import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  collectImplementedOperations,
  loadContext,
  operationKey,
} from './contract-model.mjs';
import { buildExpected } from './contract-expected.mjs';

const options = parseArgs(process.argv.slice(2));
const context = loadContext(options);
const openapiPath = resolve(context.root, options.openapi ?? '../../../SRS_需求规格化与基线/SRS08_OpenAPI3.1初版.json');
const mappingPath = resolve(context.root, options.mapping ?? '../../../SRS_需求规格化与基线/SRS08_API需求操作映射.json');
const outputPath = resolve(context.root, options.out ?? 'openapi-contract-check-result.json');
const openapi = JSON.parse(readFileSync(openapiPath, 'utf8'));
const mappingDocument = JSON.parse(readFileSync(mappingPath, 'utf8'));

const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
const authoritativeOperations = [];
for (const [path, pathItem] of Object.entries(openapi.paths ?? {})) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!httpMethods.has(method)) continue;
    const upper = method.toUpperCase();
    authoritativeOperations.push({ method: upper, path, key: operationKey(upper, path), operationId: operation.operationId, tags: operation.tags ?? [] });
  }
}

const implementedOperations = collectImplementedOperations(context);
const actualByKey = new Map(implementedOperations.map((item) => [item.key, item]));
const authoritativeByKey = new Map(authoritativeOperations.map((item) => [item.key, item]));
const missingContractOperations = authoritativeOperations.filter((item) => !actualByKey.has(item.key)).map(stripKey);
const undocumentedOperations = implementedOperations.filter((item) => !authoritativeByKey.has(item.key)).map(stripKey);

const schemaErrors = [];
const statusErrors = [];
const parameterErrors = [];
const checkedOperations = [];

for (const operation of authoritativeOperations) {
  const pathItem = openapi.paths[operation.path];
  const operationDoc = pathItem[operation.method.toLowerCase()];
  const expected = buildExpected(operation, context);
  const errors = compareOperation(operation, operationDoc, expected, openapi);
  if (errors.schema.length) schemaErrors.push({ key: operation.key, operationId: operation.operationId, errors: errors.schema });
  if (errors.statuses.length) statusErrors.push({ key: operation.key, operationId: operation.operationId, errors: errors.statuses });
  if (errors.parameters.length) parameterErrors.push({ key: operation.key, operationId: operation.operationId, errors: errors.parameters });
  checkedOperations.push({ key: operation.key, expectedStatuses: expected.statuses, expectedFields: Object.keys(expected.body?.properties ?? {}), expectedQuery: Object.keys(expected.query ?? {}) });
}

const readOnlyWriteExposures = [];
for (const mapping of mappingDocument.mappings.filter((item) => item.mode === 'READ_ONLY' || item.mode === 'PROPOSED_READ_ONLY')) {
  for (const operation of implementedOperations) {
    if (operation.path.startsWith(mapping.collection_path) && operation.method !== 'GET') {
      readOnlyWriteExposures.push({ ...stripKey(operation), requirementId: mapping.requirement_id });
    }
  }
}

const routePass = missingContractOperations.length === 0 && undocumentedOperations.length === 0;
const fieldPass = schemaErrors.length === 0 && parameterErrors.length === 0;
const statusPass = statusErrors.length === 0;
const result = {
  checkedAt: new Date().toISOString(),
  status: routePass && fieldPass && statusPass ? 'pass' : 'fail',
  scope: 'route, HTTP method, field-level schema, query parameters and status-code contract',
  inputs: {
    openapiPath,
    mappingPath,
    appPath: context.paths.appPath,
    resourcesPath: context.paths.resourcesPath,
    policyPath: context.paths.policyPath,
    contractProcessPath: context.paths.processPath,
  },
  authoritative: {
    openapi: openapi.openapi,
    paths: Object.keys(openapi.paths ?? {}).length,
    operations: authoritativeOperations.length,
    mappings: mappingDocument.mappings.length,
  },
  implementation: {
    resources: context.resources.length,
    routePolicies: context.routePolicies.length,
    processSpecs: context.processSpecs.length,
    totalApiOperations: implementedOperations.length,
    generatedOperations: implementedOperations.filter((item) => item.source.type === 'generated').length,
    contractProcessOperations: implementedOperations.filter((item) => item.source.type === 'contract-process').length,
    explicitApiOperations: implementedOperations.filter((item) => item.source.type === 'explicit').length,
  },
  matched: {
    operations: authoritativeOperations.filter((item) => actualByKey.has(item.key)).length,
    coverage: authoritativeOperations.length === 0 ? 0 : Number((authoritativeOperations.filter((item) => actualByKey.has(item.key)).length / authoritativeOperations.length).toFixed(4)),
  },
  route: {
    status: routePass ? 'pass' : 'fail',
    missingContractOperations,
    undocumentedOperations,
    readOnlyWriteExposures,
  },
  fieldSchema: {
    status: fieldPass ? 'pass' : 'fail',
    errors: schemaErrors,
    parameterErrors,
  },
  statusCodes: {
    status: statusPass ? 'pass' : 'fail',
    errors: statusErrors,
  },
  checkedOperations,
};

writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({
  status: result.status,
  authoritativeOperations: authoritativeOperations.length,
  implementationOperations: implementedOperations.length,
  schemaErrors: schemaErrors.length,
  statusErrors: statusErrors.length,
  parameterErrors: parameterErrors.length,
  missing: missingContractOperations.length,
  undocumented: undocumentedOperations.length,
  outputPath,
}, null, 2));
if (result.status === 'fail') process.exitCode = 1;

function compareOperation(operation, operationDoc, expected, document) {
  const errors = { schema: [], statuses: [], parameters: [] };
  if (expected.body) {
    const actualSchema = requestSchema(operationDoc, document);
    errors.schema.push(...compareSchema(expected.body, actualSchema, document, '$'));
  }
  if (expected.multipart) {
    const content = operationDoc.requestBody?.content?.['multipart/form-data'];
    if (!content?.schema || !content.schema.properties?.file) errors.schema.push('missing multipart file schema');
  }
  const expectedStatusList = [...expected.statuses].map(String);
  const actualStatuses = Object.keys(operationDoc.responses ?? {});
  if (actualStatuses.includes('default')) errors.statuses.push('default response must be replaced by explicit status codes');
  for (const status of expectedStatusList) if (!actualStatuses.includes(status)) errors.statuses.push(`missing status ${status}`);
  for (const status of actualStatuses) if (!expectedStatusList.includes(status)) errors.statuses.push(`unexpected status ${status}`);

  const actualQuery = new Set((operationDoc.parameters ?? []).filter((item) => item.in === 'query').map((item) => item.name));
  for (const name of Object.keys(expected.query ?? {})) if (!actualQuery.has(name)) errors.parameters.push(`missing query parameter ${name}`);
  return errors;
}

function requestSchema(operationDoc, document) {
  const schema = operationDoc.requestBody?.content?.['application/json']?.schema;
  if (!schema) return undefined;
  return resolveRef(schema, document);
}

function resolveRef(schema, document) {
  let current = schema;
  const seen = new Set();
  while (current?.$ref) {
    if (seen.has(current.$ref)) return current;
    seen.add(current.$ref);
    const parts = current.$ref.split('/').slice(1).map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
    current = parts.reduce((value, part) => value?.[part], document);
  }
  return current;
}

function compareSchema(expected, actual, document, path) {
  const resolved = resolveRef(actual, document);
  const errors = [];
  if (!resolved) return [`${path}: missing schema`];
  switch (expected.kind) {
    case 'object': {
      if (resolved.type !== 'object') errors.push(`${path}: expected object`);
      if (resolved.additionalProperties !== false) errors.push(`${path}: additionalProperties must be false`);
      const expectedProps = Object.keys(expected.properties).sort();
      const actualProps = Object.keys(resolved.properties ?? {}).sort();
      if (JSON.stringify(expectedProps) !== JSON.stringify(actualProps)) errors.push(`${path}: property keys differ expected=${expectedProps.join(',')} actual=${actualProps.join(',')}`);
      const expectedRequired = [...(expected.requiredProps ?? [])].sort();
      const actualRequired = [...(resolved.required ?? [])].sort();
      if (JSON.stringify(expectedRequired) !== JSON.stringify(actualRequired)) errors.push(`${path}: required differ expected=${expectedRequired.join(',')} actual=${actualRequired.join(',')}`);
      for (const [name, child] of Object.entries(expected.properties)) errors.push(...compareSchema(child, resolved.properties?.[name], document, `${path}.${name}`));
      break;
    }
    case 'string': {
      const actualType = Array.isArray(resolved.type) ? resolved.type.find((item) => item !== 'null') : resolved.type;
      if (actualType !== 'string') errors.push(`${path}: expected string`);
      if (expected.maxLength !== undefined && resolved.maxLength !== expected.maxLength) errors.push(`${path}: maxLength expected ${expected.maxLength} actual ${resolved.maxLength}`);
      if (expected.pattern !== undefined && resolved.pattern !== expected.pattern) errors.push(`${path}: pattern mismatch`);
      if (expected.format !== undefined && resolved.format !== expected.format) errors.push(`${path}: format expected ${expected.format}`);
      if (expected.enum && JSON.stringify(expected.enum) !== JSON.stringify(resolved.enum)) errors.push(`${path}: enum mismatch`);
      break;
    }
    case 'integer':
      if (resolved.type !== 'integer') errors.push(`${path}: expected integer`);
      break;
    case 'number':
      if (resolved.type !== 'number') errors.push(`${path}: expected number`);
      break;
    case 'boolean':
      if (resolved.type !== 'boolean') errors.push(`${path}: expected boolean`);
      break;
    case 'array':
      if (resolved.type !== 'array') errors.push(`${path}: expected array`);
      if (expected.items) errors.push(...compareSchema(expected.items, resolved.items, document, `${path}[]`));
      break;
    case 'bigint-input':
      if (!resolved.oneOf?.some((item) => item.type === 'integer') || !resolved.oneOf.some((item) => item.type === 'string')) errors.push(`${path}: expected integer|string bigint input`);
      break;
    case 'numeric-input':
      if (!resolved.oneOf?.some((item) => item.type === 'number') || !resolved.oneOf.some((item) => item.type === 'string')) errors.push(`${path}: expected number|string numeric input`);
      break;
    case 'any-json':
      if (!resolved.oneOf && resolved.type === undefined) errors.push(`${path}: expected flexible JSON value`);
      break;
    case 'any':
      break;
    default:
      errors.push(`${path}: unsupported expected kind ${expected.kind}`);
  }
  return errors;
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
