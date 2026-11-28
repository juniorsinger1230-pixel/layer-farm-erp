import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argumentsList = process.argv.slice(2);
function getOption(name) {
  const inline = argumentsList.find((argument) => argument.startsWith(`--${name}=`));
  if (inline) return inline.split('=').slice(1).join('=');
  const index = argumentsList.indexOf(`--${name}`);
  return index >= 0 ? argumentsList[index + 1] : null;
}
const runInput = getOption('run');
if (!runInput) {
  console.error('必须提供 --run=<严格运行目录>');
  process.exit(1);
}
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runDirectory = path.resolve(projectRoot, runInput);
const manifestPath = path.join(runDirectory, 'run-manifest.json');
const summaryPath = path.join(runDirectory, 'summary.json');
const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}
function resolveProjectFile(value) {
  return path.resolve(projectRoot, value);
}
function hashFile(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}
function checkFileHash(file, expectedHash, label) {
  if (!existsSync(file)) {
    errors.push(`${label} 不存在：${file}`);
    return;
  }
  assert(hashFile(file) === expectedHash, `${label} 哈希不一致：${file}`);
}

assert(existsSync(manifestPath), 'run-manifest.json 不存在');
assert(existsSync(summaryPath), 'summary.json 不存在');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const expectedStageCounts = { S0: 20, S1: 35, S2: 74, S3: 74, S4: 15, S5: 10, S6: 6 };
const stageCounts = {};
const expectedIds = Array.from({ length: 234 }, (_, index) => `TC-${String(index + 1).padStart(3, '0')}`);

for (const caseId of expectedIds) {
  const envelopePath = path.join(runDirectory, 'envelopes', `${caseId}.json`);
  if (!existsSync(envelopePath)) {
    errors.push(`信封不存在：${caseId}`);
    continue;
  }
  const envelope = JSON.parse(readFileSync(envelopePath, 'utf8'));
  stageCounts[envelope.stage] = (stageCounts[envelope.stage] ?? 0) + 1;
  for (const field of ['schemaVersion', 'caseId', 'stage', 'source', 'environment', 'precondition', 'evidence', 'regression', 'integrity']) {
    assert(Object.hasOwn(envelope, field), `${caseId} 缺少字段 ${field}`);
  }
  assert(envelope.caseId === caseId, `${caseId} ID 不匹配`);
  assert(envelope.pass === true && envelope.actualResult === '通过', `${caseId} 未通过`);
  assert(envelope.source.commitSha === manifest.source.commitSha, `${caseId} commitSha 不一致`);
  assert(envelope.source.worktreeClean === true, `${caseId} 工作树不干净`);
  const preconditionFile = resolveProjectFile(envelope.precondition.path);
  checkFileHash(preconditionFile, envelope.precondition.sha256, `${caseId} 前置数据`);
  const requestLog = resolveProjectFile(envelope.evidence.requestResponseLog);
  assert(existsSync(requestLog), `${caseId} 请求响应日志不存在`);
  const rawEvidence = resolveProjectFile(envelope.evidence.rawEvidence.path);
  checkFileHash(rawEvidence, envelope.evidence.rawEvidence.sha256, `${caseId} 原始证据`);
  for (const [filePath, hash] of Object.entries(envelope.evidence.referencedFiles ?? {})) {
    checkFileHash(resolveProjectFile(filePath), hash, `${caseId} 引用证据`);
  }
  assert(envelope.regression.runId === manifest.runId, `${caseId} 回归 runId 不一致`);
}

assert(summary.total === 234, 'summary.total 不等于 234');
assert(summary.passed === 234, 'summary.passed 不等于 234');
assert(summary.failed === 0, 'summary.failed 不等于 0');
for (const [stage, count] of Object.entries(expectedStageCounts)) {
  assert(stageCounts[stage] === count, `${stage} 数量不正确`);
}
assert(manifest.status === 'pass', 'manifest 状态不是 pass');

const report = {
  schemaVersion: 'strict-acceptance-verification/v1',
  verifiedAt: new Date().toISOString(),
  runDirectory: path.relative(projectRoot, runDirectory).replaceAll('\\', '/'),
  status: errors.length === 0 ? 'pass' : 'fail',
  envelopeCount: expectedIds.length,
  stageCounts,
  expectedStageCounts,
  errors,
};
const reportPath = path.join(runDirectory, 'verification-report.json');
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, errorCount: errors.length, reportPath }, null, 2));
if (errors.length) process.exit(1);
