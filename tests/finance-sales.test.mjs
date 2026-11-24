import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { FinanceService } from '../dist/packages/domain/src/finance.js';
import { SalesService } from '../dist/packages/domain/src/sales.js';
class Pool { constructor(db) { this.db = db; } query(q, v) { return this.db.query(q, v); } async connect() { return { query: (q, v) => this.db.query(q, v), release: () => {} }; } }
const context = { actorId: 'TEST', employeeId: 1, companyCode: 'THL', companyId: 1 };
async function fixture() {
  const db = new PGlite();
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8').replaceAll('CONCURRENTLY', ''));
  await db.query("SELECT set_config('app.actor_id','TEST',false),set_config('app.company_code','*',false),set_config('app.company_id','0',false)");
  await db.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('THL','Synthetic','PHP','active','TEST')");
  await db.query("SELECT set_config('app.company_code','THL',false),set_config('app.company_id','1',false)");
  await db.query("INSERT INTO app.price_list (price_list_code,price_type,product_name,price,effective_date,company_code,created_by) VALUES ('P1','standard','Egg',10,'2026-01-01','THL','TEST')");
  const customer = await db.query("INSERT INTO app.customer (customer_code,customer_name,address,payment_term,credit_ref,price_id,status,company_code,created_by) VALUES ('C1','Customer','Address',30,0,1,'active','THL','TEST') RETURNING id");
  await db.query("INSERT INTO app.credit_limit (customer_id,credit_amount,occupied_amount,over_limit_block,ceo_approval,company_code,created_by) VALUES ($1,10000,1000,true,'not_required','THL','TEST')", [customer.rows[0].id]);
  const order = await db.query("INSERT INTO app.sales_order (order_no,customer_id,order_mode,inventory_quantity,status,company_code,created_by) VALUES ('SO1',$1,'standard',100,'shipped','THL','TEST') RETURNING id", [customer.rows[0].id]);
  return { db, pool: new Pool(db), customerId: Number(customer.rows[0].id), orderId: Number(order.rows[0].id) };
}

test('收款核销同步应收信用和平衡会计分录且幂等', async () => {
  const f = await fixture();
  const ar = await f.db.query("INSERT INTO app.receivable (order_id,signed,payment_term,receivable_balance,overdue,company_code,created_by) VALUES ($1,true,30,250,false,'THL','TEST') RETURNING id", [f.orderId]);
  const finance = new FinanceService(f.pool, context);
  const result = await finance.receivePayment({ receivableId: Number(ar.rows[0].id), receiptMethod: 'cash', cashAmount: 100 }, 'RECEIPT-IDEM-1');
  assert.equal(Number(result.overpay_balance), 0);
  assert.equal(Number((await f.db.query('SELECT receivable_balance FROM app.receivable')).rows[0].receivable_balance), 150);
  assert.equal(Number((await f.db.query('SELECT occupied_amount FROM app.credit_limit')).rows[0].occupied_amount), 900);
  await finance.receivePayment({ receivableId: Number(ar.rows[0].id), receiptMethod: 'cash', cashAmount: 100 }, 'RECEIPT-IDEM-1');
  assert.equal(Number((await f.db.query('SELECT count(*)::int AS n FROM app.receipt_record')).rows[0].n), 1);
  const journal = await f.db.query('SELECT sum(debit)::numeric AS debit,sum(credit)::numeric AS credit FROM app_ops.journal_line');
  assert.equal(Number(journal.rows[0].debit), 100); assert.equal(Number(journal.rows[0].credit), 100);
  await assert.rejects(() => finance.postJournal({ entryDate: '2026-11-23', lines: [{ accountCode: 'CASH', debit: 1 }, { accountCode: 'AR', credit: 2 }] }, 'JE-BAD-001'), /借贷必须相等/);
  await f.db.close();
});

test('批准凭证驱动付款并更新应付和总账', async () => {
  const f = await fixture();
  const payable = await f.db.query("INSERT INTO app.payable (purchase_id,payable_balance,payment_term,voucher_status,company_code,created_by) VALUES (1,400,0,'approved','THL','TEST') RETURNING id");
  const voucher = await f.db.query("INSERT INTO app.disbursement_voucher (voucher_no,voucher_type,planned_payment_method,payable_id,invoice_refs,receiving_refs,gross_amount,withholding_tax_amount,net_disbursement_amount,prepared_by,prepared_at,approval_status,company_code,created_by) VALUES ('DV1','supplier','bank',$1,'INV1','GR1',400,0,400,1,now(),'approved','THL','TEST') RETURNING id", [payable.rows[0].id]);
  const finance = new FinanceService(f.pool, context);
  await finance.executePayment({ voucherId: Number(voucher.rows[0].id), cashierId: 1, plannedPaymentMethod: 'bank', checkAmount: 100, bankTransferRef: 'BANK-TEST-1' }, 'PAY-IDEM-1');
  assert.equal(Number((await f.db.query('SELECT payable_balance FROM app.payable')).rows[0].payable_balance), 300);
  assert.equal(Number((await f.db.query('SELECT amount FROM app_ops.payment_allocation')).rows[0].amount), 100);
  assert.equal(Number((await f.db.query('SELECT count(*)::int AS n FROM app_ops.journal_entry')).rows[0].n), 1);
  await f.db.close();
});

test('销售退货恢复原批次并冲减应收信用', async () => {
  const f = await fixture();
  const material = await f.db.query("INSERT INTO app.material (material_code,material_name,category,uom,company_code,created_by) VALUES ('M1','Egg','egg','egg','THL','TEST') RETURNING id");
  const ledger = await f.db.query("INSERT INTO app.inventory_ledger (material_id,batch_no,location_id,company_code,warehouse_id,quantity,inventory_status,created_by) VALUES ($1,'B1',1,1,1,100,'available','TEST') RETURNING id", [material.rows[0].id]);
  await f.db.query("INSERT INTO app_ops.inventory_valuation (company_id,material_id,batch_no,warehouse_id,location_id,quantity,unit_cost) VALUES (1,$1,'B1',1,1,100,5)", [material.rows[0].id]);
  await f.db.query('INSERT INTO app_ops.sales_order_line (company_id,sales_order_id,line_no,material_id,quantity,uom,unit_price,line_amount) VALUES (1,$1,1,$2,100,\'egg\',10,1000)', [f.orderId, material.rows[0].id]);
  const reservation = await f.db.query("INSERT INTO app_ops.inventory_reservation (company_id,sales_order_id,inventory_id,quantity,status) VALUES (1,$1,$2,100,'consumed') RETURNING id", [f.orderId, ledger.rows[0].id]);
  await f.db.query("INSERT INTO app.receivable (order_id,signed,payment_term,receivable_balance,overdue,company_code,created_by) VALUES ($1,true,30,1000,false,'THL','TEST')", [f.orderId]);
  const sales = new SalesService(f.pool, context);
  await sales.createReturn({ salesOrderId: f.orderId, reservationId: Number(reservation.rows[0].id), quantity: 20, returnNo: 'SR1', reason: 'broken' }, 'SALE-RETURN-1');
  assert.equal(Number((await f.db.query('SELECT quantity FROM app.inventory_ledger')).rows[0].quantity), 120);
  assert.equal(Number((await f.db.query('SELECT receivable_balance FROM app.receivable')).rows[0].receivable_balance), 800);
  assert.equal(Number((await f.db.query('SELECT occupied_amount FROM app.credit_limit')).rows[0].occupied_amount), 800);
  const statement = await sales.statement(f.customerId);
  assert.equal(statement.balance, '800.00');
  await f.db.close();
});

test('BIR税率按交易日生效并生成可复算税务报表', async () => {
  const f = await fixture(); const finance = new FinanceService(f.pool, context);
  await finance.setTaxRate({ taxCode: 'VAT12', rate: 0.12, effectiveFrom: '2026-01-01' });
  const tax = await finance.registerTax({ transactionDate: '2026-11-23', direction: 'output', sourceType: 'sales_order', sourceId: 'SO1', taxCode: 'VAT12', netAmount: 1000, birForm: '2550Q' }, 'TAX-IDEM-1');
  assert.equal(Number(tax.tax_amount), 120); assert.equal(Number(tax.gross_amount), 1120);
  const report = await finance.taxReport('2026-10-01', '2026-12-31', '2550Q');
  assert.equal(report.totals.tax, '120.00');
  await f.db.close();
});
