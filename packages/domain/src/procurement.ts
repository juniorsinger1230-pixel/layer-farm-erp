import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { withTransaction, type ActorContext, type Queryable } from '../../database/src/client.js';
import { PostgresRepository } from '../../database/src/repository.js';
import { AppError, validationError } from '../../shared/src/errors.js';
import { DomainService, assertReferences } from './service.js';
import { InventoryService } from './inventory.js';

function positiveId(value: unknown): number {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw validationError();
  return Number(value);
}
function positiveNumber(value: unknown, zero = false): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (!zero && parsed === 0) || !/^\d+(\.\d{1,2})?$/.test(String(value))) throw validationError();
  return parsed;
}
function validDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw validationError();
  return value;
}

function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || value.includes('\0')) throw validationError();
  return value;
}

export class ProcurementService {
  private readonly domain: DomainService;
  constructor(private readonly pool: Pool, private readonly context: ActorContext) { this.domain = new DomainService(pool, context); }

  async setLeadTime(input: Record<string, unknown>): Promise<unknown> {
    const supplierId = positiveId(input.supplierId);
    const materialId = positiveId(input.materialId);
    const leadTimeDays = positiveNumber(input.leadTimeDays, true);
    if (!Number.isInteger(leadTimeDays) || leadTimeDays > 365) throw validationError();
    const effectiveFrom = validDate(input.effectiveFrom);
    return withTransaction(this.pool, this.context, async (client) => {
      await assertReferences(client, 'supplier_lead_time', { supplier_id: supplierId, material_id: materialId }, this.context);
      const result = await client.query<Record<string, unknown>>(
        `INSERT INTO app_ops.supplier_lead_time (company_code,supplier_id,material_id,lead_time_days,effective_from,created_by)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (company_code,supplier_id,material_id,effective_from)
         DO UPDATE SET lead_time_days=EXCLUDED.lead_time_days RETURNING *`,
        [this.context.companyCode, supplierId, materialId, leadTimeDays, effectiveFrom, this.context.actorId],
      );
      return result.rows[0];
    });
  }

  async calculateMrp(input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    if (!Array.isArray(input.demands) || input.demands.length < 1 || input.demands.length > 500) throw validationError();
    const demands = (input.demands as Record<string, unknown>[]).map((demand) => ({ materialId: positiveId(demand.materialId), requiredDate: validDate(demand.requiredDate), grossRequirement: positiveNumber(demand.grossRequirement, true) }));
    const convert = input.convert === true;
    const inputHash = createHash('sha256').update(JSON.stringify({ demands, convert })).digest('hex');
    return this.domain.idempotent('procurement:mrp', idempotencyKey, { demands, convert }, async (client) => {
      const runNo = `MRP-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const run = await client.query<{ id: string }>("INSERT INTO app_ops.mrp_run (run_no,company_code,input_hash,status,created_by) VALUES ($1,$2,$3,'calculated',$4) RETURNING id", [runNo, this.context.companyCode, inputHash, this.context.actorId]);
      const runId = Number(run.rows[0]!.id);
      const results: Record<string, unknown>[] = [];
      for (const demand of demands) {
        await assertReferences(client, 'mrp_line', { material_id: demand.materialId }, this.context);
        const stock = await client.query(
          `SELECT COALESCE(sum(l.quantity),0)::text AS on_hand,
            COALESCE((SELECT sum(r.quantity) FROM app_ops.inventory_reservation r JOIN app.inventory_ledger i ON i.id=r.inventory_id WHERE i.material_id=$1 AND i.company_code=$2 AND r.status='reserved'),0)::text AS reserved
           FROM app.inventory_ledger l WHERE l.material_id=$1 AND l.company_code=$2 AND l.inventory_status='available'`,
          [demand.materialId, this.context.companyId],
        );
        const inbound = await client.query(
          `SELECT COALESCE(sum(po.quantity-COALESCE((SELECT sum(m.quantity) FROM app_ops.inventory_movement m JOIN app.goods_receipt gr ON gr.id=m.source_id::bigint WHERE gr.order_id=po.id AND m.movement_type='receipt'),0)),0)::text AS quantity
           FROM app.purchase_order po WHERE po.material_id=$1 AND po.company_code=$2 AND po.execution_close IN ('open','partial')`,
          [demand.materialId, this.context.companyCode],
        );
        const safety = await client.query("SELECT COALESCE(sum(threshold_value),0)::text AS value FROM app.safety_stock WHERE material_id=$1 AND company_code=$2 AND process_status='active'", [demand.materialId, this.context.companyCode]);
        const onHand = Number(stock.rows[0]?.on_hand ?? 0);
        const reserved = Number(stock.rows[0]?.reserved ?? 0);
        const inboundQuantity = Math.max(0, Number(inbound.rows[0]?.quantity ?? 0));
        const safetyStock = Number(safety.rows[0]?.value ?? 0);
        const net = Math.max(0, demand.grossRequirement + safetyStock - Math.max(0, onHand - reserved) - inboundQuantity);
        const supplier = await client.query(
          `SELECT s.supplier_id,s.lead_time_days FROM app_ops.supplier_lead_time s JOIN app.supplier p ON p.id=s.supplier_id AND p.company_code=s.company_code
           WHERE s.company_code=$1 AND s.material_id=$2 AND s.effective_from<=$3 AND p.status='active' ORDER BY s.effective_from DESC,s.lead_time_days,s.supplier_id LIMIT 1`,
          [this.context.companyCode, demand.materialId, demand.requiredDate],
        );
        const leadTime = supplier.rows[0]?.lead_time_days as number | undefined;
        const suggestedDate = leadTime === undefined ? null : new Date(Date.parse(`${demand.requiredDate}T00:00:00Z`) - leadTime * 86400000).toISOString().slice(0, 10);
        const expedite = suggestedDate !== null && suggestedDate < new Date().toISOString().slice(0, 10);
        let requisitionId: number | null = null;
        if (convert && net > 0) {
          if (supplier.rows[0] === undefined) throw new AppError(409, 'CONFLICT', '净需求大于零但没有有效供应商与采购提前期');
          const requisition = await client.query<{ id: string }>(
            `INSERT INTO app.purchase_requisition (requisition_no,demand_source,material_id,quantity,purpose,approval_status,company_code,created_by)
             VALUES ($1,$2,$3,$4,$5,'draft',$6,$7) RETURNING id`,
            [`PR-${runNo}`.slice(0, 32), `MRP:${runNo}`, demand.materialId, net, `需求日期${demand.requiredDate}`, this.context.companyCode, this.context.actorId],
          );
          requisitionId = Number(requisition.rows[0]!.id);
        }
        const line = await client.query(
          `INSERT INTO app_ops.mrp_line (run_id,company_code,material_id,required_date,gross_requirement,on_hand,reserved,inbound,safety_stock,net_requirement,supplier_id,lead_time_days,suggested_order_date,expedite,requisition_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
          [runId, this.context.companyCode, demand.materialId, demand.requiredDate, demand.grossRequirement, onHand, reserved, inboundQuantity, safetyStock, net, supplier.rows[0]?.supplier_id ?? null, leadTime ?? null, suggestedDate, expedite, requisitionId],
        );
        results.push({ ...line.rows[0]!, required_date: demand.requiredDate, suggested_order_date: suggestedDate });
      }
      if (convert) await client.query("UPDATE app_ops.mrp_run SET status='converted' WHERE id=$1", [runId]);
      const result = { runId, runNo, status: convert ? 'converted' : 'calculated', lines: results };
      await this.domain.recordMutation(client, 'mrp_run', convert ? 'convert' : 'calculate', { ...result, id: runId });
      return result;
    });
  }

  async bindSupplier(input: Record<string, unknown>): Promise<unknown> {
    const employeeId = positiveId(input.employeeId);
    const supplierId = positiveId(input.supplierId);
    return withTransaction(this.pool, this.context, async (client) => {
      await assertReferences(client, 'supplier_account_binding', { employee_id: employeeId, supplier_id: supplierId }, this.context);
      const result = await client.query<Record<string, unknown>>(
        `INSERT INTO app_ops.supplier_account_binding (company_code,employee_id,supplier_id,status,created_by)
         VALUES ($1,$2,$3,'active',$4)
         ON CONFLICT (company_code,employee_id) DO UPDATE SET supplier_id=EXCLUDED.supplier_id,status='active' RETURNING *`,
        [this.context.companyCode, employeeId, supplierId, this.context.actorId],
      );
      await this.domain.recordMutation(client, 'supplier_account_binding', 'bind', result.rows[0] as Record<string, unknown>);
      return result.rows[0];
    });
  }

  private async portalSupplierId(client: Queryable): Promise<number> {
    const binding = await client.query<{ supplier_id: string }>(
      `SELECT b.supplier_id FROM app_ops.supplier_account_binding b JOIN app.supplier s ON s.id=b.supplier_id AND s.company_code=b.company_code
       WHERE b.company_code=$1 AND b.employee_id=$2 AND b.status='active' AND s.status='active'`,
      [this.context.companyCode, this.context.employeeId],
    );
    if (binding.rowCount !== 1) throw new AppError(403, 'FORBIDDEN', '当前账号未绑定有效供应商');
    return Number(binding.rows[0]!.supplier_id);
  }

  async portalOrders(): Promise<unknown> {
    return withTransaction(this.pool, this.context, async (client) => {
      const supplierId = await this.portalSupplierId(client);
      const orders = await client.query<Record<string, unknown>>(
        `SELECT po.id,po.order_no,po.material_id,po.quantity,po.price,po.execution_close,po.created_at,
          c.confirmed_delivery_date,c.confirmed_at,
          COALESCE((SELECT sum(a.quantity) FROM app_ops.supplier_asn a WHERE a.company_code=po.company_code AND a.purchase_order_id=po.id AND a.status IN ('submitted','received')),0)::text AS asn_quantity
         FROM app.purchase_order po LEFT JOIN app_ops.supplier_order_confirmation c ON c.company_code=po.company_code AND c.purchase_order_id=po.id
         WHERE po.company_code=$1 AND po.supplier_id=$2 ORDER BY po.created_at DESC,po.id DESC LIMIT 200`,
        [this.context.companyCode, supplierId],
      );
      return { supplierId, items: orders.rows, total: orders.rowCount };
    });
  }

  async confirmPortalOrder(orderIdValue: unknown, input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const purchaseOrderId = positiveId(orderIdValue);
    const confirmedDeliveryDate = validDate(input.confirmedDeliveryDate);
    if (confirmedDeliveryDate < new Date().toISOString().slice(0, 10)) throw new AppError(400, 'VALIDATION_ERROR', '确认交期不得早于当天');
    const note = input.note === undefined ? null : text(input.note, 500);
    return this.domain.idempotent('procurement:portal-confirm', idempotencyKey, { purchaseOrderId, confirmedDeliveryDate, note }, async (client) => {
      const supplierId = await this.portalSupplierId(client);
      const order = await client.query<{ id: string; execution_close: string }>(
        'SELECT id,execution_close FROM app.purchase_order WHERE id=$1 AND company_code=$2 AND supplier_id=$3 FOR UPDATE',
        [purchaseOrderId, this.context.companyCode, supplierId],
      );
      if (order.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '采购订单不存在或不属于当前供应商');
      if (!['approved', 'open', 'partial'].includes(order.rows[0]!.execution_close)) {
        throw new AppError(409, 'CONFLICT', '采购订单尚未完成内部审批，不能确认交期');
      }
      const result = await client.query<Record<string, unknown>>(
        `INSERT INTO app_ops.supplier_order_confirmation (company_code,purchase_order_id,supplier_id,confirmed_delivery_date,note,confirmed_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [this.context.companyCode, purchaseOrderId, supplierId, confirmedDeliveryDate, note, this.context.actorId],
      );
      await this.domain.recordMutation(client, 'supplier_order_confirmation', 'confirm', result.rows[0] as Record<string, unknown>);
      return result.rows[0];
    });
  }

  async createPortalAsn(input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const purchaseOrderId = positiveId(input.purchaseOrderId);
    const asnNo = text(input.asnNo, 40);
    const quantity = positiveNumber(input.quantity);
    const batchNo = text(input.batchNo, 32);
    if (!/^[A-Za-z0-9._-]{2,32}$/.test(batchNo)) throw validationError();
    const productionDate = validDate(input.productionDate);
    const expiryDate = validDate(input.expiryDate);
    if (expiryDate <= productionDate) throw validationError();
    return this.domain.idempotent('procurement:portal-asn', idempotencyKey, input, async (client) => {
      const supplierId = await this.portalSupplierId(client);
      const order = await client.query<{ material_id: string; quantity: string }>(
        `SELECT po.material_id,po.quantity FROM app.purchase_order po JOIN app_ops.supplier_order_confirmation c ON c.company_code=po.company_code AND c.purchase_order_id=po.id
         WHERE po.id=$1 AND po.company_code=$2 AND po.supplier_id=$3 AND po.execution_close IN ('open','partial') FOR UPDATE OF po`,
        [purchaseOrderId, this.context.companyCode, supplierId],
      );
      if (order.rowCount !== 1) throw new AppError(409, 'CONFLICT', '订单未确认、已关闭或不属于当前供应商');
      const shipped = await client.query<{ quantity: string }>("SELECT COALESCE(sum(quantity),0)::text AS quantity FROM app_ops.supplier_asn WHERE company_code=$1 AND purchase_order_id=$2 AND status IN ('submitted','received')", [this.context.companyCode, purchaseOrderId]);
      if (Number(shipped.rows[0]?.quantity ?? 0) + quantity > Number(order.rows[0]!.quantity)) throw new AppError(409, 'CONFLICT', 'ASN累计数量超过采购订单数量');
      const result = await client.query<Record<string, unknown>>(
        `INSERT INTO app_ops.supplier_asn (company_code,asn_no,purchase_order_id,supplier_id,material_id,quantity,batch_no,production_date,expiry_date,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'submitted',$10) RETURNING *`,
        [this.context.companyCode, asnNo, purchaseOrderId, supplierId, Number(order.rows[0]!.material_id), quantity, batchNo, productionDate, expiryDate, this.context.actorId],
      );
      await this.domain.recordMutation(client, 'supplier_asn', 'submit', result.rows[0] as Record<string, unknown>);
      return result.rows[0];
    });
  }

  async receivePortalAsn(asnIdValue: unknown, input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const asnId = positiveId(asnIdValue);
    const qualityStatus = input.qualityStatus;
    if (qualityStatus !== 'accepted' && qualityStatus !== 'rejected') throw validationError();
    const warehouseId = positiveId(input.warehouseId);
    const locationId = positiveId(input.locationId);
    return this.domain.idempotent('procurement:asn-receive', idempotencyKey, { asnId, ...input }, async (client) => {
      const found = await client.query<Record<string, unknown>>(
        `SELECT a.*,po.price FROM app_ops.supplier_asn a JOIN app.purchase_order po ON po.id=a.purchase_order_id AND po.company_code=a.company_code
         WHERE a.id=$1 AND a.company_code=$2 FOR UPDATE OF a,po`,
        [asnId, this.context.companyCode],
      );
      if (found.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', 'ASN不存在');
      const asn = found.rows[0]!;
      if (asn.status !== 'submitted') throw new AppError(409, 'CONFLICT', 'ASN已处理，不能重复收货');
      await assertReferences(client, 'inventory_receipt', { warehouse_id: warehouseId, location_id: locationId, material_id: Number(asn.material_id) }, this.context);
      const receipt = await client.query<{ id: string }>(
        `INSERT INTO app.goods_receipt (receipt_no,order_id,quantity,quality_status,company_code,created_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [`GR-ASN-${asnId}-${randomUUID().slice(0, 8)}`, Number(asn.purchase_order_id), Number(asn.quantity), qualityStatus, this.context.companyCode, this.context.actorId],
      );
      const goodsReceiptId = Number(receipt.rows[0]!.id);
      let inventory: unknown = null;
      if (qualityStatus === 'accepted') {
        inventory = await new InventoryService(this.pool, this.context).receiveInTransaction(client, {
          goodsReceiptId, warehouseId, locationId, batchNo: String(asn.batch_no), productionDate: new Date(String(asn.production_date)).toISOString().slice(0, 10),
          expiryDate: new Date(String(asn.expiry_date)).toISOString().slice(0, 10), unitCost: String(asn.price), idempotencyKey,
        });
      }
      await client.query('UPDATE app_ops.supplier_asn SET status=$2,received_at=now(),goods_receipt_id=$3 WHERE id=$1', [asnId, qualityStatus === 'accepted' ? 'received' : 'rejected', goodsReceiptId]);
      await this.domain.recordMutation(client, 'supplier_asn', qualityStatus === 'accepted' ? 'receive' : 'reject', { ...asn, id: asnId, status: qualityStatus === 'accepted' ? 'received' : 'rejected', goods_receipt_id: goodsReceiptId });
      return { asnId, goodsReceiptId, qualityStatus, status: qualityStatus === 'accepted' ? 'received' : 'rejected', inventory };
    });
  }

  async convertRequisition(requisitionIdValue: unknown, input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const requisitionId = positiveId(requisitionIdValue);
    const allowedKeys = new Set(['supplier_id', 'price']);
    if (Object.keys(input).some((key) => !allowedKeys.has(key))) throw validationError();
    const supplierId = positiveId(input.supplier_id);
    const price = positiveNumber(input.price);
    return this.domain.idempotent('procurement:requisition-convert', idempotencyKey, { requisitionId, supplierId, price }, async (client) => {
      const requisitionResult = await client.query<Record<string, unknown>>(
        'SELECT * FROM app.purchase_requisition WHERE id=$1 AND company_code=$2 FOR UPDATE',
        [requisitionId, this.context.companyCode],
      );
      if (requisitionResult.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '采购申请不存在');
      const before = requisitionResult.rows[0]!;
      const existing = await client.query(
        'SELECT purchase_order_id FROM app_ops.purchase_requisition_conversion WHERE company_code=$1 AND requisition_id=$2 FOR UPDATE',
        [this.context.companyCode, requisitionId],
      );
      if (existing.rowCount === 1) throw new AppError(409, 'CONFLICT', '采购申请已转换为采购订单');
      if (before.approval_status !== 'approved') throw new AppError(409, 'CONFLICT', '只有已批准采购申请才能转采购订单');
      const quantity = Number(before.quantity);
      if (quantity <= 0) throw new AppError(409, 'CONFLICT', '采购申请数量必须大于0');

      const materialId = Number(before.material_id);
      const supplier = await client.query(
        'SELECT id FROM app.supplier WHERE id=$1 AND company_code=$2 AND material_id=$3',
        [supplierId, this.context.companyCode, materialId],
      );
      if (supplier.rowCount !== 1) throw new AppError(400, 'VALIDATION_ERROR', '供应商不存在或不能供应申请物料');
      const material = await client.query(
        'SELECT id FROM app.material WHERE id=$1 AND company_code=$2',
        [materialId, this.context.companyCode],
      );
      if (material.rowCount !== 1) throw new AppError(400, 'VALIDATION_ERROR', '申请物料不存在');

      const repository = new PostgresRepository(client, this.context);
      const purchaseOrder = await repository.create<Record<string, unknown>>('purchase_order', {
        order_no: `PO-R${String(requisitionId).padStart(8, '0')}`,
        supplier_id: supplierId,
        material_id: materialId,
        quantity,
        price,
        change_log: `Converted from purchase requisition ${requisitionId}`,
        execution_close: 'draft',
        remark: `Generated from approved requisition ${requisitionId}`,
      });
      const requisition = await repository.update('purchase_requisition', String(requisitionId), { approval_status: 'closed' });
      if (requisition === null) throw new AppError(409, 'CONFLICT', '采购申请状态更新失败');

      await client.query(
        `INSERT INTO app_ops.purchase_requisition_conversion
         (company_code,requisition_id,purchase_order_id,supplier_id,material_id,quantity,converted_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [this.context.companyCode, requisitionId, Number(purchaseOrder.id), supplierId, materialId, quantity, this.context.actorId],
      );

      await this.domain.recordMutation(client, 'purchase_requisition', 'convert_to_purchase_order', requisition, before);
      await this.domain.recordMutation(client, 'purchase_order', 'create', purchaseOrder);
      return { requisition, purchaseOrder };
    });
  }

  async returnReceipt(input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const goodsReceiptId = positiveId(input.goodsReceiptId);
    const returnNo = typeof input.returnNo === 'string' && input.returnNo.length <= 40 ? input.returnNo : (() => { throw validationError(); })();
    const reason = typeof input.reason === 'string' && input.reason.length <= 500 ? input.reason : (() => { throw validationError(); })();
    return this.domain.idempotent('procurement:return', idempotencyKey, input, async (client) => {
      const receipt = await client.query('SELECT gr.*,po.material_id FROM app.goods_receipt gr JOIN app.purchase_order po ON po.id=gr.order_id WHERE gr.id=$1 AND gr.company_code=$2 FOR UPDATE OF gr,po', [goodsReceiptId, this.context.companyCode]);
      if (receipt.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '采购收货记录不存在');
      const movement = await client.query("SELECT * FROM app_ops.inventory_movement WHERE company_id=$1 AND source_type='goods_receipt' AND source_id=$2 AND movement_type='receipt' ORDER BY occurred_at LIMIT 1", [this.context.companyId, String(goodsReceiptId)]);
      if (movement.rowCount !== 1) throw new AppError(409, 'CONFLICT', '收货尚未入库，不能退货');
      const original = movement.rows[0]!;
      const returned = await client.query('SELECT COALESCE(sum(quantity),0)::text AS quantity FROM app_ops.procurement_return WHERE company_id=$1 AND goods_receipt_id=$2', [this.context.companyId, goodsReceiptId]);
      const remaining = Number(original.quantity) - Number(returned.rows[0]?.quantity ?? 0);
      const quantity = positiveNumber(input.quantity);
      if (quantity > remaining) throw new AppError(409, 'CONFLICT', '退货数量超过可退数量');
      const ledger = await client.query('SELECT id FROM app.inventory_ledger WHERE company_code=$1 AND material_id=$2 AND batch_no=$3 AND warehouse_id=$4 AND location_id=$5 FOR UPDATE', [this.context.companyId, original.material_id, original.batch_no, original.warehouse_id, original.location_id]);
      if (ledger.rowCount !== 1) throw new AppError(409, 'CONFLICT', '原收货批次库存不存在');
      const deducted = await client.query('UPDATE app.inventory_ledger SET quantity=quantity-$2,updated_by=$3,updated_at=now() WHERE id=$1 AND quantity>=$2', [ledger.rows[0]!.id, quantity, this.context.actorId]);
      if (deducted.rowCount !== 1) throw new AppError(409, 'CONFLICT', '库存已被占用或出库，无法退货');
      await client.query('UPDATE app_ops.inventory_valuation SET quantity=quantity-$6,updated_at=now() WHERE company_id=$1 AND material_id=$2 AND batch_no=$3 AND warehouse_id=$4 AND location_id=$5 AND quantity>=$6', [this.context.companyId, original.material_id, original.batch_no, original.warehouse_id, original.location_id, quantity]);
      const inserted = await client.query(
        `INSERT INTO app_ops.procurement_return (return_no,company_id,goods_receipt_id,material_id,batch_no,warehouse_id,location_id,quantity,unit_cost,reason,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [returnNo, this.context.companyId, goodsReceiptId, original.material_id, original.batch_no, original.warehouse_id, original.location_id, quantity, original.unit_cost, reason, this.context.actorId],
      );
      await client.query("INSERT INTO app_ops.inventory_movement (movement_id,company_id,material_id,batch_no,warehouse_id,location_id,movement_type,quantity,unit_cost,source_type,source_id,idempotency_key) VALUES ($1,$2,$3,$4,$5,$6,'issue',$7,$8,'procurement_return',$9,$10)", [randomUUID(), this.context.companyId, original.material_id, original.batch_no, original.warehouse_id, original.location_id, -quantity, original.unit_cost, returnNo, idempotencyKey]);
      await client.query('UPDATE app.payable SET payable_balance=GREATEST(0,payable_balance-$2),updated_by=$3,updated_at=now() WHERE goods_receipt_id=$1 AND company_code=$4', [goodsReceiptId, (quantity * Number(original.unit_cost)).toFixed(2), this.context.actorId, this.context.companyCode]);
      await this.domain.recordMutation(client, 'procurement_return', 'create', inserted.rows[0] as Record<string, unknown>);
      return inserted.rows[0];
    });
  }
}
