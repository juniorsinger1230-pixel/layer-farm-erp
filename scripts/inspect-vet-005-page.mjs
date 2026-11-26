import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = (process.env.BASE_URL ?? '').replace(/\/$/, '');
const passwordFile = resolve(process.env.TRIAL_PASSWORD_FILE ?? '.runtime/trial-passwords.json');
const account = JSON.parse(readFileSync(passwordFile, 'utf8')).accounts.find((item) => item.account === 'trial.admin');
const output = resolve(process.env.PAGE_INSPECT_OUTPUT ?? 'vet-005-page-inspect.json');
const screenshot = resolve(process.env.PAGE_INSPECT_SCREENSHOT ?? 'vet-005-page.png');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const events = { responses: [], failed: [], console: [] };
page.on('response', (response) => events.responses.push({ url: new URL(response.url()).pathname, status: response.status() }));
page.on('requestfailed', (request) => events.failed.push({ url: new URL(request.url()).pathname, error: request.failure()?.errorText }));
page.on('console', (message) => events.console.push({ type: message.type(), text: message.text() }));

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('例如 trial.admin').fill(account.account);
  await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole('button', { name: '登录工作台' }).click();
  await page.waitForURL('**/app/workbench', { timeout: 30000 });
  const startedAt = Date.now();
  await page.goto(`${baseUrl}/app/vet-005`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.business-page', { timeout: 15000 });
  await page.waitForSelector('.ant-table', { timeout: 15000 });
  await page.waitForTimeout(2000);
  const result = {
    status: 'passed',
    url: page.url(),
    durationMs: Date.now() - startedAt,
    title: await page.title(),
    bodyTextLength: (await page.locator('body').innerText()).length,
    hasBusinessPage: await page.locator('.business-page').count(),
    tableCount: await page.locator('.ant-table').count(),
    events,
  };
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  await page.screenshot({ path: screenshot, fullPage: true });
  console.log(JSON.stringify({ status: result.status, durationMs: result.durationMs }));
} catch (error) {
  const result = { status: 'failed', error: error instanceof Error ? error.message : String(error), events };
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
  console.log(JSON.stringify({ status: result.status, error: result.error }));
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
