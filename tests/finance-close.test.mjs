import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { FinanceService } from '../dist/packages/domain/src/finance.js';

class Pool {
  constructor(db) { this.db = db; }
  query(q, v) { return this.db.query(q, v); }
  async connect() { return { query: (q, v) => this.db.query(q, v), release: () => {} }; }
}
const context = { actorId: 'TEST', employeeId: 1, companyCode: 'THL', companyId: 1 };
async function fixture() {
  const db = new PGlite();
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).filter((x) => x.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8').replaceAll('CONCURRENTLY', ''));
  }
  await db.query("SELECT set_config('app.actor_id','TEST',false),set_config('app.company_code','*',false),set_config('app.company_id','0',false)");
  await db.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('THL','Synthetic','PHP','active','TEST')");
  await db.query("SELECT set_config('app.company_code','THL',false),set_config('app.company_id','1',false)");
  return { db, pool: new Pool(db), finance: new FinanceService(new Pool(db), context) };
}
async function createReceivable(db) {
  await db.query("INSERT INTO app.price_list (price_list_code,price_type,product_name,price,effective_date,company_code,created_by) VALUES ('P1','standard','Egg',10,'2026-01-01','THL','TEST')");
  const customer = await db.query("INSERT INTO app.customer (customer_code,customer_name,address,payment_term,credit_ref,price_id,status,company_code,created_by) VALUES ('C1','Customer','Address',0,0,1,'active','THL','TEST') RETURNING id");
  const order = await db.query("INSERT INTO app.sales_order (order_no,customer_id,order_mode,inventory_quantity,status,company_code,created_by) VALUES ('SO1',$1,'standard',10,'shipped','THL','TEST') RETURNING id", [customer.rows[0].id]);
  return db.query("INSERT INTO app.receivable (order_id,signed,payment_term,receivable_balance,overdue,company_code,created_by) VALUES ($1,true,0,250,false,'THL','TEST') RETURNING id", [order.rows[0].id]);
}
async function createPayable(db) {
  const material = await db.query("INSERT INTO app.material (material_code,material_name,category,uom,company_code,created_by) VALUES ('M1','Feed','feed','kg','THL','TEST') RETURNING id");
  const supplier = await db.query("INSERT INTO app.supplier (supplier_code,supplier_name,material_id,status,company_code,created_by) VALUES ('S1','Supplier',$1,'active','THL','TEST') RETURNING id", [material.rows[0].id]);
  const order = await db.query("INSERT INTO app.purchase_order (order_no,supplier_id,material_id,quantity,price,execution_close,company_code,created_by) VALUES ('PO1',$1,$2,10,12,'open','THL','TEST') RETURNING id", [supplier.rows[0].id, material.rows[0].id]);
  return db.query("INSERT INTO app.payable (purchase_id,payable_balance,payment_term,company_code,created_by) VALUES ($1,120,0,'THL','TEST') RETURNING id", [order.rows[0].id]);
}

test('会计期间开放、关闭快照、阻断记账并可重新开放', async () => {
  const f = await fixture();
  const period = await f.finance.openPeriod({ periodCode: '2026-11', periodStart: '2026-11-01', periodEnd: '2026-11-30' }, 'PERIOD-OPEN-1');
  assert.equal(period.status, 'open');
  await f.finance.postJournal({ entryDate: '2026-11-15', lines: [{ accountCode: 'CASH', debit: 100 }, { accountCode: 'AR', credit: 100 }] }, 'JOURNAL-PERIOD-1');
  const closed = await f.finance.closePeriod(period.id, {}, 'PERIOD-CLOSE-1');
  assert.equal(closed.period.status, 'closed');
  assert.equal(closed.snapshots.length, 2);
  assert.equal(Number(closed.snapshots[0].debit) + Number(closed.snapshots[1].debit), 100);
  await assert.rejects(() => f.finance.postJournal({ entryDate: '2026-11-20', lines: [{ accountCode: 'CASH', debit: 50 }, { accountCode: 'AR', credit: 50 }] }, 'JOURNAL-BLOCKED-1'), /会计期间已关闭/);
  const reopened = await f.finance.reopenPeriod(period.id, {}, 'PERIOD-REOPEN-1');
  assert.equal(reopened.status, 'open');
  await f.finance.postJournal({ entryDate: '2026-11-20', lines: [{ accountCode: 'CASH', debit: 50 }, { accountCode: 'AR', credit: 50 }] }, 'JOURNAL-REOPEN-1');
  await f.db.close();
});

test('应收和应付账龄按到期日分桶并汇总', async () => {
  const f = await fixture();
  await createReceivable(f.db);
  await createPayable(f.db);
  const ar = await f.finance.arAging('2027-01-01');
  const ap = await f.finance.apAging('2027-01-01');
  const totalAging = (totals) => Object.values(totals).reduce((sum, value) => sum + Number(value), 0);
  assert.equal(ar.rows.length, 1);
  assert.equal(ar.rows[0].receivable_balance, '250.00');
  assert.equal(totalAging(ar.totals), 250);
  assert.equal(ap.rows.length, 1);
  assert.equal(ap.rows[0].payable_balance, '120.00');
  assert.equal(totalAging(ap.totals), 120);
  await f.db.close();
});

test('试算平衡和财务报表由已过账分录复算且资产负债表平衡', async () => {
  const f = await fixture();
  await f.finance.postJournal({ entryDate: '2026-11-10', lines: [{ accountCode: 'CASH', debit: 1000 }, { accountCode: 'REV.SALES', credit: 1000 }] }, 'JOURNAL-REV-1');
  await f.finance.postJournal({ entryDate: '2026-11-11', lines: [{ accountCode: 'EXP.FEED', debit: 600 }, { accountCode: 'CASH', credit: 600 }] }, 'JOURNAL-EXP-1');
  const trial = await f.finance.trialBalance('2026-01-01', '2026-12-31');
  assert.equal(trial.totals.debit, trial.totals.credit);
  assert.equal(trial.totals.debit, '1600.00');
  const statements = await f.finance.financialStatements('2026-12-31');
  assert.equal(statements.incomeStatement.revenue, '1000.00');
  assert.equal(statements.incomeStatement.expenses, '600.00');
  assert.equal(statements.incomeStatement.netProfit, '400.00');
  assert.equal(statements.balanceSheet.assets, '400.00');
  assert.equal(statements.balanceSheet.liabilitiesAndEquity, '400.00');
  await f.db.close();
});

test('账龄、BIR税务和财务报表支持多语言 CSV 导出', async () => {
  const f = await fixture();
  await createReceivable(f.db);
  await createPayable(f.db);
  await f.finance.setTaxRate({ taxCode: 'VAT12', rate: 0.12, effectiveFrom: '2026-01-01' });
  await f.finance.registerTax({ transactionDate: '2026-11-15', direction: 'output', sourceType: 'sales_order', sourceId: 'SO1', taxCode: 'VAT12', netAmount: 1000, birForm: '2550Q' }, 'TAX-CSV-1');
  const agingCsv = await f.finance.agingCsv('ar', '2027-01-01', 'zh-CN');
  const taxCsv = await f.finance.taxReportCsv('2026-01-01', '2026-12-31', '2550Q', 'zh-CN');
  const statementCsv = await f.finance.financialStatementsCsv('2027-01-01', 'en-US');
  assert.match(agingCsv, /应收账龄表/);
  assert.match(taxCsv, /BIR税务报表/);
  assert.match(taxCsv, /120\.00/);
  assert.match(statementCsv, /Financial Statements/);
  await f.db.close();
});
