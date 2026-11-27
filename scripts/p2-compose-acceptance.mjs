import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const root = new URL('..', import.meta.url);
const composeFile = new URL('../deploy/compose/docker-compose.yml', import.meta.url);
const outputFile = new URL('../p2-compose-acceptance-result.json', import.meta.url);
const projectName = process.env.P2_COMPOSE_PROJECT ?? 'layer-farm-erp-p2';
const checks = [];
const commandLogs = [];

const env = {
  ...process.env,
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ?? randomBytes(24).toString('base64url'),
  JWT_SIGNING_KEY: process.env.JWT_SIGNING_KEY ?? randomBytes(48).toString('hex'),
  POSTGRES_PORT: process.env.POSTGRES_PORT ?? '55432',
  VALKEY_PORT: process.env.VALKEY_PORT ?? '56379',
  API_PORT: process.env.API_PORT ?? '3100',
  WEB_PORT: process.env.WEB_PORT ?? '8080',
};

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeOutput(text) {
  if (!text) return '';
  return String(text)
    .replace(/postgresql:\/\/[^:\s/]+:[^@\s/]+@/g, 'postgresql://***:***@')
    .replace(/redis:\/\/[^:\s/]+:[^@\s/]+@/g, 'redis://***:***@')
    .replace(new RegExp(escapeRegExp(env.POSTGRES_PASSWORD), 'g'), '***')
    .replace(new RegExp(escapeRegExp(env.JWT_SIGNING_KEY), 'g'), '***')
    .slice(0, 2000);
}

function run(name, args, options = {}) {
  const startedAt = Date.now();
  try {
    const stdout = execFileSync('docker', ['compose', '--project-name', projectName, '-f', fileURLToPath(composeFile), ...args], {
      cwd: fileURLToPath(root),
      encoding: 'utf8',
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
    const trimmedStdout = stdout.trim();
    const record = { name, args, ok: true, durationMs: Date.now() - startedAt, stdoutBytes: trimmedStdout.length, stdout: sanitizeOutput(trimmedStdout) };
    commandLogs.push(record);
    checks.push({ name, ok: true });
    return stdout;
  } catch (error) {
    const record = {
      name,
      args,
      ok: false,
      durationMs: Date.now() - startedAt,
      stdout: sanitizeOutput(error.stdout?.toString().trim()),
      stderr: sanitizeOutput(error.stderr?.toString().trim()),
      message: sanitizeOutput(error.message),
    };
    commandLogs.push(record);
    checks.push({ name, ok: false, error: record.stderr ?? record.message });
    throw error;
  }
}

async function fetchCheck(name, url, expectedStatus = 200) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { cache: 'no-store' });
    const ok = response.status === expectedStatus;
    checks.push({ name, url, ok, status: response.status, durationMs: Date.now() - startedAt });
    if (!ok) throw new Error(`Expected ${expectedStatus}, got ${response.status}`);
  } catch (error) {
    checks.push({ name, url, ok: false, error: error.message, durationMs: Date.now() - startedAt });
    throw error;
  }
}

function fileURLToPath(url) {
  return decodeURIComponent(url.pathname.replace(/^\/([A-Za-z]:)/, '$1'));
}

async function waitForHealthy(label, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    last = execFileSync('docker', ['compose', '--project-name', projectName, '-f', fileURLToPath(composeFile), 'ps', '--format', 'json'], {
      cwd: fileURLToPath(root),
      encoding: 'utf8',
      env,
    }).trim();
    const lines = last.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    const required = lines.filter((item) => item.Service === 'postgres' || item.Service === 'valkey' || item.Service === 'api');
    if (required.length === 3 && required.every((item) => item.Health === 'healthy')) {
      checks.push({ name: `${label} service health`, ok: true });
      return lines;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  checks.push({ name: `${label} service health`, ok: false, last });
  throw new Error(`Timed out waiting for Compose services: ${label}`);
}

try {
  run('compose config', ['config']);
  run('compose build', ['build']);
  run('compose down', ['down', '--volumes', '--remove-orphans']);
  run('compose up', ['up', '--build', '--detach']);
  const firstPs = await waitForHealthy('initial');
  await fetchCheck('initial live endpoint', 'http://127.0.0.1:3100/health/live');
  await fetchCheck('initial ready endpoint', 'http://127.0.0.1:3100/health/ready');
  await fetchCheck('initial web endpoint', 'http://127.0.0.1:8080/');
  run('compose restart', ['restart']);
  const restartPs = await waitForHealthy('restart');
  await fetchCheck('restart live endpoint', 'http://127.0.0.1:3100/health/live');
  await fetchCheck('restart ready endpoint', 'http://127.0.0.1:3100/health/ready');
  run('compose force recreate', ['up', '--detach', '--force-recreate']);
  const recreatePs = await waitForHealthy('recreate');
  await fetchCheck('recreate web endpoint', 'http://127.0.0.1:8080/');
  const result = {
    event: 'p2_compose_acceptance_passed',
    checkedAt: new Date().toISOString(),
    projectName,
    composeFile: fileURLToPath(composeFile),
    secretValuesRecorded: false,
    checks,
    commands: commandLogs,
    finalServices: recreatePs,
    initialServiceCount: firstPs.length,
    restartServiceCount: restartPs.length,
    recreateServiceCount: recreatePs.length,
  };
  writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ event: result.event, totalChecks: checks.length, failedChecks: checks.filter((item) => !item.ok).length }));
} catch (error) {
  const result = {
    event: 'p2_compose_acceptance_failed',
    checkedAt: new Date().toISOString(),
    projectName,
    composeFile: fileURLToPath(composeFile),
    secretValuesRecorded: false,
    checks,
    commands: commandLogs,
    error: error.message,
  };
  writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`);
  console.error(error.message);
  process.exitCode = 1;
}
