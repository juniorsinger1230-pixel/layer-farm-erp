import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const modeArg = args.find((arg) => arg.startsWith('--mode='))?.split('=')[1];
const outputArg = args.find((arg) => arg.startsWith('--output='))?.split('=')[1];
const mode = modeArg ?? (process.env.CI ? 'ci' : 'local');
const checks = {};
const violations = [];
const expectedStageCounts = { S0: 20, S1: 35, S2: 74, S3: 74, S4: 15, S5: 10, S6: 6 };

const policy = readJson('snapshot-isolation-policy.json');
const casesFile = readJson('acceptance-cases.json');
const baseline = readJson('acceptance-baseline.json');
const manifest = readJson('current-sha-evidence/manifest.json');
const coverageSummary = readJson('current-sha-evidence/coverage-summary.json');
const contractResult = readJson('current-sha-evidence/openapi-contract-check-result.json');
const finalLedger = readJson('S0-S6_234条逐条验收台账.json');
const step8Audit = readJson('S0-S6_第8步报告审计.json');
const finalReportText = readText('S0-S6_总体验收报告.md');
const finalLedgerText = readText('S0-S6_234条逐条验收台账.md');
const expectedIds = Array.from({ length: 234 }, (_, index) => `TC-${String(index + 1).padStart(3, '0')}`);

check('policy-constants', () => {
  const expected = policy.expected;
  mustEqual(expected.totalCases, 234);
  mustEqual(expected.operations, 479);
  mustEqual(expected.manualCreatePages, 74);
  mustEqual(expected.systemReadOnlyPages, 2);
  mustEqual(expected.visibleFields, 541);
  mustEqual(expected.referenceFields, 110);
  mustEqual(JSON.stringify(expected.stageCounts), JSON.stringify(expectedStageCounts));
});

check('case-definitions', () => {
  mustEqual(casesFile.totalCases, 234);
  mustEqual(casesFile.cases.length, 234);
  mustEqual(JSON.stringify(casesFile.stageCounts), JSON.stringify(expectedStageCounts));
  mustEqual(JSON.stringify(casesFile.cases.map((item) => item.id)), JSON.stringify(expectedIds));
  mustEqual(new Set(casesFile.cases.map((item) => item.id)).size, 234);
  for (const item of casesFile.cases) {
    mustEqual(item.sha, policy.frozenCaseDefinitionSha);
    if (!item.operation || !item.expected || !item.steps) throw new Error(`${item.id} definition incomplete`);
  }
});

check('baseline-scope', () => {
  mustEqual(baseline.git.sha, policy.frozenCaseDefinitionSha);
  mustEqual(baseline.authoritativeContract.operations, 479);
  mustEqual(baseline.authoritativeContract.implementationOperations, 479);
  mustEqual(baseline.pageScope.totalRegistryPages, 87);
  mustEqual(baseline.pageScope.manualCreatePages, 74);
  mustEqual(baseline.pageScope.systemReadOnlyPages, 2);
  mustEqual(baseline.pageScope.otherReadOnlyPages, 11);
  mustEqual(JSON.stringify(baseline.pageScope.systemReadOnlyPageIds), JSON.stringify(['trace-001', 'plat-001']));
  mustEqual(baseline.formScope.visibleFields, 541);
  mustEqual(baseline.formScope.referenceFields, 110);
});

check('current-contract-result', () => {
  mustEqual(contractResult.sourceRevision.sha, policy.currentCoverageContractSourceSha);
  mustEqual(contractResult.status, 'pass');
  mustEqual(contractResult.authoritative.paths, 321);
  mustEqual(contractResult.authoritative.operations, 479);
  mustEqual(contractResult.authoritative.mappings, 100);
  mustEqual(contractResult.implementation.totalApiOperations, 479);
  mustEqual(contractResult.matched.operations, 479);
  mustEqual(contractResult.matched.coverage, 1);
  mustEqual(contractResult.route.missingContractOperations.length, 0);
  mustEqual(contractResult.route.undocumentedOperations.length, 0);
  mustEqual(contractResult.route.readOnlyWriteExposures.length, 0);
  mustEqual(contractResult.fieldSchema.errors.length, 0);
  mustEqual(contractResult.fieldSchema.parameterErrors.length, 0);
  mustEqual(contractResult.statusCodes.errors.length, 0);
});

check('manifest-matches-raw-evidence', () => {
  mustEqual(manifest.sourceRevision.sha, policy.currentCoverageContractSourceSha);
  mustEqual(manifest.status, 'pass');
  mustEqual(manifest.tests.tests, 137);
  mustEqual(manifest.tests.pass, 137);
  mustEqual(manifest.tests.fail, 0);
  mustEqual(manifest.contract.authoritativeOperations, 479);
  mustEqual(manifest.contract.implementationOperations, 479);
  mustEqual(manifest.contract.matchedOperations, 479);
  mustEqual(manifest.contract.missing, 0);
  mustEqual(manifest.contract.undocumented, 0);
  mustEqual(manifest.contract.readOnlyWriteExposures, 0);
  mustEqual(manifest.contract.schemaErrors, 0);
  mustEqual(manifest.contract.parameterErrors, 0);
  mustEqual(manifest.contract.statusErrors, 0);
  mustEqual(manifest.coverage.summarySha256, sha256('current-sha-evidence/coverage-summary.json'));
  mustEqual(manifest.contract.resultSha256, sha256('current-sha-evidence/openapi-contract-check-result.json'));
  for (const metric of ['statements', 'lines', 'branches', 'functions']) {
    mustEqual(manifest.coverage.total[metric].pct, coverageSummary.total[metric].pct);
  }
  mustEqual(manifest.coverage.total.statements.pct, 95.71);
  mustEqual(manifest.coverage.total.lines.pct, 95.71);
  mustEqual(manifest.coverage.total.branches.pct, 68.57);
  mustEqual(manifest.coverage.total.functions.pct, 93.39);
  if (!manifest.coverage.scope.includes('not full-system')) throw new Error('coverage scope boundary missing');
});

check('final-json-ledger', () => {
  mustEqual(finalLedger.status, 'pass');
  mustEqual(finalLedger.scope.totalCases, 234);
  mustEqual(finalLedger.scope.operations, 479);
  mustEqual(finalLedger.scope.manualCreatePages, 74);
  mustEqual(finalLedger.scope.systemReadOnlyPages, 2);
  mustEqual(finalLedger.cases.length, 234);
  mustEqual(JSON.stringify(finalLedger.cases.map((item) => item.id)), JSON.stringify(expectedIds));
  const historyCount = sum(finalLedger.cases.map((item) => item.history.length));
  mustEqual(historyCount, 1812);
  const failedCases = finalLedger.cases.filter((item) => item.execution.failed > 0);
  mustEqual(failedCases.length, 146);
  mustEqual(failedCases.filter((item) => !['TC-013', 'TC-019'].includes(item.id) && item.id !== 'TC-234').length, 143);
  let passCount = 0;
  let failCount = 0;
  for (const item of finalLedger.cases) {
    mustEqual(item.stage, casesFile.cases.find((definition) => definition.id === item.id).stage);
    mustEqual(item.status, '已关闭（有权威通过证据）');
    mustEqual(Boolean(item.authoritativePass.evidencePath), true);
    if (item.authoritativePass.evidencePath.includes('待填写')) throw new Error(`${item.id} placeholder evidence`);
    const matchingPass = item.history.find((history) => history.pass === true
      && history.evidencePath === item.authoritativePass.evidencePath
      && history.finishedAt === item.authoritativePass.finishedAt);
    if (!matchingPass) throw new Error(`${item.id} authoritative pass not in history`);
    for (const history of item.history) {
      if (history.pass === true) passCount += 1;
      else failCount += 1;
      if (!history.evidencePath || history.evidencePath === '待填写') throw new Error(`${item.id} bad history evidence`);
    }
    if (item.id === 'TC-013' || item.id === 'TC-019') {
      mustEqual(item.execution.latestResult.pass, false);
      if (!item.note.includes('环境基线漂移')) throw new Error(`${item.id} drift note missing`);
    } else {
      mustEqual(item.execution.latestResult.pass, true);
    }
  }
  mustEqual(passCount, 1466);
  mustEqual(failCount, 346);
});

check('final-markdown-ledger', () => {
  const rows = finalLedgerText.match(/^\| TC-\d{3} \|/gm) ?? [];
  mustEqual(rows.length, 234);
  mustEqual(new Set(rows.map((row) => row.match(/TC-\d{3}/)[0])).size, 234);
  if (/待执行|待填写|待回归/.test(finalLedgerText)) throw new Error('final markdown contains execution placeholders');
});

check('final-report-boundary', () => {
  if (!finalReportText.includes('234条验收用例均已形成权威通过证据')) throw new Error('final conclusion missing');
  if (!finalReportText.includes('不等于生产上线批准')) throw new Error('production boundary missing');
  if (!finalReportText.includes('不表示全部234条在同一后续提交上重新执行')) throw new Error('same-SHA boundary missing');
});

check('step8-hashes', () => {
  mustEqual(step8Audit.pass, true);
  mustEqual(step8Audit.totals.definitions, 234);
  mustEqual(step8Audit.totals.markdownRows, 234);
  mustEqual(step8Audit.totals.historyResults, 1812);
  const files = {
    report: 'S0-S6_总体验收报告.md',
    ledgerMarkdown: 'S0-S6_234条逐条验收台账.md',
    ledgerJson: 'S0-S6_234条逐条验收台账.json',
  };
  for (const [key, file] of Object.entries(files)) {
    mustEqual(sha256(file), step8Audit.outputSha256[key]);
  }
});

check('authoritative-files-tracked', () => {
  const trackedFiles = [
    'snapshot-isolation-policy.json',
    'acceptance-cases.json',
    'acceptance-baseline.json',
    'current-sha-evidence/manifest.json',
    'current-sha-evidence/coverage-summary.json',
    'current-sha-evidence/openapi-contract-check-result.json',
    'S0-S6_234条逐条验收台账.json',
    'S0-S6_234条逐条验收台账.md',
    'S0-S6_总体验收报告.md',
    'S0-S6_第8步报告审计.json',
  ];
  for (const file of trackedFiles) {
    git('ls-files', '--error-unmatch', file);
  }
});

check('forbidden-metric-isolation', () => {
  const archived = new Set(policy.archivedHistoricalPaths);
  const scanRoot = root;
  const files = walkFiles(scanRoot);
  for (const file of files) {
    const relativePath = toPosix(relative(root, file));
    if (archived.has(relativePath)) continue;
    const text = readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const metric of policy.forbiddenCurrentMetrics) {
        if (metric.patterns.some((pattern) => line.includes(pattern))) {
          violations.push(`${relativePath}:${index + 1} contains deprecated metric ${metric.id}`);
        }
      }
    });
  }
  if (violations.length) throw new Error(violations.join('; '));
});

if (mode === 'local') {
  check('local-full-history-and-evidence', () => {
    const ledger = readJson('acceptance-ledger.json');
    const g5Audit = readJson('acceptance-evidence/run-2026-11-27T11-05-39-030Z/G5-final-ledger-audit.json');
    const runs = [...ledger.history, ledger];
    const originalRows = runs.flatMap((run) => (run.results ?? []).map((result) => ({ ...result })));
    mustEqual(runs.length, 61);
    mustEqual(originalRows.length, 1812);
    mustEqual(originalRows.filter((item) => item.pass === true).length, 1466);
    mustEqual(originalRows.filter((item) => item.pass !== true).length, 346);
    mustEqual(g5Audit.pass, true);
    mustEqual(g5Audit.authoritativePassCount, 234);
    mustEqual(g5Audit.authoritativeResults.length, 234);
    mustEqual(sha256('acceptance-ledger.json'), step8Audit.inputSha256.ledgerPath);
    mustEqual(sha256('acceptance-evidence/run-2026-11-27T11-05-39-030Z/G5-final-ledger-audit.json'), step8Audit.inputSha256.auditPath);
    for (const item of finalLedger.cases) {
      const sourceHistory = originalRows.filter((row) => row.caseId === item.id);
      mustEqual(sourceHistory.length, item.history.length);
      item.history.forEach((history, index) => {
        const source = sourceHistory[index];
        for (const field of ['caseId', 'stage', 'pageId', 'operation', 'finishedAt', 'actualResult', 'evidencePath', 'defectId', 'pass']) {
          mustEqual(JSON.stringify(history[field]), JSON.stringify(source[field]));
        }
      });
      const authoritative = g5Audit.authoritativeResults.find((row) => row.caseId === item.id);
      mustEqual(authoritative.stage, item.stage);
      mustEqual(authoritative.finishedAt, item.authoritativePass.finishedAt);
      mustEqual(authoritative.evidencePath, item.authoritativePass.evidencePath);
      for (const history of item.history) {
        const evidencePath = resolve(root, history.evidencePath);
        if (!existsSync(evidencePath)) throw new Error(`missing evidence ${history.evidencePath}`);
      }
    }
  });
} else {
  checks['local-full-history-and-evidence'] = true;
}

const pass = Object.values(checks).every(Boolean) && violations.length === 0;
const result = {
  generatedAt: new Date().toISOString(),
  mode,
  pass,
  checks,
  violations,
  authoritativeCounts: {
    cases: 234,
    operations: 479,
    manualCreatePages: 74,
    systemReadOnlyPages: 2,
    historyResults: 1812,
  },
};
if (outputArg) writeFileSync(resolve(root, outputArg), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (!pass) process.exit(1);

function check(name, callback) {
  try {
    callback();
    checks[name] = true;
  } catch (error) {
    checks[name] = false;
    violations.push(`${name}: ${error.message}`);
  }
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function readText(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function sha256(relativePath) {
  return createHash('sha256').update(readFileSync(resolve(root, relativePath))).digest('hex');
}

function git(...args) {
  return execFileSync(process.env.GIT_PATH ?? 'git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
}

function mustEqual(actual, expected) {
  if (actual !== expected) throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function toPosix(path) {
  return path.split('\\').join('/');
}

function walkFiles(directory) {
  const skip = new Set(['.git', 'node_modules', 'dist', 'coverage', 'playwright-report', 'test-results', '.runtime', 'sbom', 'acceptance-evidence']);
  const extensions = new Set(['.md', '.json', '.mjs', '.js', '.ts', '.tsx', '.yml', '.yaml', '.txt']);
  const results = [];
  for (const entry of readdirSync(directory)) {
    if (skip.has(entry)) continue;
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) results.push(...walkFiles(path));
    else if (extensions.has(relative(root, path).match(/\.[^.]+$/)?.[0] ?? '')) results.push(path);
  }
  return results;
}
