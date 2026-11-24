import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { withTransaction, type ActorContext, type Queryable } from '../../database/src/client.js';
import { PostgresRepository } from '../../database/src/repository.js';
import { tableCatalogByName, type ColumnCatalog, type TableCatalog } from '../../database/src/generated/catalog.js';
import { AppError, validationError } from '../../shared/src/errors.js';
import { validateBusinessRules } from './rules.js';

const READ_ONLY = new Set(['audit_log', 'version_history', 'traceability_link', 'outbox_event', 'idempotency_consumption', 'task_status']);
const REFERENCES: Record<string, string> = {
  batch_id: 'farm_batch', house_id: 'house_pen', material_id: 'material', vaccine_id: 'material', drug_id: 'material',
  program_id: 'vaccination_program', task_id: 'vaccination_task', execution_id: 'vaccination_execution', prescription_id: 'medication_prescription',
  supplier_id: 'supplier', order_id: 'purchase_order', position_id: 'position', unit_id: 'organization_unit', role_id: 'system_role', employee_id: 'employee',
  location_id: 'warehouse_location', warehouse_id: 'warehouse_location', customer_id: 'customer', price_id: 'price_list', credit_ref: 'credit_limit',
  vehicle_id: 'vehicle_route', route_id: 'vehicle_route', equipment_id: 'equipment', spare_part_id: 'spare_part', template_id: 'print_template',
  printer_device_id: 'printer_device', payable_id: 'payable', purchase_id: 'purchase_order', goods_receipt_id: 'goods_receipt', receivable_id: 'receivable',
};
const TABLE_REFERENCES: Record<string, Record<string, string>> = {
  sales_order: { order_id: 'sales_order' }, delivery_task: { order_id: 'sales_order', driver_no: 'employee', courier_no: 'employee' },
  receivable: { order_id: 'sales_order' }, payment_record: { cashier_id: 'employee', voucher_id: 'disbursement_voucher', payment_evidence_id: 'attachment' },
  cash_checkbook: { voucher_id: 'disbursement_voucher' }, disbursement_voucher: { prepared_by: 'employee', approved_by: 'employee' },
  vaccination_task: { owner_employee_no: 'employee' }, audit_log: { employee_no: 'employee' }, notification: { employee_no: 'employee' },
  print_job: { pdf_ref: 'attachment' }, delivery_receipt: { photo_ref: 'attachment', task_id: 'delivery_task' }, delivery_exception: { photo_ref: 'attachment', task_id: 'delivery_task' },
  report_record: { export_ref: 'attachment' }, inbound_record: { purchase_arrival: 'goods_receipt' }, outbound_record: { sales_ref: 'sales_order' },
};

function model(table: string): TableCatalog {
  const found = tableCatalogByName.get(table);
  if (!found) throw new AppError(404, 'NOT_FOUND', '业务资源不存在');
  return found;
}

function validateText(value: string, maximum: number): string {
  if (value.length > maximum || value.includes('\0')) throw validationError();
  return value;
}

function validateColumn(column: ColumnCatalog, value: unknown): unknown {
  if (value === null) {
    if (!column.nullable) throw validationError();
    return null;
  }
  const type = column.type.toUpperCase();
  if (type === 'BOOLEAN') {
    if (typeof value !== 'boolean') throw validationError();
    return value;
  }
  if (type === 'JSONB') {
    if (typeof value !== 'object' || value === null || JSON.stringify(value).includes('__proto__')) throw validationError();
    return value;
  }
  if (type === 'BIGINT' || type === 'INTEGER') {
    if ((typeof value !== 'number' && typeof value !== 'string') || !/^-?\d+$/.test(String(value))) throw validationError();
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || (type === 'INTEGER' && (parsed < -2_147_483_648 || parsed > 2_147_483_647))) throw validationError();
    return parsed;
  }
  if (type.startsWith('NUMERIC')) {
    if (typeof value !== 'number' && typeof value !== 'string') throw validationError();
    const text = String(value);
    if (!/^-?\d+(\.\d+)?$/.test(text)) throw validationError();
    const match = type.match(/NUMERIC\((\d+),(\d+)\)/);
    if (match) {
      const [, integerPart = '', fractionPart = ''] = text.replace('-', '').split('.');
      if (integerPart.length > Number(match[1]) - Number(match[2]) || fractionPart.length > Number(match[2])) throw validationError();
    }
    return text;
  }
  if (typeof value !== 'string') throw validationError();
  if (type.startsWith('VARCHAR')) {
    const maximum = Number(type.match(/\((\d+)\)/)?.[1]);
    return validateText(value, maximum);
  }
  if (type.startsWith('CHAR(')) return validateText(value, Number(type.match(/\((\d+)\)/)?.[1]));
  if (type === 'TEXT') return validateText(value, 100_000);
  if (type === 'DATE') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw validationError();
    return value;
  }
  if (type === 'TIMESTAMPTZ') {
    if (Number.isNaN(Date.parse(value))) throw validationError();
    return new Date(value).toISOString();
  }
  if (type === 'UUID' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw validationError();
  return value;
}

function normalizeInput(table: TableCatalog, input: Record<string, unknown>, create: boolean): Record<string, unknown> {
  const immutable = new Set(['id', 'created_by', 'created_at', 'updated_by', 'updated_at', 'company_code']);
  const unknown = Object.keys(input).filter((key) => !table.columns.some((column) => column.name === key) || (!create && immutable.has(key)) || (create && key !== 'company_code' && immutable.has(key)));
  if (unknown.length > 0) throw validationError();
  const normalized: Record<string, unknown> = {};
  for (const column of table.columns) {
    const value = input[column.name];
    if (value !== undefined) normalized[column.name] = validateColumn(column, value);
    if (create && !column.nullable && !column.identity && !column.actorContext && !column.hasDatabaseDefault && column.name !== 'company_code' && value === undefined) throw validationError();
  }
  validateBusinessRules(table.tableName, normalized);
  return normalized;
}

async function assertReference(db: Queryable, table: string, id: unknown, context: ActorContext): Promise<void> {
  if (!Number.isSafeInteger(id) || (id as number) < 1) throw validationError();
  const referenced = model(table);
  const values: unknown[] = [id];
  let scope = '';
  if (referenced.companyScope) {
    const numeric = referenced.columns.find((column) => column.name === 'company_code')?.type === 'BIGINT';
    values.push(numeric ? context.companyId : context.companyCode);
    scope = ' AND company_code=$2';
  }
  const result = await db.query(`SELECT id FROM app."${table}" WHERE id=$1${scope}`, values);
  if (result.rowCount !== 1) throw new AppError(400, 'VALIDATION_ERROR', '引用记录不存在或不属于当前公司');
}

export async function assertReferences(db: Queryable, table: string, input: Record<string, unknown>, context: ActorContext): Promise<void> {
  for (const [field, value] of Object.entries(input)) {
    if (value === null) continue;
    if (field === 'credit_ref' && value === 0) continue;
    const referenced = TABLE_REFERENCES[table]?.[field] ?? REFERENCES[field];
    if (referenced !== undefined) await assertReference(db, referenced, value, context);
  }
  if (table === 'organization_unit' && input.parent_unit_id !== undefined && input.parent_unit_id !== null) await assertReference(db, 'organization_unit', input.parent_unit_id, context);
  if (table === 'position' && input.reports_to_id !== undefined && input.reports_to_id !== null) await assertReference(db, 'position', input.reports_to_id, context);
}

function requestHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export class DomainService {
  constructor(private readonly pool: Pool, private readonly context: ActorContext) {}

  async list(tableName: string, options: { page: number; pageSize: number; filters?: Record<string, unknown>; orderBy?: string; orderDirection?: 'ASC' | 'DESC' }): Promise<unknown> {
    model(tableName);
    return withTransaction(this.pool, this.context, async (client) => new PostgresRepository(client, this.context).list(tableName, options));
  }

  async get(tableName: string, id: string): Promise<Record<string, unknown>> {
    model(tableName);
    const row = await withTransaction(this.pool, this.context, async (client) => new PostgresRepository(client, this.context).get<Record<string, unknown>>(tableName, id));
    if (row === null) throw new AppError(404, 'NOT_FOUND', '业务记录不存在');
    return row;
  }

  async create(tableName: string, input: Record<string, unknown>, idempotencyKey: string): Promise<Record<string, unknown>> {
    if (READ_ONLY.has(tableName)) throw new AppError(403, 'FORBIDDEN', '系统留痕记录禁止人工写入');
    const table = model(tableName);
    const normalized = normalizeInput(table, input, true);
    if (!/^[A-Za-z0-9._:-]{8,200}$/.test(idempotencyKey)) throw validationError();
    return this.idempotent(`api:${tableName}`, idempotencyKey, { tableName, input: normalized }, async (client) => {
      await assertReferences(client, tableName, normalized, this.context);
      const repository = new PostgresRepository(client, this.context);
      const created = await repository.create<Record<string, unknown>>(tableName, normalized);
      await this.applyCreateSideEffects(client, tableName, created);
      await this.recordMutation(client, tableName, 'create', created);
      return created;
    });
  }

  async idempotent<T>(consumer: string, idempotencyKey: string, input: unknown, work: (client: Queryable) => Promise<T>): Promise<T> {
    if (!/^[A-Za-z0-9._:-]{8,200}$/.test(idempotencyKey)) throw validationError();
    const hash = requestHash(input);
    return withTransaction(this.pool, this.context, async (client) => {
      const inserted = await client.query(
        `INSERT INTO app.idempotency_consumption (company_id,consumer_name,event_id,idempotency_key,request_hash,processing_status,first_received_at)
         VALUES ($1,$2,$3,$4,$5,'processing',now()) ON CONFLICT (company_id,consumer_name,idempotency_key) DO NOTHING RETURNING id`,
        [this.context.companyId, consumer, randomUUID(), idempotencyKey, hash],
      );
      if (inserted.rowCount === 0) {
        const existing = await client.query<{ request_hash: string; processing_status: string; result_payload: T | null }>(
          'SELECT request_hash,processing_status,result_payload FROM app.idempotency_consumption WHERE company_id=$1 AND consumer_name=$2 AND idempotency_key=$3 FOR UPDATE',
          [this.context.companyId, consumer, idempotencyKey],
        );
        const row = existing.rows[0];
        if (row === undefined || row.request_hash !== hash) throw new AppError(409, 'CONFLICT', '幂等键已用于不同请求');
        if (row.processing_status === 'completed' && row.result_payload !== null) return row.result_payload;
        throw new AppError(409, 'CONFLICT', '相同请求正在处理或曾经失败，请使用新幂等键重试');
      }
      const result = await work(client);
      await client.query(
        `UPDATE app.idempotency_consumption SET processing_status='completed',result_payload=$4::jsonb,processed_at=now()
         WHERE company_id=$1 AND consumer_name=$2 AND idempotency_key=$3`,
        [this.context.companyId, consumer, idempotencyKey, JSON.stringify(result)],
      );
      return result;
    });
  }

  async update(tableName: string, id: string, input: Record<string, unknown>, expectedUpdatedAt?: string): Promise<Record<string, unknown>> {
    if (READ_ONLY.has(tableName)) throw new AppError(403, 'FORBIDDEN', '系统留痕记录禁止人工修改');
    const table = model(tableName);
    const normalized = normalizeInput(table, input, false);
    return withTransaction(this.pool, this.context, async (client) => {
      const repository = new PostgresRepository(client, this.context);
      const before = await repository.get<Record<string, unknown>>(tableName, id);
      if (before === null) throw new AppError(404, 'NOT_FOUND', '业务记录不存在');
      await assertReferences(client, tableName, { ...before, ...normalized }, this.context);
      validateBusinessRules(tableName, { ...before, ...normalized });
      const updated = await repository.update<Record<string, unknown>>(tableName, id, normalized, expectedUpdatedAt);
      if (updated === null) throw new AppError(409, 'CONFLICT', '记录已被其他用户修改或无权访问');
      await this.recordMutation(client, tableName, 'update', updated, before);
      return updated;
    });
  }

  private async applyCreateSideEffects(client: Queryable, tableName: string, created: Record<string, unknown>): Promise<void> {
    if (tableName === 'transfer_record') {
      const batchId = Number(created.batch_id);
      const fromHouse = Number(created.from_house_id);
      const toHouse = Number(created.to_house_id);
      const quantity = Number(created.headcount_check);
      const source = await client.query<{ quantity: string }>('SELECT quantity FROM app_ops.flock_position WHERE batch_id=$1 AND house_id=$2 AND company_code=$3 FOR UPDATE', [batchId, fromHouse, this.context.companyCode]);
      if (source.rowCount !== 1 || Number(source.rows[0]!.quantity) < quantity) throw new AppError(409, 'CONFLICT', '转出栋舍存栏不足');
      await client.query('UPDATE app_ops.flock_position SET quantity=quantity-$3,version=version+1,updated_at=now() WHERE batch_id=$1 AND house_id=$2', [batchId, fromHouse, quantity]);
      await client.query(
        `INSERT INTO app_ops.flock_position (batch_id,house_id,company_code,quantity) VALUES ($1,$2,$3,$4)
         ON CONFLICT (batch_id,house_id) DO UPDATE SET quantity=app_ops.flock_position.quantity+EXCLUDED.quantity,version=app_ops.flock_position.version+1,updated_at=now()`,
        [batchId, toHouse, this.context.companyCode, quantity],
      );
    }
    if (tableName === 'mortality_cull_record') {
      let remaining = Number(created.quantity);
      const positions = await client.query<{ house_id: string; quantity: string }>('SELECT house_id,quantity FROM app_ops.flock_position WHERE batch_id=$1 AND company_code=$2 AND quantity>0 ORDER BY house_id FOR UPDATE', [Number(created.batch_id), this.context.companyCode]);
      const available = positions.rows.reduce((sum, row) => sum + Number(row.quantity), 0);
      if (remaining > available) throw new AppError(409, 'CONFLICT', '死淘数量超过当前存栏');
      for (const position of positions.rows) {
        if (remaining <= 0) break;
        const deduction = Math.min(remaining, Number(position.quantity));
        await client.query('UPDATE app_ops.flock_position SET quantity=quantity-$3,version=version+1,updated_at=now() WHERE batch_id=$1 AND house_id=$2', [Number(created.batch_id), Number(position.house_id), deduction]);
        remaining -= deduction;
      }
    }
  }

  private async applyTransitionSideEffects(client: Queryable, tableName: string, action: string, updated: Record<string, unknown>): Promise<void> {
    if (tableName !== 'stocktake_record' || action !== 'approve') return;
    const lines = await client.query(
      `SELECT s.*,l.material_id,l.batch_no,l.warehouse_id,l.location_id,v.unit_cost
       FROM app_ops.stocktake_line s JOIN app.inventory_ledger l ON l.id=s.inventory_id
       LEFT JOIN app_ops.inventory_valuation v ON v.company_id=l.company_code AND v.material_id=l.material_id AND v.batch_no=l.batch_no AND v.warehouse_id=l.warehouse_id AND v.location_id=l.location_id
       WHERE s.company_id=$1 AND s.stocktake_id=$2 ORDER BY s.id FOR UPDATE OF s,l`,
      [this.context.companyId, Number(updated.id)],
    );
    if (lines.rowCount === 0) throw new AppError(409, 'CONFLICT', '盘点单没有明细，禁止批准');
    for (const line of lines.rows) {
      const changed = await client.query('UPDATE app.inventory_ledger SET quantity=$2,updated_by=$3,updated_at=now() WHERE id=$1', [line.inventory_id, line.actual_quantity, this.context.actorId]);
      if (changed.rowCount !== 1) throw new AppError(409, 'CONFLICT', '盘点库存已被其他业务改变');
      await client.query('UPDATE app_ops.inventory_valuation SET quantity=$6,updated_at=now() WHERE company_id=$1 AND material_id=$2 AND batch_no=$3 AND warehouse_id=$4 AND location_id=$5', [this.context.companyId, line.material_id, line.batch_no, line.warehouse_id, line.location_id, line.actual_quantity]);
      await client.query(
        `INSERT INTO app_ops.inventory_movement (movement_id,company_id,material_id,batch_no,warehouse_id,location_id,movement_type,quantity,unit_cost,source_type,source_id,idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,'adjustment',$7,$8,'stocktake',$9,$10)`,
        [randomUUID(), this.context.companyId, line.material_id, line.batch_no, line.warehouse_id, line.location_id, line.difference, line.unit_cost ?? 0, String(updated.id), `stocktake:${line.id}`],
      );
    }
    await client.query('UPDATE app.stocktake_record SET book_quantity=(SELECT sum(book_quantity) FROM app_ops.stocktake_line WHERE stocktake_id=$1),actual_quantity=(SELECT sum(actual_quantity) FROM app_ops.stocktake_line WHERE stocktake_id=$1),difference=(SELECT sum(difference) FROM app_ops.stocktake_line WHERE stocktake_id=$1) WHERE id=$1', [Number(updated.id)]);
  }

  async transition(tableName: string, id: string, action: string, expectedUpdatedAt?: string): Promise<Record<string, unknown>> {
    const states: Record<string, { field: string; transitions: Record<string, [string[], string]> }> = {
      purchase_requisition: { field: 'approval_status', transitions: { submit: [['draft', 'rejected'], 'pending'], approve: [['pending'], 'approved'], reject: [['pending'], 'rejected'], close: [['approved'], 'closed'] } },
      purchase_order: { field: 'execution_close', transitions: { approve: [['draft'], 'approved'], open: [['approved'], 'open'], close: [['open', 'partial'], 'closed'], cancel: [['draft', 'approved', 'open'], 'cancelled'] } },
      medication_prescription: { field: 'approval_status', transitions: { submit: [['draft', 'rejected'], 'pending'], approve: [['pending'], 'approved'], reject: [['pending'], 'rejected'], execute: [['approved'], 'executed'] } },
      sales_order: { field: 'status', transitions: { submit: [['draft', 'cancelled'], 'pending'], approve: [['pending'], 'approved'], allocate: [['approved'], 'allocated'], ship: [['allocated'], 'shipped'], sign: [['shipped'], 'signed'], close: [['signed'], 'closed'], cancel: [['draft', 'pending', 'approved'], 'cancelled'] } },
      credit_limit: { field: 'ceo_approval', transitions: { request_approval: [['not_required', 'rejected'], 'pending'], approve: [['pending'], 'approved'], reject: [['pending'], 'rejected'] } },
      stocktake_record: { field: 'approval_status', transitions: { submit: [['draft', 'rejected'], 'pending'], approve: [['pending'], 'approved'], reject: [['pending'], 'rejected'] } },
      disbursement_voucher: { field: 'approval_status', transitions: { submit: [['draft', 'rejected'], 'pending'], approve: [['pending'], 'approved'], reject: [['pending'], 'rejected'] } },
      payment_record: { field: 'approval_status', transitions: { submit: [['draft', 'rejected'], 'pending'], approve: [['pending'], 'approved'], reject: [['pending'], 'rejected'] } },
      maintenance_work_order: { field: 'acceptance_close', transitions: { start: [['open'], 'repairing'], request_acceptance: [['repairing'], 'pending_acceptance'], accept: [['pending_acceptance'], 'closed'], cancel: [['open', 'repairing'], 'cancelled'] } },
      withdrawal_period_record: { field: 'release_status', transitions: { release: [['blocked', 'expired'], 'released'] } },
    };
    const definition = states[tableName];
    const transition = definition?.transitions[action];
    if (definition === undefined || transition === undefined) throw validationError();
    return withTransaction(this.pool, this.context, async (client) => {
      const repository = new PostgresRepository(client, this.context);
      const before = await repository.get<Record<string, unknown>>(tableName, id);
      if (before === null) throw new AppError(404, 'NOT_FOUND', '业务记录不存在');
      const [allowed, target] = transition;
      if (!allowed.includes(String(before[definition.field]))) throw new AppError(409, 'CONFLICT', '当前状态不允许该操作');
      if (tableName === 'withdrawal_period_record' && action === 'release') {
        const released = await client.query<{ allowed: boolean }>("SELECT now() >= created_at + make_interval(days => withdrawal_days) AS allowed FROM app.withdrawal_period_record WHERE id=$1", [Number(id)]);
        if (released.rows[0]?.allowed !== true) throw new AppError(409, 'CONFLICT', '停药期尚未届满，禁止解除销售阻断');
      }
      const updated = await repository.update<Record<string, unknown>>(tableName, id, { [definition.field]: target, ...(tableName === 'medication_prescription' && action === 'execute' ? { executed: true } : {}) }, expectedUpdatedAt);
      if (updated === null) throw new AppError(409, 'CONFLICT', '记录已被其他用户修改');
      await this.applyTransitionSideEffects(client, tableName, action, updated);
      await this.recordMutation(client, tableName, action, updated, before);
      return updated;
    });
  }

  async recordMutation(client: Queryable, tableName: string, operation: string, current: Record<string, unknown>, before?: Record<string, unknown>): Promise<void> {
    const companyId = this.context.companyId;
    const companyCode = this.context.companyCode;
    const employeeId = this.context.employeeId ?? 0;
    if (employeeId < 1) throw new Error('Actor employee id is required for audit');
    await client.query(
      `INSERT INTO app.audit_log (employee_no,operation,permission_ref,sensitive_op,company_code,created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [employeeId, `${tableName}.${operation}`, `api:${tableName}`, operation === 'update' ? 'business_mutation' : null, companyCode, this.context.actorId],
    );
    if (before !== undefined) {
      await client.query(
        `INSERT INTO app.version_history (entity_ref,before_value,after_value,employee_no,time_reason,company_code,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [`${tableName}:${String(current.id)}`, JSON.stringify(before).slice(0, 2000), JSON.stringify(current).slice(0, 2000), employeeId, 'user_mutation', companyCode, this.context.actorId],
      );
    }
    await client.query(
      `INSERT INTO app.outbox_event (company_id,event_id,aggregate_type,aggregate_id,event_type,event_version,payload,headers,occurred_at,available_at,publish_attempts)
       VALUES ($1,$2,$3,$4,$5,1,$6::jsonb,$7::jsonb,now(),now(),0)`,
      [companyId, randomUUID(), tableName, String(current.id), `${tableName}.${operation}`, JSON.stringify(current), JSON.stringify({ actor: this.context.actorId, companyCode })],
    );
  }
}
