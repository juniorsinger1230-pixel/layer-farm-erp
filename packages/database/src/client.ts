import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<T>>;
}

export interface ActorContext {
  actorId: string;
  companyCode: string;
  companyId?: number;
  employeeId?: number;
}

export function createPostgresPool(connectionString: string, max = 20): Pool {
  if (connectionString.trim().length === 0) throw new Error('DATABASE_URL is required');
  return new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  });
}

/** 事务内设置 RLS 与审计上下文；set_config 的第三个参数保证只在当前事务生效。 */
export async function withTransaction<T>(
  pool: Pool,
  context: ActorContext,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.actor_id', $1, true)", [context.actorId]);
    await client.query("SELECT set_config('app.company_code', $1, true)", [context.companyCode]);
    await client.query("SELECT set_config('app.company_id', $1, true)", [context.companyId === undefined ? '' : String(context.companyId)]);
    await client.query("SELECT set_config('statement_timeout', '15000', true)");
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
