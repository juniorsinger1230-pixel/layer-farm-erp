import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8080';
const testData = JSON.parse(readFileSync(resolve('e2e/test-data.json'), 'utf8'));
const outputDir = resolve('.runtime/csv-export');
mkdirSync(outputDir, { recursive: true });
const outputPath = resolve(outputDir, 'material-export.csv');

const browser = await chromium.launch();
const page = await browser.newPage({ baseURL: baseUrl });
try {
  await page.goto('/');
  await page.getByLabel('员工账号').fill(testData.account);
  await page.getByLabel('密码').fill(testData.password);
  await page.getByRole('button', { name: '登录工作台' }).click();
  await page.getByRole('menuitem', { name: '经营驾驶舱' }).waitFor();

  await page.goto('/app/inv-001');
  await page.getByRole('table').waitFor();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 CSV' }).click();
  const download = await downloadPromise;
  await download.saveAs(outputPath);

  const bytes = readFileSync(outputPath);
  const hasUtf8Bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const text = bytes.toString('utf8');
  const lines = text.trim().split(/\r?\n/);
  const result = {
    checkedAt: new Date().toISOString(),
    baseUrl,
    page: '/app/inv-001',
    outputPath,
    bytes: bytes.length,
    hasUtf8Bom,
    lineCount: lines.length,
    status: hasUtf8Bom && bytes.length > 0 && lines.length > 1 ? 'PASS' : 'FAIL',
    secretHandling: 'Credentials are read from local test data and are not printed.',
  };
  writeFileSync(resolve(outputDir, 'csv-export-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
} finally {
  await browser.close();
}
