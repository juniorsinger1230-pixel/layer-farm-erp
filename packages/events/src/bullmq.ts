import { Queue, Worker, type ConnectionOptions, type Job, type JobsOptions } from 'bullmq';
import { randomUUID } from 'node:crypto';

export interface EventEnvelope { eventId: string; eventType: string; aggregateType: string; aggregateId: string; companyId: number; companyCode: string; payload: Record<string, unknown>; occurredAt: string; sequence?: number }
export interface EventQueue {
  enqueue(event: EventEnvelope): Promise<void>;
  close(): Promise<void>;
}
export type EventHandler = (event: EventEnvelope, job?: Job) => Promise<unknown>;

export class BullMqEventQueue implements EventQueue {
  private readonly queue: Queue;
  private readonly deadLetterQueue: Queue;
  constructor(private readonly connection: ConnectionOptions, queueName = 'layer-farm-events', private readonly retry: { attempts: number; backoffMs: number } = { attempts: 8, backoffMs: 1000 }) {
    this.queue = new Queue(queueName, { connection });
    this.deadLetterQueue = new Queue(`${queueName}-dlq`, { connection });
  }
  async enqueue(event: EventEnvelope): Promise<void> {
    const options: JobsOptions = { jobId: event.eventId, attempts: this.retry.attempts, backoff: { type: 'exponential', delay: this.retry.backoffMs }, removeOnComplete: 1000, removeOnFail: false };
    await this.queue.add(event.eventType, event, options);
  }
  createWorker(handler: EventHandler, concurrency = 10): Worker {
    const worker = new Worker(this.queue.name, async (job) => handler(job.data as EventEnvelope, job), { connection: this.connection, concurrency, lockDuration: 30000, maxStalledCount: 2 });
    worker.on('failed', (job, error) => {
      if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
      const event = job.data as EventEnvelope;
      void this.deadLetterQueue.add('dead-letter', { event, sourceJobId: job.id, attemptsMade: job.attemptsMade, failedReason: error.message.slice(0, 1000), failedAt: new Date().toISOString() }, { jobId: `dlq-${event.eventId}`, removeOnComplete: false, removeOnFail: false }).catch((dlqError: unknown) => {
        console.error(JSON.stringify({ event: 'event_dlq_failed', eventId: event.eventId, message: dlqError instanceof Error ? dlqError.message : 'unknown' }));
      });
    });
    return worker;
  }
  async status(): Promise<{ main: Record<string, number>; deadLetter: Record<string, number> }> {
    return { main: await this.queue.getJobCounts(), deadLetter: await this.deadLetterQueue.getJobCounts() };
  }
  async deadLetters(limit = 100): Promise<Array<{ jobId: string; eventId: string; sourceJobId?: string; attemptsMade: number; failedReason: string; failedAt: string }>> {
    const jobs = await this.deadLetterQueue.getJobs(['completed', 'failed', 'waiting', 'active', 'delayed', 'paused'], 0, Math.max(0, limit - 1), true);
    return jobs.map((job) => {
      const data = job.data as { event: EventEnvelope; sourceJobId?: string; attemptsMade: number; failedReason: string; failedAt: string };
      return { jobId: String(job.id), eventId: data.event.eventId, ...(data.sourceJobId ? { sourceJobId: data.sourceJobId } : {}), attemptsMade: data.attemptsMade, failedReason: data.failedReason, failedAt: data.failedAt };
    });
  }
  async replayDeadLetter(jobId: string): Promise<void> {
    const deadLetter = await this.deadLetterQueue.getJob(jobId);
    if (!deadLetter) throw new Error('Dead-letter job not found');
    const data = deadLetter.data as { event: EventEnvelope; sourceJobId?: string };
    if (data.sourceJobId) {
      const source = await this.queue.getJob(data.sourceJobId);
      if (source) {
        const state = await source.getState();
        if (state !== 'failed') throw new Error('Source event is not in failed state');
        await source.remove();
      }
    }
    await this.enqueue(data.event);
    await deadLetter.remove();
  }
  async close(): Promise<void> { await Promise.all([this.queue.close(), this.deadLetterQueue.close()]); }
  disconnect(): void {
    void this.queue.disconnect();
    void this.deadLetterQueue.disconnect();
  }
}

export function createEventEnvelope(input: Omit<EventEnvelope, 'eventId' | 'occurredAt'> & { eventId?: string; occurredAt?: string }): EventEnvelope {
  return { ...input, eventId: input.eventId ?? randomUUID(), occurredAt: input.occurredAt ?? new Date().toISOString() };
}
