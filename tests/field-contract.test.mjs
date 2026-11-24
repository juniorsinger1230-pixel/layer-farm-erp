import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { loadContext, operationKey } from '../scripts/contract-model.mjs';

const context = loadContext();
const base = resolve(context.root, '../../../SRS_需求规格化与基线');
const openapi = JSON.parse(readFileSync(resolve(base, 'SRS08_OpenAPI3.1初版.json'), 'utf8'));
const mapping = JSON.parse(readFileSync(resolve(base, 'SRS08_API需求操作映射.json'), 'utf8'));
const result = JSON.parse(readFileSync(resolve(context.root, 'openapi-contract-check-result.json'), 'utf8'));
const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

function eachOperation(callback) {
  for (const [path, pathItem] of Object.entries(openapi.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (methods.has(method)) callback(method.toUpperCase(), path, operation);
    }
  }
}

test('field-level contract checker reports pass for all 481 operations', () => {
  assert.equal(result.status, 'pass');
  assert.equal(result.authoritative.operations, 481);
  assert.equal(result.implementation.totalApiOperations, 481);
  assert.equal(result.fieldSchema.errors.length, 0);
  assert.equal(result.statusCodes.errors.length, 0);
  assert.equal(result.route.missingContractOperations.length, 0);
  assert.equal(result.route.undocumentedOperations.length, 0);
});

test('request bodies no longer use the permissive BusinessDocumentInput schema', () => {
  eachOperation((method, path, operation) => {
    const refs = [];
    visit(operation.requestBody?.content?.['application/json']?.schema, (node) => {
      if (node.$ref) refs.push(node.$ref);
    });
    assert.deepEqual(refs.filter((ref) => ref.endsWith('/BusinessDocumentInput')), [], `${method} ${path}`);
  });
});

test('every operation uses explicit status codes and no default response', () => {
  let count = 0;
  eachOperation((method, path, operation) => {
    count += 1;
    assert.equal(Object.hasOwn(operation.responses, 'default'), false, path);
    assert.ok(Object.keys(operation.responses).length >= 5, path);
    if (method !== 'GET') {
      const success = Object.keys(operation.responses).map(Number).find((status) => status < 300);
      assert.ok(success, path);
    }
  });
  assert.equal(count, 481);
});

test('representative operation schemas enforce exact fields, enums and numeric limits', () => {
  const login = openapi.paths['/api/v1/auth/login'].post;
  const loginSchema = login.requestBody.content['application/json'].schema;
  assert.equal(loginSchema.additionalProperties, false);
  assert.deepEqual(loginSchema.required, ['account', 'password', 'companyCode']);
  assert.deepEqual(Object.keys(loginSchema.properties).sort(), ['account', 'companyCode', 'mfaCode', 'password']);

  const cost = openapi.paths['/api/v1/farm/flock-batches/{id}/cost-postings'].post;
  const costSchema = cost.requestBody.content['application/json'].schema;
  assert.deepEqual(costSchema.properties.costType.enum, ['chick', 'feed', 'vaccine', 'medication', 'labor', 'utility', 'other']);
  assert.equal(costSchema.additionalProperties, false);

  const discount = openapi.paths['/api/v1/sales/sales-orders/{id}/discount'].post;
  const discountSchema = discount.requestBody.content['application/json'].schema;
  assert.deepEqual(discountSchema.required, ['discountPercent', 'reason']);
  assert.equal(discountSchema.properties.discountPercent.type, 'number');
});

test('print canvas schema captures operation-level design constraints', () => {
  const design = openapi.paths['/api/v1/print/print-templates/{id}/design'].post;
  const schema = design.requestBody.content['application/json'].schema;
  const elements = schema.properties.elements;
  assert.equal(elements.type, 'array');
  assert.deepEqual(elements.items.properties.type.enum, ['text', 'barcode', 'line', 'rectangle']);
  assert.deepEqual(elements.items.properties.barcodeFormat.enum, ['CODE128']);
  assert.deepEqual(elements.items.properties.align.enum, ['left', 'center', 'right']);
  assert.equal(schema.additionalProperties, false);
});

test('API mapping covers every operation exactly once at the 481 operation baseline', () => {
  assert.equal(mapping.operations_total, 481);
  assert.equal(mapping.mappings_total, mapping.mappings.length);
  const all = mapping.mappings.flatMap((item) => item.operation_ids);
  assert.equal(all.length, 481);
  assert.equal(new Set(all).size, 481);
  const expected = new Set();
  eachOperation((method, path, operation) => expected.add(operation.operationId));
  assert.deepEqual(new Set(all), expected);
});

test('mapping distinguishes derived temporary and explicit routes from baseline requirements', () => {
  const temporary = mapping.mappings.filter((item) => item.mode === 'DERIVED_TEMPORARY_UNMAPPED');
  const explicit = mapping.mappings.filter((item) => item.mode === 'DERIVED_EXPLICIT_OPERATIONS');
  assert.equal(temporary.length, 4);
  assert.equal(explicit.length, 8);
  assert.ok(temporary.every((item) => item.status === 'DERIVED_TEMPORARY_PENDING_REMOVAL'));
  assert.ok(explicit.every((item) => item.status === 'DERIVED_FROM_IMPLEMENTED_ROUTE'));
});

test('implemented and authoritative operation keys remain identical', () => {
  const keys = [];
  eachOperation((method, path) => keys.push(operationKey(method, path)));
  const implemented = collectKeysFromResult(result);
  assert.deepEqual(implemented.sort(), keys.sort());
});

function collectKeysFromResult(document) {
  return document.checkedOperations.map((item) => item.key);
}

function visit(node, callback) {
  if (!node || typeof node !== 'object') return;
  callback(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => visit(child, callback));
    else visit(value, callback);
  }
}
