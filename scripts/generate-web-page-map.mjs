import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = JSON.parse(fs.readFileSync(path.join(repoRoot, 'apps/web/src/data/pageRegistry.json'), 'utf8'));
const resourcesSource = fs.readFileSync(path.join(repoRoot, 'packages/domain/src/generated/resources.ts'), 'utf8');
const policySource = fs.readFileSync(path.join(repoRoot, 'packages/domain/src/generated/resource-route-policy.ts'), 'utf8');
const processSource = fs.readFileSync(path.join(repoRoot, 'packages/domain/src/contract-process.ts'), 'utf8');

function field(block, key) {
  return block.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`))?.[1] ?? '';
}

const resourceBlocks = [...resourcesSource.matchAll(/\{\s*"table"[\s\S]*?\}/g)].map((match) => match[0]);
const resources = resourceBlocks.map((block) => ({
  table: field(block, 'table'),
  path: field(block, 'path'),
  module: field(block, 'module'),
  permission: field(block, 'permission'),
  companyScope: block.includes('"companyScope": true'),
  contractPath: block.includes('"contractPath": true'),
}));
const resourceByPath = new Map(resources.map((resource) => [resource.path, resource]));
const policyLines = policySource.split('\n').filter((line) => line.includes('"table":'));
const policies = policyLines.map((line) => ({
  table: field(line, 'table'),
  path: field(line, 'path'),
  mode: field(line, 'mode'),
  requirementId: field(line, 'requirementId'),
  allowedMethods: [...line.matchAll(/"(GET|POST|PATCH|PUT|DELETE)"/g)].map((match) => match[1]),
}));

const processPermissionBySegment = {
  org: 'master',
  farm: 'production',
  vet: 'vet',
  proc: 'purchase',
  sales: 'sales',
  log: 'delivery',
  fin: 'finance',
  eqp: 'equipment',
  rpt: 'report',
  print: 'print',
  trace: 'report',
  plat: 'master',
};

function parseContractProcessPolicies(source) {
  const block = source.match(/export const contractProcessSpecs[^=]*= \[([\s\S]*?)\n\];/);
  if (!block) throw new Error('contractProcessSpecs not found');
  const specRegex = /\{\s+requirementId:\s*'([^']+)',\s*path:\s*'([^']+)',\s*schema:\s*'([^']+)',\s*table:\s*'([^']+)'[\s\S]*?\n\s+\}/g;
  return [...block[1].matchAll(specRegex)].map((match) => {
    const text = match[0];
    const readOnly = /readOnly: true/.test(text);
    const segment = match[2].split('/')[3];
    return {
      table: match[4],
      path: match[2],
      mode: readOnly ? 'READ_ONLY' : 'CRUD_AND_ACTION',
      requirementId: match[1],
      allowedMethods: readOnly ? ['GET'] : ['GET', 'POST', 'PATCH'],
      permission: processPermissionBySegment[segment],
      companyScope: !/companyKind: 'none'/.test(text),
      contractPath: true,
      itemKey: text.match(/itemKey: '([^']+)'/)?.[1] ?? 'id',
      itemType: text.match(/itemType: '([^']+)'/)?.[1] ?? 'integer',
    };
  });
}

const contractProcessPolicies = parseContractProcessPolicies(processSource);
const policyByRequirement = new Map();
for (const policy of policies.filter((item) => item.requirementId)) {
  policyByRequirement.set(policy.requirementId, policy);
}
for (const policy of contractProcessPolicies) {
  if (!policyByRequirement.has(policy.requirementId)) policyByRequirement.set(policy.requirementId, policy);
}

const mapped = {};
const gap = [];
for (const page of pages) {
  const policy = policyByRequirement.get(page.requirementId);
  if (!policy) {
    gap.push({ pageId: page.pageId, requirementId: page.requirementId, domain: page.domain, title: page.title });
    continue;
  }
  const resource = resourceByPath.get(policy.path);
  mapped[page.pageId] = {
    requirementId: page.requirementId,
    table: policy.table,
    path: policy.path,
    mode: policy.mode,
    allowedMethods: policy.allowedMethods,
    permission: resource?.permission ?? policy.permission ?? '',
    companyScope: resource?.companyScope ?? policy.companyScope ?? true,
    contractPath: resource?.contractPath ?? policy.contractPath ?? true,
    itemKey: policy.itemKey ?? 'id',
    itemType: policy.itemType ?? 'integer',
  };
}
const result = {
  total: pages.length,
  mappedCount: Object.keys(mapped).length,
  gapCount: gap.length,
  mapped,
  gap,
};
const outputDir = path.join(repoRoot, 'apps/web/src/generated');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'page-api-map.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ output: 'apps/web/src/generated/page-api-map.json', total: result.total, mappedCount: result.mappedCount, gapCount: result.gapCount }, null, 2));
