import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../dist/apps/api/src/app.js';
import { AuthService, InMemoryAuthStore, generateMfaSecret, totp } from '../dist/packages/security/src/auth.js';

const password = 'Synthetic-Test-Passw0rd!2026';
const signingKey = 'test-only-signing-key-with-at-least-32-bytes';
class TestPool { constructor(db) { this.db = db; } query(text, values) { return this.db.query(text, values); } async connect() { return { query: (text, values) => this.db.query(text, values), release: () => {} }; } }

async function fixture() {
  const db = new PGlite();
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8').replaceAll('CONCURRENTLY', ''));
  await db.query("SELECT set_config('app.actor_id','BOOTSTRAP',false),set_config('app.company_code','*',false),set_config('app.company_id','0',false)");
  await db.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('THL','Synthetic THL','PHP','active','BOOTSTRAP'),('TGE','Synthetic TGE','PHP','active','BOOTSTRAP')");
  const store = new InMemoryAuthStore();
  const auth = new AuthService(store, { issuer: 'layer-farm-test', audience: 'layer-farm-api', signingKey });
  const mfaSecret = generateMfaSecret();
  await auth.register('admin.production', password, { employeeId: 1, employeeNo: 'ADMIN-1', companyCode: 'THL', companyId: 1, mfaEnrolled: true, roles: [{ role: 'admin' }] }, mfaSecret);
  const app = createApp({ config: { nodeEnv: 'test', port: 3100, bodyLimitBytes: 8192, externalIntegrationsEnabled: false }, auth, database: new TestPool(db) });
  const login = await app.request('/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account: 'admin.production', password, companyCode: 'THL', mfaCode: totp(mfaSecret) }) });
  const tokens = (await login.json()).data;
  const call = (method, path, body, key = `KEY-${crypto.randomUUID()}`, extraHeaders = {}) => app.request(path, { method, headers: { authorization: `Bearer ${tokens.accessToken}`, 'content-type': 'application/json', 'idempotency-key': key, ...extraHeaders }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const create = async (path, body) => {
    const response = await call('POST', path, body);
    assert.equal(response.status, 201, await response.clone().text());
    return (await response.json()).data;
  };
  const house = await create('/api/v1/farm/houses-and-pens', { house_code: 'H-01', house_name: 'Layer House 01', pen_count: 4, floor_count: 3, farm_mode: 'cage', house_status: 'active' });
  const house2 = await create('/api/v1/farm/houses-and-pens', { house_code: 'H-02', house_name: 'Layer House 02', pen_count: 4, floor_count: 3, farm_mode: 'cage', house_status: 'active' });
  const batch = await create('/api/v1/farm/flock-batches', { batch_no: 'B-2026-01', breed: 'Lohmann Pink', source: 'Synthetic Supplier', chick_date: '2026-01-01', initial_quantity: 1000, day_age: 326, stage: 'laying' });
  const material = await create('/api/v1/inv/materials', { material_code: 'EGG-001', material_name: 'Synthetic Table Egg', category: 'egg', uom: 'egg' });
  const drug = await create('/api/v1/inv/materials', { material_code: 'MED-001', material_name: 'Synthetic Medicine', category: 'medicine', uom: 'ml' });
  const warehouse = await create('/api/v1/inv/stock-locations', { warehouse_code: 'WH-01', warehouse_name: 'Egg Warehouse', location_code: 'L-01' });
  return { db, app, tokens, call, create, house, house2, batch, material, drug, warehouse };
}

test('分栋、转群、死淘与存栏投影保持一致', async () => {
  const f = await fixture();
  const placed = await f.call('POST', `/api/v1/farm/flock-batches/${f.batch.id}/actions`, { action: 'place', houseId: f.house.id, quantity: 1000 }, 'IDEM-PLACE-001');
  assert.equal(placed.status, 200, await placed.clone().text());
  const excessive = await f.call('POST', `/api/v1/farm/flock-batches/${f.batch.id}/actions`, { action: 'place', houseId: f.house2.id, quantity: 1 }, 'IDEM-PLACE-OVER');
  assert.equal(excessive.status, 409);
  const transfer = await f.create('/api/v1/farm/flock-transfers', { batch_id: f.batch.id, from_house_id: f.house.id, to_house_id: f.house2.id, fasting: true, headcount_check: 200 });
  assert.equal(Number(transfer.headcount_check), 200);
  await f.create('/api/v1/farm/mortality-disposal', { batch_id: f.batch.id, mortality_reason: 'disease', quantity: 50, stock_update: 50, harmless_treatment: 'synthetic rendering' });
  const positions = await f.call('GET', `/api/v1/farm/flock-batches/${f.batch.id}/positions`);
  const data = (await positions.json()).data;
  assert.equal(data.total, 950);
  assert.equal(data.houses.reduce((sum, row) => sum + Number(row.quantity), 0), 950);
  await f.db.close();
});

test('集蛋分级幂等入库且不超过理论产蛋上限', async () => {
  const f = await fixture();
  await f.call('POST', `/api/v1/farm/flock-batches/${f.batch.id}/actions`, { action: 'place', houseId: f.house.id, quantity: 1000 }, 'IDEM-PLACE-002');
  const input = { collectionNo: 'EGG-20261123-01', batchId: f.batch.id, houseId: f.house.id, materialId: f.material.id, warehouseId: f.warehouse.id, locationId: f.warehouse.id, collectionDate: '2026-11-23', shift: 'day', goodEggs: 800, brokenEggs: 5, dirtyEggs: 2, gradeDetail: { small: 100, medium: 300, large: 300, extra_large: 100 }, deviceRef: 'MOBA-SYNTH-01' };
  const response = await f.call('POST', '/api/v1/farm/egg-collection-grading', input, 'IDEM-EGG-0001');
  assert.equal(response.status, 201, await response.clone().text());
  const replay = await f.call('POST', '/api/v1/farm/egg-collection-grading', input, 'IDEM-EGG-0001');
  assert.equal(replay.status, 201);
  const excessive = await f.call('POST', '/api/v1/farm/egg-collection-grading', { ...input, collectionNo: 'EGG-20261123-02', goodEggs: 300, gradeDetail: { medium: 300 } }, 'IDEM-EGG-OVER');
  assert.equal(excessive.status, 409);
  const ledger = await f.db.query("SELECT quantity FROM app.inventory_ledger WHERE batch_no='EGG-20261123-01'");
  assert.equal(Number(ledger.rows[0].quantity), 800);
  assert.equal(Number((await f.db.query("SELECT count(*)::int AS n FROM app_ops.inventory_movement WHERE movement_type='egg_collection'")).rows[0].n), 1);
  await f.db.close();
});

test('集蛋分级合计、湿度和称重边界错误被阻断', async () => {
  const f = await fixture();
  await f.call('POST', `/api/v1/farm/flock-batches/${f.batch.id}/actions`, { action: 'place', houseId: f.house.id, quantity: 1000 }, 'IDEM-PLACE-003');
  const input = { collectionNo: 'EGG-GRADING-BAD', batchId: f.batch.id, houseId: f.house.id, materialId: f.material.id, warehouseId: f.warehouse.id, locationId: f.warehouse.id, collectionDate: '2026-11-23', shift: 'day', goodEggs: 100, brokenEggs: 0, dirtyEggs: 0, gradeDetail: { medium: 99 } };
  assert.equal((await f.call('POST', '/api/v1/farm/egg-collection-grading', input, 'IDEM-EGG-GRADE')).status, 400);
  assert.equal((await f.call('POST', '/api/v1/farm/environment-shift-records', { batch_id: f.batch.id, house_id: f.house.id, shift: 'day', temperature: 25, humidity: 101, threshold: 30 }, 'IDEM-ENV-HUMID')).status, 400);
  assert.equal((await f.call('POST', '/api/v1/farm/weighing-uniformity', { batch_id: f.batch.id, sample_size: 100, avg_weight: 1500, uniformity: 100.01, feeding_group_advice: 0 }, 'IDEM-WEIGH-101')).status, 400);
  await f.db.close();
});

test('饲喂出库按FEFO和移动加权批次成本自动归集鸡群成本', async () => {
  const f = await fixture();
  await f.call('POST', `/api/v1/farm/flock-batches/${f.batch.id}/actions`, { action: 'place', houseId: f.house.id, quantity: 1000 }, 'IDEM-FEED-PLACE');
  const feed = await f.create('/api/v1/inv/materials', { material_code: 'FEED-001', material_name: 'Synthetic Layer Feed', category: 'feed', uom: 'kg' });
  const feeding = await f.create('/api/v1/farm/feeding-management', { batch_id: f.batch.id, material_id: feed.id, quantity: 20, daily_feeding: 20, first_drink_feed: 0 });
  for (const lot of [{ batch: 'FEED-FEFO-A', quantity: 10, cost: 2, expiry: '2026-12-01' }, { batch: 'FEED-FEFO-B', quantity: 50, cost: 4, expiry: '2027-01-01' }]) {
    await f.db.query("INSERT INTO app.batch_expiry (material_id,batch_no,production_date,expiry_date,batch_status,company_code,created_by) VALUES ($1,$2,'2026-01-01',$3,'active','THL','TEST')", [feed.id, lot.batch, lot.expiry]);
    await f.db.query("INSERT INTO app.inventory_ledger (material_id,batch_no,location_id,company_code,warehouse_id,quantity,inventory_status,created_by) VALUES ($1,$2,$3,1,$3,$4,'available','TEST')", [feed.id, lot.batch, f.warehouse.id, lot.quantity]);
    await f.db.query('INSERT INTO app_ops.inventory_valuation (company_id,material_id,batch_no,warehouse_id,location_id,quantity,unit_cost) VALUES (1,$1,$2,$3,$3,$4,$5)', [feed.id, lot.batch, f.warehouse.id, lot.quantity, lot.cost]);
  }
  const input = { warehouseId: f.warehouse.id, locationId: f.warehouse.id, incurredOn: '2026-11-23' };
  const issued = await f.call('POST', `/api/v1/farm/feeding-management/${feeding.id}/issue`, input, 'IDEM-FEED-ISSUE-001');
  assert.equal(issued.status, 201, await issued.clone().text());
  const result = (await issued.json()).data;
  assert.equal(result.costAmount, '60.00'); assert.equal(result.allocations.length, 2);
  assert.equal(Number((await f.db.query("SELECT quantity FROM app.inventory_ledger WHERE batch_no='FEED-FEFO-A'")).rows[0].quantity), 0);
  assert.equal(Number((await f.db.query("SELECT quantity FROM app.inventory_ledger WHERE batch_no='FEED-FEFO-B'")).rows[0].quantity), 40);
  const snapshot = await f.db.query('SELECT accumulated_cost,unit_cost FROM app_ops.flock_cost_snapshot WHERE batch_id=$1', [f.batch.id]);
  assert.equal(Number(snapshot.rows[0].accumulated_cost), 60); assert.equal(Number(snapshot.rows[0].unit_cost), 0.06);
  const replay = await f.call('POST', `/api/v1/farm/feeding-management/${feeding.id}/issue`, input, 'IDEM-FEED-ISSUE-001'); assert.equal(replay.status, 201);
  const duplicate = await f.call('POST', `/api/v1/farm/feeding-management/${feeding.id}/issue`, input, 'IDEM-FEED-ISSUE-002'); assert.equal(duplicate.status, 409);
  assert.equal(Number((await f.db.query("SELECT count(*)::int AS n FROM app_ops.flock_cost_entry WHERE source_type='feeding_record'")).rows[0].n), 1);
  await f.db.close();
});


test('兽药处方状态机和停药期共同阻止提前销售放行', async () => {
  const f = await fixture();
  const prescription = await f.create('/api/v1/vet/medication-prescriptions', { batch_id: f.batch.id, drug_id: f.drug.id, usage_dosage: 2.5, approval_status: 'draft', executed: false, exception_feedback: 0 });
  assert.equal((await f.call('POST', `/api/v1/vet/medication-prescriptions/${prescription.id}/actions`, { action: 'execute' })).status, 409);
  for (const action of ['submit', 'approve', 'execute']) {
    const response = await f.call('POST', `/api/v1/vet/medication-prescriptions/${prescription.id}/actions`, { action });
    assert.equal(response.status, 200, `${action}:${await response.clone().text()}`);
  }
  const withdrawal = await f.create('/api/v1/vet/withdrawal-sale-controls', { prescription_id: prescription.id, withdrawal_days: 7, sale_block_alert: 'BLOCK_SALE', release_status: 'blocked' });
  assert.equal((await f.call('POST', `/api/v1/vet/withdrawal-sale-controls/${withdrawal.id}/actions`, { action: 'release' })).status, 409);
  await f.db.query('UPDATE app.withdrawal_period_record SET created_at=now()-interval \'8 days\' WHERE id=$1', [withdrawal.id]);
  const released = await f.call('POST', `/api/v1/vet/withdrawal-sale-controls/${withdrawal.id}/actions`, { action: 'release' });
  assert.equal(released.status, 200, await released.clone().text());
  await f.db.close();
});
