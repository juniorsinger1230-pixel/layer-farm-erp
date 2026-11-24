import { writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const project = process.env.P2_COMPOSE_PROJECT ?? 'layer-farm-erp-p2';
const apiBase = process.env.API_BASE_URL ?? 'http://127.0.0.1:3100';
const webBase = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:8080';
const scenarios = [
  {
    name: 'postgres_unavailable_and_recovery',
    service: 'postgres',
    container: `${project}-postgres-1`,
    expectDegraded: [`${apiBase}/health/ready`],
    expectAvailable: [`${webBase}/`],
  },
  {
    name: 'valkey_unavailable_and_recovery',
    service: 'valkey',
    container: `${project}-valkey-1`,
    expectDegraded: [`${apiBase}/health/ready`],
    expectAvailable: [`${webBase}/`],
  },
  {
    name: 'api_unavailable_and_recovery',
    service: 'api',
    container: `${project}-api-1`,
    expectDegraded: [`${apiBase}/health/ready`, `${webBase}/health/ready`],
    expectAvailable: [`${webBase}/`],
  },
  {
    name: 'web_unavailable_api_remains_available',
    service: 'web',
    container: `${project}-web-1`,
    expectDegraded: [`${webBase}/`],
    expectAvailable: [`${apiBase}/health/ready`],
  },
];

async function docker(args) {
  const { stdout } = await exec('docker', args);
  return stdout.trim();
}

async function request(url) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    return { ok: response.ok, status: response.status, elapsedMs: Date.now() - startedAt };
  } catch (error) {
    return { ok: false, error: error.message, elapsedMs: Date.now() - startedAt };
  }
}

async function waitFor(url, expectedOk, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  let last;
  while (Date.now() < deadline) {
    last = await request(url);
    if (Boolean(last.ok) === expectedOk) return { detected: true, result: last, elapsedMs: Date.now() - (deadline - timeoutSeconds * 1000) };
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return { detected: false, result: last };
}

async function inspectState(container) {
  try {
    const state = await docker(['inspect', '-f', '{{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}', container]);
    return state;
  } catch (error) {
    return `inspect failed: ${error.message}`;
  }
}

try {
  const baseline = { api: await request(`${apiBase}/health/ready`), web: await request(`${webBase}/`) };
  const results = [];
  for (const scenario of scenarios) {
    const item = { ...scenario, baselineContainerState: await inspectState(scenario.container) };
    await docker(['stop', scenario.container]);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    item.faultContainerState = await inspectState(scenario.container);
    item.degradedChecks = await Promise.all(scenario.expectDegraded.map(async (url) => ({ url, ...await waitFor(url, false, 30) })));
    item.availableDuringFault = await Promise.all(scenario.expectAvailable.map(async (url) => ({ url, ...await request(url) })));
    const recoveryStartedAt = Date.now();
    await docker(['start', scenario.container]);
    item.recoveryContainerState = await inspectState(scenario.container);
    item.recoveredChecks = await Promise.all([...new Set([...scenario.expectDegraded, ...scenario.expectAvailable])].map(async (url) => {
      const expectedOk = true;
      const deadline = Date.now() + 120000;
      let last;
      while (Date.now() < deadline) {
        last = await request(url);
        if (last.ok === expectedOk) return { url, recovered: true, elapsedMs: Date.now() - recoveryStartedAt, result: last };
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      return { url, recovered: false, result: last };
    }));
    results.push(item);
  }
  const finalState = { api: await request(`${apiBase}/health/ready`), web: await request(`${webBase}/`) };
  const result = { event: 'p2_fault_injection_completed', checkedAt: new Date().toISOString(), project, baseline, results, finalState };
  writeFileSync('p2-fault-injection-result.json', `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ event: result.event, scenarioCount: results.length }));
} catch (error) {
  const result = { event: 'p2_fault_injection_failed', checkedAt: new Date().toISOString(), project, error: error.message };
  writeFileSync('p2-fault-injection-result.json', `${JSON.stringify(result, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
}
