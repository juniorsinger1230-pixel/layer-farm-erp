import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../dist/apps/api/src/app.js';
import { AuthService, InMemoryAuthStore, generateMfaSecret, totp } from '../dist/packages/security/src/auth.js';

const password = 'Synthetic-Test-Passw0rd!2026';
const signingKey = 'test-only-signing-key-with-at-least-32-bytes';
class TestPool {
  constructor(db) { this.db = db; this.tail = Promise.resolve(); }
  query(text, values) { return this.db.query(text, values); }
  async connect() {
    let releaseLease;
    const lease = new Promise((resolve) => { releaseLease = resolve; });
    const previous = this.tail;
    this.tail = previous.then(() => lease);
    await previous;
    return { query: (text, values) => this.db.query(text, values), release: () => releaseLease() };
  }
}

async function fixture() {
  const db = new PGlite();
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8').replaceAll('CONCURRENTLY', ''));
  await db.query("SELECT set_config('app.actor_id','BOOTSTRAP',false),set_config('app.company_code','*',false),set_config('app.company_id','0',false)");
  await db.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('THL','Synthetic THL','PHP','active','BOOTSTRAP'),('TGE','Synthetic TGE','PHP','active','BOOTSTRAP')");
  const store = new InMemoryAuthStore();
  const auth = new AuthService(store, { issuer: 'layer-farm-test', audience: 'layer-farm-api', signingKey });
  const mfaSecret = generateMfaSecret();
  await auth.register('admin.inventory', password, { employeeId: 1, employeeNo: 'ADMIN-1', companyCode: 'THL', companyId: 1, mfaEnrolled: true, roles: [{ role: 'admin' }] }, mfaSecret);
  const app = createApp({ config: { nodeEnv: 'test', port: 3100, bodyLimitBytes: 8192, externalIntegrationsEnabled: false }, auth, database: new TestPool(db) });
  const login = await app.request('/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account: 'admin.inventory', password, companyCode: 'THL', mfaCode: totp(mfaSecret) }) });
  const tokens = (await login.json()).data;
  const call = (method, path, body, key = `KEY-${crypto.randomUUID()}`) => app.request(path, { method, headers: { authorization: `Bearer ${tokens.accessToken}`, 'content-type': 'application/json', 'idempotency-key': key }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const create = async (path, body) => { const response = await call('POST', path, body); assert.equal(response.status, 201, await response.clone().text()); return (await response.json()).data; };
  const material = await create('/api/v1/inv/materials', { material_code: 'EGG-001', material_name: 'Synthetic Egg', category: 'egg', pack_uom: 'tray', uom: 'egg' });
  const supplier = await create('/api/v1/proc/suppliers', { supplier_code: 'SUP-1', supplier_name: 'Synthetic Supplier', material_id: material.id, status: 'active' });
  const warehouse = await create('/api/v1/inv/stock-locations', { warehouse_code: 'WH-01', warehouse_name: 'Egg Warehouse', location_code: 'L-01' });
  const price = await create('/api/v1/sales/price-lists', { price_list_code: 'PRICE-1', price_type: 'standard', product_name: 'Synthetic Egg', price: 30, effective_date: '2026-01-01' });
  const customerInsert = await db.query("INSERT INTO app.customer (customer_code,customer_name,address,payment_term,credit_ref,price_id,status,company_code,created_by) VALUES ('CUS-1','Synthetic Customer','Synthetic Address',30,0,$1,'active','THL','BOOTSTRAP') RETURNING id", [price.id]);
  const customer = { id: Number(customerInsert.rows[0].id) };
  await db.query("INSERT INTO app.credit_limit (customer_id,credit_amount,occupied_amount,over_limit_block,ceo_approval,company_code,created_by) VALUES ($1,10000,0,true,'not_required','THL','BOOTSTRAP')", [customer.id]);
  async function purchaseReceipt(suffix, qty, priceValue) {
    const order = await create('/api/v1/proc/purchase-orders', { order_no: `PO-${suffix}`, supplier_id: supplier.id, material_id: material.id, quantity: qty, price: priceValue, execution_close: 'open' });
    const receipt = await create('/api/v1/proc/receipt-inspections', { receipt_no: `GR-${suffix}`, order_id: order.id, quantity: qty, quality_status: 'accepted', difference: 0 });
    return { order, receipt };
  }
  async function receive(receipt, batchNo, expiryDate, unitCost, extra = {}) {
    const response = await call('POST', `/api/v1/proc/receipt-inspections/${receipt.id}/actions`, { action: 'receive', batchNo, warehouseId: warehouse.id, locationId: warehouse.id, productionDate: '2026-01-01', expiryDate, unitCost, ...extra }, `IDEM-RECEIVE-${receipt.id}-${batchNo}`);
    assert.equal(response.status, 200, await response.clone().text());
    return (await response.json()).data;
  }
  async function salesOrder(suffix) {
    return create('/api/v1/sales/sales-orders', { order_no: `SO-${suffix}`, customer_id: customer.id, order_mode: 'standard', inventory_quantity: 0, status: 'approved' });
  }
  return { db, app, tokens, call, create, material, supplier, warehouse, price, customer, purchaseReceipt, receive, salesOrder };
}

test('双计量收货、FEFO预占、移动加权和销售出库全链路一致', async () => {
  const f = await fixture();
  const first = await f.purchaseReceipt('001', 100, 10);
  const second = await f.purchaseReceipt('002', 100, 20);
  const receivedA = await f.receive(first.receipt, 'BATCH-A', '2026-12-01', 10, { packQuantity: 10, unitsPerPack: 10 });
  assert.equal(receivedA.movingAverageCost, '10.0000');
  await f.receive(second.receipt, 'BATCH-B', '2027-01-01', 20);
  const order = await f.salesOrder('001');
  const reserveInput = { action: 'allocate', lines: [{ materialId: f.material.id, quantity: 120, uom: 'egg', unitPrice: 30 }] };
  const reservedResponse = await f.call('POST', `/api/v1/sales/sales-orders/${order.id}/actions`, reserveInput, 'IDEM-RESERVE-001');
  assert.equal(reservedResponse.status, 200, await reservedResponse.clone().text());
  const reserved = (await reservedResponse.json()).data;
  assert.equal(reserved.allocations.length, 2);
  assert.equal(reserved.allocations[0].batchNo, 'BATCH-A');
  assert.equal(Number(reserved.allocations[0].quantity), 100);
  assert.equal(Number(reserved.allocations[1].quantity), 20);
  const replay = await f.call('POST', `/api/v1/sales/sales-orders/${order.id}/actions`, reserveInput, 'IDEM-RESERVE-001');
  assert.equal(replay.status, 200);
  const issuedResponse = await f.call('POST', `/api/v1/sales/sales-orders/${order.id}/actions`, { action: 'ship' }, 'IDEM-ISSUE-001');
  assert.equal(issuedResponse.status, 200, await issuedResponse.clone().text());
  await f.call('POST', `/api/v1/sales/sales-orders/${order.id}/actions`, { action: 'ship' }, 'IDEM-ISSUE-001');
  const positions = await f.call('GET', `/api/v1/inv/stock-positions?materialId=${f.material.id}`);
  const stock = (await positions.json()).data.items;
  assert.equal(stock.find((row) => row.batch_no === 'BATCH-A').available, 0);
  assert.equal(stock.find((row) => row.batch_no === 'BATCH-B').available, 80);
  assert.equal(Number((await f.db.query("SELECT count(*)::int AS n FROM app_ops.inventory_movement WHERE movement_type='sales_issue'")).rows[0].n), 2);
  assert.equal(Number((await f.db.query("SELECT occupied_amount FROM app.credit_limit WHERE customer_id=$1", [f.customer.id])).rows[0].occupied_amount), 3600);
  await f.db.close();
});

test('信用额度不足会回滚全部FEFO预占', async () => {
  const f = await fixture();
  const purchase = await f.purchaseReceipt('001', 100, 10);
  await f.receive(purchase.receipt, 'BATCH-A', '2026-12-01', 10);
  await f.db.query('UPDATE app.credit_limit SET credit_amount=100 WHERE customer_id=$1', [f.customer.id]);
  const order = await f.salesOrder('CREDIT');
  const response = await f.call('POST', `/api/v1/sales/sales-orders/${order.id}/actions`, { action: 'allocate', lines: [{ materialId: f.material.id, quantity: 10, uom: 'egg', unitPrice: 30 }] }, 'IDEM-RESERVE-CREDIT');
  assert.equal(response.status, 409);
  assert.equal(Number((await f.db.query('SELECT count(*)::int AS n FROM app_ops.inventory_reservation')).rows[0].n), 0);
  assert.equal(Number((await f.db.query('SELECT count(*)::int AS n FROM app_ops.sales_order_line')).rows[0].n), 0);
  await f.db.close();
});

test('同批次两次收货按数量重算移动加权平均成本', async () => {
  const f = await fixture();
  const first = await f.purchaseReceipt('001', 100, 10);
  const second = await f.purchaseReceipt('002', 100, 20);
  await f.receive(first.receipt, 'BATCH-A', '2026-12-01', 10);
  const secondReceipt = await f.receive(second.receipt, 'BATCH-A', '2026-12-01', 20);
  assert.equal(secondReceipt.movingAverageCost, '15.0000');
  const positions = await f.call('GET', `/api/v1/inv/stock-positions?materialId=${f.material.id}`);
  const item = (await positions.json()).data.items[0];
  assert.equal(Number(item.on_hand), 200);
  assert.equal(Number(item.unit_cost), 15);
  await f.db.close();
});

test('并发争抢库存最多一个订单成功且库存不为负', async () => {
  const f = await fixture();
  const purchase = await f.purchaseReceipt('001', 100, 10);
  await f.receive(purchase.receipt, 'BATCH-A', '2026-12-01', 10);
  const [order1, order2] = await Promise.all([f.salesOrder('RACE-1'), f.salesOrder('RACE-2')]);
  const reserve = (order, key) => f.call('POST', `/api/v1/sales/sales-orders/${order.id}/actions`, { action: 'allocate', lines: [{ materialId: f.material.id, quantity: 80, uom: 'egg', unitPrice: 20 }] }, key);
  const results = await Promise.allSettled([reserve(order1, 'IDEM-RACE-001'), reserve(order2, 'IDEM-RACE-002')]);
  assert.equal(results.filter((result) => result.status === 'fulfilled' && result.value.status === 200).length, 1);
  const positions = await f.call('GET', `/api/v1/inv/stock-positions?materialId=${f.material.id}`);
  const item = (await positions.json()).data.items[0];
  assert.equal(item.available, 20);
  assert.equal(Number(item.on_hand), 100);
  await f.db.close();
});

test('盘点明细批准后调整台账估值并保留移动记录', async () => {
  const f = await fixture();
  const purchase = await f.purchaseReceipt('001', 100, 10);
  const received = await f.receive(purchase.receipt, 'BATCH-A', '2026-12-01', 10);
  const stocktake = await f.create('/api/v1/inv/stock-counts', { stocktake_no: 'ST-001', book_quantity: 100, actual_quantity: 100, difference: 0, approval_status: 'draft' });
  const lines = await f.call('POST', `/api/v1/inv/stock-counts/${stocktake.id}/lines`, { lines: [{ inventoryId: received.inventoryId, actualQuantity: 95 }] }, 'IDEM-STOCKTAKE-L1');
  assert.equal(lines.status, 200, await lines.text());
  await f.call('POST', `/api/v1/inv/stock-counts/${stocktake.id}/actions`, { action: 'submit' });
  const approved = await f.call('POST', `/api/v1/inv/stock-counts/${stocktake.id}/actions`, { action: 'approve' });
  assert.equal(approved.status, 200, await approved.text());
  const positions = await f.call('GET', `/api/v1/inv/stock-positions?materialId=${f.material.id}`);
  assert.equal((await positions.json()).data.items[0].available, 95);
  assert.equal(Number((await f.db.query("SELECT quantity FROM app_ops.inventory_movement WHERE movement_type='adjustment'")).rows[0].quantity), -5);
  await f.db.close();
});

test('小额折扣自动批准并在预占、出库和应收中按净额执行', async () => {
  const f = await fixture();
  const purchase = await f.purchaseReceipt('DISC-1', 100, 10);
  await f.receive(purchase.receipt, 'DISC-BATCH-A', '2026-12-01', 10);
  const order = await f.salesOrder('DISC-AUTO');
  const discountResponse = await f.call('POST', `/api/v1/sales/sales-orders/${order.id}/discount`, { discountPercent: 3, reason: 'Loyalty discount' }, 'IDEM-DISC-AUTO');
  const discountText = await discountResponse.text();
  assert.equal(discountResponse.status, 201, discountText);
  const discount = JSON.parse(discountText).data;
  assert.equal(discount.status, 'approved');

  const reserveResponse = await f.call('POST', `/api/v1/sales/sales-orders/${order.id}/actions`, { action: 'allocate', lines: [{ materialId: f.material.id, quantity: 10, uom: 'egg', unitPrice: 30 }] }, 'IDEM-DISC-AUTO-RESERVE');
  const reserveText = await reserveResponse.text();
  assert.equal(reserveResponse.status, 200, reserveText);
  const reserved = JSON.parse(reserveText).data;
  assert.equal(reserved.totalAmount, '291.00');
  const shipResponse = await f.call('POST', `/api/v1/sales/sales-orders/${order.id}/actions`, { action: 'ship' }, 'IDEM-DISC-AUTO-SHIP');
  assert.equal(shipResponse.status, 200, await shipResponse.text());
  const receivable = await f.db.query('SELECT receivable_balance FROM app.receivable WHERE order_id=$1', [order.id]);
  assert.equal(receivable.rows[0].receivable_balance, '291.00');
  await f.db.close();
});

test('超过自动批准阈值的折扣审批通过后才允许预占并按净额入账', async () => {
  const f = await fixture();
  const purchase = await f.purchaseReceipt('DISC-2', 100, 10);
  await f.receive(purchase.receipt, 'DISC-BATCH-B', '2026-12-01', 10);
  const order = await f.salesOrder('DISC-APPROVE');
  const requestResponse = await f.call('POST', `/api/v1/sales/sales-orders/${order.id}/discount`, { discountPercent: 10, reason: 'volume discount' }, 'IDEM-DISC-REQUEST');
  const requestText = await requestResponse.text();
  assert.equal(requestResponse.status, 201, requestText);
  const requested = JSON.parse(requestText).data;
  assert.equal(requested.status, 'pending');

  const blockedReserve = await f.call('POST', `/api/v1/sales/sales-orders/${order.id}/actions`, { action: 'allocate', lines: [{ materialId: f.material.id, quantity: 10, uom: 'egg', unitPrice: 30 }] }, 'IDEM-DISC-BLOCKED');
  assert.equal(blockedReserve.status, 409);

  const reviewResponse = await f.call('POST', `/api/v1/sales/discount-approvals/${requested.id}/actions`, { action: 'approve', note: 'approved' }, 'IDEM-DISC-REVIEW');
  assert.equal(reviewResponse.status, 200, await reviewResponse.text());
  const reserveResponse = await f.call('POST', `/api/v1/sales/sales-orders/${order.id}/actions`, { action: 'allocate', lines: [{ materialId: f.material.id, quantity: 10, uom: 'egg', unitPrice: 30 }] }, 'IDEM-DISC-APPROVED-RESERVE');
  const reserveText = await reserveResponse.text();
  assert.equal(reserveResponse.status, 200, reserveText);
  const reserved = JSON.parse(reserveText).data;
  assert.equal(reserved.totalAmount, '270.00');
  await f.call('POST', `/api/v1/sales/sales-orders/${order.id}/actions`, { action: 'ship' }, 'IDEM-DISC-APPROVED-SHIP');
  const receivable = await f.db.query('SELECT receivable_balance FROM app.receivable WHERE order_id=$1', [order.id]);
  assert.equal(receivable.rows[0].receivable_balance, '270.00');
  await f.db.close();
});

test('折扣被驳回后预占按原价执行，且重复申请和超额折扣被阻断', async () => {
  const f = await fixture();
  const purchase = await f.purchaseReceipt('DISC-3', 100, 10);
  await f.receive(purchase.receipt, 'DISC-BATCH-C', '2026-12-01', 10);
  const order = await f.salesOrder('DISC-REJECT');
  const requestResponse = await f.call('POST', `/api/v1/sales/sales-orders/${order.id}/discount`, { discountPercent: 12, reason: 'requested discount' }, 'IDEM-DISC-REJECT-REQUEST');
  const requested = (await requestResponse.json()).data;
  const rejectResponse = await f.call('POST', `/api/v1/sales/discount-approvals/${requested.id}/actions`, { action: 'reject', note: 'not allowed' }, 'IDEM-DISC-REJECT-REVIEW');
  assert.equal(rejectResponse.status, 200, await rejectResponse.text());
  const reserveResponse = await f.call('POST', `/api/v1/sales/sales-orders/${order.id}/actions`, { action: 'allocate', lines: [{ materialId: f.material.id, quantity: 10, uom: 'egg', unitPrice: 30 }] }, 'IDEM-DISC-REJECT-RESERVE');
  const reserveText = await reserveResponse.text();
  assert.equal(reserveResponse.status, 200, reserveText);
  assert.equal(JSON.parse(reserveText).data.totalAmount, '300.00');

  const duplicate = await f.call('POST', `/api/v1/sales/sales-orders/${order.id}/discount`, { discountPercent: 5, reason: 'duplicate' }, 'IDEM-DISC-DUPLICATE');
  assert.equal(duplicate.status, 409);
  const otherOrder = await f.salesOrder('DISC-TOO-HIGH');
  const tooHigh = await f.call('POST', `/api/v1/sales/sales-orders/${otherOrder.id}/discount`, { discountPercent: 30, reason: 'too high' }, 'IDEM-DISC-TOO-HIGH');
  assert.equal(tooHigh.status, 400);
  await f.db.close();
});
