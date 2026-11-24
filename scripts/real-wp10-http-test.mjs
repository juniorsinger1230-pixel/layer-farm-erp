import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { AuthService, totp } from '../dist/packages/security/src/auth.js';
import { PostgresAuthStore } from '../dist/packages/security/src/postgres-store.js';
import { scheduleForcedExit } from './force-exit.mjs';

const databaseUrl = process.env.DATABASE_URL;
const valkeyUrl = process.env.VALKEY_URL;
if (!databaseUrl || !valkeyUrl) throw new Error('DATABASE_URL and VALKEY_URL are required');
const pool = new pg.Pool({ connectionString: databaseUrl, max: 20 });
const evidence = [];
const record = (name, detail = {}) => { evidence.push({ name, result: 'passed', ...detail }); console.log(JSON.stringify(evidence.at(-1))); };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const request = async (base, path, options = {}) => {
  const headers = {
    'content-type': 'application/json',
    ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    ...(options.key ? { 'idempotency-key': options.key } : {}),
  };
  const response = await fetch(`${base}${path}`, { method: options.method ?? 'GET', headers, ...(options.body ? { body: JSON.stringify(options.body) } : {}) });
  const text = await response.text();
  return { status: response.status, text, body: text.startsWith('{') ? JSON.parse(text) : undefined, headers: response.headers };
};

const designElements = [{
  id: 'txt-1', type: 'text', xMm: 5, yMm: 5, widthMm: 45, heightMm: 8, rotation: 0,
  content: 'EGG-001', fontSizePt: 10, bold: false, align: 'left',
}, {
  id: 'bar-1', type: 'barcode', xMm: 5, yMm: 18, widthMm: 45, heightMm: 16, rotation: 0,
  value: 'B-1001', barcodeFormat: 'CODE128', humanReadable: true,
}];

let cancelForcedExit;
let child;
try {
  const admin = await pool.connect();
  await admin.query("SELECT set_config('app.company_code','*',false),set_config('app.company_id','0',false),set_config('app.actor_id','REAL-WP10',false)");
  await admin.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('THL','WP10 THL','PHP','active','REAL-WP10')");
  const companyId = Number((await admin.query("SELECT id FROM app.company WHERE company_code='THL'")).rows[0].id);
  await admin.query("SELECT set_config('app.company_code','THL',false),set_config('app.company_id',$1,false)", [String(companyId)]);
  const unit = await admin.query("INSERT INTO app.organization_unit (unit_code,unit_name,parent_unit_id,org_level,status,company_code,created_by) VALUES ('WP10-UNIT','WP10 Unit',null,1,'active','THL','REAL-WP10') RETURNING id");
  const position = await admin.query("INSERT INTO app.position (position_code,position_name,unit_id,headcount,reports_to_id,effective_date,status,company_code,created_by) VALUES ('WP10-POS','WP10 Position',$1,10,null,'2026-01-01','active','THL','REAL-WP10') RETURNING id", [unit.rows[0].id]);
  const employees = {};
  for (const [key, no] of [['admin', 'WP10-EMP-ADMIN'], ['staff', 'WP10-EMP-STAFF']]) {
    const inserted = await admin.query("INSERT INTO app.employee (employee_no,employee_name,position_id,account,employment_status,company_code,created_by) VALUES ($1,$2,$3,0,'active','THL','REAL-WP10') RETURNING id", [no, no, position.rows[0].id]);
    employees[key] = Number(inserted.rows[0].id);
  }
  const template = await admin.query("INSERT INTO app.print_template (template_code,template_name,template_type,paper_size_code,paper_dimensions_mm,company_code,created_by) VALUES ('TPL-1','Egg Label','label','80x60','80x60','THL','REAL-WP10') RETURNING id");
  const device = await admin.query("INSERT INTO app.printer_device (device_code,device_brand,device_model,supported_paper,device_status,company_code,created_by) VALUES ('DEV-1','Gprinter','M421','80x60','online','THL','REAL-WP10') RETURNING id");
  admin.release();

  const signingKey = 'real-wp10-signing-key-with-at-least-32-bytes';
  const authService = new AuthService(new PostgresAuthStore(pool), { issuer: 'layer-farm-erp', audience: 'layer-farm-web', signingKey });
  const password = 'Synthetic-Test-Passw0rd!2026';
  const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
  await authService.register('admin.wp10', password, { employeeId: employees.admin, employeeNo: 'WP10-EMP-ADMIN', companyCode: 'THL', companyId, mfaEnrolled: true, roles: [{ role: 'admin' }] }, secret);
  await authService.register('staff.wp10', password, { employeeId: employees.staff, employeeNo: 'WP10-EMP-STAFF', companyCode: 'THL', companyId, mfaEnrolled: true, roles: [{ role: 'sales_staff' }] }, secret);

  const port = 3216;
  const serverPath = fileURLToPath(new URL('../dist/apps/api/src/server.js', import.meta.url));
  child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env, NODE_ENV: 'test', PORT: String(port), DATABASE_URL: databaseUrl, VALKEY_URL: valkeyUrl,
      JWT_SIGNING_KEY: signingKey, PRINT_SANDBOX_MODE: 'true', ATTACHMENT_DIR: '/tmp',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (data) => process.stdout.write(data));
  child.stderr.on('data', (data) => process.stderr.write(data));
  const base = `http://127.0.0.1:${port}`;
  for (let index = 0; index < 30; index += 1) {
    try {
      const ready = await fetch(`${base}/health/ready`);
      if (ready.status === 200) break;
    } catch { await sleep(500); continue; }
    await sleep(500);
  }
  const ready = await request(base, '/health/ready');
  assert.equal(ready.status, 200, ready.text);

  let login = await request(base, '/api/v1/auth/login', { method: 'POST', body: { account: 'admin.wp10', password, companyCode: 'THL', mfaCode: totp(secret) } });
  assert.equal(login.status, 200, login.text);
  const adminToken = login.body.data.accessToken;
  login = await request(base, '/api/v1/auth/login', { method: 'POST', body: { account: 'staff.wp10', password, companyCode: 'THL', mfaCode: totp(secret) } });
  assert.equal(login.status, 200, login.text);
  const staffToken = login.body.data.accessToken;

  const staffRead = await request(base, `/api/v1/print/print-templates/${template.rows[0].id}/design`, { token: staffToken });
  assert.equal(staffRead.status, 200, staffRead.text);
  assert.equal(staffRead.body.data, null);
  const staffCreate = await request(base, `/api/v1/print/print-templates/${template.rows[0].id}/design`, { method: 'POST', token: staffToken, key: 'WP10-STAFF-DENIED', body: { widthMm: 80, heightMm: 60, elements: designElements } });
  assert.equal(staffCreate.status, 403, staffCreate.text);
  record('REAL-WP10-001 RBAC读取、设计创建权限和真实HTTP鉴权');

  const first = await request(base, `/api/v1/print/print-templates/${template.rows[0].id}/design`, { method: 'POST', token: adminToken, key: 'WP10-DESIGN-1', body: { widthMm: 80, heightMm: 60, elements: designElements } });
  assert.equal(first.status, 201, first.text);
  const publishFirst = await request(base, `/api/v1/print/print-templates/${template.rows[0].id}/design/${first.body.data.id}/publish`, { method: 'POST', token: adminToken });
  assert.equal(publishFirst.status, 200, publishFirst.text);
  const second = await request(base, `/api/v1/print/print-templates/${template.rows[0].id}/design`, { method: 'POST', token: adminToken, key: 'WP10-DESIGN-2', body: { widthMm: 80, heightMm: 60, elements: [{ ...designElements[0], yMm: 8 }, designElements[1]] } });
  const publishSecond = await request(base, `/api/v1/print/print-templates/${template.rows[0].id}/design/${second.body.data.id}/publish`, { method: 'POST', token: adminToken });
  assert.equal(publishSecond.status, 200, publishSecond.text);
  const latest = await request(base, `/api/v1/print/print-templates/${template.rows[0].id}/design`, { token: adminToken });
  assert.equal(latest.body.data.version, second.body.data.version);
  record('REAL-WP10-002 设计版本保存、发布、归档和最新版本查询', { version: latest.body.data.version });

  const previewResponse = await fetch(`${base}/api/v1/print/design-preview`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ widthMm: 80, heightMm: 60, elements: designElements, format: 'pdf' }) });
  const previewBytes = Buffer.from(await previewResponse.arrayBuffer());
  assert.equal(previewResponse.status, 200);
  assert.equal(previewResponse.headers.get('content-type'), 'application/pdf');
  assert.equal(previewBytes.subarray(0, 4).toString(), '%PDF');
  record('REAL-WP10-003 Canvas设计生成真实PDF字节', { bytes: previewBytes.byteLength });

  const submitted = await request(base, '/api/v1/print/print-job/submit', { method: 'POST', token: adminToken, key: 'WP10-PRINT-JOB', body: { templateId: Number(template.rows[0].id), deviceId: Number(device.rows[0].id), designVersion: second.body.data.version } });
  assert.equal(submitted.status, 201, submitted.text);
  assert.equal(submitted.body.data.queue_status, 'pending');
  assert.equal(submitted.body.data.format, 'tspl');
  record('REAL-WP10-004 按已发布设计生成受控打印任务', { jobId: submitted.body.data.id });

  const dispatched = await request(base, `/api/v1/print/print-job/${submitted.body.data.id}/dispatch`, { method: 'POST', token: adminToken });
  assert.equal(dispatched.status, 200, dispatched.text);
  assert.equal(dispatched.body.data.status, 'completed');
  assert.match(dispatched.body.data.externalRef, /^SANDBOX-tspl-/);
  const repeat = await request(base, `/api/v1/print/print-job/${submitted.body.data.id}/dispatch`, { method: 'POST', token: adminToken });
  assert.equal(repeat.status, 409, repeat.text);
  const logs = await pool.query('SELECT count(*)::int AS n FROM app.print_log WHERE company_code=$1', ['THL']);
  assert.equal(logs.rows[0].n, 1);
  record('REAL-WP10-005 沙箱适配器发送、状态回写、打印日志和重复派发阻断', { externalRef: dispatched.body.data.externalRef });

  console.log(JSON.stringify({ result: 'passed', evidence: evidence.length, items: evidence }, null, 2));
} finally {
  cancelForcedExit = scheduleForcedExit(5000);
  if (child) {
    child.kill('SIGTERM');
    await once(child, 'exit').catch(() => {});
  }
  await pool.end();
  cancelForcedExit();
}
