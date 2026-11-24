import test from 'node:test';
import assert from 'node:assert/strict';
import { runMigrations } from '../dist/apps/api/src/migration-runner.js';

const migration = (id, sql = 'SELECT 1', transaction = true) => ({ id, sql, checksum: 'a'.repeat(64), transaction });
function createStore(applied = []) {
  const values = new Set(applied);
  return {
    values,
    has: async (id) => values.has(id),
    getChecksum: async () => 'a'.repeat(64),
    apply: async (item) => { values.add(item.id); },
  };
}

test('迁移按顺序执行并跳过已应用版本', async () => {
  const store = createStore(['001_first']);
  const applied = await runMigrations([migration('001_first'), migration('002_second', 'SELECT 2')], store);
  assert.deepEqual(applied, ['002_second']);
  assert.equal(store.values.has('002_second'), true);
});

test('重复、乱序、空SQL和非法校验和被拒绝', async () => {
  await assert.rejects(runMigrations([migration('002_second'), migration('001_first')], createStore()));
  await assert.rejects(runMigrations([migration('001_first', '')], createStore()));
  await assert.rejects(runMigrations([{ ...migration('../escape'), id: '../escape' }], createStore()));
  await assert.rejects(runMigrations([{ ...migration('001_first'), checksum: 'bad' }], createStore()));
});

test('已应用迁移校验和漂移会阻断执行', async () => {
  const store = createStore(['001_first']);
  store.getChecksum = async () => 'b'.repeat(64);
  await assert.rejects(runMigrations([migration('001_first')], store), /checksum mismatch/);
});

test('并发索引迁移不得在事务中执行', async () => {
  await assert.rejects(runMigrations([migration('003_indexes', 'CREATE INDEX CONCURRENTLY x ON t(id)', true)], createStore()), /outside|transaction/);
});
