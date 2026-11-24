import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { ProcurementService } from '../dist/packages/domain/src/procurement.js';
import { SalesService } from '../dist/packages/domain/src/sales.js';
import { FinanceService } from '../dist/packages/domain/src/finance.js';
import { FlockCostService } from '../dist/packages/domain/src/flock-cost.js';

class Pool { constructor(db) { this.db = db; } query(q, v) { return this.db.query(q, v); } async connect() { return { query: (q, v) => this.db.query(q, v), release: () => {} }; } }
const context = { actorId: 'TEST', employeeId: 1, companyCode: 'THL', companyId: 1 };
async function fixture() {
  const db = new PGlite();
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8').replaceAll('CONCURRENTLY', ''));
  await db.query("SELECT set_config('app.actor_id','TEST',false),set_config('app.company_code','*',false),set_config('app.company_id','0',false)");
  await db.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('THL','Synthetic','PHP','active','TEST')");
  await db.query("SELECT set_config('app.company_code','THL',false),set_config('app.company_id','1',false)");
  return { db, pool: new Pool(db) };
}
async function customer(db) {
  await db.query("INSERT INTO app.price_list (price_list_code,price_type,product_name,price,effective_date,company_code,created_by) VALUES ('P1','standard','Bird',20,'2026-01-01','THL','TEST')");
  const result = await db.query("INSERT INTO app.customer (customer_code,customer_name,address,payment_term,credit_ref,price_id,status,company_code,created_by) VALUES ('C1','Customer','Address',30,0,1,'active','THL','TEST') RETURNING id");
  await db.query("INSERT INTO app.credit_limit (customer_id,credit_amount,occupied_amount,over_limit_block,ceo_approval,company_code,created_by) VALUES ($1,10000,1000,true,'not_required','THL','TEST')", [result.rows[0].id]);
  return Number(result.rows[0].id);
}

test('供应商账号绑定后仅见本供应商订单并按确认交期提交限量ASN', async () => {
  const f = await fixture();
  const material = await f.db.query("INSERT INTO app.material (material_code,material_name,category,uom,company_code,created_by) VALUES ('MAT-1','Feed','feed','kg','THL','TEST') RETURNING id");
  const supplier = await f.db.query("INSERT INTO app.supplier (supplier_code,supplier_name,material_id,status,company_code,created_by) VALUES ('SUP-1','Supplier',$1,'active','THL','TEST') RETURNING id", [material.rows[0].id]);
  await f.db.query("INSERT INTO app.organization_unit (unit_code,unit_name,org_level,status,company_code,created_by) VALUES ('U1','Unit',1,'active','THL','TEST')");
  await f.db.query("INSERT INTO app.position (position_code,position_name,unit_id,headcount,effective_date,status,company_code,created_by) VALUES ('P1','Buyer',1,2,'2026-01-01','active','THL','TEST')");
  await f.db.query("INSERT INTO app.employee (employee_no,employee_name,position_id,account,employment_status,company_code,created_by) VALUES ('E1','Supplier User',1,0,'active','THL','TEST'),('E2','Other User',1,0,'active','THL','TEST')");
  const service = new ProcurementService(f.pool, context);
  await service.bindSupplier({ employeeId: 1, supplierId: Number(supplier.rows[0].id) });
  const order = await f.db.query("INSERT INTO app.purchase_order (order_no,supplier_id,material_id,quantity,price,execution_close,company_code,created_by) VALUES ('PO-PORTAL',$1,$2,100,10,'open','THL','TEST') RETURNING id", [supplier.rows[0].id, material.rows[0].id]);
  assert.equal((await service.portalOrders()).total, 1);
  const delivery = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  await service.confirmPortalOrder(Number(order.rows[0].id), { confirmedDeliveryDate: delivery, note: 'confirmed' }, 'PORTAL-CONFIRM-001');
  const asn = await service.createPortalAsn({ purchaseOrderId: Number(order.rows[0].id), asnNo: 'ASN-1', quantity: 60, batchNo: 'B-1', productionDate: '2026-01-01', expiryDate: '2027-01-01' }, 'PORTAL-ASN-001');
  assert.equal(Number(asn.quantity), 60);
  await assert.rejects(() => service.createPortalAsn({ purchaseOrderId: Number(order.rows[0].id), asnNo: 'ASN-2', quantity: 50, batchNo: 'B-2', productionDate: '2026-01-01', expiryDate: '2027-01-01' }, 'PORTAL-ASN-002'), /超过采购订单数量/);
  assert.equal(Number((await f.db.query('SELECT sum(quantity)::numeric AS quantity FROM app_ops.supplier_asn')).rows[0].quantity), 60);
  await f.db.query("INSERT INTO app.warehouse_location (warehouse_code,warehouse_name,location_code,company_code,created_by) VALUES ('WH-ASN','Synthetic Warehouse','LOC-ASN',1,'TEST')");
  const received = await service.receivePortalAsn(Number(asn.id), { warehouseId: 1, locationId: 1, qualityStatus: 'accepted' }, 'PORTAL-ASN-RECEIVE-001');
  assert.equal(received.status, 'received');
  assert.equal(Number((await f.db.query("SELECT quantity FROM app.inventory_ledger WHERE batch_no='B-1'")).rows[0].quantity), 60);
  assert.equal(Number((await f.db.query('SELECT payable_balance FROM app.payable WHERE goods_receipt_id=$1', [received.goodsReceiptId])).rows[0].payable_balance), 600);
  assert.equal((await f.db.query("SELECT execution_close FROM app.purchase_order WHERE id=$1", [order.rows[0].id])).rows[0].execution_close, 'partial');
  const secondAsn = await service.createPortalAsn({ purchaseOrderId: Number(order.rows[0].id), asnNo: 'ASN-REJECT', quantity: 40, batchNo: 'B-REJECT', productionDate: '2026-01-01', expiryDate: '2027-01-01' }, 'PORTAL-ASN-REJECT-001');
  const rejected = await service.receivePortalAsn(Number(secondAsn.id), { warehouseId: 1, locationId: 1, qualityStatus: 'rejected' }, 'PORTAL-ASN-REJECT-002');
  assert.equal(rejected.status, 'rejected');
  assert.equal(Number((await f.db.query("SELECT count(*)::int AS n FROM app.inventory_ledger WHERE batch_no='B-REJECT'")).rows[0].n), 0);
  assert.equal(Number((await f.db.query('SELECT count(*)::int AS n FROM app.payable WHERE goods_receipt_id=$1', [rejected.goodsReceiptId])).rows[0].n), 0);
  const other = new ProcurementService(f.pool, { ...context, employeeId: 2 });
  await assert.rejects(() => other.portalOrders(), /未绑定有效供应商/);
  await f.db.close();
});

test('淘汰鸡销售原子扣减存栏并生成应收和可复算毛利', async () => {
  const f = await fixture();
  const customerId = await customer(f.db);
  const batch = await f.db.query("INSERT INTO app.farm_batch (batch_no,breed,source,chick_date,initial_quantity,day_age,stage,company_code,created_by) VALUES ('FB-1','Lohmann Pink','Synthetic','2026-01-01',100,326,'laying','THL','TEST') RETURNING id");
  await f.db.query('INSERT INTO app_ops.flock_position (batch_id,house_id,company_code,quantity) VALUES ($1,1,\'THL\',100)', [batch.rows[0].id]);
  const sales = new SalesService(f.pool, context);
  const input = { saleNo: 'CULL-1', saleType: 'cull', customerId, flockBatchId: Number(batch.rows[0].id), quantity: 40, unitPrice: 20, unitCost: 12, saleDate: '2026-11-23' };
  const sale = await sales.createLivestockSale(input, 'LIVESTOCK-SALE-001');
  assert.equal(Number(sale.remainingFlock), 60);
  assert.equal(Number((await f.db.query('SELECT receivable_balance FROM app.receivable')).rows[0].receivable_balance), 800);
  assert.equal(Number((await f.db.query('SELECT occupied_amount FROM app.credit_limit')).rows[0].occupied_amount), 1800);
  await sales.createLivestockSale(input, 'LIVESTOCK-SALE-001');
  assert.equal(Number((await f.db.query('SELECT count(*)::int AS n FROM app_ops.livestock_sale_execution')).rows[0].n), 1);
  const finance = new FinanceService(f.pool, context);
  const profit = await finance.salesProfit(Number(sale.sales_order_id));
  assert.equal(profit.netRevenue, '800.00');
  assert.equal(profit.cogs, '480.00');
  assert.equal(profit.grossProfit, '320.00');
  const csv = await finance.salesProfitCsv(Number(sale.sales_order_id), 'en-US');
  assert.ok(csv.includes('Sales Batch Profitability'));
  assert.ok(csv.includes('"320.00"'));
  await assert.rejects(() => sales.createLivestockSale({ ...input, saleNo: 'CULL-2', quantity: 61 }, 'LIVESTOCK-SALE-002'), /超过鸡群当前存栏/);
  await f.db.close();
});

test('批次毛利扣除退货收入与退回成本且导出防止公式注入', async () => {
  const f = await fixture(); const customerId = await customer(f.db);
  const order = await f.db.query("INSERT INTO app.sales_order (order_no,customer_id,order_mode,inventory_quantity,status,company_code,created_by) VALUES ('SO-PROFIT',$1,'standard',100,'returned_partial','THL','TEST') RETURNING id", [customerId]);
  const orderId = Number(order.rows[0].id);
  const material = await f.db.query("INSERT INTO app.material (material_code,material_name,category,uom,company_code,created_by) VALUES ('M1','Egg','egg','egg','THL','TEST') RETURNING id");
  await f.db.query('INSERT INTO app_ops.sales_order_line (company_id,sales_order_id,line_no,material_id,quantity,uom,unit_price,line_amount) VALUES (1,$1,1,$2,100,\'egg\',10,1000)', [orderId, material.rows[0].id]);
  await f.db.query("INSERT INTO app_ops.inventory_movement (movement_id,company_id,material_id,batch_no,warehouse_id,location_id,movement_type,quantity,unit_cost,source_type,source_id,idempotency_key) VALUES (gen_random_uuid(),1,$1,'B1',1,1,'sales_issue',-100,5,'sales_order',$2,'ISSUE-1')", [material.rows[0].id, String(orderId)]);
  await f.db.query("INSERT INTO app_ops.sales_return_execution (return_no,company_id,sales_order_id,original_reservation_id,quantity,credit_amount,reason,created_by) VALUES ('SR-PROFIT',1,$1,1,20,200,'broken','TEST')", [orderId]);
  await f.db.query("INSERT INTO app_ops.inventory_movement (movement_id,company_id,material_id,batch_no,warehouse_id,location_id,movement_type,quantity,unit_cost,source_type,source_id,idempotency_key) VALUES (gen_random_uuid(),1,$1,'B1',1,1,'receipt',20,5,'sales_return','SR-PROFIT','RETURN-1')", [material.rows[0].id]);
  const finance = new FinanceService(f.pool, context);
  const profit = await finance.salesProfit(orderId);
  assert.equal(profit.netRevenue, '800.00'); assert.equal(profit.cogs, '400.00'); assert.equal(profit.grossProfit, '400.00'); assert.equal(profit.marginRate, '0.500000');
  await f.db.query('UPDATE app.sales_order SET order_no=$1 WHERE id=$2', ['=FORMULA', orderId]);
  const csv = await finance.salesProfitCsv(orderId, 'zh-CN');
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=FORMULA"'));
  assert.ok(csv.includes('销售批次毛利表'));
  await f.db.close();
});

test('鸡群成本归集后自动核算禽苗销售成本并滚动剩余批次成本', async () => {
  const f = await fixture(); const customerId = await customer(f.db);
  const batch = await f.db.query("INSERT INTO app.farm_batch (batch_no,breed,source,chick_date,initial_quantity,day_age,stage,company_code,created_by) VALUES ('FB-COST','Lohmann Pink','Synthetic','2026-01-01',100,1,'brooding','THL','TEST') RETURNING id");
  const batchId = Number(batch.rows[0].id);
  await f.db.query('INSERT INTO app_ops.flock_position (batch_id,house_id,company_code,quantity) VALUES ($1,1,\'THL\',100)', [batchId]);
  const costs = new FlockCostService(f.pool, context);
  const posted = await costs.post(batchId, { costType: 'chick', amount: 1200, sourceType: 'chick_receipt', sourceId: 'CR-COST-1', incurredOn: '2026-01-01' }, 'FLOCK-COST-001');
  assert.equal(posted.snapshot.unit_cost, '12.0000');
  const sales = new SalesService(f.pool, context);
  const sale = await sales.createLivestockSale({ saleNo: 'CHICK-AUTO-COST', saleType: 'chick', customerId, flockBatchId: batchId, quantity: 40, unitPrice: 20, saleDate: '2026-11-23' }, 'CHICK-AUTO-COST-001');
  assert.equal(Number(sale.unit_cost), 12);
  assert.equal(Number((await f.db.query('SELECT accumulated_cost FROM app_ops.flock_cost_snapshot WHERE batch_id=$1', [batchId])).rows[0].accumulated_cost), 720);
  const reposted = await costs.post(batchId, { costType: 'feed', amount: 600, sourceType: 'feeding', sourceId: 'FEED-COST-1', incurredOn: '2026-11-23' }, 'FLOCK-COST-002');
  assert.equal(reposted.snapshot.unit_cost, '22.0000');
  const detail = await costs.get(batchId);
  assert.equal(detail.total, 2);
  const secondSale = await sales.createLivestockSale({ saleNo: 'CHICK-AUTO-COST-2', saleType: 'chick', customerId, flockBatchId: batchId, quantity: 10, unitPrice: 30, saleDate: '2026-11-23' }, 'CHICK-AUTO-COST-002');
  assert.equal(Number(secondSale.unit_cost), 22);
  assert.equal(Number((await f.db.query('SELECT accumulated_cost FROM app_ops.flock_cost_snapshot WHERE batch_id=$1', [batchId])).rows[0].accumulated_cost), 1100);
  const noCostBatch = await f.db.query("INSERT INTO app.farm_batch (batch_no,breed,source,chick_date,initial_quantity,day_age,stage,company_code,created_by) VALUES ('FB-NO-COST','Lohmann Pink','Synthetic','2026-01-01',10,1,'brooding','THL','TEST') RETURNING id");
  await f.db.query('INSERT INTO app_ops.flock_position (batch_id,house_id,company_code,quantity) VALUES ($1,1,\'THL\',10)', [noCostBatch.rows[0].id]);
  await assert.rejects(() => sales.createLivestockSale({ saleNo: 'NO-COST', saleType: 'chick', customerId, flockBatchId: Number(noCostBatch.rows[0].id), quantity: 1, unitPrice: 20, saleDate: '2026-11-23' }, 'NO-COST-KEY-001'), /成本快照/);
  await f.db.close();
});
