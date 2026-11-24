import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const options = parseArgs(process.argv.slice(2));
const openapiPath = resolve(root, options.openapi ?? '../../../SRS_需求规格化与基线/SRS08_OpenAPI3.1初版.json');
const mappingPath = resolve(root, options.mapping ?? '../../../SRS_需求规格化与基线/SRS08_API需求操作映射.json');
const appPath = resolve(root, options.app ?? 'apps/api/src/app.ts');
const resourcesPath = resolve(root, options.resources ?? 'packages/domain/src/generated/resources.ts');
const policyPath = resolve(root, options.policy ?? 'packages/domain/src/generated/resource-route-policy.ts');
const contractProcessPath = resolve(root, options.contractProcess ?? 'packages/domain/src/contract-process.ts');
const outputPath = resolve(root, options.out ?? 'openapi-contract-check-result.json');

const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
const openapi = JSON.parse(readFileSync(openapiPath, 'utf8'));
const mappingDocument = JSON.parse(readFileSync(mappingPath, 'utf8'));
const appSource = readFileSync(appPath, 'utf8');
const resourcesSource = readFileSync(resourcesPath, 'utf8');
const policySource = readFileSync(policyPath, 'utf8');
const contractProcessSource = readFileSync(contractProcessPath, 'utf8');

const resourceRegex = /\{\s*"table":\s*"([^"]+)"[\s\S]*?"path":\s*"([^"]+)"[\s\S]*?"module":\s*"([^"]+)"[\s\S]*?"permission":\s*"([^"]+)"[\s\S]*?"companyScope":\s*(true|false)[\s\S]*?"contractPath":\s*(true|false)\s*\}/g;
const resources = [...resourcesSource.matchAll(resourceRegex)].map((match) => ({
  table: match[1],
  path: match[2],
  module: match[3],
  permission: match[4],
  companyScope: match[5] === 'true',
  contractPath: match[6] === 'true',
}));
const policyRegex = /\{\s*"table":\s*"([^"]+)"[\s\S]*?"path":\s*"([^"]+)"[\s\S]*?"allowedMethods":\s*\[([^\]]*)\]/g;
const routePolicies = [...policySource.matchAll(policyRegex)].map((match) => ({
  table: match[1],
  path: match[2],
  allowedMethods: [...match[3].matchAll(/"([^"]+)"/g)].map((method) => method[1]),
}));

const authoritativeOperations = [];
for (const [path, pathItem] of Object.entries(openapi.paths ?? {})) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!httpMethods.has(method)) continue;
    authoritativeOperations.push({
      method: method.toUpperCase(),
      path,
      key: operationKey(method.toUpperCase(), path),
      operationId: operation.operationId,
      tags: operation.tags ?? [],
    });
  }
}

const contractExpectations = [];
for (const mapping of mappingDocument.mappings) {
  const expected = expectedOperationsForMapping(mapping);
  contractExpectations.push({
    requirementId: mapping.requirement_id,
    useCaseId: mapping.use_case_id,
    domain: mapping.domain,
    mode: mapping.mode,
    collectionPath: mapping.collection_path,
    itemPath: mapping.item_path,
    actionPath: mapping.action_path,
    expected,
  });
}

const generatedLoopLine = lineAt(appSource, appSource.indexOf('for (const resource of resources)'));
const actualOperations = [];
const seen = new Set();
function addOperation(method, path, source) {
  const normalizedPath = normalizeHonoPath(path);
  const key = operationKey(method, normalizedPath);
  if (seen.has(key)) return;
  seen.add(key);
  actualOperations.push({ method, path: normalizedPath, key, source });
}

for (const policy of routePolicies) {
  const resource = resources.find((item) => item.path === policy.path);
  const source = {
    type: 'generated',
    file: appPath,
    line: generatedLoopLine,
    resource,
  };
  if (policy.allowedMethods.includes('GET')) {
    addOperation('GET', policy.path, source);
    addOperation('GET', `${policy.path}/:id`, source);
  }
  if (policy.allowedMethods.includes('POST')) {
    addOperation('POST', policy.path, source);
    addOperation('POST', `${policy.path}/:id/actions`, source);
  }
  if (policy.allowedMethods.includes('PATCH')) {
    addOperation('PATCH', `${policy.path}/:id`, source);
  }
}

const readOnlyProcessPaths = new Set([
  '/api/v1/fin/batch-cost-cards',
  '/api/v1/fin/financial-reconciliation-reports',
  '/api/v1/rpt/management-dashboard',
  '/api/v1/rpt/production-reports',
  '/api/v1/rpt/inventory-purchase-reports',
  '/api/v1/rpt/sales-finance-reports',
  '/api/v1/trace/batch-end-to-end-trace',
]);
const contractProcessRegex = /\{[\s\S]*?requirementId: '([^']+)'[\s\S]*?path: '([^']+)'[\s\S]*?\}/g;
const contractProcessPolicies = [...contractProcessSource.matchAll(contractProcessRegex)]
  .map((match) => ({
    requirementId: match[1],
    path: match[2],
    readOnly: readOnlyProcessPaths.has(match[2]),
    collectionAlreadyRegistered: match[0].includes('collectionAlreadyRegistered: true'),
    line: lineAt(contractProcessSource, match.index),
  }))
  .filter((item) => item.path.startsWith('/api/v1/'));

for (const processPolicy of contractProcessPolicies) {
  const source = {
    type: 'contract-process',
    file: contractProcessPath,
    line: processPolicy.line,
    requirementId: processPolicy.requirementId,
  };
  if (!processPolicy.collectionAlreadyRegistered) {
    addOperation('GET', processPolicy.path, source);
    if (!processPolicy.readOnly) addOperation('POST', processPolicy.path, source);
  }
  addOperation('GET', `${processPolicy.path}/:id`, source);
  if (!processPolicy.readOnly) {
    addOperation('PATCH', `${processPolicy.path}/:id`, source);
    addOperation('POST', `${processPolicy.path}/:id/actions`, source);
  }
}

const infrastructureOperations = [];
const routePattern = /app\.(get|post|put|patch|delete|head|options)\(\s*([^,\n]+?)\s*,/g;
for (const match of appSource.matchAll(routePattern)) {
  const method = match[1].toUpperCase();
  const rawExpression = match[2].trim();
  const path = decodeRouteExpression(rawExpression);
  if (path === undefined) continue;
  const source = {
    type: 'explicit',
    file: appPath,
    line: lineAt(appSource, match.index),
  };
  if (!path.startsWith('/api/v1/')) {
    infrastructureOperations.push({ method, path: normalizeHonoPath(path), source });
    continue;
  }
  addOperation(method, path, source);
}

const actualByKey = new Map(actualOperations.map((operation) => [operation.key, operation]));
const authoritativeByKey = new Map(authoritativeOperations.map((operation) => [operation.key, operation]));
const mappingByCollection = new Map(mappingDocument.mappings.map((mapping) => [mapping.collection_path, mapping]));

const matchedOperations = authoritativeOperations
  .filter((operation) => actualByKey.has(operation.key))
  .map(stripKey);
const missingContractOperations = authoritativeOperations
  .filter((operation) => !actualByKey.has(operation.key))
  .map((operation) => ({ ...stripKey(operation), requirement: findRequirementForPath(operation.path) }));
const undocumentedOperations = actualOperations
  .filter((operation) => !authoritativeByKey.has(operation.key))
  .map(stripKey);

const readOnlyWriteExposures = [];
for (const expectation of contractExpectations.filter((item) => item.mode === 'READ_ONLY')) {
  for (const operation of actualOperations) {
    if (!operation.path.startsWith(expectation.collectionPath)) continue;
    if (operation.method !== 'GET') {
      readOnlyWriteExposures.push({
        ...stripKey(operation),
        contract: {
          requirementId: expectation.requirementId,
          mode: expectation.mode,
        },
      });
    }
  }
}

const nonContractResourceEndpoints = [];
for (const resource of resources.filter((item) => !mappingByCollection.has(item.path))) {
  for (const operation of actualOperations) {
    if (operation.source.resource?.table === resource.table) {
      nonContractResourceEndpoints.push(stripKey(operation));
    }
  }
}

const explicitUndocumentedOperations = undocumentedOperations.filter((operation) => operation.source.type === 'explicit');
const genericUndocumentedOperations = undocumentedOperations.filter((operation) => operation.source.type === 'generated');

const result = {
  checkedAt: new Date().toISOString(),
  status: missingContractOperations.length === 0 && undocumentedOperations.length === 0 ? 'pass' : 'fail',
  scope: 'route and HTTP method bidirectional coverage',
  inputs: {
    openapiPath,
    mappingPath,
    appPath,
    resourcesPath,
    policyPath,
  },
  authoritative: {
    openapi: openapi.openapi,
    paths: Object.keys(openapi.paths ?? {}).length,
    operations: authoritativeOperations.length,
    mappings: mappingDocument.mappings.length,
  },
  implementation: {
    resources: resources.length,
    resourcesWithContractPath: resources.filter((resource) => resource.contractPath).length,
    routePolicies: routePolicies.length,
    generatedOperations: actualOperations.filter((operation) => operation.source.type === 'generated').length,
    explicitApiOperations: actualOperations.filter((operation) => operation.source.type === 'explicit').length,
    totalApiOperations: actualOperations.length,
    infrastructureExcluded: infrastructureOperations.map(stripKey),
  },
  matched: {
    operations: matchedOperations.length,
    coverage: authoritativeOperations.length === 0 ? 0 : Number((matchedOperations.length / authoritativeOperations.length).toFixed(4)),
  },
  missingContractOperations,
  undocumentedOperations,
  explicitUndocumentedOperations,
  genericUndocumentedOperations,
  readOnlyWriteExposures,
  nonContractResourceEndpoints,
  contractExpectations,
};

writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({
  status: result.status,
  authoritativeOperations: result.authoritative.operations,
  implementationOperations: result.implementation.totalApiOperations,
  matched: matchedOperations.length,
  missing: missingContractOperations.length,
  undocumented: undocumentedOperations.length,
  explicitUndocumented: explicitUndocumentedOperations.length,
  genericUndocumented: genericUndocumentedOperations.length,
  readOnlyWriteExposures: readOnlyWriteExposures.length,
  nonContractResourceEndpoints: nonContractResourceEndpoints.length,
  outputPath,
}, null, 2));

if (result.status === 'fail') process.exitCode = 1;

function expectedOperationsForMapping(mapping) {
  const operations = [
    { method: 'GET', path: mapping.collection_path },
    { method: 'GET', path: mapping.item_path },
  ];
  if (mapping.mode === 'PROPOSED_CRUD_AND_ACTION') {
    operations.push(
      { method: 'POST', path: mapping.collection_path },
      { method: 'PATCH', path: mapping.item_path },
      { method: 'POST', path: mapping.action_path },
    );
  }
  return operations.map((operation) => ({ ...operation, key: operationKey(operation.method, operation.path) }));
}

function findRequirementForPath(path) {
  const mapping = mappingDocument.mappings.find((item) => path.startsWith(item.collection_path));
  return mapping ? {
    requirementId: mapping.requirement_id,
    useCaseId: mapping.use_case_id,
    mode: mapping.mode,
  } : undefined;
}

function operationKey(method, path) {
  return `${method.toUpperCase()} ${path}`;
}

function normalizeHonoPath(path) {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function decodeRouteExpression(expression) {
  if (expression === 'resource.path' || expression.includes('resource.path')) return undefined;
  const quoted = expression.match(/^(['"])(.*)\1$/);
  if (quoted) return quoted[2];
  const template = expression.match(/^`(.*)`$/);
  if (template) {
    if (template[1].includes('${')) return undefined;
    return template[1];
  }
  return undefined;
}

function lineAt(source, index) {
  if (index < 0) return undefined;
  return source.slice(0, index).split('\n').length;
}

function stripKey(object) {
  const copy = { ...object };
  delete copy.key;
  return copy;
}

function parseArgs(args) {
  const parsed = {};
  for (const arg of args) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
