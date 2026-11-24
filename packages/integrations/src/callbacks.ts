import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Redis } from 'ioredis';

export interface ReplayGuard { claim(key: string, ttlSeconds: number): Promise<boolean>; }
export class ValkeyReplayGuard implements ReplayGuard {
  constructor(private readonly redis: Redis) {}
  async claim(key: string, ttlSeconds: number): Promise<boolean> { return (await this.redis.set(`callback:${key}`, '1', 'PX', ttlSeconds * 1000, 'NX')) === 'OK'; }
}

export async function verifySignedCallback(input: { rawBody: Uint8Array; timestamp: string; signature: string; secret: string; eventId: string; nowSeconds?: number; toleranceSeconds?: number; replayGuard: ReplayGuard }): Promise<void> {
  const timestamp = Number(input.timestamp); const now = input.nowSeconds ?? Math.floor(Date.now() / 1000); const tolerance = input.toleranceSeconds ?? 300;
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > tolerance || !/^[a-f0-9]{64}$/i.test(input.signature) || !/^[A-Za-z0-9._:-]{3,150}$/.test(input.eventId)) throw new Error('Invalid callback signature envelope');
  const expected = createHmac('sha256', input.secret).update(`${input.timestamp}.`).update(input.rawBody).digest();
  const provided = Buffer.from(input.signature, 'hex');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw new Error('Invalid callback signature');
  if (!(await input.replayGuard.claim(input.eventId, tolerance * 2))) throw new Error('Duplicate callback');
}

export class HttpIntegrationClient {
  private failures = 0; private openedUntil = 0;
  constructor(private readonly allowedHosts: ReadonlySet<string>, private readonly timeoutMs = 5000) {}
  async postJson(urlValue: string, body: Record<string, unknown>, headers: Record<string, string>): Promise<unknown> {
    const url = new URL(urlValue);
    if (url.protocol !== 'https:' || !this.allowedHosts.has(url.hostname) || url.username !== '' || url.password !== '') throw new Error('Integration host is not allowlisted');
    if (Date.now() < this.openedUntil) throw new Error('Integration circuit is open');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeoutMs); timer.unref();
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: controller.signal, redirect: 'error' });
      if (!response.ok) throw new Error(`Integration HTTP ${response.status}`);
      const result = await response.json() as unknown; this.failures = 0; return result;
    } catch (error) {
      this.failures += 1; if (this.failures >= 5) { this.openedUntil = Date.now() + 30000; this.failures = 0; }
      throw error;
    } finally { clearTimeout(timer); }
  }
}
