import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const resultPath = resolve(root, process.argv[2] ?? 'openapi-contract-check-result.json');
const reportPath = resolve(root, process.argv[3] ?? 'OpenAPI双向核对报告.md');
const result = JSON.parse(readFileSync(resultPath, 'utf8'));
const source = result.sourceRevision;
const lines = [
  '# OpenAPI 双向核对报告',
  '',
  `- 检查时间：${result.checkedAt}`,
  `- 被测源码 SHA：\`${source.sha}\``,
  `- 分支：\`${source.branch}\``,
  `- 已跟踪工作树干净：**${source.trackedWorktreeClean ? '是' : '否'}**`,
  `- 检查范围：${result.scope}`,
  `- 检查结论：**${result.status === 'pass' ? '通过' : '未通过'}**`,
  '- 技术栈：Hono + Node.js + TypeScript，权威契约为 OpenAPI 3.1。',
  '',
  '> 本报告只展示上述 SHA 的当次结果。旧 58 REAL＋29 GAP、481 操作及历史契约覆盖率均不作为当前结论。',
  '',
  '## 1. 输入与追溯',
  '',
  '| 输入 | 路径 | SHA-256 |',
  '|---|---|---|',
];
for (const [label, value] of Object.entries(result.inputs)) {
  const hashKey = { openapiPath: 'openapi', mappingPath: 'mapping', appPath: 'app', resourcesPath: 'resources', policyPath: 'routePolicy', contractProcessPath: 'contractProcess' }[label];
  lines.push(`| ${label} | ${displayPath(value)} | \`${result.inputSha256[hashKey]}\` |`);
}
lines.push(
  '',
  '核对规则：OpenAPI 与 Hono 实现按路径和 HTTP 方法双向核对，同时检查请求字段、查询参数、状态码和只读资源写暴露。',
  '',
  '## 2. 当前 SHA 汇总',
  '',
  '| 指标 | 数量 |',
  '|---|---:|',
  `| OpenAPI 路径数 | ${result.authoritative.paths} |`,
  `| OpenAPI 操作数 | ${result.authoritative.operations} |`,
  `| API 映射数 | ${result.authoritative.mappings} |`,
  `| 实际 API 操作数 | ${result.implementation.totalApiOperations} |`,
  `| 已匹配操作 | ${result.matched.operations} |`,
  `| 契约覆盖率 | ${(result.matched.coverage * 100).toFixed(2)}% |`,
  `| 缺失实现 | ${result.route.missingContractOperations.length} |`,
  `| 未文档化操作 | ${result.route.undocumentedOperations.length} |`,
  `| 只读契约仍暴露写操作 | ${result.route.readOnlyWriteExposures.length} |`,
  `| 字段 Schema 错误 | ${result.fieldSchema.errors.length} |`,
  `| 查询参数错误 | ${result.fieldSchema.parameterErrors.length} |`,
  `| 状态码错误 | ${result.statusCodes.errors.length} |`,
  '',
  '## 3. 差异明细',
  '',
  '### 3.1 OpenAPI 已定义但未实现',
  '',
  operationTable(result.route.missingContractOperations),
  '',
  '### 3.2 已实现但未文档化',
  '',
  operationTable(result.route.undocumentedOperations),
  '',
  '### 3.3 只读契约写暴露',
  '',
  operationTable(result.route.readOnlyWriteExposures),
  '',
  '### 3.4 字段、参数和状态码错误',
  '',
  `- 字段 Schema：${result.fieldSchema.errors.length} 项`,
  `- 查询参数：${result.fieldSchema.parameterErrors.length} 项`,
  `- 状态码：${result.statusCodes.errors.length} 项`,
  '',
  '## 4. 复跑方式',
  '',
  '```powershell',
  'npm run contract:check',
  'npm run contract:report',
  '```',
  '',
);
writeFileSync(reportPath, `${lines.join('\n')}\n`);
console.log(reportPath);

function operationTable(items) {
  if (items.length === 0) return '无。';
  const rows = ['| 方法 | 路径 | operationId |', '|---|---|---|'];
  for (const item of items) rows.push(`| ${item.method} | ${item.path} | ${item.operationId ?? ''} |`);
  return rows.join('\n');
}

function displayPath(value) {
  if (!value) return '';
  const relativePath = relative(root, value).replaceAll('\\', '/');
  return relativePath || value;
}
