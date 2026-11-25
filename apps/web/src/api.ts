export type Json = Record<string, unknown>;
type Session = { accessToken: string; refreshToken: string };
type Envelope = { data?: unknown; error?: { message?: unknown } };
const sessionKey = 'layer-erp-session';
function isSession(value: unknown): value is Session { return typeof value === 'object' && value !== null && typeof (value as Session).accessToken === 'string' && typeof (value as Session).refreshToken === 'string'; }
export function session(): Session | null { try { const value: unknown = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null'); return isSession(value) ? value : null; } catch { return null; } }
function save(value: unknown): void { sessionStorage.setItem(sessionKey, JSON.stringify(value)); }
export function logoutLocal(): void { sessionStorage.removeItem(sessionKey); }
function message(result: Envelope, fallback: string): string { return typeof result.error?.message === 'string' ? result.error.message : fallback; }
async function fetchWithGetRetry(path: string, options: RequestInit, retry: boolean): Promise<Response> {
  const request = new Request(path, options);
  try {
    return await fetch(request);
  } catch (error) {
    if (!retry || request.method !== 'GET' || !(error instanceof TypeError)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 300));
    return fetch(new Request(path, options));
  }
}
export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = session()?.accessToken;
  const response = await fetchWithGetRetry(path, { ...options, headers: { ...(options.body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}), ...(options.body && !(options.body instanceof FormData) && options.method !== 'GET' ? { 'idempotency-key': crypto.randomUUID() } : {}), ...options.headers } }, retry);
  if (response.status === 401 && retry && session()?.refreshToken) {
    const refreshed = await fetch('/api/v1/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: session()!.refreshToken }) });
    const refreshResult = await refreshed.json() as Envelope;
    if (refreshed.ok && isSession(refreshResult.data)) { save(refreshResult.data); return api<T>(path, options, false); }
    logoutLocal(); location.reload(); throw new Error('会话已过期');
  }
  const result = await response.json().catch((): Envelope => ({})) as Envelope;
  if (!response.ok) throw new Error(message(result, `请求失败 (${response.status})`));
  return result.data as T;
}
export async function apiBlob(path: string): Promise<Blob> {
  const token = session()?.accessToken;
  const response = await fetchWithGetRetry(path, { headers: token ? { authorization: `Bearer ${token}` } : {} }, true);
  if (!response.ok) throw new Error(`导出失败 (${response.status})`);
  return response.blob();
}

export async function login(input: { account: string; password: string; companyCode: string }): Promise<void> {
  const response = await fetch('/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
  const result = await response.json() as Envelope;
  if (!response.ok || !isSession(result.data)) throw new Error(message(result, '登录失败'));
  save(result.data);
}
