import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../dist/apps/api/src/app.js';
import { loadConfig } from '../dist/apps/api/src/config.js';
import { InMemoryRateLimiter } from '../dist/packages/integrations/src/rate-limiter.js';

const baseConfig = {
  nodeEnv: 'test',
  port: 3100,
  bodyLimitBytes: 1048576,
  externalIntegrationsEnabled: false,
  printSandboxMode: false,
  attachmentRetentionDays: 3650,
  rateLimitEnabled: true,
  rateLimitWindowSeconds: 60,
  rateLimitMax: 2,
  loginRateLimitMax: 1,
  gracefulShutdownTimeoutMs: 10000,
};

class FixedLimiter {
  constructor(decision, error) { this.decision = decision; this.error = error; }
  async check() {
    if (this.error) throw this.error;
    return this.decision;
  }
}

test('内存限流器在窗口内允许后阻断', async () => {
  const limiter = new InMemoryRateLimiter();
  const first = await limiter.check('key', 2, 60);
  const second = await limiter.check('key', 2, 60);
  const third = await limiter.check('key', 2, 60);
  assert.equal(first.allowed, true);
  assert.equal(second.remaining, 0);
  assert.equal(third.allowed, false);
});

test('应用在限流时返回429、标准头和重试时间', async () => {
  const limiter = new FixedLimiter({ allowed: false, limit: 2, remaining: 0, resetAt: Date.now() + 60000 });
  const app = createApp({ config: baseConfig, rateLimiter: limiter });
  const response = await app.request('/api/v1/companies');
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('x-ratelimit-limit'), '2');
  assert.equal(response.headers.get('x-ratelimit-remaining'), '0');
  assert.equal(response.headers.get('retry-after'), '60');
  const body = await response.json();
  assert.equal(body.error.code, 'RATE_LIMITED');
});

test('限流依赖异常时返回503且不进入业务处理', async () => {
  const limiter = new FixedLimiter(null, new Error('valkey unavailable'));
  const app = createApp({ config: baseConfig, rateLimiter: limiter });
  const response = await app.request('/api/v1/companies');
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error.code, 'SERVICE_UNAVAILABLE');
});

test('配置加载默认NFR项并支持环境覆盖', () => {
  const defaults = loadConfig({ NODE_ENV: 'test' });
  assert.equal(defaults.rateLimitEnabled, true);
  assert.equal(defaults.rateLimitMax, 300);
  assert.equal(defaults.loginRateLimitMax, 20);
  assert.equal(defaults.gracefulShutdownTimeoutMs, 10000);
  const overridden = loadConfig({
    NODE_ENV: 'test', RATE_LIMIT_ENABLED: 'false', RATE_LIMIT_MAX: '100',
    LOGIN_RATE_LIMIT_MAX: '5', GRACEFUL_SHUTDOWN_TIMEOUT_MS: '3000',
  });
  assert.equal(overridden.rateLimitEnabled, false);
  assert.equal(overridden.rateLimitMax, 100);
  assert.equal(overridden.loginRateLimitMax, 5);
  assert.equal(overridden.gracefulShutdownTimeoutMs, 3000);
});
