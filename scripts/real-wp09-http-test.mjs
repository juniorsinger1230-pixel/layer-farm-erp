import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import WebSocket from 'ws';
import { AuthService, totp } from '../dist/packages/security/src/auth.js';
import { PostgresAuthStore } from '../dist/packages/security/src/postgres-store.js';
import { scheduleForcedExit } from './force-exit.mjs';

const databaseUrl = process.env.DATABASE_URL;
const valkeyUrl = process.env.VALKEY_URL;
if (!databaseUrl || !valkeyUrl) throw new Error('DATABASE_URL and VALKEY_URL are required');
const pool = new pg.Pool({ connectionString: databaseUrl, max: 20 });
const queueRedis = new Redis(valkeyUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
const evidence = [];
const record = (name, detail) => { evidence.push({ name, result: 'passed', ...detail }); console.log(JSON.stringify(evidence.at(-1))); };
const waitForMessage = (ws, predicate, timeoutMs = 15000) => new Promise((resolve, reject) => {
  const onMessage = (data) => {
    const message = JSON.parse(data.toString());
    if (predicate(message)) { ws.off('message', onMessage); resolve(message); }
  };
  const timer = setTimeout(() => { ws.off('message', onMessage); reject(new Error('Expected WebSocket message was not received')); }, timeoutMs);
  ws.on('message', onMessage);
  waitForMessage.timer = timer;
});
const request = async (base, path, options = {}) => {
  const headers = { 'content-type': 'application/json', ...(options.token ? { authorization: `Bearer ${options.token}` } : {}), ...(options.key ? { 'idempotency-key': options.key } : {}) };
  const response = await fetch(`${base}${path}`, { method: options.method ?? 'GET', headers, ...(options.body ? { body: JSON.stringify(options.body) } : {}) });
  const text = await response.text();
  return { status: response.status, text, body: text.startsWith('{') ? JSON.parse(text) : undefined };
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let cancelForcedExit;
let child;
try {
  const admin = new pg.Client({ connectionString: databaseUrl });
  await admin.connect();
  await admin.query("SELECT set_config('app.company_code','*',false), set_config('app.company_id','0',false), set_config('app.actor_id','REAL-WP09',false)");
  if ((await admin.query('SELECT id FROM app.company WHERE company_code=$1', ['THL'])).rowCount === 0) {
    await admin.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('THL','WP09 THL','PHP','active','REAL-WP09')");
  }
  if ((await admin.query('SELECT id FROM app.company WHERE company_code=$1', ['TGE'])).rowCount === 0) {
    await admin.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('TGE','WP09 TGE','PHP','active','REAL-WP09')");
  }
  const companyId = Number((await admin.query("SELECT id FROM app.company WHERE company_code='THL'")).rows[0].id);
  const tgeCompanyId = Number((await admin.query("SELECT id FROM app.company WHERE company_code='TGE'")).rows[0].id);

  await admin.query("DELETE FROM app_ops.account_balance_snapshot WHERE company_code='THL' AND period_id IN (SELECT id FROM app_ops.accounting_period WHERE company_code='THL' AND period_code='2026-NOV')");
  await admin.query("DELETE FROM app_ops.accounting_period WHERE company_code='THL' AND period_code='2026-NOV'");
  await admin.query("DELETE FROM app.idempotency_consumption WHERE company_id=$1 AND (consumer_name='websocket-notifications' OR consumer_name LIKE 'finance:%')", [companyId]);
  await admin.query("DELETE FROM app_ops.journal_line WHERE company_code='THL' AND entry_id IN (SELECT id FROM app_ops.journal_entry WHERE company_code='THL' AND created_by IN ('REAL-WP09','WP09-EMP-ADMIN'))");
  await admin.query("DELETE FROM app_ops.journal_entry WHERE company_code='THL' AND created_by IN ('REAL-WP09','WP09-EMP-ADMIN')");
  await admin.query("DELETE FROM app.outbox_event WHERE company_id=$1", [companyId]);
  await admin.query('DELETE FROM app.outbox_event WHERE company_id=$1', [tgeCompanyId]);
  const tgeEventId = randomUUID();
  await admin.query("INSERT INTO app.outbox_event (company_id,event_id,aggregate_type,aggregate_id,event_type,event_version,payload,headers,occurred_at,available_at,published_at) VALUES ($1,$2,'test','TGE','cross.company.event',1,'{}','{}',now(),now(),now())", [tgeCompanyId, tgeEventId]);

  if ((await admin.query('SELECT id FROM app.organization_unit WHERE unit_code=$1', ['WP09-UNIT'])).rowCount === 0) {
    await admin.query("INSERT INTO app.organization_unit (unit_code,unit_name,parent_unit_id,org_level,status,company_code,created_by) VALUES ('WP09-UNIT','WP09 Unit',null,1,'active','THL','REAL-WP09')");
  }
  const unitId = Number((await admin.query("SELECT id FROM app.organization_unit WHERE unit_code='WP09-UNIT'")).rows[0].id);
  if ((await admin.query('SELECT id FROM app.position WHERE position_code=$1', ['WP09-POS'])).rowCount === 0) {
    await admin.query("INSERT INTO app.position (position_code,position_name,unit_id,headcount,reports_to_id,effective_date,status,company_code,created_by) VALUES ('WP09-POS','WP09 Position',$1,10,null,'2026-01-01','active','THL','REAL-WP09')", [unitId]);
  }
  const positionId = Number((await admin.query("SELECT id FROM app.position WHERE position_code='WP09-POS'")).rows[0].id);
  const employeeIds = {};
  for (const [key, no] of Object.entries({ admin: 'WP09-EMP-ADMIN', staff: 'WP09-EMP-STAFF' })) {
    const existing = await admin.query('SELECT id FROM app.employee WHERE employee_no=$1', [no]);
    if (existing.rowCount === 0) {
      const inserted = await admin.query("INSERT INTO app.employee (employee_no,employee_name,position_id,account,employment_status,company_code,created_by) VALUES ($1,$2,$3,0,'active','THL','REAL-WP09') RETURNING id", [no, no, positionId]);
      employeeIds[key] = Number(inserted.rows[0].id);
    } else employeeIds[key] = Number(existing.rows[0].id);
  }

  const signingKey = 'real-wp09-signing-key-with-at-least-32-bytes';
  const auth = new AuthService(new PostgresAuthStore(pool), { issuer: 'layer-farm-erp', audience: 'layer-farm-web', signingKey });
  const password = 'Synthetic-Test-Passw0rd!2026';
  const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
  await admin.query("DELETE FROM app_auth.credential WHERE account IN ('admin.wp09','staff.wp09') AND company_code='THL'");
  await auth.register('admin.wp09', password, { employeeId: employeeIds.admin, employeeNo: 'WP09-EMP-ADMIN', companyCode: 'THL', companyId, mfaEnrolled: true, roles: [{ role: 'admin' }] }, secret);
  await auth.register('staff.wp09', password, { employeeId: employeeIds.staff, employeeNo: 'WP09-EMP-STAFF', companyCode: 'THL', companyId, mfaEnrolled: true, roles: [{ role: 'sales_staff' }] }, secret);
  await admin.end();

  const port = 3215;
  const queueName = `wp09-events-${Date.now()}`;
  const serverPath = fileURLToPath(new URL('../dist/apps/api/src/server.js', import.meta.url));
  child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env, NODE_ENV: 'test', PORT: String(port), DATABASE_URL: databaseUrl, VALKEY_URL: valkeyUrl,
      JWT_SIGNING_KEY: signingKey, EVENT_QUEUE_NAME: queueName, ATTACHMENT_DIR: '/tmp',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (data) => process.stdout.write(data));
  child.stderr.on('data', (data) => process.stderr.write(data));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 30; i += 1) {
    try {
      const ready = await fetch(`${base}/health/ready`);
      if (ready.status === 200) break;
    } catch {
      await sleep(500);
      continue;
    }
    await sleep(500);
  }
  const ready = await request(base, '/health/ready');
  assert.equal(ready.status, 200, ready.text); assert.equal(ready.body.status, 'ok');

  let loginResponse = await request(base, '/api/v1/auth/login', { method: 'POST', body: { account: 'admin.wp09', password, companyCode: 'THL', mfaCode: totp(secret) } });
  assert.equal(loginResponse.status, 200, loginResponse.text);
  const adminToken = loginResponse.body.data.accessToken;
  loginResponse = await request(base, '/api/v1/auth/login', { method: 'POST', body: { account: 'staff.wp09', password, companyCode: 'THL', mfaCode: totp(secret) } });
  assert.equal(loginResponse.status, 200, loginResponse.text);
  const staffToken = loginResponse.body.data.accessToken;

  const invalidWs = new WebSocket(`ws://127.0.0.1:${port}/api/v1/events/ws?token=invalid`);
  const [closeCode] = await once(invalidWs, 'close');
  assert.equal(closeCode, 1008);
  const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v1/events/ws?token=${encodeURIComponent(adminToken)}`);
  await once(ws, 'open');
  const readyMessage = await waitForMessage(ws, (message) => message.type === 'ready');
  assert.equal(readyMessage.companyCode, 'THL');
  ws.send(JSON.stringify({ type: 'subscribe', channel: 'company:THL' }));
  const subscribed = await waitForMessage(ws, (message) => message.type === 'subscribed');
  assert.equal(subscribed.channel, 'company:THL');
  record('REAL-WP09-001 真实WebSocket鉴权、非法令牌拒绝和频道订阅', { invalidClose: closeCode });

  const periodResponse = await request(base, '/api/v1/fin/periods', { method: 'POST', token: adminToken, key: 'WP09-PERIOD', body: { periodCode: '2026-NOV', periodStart: '2026-11-01', periodEnd: '2026-11-30' } });
  assert.equal(periodResponse.status, 201, periodResponse.text);
  const journalResponse = await request(base, '/api/v1/fin/journal-entries', { method: 'POST', token: adminToken, key: 'WP09-JOURNAL', body: { entryDate: '2026-11-10', lines: [{ accountCode: 'CASH', debit: 500 }, { accountCode: 'REV.SALES', credit: 500 }] } });
  assert.equal(journalResponse.status, 201, journalResponse.text);
  const liveEvent = await waitForMessage(ws, (message) => message.type === 'event' && message.event?.eventType === 'journal_entry.post', 20000);
  assert.equal(liveEvent.channel, 'company:THL'); assert.equal(liveEvent.event.companyCode, 'THL');
  let published;
  let consumed;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    published = await pool.query('SELECT published_at IS NOT NULL AS done FROM app.outbox_event WHERE company_id=$1 AND event_type=$2', [companyId, 'journal_entry.post']);
    consumed = await pool.query("SELECT processing_status FROM app.idempotency_consumption WHERE company_id=$1 AND consumer_name='websocket-notifications'", [companyId]);
    if (published.rows[0]?.done && consumed.rows[0]?.processing_status === 'completed') break;
    await sleep(100);
  }
  assert.equal(published.rows[0]?.done, true); assert.equal(consumed.rows[0]?.processing_status, 'completed');
  record('REAL-WP09-002 Outbox、BullMQ、幂等消费者到WebSocket实时投递闭环', { eventType: liveEvent.event.eventType });

  ws.send(JSON.stringify({ type: 'replay', afterSequence: 0 }));
  const replayed = await waitForMessage(ws, (message) => message.type === 'event' && message.event?.eventType === 'journal_entry.post', 10000);
  await sleep(500);
  assert.equal(replayed.event.companyCode, 'THL');
  const crossCompany = await pool.query('SELECT count(*)::int AS n FROM app.outbox_event WHERE company_id=$1 AND event_id=$2', [tgeCompanyId, tgeEventId]);
  assert.equal(crossCompany.rows[0].n, 1);
  record('REAL-WP09-003 WebSocket重放且公司隔离过滤跨公司事件', { replayedEvent: replayed.event.eventId });

  const staffDlq = await request(base, '/api/v1/events/dead-letters', { token: staffToken });
  assert.equal(staffDlq.status, 403, staffDlq.text);
  const dlq = new Queue(`${queueName}-dlq`, { connection: queueRedis });
  const replayEventId = randomUUID();
  await dlq.add('dead-letter', {
    event: { eventId: replayEventId, eventType: 'wp09.replay', aggregateType: 'test', aggregateId: '1', companyId, companyCode: 'THL', payload: { replay: true }, occurredAt: new Date().toISOString() },
    sourceJobId: 'wp09-source-job', attemptsMade: 1, failedReason: 'synthetic dead letter', failedAt: new Date().toISOString(),
  }, { jobId: 'wp09-dlq-1' });
  const listed = await request(base, '/api/v1/events/dead-letters?limit=10', { token: adminToken });
  assert.equal(listed.status, 200, listed.text);
  assert.ok(Array.isArray(listed.body.data));
  assert.ok(listed.body.data.some((item) => item.eventId === replayEventId));
  const replayWait = waitForMessage(ws, (message) => message.type === 'event' && message.event?.eventId === replayEventId, 15000);
  const replayResponse = await request(base, '/api/v1/events/dead-letters/wp09-dlq-1/replay', { method: 'POST', token: adminToken, key: 'WP09-DLQ-REPLAY' });
  assert.equal(replayResponse.status, 200, replayResponse.text);
  const replayedEvent = await replayWait;
  assert.equal(replayedEvent.event.payload.replay, true);
  const removedJob = await dlq.getJob('wp09-dlq-1');
  assert.ok(removedJob === null || removedJob === undefined);
  await dlq.close();
  record('REAL-WP09-004 DLQ权限、查询、HTTP重放和重新消费闭环', { eventId: replayEventId });

  console.log(JSON.stringify({ result: 'passed', evidence: evidence.length, items: evidence }, null, 2));
} finally {
  cancelForcedExit = scheduleForcedExit(5000);
  if (child) {
    child.kill('SIGTERM');
    await once(child, 'exit').catch(() => {});
  }
  await pool.end();
  queueRedis.disconnect();
  cancelForcedExit();
}
