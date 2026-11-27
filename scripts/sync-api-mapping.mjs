import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadContext } from './contract-model.mjs';

const options = parseArgs(process.argv.slice(2));
const context = loadContext(options);
const openapiPath = resolve(context.root, options.openapi ?? 'contracts/openapi.json');
const mappingPath = resolve(context.root, options.mapping ?? 'contracts/api-operation-map.json');
const openapi = JSON.parse(readFileSync(openapiPath, 'utf8'));
const mappingDocument = JSON.parse(readFileSync(mappingPath, 'utf8'));
const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
const operations = [];
for (const [path, pathItem] of Object.entries(openapi.paths)) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!httpMethods.has(method)) continue;
    operations.push({
      path,
      method: method.toUpperCase(),
      operationId: operation.operationId,
      requirementId: operation['x-srs-requirement-id'],
      source: operation['x-implementation-source'],
    });
  }
}

const updatedMappings = mappingDocument.mappings.map((mapping) => {
  const prefix = `${mapping.collection_path}/`;
  const matched = operations.filter((item) => {
    if (mapping.paths?.length) return mapping.paths.includes(item.path);
    return item.path === mapping.collection_path || item.path.startsWith(prefix);
  });
  return {
    ...mapping,
    operation_ids: [...new Set(matched.map((item) => item.operationId))],
    extra_operation_ids: [...new Set(matched.filter((item) => !isStandardPath(item.path, mapping)).map((item) => item.operationId))],
  };
});

const existingCollectionPaths = new Set(updatedMappings.map((item) => item.collection_path));
for (const spec of context.processSpecs) {
  if (existingCollectionPaths.has(spec.path)) continue;
  const matched = operations.filter((item) => item.path === spec.path || item.path.startsWith(`${spec.path}/`));
  updatedMappings.push({
    requirement_id: spec.requirementId,
    use_case_id: `UC-${spec.requirementId.replace('SRS-', '').replaceAll('-', '')}`,
    domain: spec.requirementId.split('-')[1],
    collection_path: spec.path,
    item_path: spec.readOnly ? undefined : `${spec.path}/{id}`,
    action_path: spec.readOnly ? undefined : `${spec.path}/{id}/actions`,
    slug: spec.path.split('/').pop(),
    mode: spec.readOnly ? 'DERIVED_READ_ONLY' : 'DERIVED_CONTRACT_PROCESS',
    operation_ids: matched.map((item) => item.operationId),
    status: 'DERIVED_FROM_IMPLEMENTED_ROUTE',
    source_table: spec.table,
  });
}

for (const policy of context.routePolicies.filter((item) => item.mode === 'TEMPORARY_UNMAPPED')) {
  if (updatedMappings.some((item) => item.collection_path === policy.path)) continue;
  const matched = operations.filter((item) => item.path === policy.path || item.path.startsWith(`${policy.path}/`));
  updatedMappings.push({
    requirement_id: `DERIVED:TEMPORARY:${policy.table}`,
    use_case_id: '',
    domain: policy.path.split('/')[3]?.toUpperCase(),
    collection_path: policy.path,
    item_path: `${policy.path}/{id}`,
    action_path: `${policy.path}/{id}/actions`,
    slug: policy.path.split('/').pop(),
    mode: 'DERIVED_TEMPORARY_UNMAPPED',
    operation_ids: matched.map((item) => item.operationId),
    status: 'DERIVED_TEMPORARY_PENDING_REMOVAL',
    source_table: policy.table,
  });
}

const coveredByCollections = new Set();
for (const mapping of updatedMappings) {
  for (const operation of operations) {
    const covered = mapping.paths?.length
      ? mapping.paths.includes(operation.path)
      : operation.path === mapping.collection_path || operation.path.startsWith(`${mapping.collection_path}/`);
    if (covered) coveredByCollections.add(operation.operationId);
  }
}
const remaining = operations.filter((item) => !coveredByCollections.has(item.operationId));
const groups = new Map();
for (const operation of remaining) {
  const key = operation.requirementId?.startsWith('IMPLEMENTED:')
    ? operation.requirementId.replace('IMPLEMENTED:', '')
    : operation.path.split('/')[3] ?? 'misc';
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(operation);
}
for (const [key, items] of groups) {
  const paths = [...new Set(items.map((item) => item.path))].sort();
  const operationIds = items.map((item) => item.operationId);
  const existingIndex = updatedMappings.findIndex((mapping) => mapping.requirement_id === `DERIVED:EXPLICIT:${key}`);
  if (existingIndex >= 0) {
    const existing = updatedMappings[existingIndex];
    updatedMappings[existingIndex] = {
      ...existing,
      paths: [...new Set([...(existing.paths ?? []), ...paths])].sort(),
      operation_ids: [...new Set([...existing.operation_ids, ...operationIds])],
    };
    continue;
  }
  const commonPrefix = commonPrefixOf(paths);
  updatedMappings.push({
    requirement_id: `DERIVED:EXPLICIT:${key}`,
    use_case_id: '',
    domain: key.toUpperCase(),
    collection_path: commonPrefix,
    paths,
    slug: key,
    mode: 'DERIVED_EXPLICIT_OPERATIONS',
    operation_ids: operationIds,
    status: 'DERIVED_FROM_IMPLEMENTED_ROUTE',
  });
}

const allCovered = new Set(updatedMappings.flatMap((item) => item.operation_ids));
const missing = operations.filter((item) => !allCovered.has(item.operationId));
const duplicates = findDuplicates(updatedMappings.flatMap((item) => item.operation_ids));
if (missing.length || duplicates.length) {
  throw new Error(JSON.stringify({ missing, duplicates }, null, 2));
}

mappingDocument.version = '0.2.0-FIELD-ALIGNED';
mappingDocument.status = 'FIELD_ALIGNED_PENDING_BUSINESS_REVIEW';
mappingDocument.operations_total = operations.length;
mappingDocument.mappings_total = updatedMappings.length;
mappingDocument.mappings = updatedMappings;
writeFileSync(mappingPath, `${JSON.stringify(mappingDocument, null, 2)}\n`);
console.log(JSON.stringify({
  status: 'synced',
  operations: operations.length,
  mappings: updatedMappings.length,
  explicitGroups: groups.size,
  mappingPath,
}, null, 2));

function isStandardPath(path, mapping) {
  return path === mapping.collection_path
    || path === mapping.item_path
    || path === mapping.action_path;
}

function commonPrefixOf(paths) {
  if (paths.length === 1) return paths[0];
  let prefix = paths[0];
  for (const path of paths.slice(1)) {
    while (!path.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  const parts = prefix.split('/');
  return parts.slice(0, -1).join('/') || prefix;
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicate = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate];
}

function parseArgs(args) {
  const parsed = {};
  for (const arg of args) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
