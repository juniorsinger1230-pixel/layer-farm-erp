import { writeFileSync } from 'node:fs';
import pg from 'pg';

const [outputPath] = process.argv.slice(2);
if (!outputPath || !process.env.DATABASE_URL) throw new Error('Usage: DATABASE_URL=... node scripts/backup-database.mjs <output>');
const quoteIdent = (value) => `"${value.replaceAll('"', '""')}"`;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const tablesResult = await client.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('app','app_auth','app_ops') AND table_type='BASE TABLE' ORDER BY table_schema, table_name");
  const tables = [];
  for (const table of tablesResult.rows) {
    const qualified = `${quoteIdent(table.table_schema)}.${quoteIdent(table.table_name)}`;
    const result = await client.query(`SELECT * FROM ${qualified}`);
    const byteaIndexes = result.fields.map((field, index) => field.dataTypeID === 17 ? index : -1).filter((index) => index >= 0);
    const rows = result.rows.map((row) => {
      const copy = { ...row };
      for (const index of byteaIndexes) {
        const key = result.fields[index].name;
        if (Buffer.isBuffer(copy[key])) copy[key] = { __base64: copy[key].toString('base64') };
      }
      return copy;
    });
    tables.push({
      schema: table.table_schema,
      name: table.table_name,
      columns: result.fields.map((field) => ({ name: field.name, dataTypeId: field.dataTypeID })),
      rows,
    });
  }
  const database = new URL(process.env.DATABASE_URL).pathname.slice(1);
  writeFileSync(outputPath, JSON.stringify({ format: 'layer-farm-logical-backup', specVersion: 1, database, exportedAt: new Date().toISOString(), tables }, null, 2));
  await client.query('COMMIT');
  console.log(JSON.stringify({ result: 'passed', output: outputPath, tables: tables.length, rows: tables.reduce((sum, table) => sum + table.rows.length, 0) }));
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
