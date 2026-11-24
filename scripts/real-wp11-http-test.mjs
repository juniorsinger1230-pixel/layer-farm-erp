import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const databaseUrl = process.env.DATABASE_URL;
const valkeyUrl = process.env.VALKEY_URL;
if (!databaseUrl || !valkeyUrl) throw new Error('DATABASE_URL and VALKEY_URL are required');
const evidence = [];
const record = (name, detail = {}) => { evidence.push({ name, result: 'passed', ...detail }); console.log(JSON.stringify(evidence.at(-1))); };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const request = async (base, path, options = {}) => {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...(options.body ? {} : {}) },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await response.text();
  return { status: response.status, text, body: text.startsWith('{') ? JSON.parse(text) : undefined, headers: response.headers };
};

let child;
try {
  const port = 3217;
  const serverPath = fileURLToPath(new URL('../dist/apps/api/src/server.js', import.meta.url));
  child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env, NODE_ENV: 'test', PORT: String(port), DATABASE_URL: databaseUrl, VALKEY_URL: valkeyUrl,
      JWT_SIGNING_KEY: 'real-wp11-signing-key-with-at-least-32-bytes',
      RATE_LIMIT_ENABLED: 'true', RATE_LIMIT_WINDOW_SECONDS: '60', RATE_LIMIT_MAX: '100',
      LOGIN_RATE_LIMIT_MAX: '2', GRACEFUL_SHUTDOWN_TIMEOUT_MS: '5000', ATTACHMENT_DIR: '/tmp',
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
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

  const metrics = await request(base, '/metrics');
  assert.equal(metrics.status, 200, metrics.text);
  assert.match(metrics.text, /layer_farm_http_requests_total/);
  assert.match(metrics.text, /process_resident_memory_bytes/);
  record('REAL-WP11-001 真实TCP Prometheus指标、进程指标和探针');

  const loginStatuses = [];
  for (let index = 0; index < 3; index += 1) {
    const response = await request(base, '/api/v1/auth/login', { method: 'POST', body: { account: 'missing.wp11', password: 'wrong', companyCode: 'THL' } });
    loginStatuses.push(response.status);
    if (index < 2) assert.equal(response.status, 401, response.text);
  }
  assert.deepEqual(loginStatuses, [401, 401, 429]);
  const limited = await request(base, '/api/v1/auth/login', { method: 'POST', body: { account: 'missing.wp11', password: 'wrong', companyCode: 'THL' } });
  assert.equal(limited.headers.get('x-ratelimit-limit'), '2');
  assert.equal(limited.headers.get('x-ratelimit-remaining'), '0');
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  record('REAL-WP11-002 Valkey登录限流、429头和重试窗口');

  const started = Date.now();
  child.send({ type: 'shutdown' });
  const [code, signal] = await once(child, 'exit');
  const elapsedMs = Date.now() - started;
  assert.ok(elapsedMs < 5000, `shutdown took ${elapsedMs}ms`);
  assert.equal(code ?? signal, 0);
  child = undefined;
  record('REAL-WP11-003 受控优雅关停和硬超时配置', { elapsedMs });

  console.log(JSON.stringify({ result: 'passed', evidence: evidence.length, items: evidence }, null, 2));
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit').catch(() => {}), sleep(5000)]);
  }
}
