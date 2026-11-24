import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checkPath = resolve(root, 'openapi-contract-check-result.json');
const openapiPath = resolve(root, options('openapi', '../../../SRS_需求规格化与基线/SRS08_OpenAPI3.1初版.json'));
const check = JSON.parse(readFileSync(checkPath, 'utf8'));
const openapi = JSON.parse(readFileSync(openapiPath, 'utf8'));

const tagByPrefix = {
  auth: 'ORG', org: 'ORG', farm: 'FARM', vet: 'VET', inv: 'INV', fin: 'FIN',
  proc: 'PROC', log: 'LOG', sales: 'SALES', eqp: 'EQP', print: 'PRINT',
  trace: 'TRACE', rpt: 'RPT', plat: 'PLAT', events: 'PLAT',
};

const requirementByPath = {
  '/api/v1/org/organization-units': 'SRS-FR-ORG-001',
  '/api/v1/org/positions': 'SRS-FR-ORG-004',
  '/api/v1/rpt/dashboard-snapshot': 'SRS-FR-RPT-001',
  '/api/v1/print/print-job': 'SRS-FR-PRINT-002',
};

for (const operation of check.undocumentedOperations) {
  const pathItem = openapi.paths[operation.path] ?? {};
  const method = operation.method.toLowerCase();
  if (pathItem[method]) continue;
  pathItem[method] = buildOperation(operation);
  openapi.paths[operation.path] = pathItem;
}

openapi.info.version = '0.2.0-ROUTE-ALIGNED';
openapi.info.description = '在87个SRS功能需求基础上，纳入经真实路由审计确认的认证、财务、采购、销售、打印、事件及临时资源操作。字段级契约仍需按后续Schema门禁继续细化。';
openapi.info['x-contract-status'] = 'ROUTE_METHOD_ALIGNED';

writeFileSync(openapiPath, `${JSON.stringify(openapi, null, 2)}\n`);
console.log(JSON.stringify({ documented: check.undocumentedOperations.length, openapiPath }, null, 2));

function buildOperation(operation) {
  const prefix = operation.path.split('/')[3];
  const tag = tagByPrefix[prefix] ?? 'PLAT';
  const isCollection = /^\/api\/v1\/[a-z]+\/[a-z0-9-]+$/.test(operation.path);
  const isPublic = ['/api/v1/auth/login', '/api/v1/auth/refresh'].includes(operation.path);
  const operationId = uniqueOperationId(operation.method, operation.path);
  const parameters = buildParameters(operation, isCollection);
  const built = {
    operationId,
    summary: buildSummary(operation),
    tags: [tag],
    'x-srs-requirement-id': requirementByPath[collectionPath(operation.path)] ?? `IMPLEMENTED:${prefix}`,
    'x-contract-status': 'IMPLEMENTED_DOCUMENTED',
    'x-implementation-source': operation.source.type,
    security: isPublic ? [] : [{ bearerAuth: [] }],
    parameters,
    responses: buildResponses(operation, isCollection),
  };
  if (operation.method === 'POST') {
    built.requestBody = {
      required: false,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/BusinessDocumentInput' },
        },
      },
    };
  }
  return built;
}

function buildParameters(operation, isCollection) {
  const parameters = [];
  for (const match of operation.path.matchAll(/\{([^}]+)\}/g)) {
    parameters.push({
      name: match[1],
      in: 'path',
      required: true,
      description: `${match[1]} path parameter`,
      schema: { type: 'integer', minimum: 1 },
    });
  }
  if (!operation.path.startsWith('/api/v1/auth/')) {
    parameters.push({ $ref: '#/components/parameters/CompanyCode' });
  }
  parameters.push({ $ref: '#/components/parameters/RequestId' });
  if (operation.method === 'GET' && isCollection) {
    parameters.push({ $ref: '#/components/parameters/Page' });
    parameters.push({ $ref: '#/components/parameters/PageSize' });
  }
  return parameters;
}

function buildResponses(operation, isCollection) {
  const successSchema = operation.method === 'GET' && isCollection
    ? { $ref: '#/components/schemas/ListResponse' }
    : { $ref: '#/components/schemas/BusinessDocument' };
  const successStatus = operation.method === 'POST' && isCollection ? '201' : '200';
  return {
    [successStatus]: {
      description: operation.method === 'POST' && isCollection ? '资源已创建' : '成功',
      content: {
        'application/json': { schema: successSchema },
      },
    },
    default: {
      description: '错误响应',
      content: {
        'application/json': { schema: { $ref: '#/components/schemas/Error' } },
      },
    },
  };
}

function buildSummary(operation) {
  const parts = operation.path.replace(/^\//, '').split('/');
  const name = parts[parts.length - 1].replaceAll(/[-_]/g, ' ');
  const actionMap = { GET: '查询', POST: '执行', PATCH: '更新' };
  return `${actionMap[operation.method] ?? operation.method} ${name}`;
}

function uniqueOperationId(method, path) {
  const normalized = path
    .replaceAll(/\{|\}/g, '')
    .replaceAll(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
  return `${method.toLowerCase()}_${normalized}`;
}

function collectionPath(path) {
  const segments = path.split('/');
  return segments.slice(0, 5).join('/');
}

function options(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}
