import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

export interface StoredAttachment { key: string; sha256: string; bytes: number; }
export class LocalAttachmentStore {
  private readonly root: string;
  constructor(rootDirectory: string) { this.root = resolve(rootDirectory); }
  async put(content: Uint8Array, extension: string): Promise<StoredAttachment> {
    if (content.byteLength === 0 || content.byteLength > 10 * 1024 * 1024) throw new Error('Attachment size outside allowed range');
    if (!/^[a-z0-9]{2,8}$/.test(extension)) throw new Error('Invalid attachment extension');
    const sha256 = createHash('sha256').update(content).digest('hex');
    const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
    const path = resolve(this.root, key);
    if (!path.startsWith(`${this.root}${sep}`)) throw new Error('Unsafe attachment path');
    await mkdir(resolve(path, '..'), { recursive: true });
    await writeFile(path, content, { flag: 'wx' });
    return { key, sha256, bytes: content.byteLength };
  }
  private safePath(key: string): string {
    if (!/^\d{4}-\d{2}-\d{2}\/[a-f0-9-]{36}\.[a-z0-9]{2,8}$/.test(key)) throw new Error('Invalid attachment key');
    const path = resolve(this.root, key);
    if (!path.startsWith(`${this.root}${sep}`)) throw new Error('Unsafe attachment path');
    return path;
  }
  async get(key: string): Promise<Uint8Array> {
    return readFile(this.safePath(key));
  }
  async remove(key: string): Promise<void> {
    try {
      await unlink(this.safePath(key));
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return;
      throw error;
    }
  }
}
