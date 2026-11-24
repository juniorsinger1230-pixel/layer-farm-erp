import pg from 'pg';
import { hashPassword } from '../dist/packages/security/src/auth.js';

const companyCode = process.env.TRIAL_COMPANY_CODE ?? 'THL';
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}
if (!['THL', 'TGE'].includes(companyCode)) {
  throw new Error('TRIAL_COMPANY_CODE must be THL or TGE');
}

const accounts = [
  { role: 'admin', account: 'trial.admin', employeeNo: 'TRIAL-ADMIN', employeeName: '试用系统管理员', positionName: '系统管理员', password: 'Trial-Admin-2026!' },
  { role: 'boss', account: 'trial.boss', employeeNo: 'TRIAL-BOSS', employeeName: '试用总经理', positionName: '总经理', password: 'Trial-Boss-2026!' },
  { role: 'finance_manager', account: 'trial.finance_manager', employeeNo: 'TRIAL-FIN-MGR', employeeName: '试用财务经理', positionName: '财务经理', password: 'Trial-FinMgr-2026!' },
  { role: 'finance_cashier', account: 'trial.finance_cashier', employeeNo: 'TRIAL-CASHIER', employeeName: '试用出纳', positionName: '出纳', password: 'Trial-Cashier-2026!' },
  { role: 'purchase_manager', account: 'trial.purchase_manager', employeeNo: 'TRIAL-PUR-MGR', employeeName: '试用采购经理', positionName: '采购经理', password: 'Trial-PurMgr-2026!' },
  { role: 'purchase_staff', account: 'trial.purchase_staff', employeeNo: 'TRIAL-PUR-STAFF', employeeName: '试用采购专员', positionName: '采购专员', password: 'Trial-PurStaff-2026!' },
  { role: 'sales_manager', account: 'trial.sales_manager', employeeNo: 'TRIAL-SAL-MGR', employeeName: '试用销售经理', positionName: '销售经理', password: 'Trial-SalMgr-2026!' },
  { role: 'sales_staff', account: 'trial.sales_staff', employeeNo: 'TRIAL-SAL-STAFF', employeeName: '试用销售专员', positionName: '销售专员', password: 'Trial-SalStaff-2026!' },
  { role: 'layer_farm_manager', account: 'trial.layer_farm_manager', employeeNo: 'TRIAL-FARM-MGR', employeeName: '试用蛋鸡场经理', positionName: '蛋鸡场经理', password: 'Trial-FarmMgr-2026!' },
  { role: 'vet', account: 'trial.vet', employeeNo: 'TRIAL-VET', employeeName: '试用兽医', positionName: '兽医', password: 'Trial-Vet-2026!' },
  { role: 'feeder', account: 'trial.feeder', employeeNo: 'TRIAL-FEEDER', employeeName: '试用饲养员', positionName: '饲养员', password: 'Trial-Feeder-2026!' },
  { role: 'warehouse', account: 'trial.warehouse', employeeNo: 'TRIAL-WAREHOUSE', employeeName: '试用仓库管理员', positionName: '仓库管理员', password: 'Trial-Warehouse-2026!' },
  { role: 'external_affairs', account: 'trial.external_affairs', employeeNo: 'TRIAL-EXTERNAL', employeeName: '试用外事专员', positionName: '外事专员', password: 'Trial-External-2026!' },
  { role: 'driver', account: 'trial.driver', employeeNo: 'TRIAL-DRIVER', employeeName: '试用司机', positionName: '司机', password: 'Trial-Driver-2026!' },
  { role: 'engineering', account: 'trial.engineering', employeeNo: 'TRIAL-ENGINEERING', employeeName: '试用工程维修员', positionName: '工程维修员', password: 'Trial-Engineering-2026!' },
];

const pool = new pg.Pool({ connectionString: databaseUrl });

async function findOne(text, values = []) {
  const result = await pool.query(text, values);
  return result.rows[0];
}

try {
  let company = await findOne('SELECT id FROM app.company WHERE company_code=$1', [companyCode]);
  if (!company) {
    company = await findOne(
      `INSERT INTO app.company (company_code, company_name, base_currency, status, created_by, remark)
       VALUES ($1, $2, 'PHP', 'active', 'BOOTSTRAP', 'Trial account company') RETURNING id`,
      [companyCode, companyCode === 'THL' ? 'THL Poultry Farm Inc.' : 'TGE Poultry Farm Inc.'],
    );
  }

  let orgUnit = await findOne(
    'SELECT id FROM app.organization_unit WHERE unit_code=$1 AND company_code=$2',
    ['TRIAL-HQ', companyCode],
  );
  if (!orgUnit) {
    orgUnit = await findOne(
      `INSERT INTO app.organization_unit
       (unit_code, unit_name, parent_unit_id, org_level, status, company_code, created_by, remark)
       VALUES ('TRIAL-HQ', 'Trial Headquarters', NULL, 1, 'active', $1, 'BOOTSTRAP', 'Trial account organization')
       RETURNING id`,
      [companyCode],
    );
  }

  for (const item of accounts) {
    const position = await findOne(
      `INSERT INTO app.position
       (position_code, position_name, unit_id, headcount, reports_to_id, effective_date, status, company_code, created_by, remark)
       VALUES ($1, $2, $3, 1, NULL, CURRENT_DATE, 'active', $4, 'BOOTSTRAP', 'Trial account position')
       ON CONFLICT (company_code, position_code) DO UPDATE SET
         position_name=EXCLUDED.position_name, unit_id=EXCLUDED.unit_id, status=EXCLUDED.status, updated_at=now()
       RETURNING id`,
      [item.employeeNo, item.positionName, orgUnit.id, companyCode],
    );

    const employee = await findOne(
      `INSERT INTO app.employee
       (employee_no, employee_name, position_id, account, employment_status, company_code, created_by, remark)
       VALUES ($1, $2, $3, 0, 'active', $4, 'BOOTSTRAP', 'Trial account employee')
       ON CONFLICT (company_code, employee_no) DO UPDATE SET
         employee_name=EXCLUDED.employee_name, position_id=EXCLUDED.position_id,
         employment_status=EXCLUDED.employment_status, updated_at=now()
       RETURNING id`,
      [item.employeeNo, item.employeeName, position.id, companyCode],
    );

    const principal = {
      employeeId: Number(employee.id),
      employeeNo: item.employeeNo,
      companyCode,
      companyId: Number(company.id),
      roles: [{ role: item.role, companyCode }],
      mfaEnrolled: false,
    };
    const passwordHash = await hashPassword(item.password);
    await pool.query(
      `INSERT INTO app_auth.credential
       (employee_id, account, company_code, password_hash, principal, status, failed_attempts, locked_until, mfa_secret)
       VALUES ($1, $2, $3, $4, $5::jsonb, 'active', 0, NULL, NULL)
       ON CONFLICT (employee_id) DO UPDATE SET
         account=EXCLUDED.account, company_code=EXCLUDED.company_code, password_hash=EXCLUDED.password_hash,
         principal=EXCLUDED.principal, status='active', failed_attempts=0, locked_until=NULL,
         mfa_secret=NULL, updated_at=now()`,
      [employee.id, item.account, companyCode, passwordHash, JSON.stringify(principal)],
    );
  }

  console.log(JSON.stringify({
    event: 'trial_accounts_ready',
    companyCode,
    count: accounts.length,
    accounts: accounts.map((item) => ({ role: item.role, account: item.account, employeeNo: item.employeeNo })),
  }));
} finally {
  await pool.end();
}
