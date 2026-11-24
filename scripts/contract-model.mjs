import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const str = (required = false, maxLength = 255, pattern) => ({ kind: 'string', required, maxLength, pattern });
export const int = (required = false) => ({ kind: 'integer', required });
export const num = (required = false) => ({ kind: 'number', required });
export const date = (required = false) => ({ kind: 'string', format: 'date', required });
export const dt = (required = false) => ({ kind: 'string', format: 'date-time', required });
export const bool = (required = false) => ({ kind: 'boolean', required });
export const en = (required = false, values = []) => ({ kind: 'string', enum: values, required });
export const arr = (required = false, items) => ({ kind: 'array', items, required });
export const obj = (required = false, properties = {}, requiredProps = []) => ({ kind: 'object', properties, requiredProps, required });
export const anyJson = (required = false) => ({ kind: 'any', required });
export const emptyBody = () => ({ kind: 'object', properties: {}, requiredProps: [], required: true });

export function loadContext(paths = {}) {
  const catalogPath = resolve(root, paths.catalog ?? 'packages/database/src/generated/catalog.ts');
  const resourcesPath = resolve(root, paths.resources ?? 'packages/domain/src/generated/resources.ts');
  const policyPath = resolve(root, paths.policy ?? 'packages/domain/src/generated/resource-route-policy.ts');
  const processPath = resolve(root, paths.contractProcess ?? 'packages/domain/src/contract-process.ts');
  const appPath = resolve(root, paths.app ?? 'apps/api/src/app.ts');

  const catalogSource = readFileSync(catalogPath, 'utf8');
  const resourcesSource = readFileSync(resourcesPath, 'utf8');
  const policySource = readFileSync(policyPath, 'utf8');
  const processSource = readFileSync(processPath, 'utf8');
  const appSource = readFileSync(appPath, 'utf8');

  const tables = parseCatalog(catalogSource);
  const resources = parseExportedArray(resourcesSource, 'resources');
  const routePolicies = parseExportedArray(policySource, 'resourceRoutePolicies');
  const fieldMaps = parseFieldMaps(processSource);
  const processSpecs = parseProcessSpecs(processSource, fieldMaps);
  return {
    root,
    paths: { catalogPath, resourcesPath, policyPath, processPath, appPath },
    sources: { catalogSource, resourcesSource, policySource, processSource, appSource },
    tables,
    resources,
    routePolicies,
    processSpecs,
    tableByName: new Map(tables.map((item) => [item.tableName, item])),
    resourceByPath: new Map(resources.map((item) => [item.path, item])),
    policyByPath: new Map(routePolicies.map((item) => [item.path, item])),
    processByPath: new Map(processSpecs.map((item) => [item.path, item])),
  };
}

function parseCatalog(source) {
  const startMarker = 'export const schemaCatalog = ';
  const start = source.indexOf(startMarker);
  const end = source.indexOf('] as const', start);
  if (start < 0 || end < 0) throw new Error('schemaCatalog not found');
  const literal = source.slice(start + startMarker.length, end + 1);
  return JSON.parse(literal);
}

function parseExportedArray(source, name) {
  const marker = `export const ${name} = `;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`${name} not found`);
  const valueStart = start + marker.length;
  const end = source.indexOf('] as const', valueStart);
  if (source[valueStart] !== '[' || end < 0) throw new Error(`${name} literal not found`);
  return JSON.parse(source.slice(valueStart, end + 1).replace(/,\s*]/g, ']'));
}

function parseFieldMaps(source) {
  const maps = new Map();
  const regex = /const (\w+Fields)(?::[^=]+)? = \{([\s\S]*?)\n\};/g;
  for (const match of source.matchAll(regex)) {
    const fields = {};
    for (const line of match[2].matchAll(/(\w+):\s*([^,\n]+)(?:,|$)/g)) {
      fields[line[1]] = parseHelperExpression(line[2].trim());
    }
    maps.set(match[1], fields);
  }
  return maps;
}

function parseHelperExpression(expression) {
  if (expression === 'b()') return bool(false);
  const helper = expression.match(/^([sindbje])\((.*)\)$/);
  if (!helper) return anyJson(false);
  const args = splitArgs(helper[2]);
  const required = args[0] === 'true';
  if (helper[1] === 's') return str(required, Number(args[1] ?? 255));
  if (helper[1] === 'i') return int(required);
  if (helper[1] === 'n') return num(required);
  if (helper[1] === 'd') return date(required);
  if (helper[1] === 'b') return bool(required);
  if (helper[1] === 'j') return obj(required);
  if (helper[1] === 'e') {
    const values = args[1]?.startsWith('[') ? parseStringArray(args[1]) : [];
    return en(required, values);
  }
  return anyJson(required);
}

function splitArgs(value) {
  const args = [];
  let depth = 0;
  let current = '';
  let quote = '';
  for (const char of value) {
    if (quote) {
      current += char;
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (char === '[' || char === '(' || char === '{') {
      depth += 1;
      current += char;
    } else if (char === ']' || char === ')' || char === '}') {
      depth -= 1;
      current += char;
    } else if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function parseStringArray(value) {
  return [...value.matchAll(/'([^']+)'|"([^"]+)"/g)].map((item) => item[1] ?? item[2]);
}

function parseProcessSpecs(source, fieldMaps) {
  const block = source.match(/export const contractProcessSpecs[^=]*= \[([\s\S]*?)\n\];/);
  if (!block) throw new Error('contractProcessSpecs not found');
  const specs = [];
  const specRegex = /\{\n\s+requirementId: '([^']+)', path: '([^']+)', schema: '([^']+)', table: '([^']+)'[\s\S]*?\n\s+\}/g;
  for (const match of block[1].matchAll(specRegex)) {
    const text = match[0];
    const fieldsVar = text.match(/fields:\s*(\w+Fields)/)?.[1];
    const inlineFields = text.match(/fields:\s*\{([\s\S]*?)\}\s*,\s*readOnly/);
    const fields = {};
    if (fieldsVar) Object.assign(fields, fieldMaps.get(fieldsVar));
    if (inlineFields) {
      for (const line of inlineFields[1].matchAll(/(\w+):\s*([^,\n]+)(?:,|$)/g)) {
        fields[line[1]] = parseHelperExpression(line[2].trim());
      }
    }
    const fixedValues = {};
    const fixedBlock = text.match(/fixedValues:\s*\{([^}]*)\}/);
    if (fixedBlock) {
      for (const line of fixedBlock[1].matchAll(/(\w+):\s*('[^']+'|true|false|\d+)/g)) {
        fixedValues[line[1]] = JSON.parse(line[2].replace(/'/g, '"'));
      }
    }
    const actions = [...text.matchAll(/(\w+):\s*\{ field: '([^']+)', target: '([^']+)', allowed: \[([^\]]*)\]/g)].map((item) => ({
      name: item[1], field: item[2], target: item[3], allowed: parseStringArray(`[${item[4]}]`),
    }));
    const domainActions = parseStringArray(text.match(/domainActions:\s*(\[[^\]]*\])/)?.[1] ?? '[]');
    specs.push({
      requirementId: match[1],
      path: match[2],
      schema: match[3],
      table: match[4],
      companyKind: text.match(/companyKind: '([^']+)'/)?.[1],
      itemKey: text.match(/itemKey: '([^']+)'/)?.[1],
      itemType: text.match(/itemType: '([^']+)'/)?.[1],
      fields,
      fixedValues,
      actions,
      domainActions,
      readOnly: /readOnly: true/.test(text),
      collectionAlreadyRegistered: /collectionAlreadyRegistered: true/.test(text),
      printTypes: parseStringArray(text.match(/printTypes:\s*(\[[^\]]*\])/)?.[1] ?? '[]'),
    });
  }
  return specs;
}

export function operationKey(method, path) {
  return `${method.toUpperCase()} ${path}`;
}

export function normalizeHonoPath(path) {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

export function collectImplementedOperations(context) {
  const operations = [];
  const seen = new Set();
  const add = (method, path, source) => {
    const normalized = normalizeHonoPath(path);
    const key = operationKey(method, normalized);
    if (seen.has(key)) return;
    seen.add(key);
    operations.push({ method, path: normalized, key, source });
  };

  const generatedIndex = context.sources.appSource.indexOf('for (const resource of resources)');
  const generatedLine = lineAt(context.sources.appSource, generatedIndex);
  for (const policy of context.routePolicies) {
    const resource = context.resourceByPath.get(policy.path);
    const source = { type: 'generated', file: context.paths.appPath, line: generatedLine, resource };
    if (policy.allowedMethods.includes('GET')) {
      add('GET', policy.path, source);
      add('GET', `${policy.path}/:id`, source);
    }
    if (policy.allowedMethods.includes('POST')) {
      add('POST', policy.path, source);
      add('POST', `${policy.path}/:id/actions`, source);
    }
    if (policy.allowedMethods.includes('PATCH')) add('PATCH', `${policy.path}/:id`, source);
  }

  for (const spec of context.processSpecs) {
    const source = { type: 'contract-process', file: context.paths.processPath, line: lineAt(context.sources.processSource, context.sources.processSource.indexOf(spec.path)) };
    if (!spec.collectionAlreadyRegistered) {
      add('GET', spec.path, source);
      if (!spec.readOnly) add('POST', spec.path, source);
    }
    add('GET', `${spec.path}/:id`, source);
    if (!spec.readOnly) {
      add('PATCH', `${spec.path}/:id`, source);
      add('POST', `${spec.path}/:id/actions`, source);
    }
  }

  const routePattern = /app\.(get|post|put|patch|delete|head|options)\(\s*([^,\n]+?)\s*,/g;
  for (const match of context.sources.appSource.matchAll(routePattern)) {
    const method = match[1].toUpperCase();
    const raw = match[2].trim();
    if (raw === 'resource.path' || raw.includes('resource.path') || raw === 'processSpec.path' || raw.includes('processSpec.path')) continue;
    const quoted = raw.match(/^(['"])(.*)\1$/);
    if (!quoted) continue;
    const path = quoted[2];
    if (!path.startsWith('/api/v1/')) continue;
    add(method, path, { type: 'explicit', file: context.paths.appPath, line: lineAt(context.sources.appSource, match.index) });
  }
  return operations;
}

function lineAt(source, index) {
  if (index < 0) return undefined;
  return source.slice(0, index).split('\n').length;
}

export function schemaFromColumn(column, required, forResponse = false) {
  const type = column.type.toUpperCase();
  let schema;
  if (type === 'BOOLEAN') schema = { kind: 'boolean' };
  else if (type === 'JSONB') schema = { kind: 'any-json' };
  else if (type === 'BIGINT') {
    schema = forResponse ? { kind: 'string' } : { kind: 'bigint-input' };
  } else if (type === 'INTEGER') schema = { kind: 'integer' };
  else if (type.startsWith('NUMERIC')) {
    schema = forResponse ? { kind: 'string' } : { kind: 'numeric-input', precision: type.match(/NUMERIC\((\d+),(\d+)\)/)?.slice(1).map(Number) };
  } else if (type === 'DATE') schema = { kind: 'string', format: 'date' };
  else if (type === 'TIMESTAMPTZ') schema = { kind: 'string', format: 'date-time' };
  else if (type === 'UUID') schema = { kind: 'string', format: 'uuid' };
  else {
    const max = type.match(/(?:VARCHAR|CHAR)\((\d+)\)/)?.[1];
    schema = { kind: 'string', maxLength: max ? Number(max) : (type === 'TEXT' ? 100000 : undefined) };
  }
  schema.required = required;
  if (column.nullable) schema.nullable = true;
  return schema;
}

export function createFieldsForTable(table) {
  const fields = {};
  for (const column of table.columns) {
    const required = !column.nullable && !column.identity && !column.actorContext && !column.hasDatabaseDefault;
    fields[column.name] = schemaFromColumn(column, required);
  }
  applyRuleEnums(table.tableName, fields);
  return fields;
}

export function updateFieldsForTable(table) {
  const immutable = new Set(['id', 'created_by', 'created_at', 'updated_by', 'updated_at', 'company_code']);
  const fields = {};
  for (const column of table.columns) {
    if (immutable.has(column.name) || column.identity) continue;
    fields[column.name] = schemaFromColumn(column, false);
  }
  applyRuleEnums(table.tableName, fields);
  return fields;
}

export function rowFieldsForTable(table) {
  const fields = {};
  for (const column of table.columns) fields[column.name] = schemaFromColumn(column, false, true);
  return fields;
}

function applyRuleEnums(tableName, fields) {
  const enumMap = {
    company: { base_currency: ['PHP', 'USD'], status: ['active', 'disabled'] },
    organization_unit: { status: ['active', 'disabled'] },
    position: { status: ['active', 'disabled'] },
    employee: { employment_status: ['probation', 'active', 'suspended', 'disabled', 'resigned'] },
    system_role: { role_status: ['active', 'disabled'] },
    data_permission: { approval_status: ['pending', 'approved', 'rejected', 'expired'] },
    farm_batch: { stage: ['brooding', 'growing', 'pre_laying', 'laying', 'culling', 'closed'] },
    house_pen: { farm_mode: ['cage', 'aviary', 'floor', 'brooding'], house_status: ['active', 'cleaning', 'maintenance', 'closed'] },
    chick_receipt: { qualified: ['qualified', 'quarantine', 'rejected'] },
    environment_record: { shift: ['day', 'night', 'morning', 'evening'] },
    vaccination_program: { program_type: ['standard', 'emergency', 'custom'] },
    medication_prescription: { approval_status: ['draft', 'pending', 'approved', 'rejected', 'executed'] },
    withdrawal_period_record: { release_status: ['blocked', 'released', 'expired'] },
    quarantine_certificate: { request_status: ['draft', 'requested', 'cancelled'], issue_status: ['pending', 'issued', 'rejected'] },
    purchase_requisition: { approval_status: ['draft', 'pending', 'approved', 'rejected', 'closed'] },
    purchase_order: { execution_close: ['draft', 'approved', 'open', 'partial', 'closed', 'cancelled'] },
    supplier: { status: ['pending', 'active', 'suspended', 'disabled'] },
    goods_receipt: { quality_status: ['pending', 'accepted', 'quarantine', 'rejected'] },
    material: { category: ['feed', 'medicine', 'vaccine', 'egg', 'package', 'spare', 'other'] },
    inventory_ledger: { inventory_status: ['available', 'reserved', 'quarantine', 'blocked', 'consumed'] },
    inbound_record: { inbound_type: ['purchase', 'egg', 'transfer', 'return', 'adjustment'] },
    outbound_record: { outbound_type: ['sales', 'requisition', 'transfer', 'return', 'task', 'adjustment'] },
    stocktake_record: { approval_status: ['draft', 'pending', 'approved', 'rejected'] },
    batch_expiry: { batch_status: ['active', 'near_expiry', 'expired', 'blocked', 'consumed'] },
    safety_stock: { process_status: ['normal', 'pending', 'requested', 'resolved'] },
    customer: { status: ['pending', 'active', 'suspended', 'disabled'] },
    price_list: { price_type: ['standard', 'contract', 'special', 'promotion'] },
    sales_order: { order_mode: ['standard', 'contract', 'spot', 'pullets', 'culled_birds'], status: ['draft', 'pending', 'approved', 'allocated', 'shipped', 'signed', 'closed', 'cancelled'] },
    credit_limit: { ceo_approval: ['not_required', 'pending', 'approved', 'rejected'] },
    payment_term_exception: { approval_audit: ['pending', 'approved', 'rejected'] },
    payment_record: { planned_payment_method: ['cash', 'check', 'bank_transfer'], payment_execution_status: ['pending', 'approved', 'executing', 'paid', 'failed', 'cancelled'] },
    cash_checkbook: { payment_execution_status: ['pending', 'issued', 'cleared', 'void', 'cancelled'] },
    payable: { voucher_status: ['not_created', 'draft', 'approved', 'paid'] },
    disbursement_voucher: { planned_payment_method: ['cash', 'check', 'bank_transfer'], approval_status: ['draft', 'pending', 'approved', 'rejected', 'paid'] },
    equipment_check: { result: ['passed', 'failed', 'blocked'] },
    maintenance_work_order: { acceptance_close: ['open', 'repairing', 'pending_acceptance', 'closed', 'cancelled'] },
    print_job: { queue_status: ['queued', 'printing', 'completed', 'failed', 'cancelled'] },
    notification: { read_status: ['unread', 'read'] },
  };
  for (const [field, values] of Object.entries(enumMap[tableName] ?? {})) {
    if (fields[field]) fields[field] = { ...fields[field], kind: 'string', enum: values };
  }
}

const elementBase = {
  id: str(true, 64),
  type: en(true, ['text', 'barcode', 'line', 'rectangle']),
  xMm: num(true),
  yMm: num(true),
  widthMm: num(true),
  heightMm: num(true),
  rotation: en(false, [0, 90]),
};
const canvasDesign = obj(true, {
  widthMm: num(false),
  heightMm: num(false),
  elements: arr(true, obj(true, {
    ...elementBase,
    content: str(false, 200),
    fontSizePt: num(false),
    align: en(false, ['left', 'center', 'right']),
    bold: bool(false),
    value: str(false, 100),
    barcodeFormat: en(false, ['CODE128']),
    humanReadable: bool(false),
  })),
}, ['elements']);

export const explicitContracts = {
  'POST /api/v1/auth/login': { authenticated: false, success: 200, body: obj(true, { account: str(true), password: str(true), companyCode: str(true), mfaCode: str(false) }, ['account', 'password', 'companyCode']), response: 'json' },
  'POST /api/v1/auth/refresh': { authenticated: false, success: 200, body: obj(true, { refreshToken: str(true) }, ['refreshToken']), response: 'json' },
  'POST /api/v1/auth/logout': { success: 204, body: emptyBody(), response: 'empty' },
  'POST /api/v1/farm/feeding-management/{id}/issue': { success: 201, body: obj(true, { warehouseId: int(true), locationId: int(true), incurredOn: date(true) }, ['warehouseId', 'locationId', 'incurredOn']), response: 'json' },
  'POST /api/v1/farm/flock-batches/{id}/cost-postings': {
    success: 201,
    body: obj(true, { amount: num(true), costType: en(true, ['chick', 'feed', 'vaccine', 'medication', 'labor', 'utility', 'other']), sourceType: str(true, 32), sourceId: str(true, 64), incurredOn: date(true), note: str(false, 500) }, ['amount', 'costType', 'sourceType', 'sourceId', 'incurredOn']),
    response: 'json',
  },
  'GET /api/v1/farm/flock-batches/{id}/cost': { success: 200, response: 'json' },
  'POST /api/v1/farm/flock-batches/{id}/actions': { success: 200, body: obj(true, { action: en(true, ['place']), houseId: int(true), quantity: num(true) }, ['action', 'houseId', 'quantity']), response: 'json' },
  'GET /api/v1/farm/flock-batches/{id}/positions': { success: 200, response: 'json' },
  'GET /api/v1/farm/egg-collection-grading': { success: 200, query: { batchId: str(false) }, response: 'json' },
  'POST /api/v1/farm/egg-collection-grading': {
    success: 201,
    body: obj(true, {
      collectionNo: str(true, 40), batchId: int(true), houseId: int(true), materialId: int(true), warehouseId: int(true), locationId: int(true), collectionDate: date(true), shift: en(true, ['day', 'night', 'morning', 'evening']), goodEggs: num(true), brokenEggs: num(true), dirtyEggs: num(true), gradeDetail: obj(true), deviceRef: str(false, 150),
    }, ['collectionNo', 'batchId', 'houseId', 'materialId', 'warehouseId', 'locationId', 'collectionDate', 'shift', 'goodEggs', 'brokenEggs', 'dirtyEggs', 'gradeDetail']),
    response: 'json',
  },
  'GET /api/v1/print/print-templates/{id}/design': { success: 200, response: 'json' },
  'POST /api/v1/print/print-templates/{id}/design': { success: 201, body: canvasDesign, response: 'json' },
  'POST /api/v1/print/print-templates/{id}/design/{designId}/publish': { success: 200, body: emptyBody(), response: 'json' },
  'POST /api/v1/print/design-preview': { success: 200, body: obj(true, { ...canvasDesign.properties, format: en(false, ['pdf', 'escp', 'tspl']) }, ['elements']), response: 'binary' },
  'POST /api/v1/print/print-job/submit': { success: 201, body: obj(true, { templateId: int(true), deviceId: int(true), designVersion: int(false), lines: arr(false, str()) }, ['templateId', 'deviceId']), response: 'json' },
  'POST /api/v1/print/print-job/{id}/dispatch': { success: 200, body: emptyBody(), response: 'json' },
  'POST /api/v1/plat/attachments-import-export/destroy-expired': { success: 200, body: emptyBody(), response: 'json' },
  'POST /api/v1/plat/attachments-import-export/upload': { success: 201, multipart: true, response: 'json' },
  'POST /api/v1/fin/journal-entries': { success: 201, body: obj(true, { entryDate: date(true), lines: arr(true, obj(true)) }, ['entryDate', 'lines']), response: 'json' },
  'POST /api/v1/fin/receipt-settlements': { success: 201, body: obj(true, { receivableId: int(true), cashAmount: num(true), checkAmount: num(true), bankCredit: num(true), writeoff: num(true), receiptMethod: en(true, ['cash', 'check', 'bank_transfer']) }, ['receivableId', 'cashAmount', 'checkAmount', 'bankCredit', 'writeoff', 'receiptMethod']), response: 'json' },
  'POST /api/v1/fin/payment-executions': { success: 201, body: obj(true, { voucherId: int(true), cashierId: int(true), checkAmount: num(true), writeoff: num(true), plannedPaymentMethod: en(true, ['cash', 'check', 'bank_transfer']), paymentRequest: bool(false), bankRef: str(false), bankTransferRef: str(false) }, ['voucherId', 'cashierId', 'checkAmount', 'writeoff', 'plannedPaymentMethod']), response: 'json' },
  'POST /api/v1/fin/tax-rates': { success: 201, body: obj(true, { taxCode: str(true), effectiveFrom: date(true), rate: num(true), effectiveTo: date(false) }, ['taxCode', 'effectiveFrom', 'rate']), response: 'json' },
  'POST /api/v1/fin/tax-transactions': { success: 201, body: obj(true, { transactionDate: date(true), direction: en(true, ['debit', 'credit']), taxCode: str(true), birForm: str(true), netAmount: num(true), sourceType: str(true), sourceId: str(true) }, ['transactionDate', 'direction', 'taxCode', 'birForm', 'netAmount', 'sourceType', 'sourceId']), response: 'json' },
  'GET /api/v1/fin/operating-dashboard': { success: 200, query: { from: date(false), to: date(false) }, response: 'json' },
  'GET /api/v1/fin/tax-report': { success: 200, query: { from: date(false), to: date(false), birForm: str(false) }, response: 'json' },
  'GET /api/v1/fin/periods': { success: 200, query: { status: str(false) }, response: 'json' },
  'POST /api/v1/fin/periods': { success: 201, body: obj(true, { periodCode: str(true, 16), periodStart: date(true), periodEnd: date(true), note: str(false, 500) }, ['periodCode', 'periodStart', 'periodEnd']), response: 'json' },
  'POST /api/v1/fin/periods/{id}/close': { success: 200, body: obj(false, { note: str(false, 500) }), response: 'json' },
  'POST /api/v1/fin/periods/{id}/reopen': { success: 200, body: obj(false, { note: str(false, 500) }), response: 'json' },
  'GET /api/v1/fin/ar-aging': { success: 200, query: { asOf: date(false) }, response: 'json' },
  'GET /api/v1/fin/ap-aging': { success: 200, query: { asOf: date(false) }, response: 'json' },
  'GET /api/v1/fin/trial-balance': { success: 200, query: { from: date(false), to: date(false) }, response: 'json' },
  'GET /api/v1/fin/financial-statements': { success: 200, query: { asOf: date(false) }, response: 'json' },
  'GET /api/v1/fin/aging-export': { success: 200, query: { type: str(false), asOf: date(false), locale: en(false, ['zh-CN', 'en-US', 'fil-PH']) }, response: 'csv' },
  'GET /api/v1/fin/tax-report-export': { success: 200, query: { from: date(false), to: date(false), birForm: str(false), locale: en(false, ['zh-CN', 'en-US', 'fil-PH']) }, response: 'csv' },
  'GET /api/v1/fin/financial-statements-export': { success: 200, query: { asOf: date(false), locale: en(false, ['zh-CN', 'en-US', 'fil-PH']) }, response: 'csv' },
  'POST /api/v1/sales/sales-returns': { success: 201, body: obj(true, { salesOrderId: int(true), reservationId: int(true), quantity: num(true), returnNo: str(true, 40), reason: str(true, 500) }, ['salesOrderId', 'reservationId', 'quantity', 'returnNo', 'reason']), response: 'json' },
  'GET /api/v1/sales/delivery-tasks': { success: 200, response: 'json' },
  'POST /api/v1/sales/delivery-tasks/dispatch': { success: 201, body: obj(true, { taskNo: str(true, 32), salesOrderId: int(true), vehicleId: int(true), routeId: int(true), driverNo: str(true), courierNo: str(true), cargo: str(false, 500), remark: str(false, 500) }, ['taskNo', 'salesOrderId', 'vehicleId', 'routeId', 'driverNo', 'courierNo']), response: 'json' },
  'POST /api/v1/sales/delivery-tasks/{id}/events': { success: 201, body: obj(true, { status: en(true, ['assigned', 'departed', 'arrived', 'signed', 'failed', 'cancelled']), proof: obj(false) }, ['status']), response: 'json' },
  'GET /api/v1/sales/customers/{id}/statement': { success: 200, response: 'json' },
  'GET /api/v1/sales/discount-approvals': { success: 200, query: { status: en(false, ['pending', 'approved', 'rejected']) }, response: 'json' },
  'POST /api/v1/sales/sales-orders/{id}/discount': { success: 201, body: obj(true, { discountPercent: num(true), reason: str(true, 500) }, ['discountPercent', 'reason']), response: 'json' },
  'POST /api/v1/sales/discount-approvals/{id}/actions': { success: 200, body: obj(true, { action: en(true, ['approve', 'reject']), note: str(false, 500) }, ['action']), response: 'json' },
  'POST /api/v1/proc/supplier-lead-times': { success: 201, body: obj(true, { supplierId: int(true), materialId: int(true), leadTimeDays: int(true), effectiveFrom: date(true) }, ['supplierId', 'materialId', 'leadTimeDays', 'effectiveFrom']), response: 'json' },
  'POST /api/v1/proc/mrp-runs': { success: 201, body: obj(true, { demands: arr(true, obj(true)), convert: bool(false) }, ['demands']), response: 'json' },
  'POST /api/v1/proc/procurement-returns': { success: 201, body: obj(true, { goodsReceiptId: int(true), returnNo: str(true, 40), reason: str(true, 500), quantity: num(true) }, ['goodsReceiptId', 'returnNo', 'reason', 'quantity']), response: 'json' },
  'POST /api/v1/proc/supplier-bindings': { success: 201, body: obj(true, { employeeId: int(true), supplierId: int(true) }, ['employeeId', 'supplierId']), response: 'json' },
  'GET /api/v1/proc/portal/purchase-orders': { success: 200, response: 'json' },
  'POST /api/v1/proc/portal/purchase-orders/{id}/confirm': { success: 200, body: obj(true, { confirmedDeliveryDate: date(true), note: str(false, 500) }, ['confirmedDeliveryDate']), response: 'json' },
  'POST /api/v1/proc/portal/advance-shipping-notices': { success: 201, body: obj(true, { purchaseOrderId: int(true), asnNo: str(true), quantity: num(true), batchNo: str(true), productionDate: date(true), expiryDate: date(true) }, ['purchaseOrderId', 'asnNo', 'quantity', 'batchNo', 'productionDate', 'expiryDate']), response: 'json' },
  'POST /api/v1/proc/advance-shipping-notices/{id}/receive': { success: 201, body: obj(true, { qualityStatus: en(true, ['accepted', 'quarantine', 'rejected']), warehouseId: int(true), locationId: int(true) }, ['qualityStatus', 'warehouseId', 'locationId']), response: 'json' },
  'POST /api/v1/sales/livestock-sales': { success: 201, body: obj(true, { saleNo: str(true, 40), saleType: en(true, ['chick', 'cull']), customerId: int(true), flockBatchId: int(true), quantity: int(true), unitPrice: num(true), unitCost: num(false), saleDate: date(true) }, ['saleNo', 'saleType', 'customerId', 'flockBatchId', 'quantity', 'unitPrice', 'saleDate']), response: 'json' },
  'GET /api/v1/fin/sales-orders/{id}/profit': { success: 200, response: 'json' },
  'GET /api/v1/fin/sales-orders/{id}/profit-export': { success: 200, query: { locale: en(false, ['zh-CN', 'en-US', 'fil-PH']) }, response: 'csv' },
  'POST /api/v1/inv/uom-conversions': { success: 201, body: obj(true, { materialId: int(true), unitsPerPack: num(true), effectiveFrom: date(true), effectiveTo: date(false) }, ['materialId', 'unitsPerPack', 'effectiveFrom']), response: 'json' },
  'GET /api/v1/inv/batch-trace': { success: 200, query: { materialId: int(false), batchNo: str(false) }, response: 'json' },
  'GET /api/v1/inv/stock-positions': { success: 200, query: { materialId: int(false) }, response: 'json' },
  'POST /api/v1/inv/stock-counts/{id}/lines': { success: 200, body: obj(true, { lines: arr(true, obj(true, { inventoryId: int(true), actualQuantity: num(true) }, ['inventoryId', 'actualQuantity'])) }, ['lines']), response: 'json' },
  'GET /api/v1/events/dead-letters': { success: 200, query: { limit: int(false) }, response: 'json' },
  'POST /api/v1/events/dead-letters/{jobId}/replay': { success: 200, body: emptyBody(), response: 'json' },
  'GET /api/v1/auth/me': { success: 200, response: 'json' },
  'GET /api/v1/org/role-permissions': { success: 200, response: 'json' },
};

export function expectedStatuses(method, path, contract) {
  const statuses = [contract?.success ?? (method === 'POST' ? 201 : 200)];
  const itemPath = path.includes('{') || /\/actions$/.test(path);
  if (contract?.authenticated !== false) {
    statuses.push(401, 403);
    if (itemPath) statuses.push(404);
  }
  statuses.push(400, 409, 429, 500, 503);
  if (contract?.body || contract?.multipart) statuses.push(413);
  if (contract?.body && !contract.multipart) statuses.push(415);
  return [...new Set(statuses)].sort((a, b) => a - b);
}
