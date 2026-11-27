import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  closeDefectWithRegression,
  createDefectFromFailedRun,
  createFixForDefect,
  readDefect,
} from './strict-defect-manager.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argumentsList = process.argv.slice(2);
function getOption(name, fallback) {
  const argument = argumentsList.find((item) => item.startsWith(`--${name}=`));
  return argument ? argument.split('=').slice(1).join('=') : fallback;
}
const maxAttempts = Number(getOption('max-attempts', '10'));
const pollIntervalMs = Number(getOption('poll-interval', '5000'));
const gitPath = process.env.GIT_PATH ?? 'C:\\Program Files\\Git\\cmd\\git.exe';
const evidenceRoot = path.join(projectRoot, 'strict-acceptance-evidence');
const loopId = new Date().toISOString().replace(/[:.]/g, '-');
const loopStatePath = path.join(evidenceRoot, `stage-f-loop-${loopId}.json`);
mkdirSync(evidenceRoot, { recursive: true });

function exec(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 20 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stdout, stderr }));
      else resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: projectRoot, stdio: 'inherit' });
    child.on('close', (code) => resolve(code));
    child.on('error', (error) => {
      console.error(error);
      resolve(1);
    });
  });
}

function writeState(value) {
  writeFileSync(loopStatePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function getHead() {
  const { stdout } = await exec(gitPath, ['rev-parse', 'HEAD'], { cwd: projectRoot });
  return stdout.trim();
}

async function getWorktreeStatus() {
  const { stdout } = await exec(gitPath, ['status', '--porcelain'], { cwd: projectRoot });
  return stdout.split(/\r?\n/).filter(Boolean);
}

function listRunDirectories() {
  if (!existsSync(evidenceRoot)) return [];
  return readdirSync(evidenceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('run-'))
    .map((entry) => path.join(evidenceRoot, entry.name));
}

function findNewRunDirectory(beforeSet) {
  const candidates = listRunDirectories()
    .filter((target) => !beforeSet.has(target))
    .map((target) => ({ target, mtime: statSync(target).mtimeMs }));
  if (!candidates.length) return null;
  return candidates.sort((left, right) => right.mtime - left.mtime)[0].target;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const state = {
  schemaVersion: 'stage-f-loop/v1',
  loopId,
  startedAt: new Date().toISOString(),
  status: 'running',
  maxAttempts,
  attempts: [],
  openDefects: [],
  closedDefects: [],
};
writeState(state);

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const startedHead = await getHead();
  const worktreeStatus = await getWorktreeStatus();
  if (worktreeStatus.length) {
    state.status = 'failed';
    state.error = `工作树不干净，不能启动第 ${attempt} 次严格运行`;
    state.finishedAt = new Date().toISOString();
    writeState(state);
    process.exit(1);
  }

  const attemptRecord = {
    attempt,
    startedAt: new Date().toISOString(),
    startCommitSha: startedHead,
    seed: null,
    strictRun: null,
    defect: null,
    fix: null,
  };
  state.attempts.push(attemptRecord);
  writeState(state);

  const seedCode = await run(process.execPath, [path.join(projectRoot, 'scripts', 'demo-seed.mjs')]);
  attemptRecord.seed = { exitCode: seedCode, finishedAt: new Date().toISOString() };
  writeState(state);
  if (seedCode !== 0) {
    state.status = 'failed';
    state.error = '确定性演示种子执行失败';
    state.finishedAt = new Date().toISOString();
    writeState(state);
    process.exit(seedCode);
  }

  const beforeRuns = new Set(listRunDirectories());
  const strictCode = await run(process.execPath, [
    path.join(projectRoot, 'scripts', 'strict-acceptance-runner.mjs'),
    '--all',
  ]);
  const runDirectory = findNewRunDirectory(beforeRuns);
  attemptRecord.strictRun = {
    exitCode: strictCode,
    runDirectory,
    finishedAt: new Date().toISOString(),
  };
  writeState(state);

  if (strictCode === 0 && runDirectory) {
    for (const item of state.openDefects) {
      const defect = readDefect(projectRoot, item.defectPath);
      const closed = closeDefectWithRegression(projectRoot, item.runDirectory, runDirectory, defect);
      state.closedDefects.push({
        defectId: closed.defectId,
        caseId: closed.caseId,
        defectPath: item.defectPath,
        regressionRunId: closed.closure.regressionRunId,
      });
    }
    state.openDefects = [];
    state.status = 'pass';
    state.finishedAt = new Date().toISOString();
    writeState(state);
    console.log(JSON.stringify({ status: 'pass', loopStatePath }, null, 2));
    process.exit(0);
  }

  if (!runDirectory) {
    state.status = 'failed';
    state.error = '严格运行失败且未找到运行目录';
    state.finishedAt = new Date().toISOString();
    writeState(state);
    process.exit(1);
  }

  const { defect, path: defectPath } = await createDefectFromFailedRun(projectRoot, runDirectory);
  attemptRecord.defect = { defectId: defect.defectId, defectPath };
  state.openDefects.push({ defectId: defect.defectId, runDirectory, defectPath });
  writeState(state);

  const failedHead = await getHead();
  console.log(`等待缺陷 ${defect.defectId} 的修复提交；检测到新干净提交后将自动从TC-001全量重跑。`);
  let fixHead = await getHead();
  let fixStatus = await getWorktreeStatus();
  while (fixHead === failedHead || fixStatus.length) {
    await sleep(pollIntervalMs);
    fixHead = await getHead();
    fixStatus = await getWorktreeStatus();
  }

  const { path: fixPath } = await createFixForDefect(projectRoot, runDirectory, defect, fixHead, gitPath);
  attemptRecord.fix = { fixCommitSha: fixHead, fixPath };
  const openItem = state.openDefects.find((item) => item.defectId === defect.defectId);
  if (openItem) openItem.fixCommitSha = fixHead;
  writeState(state);
}

state.status = 'failed';
state.error = '达到最大尝试次数，仍未完成同SHA全量严格运行';
state.finishedAt = new Date().toISOString();
writeState(state);
process.exit(1);
