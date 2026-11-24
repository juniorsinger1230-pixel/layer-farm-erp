import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomInt, randomBytes } from 'node:crypto';
import pg from 'pg';
import { hashPassword } from '../dist/packages/security/src/auth.js';

const companyCode = process.env.TRIAL_COMPANY_CODE ?? 'THL';
const databaseUrl = process.env.DATABASE_URL;
const outputFile = resolve(process.env.TRIAL_PASSWORD_FILE ?? '.runtime/trial-passwords.json');

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}
if (!['THL', 'TGE'].includes(companyCode)) {
  throw new Error('TRIAL_COMPANY_CODE must be THL or TGE');
}

const accounts = [
  { role: 'admin', account: 'trial.admin' },
  { role: 'boss', account: 'trial.boss' },
  { role: 'finance_manager', account: 'trial.finance_manager' },
  { role: 'finance_cashier', account: 'trial.finance_cashier' },
  { role: 'purchase_manager', account: 'trial.purchase_manager' },
  { role: 'purchase_staff', account: 'trial.purchase_staff' },
  { role: 'sales_manager', account: 'trial.sales_manager' },
  { role: 'sales_staff', account: 'trial.sales_staff' },
  { role: 'layer_farm_manager', account: 'trial.layer_farm_manager' },
  { role: 'vet', account: 'trial.vet' },
  { role: 'feeder', account: 'trial.feeder' },
  { role: 'warehouse', account: 'trial.warehouse' },
  { role: 'external_affairs', account: 'trial.external_affairs' },
  { role: 'driver', account: 'trial.driver' },
  { role: 'engineering', account: 'trial.engineering' },
];

const lower = 'abcdefghijkmnpqrstuvwxyz';
const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const digits = '23456789';
const special = '-_.!@#$%^&*';
const all = `${lower}${upper}${digits}${special}`;

function pick(alphabet) {
  return alphabet[randomInt(alphabet.length)];
}

function generatePassword() {
  const chars = [pick(lower), pick(upper), pick(digits), pick(special)];
  while (chars.length < 24) chars.push(pick(all));
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }
  return chars.join('');
}

const pool = new pg.Pool({ connectionString: databaseUrl });

try {
  const existing = await pool.query(
    `SELECT account, employee_id
       FROM app_auth.credential
      WHERE company_code=$1 AND account = ANY($2)`,
    [companyCode, accounts.map((item) => item.account)],
  );

  if (existing.rowCount !== accounts.length) {
    const found = new Set(existing.rows.map((row) => row.account));
    const missing = accounts.filter((item) => !found.has(item.account)).map((item) => item.account);
    throw new Error(`Expected ${accounts.length} trial accounts, found ${existing.rowCount}; missing: ${missing.join(', ')}`);
  }

  const client = await pool.connect();
  const rotated = [];
  try {
    await client.query('BEGIN');
    for (const item of accounts) {
      const password = generatePassword();
      const passwordHash = await hashPassword(password);
      const result = await client.query(
        `UPDATE app_auth.credential
            SET password_hash=$1, status='active', failed_attempts=0, locked_until=NULL, updated_at=now()
          WHERE company_code=$2 AND account=$3
          RETURNING employee_id`,
        [passwordHash, companyCode, item.account],
      );
      if (result.rowCount !== 1) {
        throw new Error(`Failed to rotate ${item.account}`);
      }
      rotated.push({
        role: item.role,
        account: item.account,
        employeeId: result.rows[0].employee_id,
        password,
      });
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  mkdirSync(dirname(outputFile), { recursive: true });
  const payload = {
    event: 'trial_passwords_rotated',
    companyCode,
    rotatedAt: new Date().toISOString(),
    requestId: randomBytes(8).toString('hex'),
    accounts: rotated,
  };
  writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  chmodSync(outputFile, 0o600);

  console.log(JSON.stringify({
    event: 'trial_password_rotation_ready',
    companyCode,
    count: rotated.length,
    passwordFile: outputFile,
  }));
} finally {
  await pool.end();
}
