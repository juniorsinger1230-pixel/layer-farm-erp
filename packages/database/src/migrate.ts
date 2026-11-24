import { fileURLToPath } from 'node:url';
import { runMigrations } from '../../../apps/api/src/migration-runner.js';
import { createPostgresPool } from './client.js';
import { loadMigrations, PostgresMigrationStore } from './migrations.js';

const directory = process.env.MIGRATION_DIR ?? fileURLToPath(new URL('../../../migrations/', import.meta.url));
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = createPostgresPool(databaseUrl);
try {
  const applied = await runMigrations(loadMigrations(directory), new PostgresMigrationStore(pool));
  console.log(JSON.stringify({ applied }));
} finally {
  await pool.end();
}
