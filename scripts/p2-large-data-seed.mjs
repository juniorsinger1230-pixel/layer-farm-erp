import { writeFileSync } from 'node:fs';
import pg from 'pg';

const totalEgg = Number(process.env.P2_EGG_ROWS ?? 500000);
const totalLedger = Number(process.env.P2_LEDGER_ROWS ?? 1000000);
const totalAudit = Number(process.env.P2_AUDIT_ROWS ?? 2000000);
const batchSize = Number(process.env.P2_BATCH_SIZE ?? 1000);
const output = process.env.P2_LARGE_DATA_RESULT ?? 'p2-large-data-seed-result.json';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const timings = [];

function dateFor(index) {
  const day = Math.floor(index / 4);
  return new Date(Date.UTC(2025, 10, 1) + day * 86400000).toISOString().slice(0, 10);
}

async function insertBatches(name, total, columns, buildRow) {
  const startedAt = Date.now();
  for (let start = 0; start < total; start += batchSize) {
    const size = Math.min(batchSize, total - start);
    const placeholders = [];
    const values = [];
    for (let index = 0; index < size; index += 1) {
      const row = buildRow(start + index);
      const base = index * columns.length;
      placeholders.push(`(${columns.map((_, column) => `$${base + column + 1}`).join(',')})`);
      values.push(...row);
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO ${name} (${columns.join(',')}) VALUES ${placeholders.join(',')}`, values);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  timings.push({ table: name, rows: total, elapsedMs: Date.now() - startedAt });
}

try {
  await insertBatches(
    'app_ops.egg_collection',
    totalEgg,
    ['collection_no','batch_id','house_id','material_id','warehouse_id','location_id','collection_date','shift','good_eggs','broken_eggs','dirty_eggs','grade_detail','device_ref','company_code','created_by'],
    (i) => [`P2-EGG-${i}`, 1 + (i % 20), 1 + (i % 106), 1, 1, 1, dateFor(i), ['day','night','morning','evening'][i % 4], 800 + (i % 100), i % 10, i % 5, { grade: i % 3 }, `MOBA-${i % 12}`, 'THL', 'P2_BULK'],
  );
  await insertBatches(
    'app.inventory_ledger',
    totalLedger,
    ['material_id','batch_no','location_id','company_code','warehouse_id','quantity','inventory_status','created_by'],
    (i) => [1 + (i % 50), `BATCH-${1 + (i % 100)}`, 1 + (i % 200), 1, 1 + (i % 20), 100 + (i % 1000), i % 3 === 0 ? 'reserved' : 'available', 'P2_BULK'],
  );
  await insertBatches(
    'app.audit_log',
    totalAudit,
    ['employee_no','login_ref','operation','permission_ref','sensitive_op','company_code','created_by'],
    (i) => [1 + (i % 200), `LOGIN-${i % 100}`, `P2 bulk operation ${i % 100}`, `PERM-${i % 40}`, i % 10 === 0 ? 'yes' : 'no', 'THL', 'P2_BULK'],
  );
  const counts = {};
  for (const [label, table] of [['egg','app_ops.egg_collection'], ['ledger','app.inventory_ledger'], ['audit','app.audit_log']]) {
    counts[label] = Number((await pool.query(`SELECT count(*) AS count FROM ${table}`)).rows[0].count);
  }
  const result = { event: 'p2_large_data_seed_completed', checkedAt: new Date().toISOString(), target: process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ':***@'), requested: { totalEgg, totalLedger, totalAudit }, counts, timings };
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ event: result.event, counts }));
} catch (error) {
  const result = { event: 'p2_large_data_seed_failed', checkedAt: new Date().toISOString(), error: error.message, timings };
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
