import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureComposeServices, captureSource } from './strict-precondition-snapshot.mjs';
import { StrictNetworkRecorder } from './strict-network-recorder.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argumentsList = process.argv.slice(2);
const allMode = argumentsList.includes('--all');
const preflightOnly = argumentsList.includes('--preflight');
const gitPath = process.env.GIT_PATH ?? 'C:\\Program Files\\Git\\cmd\\git.exe';
const dockerPath = process.env.DOCKER_PATH ?? 'C:\\Users\\龚\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe';
const composeFile = path.join(projectRoot, 'deploy', 'compose', 'docker-compose.yml');
const projectName = process.env.STRICT_COMPOSE_PROJECT ?? process.env.COMPOSE_PROJECT_NAME ?? 'layer-farm-erp-strict';
const apiBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3100';
const webBaseUrl = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:8080';

function sha256File(target) {
  return createHash('sha256').update(readFileSync(target)).digest('hex');
}

function relativePath(target) {
  return path.relative(projectRoot, target).replaceAll('\\', '/');
}

function writeJson(target, value) {
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function collectReferencedFiles(value, sourceFile, collected) {
  if (typeof value === 'string') {
    const candidate = path.resolve(projectRoot, value);
    if (existsSync(candidate) && statSync(candidate).isFile() && candidate !== sourceFile && !collected.has(candidate)) {
      collected.add(candidate);
      if (candidate.endsWith('.json')) collectEvidenceReferences(candidate, collected);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectReferencedFiles(item, sourceFile, collected);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectReferencedFiles(item, sourceFile, collected);
  }
}

function collectEvidenceReferences(sourceFile, collected) {
  const data = JSON.parse(readFileSync(sourceFile, 'utf8'));
  collectReferencedFiles(data, sourceFile, collected);
}

function runChildProcess(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: projectRoot, stdio: 'inherit' });
    child.on('close', (code) => resolve(code));
    child.on('error', (error) => {
      console.error(error);
      resolve(1);
    });
  });
}

const source = captureSource(projectRoot, gitPath);
if (!source.worktreeClean) {
  console.error('严格运行拒绝启动：工作树不干净。');
  process.exit(1);
}
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const strictRoot = path.join(projectRoot, 'strict-acceptance-evidence', `run-${runId}`);
const directories = ['envelopes', 'preconditions', 'request-responses', 'bodies', 'browser', 'defects', 'fixes', 'patches', 'raw'];
for (const directory of directories) mkdirSync(path.join(strictRoot, directory), { recursive: true });

const { chromium } = await import('playwright');
const environment = {
  mode: 'local-compose',
  composeProject: projectName,
  composeFile: relativePath(composeFile),
  composeConfigSha256: sha256File(composeFile),
  webBaseUrl,
  apiBaseUrl,
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  browser: { name: 'chromium', executablePath: chromium.executablePath() },
  services: captureComposeServices(dockerPath, composeFile, projectName),
};

const runManifest = {
  schemaVersion: 'strict-acceptance-run/v1',
  runId,
  startedAt: new Date().toISOString(),
  status: preflightOnly ? 'preflight' : 'running',
  source,
  environment,
};
writeJson(path.join(strictRoot, 'run-manifest.json'), runManifest);

if (preflightOnly) {
  writeJson(path.join(strictRoot, 'summary.json'), { status: 'preflight-pass', runId });
  console.log(JSON.stringify({ status: 'preflight-pass', runId }, null, 2));
  process.exit(0);
}
if (!allMode) {
  console.error('严格关闭运行必须使用 --all。');
  process.exit(1);
}

const caseDefinitions = JSON.parse(readFileSync(path.join(projectRoot, 'acceptance-cases.json'), 'utf8')).cases;
const caseList = caseDefinitions.map((item) => item.id).join(',');
const exitCode = await runChildProcess(process.execPath, [
  path.join(projectRoot, 'scripts', 'acceptance-runner.mjs'),
  `--cases=${caseList}`,
  `--run-id=${runId}`,
  `--strict-root=${strictRoot}`,
]);
const ledger = JSON.parse(readFileSync(path.join(projectRoot, 'acceptance-ledger.json'), 'utf8'));
if (exitCode !== 0 || ledger.runId !== runId) {
  runManifest.status = 'failed';
  runManifest.finishedAt = new Date().toISOString();
  writeJson(path.join(strictRoot, 'run-manifest.json'), runManifest);
  writeJson(path.join(strictRoot, 'summary.json'), { status: 'fail', runId, resultCount: ledger.results?.length ?? 0 });
  process.exit(1);
}

const recorder = new StrictNetworkRecorder({ runId, projectRoot, strictRoot });
const envelopes = [];
for (const result of ledger.results) {
  const definition = caseDefinitions.find((item) => item.id === result.caseId);
  const rawEvidence = path.join(projectRoot, result.evidencePath);
  const referencedFiles = new Set([rawEvidence]);
  collectEvidenceReferences(rawEvidence, referencedFiles);
  const requestResponseLog = path.join(strictRoot, 'request-responses', `${result.caseId}.jsonl`);
  recorder.filterCaseEvents(result.caseId, requestResponseLog);
  const fileHashes = new Map();
  for (const file of referencedFiles) fileHashes.set(relativePath(file), sha256File(file));
  fileHashes.set(relativePath(requestResponseLog), sha256File(requestResponseLog));
  const preconditionFile = result.preconditionPath ? path.join(projectRoot, result.preconditionPath) : null;
  const envelope = {
    schemaVersion: 'strict-acceptance-envelope/v1',
    caseId: definition.id,
    stage: definition.stage,
    pageId: definition.pageId,
    pageType: definition.pageType,
    operation: definition.operation,
    runId,
    source,
    environment,
    precondition: preconditionFile
      ? {
          path: relativePath(preconditionFile),
          sha256: sha256File(preconditionFile),
        }
      : {
          path: null,
          sha256: null,
          error: 'precondition snapshot was not produced',
        },
    execution: {
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      steps: definition.steps,
    },
    evidence: {
      requestResponseLog: relativePath(requestResponseLog),
      rawEvidence: {
        path: relativePath(rawEvidence),
        sha256: sha256File(rawEvidence),
      },
      referencedFiles: Object.fromEntries(fileHashes),
    },
    expected: {
      description: definition.expected,
      assertions: [definition.expected],
    },
    actualResult: result.actualResult,
    pass: result.pass,
    defect: null,
    fix: null,
    regression: {
      regressionId: `REG-${runId}-${definition.id}`,
      runId,
      caseId: definition.id,
      pass: result.pass,
      evidencePath: `envelopes/${definition.id}.json`,
    },
  };
  const canonical = JSON.stringify(envelope);
  envelope.integrity = {
    envelopeSha256: createHash('sha256').update(canonical).digest('hex'),
    referencedFilesSha256: Object.fromEntries(fileHashes),
  };
  const envelopePath = path.join(strictRoot, 'envelopes', `${definition.id}.json`);
  writeJson(envelopePath, envelope);
  envelopes.push({ caseId: definition.id, path: relativePath(envelopePath), pass: envelope.pass });
}

const summary = {
  schemaVersion: 'strict-acceptance-summary/v1',
  runId,
  status: 'pass',
  total: envelopes.length,
  passed: envelopes.filter((item) => item.pass).length,
  failed: envelopes.filter((item) => !item.pass).length,
  envelopes,
};
runManifest.status = 'pass';
runManifest.finishedAt = new Date().toISOString();
writeJson(path.join(strictRoot, 'run-manifest.json'), runManifest);
writeJson(path.join(strictRoot, 'summary.json'), summary);
console.log(JSON.stringify({ status: 'pass', total: summary.total, runId }, null, 2));
