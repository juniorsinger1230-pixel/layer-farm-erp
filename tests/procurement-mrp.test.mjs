import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { ProcurementService } from '../dist/packages/domain/src/procurement.js';
import { DomainService } from '../dist/packages/domain/src/service.js';

class Pool { constructor(db) { this.db = db; } query(q, v) { return this.db.query(q, v); } async connect() { return { query: (q, v) => this.db.query(q, v), release: () => {} }; } }
const context = { actorId: 'TEST', employeeId: 1, companyCode: 'THL', companyId: 1 };
async function fixture() {
  const db = new PGlite();
  for (const file of readdirSync(new URL('../migrations/', import.meta.url)).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8').replaceAll('CONCURRENTLY', ''));
  await db.query("SELECT set_config('app.actor_id','TEST',false),set_config('app.company_code','*',false),set_config('app.company_id','0',false)");
  await db.query("INSERT INTO app.company (company_code,company_name,base_currency,status,created_by) VALUES ('THL','Synthetic','PHP','active','TEST')");
  await db.query("SELECT set_config('app.company_code','THL',false),set_config('app.company_id','1',false)");
  const material = await db.query("INSERT INTO app.material (material_code,material_name,category,uom,company_code,created_by) VALUES ('MAT-1','Feed','feed','kg','THL','TEST') RETURNING id");
  const supplier = await db.query("INSERT INTO app.supplier (supplier_code,supplier_name,material_id,status,company_code,created_by) VALUES ('SUP-1','Supplier',$1,'active','THL','TEST') RETURNING id", [material.rows[0].id]);
  return { db, pool: new Pool(db), materialId: Number(material.rows[0].id), supplierId: Number(supplier.rows[0].id) };
}

test('MRP按毛需求、安全库存、可用量、预占和在途计算净需求并生成采购申请', async () => {
  const f = await fixture();
  await f.db.query("INSERT INTO app.inventory_ledger (material_id,batch_no,location_id,company_code,warehouse_id,quantity,inventory_status,created_by) VALUES ($1,'B1',1,1,1,100,'available','TEST')", [f.materialId]);
  const ledger = await f.db.query('SELECT id FROM app.inventory_ledger');
  await f.db.query("INSERT INTO app_ops.inventory_reservation (company_id,sales_order_id,inventory_id,quantity,status) VALUES (1,999,$1,20,'reserved')", [ledger.rows[0].id]);
  await f.db.query("INSERT INTO app.safety_stock (material_id,threshold_value,process_status,company_code,created_by) VALUES ($1,30,'active','THL','TEST')", [f.materialId]);
  await f.db.query("INSERT INTO app.purchase_order (order_no,supplier_id,material_id,quantity,price,execution_close,company_code,created_by) VALUES ('PO-OPEN',$1,$2,50,10,'open','THL','TEST')", [f.supplierId, f.materialId]);
  const service = new ProcurementService(f.pool, context);
  await service.setLeadTime({ supplierId: f.supplierId, materialId: f.materialId, leadTimeDays: 5, effectiveFrom: '2026-01-01' });
  const result = await service.calculateMrp({ convert: true, demands: [{ materialId: f.materialId, requiredDate: '2027-01-20', grossRequirement: 200 }] }, 'MRP-IDEM-001');
  assert.equal(Number(result.lines[0].on_hand), 100);
  assert.equal(Number(result.lines[0].reserved), 20);
  assert.equal(Number(result.lines[0].inbound), 50);
  assert.equal(Number(result.lines[0].safety_stock), 30);
  assert.equal(Number(result.lines[0].net_requirement), 100);
  assert.equal(result.lines[0].suggested_order_date, '2027-01-15');
  assert.ok(result.lines[0].requisition_id);
  const replay = await service.calculateMrp({ convert: true, demands: [{ materialId: f.materialId, requiredDate: '2027-01-20', grossRequirement: 200 }] }, 'MRP-IDEM-001');
  assert.equal(replay.runId, result.runId);
  assert.equal(Number((await f.db.query('SELECT count(*)::int AS n FROM app.purchase_requisition')).rows[0].n), 1);
  await f.db.close();
});

test('已批准采购申请原子转采购订单并阻断重复、非法状态和异常输入', async () => {
  const f = await fixture();
  const requisition = await f.db.query(
    "INSERT INTO app.purchase_requisition (requisition_no,material_id,quantity,approval_status,company_code,created_by) VALUES ('PR-1',$1,100,'approved','THL','TEST') RETURNING *",
    [f.materialId],
  );
  const requisitionId = Number(requisition.rows[0].id);
  const service = new ProcurementService(f.pool, context);
  const converted = await service.convertRequisition(requisitionId, { supplier_id: f.supplierId, price: 12.5 }, 'CONVERT-IDEM-001');
  assert.equal(converted.requisition.approval_status, 'closed');
  assert.equal(converted.purchaseOrder.order_no, `PO-R${String(requisitionId).padStart(8, '0')}`);
  assert.equal(Number(converted.purchaseOrder.quantity), 100);
  assert.equal(Number(converted.purchaseOrder.price), 12.5);
  const link = await f.db.query('SELECT * FROM app_ops.purchase_requisition_conversion WHERE requisition_id=$1', [requisitionId]);
  assert.equal(link.rowCount, 1);
  assert.equal(Number(link.rows[0].purchase_order_id), Number(converted.purchaseOrder.id));
  assert.equal(Number((await f.db.query('SELECT count(*)::int AS n FROM app.audit_log')).rows[0].n), 2);
  assert.equal(Number((await f.db.query('SELECT count(*)::int AS n FROM app.outbox_event')).rows[0].n), 2);

  const replay = await service.convertRequisition(requisitionId, { supplier_id: f.supplierId, price: 12.5 }, 'CONVERT-IDEM-001');
  assert.equal(replay.purchaseOrder.id, converted.purchaseOrder.id);
  await assert.rejects(
    service.convertRequisition(requisitionId, { supplier_id: f.supplierId, price: 12.5 }, 'CONVERT-IDEM-002'),
    /已转换/,
  );
  await assert.rejects(
    service.convertRequisition(requisitionId, { supplier_id: f.supplierId, price: 0 }, 'CONVERT-IDEM-003'),
    /请求参数不符合要求/,
  );
  await f.db.close();
});

test('采购申请转单后完成审批、供应商确认、ASN收货、库存与应付闭环', async () => {
  const f = await fixture();
  await f.db.query("INSERT INTO app.organization_unit (unit_code,unit_name,org_level,status,company_code,created_by) VALUES ('OU-1','Procurement',1,'active','THL','TEST')");
  await f.db.query("INSERT INTO app.position (position_code,position_name,unit_id,effective_date,status,company_code,created_by) VALUES ('POS-1','Buyer',1,'2026-01-01','active','THL','TEST')");
  await f.db.query("INSERT INTO app.employee (employee_no,employee_name,position_id,employment_status,company_code,created_by) VALUES ('EMP-1','Portal Buyer',1,'active','THL','TEST')");
  await f.db.query("INSERT INTO app.warehouse_location (warehouse_code,warehouse_name,location_code,company_code,created_by) VALUES ('WH-1','Feed Warehouse','LOC-1',1,'TEST')");
  const requisition = await f.db.query(
    "INSERT INTO app.purchase_requisition (requisition_no,material_id,quantity,approval_status,company_code,created_by) VALUES ('PR-E2E',$1,100,'approved','THL','TEST') RETURNING id",
    [f.materialId],
  );
  const requisitionId = Number(requisition.rows[0].id);
  const procurement = new ProcurementService(f.pool, context);
  const domain = new DomainService(f.pool, context);
  const converted = await procurement.convertRequisition(requisitionId, { supplier_id: f.supplierId, price: 12.5 }, 'E2E-CONVERT-001');
  const purchaseOrderId = Number(converted.purchaseOrder.id);
  await procurement.bindSupplier({ employeeId: 1, supplierId: f.supplierId });
  await assert.rejects(
    procurement.confirmPortalOrder(purchaseOrderId, { confirmedDeliveryDate: '2027-01-10' }, 'E2E-CONFIRM-001'),
    /尚未完成内部审批/,
  );
  await domain.transition('purchase_order', String(purchaseOrderId), 'approve');
  await domain.transition('purchase_order', String(purchaseOrderId), 'open');
  await procurement.confirmPortalOrder(purchaseOrderId, { confirmedDeliveryDate: '2027-01-10', note: 'On schedule' }, 'E2E-CONFIRM-001');
  const asn = await procurement.createPortalAsn({
    purchaseOrderId, asnNo: 'ASN-E2E-001', quantity: 100, batchNo: 'BATCH-E2E',
    productionDate: '2027-01-01', expiryDate: '2027-06-01',
  }, 'E2E-ASN-001');
  const received = await procurement.receivePortalAsn(Number(asn.id), {
    warehouseId: 1, locationId: 1, qualityStatus: 'accepted',
  }, 'E2E-RECEIVE-001');
  assert.equal(received.status, 'received');
  assert.equal(received.qualityStatus, 'accepted');
  const order = await f.db.query('SELECT execution_close FROM app.purchase_order WHERE id=$1', [purchaseOrderId]);
  assert.equal(order.rows[0].execution_close, 'closed');
  const ledger = await f.db.query('SELECT quantity,inventory_status FROM app.inventory_ledger WHERE id=$1', [received.inventory.inventoryId]);
  assert.equal(Number(ledger.rows[0].quantity), 100);
  assert.equal(ledger.rows[0].inventory_status, 'available');
  const valuation = await f.db.query('SELECT quantity,unit_cost FROM app_ops.inventory_valuation WHERE company_id=1 AND material_id=$1 AND batch_no=$2', [f.materialId, 'BATCH-E2E']);
  assert.equal(Number(valuation.rows[0].quantity), 100);
  assert.equal(Number(valuation.rows[0].unit_cost), 12.5);
  const payable = await f.db.query('SELECT payable_balance,voucher_status FROM app.payable WHERE purchase_id=$1', [purchaseOrderId]);
  assert.equal(Number(payable.rows[0].payable_balance), 1250);
  assert.equal(payable.rows[0].voucher_status, 'pending');
  const processedAsn = await f.db.query('SELECT status,goods_receipt_id FROM app_ops.supplier_asn WHERE id=$1', [asn.id]);
  assert.equal(processedAsn.rows[0].status, 'received');
  assert.ok(processedAsn.rows[0].goods_receipt_id);
  await f.db.close();
});

test('采购退货限量扣减原批次和应付且超额退货回滚', async () => {
  const f = await fixture();
  const order = await f.db.query("INSERT INTO app.purchase_order (order_no,supplier_id,material_id,quantity,price,execution_close,company_code,created_by) VALUES ('PO-1',$1,$2,100,10,'closed','THL','TEST') RETURNING id", [f.supplierId, f.materialId]);
  const receipt = await f.db.query("INSERT INTO app.goods_receipt (receipt_no,order_id,quantity,quality_status,difference,company_code,created_by) VALUES ('GR-1',$1,100,'accepted',0,'THL','TEST') RETURNING id", [order.rows[0].id]);
  await f.db.query("INSERT INTO app.inventory_ledger (material_id,batch_no,location_id,company_code,warehouse_id,quantity,inventory_status,created_by) VALUES ($1,'B1',1,1,1,100,'available','TEST')", [f.materialId]);
  await f.db.query("INSERT INTO app_ops.inventory_valuation (company_id,material_id,batch_no,warehouse_id,location_id,quantity,unit_cost) VALUES (1,$1,'B1',1,1,100,10)", [f.materialId]);
  await f.db.query("INSERT INTO app_ops.inventory_movement (movement_id,company_id,material_id,batch_no,warehouse_id,location_id,movement_type,quantity,unit_cost,source_type,source_id,idempotency_key) VALUES (gen_random_uuid(),1,$1,'B1',1,1,'receipt',100,10,'goods_receipt',$2,'R1')", [f.materialId, receipt.rows[0].id]);
  await f.db.query("INSERT INTO app.payable (purchase_id,goods_receipt_id,payable_balance,payment_term,voucher_status,company_code,created_by) VALUES ($1,$2,1000,0,'pending','THL','TEST')", [order.rows[0].id, receipt.rows[0].id]);
  const service = new ProcurementService(f.pool, context);
  const returned = await service.returnReceipt({ returnNo: 'PR-1', goodsReceiptId: Number(receipt.rows[0].id), quantity: 30, reason: 'quality' }, 'RETURN-IDEM-001');
  assert.equal(Number(returned.quantity), 30);
  assert.equal(Number((await f.db.query('SELECT quantity FROM app.inventory_ledger')).rows[0].quantity), 70);
  assert.equal(Number((await f.db.query('SELECT payable_balance FROM app.payable')).rows[0].payable_balance), 700);
  await assert.rejects(() => service.returnReceipt({ returnNo: 'PR-2', goodsReceiptId: Number(receipt.rows[0].id), quantity: 80, reason: 'quality' }, 'RETURN-IDEM-002'), /超过可退数量/);
  assert.equal(Number((await f.db.query('SELECT quantity FROM app.inventory_ledger')).rows[0].quantity), 70);
  await f.db.close();
});
