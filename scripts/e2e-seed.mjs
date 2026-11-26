import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { hashPassword } from '../dist/packages/security/src/auth.js';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const testData = JSON.parse(readFileSync(new URL('../e2e/test-data.json', import.meta.url), 'utf8'));
const envPath = `${projectRoot}deploy/compose/.env`;
const env = process.env.DATABASE_URL ? {} : Object.fromEntries(readFileSync(envPath, 'utf8').split(/\r?\n/).filter((line) => line.includes('=')).map((line) => {
  const separator = line.indexOf('=');
  return [line.slice(0, separator), line.slice(separator + 1)];
}));
const databaseUrl = process.env.DATABASE_URL ?? `postgresql://erp:${env.POSTGRES_PASSWORD}@127.0.0.1:${env.POSTGRES_PORT ?? '55432'}/layer_farm`;
const pool = new pg.Pool({ connectionString: databaseUrl });

async function findOne(text, values = []) {
  const result = await pool.query(text, values);
  return result.rows[0];
}

try {
  const tableResult = await pool.query(
    `SELECT quote_ident(table_schema) || '.' || quote_ident(table_name) AS qualified_name
       FROM information_schema.tables
      WHERE table_schema IN ('app', 'app_auth', 'app_ops') AND table_type = 'BASE TABLE'`,
  );
  await pool.query(
    `TRUNCATE TABLE ${tableResult.rows.map((row) => row.qualified_name).join(', ')} RESTART IDENTITY CASCADE`,
  );
  await pool.query("SELECT set_config('app.company_code', $1, false)", [testData.companyCode]);
  await pool.query("SELECT set_config('app.actor_id', 'BOOTSTRAP', false)");

  let orgUnit = await findOne(
    'SELECT id FROM app.organization_unit WHERE unit_code=$1 AND company_code=$2',
    ['E2E-HQ', testData.companyCode],
  );
  if (!orgUnit) {
    orgUnit = await findOne(
      `INSERT INTO app.organization_unit (unit_code, unit_name, parent_unit_id, org_level, status, company_code, created_by, remark)
       VALUES ('E2E-HQ', 'E2E Headquarters', NULL, 1, 'active', $1, 'BOOTSTRAP', 'E2E bootstrap unit') RETURNING id`,
      [testData.companyCode],
    );
  }

  let position = await findOne(
    'SELECT id FROM app.position WHERE position_code=$1 AND company_code=$2',
    ['E2E-ADMIN', testData.companyCode],
  );
  if (!position) {
    position = await findOne(
      `INSERT INTO app.position
       (position_code, position_name, unit_id, headcount, reports_to_id, effective_date, status, company_code, created_by, remark)
       VALUES ('E2E-ADMIN', 'E2E Administrator', $1, 1, NULL, CURRENT_DATE, 'active', $2, 'BOOTSTRAP', 'E2E bootstrap position')
       RETURNING id`,
      [orgUnit.id, testData.companyCode],
    );
  }

  let employee = await findOne(
    'SELECT id FROM app.employee WHERE employee_no=$1 AND company_code=$2',
    [testData.employeeNo, testData.companyCode],
  );
  if (!employee) {
    employee = await findOne(
      `INSERT INTO app.employee (employee_no, employee_name, position_id, account, employment_status, company_code, created_by, remark)
       VALUES ($1, 'E2E Administrator', $2, 0, 'active', $3, 'BOOTSTRAP', 'E2E bootstrap employee') RETURNING id`,
      [testData.employeeNo, position.id, testData.companyCode],
    );
  }

  const principal = {
    employeeId: employee.id,
    employeeNo: testData.employeeNo,
    companyCode: testData.companyCode,
    companyId: 0,
    roles: [{ role: 'admin', companyCode: testData.companyCode }],
    mfaEnrolled: false,
  };
  const passwordHash = await hashPassword(testData.password);
  await pool.query(
    `INSERT INTO app_auth.credential
     (employee_id, account, company_code, password_hash, principal, status, failed_attempts, locked_until, mfa_secret)
     VALUES ($1, $2, $3, $4, $5::jsonb, 'active', 0, NULL, NULL)
     ON CONFLICT (employee_id) DO UPDATE SET
       account=EXCLUDED.account, company_code=EXCLUDED.company_code, password_hash=EXCLUDED.password_hash,
       principal=EXCLUDED.principal, status=EXCLUDED.status, failed_attempts=0, locked_until=NULL,
       mfa_secret=EXCLUDED.mfa_secret, updated_at=now()`,
    [employee.id, testData.account, testData.companyCode, passwordHash, JSON.stringify(principal)],
  );

  let printTemplate = await findOne('SELECT id FROM app.print_template WHERE template_code=$1 AND company_code=$2', ['E2E-LABEL', testData.companyCode]);
  if (!printTemplate) {
    printTemplate = await findOne(
      `INSERT INTO app.print_template
       (template_code, template_name, template_type, paper_spec, company_code, created_by, paper_size_code,
        paper_dimensions_mm, applicable_document_type, target_printer_models, margin_config)
       VALUES ('E2E-LABEL', 'E2E Egg Label', 'label', '80x60', $1, 'BOOTSTRAP', '80x60',
               '80x60mm', 'egg-collection', 'EPSON L3110', '{"top":2,"right":2,"bottom":2,"left":2}'::jsonb)
       RETURNING id`,
      [testData.companyCode],
    );
  }

  let priceList = await findOne(
    'SELECT id FROM app.price_list WHERE price_list_code=$1 AND company_code=$2',
    ['E2E-PRICE', testData.companyCode],
  );
  if (!priceList) {
    priceList = await findOne(
      `INSERT INTO app.price_list
       (price_list_code, price_type, product_name, price, effective_rule, effective_date, company_code, created_by, remark)
       VALUES ('E2E-PRICE', 'standard', 'E2E Eggs', 10.50, 'E2E seed price', CURRENT_DATE, $1, 'BOOTSTRAP',
               'E2E bootstrap price list') RETURNING id`,
      [testData.companyCode],
    );
  }

  let customer = await findOne(
    'SELECT id FROM app.customer WHERE customer_code=$1 AND company_code=$2',
    ['E2E-CUSTOMER', testData.companyCode],
  );
  if (!customer) {
    customer = await findOne(
      `INSERT INTO app.customer
       (customer_code, customer_name, contact_person, address, payment_term, credit_ref, price_id, status,
        company_code, created_by, remark)
       VALUES ('E2E-CUSTOMER', 'E2E Customer', 'E2E Contact', 'E2E Address', 30, 0, $1, 'active', $2,
               'BOOTSTRAP', 'E2E bootstrap customer') RETURNING id`,
      [priceList.id, testData.companyCode],
    );
  }

  let creditLimit = await findOne(
    'SELECT id FROM app.credit_limit WHERE customer_id=$1 AND company_code=$2',
    [customer.id, testData.companyCode],
  );
  if (!creditLimit) {
    creditLimit = await findOne(
      `INSERT INTO app.credit_limit
       (customer_id, credit_amount, occupied_amount, over_limit_block, manual_adjust, ceo_approval, company_code,
        created_by, remark)
       VALUES ($1, 100000, 0, true, NULL, 'not_required', $2, 'BOOTSTRAP', 'E2E bootstrap credit limit')
       RETURNING id`,
      [customer.id, testData.companyCode],
    );
  }
  await pool.query('UPDATE app.customer SET credit_ref=$1 WHERE id=$2', [creditLimit.id, customer.id]);

  let printDesign = await findOne(
    'SELECT id FROM app_ops.print_template_design WHERE company_code=$1 AND template_id=$2 AND version=1',
    [testData.companyCode, printTemplate.id],
  );
  if (!printDesign) {
    printDesign = await findOne(
      `INSERT INTO app_ops.print_template_design
       (company_code, template_id, version, canvas_width_mm, canvas_height_mm, elements, status, created_by)
       VALUES ($1, $2, 1, 80, 60, '[]'::jsonb, 'draft', 'BOOTSTRAP') RETURNING id`,
      [testData.companyCode, printTemplate.id],
    );
  }

  writeFileSync(
    new URL('../e2e/runtime-data.json', import.meta.url),
    `${JSON.stringify({
      companyId: 0,
      printTemplateId: Number(printTemplate.id),
      priceListId: Number(priceList.id),
      customerId: Number(customer.id),
      creditLimitId: Number(creditLimit.id),
      printDesignId: Number(printDesign.id),
    }, null, 2)}\n`,
  );
  console.log(JSON.stringify({ event: 'e2e_bootstrap_ready', companyCode: testData.companyCode, account: testData.account }));
} finally {
  await pool.end();
}
