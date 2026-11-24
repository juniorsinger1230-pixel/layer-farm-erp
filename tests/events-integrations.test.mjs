import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFileSync, readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import WebSocket from 'ws';
import { OutboxRelay, IdempotentEventConsumer } from '../dist/packages/events/src/outbox.js';
import { NotificationHub } from '../dist/packages/events/src/websocket.js';
import { LocalAttachmentStore } from '../dist/packages/integrations/src/attachments.js';
import { PrintService, renderPrintArtifact, PRINTER_PROFILES, printerProfile, assertDocumentPaper } from '../dist/packages/integrations/src/print.js';
import { verifySignedCallback } from '../dist/packages/integrations/src/callbacks.js';
import { AuthService, InMemoryAuthStore, generateMfaSecret, totp } from '../dist/packages/security/src/auth.js';
import { createApp } from '../dist/apps/api/src/app.js';
class Pool { constructor(db) { this.db = db; } query(q, v) { return this.db.query(q, v); } async connect() { return { query: (q, v) => this.db.query(q, v), release: () => {} }; } }
async function fixture() {
  const db = new PGlite();
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8').replaceAll('CONCURRENTLY', ''));
  await db.query("SELECT set_config('app.actor_id','TEST',false),set_config('app.company_code','*',false),set_config('app.company_id','0',false)");
  await db.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('THL','Synthetic','PHP','active','TEST')");
  return { db, pool: new Pool(db) };
}
const envelope = () => ({ eventId: randomUUID(), eventType: 'test.created', aggregateType: 'test', aggregateId: '1', companyId: 1, companyCode: 'THL', payload: { value: 1 }, occurredAt: new Date().toISOString() });

test('Outbox真实数据库状态推进且消费者幂等', async () => {
  const { db, pool } = await fixture(); const event = envelope(); const published = [];
  await db.query("INSERT INTO app.outbox_event (company_id,event_id,aggregate_type,aggregate_id,event_type,event_version,payload,headers,occurred_at,available_at) VALUES (1,$1,'test','1',$2,1,'{}','{}',now(),now())", [event.eventId, event.eventType]);
  const relay = new OutboxRelay(pool, { enqueue: async (value) => { published.push(value); }, close: async () => {} });
  assert.deepEqual(await relay.publishBatch(), { published: 1, failed: 0 });
  assert.equal(published[0].companyCode, 'THL');
  assert.ok(Number.isInteger(published[0].sequence) && published[0].sequence > 0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM app.outbox_event WHERE published_at IS NOT NULL')).rows[0].n, 1);
  let calls = 0; const consume = new IdempotentEventConsumer(pool, 'test-consumer').consume(async () => { calls += 1; return { ok: true }; });
  await consume(event); await consume(event); assert.equal(calls, 1); await db.close();
});

test('WebSocket鉴权订阅心跳和公司频道推送', async () => {
  const server = createServer(); const hub = new NotificationHub();
  const wss = hub.attach(server, async (token) => { if (token !== 'valid') throw new Error('bad'); return { employeeId: 1, companyId: 1, companyCode: 'THL', channels: ['company:THL'] }; });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); const ws = new WebSocket(`ws://127.0.0.1:${address.port}/api/v1/events/ws?token=valid`);
  const messages = []; ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
  await once(ws, 'open'); await new Promise((resolve) => setTimeout(resolve, 30));
  ws.send(JSON.stringify({ type: 'subscribe', channel: 'company:THL' }));
  await new Promise((resolve) => setTimeout(resolve, 30));
  hub.publish('THL', 'company:THL', 9, envelope());
  ws.send(JSON.stringify({ type: 'ping' }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(messages[0].type, 'ready'); assert.ok(messages.some((m) => m.type === 'subscribed')); assert.ok(messages.some((m) => m.type === 'event' && m.sequence === 9)); assert.equal(messages.at(-1).type, 'pong'); assert.ok(!messages.some((m) => m.type === 'error'));
  ws.close(); wss.close(); server.close();
});

test('事件消费者接管过期处理租约并保留完成后的幂等记录', async () => {
  const { db, pool } = await fixture(); const event = envelope();
  await db.query("INSERT INTO app.outbox_event (company_id,event_id,aggregate_type,aggregate_id,event_type,event_version,payload,headers,occurred_at,available_at) VALUES (1,$1,'test','1',$2,1,'{}','{}',now(),now())", [event.eventId, event.eventType]);
  await db.query("INSERT INTO app.idempotency_consumption (company_id,consumer_name,event_id,idempotency_key,request_hash,processing_status,first_received_at,expires_at) VALUES (1,'lease-consumer',$1,'lease-key','x','processing',now()-interval '10 minutes',now()-interval '1 second')", [event.eventId]);
  let calls = 0;
  const consume = new IdempotentEventConsumer(pool, 'lease-consumer').consume(async () => { calls += 1; return { ok: true }; });
  await consume(event);
  const row = (await db.query("SELECT processing_status,expires_at>now() AS active FROM app.idempotency_consumption WHERE company_id=1 AND consumer_name='lease-consumer' AND event_id=$1", [event.eventId])).rows[0];
  assert.equal(calls, 1); assert.equal(row.processing_status, 'completed'); assert.equal(row.active, true);
  await consume(event); assert.equal(calls, 1);
  await db.close();
});

test('WebSocket重放只返回当前公司的已发布事件', async () => {
  const { db, pool } = await fixture();
  await db.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('TGE','Synthetic 2','PHP','active','TEST')");
  await db.query("INSERT INTO app.outbox_event (company_id,event_id,aggregate_type,aggregate_id,event_type,event_version,payload,headers,occurred_at,available_at,published_at) VALUES (1,$1,'test','1','thl.event',1,'{}','{}',now(),now(),now())", [randomUUID()]);
  await db.query("INSERT INTO app.outbox_event (company_id,event_id,aggregate_type,aggregate_id,event_type,event_version,payload,headers,occurred_at,available_at,published_at) VALUES (2,$1,'test','1','tge.event',1,'{}','{}',now(),now(),now())", [randomUUID()]);
  const sent = [];
  const socket = { principal: { employeeId: 1, companyId: 1, companyCode: 'THL' }, channels: new Set(['company:THL']), send: (message) => sent.push(JSON.parse(message)) };
  const hub = new NotificationHub();
  const count = await hub.replay(pool, socket, 0);
  assert.equal(count, 1); assert.equal(sent.length, 1); assert.equal(sent[0].event.eventType, 'thl.event');
  await db.close();
});

test('附件哈希、路径阻断及三类打印字节渲染', async () => {
  const root = await mkdtemp(join(tmpdir(), 'erp-attachment-')); const store = new LocalAttachmentStore(root);
  const stored = await store.put(Buffer.from('synthetic'), 'pdf'); assert.equal(stored.sha256.length, 64); assert.equal(Buffer.from(await store.get(stored.key)).toString(), 'synthetic');
  await assert.rejects(() => store.get('../../secret.pdf'));
  const pdf = await renderPrintArtifact('pdf', { widthMm: 148, heightMm: 210 }, ['Delivery D-001']); assert.equal(Buffer.from(pdf.content).subarray(0, 4).toString(), '%PDF');
  const escp = await renderPrintArtifact('escp', { widthMm: 241, heightMm: 140 }, ['VOUCHER']); assert.deepEqual([...escp.content.slice(0, 2)], [27, 64]);
  const tspl = await renderPrintArtifact('tspl', { widthMm: 80, heightMm: 60 }, ['EGG-001']); assert.match(Buffer.from(tspl.content).toString(), /SIZE 80 mm,60 mm/);
  await assert.rejects(() => renderPrintArtifact('pdf', { widthMm: 210, heightMm: 297 }, ['中文无字体']), /嵌入字体/);
  await rm(root, { recursive: true, force: true });
});

test('权威七台打印机型号和纸张规则全部通过软件矩阵', async () => {
  const baseline = PRINTER_PROFILES.filter((item) => item.baseline);
  assert.equal(baseline.length, 7);
  for (const device of baseline) {
    assert.equal(printerProfile(device.brand, device.model).format, device.format);
    assertDocumentPaper('delivery_note', 'Legal', device.model);
    assertDocumentPaper('cash_voucher', 'half_A4', device.model);
    assert.throws(() => assertDocumentPaper('cash_voucher', 'Legal', device.model), /半A4/);
    const artifact = await renderPrintArtifact(device.format, { widthMm: 148, heightMm: 210 }, [`${device.brand} ${device.model}`]);
    assert.ok(artifact.content.byteLength > 10);
  }
  assert.throws(() => printerProfile('EPSON', 'UNKNOWN'), /受控打印矩阵/);
});

test('打印任务持久化并仅在实际适配成功后完成', async () => {
  const { db, pool } = await fixture(); const root = await mkdtemp(join(tmpdir(), 'erp-print-'));
  const template = await db.query("INSERT INTO app.print_template (template_code,template_name,template_type,paper_size_code,paper_dimensions_mm,company_code,created_by) VALUES ('T1','Egg label','label','80x60','80x60','THL','TEST') RETURNING id");
  const device = await db.query("INSERT INTO app.printer_device (device_code,device_brand,device_model,supported_paper,device_status,company_code,created_by) VALUES ('D1','Gprinter','M421','80x60','online','THL','TEST') RETURNING id");
  const calls = []; const adapters = new Map([['tspl', { send: async (content, format) => { calls.push({ content, format }); return { externalRef: 'LOCAL-1' }; } }]]);
  const service = new PrintService(pool, { actorId: 'TEST', employeeId: 1, companyCode: 'THL', companyId: 1 }, new LocalAttachmentStore(root), adapters);
  const submitted = await service.submit({ templateId: Number(template.rows[0].id), deviceId: Number(device.rows[0].id), lines: ['EGG-001'] }, 'PRINT-IDEM-1');
  const dispatched = await service.dispatch(submitted.id); assert.equal(dispatched.status, 'completed'); assert.equal(calls.length, 1); assert.equal(calls[0].format, 'tspl');
  await db.close(); await rm(root, { recursive: true, force: true });
});

test('附件到期后物理删除且保留可审计销毁元数据', async () => {
  const { db, pool } = await fixture(); const root = await mkdtemp(join(tmpdir(), 'erp-retention-'));
  const store = new LocalAttachmentStore(root);
  const service = new PrintService(pool, { actorId: 'TEST', employeeId: 1, companyCode: 'THL', companyId: 1 }, store, new Map());
  const uploaded = await service.upload(Buffer.from('synthetic-retention'), 'evidence.pdf', 'application/pdf', 'TEST-OWNER');
  const path = (await db.query('SELECT file_path FROM app.attachment WHERE id=$1', [uploaded.id])).rows[0].file_path;
  await db.query("UPDATE app.attachment SET retention_until=now()-interval '1 second' WHERE id=$1", [uploaded.id]);
  assert.deepEqual(await service.destroyExpired(), { destroyed: 1 });
  await assert.rejects(() => store.get(path));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM app.attachment WHERE id=$1 AND destroyed_at IS NOT NULL', [uploaded.id])).rows[0].n, 1);
  assert.deepEqual(await service.destroyExpired(), { destroyed: 0 });
  await db.close(); await rm(root, { recursive: true, force: true });
});

test('HMAC回调验签拒绝重放和过期时间戳', async () => {
  const body = Buffer.from('{"ok":true}'); const secret = 'synthetic-secret'; const timestamp = '1000'; const signature = createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex'); const claimed = new Set();
  const replayGuard = { claim: async (key) => { if (claimed.has(key)) return false; claimed.add(key); return true; } };
  await verifySignedCallback({ rawBody: body, timestamp, signature, secret, eventId: 'event-1', nowSeconds: 1001, replayGuard });
  await assert.rejects(() => verifySignedCallback({ rawBody: body, timestamp, signature, secret, eventId: 'event-1', nowSeconds: 1001, replayGuard }), /Duplicate/);
  await assert.rejects(() => verifySignedCallback({ rawBody: body, timestamp, signature, secret, eventId: 'event-2', nowSeconds: 2000, replayGuard }), /Invalid callback signature envelope/);
});

test('DLQ查询与重放运维入口执行独立管理员鉴权和404契约', async () => {
  const store = new InMemoryAuthStore();
  const auth = new AuthService(store, { issuer: 'layer-farm-test', audience: 'layer-farm-api', signingKey: 'test-only-signing-key-with-at-least-32-bytes' });
  const mfaSecret = generateMfaSecret();
  await auth.register('dlq.admin', 'Synthetic-Test-Passw0rd!2026', { employeeId: 99, employeeNo: 'DLQ-ADMIN', companyCode: 'THL', companyId: 1, mfaEnrolled: true, roles: [{ role: 'admin' }] }, mfaSecret);
  const replayed = [];
  const app = createApp({ config: { nodeEnv: 'test', port: 3100, bodyLimitBytes: 4096, externalIntegrationsEnabled: false }, auth, deadLetters: { list: async (limit) => ({ items: [{ jobId: 'dlq-1' }], limit }), replay: async (jobId) => { if (jobId === 'missing') throw new Error('Dead-letter job not found'); replayed.push(jobId); } } });
  const denied = await app.request('/api/v1/events/dead-letters');
  assert.equal(denied.status, 401);
  const login = await app.request('/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account: 'dlq.admin', password: 'Synthetic-Test-Passw0rd!2026', companyCode: 'THL', mfaCode: totp(mfaSecret) }) });
  const { data } = await login.json();
  const headers = { authorization: `Bearer ${data.accessToken}` };
  const listed = await app.request('/api/v1/events/dead-letters?limit=1', { headers });
  assert.equal(listed.status, 200);
  assert.deepEqual((await listed.json()).data, { items: [{ jobId: 'dlq-1' }], limit: 1 });
  const replay = await app.request('/api/v1/events/dead-letters/dlq-1/replay', { method: 'POST', headers });
  assert.equal(replay.status, 200); assert.deepEqual(replayed, ['dlq-1']);
  const missing = await app.request('/api/v1/events/dead-letters/missing/replay', { method: 'POST', headers });
  assert.equal(missing.status, 404);
});
