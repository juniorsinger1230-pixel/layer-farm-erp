export interface Migration {
  id: string;
  sql: string;
  checksum: string;
  transaction: boolean;
}

/** 事务型迁移由适配器原子执行；并发索引迁移必须在事务外执行。 */
export interface MigrationStore {
  has(id: string): Promise<boolean>;
  getChecksum?(id: string): Promise<string | null>;
  apply(migration: Migration): Promise<void>;
}

export async function runMigrations(migrations: readonly Migration[], store: MigrationStore): Promise<string[]> {
  const ids = new Set<string>();
  let previous = '';
  for (const migration of migrations) {
    if (!/^\d{3,}_[a-z0-9_]+$/.test(migration.id)) throw new Error('Invalid migration identifier');
    if (ids.has(migration.id) || migration.id.localeCompare(previous) <= 0) {
      throw new Error('Migrations must be unique and sorted');
    }
    if (migration.sql.trim().length === 0) throw new Error('Migration SQL cannot be empty');
    if (!/^[0-9a-f]{64}$/.test(migration.checksum)) throw new Error('Invalid migration checksum');
    if (migration.sql.includes('CONCURRENTLY') && migration.transaction) throw new Error('Concurrent migration cannot run in a transaction');
    ids.add(migration.id);
    previous = migration.id;
  }

  const applied: string[] = [];
  for (const migration of migrations) {
    if (await store.has(migration.id)) {
      const checksum = await store.getChecksum?.(migration.id);
      if (checksum !== undefined && checksum !== migration.checksum) throw new Error(`Migration checksum mismatch: ${migration.id}`);
      continue;
    }
    await store.apply(migration);
    applied.push(migration.id);
  }
  return applied;
}
