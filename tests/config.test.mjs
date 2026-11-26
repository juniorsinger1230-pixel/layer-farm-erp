import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../dist/apps/api/src/config.js';

test('配置使用安全默认值', () => {
  const config = loadConfig({});
  assert.equal(config.port, 3100);
  assert.equal(config.bodyLimitBytes, 1048576);
  assert.equal(config.externalIntegrationsEnabled, false);
  assert.equal(config.databasePoolMax, 20);
  assert.equal(config.databaseConnectionTimeoutMs, 10000);
});

test('非法端口和环境被拒绝', () => {
  assert.throws(() => loadConfig({ PORT: '0' }));
  assert.throws(() => loadConfig({ PORT: '3100;bad' }));
  assert.throws(() => loadConfig({ NODE_ENV: 'unknown' }));
});

test('请求体上限必须为正且有上限', () => {
  assert.throws(() => loadConfig({ BODY_LIMIT_BYTES: '-1' }));
  assert.throws(() => loadConfig({ BODY_LIMIT_BYTES: '99999999' }));
});

test('数据库连接池配置可覆盖且不能越界', () => {
  const overridden = loadConfig({ DATABASE_POOL_MAX: '10', DATABASE_CONNECTION_TIMEOUT_MS: '15000' });
  assert.equal(overridden.databasePoolMax, 10);
  assert.equal(overridden.databaseConnectionTimeoutMs, 15000);
  assert.throws(() => loadConfig({ DATABASE_POOL_MAX: '51' }));
  assert.throws(() => loadConfig({ DATABASE_CONNECTION_TIMEOUT_MS: '30001' }));
});
