import { readFileSync } from 'node:fs';
import pg from 'pg';

const [inputPath] = process.argv.slice(2);
if (!inputPath || !process.env.DATABASE_URL) throw new Error('Usage: DATABASE_URL=... node scripts/restore-database.mjs <input>');
const backup = JSON.parse(readFileSync(inputPath, 'utf8'));
if (backup.format !== 'layer-farm-logical-backup' || backup.specVersion !== 1) throw new Error('Unsupported backup format');
const quoteIdent = (value) => `"${value.replaceAll('"', '""')}"`;
const keyOf = (schema, name) => `${schema}.${name}`;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  const backupTables = new Map(backup.tables.map((table) => [keyOf(table.schema, table.name), table]));
  const fkResult = await client.query(`
    SELECT tc.table_schema AS schema_name, tc.table_name AS table_name,
           ccu.table_schema AS ref_schema, ccu.table_name AS ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.constraint_schema = ccu.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema IN ('app','app_auth','app_ops')
      AND ccu.table_schema IN ('app','app_auth','app_ops')`);
  const dependencies = new Map([...backupTables.keys()].map((key) => [key, new Set()]));
  for (const edge of fkResult.rows) {
    const from = keyOf(edge.schema_name, edge.table_name);
    const to = keyOf(edge.ref_schema, edge.ref_table);
    if (from !== to && dependencies.has(from) && backupTables.has(to)) dependencies.get(from).add(to);
  }
  const ordered = [];
  const remaining = new Map(dependencies);
  while (remaining.size > 0) {
    const ready = [...remaining.entries()].filter(([, deps]) => [...deps].every((dep) => !remaining.has(dep))).map(([key]) => key);
    const selected = ready[0] ?? remaining.keys().next().value;
    ordered.push(selected);
    remaining.delete(selected);
    for (const deps of remaining.values()) deps.delete(selected);
  }

  await client.query('BEGIN');
  const allQualified = [...backupTables.keys()].map((key) => {
    const [schema, name] = key.split('.');
    return `${quoteIdent(schema)}.${quoteIdent(name)}`;
  });
  await client.query(`TRUNCATE TABLE ${allQualified.join(', ')} RESTART IDENTITY CASCADE`);
  let insertedRows = 0;
  for (const key of ordered) {
    const table = backupTables.get(key);
    const qualified = `${quoteIdent(table.schema)}.${quoteIdent(table.name)}`;
    const columns = table.columns.map((column) => quoteIdent(column.name));
    const targetTypes = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2`, [table.schema, table.name]);
    const typeByName = new Map(targetTypes.rows.map((row) => [row.column_name, row.data_type]));
    for (const row of table.rows) {
      const values = table.columns.map((column) => {
        const value = row[column.name];
        if (value && typeof value === 'object' && typeof value.__base64 === 'string') return Buffer.from(value.__base64, 'base64');
        if (['json', 'jsonb'].includes(typeByName.get(column.name) ?? '') && (typeof value === 'object')) return JSON.stringify(value);
        return value;
      });
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
      await client.query(`INSERT INTO ${qualified} (${columns.join(', ')}) VALUES (${placeholders})`, values);
      insertedRows += 1;
    }
  }
  const sequenceColumns = await client.query(`
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema IN ('app','app_auth','app_ops') AND column_default LIKE 'nextval%'`);
  for (const column of sequenceColumns.rows) {
    const qualified = `${quoteIdent(column.table_schema)}.${quoteIdent(column.table_name)}`;
    await client.query(`SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT max(${quoteIdent(column.column_name)}) FROM ${qualified}), 1), COALESCE((SELECT max(${quoteIdent(column.column_name)}) IS NOT NULL FROM ${qualified}), false))`, [`${column.table_schema}.${column.table_name}`, column.column_name]);
  }
  await client.query('COMMIT');
  console.log(JSON.stringify({ result: 'passed', input: inputPath, tables: ordered.length, rows: insertedRows }));
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
