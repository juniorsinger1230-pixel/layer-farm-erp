import test from 'node:test';
import assert from 'node:assert/strict';
import { redactLogValue } from '../dist/packages/shared/src/redaction.js';

test('日志对象中的敏感键和连接串被脱敏', () => {
  const result = redactLogValue({ password: 'secret', nested: { token: 'abc' }, url: 'postgresql://u:p@host/db' });
  assert.equal(result.password, '[REDACTED]');
  assert.equal(result.nested.token, '[REDACTED]');
  assert.equal(result.url.includes('u:p'), false);
});

test('日志文本中的Authorization被脱敏', () => {
  const result = redactLogValue('authorization: Bearer abcdef');
  assert.equal(result.includes('abcdef'), false);
});
