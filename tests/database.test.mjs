import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { runMigrations } from '../dist/apps/api/src/migration-runner.js';
import { loadMigrations, loadDevelopmentRollback } from '../dist/packages/database/src/migrations.js';
import { PostgresRepository } from '../dist/packages/database/src/repository.js';

const db = new PGlite();
const migrationsDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));
let migrations;

function store() {
  return {
    has: async (id) => {
      try { return (await db.query('SELECT 1 FROM schema_migration WHERE id=$1', [id])).rows.length === 1; }
      catch (error) { if (error.code === '42P01') return false; throw error; }
    },
    getChecksum: async (id) => {
      try { return (await db.query('SELECT checksum FROM schema_migration WHERE id=$1', [id])).rows[0]?.checksum ?? null; }
      catch (error) { if (error.code === '42P01') return null; throw error; }
    },
    apply: async (migration) => {
      const sql = migration.transaction ? migration.sql : migration.sql.replaceAll('CONCURRENTLY ', '');
      try {
        if (migration.transaction) await db.exec('BEGIN');
        await db.exec(sql);
        await db.query('INSERT INTO schema_migration(id,checksum) VALUES($1,$2)', [migration.id, migration.checksum]);
        if (migration.transaction) await db.exec('COMMIT');
      } catch (error) {
        if (migration.transaction) await db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

before(async () => {
  migrations = loadMigrations(migrationsDirectory);
  const applied = await runMigrations(migrations, store());
  assert.deepEqual(applied, migrations.map((item) => item.id));
});

after(async () => { await db.close(); });

test('权威75表与登记的执行扩展字段数量一致', async () => {
  const tables = await db.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='app'");
  const columns = await db.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='app'");
  const extensionColumns = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='app' AND table_name='attachment' AND column_name IN ('retention_until','destroyed_at') ORDER BY column_name");
  const indexes = await db.query("SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname='app' AND indexname LIKE 'idx_%'");
  const policies = await db.query("SELECT count(*)::int AS n FROM pg_policies WHERE schemaname='app'");
  assert.equal(tables.rows[0].n, 75);
  assert.equal(columns.rows[0].n, 981);
  assert.deepEqual(extensionColumns.rows.map((row) => row.column_name), ['destroyed_at', 'retention_until']);
  assert.equal(indexes.rows[0].n, 252);
  assert.equal(policies.rows[0].n, 68);
});

test('重复迁移幂等且校验和受控', async () => {
  assert.deepEqual(await runMigrations(migrations, store()), []);
  const changed = migrations.map((item, index) => index === 0 ? { ...item, checksum: 'b'.repeat(64) } : item);
  await assert.rejects(runMigrations(changed, store()), /checksum mismatch/);
});

test('双公司RLS与Repository字段白名单生效', async () => {
  await db.query("SELECT set_config('app.actor_id','TEST_ADMIN',false), set_config('app.company_code','*',false), set_config('app.company_id','0',false)");
  const root = new PostgresRepository(db, { actorId: 'TEST_ADMIN', companyCode: '*' });
  const thl = await root.create('company', { company_code: 'THL', company_name: 'THL Test', status: 'ACTIVE' });
  const tge = await root.create('company', { company_code: 'TGE', company_name: 'TGE Test', status: 'ACTIVE' });
  assert.ok(thl.id);
  assert.ok(tge.id);
  await assert.rejects(root.create('company', { company_code: 'XXX', company_name: 'Bad', status: 'ACTIVE' }), /Company scope/);
  await assert.rejects(root.create('company', { company_code: 'THL', company_name: 'Bad', status: 'ACTIVE', injected: true }), /Unknown fields/);

  await db.query("SELECT set_config('app.actor_id','THL_USER',false), set_config('app.company_code','THL',false), set_config('app.company_id',(SELECT id::text FROM app.company WHERE company_code='THL' LIMIT 1),false)");
  const scoped = new PostgresRepository(db, { actorId: 'THL_USER', companyCode: 'THL' });
  const list = await scoped.list('company', { page: 1, pageSize: 20 });
  assert.equal(list.total, 1);
  assert.equal(list.items[0].company_code, 'THL');
  assert.equal(await scoped.get('company', String(tge.id)), null);
  const newCompany = await scoped.create('company', { company_code: 'E2E_NEW', company_name: 'New tenant', status: 'ACTIVE' });
  assert.equal(newCompany.company_code, 'E2E_NEW');
  await assert.rejects(scoped.create('organization_unit', { unit_code: 'CROSS', unit_name: 'Cross', org_level: 1, status: 'ACTIVE', company_code: 'TGE' }), /Cross-company/);
});

test('检查约束和唯一约束拒绝非法数据', async () => {
  await db.query("SELECT set_config('app.actor_id','TEST_ADMIN',false), set_config('app.company_code','THL',false)");
  await assert.rejects(db.query("INSERT INTO app.organization_unit(unit_code,unit_name,org_level,status,company_code) VALUES('NEG','Negative',0,'ACTIVE','THL')"), /ck_organization_unit_org_level/);
  await db.query("INSERT INTO app.organization_unit(unit_code,unit_name,org_level,status,company_code) VALUES('HQ','Headquarters',1,'ACTIVE','THL')");
  await assert.rejects(db.query("INSERT INTO app.organization_unit(unit_code,unit_name,org_level,status,company_code) VALUES('HQ','Duplicate',1,'ACTIVE','THL')"), /unique|duplicate/i);
});

test('Repository乐观锁拒绝过期更新', async () => {
  await db.query("SELECT set_config('app.actor_id','THL_USER',false), set_config('app.company_code','THL',false), set_config('app.company_id',(SELECT id::text FROM app.company WHERE company_code='THL' LIMIT 1),false)");
  const scoped = new PostgresRepository(db, { actorId: 'THL_USER', companyCode: 'THL' });
  const company = (await scoped.list('company', { page: 1, pageSize: 1 })).items[0];
  const updated = await scoped.update('company', String(company.id), { status: 'DISABLED' });
  assert.equal(updated.status, 'DISABLED');
  const stale = await scoped.update('company', String(company.id), { status: 'ACTIVE' }, company.updated_at ?? '2000-01-01T00:00:00Z');
  assert.equal(stale, null);
  await assert.rejects(scoped.update('company', String(company.id), { company_code: 'TGE' }), /Invalid update/);
});

test('并发读取与分页边界不会改变结果', async () => {
  await db.query("SELECT set_config('app.actor_id','THL_USER',false), set_config('app.company_code','THL',false), set_config('app.company_id',(SELECT id::text FROM app.company WHERE company_code='THL' LIMIT 1),false)");
  const scoped = new PostgresRepository(db, { actorId: 'THL_USER', companyCode: 'THL' });
  const results = await Promise.all(Array.from({ length: 20 }, () => scoped.list('company', { page: 1, pageSize: 1 })));
  assert.equal(new Set(results.map((item) => item.total)).size, 1);
  await assert.rejects(scoped.list('company', { page: 0, pageSize: 1 }), /pagination/);
  await assert.rejects(scoped.list('company', { page: 1, pageSize: 201 }), /pagination/);
  await assert.rejects(scoped.list('company', { page: 1, pageSize: 1, orderBy: 'id;DROP TABLE company' }), /order column/);
});

test('非生产回滚需显式批准且生产被阻断', async () => {
  const rollbackDirectory = fileURLToPath(new URL('../migrations/rollback/', import.meta.url));
  assert.throws(() => loadDevelopmentRollback(rollbackDirectory, 'production', true), /not approved/);
  assert.throws(() => loadDevelopmentRollback(rollbackDirectory, 'test', false), /not approved/);
  const sql = loadDevelopmentRollback(rollbackDirectory, 'test', true);
  assert.match(sql, /DROP TABLE IF EXISTS app\."company"/);
});
