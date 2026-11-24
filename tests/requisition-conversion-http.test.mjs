import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../dist/apps/api/src/app.js';
import { AuthService, InMemoryAuthStore, generateMfaSecret, totp } from '../dist/packages/security/src/auth.js';

const password = 'Synthetic-Test-Passw0rd!2026';
const signingKey = 'test-only-signing-key-with-at-least-32-bytes';

class TestPool {
  constructor(db) { this.db = db; }
  query(text, values) { return this.db.query(text, values); }
  async connect() {
    const db = this.db;
    return { query: (text, values) => db.query(text, values), release: () => {} };
  }
}

async function fixture() {
  const db = new PGlite();
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8').replaceAll('CONCURRENTLY', ''));
  }
  await db.query("SELECT set_config('app.actor_id','BOOTSTRAP',false),set_config('app.company_code','*',false),set_config('app.company_id','0',false)");
  await db.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('THL','Synthetic THL','PHP','active','BOOTSTRAP')");
  const material = await db.query("INSERT INTO app.material (material_code,material_name,category,uom,company_code,created_by) VALUES ('MAT-1','Feed','feed','kg','THL','BOOTSTRAP') RETURNING id");
  const supplier = await db.query("INSERT INTO app.supplier (supplier_code,supplier_name,material_id,status,company_code,created_by) VALUES ('SUP-1','Supplier',$1,'active','THL','BOOTSTRAP') RETURNING id", [material.rows[0].id]);
  const first = await db.query("INSERT INTO app.purchase_requisition (requisition_no,material_id,quantity,approval_status,company_code,created_by) VALUES ('PR-1',$1,100,'approved','THL','BOOTSTRAP') RETURNING id", [material.rows[0].id]);
  const second = await db.query("INSERT INTO app.purchase_requisition (requisition_no,material_id,quantity,approval_status,company_code,created_by) VALUES ('PR-2',$1,100,'approved','THL','BOOTSTRAP') RETURNING id", [material.rows[0].id]);

  const authStore = new InMemoryAuthStore();
  const auth = new AuthService(authStore, { issuer: 'layer-farm-test', audience: 'layer-farm-api', signingKey });
  const mfaSecret = generateMfaSecret();
  await auth.register('admin.test', password, { employeeId: 1, employeeNo: 'ADMIN-1', companyCode: 'THL', companyId: 1, mfaEnrolled: true, roles: [{ role: 'admin' }] }, mfaSecret);
  await auth.register('purchase.staff', password, { employeeId: 2, employeeNo: 'PURCHASE-2', companyCode: 'THL', companyId: 1, mfaEnrolled: false, roles: [{ role: 'purchase_staff' }] });
  const app = createApp({ config: { nodeEnv: 'test', port: 3100, bodyLimitBytes: 8192, externalIntegrationsEnabled: false }, auth, database: new TestPool(db) });
  return { app, db, mfaSecret, firstId: Number(first.rows[0].id), secondId: Number(second.rows[0].id), supplierId: Number(supplier.rows[0].id) };
}

test('采购申请转单HTTP要求认证和采购审批权限', async () => {
  const { app, mfaSecret, firstId, secondId, supplierId } = await fixture();
  const adminLogin = await app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account: 'admin.test', password, companyCode: 'THL', mfaCode: totp(mfaSecret) }),
  });
  const adminTokens = (await adminLogin.json()).data;
  const adminResponse = await app.request(`/api/v1/proc/purchase-requisitions/${firstId}/actions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminTokens.accessToken}`, 'content-type': 'application/json', 'idempotency-key': 'HTTP-CONVERT-ADMIN-001' },
    body: JSON.stringify({ action: 'convert_to_purchase_order', data: { supplier_id: supplierId, price: 12.5 } }),
  });
  assert.equal(adminResponse.status, 200);
  const adminBody = await adminResponse.json();
  assert.equal(adminBody.data.purchaseOrder.price, '12.50');
  assert.equal(adminBody.data.requisition.approval_status, 'closed');

  const staffLogin = await app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account: 'purchase.staff', password, companyCode: 'THL' }),
  });
  const staffTokens = (await staffLogin.json()).data;
  const staffResponse = await app.request(`/api/v1/proc/purchase-requisitions/${secondId}/actions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${staffTokens.accessToken}`, 'content-type': 'application/json', 'idempotency-key': 'HTTP-CONVERT-STAFF-001' },
    body: JSON.stringify({ action: 'convert_to_purchase_order', data: { supplier_id: supplierId, price: 12.5 } }),
  });
  assert.equal(staffResponse.status, 403);

  const unauthenticated = await app.request(`/api/v1/proc/purchase-requisitions/${secondId}/actions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': 'HTTP-CONVERT-NOAUTH-001' },
    body: JSON.stringify({ action: 'convert_to_purchase_order', data: { supplier_id: supplierId, price: 12.5 } }),
  });
  assert.equal(unauthenticated.status, 401);
});
