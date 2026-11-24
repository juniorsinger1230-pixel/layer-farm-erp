import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const baseUrl = (process.env.BASE_URL ?? '').replace(/\/$/, '');
const companyCode = process.env.TRIAL_COMPANY_CODE ?? 'THL';
const passwordFile = process.env.TRIAL_PASSWORD_FILE ? resolve(process.env.TRIAL_PASSWORD_FILE) : '';
const outputFile = resolve(process.env.TRIAL_VERIFY_OUTPUT ?? 'trial-account-acceptance-result.json');

if (!baseUrl) {
  throw new Error('BASE_URL is required');
}

const accounts = [
  { role: 'admin', account: 'trial.admin', initialPassword: 'Trial-Admin-2026!' },
  { role: 'boss', account: 'trial.boss', initialPassword: 'Trial-Boss-2026!' },
  { role: 'finance_manager', account: 'trial.finance_manager', initialPassword: 'Trial-FinMgr-2026!' },
  { role: 'finance_cashier', account: 'trial.finance_cashier', initialPassword: 'Trial-Cashier-2026!' },
  { role: 'purchase_manager', account: 'trial.purchase_manager', initialPassword: 'Trial-PurMgr-2026!' },
  { role: 'purchase_staff', account: 'trial.purchase_staff', initialPassword: 'Trial-PurStaff-2026!' },
  { role: 'sales_manager', account: 'trial.sales_manager', initialPassword: 'Trial-SalMgr-2026!' },
  { role: 'sales_staff', account: 'trial.sales_staff', initialPassword: 'Trial-SalStaff-2026!' },
  { role: 'layer_farm_manager', account: 'trial.layer_farm_manager', initialPassword: 'Trial-FarmMgr-2026!' },
  { role: 'vet', account: 'trial.vet', initialPassword: 'Trial-Vet-2026!' },
  { role: 'feeder', account: 'trial.feeder', initialPassword: 'Trial-Feeder-2026!' },
  { role: 'warehouse', account: 'trial.warehouse', initialPassword: 'Trial-Warehouse-2026!' },
  { role: 'external_affairs', account: 'trial.external_affairs', initialPassword: 'Trial-External-2026!' },
  { role: 'driver', account: 'trial.driver', initialPassword: 'Trial-Driver-2026!' },
  { role: 'engineering', account: 'trial.engineering', initialPassword: 'Trial-Engineering-2026!' },
];

let rotatedPasswords = new Map();
if (passwordFile) {
  const parsed = JSON.parse(readFileSync(passwordFile, 'utf8'));
  rotatedPasswords = new Map((parsed.accounts ?? []).map((item) => [item.account, item.password]));
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  return { response, body };
}

async function verifyWrongPassword() {
  const { response } = await request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ companyCode, account: accounts[0].account, password: 'definitely-wrong-password' }),
  });
  return response.status === 401;
}

try {
  const negativeAuthBlocked = await verifyWrongPassword();
  const results = [];
  let passCount = 0;

  for (const item of accounts) {
    const password = rotatedPasswords.get(item.account) ?? item.initialPassword;
    const loginResult = await request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ companyCode, account: item.account, password }),
    });

    const checks = {
      login200: loginResult.response.status === 200,
      accessToken: typeof loginResult.body?.data?.accessToken === 'string',
      me200: false,
      companyMatch: false,
      roleMatch: false,
      permissionsReturned: false,
    };
    let profile = null;

    if (checks.accessToken) {
      const meResult = await request('/api/v1/auth/me', {
        headers: { authorization: `Bearer ${loginResult.body.data.accessToken}` },
      });
      checks.me200 = meResult.response.status === 200;
      profile = meResult.body?.data ?? null;
      checks.companyMatch = profile?.companyCode === companyCode;
      checks.roleMatch = Array.isArray(profile?.roles) && profile.roles.includes(item.role);
      checks.permissionsReturned = Array.isArray(profile?.permissions) && profile.permissions.length > 0;
    }

    const passed = Object.values(checks).every(Boolean);
    if (passed) passCount += 1;
    results.push({
      account: item.account,
      expectedRole: item.role,
      actualRoles: profile?.roles ?? [],
      permissionCount: Array.isArray(profile?.permissions) ? profile.permissions.length : 0,
      companyScope: profile?.companyScope ?? null,
      houseScope: profile?.houseScope ?? [],
      warehouseScope: profile?.warehouseScope ?? [],
      checks,
      passed,
    });
  }

  const summary = {
    event: 'trial_account_acceptance_completed',
    baseUrl,
    companyCode,
    negativeAuthBlocked,
    total: accounts.length,
    passCount,
    failCount: accounts.length - passCount,
    allPassed: negativeAuthBlocked && passCount === accounts.length,
    generatedAt: new Date().toISOString(),
    results,
  };

  writeFileSync(outputFile, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({
    event: 'trial_account_acceptance_ready',
    outputFile,
    negativeAuthBlocked,
    total: accounts.length,
    passCount,
    failCount: accounts.length - passCount,
    allPassed: summary.allPassed,
  }));

  if (!summary.allPassed) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
