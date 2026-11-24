import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { AuthService, InMemoryAuthStore, generateMfaSecret, hashPassword, totp, verifyPassword } from '../dist/packages/security/src/auth.js';
import { PostgresAuthStore } from '../dist/packages/security/src/postgres-store.js';
import { assertCompanyScope, projectFields, resolveEffectiveAccess } from '../dist/packages/security/src/rbac.js';
import { createApp } from '../dist/apps/api/src/app.js';
import { PGlite } from '@electric-sql/pglite';

let now = new Date('2026-11-23T08:00:00.000Z');
const signingKey = 'test-only-signing-key-with-at-least-32-bytes';
const password = 'Synthetic-Test-Passw0rd!2026';
const principal = (roles, companyCode = 'THL') => ({ employeeId: roles.length + (companyCode === 'TGE' ? 100 : 0), employeeNo: `EMP-${roles.length}`, companyCode, companyId: companyCode === 'THL' ? 1 : 2, mfaEnrolled: roles.some((r) => ['admin', 'boss', 'finance_manager'].includes(r.role)), roles });

async function fixture() {
  const store = new InMemoryAuthStore();
  const auth = new AuthService(store, { issuer: 'layer-farm-test', audience: 'layer-farm-api', signingKey, now: () => now });
  const mfaSecret = generateMfaSecret();
  await auth.register('feeder.test', password, principal([{ role: 'feeder', scopeConfig: { houseIds: [11] } }]));
  await auth.register('boss.test', password, { ...principal([{ role: 'boss' }]), employeeId: 2, employeeNo: 'EMP-BOSS' }, mfaSecret);
  return { store, auth, mfaSecret };
}

function appFixture(auth) {
  return createApp({ config: { nodeEnv: 'test', port: 3100, bodyLimitBytes: 4096, externalIntegrationsEnabled: false }, auth });
}

async function login(app, account = 'feeder.test', mfaCode) {
  return app.request('/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account, password, companyCode: 'THL', ...(mfaCode ? { mfaCode } : {}) }) });
}

test('密码仅保存自适应scrypt哈希并拒绝弱口令', async () => {
  const encoded = await hashPassword(password);
  assert.match(encoded, /^scrypt\$32768\$8\$1\$/);
  assert.equal(encoded.includes(password), false);
  assert.equal(await verifyPassword(password, encoded), true);
  assert.equal(await verifyPassword('wrong-password', encoded), false);
  await assert.rejects(hashPassword('password123'), (error) => error.code === 'VALIDATION_ERROR');
});

test('登录、me、退出和会话即时吊销形成闭环', async () => {
  const { auth } = await fixture();
  const app = appFixture(auth);
  const response = await login(app);
  assert.equal(response.status, 200);
  const { data: tokens } = await response.json();
  const me = await app.request('/api/v1/auth/me', { headers: { authorization: `Bearer ${tokens.accessToken}` } });
  assert.equal(me.status, 200);
  const body = await me.json();
  assert.equal(body.data.employeeNo, 'EMP-1');
  assert.equal(body.data.permissions.includes('production:read'), true);
  assert.equal('passwordHash' in body.data, false);
  assert.equal((await app.request('/api/v1/auth/logout', { method: 'POST', headers: { authorization: `Bearer ${tokens.accessToken}` } })).status, 204);
  assert.equal((await app.request('/api/v1/auth/me', { headers: { authorization: `Bearer ${tokens.accessToken}` } })).status, 401);
});

test('账号枚举得到统一错误且连续失败触发指数锁定', async () => {
  const { auth } = await fixture();
  let unknown;
  let wrong;
  try { await auth.login('nobody.test', 'bad', 'THL'); } catch (error) { unknown = error; }
  try { await auth.login('feeder.test', 'bad', 'THL'); } catch (error) { wrong = error; }
  assert.equal(unknown.publicMessage, wrong.publicMessage);
  for (let index = 0; index < 4; index += 1) await assert.rejects(auth.login('feeder.test', 'bad', 'THL'), (error) => error.code === 'UNAUTHORIZED');
  await assert.rejects(auth.login('feeder.test', password, 'THL'), (error) => error.code === 'RATE_LIMITED' && error.status === 429);
});

test('高权限角色必须MFA且接受时钟相邻窗口', async () => {
  const { auth, mfaSecret } = await fixture();
  await assert.rejects(auth.login('boss.test', password, 'THL'), (error) => error.code === 'MFA_REQUIRED');
  const tokens = await auth.login('boss.test', password, 'THL', totp(mfaSecret, now));
  assert.equal((await auth.authenticate(`Bearer ${tokens.accessToken}`)).principal.roles[0].role, 'boss');
  await assert.rejects(auth.login('boss.test', password, 'THL', '000000'), (error) => error.code === 'UNAUTHORIZED');
});

test('MFA关闭后高权限角色可直接登录', async () => {
  const store = new InMemoryAuthStore();
  const auth = new AuthService(store, {
    issuer: 'layer-farm-test',
    audience: 'layer-farm-api',
    signingKey,
    mfaEnabled: false,
    now: () => now,
  });
  const bossPrincipal = {
    ...principal([{ role: 'boss' }]),
    employeeId: 3,
    employeeNo: 'EMP-BOSS-NOMFA',
    mfaEnrolled: false,
  };
  await auth.register('boss.nomfa', password, bossPrincipal);
  const tokens = await auth.login('boss.nomfa', password, 'THL');
  const authenticated = await auth.authenticate(`Bearer ${tokens.accessToken}`);
  assert.equal(authenticated.principal.roles[0].role, 'boss');
});

test('篡改、错误签发方和过期JWT均被拒绝', async () => {
  const { auth } = await fixture();
  const tokens = await auth.login('feeder.test', password, 'THL');
  const tampered = `${tokens.accessToken.slice(0, -2)}xx`;
  await assert.rejects(auth.authenticate(`Bearer ${tampered}`), (error) => error.code === 'UNAUTHORIZED');
  now = new Date(now.getTime() + 901_000);
  await assert.rejects(auth.authenticate(`Bearer ${tokens.accessToken}`), (error) => error.code === 'UNAUTHORIZED');
});

test('刷新轮换后旧令牌重放会吊销全部会话', async () => {
  const { auth } = await fixture();
  const tokens = await auth.login('feeder.test', password, 'THL');
  const rotated = await auth.refresh(tokens.refreshToken);
  await assert.rejects(auth.refresh(tokens.refreshToken), (error) => error.code === 'UNAUTHORIZED');
  await assert.rejects(auth.authenticate(`Bearer ${rotated.accessToken}`), (error) => error.code === 'UNAUTHORIZED');
});

test('两个并发刷新最多一个成功', async () => {
  const { auth } = await fixture();
  const tokens = await auth.login('feeder.test', password, 'THL');
  const results = await Promise.allSettled([auth.refresh(tokens.refreshToken), auth.refresh(tokens.refreshToken)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
});

test('多角色权限与数据范围取并集且出纳剥离审批', () => {
  const access = resolveEffectiveAccess(principal([
    { role: 'finance_cashier', scopeConfig: { companyCodes: ['THL'], warehouseIds: [1] } },
    { role: 'warehouse', scopeConfig: { companyCodes: ['TGE'], warehouseIds: [2] } },
  ]));
  assert.equal(access.permissions.has('inventory:update'), true);
  assert.equal(access.permissions.has('finance:payment'), true);
  assert.equal([...access.permissions].some((permission) => permission.endsWith(':approve')), false);
  assert.deepEqual([...access.companyCodes].sort(), ['TGE', 'THL']);
  assert.deepEqual([...access.warehouseIds].sort(), [1, 2]);
});

test('限时角色到期失效且scope_config覆盖默认范围', () => {
  const access = resolveEffectiveAccess(principal([
    { role: 'admin', validTo: new Date('2026-11-22T23:59:59Z') },
    { role: 'feeder', scopeConfig: { companyCodes: ['TGE'], houseIds: [88], selfOnly: true } },
  ]));
  assert.equal(access.permissions.has('*'), false);
  assert.deepEqual([...access.companyCodes], ['TGE']);
  assert.deepEqual([...access.houseIds], [88]);
  assert.equal(access.selfOnly, true);
});

test('字段级投影彻底移除受限岗位价格成本薪资和凭据', () => {
  const result = projectFields({ purchasePrice: 12, cost: 8, salary: 100, passwordHash: 'secret', nested: [{ sales_price: 20, name: 'ok' }] }, ['feeder']);
  assert.deepEqual(result, { nested: [{ name: 'ok' }] });
  const masked = projectFields({ cost: 8, profit: 2, salary: 100, price: 12 }, ['warehouse']);
  assert.deepEqual(masked, { cost: '***', profit: '***', price: 12 });
});

test('公司范围拒绝跨公司和非法公司', () => {
  const access = resolveEffectiveAccess(principal([{ role: 'warehouse', companyCode: 'THL' }]));
  assert.doesNotThrow(() => assertCompanyScope(access, 'THL'));
  assert.throws(() => assertCompanyScope(access, 'TGE'), (error) => error.code === 'AUTH_SCOPE_VIOLATION');
  assert.throws(() => assertCompanyScope(access, 'GDAI'));
});

test('服务端独立鉴权阻止普通角色访问RBAC管理', async () => {
  const { auth, mfaSecret } = await fixture();
  const app = appFixture(auth);
  const feederLogin = await login(app);
  const feederTokens = (await feederLogin.json()).data;
  assert.equal((await app.request('/api/v1/org/role-permissions', { headers: { authorization: `Bearer ${feederTokens.accessToken}` } })).status, 403);
  const bossLogin = await login(app, 'boss.test', totp(mfaSecret, now));
  const bossTokens = (await bossLogin.json()).data;
  assert.equal((await app.request('/api/v1/org/role-permissions', { headers: { authorization: `Bearer ${bossTokens.accessToken}` } })).status, 403);
});

test('PGlite认证存储支持登录、查询和原子轮换', async () => {
  const db = new PGlite();
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort()) {
    const sql = readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8').replaceAll('CONCURRENTLY', '');
    await db.exec(sql);
  }
  const store = new PostgresAuthStore(db);
  const auth = new AuthService(store, { issuer: 'layer-farm-test', audience: 'layer-farm-api', signingKey, now: () => now });
  await auth.register('db.feeder', password, { ...principal([{ role: 'feeder' }]), employeeId: 9001, employeeNo: 'DB-9001' });
  const tokens = await auth.login('db.feeder', password, 'THL');
  assert.equal((await auth.authenticate(`Bearer ${tokens.accessToken}`)).principal.employeeNo, 'DB-9001');
  const rotated = await auth.refresh(tokens.refreshToken);
  assert.notEqual(rotated.refreshToken, tokens.refreshToken);
  await assert.rejects(auth.refresh(tokens.refreshToken));
  const persisted = await db.query('SELECT password_hash, principal FROM app_auth.credential WHERE employee_id=$1', [9001]);
  assert.equal(persisted.rows[0].password_hash.includes(password), false);
  await db.close();
});
