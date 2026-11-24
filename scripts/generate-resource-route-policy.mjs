import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mappingPath = resolve(root, '../../../SRS_需求规格化与基线/SRS08_API需求操作映射.json');
const resourcesPath = resolve(root, 'packages/domain/src/generated/resources.ts');
const outputPath = resolve(root, 'packages/domain/src/generated/resource-route-policy.ts');
const temporaryUnmappedPaths = new Set([
  '/api/v1/org/organization-units',
  '/api/v1/org/positions',
  '/api/v1/rpt/dashboard-snapshot',
  '/api/v1/print/print-job',
]);

const mappingDocument = JSON.parse(readFileSync(mappingPath, 'utf8'));
const resourcesSource = readFileSync(resourcesPath, 'utf8');
const mappingByPath = new Map(mappingDocument.mappings.map((mapping) => [mapping.collection_path, mapping]));
const resourceRegex = /\{\s*"table":\s*"([^"]+)"[\s\S]*?"path":\s*"([^"]+)"[\s\S]*?"module":\s*"([^"]+)"[\s\S]*?"permission":\s*"([^"]+)"[\s\S]*?"companyScope":\s*(true|false)[\s\S]*?"contractPath":\s*(true|false)\s*\}/g;
const policies = [];
for (const match of resourcesSource.matchAll(resourceRegex)) {
  const table = match[1];
  const path = match[2];
  const mapping = mappingByPath.get(path);
  if (mapping) {
    policies.push({
      table,
      path,
      mode: mapping.mode === 'READ_ONLY' ? 'READ_ONLY' : 'CRUD_AND_ACTION',
      requirementId: mapping.requirement_id,
      useCaseId: mapping.use_case_id,
      allowedMethods: mapping.mode === 'READ_ONLY' ? ['GET'] : ['GET', 'POST', 'PATCH'],
    });
  } else if (temporaryUnmappedPaths.has(path)) {
    policies.push({
      table,
      path,
      mode: 'TEMPORARY_UNMAPPED',
      requirementId: '',
      useCaseId: '',
      allowedMethods: ['GET', 'POST', 'PATCH'],
    });
  }
}

const content = [
  '// 由 scripts/generate-resource-route-policy.mjs 生成；临时未映射路径必须在 OpenAPI 变更后关闭。',
  'export type ResourceRoutePolicyMode = "CRUD_AND_ACTION" | "READ_ONLY" | "TEMPORARY_UNMAPPED";',
  'export type ResourceRoutePolicy = {',
  '  table: string;',
  '  path: string;',
  '  mode: ResourceRoutePolicyMode;',
  '  requirementId: string;',
  '  useCaseId: string;',
  '  allowedMethods: readonly string[];',
  '};',
  '',
  'export const resourceRoutePolicies = [',
  ...policies.map((policy) => `  ${JSON.stringify(policy)},`),
  '] as const satisfies readonly ResourceRoutePolicy[];',
  '',
  'export const resourceRoutePolicyByPath = new Map<string, ResourceRoutePolicy>(',
  '  resourceRoutePolicies.map((policy) => [policy.path, policy]),',
  ');',
  '',
].join('\n');
writeFileSync(outputPath, content);
console.log(outputPath);
console.log({ policies: policies.length, temporary: policies.filter((policy) => policy.mode === 'TEMPORARY_UNMAPPED').length });
