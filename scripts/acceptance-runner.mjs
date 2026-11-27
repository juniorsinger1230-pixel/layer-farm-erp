import { createHmac } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { totp } from '../dist/packages/security/src/auth.js';
import { projectFields } from '../dist/packages/security/src/rbac.js';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceRoot = path.join(projectRoot, 'acceptance-evidence', `run-${runId}`);
mkdirSync(evidenceRoot, { recursive: true });

const dockerExecutable = 'C:\\Users\\龚\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe';
const gitExecutable = 'C:\\Program Files\\Git\\cmd\\git.exe';
const baseUrl = 'http://127.0.0.1:3100';
const webUrl = 'http://127.0.0.1:8080';
const composeFile = path.join(projectRoot, 'deploy', 'compose', 'docker-compose.yml');
const projectName = 'layer-farm-erp-p2';

const casesFile = JSON.parse(readFileSync(path.join(projectRoot, 'acceptance-cases.json'), 'utf8'));
const allCases = casesFile.cases;

function promisifyExec(executable, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    execFile(executable, args, { cwd: projectRoot, maxBuffer: 20 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stdout, stderr }));
      else resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

async function docker(args) {
  return promisifyExec(dockerExecutable, args);
}

async function git(args) {
  return promisifyExec(gitExecutable, args);
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { response, text, json, status: response.status };
}

function saveEvidence(name, payload) {
  const target = path.join(evidenceRoot, name);
  writeFileSync(target, typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2), 'utf8');
  return path.relative(projectRoot, target).replaceAll('\\', '/');
}

async function composePs() {
  const { stdout } = await docker([
    'compose', '-p', projectName, '-f', composeFile, 'ps', '--format', '{{json .}}',
  ]);
  return stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function psql(sql) {
  const { stdout } = await docker([
    'exec', `${projectName}-postgres-1`, 'psql', '-U', 'erp', '-d', 'layer_farm', '-t', '-A', '-c', sql,
  ]);
  return stdout.trim();
}

async function login(account, password, companyCode = 'THL') {
  return request(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ companyCode, account, password }),
  });
}

function authHeaders(accessToken) {
  return { authorization: `Bearer ${accessToken}` };
}

const composeEnvText = readFileSync(path.join(projectRoot, 'deploy', 'compose', '.env'), 'utf8');
const composeEnv = Object.fromEntries(composeEnvText.split(/\r?\n/).filter((line) => line.includes('=')).map((line) => {
  const index = line.indexOf('=');
  return [line.slice(0, index), line.slice(index + 1)];
}));

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signAccessTokenFromPayload(payload) {
  const header = base64urlJson({ alg: 'HS256', typ: 'JWT' });
  const payloadText = base64urlJson(payload);
  const signature = createHmac('sha256', composeEnv.JWT_SIGNING_KEY).update(`${header}.${payloadText}`).digest('base64url');
  return `${header}.${payloadText}.${signature}`;
}

async function withBrowser(callback) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    return await callback(page);
  } finally {
    await browser.close();
  }
}

async function browserLogin(page, account, password, mfaCode) {
  await page.goto(`${webUrl}/login`);
  const result = await login(account, password, 'THL');
  if (result.status !== 200 && mfaCode) {
    const mfaResult = await request(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ companyCode: 'THL', account, password, mfaCode }),
    });
    Object.assign(result, mfaResult);
  }
  if (result.status !== 200) throw new Error(`Browser login failed: ${result.status}`);
  await page.sessionStorage.setItem('layer-erp-session', JSON.stringify(result.json.data));
  await page.goto(`${webUrl}/app/workbench`);
  await page.waitForLoadState('networkidle');
  return result.json.data;
}

const checks = {
  async S0_01() {
    const result = await docker(['compose', '-p', projectName, '-f', composeFile, 'config']);
    return { pass: true, evidence: saveEvidence('S0-01-compose-config.json', { pass: true, output: result.stdout }) };
  },
  async S0_02() {
    const envText = readFileSync(path.join(projectRoot, 'deploy', 'compose', '.env'), 'utf8');
    const required = ['WEB_PORT', 'API_PORT', 'POSTGRES_PORT', 'VALKEY_PORT', 'POSTGRES_PASSWORD'];
    const missing = required.filter((key) => !envText.includes(`${key}=`));
    return { pass: missing.length === 0, evidence: saveEvidence('S0-02-env.json', { missing, envText }) };
  },
  async S0_03() {
    const rows = await composePs();
    const row = rows.find((item) => item.Service === 'postgres');
    const pass = row?.Health === 'healthy';
    return { pass, evidence: saveEvidence('S0-03-postgres.json', row ?? null) };
  },
  async S0_04() {
    const rows = await composePs();
    const row = rows.find((item) => item.Service === 'valkey');
    const pass = row?.Health === 'healthy';
    return { pass, evidence: saveEvidence('S0-04-valkey.json', row ?? null) };
  },
  async S0_05() {
    const output = await psql("SELECT count(*) FROM schema_migration;");
    const pass = Number(output) > 0;
    return { pass, evidence: saveEvidence('S0-05-migrations.json', { migrationCount: Number(output) }) };
  },
  async S0_06() {
    const rows = await composePs();
    const row = rows.find((item) => item.Service === 'api');
    const pass = row?.Health === 'healthy';
    return { pass, evidence: saveEvidence('S0-06-api.json', row ?? null) };
  },
  async S0_07() {
    const result = await request(webUrl);
    const pass = result.status === 200;
    return { pass, evidence: saveEvidence('S0-07-web.json', { status: result.status, length: result.text.length }) };
  },
  async S0_08() {
    const result = await request(`${baseUrl}/health/live`);
    const pass = result.status === 200 && result.json?.status === 'ok';
    return { pass, evidence: saveEvidence('S0-08-live.json', result.json) };
  },
  async S0_09() {
    const result = await request(`${baseUrl}/health/ready`);
    const pass = result.status === 200 && result.json?.status === 'ok'
      && result.json.dependencies.database === 'up' && result.json.dependencies.valkey === 'up';
    return { pass, evidence: saveEvidence('S0-09-ready.json', result.json) };
  },
  async S0_10() {
    const target = path.join(projectRoot, 'scripts', 'demo-seed.mjs');
    const pass = readFileSync(target, 'utf8').includes('demo_data_ready');
    return { pass, evidence: saveEvidence('S0-10-seed-script.json', { pass, script: 'scripts/demo-seed.mjs' }) };
  },
  async S0_11() {
    const output = await psql("SELECT count(*) FROM app.company WHERE company_code='THL';");
    const pass = Number(output) === 1;
    return { pass, evidence: saveEvidence('S0-11-company.json', { count: Number(output) }) };
  },
  async S0_12() {
    const output = await psql('SELECT count(*) FROM app.organization_unit;');
    const pass = Number(output) === 7;
    return { pass, evidence: saveEvidence('S0-12-units.json', { count: Number(output) }) };
  },
  async S0_13() {
    const output = await psql('SELECT count(*) FROM app.employee;');
    const pass = Number(output) === 8;
    return { pass, evidence: saveEvidence('S0-13-employees.json', { count: Number(output) }) };
  },
  async S0_14() {
    const output = await psql('SELECT count(*) FROM app.print_template;');
    const pass = Number(output) === 3;
    return { pass, evidence: saveEvidence('S0-14-print-templates.json', { count: Number(output) }) };
  },
  async S0_15() {
    const output = await psql('SELECT count(*) FROM app.customer;');
    const pass = Number(output) === 1;
    return { pass, evidence: saveEvidence('S0-15-customer.json', { count: Number(output) }) };
  },
  async S0_16() {
    const output = await psql('SELECT count(*) FROM app.price_list;');
    const pass = Number(output) === 1;
    return { pass, evidence: saveEvidence('S0-16-price.json', { count: Number(output) }) };
  },
  async S0_17() {
    const result = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const pass = result.status === 200 && Boolean(result.json.data.accessToken);
    return { pass, evidence: saveEvidence('S0-17-login.json', { status: result.status, hasToken: pass }) };
  },
  async S0_18() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(loginResult.json.data.accessToken) });
    const pass = result.status === 200;
    return { pass, evidence: saveEvidence('S0-18-me.json', result.json) };
  },
  async S0_19() {
    const { stdout } = await git(['status', '--short']);
    const pass = stdout.trim() === '';
    return { pass, evidence: saveEvidence('S0-19-git-clean.json', { status: stdout }) };
  },
  async S0_20() {
    const { stdout } = await git(['rev-parse', 'HEAD']);
    const baseline = JSON.parse(readFileSync(path.join(projectRoot, 'acceptance-baseline.json'), 'utf8'));
    const pass = baseline.git.sha === casesFile.baseline.sha;
    return { pass, evidence: saveEvidence('S0-20-baseline.json', { head: stdout.trim(), baselineSha: baseline.git.sha, caseSha: casesFile.baseline.sha }) };
  },

  async S1_21() {
    const evidence = await withBrowser(async (page) => {
      await page.goto(`${webUrl}/app/org-001`);
      await page.waitForURL('**/login');
      return { finalUrl: page.url() };
    });
    const pass = evidence.finalUrl.endsWith('/login');
    return { pass, evidence: saveEvidence('S1-21-redirect.json', evidence) };
  },
  async S1_22() {
    const result = await login('admin.zhang', 'wrong-password');
    const pass = result.status === 401;
    return { pass, evidence: saveEvidence('S1-22-wrong-password.json', { status: result.status, body: result.json }) };
  },
  async S1_23() {
    const result = await login('admin.zhang', 'Admin-Passw0rd!2026', 'BAD');
    const pass = result.status === 401;
    return { pass, evidence: saveEvidence('S1-23-wrong-company.json', { status: result.status, body: result.json }) };
  },
  async S1_24() {
    const evidence = await withBrowser(async (page) => {
      await page.goto(`${webUrl}/login`);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForTimeout(500);
      return { url: page.url(), errors: await page.locator('.ant-form-item-explain-error').allInnerTexts(), session: await page.sessionStorage.getItem('layer-erp-session') };
    });
    const pass = evidence.url.endsWith('/login') && evidence.errors.includes('请输入员工账号') && evidence.session === null;
    return { pass, evidence: saveEvidence('S1-24-empty-account.json', evidence) };
  },
  async S1_25() {
    const evidence = await withBrowser(async (page) => {
      await page.goto(`${webUrl}/login`);
      await page.getByPlaceholder('请输入员工账号').fill('admin.zhang');
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForTimeout(500);
      return { url: page.url(), errors: await page.locator('.ant-form-item-explain-error').allInnerTexts(), session: await page.sessionStorage.getItem('layer-erp-session') };
    });
    const pass = evidence.url.endsWith('/login') && evidence.errors.includes('请输入密码') && evidence.session === null;
    return { pass, evidence: saveEvidence('S1-25-empty-password.json', evidence) };
  },
  async S1_26() {
    const result = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const pass = result.status === 200 && Boolean(result.json.data.accessToken) && Boolean(result.json.data.refreshToken);
    return { pass, evidence: saveEvidence('S1-26-tokens.json', { status: result.status, hasAccess: Boolean(result.json?.data?.accessToken), hasRefresh: Boolean(result.json?.data?.refreshToken) }) };
  },
  async S1_27() {
    const result = await request(`${baseUrl}/api/v1/auth/me`);
    const pass = result.status === 401;
    return { pass, evidence: saveEvidence('S1-27-no-token.json', { status: result.status, body: result.json }) };
  },
  async S1_28() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const token = loginResult.json.data.accessToken;
    const tampered = `${token.slice(0, -2)}xx`;
    const result = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(tampered) });
    const pass = result.status === 401;
    return { pass, evidence: saveEvidence('S1-28-tampered.json', { status: result.status, body: result.json }) };
  },
  async S1_29() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const payload = JSON.parse(Buffer.from(loginResult.json.data.accessToken.split('.')[1], 'base64url'));
    payload.exp = Math.floor(Date.now() / 1000) - 60;
    const expiredToken = signAccessTokenFromPayload(payload);
    const result = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(expiredToken) });
    const pass = result.status === 401;
    return { pass, evidence: saveEvidence('S1-29-expired.json', { status: result.status, body: result.json }) };
  },
  async S1_30() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const refreshToken = loginResult.json.data.refreshToken;
    const result = await request(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const pass = result.status === 200 && Boolean(result.json.data.accessToken) && result.json.data.accessToken !== loginResult.json.data.accessToken;
    return { pass, evidence: saveEvidence('S1-30-refresh.json', { status: result.status, rotated: pass }) };
  },
  async S1_31() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const token = loginResult.json.data.accessToken;
    const logoutResult = await request(`${baseUrl}/api/v1/auth/logout`, { method: 'POST', headers: authHeaders(token) });
    const meResult = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(token) });
    const pass = logoutResult.status === 204 && meResult.status === 401;
    return { pass, evidence: saveEvidence('S1-31-logout.json', { logout: logoutResult.status, me: meResult.status }) };
  },
  async S1_32() {
    const loginResult = await login('warehouse.zhou', 'Demo-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/org/role-permissions`, { headers: authHeaders(loginResult.json.data.accessToken) });
    const pass = result.status === 403;
    return { pass, evidence: saveEvidence('S1-32-rbac-denied.json', { status: result.status, body: result.json }) };
  },
  async S1_33() {
    const loginResult = await login('warehouse.zhou', 'Demo-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/org/organizations`, {
      method: 'POST',
      headers: { ...authHeaders(loginResult.json.data.accessToken), 'content-type': 'application/json', 'idempotency-key': 's1-33-denied-0001' },
      body: JSON.stringify({}),
    });
    const pass = result.status === 403;
    return { pass, evidence: saveEvidence('S1-33-create-org-denied.json', { status: result.status, body: result.json }) };
  },
  async S1_34() {
    const loginResult = await login('warehouse.zhou', 'Demo-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/fin/periods`, {
      method: 'POST',
      headers: { ...authHeaders(loginResult.json.data.accessToken), 'content-type': 'application/json', 'idempotency-key': 's1-34-denied-0001' },
      body: JSON.stringify({}),
    });
    const pass = result.status === 403;
    return { pass, evidence: saveEvidence('S1-34-finance-approve-denied.json', { status: result.status, body: result.json }) };
  },
  async S1_35() {
    const loginResult = await login('farm.zhao', 'Demo-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/farm/flock-batches`, { headers: authHeaders(loginResult.json.data.accessToken) });
    const pass = result.status === 200;
    return { pass, evidence: saveEvidence('S1-35-farm-read.json', { status: result.status }) };
  },
  async S1_36() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const endpoints = ['/api/v1/org/organizations', '/api/v1/farm/flock-batches', '/api/v1/sales/customers', '/api/v1/fin/periods'];
    const results = [];
    for (const endpoint of endpoints) {
      const response = await request(`${baseUrl}${endpoint}`, { headers: authHeaders(loginResult.json.data.accessToken) });
      results.push({ endpoint, status: response.status });
    }
    const pass = results.every((item) => item.status === 200);
    return { pass, evidence: saveEvidence('S1-36-admin-read.json', results) };
  },
  async S1_37() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/org/positions`, {
      method: 'POST',
      headers: { ...authHeaders(loginResult.json.data.accessToken), 'content-type': 'application/json', 'idempotency-key': 's1-37-permission-0001' },
      body: JSON.stringify({}),
    });
    const pass = result.status === 400;
    return { pass, evidence: saveEvidence('S1-37-admin-create.json', { status: result.status, body: result.json }) };
  },
  async S1_38() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/org/positions/999999`, {
      method: 'PATCH',
      headers: { ...authHeaders(loginResult.json.data.accessToken), 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const pass = result.status === 404;
    return { pass, evidence: saveEvidence('S1-38-admin-update.json', { status: result.status, body: result.json }) };
  },
  async S1_39() {
    const loginResult = await login('warehouse.zhou', 'Demo-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/org/organizations`, {
      headers: { ...authHeaders(loginResult.json.data.accessToken), 'x-company-code': 'TGE' },
    });
    const pass = result.status === 403;
    return { pass, evidence: saveEvidence('S1-39-cross-company.json', { status: result.status, body: result.json }) };
  },
  async S1_40() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const suffix = Date.now();
    const result = await request(`${baseUrl}/api/v1/org/positions`, {
      method: 'POST',
      headers: { ...authHeaders(loginResult.json.data.accessToken), 'content-type': 'application/json', 'idempotency-key': `s1-40-company-${suffix}` },
      body: JSON.stringify({ position_code: `S1-POS-${suffix}`, position_name: '公司自动注入测试', unit_id: 1, effective_date: '2026-11-27', status: 'active' }),
    });
    const pass = result.status === 201 && result.json.data.company_code === 'THL';
    return { pass, evidence: saveEvidence('S1-40-company-injection.json', { status: result.status, data: result.json?.data }) };
  },
  async S1_41() {
    const adminLogin = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const adminResponse = await request(`${baseUrl}/api/v1/sales/price-lists`, { headers: authHeaders(adminLogin.json.data.accessToken) });
    const driverLogin = await login('driver.test', 'Demo-Passw0rd!2026');
    const driverResponse = await request(`${baseUrl}/api/v1/sales/price-lists`, { headers: authHeaders(driverLogin.json.data.accessToken) });
    const driverRows = driverResponse.json.data;
    const pass = adminResponse.status === 200 && driverResponse.status === 200 && driverRows.every((row) => !Object.prototype.hasOwnProperty.call(row, 'price'));
    return { pass, evidence: saveEvidence('S1-41-price-field.json', { adminStatus: adminResponse.status, driverStatus: driverResponse.status, driverRows }) };
  },
  async S1_42() {
    const projected = projectFields({ salary: 100, nested: { salary: 200, name: 'ok' } }, ['warehouse']);
    const pass = !JSON.stringify(projected).includes('salary');
    return { pass, evidence: saveEvidence('S1-42-salary-field.json', projected) };
  },
  async S1_43() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(loginResult.json.data.accessToken) });
    const pass = result.status === 200 && !JSON.stringify(result.json).includes('passwordHash') && !JSON.stringify(result.json).includes('mfaSecret');
    return { pass, evidence: saveEvidence('S1-43-credential-field.json', { status: result.status, body: result.json }) };
  },
  async S1_44() {
    const statuses = [];
    for (let index = 0; index < 5; index += 1) {
      const response = await login('lock.test', 'wrong-password');
      statuses.push(response.status);
    }
    const correctResponse = await login('lock.test', 'Demo-Passw0rd!2026');
    const pass = statuses.slice(0, 4).every((status) => status === 401) && statuses[4] === 429 && correctResponse.status === 429;
    return { pass, evidence: saveEvidence('S1-44-lock.json', { statuses, correctStatus: correctResponse.status }) };
  },
  async S1_45() {
    const withoutMfa = await login('mfa.boss', 'Demo-Passw0rd!2026');
    const code = totp('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    const withMfa = await request(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ companyCode: 'THL', account: 'mfa.boss', password: 'Demo-Passw0rd!2026', mfaCode: code }),
    });
    const pass = withoutMfa.status === 401 && withoutMfa.json.error.code === 'MFA_REQUIRED' && withMfa.status === 200;
    return { pass, evidence: saveEvidence('S1-45-mfa.json', { withoutMfa: withoutMfa.status, withMfa: withMfa.status, code }) };
  },
  async S1_46() {
    const code = totp('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', new Date(Date.now() + 30_000));
    const result = await request(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ companyCode: 'THL', account: 'mfa.boss', password: 'Demo-Passw0rd!2026', mfaCode: code }),
    });
    const pass = result.status === 200;
    return { pass, evidence: saveEvidence('S1-46-mfa-window.json', { status: result.status, code }) };
  },
  async S1_47() {
    const loginResult = await login('multi.test', 'Demo-Passw0rd!2026');
    const me = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(loginResult.json.data.accessToken) });
    const permissions = me.json.data.permissions;
    const pass = permissions.includes('finance:payment') && permissions.includes('inventory:update');
    return { pass, evidence: saveEvidence('S1-47-multi-role.json', { status: me.status, permissions }) };
  },
  async S1_48() {
    const code = totp('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    const loginResult = await request(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ companyCode: 'THL', account: 'expired.test', password: 'Demo-Passw0rd!2026', mfaCode: code }),
    });
    const me = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(loginResult.json.data.accessToken) });
    const pass = loginResult.status === 200 && !me.json.data.permissions.includes('*');
    return { pass, evidence: saveEvidence('S1-48-expired-role.json', { login: loginResult.status, permissions: me.json?.data?.permissions }) };
  },
  async S1_49() {
    const loginResult = await login('scope.test', 'Demo-Passw0rd!2026');
    const me = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(loginResult.json.data.accessToken) });
    const data = me.json.data;
    const pass = data.companyScope.includes('TGE') && data.houseScope.includes(88) && data.roles.includes('feeder');
    return { pass, evidence: saveEvidence('S1-49-scope-config.json', data) };
  },
  async S1_50() {
    const loginResult = await login('cashier.test', 'Demo-Passw0rd!2026');
    const me = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(loginResult.json.data.accessToken) });
    const permissions = me.json.data.permissions;
    const pass = permissions.includes('finance:payment') && permissions.every((permission) => !permission.endsWith(':approve'));
    return { pass, evidence: saveEvidence('S1-50-cashier.json', { permissions }) };
  },
  async S1_51() {
    const evidence = await withBrowser(async (page) => {
      await browserLogin(page, 'warehouse.zhou', 'Demo-Passw0rd!2026');
      const menuText = await page.locator('.ant-menu').innerText();
      return { menuText, hasSystemRole: menuText.includes('系统角色目录管理') };
    });
    const pass = !evidence.hasSystemRole;
    return { pass, evidence: saveEvidence('S1-51-menu-render.json', evidence) };
  },
  async S1_52() {
    const evidence = await withBrowser(async (page) => {
      await browserLogin(page, 'warehouse.zhou', 'Demo-Passw0rd!2026');
      await page.goto(`${webUrl}/app/org-003`);
      await page.waitForLoadState('networkidle');
      return { url: page.url(), bodyText: await page.locator('body').innerText() };
    });
    const pass = evidence.bodyText.includes('无权限') || evidence.bodyText.includes('访问被拒绝');
    return { pass, evidence: saveEvidence('S1-52-direct-url.json', evidence) };
  },
  async S1_53() {
    const evidence = await withBrowser(async (page) => {
      await browserLogin(page, 'warehouse.zhou', 'Demo-Passw0rd!2026');
      await page.reload({ waitUntil: 'networkidle' });
      const me = await page.request.get(`${baseUrl}/api/v1/auth/me`);
      return { url: page.url(), meStatus: me.status() };
    });
    const pass = evidence.url.includes('/app/workbench') && evidence.meStatus === 200;
    return { pass, evidence: saveEvidence('S1-53-refresh-state.json', evidence) };
  },
  async S1_54() {
    const loginResult = await login('supplier.test', 'Demo-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/proc/purchase-orders`, { headers: authHeaders(loginResult.json.data.accessToken) });
    const pass = result.status === 200 && Boolean(result.json.data.supplierFiltered);
    return { pass, evidence: saveEvidence('S1-54-supplier-scope.json', { status: result.status, data: result.json.data }) };
  },
  async S1_55() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const traceWrite = await request(`${baseUrl}/api/v1/trace/traceability`, {
      method: 'POST',
      headers: { ...authHeaders(loginResult.json.data.accessToken), 'content-type': 'application/json', 'idempotency-key': 's1-55-trace-0001' },
      body: JSON.stringify({}),
    });
    const pass = traceWrite.status === 404;
    return { pass, evidence: saveEvidence('S1-55-system-write.json', { status: traceWrite.status, body: traceWrite.json }) };
  },
};

const argv = process.argv.slice(2);
let stageArg = null;
for (const [index, arg] of argv.entries()) {
  if (arg.startsWith('--stage=')) stageArg = arg.split('=')[1];
  else if (arg === '--stage') stageArg = argv[index + 1];
}
const stages = stageArg ? [stageArg] : ['S0'];
const selectedCases = allCases.filter((item) => stages.includes(item.stage));
const ledgerPath = path.join(projectRoot, 'acceptance-ledger.json');
let history = [];
try {
  const previousLedger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  const archived = { ...previousLedger };
  delete archived.history;
  history = [...(previousLedger.history ?? []), archived];
} catch {
  history = [];
}
let ledger = { startedAt: new Date().toISOString(), runId, stages, results: [], history };

for (const item of selectedCases) {
  const caseNumber = Number(item.id.split('-')[1]);
  const key = `${item.stage}_${String(caseNumber).padStart(2, '0')}`;
  const startedAt = new Date().toISOString();
  try {
    const check = checks[key];
    if (!check) throw new Error(`Missing check implementation: ${key}`);
    const result = await check();
    ledger.results.push({
      caseId: item.id,
      stage: item.stage,
      pageId: item.pageId,
      operation: item.operation,
      startedAt,
      finishedAt: new Date().toISOString(),
      actualResult: result.pass ? '通过' : '失败',
      evidencePath: result.evidence,
      defectId: result.pass ? '无' : '待登记',
      pass: result.pass,
    });
  } catch (error) {
    const evidence = saveEvidence(`${key}-error.json`, { message: error.message, stack: error.stack });
    ledger.results.push({
      caseId: item.id,
      stage: item.stage,
      pageId: item.pageId,
      operation: item.operation,
      startedAt,
      finishedAt: new Date().toISOString(),
      actualResult: '阻断',
      evidencePath: evidence,
      defectId: '待登记',
      pass: false,
      error: error.message,
    });
  }
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');
}

const summary = {};
for (const result of ledger.results) {
  summary[result.actualResult] = (summary[result.actualResult] ?? 0) + 1;
}
ledger.finishedAt = new Date().toISOString();
ledger.summary = summary;
ledger.pass = ledger.results.every((result) => result.pass);
writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');
console.log(JSON.stringify({ status: ledger.pass ? 'pass' : 'fail', total: ledger.results.length, summary }, null, 2));
