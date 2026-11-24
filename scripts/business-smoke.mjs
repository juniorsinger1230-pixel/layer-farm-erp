import { readFileSync, writeFileSync } from 'node:fs';
import { totp } from '../dist/packages/security/src/auth.js';

const testData = JSON.parse(readFileSync(new URL('../e2e/test-data.json', import.meta.url), 'utf8'));
const runtimeData = JSON.parse(readFileSync(new URL('../e2e/runtime-data.json', import.meta.url), 'utf8'));
const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:8080';
const checks = [];

async function request(name, path, options = {}, requireData = true) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${path}`, { cache: 'no-store', ...options });
  const body = await response.json();
  const ok = response.ok && (!requireData || Object.prototype.hasOwnProperty.call(body, 'data'));
  checks.push({ name, path, method: options.method ?? 'GET', status: response.status, ok, durationMs: Date.now() - startedAt });
  if (!ok) throw new Error(`Business smoke check failed: ${name} ${response.status}`);
  return body;
}

await request('API live probe', '/health/live', {}, false);
await request('API ready probe', '/health/ready', {}, false);
const loginBody = await request('Administrator MFA login', '/api/v1/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    account: testData.account,
    password: testData.password,
    companyCode: testData.companyCode,
    mfaCode: totp(testData.mfaSecret),
  }),
});
const token = loginBody.data.accessToken;
const authenticatedPaths = [
  ['Current principal', '/api/v1/auth/me'],
  ['Materials', '/api/v1/inv/materials?page=1&pageSize=200'],
  ['Stock locations', '/api/v1/inv/stock-locations?page=1&pageSize=200'],
  ['Houses and pens', '/api/v1/farm/houses-and-pens?page=1&pageSize=200'],
  ['Suppliers', '/api/v1/proc/suppliers?page=1&pageSize=200'],
  ['Customers', '/api/v1/sales/customers?page=1&pageSize=200'],
  ['Credit limits', '/api/v1/sales/credit-checks?page=1&pageSize=200'],
  ['Latest print design', `/api/v1/print/print-templates/${runtimeData.printTemplateId}/design`],
];
for (const [name, path] of authenticatedPaths) {
  await request(name, path, { headers: { authorization: `Bearer ${token}` } });
}
const result = { event: 'business_smoke_passed', checkedAt: new Date().toISOString(), baseUrl, totalChecks: checks.length, checks };
writeFileSync(new URL('../business-smoke-result.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ event: result.event, totalChecks: result.totalChecks }));
