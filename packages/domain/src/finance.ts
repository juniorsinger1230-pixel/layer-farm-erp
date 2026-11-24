import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { withTransaction, type ActorContext, type Queryable } from '../../database/src/client.js';
import { AppError, validationError } from '../../shared/src/errors.js';
import { DomainService } from './service.js';
function id(value: unknown): number { if (!/^\d+$/.test(String(value)) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) throw validationError(); return Number(value); }
function cents(value: unknown, zero = true): number { if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+(\.\d{1,2})?$/.test(String(value))) throw validationError(); const n = Math.round(Number(value) * 100); if (n < 0 || (!zero && n === 0)) throw validationError(); return n; }
function date(value: unknown): string { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw validationError(); return value; }
function text(value: unknown, max: number): string { if (typeof value !== 'string' || value.length < 1 || value.length > max) throw validationError(); return value; }
type AccountKind = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'unclassified';
function accountKind(codeValue: string): AccountKind {
  const code = codeValue.toUpperCase();
  if (['CASH', 'AR', 'INV'].includes(code) || code.startsWith('ASSET') || code.startsWith('ACC')) return 'asset';
  if (['AP', 'VAT', 'WH'].includes(code) || code.startsWith('LIAB') || code.startsWith('PAY')) return 'liability';
  if (code.startsWith('EQUITY') || code.startsWith('CAP') || code.startsWith('RETAINED')) return 'equity';
  if (code.startsWith('REV') || code.startsWith('SALES') || code.startsWith('INCOME')) return 'revenue';
  if (code.startsWith('EXP') || code.startsWith('COGS') || code.startsWith('UTILITY') || code.startsWith('LABOR') || code.startsWith('FEED')) return 'expense';
  return 'unclassified';
}

export class FinanceService {
  private readonly domain: DomainService;
  constructor(private readonly pool: Pool, private readonly context: ActorContext) { this.domain = new DomainService(pool, context); }

  private async journal(client: Queryable, entryDate: string, sourceType: string, sourceId: string, lines: { account: string; debit?: number; credit?: number; description?: string | undefined }[]): Promise<void> {
    const debit = lines.reduce((sum, line) => sum + (line.debit ?? 0), 0);
    const credit = lines.reduce((sum, line) => sum + (line.credit ?? 0), 0);
    if (debit <= 0 || debit !== credit) throw new AppError(400, 'VALIDATION_ERROR', '会计分录借贷必须相等且大于零');
    const entry = await client.query<{ id: string }>("INSERT INTO app_ops.journal_entry (entry_no,company_code,entry_date,source_type,source_id,status,created_by) VALUES ($1,$2,$3,$4,$5,'posted',$6) RETURNING id", [`JE-${randomUUID()}`, this.context.companyCode, entryDate, sourceType, sourceId, this.context.actorId]);
    for (const [index, line] of lines.entries()) {
      if (!/^[A-Z0-9.-]{2,32}$/.test(line.account)) throw validationError();
      await client.query('INSERT INTO app_ops.journal_line (entry_id,company_code,line_no,account_code,debit,credit,description) VALUES ($1,$2,$3,$4,$5,$6,$7)', [entry.rows[0]!.id, this.context.companyCode, index + 1, line.account, ((line.debit ?? 0) / 100).toFixed(2), ((line.credit ?? 0) / 100).toFixed(2), line.description ?? null]);
    }
  }

  async postJournal(input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const entryDate = date(input.entryDate);
    if (!Array.isArray(input.lines) || input.lines.length < 2 || input.lines.length > 200) throw validationError();
    const lines = (input.lines as Record<string, unknown>[]).map((line) => ({ account: text(line.accountCode, 32), debit: cents(line.debit ?? 0), credit: cents(line.credit ?? 0), ...(typeof line.description === 'string' ? { description: line.description.slice(0, 500) } : {}) }));
    if (lines.filter((line) => (line.debit > 0) === (line.credit > 0)).length > 0) throw validationError();
    return this.domain.idempotent('finance:journal', idempotencyKey, { entryDate, lines }, async (client) => {
      await this.assertPeriodOpen(client, entryDate);
      const sourceId = randomUUID();
      await this.journal(client, entryDate, 'manual', sourceId, lines);
      const entry = await client.query('SELECT * FROM app_ops.journal_entry WHERE source_id=$1 AND company_code=$2', [sourceId, this.context.companyCode]);
      await this.domain.recordMutation(client, 'journal_entry', 'post', entry.rows[0] as Record<string, unknown>);
      return entry.rows[0];
    });
  }

  async receivePayment(input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const receivableId = id(input.receivableId);
    const cash = cents(input.cashAmount ?? 0);
    const check = cents(input.checkAmount ?? 0);
    const bank = cents(input.bankCredit ?? 0);
    const writeoff = cents(input.writeoff ?? 0);
    const method = text(input.receiptMethod, 32);
    if (cash + check + bank + writeoff === 0) throw validationError();
    return this.domain.idempotent('finance:receipt', idempotencyKey, input, async (client) => {
      await this.assertPeriodOpen(client, new Date().toISOString().slice(0, 10));
      const receivable = await client.query('SELECT r.*,so.customer_id FROM app.receivable r JOIN app.sales_order so ON so.id=r.order_id AND so.company_code=r.company_code WHERE r.id=$1 AND r.company_code=$2 FOR UPDATE OF r', [receivableId, this.context.companyCode]);
      if (receivable.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '应收记录不存在');
      const balance = cents(receivable.rows[0]!.receivable_balance);
      const paid = cash + check + bank;
      const total = paid + writeoff;
      if (writeoff > balance || total === 0) throw new AppError(409, 'CONFLICT', '核销金额超过应收余额');
      const overpay = Math.max(0, paid - balance);
      const applied = Math.min(balance, total);
      const inserted = await client.query<Record<string, unknown>>(
        `INSERT INTO app.receipt_record (receivable_id,receipt_method,cash_amount,check_amount,bank_credit,writeoff,overpay_balance,company_code,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [receivableId, method, (cash / 100).toFixed(2), (check / 100).toFixed(2), (bank / 100).toFixed(2), (writeoff / 100).toFixed(2), (overpay / 100).toFixed(2), this.context.companyCode, this.context.actorId],
      );
      await client.query('UPDATE app.receivable SET receivable_balance=$2,overdue=false,updated_by=$3,updated_at=now() WHERE id=$1', [receivableId, ((balance - applied) / 100).toFixed(2), this.context.actorId]);
      await client.query('UPDATE app.credit_limit SET occupied_amount=GREATEST(0,occupied_amount-$2),updated_by=$3,updated_at=now() WHERE customer_id=$1 AND company_code=$4', [Number(receivable.rows[0]!.customer_id), (applied / 100).toFixed(2), this.context.actorId, this.context.companyCode]);
      if (paid > 0) await this.journal(client, new Date().toISOString().slice(0, 10), 'receipt', String(inserted.rows[0]!.id), [{ account: 'CASH', debit: paid }, { account: 'AR', credit: paid }]);
      await this.domain.recordMutation(client, 'receipt_record', 'settle', inserted.rows[0] as Record<string, unknown>);
      return inserted.rows[0];
    });
  }

  async executePayment(input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const voucherId = id(input.voucherId);
    const cashierId = id(input.cashierId);
    const checkAmount = cents(input.checkAmount ?? 0);
    const writeoff = cents(input.writeoff ?? 0);
    const method = text(input.plannedPaymentMethod, 32);
    return this.domain.idempotent('finance:payment', idempotencyKey, input, async (client) => {
      await this.assertPeriodOpen(client, new Date().toISOString().slice(0, 10));
      const voucher = await client.query('SELECT * FROM app.disbursement_voucher WHERE id=$1 AND company_code=$2 FOR UPDATE', [voucherId, this.context.companyCode]);
      if (voucher.rowCount !== 1 || voucher.rows[0]!.approval_status !== 'approved') throw new AppError(409, 'CONFLICT', '仅已批准支出凭证可执行付款');
      const payableId = Number(voucher.rows[0]!.payable_id);
      const payable = await client.query('SELECT * FROM app.payable WHERE id=$1 AND company_code=$2 FOR UPDATE', [payableId, this.context.companyCode]);
      if (payable.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '应付记录不存在');
      if (voucher.rows[0]!.planned_payment_method !== method) throw new AppError(400, 'VALIDATION_ERROR', '付款方式必须与已批准凭证一致');
      const balance = cents(payable.rows[0]!.payable_balance);
      if (checkAmount + writeoff <= 0 || checkAmount + writeoff > balance || checkAmount > cents(voucher.rows[0]!.net_disbursement_amount)) throw new AppError(409, 'CONFLICT', '付款金额超过应付余额或批准金额');
      const payment = await client.query<Record<string, unknown>>(
        `INSERT INTO app.payment_record (payment_request,check_amount,bank_ref,approval_status,writeoff,company_code,created_by,voucher_id,planned_payment_method,payment_execution_status,cashier_id,bank_transfer_ref,executed_at)
         VALUES ($1,$2,$3,'approved',$4,$5,$6,$7,$8,'COMPLETED',$9,$10,now()) RETURNING *`,
        [typeof input.paymentRequest === 'string' ? input.paymentRequest : `VOUCHER-${voucherId}`, (checkAmount / 100).toFixed(2), typeof input.bankRef === 'string' ? input.bankRef : null, (writeoff / 100).toFixed(2), this.context.companyCode, this.context.actorId, voucherId, method, cashierId, typeof input.bankTransferRef === 'string' ? input.bankTransferRef : null],
      );
      await client.query('INSERT INTO app_ops.payment_allocation (company_code,payment_id,payable_id,amount) VALUES ($1,$2,$3,$4)', [this.context.companyCode, payment.rows[0]!.id, payableId, ((checkAmount + writeoff) / 100).toFixed(2)]);
      await client.query('UPDATE app.payable SET payable_balance=$2,voucher_status=$3,updated_by=$4,updated_at=now() WHERE id=$1', [payableId, ((balance - checkAmount - writeoff) / 100).toFixed(2), balance - checkAmount - writeoff === 0 ? 'paid' : 'partial', this.context.actorId]);
      if (checkAmount > 0) await this.journal(client, new Date().toISOString().slice(0, 10), 'payment', String(payment.rows[0]!.id), [{ account: 'AP', debit: checkAmount }, { account: 'CASH', credit: checkAmount }]);
      await this.domain.recordMutation(client, 'payment_record', 'execute', payment.rows[0] as Record<string, unknown>);
      return payment.rows[0];
    });
  }

  async setTaxRate(input: Record<string, unknown>): Promise<unknown> {
    const taxCode = text(input.taxCode, 32); const effectiveFrom = date(input.effectiveFrom);
    const rate = Number(input.rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw validationError();
    return withTransaction(this.pool, this.context, async (client) => {
      const result = await client.query<Record<string, unknown>>('INSERT INTO app_ops.tax_rate (company_code,tax_code,rate,effective_from,effective_to,created_by) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (company_code,tax_code,effective_from) DO UPDATE SET rate=EXCLUDED.rate,effective_to=EXCLUDED.effective_to RETURNING *', [this.context.companyCode, taxCode, rate, effectiveFrom, input.effectiveTo === undefined ? null : date(input.effectiveTo), this.context.actorId]);
      return result.rows[0];
    });
  }

  async registerTax(input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const transactionDate = date(input.transactionDate);
    const direction = text(input.direction, 16);
    const taxCode = text(input.taxCode, 32);
    const birForm = text(input.birForm, 16);
    if (!['output','input','withholding'].includes(direction) || !['2550Q','2550M','1601EQ','2307'].includes(birForm)) throw validationError();
    const net = cents(input.netAmount, false);
    return this.domain.idempotent('finance:tax', idempotencyKey, input, async (client) => {
      await this.assertPeriodOpen(client, transactionDate);
      const rate = await client.query('SELECT rate FROM app_ops.tax_rate WHERE company_code=$1 AND tax_code=$2 AND effective_from<=$3 AND (effective_to IS NULL OR effective_to>=$3) ORDER BY effective_from DESC LIMIT 1', [this.context.companyCode, taxCode, transactionDate]);
      if (rate.rowCount !== 1) throw new AppError(409, 'CONFLICT', '交易日期没有有效税率配置');
      const tax = Math.round(net * Number(rate.rows[0]!.rate));
      const inserted = await client.query<Record<string, unknown>>(
        `INSERT INTO app_ops.tax_transaction (company_code,transaction_date,direction,source_type,source_id,tax_code,net_amount,tax_amount,gross_amount,bir_form,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [this.context.companyCode, transactionDate, direction, text(input.sourceType, 64), text(input.sourceId, 100), taxCode, (net / 100).toFixed(2), (tax / 100).toFixed(2), ((net + tax) / 100).toFixed(2), birForm, this.context.actorId],
      );
      await this.domain.recordMutation(client, 'tax_transaction', 'register', inserted.rows[0] as Record<string, unknown>);
      return inserted.rows[0];
    });
  }

  async salesProfit(orderIdValue: unknown): Promise<unknown> {
    const salesOrderId = id(orderIdValue);
    return withTransaction(this.pool, this.context, async (client) => {
      const order = await client.query<{ order_no: string; status: string }>('SELECT order_no,status FROM app.sales_order WHERE id=$1 AND company_code=$2', [salesOrderId, this.context.companyCode]);
      if (order.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '销售订单不存在');
      const [standard, livestock, issues, returns, returnCost] = await Promise.all([
        client.query<{ revenue: string }>('SELECT COALESCE(sum(line_amount),0)::text AS revenue FROM app_ops.sales_order_line WHERE company_id=$1 AND sales_order_id=$2', [this.context.companyId, salesOrderId]),
        client.query<Record<string, unknown>>('SELECT * FROM app_ops.livestock_sale_execution WHERE company_code=$1 AND sales_order_id=$2', [this.context.companyCode, salesOrderId]),
        client.query<{ batch_no: string; material_id: string; quantity: string; cost: string }>("SELECT batch_no,material_id,(-sum(quantity))::text AS quantity,(-sum(quantity*unit_cost))::text AS cost FROM app_ops.inventory_movement WHERE company_id=$1 AND source_type='sales_order' AND source_id=$2 AND movement_type='sales_issue' GROUP BY batch_no,material_id ORDER BY batch_no,material_id", [this.context.companyId, String(salesOrderId)]),
        client.query<{ credit: string }>('SELECT COALESCE(sum(credit_amount),0)::text AS credit FROM app_ops.sales_return_execution WHERE company_id=$1 AND sales_order_id=$2', [this.context.companyId, salesOrderId]),
        client.query<{ cost: string }>("SELECT COALESCE(sum(m.quantity*m.unit_cost),0)::text AS cost FROM app_ops.inventory_movement m JOIN app_ops.sales_return_execution r ON r.company_id=m.company_id AND r.return_no=m.source_id AND r.sales_order_id=$2 WHERE m.company_id=$1 AND m.source_type='sales_return' AND m.movement_type='receipt'", [this.context.companyId, salesOrderId]),
      ]);
      const livestockRow = livestock.rows[0];
      const livestockRevenue = Number(livestockRow?.total_amount ?? 0);
      const livestockCost = livestockRow === undefined ? 0 : Number(livestockRow.quantity) * Number(livestockRow.unit_cost);
      const grossRevenue = Number(standard.rows[0]?.revenue ?? 0) + livestockRevenue;
      const credits = Number(returns.rows[0]?.credit ?? 0);
      const issueCost = issues.rows.reduce((sum, row) => sum + Number(row.cost), 0);
      const cogs = issueCost + livestockCost - Number(returnCost.rows[0]?.cost ?? 0);
      const netRevenue = grossRevenue - credits;
      const grossProfit = netRevenue - cogs;
      const batches: Record<string, unknown>[] = issues.rows.map((row) => ({ source: 'inventory', materialId: Number(row.material_id), batchNo: row.batch_no, quantity: row.quantity, cost: Number(row.cost).toFixed(2) }));
      if (livestockRow !== undefined) batches.push({ source: livestockRow.sale_type, flockBatchId: Number(livestockRow.flock_batch_id), quantity: Number(livestockRow.quantity), cost: livestockCost.toFixed(2) });
      return {
        salesOrderId, orderNo: order.rows[0]!.order_no, status: order.rows[0]!.status, currency: 'PHP', batches,
        grossRevenue: grossRevenue.toFixed(2), returnCredits: credits.toFixed(2), netRevenue: netRevenue.toFixed(2),
        cogs: cogs.toFixed(2), grossProfit: grossProfit.toFixed(2), marginRate: netRevenue === 0 ? null : (grossProfit / netRevenue).toFixed(6),
      };
    });
  }

  async salesProfitCsv(orderIdValue: unknown, localeValue: unknown): Promise<string> {
    if (localeValue !== 'zh-CN' && localeValue !== 'en-US') throw validationError();
    const report = await this.salesProfit(orderIdValue) as {
      orderNo: string; currency: string; grossRevenue: string; returnCredits: string; netRevenue: string; cogs: string; grossProfit: string; marginRate: string | null;
      batches: { source: string; materialId?: number; flockBatchId?: number; batchNo?: string; quantity: string | number; cost: string }[];
    };
    const zh = localeValue === 'zh-CN';
    const cell = (value: unknown): string => {
      let text = value === null || value === undefined ? '' : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : JSON.stringify(value) ?? '';
      if (/^[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const lines: unknown[][] = [
      [zh ? '销售批次毛利表' : 'Sales Batch Profitability', report.orderNo],
      [zh ? '来源' : 'Source', zh ? '物料/鸡群批次' : 'Material/Flock Batch', zh ? '库存批次' : 'Inventory Batch', zh ? '数量' : 'Quantity', zh ? '成本(PHP)' : 'Cost (PHP)'],
      ...report.batches.map((batch) => [batch.source, batch.materialId ?? batch.flockBatchId ?? '', batch.batchNo ?? '', batch.quantity, batch.cost]),
      [],
      [zh ? '销售收入' : 'Gross revenue', report.grossRevenue],
      [zh ? '退货冲减' : 'Return credits', report.returnCredits],
      [zh ? '净收入' : 'Net revenue', report.netRevenue],
      [zh ? '销售成本' : 'COGS', report.cogs],
      [zh ? '毛利' : 'Gross profit', report.grossProfit],
      [zh ? '毛利率' : 'Margin rate', report.marginRate ?? ''],
    ];
    return `\uFEFF${lines.map((line) => line.map(cell).join(',')).join('\r\n')}\r\n`;
  }

  async dashboard(fromValue: unknown, toValue: unknown): Promise<unknown> {
    const from = date(fromValue);
    const to = date(toValue);
    if (from > to) throw validationError();
    return withTransaction(this.pool, this.context, async (client) => {
      const [ar, ap, inventory, sales, cogs, journal] = await Promise.all([
        client.query<{ value: string }>('SELECT COALESCE(sum(receivable_balance),0)::text AS value FROM app.receivable WHERE company_code=$1', [this.context.companyCode]),
        client.query<{ value: string }>('SELECT COALESCE(sum(payable_balance),0)::text AS value FROM app.payable WHERE company_code=$1', [this.context.companyCode]),
        client.query<{ value: string }>('SELECT COALESCE(sum(quantity*unit_cost),0)::text AS value FROM app_ops.inventory_valuation WHERE company_id=$1', [this.context.companyId]),
        client.query<{ value: string }>("SELECT COALESCE(sum(sol.line_amount),0)::text AS value FROM app_ops.sales_order_line sol JOIN app.sales_order so ON so.id=sol.sales_order_id AND so.company_code=$2 WHERE sol.company_id=$1 AND so.status IN ('shipped','returned_partial') AND so.updated_at::date BETWEEN $3 AND $4", [this.context.companyId, this.context.companyCode, from, to]),
        client.query<{ value: string }>("SELECT COALESCE(sum(-quantity*unit_cost),0)::text AS value FROM app_ops.inventory_movement WHERE company_id=$1 AND movement_type='sales_issue' AND occurred_at::date BETWEEN $2 AND $3", [this.context.companyId, from, to]),
        client.query<Record<string, unknown>>("SELECT account_code,sum(debit)::text AS debit,sum(credit)::text AS credit FROM app_ops.journal_line jl JOIN app_ops.journal_entry je ON je.id=jl.entry_id WHERE jl.company_code=$1 AND je.entry_date BETWEEN $2 AND $3 AND je.status='posted' GROUP BY account_code ORDER BY account_code", [this.context.companyCode, from, to]),
      ]);
      const revenue = Number(sales.rows[0]?.value ?? 0);
      const cost = Number(cogs.rows[0]?.value ?? 0);
      return { period: { from, to }, receivable: ar.rows[0]?.value, payable: ap.rows[0]?.value, inventoryValue: inventory.rows[0]?.value, revenue: revenue.toFixed(2), cogs: cost.toFixed(2), grossProfit: (revenue - cost).toFixed(2), ledger: journal.rows };
    });
  }

  async taxReport(fromValue: unknown, toValue: unknown, birFormValue: unknown): Promise<unknown> {
    const from = date(fromValue); const to = date(toValue); const birForm = text(birFormValue, 16);
    return withTransaction(this.pool, this.context, async (client) => {
      const rows = await client.query<{ net_amount: string; tax_amount: string }>('SELECT direction,tax_code,sum(net_amount)::text AS net_amount,sum(tax_amount)::text AS tax_amount,sum(gross_amount)::text AS gross_amount,count(*)::int AS transactions FROM app_ops.tax_transaction WHERE company_code=$1 AND bir_form=$2 AND transaction_date BETWEEN $3 AND $4 GROUP BY direction,tax_code ORDER BY direction,tax_code', [this.context.companyCode, birForm, from, to]);
      return { birForm, period: { from, to }, currency: 'PHP', lines: rows.rows, totals: { net: rows.rows.reduce((sum, row) => sum + Number(row.net_amount), 0).toFixed(2), tax: rows.rows.reduce((sum, row) => sum + Number(row.tax_amount), 0).toFixed(2) } };
    });
  }

  private async assertPeriodOpen(client: Queryable, entryDate: string): Promise<void> {
    const period = await client.query('SELECT status FROM app_ops.accounting_period WHERE company_code=$1 AND period_start <= $2 AND period_end >= $2 FOR UPDATE', [this.context.companyCode, entryDate]);
    if (period.rowCount === 1 && period.rows[0]!.status === 'closed') throw new AppError(409, 'CONFLICT', '会计期间已关闭，禁止记账');
  }

  private toCsv(lines: unknown[][]): string {
    const cell = (value: unknown): string => {
      let valueText: string;
      if (value === null || value === undefined) valueText = '';
      else if (typeof value === 'object') valueText = JSON.stringify(value);
      else if (typeof value === 'string') valueText = value;
      else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') valueText = value.toString();
      else if (typeof value === 'symbol') valueText = value.description ?? '';
      else valueText = '';
      if (/^[=+\-@]/.test(valueText)) valueText = `'${valueText}`;
      return `"${valueText.replaceAll('"', '""')}"`;
    };
    return `\uFEFF${lines.map((line) => line.map(cell).join(',')).join('\r\n')}\r\n`;
  }

  async listPeriods(statusValue?: unknown): Promise<unknown> {
    const status = statusValue === undefined ? undefined : text(statusValue, 16);
    if (status !== undefined && !['open', 'closing', 'closed'].includes(status)) throw validationError();
    return withTransaction(this.pool, this.context, async (client) => {
      const rows = status === undefined
        ? await client.query('SELECT * FROM app_ops.accounting_period WHERE company_code=$1 ORDER BY period_start DESC', [this.context.companyCode])
        : await client.query('SELECT * FROM app_ops.accounting_period WHERE company_code=$1 AND status=$2 ORDER BY period_start DESC', [this.context.companyCode, status]);
      return rows.rows as unknown[];
    });
  }

  async openPeriod(input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const periodCode = text(input.periodCode, 16);
    const periodStart = date(input.periodStart);
    const periodEnd = date(input.periodEnd);
    if (!/^[0-9]{4}-[A-Z0-9]{1,8}$/.test(periodCode) || periodStart > periodEnd) throw validationError();
    return this.domain.idempotent('finance:period-open', idempotencyKey, input, async (client) => {
      const existing = await client.query('SELECT * FROM app_ops.accounting_period WHERE company_code=$1 AND period_code=$2 FOR UPDATE', [this.context.companyCode, periodCode]);
      if (existing.rowCount === 1) return existing.rows[0];
      const inserted = await client.query<Record<string, unknown>>(
        'INSERT INTO app_ops.accounting_period (company_code,period_code,period_start,period_end,status,note,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [this.context.companyCode, periodCode, periodStart, periodEnd, 'open', typeof input.note === 'string' ? input.note.slice(0, 500) : null, this.context.actorId],
      );
      await this.domain.recordMutation(client, 'accounting_period', 'open', inserted.rows[0]!);
      return inserted.rows[0];
    });
  }

  async closePeriod(periodIdValue: unknown, input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const periodId = id(periodIdValue);
    return this.domain.idempotent('finance:period-close', idempotencyKey, { periodId, input }, async (client) => {
      const period = await client.query<Record<string, unknown>>('SELECT * FROM app_ops.accounting_period WHERE id=$1 AND company_code=$2 FOR UPDATE', [periodId, this.context.companyCode]);
      if (period.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '会计期间不存在');
      if (period.rows[0]!.status !== 'open') throw new AppError(409, 'CONFLICT', '仅开放状态期间可以关闭');
      await client.query('UPDATE app_ops.accounting_period SET status=$2,updated_at=now() WHERE id=$1', [periodId, 'closing']);
      await client.query('DELETE FROM app_ops.account_balance_snapshot WHERE period_id=$1', [periodId]);
      const balances = await client.query<Record<string, unknown>>(
        `SELECT jl.account_code,sum(jl.debit)::text AS debit,sum(jl.credit)::text AS credit
         FROM app_ops.journal_line jl JOIN app_ops.journal_entry je ON je.id=jl.entry_id
         WHERE jl.company_code=$1 AND je.status='posted' AND je.entry_date BETWEEN $2 AND $3
         GROUP BY jl.account_code ORDER BY jl.account_code`,
        [this.context.companyCode, period.rows[0]!.period_start, period.rows[0]!.period_end],
      );
      for (const row of balances.rows) {
        const debit = Number(row.debit);
        const credit = Number(row.credit);
        await client.query(
          'INSERT INTO app_ops.account_balance_snapshot (period_id,company_code,account_code,debit,credit,balance) VALUES ($1,$2,$3,$4,$5,$6)',
          [periodId, this.context.companyCode, row.account_code, row.debit, row.credit, (debit - credit).toFixed(2)],
        );
      }
      const updated = await client.query<Record<string, unknown>>(
        'UPDATE app_ops.accounting_period SET status=$2,closed_by=$3,closed_at=now(),note=$4,updated_at=now() WHERE id=$1 RETURNING *',
        [periodId, 'closed', this.context.actorId, typeof input.note === 'string' ? input.note.slice(0, 500) : period.rows[0]!.note],
      );
      const snapshots = await client.query('SELECT * FROM app_ops.account_balance_snapshot WHERE period_id=$1 ORDER BY account_code', [periodId]);
      await this.domain.recordMutation(client, 'accounting_period', 'close', updated.rows[0]!, period.rows[0]);
      return { period: updated.rows[0], snapshots: snapshots.rows };
    });
  }

  async reopenPeriod(periodIdValue: unknown, input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const periodId = id(periodIdValue);
    return this.domain.idempotent('finance:period-reopen', idempotencyKey, { periodId, input }, async (client) => {
      const before = await client.query<Record<string, unknown>>('SELECT * FROM app_ops.accounting_period WHERE id=$1 AND company_code=$2 FOR UPDATE', [periodId, this.context.companyCode]);
      if (before.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '会计期间不存在');
      if (before.rows[0]!.status !== 'closed') throw new AppError(409, 'CONFLICT', '仅已关闭期间可以重新开放');
      await client.query('DELETE FROM app_ops.account_balance_snapshot WHERE period_id=$1', [periodId]);
      const updated = await client.query<Record<string, unknown>>(
        'UPDATE app_ops.accounting_period SET status=$2,closed_by=NULL,closed_at=NULL,note=$3,updated_at=now() WHERE id=$1 RETURNING *',
        [periodId, 'open', typeof input.note === 'string' ? input.note.slice(0, 500) : before.rows[0]!.note],
      );
      await this.domain.recordMutation(client, 'accounting_period', 'reopen', updated.rows[0]!, before.rows[0]);
      return updated.rows[0];
    });
  }

  async arAging(asOfValue: unknown): Promise<unknown> {
    const asOf = date(asOfValue);
    return withTransaction(this.pool, this.context, async (client) => {
      const rows = await client.query<Record<string, unknown>>(
        `SELECT r.id,so.order_no,c.customer_name,r.receivable_balance,r.created_at,
                (r.created_at + make_interval(days => r.payment_term))::date AS due_date,
                CASE
                  WHEN (r.created_at + make_interval(days => r.payment_term))::date >= $2 THEN 'current'
                  WHEN $2::date - (r.created_at + make_interval(days => r.payment_term))::date <= 30 THEN 'b1_30'
                  WHEN $2::date - (r.created_at + make_interval(days => r.payment_term))::date <= 60 THEN 'b31_60'
                  WHEN $2::date - (r.created_at + make_interval(days => r.payment_term))::date <= 90 THEN 'b61_90'
                  ELSE 'over_90'
                END AS aging_bucket
         FROM app.receivable r
         JOIN app.sales_order so ON so.id=r.order_id AND so.company_code=r.company_code
         JOIN app.customer c ON c.id=so.customer_id AND c.company_code=r.company_code
         WHERE r.company_code=$1 AND r.receivable_balance > 0
         ORDER BY due_date, r.id`,
        [this.context.companyCode, asOf],
      );
      const totals = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, over_90: 0 };
      for (const row of rows.rows) totals[row.aging_bucket as keyof typeof totals] += Number(row.receivable_balance);
      return { asOf, currency: 'PHP', rows: rows.rows, totals: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value.toFixed(2)])) };
    });
  }

  async apAging(asOfValue: unknown): Promise<unknown> {
    const asOf = date(asOfValue);
    return withTransaction(this.pool, this.context, async (client) => {
      const rows = await client.query<Record<string, unknown>>(
        `SELECT p.id,s.supplier_name,p.payable_balance,p.created_at,
                (p.created_at + make_interval(days => p.payment_term))::date AS due_date,
                CASE
                  WHEN (p.created_at + make_interval(days => p.payment_term))::date >= $2 THEN 'current'
                  WHEN $2::date - (p.created_at + make_interval(days => p.payment_term))::date <= 30 THEN 'b1_30'
                  WHEN $2::date - (p.created_at + make_interval(days => p.payment_term))::date <= 60 THEN 'b31_60'
                  WHEN $2::date - (p.created_at + make_interval(days => p.payment_term))::date <= 90 THEN 'b61_90'
                  ELSE 'over_90'
                END AS aging_bucket
         FROM app.payable p
         JOIN app.purchase_order po ON po.id=p.purchase_id AND po.company_code=p.company_code
         JOIN app.supplier s ON s.id=po.supplier_id AND s.company_code=p.company_code
         WHERE p.company_code=$1 AND p.payable_balance > 0
         ORDER BY due_date, p.id`,
        [this.context.companyCode, asOf],
      );
      const totals = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, over_90: 0 };
      for (const row of rows.rows) totals[row.aging_bucket as keyof typeof totals] += Number(row.payable_balance);
      return { asOf, currency: 'PHP', rows: rows.rows, totals: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value.toFixed(2)])) };
    });
  }

  async trialBalance(fromValue: unknown, toValue: unknown): Promise<unknown> {
    const from = date(fromValue); const to = date(toValue);
    if (from > to) throw validationError();
    return withTransaction(this.pool, this.context, async (client) => {
      const rows = await client.query<Record<string, unknown>>(
        `SELECT account_code,sum(debit)::text AS debit,sum(credit)::text AS credit
         FROM app_ops.journal_line jl JOIN app_ops.journal_entry je ON je.id=jl.entry_id
         WHERE jl.company_code=$1 AND je.status='posted' AND je.entry_date BETWEEN $2 AND $3
         GROUP BY account_code ORDER BY account_code`,
        [this.context.companyCode, from, to],
      );
      const lines: Record<string, unknown>[] = rows.rows.map((row) => ({ ...row, kind: accountKind(String(row.account_code)), balance: (Number(row.debit) - Number(row.credit)).toFixed(2) }));
      const debit = lines.reduce((sum, row) => sum + Number(row.debit), 0);
      const credit = lines.reduce((sum, row) => sum + Number(row.credit), 0);
      return { period: { from, to }, currency: 'PHP', lines, totals: { debit: debit.toFixed(2), credit: credit.toFixed(2) } };
    });
  }

  async financialStatements(asOfValue: unknown): Promise<unknown> {
    const asOf = date(asOfValue);
    return withTransaction(this.pool, this.context, async (client) => {
      const balances = await client.query<Record<string, unknown>>(
        `SELECT account_code,sum(debit)::text AS debit,sum(credit)::text AS credit
         FROM app_ops.journal_line jl JOIN app_ops.journal_entry je ON je.id=jl.entry_id
         WHERE jl.company_code=$1 AND je.status='posted' AND je.entry_date <= $2
         GROUP BY account_code ORDER BY account_code`,
        [this.context.companyCode, asOf],
      );
      const accounts = balances.rows.map((row) => {
        const kind = accountKind(String(row.account_code));
        return { accountCode: row.account_code, kind, debit: row.debit, credit: row.credit, balance: (Number(row.debit) - Number(row.credit)).toFixed(2) };
      });
      if (accounts.some((account) => account.kind === 'unclassified')) throw new AppError(409, 'CONFLICT', '存在未映射会计科目，不能生成财务报表');
      const debitNormal = (kind: AccountKind): number => accounts.filter((account) => account.kind === kind).reduce((sum, account) => sum + Number(account.balance), 0);
      const creditNormal = (kind: AccountKind): number => accounts.filter((account) => account.kind === kind).reduce((sum, account) => sum - Number(account.balance), 0);
      const assets = debitNormal('asset');
      const liabilities = creditNormal('liability');
      const equity = creditNormal('equity');
      const revenue = creditNormal('revenue');
      const expenses = debitNormal('expense');
      const currentPeriodProfit = revenue - expenses;
      if (Math.abs(assets - liabilities - equity - currentPeriodProfit) > 0.01) throw new AppError(409, 'CONFLICT', '资产负债表不平衡');
      return {
        asOf, currency: 'PHP', accounts,
        incomeStatement: { revenue: revenue.toFixed(2), expenses: expenses.toFixed(2), netProfit: currentPeriodProfit.toFixed(2) },
        balanceSheet: { assets: assets.toFixed(2), liabilities: liabilities.toFixed(2), equity: equity.toFixed(2), currentPeriodProfit: currentPeriodProfit.toFixed(2), liabilitiesAndEquity: (liabilities + equity + currentPeriodProfit).toFixed(2) },
      };
    });
  }

  async agingCsv(typeValue: unknown, asOfValue: unknown, localeValue: unknown): Promise<string> {
    const type = text(typeValue, 16); const asOf = date(asOfValue);
    if (localeValue !== 'zh-CN' && localeValue !== 'en-US') throw validationError();
    if (!['ar', 'ap'].includes(type)) throw validationError();
    const report = await (type === 'ar' ? this.arAging(asOf) : this.apAging(asOf)) as { rows: Record<string, unknown>[]; totals: Record<string, string> };
    const zh = localeValue === 'zh-CN';
    const lines: unknown[][] = [
      [zh ? (type === 'ar' ? '应收账龄表' : '应付账龄表') : (type === 'ar' ? 'AR Aging' : 'AP Aging'), asOf],
      [zh ? '单据' : 'Record', zh ? '往来方' : 'Counterparty', zh ? '到期日' : 'Due Date', zh ? '余额' : 'Balance', zh ? '账龄' : 'Aging'],
      ...report.rows.map((row) => [row.order_no ?? row.id, row.customer_name ?? row.supplier_name, row.due_date, row.receivable_balance ?? row.payable_balance, row.aging_bucket]),
      [], ...Object.entries(report.totals).map(([key, value]) => [key, value]),
    ];
    return this.toCsv(lines);
  }

  async taxReportCsv(fromValue: unknown, toValue: unknown, birFormValue: unknown, localeValue: unknown): Promise<string> {
    if (localeValue !== 'zh-CN' && localeValue !== 'en-US') throw validationError();
    const report = await this.taxReport(fromValue, toValue, birFormValue) as { birForm: string; period: { from: string; to: string }; lines: Record<string, unknown>[]; totals: { net: string; tax: string } };
    const zh = localeValue === 'zh-CN';
    return this.toCsv([
      [zh ? 'BIR税务报表' : 'BIR Tax Report', report.birForm, report.period.from, report.period.to],
      [zh ? '方向' : 'Direction', zh ? '税码' : 'Tax Code', zh ? '净额' : 'Net', zh ? '税额' : 'Tax', zh ? '含税' : 'Gross', zh ? '交易数' : 'Transactions'],
      ...report.lines.map((row) => [row.direction, row.tax_code, row.net_amount, row.tax_amount, row.gross_amount, row.transactions]),
      [], [zh ? '净额合计' : 'Total Net', report.totals.net], [zh ? '税额合计' : 'Total Tax', report.totals.tax],
    ]);
  }

  async financialStatementsCsv(asOfValue: unknown, localeValue: unknown): Promise<string> {
    if (localeValue !== 'zh-CN' && localeValue !== 'en-US') throw validationError();
    const asOf = date(asOfValue);
    const report = await this.financialStatements(asOf) as { asOf: string; incomeStatement: Record<string, string>; balanceSheet: Record<string, string> };
    const zh = localeValue === 'zh-CN';
    return this.toCsv([
      [zh ? '财务报表' : 'Financial Statements', report.asOf],
      [zh ? '利润表' : 'Income Statement'], ...Object.entries(report.incomeStatement),
      [], [zh ? '资产负债表' : 'Balance Sheet'], ...Object.entries(report.balanceSheet),
    ]);
  }
}
