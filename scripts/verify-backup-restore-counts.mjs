import pg from 'pg';

const source = new pg.Pool({ connectionString: process.env.SOURCE_DATABASE_URL, max: 1 });
const target = new pg.Pool({ connectionString: process.env.TARGET_DATABASE_URL, max: 1 });
const tables = (await source.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('app','app_auth','app_ops') AND table_type='BASE TABLE' ORDER BY table_schema, table_name")).rows;
const mismatches = [];
let sourceRows = 0;
let targetRows = 0;
for (const table of tables) {
  const qualified = `${table.table_schema}.${table.table_name}`;
  const sourceCount = Number((await source.query(`SELECT count(*) AS count FROM ${qualified}`)).rows[0].count);
  const targetCount = Number((await target.query(`SELECT count(*) AS count FROM ${qualified}`)).rows[0].count);
  sourceRows += sourceCount;
  targetRows += targetCount;
  if (sourceCount !== targetCount) mismatches.push({ table: qualified, sourceCount, targetCount });
}
const result = { result: mismatches.length === 0 ? 'passed' : 'failed', tables: tables.length, sourceRows, targetRows, mismatches };
console.log(JSON.stringify(result));
await source.end();
await target.end();
if (mismatches.length > 0) process.exit(1);
