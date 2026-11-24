import test from 'node:test';
import assert from 'node:assert/strict';
import { ContractProcessService } from '../dist/packages/domain/src/contract-process.js';

const context = {
  actorId: 'EMP-001',
  employeeId: 1,
  companyCode: 'THL',
  companyId: 1,
};

class FakeClient {
  constructor(mode = 'normal') {
    this.mode = mode;
    this.queries = [];
  }

  async query(sql, values = []) {
    this.queries.push({ sql, values });
    const text = sql.trim();
    if (text === 'BEGIN' || text === 'COMMIT' || text.startsWith('SELECT set_config')) {
      return { rows: [], rowCount: 0 };
    }
    if (text.startsWith('ROLLBACK')) return { rows: [], rowCount: 0 };
    if (text.includes('count(*)')) return { rows: [{ count: 1 }], rowCount: 1 };
    if (text.startsWith('SELECT 1 FROM')) return { rows: [{ exists: 1 }], rowCount: 1 };
    if (text.startsWith('INSERT INTO app.idempotency_consumption')) {
      return { rows: [{ id: 1 }], rowCount: 1 };
    }
    if (text.startsWith('UPDATE app.idempotency_consumption')) {
      return { rows: [], rowCount: 1 };
    }
    if (this.mode === 'missing') return { rows: [], rowCount: 0 };
    if (text.startsWith('INSERT') || text.startsWith('UPDATE')) {
      return { rows: [{ ...rowFor(text, values), ...parseData(text, values) }], rowCount: 1 };
    }
    return { rows: [rowFor(text, values)], rowCount: 1 };
  }

  release() {}
}

class FakePool {
  constructor(mode) {
    this.mode = mode;
    this.clients = [];
  }

  async connect() {
    const client = new FakeClient(this.mode);
    this.clients.push(client);
    return client;
  }
}

function service(mode) {
  return new ContractProcessService(new FakePool(mode), context);
}

function parseData(sql, values) {
  const output = {};
  const insert = sql.match(/INSERT INTO .*?\((.*?)\) VALUES \((.*?)\)/);
  if (insert) {
    const columns = insert[1].split(',').map((value) => value.trim().replaceAll('"', ''));
    const placeholders = insert[2].split(',').map((value) => Number(value.trim().replace('$', '')));
    columns.forEach((column, index) => { output[column] = values[placeholders[index] - 1]; });
    return output;
  }
  const update = sql.match(/SET (.*?) WHERE/);
  for (const assignment of update ? update[1].split(',') : []) {
    const match = assignment.trim().match(/^"?([^"=]+)"?=\$(\d+)$/);
    if (match) output[match[1]] = values[Number(match[2]) - 1];
  }
  return output;
}

function rowFor(sql) {
  if (sql.includes('farm_batch')) {
    return { id: 1, batch_no: 'BATCH-001', stage: 'open', company_code: 'THL' };
  }
  if (sql.includes('data_permission')) {
    return { id: 1, approval_status: 'draft', module: 'position_role', company_id: 1 };
  }
  if (sql.includes('flock_cost_snapshot')) {
    return { batch_id: 1, accumulated_cost: 100, remaining_flock: 0, unit_cost: 1, company_code: 'THL' };
  }
  if (sql.includes('print_log')) {
    return { id: 1, void_status: 'valid', reprint: false, company_code: 'THL' };
  }
  if (sql.includes('print_job')) {
    return { id: 1, queue_status: 'pending', company_code: 'THL' };
  }
  if (sql.includes('session')) {
    return { session_id: 'session-1', revoked_at: null };
  }
  return { id: 1, report_no: 'RPT-001', report_type: 'management', company_code: 'THL' };
}

const reportPath = '/api/v1/rpt/report-exports';
const permissionPath = '/api/v1/org/position-role-mappings';
const costPath = '/api/v1/fin/batch-cost-cards';
const settlementPath = '/api/v1/fin/profit-and-batch-settlement';
const printLogPath = '/api/v1/print/reprint-void-audit';
const printJobPath = '/api/v1/print/delivery-note-printing';
const sessionPath = '/api/v1/plat/authentication-sessions';

test('ContractProcessService 列表、详情和审计视图返回真实数据', async () => {
  const listed = await service().list(reportPath, { page: '1', pageSize: '20' });
  assert.equal(listed.total, 1);
  assert.equal(listed.items[0].report_no, 'RPT-001');

  const cost = await service().list(costPath, {});
  assert.equal(cost.items[0].batch_id, 1);
  const costItem = await service().get(costPath, '1');
  assert.equal(costItem.batch_id, 1);
});

test('ContractProcessService 创建、修改和通用动作执行字段白名单与审计', async () => {
  const created = await service().create(reportPath, {
    report_no: 'RPT-002',
    report_type: 'production',
    export_ref: 1,
    generation_condition: 'daily',
  }, 'idempotency-key-001');
  assert.equal(created.report_no, 'RPT-002');

  const updated = await service().update(reportPath, '1', { report_type: 'finance' });
  assert.equal(updated.report_type, 'finance');

  const submitted = await service().action(permissionPath, '1', { action: 'submit' });
  assert.equal(submitted.approval_status, 'pending');
});

test('ContractProcessService 支持结项、作废、重打、取消和会话吊销动作', async () => {
  const settled = await service().action(settlementPath, '1', { action: 'settle' });
  assert.equal(settled.batch.stage, 'open');
  assert.equal(settled.profit, 0);

  const voided = await service().action(printLogPath, '1', { action: 'void', reason: 'damaged' });
  assert.equal(voided.void_status, 'void');
  const reprinted = await service().action(printLogPath, '1', { action: 'reprint' });
  assert.equal(reprinted.void_status, 'reprint');

  const cancelled = await service().action(printJobPath, '1', { action: 'cancel' });
  assert.equal(cancelled.queue_status, 'cancelled');

  const revoked = await service().action(sessionPath, 'session-1', { action: 'revoke' });
  assert.ok(revoked.revoked_at);
});

test('ContractProcessService 阻断只读写入、非法动作、非法ID、未知字段和状态冲突', async () => {
  await assert.rejects(service().create(costPath, {}, 'idempotency-key-002'), (error) => {
    assert.equal(error.status, 403);
    return true;
  });
  await assert.rejects(service().update(costPath, '1', {}), (error) => {
    assert.equal(error.status, 403);
    return true;
  });
  await assert.rejects(service().action(reportPath, '1', { action: 'invalid action' }), (error) => {
    assert.equal(error.status, 400);
    return true;
  });
  await assert.rejects(service().get(reportPath, 'abc'), (error) => {
    assert.equal(error.status, 400);
    return true;
  });
  await assert.rejects(service().create(reportPath, { unknown_field: 1 }, 'idempotency-key-003'), (error) => {
    assert.equal(error.status, 400);
    return true;
  });
  await assert.rejects(service('missing').get(reportPath, '99'), (error) => {
    assert.equal(error.status, 404);
    return true;
  });

  const conflictService = new ContractProcessService(new FakePool(), context);
  conflictService['findRow'] = async () => ({ approval_status: 'pending' });
  await assert.rejects(conflictService.action(permissionPath, '1', { action: 'submit' }), (error) => {
    assert.equal(error.status, 409);
    return true;
  });
});
