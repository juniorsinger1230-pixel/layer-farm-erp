import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const root = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const options = parseArgs(process.argv.slice(2));
const openapiPath = resolve(root, options.openapi ?? 'contracts/openapi.json');
const pageMapPath = resolve(root, options.pageMap ?? 'apps/web/src/generated/page-api-map.json');
const catalogPath = resolve(root, options.catalog ?? 'packages/database/src/generated/catalog.ts');
const servicePath = resolve(root, options.service ?? 'packages/domain/src/service.ts');
const rulesPath = resolve(root, options.rules ?? 'packages/domain/src/rules.ts');
const contractProcessPath = resolve(root, options.contractProcess ?? 'packages/domain/src/contract-process.ts');
const outputPath = resolve(root, options.out ?? 'apps/web/src/generated/form-schemas.json');

const [openapi, pageMap, catalogSource, serviceSource, rulesSource, contractProcessSource] = await Promise.all([
  readJson(openapiPath),
  readJson(pageMapPath),
  readFile(catalogPath, 'utf8'),
  readFile(servicePath, 'utf8'),
  readFile(rulesPath, 'utf8'),
  readFile(contractProcessPath, 'utf8'),
]);
const catalog = await loadCatalog(catalogSource);
const referenceRules = extractReferenceRules(serviceSource);
const businessEnums = extractBusinessEnums(rulesSource);
const fixedValuesByPath = extractFixedValues(contractProcessSource);
const contractProcessPaths = extractContractPaths(contractProcessSource);
const tablePaths = buildTablePaths(pageMap);
const labelFields = [
  'company_name', 'employee_name', 'role_name', 'position_name', 'unit_name', 'material_name',
  'supplier_name', 'customer_name', 'house_name', 'warehouse_name', 'location_name', 'batch_name',
  'flock_name', 'equipment_name', 'spare_part_name', 'template_name', 'printer_name', 'vehicle_name',
  'route_name', 'task_name', 'prescription_name', 'program_name', 'document_no', 'voucher_no',
  'name', 'title', 'label', 'code', 'number', 'no', 'status',
];

const pages = {};
const createPages = Object.entries(pageMap.mapped).filter(([, contract]) => contract.allowedMethods.includes('POST'));
for (const [pageId, pageContract] of createPages) {
  const operation = openapi.paths[pageContract.path]?.post;
  const requestSchema = dereference(operation?.requestBody?.content?.['application/json']?.schema, new Set());
  if (!requestSchema || requestSchema.type !== 'object') throw new Error(`Missing object create schema: ${pageId}`);
  const tableCatalog = catalog.find((item) => item.tableName === pageContract.table)
    ?? buildSyntheticTable(pageContract.table, requestSchema);
  const columnByName = new Map(tableCatalog.columns.map((column) => [column.name, column]));
  const fixedValues = fixedValuesByPath.get(pageContract.path) ?? {};
  const isContractProcess = contractProcessPaths.has(pageContract.path);
  const hiddenFields = [];
  const fields = [];
  for (const [name, rawProperty] of Object.entries(requestSchema.properties ?? {})) {
    const property = normalizeOneOf(dereference(rawProperty, new Set()));
    const openapiRequired = requestSchema.required?.includes(name) ?? false;
    const existingColumn = columnByName.get(name);
    const column = existingColumn ?? buildSyntheticColumn(name, property, openapiRequired);
    const databaseRequired = existingColumn
      ? !existingColumn.nullable && !existingColumn.identity && !existingColumn.actorContext && !existingColumn.hasDatabaseDefault
      : false;
    const hidden = isHiddenField(name, column) || Object.prototype.hasOwnProperty.call(fixedValues, name);
    if (hidden) {
      hiddenFields.push(name);
      continue;
    }
    const referencedTable = referenceRules.tableReferences[tableCatalog.tableName]?.[name]
      ?? referenceRules.references[name]
      ?? inferConventionalReference(name);
    const businessEnum = businessEnums.get(tableCatalog.tableName)?.get(name) ?? null;
    const effectiveProperty = alignPropertyToColumn(property, column);
    const field = buildField({
      name,
      property: effectiveProperty,
      column,
      required: openapiRequired || databaseRequired,
      referencedTable,
      businessEnum,
    });
    fields.push(field);
  }
  for (const column of tableCatalog.columns) {
    if (isContractProcess && !Object.prototype.hasOwnProperty.call(requestSchema.properties ?? {}, column.name)) continue;
    if (Object.prototype.hasOwnProperty.call(requestSchema.properties ?? {}, column.name)) continue;
    if (column.identity || column.actorContext || column.hasDatabaseDefault || column.nullable) continue;
    if (isHiddenField(column.name, column) || Object.prototype.hasOwnProperty.call(fixedValues, column.name)) continue;
    const property = propertyFromColumn(column);
    const referencedTable = referenceRules.tableReferences[tableCatalog.tableName]?.[column.name]
      ?? referenceRules.references[column.name]
      ?? inferConventionalReference(column.name);
    const businessEnum = businessEnums.get(tableCatalog.tableName)?.get(column.name) ?? null;
    fields.push(buildField({
      name: column.name,
      property,
      column,
      required: true,
      referencedTable,
      businessEnum,
    }));
  }
  if (fields.length === 0) throw new Error(`No visible create fields: ${pageId}`);
  applyKnownOverrides(pageContract.table, fields);
  const companyColumn = tableCatalog.columns.find((column) => column.name === 'company_code');
  pages[pageId] = {
    path: pageContract.path,
    table: pageContract.table,
    companyField: companyColumn ? 'company_code' : null,
    companyFieldType: companyColumn?.type ?? null,
    hiddenFields: [...new Set(hiddenFields)],
    fields,
  };
}

const result = {
  version: 1,
  generatedAt: new Date().toISOString(),
  summary: {
    pageCount: createPages.length,
    totalVisibleFields: Object.values(pages).reduce((sum, page) => sum + page.fields.length, 0),
    referenceFieldCount: Object.values(pages).reduce((sum, page) => sum + page.fields.filter((field) => field.reference).length, 0),
  },
  pages,
};
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(`Generated ${result.summary.pageCount} create form schemas with ${result.summary.totalVisibleFields} visible fields`);

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (next === undefined || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
async function loadCatalog(source) {
  const typescript = (await import('typescript')).default;
  const transpiled = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.ES2022, target: typescript.ScriptTarget.ES2022 },
  }).outputText;
  const directory = await mkdtemp(join(tmpdir(), 'catalog-'));
  const path = join(directory, 'catalog.mjs');
  await writeFile(path, transpiled, 'utf8');
  try {
    const imported = await import(pathToFileURL(path).href);
    return imported.schemaCatalog;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
function extractBalancedObject(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Missing ${marker}`);
  const start = source.indexOf('{', markerIndex);
  let depth = 0;
  let quote = '';
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];
    if (quote) {
      if (char === quote && previous !== '\\') quote = '';
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Unbalanced ${marker}`);
}
function extractReferenceRules(source) {
  const references = Function(`return ${extractBalancedObject(source, 'const REFERENCES')}`)();
  const tableReferences = Function(`return ${extractBalancedObject(source, 'const TABLE_REFERENCES')}`)();
  return { references, tableReferences };
}
function extractBusinessEnums(source) {
  const result = new Map();
  const casePattern = /case\s+'([^']+)'\s*:([\s\S]*?)(?=\s*case\s+'|\s*default:)/g;
  for (const caseMatch of source.matchAll(casePattern)) {
    const tableName = caseMatch[1];
    const body = caseMatch[2];
    const fieldEnums = new Map();
    const enumPattern = /oneOf\s*\(\s*input\s*,\s*'([^']+)'\s*,\s*(\[[^\]]*\])\s*\)/g;
    for (const enumMatch of body.matchAll(enumPattern)) {
      const values = Function(`return ${enumMatch[2]}`)();
      if (Array.isArray(values) && values.every((value) => ['string', 'number'].includes(typeof value))) {
        fieldEnums.set(enumMatch[1], values);
      }
    }
    if (fieldEnums.size > 0) result.set(tableName, fieldEnums);
  }
  return result;
}
function parseFixedValueLiteral(body) {
  const result = {};
  const pairPattern = /([A-Za-z0-9_]+):\s*('[^']*'|true|false|-?\d+(?:\.\d+)?)/g;
  for (const match of body.matchAll(pairPattern)) {
    const key = match[1];
    const raw = match[2];
    if (raw.startsWith("'")) result[key] = raw.slice(1, -1);
    else if (raw === 'true' || raw === 'false') result[key] = raw === 'true';
    else result[key] = Number(raw);
  }
  return result;
}
function extractContractPaths(source) {
  return new Set([...source.matchAll(/path:\s*'([^']+)'/g)].map((match) => match[1]));
}
function extractFixedValues(source) {
  const result = new Map();
  let currentPath = null;
  for (const line of source.split('\n')) {
    const pathMatch = /path:\s*'([^']+)'/.exec(line);
    if (pathMatch) currentPath = pathMatch[1];
    const fixedMatch = /fixedValues:\s*\{([^}]*)\}/.exec(line);
    if (fixedMatch && currentPath) result.set(currentPath, parseFixedValueLiteral(fixedMatch[1]));
  }
  return result;
}
function toSnakeCase(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function inferConventionalReference(name) {
  const normalized = toSnakeCase(name);
  if (normalized === 'from_house_id' || normalized === 'to_house_id' || normalized === 'house_id') return 'house_pen';
  if (normalized === 'batch_id') return 'farm_batch';
  if (normalized === 'warehouse_id' || normalized === 'location_id') return 'warehouse_location';
  if (!normalized.endsWith('_id')) return null;
  const candidate = normalized.slice(0, -3);
  return tablePaths.has(candidate) ? candidate : null;
}
function buildTablePaths(map) {
  const paths = {};
  for (const [pageId, contract] of Object.entries(map.mapped)) {
    if (!contract.allowedMethods.includes('GET')) continue;
    (paths[contract.table] ??= []).push({ pageId, path: contract.path });
  }
  const overrides = {
    farm_batch: '/api/v1/farm/flock-batches',
    position: '/api/v1/org/positions',
    organization_unit: '/api/v1/org/organization-units',
    purchase_requisition: '/api/v1/proc/purchase-requisitions',
    vaccination_execution: '/api/v1/vet/vaccination-records',
    goods_receipt: '/api/v1/proc/receipt-inspections',
    vehicle_route: '/api/v1/log/vehicles',
    print_template: '/api/v1/print/print-template-versions',
  };
  return new Map(Object.entries({
    ...Object.fromEntries(Object.entries(paths).map(([table, entries]) => [table, entries[0].path])),
    ...overrides,
  }));
}
function resolveRef(ref) {
  let value = openapi;
  for (const part of ref.replace('#/', '').split('/')) value = value[part];
  return value;
}
function dereference(schema, seen) {
  if (!schema || typeof schema !== 'object') return schema;
  if (schema.$ref) {
    if (seen.has(schema.$ref)) return resolveRef(schema.$ref);
    seen.add(schema.$ref);
    return dereference(resolveRef(schema.$ref), seen);
  }
  if (schema.allOf) {
    const merged = {
      ...schema,
      allOf: undefined,
      properties: { ...(schema.properties ?? {}) },
      required: [...(schema.required ?? [])],
    };
    for (const item of schema.allOf) {
      const resolved = dereference(item, new Set(seen));
      Object.assign(merged.properties, resolved.properties ?? {});
      merged.required.push(...(resolved.required ?? []));
    }
    merged.required = [...new Set(merged.required)];
    return merged;
  }
  return schema;
}
function normalizeOneOf(schema) {
  if (!schema.oneOf) return schema;
  const preferred = schema.oneOf
    .map((item) => dereference(item, new Set()))
    .find((item) => item.type === 'integer' || item.type === 'number' || item.type === 'boolean')
    ?? dereference(schema.oneOf[0], new Set());
  return { ...preferred, ...Object.fromEntries(Object.entries(schema).filter(([key]) => key !== 'oneOf')) };
}
function isHiddenField(name, column) {
  return name === 'id'
    || name === 'company_code'
    || name === 'created_by'
    || name === 'created_at'
    || name === 'updated_by'
    || name === 'updated_at'
    || column.identity
    || column.actorContext;
}
function syntheticColumnType(property) {
  if (property.type === 'boolean') return 'BOOLEAN';
  if (property.type === 'integer') return 'BIGINT';
  if (property.type === 'number') return 'NUMERIC(18,4)';
  if (property.type === 'object' || property.type === 'array') return 'JSONB';
  if (property.format === 'date-time') return 'TIMESTAMPTZ';
  if (property.format === 'date') return 'DATE';
  return `VARCHAR(${property.maxLength ?? 255})`;
}
function buildSyntheticColumn(name, property, required) {
  return {
    name,
    type: syntheticColumnType(property),
    nullable: !required,
    identity: false,
    actorContext: false,
    hasDatabaseDefault: false,
    description: property.description ?? '',
    sensitivity: 'INTERNAL',
  };
}
function buildSyntheticTable(tableName, schema) {
  return {
    tableName,
    tableId: `SYNTHETIC-${tableName}`,
    moduleCode: 'PROCESS',
    tableKind: 'CONTRACT_PROCESS',
    companyScope: Object.keys(schema.properties ?? {}).includes('company_code'),
    chineseName: tableName,
    primaryKey: ['id'],
    columns: Object.entries(schema.properties ?? {}).map(([name, rawProperty]) => {
      const property = normalizeOneOf(dereference(rawProperty, new Set()));
      return buildSyntheticColumn(name, property, schema.required?.includes(name) ?? false);
    }),
  };
}
function humanize(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-]+/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());
}
function numericConstraints(column) {
  const match = /^NUMERIC\((\d+),(\d+)\)$/.exec(column.type);
  if (!match) return { precision: null, scale: null };
  return { precision: Number(match[1]), scale: Number(match[2]) };
}
function propertyFromColumn(column) {
  if (/^(BIGINT|INTEGER|SMALLINT|BIGSERIAL|SERIAL)(\(|$)/.test(column.type)) return { type: 'integer' };
  if (/^(NUMERIC|DECIMAL|REAL|DOUBLE PRECISION)(\(|$)/.test(column.type)) return { type: 'number' };
  if (column.type === 'BOOLEAN') return { type: 'boolean' };
  if (column.type === 'DATE') return { type: 'string', format: 'date' };
  if (/^TIMESTAMP/.test(column.type)) return { type: 'string', format: 'date-time' };
  if (/^JSONB?$/.test(column.type)) return { type: 'object' };
  const lengthMatch = /^(?:VARCHAR|CHAR)\((\d+)\)$/.exec(column.type);
  return { type: 'string', ...(lengthMatch ? { maxLength: Number(lengthMatch[1]) } : {}) };
}
function alignPropertyToColumn(property, column) {
  if (/^(BIGINT|INTEGER|SMALLINT|BIGSERIAL|SERIAL)(\(|$)/.test(column.type)) return { ...property, type: 'integer' };
  if (/^(NUMERIC|DECIMAL|REAL|DOUBLE PRECISION)(\(|$)/.test(column.type)) return { ...property, type: 'number' };
  if (column.type === 'BOOLEAN') return { ...property, type: 'boolean' };
  if (column.type === 'DATE') return { ...property, type: 'string', format: 'date' };
  if (/^TIMESTAMP/.test(column.type)) return { ...property, type: 'string', format: 'date-time' };
  if (/^JSONB?(\(|$)/.test(column.type)) {
    if (property.type === 'object' || property.type === 'array') return property;
    return { ...property, type: 'string' };
  }
  if (/^(VARCHAR|CHAR|TEXT|CITEXT|UUID)(\(|$)/.test(column.type)) {
    if (property.type === 'integer' || property.type === 'number' || property.type === 'object' || property.type === 'array') return property;
    return { ...property, type: 'string' };
  }
  return property;
}

function inferControl(property, column, referencedTable, businessEnum) {
  if (referencedTable) return 'reference';
  if (property.type === 'boolean') return 'switch';
  if (property.format === 'date-time') return 'date-time';
  if (property.format === 'date' || column.type === 'DATE') return 'date';
  if (property.enum || businessEnum) return 'select';
  if (property.type === 'integer' || property.type === 'number') return 'number';
  if (property.type === 'object' || property.type === 'array') return 'json';
  if (column.type === 'TEXT' || (property.maxLength ?? 0) >= 200 || /remark|description|note/.test(property.name ?? '')) return 'textarea';
  return 'text';
}
function buildField({ name, property, column, required, referencedTable, businessEnum }) {
  const enumValues = property.enum ?? businessEnum ?? null;
  const control = inferControl(property, column, referencedTable, businessEnum);
  const constraints = numericConstraints(column);
  const field = {
    name,
    label: humanize(name),
    type: property.type ?? 'string',
    format: property.format ?? null,
    control,
    required,
    nullable: column.nullable,
    description: column.description || property.description || '',
    default: property.default ?? null,
    enum: enumValues,
    min: property.minimum ?? null,
    max: property.maximum ?? null,
    minLength: property.minLength ?? null,
    maxLength: property.maxLength ?? null,
    precision: constraints.precision,
    scale: constraints.scale,
    placeholder: `请输入${humanize(name)}`,
  };
  if (referencedTable) {
    const referencePath = tablePaths.get(referencedTable);
    if (!referencePath) throw new Error(`Missing reference API path: ${referencedTable}`);
    field.reference = {
      table: referencedTable,
      path: referencePath,
      valueField: referencedTable === 'print_template' ? 'template_id' : 'id',
      labelFields,
    };
  }
  return field;
}
function applyKnownOverrides(tableName, fields) {
  if (tableName !== 'print_template_design') return;
  for (const field of fields) {
    if (field.name === 'status') {
      field.type = 'string';
      field.control = 'select';
      field.enum = ['draft', 'published', 'archived'];
      field.maxLength = 16;
      field.default = 'draft';
    }
    if (field.name === 'elements') {
      field.type = 'array';
      field.jsonShape = 'array';
    }
  }
}
