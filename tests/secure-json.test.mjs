import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeHtmlText, isSafeRequestId, readJsonObject } from '../dist/packages/shared/src/secure-json.js';

function jsonRequest(body, headers = {}) {
  return new Request('http://localhost/test', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });
}

test('合法JSON对象可解析', async () => {
  assert.deepEqual(await readJsonObject(jsonRequest('{"name":"SYNTH"}'), 100), { name: 'SYNTH' });
});

test('数组、空对象体和畸形JSON被拒绝', async () => {
  await assert.rejects(readJsonObject(jsonRequest('[]'), 100), (error) => error.code === 'VALIDATION_ERROR');
  await assert.rejects(readJsonObject(jsonRequest(''), 100), (error) => error.code === 'VALIDATION_ERROR');
  await assert.rejects(readJsonObject(jsonRequest('{'), 100), (error) => error.code === 'VALIDATION_ERROR');
});

test('原型污染键和超深结构被拒绝', async () => {
  await assert.rejects(readJsonObject(jsonRequest('{"__proto__":{"admin":true}}'), 200), (error) => error.code === 'VALIDATION_ERROR');
  const deep = '{"a":'.repeat(10) + '1' + '}'.repeat(10);
  await assert.rejects(readJsonObject(jsonRequest(deep), 1000), (error) => error.code === 'VALIDATION_ERROR');
});

test('非JSON内容类型被拒绝', async () => {
  await assert.rejects(readJsonObject(jsonRequest('{"a":1}', { 'content-type': 'text/plain' }), 100), (error) => error.code === 'UNSUPPORTED_MEDIA_TYPE');
});

test('无Content-Length的流式请求仍按真实字节数阻断', async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"value":"'));
      controller.enqueue(new TextEncoder().encode('x'.repeat(100)));
      controller.enqueue(new TextEncoder().encode('"}'));
      controller.close();
    },
  });
  const request = new Request('http://localhost/test', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: stream, duplex: 'half',
  });
  await assert.rejects(readJsonObject(request, 32), (error) => error.code === 'PAYLOAD_TOO_LARGE');
});

test('请求ID白名单拒绝CRLF、HTML和超长值', () => {
  assert.equal(isSafeRequestId('REQ-safe-0001'), true);
  assert.equal(isSafeRequestId('bad\r\nX-Evil: yes'), false);
  assert.equal(isSafeRequestId('<script>alert(1)</script>'), false);
  assert.equal(isSafeRequestId('x'.repeat(65)), false);
});

test('HTML文本输出编码覆盖五类特殊字符', () => {
  assert.equal(encodeHtmlText('<script>"x"&\'y\'</script>'), '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;');
});
