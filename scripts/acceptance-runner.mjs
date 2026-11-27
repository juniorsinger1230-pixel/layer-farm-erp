import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const evidenceRoot = path.join(projectRoot, 'acceptance-evidence');
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
    const output = await psql("SELECT count(*) FROM app_auth.schema_migrations;");
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
};

const stageArg = process.argv[2]?.replace('--stage=', '') ?? process.argv[3];
const stages = stageArg ? [stageArg] : ['S0'];
const selectedCases = allCases.filter((item) => stages.includes(item.stage));
const ledgerPath = path.join(projectRoot, 'acceptance-ledger.json');
let ledger = { startedAt: new Date().toISOString(), stages, results: [] };

for (const item of selectedCases) {
  const key = `${item.stage}_${item.id.split('-')[1]}`;
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
