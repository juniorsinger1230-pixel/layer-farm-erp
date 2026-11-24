import { AppError, validationError } from './errors.js';

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_DEPTH = 8;
const MAX_NODES = 10_000;

function assertSafeJsonValue(value: unknown, depth = 0, counter = { count: 0 }): void {
  counter.count += 1;
  if (depth > MAX_DEPTH || counter.count > MAX_NODES) throw validationError();
  if (Array.isArray(value)) {
    for (const item of value) assertSafeJsonValue(item, depth + 1, counter);
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) throw validationError();
      assertSafeJsonValue(child, depth + 1, counter);
    }
  }
}

/**
 * 按实际字节数读取 JSON，防止仅依赖 Content-Length 绕过限制。
 * 返回值保持 unknown，调用方必须继续执行字段级白名单校验。
 */
export async function readJsonObject(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error('Invalid body limit');
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') {
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', '请求内容类型不受支持');
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) throw validationError();
    if (Number(contentLength) > maxBytes) {
      throw new AppError(413, 'PAYLOAD_TOO_LARGE', '请求内容超过允许大小');
    }
  }

  if (request.body === null) throw validationError();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new AppError(413, 'PAYLOAD_TOO_LARGE', '请求内容超过允许大小');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (received === 0) throw validationError();
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw validationError();
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw validationError();
  assertSafeJsonValue(parsed);
  return parsed as Record<string, unknown>;
}

/** 仅用于明确的 HTML 文本插值；JSON 响应由序列化器编码，不进行 HTML 拼接。 */
export function encodeHtmlText(value: string): string {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? '');
}

export function isSafeRequestId(value: string | undefined): value is string {
  return value !== undefined && /^[A-Za-z0-9._-]{8,64}$/.test(value);
}
