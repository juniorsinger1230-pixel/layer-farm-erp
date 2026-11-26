import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { withTransaction, type ActorContext } from '../../database/src/client.js';
import { buildObjectScope, renderObjectScope } from '../../database/src/object-scope.js';
import { tableCatalogByName } from '../../database/src/generated/catalog.js';
import { AppError, validationError } from '../../shared/src/errors.js';
import { DomainService, assertReferences } from './service.js';

function id(value: unknown): number { if (!/^\d+$/.test(String(value)) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) throw validationError(); return Number(value); }
function amount(value: unknown): number { const n = Number(value); if (!Number.isFinite(n) || n <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(value))) throw validationError(); return n; }
function text(value: unknown, max: number): string { if (typeof value !== 'string' || value.length < 1 || value.length > max) throw validationError(); return value; }

export class SalesService {
  private readonly domain: DomainService;
  constructor(private readonly pool: Pool, private readonly context: ActorContext) { this.domain = new DomainService(pool, context); }

  async listDeliveryTasks(): Promise<{ items: Record<string, unknown>[]; total: number }> {
    return withTransaction(this.pool, this.context, async (client) => {
      const deliveryModel = tableCatalogByName.get('delivery_task');
      const deliveryColumns = new Set(deliveryModel?.columns.map((column) => column.name) ?? []);
      const renderedScope = renderObjectScope(buildObjectScope('delivery_task', deliveryColumns, this.context), 2);
      const scopeSql = renderedScope.sql === '' ? '' : ` AND ${renderedScope.sql}`;
      const result = await client.query<Record<string, unknown>>(
        `SELECT dt.*, so.order_no, so.customer_id, c.customer_name, latest.status AS latest_status, latest.sequence_no AS latest_sequence
         FROM app.delivery_task dt
         JOIN app.sales_order so ON so.id=dt.order_id AND so.company_code=dt.company_code
         JOIN app.customer c ON c.id=so.customer_id AND c.company_code=so.company_code
         LEFT JOIN LATERAL (
           SELECT status, sequence_no
           FROM app_ops.delivery_status_event event
           WHERE event.delivery_task_id=dt.id AND event.company_code=dt.company_code
           ORDER BY sequence_no DESC
           LIMIT 1
         ) latest ON true
         WHERE dt.company_code=$1${scopeSql}
         ORDER BY dt.id DESC`,
        [this.context.companyCode, ...renderedScope.values],
      );
      return { items: result.rows, total: Number(result.rowCount) };
    });
  }

  async listDiscountApprovals(status?: string): Promise<{ items: Record<string, unknown>[]; total: number }> {
    return withTransaction(this.pool, this.context, async (client) => {
      const filter = status === undefined ? '' : ' AND status=$2';
      const values: unknown[] = [this.context.companyCode];
      if (status !== undefined) {
        if (!['pending', 'approved', 'rejected'].includes(status)) throw validationError();
        values.push(status);
      }
      const result = await client.query<Record<string, unknown>>(
        `SELECT * FROM app_ops.sales_discount_approval WHERE company_code=$1${filter} ORDER BY id DESC`,
        values,
      );
      return { items: result.rows, total: Number(result.rowCount) };
    });
  }

  async requestDiscount(salesOrderIdValue: unknown, input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const salesOrderId = id(salesOrderIdValue);
    const allowed = new Set(['discountPercent', 'reason']);
    for (const key of Object.keys(input)) {
      if (!allowed.has(key)) throw validationError();
    }
    const discountPercent = Number(input.discountPercent);
    if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 25) throw validationError();
    const reason = text(input.reason, 500);
    return this.domain.idempotent('sales:discount-request', idempotencyKey, { salesOrderId, ...input }, async (client) => {
      const order = await client.query<{ id: string; status: string }>(
        'SELECT id,status FROM app.sales_order WHERE id=$1 AND company_code=$2 FOR UPDATE',
        [salesOrderId, this.context.companyCode],
      );
      if (order.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '销售订单不存在');
      if (!['draft', 'approved'].includes(order.rows[0]!.status)) {
        throw new AppError(409, 'CONFLICT', '已预占、出库或关闭订单不能申请折扣');
      }
      const existing = await client.query(
        'SELECT id FROM app_ops.sales_discount_approval WHERE company_code=$1 AND sales_order_id=$2 FOR UPDATE',
        [this.context.companyCode, salesOrderId],
      );
      if (existing.rowCount !== 0) throw new AppError(409, 'CONFLICT', '该订单已存在折扣审批记录');
      const autoApproved = discountPercent <= 5;
      const inserted = await client.query<Record<string, unknown>>(
        `INSERT INTO app_ops.sales_discount_approval
          (company_code,sales_order_id,discount_percent,reason,status,requested_by,reviewed_by,reviewed_at,review_note)
         VALUES ($1::varchar,$2::bigint,$3::numeric,$4::varchar,$5::varchar,$6::varchar,$7::varchar,$8::timestamptz,$9::varchar) RETURNING *`,
        [
          this.context.companyCode, salesOrderId, discountPercent, reason,
          autoApproved ? 'approved' : 'pending', this.context.actorId,
          autoApproved ? 'SYSTEM_AUTO' : null, autoApproved ? new Date() : null,
          autoApproved ? '折扣不超过5%，按规则自动批准' : null,
        ],
      );
      if (autoApproved) {
        await client.query(
          `UPDATE app.sales_order
            SET pricing=jsonb_build_object('discountPercent',$2::numeric,'status','approved','approvedBy','SYSTEM_AUTO')::text,
                updated_by=$3,updated_at=now()
           WHERE id=$1`,
          [salesOrderId, discountPercent, this.context.actorId],
        );
      }
      await this.domain.recordMutation(client, 'sales_discount_approval', autoApproved ? 'auto_approve' : 'request', inserted.rows[0]!);
      return inserted.rows[0];
    });
  }

  async reviewDiscount(discountIdValue: unknown, input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const discountId = id(discountIdValue);
    const allowed = new Set(['action', 'note']);
    for (const key of Object.keys(input)) {
      if (!allowed.has(key)) throw validationError();
    }
    if (!['approve', 'reject'].includes(String(input.action))) throw validationError();
    const note = input.note === undefined ? null : text(input.note, 500);
    return this.domain.idempotent('sales:discount-review', idempotencyKey, { discountId, ...input }, async (client) => {
      const record = await client.query<Record<string, unknown>>(
        'SELECT * FROM app_ops.sales_discount_approval WHERE id=$1 AND company_code=$2 FOR UPDATE',
        [discountId, this.context.companyCode],
      );
      if (record.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '折扣审批记录不存在');
      if (record.rows[0]!.status !== 'pending') throw new AppError(409, 'CONFLICT', '仅待审批折扣可执行审批动作');
      const approved = input.action === 'approve';
      const updated = await client.query<Record<string, unknown>>(
        `UPDATE app_ops.sales_discount_approval
            SET status=$3,reviewed_by=$4,reviewed_at=now(),review_note=$5::varchar,updated_at=now()
          WHERE id=$1 AND company_code=$2 RETURNING *`,
        [discountId, this.context.companyCode, approved ? 'approved' : 'rejected', this.context.actorId, note],
      );
      if (approved) {
        await client.query(
          `UPDATE app.sales_order
              SET pricing=jsonb_build_object('discountPercent',$2::numeric,'status','approved','approvedBy',$3::varchar)::text,
                  updated_by=$4,updated_at=now()
             WHERE id=$1`,
          [record.rows[0]!.sales_order_id, record.rows[0]!.discount_percent, this.context.actorId, this.context.actorId],
        );
      }
      await this.domain.recordMutation(client, 'sales_discount_approval', approved ? 'approve' : 'reject', updated.rows[0]!);
      return updated.rows[0];
    });
  }

  async createReturn(input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const salesOrderId = id(input.salesOrderId);
    const reservationId = id(input.reservationId);
    const quantity = amount(input.quantity);
    const returnNo = text(input.returnNo, 40);
    const reason = text(input.reason, 500);
    return this.domain.idempotent('sales:return', idempotencyKey, input, async (client) => {
      const order = await client.query<{ status: string; customer_id: string }>('SELECT * FROM app.sales_order WHERE id=$1 AND company_code=$2 FOR UPDATE', [salesOrderId, this.context.companyCode]);
      if (order.rowCount !== 1 || !['shipped','returned_partial'].includes(order.rows[0]!.status)) throw new AppError(409, 'CONFLICT', '仅已发货订单可退货');
      const reservation = await client.query<Record<string, unknown>>(
        `SELECT r.*,l.material_id,l.batch_no,l.warehouse_id,l.location_id,v.unit_cost,sol.unit_price
         FROM app_ops.inventory_reservation r JOIN app.inventory_ledger l ON l.id=r.inventory_id
         LEFT JOIN app_ops.inventory_valuation v ON v.company_id=l.company_code AND v.material_id=l.material_id AND v.batch_no=l.batch_no AND v.warehouse_id=l.warehouse_id AND v.location_id=l.location_id
         LEFT JOIN app_ops.sales_order_line sol ON sol.company_id=r.company_id AND sol.sales_order_id=r.sales_order_id AND sol.material_id=l.material_id
         WHERE r.id=$1 AND r.company_id=$2 AND r.sales_order_id=$3 AND r.status='consumed' ORDER BY sol.line_no LIMIT 1 FOR UPDATE OF r,l`,
        [reservationId, this.context.companyId, salesOrderId],
      );
      if (reservation.rowCount !== 1 || quantity > Number(reservation.rows[0]!.quantity)) throw new AppError(409, 'CONFLICT', '退货数量超过原出库数量或批次不匹配');
      const row = reservation.rows[0]!;
      await client.query('UPDATE app.inventory_ledger SET quantity=quantity+$2,updated_by=$3,updated_at=now() WHERE id=$1', [row.inventory_id, quantity, this.context.actorId]);
      await client.query('UPDATE app_ops.inventory_valuation SET quantity=quantity+$6,updated_at=now() WHERE company_id=$1 AND material_id=$2 AND batch_no=$3 AND warehouse_id=$4 AND location_id=$5', [this.context.companyId, row.material_id, row.batch_no, row.warehouse_id, row.location_id, quantity]);
      const credit = (quantity * Number(row.unit_price ?? 0)).toFixed(2);
      const inserted = await client.query<Record<string, unknown>>(
        `INSERT INTO app_ops.sales_return_execution (return_no,company_id,sales_order_id,original_reservation_id,quantity,credit_amount,reason,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [returnNo, this.context.companyId, salesOrderId, reservationId, quantity, credit, reason, this.context.actorId],
      );
      await client.query("INSERT INTO app_ops.inventory_movement (movement_id,company_id,material_id,batch_no,warehouse_id,location_id,movement_type,quantity,unit_cost,source_type,source_id,idempotency_key) VALUES ($1,$2,$3,$4,$5,$6,'receipt',$7,$8,'sales_return',$9,$10)", [randomUUID(), this.context.companyId, row.material_id, row.batch_no, row.warehouse_id, row.location_id, quantity, row.unit_cost ?? 0, returnNo, idempotencyKey]);
      await client.query('UPDATE app.receivable SET receivable_balance=GREATEST(0,receivable_balance-$2),updated_by=$3,updated_at=now() WHERE order_id=$1 AND company_code=$4', [salesOrderId, credit, this.context.actorId, this.context.companyCode]);
      await client.query('UPDATE app.credit_limit SET occupied_amount=GREATEST(0,occupied_amount-$2),updated_by=$3,updated_at=now() WHERE customer_id=$1 AND company_code=$4', [Number(order.rows[0]!.customer_id), credit, this.context.actorId, this.context.companyCode]);
      await client.query("UPDATE app.sales_order SET status='returned_partial',updated_by=$2,updated_at=now() WHERE id=$1", [salesOrderId, this.context.actorId]);
      await this.domain.recordMutation(client, 'sales_return_execution', 'create', inserted.rows[0] as Record<string, unknown>);
      return inserted.rows[0];
    });
  }

  async createLivestockSale(input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const saleNo = text(input.saleNo, 40);
    const saleType = text(input.saleType, 16);
    if (!['chick', 'cull'].includes(saleType)) throw validationError();
    const customerId = id(input.customerId);
    const flockBatchId = id(input.flockBatchId);
    if (typeof input.quantity !== 'number' && typeof input.quantity !== 'string') throw validationError();
    if (!/^[1-9]\d*$/.test(String(input.quantity)) || !Number.isSafeInteger(Number(input.quantity))) throw validationError();
    const quantity = Number(input.quantity);
    const unitPrice = amount(input.unitPrice);
    const requestedUnitCost = input.unitCost === undefined ? null : Number(input.unitCost);
    if (requestedUnitCost !== null && (!Number.isFinite(requestedUnitCost) || requestedUnitCost < 0 || !/^\d+(\.\d{1,4})?$/.test(String(input.unitCost)))) throw validationError();
    const saleDate = text(input.saleDate, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate) || Number.isNaN(Date.parse(`${saleDate}T00:00:00Z`))) throw validationError();
    const total = Math.round(quantity * unitPrice * 100) / 100;
    return this.domain.idempotent('sales:livestock', idempotencyKey, input, async (client) => {
      const batch = await client.query('SELECT id FROM app.farm_batch WHERE id=$1 AND company_code=$2', [flockBatchId, this.context.companyCode]);
      const customer = await client.query<{ payment_term: number }>("SELECT payment_term FROM app.customer WHERE id=$1 AND company_code=$2 AND status='active'", [customerId, this.context.companyCode]);
      if (batch.rowCount !== 1 || customer.rowCount !== 1) throw new AppError(400, 'VALIDATION_ERROR', '鸡苗/淘汰鸡批次或客户不存在');
      const withdrawal = await client.query(
        `SELECT w.id FROM app.withdrawal_period_record w JOIN app.medication_prescription p ON p.id=w.prescription_id AND p.company_code=w.company_code
         WHERE p.batch_id=$1 AND w.company_code=$2 AND w.release_status='blocked' LIMIT 1`,
        [flockBatchId, this.context.companyCode],
      );
      if (withdrawal.rowCount !== 0) throw new AppError(409, 'CONFLICT', '批次仍在停药期，禁止禽苗或淘汰鸡销售');
      const credit = await client.query('SELECT * FROM app.credit_limit WHERE customer_id=$1 AND company_code=$2 FOR UPDATE', [customerId, this.context.companyCode]);
      if (credit.rowCount === 1) {
        const row = credit.rows[0]!;
        if (Number(row.occupied_amount) + total > Number(row.credit_amount) && (row.over_limit_block === true || row.ceo_approval !== 'approved')) throw new AppError(409, 'CONFLICT', '销售金额超过客户信用额度且未获CEO特批');
      }
      const positions = await client.query<{ house_id: string; quantity: string }>('SELECT house_id,quantity FROM app_ops.flock_position WHERE batch_id=$1 AND company_code=$2 AND quantity>0 ORDER BY house_id FOR UPDATE', [flockBatchId, this.context.companyCode]);
      const available = positions.rows.reduce((sum, row) => sum + Number(row.quantity), 0);
      if (quantity > available) throw new AppError(409, 'CONFLICT', '销售数量超过鸡群当前存栏');
      let unitCost = requestedUnitCost;
      const costSnapshot = await client.query<{ unit_cost: string }>('SELECT unit_cost FROM app_ops.flock_cost_snapshot WHERE batch_id=$1 AND company_code=$2 FOR UPDATE', [flockBatchId, this.context.companyCode]);
      if (unitCost === null) {
        if (costSnapshot.rowCount !== 1) throw new AppError(409, 'CONFLICT', '缺少鸡群成本快照，请先归集批次成本');
        unitCost = Number(costSnapshot.rows[0]!.unit_cost);
      }
      if (costSnapshot.rowCount === 1) {
        await client.query(
          `UPDATE app_ops.flock_cost_snapshot SET accumulated_cost=GREATEST(0,accumulated_cost-$3),remaining_flock=$4,calculated_at=now()
           WHERE batch_id=$1 AND company_code=$2`,
          [flockBatchId, this.context.companyCode, (quantity * unitCost).toFixed(2), available - quantity],
        );
      }
      let remaining = quantity;
      for (const position of positions.rows) {
        if (remaining <= 0) break;
        const deduction = Math.min(remaining, Number(position.quantity));
        await client.query('UPDATE app_ops.flock_position SET quantity=quantity-$3,version=version+1,updated_at=now() WHERE batch_id=$1 AND house_id=$2', [flockBatchId, Number(position.house_id), deduction]);
        remaining -= deduction;
      }
      const order = await client.query<{ id: string }>(
        `INSERT INTO app.sales_order (order_no,customer_id,order_mode,detail,pricing,inventory_quantity,status,company_code,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'shipped',$7,$8) RETURNING id`,
        [saleNo.slice(0, 32), customerId, saleType, JSON.stringify({ flockBatchId, quantity }), `unitPrice=${unitPrice}`, quantity, this.context.companyCode, this.context.actorId],
      );
      const salesOrderId = Number(order.rows[0]!.id);
      const inserted = await client.query<Record<string, unknown>>(
        `INSERT INTO app_ops.livestock_sale_execution (company_code,sale_no,sales_order_id,sale_type,flock_batch_id,customer_id,quantity,unit_price,unit_cost,total_amount,sale_date,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [this.context.companyCode, saleNo, salesOrderId, saleType, flockBatchId, customerId, quantity, unitPrice, unitCost, total.toFixed(2), saleDate, this.context.actorId],
      );
      await client.query(
        `INSERT INTO app.receivable (order_id,signed,payment_term,receivable_balance,overdue,company_code,created_by)
         VALUES ($1,false,$2,$3,false,$4,$5)`,
        [salesOrderId, customer.rows[0]!.payment_term, total.toFixed(2), this.context.companyCode, this.context.actorId],
      );
      await client.query('UPDATE app.credit_limit SET occupied_amount=occupied_amount+$3,updated_by=$4,updated_at=now() WHERE customer_id=$1 AND company_code=$2', [customerId, this.context.companyCode, total.toFixed(2), this.context.actorId]);
      await this.domain.recordMutation(client, 'livestock_sale_execution', 'sell', inserted.rows[0] as Record<string, unknown>);
      return { ...inserted.rows[0], remainingFlock: available - quantity };
    });
  }

  async dispatchDeliveryTask(input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const allowed = new Set(['taskNo', 'salesOrderId', 'vehicleId', 'routeId', 'driverNo', 'courierNo', 'cargo', 'remark']);
    for (const key of Object.keys(input)) {
      if (!allowed.has(key)) throw validationError();
    }
    const taskNo = text(input.taskNo, 32);
    const salesOrderId = id(input.salesOrderId);
    const vehicleId = id(input.vehicleId);
    const routeId = id(input.routeId);
    const driverNo = id(input.driverNo);
    const courierNo = id(input.courierNo);
    const cargo = input.cargo === undefined ? null : text(input.cargo, 500);
    const remark = input.remark === undefined ? null : text(input.remark, 500);
    return this.domain.idempotent('sales:delivery-dispatch', idempotencyKey, input, async (client) => {
      const order = await client.query<{ id: string; status: string }>(
        'SELECT id,status FROM app.sales_order WHERE id=$1 AND company_code=$2 FOR UPDATE',
        [salesOrderId, this.context.companyCode],
      );
      if (order.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '销售订单不存在');
      if (order.rows[0]!.status !== 'shipped') throw new AppError(409, 'CONFLICT', '仅已出库订单可派发配送任务');
      const existing = await client.query(
        'SELECT id FROM app.delivery_task WHERE company_code=$1 AND order_id=$2 FOR UPDATE',
        [this.context.companyCode, salesOrderId],
      );
      if (existing.rowCount !== 0) throw new AppError(409, 'CONFLICT', '该销售订单已存在配送任务');
      await assertReferences(client, 'delivery_task', {
        order_id: salesOrderId, vehicle_id: vehicleId, route_id: routeId, driver_no: driverNo, courier_no: courierNo,
      }, this.context);
      const activeEmployees = await client.query(
        'SELECT id FROM app.employee WHERE company_code=$1 AND employment_status=$2 AND id = ANY($3)',
        [this.context.companyCode, 'active', [driverNo, courierNo]],
      );
      const activeIds = new Set(activeEmployees.rows.map((row) => Number(row.id)));
      if (!activeIds.has(driverNo) || !activeIds.has(courierNo)) {
        throw new AppError(400, 'VALIDATION_ERROR', '司机或配送员不是当前公司有效员工');
      }
      const task = await client.query<Record<string, unknown>>(
        `INSERT INTO app.delivery_task (task_no,order_id,cargo,vehicle_id,route_id,driver_no,courier_no,company_code,created_by,remark)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [taskNo, salesOrderId, cargo, vehicleId, routeId, driverNo, courierNo, this.context.companyCode, this.context.actorId, remark],
      );
      const initialEvent = await client.query(
        `INSERT INTO app_ops.delivery_status_event (company_code,delivery_task_id,sequence_no,status,proof,created_by)
         VALUES ($1,$2,1,'assigned','{}'::jsonb,$3) RETURNING *`,
        [this.context.companyCode, task.rows[0]!.id, this.context.actorId],
      );
      await this.domain.recordMutation(client, 'delivery_task', 'dispatch', task.rows[0] as Record<string, unknown>);
      await this.domain.recordMutation(client, 'delivery_status_event', 'assigned', initialEvent.rows[0] as Record<string, unknown>);
      return { task: task.rows[0], initialEvent: initialEvent.rows[0] };
    });
  }

  async addDeliveryEvent(taskIdValue: unknown, input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const taskId = id(taskIdValue);
    const status = text(input.status, 24);
    if (!['assigned','departed','arrived','signed','failed','cancelled'].includes(status)) throw validationError();
    const proof = typeof input.proof === 'object' && input.proof !== null && !Array.isArray(input.proof) ? input.proof : {};
    if (status === 'signed' && Object.keys(proof).length === 0) throw new AppError(400, 'VALIDATION_ERROR', '签收必须提供签收凭证');
    return this.domain.idempotent('sales:delivery-event', idempotencyKey, { taskId, ...input }, async (client) => {
      const task = await client.query<{ order_status: string; order_id: string }>('SELECT dt.*,so.status AS order_status FROM app.delivery_task dt JOIN app.sales_order so ON so.id=dt.order_id AND so.company_code=dt.company_code WHERE dt.id=$1 AND dt.company_code=$2 FOR UPDATE OF dt', [taskId, this.context.companyCode]);
      if (task.rowCount !== 1 || !['shipped','returned_partial'].includes(task.rows[0]!.order_status)) throw new AppError(409, 'CONFLICT', '配送任务不存在或订单未发货');
      const latest = await client.query<{ status: string }>('SELECT status FROM app_ops.delivery_status_event WHERE company_code=$1 AND delivery_task_id=$2 ORDER BY sequence_no DESC LIMIT 1', [this.context.companyCode, taskId]);
      const previous = latest.rows[0]?.status;
      const next = { assigned: ['departed','failed','cancelled'], departed: ['arrived','failed','cancelled'], arrived: ['signed','failed'], signed: [], failed: [], cancelled: [] } as Record<string, string[]>;
      if (previous === undefined ? status !== 'assigned' : !next[previous]?.includes(status)) throw new AppError(409, 'CONFLICT', '配送状态不允许该跳转');
      const sequence = await client.query('SELECT COALESCE(max(sequence_no),0)+1 AS next FROM app_ops.delivery_status_event WHERE company_code=$1 AND delivery_task_id=$2', [this.context.companyCode, taskId]);
      const inserted = await client.query<Record<string, unknown>>('INSERT INTO app_ops.delivery_status_event (company_code,delivery_task_id,sequence_no,status,proof,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [this.context.companyCode, taskId, Number(sequence.rows[0]!.next), status, JSON.stringify(proof), this.context.actorId]);
      if (status === 'signed') {
        const photoRef = id((proof as Record<string, unknown>).attachmentId);
        await assertReferences(client, 'delivery_receipt', { task_id: taskId, photo_ref: photoRef }, this.context);
        await client.query('INSERT INTO app.delivery_receipt (task_id,customer_sign,receipt_doc,photo_ref,has_exception,archived,company_code,created_by) VALUES ($1,true,$2,$3,false,false,$4,$5)', [taskId, JSON.stringify(proof), photoRef, this.context.companyCode, this.context.actorId]);
        await client.query('UPDATE app.receivable SET signed=true,updated_by=$2,updated_at=now() WHERE order_id=$1 AND company_code=$3', [Number(task.rows[0]!.order_id), this.context.actorId, this.context.companyCode]);
      }
      await this.domain.recordMutation(client, 'delivery_status_event', status, inserted.rows[0] as Record<string, unknown>);
      return inserted.rows[0];
    });
  }

  async statement(customerIdValue: unknown): Promise<unknown> {
    const customerId = id(customerIdValue);
    return withTransaction(this.pool, this.context, async (client) => {
      const customer = await client.query<Record<string, unknown>>('SELECT id,customer_code,customer_name,payment_term FROM app.customer WHERE id=$1 AND company_code=$2', [customerId, this.context.companyCode]);
      if (customer.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '客户不存在');
      const receivables = await client.query<{ receivable_balance: string }>(`SELECT r.*,so.order_no,COALESCE((SELECT sum(rr.cash_amount+rr.check_amount+rr.bank_credit+rr.writeoff) FROM app.receipt_record rr WHERE rr.receivable_id=r.id AND rr.company_code=r.company_code),0)::text AS settled FROM app.receivable r JOIN app.sales_order so ON so.id=r.order_id AND so.company_code=r.company_code WHERE so.customer_id=$1 AND r.company_code=$2 ORDER BY r.created_at,r.id`, [customerId, this.context.companyCode]);
      const credit = await client.query<Record<string, unknown>>('SELECT credit_amount,occupied_amount,over_limit_block,ceo_approval FROM app.credit_limit WHERE customer_id=$1 AND company_code=$2', [customerId, this.context.companyCode]);
      const balance = receivables.rows.reduce((sum, row) => sum + Number(row.receivable_balance), 0);
      return { customer: customer.rows[0], credit: credit.rows[0] ?? null, receivables: receivables.rows, balance: balance.toFixed(2) };
    });
  }
}
