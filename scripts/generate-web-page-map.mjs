import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = JSON.parse(fs.readFileSync(path.join(repoRoot, 'apps/web/src/data/pageRegistry.json'), 'utf8'));
const resourcesSource = fs.readFileSync(path.join(repoRoot, 'packages/domain/src/generated/resources.ts'), 'utf8');
const policySource = fs.readFileSync(path.join(repoRoot, 'packages/domain/src/generated/resource-route-policy.ts'), 'utf8');

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
const policyByRequirement = new Map(policies.filter((policy) => policy.requirementId).map((policy) => [policy.requirementId, policy]));
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
    permission: resource?.permission ?? '',
    companyScope: resource?.companyScope ?? true,
    contractPath: resource?.contractPath ?? true,
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
