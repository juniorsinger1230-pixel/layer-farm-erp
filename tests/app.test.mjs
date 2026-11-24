import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../dist/apps/api/src/app.js';

const baseConfig = { nodeEnv: 'test', port: 3100, bodyLimitBytes: 128, externalIntegrationsEnabled: false };

test('存活检查返回最小必要字段和安全响应头', async () => {
  const app = createApp({ config: baseConfig });
  const response = await app.request('/health/live', { headers: { 'x-request-id': 'REQ-test-0001' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-request-id'), 'REQ-test-0001');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ['requestId', 'service', 'status', 'version']);
});

test('可传输但不符合白名单的请求ID不被反射', async () => {
  const app = createApp({ config: baseConfig });
  const hostile = '<script>alert(1)</script>';
  const response = await app.request('/health/live', { headers: { 'x-request-id': hostile } });
  assert.notEqual(response.headers.get('x-request-id'), hostile);
  assert.match(response.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
});

test('未配置依赖时就绪检查失败且不回显连接串', async () => {
  const app = createApp({ config: { ...baseConfig, databaseUrl: 'postgresql://secret.invalid/db', valkeyUrl: 'redis://secret.invalid' } });
  const response = await app.request('/health/ready');
  const text = await response.text();
  assert.equal(response.status, 503);
  assert.equal(text.includes('secret.invalid'), false);
  assert.equal(text.includes('not_configured'), false);
  assert.equal(text.includes('down'), true);
});

test('健康探针通过后就绪检查成功', async () => {
  const app = createApp({
    config: { ...baseConfig, databaseUrl: 'postgresql://test.invalid/db', valkeyUrl: 'redis://test.invalid' },
    probes: { database: async () => {}, valkey: async () => {} },
  });
  const response = await app.request('/health/ready');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.dependencies.database, 'up');
  assert.equal(body.dependencies.valkey, 'up');
});

test('404使用统一最小错误信封', async () => {
  const app = createApp({ config: baseConfig });
  const response = await app.request('/not-found');
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.error.code, 'NOT_FOUND');
  assert.equal('stack' in body.error, false);
});

test('未知异常不泄露内部消息、SQL或堆栈', async () => {
  const app = createApp({ config: baseConfig });
  app.get('/__test/failure', () => { throw new Error('postgresql://user:password@host/db sensitive stack'); });
  const response = await app.request('/__test/failure');
  const text = await response.text();
  assert.equal(response.status, 500);
  assert.equal(text.includes('password'), false);
  assert.equal(text.includes('sensitive stack'), false);
  assert.equal(text.includes('postgresql'), false);
});

test('Content-Length超限时在路由前拒绝', async () => {
  const app = createApp({ config: baseConfig });
  const response = await app.request('/api/v1/anything', { method: 'POST', headers: { 'content-length': '999' } });
  assert.equal(response.status, 413);
  const body = await response.json();
  assert.equal(body.error.code, 'PAYLOAD_TOO_LARGE');
});
