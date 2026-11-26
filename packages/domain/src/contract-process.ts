import type { Pool } from 'pg';
import { withTransaction, type ActorContext, type Queryable } from '../../database/src/client.js';
import { buildObjectScope, renderObjectScope } from '../../database/src/object-scope.js';
import { tableCatalogByName } from '../../database/src/generated/catalog.js';
import { AppError, validationError } from '../../shared/src/errors.js';
import { DomainService } from './service.js';
import { ProductionService } from './production.js';
import { ProcurementService } from './procurement.js';
import { SalesService } from './sales.js';
import { FlockCostService } from './flock-cost.js';
import { PrintService } from '../../integrations/src/print.js';
import { LocalAttachmentStore } from '../../integrations/src/attachments.js';
import { resolve } from 'node:path';
import type { PrinterAdapter } from '../../integrations/src/print.js';

type FieldType = 'string' | 'integer' | 'number' | 'date' | 'boolean' | 'json' | 'datetime';

type FieldDefinition = {
  type: FieldType;
  required: boolean;
  max?: number;
  values?: readonly string[];
  min?: number;
};

type ReferenceDefinition = {
  table: string;
  companyKind: 'code' | 'id' | 'none';
};

type ActionDefinition = {
  field: string;
  target: string;
  allowed: readonly string[];
};

type ProcessSpec = {
  requirementId: string;
  path: string;
  schema: 'app' | 'app_ops' | 'app_auth';
  table: string;
  companyKind: 'code' | 'id' | 'none';
  itemKey: string;
  itemType: 'integer' | 'string';
  fields: Record<string, FieldDefinition>;
  references?: Record<string, ReferenceDefinition>;
  fixedValues?: Record<string, unknown>;
  actions?: Record<string, ActionDefinition>;
  domainActions?: readonly string[];
  readOnly?: boolean;
  collectionAlreadyRegistered?: boolean;
  filterFields?: readonly string[];
  printTypes?: readonly string[];
};

export type ListQuery = {
  page?: string | undefined;
  pageSize?: string | undefined;
  filters?: Record<string, string | undefined>;
};

const s = (required: boolean, max = 255): FieldDefinition => ({ type: 'string', required, max });
const i = (required: boolean): FieldDefinition => ({ type: 'integer', required });
const n = (required: boolean): FieldDefinition => ({ type: 'number', required });
const d = (required: boolean): FieldDefinition => ({ type: 'date', required });
const b = (required = false): FieldDefinition => ({ type: 'boolean', required });
const j = (required: boolean): FieldDefinition => ({ type: 'json', required });
const e = (required: boolean, values: readonly string[]): FieldDefinition => ({ type: 'string', required, values });

const permissionStatuses = ['draft', 'pending', 'approved', 'rejected'] as const;

const dataPermissionFields: Record<string, FieldDefinition> = {
  role_id: i(true),
  employee_id: i(true),
  module: s(true, 500),
  house_id: i(false),
  warehouse_id: i(false),
  task_ref: s(false, 500),
  valid_until: d(false),
  approval_status: e(true, permissionStatuses),
  remark: s(false, 500),
};

const dataPermissionReferences = {
  role_id: { table: 'app.system_role', companyKind: 'none' },
  employee_id: { table: 'app.employee', companyKind: 'code' },
  house_id: { table: 'app.house_pen', companyKind: 'code' },
  warehouse_id: { table: 'app.warehouse_location', companyKind: 'code' },
} satisfies Record<string, ReferenceDefinition>;

const farmBatchFields: Record<string, FieldDefinition> = {
  batch_no: s(true, 32),
  breed: s(true, 100),
  source: s(true, 255),
  chick_date: d(true),
  initial_quantity: n(true),
  day_age: i(true),
  stage: s(true, 100),
  remark: s(false, 500),
};

const eggFields: Record<string, FieldDefinition> = {
  collection_no: s(true, 40),
  batch_id: i(true),
  house_id: i(true),
  material_id: i(true),
  warehouse_id: i(true),
  location_id: i(true),
  collection_date: d(true),
  shift: e(true, ['day', 'night', 'morning', 'evening']),
  good_eggs: n(true),
  broken_eggs: n(true),
  dirty_eggs: n(true),
  grade_detail: j(true),
  device_ref: s(false, 150),
};

const mortalityFields: Record<string, FieldDefinition> = {
  batch_id: i(true),
  mortality_reason: s(true, 255),
  quantity: n(true),
  cull_decision: s(false, 255),
  harmless_treatment: s(false, 255),
  stock_update: b(),
  remark: s(false, 500),
};

const vaccinationExceptionFields: Record<string, FieldDefinition> = {
  task_id: i(true),
  planned_day_age: i(true),
  actual_day_age: i(false),
  lot_no: s(true, 32),
  dosage: n(true),
  stock_quantity: n(true),
  has_exception: b(true),
  remark: s(false, 500),
};

const procurementReturnFields: Record<string, FieldDefinition> = {
  return_no: s(true, 40),
  goods_receipt_id: i(true),
  material_id: i(true),
  batch_no: s(true, 32),
  warehouse_id: i(true),
  location_id: i(true),
  quantity: n(true),
  unit_cost: n(true),
  reason: s(true, 500),
};

const emergencyFields: Record<string, FieldDefinition> = {
  requisition_no: s(true, 32),
  demand_source: s(true, 255),
  material_id: i(true),
  quantity: n(true),
  purpose: s(false, 255),
  approval_status: e(true, permissionStatuses),
  remark: s(false, 500),
};

const outboundFields: Record<string, FieldDefinition> = {
  outbound_no: s(true, 32),
  outbound_type: s(true, 32),
  sales_ref: i(false),
  requisition_ref: i(false),
  transfer_ref: i(false),
  return_ref: i(false),
  task_driven_ref: i(false),
  remark: s(false, 500),
};

const salesReturnFields: Record<string, FieldDefinition> = {
  return_no: s(true, 40),
  sales_order_id: i(true),
  original_reservation_id: i(true),
  quantity: n(true),
  credit_amount: n(true),
  reason: s(true, 500),
};

const livestockFields: Record<string, FieldDefinition> = {
  sale_no: s(true, 40),
  sales_order_id: i(true),
  sale_type: e(true, ['chick', 'cull']),
  flock_batch_id: i(true),
  customer_id: i(true),
  quantity: i(true),
  unit_price: n(true),
  unit_cost: n(true),
  total_amount: n(true),
  sale_date: d(true),
};

const deliveryFields: Record<string, FieldDefinition> = {
  task_no: s(true, 32),
  order_id: i(true),
  cargo: s(false, 500),
  vehicle_id: i(true),
  route_id: i(true),
  driver_no: i(true),
  courier_no: i(true),
  remark: s(false, 500),
};

const maintenanceFields: Record<string, FieldDefinition> = {
  equipment_id: i(true),
  fault: s(true, 500),
  repair: s(false, 500),
  spare_part_id: i(false),
  work_hours: n(false),
  acceptance_close: e(true, ['open', 'repairing', 'pending_acceptance', 'closed', 'cancelled']),
  remark: s(false, 500),
};

const designFields: Record<string, FieldDefinition> = {
  template_id: i(true),
  version: i(true),
  canvas_width_mm: n(true),
  canvas_height_mm: n(true),
  elements: j(true),
  status: e(true, ['draft', 'published', 'archived']),
  published_by: s(false, 32),
  published_at: d(false),
};

const printJobFields: Record<string, FieldDefinition> = {
  job_no: s(true, 32),
  template_id: i(true),
  pdf_ref: i(true),
  batch_print: b(),
  queue_status: e(true, ['pending', 'completed', 'failed', 'cancelled']),
  result: s(false, 500),
  printer_device_id: i(false),
  paper_size_code: s(false, 32),
  target_device_model: s(false, 64),
  reprint_count: i(false),
  remark: s(false, 500),
};

const printLogFields: Record<string, FieldDefinition> = {
  print_by: i(true),
  doc_ref: s(false, 500),
  reprint: b(),
  void_status: e(true, ['valid', 'void', 'reprint']),
  reason: s(false, 500),
  device_model: s(false, 64),
  paper_size_code: s(false, 32),
};

const reportFields: Record<string, FieldDefinition> = {
  report_no: s(true, 32),
  report_type: s(true, 32),
  export_ref: i(true),
  generation_condition: s(false, 500),
  remark: s(false, 500),
};

const traceFields: Record<string, FieldDefinition> = {
  batch_id: i(true),
  house_id: i(false),
  material_id: i(false),
  vaccination_id: i(false),
  doc_ref: s(false, 500),
  drill_through: s(false, 1000),
};

const readModelFields: Record<string, FieldDefinition> = {
  read_model_key: s(true, 200),
  source_event_version: i(true),
  source_updated_at: d(false),
  projection_payload: j(true),
};

const snapshotFields: Record<string, FieldDefinition> = {
  batch_id: i(true),
  accumulated_cost: n(true),
  remaining_flock: n(true),
  unit_cost: n(true),
};

const sessionFields: Record<string, FieldDefinition> = {
  session_id: s(true, 36),
  employee_id: i(true),
  access_expires_at: d(true),
  refresh_expires_at: d(true),
  refresh_hash: s(true, 64),
  previous_refresh_hash: s(false, 64),
  rotated_at: d(false),
  revoked_at: d(false),
};

export const contractProcessSpecs: readonly ProcessSpec[] = [
  {
    requirementId: 'SRS-FR-ORG-004', path: '/api/v1/org/position-role-mappings', schema: 'app', table: 'data_permission',
    companyKind: 'id', itemKey: 'id', itemType: 'integer', fields: dataPermissionFields, references: dataPermissionReferences,
    fixedValues: { module: 'position_role' }, actions: {
      submit: { field: 'approval_status', target: 'pending', allowed: ['draft', 'rejected'] },
      approve: { field: 'approval_status', target: 'approved', allowed: ['pending'] },
      reject: { field: 'approval_status', target: 'rejected', allowed: ['pending'] },
    },
  },
  {
    requirementId: 'SRS-FR-ORG-006', path: '/api/v1/org/role-delegations', schema: 'app', table: 'data_permission',
    companyKind: 'id', itemKey: 'id', itemType: 'integer', fields: dataPermissionFields, references: dataPermissionReferences,
    fixedValues: { module: 'role_delegation' }, actions: {
      submit: { field: 'approval_status', target: 'pending', allowed: ['draft', 'rejected'] },
      approve: { field: 'approval_status', target: 'approved', allowed: ['pending'] },
      revoke: { field: 'approval_status', target: 'rejected', allowed: ['pending', 'approved'] },
    },
  },
  {
    requirementId: 'SRS-FR-FARM-001', path: '/api/v1/farm/flock-projects', schema: 'app', table: 'farm_batch',
    companyKind: 'code', itemKey: 'id', itemType: 'integer', fields: farmBatchFields, domainActions: ['place', 'close'],
  },
  {
    requirementId: 'SRS-FR-FARM-011', path: '/api/v1/farm/egg-collection-grading', schema: 'app_ops', table: 'egg_collection',
    companyKind: 'code', itemKey: 'id', itemType: 'integer', fields: eggFields, collectionAlreadyRegistered: true,
    domainActions: ['regrade', 'attach_device'],
  },
  {
    requirementId: 'SRS-FR-FARM-012', path: '/api/v1/farm/culling-and-batch-closing', schema: 'app', table: 'mortality_cull_record',
    companyKind: 'code', itemKey: 'id', itemType: 'integer', fields: mortalityFields, domainActions: ['approve_cull', 'close_batch'],
  },
  {
    requirementId: 'SRS-FR-VET-008', path: '/api/v1/vet/missed-vaccination-adverse-reactions', schema: 'app', table: 'vaccination_execution',
    companyKind: 'code', itemKey: 'id', itemType: 'integer', fields: vaccinationExceptionFields,
    fixedValues: { has_exception: true }, domainActions: ['supplement', 'report_adverse', 'approve_exception'],
  },
  {
    requirementId: 'SRS-FR-PROC-005', path: '/api/v1/proc/purchase-returns', schema: 'app_ops', table: 'procurement_return',
    companyKind: 'id', itemKey: 'id', itemType: 'integer', fields: procurementReturnFields, domainActions: ['audit_note'],
  },
  {
    requirementId: 'SRS-FR-PROC-006', path: '/api/v1/proc/emergency-purchases', schema: 'app', table: 'purchase_requisition',
    companyKind: 'code', itemKey: 'id', itemType: 'integer', fields: emergencyFields,
    fixedValues: { demand_source: 'emergency', approval_status: 'pending' }, domainActions: ['submit', 'approve', 'reject', 'close'],
  },
  {
    requirementId: 'SRS-FR-SALES-005', path: '/api/v1/sales/sales-fulfilment', schema: 'app', table: 'outbound_record',
    companyKind: 'code', itemKey: 'id', itemType: 'integer', fields: outboundFields,
    fixedValues: { outbound_type: 'sales' }, domainActions: ['confirm_shipment', 'cancel_shipment'],
  },
  {
    requirementId: 'SRS-FR-SALES-006', path: '/api/v1/sales/sales-returns-order-changes', schema: 'app_ops', table: 'sales_return_execution',
    companyKind: 'id', itemKey: 'id', itemType: 'integer', fields: salesReturnFields, domainActions: ['audit_note'],
  },
  {
    requirementId: 'SRS-FR-SALES-007', path: '/api/v1/sales/pullets-and-culled-birds-sales', schema: 'app_ops', table: 'livestock_sale_execution',
    companyKind: 'code', itemKey: 'id', itemType: 'integer', fields: livestockFields, domainActions: ['audit_note'],
  },
  {
    requirementId: 'SRS-FR-LOG-003', path: '/api/v1/log/night-loading', schema: 'app', table: 'delivery_task',
    companyKind: 'code', itemKey: 'id', itemType: 'integer', fields: deliveryFields, domainActions: ['departed', 'arrived', 'signed', 'failed', 'cancelled'],
  },
  {
    requirementId: 'SRS-FR-LOG-006', path: '/api/v1/log/driver-tasks', schema: 'app', table: 'delivery_task',
    companyKind: 'code', itemKey: 'id', itemType: 'integer', fields: deliveryFields, domainActions: ['departed', 'arrived', 'signed', 'failed', 'cancelled'],
  },
  {
    requirementId: 'SRS-FR-FIN-006', path: '/api/v1/fin/batch-cost-cards', schema: 'app_ops', table: 'flock_cost_snapshot',
    companyKind: 'code', itemKey: 'batch_id', itemType: 'integer', fields: snapshotFields, readOnly: true,
  },
  {
    requirementId: 'SRS-FR-FIN-007', path: '/api/v1/fin/profit-and-batch-settlement', schema: 'app_ops', table: 'flock_cost_snapshot',
    companyKind: 'code', itemKey: 'batch_id', itemType: 'integer', fields: snapshotFields, domainActions: ['recalculate', 'settle'],
  },
  {
    requirementId: 'SRS-FR-FIN-008', path: '/api/v1/fin/financial-reconciliation-reports', schema: 'app_ops', table: 'account_balance_snapshot',
    companyKind: 'code', itemKey: 'id', itemType: 'integer',
    fields: { id: i(false), period_id: i(true), account_code: s(true, 32), debit: n(true), credit: n(true), balance: n(true) }, readOnly: true,
  },
  {
    requirementId: 'SRS-FR-EQP-004', path: '/api/v1/eqp/equipment-repairs', schema: 'app', table: 'maintenance_work_order',
    companyKind: 'code', itemKey: 'id', itemType: 'integer', fields: maintenanceFields,
    domainActions: ['start', 'request_acceptance', 'accept', 'cancel'],
  },
  {
    requirementId: 'SRS-FR-PRINT-001', path: '/api/v1/print/print-template-versions', schema: 'app_ops', table: 'print_template_design',
    companyKind: 'code', itemKey: 'id', itemType: 'integer', fields: designFields, domainActions: ['publish', 'archive'],
  },
  {
    requirementId: 'SRS-FR-PRINT-002', path: '/api/v1/print/delivery-note-printing', schema: 'app', table: 'print_job',
    companyKind: 'code', itemKey: 'id', itemType: 'integer', fields: printJobFields, printTypes: ['delivery', 'delivery_note'],
    domainActions: ['dispatch', 'cancel'],
  },
  {
    requirementId: 'SRS-FR-PRINT-003', path: '/api/v1/print/cash-check-printing', schema: 'app', table: 'print_job',
    companyKind: 'code', itemKey: 'id', itemType: 'integer', fields: printJobFields, printTypes: ['cash', 'check', 'cash_voucher', 'check_voucher'],
    domainActions: ['dispatch', 'cancel'],
  },
  {
    requirementId: 'SRS-FR-PRINT-004', path: '/api/v1/print/labels-business-document-printing', schema: 'app', table: 'print_job',
    companyKind: 'code', itemKey: 'id', itemType: 'integer', fields: printJobFields, printTypes: ['label', 'business', 'business_document'],
    domainActions: ['dispatch', 'cancel'],
  },
  {
    requirementId: 'SRS-FR-PRINT-005', path: '/api/v1/print/reprint-void-audit', schema: 'app', table: 'print_log',
    companyKind: 'code', itemKey: 'id', itemType: 'integer', fields: printLogFields, domainActions: ['void', 'reprint'],
  },
  {
    requirementId: 'SRS-FR-RPT-001', path: '/api/v1/rpt/management-dashboard', schema: 'app', table: 'rm_operational_dashboard',
    companyKind: 'id', itemKey: 'read_model_key', itemType: 'string', fields: readModelFields, readOnly: true,
  },
  {
    requirementId: 'SRS-FR-RPT-002', path: '/api/v1/rpt/production-reports', schema: 'app', table: 'rm_report_snapshot',
    companyKind: 'id', itemKey: 'read_model_key', itemType: 'string', fields: readModelFields, readOnly: true,
  },
  {
    requirementId: 'SRS-FR-RPT-003', path: '/api/v1/rpt/inventory-purchase-reports', schema: 'app', table: 'rm_report_snapshot',
    companyKind: 'id', itemKey: 'read_model_key', itemType: 'string', fields: readModelFields, readOnly: true,
  },
  {
    requirementId: 'SRS-FR-RPT-004', path: '/api/v1/rpt/sales-finance-reports', schema: 'app', table: 'rm_report_snapshot',
    companyKind: 'id', itemKey: 'read_model_key', itemType: 'string', fields: readModelFields, readOnly: true,
  },
  {
    requirementId: 'SRS-FR-RPT-005', path: '/api/v1/rpt/report-exports', schema: 'app', table: 'report_record',
    companyKind: 'code', itemKey: 'id', itemType: 'integer', fields: reportFields, domainActions: ['archive'],
  },
  {
    requirementId: 'SRS-FR-TRACE-001', path: '/api/v1/trace/batch-end-to-end-trace', schema: 'app', table: 'traceability_link',
    companyKind: 'code', itemKey: 'id', itemType: 'integer', fields: traceFields, readOnly: true,
  },
  {
    requirementId: 'SRS-FR-PLAT-001', path: '/api/v1/plat/authentication-sessions', schema: 'app_auth', table: 'session',
    companyKind: 'none', itemKey: 'session_id', itemType: 'string', fields: sessionFields, domainActions: ['revoke'],
  },
];

const specByPath = new Map(contractProcessSpecs.map((spec) => [spec.path, spec]));

export class ContractProcessService {
  private readonly domain: DomainService;
  private readonly production: ProductionService;
  private readonly procurement: ProcurementService;
  private readonly sales: SalesService;
  private readonly flockCost: FlockCostService;
  private readonly print: PrintService;

  constructor(
    private readonly pool: Pool,
    private readonly context: ActorContext,
    attachmentStore?: LocalAttachmentStore,
    printerAdapters?: Map<string, PrinterAdapter>,
    printFontPath?: string,
  ) {
    this.domain = new DomainService(pool, context);
    this.production = new ProductionService(pool, context);
    this.procurement = new ProcurementService(pool, context);
    this.sales = new SalesService(pool, context);
    this.flockCost = new FlockCostService(pool, context);
    this.print = new PrintService(
      pool,
      context,
      attachmentStore ?? new LocalAttachmentStore(resolve(process.cwd(), 'data', 'attachments')),
      printerAdapters ?? new Map<string, PrinterAdapter>(),
      printFontPath,
      3650,
    );
  }

  private objectScope(spec: ProcessSpec) {
    const catalogModel = tableCatalogByName.get(spec.table);
    const columnNames = new Set([
      ...(catalogModel?.columns.map((column) => column.name) ?? []),
      ...Object.keys(spec.fields),
    ]);
    return buildObjectScope(spec.table, columnNames, this.context);
  }

  async list(path: string, query: ListQuery): Promise<{ items: Record<string, unknown>[]; total: number; page: number; pageSize: number }> {
    const spec = requiredSpec(path);
    const page = Math.min(10000, Math.max(1, Number(query.page ?? 1)));
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize ?? 20)));
    return withTransaction(this.pool, this.context, async (client) => {
      const where: string[] = [];
      const values: unknown[] = [];
      if (spec.companyKind !== 'none') {
        values.push(this.companyValue(spec));
        where.push(`${this.companyColumn(spec)}=$${values.length}`);
      }
      for (const [key, raw] of Object.entries(query.filters ?? {})) {
        if (raw === undefined || !spec.filterFields?.includes(key) || !/^[A-Za-z0-9_]+$/.test(key)) continue;
        values.push(raw);
        where.push(`${key}=$${values.length}`);
      }
      const renderedScope = renderObjectScope(this.objectScope(spec), values.length + 1);
      if (renderedScope.sql !== '') {
        where.push(renderedScope.sql);
        values.push(...renderedScope.values);
      }
      const whereSql = where.length === 0 ? '' : ` WHERE ${where.join(' AND ')}`;
      const count = await client.query<{ count: number }>(`SELECT count(*)::int AS count FROM ${qualifiedTable(spec)}${whereSql}`, values);
      const offset = (page - 1) * pageSize;
      const rows = await client.query(
        `${this.selectSql(spec)}${whereSql} ORDER BY ${this.itemColumn(spec)} DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, pageSize, offset],
      );
      if (spec.readOnly) await this.auditView(client, spec, 'list');
      return { items: rows.rows, total: Number(count.rows[0]?.count ?? 0), page, pageSize };
    });
  }

  async get(path: string, id: string): Promise<Record<string, unknown>> {
    const spec = requiredSpec(path);
    return withTransaction(this.pool, this.context, async (client) => {
      const row = await this.findRow(client, spec, id);
      if (spec.readOnly) await this.auditView(client, spec, 'get');
      return row;
    });
  }

  async create(path: string, body: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const spec = requiredSpec(path);
    if (spec.readOnly) throw new AppError(403, 'FORBIDDEN', '只读报表不允许人工写入');
    const special = await this.specialCreate(spec, body, idempotencyKey);
    if (special !== undefined) return special;
    const normalized = this.normalizeFields(spec, body, true);
    return this.domain.idempotent(`contract:${spec.table}:create`, idempotencyKey, normalized, async (client) => {
      await this.assertReferences(client, spec, normalized);
      const row = await this.insertRow(client, spec, normalized);
      await this.domain.recordMutation(client, spec.table, 'contract_create', row);
      return row;
    });
  }

  async update(path: string, id: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const spec = requiredSpec(path);
    if (spec.readOnly) throw new AppError(403, 'FORBIDDEN', '只读报表不允许修改');
    const normalized = this.normalizeFields(spec, body, false);
    return withTransaction(this.pool, this.context, async (client) => {
      const before = await this.findRow(client, spec, id, true);
      await this.assertReferences(client, spec, normalized);
      const updated = await this.updateRow(client, spec, before, normalized);
      await this.domain.recordMutation(client, spec.table, 'contract_update', updated, before);
      return updated;
    });
  }

  async action(path: string, id: string, body: Record<string, unknown>, idempotencyKey?: string): Promise<unknown> {
    const spec = requiredSpec(path);
    const actionName = typeof body.action === 'string' ? body.action : '';
    if (!/^[a-z_]+$/.test(actionName)) throw validationError();
    const special = await this.specialAction(spec, actionName, id, body, idempotencyKey);
    if (special !== undefined) return special;
    const definition = spec.actions?.[actionName];
    if (!definition) throw validationError();
    return withTransaction(this.pool, this.context, async (client) => {
      const before = await this.findRow(client, spec, id, true);
      if (!definition.allowed.includes(String(before[definition.field]))) throw new AppError(409, 'CONFLICT', '当前状态不允许该动作');
      const updated = await this.updateRow(client, spec, before, { [definition.field]: definition.target });
      await this.domain.recordMutation(client, spec.table, actionName, updated, before);
      return updated;
    });
  }

  private async specialCreate(spec: ProcessSpec, body: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    if (spec.requirementId === 'SRS-FR-FARM-001') {
      return this.domain.create('farm_batch', body, idempotencyKey);
    }
    if (spec.requirementId === 'SRS-FR-FARM-012') {
      return this.domain.create('mortality_cull_record', body, idempotencyKey);
    }
    if (spec.requirementId === 'SRS-FR-PROC-005') {
      return this.procurement.returnReceipt(body, idempotencyKey);
    }
    if (spec.requirementId === 'SRS-FR-SALES-006') {
      return this.sales.createReturn(body, idempotencyKey);
    }
    if (spec.requirementId === 'SRS-FR-SALES-007') {
      return this.sales.createLivestockSale(body, idempotencyKey);
    }
    if (spec.requirementId === 'SRS-FR-LOG-003' || spec.requirementId === 'SRS-FR-LOG-006') {
      return this.sales.dispatchDeliveryTask(body, idempotencyKey);
    }
    if (spec.requirementId === 'SRS-FR-EQP-001') {
      return this.domain.create('maintenance_work_order', body, idempotencyKey);
    }
    if (spec.requirementId === 'SRS-FR-PRINT-001') {
      return this.print.saveDesign(String(body.template_id ?? body.templateId), body, idempotencyKey);
    }
    if (spec.printTypes) {
      const submitted = await this.print.submit(body, idempotencyKey);
      this.assertPrintType(spec, submitted);
      return submitted;
    }
    return undefined;
  }

  private async specialAction(
    spec: ProcessSpec,
    actionName: string,
    id: string,
    body: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<unknown> {
    if (spec.domainActions?.includes(actionName) !== true) return undefined;
    const key = idempotencyKey ?? `contract-action-${id}-${actionName}-${Date.now()}`;
    if (!/^[A-Za-z0-9._:-]{8,200}$/.test(key)) throw validationError();

    if (spec.requirementId === 'SRS-FR-FARM-001') {
      if (actionName === 'place') return this.production.placeFlock(id, body, key);
      if (actionName === 'close') return this.domain.update('farm_batch', id, { stage: 'closed' });
    }
    if (spec.requirementId === 'SRS-FR-FARM-011') {
      if (actionName === 'regrade') return this.update(spec.path, id, { grade_detail: body.grade_detail });
      if (actionName === 'attach_device') return this.update(spec.path, id, { device_ref: body.device_ref });
    }
    if (spec.requirementId === 'SRS-FR-FARM-012') {
      if (actionName === 'approve_cull') return this.domain.update('mortality_cull_record', id, { cull_decision: 'approved' });
      if (actionName === 'close_batch') return this.closeBatch(id);
    }
    if (spec.requirementId === 'SRS-FR-VET-008') {
      if (actionName === 'supplement') return this.domain.update('vaccination_execution', id, { actual_day_age: body.actual_day_age, has_exception: true });
      if (actionName === 'report_adverse') return this.domain.update('vaccination_execution', id, { has_exception: true, remark: body.remark });
      if (actionName === 'approve_exception') return this.domain.update('vaccination_execution', id, { remark: `approved:${safeText(body.remark)}`.slice(0, 500) });
    }
    if (spec.requirementId === 'SRS-FR-PROC-006') {
      return this.domain.transition('purchase_requisition', id, actionName);
    }
    if (spec.requirementId === 'SRS-FR-SALES-005') {
      return this.update(spec.path, id, { remark: `${actionName}:${safeText(body.reason)}`.slice(0, 500) });
    }
    if (spec.requirementId === 'SRS-FR-LOG-003' || spec.requirementId === 'SRS-FR-LOG-006') {
      return this.sales.addDeliveryEvent(id, body, key);
    }
    if (spec.requirementId === 'SRS-FR-FIN-007') {
      if (actionName === 'recalculate') return this.flockCost.get(id);
      if (actionName === 'settle') return this.settleBatch(id);
    }
    if (spec.requirementId === 'SRS-FR-EQP-004') {
      return this.domain.transition('maintenance_work_order', id, actionName);
    }
    if (spec.requirementId === 'SRS-FR-PRINT-001') {
      if (actionName === 'publish') return this.print.publishDesign(String(body.template_id ?? body.templateId), id);
      if (actionName === 'archive') return this.update(spec.path, id, { status: 'archived' });
    }
    if (spec.printTypes) {
      if (actionName === 'dispatch') return this.print.dispatch(id);
      if (actionName === 'cancel') return this.update(spec.path, id, { queue_status: 'cancelled' });
    }
    if (spec.requirementId === 'SRS-FR-PRINT-005') {
      return this.update(spec.path, id, actionName === 'void' ? { void_status: 'void', reason: body.reason } : { void_status: 'reprint', reprint: true });
    }
    if (spec.requirementId === 'SRS-FR-RPT-005') {
      return this.update(spec.path, id, { remark: `archived:${safeText(body.reason)}`.slice(0, 500) });
    }
    if (spec.requirementId === 'SRS-FR-PLAT-001') {
      return this.update(spec.path, id, { revoked_at: new Date().toISOString().slice(0, 10) });
    }
    return undefined;
  }

  private async closeBatch(id: string): Promise<unknown> {
    const mortality = await this.domain.get('mortality_cull_record', id);
    const batchId = String(mortality.batch_id);
    return this.settleBatch(batchId, true);
  }

  private async settleBatch(batchId: string, fromMortality = false): Promise<unknown> {
    return withTransaction(this.pool, this.context, async (client) => {
      const batch = await client.query('SELECT * FROM app.farm_batch WHERE id=$1 AND company_code=$2 FOR UPDATE', [batchId, this.context.companyCode]);
      if (batch.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '批次不存在');
      const positions = await client.query<{ remaining: string }>('SELECT COALESCE(sum(quantity),0)::text AS remaining FROM app_ops.flock_position WHERE batch_id=$1 AND company_code=$2', [batchId, this.context.companyId]);
      const remaining = Number(positions.rows[0]?.remaining ?? 0);
      if (!fromMortality && remaining !== 0) throw new AppError(409, 'CONFLICT', '存栏未清零，不能结项');
      const entries = await client.query<{ cost: string }>('SELECT COALESCE(sum(amount),0)::text AS cost FROM app_ops.flock_cost_entry WHERE batch_id=$1 AND company_code=$2', [batchId, this.context.companyCode]);
      const sales = await client.query<{ revenue: string }>('SELECT COALESCE(sum(total_amount),0)::text AS revenue FROM app_ops.livestock_sale_execution WHERE flock_batch_id=$1 AND company_code=$2', [batchId, this.context.companyCode]);
      const updated = await client.query<Record<string, unknown>>("UPDATE app.farm_batch SET stage='closed',updated_by=$3,updated_at=now() WHERE id=$1 RETURNING *", [batchId, this.context.actorId]);
      const result = {
        batch: updated.rows[0],
        cost: Number(entries.rows[0]?.cost ?? 0),
        revenue: Number(sales.rows[0]?.revenue ?? 0),
        profit: Number(sales.rows[0]?.revenue ?? 0) - Number(entries.rows[0]?.cost ?? 0),
      };
      await this.domain.recordMutation(client, 'farm_batch', 'settle', result.batch as Record<string, unknown>);
      return result;
    });
  }

  private assertPrintType(spec: ProcessSpec, submitted: unknown): void {
    const row = submitted as Record<string, unknown>;
    if (!spec.printTypes?.includes(safeText(row.template_type).toLowerCase())) {
      throw new AppError(409, 'CONFLICT', '打印模板类型与当前业务入口不匹配');
    }
  }

  private async findRow(client: Queryable, spec: ProcessSpec, id: string, lock = false): Promise<Record<string, unknown>> {
    const parsedId = spec.itemType === 'integer' ? parseId(id) : parseKey(id);
    const values: unknown[] = [parsedId];
    let scope = '';
    if (spec.companyKind !== 'none') {
      values.push(this.companyValue(spec));
      scope = ` AND ${this.companyColumn(spec)}=$2`;
    }
    const renderedScope = renderObjectScope(this.objectScope(spec), values.length + 1);
    const scopeSql = renderedScope.sql === '' ? '' : ` AND ${renderedScope.sql}`;
    values.push(...renderedScope.values);
    const result = await client.query(
      `${this.selectSql(spec)} WHERE ${this.itemColumn(spec)}=$1${scope}${scopeSql}${lock ? ' FOR UPDATE' : ''}`,
      values,
    );
    if (result.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '业务记录不存在');
    return result.rows[0] as Record<string, unknown>;
  }

  private async insertRow(client: Queryable, spec: ProcessSpec, values: Record<string, unknown>): Promise<Record<string, unknown>> {
    const data = { ...values };
    if (spec.companyKind !== 'none') data[this.companyColumn(spec)] = this.companyValue(spec);
    const keys = Object.keys(data);
    const columns = keys.map((key) => `"${key}"`).join(',');
    const params = keys.map((_, index) => `$${index + 1}`).join(',');
    const result = await client.query(
      `INSERT INTO ${qualifiedTable(spec)} (${columns}) VALUES (${params}) RETURNING *`,
      keys.map((key) => data[key]),
    );
    return result.rows[0] as Record<string, unknown>;
  }

  private async updateRow(
    client: Queryable,
    spec: ProcessSpec,
    before: Record<string, unknown>,
    changes: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const keys = Object.keys(changes);
    if (keys.length === 0) return before;
    const assignments = keys.map((key, index) => `"${key}"=$${index + 1}`).join(',');
    const changeValues = keys.map((key) => changes[key]);
    const idIndex = changeValues.length + 1;
    const whereValues: unknown[] = [];
    let scope = '';
    if (spec.companyKind !== 'none') {
      const companyPlaceholder = idIndex + 1 + whereValues.length;
      whereValues.push(this.companyValue(spec));
      scope = ` AND ${this.companyColumn(spec)}=$${companyPlaceholder}`;
    }
    const renderedScope = renderObjectScope(this.objectScope(spec), idIndex + 1 + whereValues.length);
    const scopeSql = renderedScope.sql === '' ? '' : ` AND ${renderedScope.sql}`;
    whereValues.push(...renderedScope.values);
    const result = await client.query(
      `UPDATE ${qualifiedTable(spec)} SET ${assignments}, updated_by=$${idIndex}, updated_at=now()
       WHERE ${this.itemColumn(spec)}=$${idIndex + 1}${scope}${scopeSql} RETURNING *`,
      [...changeValues, this.context.actorId, before[this.itemColumn(spec)], ...whereValues],
    );
    if (result.rowCount !== 1) throw new AppError(409, 'CONFLICT', '记录已被其他用户修改');
    return result.rows[0] as Record<string, unknown>;
  }

  private normalizeFields(spec: ProcessSpec, body: Record<string, unknown>, create: boolean): Record<string, unknown> {
    const allowed = Object.keys(spec.fields);
    const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
    if (unknown.length > 0) throw validationError();
    const output: Record<string, unknown> = {};
    for (const [key, definition] of Object.entries(spec.fields)) {
      const value = body[key] ?? (create ? spec.fixedValues?.[key] : undefined);
      if (value === undefined) {
        if (create && definition.required && spec.fixedValues?.[key] === undefined) throw validationError();
        continue;
      }
      output[key] = normalizeValue(definition, value);
    }
    if (create) {
      for (const [key, value] of Object.entries(spec.fixedValues ?? {})) {
        if (output[key] !== undefined && output[key] !== value) throw validationError();
        output[key] = value;
      }
    }
    return output;
  }

  private async assertReferences(client: Queryable, spec: ProcessSpec, values: Record<string, unknown>): Promise<void> {
    for (const [key, reference] of Object.entries(spec.references ?? {})) {
      if (values[key] === undefined) continue;
      const params: unknown[] = [values[key]];
      let scope = '';
      if (reference.companyKind === 'code') {
        params.push(this.context.companyCode);
        scope = ' AND company_code=$2';
      } else if (reference.companyKind === 'id') {
        params.push(this.context.companyId);
        scope = ' AND company_id=$2';
      }
      const result = await client.query(`SELECT 1 FROM ${reference.table} WHERE id=$1${scope}`, params);
      if (result.rowCount !== 1) throw new AppError(400, 'VALIDATION_ERROR', `引用记录不存在: ${key}`);
    }
  }

  private async auditView(client: Queryable, spec: ProcessSpec, operation: string): Promise<void> {
    await client.query(
      'INSERT INTO app.audit_log (employee_no,login_ref,operation,permission_ref,sensitive_op,company_code,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [this.context.employeeId, spec.path, `${spec.requirementId}.${operation}`, 'report:read', 'report_view', this.context.companyCode, this.context.actorId],
    );
  }

  private selectSql(spec: ProcessSpec): string {
    return `SELECT * FROM ${qualifiedTable(spec)}`;
  }

  private itemColumn(spec: ProcessSpec): string {
    assertIdentifier(spec.itemKey);
    return `"${spec.itemKey}"`;
  }

  private companyColumn(spec: ProcessSpec): string {
    if (spec.companyKind === 'code') return 'company_code';
    if (spec.companyKind === 'id') {
      const model = tableCatalogByName.get(spec.table);
      const columnNames = new Set(model?.columns.map((column) => column.name));
      if (columnNames.has('company_id')) return 'company_id';
      if (columnNames.has('company_code')) return 'company_code';
      if (!model) return 'company_id';
    }
    throw new AppError(500, 'INTERNAL_ERROR', '契约流程缺少公司隔离字段');
  }

  private companyValue(spec: ProcessSpec): number | string {
    if (spec.companyKind === 'none') throw new AppError(500, 'INTERNAL_ERROR', '当前流程没有公司隔离字段');
    if (this.context.companyId === undefined) throw new AppError(500, 'INTERNAL_ERROR', '公司数字标识未初始化');
    return spec.companyKind === 'id' ? this.context.companyId : this.context.companyCode;
  }
}

function requiredSpec(path: string): ProcessSpec {
  const spec = specByPath.get(path);
  if (!spec) throw new AppError(404, 'NOT_FOUND', '契约流程未配置');
  return spec;
}

function qualifiedTable(spec: ProcessSpec): string {
  const schema = spec.schema === 'app_auth' ? 'app_auth' : spec.schema === 'app_ops' ? 'app_ops' : 'app';
  assertIdentifier(spec.table);
  return `${schema}."${spec.table}"`;
}

function normalizeValue(definition: FieldDefinition, value: unknown): unknown {
  if (definition.type === 'boolean') {
    if (typeof value !== 'boolean') throw validationError();
    return value;
  }
  if (definition.type === 'json') {
    if (typeof value !== 'object' || value === null || JSON.stringify(value).includes('__proto__')) throw validationError();
    return value;
  }
  if (definition.type === 'integer') {
    if (!/^-?\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw validationError();
    return Number(value);
  }
  if (definition.type === 'number') {
    if (!/^-?\d+(\.\d+)?$/.test(String(value)) || !Number.isFinite(Number(value))) throw validationError();
    return Number(value);
  }
  if (typeof value !== 'string') throw validationError();
  if (definition.values && !definition.values.includes(value)) throw validationError();
  if (definition.max && value.length > definition.max) throw validationError();
  if (value.includes('\0')) throw validationError();
  if (definition.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw validationError();
  return value;
}

function parseId(value: string): number {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw validationError();
  return Number(value);
}

function parseKey(value: string): string {
  if (value.length < 1 || value.length > 200 || /[\0]/.test(value)) throw validationError();
  return value;
}

function assertIdentifier(value: string): void {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw validationError();
}

function safeText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}
