import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

function promisifyExec(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 20 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stdout, stderr }));
      else resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

function writeJson(target, value) {
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function relativePath(projectRoot, target) {
  return path.relative(projectRoot, target).replaceAll('\\', '/');
}

function sha256File(target) {
  return createHash('sha256').update(readFileSync(target)).digest('hex');
}

function datePart(value) {
  return new Date(value).toISOString().slice(0, 10).replaceAll('-', '');
}

function listRunDirectories(projectRoot) {
  const evidenceRoot = path.join(projectRoot, 'strict-acceptance-evidence');
  if (!existsSync(evidenceRoot)) return [];
  return readdirSync(evidenceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('run-'))
    .map((entry) => path.join(evidenceRoot, entry.name));
}

function nextDefectId(projectRoot, discoveredAt) {
  const day = datePart(discoveredAt);
  let highest = 0;
  for (const runDirectory of listRunDirectories(projectRoot)) {
    const defectDirectory = path.join(runDirectory, 'defects');
    if (!existsSync(defectDirectory)) continue;
    for (const name of readdirSync(defectDirectory)) {
      const match = name.match(`^DEF-${day}-(\\d{3})\\.json$`);
      if (match) highest = Math.max(highest, Number(match[1]));
    }
  }
  return `DEF-${day}-${String(highest + 1).padStart(3, '0')}`;
}

function filterCaseEvents(runDirectory, caseId, targetPath) {
  const sources = [
    path.join(runDirectory, 'request-responses', 'node-http.jsonl'),
    path.join(runDirectory, 'request-responses', 'browser-http.jsonl'),
    path.join(runDirectory, 'browser', 'console.jsonl'),
    path.join(runDirectory, 'browser', 'pageerror.jsonl'),
  ];
  const events = [];
  for (const source of sources) {
    if (!existsSync(source)) continue;
    for (const line of readFileSync(source, 'utf8').split(/\r?\n/).filter(Boolean)) {
      const event = JSON.parse(line);
      if (event.caseId === caseId) events.push(event);
    }
  }
  writeFileSync(targetPath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
}

function collectReferencedPaths(value, projectRoot, sourceFile, collected, visited = new Set()) {
  if (visited.has(value)) return;
  visited.add(value);
  if (typeof value === 'string') {
    const candidate = path.resolve(projectRoot, value);
    if (existsSync(candidate) && candidate !== sourceFile) collected.add(candidate);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectReferencedPaths(item, projectRoot, sourceFile, collected, visited);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectReferencedPaths(item, projectRoot, sourceFile, collected, visited);
  }
}

export async function createDefectFromFailedRun(projectRoot, runDirectory) {
  const manifest = JSON.parse(readFileSync(path.join(runDirectory, 'run-manifest.json'), 'utf8'));
  const summary = JSON.parse(readFileSync(path.join(runDirectory, 'summary.json'), 'utf8'));
  const ledgerPath = path.join(projectRoot, 'acceptance-ledger.json');
  const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  const cases = JSON.parse(readFileSync(path.join(projectRoot, 'acceptance-cases.json'), 'utf8')).cases;
  const failedResult = (ledger.results ?? []).find((item) => !item.pass);
  const discoveredAt = new Date().toISOString();
  const defectId = nextDefectId(projectRoot, discoveredAt);
  const caseId = failedResult?.caseId
    ?? summary.failed?.[0]
    ?? cases[ledger.results?.length]?.id;
  const definition = cases.find((item) => item.id === caseId);
  if (!definition) throw new Error(`Cannot identify failed case for defect in ${runDirectory}`);

  const defectDirectory = path.join(runDirectory, 'defects');
  const requestDirectory = path.join(runDirectory, 'request-responses');
  mkdirSync(defectDirectory, { recursive: true });
  mkdirSync(requestDirectory, { recursive: true });
  const requestResponseLog = path.join(requestDirectory, `${caseId}.jsonl`);
  filterCaseEvents(runDirectory, caseId, requestResponseLog);

  const rawEvidencePath = failedResult?.evidencePath
    ? path.join(projectRoot, failedResult.evidencePath)
    : null;
  const referencedFiles = new Set();
  if (rawEvidencePath) {
    const rawEvidence = JSON.parse(readFileSync(rawEvidencePath, 'utf8'));
    collectReferencedPaths(rawEvidence, projectRoot, rawEvidencePath, referencedFiles);
  }

  const defect = {
    schemaVersion: 'strict-defect/v1',
    defectId,
    caseId,
    runId: manifest.runId,
    severity: 'P0',
    severityBasis: '阻断234条严格验收关闭，初始等级按P0登记，根因确认后可调整',
    precondition: {
      description: definition.precondition,
      snapshotPath: failedResult?.preconditionPath ?? null,
    },
    reproductionSteps: definition.steps,
    expectedResult: definition.expected,
    actualResult: {
      status: failedResult?.actualResult ?? summary.status,
      error: failedResult?.error ?? null,
      rawEvidencePath: failedResult?.evidencePath ?? null,
    },
    requestResponseEvidence: relativePath(projectRoot, requestResponseLog),
    screenshotsAndPdfs: [...referencedFiles]
      .filter((target) => /\.(png|jpe?g|pdf)$/i.test(target))
      .map((target) => relativePath(projectRoot, target)),
    rootCauseAnalysis: null,
    status: 'open',
    discoveredAt,
    fix: null,
    closure: null,
  };
  const target = path.join(defectDirectory, `${defectId}.json`);
  writeJson(target, defect);
  return { defect, path: target };
}

export async function createFixForDefect(projectRoot, runDirectory, defect, fixCommitSha, gitPath) {
  const { stdout: showOutput } = await promisifyExec(gitPath, [
    'show', '--format=fuller', fixCommitSha,
  ], { cwd: projectRoot });
  const { stdout: nameOutput } = await promisifyExec(gitPath, [
    'diff-tree', '--no-commit-id', '--name-only', '-r', fixCommitSha,
  ], { cwd: projectRoot });
  const { stdout: timeOutput } = await promisifyExec(gitPath, [
    'show', '-s', '--format=%cI', fixCommitSha,
  ], { cwd: projectRoot });
  const { stdout: messageOutput } = await promisifyExec(gitPath, [
    'show', '-s', '--format=%B', fixCommitSha,
  ], { cwd: projectRoot });

  const fixId = `FIX-${defect.defectId}`;
  const patchDirectory = path.join(runDirectory, 'patches');
  const fixDirectory = path.join(runDirectory, 'fixes');
  mkdirSync(patchDirectory, { recursive: true });
  mkdirSync(fixDirectory, { recursive: true });
  const patchPath = path.join(patchDirectory, `${fixId}.patch`);
  writeFileSync(patchPath, showOutput);
  const changedFiles = nameOutput.split(/\r?\n/).filter(Boolean);
  const fix = {
    schemaVersion: 'strict-fix/v1',
    fixId,
    defectId: defect.defectId,
    fixCommitSha,
    changedFiles,
    patchPath: relativePath(projectRoot, patchPath),
    updatedTestArtifacts: changedFiles.filter((item) => /(^|\/)tests?\/|\.test\.|\.spec\./.test(item)),
    fixExplanation: messageOutput.trim(),
    committedAt: timeOutput.trim(),
  };
  const fixPath = path.join(fixDirectory, `${fixId}.json`);
  writeJson(fixPath, fix);

  defect.status = 'fix-committed';
  defect.fixHistory = [
    ...(defect.fixHistory ?? []),
    ...(defect.fix ? [defect.fix] : []),
  ];
  defect.fix = {
    fixId,
    fixCommitSha,
    fixRecordPath: relativePath(projectRoot, fixPath),
  };
  const defectPath = path.join(runDirectory, 'defects', `${defect.defectId}.json`);
  writeJson(defectPath, defect);
  return { fix, path: fixPath };
}

export function closeDefectWithRegression(projectRoot, runDirectory, finalRunDirectory, defect) {
  const envelopePath = path.join(finalRunDirectory, 'envelopes', `${defect.caseId}.json`);
  if (!existsSync(envelopePath)) throw new Error(`Missing final envelope for ${defect.caseId}`);
  const envelope = JSON.parse(readFileSync(envelopePath, 'utf8'));
  const finalManifest = JSON.parse(readFileSync(path.join(finalRunDirectory, 'run-manifest.json'), 'utf8'));
  defect.status = 'closed';
  defect.closure = {
    regressionRunId: finalManifest.runId,
    finalCommitSha: finalManifest.source.commitSha,
    finalCaseEvidence: relativePath(projectRoot, envelopePath),
    finalPass: envelope.pass === true,
    closedAt: new Date().toISOString(),
  };
  const defectPath = path.join(runDirectory, 'defects', `${defect.defectId}.json`);
  writeJson(defectPath, defect);
  return defect;
}

export function readDefect(projectRoot, defectPath) {
  return JSON.parse(readFileSync(defectPath, 'utf8'));
}

export { sha256File };
