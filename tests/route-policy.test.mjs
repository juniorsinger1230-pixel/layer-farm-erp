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
  await db.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('THL','Synthetic THL','PHP','active','BOOTSTRAP')");
  const store = new InMemoryAuthStore();
  const auth = new AuthService(store, { issuer: 'layer-farm-test', audience: 'layer-farm-api', signingKey });
  const mfaSecret = generateMfaSecret();
  await auth.register('admin.policy', password, { employeeId: 1, employeeNo: 'ADMIN-1', companyCode: 'THL', companyId: 1, mfaEnrolled: true, roles: [{ role: 'admin' }] }, mfaSecret);
  const app = createApp({ config: { nodeEnv: 'test', port: 3100, bodyLimitBytes: 8192, externalIntegrationsEnabled: false }, auth, database: new TestPool(db) });
  const login = await app.request('/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account: 'admin.policy', password, companyCode: 'THL', mfaCode: totp(mfaSecret) }) });
  const tokens = (await login.json()).data;
  return { db, app, tokens };
}

function call(app, tokens, method, path) {
  const init = { method, headers: { authorization: `Bearer ${tokens.accessToken}`, 'content-type': 'application/json', 'idempotency-key': `KEY-${crypto.randomUUID()}` } };
  if (method !== 'GET') init.body = JSON.stringify({});
  return app.request(path, init);
}

test('只读契约资源不暴露通用写入口', async () => {
  const { db, app, tokens } = await fixture();
  assert.equal((await call(app, tokens, 'GET', '/api/v1/inv/inventory-ledger')).status, 200);
  assert.equal((await call(app, tokens, 'POST', '/api/v1/inv/inventory-ledger')).status, 404);
  assert.equal((await call(app, tokens, 'POST', '/api/v1/inv/inventory-ledger/1/actions')).status, 404);
  assert.equal((await call(app, tokens, 'PATCH', '/api/v1/inv/inventory-ledger/1')).status, 404);
  await db.close();
});

test('无策略的非契约资源不注册通用端点', async () => {
  const { db, app, tokens } = await fixture();
  for (const method of ['GET', 'POST', 'PATCH']) {
    assert.equal((await call(app, tokens, method, '/api/v1/plat/outbox-event')).status, 404);
  }
  await db.close();
});

test('临时保留且已使用的资源仍可执行受控写入', async () => {
  const { db, app, tokens } = await fixture();
  const response = await call(app, tokens, 'POST', '/api/v1/org/organization-units');
  assert.equal(response.status, 400);
  await db.close();
});

test('启用公司目录公开可查且系统会话仅允许受控吊销', async () => {
  const { db, app, tokens } = await fixture();
  const companies = await app.request('/api/v1/auth/companies');
  assert.equal(companies.status, 200);
  assert.deepEqual((await companies.json()).data, [{ company_code: 'THL', company_name: 'Synthetic THL' }]);
  const sessionId = crypto.randomUUID();
  await db.query(
    'INSERT INTO app_auth.session (session_id,employee_id,access_expires_at,refresh_expires_at,refresh_hash) VALUES ($1,1,now()+interval \'1 hour\',now()+interval \'1 day\',$2)',
    [sessionId, 'a'.repeat(64)],
  );
  const response = await app.request(`/api/v1/plat/authentication-sessions/${sessionId}/actions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${tokens.accessToken}`, 'content-type': 'application/json', 'idempotency-key': `KEY-${crypto.randomUUID()}` },
    body: JSON.stringify({ action: 'revoke' }),
  });
  assert.equal(response.status, 200);
  assert.ok((await response.json()).data.revoked_at);
  await db.close();
});
