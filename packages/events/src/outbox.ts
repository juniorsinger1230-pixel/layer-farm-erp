import type { Pool } from 'pg';
import type { EventEnvelope, EventHandler, EventQueue } from './bullmq.js';

export class OutboxRelay {
  constructor(private readonly pool: Pool, private readonly queue: EventQueue) {}

  async publishBatch(limit = 100): Promise<{ published: number; failed: number }> {
    const client = await this.pool.connect();
    let published = 0; let failed = 0;
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.company_code','*',true),set_config('app.company_id','0',true),set_config('app.actor_id','OUTBOX',true)");
      const events = await client.query<{ event_id: string; event_type: string; aggregate_type: string; aggregate_id: string; company_id: string; company_code: string; payload: Record<string, unknown>; occurred_at: string | Date; id: string }>('SELECT o.*,c.company_code FROM app.outbox_event o JOIN app.company c ON c.id=o.company_id WHERE o.published_at IS NULL AND o.available_at<=now() ORDER BY o.id FOR UPDATE OF o SKIP LOCKED LIMIT $1', [Math.min(500, Math.max(1, Math.trunc(limit)))]);
      for (const row of events.rows) {
        try {
          const event: EventEnvelope = { eventId: row.event_id, eventType: row.event_type, aggregateType: row.aggregate_type, aggregateId: row.aggregate_id, companyId: Number(row.company_id), companyCode: row.company_code, payload: row.payload, occurredAt: new Date(row.occurred_at).toISOString(), sequence: Number(row.id) };
          await this.queue.enqueue(event);
          await client.query('UPDATE app.outbox_event SET published_at=now(),last_error=NULL WHERE id=$1', [row.id]);
          published += 1;
        } catch (error) {
          failed += 1;
          await client.query("UPDATE app.outbox_event SET publish_attempts=publish_attempts+1,last_error=left($2,1000),available_at=now()+LEAST(interval '5 minutes',interval '1 second' * power(2,LEAST(publish_attempts,10))) WHERE id=$1", [row.id, error instanceof Error ? error.message : 'queue publish failed']);
        }
      }
      await client.query('COMMIT');
      return { published, failed };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
}

export class IdempotentEventConsumer {
  constructor(private readonly pool: Pool, private readonly consumerName: string) {}

  consume(handler: EventHandler): EventHandler {
    return async (event, job) => {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.company_code',$1,true),set_config('app.company_id',$2,true),set_config('app.actor_id',$3,true)", [event.companyCode, event.companyId, `EVENT:${this.consumerName}`]);
        const claim = await client.query<{ processing_status: string; result_payload: unknown }>(
          `INSERT INTO app.idempotency_consumption (company_id,consumer_name,event_id,idempotency_key,request_hash,processing_status,first_received_at,expires_at)
           VALUES ($1,$2,$3,$4,'0000000000000000000000000000000000000000000000000000000000000000','processing',now(),now()+interval '5 minutes')
           ON CONFLICT DO NOTHING RETURNING id`,
          [event.companyId, this.consumerName, event.eventId, `${this.consumerName}:${event.eventId}`],
        );
        if (claim.rowCount === 0) {
          const existing = await client.query<{ processing_status: string; result_payload: unknown; expires_at: string | Date }>('SELECT processing_status,result_payload,expires_at FROM app.idempotency_consumption WHERE company_id=$1 AND consumer_name=$2 AND event_id=$3 FOR UPDATE', [event.companyId, this.consumerName, event.eventId]);
          if (existing.rows[0]?.processing_status === 'completed') { await client.query('COMMIT'); return existing.rows[0].result_payload; }
          if (existing.rows[0]?.processing_status === 'processing') {
            if (new Date(existing.rows[0].expires_at).getTime() > Date.now()) throw new Error('Event is already processing');
            await client.query("UPDATE app.idempotency_consumption SET processing_status='processing',result_payload=NULL,expires_at=now()+interval '5 minutes' WHERE company_id=$1 AND consumer_name=$2 AND event_id=$3", [event.companyId, this.consumerName, event.eventId]);
          }
        }
        const result = await handler(event, job);
        await client.query("UPDATE app.idempotency_consumption SET processing_status='completed',result_payload=$4::jsonb,processed_at=now(),expires_at=now()+interval '7 days' WHERE company_id=$1 AND consumer_name=$2 AND event_id=$3", [event.companyId, this.consumerName, event.eventId, JSON.stringify(result ?? { consumed: true })]);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    };
  }
}
