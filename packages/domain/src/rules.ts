import { AppError } from '../../shared/src/errors.js';

function fail(message: string): never {
  throw new AppError(400, 'VALIDATION_ERROR', message);
}

function scalar(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) return String(value);
  fail('字段必须为标量值');
}

function number(input: Record<string, unknown>, field: string): number {
  const value = Number(input[field]);
  if (!Number.isFinite(value)) fail(`${field}必须为有效数值`);
  return value;
}

function positive(input: Record<string, unknown>, ...fields: string[]): void {
  for (const field of fields) if (input[field] !== undefined && number(input, field) <= 0) fail(`${field}必须大于0`);
}

function nonNegative(input: Record<string, unknown>, ...fields: string[]): void {
  for (const field of fields) if (input[field] !== undefined && number(input, field) < 0) fail(`${field}不得为负数`);
}

function oneOf(input: Record<string, unknown>, field: string, values: string[]): void {
  if (input[field] !== undefined && !values.includes(scalar(input[field]))) fail(`${field}状态不在允许范围`);
}

/** 跨字段与状态规则；引用存在性和租户归属由 DomainService 在事务内再次检查。 */
export function validateBusinessRules(table: string, input: Record<string, unknown>): void {
  nonNegative(input, 'quantity', 'price', 'credit_amount', 'occupied_amount', 'receivable_balance', 'payable_balance', 'cash_amount', 'check_amount', 'bank_credit', 'writeoff', 'overpay_balance', 'salary', 'expense_account', 'gross_amount', 'withholding_tax_amount', 'net_disbursement_amount', 'inventory_quantity', 'threshold_value', 'work_hours');
  switch (table) {
    case 'company':
      oneOf(input, 'base_currency', ['PHP', 'USD']);
      oneOf(input, 'status', ['active', 'disabled']);
      break;
    case 'organization_unit':
      if (input.org_level !== undefined && (number(input, 'org_level') < 1 || number(input, 'org_level') > 10)) fail('组织层级必须为1至10');
      oneOf(input, 'status', ['active', 'disabled']);
      break;
    case 'position':
      nonNegative(input, 'headcount');
      oneOf(input, 'status', ['active', 'disabled']);
      break;
    case 'employee':
      nonNegative(input, 'account');
      oneOf(input, 'employment_status', ['probation', 'active', 'suspended', 'disabled', 'resigned']);
      break;
    case 'system_role':
      oneOf(input, 'role_status', ['active', 'disabled']);
      break;
    case 'data_permission':
      positive(input, 'role_id', 'employee_id', 'company_code', 'house_id', 'warehouse_id');
      oneOf(input, 'approval_status', ['pending', 'approved', 'rejected', 'expired']);
      break;
    case 'farm_batch':
      positive(input, 'initial_quantity');
      nonNegative(input, 'day_age');
      oneOf(input, 'stage', ['brooding', 'growing', 'pre_laying', 'laying', 'culling', 'closed']);
      break;
    case 'house_pen':
      positive(input, 'pen_count', 'floor_count');
      oneOf(input, 'farm_mode', ['cage', 'aviary', 'floor', 'brooding']);
      oneOf(input, 'house_status', ['active', 'cleaning', 'maintenance', 'closed']);
      break;
    case 'chick_receipt':
      positive(input, 'count_quantity', 'avg_weight');
      nonNegative(input, 'gifted_quantity');
      oneOf(input, 'qualified', ['qualified', 'quarantine', 'rejected']);
      break;
    case 'feeding_record':
      nonNegative(input, 'first_drink_feed', 'daily_feeding', 'quantity');
      break;
    case 'environment_record':
      if (input.temperature !== undefined && (number(input, 'temperature') < -10 || number(input, 'temperature') > 60)) fail('温度超出可记录范围');
      if (input.humidity !== undefined && (number(input, 'humidity') < 0 || number(input, 'humidity') > 100)) fail('湿度必须为0至100');
      nonNegative(input, 'ventilation', 'threshold');
      oneOf(input, 'shift', ['day', 'night', 'morning', 'evening']);
      break;
    case 'weighing_record':
      positive(input, 'sample_size', 'avg_weight');
      if (input.uniformity !== undefined && (number(input, 'uniformity') < 0 || number(input, 'uniformity') > 100)) fail('均匀度必须为0至100');
      break;
    case 'transfer_record':
      positive(input, 'headcount_check');
      if (input.from_house_id !== undefined && input.from_house_id === input.to_house_id) fail('转出与转入栋舍不得相同');
      break;
    case 'mortality_cull_record':
      positive(input, 'quantity', 'stock_update');
      if (input.quantity !== undefined && input.stock_update !== undefined && number(input, 'quantity') !== number(input, 'stock_update')) fail('死淘数量与存栏扣减数必须一致');
      break;
    case 'vaccination_program':
      oneOf(input, 'program_type', ['standard', 'emergency', 'custom']);
      break;
    case 'vaccination_task':
      nonNegative(input, 'day_age');
      break;
    case 'vaccination_execution':
      nonNegative(input, 'planned_day_age', 'actual_day_age', 'stock_quantity');
      positive(input, 'dosage');
      break;
    case 'vaccine_requisition':
      positive(input, 'requisition_quantity', 'stock_deduction');
      if (input.requisition_quantity !== undefined && input.stock_deduction !== undefined && number(input, 'requisition_quantity') !== number(input, 'stock_deduction')) fail('领用与库存扣减数量必须一致');
      break;
    case 'medication_prescription':
      positive(input, 'usage_dosage');
      nonNegative(input, 'exception_feedback');
      oneOf(input, 'approval_status', ['draft', 'pending', 'approved', 'rejected', 'executed']);
      if (input.executed === true && input.approval_status !== undefined && !['approved', 'executed'].includes(scalar(input.approval_status))) fail('处方批准后才能执行');
      break;
    case 'withdrawal_period_record':
      nonNegative(input, 'withdrawal_days');
      oneOf(input, 'release_status', ['blocked', 'released', 'expired']);
      break;
    case 'quarantine_certificate':
      oneOf(input, 'request_status', ['draft', 'requested', 'cancelled']);
      oneOf(input, 'issue_status', ['pending', 'issued', 'rejected']);
      break;
    case 'purchase_requisition':
      positive(input, 'quantity');
      oneOf(input, 'approval_status', ['draft', 'pending', 'approved', 'rejected', 'closed']);
      break;
    case 'purchase_order':
      positive(input, 'quantity');
      oneOf(input, 'execution_close', ['draft', 'approved', 'open', 'partial', 'closed', 'cancelled']);
      break;
    case 'supplier':
      oneOf(input, 'status', ['pending', 'active', 'suspended', 'disabled']);
      break;
    case 'goods_receipt':
      positive(input, 'quantity');
      oneOf(input, 'quality_status', ['pending', 'accepted', 'quarantine', 'rejected']);
      break;
    case 'material':
      oneOf(input, 'category', ['feed', 'medicine', 'vaccine', 'egg', 'package', 'spare', 'other']);
      break;
    case 'inventory_ledger':
      nonNegative(input, 'quantity');
      oneOf(input, 'inventory_status', ['available', 'reserved', 'quarantine', 'blocked', 'consumed']);
      break;
    case 'inbound_record':
      positive(input, 'purchase_arrival');
      nonNegative(input, 'egg_quantity');
      oneOf(input, 'inbound_type', ['purchase', 'egg', 'transfer', 'return', 'adjustment']);
      break;
    case 'outbound_record':
      oneOf(input, 'outbound_type', ['sales', 'requisition', 'transfer', 'return', 'task', 'adjustment']);
      break;
    case 'stocktake_record':
      nonNegative(input, 'book_quantity', 'actual_quantity');
      if (input.book_quantity !== undefined && input.actual_quantity !== undefined && input.difference !== undefined && number(input, 'difference') !== number(input, 'actual_quantity') - number(input, 'book_quantity')) fail('盘点差异必须等于实盘减账面');
      oneOf(input, 'approval_status', ['draft', 'pending', 'approved', 'rejected']);
      break;
    case 'batch_expiry':
      if (input.production_date !== undefined && input.expiry_date !== undefined && scalar(input.expiry_date) <= scalar(input.production_date)) fail('失效日期必须晚于生产日期');
      oneOf(input, 'batch_status', ['active', 'near_expiry', 'expired', 'blocked', 'consumed']);
      break;
    case 'safety_stock':
      oneOf(input, 'process_status', ['normal', 'pending', 'requested', 'resolved']);
      break;
    case 'customer':
      nonNegative(input, 'payment_term');
      oneOf(input, 'status', ['pending', 'active', 'suspended', 'disabled']);
      break;
    case 'price_list':
      positive(input, 'price');
      oneOf(input, 'price_type', ['standard', 'contract', 'special', 'promotion']);
      break;
    case 'sales_order':
      nonNegative(input, 'inventory_quantity');
      oneOf(input, 'order_mode', ['standard', 'contract', 'spot', 'pullets', 'culled_birds']);
      oneOf(input, 'status', ['draft', 'pending', 'approved', 'allocated', 'shipped', 'signed', 'closed', 'cancelled']);
      break;
    case 'credit_limit':
      if (input.credit_amount !== undefined && input.occupied_amount !== undefined && number(input, 'occupied_amount') > number(input, 'credit_amount') && input.over_limit_block === true) fail('信用占用已超过额度，必须阻断');
      oneOf(input, 'ceo_approval', ['not_required', 'pending', 'approved', 'rejected']);
      break;
    case 'payment_term_exception':
      nonNegative(input, 'payment_term', 'threshold_value');
      oneOf(input, 'approval_audit', ['pending', 'approved', 'rejected']);
      break;
    case 'delivery_receipt':
      if (input.customer_sign === false && input.has_exception === false) fail('未签收必须登记异常');
      oneOf(input, 'void_status', ['active', 'void']);
      break;
    case 'receivable':
      nonNegative(input, 'payment_term');
      break;
    case 'receipt_record': {
      nonNegative(input, 'overpay_balance');
      break;
    }
    case 'payment_record':
      oneOf(input, 'approval_status', ['draft', 'pending', 'approved', 'rejected']);
      oneOf(input, 'planned_payment_method', ['cash', 'check', 'bank_transfer']);
      oneOf(input, 'payment_execution_status', ['pending', 'approved', 'executing', 'paid', 'failed', 'cancelled']);
      break;
    case 'cash_checkbook':
      oneOf(input, 'payment_execution_status', ['pending', 'issued', 'cleared', 'void', 'cancelled']);
      break;
    case 'payable':
      nonNegative(input, 'payment_term');
      oneOf(input, 'voucher_status', ['not_created', 'draft', 'approved', 'paid']);
      break;
    case 'disbursement_voucher':
      oneOf(input, 'planned_payment_method', ['cash', 'check', 'bank_transfer']);
      oneOf(input, 'approval_status', ['draft', 'pending', 'approved', 'rejected', 'paid']);
      if (input.gross_amount !== undefined && input.withholding_tax_amount !== undefined && number(input, 'withholding_tax_amount') > number(input, 'gross_amount')) fail('预扣税不得大于价税合计');
      if (input.gross_amount !== undefined && input.withholding_tax_amount !== undefined && input.net_disbursement_amount !== undefined && Math.round((number(input, 'gross_amount') - number(input, 'withholding_tax_amount')) * 100) !== Math.round(number(input, 'net_disbursement_amount') * 100)) fail('实付金额必须等于价税合计减预扣税');
      break;
    case 'equipment_check':
      oneOf(input, 'result', ['passed', 'failed', 'blocked']);
      break;
    case 'maintenance_work_order':
      oneOf(input, 'acceptance_close', ['open', 'repairing', 'pending_acceptance', 'closed', 'cancelled']);
      break;
    case 'print_job':
      nonNegative(input, 'reprint_count');
      oneOf(input, 'queue_status', ['queued', 'printing', 'completed', 'failed', 'cancelled']);
      break;
    case 'notification':
      oneOf(input, 'read_status', ['unread', 'read']);
      break;
    case 'offline_sync_record':
      oneOf(input, 'sync_status', ['pending', 'syncing', 'synced', 'conflict', 'failed']);
      break;
    case 'task_status':
      if (input.progress_percent !== undefined && (number(input, 'progress_percent') < 0 || number(input, 'progress_percent') > 100)) fail('任务进度必须为0至100');
      oneOf(input, 'status', ['queued', 'running', 'retrying', 'completed', 'failed', 'cancelled']);
      break;
    default:
      break;
  }
}
