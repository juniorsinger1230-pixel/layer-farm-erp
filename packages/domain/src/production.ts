import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { withTransaction, type ActorContext } from '../../database/src/client.js';
import { AppError, validationError } from '../../shared/src/errors.js';
import { DomainService, assertReferences } from './service.js';
import { FlockCostService } from './flock-cost.js';

function requiredInteger(value: unknown, field: string): number {
  void field;
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+$/.test(String(value))) throw validationError();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw validationError();
  return parsed;
}

function requiredQuantity(value: unknown, field: string, allowZero = false): string {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+(\.\d{1,2})?$/.test(String(value))) throw validationError();
  if (Number(value) < 0 || (!allowZero && Number(value) === 0)) throw new AppError(400, 'VALIDATION_ERROR', `${field}数量不在允许范围`);
  return String(value);
}

export class ProductionService {
  private readonly domain: DomainService;

  constructor(private readonly pool: Pool, private readonly context: ActorContext) {
    this.domain = new DomainService(pool, context);
  }

  async placeFlock(batchId: string, input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const id = requiredInteger(batchId, 'batchId');
    const houseId = requiredInteger(input.houseId, 'houseId');
    const quantity = requiredQuantity(input.quantity, 'quantity');
    return this.domain.idempotent('production:place-flock', idempotencyKey, { id, houseId, quantity }, async (client) => {
      await assertReferences(client, 'transfer_record', { batch_id: id, to_house_id: houseId }, this.context);
      const batch = await client.query<{ initial_quantity: string }>('SELECT initial_quantity FROM app.farm_batch WHERE id=$1 AND company_code=$2 FOR UPDATE', [id, this.context.companyCode]);
      if (batch.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '鸡苗批次不存在');
      const allocated = await client.query<{ total: string }>('SELECT COALESCE(sum(quantity),0)::text AS total FROM app_ops.flock_position WHERE batch_id=$1 AND company_code=$2', [id, this.context.companyCode]);
      if (Number(allocated.rows[0]?.total ?? 0) + Number(quantity) > Number(batch.rows[0]!.initial_quantity)) throw new AppError(409, 'CONFLICT', '分栋数量超过批次初始数量');
      const inserted = await client.query<Record<string, unknown>>(
        `INSERT INTO app_ops.flock_position (batch_id,house_id,company_code,quantity) VALUES ($1,$2,$3,$4)
         ON CONFLICT (batch_id,house_id) DO NOTHING RETURNING batch_id,house_id,quantity,version,updated_at`,
        [id, houseId, this.context.companyCode, quantity],
      );
      if (inserted.rowCount !== 1) throw new AppError(409, 'CONFLICT', '该批次已分配到此栋舍');
      const result = inserted.rows[0]!;
      await this.domain.recordMutation(client, 'farm_batch', 'place', { ...result, id: String(id) });
      return result;
    });
  }

  async flockPosition(batchId: string): Promise<unknown> {
    const id = requiredInteger(batchId, 'batchId');
    return withTransaction(this.pool, this.context, async (client) => {
      const result = await client.query<{ quantity: string }>('SELECT batch_id,house_id,quantity,version,updated_at FROM app_ops.flock_position WHERE batch_id=$1 AND company_code=$2 ORDER BY house_id', [id, this.context.companyCode]);
      return { batchId: id, total: result.rows.reduce((sum, row) => sum + Number(row.quantity), 0), houses: result.rows };
    });
  }

  async listEggCollections(batchId?: string): Promise<unknown> {
    const parsedBatch = batchId === undefined ? undefined : requiredInteger(batchId, 'batchId');
    return withTransaction(this.pool, this.context, async (client) => {
      const values: unknown[] = [this.context.companyCode];
      const condition = parsedBatch === undefined ? '' : ' AND batch_id=$2';
      if (parsedBatch !== undefined) values.push(parsedBatch);
      const result = await client.query(`SELECT * FROM app_ops.egg_collection WHERE company_code=$1${condition} ORDER BY collection_date DESC,id DESC LIMIT 200`, values);
      return { items: result.rows, total: result.rowCount };
    });
  }

  async issueFeed(recordIdValue: unknown, input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const recordId = requiredInteger(recordIdValue, 'recordId');
    const warehouseId = requiredInteger(input.warehouseId, 'warehouseId');
    const locationId = requiredInteger(input.locationId, 'locationId');
    if (typeof input.incurredOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.incurredOn) || Number.isNaN(Date.parse(`${input.incurredOn}T00:00:00Z`))) throw validationError();
    if (Object.keys(input).some((key) => !['warehouseId', 'locationId', 'incurredOn'].includes(key))) throw validationError();
    return this.domain.idempotent('production:feed-issue', idempotencyKey, { recordId, ...input }, async (client) => {
      const feeding = await client.query<{ batch_id: string; material_id: string; quantity: string }>('SELECT batch_id,material_id,quantity FROM app.feeding_record WHERE id=$1 AND company_code=$2 FOR UPDATE', [recordId, this.context.companyCode]);
      if (feeding.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '饲喂记录不存在');
      const record = feeding.rows[0]!;
      const batchId = Number(record.batch_id); const materialId = Number(record.material_id);
      let remaining = Number(record.quantity);
      if (!Number.isFinite(remaining) || remaining <= 0) throw new AppError(409, 'CONFLICT', '饲喂数量必须大于零');
      const prior = await client.query("SELECT movement_id FROM app_ops.inventory_movement WHERE company_id=$1 AND source_type='feeding_record' AND source_id=$2", [this.context.companyId, String(recordId)]);
      if (prior.rowCount !== 0) throw new AppError(409, 'CONFLICT', '该饲喂记录已执行出库');
      const candidates = await client.query<{ id: string; batch_no: string; quantity: string; reserved: string; unit_cost: string }>(
        `SELECT l.id,l.batch_no,l.quantity,v.unit_cost,
                COALESCE((SELECT sum(r.quantity) FROM app_ops.inventory_reservation r WHERE r.inventory_id=l.id AND r.status='reserved'),0)::text AS reserved
         FROM app.inventory_ledger l
         JOIN app_ops.inventory_valuation v ON v.company_id=l.company_code AND v.material_id=l.material_id AND v.batch_no=l.batch_no AND v.warehouse_id=l.warehouse_id AND v.location_id=l.location_id
         LEFT JOIN app.batch_expiry b ON b.material_id=l.material_id AND b.batch_no=l.batch_no AND b.company_code=$2
         WHERE l.material_id=$1 AND l.company_code=$3 AND l.warehouse_id=$4 AND l.location_id=$5 AND l.inventory_status='available' AND l.quantity>0
           AND (b.id IS NULL OR (b.expiry_date>=$6::date AND b.batch_status IN ('active','near_expiry')))
         ORDER BY b.expiry_date ASC NULLS LAST,l.created_at,l.id FOR UPDATE OF l,v`,
        [materialId, this.context.companyCode, this.context.companyId, warehouseId, locationId, input.incurredOn],
      );
      const allocations: Array<{ batchNo: string; quantity: number; unitCost: number }> = [];
      for (const candidate of candidates.rows) {
        if (remaining <= 0) break;
        const available = Number(candidate.quantity) - Number(candidate.reserved);
        if (available <= 0) continue;
        const allocated = Math.min(remaining, available);
        const deducted = await client.query('UPDATE app.inventory_ledger SET quantity=quantity-$2,updated_by=$3,updated_at=now() WHERE id=$1 AND quantity>=$2', [candidate.id, allocated, this.context.actorId]);
        const valued = await client.query('UPDATE app_ops.inventory_valuation SET quantity=quantity-$6,updated_at=now() WHERE company_id=$1 AND material_id=$2 AND batch_no=$3 AND warehouse_id=$4 AND location_id=$5 AND quantity>=$6', [this.context.companyId, materialId, candidate.batch_no, warehouseId, locationId, allocated]);
        if (deducted.rowCount !== 1 || valued.rowCount !== 1) throw new AppError(409, 'CONFLICT', '饲料库存或估值不足，出库已回滚');
        await client.query(
          `INSERT INTO app_ops.inventory_movement (movement_id,company_id,material_id,batch_no,warehouse_id,location_id,movement_type,quantity,unit_cost,source_type,source_id,idempotency_key)
           VALUES ($1,$2,$3,$4,$5,$6,'issue',$7,$8,'feeding_record',$9,$10)`,
          [randomUUID(), this.context.companyId, materialId, candidate.batch_no, warehouseId, locationId, -allocated, candidate.unit_cost, String(recordId), `${idempotencyKey.slice(0, 160)}:${candidate.id}`],
        );
        allocations.push({ batchNo: candidate.batch_no, quantity: allocated, unitCost: Number(candidate.unit_cost) });
        remaining -= allocated;
      }
      if (remaining > 0) throw new AppError(409, 'CONFLICT', '指定库位FEFO饲料可用库存不足');
      const amount = allocations.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
      if (amount <= 0) throw new AppError(409, 'CONFLICT', '饲料批次成本必须大于零');
      const cost = await new FlockCostService(this.pool, this.context).postInTransaction(client, { batchId, amount, costType: 'feed', sourceType: 'feeding_record', sourceId: String(recordId), incurredOn: String(input.incurredOn), note: `饲喂记录${recordId}自动出库归集` });
      const result = { feedingRecordId: recordId, batchId, materialId, quantity: Number(record.quantity), costAmount: amount.toFixed(2), allocations, cost };
      await this.domain.recordMutation(client, 'feeding_record', 'issue', { ...record, id: String(recordId), result });
      return result;
    });
  }

  async collectEggs(input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const allowed = new Set(['collectionNo', 'batchId', 'houseId', 'materialId', 'warehouseId', 'locationId', 'collectionDate', 'shift', 'goodEggs', 'brokenEggs', 'dirtyEggs', 'gradeDetail', 'deviceRef']);
    if (Object.keys(input).some((key) => !allowed.has(key))) throw validationError();
    const collectionNo = typeof input.collectionNo === 'string' && /^[A-Za-z0-9._-]{4,40}$/.test(input.collectionNo) ? input.collectionNo : (() => { throw validationError(); })();
    const batchId = requiredInteger(input.batchId, 'batchId');
    const houseId = requiredInteger(input.houseId, 'houseId');
    const materialId = requiredInteger(input.materialId, 'materialId');
    const warehouseId = requiredInteger(input.warehouseId, 'warehouseId');
    const locationId = requiredInteger(input.locationId, 'locationId');
    const goodEggs = requiredQuantity(input.goodEggs, 'goodEggs', true);
    const brokenEggs = requiredQuantity(input.brokenEggs, 'brokenEggs', true);
    const dirtyEggs = requiredQuantity(input.dirtyEggs, 'dirtyEggs', true);
    if (Number(goodEggs) + Number(brokenEggs) + Number(dirtyEggs) <= 0) throw validationError();
    if (typeof input.collectionDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.collectionDate) || !['day', 'night', 'morning', 'evening'].includes(String(input.shift))) throw validationError();
    const gradeDetail = input.gradeDetail ?? {};
    if (typeof gradeDetail !== 'object' || gradeDetail === null || Array.isArray(gradeDetail)) throw validationError();
    const grades = Object.entries(gradeDetail as Record<string, unknown>);
    if (grades.some(([key, value]) => !['small', 'medium', 'large', 'extra_large'].includes(key) || typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw validationError();
    if (grades.length > 0 && grades.reduce((sum, [, value]) => sum + Number(value), 0) !== Number(goodEggs)) throw new AppError(400, 'VALIDATION_ERROR', '分级数量合计必须等于合格蛋数量');
    if (input.deviceRef !== undefined && (typeof input.deviceRef !== 'string' || input.deviceRef.length > 150)) throw validationError();

    return this.domain.idempotent('production:egg-collection', idempotencyKey, input, async (client) => {
      await assertReferences(client, 'egg_collection', { batch_id: batchId, house_id: houseId, material_id: materialId, warehouse_id: warehouseId, location_id: locationId }, this.context);
      const position = await client.query<{ quantity: string }>('SELECT quantity FROM app_ops.flock_position WHERE batch_id=$1 AND house_id=$2 AND company_code=$3 FOR UPDATE', [batchId, houseId, this.context.companyCode]);
      if (position.rowCount !== 1 || Number(position.rows[0]!.quantity) <= 0) throw new AppError(409, 'CONFLICT', '该栋舍没有可集蛋存栏');
      const daily = await client.query<{ total: string }>('SELECT COALESCE(sum(good_eggs+broken_eggs+dirty_eggs),0)::text AS total FROM app_ops.egg_collection WHERE batch_id=$1 AND house_id=$2 AND collection_date=$3', [batchId, houseId, input.collectionDate]);
      if (Number(daily.rows[0]?.total ?? 0) + Number(goodEggs) + Number(brokenEggs) + Number(dirtyEggs) > Number(position.rows[0]!.quantity)) throw new AppError(409, 'CONFLICT', '当日集蛋数量超过存栏理论上限');
      const inserted = await client.query(
        `INSERT INTO app_ops.egg_collection (collection_no,batch_id,house_id,material_id,warehouse_id,location_id,collection_date,shift,good_eggs,broken_eggs,dirty_eggs,grade_detail,device_ref,company_code,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15) RETURNING *`,
        [collectionNo, batchId, houseId, materialId, warehouseId, locationId, input.collectionDate, input.shift, goodEggs, brokenEggs, dirtyEggs, JSON.stringify(gradeDetail), input.deviceRef ?? null, this.context.companyCode, this.context.actorId],
      );
      const created = inserted.rows[0]!;
      const ledger = await client.query<{ id: string; quantity: string }>(
        `SELECT id,quantity FROM app.inventory_ledger WHERE material_id=$1 AND batch_no=$2 AND location_id=$3 AND company_code=$4 AND warehouse_id=$5 FOR UPDATE`,
        [materialId, collectionNo, locationId, this.context.companyId, warehouseId],
      );
      if (ledger.rowCount === 1) {
        await client.query('UPDATE app.inventory_ledger SET quantity=quantity+$2,updated_by=$3,updated_at=now() WHERE id=$1', [ledger.rows[0]!.id, goodEggs, this.context.actorId]);
      } else {
        await client.query(
          `INSERT INTO app.inventory_ledger (material_id,batch_no,location_id,company_code,warehouse_id,quantity,inventory_status,created_by)
           VALUES ($1,$2,$3,$4,$5,$6,'available',$7)`,
          [materialId, collectionNo, locationId, this.context.companyId, warehouseId, goodEggs, this.context.actorId],
        );
      }
      await client.query(
        `INSERT INTO app_ops.inventory_valuation (company_id,material_id,batch_no,warehouse_id,location_id,quantity,unit_cost)
         VALUES ($1,$2,$3,$4,$5,$6,0) ON CONFLICT (company_id,material_id,batch_no,warehouse_id,location_id)
         DO UPDATE SET quantity=app_ops.inventory_valuation.quantity+EXCLUDED.quantity,updated_at=now()`,
        [this.context.companyId, materialId, collectionNo, warehouseId, locationId, goodEggs],
      );
      await client.query(
        `INSERT INTO app_ops.inventory_movement (movement_id,company_id,material_id,batch_no,warehouse_id,location_id,movement_type,quantity,unit_cost,source_type,source_id,idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,'egg_collection',$7,0,'egg_collection',$8,$9)`,
        [randomUUID(), this.context.companyId, materialId, collectionNo, warehouseId, locationId, goodEggs, String(created.id), idempotencyKey],
      );
      await this.domain.recordMutation(client, 'egg_collection', 'create', created);
      return created;
    });
  }
}
