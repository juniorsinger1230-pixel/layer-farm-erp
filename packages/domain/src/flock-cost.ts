import type { Pool } from 'pg';
import { withTransaction, type ActorContext, type Queryable } from '../../database/src/client.js';
import { AppError, validationError } from '../../shared/src/errors.js';
import { DomainService } from './service.js';

const COST_TYPES = new Set(['chick', 'feed', 'vaccine', 'medication', 'labor', 'utility', 'other']);
function positiveId(value: unknown): number {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw validationError();
  return Number(value);
}
function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > maximum || value.includes('\0')) throw validationError();
  return value;
}
function date(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw validationError();
  return value;
}

export class FlockCostService {
  private readonly domain: DomainService;
  constructor(private readonly pool: Pool, private readonly context: ActorContext) { this.domain = new DomainService(pool, context); }

  async post(batchIdValue: unknown, input: Record<string, unknown>, idempotencyKey: string): Promise<unknown> {
    const batchId = positiveId(batchIdValue);
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(input.amount))) throw validationError();
    const costType = text(input.costType, 24);
    if (!COST_TYPES.has(costType)) throw validationError();
    const sourceType = text(input.sourceType, 32);
    const sourceId = text(input.sourceId, 64);
    const incurredOn = date(input.incurredOn);
    const note = input.note === undefined ? null : text(input.note, 500);
    return this.domain.idempotent('farm:flock-cost', idempotencyKey, { batchId, ...input }, async (client) => this.postInTransaction(client, { batchId, amount, costType, sourceType, sourceId, incurredOn, note }));
  }

  /** 在调用方事务内归集业务单据成本，并由来源唯一约束防止重复入账。 */
  async postInTransaction(client: Queryable, input: { batchId: number; amount: number; costType: string; sourceType: string; sourceId: string; incurredOn: string; note: string | null }): Promise<unknown> {
    const { batchId, amount, costType, sourceType, sourceId, incurredOn, note } = input;
    {
      const batch = await client.query('SELECT id FROM app.farm_batch WHERE id=$1 AND company_code=$2 FOR UPDATE', [batchId, this.context.companyCode]);
      if (batch.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '鸡群批次不存在');
      const entry = await client.query<Record<string, unknown>>(
        `INSERT INTO app_ops.flock_cost_entry (company_code,batch_id,cost_type,amount,source_type,source_id,incurred_on,note,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [this.context.companyCode, batchId, costType, amount.toFixed(2), sourceType, sourceId, incurredOn, note, this.context.actorId],
      );
      const position = await client.query<{ quantity: string }>('SELECT quantity FROM app_ops.flock_position WHERE batch_id=$1 AND company_code=$2 FOR UPDATE', [batchId, this.context.companyCode]);
      const remaining = position.rows.reduce((sum, row) => sum + Number(row.quantity), 0);
      if (remaining <= 0) throw new AppError(409, 'CONFLICT', '鸡群现存为零，不能新增待摊成本');
      const previous = await client.query<{ accumulated_cost: string }>('SELECT accumulated_cost FROM app_ops.flock_cost_snapshot WHERE batch_id=$1 AND company_code=$2 FOR UPDATE', [batchId, this.context.companyCode]);
      const accumulated = Number(previous.rows[0]?.accumulated_cost ?? 0) + amount;
      const unitCost = (accumulated / remaining).toFixed(4);
      const snapshot = await client.query<Record<string, unknown>>(
        `INSERT INTO app_ops.flock_cost_snapshot (batch_id,company_code,accumulated_cost,remaining_flock,unit_cost,calculated_at)
         VALUES ($1,$2,$3,$4,$5,now()) ON CONFLICT (batch_id,company_code)
         DO UPDATE SET accumulated_cost=EXCLUDED.accumulated_cost,remaining_flock=EXCLUDED.remaining_flock,unit_cost=EXCLUDED.unit_cost,calculated_at=now() RETURNING *`,
        [batchId, this.context.companyCode, accumulated.toFixed(2), remaining, unitCost],
      );
      const result = { entry: entry.rows[0]!, snapshot: snapshot.rows[0]! };
      await this.domain.recordMutation(client, 'flock_cost_entry', 'post', { ...entry.rows[0]!, snapshot: snapshot.rows[0]! });
      return result;
    }
  }

  async get(batchIdValue: unknown): Promise<unknown> {
    const batchId = positiveId(batchIdValue);
    return withTransaction(this.pool, this.context, async (client) => {
      const batch = await client.query('SELECT id FROM app.farm_batch WHERE id=$1 AND company_code=$2', [batchId, this.context.companyCode]);
      if (batch.rowCount !== 1) throw new AppError(404, 'NOT_FOUND', '鸡群批次不存在');
      const snapshot = await client.query<Record<string, unknown>>('SELECT * FROM app_ops.flock_cost_snapshot WHERE batch_id=$1 AND company_code=$2', [batchId, this.context.companyCode]);
      const entries = await client.query<Record<string, unknown>>('SELECT * FROM app_ops.flock_cost_entry WHERE batch_id=$1 AND company_code=$2 ORDER BY incurred_on,id DESC LIMIT 200', [batchId, this.context.companyCode]);
      return { batchId, snapshot: snapshot.rows[0] ?? null, entries: entries.rows, total: entries.rowCount };
    });
  }
}
