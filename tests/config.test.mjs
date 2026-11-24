import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../dist/apps/api/src/config.js';

test('配置使用安全默认值', () => {
  const config = loadConfig({});
  assert.equal(config.port, 3100);
  assert.equal(config.bodyLimitBytes, 1048576);
  assert.equal(config.externalIntegrationsEnabled, false);
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
