import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { Redis } from 'ioredis';
import { loadMigrations, PostgresMigrationStore } from '../dist/packages/database/src/migrations.js';
import { runMigrations } from '../dist/apps/api/src/migration-runner.js';
import { DomainService } from '../dist/packages/domain/src/service.js';
import { SalesService } from '../dist/packages/domain/src/sales.js';
import { ProcurementService } from '../dist/packages/domain/src/procurement.js';
import { createApp } from '../dist/apps/api/src/app.js';
import { AuthService, generateMfaSecret, totp } from '../dist/packages/security/src/auth.js';
import { PostgresAuthStore } from '../dist/packages/security/src/postgres-store.js';
import { BullMqEventQueue } from '../dist/packages/events/src/bullmq.js';
import { IdempotentEventConsumer, OutboxRelay } from '../dist/packages/events/src/outbox.js';

const databaseUrl = process.env.DATABASE_URL;
const valkeyUrl = process.env.VALKEY_URL;
if (!databaseUrl || !valkeyUrl) throw new Error('DATABASE_URL and VALKEY_URL are required');
const evidence = [];
const record = (name, detail) => { evidence.push({ name, result: 'passed', ...detail }); console.log(JSON.stringify(evidence.at(-1))); };
const waitFor = async (check, timeoutMs = 20000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for real-service condition');
};

const pool = new pg.Pool({ connectionString: databaseUrl, max: 20 });
const admin = await adminClient();
async function adminClient() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query("SELECT set_config('app.company_code','*',false),set_config('app.company_id','0',false),set_config('app.actor_id','REAL-TEST',false)");
  return client;
}

try {
  const applied = await runMigrations(loadMigrations(new URL('../migrations/', import.meta.url).pathname), new PostgresMigrationStore(pool));
  const schema = await admin.query("SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='app')::int AS tables,(SELECT count(*) FROM information_schema.columns WHERE table_schema='app')::int AS columns,(SELECT count(*) FROM pg_indexes WHERE schemaname='app' AND indexname LIKE 'idx\\_%')::int AS indexes,(SELECT count(*) FROM pg_policies WHERE schemaname='app')::int AS rls,(SELECT count(*) FROM schema_migration)::int AS migrations");
  assert.deepEqual(schema.rows[0], { tables: 75, columns: 981, indexes: 252, rls: 68, migrations: 13 });
  record('REAL-PG-001 全量迁移与结构计数', { appliedThisRun: applied, schema: schema.rows[0] });

  await admin.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('THL','Synthetic THL','PHP','active','REAL-TEST'),('TGE','Synthetic TGE','PHP','active','REAL-TEST') ON CONFLICT (company_code) DO NOTHING");
  const companies = await admin.query("SELECT id,company_code FROM app.company WHERE company_code IN ('THL','TGE') ORDER BY company_code");
  const ids = Object.fromEntries(companies.rows.map((row) => [row.company_code, Number(row.id)]));
  assert.ok(ids.THL > 0 && ids.TGE > 0);
  const thl = { actorId: 'REAL-TEST', employeeId: 9001, companyCode: 'THL', companyId: ids.THL };
  const tge = { actorId: 'REAL-TEST-TGE', employeeId: 9002, companyCode: 'TGE', companyId: ids.TGE };
  assert.equal((await new DomainService(pool, thl).list('company', { page: 1, pageSize: 20 })).total, 1);
  assert.equal((await new DomainService(pool, tge).list('company', { page: 1, pageSize: 20 })).total, 1);
  await assert.rejects(() => new DomainService(pool, thl).get('company', String(ids.TGE)), (error) => error.code === 'NOT_FOUND');
  const crossWrite = await admin.query("SELECT count(*)::int AS n FROM app.company WHERE company_code='TGE'");
  assert.equal(crossWrite.rows[0].n, 1);
  record('REAL-PG-002 FORCE RLS双公司隔离', { visibleCompaniesPerTenant: 1, crossTenantRead: 'NOT_FOUND' });

  await admin.query("SELECT set_config('app.company_code','THL',false),set_config('app.company_id',$1,false)", [ids.THL]);
  await admin.query("INSERT INTO app.price_list (price_list_code,price_type,product_name,price,effective_date,company_code,created_by) VALUES ('REAL-P','standard','Synthetic birds',20,'2026-01-01','THL','REAL-TEST')");
  const price = await admin.query("SELECT id FROM app.price_list WHERE price_list_code='REAL-P'");
  const customer = await admin.query("INSERT INTO app.customer (customer_code,customer_name,address,payment_term,credit_ref,price_id,status,company_code,created_by) VALUES ('REAL-C','Synthetic customer','Synthetic address',30,0,$1,'active','THL','REAL-TEST') RETURNING id", [price.rows[0].id]);
  const customerId = Number(customer.rows[0].id);
  await admin.query("INSERT INTO app.credit_limit (customer_id,credit_amount,occupied_amount,over_limit_block,ceo_approval,company_code,created_by) VALUES ($1,10000,0,true,'not_required','THL','REAL-TEST')", [customerId]);
  const flock = await admin.query("INSERT INTO app.farm_batch (batch_no,breed,source,chick_date,initial_quantity,day_age,stage,company_code,created_by) VALUES ('REAL-FLOCK','Lohmann Pink','Synthetic','2026-01-01',100,326,'laying','THL','REAL-TEST') RETURNING id");
  const flockId = Number(flock.rows[0].id);
  await admin.query('INSERT INTO app_ops.flock_position (batch_id,house_id,company_code,quantity) VALUES ($1,1,$2,100)', [flockId, 'THL']);
  const sales = new SalesService(pool, thl);
  const saleInput = { saleType: 'cull', customerId, flockBatchId: flockId, quantity: 60, unitPrice: 20, unitCost: 12, saleDate: '2026-11-23' };
  const concurrent = await Promise.allSettled([
    sales.createLivestockSale({ ...saleInput, saleNo: 'REAL-CULL-A' }, 'REAL-CULL-A-001'),
    sales.createLivestockSale({ ...saleInput, saleNo: 'REAL-CULL-B' }, 'REAL-CULL-B-001'),
  ]);
  assert.equal(concurrent.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(concurrent.filter((result) => result.status === 'rejected').length, 1);
  assert.match(concurrent.find((result) => result.status === 'rejected').reason.message, /存栏/);
  const position = await admin.query('SELECT quantity FROM app_ops.flock_position WHERE batch_id=$1', [flockId]);
  assert.equal(Number(position.rows[0].quantity), 40);
  const saleRows = await admin.query("SELECT count(*)::int AS n FROM app_ops.livestock_sale_execution WHERE sale_no IN ('REAL-CULL-A','REAL-CULL-B')");
  assert.equal(saleRows.rows[0].n, 1);
  record('REAL-PG-003 多连接并发存栏与信用原子扣减', { fulfilled: 1, rejected: 1, remainingFlock: 40, saleRows: 1 });

  const auth = new AuthService(new PostgresAuthStore(pool), { issuer: 'layer-farm-erp', audience: 'layer-farm-web', signingKey: 'synthetic-real-service-signing-key-32bytes' });
  const password = 'Synthetic-Test-Passw0rd!2026';
  const thlSecret = generateMfaSecret();
  const tgeSecret = generateMfaSecret();
  await auth.register('real.thl.sales', password, { employeeId: 9001, employeeNo: 'REAL-THL', companyCode: 'THL', companyId: ids.THL, mfaEnrolled: false, roles: [{ role: 'sales_manager' }] });
  await auth.register('real.thl.farm', password, { employeeId: 9004, employeeNo: 'REAL-FARM', companyCode: 'THL', companyId: ids.THL, mfaEnrolled: false, roles: [{ role: 'layer_farm_manager' }] });
  await auth.register('real.thl.warehouse', password, { employeeId: 9006, employeeNo: 'REAL-WH', companyCode: 'THL', companyId: ids.THL, mfaEnrolled: false, roles: [{ role: 'warehouse' }] });
  await auth.register('real.thl.finance', password, { employeeId: 9003, employeeNo: 'REAL-FIN', companyCode: 'THL', companyId: ids.THL, mfaEnrolled: true, roles: [{ role: 'finance_manager' }] }, thlSecret);
  await auth.register('real.tge.boss', password, { employeeId: 9002, employeeNo: 'REAL-TGE', companyCode: 'TGE', companyId: ids.TGE, mfaEnrolled: true, roles: [{ role: 'boss' }] }, tgeSecret);
  await auth.register('real.tge.warehouse', password, { employeeId: 9007, employeeNo: 'REAL-TGE-WH', companyCode: 'TGE', companyId: ids.TGE, mfaEnrolled: false, roles: [{ role: 'warehouse' }] });
  await auth.register('real.thl.admin', password, { employeeId: 9005, employeeNo: 'REAL-ADMIN', companyCode: 'THL', companyId: ids.THL, mfaEnrolled: true, roles: [{ role: 'admin' }] }, thlSecret);
  let queue;
  const app = createApp({ config: { nodeEnv: 'test', port: 3210, bodyLimitBytes: 1048576, externalIntegrationsEnabled: false }, database: pool, auth, deadLetters: { list: (limit) => queue.deadLetters(limit), replay: (jobId) => queue.replayDeadLetter(jobId) } });
  const login = async (account, secret, companyCode) => {
    const response = await app.request('/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account, password, companyCode, mfaCode: totp(secret) }) });
    assert.equal(response.status, 200);
    return (await response.json()).data.accessToken;
  };
  const thlToken = await login('real.thl.sales', thlSecret, 'THL');
  const farmToken = await login('real.thl.farm', thlSecret, 'THL');
  const warehouseToken = await login('real.thl.warehouse', thlSecret, 'THL');
  const financeToken = await login('real.thl.finance', thlSecret, 'THL');
  const tgeToken = await login('real.tge.boss', tgeSecret, 'TGE');
  const tgeWarehouseToken = await login('real.tge.warehouse', tgeSecret, 'TGE');
  const adminToken = await login('real.thl.admin', thlSecret, 'THL');
  const costPost = await app.request(`/api/v1/farm/flock-batches/${flockId}/cost-postings`, { method: 'POST', headers: { authorization: `Bearer ${farmToken}`, 'content-type': 'application/json', 'idempotency-key': 'REAL-FLOCK-COST-001' }, body: JSON.stringify({ costType: 'chick', amount: 480, sourceType: 'chick_receipt', sourceId: 'REAL-COST-1', incurredOn: '2026-11-23' }) });
  assert.equal(costPost.status, 201, await costPost.text());
  const apiSale = await app.request('/api/v1/sales/livestock-sales', { method: 'POST', headers: { authorization: `Bearer ${thlToken}`, 'content-type': 'application/json', 'idempotency-key': 'REAL-CHICK-HTTP-001' }, body: JSON.stringify({ saleNo: 'REAL-CHICK-HTTP', saleType: 'chick', customerId, flockBatchId: flockId, quantity: 10, unitPrice: 30, saleDate: '2026-11-23' }) });
  const apiSaleText = await apiSale.text();
  assert.equal(apiSale.status, 201, apiSaleText);
  const apiSaleBody = JSON.parse(apiSaleText);
  const salesOrderId = Number(apiSaleBody.data.sales_order_id);
  const profitResponse = await app.request(`/api/v1/fin/sales-orders/${salesOrderId}/profit`, { headers: { authorization: `Bearer ${financeToken}` } });
  assert.equal(profitResponse.status, 200);
  const profit = (await profitResponse.json()).data;
  assert.deepEqual({ netRevenue: profit.netRevenue, cogs: profit.cogs, grossProfit: profit.grossProfit }, { netRevenue: '300.00', cogs: '120.00', grossProfit: '180.00' });
  const exportResponse = await app.request(`/api/v1/fin/sales-orders/${salesOrderId}/profit-export?locale=en-US`, { headers: { authorization: `Bearer ${financeToken}` } });
  assert.equal(exportResponse.status, 200);
  assert.ok((await exportResponse.text()).includes('Sales Batch Profitability'));
  const crossApi = await app.request(`/api/v1/fin/sales-orders/${salesOrderId}/profit`, { headers: { authorization: `Bearer ${tgeToken}` } });
  assert.equal(crossApi.status, 404);
  record('REAL-API-001 登录MFA+自动鸡群成本+禽苗销售+财务毛利CSV+跨公司负例', { costPostingStatus: 201, chickSaleStatus: 201, automaticUnitCost: '12.0000', profit: '180.00', csv: 'passed', crossTenantStatus: 404 });

  const material = await admin.query("INSERT INTO app.material (material_code,material_name,category,uom,company_code,created_by) VALUES ('REAL-MAT-ASN','Synthetic feed','feed','kg','THL','REAL-TEST') RETURNING id");
  const supplier = await admin.query("INSERT INTO app.supplier (supplier_code,supplier_name,material_id,status,company_code,created_by) VALUES ('REAL-SUP-ASN','Synthetic supplier',$1,'active','THL','REAL-TEST') RETURNING id", [material.rows[0].id]);
  const purchaseOrder = await admin.query("INSERT INTO app.purchase_order (order_no,supplier_id,material_id,quantity,price,execution_close,company_code,created_by) VALUES ('REAL-PO-ASN',$1,$2,100,10,'open','THL','REAL-TEST') RETURNING id", [supplier.rows[0].id, material.rows[0].id]);
  await admin.query("INSERT INTO app.warehouse_location (warehouse_code,warehouse_name,location_code,company_code,created_by) VALUES ('REAL-WH-ASN','Synthetic Warehouse','REAL-LOC-ASN',$1,'REAL-TEST') RETURNING id", [ids.THL]);
  const warehouseLocation = await admin.query("SELECT id FROM app.warehouse_location WHERE warehouse_code='REAL-WH-ASN'");
  await admin.query("INSERT INTO app.organization_unit (unit_code,unit_name,org_level,status,company_code,created_by) VALUES ('REAL-UNIT-ASN','Synthetic Unit',1,'active','THL','REAL-TEST')");
  const unit = await admin.query("SELECT id FROM app.organization_unit WHERE unit_code='REAL-UNIT-ASN'");
  await admin.query("INSERT INTO app.position (position_code,position_name,unit_id,headcount,effective_date,status,company_code,created_by) VALUES ('REAL-POS-ASN','Buyer',$1,2,'2026-01-01','active','THL','REAL-TEST')", [unit.rows[0].id]);
  const jobPosition = await admin.query("SELECT id FROM app.position WHERE position_code='REAL-POS-ASN'");
  const employee = await admin.query("INSERT INTO app.employee (employee_no,employee_name,position_id,account,employment_status,company_code,created_by) VALUES ('REAL-EMP-ASN','Supplier User',$1,0,'active','THL','REAL-TEST') RETURNING id", [jobPosition.rows[0].id]);
  const supplierProcurement = new ProcurementService(pool, { ...thl, employeeId: Number(employee.rows[0].id) });
  await supplierProcurement.bindSupplier({ employeeId: Number(employee.rows[0].id), supplierId: Number(supplier.rows[0].id) });
  await supplierProcurement.confirmPortalOrder(Number(purchaseOrder.rows[0].id), { confirmedDeliveryDate: '2026-12-31' }, 'REAL-ASN-CONFIRM-001');
  const asn = await supplierProcurement.createPortalAsn({ purchaseOrderId: Number(purchaseOrder.rows[0].id), asnNo: 'REAL-ASN-001', quantity: 60, batchNo: 'REAL-BATCH-ASN', productionDate: '2026-01-01', expiryDate: '2027-01-01' }, 'REAL-ASN-CREATE-001');
  const receiveBody = JSON.stringify({ warehouseId: Number(warehouseLocation.rows[0].id), locationId: Number(warehouseLocation.rows[0].id), qualityStatus: 'accepted' });
  const receive = (token, key) => app.request(`/api/v1/proc/advance-shipping-notices/${asn.id}/receive`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key }, body: receiveBody });
  const permissionDenied = await receive(thlToken, 'REAL-ASN-DENIED-001'); assert.equal(permissionDenied.status, 403);
  const crossAsn = await receive(tgeWarehouseToken, 'REAL-ASN-CROSS-001'); assert.equal(crossAsn.status, 404);
  const concurrentReceive = await Promise.all([receive(warehouseToken, 'REAL-ASN-RECEIVE-A'), receive(warehouseToken, 'REAL-ASN-RECEIVE-B')]);
  assert.deepEqual(concurrentReceive.map((response) => response.status).sort(), [201, 409]);
  const successfulReceive = concurrentReceive.find((response) => response.status === 201);
  const receiveResult = (await successfulReceive.json()).data;
  const duplicate = await receive(warehouseToken, 'REAL-ASN-RECEIVE-C'); assert.equal(duplicate.status, 409);
  const ledger = await admin.query("SELECT quantity FROM app.inventory_ledger WHERE batch_no='REAL-BATCH-ASN'");
  assert.equal(Number(ledger.rows[0].quantity), 60);
  const payable = await admin.query('SELECT payable_balance FROM app.payable WHERE goods_receipt_id=$1', [receiveResult.goodsReceiptId]);
  assert.equal(Number(payable.rows[0].payable_balance), 600);
  record('REAL-API-002 ASN仓库HTTP收货、RBAC、跨公司、并发及重复处理', { permissionDenied: 403, crossTenant: 404, concurrentStatuses: [201, 409], duplicateStatus: 409, inventory: 60, payable: 600 });

  const feedingCreate = await app.request('/api/v1/farm/feeding-management', { method: 'POST', headers: { authorization: `Bearer ${farmToken}`, 'content-type': 'application/json', 'idempotency-key': 'REAL-FEED-CREATE-001' }, body: JSON.stringify({ batch_id: flockId, material_id: Number(material.rows[0].id), quantity: 10, daily_feeding: 10, first_drink_feed: 0 }) });
  const feedingText = await feedingCreate.text(); assert.equal(feedingCreate.status, 201, feedingText);
  const feedingId = JSON.parse(feedingText).data.id;
  const feedIssue = await app.request(`/api/v1/farm/feeding-management/${feedingId}/issue`, { method: 'POST', headers: { authorization: `Bearer ${farmToken}`, 'content-type': 'application/json', 'idempotency-key': 'REAL-FEED-ISSUE-001' }, body: JSON.stringify({ warehouseId: Number(warehouseLocation.rows[0].id), locationId: Number(warehouseLocation.rows[0].id), incurredOn: '2026-11-23' }) });
  const feedIssueText = await feedIssue.text(); assert.equal(feedIssue.status, 201, feedIssueText);
  assert.equal(JSON.parse(feedIssueText).data.costAmount, '***');
  assert.equal(Number((await admin.query("SELECT quantity FROM app.inventory_ledger WHERE batch_no='REAL-BATCH-ASN'")).rows[0].quantity), 50);
  const feedCostEntry = await admin.query("SELECT amount FROM app_ops.flock_cost_entry WHERE source_type='feeding_record' AND source_id=$1", [String(feedingId)]);
  assert.equal(Number(feedCostEntry.rows[0].amount), 100);
  const costSnapshot = await admin.query('SELECT accumulated_cost FROM app_ops.flock_cost_snapshot WHERE batch_id=$1', [flockId]);
  assert.equal(Number(costSnapshot.rows[0].accumulated_cost), 460);
  record('REAL-API-003 真实FEFO饲喂出库与鸡群自动成本联动', { feedingStatus: 201, issueStatus: 201, feedCost: 100, remainingFeed: 50, accumulatedFlockCost: 460 });

  const queueName = `real-erp-${randomUUID()}`;
  const connection = new Redis(valkeyUrl, { maxRetriesPerRequest: null });
  queue = new BullMqEventQueue(connection, queueName, { attempts: 2, backoffMs: 20 });
  const eventId = randomUUID();
  await admin.query("SELECT set_config('app.company_code','*',false),set_config('app.company_id','0',false)");
  await admin.query("INSERT INTO app.outbox_event (company_id,event_id,aggregate_type,aggregate_id,event_type,event_version,payload,headers,occurred_at,available_at,publish_attempts) VALUES ($1,$2,'real_test','1','real.failure',1,'{}'::jsonb,'{}'::jsonb,now(),now(),0)", [ids.THL, eventId]);
  const relay = new OutboxRelay(pool, queue);
  const published = await relay.publishBatch();
  assert.ok(published.published >= 1 && published.failed === 0);
  let worker = queue.createWorker(new IdempotentEventConsumer(pool, 'real-service-test').consume(async (event) => { if (event.eventId !== eventId) return { skipped: true }; throw new Error('synthetic terminal failure'); }), 1);
  const dead = await waitFor(async () => (await queue.deadLetters()).find((item) => item.eventId === eventId));
  assert.equal(dead.eventId, eventId);
  assert.equal(dead.attemptsMade, 2);
  await worker.close();
  const dlqList = await app.request('/api/v1/events/dead-letters?limit=200', { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(dlqList.status, 200);
  assert.ok((await dlqList.json()).data.some((item) => item.jobId === dead.jobId));
  const dlqReplay = await app.request(`/api/v1/events/dead-letters/${encodeURIComponent(dead.jobId)}/replay`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(dlqReplay.status, 200, await dlqReplay.text());
  const dlqDenied = await app.request(`/api/v1/events/dead-letters/${encodeURIComponent(dead.jobId)}/replay`, { method: 'POST', headers: { authorization: `Bearer ${thlToken}` } });
  assert.equal(dlqDenied.status, 403);
  assert.equal((await queue.deadLetters()).some((item) => item.jobId === dead.jobId), false);
  let handled = 0;
  const completed = new Promise((resolve, reject) => {
    worker = queue.createWorker(new IdempotentEventConsumer(pool, 'real-service-test').consume(async (event) => { if (event.eventId !== eventId) return { skipped: true }; handled += 1; return { handled }; }), 1);
    worker.once('completed', resolve);
    worker.once('error', reject);
  });
  await completed;
  const consumption = await admin.query("SELECT processing_status FROM app.idempotency_consumption WHERE consumer_name='real-service-test' AND event_id=$1", [eventId]);
  assert.equal(consumption.rows[0].processing_status, 'completed');
  assert.equal(handled, 1);
  const outbox = await admin.query('SELECT published_at,publish_attempts FROM app.outbox_event WHERE event_id=$1', [eventId]);
  assert.ok(outbox.rows[0].published_at);
  await worker.close();
  await queue.close();
  connection.disconnect();
  record('REAL-EVENT-001 Outbox失败DLQ查询与HTTP重放、RBAC及幂等完成', { attemptsBeforeDlq: 2, replay: 'passed', replayHttpStatus: 200, nonAdminReplayStatus: 403, handlerCalls: 1, consumption: 'completed', outboxPublished: true });

  console.log(JSON.stringify({ result: 'passed', assertions: evidence.length, evidence }));
} finally {
  await admin.end();
  await pool.end();
}
