import pg from 'pg';

const name = process.argv[2];
if (!name) throw new Error('Database name is required');
const client = new pg.Client({ host: '127.0.0.1', port: 55432, user: 'erp', database: 'postgres' });
await client.connect();
try {
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (exists.rowCount === 0) {
    await client.query(`CREATE DATABASE ${name} ENCODING 'UTF8'`);
  }
  const result = await client.query('SELECT datname FROM pg_database ORDER BY datname');
  console.log(result.rows.map((row) => row.datname).join(','));
} finally {
  await client.end();
}
