import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const outputDir = new URL('../ui-regression-results/', import.meta.url);
mkdirSync(outputDir, { recursive: true });

const baseUrl = process.env.UI_BASE_URL ?? 'http://127.0.0.1:8080';
const resultPath = fileURLToPath(new URL('../ui-regression-result.json', import.meta.url));
const forbiddenPatterns = [
  /\bP[0-2]\b/,
  /\bSRS\b/,
  /\bMock\b/i,
  /真实\s*API/,
  /\bGAP\b/,
  /\bWIP\b/,
  /\bTODO\b/,
  /\bID\b/,
  /测试/,
  /原型/,
  /需求详情/,
  /数据库字段/,
  /字段/,
  /动作/,
];

const result = {
  pass: false,
  baseUrl,
  checks: [],
  forbiddenHits: [],
  browserMessages: [],
  screenshots: [],
};

function checkCopy(name, text) {
  const hits = forbiddenPatterns.flatMap((pattern) => {
    const matches = text.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`));
    return matches ? matches.map((match) => ({ page: name, term: match })) : [];
  });
  result.forbiddenHits.push(...hits);
  result.checks.push({ name, copyClean: hits.length === 0 });
}

async function screenshot(page, name) {
  const path = fileURLToPath(new URL(`${name}.png`, outputDir));
  await page.screenshot({ path, fullPage: true });
  result.screenshots.push(path);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
const page = await context.newPage();
page.on('console', (message) => {
  if (message.type() === 'error') result.browserMessages.push(message.text());
});
page.on('pageerror', (error) => result.browserMessages.push(error.message));

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await screenshot(page, 'login-initial');
  await page.getByPlaceholder('请输入员工账号').fill('admin.zhang');
  await page.getByPlaceholder('请输入密码').fill('Admin-Passw0rd!2026');
  const buttons = await page.locator('button').evaluateAll((elements) => elements.map((element) => ({
    text: element.textContent,
    html: element.outerHTML,
    visible: !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length),
  })));
  result.browserMessages.push(JSON.stringify(buttons));
  await page.locator('button').filter({ hasText: /登\s*录/ }).click({ timeout: 10000 });
  await page.waitForURL('**/app/workbench', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  checkCopy('桌面岗位工作台', await page.locator('body').innerText());
  await screenshot(page, 'desktop-workbench');

  await page.goto(`${baseUrl}/app/org-001`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '查看详情' }).first().waitFor({ timeout: 30000 });
  checkCopy('桌面业务列表', await page.locator('body').innerText());
  await screenshot(page, 'desktop-list');

  await page.getByRole('button', { name: '查看详情' }).first().click();
  await page.locator('.ant-drawer-content').waitFor();
  checkCopy('桌面详情抽屉', await page.locator('body').innerText());
  await screenshot(page, 'desktop-detail');
  await page.keyboard.press('Escape');
  await page.locator('.ant-drawer-content').waitFor({ state: 'hidden' });

  await page.getByRole('button', { name: /新建/ }).click();
  await page.locator('.ant-drawer-content').waitFor();
  checkCopy('桌面新建表单', await page.locator('body').innerText());
  await screenshot(page, 'desktop-create-form');
  await page.keyboard.press('Escape');
  await page.locator('.ant-drawer-content').waitFor({ state: 'hidden' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/h5/org-001`, { waitUntil: 'networkidle' });
  await page.locator('.ant-card').first().waitFor({ timeout: 30000 });
  checkCopy('移动业务列表', await page.locator('body').innerText());
  await screenshot(page, 'mobile-list');

  await page.locator('.ant-card').first().click();
  await page.locator('.ant-drawer-content').waitFor();
  checkCopy('移动详情抽屉', await page.locator('body').innerText());
  await screenshot(page, 'mobile-detail');
  await page.keyboard.press('Escape');
  await page.locator('.ant-drawer-content').waitFor({ state: 'hidden' });

  await page.getByRole('button', { name: /新建/ }).click();
  await page.locator('.ant-drawer-content').waitFor();
  checkCopy('移动新建表单', await page.locator('body').innerText());
  await screenshot(page, 'mobile-create-form');

  result.pass = result.checks.every((item) => item.copyClean);
  writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  result.error = error.message;
  await screenshot(page, 'failure');
  writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await context.close();
  await browser.close();
}

if (!result.pass) process.exitCode = 1;
