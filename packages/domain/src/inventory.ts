import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { withTransaction, type ActorContext, type Queryable } from '../../database/src/client.js';
import { AppError, validationError } from '../../shared/src/errors.js';
import { DomainService, assertReferences } from './service.js';

function id(value: unknown): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw validationError();
  return Number(value);
}

function quantity(value: unknown, allowZero = false): string {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+(\.\d{1,2})?$/.test(String(value)) || Number(value) < 0 || (!allowZero && Number(value) === 0)) throw validationError();
  return String(value);
}

function money(value: unknown): string {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+(\.\d{1,4})?$/.test(String(value)) || Number(value) < 0) throw validationError();
  return String(value);
}

function date(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw validationError();
  return value;
}

export class InventoryService {
  private readonly domain: DomainService;

  constructor(private readonly pool: Pool, private readonly context: ActorContext) {
    this.domain = new DomainService(pool, context);
  }

  async configureUom(input: Record<string, unknown>): Promise<unknown> {
    const materialId = id(input.materialId);
    const unitsPerPack = quantity(input.unitsPerPack);
    const effectiveFrom = date(input.effectiveFrom);
    return withTransaction(this.pool, this.context, async (client) => {
      await assertReferences(client, 'material_uom_conversion', { material_id: materialId }, this.context);
      const material = await client.query<{ uom: string; pack_uom: string | null }>('SELECT uom,pack_uom FROM app.material WHERE id=$1 AND company_code=$2', [materialId, this.context.companyCode]);
      if (material.rows[0]?.pack_uom == null) throw new AppError(400, 'VALIDATION_ERROR', '物料未定义包装单位');
      const result = await client.query<Record<string, unknown>>(
        `INSERT INTO app_ops.material_uom_conversion (company_id,material_id,base_uom,pack_uom,units_per_pack,effective_from,effective_to,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (company_id,material_id,effective_from)
         DO UPDATE SET units_per_pack=EXCLUDED.units_per_pack,effective_to=EXCLUDED.effective_to RETURNING *`,
        [this.context.companyId, materialId, material.rows[0].uom, material.rows[0].pack_uom, unitsPerPack, effectiveFrom, input.effectiveTo === undefined ? null : date(input.effectiveTo), this.context.actorId],
      );
      return result.rows[0];
    });
  }

  async receive(input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const goodsReceiptId = id(input.goodsReceiptId);
    const warehouseId = id(input.warehouseId);
    const locationId = id(input.locationId);
    const batchNo = typeof input.batchNo === 'string' && /^[A-Za-z0-9._-]{2,32}$/.test(input.batchNo) ? input.batchNo : (() => { throw validationError(); })();
    const productionDate = date(input.productionDate);
    const expiryDate = date(input.expiryDate);
    if (expiryDate <= productionDate) throw validationError();
    const unitCost = money(input.unitCost);
    const packQuantity = input.packQuantity === undefined ? undefined : quantity(input.packQuantity);
    const unitsPerPack = input.unitsPerPack === undefined ? undefined : quantity(input.unitsPerPack);
    const request = { goodsReceiptId, warehouseId, locationId, batchNo, productionDate, expiryDate, unitCost, idempotencyKey, ...(packQuantity !== undefined ? { packQuantity } : {}), ...(unitsPerPack !== undefined ? { unitsPerPack } : {}) };
    return this.domain.idempotent('inventory:receive', idempotencyKey, input, async (client) => this.receiveInTransaction(client, request));
  }

  /** 在调用方事务内复用入库内核；调用方必须提供外层幂等与原子事务。 */
  async receiveInTransaction(client: Queryable, input: { goodsReceiptId: number; warehouseId: number; locationId: number; batchNo: string; productionDate: string; expiryDate: string; unitCost: string; idempotencyKey: string; packQuantity?: string | undefined; unitsPerPack?: string | undefined }): Promise<unknown> {
    const { goodsReceiptId, warehouseId, locationId, batchNo, productionDate, expiryDate, unitCost, packQuantity, unitsPerPack, idempotencyKey } = input;
    {
      const receipt = await client.query(
        `SELECT gr.*,po.material_id,po.quantity AS ordered_quantity,po.price FROM app.goods_receipt gr
         JOIN app.purchase_order po ON po.id=gr.order_id AND po.company_code=gr.company_code
         WHERE gr.id=$1 AND gr.company_code=$2 FOR UPDATE OF gr,po`,
        [goodsReceiptId, this.context.companyCode],
      );
      if (receipt.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '采购收货记录不存在');
      const row = receipt.rows[0]!;
      if (row.quality_status !== 'accepted') throw new AppError(409, 'CONFLICT', '质检未合格的收货不得入库');
      if (packQuantity !== undefined || unitsPerPack !== undefined) {
        if (packQuantity === undefined || unitsPerPack === undefined || Number(packQuantity) * Number(unitsPerPack) !== Number(row.quantity)) throw new AppError(400, 'VALIDATION_ERROR', '包装数量乘换算率必须等于基本单位收货数量');
      }
      await assertReferences(client, 'inventory_receipt', { warehouse_id: warehouseId, location_id: locationId, material_id: Number(row.material_id) }, this.context);
      const prior = await client.query<{ total: string }>("SELECT COALESCE(sum(quantity),0)::text AS total FROM app_ops.inventory_movement WHERE source_type='goods_receipt' AND source_id=$1 AND movement_type='receipt'", [String(goodsReceiptId)]);
      if (Number(prior.rows[0]?.total ?? 0) + Number(row.quantity) > Number(row.ordered_quantity)) throw new AppError(409, 'CONFLICT', '累计入库数量超过采购订单数量');
      await client.query(
        `INSERT INTO app.batch_expiry (material_id,batch_no,production_date,expiry_date,batch_status,company_code,created_by)
         VALUES ($1,$2,$3,$4,'active',$5,$6) ON CONFLICT DO NOTHING`,
        [row.material_id, batchNo, productionDate, expiryDate, this.context.companyCode, this.context.actorId],
      );
      const existingBatch = await client.query('SELECT production_date,expiry_date,batch_status FROM app.batch_expiry WHERE material_id=$1 AND batch_no=$2 AND company_code=$3', [row.material_id, batchNo, this.context.companyCode]);
      if (existingBatch.rowCount !== 1 || existingBatch.rows[0]!.batch_status === 'blocked') throw new AppError(409, 'CONFLICT', '批次不可用');
      const ledger = await client.query<{ id: string }>(
        'SELECT id FROM app.inventory_ledger WHERE material_id=$1 AND batch_no=$2 AND location_id=$3 AND company_code=$4 AND warehouse_id=$5 FOR UPDATE',
        [row.material_id, batchNo, locationId, this.context.companyId, warehouseId],
      );
      let inventoryId: number;
      if (ledger.rowCount === 1) {
        inventoryId = Number(ledger.rows[0]!.id);
        await client.query("UPDATE app.inventory_ledger SET quantity=quantity+$2,inventory_status='available',updated_by=$3,updated_at=now() WHERE id=$1", [inventoryId, row.quantity, this.context.actorId]);
      } else {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO app.inventory_ledger (material_id,batch_no,location_id,company_code,warehouse_id,quantity,inventory_status,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,'available',$7) RETURNING id`,
          [row.material_id, batchNo, locationId, this.context.companyId, warehouseId, row.quantity, this.context.actorId],
        );
        inventoryId = Number(inserted.rows[0]!.id);
      }
      const valuation = await client.query<{ quantity: string; unit_cost: string }>(
        'SELECT quantity,unit_cost FROM app_ops.inventory_valuation WHERE company_id=$1 AND material_id=$2 AND batch_no=$3 AND warehouse_id=$4 AND location_id=$5 FOR UPDATE',
        [this.context.companyId, row.material_id, batchNo, warehouseId, locationId],
      );
      const old = valuation.rows[0];
      const oldQuantity = Number(old?.quantity ?? 0);
      const newQuantity = oldQuantity + Number(row.quantity);
      const average = newQuantity === 0 ? 0 : (oldQuantity * Number(old?.unit_cost ?? 0) + Number(row.quantity) * Number(unitCost)) / newQuantity;
      await client.query(
        `INSERT INTO app_ops.inventory_valuation (company_id,material_id,batch_no,warehouse_id,location_id,quantity,unit_cost)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (company_id,material_id,batch_no,warehouse_id,location_id)
         DO UPDATE SET quantity=EXCLUDED.quantity,unit_cost=EXCLUDED.unit_cost,updated_at=now()`,
        [this.context.companyId, row.material_id, batchNo, warehouseId, locationId, newQuantity, average.toFixed(4)],
      );
      await client.query(
        `INSERT INTO app.payable (purchase_id,goods_receipt_id,payable_balance,payment_term,voucher_status,company_code,created_by)
         VALUES ($1,$2,$3,0,'pending',$4,$5) ON CONFLICT DO NOTHING`,
        [row.order_id, goodsReceiptId, (Number(row.quantity) * Number(unitCost)).toFixed(2), this.context.companyCode, this.context.actorId],
      );
      const movement = await client.query(
        `INSERT INTO app_ops.inventory_movement (movement_id,company_id,material_id,batch_no,warehouse_id,location_id,movement_type,quantity,unit_cost,source_type,source_id,idempotency_key,pack_quantity,units_per_pack)
         VALUES ($1,$2,$3,$4,$5,$6,'receipt',$7,$8,'goods_receipt',$9,$10,$11,$12) RETURNING *`,
        [randomUUID(), this.context.companyId, row.material_id, batchNo, warehouseId, locationId, row.quantity, unitCost, String(goodsReceiptId), idempotencyKey, packQuantity ?? null, unitsPerPack ?? null],
      );
      const receivedTotal = Number(prior.rows[0]?.total ?? 0) + Number(row.quantity);
      await client.query('UPDATE app.purchase_order SET execution_close=$1,updated_by=$2,updated_at=now() WHERE id=$3', [receivedTotal >= Number(row.ordered_quantity) ? 'closed' : 'partial', this.context.actorId, row.order_id]);
      await this.domain.recordMutation(client, 'goods_receipt', 'receive', { ...movement.rows[0], id: String(goodsReceiptId), inventoryId });
      return { ...movement.rows[0], inventoryId, movingAverageCost: average.toFixed(4) };
    }
  }

  async reserve(salesOrderIdValue: unknown, linesInput: unknown, idempotencyKey: string): Promise<unknown> {
    const salesOrderId = id(salesOrderIdValue);
    if (!Array.isArray(linesInput) || linesInput.length < 1 || linesInput.length > 100) throw validationError();
    const lines = linesInput.map((line) => {
      if (typeof line !== 'object' || line === null) throw validationError();
      const record = line as Record<string, unknown>;
      return { materialId: id(record.materialId), quantity: quantity(record.quantity), unitPrice: money(record.unitPrice), uom: typeof record.uom === 'string' && record.uom.length <= 32 ? record.uom : (() => { throw validationError(); })() };
    });
    return this.domain.idempotent('inventory:reserve', idempotencyKey, { salesOrderId, lines }, async (client) => {
      const order = await client.query('SELECT * FROM app.sales_order WHERE id=$1 AND company_code=$2 FOR UPDATE', [salesOrderId, this.context.companyCode]);
      if (order.rowCount !== 1 || order.rows[0]!.status !== 'approved') throw new AppError(409, 'CONFLICT', '仅已批准销售订单可预占库存');
      let totalCents = 0;
      let totalQuantity = 0;
      const allocations: { materialId: number; inventoryId: number; batchNo: string; quantity: number }[] = [];
      const pendingDiscount = await client.query(
        `SELECT id
           FROM app_ops.sales_discount_approval
          WHERE company_code=$1 AND sales_order_id=$2 AND status='pending'`,
        [this.context.companyCode, salesOrderId],
      );
      if (Number(pendingDiscount.rowCount) > 0) {
        throw new AppError(409, 'CONFLICT', '订单存在待审批折扣，不能预占库存');
      }
      const discount = await client.query<{ discount_percent: string }>(
        `SELECT discount_percent
           FROM app_ops.sales_discount_approval
          WHERE company_code=$1 AND sales_order_id=$2 AND status='approved'`,
        [this.context.companyCode, salesOrderId],
      );
      const discountPercent = Number(discount.rows[0]?.discount_percent ?? 0);
      for (const [lineIndex, line] of lines.entries()) {
        let remaining = Number(line.quantity);
        totalQuantity += remaining;
        const grossCents = Math.round(Number(line.quantity) * Number(line.unitPrice) * 100);
        const lineCents = Math.round(grossCents * (1 - discountPercent / 100));
        totalCents += lineCents;
        const candidates = await client.query<{ id: string; batch_no: string; quantity: string; reserved: string }>(
          `SELECT l.id,l.batch_no,l.quantity,l.warehouse_id,l.location_id,
                  COALESCE((SELECT sum(r.quantity) FROM app_ops.inventory_reservation r WHERE r.inventory_id=l.id AND r.status='reserved'),0)::text AS reserved,
                  b.expiry_date
           FROM app.inventory_ledger l
           LEFT JOIN app.batch_expiry b ON b.material_id=l.material_id AND b.batch_no=l.batch_no AND b.company_code=$2
           WHERE l.material_id=$1 AND l.company_code=$3 AND l.inventory_status='available' AND l.quantity>0
             AND (b.id IS NULL OR (b.expiry_date>=CURRENT_DATE AND b.batch_status IN ('active','near_expiry')))
             AND NOT EXISTS (
               SELECT 1 FROM app_ops.inventory_movement m
               JOIN app_ops.egg_collection e ON e.id=m.source_id::bigint AND e.company_code=$2
               JOIN app.medication_prescription p ON p.batch_id=e.batch_id AND p.company_code=e.company_code
               JOIN app.withdrawal_period_record w ON w.prescription_id=p.id AND w.company_code=e.company_code
               WHERE m.batch_no=l.batch_no AND m.movement_type='egg_collection' AND m.company_id=$3 AND w.release_status='blocked')
           ORDER BY b.expiry_date ASC NULLS LAST,l.created_at,l.id FOR UPDATE OF l`,
          [line.materialId, this.context.companyCode, this.context.companyId],
        );
        for (const candidate of candidates.rows) {
          if (remaining <= 0) break;
          const available = Number(candidate.quantity) - Number(candidate.reserved);
          if (available <= 0) continue;
          const allocated = Math.min(remaining, available);
          await client.query(
            `INSERT INTO app_ops.inventory_reservation (company_id,sales_order_id,inventory_id,quantity,status)
             VALUES ($1,$2,$3,$4,'reserved')`,
            [this.context.companyId, salesOrderId, candidate.id, allocated],
          );
          allocations.push({ materialId: line.materialId, inventoryId: Number(candidate.id), batchNo: candidate.batch_no, quantity: allocated });
          remaining -= allocated;
        }
        if (remaining > 0) throw new AppError(409, 'CONFLICT', 'FEFO可用库存不足或批次处于停药/临期阻断状态');
        await client.query(
          `INSERT INTO app_ops.sales_order_line (company_id,sales_order_id,line_no,material_id,quantity,uom,unit_price,line_amount)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [this.context.companyId, salesOrderId, lineIndex + 1, line.materialId, line.quantity, line.uom, line.unitPrice, (lineCents / 100).toFixed(2)],
        );
      }
      const credit = await client.query('SELECT * FROM app.credit_limit WHERE customer_id=$1 AND company_code=$2 FOR UPDATE', [Number(order.rows[0]!.customer_id), this.context.companyCode]);
      if (credit.rowCount === 1) {
        const row = credit.rows[0]!;
        const projected = Number(row.occupied_amount) + totalCents / 100;
        if (projected > Number(row.credit_amount) && (row.over_limit_block === true || row.ceo_approval !== 'approved')) throw new AppError(409, 'CONFLICT', '订单金额超过客户信用额度且未获CEO特批');
      }
      await client.query("UPDATE app.sales_order SET status='allocated',inventory_quantity=$2,updated_by=$3,updated_at=now() WHERE id=$1", [salesOrderId, totalQuantity, this.context.actorId]);
      const result = { salesOrderId, status: 'allocated', totalAmount: (totalCents / 100).toFixed(2), allocations };
      await this.domain.recordMutation(client, 'sales_order', 'allocate', { ...order.rows[0], status: 'allocated' }, order.rows[0]);
      return result;
    });
  }

  async issue(salesOrderIdValue: unknown, idempotencyKey: string): Promise<unknown> {
    const salesOrderId = id(salesOrderIdValue);
    return this.domain.idempotent('inventory:issue', idempotencyKey, { salesOrderId }, async (client) => {
      const order = await client.query('SELECT * FROM app.sales_order WHERE id=$1 AND company_code=$2 FOR UPDATE', [salesOrderId, this.context.companyCode]);
      if (order.rowCount !== 1 || order.rows[0]!.status !== 'allocated') throw new AppError(409, 'CONFLICT', '仅已完成预占的订单可出库');
      const reservations = await client.query(
        `SELECT r.*,l.material_id,l.batch_no,l.warehouse_id,l.location_id,v.unit_cost
         FROM app_ops.inventory_reservation r JOIN app.inventory_ledger l ON l.id=r.inventory_id
         LEFT JOIN app_ops.inventory_valuation v ON v.company_id=l.company_code AND v.material_id=l.material_id AND v.batch_no=l.batch_no AND v.warehouse_id=l.warehouse_id AND v.location_id=l.location_id
         WHERE r.company_id=$1 AND r.sales_order_id=$2 AND r.status='reserved' ORDER BY r.id FOR UPDATE OF r,l`,
        [this.context.companyId, salesOrderId],
      );
      if (reservations.rowCount === 0) throw new AppError(409, 'CONFLICT', '订单没有可出库预占');
      for (const reservation of reservations.rows) {
        const deducted = await client.query('UPDATE app.inventory_ledger SET quantity=quantity-$2,updated_by=$3,updated_at=now() WHERE id=$1 AND quantity>=$2 RETURNING id', [reservation.inventory_id, reservation.quantity, this.context.actorId]);
        if (deducted.rowCount !== 1) throw new AppError(409, 'CONFLICT', '库存不足，出库已回滚');
        const valued = await client.query('UPDATE app_ops.inventory_valuation SET quantity=quantity-$6,updated_at=now() WHERE company_id=$1 AND material_id=$2 AND batch_no=$3 AND warehouse_id=$4 AND location_id=$5 AND quantity>=$6', [this.context.companyId, reservation.material_id, reservation.batch_no, reservation.warehouse_id, reservation.location_id, reservation.quantity]);
        if (valued.rowCount !== 1) throw new AppError(409, 'CONFLICT', '库存估值数量不一致');
        await client.query(
          `INSERT INTO app_ops.inventory_movement (movement_id,company_id,material_id,batch_no,warehouse_id,location_id,movement_type,quantity,unit_cost,source_type,source_id,idempotency_key)
           VALUES ($1,$2,$3,$4,$5,$6,'sales_issue',$7,$8,'sales_order',$9,$10)`,
          [randomUUID(), this.context.companyId, reservation.material_id, reservation.batch_no, reservation.warehouse_id, reservation.location_id, -Number(reservation.quantity), reservation.unit_cost ?? 0, String(salesOrderId), `${idempotencyKey}:${reservation.id}`],
        );
        await client.query("UPDATE app_ops.inventory_reservation SET status='consumed' WHERE id=$1", [reservation.id]);
      }
      await client.query(
        `INSERT INTO app.outbound_record (outbound_no,outbound_type,sales_ref,company_code,created_by)
         VALUES ($1,'sales',$2,$3,$4)`,
        [`OUT-${String(order.rows[0]!.order_no).slice(0, 26)}`, salesOrderId, this.context.companyCode, this.context.actorId],
      );
      await client.query("UPDATE app.sales_order SET status='shipped',updated_by=$2,updated_at=now() WHERE id=$1", [salesOrderId, this.context.actorId]);
      const total = await client.query<{ amount: string }>('SELECT COALESCE(sum(line_amount),0)::text AS amount FROM app_ops.sales_order_line WHERE company_id=$1 AND sales_order_id=$2', [this.context.companyId, salesOrderId]);
      const customer = await client.query<{ payment_term: number }>('SELECT payment_term FROM app.customer WHERE id=$1 AND company_code=$2', [Number(order.rows[0]!.customer_id), this.context.companyCode]);
      await client.query(
        `INSERT INTO app.receivable (order_id,signed,payment_term,receivable_balance,overdue,company_code,created_by)
         SELECT $1::bigint,false,$2::integer,$3::numeric(14,2),false,$4::varchar(16),$5::varchar(32) WHERE NOT EXISTS (SELECT 1 FROM app.receivable WHERE order_id=$1::bigint AND company_code=$4::varchar(16))`,
        [salesOrderId, customer.rows[0]?.payment_term ?? 0, total.rows[0]?.amount ?? 0, this.context.companyCode, this.context.actorId],
      );
      await client.query('UPDATE app.credit_limit SET occupied_amount=occupied_amount+(SELECT COALESCE(sum(line_amount),0) FROM app_ops.sales_order_line WHERE company_id=$1 AND sales_order_id=$2),updated_by=$3,updated_at=now() WHERE customer_id=$4 AND company_code=$5', [this.context.companyId, salesOrderId, this.context.actorId, Number(order.rows[0]!.customer_id), this.context.companyCode]);
      const result = { salesOrderId, status: 'shipped', movements: reservations.rowCount, consumedReservationIds: reservations.rows.map((row) => Number(row.id)) };
      await this.domain.recordMutation(client, 'sales_order', 'ship', { ...order.rows[0], status: 'shipped' }, order.rows[0]);
      return result;
    });
  }

  async release(salesOrderIdValue: unknown, idempotencyKey: string): Promise<unknown> {
    const salesOrderId = id(salesOrderIdValue);
    return this.domain.idempotent('inventory:release', idempotencyKey, { salesOrderId }, async (client) => {
      const order = await client.query('SELECT * FROM app.sales_order WHERE id=$1 AND company_code=$2 FOR UPDATE', [salesOrderId, this.context.companyCode]);
      if (order.rowCount !== 1 || order.rows[0]!.status !== 'allocated') throw new AppError(409, 'CONFLICT', '仅已预占未出库订单可释放库存');
      const released = await client.query("UPDATE app_ops.inventory_reservation SET status='released' WHERE company_id=$1 AND sales_order_id=$2 AND status='reserved' RETURNING id", [this.context.companyId, salesOrderId]);
      await client.query("UPDATE app.sales_order SET status='approved',inventory_quantity=0,updated_by=$2,updated_at=now() WHERE id=$1", [salesOrderId, this.context.actorId]);
      const result = { salesOrderId, status: 'approved', released: released.rowCount };
      await this.domain.recordMutation(client, 'sales_order', 'release_allocation', { ...order.rows[0], status: 'approved', inventory_quantity: 0 }, order.rows[0]);
      return result;
    });
  }

  async trace(materialIdValue: unknown, batchNoValue: unknown): Promise<unknown> {
    const materialId = id(materialIdValue);
    if (typeof batchNoValue !== 'string' || !/^[A-Za-z0-9._-]{2,32}$/.test(batchNoValue)) throw validationError();
    return withTransaction(this.pool, this.context, async (client) => {
      const movements = await client.query('SELECT * FROM app_ops.inventory_movement WHERE company_id=$1 AND material_id=$2 AND batch_no=$3 ORDER BY occurred_at,movement_id', [this.context.companyId, materialId, batchNoValue]);
      const ledger = await client.query('SELECT * FROM app.inventory_ledger WHERE company_code=$1 AND material_id=$2 AND batch_no=$3', [this.context.companyId, materialId, batchNoValue]);
      if (movements.rowCount === 0 && ledger.rowCount === 0) throw new AppError(404, 'NOT_FOUND', '批次追溯记录不存在');
      return { materialId, batchNo: batchNoValue, positions: ledger.rows, movements: movements.rows };
    });
  }

  async positions(materialIdValue?: string): Promise<unknown> {
    const materialId = materialIdValue === undefined ? undefined : id(materialIdValue);
    return withTransaction(this.pool, this.context, async (client) => {
      const values: unknown[] = [this.context.companyId];
      const condition = materialId === undefined ? '' : ' AND l.material_id=$2';
      if (materialId !== undefined) values.push(materialId);
      const result = await client.query<{ on_hand: string; reserved: string }>(
        `SELECT l.id,l.material_id,l.batch_no,l.warehouse_id,l.location_id,l.quantity AS on_hand,
          COALESCE((SELECT sum(r.quantity) FROM app_ops.inventory_reservation r WHERE r.inventory_id=l.id AND r.status='reserved'),0)::text AS reserved,
          v.unit_cost,b.expiry_date,b.batch_status
         FROM app.inventory_ledger l
         LEFT JOIN app_ops.inventory_valuation v ON v.company_id=l.company_code AND v.material_id=l.material_id AND v.batch_no=l.batch_no AND v.warehouse_id=l.warehouse_id AND v.location_id=l.location_id
         LEFT JOIN app.batch_expiry b ON b.material_id=l.material_id AND b.batch_no=l.batch_no AND b.company_code=$${values.length + 1}
         WHERE l.company_code=$1${condition} ORDER BY l.material_id,b.expiry_date ASC NULLS LAST,l.id`,
        [...values, this.context.companyCode],
      );
      return { items: result.rows.map((row) => ({ ...row, available: Number(row.on_hand) - Number(row.reserved) })), total: result.rowCount };
    });
  }

  async recordStocktakeLines(stocktakeIdValue: unknown, linesInput: unknown, idempotencyKey: string): Promise<unknown> {
    const stocktakeId = id(stocktakeIdValue);
    if (!Array.isArray(linesInput) || linesInput.length < 1) throw validationError();
    return this.domain.idempotent('inventory:stocktake-lines', idempotencyKey, { stocktakeId, linesInput }, async (client) => {
      const header = await client.query('SELECT approval_status FROM app.stocktake_record WHERE id=$1 AND company_code=$2 FOR UPDATE', [stocktakeId, this.context.companyCode]);
      if (header.rowCount !== 1 || header.rows[0]!.approval_status !== 'draft') throw new AppError(409, 'CONFLICT', '仅草稿盘点单可录入明细');
      for (const raw of linesInput as Record<string, unknown>[]) {
        const inventoryId = id(raw.inventoryId);
        const actual = quantity(raw.actualQuantity, true);
        const locked = await client.query('SELECT quantity FROM app.inventory_ledger WHERE id=$1 AND company_code=$2 FOR UPDATE', [inventoryId, this.context.companyId]);
        if (locked.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '盘点库存记录不存在');
        const book = Number(locked.rows[0]!.quantity);
        await client.query(
          `INSERT INTO app_ops.stocktake_line (company_id,stocktake_id,inventory_id,book_quantity,actual_quantity,difference)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [this.context.companyId, stocktakeId, inventoryId, book, actual, Number(actual) - book],
        );
      }
      return { stocktakeId, lines: (linesInput as unknown[]).length, status: 'draft' };
    });
  }
}
