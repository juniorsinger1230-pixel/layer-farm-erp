import type { QueryResultRow } from 'pg';
import { tableCatalogByName, type TableCatalog } from './generated/catalog.js';
import type { ActorContext, Queryable } from './client.js';

export interface ListOptions {
  page: number;
  pageSize: number;
  filters?: Record<string, unknown>;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

function table(name: string): TableCatalog {
  const found = tableCatalogByName.get(name);
  if (!found) throw new Error('Unknown table');
  return found;
}

function companyUsesId(model: TableCatalog): boolean {
  return model.columns.find((column) => column.name === 'company_code')?.type === 'BIGINT';
}

function scopedCompanyValue(model: TableCatalog, context: ActorContext): string | number {
  if (companyUsesId(model)) {
    if (!Number.isSafeInteger(context.companyId) || (context.companyId ?? 0) < 1) throw new Error('Company id scope is required');
    return context.companyId as number;
  }
  return context.companyCode;
}

function positiveInteger(value: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new Error('Invalid pagination');
  return value;
}

/** 只允许目录中的真实标识符，所有值均使用参数绑定，禁止拼接用户值。 */
export class PostgresRepository {
  constructor(private readonly db: Queryable, private readonly context: ActorContext) {}

  async create<T extends QueryResultRow>(tableName: string, input: Record<string, unknown>): Promise<T> {
    const model = table(tableName);
    const data = { ...input };
    if (model.companyScope) {
      if (this.context.companyCode === '*') {
        if (companyUsesId(model)) {
          if (!Number.isSafeInteger(data.company_code) || (data.company_code as number) < 1) throw new Error('Company id scope is required');
        } else if (data.company_code !== 'THL' && data.company_code !== 'TGE') {
          throw new Error('Company scope is required');
        }
      } else {
        const scoped = scopedCompanyValue(model, this.context);
        if (data.company_code !== undefined && data.company_code !== scoped) throw new Error('Cross-company write denied');
        data.company_code = scoped;
      }
    }
    for (const column of model.columns) {
      if (column.actorContext) data[column.name] = this.context.actorId;
    }
    const allowed = model.columns.filter((column) => !column.identity && column.name !== 'created_at' && data[column.name] !== undefined);
    const unknown = Object.keys(data).filter((key) => !model.columns.some((column) => column.name === key));
    if (unknown.length > 0) throw new Error(`Unknown fields: ${unknown.join(',')}`);
    if (allowed.length === 0) throw new Error('No writable fields');
    const names = allowed.map((column) => `"${column.name}"`).join(', ');
    const parameters = allowed.map((_, index) => `$${index + 1}`).join(', ');
    const result = await this.db.query<T>(
      `INSERT INTO app."${model.tableName}" (${names}) VALUES (${parameters}) RETURNING *`,
      allowed.map((column) => data[column.name]),
    );
    return result.rows[0] as T;
  }

  async list<T extends QueryResultRow>(tableName: string, options: ListOptions): Promise<{ items: T[]; total: number }> {
    const model = table(tableName);
    const page = positiveInteger(options.page, 1_000_000);
    const pageSize = positiveInteger(options.pageSize, 200);
    const filters = { ...(options.filters ?? {}) };
    if (model.companyScope && this.context.companyCode !== '*') filters.company_code = scopedCompanyValue(model, this.context);
    const unknown = Object.keys(filters).filter((key) => !model.columns.some((column) => column.name === key));
    if (unknown.length > 0) throw new Error(`Unknown filters: ${unknown.join(',')}`);
    const values: unknown[] = [];
    const where = Object.entries(filters).map(([key, value]) => {
      values.push(value);
      return `"${key}" = $${values.length}`;
    });
    const whereSql = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';
    const orderBy = options.orderBy ?? model.primaryKey[0] ?? 'id';
    if (!model.columns.some((column) => column.name === orderBy)) throw new Error('Invalid order column');
    const direction = options.orderDirection === 'DESC' ? 'DESC' : 'ASC';
    const total = await this.db.query<{ count: string }>(`SELECT count(*)::text AS count FROM app."${model.tableName}"${whereSql}`, values);
    const pageValues = [...values, pageSize, (page - 1) * pageSize];
    const result = await this.db.query<T>(
      `SELECT * FROM app."${model.tableName}"${whereSql} ORDER BY "${orderBy}" ${direction} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      pageValues,
    );
    return { items: result.rows, total: Number(total.rows[0]?.count ?? 0) };
  }

  async get<T extends QueryResultRow>(tableName: string, id: string): Promise<T | null> {
    const model = table(tableName);
    if (!/^\d+$/.test(id)) throw new Error('Invalid resource id');
    const values: unknown[] = [Number(id)];
    let company = '';
    if (model.companyScope && this.context.companyCode !== '*') {
      values.push(scopedCompanyValue(model, this.context));
      company = ' AND company_code = $2';
    }
    const result = await this.db.query<T>(`SELECT * FROM app."${model.tableName}" WHERE id = $1${company}`, values);
    return result.rows[0] ?? null;
  }

  async update<T extends QueryResultRow>(tableName: string, id: string, input: Record<string, unknown>, expectedUpdatedAt?: string): Promise<T | null> {
    const model = table(tableName);
    const data = { ...input };
    const immutable = new Set([...model.primaryKey, 'created_by', 'created_at', 'company_code']);
    const allowed = model.columns.filter((column) => !immutable.has(column.name) && !column.identity && data[column.name] !== undefined);
    const unknown = Object.keys(data).filter((key) => !model.columns.some((column) => column.name === key));
    if (unknown.length > 0 || immutable.has(Object.keys(data).find((key) => immutable.has(key)) ?? '')) throw new Error('Invalid update fields');
    if (allowed.length === 0) throw new Error('No writable fields');
    if (model.columns.some((column) => column.name === 'updated_by')) data.updated_by = this.context.actorId;
    if (model.columns.some((column) => column.name === 'updated_at')) data.updated_at = new Date().toISOString();
    const assignments = Object.entries(data).filter(([key]) => model.columns.some((column) => column.name === key) && !immutable.has(key) && !model.columns.find((column) => column.name === key)?.identity);
    const values: unknown[] = assignments.map(([, value]) => value);
    if (!/^\d+$/.test(id)) throw new Error('Invalid resource id');
    values.push(Number(id));
    const where = [`id = $${values.length}`];
    if (model.companyScope && this.context.companyCode !== '*') {
      values.push(scopedCompanyValue(model, this.context));
      where.push(`company_code = $${values.length}`);
    }
    if (expectedUpdatedAt !== undefined) {
      values.push(expectedUpdatedAt);
      where.push(`(updated_at = $${values.length} OR (updated_at IS NULL AND created_at = $${values.length}))`);
    }
    const sql = `UPDATE app."${model.tableName}" SET ${assignments.map(([key], index) => `"${key}" = $${index + 1}`).join(', ')} WHERE ${where.join(' AND ')} RETURNING *`;
    const result = await this.db.query<T>(sql, values);
    return result.rows[0] ?? null;
  }
}
