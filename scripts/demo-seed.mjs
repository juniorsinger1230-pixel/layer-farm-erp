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
const companyCode = 'THL';
const commonPassword = 'Demo-Passw0rd!2026';
const fixedMfaSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const mfaRoles = new Set(['admin', 'finance_manager']);

const departments = [
  { code: 'HQ', name: '总经办', level: 1 },
  { code: 'FIN', name: '财务部', level: 2 },
  { code: 'PUR', name: '采购部', level: 2 },
  { code: 'SAL', name: '销售部', level: 2 },
  { code: 'FARM', name: '养殖部', level: 2 },
  { code: 'WH', name: '仓储部', level: 2 },
  { code: 'ENG', name: '工程部', level: 2 },
];

const staff = [
  { account: 'admin.zhang', employeeNo: 'EMP-001', name: '张伟', role: 'admin', department: 'HQ', position: '系统管理员', password: 'Admin-Passw0rd!2026' },
  { account: 'finance.li', employeeNo: 'EMP-002', name: '李娜', role: 'finance_manager', department: 'FIN', position: '财务经理', password: commonPassword },
  { account: 'purchase.wang', employeeNo: 'EMP-003', name: '王强', role: 'purchase_manager', department: 'PUR', position: '采购经理', password: commonPassword },
  { account: 'sales.chen', employeeNo: 'EMP-004', name: '陈杰', role: 'sales_manager', department: 'SAL', position: '销售经理', password: commonPassword },
  { account: 'farm.zhao', employeeNo: 'EMP-005', name: '赵敏', role: 'layer_farm_manager', department: 'FARM', position: '蛋鸡场经理', password: commonPassword },
  { account: 'vet.liu', employeeNo: 'EMP-006', name: '刘医生', role: 'vet', department: 'FARM', position: '兽医', password: commonPassword },
  { account: 'warehouse.zhou', employeeNo: 'EMP-007', name: '周强', role: 'warehouse', department: 'WH', position: '仓库管理员', password: commonPassword },
  { account: 'engineering.wu', employeeNo: 'EMP-008', name: '吴工', role: 'engineering', department: 'ENG', position: '工程维修员', password: commonPassword },
];

const printTemplates = [
  { code: 'LABEL-EGG', name: '鲜鸡蛋标签', type: 'label', paper: '80x60', dimensions: '80x60mm', document: 'egg-collection', printer: 'Gprinter M421' },
  { code: 'DELIVERY-NOTE', name: '配送单', type: 'delivery', paper: 'legal', dimensions: '216x356mm', document: 'delivery', printer: 'EPSON L3110' },
  { code: 'CASH-VOUCHER', name: '现金凭证', type: 'cash_voucher', paper: 'half_a4', dimensions: '148x210mm', document: 'cash_voucher', printer: 'EPSON LX-310' },
];

async function one(text, values = []) {
  const result = await pool.query(text, values);
  return result.rows[0];
}

try {
  const tableResult = await pool.query(
    `SELECT quote_ident(table_schema) || '.' || quote_ident(table_name) AS qualified_name
       FROM information_schema.tables
      WHERE table_schema IN ('app', 'app_auth', 'app_ops') AND table_type = 'BASE TABLE'`,
  );
  await pool.query(`TRUNCATE TABLE ${tableResult.rows.map((row) => row.qualified_name).join(', ')} RESTART IDENTITY CASCADE`);
  await pool.query("SELECT set_config('app.company_code', $1, false)", [companyCode]);
  await pool.query("SELECT set_config('app.actor_id', 'SYSTEM', false)");

  await pool.query(
    `INSERT INTO app.company (company_code, company_name, base_currency, status, created_by, remark)
     VALUES ($1, 'THL分公司', 'PHP', 'active', 'SYSTEM', '本地演示公司')`,
    [companyCode],
  );

  const unitMap = new Map();
  for (const department of departments) {
    const parentId = department.code === 'HQ' ? null : unitMap.get('HQ');
    const unit = await one(
      `INSERT INTO app.organization_unit (unit_code, unit_name, parent_unit_id, org_level, status, company_code, created_by, remark)
       VALUES ($1, $2, $3, $4, 'active', $5, 'SYSTEM', '业务部门') RETURNING id`,
      [department.code, department.name, parentId, department.level, companyCode],
    );
    unitMap.set(department.code, unit.id);
  }

  const positionMap = new Map();
  for (const member of staff) {
    if (positionMap.has(member.position)) continue;
    const position = await one(
      `INSERT INTO app.position
       (position_code, position_name, unit_id, headcount, reports_to_id, effective_date, status, company_code, created_by, remark)
       VALUES ($1, $2, $3, 1, NULL, CURRENT_DATE, 'active', $4, 'SYSTEM', '演示岗位') RETURNING id`,
      [member.position, member.position, unitMap.get(member.department), companyCode],
    );
    positionMap.set(member.position, position.id);
  }

  for (const member of staff) {
    const employee = await one(
      `INSERT INTO app.employee (employee_no, employee_name, position_id, account, employment_status, company_code, created_by, remark)
       VALUES ($1, $2, $3, 0, 'active', $4, 'SYSTEM', '在职员工') RETURNING id`,
      [member.employeeNo, member.name, positionMap.get(member.position), companyCode],
    );
    const principal = {
      employeeId: Number(employee.id),
      employeeNo: member.employeeNo,
      companyCode,
      companyId: 0,
      roles: [{ role: member.role, companyCode }],
      mfaEnrolled: mfaRoles.has(member.role),
    };
    const mfaSecret = mfaRoles.has(member.role) ? fixedMfaSecret : null;
    const passwordHash = await hashPassword(member.password);
    await pool.query(
      `INSERT INTO app_auth.credential
       (employee_id, account, company_code, password_hash, principal, status, failed_attempts, locked_until, mfa_secret)
       VALUES ($1, $2, $3, $4, $5::jsonb, 'active', 0, NULL, $6)`,
      [employee.id, member.account, companyCode, passwordHash, JSON.stringify(principal), mfaSecret],
    );
  }

  for (const item of printTemplates) {
    const template = await one(
      `INSERT INTO app.print_template
       (template_code, template_name, template_type, paper_spec, company_code, created_by, paper_size_code,
        paper_dimensions_mm, applicable_document_type, target_printer_models, margin_config)
       VALUES ($1, $2, $3, $4, $5, 'SYSTEM', $4, $6, $7, $8, '{"top":2,"right":2,"bottom":2,"left":2}'::jsonb)
       RETURNING id`,
      [item.code, item.name, item.type, item.paper, companyCode, item.dimensions, item.document, item.printer],
    );
    if (item.type === 'label') {
      await pool.query(
        `INSERT INTO app_ops.print_template_design
         (company_code, template_id, version, canvas_width_mm, canvas_height_mm, elements, status, created_by)
         VALUES ($1, $2, 1, 80, 60, '[]'::jsonb, 'published', 'SYSTEM')`,
        [companyCode, template.id],
      );
    }
  }

  const priceList = await one(
    `INSERT INTO app.price_list
     (price_list_code, price_type, product_name, price, effective_rule, effective_date, company_code, created_by, remark)
     VALUES ('PRICE-EGG', 'standard', '鲜鸡蛋', 10.5, '标准价格', CURRENT_DATE, $1, 'SYSTEM', '本地演示价格')
     RETURNING id`,
    [companyCode],
  );

  const customer = await one(
    `INSERT INTO app.customer
     (customer_code, customer_name, contact_person, address, payment_term, credit_ref, price_id, status, company_code, created_by, remark)
     VALUES ('CUST-MNL', '马尼拉生鲜超市', '何塞', '马尼拉市商业区 18 号', 30, 0, $1, 'active', $2, 'SYSTEM', '本地演示客户')
     RETURNING id`,
    [priceList.id, companyCode],
  );

  const credit = await one(
    `INSERT INTO app.credit_limit
     (customer_id, credit_amount, occupied_amount, over_limit_block, manual_adjust, ceo_approval, company_code, created_by, remark)
     VALUES ($1, 100000, 0, true, NULL, 'not_required', $2, 'SYSTEM', '客户信用额度')
     RETURNING id`,
    [customer.id, companyCode],
  );
  await pool.query('UPDATE app.customer SET credit_ref=$1 WHERE id=$2', [credit.id, customer.id]);

  console.log(JSON.stringify({
    event: 'demo_data_ready',
    url: 'http://127.0.0.1:8080',
    companyCode,
    admin: { account: staff[0].account, password: staff[0].password },
    users: staff.length,
  }));
} finally {
  await pool.end();
}
