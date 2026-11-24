import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import type { Migration, MigrationStore } from '../../../apps/api/src/migration-runner.js';

export class PostgresMigrationStore implements MigrationStore {
  constructor(private readonly pool: Pool) {}

  async has(id: string): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT 1 FROM schema_migration WHERE id = $1', [id]);
      return result.rowCount === 1;
    } catch (error) {
      if ((error as { code?: string }).code === '42P01') return false;
      throw error;
    }
  }

  async getChecksum(id: string): Promise<string | null> {
    try {
      const result = await this.pool.query<{ checksum: string }>('SELECT checksum FROM schema_migration WHERE id = $1', [id]);
      return result.rows[0]?.checksum ?? null;
    } catch (error) {
      if ((error as { code?: string }).code === '42P01') return null;
      throw error;
    }
  }

  async apply(migration: Migration): Promise<void> {
    const client = await this.pool.connect();
    try {
      if (migration.transaction) await client.query('BEGIN');
      if (!migration.transaction && migration.sql.includes('CONCURRENTLY')) {
        // PostgreSQL wraps multiple statements in one simple Query message in an implicit
        // transaction. Send each concurrent index statement separately so CREATE INDEX
        // CONCURRENTLY really runs outside a transaction on a real server.
        const statements = migration.sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
        for (const statement of statements) await client.query(statement);
      } else {
        await client.query(migration.sql);
      }
      await client.query('INSERT INTO schema_migration(id, checksum) VALUES ($1, $2)', [migration.id, migration.checksum]);
      if (migration.transaction) await client.query('COMMIT');
    } catch (error) {
      if (migration.transaction) await rollbackQuietly(client);
      throw error;
    } finally {
      client.release();
    }
  }
}

async function rollbackQuietly(client: PoolClient): Promise<void> {
  try { await client.query('ROLLBACK'); } catch { /* 保留原始迁移异常。 */ }
}

export function loadMigrations(directory: string): Migration[] {
  return readdirSync(directory).filter((name) => /^\d{3,}_[a-z0-9_]+\.sql$/.test(name)).sort().map((name) => {
    const sql = readFileSync(join(directory, name), 'utf8');
    return {
      id: name.replace(/\.sql$/, ''),
      sql,
      checksum: createHash('sha256').update(sql).digest('hex'),
      transaction: !name.includes('concurrently'),
    };
  });
}

/** 仅用于已批准的非生产回滚；生产恢复必须走备份恢复审批，不自动 DROP。 */
export function loadDevelopmentRollback(directory: string, environment: string, approved: boolean): string {
  if (environment === 'production' || !approved) throw new Error('Destructive rollback is not approved');
  const file = readdirSync(directory).filter((name) => name.endsWith('.sql')).sort().at(-1);
  if (!file) throw new Error('Rollback file not found');
  return readFileSync(join(directory, file), 'utf8');
}
