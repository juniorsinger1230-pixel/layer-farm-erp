import { writeFileSync } from 'node:fs';
import { totp } from '../dist/packages/security/src/auth.js';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:8080';
const testData = JSON.parse(await import('node:fs').then((fs) => fs.readFileSync(new URL('../e2e/test-data.json', import.meta.url), 'utf8')));
const allPhases = [
  { name: 'baseline_50_concurrency', concurrency: Number(process.env.P2_LOAD_BASE_CONCURRENCY ?? 50), durationSeconds: Number(process.env.P2_LOAD_BASE_SECONDS ?? 600) },
  { name: 'peak_100_concurrency', concurrency: Number(process.env.P2_LOAD_PEAK_CONCURRENCY ?? 100), durationSeconds: Number(process.env.P2_LOAD_PEAK_SECONDS ?? 300) },
];
const selectedPhases = process.env.P2_LOAD_PHASES?.split(',').map((value) => value.trim()) ?? allPhases.map((phase) => phase.name);
const phases = allPhases.filter((phase) => selectedPhases.includes(phase.name));
const phaseResults = [];

function percentile(sorted, value) {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.ceil((value / 100) * sorted.length) - 1);
  return sorted[index];
}

async function login() {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      account: testData.account,
      password: testData.password,
      companyCode: testData.companyCode,
      mfaCode: totp(testData.mfaSecret),
    }),
  });
  if (!response.ok) throw new Error(`Login failed: ${response.status} ${await response.text()}`);
  const body = await response.json();
  return body.data.accessToken;
}

async function createTokenManager() {
  let token = await login();
  let refreshedAt = Date.now();
  return {
    async getToken() {
      if (Date.now() - refreshedAt > 8 * 60 * 1000) {
        token = await login();
        refreshedAt = Date.now();
      }
      return token;
    },
  };
}

async function runPhase(phase, tokenManager) {
  const deadline = Date.now() + phase.durationSeconds * 1000;
  const durations = [];
  const statusCounts = {};
  const errors = [];
  const paths = ['/health/live', '/health/ready', '/api/v1/auth/me', '/api/v1/inv/materials?page=1&pageSize=50'];

  async function worker(workerId) {
    let index = 0;
    while (Date.now() < deadline) {
      const path = paths[(workerId + index) % paths.length];
      const startedAt = Date.now();
      try {
        const currentToken = await tokenManager.getToken();
        const response = await fetch(`${baseUrl}${path}`, {
          cache: 'no-store',
          ...(path.startsWith('/api/v1/') ? { headers: { authorization: `Bearer ${currentToken}` } } : {}),
        });
        const elapsedMs = Date.now() - startedAt;
        durations.push(elapsedMs);
        statusCounts[response.status] = (statusCounts[response.status] ?? 0) + 1;
        if (!response.ok && response.status !== 429) errors.push({ path, status: response.status, message: (await response.text()).slice(0, 200) });
      } catch (error) {
        durations.push(Date.now() - startedAt);
        errors.push({ path, message: error.message });
        if (errors.length > 100) errors.shift();
      }
      index += 1;
    }
  }

  const startedAt = Date.now();
  await Promise.all(Array.from({ length: phase.concurrency }, (_, id) => worker(id)));
  const sorted = [...durations].sort((a, b) => a - b);
  return {
    name: phase.name,
    concurrency: phase.concurrency,
    durationSeconds: phase.durationSeconds,
    elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
    totalRequests: durations.length,
    statusCounts,
    errorCount: errors.length,
    sampleErrors: errors.slice(0, 20),
    latencyMs: {
      min: sorted[0],
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      max: sorted[sorted.length - 1],
      avg: Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length),
    },
  };
}

try {
  const tokenManager = await createTokenManager();
  for (const phase of phases) phaseResults.push(await runPhase(phase, tokenManager));
  const result = { event: 'p2_performance_load_completed', checkedAt: new Date().toISOString(), baseUrl, phaseResults };
  writeFileSync('p2-performance-load-result.json', `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ event: result.event, phases: phaseResults.map((phase) => ({ name: phase.name, requests: phase.totalRequests, p95: phase.latencyMs.p95 })) }));
} catch (error) {
  const result = { event: 'p2_performance_load_failed', checkedAt: new Date().toISOString(), baseUrl, error: error.message, phaseResults };
  writeFileSync('p2-performance-load-result.json', `${JSON.stringify(result, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
}
