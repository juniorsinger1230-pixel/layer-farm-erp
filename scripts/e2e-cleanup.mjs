import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const envText = readFileSync(`${projectRoot}deploy/compose/.env`, 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter((line) => line.includes('=')).map((line) => {
  const separator = line.indexOf('=');
  return [line.slice(0, separator), line.slice(separator + 1)];
}));
const databaseUrl = process.env.DATABASE_URL ?? `postgresql://erp:${env.POSTGRES_PASSWORD}@127.0.0.1:${env.POSTGRES_PORT ?? '55432'}/layer_farm`;
const parsedUrl = new URL(databaseUrl);
if (!['127.0.0.1', 'localhost'].includes(parsedUrl.hostname) || parsedUrl.pathname !== '/layer_farm') {
  throw new Error('E2E cleanup is only allowed against the local layer_farm database');
}
const pool = new pg.Pool({ connectionString: databaseUrl });

try {
  const tableResult = await pool.query(
    `SELECT quote_ident(table_schema) || '.' || quote_ident(table_name) AS qualified_name
       FROM information_schema.tables
      WHERE table_schema IN ('app', 'app_auth', 'app_ops') AND table_type = 'BASE TABLE'`,
  );
  await pool.query(
    `TRUNCATE TABLE ${tableResult.rows.map((row) => row.qualified_name).join(', ')} RESTART IDENTITY CASCADE`,
  );
  const countResult = await pool.query(
    `SELECT nspname AS schema_name, sum(c.reltuples)::bigint AS estimated_rows
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE nspname IN ('app', 'app_auth', 'app_ops') AND c.relkind='r'
      GROUP BY nspname ORDER BY nspname`,
  );
  const remainingChecks = await Promise.all(tableResult.rows.map(async (row) => {
    const result = await pool.query(`SELECT count(*)::integer AS row_count FROM ${row.qualified_name}`);
    return { table: row.qualified_name, rowCount: result.rows[0].row_count };
  }));
  const remainingRows = remainingChecks.reduce((sum, row) => sum + row.rowCount, 0);
  const result = {
    event: 'e2e_cleanup_completed',
    checkedAt: new Date().toISOString(),
    tableCount: tableResult.rowCount,
    remainingRows,
    schemaEstimates: countResult.rows,
    remainingChecks,
  };
  writeFileSync(new URL('../e2e-cleanup-result.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ event: result.event, tableCount: result.tableCount, remainingRows }));
} finally {
  await pool.end();
}
