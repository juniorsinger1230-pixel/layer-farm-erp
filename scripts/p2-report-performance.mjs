import { writeFileSync } from 'node:fs';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const iterations = Number(process.env.P2_REPORT_ITERATIONS ?? 3);
const queries = [
  {
    name: 'egg collection paged list',
    sql: `SELECT * FROM app_ops.egg_collection WHERE company_code='THL' AND collection_date BETWEEN DATE '2025-11-01' AND DATE '2026-06-30' ORDER BY collection_date, id LIMIT 100`,
  },
  {
    name: 'egg collection daily aggregation',
    sql: `SELECT collection_date, shift, count(*) AS total, sum(good_eggs) AS good_eggs, sum(broken_eggs) AS broken_eggs, sum(dirty_eggs) AS dirty_eggs FROM app_ops.egg_collection WHERE company_code='THL' AND collection_date >= DATE '2025-11-01' GROUP BY collection_date, shift ORDER BY collection_date, shift`,
  },
  {
    name: 'inventory ledger paged list',
    sql: `SELECT * FROM app.inventory_ledger WHERE company_code=1 ORDER BY id LIMIT 100`,
  },
  {
    name: 'inventory material status aggregation',
    sql: `SELECT material_id, inventory_status, count(*) AS total, sum(quantity) AS quantity FROM app.inventory_ledger WHERE company_code=1 GROUP BY material_id, inventory_status ORDER BY material_id, inventory_status`,
  },
  {
    name: 'audit log paged list',
    sql: `SELECT * FROM app.audit_log WHERE company_code='THL' ORDER BY id LIMIT 100`,
  },
  {
    name: 'audit operation aggregation',
    sql: `SELECT operation, count(*) AS total FROM app.audit_log WHERE company_code='THL' GROUP BY operation ORDER BY operation`,
  },
];

try {
  const results = [];
  for (const query of queries) {
    const durations = [];
    let rowCount = 0;
    for (let index = 0; index < iterations; index += 1) {
      const startedAt = Date.now();
      const result = await pool.query(query.sql);
      const elapsedMs = Date.now() - startedAt;
      durations.push(elapsedMs);
      rowCount = result.rowCount;
    }
    const sorted = [...durations].sort((a, b) => a - b);
    results.push({
      name: query.name,
      rowCount,
      iterations,
      durations,
      minMs: sorted[0],
      maxMs: sorted[sorted.length - 1],
      avgMs: Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length),
    });
  }
  const explain = await pool.query(`EXPLAIN (ANALYZE, BUFFERS) SELECT collection_date, shift, count(*) AS total, sum(good_eggs) AS good_eggs FROM app_ops.egg_collection WHERE company_code='THL' AND collection_date >= DATE '2025-11-01' GROUP BY collection_date, shift ORDER BY collection_date, shift`);
  const result = {
    event: 'p2_report_performance_completed',
    checkedAt: new Date().toISOString(),
    target: process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ':***@'),
    results,
    explain: explain.rows.map((row) => row['QUERY PLAN']),
  };
  writeFileSync('p2-report-performance-result.json', `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ event: result.event, queryCount: results.length, iterations }));
} catch (error) {
  const result = { event: 'p2_report_performance_failed', checkedAt: new Date().toISOString(), error: error.message };
  writeFileSync('p2-report-performance-result.json', `${JSON.stringify(result, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
