import assert from 'node:assert/strict';
import pg from 'pg';
import { Redis } from 'ioredis';
import { serve } from '@hono/node-server';
import { createApp } from '../dist/apps/api/src/app.js';
import { AuthService, totp } from '../dist/packages/security/src/auth.js';
import { PostgresAuthStore } from '../dist/packages/security/src/postgres-store.js';

const databaseUrl = process.env.DATABASE_URL;
const valkeyUrl = process.env.VALKEY_URL;
if (!databaseUrl || !valkeyUrl) throw new Error('DATABASE_URL and VALKEY_URL are required');
const pool = new pg.Pool({ connectionString: databaseUrl, max: 20 });
const redis = new Redis(valkeyUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
const evidence = [];
const record = (name, detail) => { evidence.push({ name, result: 'passed', ...detail }); console.log(JSON.stringify(evidence.at(-1))); };

try {
  const admin = new pg.Client({ connectionString: databaseUrl });
  await admin.connect();
  await admin.query("SELECT set_config('app.company_code','*',false), set_config('app.company_id','0',false), set_config('app.actor_id','REAL-WP08',false)");
  if ((await admin.query('SELECT id FROM app.company WHERE company_code=$1', ['THL'])).rowCount === 0) {
    await admin.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('THL','Synthetic THL','PHP','active','REAL-WP08')");
  }
  const company = await admin.query("SELECT id FROM app.company WHERE company_code='THL'");
  const companyId = Number(company.rows[0].id);

  const oldPeriods = await admin.query("SELECT id FROM app_ops.accounting_period WHERE company_code='THL' AND period_code='2026-NOV'");
  await admin.query('DELETE FROM app_ops.account_balance_snapshot WHERE period_id = ANY($1)', [oldPeriods.rows.map((row) => row.id)]);
  await admin.query("DELETE FROM app_ops.journal_line WHERE company_code='THL' AND entry_id IN (SELECT id FROM app_ops.journal_entry WHERE company_code='THL' AND created_by IN ('REAL-WP08','WP08-EMP-ADMIN'))");
  await admin.query("DELETE FROM app_ops.journal_entry WHERE company_code='THL' AND created_by IN ('REAL-WP08','WP08-EMP-ADMIN')");
  await admin.query("DELETE FROM app_ops.tax_transaction WHERE company_code='THL' AND tax_code='VAT12' AND source_id='WP08-SO'");
  await admin.query("DELETE FROM app_ops.tax_rate WHERE company_code='THL' AND tax_code='VAT12'");
  await admin.query("DELETE FROM app_ops.accounting_period WHERE id = ANY($1)", [oldPeriods.rows.map((row) => row.id)]);
  const oldReceivables = await admin.query("SELECT r.id FROM app.receivable r JOIN app.sales_order so ON so.id=r.order_id WHERE so.order_no='WP08-SO' AND r.company_code='THL'");
  await admin.query('DELETE FROM app.receipt_record WHERE receivable_id = ANY($1)', [oldReceivables.rows.map((row) => row.id)]);
  await admin.query('DELETE FROM app.receivable WHERE id = ANY($1)', [oldReceivables.rows.map((row) => row.id)]);
  const oldPayables = await admin.query("SELECT p.id FROM app.payable p JOIN app.purchase_order po ON po.id=p.purchase_id WHERE po.order_no='WP08-PO' AND p.company_code='THL'");
  await admin.query('DELETE FROM app_ops.payment_allocation WHERE payable_id = ANY($1)', [oldPayables.rows.map((row) => row.id)]);
  await admin.query('DELETE FROM app.payment_record WHERE voucher_id IN (SELECT id FROM app.disbursement_voucher WHERE payable_id = ANY($1))', [oldPayables.rows.map((row) => row.id)]);
  await admin.query('DELETE FROM app.payable WHERE id = ANY($1)', [oldPayables.rows.map((row) => row.id)]);
  await admin.query("DELETE FROM app.sales_order WHERE order_no='WP08-SO' AND company_code='THL'");
  await admin.query("DELETE FROM app.purchase_order WHERE order_no='WP08-PO' AND company_code='THL'");
  await admin.query("DELETE FROM app.customer WHERE customer_code='WP08-CUS' AND company_code='THL'");
  await admin.query("DELETE FROM app.supplier WHERE supplier_code='WP08-SUP' AND company_code='THL'");
  await admin.query("DELETE FROM app.material WHERE material_code='WP08-MAT' AND company_code='THL'");
  await admin.query("DELETE FROM app.price_list WHERE price_list_code='WP08-PRICE' AND company_code='THL'");
  await admin.query("DELETE FROM app.idempotency_consumption WHERE idempotency_key LIKE 'WP08-%'");

  if ((await admin.query('SELECT id FROM app.organization_unit WHERE unit_code=$1', ['WP08-UNIT'])).rowCount === 0) {
    await admin.query("INSERT INTO app.organization_unit (unit_code,unit_name,parent_unit_id,org_level,status,company_code,created_by) VALUES ('WP08-UNIT','WP08 Finance',null,1,'active','THL','REAL-WP08')");
  }
  const unit = await admin.query("SELECT id FROM app.organization_unit WHERE unit_code='WP08-UNIT'");
  if ((await admin.query('SELECT id FROM app.position WHERE position_code=$1', ['WP08-POS'])).rowCount === 0) {
    await admin.query("INSERT INTO app.position (position_code,position_name,unit_id,headcount,reports_to_id,effective_date,status,company_code,created_by) VALUES ('WP08-POS','WP08 Finance Staff',$1,10,null,'2026-01-01','active','THL','REAL-WP08')", [unit.rows[0].id]);
  }
  const position = await admin.query("SELECT id FROM app.position WHERE position_code='WP08-POS'");
  const employees = {};
  for (const [key, no] of Object.entries({ admin: 'WP08-EMP-ADMIN', staff: 'WP08-EMP-STAFF' })) {
    const existing = await admin.query('SELECT id FROM app.employee WHERE employee_no=$1', [no]);
    if (existing.rowCount === 0) {
      const inserted = await admin.query("INSERT INTO app.employee (employee_no,employee_name,position_id,account,employment_status,company_code,created_by) VALUES ($1,$2,$3,0,'active','THL','REAL-WP08') RETURNING id", [no, key, position.rows[0].id]);
      employees[key] = Number(inserted.rows[0].id);
    } else employees[key] = Number(existing.rows[0].id);
  }

  await admin.query("INSERT INTO app.price_list (price_list_code,price_type,product_name,price,effective_date,company_code,created_by) VALUES ('WP08-PRICE','standard','WP08 Eggs',10,'2026-01-01','THL','REAL-WP08')");
  const price = await admin.query("SELECT id FROM app.price_list WHERE price_list_code='WP08-PRICE'");
  const customer = await admin.query("INSERT INTO app.customer (customer_code,customer_name,address,payment_term,credit_ref,price_id,status,company_code,created_by) VALUES ('WP08-CUS','WP08 Customer','Finance address',0,0,$1,'active','THL','REAL-WP08') RETURNING id", [price.rows[0].id]);
  const customerId = Number(customer.rows[0].id);
  await admin.query("INSERT INTO app.credit_limit (customer_id,credit_amount,occupied_amount,over_limit_block,ceo_approval,company_code,created_by) VALUES ($1,10000,0,true,'not_required','THL','REAL-WP08')", [customerId]);
  const material = await admin.query("INSERT INTO app.material (material_code,material_name,category,uom,company_code,created_by) VALUES ('WP08-MAT','WP08 Feed','feed','kg','THL','REAL-WP08') RETURNING id");
  const materialId = Number(material.rows[0].id);
  const supplier = await admin.query("INSERT INTO app.supplier (supplier_code,supplier_name,material_id,status,company_code,created_by) VALUES ('WP08-SUP','WP08 Supplier',$1,'active','THL','REAL-WP08') RETURNING id", [materialId]);
  const salesOrder = await admin.query("INSERT INTO app.sales_order (order_no,customer_id,order_mode,inventory_quantity,status,company_code,created_by) VALUES ('WP08-SO',$1,'standard',0,'shipped','THL','REAL-WP08') RETURNING id", [customerId]);
  const purchaseOrder = await admin.query("INSERT INTO app.purchase_order (order_no,supplier_id,material_id,quantity,price,execution_close,company_code,created_by) VALUES ('WP08-PO',$1,$2,10,12,'open','THL','REAL-WP08') RETURNING id", [supplier.rows[0].id, materialId]);
  await admin.query("INSERT INTO app.receivable (order_id,signed,payment_term,receivable_balance,overdue,company_code,created_by) VALUES ($1,true,0,250,false,'THL','REAL-WP08')", [salesOrder.rows[0].id]);
  await admin.query("INSERT INTO app.payable (purchase_id,payable_balance,payment_term,company_code,created_by) VALUES ($1,120,0,'THL','REAL-WP08')", [purchaseOrder.rows[0].id]);

  const signingKey = 'real-wp08-signing-key-with-32-bytes';
  const auth = new AuthService(new PostgresAuthStore(pool), { issuer: 'layer-farm-erp', audience: 'layer-farm-web', signingKey });
  const password = 'Synthetic-Test-Passw0rd!2026';
  const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
  await admin.query("DELETE FROM app_auth.credential WHERE account IN ('admin.wp08','staff.wp08') AND company_code='THL'");
  await auth.register('admin.wp08', password, { employeeId: employees.admin, employeeNo: 'WP08-EMP-ADMIN', companyCode: 'THL', companyId, mfaEnrolled: true, roles: [{ role: 'admin' }] }, secret);
  await auth.register('staff.wp08', password, { employeeId: employees.staff, employeeNo: 'WP08-EMP-STAFF', companyCode: 'THL', companyId, mfaEnrolled: true, roles: [{ role: 'sales_staff' }] }, secret);

  const app = createApp({
    config: { nodeEnv: 'test', port: 3214, bodyLimitBytes: 1048576, externalIntegrationsEnabled: false, databaseUrl, valkeyUrl },
    database: pool, auth,
    probes: { database: async () => pool.query('SELECT 1'), valkey: async () => redis.ping() },
  });
  const server = serve({ fetch: app.fetch, port: 3214 });
  await new Promise((resolve, reject) => server.once('listening', resolve).once('error', reject));
  const base = 'http://127.0.0.1:3214';
  const request = async (path, options = {}) => {
    const headers = { 'content-type': 'application/json', ...(options.token ? { authorization: `Bearer ${options.token}` } : {}), ...(options.key ? { 'idempotency-key': options.key } : {}) };
    const response = await fetch(`${base}${path}`, { method: options.method ?? 'GET', headers, ...(options.body ? { body: JSON.stringify(options.body) } : {}) });
    const text = await response.text();
    return { status: response.status, text, body: text.startsWith('{') ? JSON.parse(text) : undefined };
  };
  const login = async (account) => {
    const response = await request('/api/v1/auth/login', { method: 'POST', body: { account, password, companyCode: 'THL', mfaCode: totp(secret) } });
    assert.equal(response.status, 200, response.text);
    return response.body.data.accessToken;
  };
  const adminToken = await login('admin.wp08');
  const staffToken = await login('staff.wp08');

  let response = await request('/api/v1/fin/periods', { method: 'POST', token: adminToken, key: 'WP08-PERIOD-OPEN', body: { periodCode: '2026-NOV', periodStart: '2026-11-01', periodEnd: '2026-11-30' } });
  assert.equal(response.status, 201, response.text);
  const periodId = Number(response.body.data.id);
  assert.equal(response.body.data.status, 'open');
  response = await request('/api/v1/fin/journal-entries', { method: 'POST', token: adminToken, key: 'WP08-JE-1', body: { entryDate: '2026-11-10', lines: [{ accountCode: 'CASH', debit: 1000 }, { accountCode: 'REV.SALES', credit: 1000 }] } });
  assert.equal(response.status, 201, response.text);
  response = await request('/api/v1/fin/journal-entries', { method: 'POST', token: adminToken, key: 'WP08-JE-2', body: { entryDate: '2026-11-11', lines: [{ accountCode: 'EXP.FEED', debit: 600 }, { accountCode: 'CASH', credit: 600 }] } });
  assert.equal(response.status, 201, response.text);
  response = await request(`/api/v1/fin/periods/${periodId}/close`, { method: 'POST', token: adminToken, key: 'WP08-PERIOD-CLOSE', body: {} });
  assert.equal(response.status, 200, response.text);
  assert.equal(response.body.data.period.status, 'closed');
  assert.equal(response.body.data.snapshots.length, 3);
  response = await request('/api/v1/fin/journal-entries', { method: 'POST', token: adminToken, key: 'WP08-JE-BLOCKED', body: { entryDate: '2026-11-20', lines: [{ accountCode: 'CASH', debit: 1 }, { accountCode: 'AR', credit: 1 }] } });
  assert.equal(response.status, 409, response.text);
  response = await request(`/api/v1/fin/periods/${periodId}/reopen`, { method: 'POST', token: staffToken, key: 'WP08-REOPEN-DENIED', body: {} });
  assert.equal(response.status, 403, response.text);
  response = await request(`/api/v1/fin/periods/${periodId}/reopen`, { method: 'POST', token: adminToken, key: 'WP08-PERIOD-REOPEN', body: {} });
  assert.equal(response.status, 200, response.text);
  response = await request(`/api/v1/fin/periods/${periodId}/close`, { method: 'POST', token: adminToken, key: 'WP08-PERIOD-CLOSE-2', body: {} });
  assert.equal(response.status, 200, response.text);
  record('REAL-WP08-001 期间开放、借贷分录、关闭快照、阻断和RBAC重开闭环', { blockedJournal: 409, staffReopen: 403, snapshots: 3 });

  response = await request('/api/v1/fin/ar-aging?asOf=2027-01-01', { token: adminToken });
  assert.equal(response.status, 200, response.text);
  assert.equal(response.body.data.rows[0].receivable_balance, '250.00');
  const arTotal = Object.values(response.body.data.totals).reduce((sum, value) => sum + Number(value), 0);
  assert.equal(arTotal, 250);
  response = await request('/api/v1/fin/ap-aging?asOf=2027-01-01', { token: adminToken });
  assert.equal(response.status, 200, response.text);
  assert.equal(response.body.data.rows[0].payable_balance, '120.00');
  const apTotal = Object.values(response.body.data.totals).reduce((sum, value) => sum + Number(value), 0);
  assert.equal(apTotal, 120);
  record('REAL-WP08-002 真实HTTP应收应付账龄分桶与汇总', { ar: '250.00', ap: '120.00' });

  response = await request('/api/v1/fin/trial-balance?from=2026-01-01&to=2026-12-31', { token: adminToken });
  assert.equal(response.status, 200, response.text);
  assert.equal(response.body.data.totals.debit, response.body.data.totals.credit);
  response = await request('/api/v1/fin/financial-statements?asOf=2026-12-31', { token: adminToken });
  assert.equal(response.status, 200, response.text);
  assert.equal(response.body.data.incomeStatement.revenue, '1000.00');
  assert.equal(response.body.data.incomeStatement.expenses, '600.00');
  assert.equal(response.body.data.incomeStatement.netProfit, '400.00');
  assert.equal(response.body.data.balanceSheet.assets, '400.00');
  assert.equal(response.body.data.balanceSheet.liabilitiesAndEquity, '400.00');
  record('REAL-WP08-003 试算平衡、利润表和资产负债表可复算', { profit: '400.00', balance: 'balanced' });

  response = await request(`/api/v1/fin/periods/${periodId}/reopen`, { method: 'POST', token: adminToken, key: 'WP08-TAX-PERIOD-REOPEN', body: {} });
  assert.equal(response.status, 200, response.text);
  response = await request('/api/v1/fin/tax-rates', { method: 'POST', token: adminToken, body: { taxCode: 'VAT12', rate: 0.12, effectiveFrom: '2026-01-01' } });
  assert.equal(response.status, 201, response.text);
  response = await request('/api/v1/fin/tax-transactions', { method: 'POST', token: adminToken, key: 'WP08-TAX-1', body: { transactionDate: '2026-11-15', direction: 'output', sourceType: 'sales_order', sourceId: 'WP08-SO', taxCode: 'VAT12', netAmount: 1000, birForm: '2550Q' } });
  assert.equal(response.status, 201, response.text);
  assert.equal(response.body.data.tax_amount, '120.00');
  response = await request(`/api/v1/fin/periods/${periodId}/close`, { method: 'POST', token: adminToken, key: 'WP08-TAX-PERIOD-CLOSE', body: {} });
  assert.equal(response.status, 200, response.text);
  response = await request('/api/v1/fin/tax-report?from=2026-01-01&to=2026-12-31&birForm=2550Q', { token: adminToken });
  assert.equal(response.status, 200, response.text);
  assert.equal(response.body.data.totals.tax, '120.00');
  record('REAL-WP08-004 BIR税率、税务交易和2550Q报表闭环', { tax: '120.00' });

  response = await request('/api/v1/fin/aging-export?type=ar&asOf=2027-01-01&locale=zh-CN', { token: adminToken });
  assert.equal(response.status, 200, response.text);
  assert.match(response.text, /应收账龄表/);
  response = await request('/api/v1/fin/tax-report-export?from=2026-01-01&to=2026-12-31&birForm=2550Q&locale=zh-CN', { token: adminToken });
  assert.equal(response.status, 200, response.text);
  assert.match(response.text, /BIR税务报表/);
  response = await request('/api/v1/fin/financial-statements-export?asOf=2026-12-31&locale=en-US', { token: adminToken });
  assert.equal(response.status, 200, response.text);
  assert.match(response.text, /Financial Statements/);
  response = await request('/api/v1/fin/financial-statements-export?asOf=2026-12-31&locale=en-US', { token: staffToken });
  assert.equal(response.status, 403, response.text);
  record('REAL-WP08-005 多语言CSV导出与非授权角色阻断', { staffExport: 403 });

  await new Promise((resolve) => server.close(resolve));
  await admin.end();
  console.log(JSON.stringify({ result: 'passed', evidence: evidence.length, items: evidence }, null, 2));
} finally {
  await redis.quit();
  await pool.end();
}
