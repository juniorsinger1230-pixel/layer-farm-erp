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
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8').replaceAll('CONCURRENTLY', ''));
  }
  await db.query("SELECT set_config('app.actor_id','BOOTSTRAP',false),set_config('app.company_code','*',false),set_config('app.company_id','0',false)");
  await db.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('THL','Synthetic THL','PHP','active','BOOTSTRAP')");
  const store = new InMemoryAuthStore();
  const auth = new AuthService(store, { issuer: 'layer-farm-test', audience: 'layer-farm-api', signingKey });
  const mfaSecret = generateMfaSecret();
  await auth.register('admin.delivery', password, { employeeId: 1, employeeNo: 'ADMIN-1', companyCode: 'THL', companyId: 1, mfaEnrolled: true, roles: [{ role: 'admin' }] }, mfaSecret);
  const app = createApp({ config: { nodeEnv: 'test', port: 3100, bodyLimitBytes: 8192, externalIntegrationsEnabled: false }, auth, database: new TestPool(db) });
  const login = await app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account: 'admin.delivery', password, companyCode: 'THL', mfaCode: totp(mfaSecret) }),
  });
  const tokens = (await login.json()).data;
  const call = (method, path, body, key = `KEY-${crypto.randomUUID()}`) => app.request(path, {
    method,
    headers: { authorization: `Bearer ${tokens.accessToken}`, 'content-type': 'application/json', 'idempotency-key': key },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const unit = await db.query("INSERT INTO app.organization_unit (unit_code,unit_name,parent_unit_id,org_level,status,company_code,created_by) VALUES ('LOG-UNIT','Logistics Unit',null,1,'active','THL','BOOTSTRAP') RETURNING id");
  const position = await db.query("INSERT INTO app.position (position_code,position_name,unit_id,headcount,reports_to_id,effective_date,status,company_code,created_by) VALUES ('LOG-POS','Logistics Staff',$1,3,null,'2026-01-01','active','THL','BOOTSTRAP') RETURNING id", [unit.rows[0].id]);
  const driver = await db.query("INSERT INTO app.employee (employee_no,employee_name,position_id,account,employment_status,company_code,created_by) VALUES ('DRV-1','Test Driver',$1,0,'active','THL','BOOTSTRAP') RETURNING id", [position.rows[0].id]);
  const courier = await db.query("INSERT INTO app.employee (employee_no,employee_name,position_id,account,employment_status,company_code,created_by) VALUES ('COU-1','Test Courier',$1,0,'active','THL','BOOTSTRAP') RETURNING id", [position.rows[0].id]);
  const price = await db.query("INSERT INTO app.price_list (price_list_code,price_type,product_name,price,effective_date,company_code,created_by) VALUES ('PRICE-1','standard','Synthetic Eggs',30,'2026-01-01','THL','BOOTSTRAP') RETURNING id");
  const customer = await db.query("INSERT INTO app.customer (customer_code,customer_name,address,payment_term,credit_ref,price_id,status,company_code,created_by) VALUES ('CUS-1','Synthetic Customer','Synthetic Address',30,0,$1,'active','THL','BOOTSTRAP') RETURNING id", [price.rows[0].id]);
  const vehicle = await db.query("INSERT INTO app.vehicle_route (vehicle_code,route_code,customer_sequence,ship_time,company_code,created_by) VALUES ('VEH-1','ROUTE-1','CUS-1',now(),'THL','BOOTSTRAP') RETURNING id");
  const proof = await db.query("INSERT INTO app.attachment (file_name,file_type,file_path,company_code,created_by) VALUES ('proof.jpg','image/jpeg','synthetic/proof.jpg','THL','BOOTSTRAP') RETURNING id");

  async function createOrder(suffix, status) {
    const result = await db.query("INSERT INTO app.sales_order (order_no,customer_id,order_mode,inventory_quantity,status,company_code,created_by) VALUES ($1,$2,'standard',100,$3,'THL','BOOTSTRAP') RETURNING id", [`SO-${suffix}`, customer.rows[0].id, status]);
    return Number(result.rows[0].id);
  }

  return {
    db, app, call, createOrder,
    driverId: Number(driver.rows[0].id),
    courierId: Number(courier.rows[0].id),
    vehicleId: Number(vehicle.rows[0].id),
    customerId: Number(customer.rows[0].id),
    proofId: Number(proof.rows[0].id),
  };
}

test('配送任务派发、状态机、签收凭证和客户对账形成闭环', async () => {
  const f = await fixture();
  const orderId = await f.createOrder('DELIVERY-1', 'shipped');
  await f.db.query("INSERT INTO app.receivable (order_id,signed,payment_term,receivable_balance,overdue,company_code,created_by) VALUES ($1,false,30,1200,false,'THL','BOOTSTRAP')", [orderId]);
  const dispatchBody = {
    taskNo: 'DT-001', salesOrderId: orderId, vehicleId: f.vehicleId, routeId: f.vehicleId,
    driverNo: f.driverId, courierNo: f.courierId, cargo: '100 eggs',
  };
  const dispatchResponse = await f.call('POST', '/api/v1/sales/delivery-tasks/dispatch', dispatchBody, 'IDEM-DISPATCH-1');
  const dispatchText = await dispatchResponse.text();
  assert.equal(dispatchResponse.status, 201, dispatchText);
  const dispatched = JSON.parse(dispatchText).data;
  const taskId = Number(dispatched.task.id);
  assert.equal(dispatched.initialEvent.status, 'assigned');
  const listResponse = await f.call('GET', '/api/v1/sales/delivery-tasks');
  const listText = await listResponse.text();
  assert.equal(listResponse.status, 200, listText);
  const list = JSON.parse(listText).data;
  assert.equal(list.total, 1);
  assert.equal(list.items[0].latest_status, 'assigned');

  const departed = await f.call('POST', `/api/v1/sales/delivery-tasks/${taskId}/events`, { status: 'departed' }, 'IDEM-EVENT-DEPARTED');
  assert.equal(departed.status, 201, await departed.text());
  const arrived = await f.call('POST', `/api/v1/sales/delivery-tasks/${taskId}/events`, { status: 'arrived' }, 'IDEM-EVENT-ARRIVED');
  assert.equal(arrived.status, 201, await arrived.text());
  const signed = await f.call('POST', `/api/v1/sales/delivery-tasks/${taskId}/events`, { status: 'signed', proof: { attachmentId: f.proofId } }, 'IDEM-EVENT-SIGNED');
  assert.equal(signed.status, 201, await signed.text());

  const events = await f.db.query('SELECT status FROM app_ops.delivery_status_event WHERE delivery_task_id=$1 ORDER BY sequence_no', [taskId]);
  assert.deepEqual(events.rows.map((row) => row.status), ['assigned', 'departed', 'arrived', 'signed']);
  const receipt = await f.db.query('SELECT id FROM app.delivery_receipt WHERE task_id=$1 AND photo_ref=$2', [taskId, f.proofId]);
  assert.equal(receipt.rowCount, 1);
  const receivable = await f.db.query('SELECT signed FROM app.receivable WHERE order_id=$1', [orderId]);
  assert.equal(receivable.rows[0].signed, true);

  const statementResponse = await f.call('GET', `/api/v1/sales/customers/${f.customerId}/statement`);
  const statementText = await statementResponse.text();
  assert.equal(statementResponse.status, 200, statementText);
  const statement = JSON.parse(statementText).data;
  assert.equal(Number(statement.balance), 1200);
  assert.equal(statement.receivables.length, 1);
  await f.db.close();
});

test('未出库订单、重复派发和非法字段会被阻断', async () => {
  const f = await fixture();
  const approvedOrder = await f.createOrder('DELIVERY-2', 'approved');
  const invalidState = await f.call('POST', '/api/v1/sales/delivery-tasks/dispatch', {
    taskNo: 'DT-002', salesOrderId: approvedOrder, vehicleId: f.vehicleId, routeId: f.vehicleId,
    driverNo: f.driverId, courierNo: f.courierId,
  }, 'IDEM-DISPATCH-2');
  assert.equal(invalidState.status, 409);

  const shippedOrder = await f.createOrder('DELIVERY-3', 'shipped');
  const body = {
    taskNo: 'DT-003', salesOrderId: shippedOrder, vehicleId: f.vehicleId, routeId: f.vehicleId,
    driverNo: f.driverId, courierNo: f.courierId,
  };
  const first = await f.call('POST', '/api/v1/sales/delivery-tasks/dispatch', body, 'IDEM-DISPATCH-3');
  assert.equal(first.status, 201, await first.text());
  const duplicate = await f.call('POST', '/api/v1/sales/delivery-tasks/dispatch', body, 'IDEM-DISPATCH-4');
  assert.equal(duplicate.status, 409);

  const illegal = await f.call('POST', '/api/v1/sales/delivery-tasks/dispatch', { ...body, taskNo: 'DT-004', salesOrderId: await f.createOrder('DELIVERY-4', 'shipped'), unknownField: true }, 'IDEM-DISPATCH-5');
  assert.equal(illegal.status, 400);
  await f.db.close();
});

test('配送状态非法跳转和缺少签收凭证会被阻断', async () => {
  const f = await fixture();
  const orderId = await f.createOrder('DELIVERY-5', 'shipped');
  const dispatch = await f.call('POST', '/api/v1/sales/delivery-tasks/dispatch', {
    taskNo: 'DT-005', salesOrderId: orderId, vehicleId: f.vehicleId, routeId: f.vehicleId,
    driverNo: f.driverId, courierNo: f.courierId,
  }, 'IDEM-DISPATCH-6');
  const dispatchText = await dispatch.text();
  assert.equal(dispatch.status, 201, dispatchText);
  const taskId = Number(JSON.parse(dispatchText).data.task.id);
  const illegalJump = await f.call('POST', `/api/v1/sales/delivery-tasks/${taskId}/events`, { status: 'signed', proof: { attachmentId: f.proofId } }, 'IDEM-EVENT-BAD');
  assert.equal(illegalJump.status, 409);
  await f.call('POST', `/api/v1/sales/delivery-tasks/${taskId}/events`, { status: 'departed' }, 'IDEM-EVENT-DEPARTED-2');
  await f.call('POST', `/api/v1/sales/delivery-tasks/${taskId}/events`, { status: 'arrived' }, 'IDEM-EVENT-ARRIVED-2');
  const missingProof = await f.call('POST', `/api/v1/sales/delivery-tasks/${taskId}/events`, { status: 'signed', proof: {} }, 'IDEM-EVENT-NO-PROOF');
  assert.equal(missingProof.status, 400);
  await f.db.close();
});
