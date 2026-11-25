import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const baseUrl = (process.env.BASE_URL ?? '').replace(/\/$/, '');
const endpoint = process.env.ENDPOINT_PATH;
const passwordFile = resolve(process.env.TRIAL_PASSWORD_FILE ?? '.runtime/trial-passwords.json');
const account = JSON.parse(readFileSync(passwordFile, 'utf8')).accounts.find((item) => item.account === process.env.ACCOUNT);
if (!baseUrl || !endpoint || !account) throw new Error('BASE_URL, ENDPOINT_PATH, ACCOUNT and password file are required');

const started = Date.now();
const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ companyCode: 'THL', account: account.account, password: account.password }),
});
const loginBody = await login.json();
if (!login.ok) throw new Error(`login failed: ${login.status}`);
const response = await fetch(`${baseUrl}${endpoint}`, { headers: { authorization: `Bearer ${loginBody.data.accessToken}` } });
const raw = await response.text();
const body = JSON.parse(raw);
const data = body.data;
const summary = {
  endpoint,
  status: response.status,
  durationMs: Date.now() - started,
  dataKeys: Object.keys(data ?? {}),
  dataType: Array.isArray(data) ? 'array' : typeof data,
  itemCount: Array.isArray(data?.items) ? data.items.length : undefined,
  total: data?.total,
  firstItemKeys: data?.items?.[0] ? Object.keys(data.items[0]) : [],
  rawLength: raw.length,
};
const output = process.env.INSPECT_OUTPUT;
if (output) writeFileSync(resolve(output), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary));
