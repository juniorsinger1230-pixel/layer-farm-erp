import type { Redis } from 'ioredis';

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export interface RateLimiter {
  check(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision>;
}

export class ValkeyRateLimiter implements RateLimiter {
  constructor(private readonly redis: Redis) {}

  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    const safeKey = `ratelimit:${key.replaceAll(':', '_').replaceAll('\n', '_').slice(0, 200)}`;
    const transaction = this.redis.multi();
    transaction.incr(safeKey);
    transaction.expire(safeKey, windowSeconds, 'NX');
    transaction.ttl(safeKey);
    const results = await transaction.exec();
    const current = results?.[0]?.[1] as number;
    const ttl = results?.[2]?.[1] as number;
    const effectiveTtl = ttl > 0 ? ttl : windowSeconds;
    return {
      allowed: current <= limit,
      limit,
      remaining: Math.max(0, limit - current),
      resetAt: Date.now() + effectiveTtl * 1000,
    };
  }
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  check(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
    const now = Date.now();
    const existing = this.windows.get(key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowSeconds * 1000;
      this.windows.set(key, { count: 1, resetAt });
      return Promise.resolve({ allowed: true, limit, remaining: Math.max(0, limit - 1), resetAt });
    }
    existing.count += 1;
    return Promise.resolve({ allowed: existing.count <= limit, limit, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt });
  }
}
