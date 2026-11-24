import {
  arr,
  createFieldsForTable,
  explicitContracts,
  expectedStatuses,
  obj,
  str,
  updateFieldsForTable,
} from './contract-model.mjs';

export function buildExpected(operation, context) {
  const explicit = explicitContracts[operation.key];
  if (explicit) {
    return {
      body: explicit.multipart ? undefined : explicit.body,
      multipart: explicit.multipart,
      query: explicit.query,
      statuses: expectedStatuses(operation.method, operation.path, explicit),
      response: explicit.response,
    };
  }

  const processSpec = findProcessSpec(operation, context);
  if (processSpec) return expectedForProcess(operation, processSpec);

  const resource = findResource(operation, context);
  if (!resource) return { statuses: expectedStatuses(operation.method, operation.path, { success: 200 }) };
  const table = context.tableByName.get(resource.table);
  const policy = context.policyByPath.get(resource.path);
  const isCollection = operation.path === resource.path;
  const isAction = operation.path === `${resource.path}/{id}/actions`;
  let body;
  let query;
  if (operation.method === 'GET' && isCollection) query = standardListQuery(table);
  else if (operation.method === 'POST' && isCollection) {
    const fields = createFieldsForTable(table);
    body = obj(true, fields, requiredNames(fields));
  } else if (isAction) body = expectedGenericActionBody(resource.table);
  else if (operation.method === 'PATCH') body = obj(true, updateFieldsForTable(table), []);

  return {
    body,
    query,
    statuses: expectedStatuses(operation.method, operation.path, { success: operation.method === 'POST' && isCollection ? 201 : 200, body }),
    response: 'json',
    table,
    policy,
  };
}

function expectedForProcess(operation, spec) {
  const isCollection = operation.path === spec.path;
  const isAction = operation.path === `${spec.path}/{id}/actions`;
  let body;
  let query;
  if (operation.method === 'GET' && isCollection) query = { page: str(false), pageSize: str(false) };
  if (operation.method === 'POST' && isCollection) {
    const fields = requestProcessFields(spec, true);
    body = obj(true, fields, requiredNames(fields));
  }
  if (operation.method === 'PATCH') {
    const fields = requestProcessFields(spec, false);
    body = obj(true, fields, []);
  }
  if (isAction) body = expectedProcessActionBody(spec);
  return {
    body,
    query,
    statuses: expectedStatuses(operation.method, operation.path, { success: operation.method === 'POST' && isCollection ? 201 : 200, body }),
    response: 'json',
    processSpec: spec,
  };
}

export function requestProcessFields(spec, create) {
  const fields = {};
  for (const [name, definition] of Object.entries(spec.fields)) {
    if (Object.hasOwn(spec.fixedValues ?? {}, name)) continue;
    fields[name] = { ...definition, required: create ? definition.required : false };
  }
  return fields;
}

function expectedGenericActionBody(tableName) {
  const action = { ...str(true), pattern: '^[a-z_]+$' };
  const fields = { action, lines: arr(false, arr(false)), data: obj(false) };
  if (tableName === 'goods_receipt') {
    Object.assign(fields, {
      warehouseId: str(false), locationId: str(false), batchNo: str(false), productionDate: str(false), expiryDate: str(false), unitCost: str(false), packQuantity: str(false), unitsPerPack: str(false),
    });
  }
  if (tableName === 'sales_order') fields.lines = arr(false);
  if (tableName === 'purchase_requisition') fields.data = obj(false, { supplier_id: str(false), price: str(false) }, []);
  return obj(true, fields, ['action']);
}

function expectedProcessActionBody(spec) {
  const names = [...new Set([...spec.actions.map((item) => item.name), ...spec.domainActions])];
  const fields = { action: names.length ? { ...str(true), enum: names } : { ...str(true), pattern: '^[a-z_]+$' } };
  const optional = ['reason', 'remark', 'note', 'proof', 'gradeDetail', 'deviceRef', 'actualDayAge', 'templateId', 'houseId', 'quantity'];
  for (const name of optional) fields[name] = name === 'proof' ? obj(false) : str(false);
  return obj(true, fields, ['action']);
}

function standardListQuery(table) {
  const query = { page: str(false), pageSize: str(false), orderBy: str(false), orderDirection: str(false) };
  for (const column of table.columns) query[column.name] = str(false);
  return query;
}

export function findProcessSpec(operation, context) {
  const direct = context.processByPath.get(operation.path);
  if (direct) return direct;
  const base = operation.path.split('/{')[0];
  return context.processByPath.get(base);
}

function findResource(operation, context) {
  const direct = context.resourceByPath.get(operation.path);
  if (direct) return direct;
  const base = operation.path.split('/{')[0];
  return context.resourceByPath.get(base);
}

export function requiredNames(fields) {
  return Object.entries(fields).filter(([, definition]) => definition.required).map(([name]) => name);
}
