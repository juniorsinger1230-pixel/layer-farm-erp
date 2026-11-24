import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalKms } from '../dist/packages/security/src/kms.js';

test('LocalKms performs envelope encryption and authenticated decryption', () => {
  const kms = LocalKms.generate('layer-farm-test-key');
  const plaintext = Buffer.from('P2 secret material', 'utf8');
  const encrypted = kms.encrypt(plaintext);
  assert.equal(encrypted.format, 'layer-farm-kms-encrypted');
  assert.equal(encrypted.algorithm, 'AES-256-GCM');
  assert.equal(encrypted.ciphertext.includes('P2 secret material'), false);
  assert.deepEqual(kms.decrypt(encrypted), plaintext);
});

test('LocalKms generates and unwraps a data key', () => {
  const kms = LocalKms.generate('layer-farm-data-key');
  const dataKey = kms.generateDataKey();
  assert.equal(dataKey.plaintext.length, 32);
  assert.deepEqual(kms.decrypt(dataKey.encrypted), dataKey.plaintext);
});

test('LocalKms rejects tampered ciphertext and AAD mismatch', () => {
  const kms = LocalKms.generate('layer-farm-aad-key');
  const aad = Buffer.from('company=THL', 'utf8');
  const encrypted = kms.encrypt(Buffer.from('protected'), aad);
  assert.throws(() => kms.decrypt(encrypted));
  assert.throws(() => kms.decrypt(encrypted, Buffer.from('company=TGE')));
  assert.doesNotThrow(() => kms.decrypt(encrypted, aad));
  const tampered = { ...encrypted, ciphertext: `${encrypted.ciphertext}AA` };
  assert.throws(() => kms.decrypt(tampered, aad));
});

test('LocalKms validates key id, version and master key length', () => {
  assert.throws(() => LocalKms.generate('invalid/key'));
  assert.throws(() => LocalKms.generate('ok', 0));
  assert.throws(() => LocalKms.fromMasterKey('ok', 1, Buffer.alloc(16)));
});
