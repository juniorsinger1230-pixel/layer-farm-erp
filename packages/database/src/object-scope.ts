import type { ActorContext } from './client.js';

export type ObjectScopeClause = { sql: string; values: unknown[] };

/**
 * 生成对象级安全谓词。所有标识符来自目录白名单，用户值通过参数绑定。
 */
export function buildObjectScope(
  tableName: string,
  columnNames: ReadonlySet<string>,
  context: ActorContext,
): ObjectScopeClause[] {
  const clauses: ObjectScopeClause[] = [];
  const houseIds = [...context.houseIds ?? []];
  const warehouseIds = [...context.warehouseIds ?? []];

  if (houseIds.length > 0) {
    if (tableName === 'house_pen') {
      clauses.push({ sql: '"id" = ANY($n)', values: [houseIds] });
    } else if (columnNames.has('house_id')) {
      clauses.push({ sql: '"house_id" = ANY($n)', values: [houseIds] });
    } else {
      clauses.push({ sql: 'FALSE', values: [] });
    }
  }

  if (warehouseIds.length > 0) {
    if (tableName === 'warehouse_location') {
      clauses.push({ sql: '"id" = ANY($n)', values: [warehouseIds] });
    } else if (columnNames.has('warehouse_id')) {
      clauses.push({ sql: '"warehouse_id" = ANY($n)', values: [warehouseIds] });
    } else {
      clauses.push({ sql: 'FALSE', values: [] });
    }
  }

  if (context.selfOnly === true) {
    if (columnNames.has('employee_no')) {
      clauses.push({ sql: '"employee_no" = $n', values: [context.actorId] });
    } else if (columnNames.has('owner_employee_no')) {
      clauses.push({ sql: '"owner_employee_no" = $n', values: [context.actorId] });
    } else if (columnNames.has('created_by')) {
      clauses.push({ sql: '"created_by" = $n', values: [context.actorId] });
    } else {
      clauses.push({ sql: 'FALSE', values: [] });
    }
  }

  if (context.taskOnly === true) {
    if (tableName === 'delivery_task' && context.employeeId !== undefined) {
      clauses.push({
        sql: '("driver_no" = $n OR "courier_no" = $n)',
        values: [context.employeeId, context.employeeId],
      });
    } else if (columnNames.has('task_ref')) {
      clauses.push({ sql: '"task_ref" = $n', values: [context.actorId] });
    } else {
      clauses.push({ sql: 'FALSE', values: [] });
    }
  }

  return clauses;
}

export function renderObjectScope(clauses: ObjectScopeClause[], startIndex: number): { sql: string; values: unknown[]; nextIndex: number } {
  let index = startIndex;
  const values: unknown[] = [];
  const rendered = clauses.map((clause) => {
    let sql = clause.sql;
    for (const value of clause.values) {
      values.push(value);
      sql = sql.replace('$n', `$${index}`);
      index += 1;
    }
    return sql;
  });
  return { sql: rendered.join(' AND '), values, nextIndex: index };
}
