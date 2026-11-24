import type { Queryable } from '../../database/src/client.js';
import type { AuthStore, CredentialRecord, SessionRecord } from './auth.js';
import type { Principal } from './rbac.js';

type CredentialRow = {
  employee_id: string;
  account: string;
  password_hash: string;
  principal: Principal;
  status: 'active' | 'disabled';
  failed_attempts: number;
  locked_until: Date | string | null;
  mfa_secret: string | null;
};

type SessionRow = {
  session_id: string;
  employee_id: string;
  access_expires_at: Date | string;
  refresh_expires_at: Date | string;
  refresh_hash: string;
  previous_refresh_hash: string | null;
  rotated_at: Date | string | null;
  revoked_at: Date | string | null;
};

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function revivePrincipal(principal: Principal): Principal {
  return {
    ...principal,
    roles: principal.roles.map((assignment) => ({
      ...assignment,
      ...(typeof assignment.validFrom === 'string' ? { validFrom: new Date(assignment.validFrom) } : {}),
      ...(typeof assignment.validTo === 'string' ? { validTo: new Date(assignment.validTo) } : {}),
    })),
  };
}

function credential(row: CredentialRow): CredentialRecord {
  return {
    account: row.account,
    principal: revivePrincipal(row.principal),
    passwordHash: row.password_hash,
    status: row.status,
    failedAttempts: row.failed_attempts,
    ...(row.locked_until === null ? {} : { lockedUntil: asDate(row.locked_until) }),
    ...(row.mfa_secret === null ? {} : { mfaSecret: row.mfa_secret }),
  };
}

function session(row: SessionRow): SessionRecord {
  return {
    sessionId: row.session_id,
    employeeId: Number(row.employee_id),
    accessExpiresAt: asDate(row.access_expires_at),
    refreshExpiresAt: asDate(row.refresh_expires_at),
    refreshHash: row.refresh_hash,
    ...(row.previous_refresh_hash === null ? {} : { previousRefreshHash: row.previous_refresh_hash }),
    ...(row.rotated_at === null ? {} : { rotatedAt: asDate(row.rotated_at) }),
    ...(row.revoked_at === null ? {} : { revokedAt: asDate(row.revoked_at) }),
  };
}

export class PostgresAuthStore implements AuthStore {
  constructor(private readonly db: Queryable) {}

  async findCredential(account: string, companyCode: string): Promise<CredentialRecord | null> {
    const result = await this.db.query<CredentialRow>('SELECT * FROM app_auth.credential WHERE account=$1 AND company_code=$2', [account, companyCode]);
    return result.rows[0] ? credential(result.rows[0]) : null;
  }

  async findCredentialByEmployeeId(employeeId: number): Promise<CredentialRecord | null> {
    const result = await this.db.query<CredentialRow>('SELECT * FROM app_auth.credential WHERE employee_id=$1', [employeeId]);
    return result.rows[0] ? credential(result.rows[0]) : null;
  }

  async saveCredential(record: CredentialRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO app_auth.credential
       (employee_id,account,company_code,password_hash,principal,status,failed_attempts,locked_until,mfa_secret)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)
       ON CONFLICT (employee_id) DO UPDATE SET account=EXCLUDED.account,company_code=EXCLUDED.company_code,
       password_hash=EXCLUDED.password_hash,principal=EXCLUDED.principal,status=EXCLUDED.status,
       failed_attempts=EXCLUDED.failed_attempts,locked_until=EXCLUDED.locked_until,mfa_secret=EXCLUDED.mfa_secret,updated_at=now()`,
      [record.principal.employeeId, record.account, record.principal.companyCode, record.passwordHash, JSON.stringify(record.principal), record.status, record.failedAttempts, record.lockedUntil ?? null, record.mfaSecret ?? null],
    );
  }

  async createSession(record: SessionRecord): Promise<void> {
    await this.db.query(
      'INSERT INTO app_auth.session (session_id,employee_id,access_expires_at,refresh_expires_at,refresh_hash) VALUES ($1,$2,$3,$4,$5)',
      [record.sessionId, record.employeeId, record.accessExpiresAt, record.refreshExpiresAt, record.refreshHash],
    );
  }

  async findSession(sessionId: string): Promise<SessionRecord | null> {
    const result = await this.db.query<SessionRow>('SELECT * FROM app_auth.session WHERE session_id=$1', [sessionId]);
    return result.rows[0] ? session(result.rows[0]) : null;
  }

  async findSessionByRefreshHash(hash: string): Promise<SessionRecord | null> {
    const result = await this.db.query<SessionRow>('SELECT * FROM app_auth.session WHERE refresh_hash=$1 OR previous_refresh_hash=$1', [hash]);
    return result.rows[0] ? session(result.rows[0]) : null;
  }

  async saveSession(record: SessionRecord): Promise<void> {
    await this.db.query(
      `UPDATE app_auth.session SET access_expires_at=$2,refresh_expires_at=$3,refresh_hash=$4,
       previous_refresh_hash=$5,rotated_at=$6,revoked_at=$7 WHERE session_id=$1`,
      [record.sessionId, record.accessExpiresAt, record.refreshExpiresAt, record.refreshHash, record.previousRefreshHash ?? null, record.rotatedAt ?? null, record.revokedAt ?? null],
    );
  }

  async rotateSession(record: SessionRecord, expectedRefreshHash: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE app_auth.session SET access_expires_at=$3,refresh_expires_at=$4,refresh_hash=$5,
       previous_refresh_hash=$6,rotated_at=$7 WHERE session_id=$1 AND refresh_hash=$2 AND revoked_at IS NULL`,
      [record.sessionId, expectedRefreshHash, record.accessExpiresAt, record.refreshExpiresAt, record.refreshHash, record.previousRefreshHash ?? null, record.rotatedAt ?? null],
    );
    return result.rowCount === 1;
  }

  async revokeAllSessions(employeeId: number): Promise<void> {
    await this.db.query('UPDATE app_auth.session SET revoked_at=now() WHERE employee_id=$1 AND revoked_at IS NULL', [employeeId]);
  }
}
