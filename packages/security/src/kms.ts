import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

export type KmsEncryptedPayload = {
  format: 'layer-farm-kms-encrypted';
  specVersion: 1;
  algorithm: 'AES-256-GCM';
  keyId: string;
  keyVersion: number;
  iv: string;
  ciphertext: string;
  authTag: string;
  aad?: string;
};

export type DataKey = {
  plaintext: Buffer;
  encrypted: KmsEncryptedPayload;
};

export class LocalKms {
  private readonly masterKey: Buffer;

  private constructor(
    readonly keyId: string,
    readonly keyVersion: number,
    masterKey: Buffer,
  ) {
    if (masterKey.length !== 32) throw new Error('Master key must contain 32 bytes');
    this.masterKey = Buffer.from(masterKey);
  }

  static generate(keyId: string, keyVersion = 1): LocalKms {
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(keyId)) throw new Error('Invalid KMS key id');
    if (!Number.isInteger(keyVersion) || keyVersion <= 0) throw new Error('Invalid KMS key version');
    return new LocalKms(keyId, keyVersion, randomBytes(32));
  }

  static fromMasterKey(keyId: string, keyVersion: number, masterKey: Buffer): LocalKms {
    return new LocalKms(keyId, keyVersion, masterKey);
  }

  generateDataKey(aad?: Buffer): DataKey {
    const plaintext = randomBytes(32);
    return { plaintext, encrypted: this.encrypt(plaintext, aad) };
  }

  encrypt(plaintext: Buffer, aad?: Buffer): KmsEncryptedPayload {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
    if (aad !== undefined) cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      format: 'layer-farm-kms-encrypted',
      specVersion: 1,
      algorithm: 'AES-256-GCM',
      keyId: this.keyId,
      keyVersion: this.keyVersion,
      iv: iv.toString('base64url'),
      ciphertext: ciphertext.toString('base64url'),
      authTag: authTag.toString('base64url'),
      ...(aad === undefined ? {} : { aad: aad.toString('base64url') }),
    };
  }

  decrypt(payload: KmsEncryptedPayload, aad?: Buffer): Buffer {
    if (
      payload.format !== 'layer-farm-kms-encrypted' ||
      payload.specVersion !== 1 ||
      payload.algorithm !== 'AES-256-GCM' ||
      payload.keyId !== this.keyId ||
      payload.keyVersion !== this.keyVersion
    ) {
      throw new Error('Unsupported KMS payload');
    }
    const expectedAad = aad?.toString('base64url');
    if ((payload.aad ?? expectedAad) !== expectedAad) throw new Error('KMS AAD mismatch');
    const iv = Buffer.from(payload.iv, 'base64url');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64url');
    const authTag = Buffer.from(payload.authTag, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(authTag);
    if (aad !== undefined) decipher.setAAD(aad);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  safeEqual(left: Buffer, right: Buffer): boolean {
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
