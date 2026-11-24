import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { hashPassword } from '../dist/packages/security/src/auth.js';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const testData = JSON.parse(readFileSync(new URL('../e2e/test-data.json', import.meta.url), 'utf8'));
const envText = readFileSync(`${projectRoot}deploy/compose/.env`, 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter((line) => line.includes('=')).map((line) => {
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

  let company = await findOne('SELECT id FROM app.company WHERE company_code=$1', [testData.companyCode]);
  if (!company) {
    company = await findOne(
      `INSERT INTO app.company (company_code, company_name, base_currency, status, created_by, remark)
       VALUES ($1, $2, 'PHP', 'active', 'BOOTSTRAP', 'E2E bootstrap company') RETURNING id`,
      [testData.companyCode, 'THL Poultry Farm Inc.'],
    );
  }

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
    companyId: Number(company.id),
    roles: [{ role: 'admin', companyCode: testData.companyCode }],
    mfaEnrolled: true,
  };
  const passwordHash = await hashPassword(testData.password);
  await pool.query(
    `INSERT INTO app_auth.credential
     (employee_id, account, company_code, password_hash, principal, status, failed_attempts, locked_until, mfa_secret)
     VALUES ($1, $2, $3, $4, $5::jsonb, 'active', 0, NULL, $6)
     ON CONFLICT (employee_id) DO UPDATE SET
       account=EXCLUDED.account, company_code=EXCLUDED.company_code, password_hash=EXCLUDED.password_hash,
       principal=EXCLUDED.principal, status=EXCLUDED.status, failed_attempts=0, locked_until=NULL,
       mfa_secret=EXCLUDED.mfa_secret, updated_at=now()`,
    [employee.id, testData.account, testData.companyCode, passwordHash, JSON.stringify(principal), testData.mfaSecret],
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
  writeFileSync(
    new URL('../e2e/runtime-data.json', import.meta.url),
    `${JSON.stringify({ companyId: Number(company.id), printTemplateId: Number(printTemplate.id) }, null, 2)}\n`,
  );
  console.log(JSON.stringify({ event: 'e2e_bootstrap_ready', companyCode: testData.companyCode, account: testData.account }));
} finally {
  await pool.end();
}
