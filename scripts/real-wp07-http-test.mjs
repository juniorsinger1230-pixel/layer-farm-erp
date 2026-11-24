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
const record = (name, detail) => {
  evidence.push({ name, result: 'passed', ...detail });
  console.log(JSON.stringify(evidence.at(-1)));
};

try {
  const admin = new pg.Client({ connectionString: databaseUrl });
  await admin.connect();
  await admin.query("SELECT set_config('app.company_code','*',false), set_config('app.company_id','0',false), set_config('app.actor_id','REAL-WP07',false)");

  if ((await admin.query('SELECT id FROM app.company WHERE company_code=$1', ['THL'])).rowCount === 0) {
    await admin.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('THL','Synthetic THL','PHP','active','REAL-WP07')");
  }
  const company = await admin.query("SELECT id FROM app.company WHERE company_code='THL'");
  const companyId = Number(company.rows[0].id);

  if ((await admin.query('SELECT id FROM app.organization_unit WHERE unit_code=$1', ['WP07-UNIT'])).rowCount === 0) {
    await admin.query("INSERT INTO app.organization_unit (unit_code,unit_name,parent_unit_id,org_level,status,company_code,created_by) VALUES ('WP07-UNIT','WP07 Logistics',null,1,'active','THL','REAL-WP07')");
  }
  const unit = await admin.query("SELECT id FROM app.organization_unit WHERE unit_code='WP07-UNIT'");
  if ((await admin.query('SELECT id FROM app.position WHERE position_code=$1', ['WP07-POS'])).rowCount === 0) {
    await admin.query("INSERT INTO app.position (position_code,position_name,unit_id,headcount,reports_to_id,effective_date,status,company_code,created_by) VALUES ('WP07-POS','WP07 Staff',$1,10,null,'2026-01-01','active','THL','REAL-WP07')", [unit.rows[0].id]);
  }
  const position = await admin.query("SELECT id FROM app.position WHERE position_code='WP07-POS'");

  const employees = {};
  for (const [key, no] of Object.entries({ admin: 'WP07-EMP-ADMIN', staff: 'WP07-EMP-STAFF', driver: 'WP07-DRV', courier: 'WP07-COU' })) {
    const existing = await admin.query('SELECT id FROM app.employee WHERE employee_no=$1', [no]);
    if (existing.rowCount === 0) {
      const inserted = await admin.query("INSERT INTO app.employee (employee_no,employee_name,position_id,account,employment_status,company_code,created_by) VALUES ($1,$2,$3,0,'active','THL','REAL-WP07') RETURNING id", [no, key, position.rows[0].id]);
      employees[key] = Number(inserted.rows[0].id);
    } else {
      employees[key] = Number(existing.rows[0].id);
    }
  }

  if ((await admin.query('SELECT id FROM app.price_list WHERE price_list_code=$1', ['WP07-PRICE'])).rowCount === 0) {
    await admin.query("INSERT INTO app.price_list (price_list_code,price_type,product_name,price,effective_date,company_code,created_by) VALUES ('WP07-PRICE','standard','Synthetic Eggs',30,'2026-01-01','THL','REAL-WP07')");
  }
  const price = await admin.query("SELECT id FROM app.price_list WHERE price_list_code='WP07-PRICE'");
  if ((await admin.query('SELECT id FROM app.customer WHERE customer_code=$1', ['WP07-CUS'])).rowCount === 0) {
    await admin.query("INSERT INTO app.customer (customer_code,customer_name,address,payment_term,credit_ref,price_id,status,company_code,created_by) VALUES ('WP07-CUS','WP07 Customer','Synthetic address',30,0,$1,'active','THL','REAL-WP07')", [price.rows[0].id]);
  }
  const customer = await admin.query("SELECT id FROM app.customer WHERE customer_code='WP07-CUS'");
  const customerId = Number(customer.rows[0].id);
  if ((await admin.query('SELECT id FROM app.credit_limit WHERE customer_id=$1', [customerId])).rowCount === 0) {
    await admin.query("INSERT INTO app.credit_limit (customer_id,credit_amount,occupied_amount,over_limit_block,ceo_approval,company_code,created_by) VALUES ($1,10000,0,true,'not_required','THL','REAL-WP07')", [customerId]);
  }

  if ((await admin.query('SELECT id FROM app.material WHERE material_code=$1', ['WP07-MAT'])).rowCount === 0) {
    await admin.query("INSERT INTO app.material (material_code,material_name,category,uom,company_code,created_by) VALUES ('WP07-MAT','WP07 Feed','feed','kg','THL','REAL-WP07')");
  }
  const material = await admin.query("SELECT id FROM app.material WHERE material_code='WP07-MAT'");
  const materialId = Number(material.rows[0].id);
  if ((await admin.query('SELECT id FROM app.warehouse_location WHERE warehouse_code=$1', ['WP07-WH'])).rowCount === 0) {
    await admin.query("INSERT INTO app.warehouse_location (warehouse_code,warehouse_name,location_code,company_code,created_by) VALUES ('WP07-WH','WP07 Warehouse','WP07-LOC',$1,'REAL-WP07')", [companyId]);
  }
  const warehouse = await admin.query("SELECT id FROM app.warehouse_location WHERE warehouse_code='WP07-WH'");
  const warehouseId = Number(warehouse.rows[0].id);
  if ((await admin.query('SELECT id FROM app.batch_expiry WHERE material_id=$1 AND batch_no=$2', [materialId, 'WP07-BATCH'])).rowCount === 0) {
    await admin.query("INSERT INTO app.batch_expiry (material_id,batch_no,production_date,expiry_date,batch_status,company_code,created_by) VALUES ($1,'WP07-BATCH','2026-01-01','2027-01-01','active','THL','REAL-WP07')", [materialId]);
  }
  if ((await admin.query('SELECT id FROM app.attachment WHERE file_name=$1', ['wp07-proof.jpg'])).rowCount === 0) {
    await admin.query("INSERT INTO app.attachment (file_name,file_type,file_path,company_code,created_by) VALUES ('wp07-proof.jpg','image/jpeg','synthetic/wp07-proof.jpg','THL','REAL-WP07')");
  }
  const attachment = await admin.query("SELECT id FROM app.attachment WHERE file_name='wp07-proof.jpg'");
  const proofId = Number(attachment.rows[0].id);
  if ((await admin.query('SELECT id FROM app.vehicle_route WHERE vehicle_code=$1', ['WP07-VEH'])).rowCount === 0) {
    await admin.query("INSERT INTO app.vehicle_route (vehicle_code,route_code,customer_sequence,ship_time,company_code,created_by) VALUES ('WP07-VEH','WP07-ROUTE','WP07-CUS',now(),'THL','REAL-WP07')");
  }
  const vehicle = await admin.query("SELECT id FROM app.vehicle_route WHERE vehicle_code='WP07-VEH'");
  const vehicleId = Number(vehicle.rows[0].id);

  const existingLedger = await admin.query('SELECT id FROM app.inventory_ledger WHERE batch_no=$1', ['WP07-BATCH']);
  if (existingLedger.rowCount === 0) {
    await admin.query("INSERT INTO app.inventory_ledger (material_id,batch_no,location_id,company_code,warehouse_id,quantity,inventory_status,created_by) VALUES ($1,'WP07-BATCH',$2,$3,$4,100,'available','REAL-WP07')", [materialId, warehouseId, companyId, warehouseId]);
  } else {
    await admin.query("UPDATE app.inventory_ledger SET quantity=100,inventory_status='available',updated_by='REAL-WP07',updated_at=now() WHERE id=$1", [existingLedger.rows[0].id]);
  }
  const ledger = await admin.query("SELECT id FROM app.inventory_ledger WHERE batch_no='WP07-BATCH'");
  const inventoryId = Number(ledger.rows[0].id);
  await admin.query(`INSERT INTO app_ops.inventory_valuation (company_id,material_id,batch_no,warehouse_id,location_id,quantity,unit_cost)
    VALUES ($1,$2,'WP07-BATCH',$3,$4,100,12)
    ON CONFLICT (company_id,material_id,batch_no,warehouse_id,location_id)
    DO UPDATE SET quantity=100,unit_cost=12,updated_at=now()`, [companyId, materialId, warehouseId, warehouseId]);

  const orderIds = {};
  for (const suffix of [1, 2, 3]) {
    const orderNo = `WP07-SO-${suffix}`;
    const existingOrder = await admin.query('SELECT id FROM app.sales_order WHERE order_no=$1', [orderNo]);
    if (existingOrder.rowCount === 0) {
      const inserted = await admin.query("INSERT INTO app.sales_order (order_no,customer_id,order_mode,inventory_quantity,status,company_code,created_by) VALUES ($1,$2,'standard',0,'approved','THL','REAL-WP07') RETURNING id", [orderNo, customerId]);
      orderIds[suffix] = Number(inserted.rows[0].id);
    } else {
      orderIds[suffix] = Number(existingOrder.rows[0].id);
      await admin.query("UPDATE app.sales_order SET customer_id=$2,status='approved',inventory_quantity=0,updated_by='REAL-WP07',updated_at=now() WHERE id=$1", [orderIds[suffix], customerId]);
    }
  }

  const orderIdList = Object.values(orderIds);
  await admin.query("DELETE FROM app_ops.delivery_status_event WHERE delivery_task_id IN (SELECT id FROM app.delivery_task WHERE order_id = ANY($1))", [orderIdList]);
  await admin.query("DELETE FROM app.delivery_receipt WHERE task_id IN (SELECT id FROM app.delivery_task WHERE order_id = ANY($1))", [orderIdList]);
  await admin.query("DELETE FROM app.delivery_task WHERE order_id = ANY($1)", [orderIdList]);
  await admin.query("DELETE FROM app_ops.inventory_reservation WHERE sales_order_id = ANY($1)", [orderIdList]);
  await admin.query("DELETE FROM app_ops.sales_order_line WHERE sales_order_id = ANY($1)", [orderIdList]);
  await admin.query("DELETE FROM app.receivable WHERE order_id = ANY($1)", [orderIdList]);
  await admin.query("DELETE FROM app.outbound_record WHERE sales_ref = ANY($1)", [orderIdList]);
  await admin.query("DELETE FROM app_ops.inventory_movement WHERE movement_type='sales_issue' AND source_type='sales_order' AND source_id::bigint = ANY($1)", [orderIdList]);
  await admin.query("DELETE FROM app_ops.sales_discount_approval WHERE sales_order_id = ANY($1)", [orderIdList]);
  await admin.query("DELETE FROM app.idempotency_consumption WHERE consumer_name = ANY($1)", [
    ['inventory:reserve', 'inventory:issue', 'sales:discount-request', 'sales:discount-review', 'sales:delivery-dispatch', 'sales:delivery-event'],
  ]);
  await admin.query("UPDATE app.credit_limit SET occupied_amount=0, updated_by='REAL-WP07', updated_at=now() WHERE customer_id=$1", [customerId]);

  const signingKey = 'real-wp07-signing-key-with-32-bytes';
  const auth = new AuthService(new PostgresAuthStore(pool), { issuer: 'layer-farm-erp', audience: 'layer-farm-web', signingKey });
  const password = 'Synthetic-Test-Passw0rd!2026';
  const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
  await admin.query("DELETE FROM app_auth.credential WHERE account IN ('admin.wp07','staff.wp07') AND company_code='THL'");
  await auth.register('admin.wp07', password, { employeeId: employees.admin, employeeNo: 'WP07-EMP-ADMIN', companyCode: 'THL', companyId, mfaEnrolled: true, roles: [{ role: 'admin' }] }, secret);
  await auth.register('staff.wp07', password, { employeeId: employees.staff, employeeNo: 'WP07-EMP-STAFF', companyCode: 'THL', companyId, mfaEnrolled: true, roles: [{ role: 'sales_staff' }] }, secret);

  const app = createApp({
    config: { nodeEnv: 'test', port: 3213, bodyLimitBytes: 1048576, externalIntegrationsEnabled: false, databaseUrl, valkeyUrl },
    database: pool,
    auth,
    probes: {
      database: async () => pool.query('SELECT 1'),
      valkey: async () => redis.ping(),
    },
  });
  const server = serve({ fetch: app.fetch, port: 3213 });
  await new Promise((resolve, reject) => server.once('listening', resolve).once('error', reject));
  const base = 'http://127.0.0.1:3213';

  const request = async (path, options = {}) => {
    const headers = { 'content-type': 'application/json', ...(options.token ? { authorization: `Bearer ${options.token}` } : {}), ...(options.key ? { 'idempotency-key': options.key } : {}) };
    const response = await fetch(`${base}${path}`, { method: options.method ?? 'GET', headers, ...(options.body ? { body: JSON.stringify(options.body) } : {}) });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : undefined, text };
  };
  const login = async (account) => {
    const response = await request('/api/v1/auth/login', { method: 'POST', body: { account, password, companyCode: 'THL', mfaCode: totp(secret) } });
    assert.equal(response.status, 200, response.text);
    return response.body.data.accessToken;
  };
  const adminToken = await login('admin.wp07');
  const staffToken = await login('staff.wp07');

  const lines = [{ materialId, quantity: 10, unitPrice: 30, uom: 'kg' }];
  const allocate = async (orderId, key) => request(`/api/v1/sales/sales-orders/${orderId}/actions`, { method: 'POST', token: adminToken, key, body: { action: 'allocate', lines } });
  const ship = async (orderId, key) => request(`/api/v1/sales/sales-orders/${orderId}/actions`, { method: 'POST', token: adminToken, key, body: { action: 'ship' } });

  let response = await request(`/api/v1/sales/sales-orders/${orderIds[1]}/discount`, { method: 'POST', token: adminToken, key: 'WP07-DISCOUNT-1', body: { discountPercent: 3, reason: 'small discount' } });
  assert.equal(response.status, 201, response.text);
  assert.equal(response.body.data.status, 'approved');
  response = await request(`/api/v1/sales/sales-orders/${orderIds[1]}/discount`, { method: 'POST', token: adminToken, key: 'WP07-DISCOUNT-1-DUP', body: { discountPercent: 3, reason: 'duplicate' } });
  assert.equal(response.status, 409, response.text);
  response = await allocate(orderIds[1], 'WP07-ALLOCATE-1');
  assert.equal(response.status, 200, response.text);
  assert.deepEqual({ status: response.body.data.status, totalAmount: response.body.data.totalAmount }, { status: 'allocated', totalAmount: '291.00' });
  response = await ship(orderIds[1], 'WP07-SHIP-1');
  assert.equal(response.status, 200, response.text);
  assert.equal(response.body.data.status, 'shipped');
  record('REAL-WP07-001 小额折扣自动批准、预占、出库、应收与信用净额闭环', { receivable: '291.00', duplicateDiscount: 409 });

  response = await request(`/api/v1/sales/sales-orders/${orderIds[2]}/discount`, { method: 'POST', token: staffToken, key: 'WP07-DISCOUNT-2', body: { discountPercent: 10, reason: 'approval required' } });
  assert.equal(response.status, 201, response.text);
  assert.equal(response.body.data.status, 'pending');
  const discountId2 = Number(response.body.data.id);
  response = await allocate(orderIds[2], 'WP07-ALLOCATE-2-BLOCKED');
  assert.equal(response.status, 409, response.text);
  response = await request(`/api/v1/sales/discount-approvals/${discountId2}/actions`, { method: 'POST', token: staffToken, key: 'WP07-REVIEW-2-DENIED', body: { action: 'approve', note: 'staff cannot approve' } });
  assert.equal(response.status, 403, response.text);
  response = await request(`/api/v1/sales/discount-approvals/${discountId2}/actions`, { method: 'POST', token: adminToken, key: 'WP07-REVIEW-2', body: { action: 'approve', note: 'approved' } });
  assert.equal(response.status, 200, response.text);
  response = await allocate(orderIds[2], 'WP07-ALLOCATE-2');
  assert.equal(response.status, 200, response.text);
  assert.equal(response.body.data.totalAmount, '270.00');
  response = await ship(orderIds[2], 'WP07-SHIP-2');
  assert.equal(response.status, 200, response.text);
  record('REAL-WP07-002 高折扣待审批阻断、RBAC审批、净额预占与出库闭环', { blockedReserve: 409, staffReview: 403, receivable: '270.00' });

  response = await request(`/api/v1/sales/sales-orders/${orderIds[3]}/discount`, { method: 'POST', token: staffToken, key: 'WP07-DISCOUNT-3-INVALID', body: { discountPercent: 26, reason: 'over limit' } });
  assert.equal(response.status, 400, response.text);
  response = await request(`/api/v1/sales/sales-orders/${orderIds[3]}/discount`, { method: 'POST', token: staffToken, key: 'WP07-DISCOUNT-3', body: { discountPercent: 8, reason: 'reject case' } });
  assert.equal(response.status, 201, response.text);
  const discountId3 = Number(response.body.data.id);
  response = await request(`/api/v1/sales/discount-approvals/${discountId3}/actions`, { method: 'POST', token: adminToken, key: 'WP07-REVIEW-3', body: { action: 'reject', note: 'not approved' } });
  assert.equal(response.status, 200, response.text);
  response = await allocate(orderIds[3], 'WP07-ALLOCATE-3');
  assert.equal(response.status, 200, response.text);
  assert.equal(response.body.data.totalAmount, '300.00');
  response = await ship(orderIds[3], 'WP07-SHIP-3');
  assert.equal(response.status, 200, response.text);
  record('REAL-WP07-003 折扣上限、驳回保持原价、预占与出库闭环', { overLimit: 400, rejectedReceivable: '300.00' });

  response = await request('/api/v1/sales/delivery-tasks/dispatch', { method: 'POST', token: adminToken, key: 'WP07-DELIVERY-DISPATCH', body: { taskNo: 'WP07-DT-1', salesOrderId: orderIds[1], vehicleId, routeId: vehicleId, driverNo: employees.driver, courierNo: employees.courier, cargo: '10 kg feed' } });
  assert.equal(response.status, 201, response.text);
  const taskId = Number(response.body.data.task.id);
  assert.equal(response.body.data.initialEvent.status, 'assigned');
  response = await request('/api/v1/sales/delivery-tasks/dispatch', { method: 'POST', token: adminToken, key: 'WP07-DELIVERY-DUP', body: { taskNo: 'WP07-DT-1-DUP', salesOrderId: orderIds[1], vehicleId, routeId: vehicleId, driverNo: employees.driver, courierNo: employees.courier } });
  assert.equal(response.status, 409, response.text);
  for (const [status, body] of [['departed', { status: 'departed' }], ['arrived', { status: 'arrived' }], ['signed', { status: 'signed', proof: { attachmentId: proofId } }]]) {
    response = await request(`/api/v1/sales/delivery-tasks/${taskId}/events`, { method: 'POST', token: adminToken, key: `WP07-DELIVERY-${status}`, body });
    assert.equal(response.status, 201, response.text);
  }
  const events = await admin.query('SELECT status FROM app_ops.delivery_status_event WHERE delivery_task_id=$1 ORDER BY sequence_no', [taskId]);
  assert.deepEqual(events.rows.map((row) => row.status), ['assigned', 'departed', 'arrived', 'signed']);
  const receipt = await admin.query('SELECT id FROM app.delivery_receipt WHERE task_id=$1 AND photo_ref=$2', [taskId, proofId]);
  assert.equal(receipt.rowCount, 1);
  record('REAL-WP07-004 真实HTTP配送派发、状态机、签收凭证与重复派发阻断', { duplicateDispatch: 409, receipt: 'passed' });

  response = await request(`/api/v1/sales/customers/${customerId}/statement`, { token: adminToken });
  assert.equal(response.status, 200, response.text);
  assert.equal(response.body.data.balance, '861.00');
  assert.equal(response.body.data.receivables.length, 3);
  assert.equal(Number(response.body.data.credit.occupied_amount), 861);
  const stock = await admin.query('SELECT quantity FROM app.inventory_ledger WHERE id=$1', [inventoryId]);
  assert.equal(Number(stock.rows[0].quantity), 70);
  const signedReceivable = await admin.query('SELECT signed FROM app.receivable WHERE order_id=$1', [orderIds[1]]);
  assert.equal(signedReceivable.rows[0].signed, true);
  record('REAL-WP07-005 客户对账单、信用占用、库存扣减与签收回执闭环', { balance: '861.00', remainingStock: 70, receivables: 3 });

  await new Promise((resolve) => server.close(resolve));
  await admin.end();
  console.log(JSON.stringify({ result: 'passed', evidence: evidence.length, items: evidence }, null, 2));
} finally {
  await redis.quit();
  await pool.end();
}
