import { createHash, createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { AppError } from '../../shared/src/errors.js';
import type { Role } from '../../shared/src/contracts.js';
import { hasPermission, resolveEffectiveAccess, type EffectiveAccess, type Principal } from './rbac.js';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const HIGH_PRIVILEGE = new Set<Role>(['admin', 'boss', 'finance_manager']);
const WEAK_PASSWORDS = new Set(['password', 'password123', '12345678', 'qwerty123', 'admin123', 'P@ssw0rd123']);

export type CredentialRecord = {
  account: string;
  principal: Principal;
  passwordHash: string;
  status: 'active' | 'disabled';
  failedAttempts: number;
  lockedUntil?: Date;
  mfaSecret?: string;
};

export type SessionRecord = {
  sessionId: string;
  employeeId: number;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
  refreshHash: string;
  previousRefreshHash?: string;
  rotatedAt?: Date;
  revokedAt?: Date;
};

export interface AuthStore {
  findCredential(account: string, companyCode: string): Promise<CredentialRecord | null>;
  findCredentialByEmployeeId(employeeId: number): Promise<CredentialRecord | null>;
  saveCredential(record: CredentialRecord): Promise<void>;
  createSession(record: SessionRecord): Promise<void>;
  findSession(sessionId: string): Promise<SessionRecord | null>;
  findSessionByRefreshHash(hash: string): Promise<SessionRecord | null>;
  saveSession(record: SessionRecord): Promise<void>;
  rotateSession(record: SessionRecord, expectedRefreshHash: string): Promise<boolean>;
  revokeAllSessions(employeeId: number): Promise<void>;
}

export type AuthServiceOptions = {
  issuer: string;
  audience: string;
  signingKey: string;
  mfaEnabled?: boolean;
  accessTtlSeconds?: number;
  refreshTtlSeconds?: number;
  now?: () => Date;
};

export type AuthTokens = { accessToken: string; refreshToken: string; tokenType: 'Bearer'; expiresIn: number };
export type AuthenticatedPrincipal = { principal: Principal; access: EffectiveAccess; sessionId: string };

function unauthorized(): AppError {
  return new AppError(401, 'UNAUTHORIZED', '账号或凭据无效');
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function base64urlJson(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function parseBase32(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/=+$/g, '');
  if (!/^[A-Z2-7]+$/.test(normalized)) throw new Error('Invalid MFA secret');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of normalized) bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

export function generateMfaSecret(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  return [...randomBytes(20)].map((byte) => alphabet[byte % 32]).join('');
}

export function totp(secret: string, now = new Date()): string {
  const counter = Math.floor(now.getTime() / 30_000);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', parseBase32(secret)).update(buffer).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code = ((hmac[offset]! & 0x7f) << 24 | hmac[offset + 1]! << 16 | hmac[offset + 2]! << 8 | hmac[offset + 3]!) % 1_000_000;
  return String(code).padStart(6, '0');
}

function safeEqualText(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password) || WEAK_PASSWORDS.has(password.toLowerCase())) {
    throw new AppError(400, 'VALIDATION_ERROR', '密码不符合复杂度要求');
  }
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64, { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$8$1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltText, hashText] = parts;
  if (n !== '32768' || r !== '8' || p !== '1') return false;
  try {
    const expected = Buffer.from(hashText!, 'base64url');
    const actual = await scryptAsync(password, Buffer.from(saltText!, 'base64url'), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export class InMemoryAuthStore implements AuthStore {
  readonly credentials = new Map<string, CredentialRecord>();
  readonly sessions = new Map<string, SessionRecord>();

  async findCredential(account: string, companyCode: string): Promise<CredentialRecord | null> {
    return this.credentials.get(`${companyCode}:${account}`) ?? null;
  }

  async findCredentialByEmployeeId(employeeId: number): Promise<CredentialRecord | null> {
    return [...this.credentials.values()].find((record) => record.principal.employeeId === employeeId) ?? null;
  }

  async saveCredential(record: CredentialRecord): Promise<void> {
    this.credentials.set(`${record.principal.companyCode}:${record.account}`, structuredClone(record));
  }

  async createSession(record: SessionRecord): Promise<void> {
    this.sessions.set(record.sessionId, structuredClone(record));
  }

  async findSession(sessionId: string): Promise<SessionRecord | null> {
    const found = this.sessions.get(sessionId);
    return found ? structuredClone(found) : null;
  }

  async findSessionByRefreshHash(hash: string): Promise<SessionRecord | null> {
    const found = [...this.sessions.values()].find((session) => session.refreshHash === hash || session.previousRefreshHash === hash);
    return found ? structuredClone(found) : null;
  }

  async saveSession(record: SessionRecord): Promise<void> {
    this.sessions.set(record.sessionId, structuredClone(record));
  }

  async rotateSession(record: SessionRecord, expectedRefreshHash: string): Promise<boolean> {
    const current = this.sessions.get(record.sessionId);
    if (current === undefined || current.refreshHash !== expectedRefreshHash || current.revokedAt !== undefined) return false;
    this.sessions.set(record.sessionId, structuredClone(record));
    return true;
  }

  async revokeAllSessions(employeeId: number): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.employeeId === employeeId) session.revokedAt = new Date();
    }
  }
}

export class AuthService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;
  private readonly mfaEnabled: boolean;
  private readonly now: () => Date;

  constructor(private readonly store: AuthStore, private readonly options: AuthServiceOptions) {
    if (Buffer.byteLength(options.signingKey) < 32) throw new Error('JWT signing key must contain at least 32 bytes');
    this.accessTtlSeconds = options.accessTtlSeconds ?? 900;
    this.refreshTtlSeconds = options.refreshTtlSeconds ?? 604_800;
    this.mfaEnabled = options.mfaEnabled ?? true;
    this.now = options.now ?? (() => new Date());
    if (this.accessTtlSeconds < 60 || this.accessTtlSeconds > 3600 || this.refreshTtlSeconds < this.accessTtlSeconds || this.refreshTtlSeconds > 2_592_000) throw new Error('Invalid token TTL');
  }

  async register(account: string, password: string, principal: Principal, mfaSecret?: string): Promise<void> {
    if (!/^[A-Za-z0-9._-]{4,64}$/.test(account) || (await this.store.findCredential(account, principal.companyCode)) !== null) {
      throw new AppError(400, 'VALIDATION_ERROR', '登录账号不符合要求或已存在');
    }
    if (this.mfaEnabled && principal.roles.some((assignment) => HIGH_PRIVILEGE.has(assignment.role)) && mfaSecret === undefined) {
      throw new AppError(400, 'VALIDATION_ERROR', '高权限账号必须登记多因素认证');
    }
    await this.store.saveCredential({
      account, principal, passwordHash: await hashPassword(password), status: 'active', failedAttempts: 0,
      ...(mfaSecret === undefined ? {} : { mfaSecret }),
    });
  }

  async login(account: string, password: string, companyCode: string, mfaCode?: string): Promise<AuthTokens> {
    if (!/^[A-Za-z0-9._-]{4,64}$/.test(account) || !['THL', 'TGE'].includes(companyCode) || password.length > 128) throw unauthorized();
    const credential = await this.store.findCredential(account, companyCode);
    if (credential === null || credential.status !== 'active') throw unauthorized();
    const now = this.now();
    if (credential.lockedUntil !== undefined && credential.lockedUntil > now) {
      throw new AppError(429, 'RATE_LIMITED', '登录尝试过多，请稍后重试');
    }
    if (!(await verifyPassword(password, credential.passwordHash))) {
      credential.failedAttempts += 1;
      if (credential.failedAttempts >= 5) {
        const delaySeconds = Math.min(900, 60 * 2 ** (credential.failedAttempts - 5));
        credential.lockedUntil = new Date(now.getTime() + delaySeconds * 1000);
      }
      await this.store.saveCredential(credential);
      throw unauthorized();
    }
    const highPrivilege = credential.principal.roles.some((assignment) => HIGH_PRIVILEGE.has(assignment.role));
    if (this.mfaEnabled && (highPrivilege || credential.principal.mfaEnrolled)) {
      if (credential.mfaSecret === undefined || mfaCode === undefined || !/^\d{6}$/.test(mfaCode)) {
        throw new AppError(401, 'MFA_REQUIRED', '需要有效的多因素认证码');
      }
      const valid = [-1, 0, 1].some((offset) => safeEqualText(totp(credential.mfaSecret!, new Date(now.getTime() + offset * 30_000)), mfaCode));
      if (!valid) throw unauthorized();
    }
    credential.failedAttempts = 0;
    delete credential.lockedUntil;
    await this.store.saveCredential(credential);
    return this.issueSession(credential.principal);
  }

  private async issueSession(principal: Principal): Promise<AuthTokens> {
    const now = this.now();
    const sessionId = randomUUID();
    const refreshToken = randomBytes(48).toString('base64url');
    await this.store.createSession({
      sessionId, employeeId: principal.employeeId,
      accessExpiresAt: new Date(now.getTime() + this.accessTtlSeconds * 1000),
      refreshExpiresAt: new Date(now.getTime() + this.refreshTtlSeconds * 1000), refreshHash: digest(refreshToken),
    });
    return { accessToken: this.signAccessToken(principal, sessionId, now), refreshToken, tokenType: 'Bearer', expiresIn: this.accessTtlSeconds };
  }

  private signAccessToken(principal: Principal, sessionId: string, now: Date): string {
    const header = base64urlJson({ alg: 'HS256', typ: 'JWT' });
    const payload = base64urlJson({
      iss: this.options.issuer, aud: this.options.audience, sub: String(principal.employeeId), sid: sessionId,
      iat: Math.floor(now.getTime() / 1000), nbf: Math.floor(now.getTime() / 1000) - 1,
      exp: Math.floor(now.getTime() / 1000) + this.accessTtlSeconds,
    });
    const signature = createHmac('sha256', this.options.signingKey).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${signature}`;
  }

  private verifyAccessToken(token: string): { employeeId: number; sessionId: string } {
    const parts = token.split('.');
    if (parts.length !== 3) throw unauthorized();
    const [headerText, payloadText, signature] = parts;
    const expected = createHmac('sha256', this.options.signingKey).update(`${headerText}.${payloadText}`).digest('base64url');
    if (!safeEqualText(signature!, expected)) throw unauthorized();
    try {
      const header = JSON.parse(Buffer.from(headerText!, 'base64url').toString('utf8')) as { alg?: string; typ?: string };
      const payload = JSON.parse(Buffer.from(payloadText!, 'base64url').toString('utf8')) as { iss?: string; aud?: string; sub?: string; sid?: string; nbf?: number; exp?: number };
      const nowSeconds = Math.floor(this.now().getTime() / 1000);
      if (header.alg !== 'HS256' || header.typ !== 'JWT' || payload.iss !== this.options.issuer || payload.aud !== this.options.audience || !/^\d+$/.test(payload.sub ?? '') || !/^[0-9a-f-]{36}$/.test(payload.sid ?? '') || typeof payload.exp !== 'number' || typeof payload.nbf !== 'number' || payload.exp <= nowSeconds || payload.nbf > nowSeconds + 30) throw unauthorized();
      return { employeeId: Number(payload.sub), sessionId: payload.sid! };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw unauthorized();
    }
  }

  async authenticate(authorization: string | undefined): Promise<AuthenticatedPrincipal> {
    const match = authorization?.match(/^Bearer ([A-Za-z0-9._-]+)$/);
    if (!match) throw unauthorized();
    const claims = this.verifyAccessToken(match[1]!);
    const session = await this.store.findSession(claims.sessionId);
    if (session === null || session.employeeId !== claims.employeeId || session.revokedAt !== undefined || session.accessExpiresAt <= this.now() || session.refreshExpiresAt <= this.now()) throw unauthorized();
    const credential = await this.store.findCredentialByEmployeeId(claims.employeeId);
    if (credential === null || credential.status !== 'active') throw unauthorized();
    return { principal: credential.principal, access: resolveEffectiveAccess(credential.principal, this.now()), sessionId: claims.sessionId };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    if (!/^[A-Za-z0-9_-]{64,80}$/.test(refreshToken)) throw unauthorized();
    const presentedHash = digest(refreshToken);
    const session = await this.store.findSessionByRefreshHash(presentedHash);
    if (session === null || session.revokedAt !== undefined || session.refreshExpiresAt <= this.now()) throw unauthorized();
    if (session.previousRefreshHash === presentedHash && session.refreshHash !== presentedHash) {
      await this.store.revokeAllSessions(session.employeeId);
      throw unauthorized();
    }
    if (session.refreshHash !== presentedHash) throw unauthorized();
    const credential = await this.store.findCredentialByEmployeeId(session.employeeId);
    if (credential === null || credential.status !== 'active') throw unauthorized();
    // 以当前哈希作原子比较，防止两个并发刷新同时成功。
    const nextRefreshToken = randomBytes(48).toString('base64url');
    session.previousRefreshHash = session.refreshHash;
    session.refreshHash = digest(nextRefreshToken);
    session.rotatedAt = this.now();
    session.accessExpiresAt = new Date(this.now().getTime() + this.accessTtlSeconds * 1000);
    session.refreshExpiresAt = new Date(this.now().getTime() + this.refreshTtlSeconds * 1000);
    if (!(await this.store.rotateSession(session, presentedHash))) {
      await this.store.revokeAllSessions(session.employeeId);
      throw unauthorized();
    }
    return {
      accessToken: this.signAccessToken(credential.principal, session.sessionId, this.now()),
      refreshToken: nextRefreshToken, tokenType: 'Bearer', expiresIn: this.accessTtlSeconds,
    };
  }

  async logout(authorization: string | undefined): Promise<void> {
    const authenticated = await this.authenticate(authorization);
    const session = await this.store.findSession(authenticated.sessionId);
    if (session !== null) {
      session.revokedAt = this.now();
      await this.store.saveSession(session);
    }
  }

  authorize(authenticated: AuthenticatedPrincipal, permission: string): void {
    if (!hasPermission(authenticated.access, permission)) throw new AppError(403, 'FORBIDDEN', '没有执行该操作的权限');
  }
}
