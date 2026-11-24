import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../dist/apps/api/src/app.js';
import { ServiceMetrics } from '../dist/packages/shared/src/metrics.js';

const baseConfig = { nodeEnv: 'test', port: 3100, bodyLimitBytes: 1024, externalIntegrationsEnabled: false };

test('Prometheus指标包含有界路由标签、直方图和进程指标', async () => {
  const app = createApp({ config: baseConfig });
  await app.request('/health/live');
  const response = await app.request('/metrics');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/plain/);
  const body = await response.text();
  assert.match(body, /layer_farm_http_requests_total\{method="GET",route="\/health\/live",status="200"\} 1/);
  assert.match(body, /layer_farm_http_request_duration_seconds_bucket/);
  assert.match(body, /process_resident_memory_bytes/);
  assert.doesNotMatch(body, /127\.0\.0\.1|postgresql|redis:\/\//);
});

test('未配置队列时状态检查明确失败且配置后返回真实计数', async () => {
  const unavailable = createApp({ config: baseConfig });
  assert.equal((await unavailable.request('/health/queue')).status, 503);
  const app = createApp({ config: baseConfig, queueStatus: async () => ({ main: { waiting: 2 }, deadLetter: { waiting: 1 } }) });
  const response = await app.request('/health/queue');
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).queues.deadLetter, { waiting: 1 });
});

test('指标标签对引号、反斜杠和换行进行安全编码', () => {
  const metrics = new ServiceMetrics();
  metrics.observeRequest('GET', '/bad"\\\npath', 500, 0.02);
  const body = metrics.render('test');
  assert.match(body, /route="\/bad\\"\\\\\\npath"/);
  assert.match(body, /le="\+Inf"/);
});

test('依赖探针永不返回时就绪检查在两秒级超时并返回503', async () => {
  const app = createApp({ config: { ...baseConfig, databaseUrl: 'postgresql://synthetic.invalid/db', valkeyUrl: 'redis://synthetic.invalid' }, probes: { database: async () => {}, valkey: () => new Promise(() => {}) } });
  const started = Date.now();
  const response = await app.request('/health/ready');
  assert.equal(response.status, 503);
  assert.ok(Date.now() - started < 4000);
  assert.equal((await response.json()).dependencies.valkey, 'down');
});
