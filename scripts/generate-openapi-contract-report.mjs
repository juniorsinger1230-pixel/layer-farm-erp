import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const resultPath = resolve(root, process.argv[2] ?? 'openapi-contract-check-result.json');
const reportPath = resolve(root, process.argv[3] ?? 'OpenAPI双向核对报告.md');
const result = JSON.parse(readFileSync(resultPath, 'utf8'));

const lines = [];
lines.push('# OpenAPI 双向核对报告');
lines.push('');
lines.push(`- 检查时间：${result.checkedAt}`);
lines.push(`- 检查范围：${result.scope}`);
lines.push(`- 检查结论：**${result.status === 'pass' ? '通过' : '未通过'}**`);
lines.push('- 技术栈：Hono + Node.js + TypeScript，权威契约为 OpenAPI 3.1');
lines.push('');
lines.push('## 1. 输入与核对口径');
lines.push('');
lines.push('| 输入 | 路径 |');
lines.push('|---|---|');
for (const [label, value] of Object.entries(result.inputs)) {
  lines.push(`| ${label} | ${displayPath(value)} |`);
}
lines.push('');
lines.push('核对规则：');
lines.push('');
lines.push('- OpenAPI 到实现：权威契约中的每个方法和路径必须存在 Hono 路由。');
lines.push('- 实现到 OpenAPI：每个生产 API 路由必须在 OpenAPI 中登记。');
lines.push('- Hono 路径参数 `:id` 统一规范化为 OpenAPI 的 `{id}`。');
lines.push('- `/metrics` 与 `/health/*` 属于运维端点，不纳入本次 402 个业务 API 契约。');
lines.push('');
lines.push('## 2. 汇总结果');
lines.push('');
lines.push('| 指标 | 数量 |');
lines.push('|---|---:|');
lines.push(`| OpenAPI 路径数 | ${result.authoritative.paths} |`);
lines.push(`| OpenAPI 操作数 | ${result.authoritative.operations} |`);
lines.push(`| API 映射用例数 | ${result.authoritative.mappings} |`);
lines.push(`| 实际 API 操作数 | ${result.implementation.totalApiOperations} |`);
lines.push(`| 已匹配操作 | ${result.matched.operations} |`);
lines.push(`| 契约覆盖率 | ${(result.matched.coverage * 100).toFixed(2)}% |`);
lines.push(`| 缺失实现 | ${result.missingContractOperations.length} |`);
lines.push(`| 未文档化操作 | ${result.undocumentedOperations.length} |`);
lines.push(`| 其中：显式 Hono 路由未文档化 | ${result.explicitUndocumentedOperations.length} |`);
lines.push(`| 其中：通用生成路由未文档化 | ${result.genericUndocumentedOperations.length} |`);
lines.push(`| 只读契约仍暴露写操作 | ${result.readOnlyWriteExposures.length} |`);
lines.push(`| 非契约资源通用端点 | ${result.nonContractResourceEndpoints.length} |`);
lines.push('');
lines.push('### 缺失实现按领域分布');
lines.push('');
lines.push(domainTable(result.missingContractOperations));
lines.push('');
lines.push('## 3. 代码实证');
lines.push('');
lines.push(`- 通用资源路由生成循环位于 \`apps/api/src/app.ts:${lineForGeneratedLoop(result)}\`，现在先读取 \`resourceRoutePolicyByPath\`，仅注册策略允许的方法。`);
lines.push('- 资源定义来自 `packages/domain/src/generated/resources.ts`；没有路由策略的资源不会注册通用端点。');
lines.push('- 显式业务路由在 `apps/api/src/app.ts` 中逐个声明，具体行号见下表。');
lines.push('');
lines.push('### 3.1 只读契约写暴露');
lines.push('');
if (result.readOnlyWriteExposures.length === 0) {
  lines.push('无。');
} else {
  lines.push('| 方法 | 路径 | 需求 | 代码位置 |');
  lines.push('|---|---|---|---|');
  for (const item of result.readOnlyWriteExposures) {
    lines.push(`| ${item.method} | ${item.path} | ${item.contract.requirementId} | ${sourceLocation(item.source)} |`);
  }
}
lines.push('');
lines.push('### 3.2 非契约资源');
lines.push('');
const nonContractPaths = [...new Set(result.nonContractResourceEndpoints.map((item) => item.source.resource.path))];
lines.push('| 资源路径 | 表 | 代码位置 |');
lines.push('|---|---|---|');
for (const path of nonContractPaths) {
  const item = result.nonContractResourceEndpoints.find((entry) => entry.source.resource.path === path);
  lines.push(`| ${path} | ${item.source.resource.table} | ${sourceLocation(item.source)} |`);
}
lines.push('');
lines.push('### 3.3 已停止通用注册的资源');
lines.push('');
const resourcesSource = readFileSync(result.inputs.resourcesPath, 'utf8');
const policySource = readFileSync(result.inputs.policyPath, 'utf8');
const resourcePaths = [...resourcesSource.matchAll(/"path":\s*"([^"]+)"/g)].map((match) => match[1]);
const policyPaths = new Set([...policySource.matchAll(/"path":\s*"([^"]+)"/g)].map((match) => match[1]));
const removedPaths = [...new Set(resourcePaths.filter((path) => !policyPaths.has(path)))];
lines.push('| 资源路径 |');
lines.push('|---|');
for (const path of removedPaths) lines.push(`| ${path} |`);
lines.push('');
lines.push('## 4. 缺失实现明细');
lines.push('');
lines.push('以下为 OpenAPI 已定义但代码中不存在的操作。');
lines.push('');
lines.push(operationTable(result.missingContractOperations, true));
lines.push('');
lines.push('## 5. 未文档化显式路由明细');
lines.push('');
lines.push('以下为代码中显式声明、但未纳入权威 OpenAPI 的生产 API。');
lines.push('');
lines.push(operationTable(result.explicitUndocumentedOperations, false));
lines.push('');
lines.push('## 6. 未文档化通用路由明细');
lines.push('');
lines.push('以下为通用资源循环生成、但未在 OpenAPI 中登记的操作。');
lines.push('');
lines.push(operationTable(result.genericUndocumentedOperations, false));
lines.push('');
lines.push('## 7. 风险分级与处置建议');
lines.push('');
lines.push('| 类别 | 数量 | 分级 | 处置要求 |');
lines.push('|---|---:|---|---|');
lines.push(`| 只读契约仍暴露写操作 | ${result.readOnlyWriteExposures.length} | P1 | 禁用或迁移为真实领域动作，禁止保留通用写入入口 |`);
lines.push(`| OpenAPI 已定义但未实现 | ${result.missingContractOperations.length} | P1 | 按业务用例实现真实闭环，或走变更审批后修改契约 |`);
lines.push(`| 显式路由未文档化 | ${result.explicitUndocumentedOperations.length} | P1 | 补入 OpenAPI，定义请求/响应 Schema、状态码和鉴权 |`);
lines.push(`| 非契约资源通用端点 | ${result.nonContractResourceEndpoints.length} | P2 | 内部端点需明确豁免；生产无用端点应移除 |`);
lines.push('');
lines.push('处置原则：');
lines.push('');
lines.push('1. 不得为了通过检查而补空接口、占位页面或无业务规则的通用 CRUD。');
lines.push('2. 已实现且确实需要上线的接口，应先更新 OpenAPI 并形成设计变更记录。');
lines.push('3. 只读台账、报表、审计类资源不得暴露通用创建、修改和状态变更入口。');
lines.push('4. 路由/方法差异关闭后，继续执行字段、请求体、响应体、状态码和鉴权的 Schema 级核对。');
lines.push('');
lines.push('## 8. 复跑方式');
lines.push('');
lines.push('```powershell');
lines.push('npm run contract:check');
lines.push('node scripts/generate-openapi-contract-report.mjs');
lines.push('```');
lines.push('');
writeFileSync(reportPath, `${lines.join('\n')}\n`);
console.log(reportPath);

function operationTable(items, includeRequirement) {
  if (items.length === 0) return '无。';
  const headers = includeRequirement
    ? ['方法', '路径', 'operationId', '标签', '需求', '代码位置']
    : ['方法', '路径', 'operationId', '标签', '代码位置'];
  const rows = ['| ' + headers.join(' | ') + ' |', '| ' + headers.map(() => '---').join(' | ') + ' |'];
  for (const item of items) {
    const base = [item.method, item.path, item.operationId ?? '', item.tags?.join(',') ?? ''];
    if (includeRequirement) base.push(item.requirement?.requirementId ?? '');
    base.push(sourceLocation(item.source));
    rows.push('| ' + base.join(' | ') + ' |');
  }
  return rows.join('\n');
}

function domainTable(items) {
  const counts = {};
  for (const item of items) {
    const domain = item.tags?.[0] ?? 'NONE';
    counts[domain] = (counts[domain] ?? 0) + 1;
  }
  return ['| 领域 | 数量 |', '|---|---:|', ...Object.entries(counts).map(([domain, count]) => `| ${domain} | ${count} |`)].join('\n');
}

function sourceLocation(source) {
  if (!source) return '';
  const file = displayPath(source.file);
  return source.line ? `${file}:${source.line}` : file;
}

function lineForGeneratedLoop(result) {
  return result.genericUndocumentedOperations.find((entry) => entry.source?.line)?.source.line ?? 644;
}

function displayPath(value) {
  if (!value) return '';
  const relativePath = relative(root, value).replaceAll('\\', '/');
  return relativePath || value;
}
