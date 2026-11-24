import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadMigrations, PostgresMigrationStore } from '../dist/packages/database/src/migrations.js';
import { runMigrations } from '../dist/apps/api/src/migration-runner.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new pg.Pool({ connectionString: databaseUrl, max: 5 });
try {
  const applied = await runMigrations(
    loadMigrations(fileURLToPath(new URL('../migrations/', import.meta.url))),
    new PostgresMigrationStore(pool),
  );
  console.log(JSON.stringify({ result: 'passed', applied }));
} finally {
  await pool.end();
}
