import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const casesPath = join(root, 'acceptance-cases.json');
const ledgerPath = join(root, 'acceptance-ledger.json');
const auditPath = join(root, 'acceptance-evidence/run-2026-11-27T11-05-39-030Z/G5-final-ledger-audit.json');
const currentEvidencePath = join(root, 'current-sha-evidence/manifest.json');
const definitions = JSON.parse(readFileSync(casesPath, 'utf8'));
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
const g5Audit = JSON.parse(readFileSync(auditPath, 'utf8'));
const currentEvidence = JSON.parse(readFileSync(currentEvidencePath, 'utf8'));
const environmentDriftIds = new Set(['TC-013', 'TC-019']);
const finalCaseId = 'TC-234';
const generatedAt = new Date().toISOString();

const runs = [...ledger.history, ledger];
const allResults = runs.flatMap((run) => (run.results ?? []).map((result) => ({
  ...result,
  runId: run.runId ?? result.evidencePath?.match(/run-([^/]+)/)?.[1] ?? `legacy-${run.startedAt}`,
  runStartedAt: run.startedAt,
})));
const historyByCase = new Map(definitions.cases.map((item) => [item.id, []]));
for (const result of allResults) {
  if (!historyByCase.has(result.caseId)) throw new Error(`Unknown case in ledger: ${result.caseId}`);
  historyByCase.get(result.caseId).push(result);
}
for (const history of historyByCase.values()) history.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
const authoritativeByCase = new Map(g5Audit.authoritativeResults.map((item) => [item.caseId, item]));
const expectedIds = Array.from({ length: 234 }, (_, index) => `TC-${String(index + 1).padStart(3, '0')}`);
const actualIds = definitions.cases.map((item) => item.id);
const stages = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
const environmentNotes = {
  'TC-013': 'S0 环境基线漂移：原始证据为8名员工，后续账号准备后为16名，与“恰好8名”定义不符；采用早期通过证据并保留后续失败。',
  'TC-019': 'S0 环境基线漂移：修复工作树曾按预期不洁净；修复后续已提交，但不倒写原执行时SHA。',
};

const ledgerCases = definitions.cases.map((definition) => {
  const history = historyByCase.get(definition.id);
  const authoritative = authoritativeByCase.get(definition.id);
  if (!authoritative) throw new Error(`Missing authoritative pass: ${definition.id}`);
  const authoritativeIndex = history.findIndex((item) => item.pass === true
    && item.evidencePath === authoritative.evidencePath
    && item.finishedAt === authoritative.finishedAt);
  if (authoritativeIndex < 0) throw new Error(`Authoritative result not found in history: ${definition.id}`);
  const authoritativeResult = history[authoritativeIndex];
  const failures = history.filter((item) => item.pass !== true);
  const latestResult = history.at(-1);
  if (!existsSync(resolve(root, authoritative.evidencePath))) throw new Error(`Missing evidence file: ${definition.id}`);
  if (!environmentDriftIds.has(definition.id) && latestResult.pass !== true) throw new Error(`Unexpected latest failure: ${definition.id}`);
  if (failures.length > 0 && !environmentDriftIds.has(definition.id) && authoritativeResult.startedAt <= failures.at(-1).startedAt) {
    throw new Error(`Failure is not closed by a later authoritative pass: ${definition.id}`);
  }
  return {
    id: definition.id,
    stage: definition.stage,
    definition: {
      pageId: definition.pageId,
      pageType: definition.pageType,
      operation: definition.operation,
      precondition: definition.precondition,
      steps: definition.steps,
      expected: definition.expected,
      apiPath: definition.apiPath,
      definitionSha: definition.sha,
    },
    execution: {
      total: history.length,
      passed: history.filter((item) => item.pass === true).length,
      failed: failures.length,
      lastFailure: failures.at(-1) ?? null,
      latestResult,
    },
    status: '已关闭（有权威通过证据）',
    note: environmentNotes[definition.id] ?? (definition.id === finalCaseId ? '严格终检历史保留；最终严格版通过。' : ''),
    authoritativePass: {
      runId: authoritativeResult.runId,
      startedAt: authoritativeResult.startedAt,
      finishedAt: authoritativeResult.finishedAt,
      actualResult: authoritativeResult.actualResult,
      evidencePath: authoritativeResult.evidencePath,
      defectId: authoritativeResult.defectId,
    },
    history,
  };
});

const failedCases = ledgerCases.filter((item) => item.execution.failed > 0);
const regressionCaseCount = failedCases.filter((item) => !environmentDriftIds.has(item.id) && item.id !== finalCaseId).length;
const stageSummary = stages.map((stage) => {
  const items = ledgerCases.filter((item) => item.stage === stage);
  return {
    stage,
    cases: items.length,
    authoritativePass: items.filter((item) => item.authoritativePass).length,
    executions: items.reduce((sum, item) => sum + item.execution.total, 0),
    failedRecords: items.reduce((sum, item) => sum + item.execution.failed, 0),
  };
});
const sourceSha = currentEvidence.sourceRevision.sha;
const functionalFixCommit = '9886853fea7c4192450c1a6d249b3ebd33465e05';
const productDiff = git(['diff', '--name-only', `${functionalFixCommit}..HEAD`, '--', 'apps', 'packages']);
const productCodeUnchangedSinceFixCommit = productDiff.length === 0;
const inputSha256 = Object.fromEntries(Object.entries({ casesPath, ledgerPath, auditPath, currentEvidencePath }).map(([key, path]) => [key, sha256(path)]));
const checks = {
  continuousIds: JSON.stringify(actualIds) === JSON.stringify(expectedIds),
  uniqueDefinitions: new Set(actualIds).size === 234,
  stageCounts: stageSummary.every((item) => item.cases === definitions.stageCounts[item.stage] && item.authoritativePass === item.cases),
  g5AuditPass: g5Audit.pass === true && g5Audit.authoritativePassCount === 234,
  authoritativeEvidencePresent: ledgerCases.every((item) => existsSync(resolve(root, item.authoritativePass.evidencePath))),
  allReferencedEvidencePresent: allResults.every((item) => item.evidencePath && existsSync(resolve(root, item.evidencePath))),
  allResultsAssigned: ledgerCases.reduce((sum, item) => sum + item.execution.total, 0) === allResults.length,
  nonEnvironmentLatestPass: ledgerCases.filter((item) => !environmentDriftIds.has(item.id)).every((item) => item.execution.latestResult.pass === true),
  regressionCaseCount: regressionCaseCount === 143,
  currentContract479: currentEvidence.contract.authoritativeOperations === 479 && currentEvidence.contract.matchedOperations === 479 && currentEvidence.contract.status === 'pass',
  currentCoveragePass: currentEvidence.status === 'pass' && currentEvidence.tests.pass === 137 && currentEvidence.tests.fail === 0,
  productCodeUnchangedSinceFixCommit,
};
const pass = Object.values(checks).every(Boolean);
if (!pass) throw new Error(`Report input validation failed: ${JSON.stringify(checks)}`);

const jsonOutput = {
  generatedAt,
  status: 'pass',
  authorityRule: g5Audit.authorityRule,
  scope: {
    totalCases: definitions.totalCases,
    stageCounts: definitions.stageCounts,
    operations: 479,
    manualCreatePages: 74,
    systemReadOnlyPages: 2,
    systemReadOnlyPageIds: ['trace-001', 'plat-001'],
  },
  provenance: {
    caseDefinitionBaselineSha: definitions.baseline.sha,
    functionalFixCommit,
    currentCoverageContractSourceSha: sourceSha,
    productCodeUnchangedSinceFixCommit,
    boundary: '234条功能用例采用各次真实执行及G5权威关闭规则，未宣称全部234条在currentCoverageContractSourceSha上重新执行。第7步契约与覆盖率在该SHA上独立重跑。',
  },
  executionSummary: {
    runs: runs.length,
    results: allResults.length,
    passedResults: allResults.filter((item) => item.pass === true).length,
    failedResults: allResults.filter((item) => item.pass !== true).length,
    failedCases: failedCases.length,
    historicalRegressionCases: regressionCaseCount,
    environmentDriftCases: [...environmentDriftIds],
    strictFinalCase: finalCaseId,
  },
  stageSummary,
  inputSha256,
  cases: ledgerCases,
};
const jsonPath = join(root, 'S0-S6_234条逐条验收台账.json');
writeFileSync(jsonPath, `${JSON.stringify(jsonOutput, null, 2)}\n`);

const ledgerLines = [
  '# S0～S6 234条逐条验收台账',
  '',
  `- 生成时间：${generatedAt}`,
  '- 权威规则：每用例最近一次通过作为关闭证据；TC-013、TC-019 按登记的 S0 环境基线漂移处理。',
  `- 执行历史：${runs.length} 个运行、${allResults.length} 条结果；本表234行均有权威通过证据。`,
  '- SHA边界：功能用例保留真实运行ID和证据，不倒写后续提交SHA；第7步契约与覆盖率绑定 `0be074655eb444ccb36ba03aabbaf06cc6abfbed`。',
  '- “执行/失败”是该用例全部历史记录数；“最后失败”只用于追溯，不表示当前未关闭。完整逐次记录见同名 JSON。',
  '',
];
for (const stage of stages) {
  ledgerLines.push(`## ${stage}（${definitions.stageCounts[stage]}条）`, '');
  ledgerLines.push('| 用例 | 页面/类型 | 操作与预期 | 执行/失败 | 权威通过运行与时间 | 权威证据 | 最后失败/备注 |');
  ledgerLines.push('|---|---|---|---:|---|---|---|');
  for (const item of ledgerCases.filter((entry) => entry.stage === stage)) {
    const lastFailure = item.execution.lastFailure;
    const failureText = lastFailure ? `${lastFailure.runId}<br>\`${lastFailure.evidencePath}\`` : '无';
    const note = item.note ? `<br>${item.note}` : '';
    ledgerLines.push(`| ${item.id} | ${md(item.definition.pageId)}<br>${md(item.definition.pageType)} | ${md(item.definition.operation)}<br>**预期：**${md(item.definition.expected)} | ${item.execution.total}/${item.execution.failed} | \`${item.authoritativePass.runId}\`<br>${item.authoritativePass.finishedAt} | \`${item.authoritativePass.evidencePath}\` | ${failureText}${md(note)} |`);
  }
  ledgerLines.push('');
}
while (ledgerLines.at(-1) === '') ledgerLines.pop();
const ledgerMdPath = join(root, 'S0-S6_234条逐条验收台账.md');
writeFileSync(ledgerMdPath, `${ledgerLines.join('\n')}\n`);

const reportLines = [
  '# S0～S6 总体验收报告',
  '',
  '## 1. 总结论',
  '',
  '**固定清单的234条验收用例均已形成权威通过证据，待执行0条，权威证据缺失0条。** G5严格终检通过；第7步OpenAPI契约、137项后端测试和覆盖率已在固定源码SHA上重新执行并通过。',
  '',
  '本结论仅表示既定S0～S6清单按权威规则完成软件验收取证，不等于生产上线批准，也不表示全部234条在同一后续提交上重新执行。',
  '',
  '## 2. 范围与追溯口径',
  '',
  '| 项目 | 当前唯一口径 |',
  '|---|---|',
  '| 用例 | S0～S6共234条，TC-001～TC-234连续且定义唯一 |',
  '| API | 479/479操作，契约覆盖率100.00% |',
  '| 页面 | 74个人工创建页＋2个系统只读页（trace-001、plat-001） |',
  '| 表单 | 541个可见字段、110个引用字段 |',
  `| 用例定义基线 | \`${definitions.baseline.sha}\` |`,
  `| G0～G5修复固化提交 | \`${functionalFixCommit}\` |`,
  `| 第7步契约/覆盖率被测SHA | \`${sourceSha}\` |`,
  '',
  '旧58 REAL＋29 GAP、481操作和旧覆盖率不进入当前结果。功能证据保留实际运行ID；修复工作树随后固化为提交，不将后续SHA倒写为早期执行时SHA。已核验从G0～G5修复固化提交到本报告生成时，`apps/`与`packages/`无产品代码差异。',
  '',
  '## 3. 阶段结果',
  '',
  '| 阶段 | 用例数 | 权威通过 | 历史执行记录 | 历史失败记录 |',
  '|---|---:|---:|---:|---:|',
  ...stageSummary.map((item) => `| ${item.stage} | ${item.cases} | ${item.authoritativePass} | ${item.executions} | ${item.failedRecords} |`),
  `| **合计** | **234** | **234** | **${allResults.length}** | **${allResults.filter((item) => item.pass !== true).length}** |`,
  '',
  'S0的20条权威通过包含TC-013、TC-019的环境基线漂移处置，不能简单按每用例最后一条记录重算为18/20。非环境项最新失败为0。',
  '',
  '## 4. 执行历史与缺陷闭环',
  '',
  `- 共读取${runs.length}个运行记录、${allResults.length}条执行结果：通过${allResults.filter((item) => item.pass === true).length}条，失败/阻断${allResults.filter((item) => item.pass !== true).length}条。`,
  `- ${failedCases.length}个用例曾出现失败记录，其中${regressionCaseCount}个属于历史失败回归项，另有TC-013/TC-019两项环境漂移和TC-234自身严格终检历史；不得把${failedCases.length}写成当前未关闭缺陷数。`,
  '- G5首轮143项重跑在13条通过后停止于TC-044；续跑130/130通过。失败即停、账号复位和续跑记录均保留。',
  '- 严格版TC-234发现桌面DatePicker字符串初始化导致编辑空白，修复后桌面PATCH=200、跨公司PATCH=403且原记录未被修改，最终运行`2026-11-27T11-05-39-030Z`通过。',
  '- 234条逐条操作、预期、执行次数、最后失败、权威通过运行、证据路径及完整历史见`S0-S6_234条逐条验收台账.md`和同名JSON。',
  '',
  '## 5. 第7步契约与覆盖率复核',
  '',
  '| 项目 | 当前SHA实测 |',
  '|---|---:|',
  '| OpenAPI双向匹配 | 479/479；缺失、未文档化、只读写暴露均为0 |',
  '| 字段/参数/状态码错误 | 0/0/0 |',
  '| Node测试 | 137/137；失败、取消、跳过均为0 |',
  '| 语句/行覆盖率 | 95.71%/95.71% |',
  '| 分支/函数覆盖率 | 68.57%/93.39% |',
  '',
  `证据来源：\`current-sha-evidence/manifest.json\`，被测SHA为\`${sourceSha}\`。覆盖率仅含测试加载的后端文件，不含Web，不等于全系统或本234条功能覆盖率。`,
  '',
  '## 6. 证据完整性与独立复核',
  '',
  '| 检查 | 结果 |',
  '|---|---|',
  ...Object.entries(checks).map(([key, value]) => `| ${key} | ${value ? '通过' : '失败'} |`),
  '',
  `G5独立终检：\`${g5Audit.finalRunId}\`，authoritativePassCount=${g5Audit.authoritativePassCount}，pass=${g5Audit.pass}。本报告生成器再次核对234条权威通过与原始历史一一匹配，且234个权威证据文件均存在。`,
  '',
  '## 7. 未关闭边界与生产准出限制',
  '',
  '- PR #12仍无真实独立GitHub Approve，未合并；作者评论和自评不能替代独立评审。',
  '- Firefox/WebKit、Android/iOS实机、实体M421出纸、完整生产性能、阿里云生产资源、域名/TLS、KMS、备份恢复、监控告警和CI/CD尚未完成。',
  '- TC-233通过路由拦截验证500错误展示，不替代真实断网、服务崩溃、超时和生产故障演练。',
  '- Web生产构建仍有大于500 kB的chunk警告；本报告不宣称完成包体积整改。',
  '- 本报告没有将历史功能执行包装成同一最终SHA的234条全量重跑；如上线门禁要求该条件，应另行执行全量同SHA回归。',
  '',
  '## 8. 交付物',
  '',
  '- `S0-S6_总体验收报告.md`：本报告。',
  '- `S0-S6_234条逐条验收台账.md`：234行人类可读台账。',
  '- `S0-S6_234条逐条验收台账.json`：234条定义、权威通过及1812条完整执行历史。',
  '- `S0-S6_第8步报告审计.json`：生成结果、输入哈希和机器校验。',
];
const reportPath = join(root, 'S0-S6_总体验收报告.md');
writeFileSync(reportPath, `${reportLines.join('\n')}\n`);

const reportAudit = {
  generatedAt,
  pass,
  checks,
  totals: {
    definitions: definitions.cases.length,
    authoritativePass: ledgerCases.length,
    markdownRows: ledgerCases.length,
    historyResults: allResults.length,
    jsonCaseHistoryResults: jsonOutput.cases.reduce((sum, item) => sum + item.history.length, 0),
    stageSummary,
  },
  inputSha256,
  outputSha256: {
    report: sha256(reportPath),
    ledgerMarkdown: sha256(ledgerMdPath),
    ledgerJson: sha256(jsonPath),
  },
};
writeFileSync(join(root, 'S0-S6_第8步报告审计.json'), `${JSON.stringify(reportAudit, null, 2)}\n`);
console.log(JSON.stringify(reportAudit, null, 2));

function git(args) {
  return execFileSync(process.env.GIT_PATH ?? 'git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function md(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\r', '').replaceAll('\n', '<br>');
}
