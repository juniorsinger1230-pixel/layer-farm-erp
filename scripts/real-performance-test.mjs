import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const password = 'Synthetic-Test-Passw0rd!2026';
const login = await fetch('http://127.0.0.1:3210/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account: 'real.websocket', password, companyCode: 'THL' }) });
assert.equal(login.status, 200);
const token = (await login.json()).data.accessToken;
const results = [];
for (const concurrency of [20, 40, 50]) {
  const latencies = [];
  const statuses = [];
  const started = performance.now();
  for (let wave = 0; wave < 10; wave += 1) {
    const responses = await Promise.all(Array.from({ length: concurrency }, async () => {
      const begin = performance.now();
      const response = await fetch('http://127.0.0.1:3210/api/v1/org/organizations?page=1&pageSize=20', { headers: { authorization: `Bearer ${token}` } });
      await response.arrayBuffer();
      latencies.push(performance.now() - begin);
      return response.status;
    }));
    statuses.push(...responses);
  }
  latencies.sort((a, b) => a - b);
  const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * p) - 1)];
  const report = { concurrency, requests: statuses.length, ok: statuses.filter((status) => status === 200).length, p50Ms: Number(percentile(0.5).toFixed(2)), p95Ms: Number(percentile(0.95).toFixed(2)), p99Ms: Number(percentile(0.99).toFixed(2)), maxMs: Number(latencies.at(-1).toFixed(2)), durationMs: Number((performance.now() - started).toFixed(2)) };
  assert.equal(report.ok, report.requests);
  assert.ok(report.p95Ms < 2000);
  results.push(report);
  console.log(JSON.stringify(report));
}
console.log(JSON.stringify({ result: 'passed', test: 'REAL-PERF-001', results }));
