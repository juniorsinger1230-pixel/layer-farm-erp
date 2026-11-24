import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { Pool } from 'pg';
import type { EventEnvelope } from './bullmq.js';

export interface SocketPrincipal { employeeId: number; companyId: number; companyCode: string; channels: string[]; }
export type SocketAuthenticator = (token: string | undefined) => Promise<SocketPrincipal>;
type Client = WebSocket & { principal?: SocketPrincipal; alive?: boolean; channels?: Set<string> };

export class NotificationHub {
  private readonly clients = new Set<Client>();
  private heartbeat?: NodeJS.Timeout;

  attach(server: HttpServer, authenticate: SocketAuthenticator, pool?: Pool): WebSocketServer {
    const wss = new WebSocketServer({ server, path: '/api/v1/events/ws', maxPayload: 16384 });
    wss.on('connection', (socket: Client, request: IncomingMessage) => { void this.acceptConnection(socket, request, authenticate, pool); });
    this.heartbeat = setInterval(() => {
      for (const socket of this.clients) {
        if (socket.alive === false) { socket.terminate(); this.clients.delete(socket); continue; }
        socket.alive = false; socket.ping();
      }
    }, 25000);
    this.heartbeat.unref();
    wss.on('close', () => { if (this.heartbeat) clearInterval(this.heartbeat); this.clients.clear(); });
    return wss;
  }

  private async acceptConnection(socket: Client, request: IncomingMessage, authenticate: SocketAuthenticator, pool?: Pool): Promise<void> {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const principal = await authenticate(url.searchParams.get('token') ?? undefined);
      socket.principal = principal; socket.alive = true;
      socket.channels = new Set(principal.channels.filter((channel) => /^(company|house|warehouse|notifications)(:[A-Za-z0-9_-]+)?$/.test(channel)));
      socket.send(JSON.stringify({ type: 'ready', companyCode: principal.companyCode, heartbeatSeconds: 25 }));
      socket.on('pong', () => { socket.alive = true; });
      socket.on('message', (data) => { const raw = Array.isArray(data) ? Buffer.concat(data).toString('utf8') : Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data).toString('utf8'); void this.handleMessage(socket, raw, pool).catch(() => socket.close(1011, 'Replay failed')); });
      socket.on('close', () => this.clients.delete(socket));
      this.clients.add(socket);
    } catch { socket.close(1008, 'Unauthorized'); }
  }

  private async handleMessage(socket: Client, raw: string, pool?: Pool): Promise<void> {
    try {
      const message = JSON.parse(raw) as { type?: string; channel?: string; afterSequence?: number };
      if (message.type === 'ping') { socket.send(JSON.stringify({ type: 'pong', at: new Date().toISOString() })); return; }
      if (message.type === 'replay' && pool !== undefined && typeof message.afterSequence === 'number') { await this.replay(pool, socket, message.afterSequence); return; }
      if (message.type === 'subscribe' && typeof message.channel === 'string' && socket.channels?.has(message.channel)) { socket.send(JSON.stringify({ type: 'subscribed', channel: message.channel })); return; }
      socket.send(JSON.stringify({ type: 'error', code: 'INVALID_SUBSCRIPTION' }));
    } catch { socket.send(JSON.stringify({ type: 'error', code: 'INVALID_MESSAGE' })); }
  }

  publish(companyCode: string, channel: string, sequence: number, event: EventEnvelope): void {
    const message = JSON.stringify({ type: 'event', channel, sequence, event });
    for (const socket of this.clients) {
      if (socket.readyState === WebSocket.OPEN && socket.principal?.companyCode === companyCode && socket.channels?.has(channel)) socket.send(message);
    }
  }

  async replay(pool: Pool, socket: Client, afterSequence: number): Promise<number> {
    if (socket.principal === undefined || !Number.isSafeInteger(afterSequence) || afterSequence < 0) return 0;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.company_code',$1,true),set_config('app.company_id',$2,true),set_config('app.actor_id','WS_REPLAY',true)", [socket.principal.companyCode, socket.principal.companyId]);
      const events = await client.query<{ id: string; event_id: string; event_type: string; aggregate_type: string; aggregate_id: string; company_id: string; payload: unknown; occurred_at: string | Date }>('SELECT * FROM app.outbox_event WHERE company_id=$2 AND id>$1 AND published_at IS NOT NULL ORDER BY id LIMIT 500', [afterSequence, socket.principal.companyId]);
      for (const row of events.rows) {
        const channel = `company:${socket.principal.companyCode}`;
        if (socket.channels?.has(channel)) socket.send(JSON.stringify({ type: 'event', channel, sequence: Number(row.id), event: { eventId: row.event_id, eventType: row.event_type, aggregateType: row.aggregate_type, aggregateId: row.aggregate_id, companyId: Number(row.company_id), companyCode: socket.principal.companyCode, payload: row.payload, occurredAt: new Date(row.occurred_at).toISOString() } }));
      }
      await client.query('COMMIT');
      return events.rowCount ?? 0;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
