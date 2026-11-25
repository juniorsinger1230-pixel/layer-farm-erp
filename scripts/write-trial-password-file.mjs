import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const outputFile = resolve(process.env.TRIAL_PASSWORD_FILE ?? '.runtime/trial-passwords.json');
const accounts = [
  ['admin', 'Trial-Admin-2026!'],
  ['boss', 'Trial-Boss-2026!'],
  ['finance_manager', 'Trial-FinMgr-2026!'],
  ['finance_cashier', 'Trial-Cashier-2026!'],
  ['purchase_manager', 'Trial-PurMgr-2026!'],
  ['purchase_staff', 'Trial-PurStaff-2026!'],
  ['sales_manager', 'Trial-SalMgr-2026!'],
  ['sales_staff', 'Trial-SalStaff-2026!'],
  ['layer_farm_manager', 'Trial-FarmMgr-2026!'],
  ['vet', 'Trial-Vet-2026!'],
  ['feeder', 'Trial-Feeder-2026!'],
  ['warehouse', 'Trial-Warehouse-2026!'],
  ['external_affairs', 'Trial-External-2026!'],
  ['driver', 'Trial-Driver-2026!'],
  ['engineering', 'Trial-Engineering-2026!'],
].map(([role, password]) => ({ role, account: `trial.${role}`, password }));

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, `${JSON.stringify({ event: 'trial_passwords_ready', accounts }, null, 2)}\n`);
console.log(JSON.stringify({ event: 'trial_password_file_ready', outputFile, accountCount: accounts.length }));
