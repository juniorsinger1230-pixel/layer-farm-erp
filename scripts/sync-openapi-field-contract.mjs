import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadContext, operationKey } from './contract-model.mjs';
import { buildExpected } from './contract-expected.mjs';

const options = parseArgs(process.argv.slice(2));
const context = loadContext(options);
const openapiPath = resolve(context.root, options.openapi ?? '../../../SRS_需求规格化与基线/SRS08_OpenAPI3.1初版.json');
const document = JSON.parse(readFileSync(openapiPath, 'utf8'));
const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

const errorSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['error', 'message'],
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
    details: { type: ['object', 'null'], additionalProperties: true },
    requestId: { type: ['string', 'null'] },
  },
};

let count = 0;
for (const [path, pathItem] of Object.entries(document.paths)) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!httpMethods.has(method)) continue;
    const upper = method.toUpperCase();
    const key = operationKey(upper, path);
    const expected = buildExpected({ method: upper, path, key }, context);
    const pathParameters = extractPathParameters(path);
    const queryParameters = Object.entries(expected.query ?? {}).map(([name]) => ({
      name,
      in: 'query',
      required: false,
      schema: { type: 'string' },
    }));
    operation.parameters = [...pathParameters, ...queryParameters];

    if (expected.body) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: toJsonSchema(expected.body),
          },
        },
      };
    } else if (expected.multipart) {
      operation.requestBody = {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['file'],
              properties: { file: { type: 'string', format: 'binary' } },
            },
          },
        },
      };
    } else if (upper !== 'GET') {
      delete operation.requestBody;
    }

    const responses = {};
    for (const status of expected.statuses) {
      responses[String(status)] = responseFor(status, expected, status === expected.statuses[0]);
    }
    operation.responses = responses;
    count += 1;
  }
}

document.info.version = '0.3.0-FIELD-ALIGNED';
document.info.contract_status = 'FIELD_STATUS_ALIGNED';
document.info.description = 'OpenAPI 3.1 authoritative contract. Operation-level request fields, query parameters, response status codes and implementation validation are aligned.';
writeFileSync(openapiPath, `${JSON.stringify(document, null, 2)}\n`);
console.log(JSON.stringify({ status: 'synced', operations: count, openapiPath }, null, 2));

function toJsonSchema(expected) {
  switch (expected.kind) {
    case 'object': {
      const properties = {};
      for (const [name, child] of Object.entries(expected.properties ?? {})) properties[name] = toJsonSchema(child);
      return {
        type: 'object',
        additionalProperties: false,
        ...(Object.keys(properties).length ? { properties } : {}),
        ...(expected.requiredProps?.length ? { required: [...expected.requiredProps] } : {}),
      };
    }
    case 'string': {
      const schema = { type: 'string' };
      if (expected.maxLength !== undefined) schema.maxLength = expected.maxLength;
      if (expected.pattern) schema.pattern = expected.pattern;
      if (expected.format) schema.format = expected.format;
      if (expected.enum) schema.enum = expected.enum;
      return schema;
    }
    case 'integer': return { type: 'integer' };
    case 'number': return { type: 'number' };
    case 'boolean': return { type: 'boolean' };
    case 'array': return { type: 'array', items: expected.items ? toJsonSchema(expected.items) : {} };
    case 'bigint-input': return { oneOf: [{ type: 'integer' }, { type: 'string' }] };
    case 'numeric-input': return { oneOf: [{ type: 'number' }, { type: 'string' }] };
    case 'any-json': return { oneOf: [{ type: 'object', additionalProperties: true }, { type: 'array' }, { type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'null' }] };
    case 'any': return {};
    default:
      throw new Error(`Unsupported schema kind: ${expected.kind}`);
  }
}

function responseFor(status, expected, success) {
  if (status === 204) return { description: 'No content' };
  if (!success) return { description: reasonPhrase(status), content: { 'application/json': { schema: errorSchema } } };
  if (expected.response === 'csv') {
    return { description: 'CSV export', content: { 'text/csv': { schema: { type: 'string' } } } };
  }
  if (expected.response === 'binary') {
    return { description: 'Binary document', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } };
  }
  if (expected.response === 'empty') return { description: 'No content' };
  return { description: 'Successful JSON response', content: { 'application/json': { schema: successSchema(expected) } } };
}

function successSchema(expected) {
  if (expected.response === 'json') return { type: ['object', 'array'], additionalProperties: true };
  return {};
}

function reasonPhrase(status) {
  return {
    400: 'Validation error',
    401: 'Authentication required',
    403: 'Permission denied',
    404: 'Resource not found',
    409: 'Business conflict',
    413: 'Request body too large',
    415: 'Unsupported media type',
    429: 'Rate limit exceeded',
    500: 'Internal server error',
    503: 'Dependency unavailable',
  }[status] ?? 'Error response';
}

function extractPathParameters(path) {
  const names = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
  return names.map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));
}

function parseArgs(args) {
  const parsed = {};
  for (const arg of args) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}
