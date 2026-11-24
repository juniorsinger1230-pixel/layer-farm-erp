import { serve } from '@hono/node-server';
import { resolve } from 'node:path';
import type { Server as HttpServer } from 'node:http';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { AuthService } from '../../../packages/security/src/auth.js';
import { PostgresAuthStore } from '../../../packages/security/src/postgres-store.js';
import type { ConnectionOptions } from 'bullmq';
import { BullMqEventQueue } from '../../../packages/events/src/bullmq.js';
import { IdempotentEventConsumer, OutboxRelay } from '../../../packages/events/src/outbox.js';
import { NotificationHub } from '../../../packages/events/src/websocket.js';
import { LocalSandboxAdapter, type PrinterAdapter } from '../../../packages/integrations/src/print.js';
import { FallbackRateLimiter, InMemoryRateLimiter, ValkeyRateLimiter } from '../../../packages/integrations/src/rate-limiter.js';
import { LocalAttachmentStore } from '../../../packages/integrations/src/attachments.js';

const config = loadConfig();
const pool = config.databaseUrl ? new Pool({ connectionString: config.databaseUrl, max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined }) : undefined;
const auth = pool && config.jwtSigningKey ? new AuthService(new PostgresAuthStore(pool), { issuer: 'layer-farm-erp', audience: 'layer-farm-web', signingKey: config.jwtSigningKey, mfaEnabled: config.mfaEnabled }) : undefined;
const redis = config.valkeyUrl ? new Redis(config.valkeyUrl, { maxRetriesPerRequest: null, enableReadyCheck: true, lazyConnect: true }) : undefined;
const rateLimitRedis = config.valkeyUrl ? new Redis(config.valkeyUrl, { maxRetriesPerRequest: 2, enableReadyCheck: true, commandTimeout: 2000 }) : undefined;
const queueConnection: ConnectionOptions | undefined = config.valkeyUrl ? (() => {
  const url = new URL(config.valkeyUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    db: Number(url.pathname.slice(1) || 0),
  };
})() : undefined;
pool?.on('error', (error) => console.error(JSON.stringify({ event: 'database_pool_error', error: error.message })));
redis?.on('error', (error) => console.error(JSON.stringify({ event: 'valkey_connection_error', error: error.message })));
rateLimitRedis?.on('error', (error) => console.error(JSON.stringify({ event: 'rate_limit_valkey_error', error: error.message })));
const queue = pool && queueConnection ? new BullMqEventQueue(queueConnection, config.eventQueueName ?? 'layer-farm-events') : undefined;
const printerAdapters = config.printSandboxMode ? new Map<string, PrinterAdapter>(['pdf', 'escp', 'tspl'].map((format) => [format, new LocalSandboxAdapter()])) : undefined;
const app = createApp({
  config,
  ...(pool ? { database: pool } : {}),
  ...(auth ? { auth } : {}),
  attachmentStore: new LocalAttachmentStore(resolve(config.attachmentDir ?? './data/attachments')),
  ...(rateLimitRedis ? { rateLimiter: new FallbackRateLimiter(new ValkeyRateLimiter(rateLimitRedis), new InMemoryRateLimiter()) } : {}),
  ...(printerAdapters ? { printerAdapters } : {}),
  ...(config.printFontPath ? { printFontPath: config.printFontPath } : {}),
  ...(queue ? { queueStatus: () => queue.status(), deadLetters: { list: (limit: number) => queue.deadLetters(limit), replay: (jobId: string) => queue.replayDeadLetter(jobId) } } : {}),
  probes: {
    ...(pool ? { database: async () => { await pool.query('SELECT 1'); } } : {}),
    ...(redis ? { valkey: async () => { await redis.ping(); } } : {}),
  },
});
const server = serve({ fetch: app.fetch, port: config.port });
const hub = new NotificationHub();
let hubServer: ReturnType<NotificationHub['attach']> | undefined;
if (pool && auth) {
  hubServer = hub.attach(server as unknown as HttpServer, async (token) => {
    if (!token) throw new Error('Missing token');
    const authenticated = await auth.authenticate(`Bearer ${token}`);
    return { employeeId: authenticated.principal.employeeId, companyId: authenticated.principal.companyId, companyCode: authenticated.principal.companyCode, channels: [`company:${authenticated.principal.companyCode}`, 'notifications', ...[...authenticated.access.houseIds].map((id) => `house:${id}`), ...[...authenticated.access.warehouseIds].map((id) => `warehouse:${id}`)] };
  }, pool);
}
let worker: ReturnType<BullMqEventQueue['createWorker']> | undefined;
let publishTimer: NodeJS.Timeout | undefined;
if (pool && queue) {
  const relay = new OutboxRelay(pool, queue);
  const consumer = new IdempotentEventConsumer(pool, 'websocket-notifications');
  worker = queue.createWorker(consumer.consume((event) => { hub.publish(event.companyCode, `company:${event.companyCode}`, event.sequence ?? 0, event); return Promise.resolve({ delivered: true }); }));
  let publishing = false;
  publishTimer = setInterval(() => {
    if (publishing) return;
    publishing = true;
    void relay.publishBatch().catch((error: unknown) => console.error(JSON.stringify({ event: 'outbox_publish_failed', message: error instanceof Error ? error.message : 'unknown' }))).finally(() => { publishing = false; });
  }, 1000);
  publishTimer.unref();
}
let stopping = false;
const wait = (delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs));
const closeWithTimeout = async (close: (() => Promise<void>) | undefined, disconnect: (() => unknown) | undefined, delayMs: number): Promise<void> => {
  if (!close) return;
  await Promise.race([close(), wait(delayMs)]);
  void disconnect?.();
};
const shutdown = async (): Promise<void> => {
  if (publishTimer) clearInterval(publishTimer);
  await closeWithTimeout(worker ? () => worker.close() : undefined, worker ? () => worker.disconnect() : undefined, 2000);
  await closeWithTimeout(queue ? () => queue.close() : undefined, queue ? () => queue.disconnect() : undefined, 2000);
  redis?.disconnect();
  rateLimitRedis?.disconnect();
  if (hubServer) {
    hubServer.clients.forEach((socket) => socket.terminate());
    let hubClosed = false;
    hubServer.close(() => { hubClosed = true; });
    await Promise.race([wait(1000), new Promise<void>((resolve) => {
      const timer = setInterval(() => { if (hubClosed) { clearInterval(timer); resolve(); } }, 25);
    })]);
  }
  if (pool) await Promise.race([pool.end(), wait(2000)]);
  await new Promise<void>((resolve) => server.close(() => resolve()));
};
const stop = async (): Promise<void> => {
  if (stopping) return;
  stopping = true;
  const hardTimeout = setTimeout(() => process.exit(1), config.gracefulShutdownTimeoutMs);
  hardTimeout.unref();
  try {
    await shutdown();
  } finally {
    if (process.connected) process.disconnect();
    clearTimeout(hardTimeout);
  }
};
server.on('close', () => { if (!stopping) void stop(); });
process.once('SIGTERM', () => { void stop(); });
process.once('SIGINT', () => { void stop(); });
if (process.send) {
  process.on('message', (message: unknown) => {
    if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'shutdown') void stop();
  });
}
console.log(JSON.stringify({ event: 'service_started', service: 'layer-farm-erp-api', port: config.port, nodeEnv: config.nodeEnv, databaseConfigured: !!pool, eventsConfigured: !!queue }));
