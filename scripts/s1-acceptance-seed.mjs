import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { hashPassword } from '../dist/packages/security/src/auth.js';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const envPath = `${projectRoot}deploy/compose/.env`;
const env = process.env.DATABASE_URL ? {} : Object.fromEntries(readFileSync(envPath, 'utf8').split(/\r?\n/).filter((line) => line.includes('=')).map((line) => {
  const separator = line.indexOf('=');
  return [line.slice(0, separator), line.slice(separator + 1)];
}));
const databaseUrl = process.env.DATABASE_URL ?? `postgresql://erp:${env.POSTGRES_PASSWORD}@127.0.0.1:${env.POSTGRES_PORT ?? '55432'}/layer_farm`;
const pool = new pg.Pool({ connectionString: databaseUrl });
const fixedMfaSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const password = 'Demo-Passw0rd!2026';

const boundaryUsers = [
  { employeeNo: 'S1-001', name: '锁定测试', account: 'lock.test', roles: [{ role: 'feeder', companyCode: 'THL' }] },
  { employeeNo: 'S1-002', name: 'MFA测试', account: 'mfa.boss', mfaSecret: fixedMfaSecret, mfaEnrolled: true, roles: [{ role: 'boss', companyCode: 'THL' }] },
  { employeeNo: 'S1-003', name: '出纳测试', account: 'cashier.test', roles: [{ role: 'finance_cashier', companyCode: 'THL' }] },
  { employeeNo: 'S1-004', name: '多角色测试', account: 'multi.test', roles: [{ role: 'finance_cashier', companyCode: 'THL' }, { role: 'warehouse', companyCode: 'THL' }] },
  { employeeNo: 'S1-005', name: '限时角色测试', account: 'expired.test', mfaSecret: fixedMfaSecret, mfaEnrolled: true, roles: [{ role: 'admin', companyCode: 'THL', validTo: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }] },
  { employeeNo: 'S1-006', name: '范围覆盖测试', account: 'scope.test', roles: [{ role: 'feeder', companyCode: 'THL', scopeConfig: { companyCodes: ['TGE'], houseIds: [88], selfOnly: true } }] },
  { employeeNo: 'S1-007', name: '供应商测试', account: 'supplier.test', roles: [{ role: 'purchase_staff', companyCode: 'THL' }] },
  { employeeNo: 'S1-008', name: '司机测试', account: 'driver.test', roles: [{ role: 'driver', companyCode: 'THL' }] },
];

try {
  await pool.query("SELECT set_config('app.company_code', 'THL', false)");
  await pool.query("SELECT set_config('app.actor_id', 'SYSTEM', false)");
  const company = await pool.query("SELECT id FROM app.company WHERE company_code='THL'");
  const position = await pool.query("SELECT id FROM app.position WHERE company_code='THL' ORDER BY id LIMIT 1");
  const companyId = Number(company.rows[0].id);
  const positionId = Number(position.rows[0].id);
  const passwordHash = await hashPassword(password);

  for (const member of boundaryUsers) {
    const existingEmployee = await pool.query('SELECT id FROM app.employee WHERE company_code=$1 AND employee_no=$2', ['THL', member.employeeNo]);
    if (existingEmployee.rowCount === 1) {
      const employeeId = Number(existingEmployee.rows[0].id);
      await pool.query('DELETE FROM app_auth.mfa_used_code WHERE employee_id=$1', [employeeId]);
      await pool.query('DELETE FROM app_auth.session WHERE employee_id=$1', [employeeId]);
      await pool.query('DELETE FROM app_auth.credential WHERE employee_id=$1', [employeeId]);
      await pool.query('DELETE FROM app.employee WHERE id=$1', [employeeId]);
    }
    const created = await pool.query(
      `INSERT INTO app.employee (employee_no, employee_name, position_id, account, employment_status, company_code, created_by, remark)
       VALUES ($1, $2, $3, 0, 'active', 'THL', 'SYSTEM', 'S1验收边界账号') RETURNING id`,
      [member.employeeNo, member.name, positionId],
    );
    const employeeId = Number(created.rows[0].id);
    const principal = {
      employeeId,
      employeeNo: member.employeeNo,
      companyCode: 'THL',
      companyId,
      roles: member.roles,
      mfaEnrolled: member.mfaEnrolled ?? false,
    };
    await pool.query(
      `INSERT INTO app_auth.credential
       (employee_id, account, company_code, password_hash, principal, status, failed_attempts, locked_until, mfa_failed_attempts, mfa_locked_until, mfa_secret)
       VALUES ($1,$2,'THL',$3,$4::jsonb,'active',0,NULL,0,NULL,$5)`,
      [employeeId, member.account, passwordHash, JSON.stringify(principal), member.mfaSecret ?? null],
    );
  }

  console.log(JSON.stringify({
    event: 's1_acceptance_data_ready',
    companyId,
    positionId,
    accounts: boundaryUsers.map((member) => member.account),
  }));
} finally {
  await pool.end();
}
