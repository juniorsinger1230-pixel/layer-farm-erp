import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../dist/apps/api/src/app.js';
import { AuthService, InMemoryAuthStore, generateMfaSecret, totp } from '../dist/packages/security/src/auth.js';

const password = 'Synthetic-Test-Passw0rd!2026';
const signingKey = 'test-only-signing-key-with-at-least-32-bytes';

class TestPool {
  constructor(db) { this.db = db; }
  query(text, values) { return this.db.query(text, values); }
  async connect() {
    const db = this.db;
    return { query: (text, values) => db.query(text, values), release: () => {} };
  }
}

async function fixture() {
  const db = new PGlite();
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8').replaceAll('CONCURRENTLY', ''));
  }
  await db.query("SELECT set_config('app.actor_id','BOOTSTRAP',false),set_config('app.company_code','*',false),set_config('app.company_id','0',false)");
  await db.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('THL','Synthetic THL','PHP','active','BOOTSTRAP'),('TGE','Synthetic TGE','PHP','active','BOOTSTRAP')");
  const store = new InMemoryAuthStore();
  const auth = new AuthService(store, { issuer: 'layer-farm-test', audience: 'layer-farm-api', signingKey });
  const mfaSecret = generateMfaSecret();
  await auth.register('admin.test', password, { employeeId: 1, employeeNo: 'ADMIN-1', companyCode: 'THL', companyId: 1, mfaEnrolled: true, roles: [{ role: 'admin' }] }, mfaSecret);
  await auth.register('feeder.domain', password, { employeeId: 2, employeeNo: 'FEED-2', companyCode: 'THL', companyId: 1, mfaEnrolled: false, roles: [{ role: 'feeder', scopeConfig: { companyCodes: ['THL'], houseIds: [1] } }] });
  const app = createApp({ config: { nodeEnv: 'test', port: 3100, bodyLimitBytes: 8192, externalIntegrationsEnabled: false }, auth, database: new TestPool(db) });
  const login = await app.request('/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account: 'admin.test', password, companyCode: 'THL', mfaCode: totp(mfaSecret) }) });
  const tokens = (await login.json()).data;
  return { db, app, tokens };
}

function call(app, tokens, method, path, body, key = `KEY-${crypto.randomUUID()}`, extraHeaders = {}) {
  return app.request(path, { method, headers: { authorization: `Bearer ${tokens.accessToken}`, 'content-type': 'application/json', 'idempotency-key': key, ...extraHeaders }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

test('组织主数据创建、幂等重放、冲突和审计outbox完整落库', async () => {
  const { db, app, tokens } = await fixture();
  const input = { unit_code: 'UNIT-001', unit_name: 'Synthetic Farm Unit', org_level: 1, status: 'active' };
  const first = await call(app, tokens, 'POST', '/api/v1/org/organization-units', input, 'IDEM-ORG-0001');
  assert.equal(first.status, 201);
  const created = (await first.json()).data;
  assert.equal(created.company_code, 'THL');
  assert.equal(created.created_by, 'ADMIN-1');
  const replay = await call(app, tokens, 'POST', '/api/v1/org/organization-units', input, 'IDEM-ORG-0001');
  assert.equal((await replay.json()).data.id, created.id);
  const conflict = await call(app, tokens, 'POST', '/api/v1/org/organization-units', { ...input, unit_name: 'Changed' }, 'IDEM-ORG-0001');
  assert.equal(conflict.status, 409);
  assert.equal(Number((await db.query("SELECT count(*)::int AS n FROM app.organization_unit")).rows[0].n), 1);
  assert.equal(Number((await db.query("SELECT count(*)::int AS n FROM app.audit_log WHERE operation='organization_unit.create'")).rows[0].n), 1);
  assert.equal(Number((await db.query("SELECT count(*)::int AS n FROM app.outbox_event WHERE event_type='organization_unit.create'")).rows[0].n), 1);
  await db.close();
});

test('公司隔离、管理员跨公司选择与RLS一致', async () => {
  const { db, app, tokens } = await fixture();
  const input = { unit_code: 'UNIT-THL', unit_name: 'THL Unit', org_level: 1, status: 'active' };
  await call(app, tokens, 'POST', '/api/v1/org/organization-units', input, 'IDEM-ORG-THL1');
  const thl = await call(app, tokens, 'GET', '/api/v1/org/organization-units');
  assert.equal((await thl.json()).data.total, 1);
  const tge = await call(app, tokens, 'GET', '/api/v1/org/organization-units', undefined, undefined, { 'x-company-code': 'TGE' });
  assert.equal((await tge.json()).data.total, 0);
  await db.close();
});

test('岗位员工引用、负数和未知字段均被精确处理', async () => {
  const { db, app, tokens } = await fixture();
  const unit = (await (await call(app, tokens, 'POST', '/api/v1/org/organization-units', { unit_code: 'U-1', unit_name: 'Unit 1', org_level: 1, status: 'active' }, 'IDEM-UNIT-0001')).json()).data;
  const invalid = await call(app, tokens, 'POST', '/api/v1/org/positions', { position_code: 'P-1', position_name: 'Manager', unit_id: unit.id, headcount: -1, effective_date: '2026-11-23', status: 'active' }, 'IDEM-POS-NEG1');
  assert.equal(invalid.status, 400);
  const positionResponse = await call(app, tokens, 'POST', '/api/v1/org/positions', { position_code: 'P-1', position_name: 'Manager', unit_id: unit.id, headcount: 1, effective_date: '2026-11-23', status: 'active' }, 'IDEM-POS-0001');
  assert.equal(positionResponse.status, 201);
  const position = (await positionResponse.json()).data;
  const unknown = await call(app, tokens, 'POST', '/api/v1/org/employee-accounts', { employee_no: 'E-1', employee_name: 'Synthetic Employee', position_id: position.id, account: 0, employment_status: 'active', is_admin: true }, 'IDEM-EMP-UNK1');
  assert.equal(unknown.status, 400);
  const employee = await call(app, tokens, 'POST', '/api/v1/org/employee-accounts', { employee_no: 'E-1', employee_name: 'Synthetic Employee', position_id: position.id, account: 0, employment_status: 'active' }, 'IDEM-EMP-0001');
  assert.equal(employee.status, 201);
  await db.close();
});

test('鸡群栋舍和雏鸡验收执行应用层引用与数值规则', async () => {
  const { db, app, tokens } = await fixture();
  const house = await call(app, tokens, 'POST', '/api/v1/farm/houses-and-pens', { house_code: 'H-01', house_name: 'Layer House 01', pen_count: 4, floor_count: 3, farm_mode: 'cage', house_status: 'active' }, 'IDEM-HOUSE-001');
  assert.equal(house.status, 201);
  assert.equal(typeof (await house.clone().json()).data.company_code, 'number');
  const batchResponse = await call(app, tokens, 'POST', '/api/v1/farm/flock-batches', { batch_no: 'B-2026-01', breed: 'Lohmann Pink', source: 'Synthetic Supplier', chick_date: '2026-01-01', initial_quantity: 10000, day_age: 326, stage: 'laying' }, 'IDEM-BATCH-001');
  const batch = (await batchResponse.json()).data;
  const receipt = await call(app, tokens, 'POST', '/api/v1/farm/chick-arrival-inspections', { batch_id: batch.id, count_quantity: 10000, avg_weight: 35.5, qualified: 'qualified', gifted_quantity: 50 }, 'IDEM-CHICK-001');
  assert.equal(receipt.status, 201);
  const missing = await call(app, tokens, 'POST', '/api/v1/farm/chick-arrival-inspections', { batch_id: 999999, count_quantity: 1, avg_weight: 35.5, qualified: 'qualified', gifted_quantity: 0 }, 'IDEM-CHICK-404');
  assert.equal(missing.status, 400);
  const badTransfer = await call(app, tokens, 'POST', '/api/v1/farm/flock-transfers', { batch_id: batch.id, from_house_id: 1, to_house_id: 1, fasting: true, headcount_check: 100 }, 'IDEM-TRANS-SAME');
  assert.equal(badTransfer.status, 400);
  await db.close();
});

test('乐观锁防止覆盖并发更新且生成版本历史', async () => {
  const { db, app, tokens } = await fixture();
  const created = (await (await call(app, tokens, 'POST', '/api/v1/org/organization-units', { unit_code: 'U-LOCK', unit_name: 'Before', org_level: 1, status: 'active' }, 'IDEM-LOCK-0001')).json()).data;
  const stale = await call(app, tokens, 'PATCH', `/api/v1/org/organization-units/${created.id}`, { unit_name: 'After' }, undefined, { 'if-match': '2000-01-01T00:00:00.000Z' });
  assert.equal(stale.status, 409);
  const updated = await call(app, tokens, 'PATCH', `/api/v1/org/organization-units/${created.id}`, { unit_name: 'After' }, undefined, { 'if-match': created.updated_at ?? created.created_at });
  assert.equal(updated.status, 200);
  assert.equal(Number((await db.query("SELECT count(*)::int AS n FROM app.version_history WHERE entity_ref=$1", [`organization_unit:${created.id}`])).rows[0].n), 1);
  await db.close();
});

test('普通养殖工可按矩阵读组织但不能写主数据', async () => {
  const { db, app } = await fixture();
  const login = await app.request('/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account: 'feeder.domain', password, companyCode: 'THL' }) });
  const feederTokens = (await login.json()).data;
  assert.equal((await call(app, feederTokens, 'GET', '/api/v1/org/organization-units')).status, 200);
  assert.equal((await call(app, feederTokens, 'POST', '/api/v1/org/positions', { position_code: 'X', position_name: 'X', headcount: 1 })).status, 403);
  await db.close();
});
