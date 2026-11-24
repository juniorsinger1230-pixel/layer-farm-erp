import test from 'node:test';
import assert from 'node:assert/strict';
import { FallbackRateLimiter, InMemoryRateLimiter } from '../dist/packages/integrations/src/rate-limiter.js';

test('内存限流器计数、剩余额度并在超限时拒绝', async () => {
  const limiter = new InMemoryRateLimiter();
  const first = await limiter.check('test:1', 2, 60);
  const second = await limiter.check('test:1', 2, 60);
  const third = await limiter.check('test:1', 2, 60);
  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 1);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
});

test('主限流器正常时优先使用主限流器结果', async () => {
  const primary = { check: async () => ({ allowed: true, limit: 10, remaining: 9, resetAt: 123 }) };
  const fallback = { check: async () => { throw new Error('fallback should not be used'); } };
  const limiter = new FallbackRateLimiter(primary, fallback);
  const decision = await limiter.check('test:1', 10, 60);
  assert.deepEqual(decision, { allowed: true, limit: 10, remaining: 9, resetAt: 123 });
});

test('主限流器故障时切换到本地兜底限流器', async () => {
  const primary = { check: async () => { throw new Error('primary unavailable'); } };
  const fallback = new InMemoryRateLimiter();
  const limiter = new FallbackRateLimiter(primary, fallback);
  const decision = await limiter.check('test:1', 5, 60);
  assert.equal(decision.allowed, true);
  assert.equal(decision.limit, 5);
  assert.equal(decision.remaining, 4);
});

test('兜底限流器仍然执行单节点限流', async () => {
  const primary = { check: async () => { throw new Error('primary unavailable'); } };
  const limiter = new FallbackRateLimiter(primary, new InMemoryRateLimiter());
  const first = await limiter.check('test:2', 1, 60);
  const second = await limiter.check('test:2', 1, 60);
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
});
