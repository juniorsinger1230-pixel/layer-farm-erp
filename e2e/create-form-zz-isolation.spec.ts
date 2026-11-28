import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { login } from './helpers.js';

const testData = JSON.parse(readFileSync(new URL('./test-data.json', import.meta.url), 'utf8')) as {
  account: string;
  password: string;
};
const schema = JSON.parse(readFileSync(new URL('../apps/web/src/generated/form-schemas.json', import.meta.url), 'utf8')) as {
  pages: Record<string, { path: string }>;
};

test('桌面端真实创建、创建后查询、同步双击防重及跨公司隔离', async ({ page, browser }) => {
  const roleSchema = schema.pages['org-003'];
  if (!roleSchema) throw new Error('Missing org-003 schema');
  const suffix = Date.now().toString(36);
  const roleCode = `E2E-D-${suffix}`.slice(0, 32);
  const roleName = `E2E Desktop Role ${suffix}`;
  const postRequests: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === roleSchema.path) postRequests.push(request.url());
  });
  await login(page, testData.account, testData.password);
  await page.goto('/app/org-003');
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByRole('button', { name: /新建/ }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#role_code').fill(roleCode);
  await dialog.locator('#role_name').fill(roleName);
  await dialog.locator('#role_status').click();
  await dialog.locator('#role_status').press('Enter');
  await dialog.locator('#position_id').click();
  await dialog.locator('#position_id').press('Enter');

  const responsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' && new URL(response.url()).pathname === roleSchema.path,
  );
  await dialog.getByRole('button', { name: /保\s*存/ }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBe(201);
  await expect(dialog).toBeHidden();
  expect(postRequests).toHaveLength(1);
  const body = await response.json() as { data?: { id?: string | number } };
  const createdId = body.data?.id;
  expect(createdId).toBeDefined();

  const detail = await page.evaluate(async ({ path, id }) => {
    const raw = sessionStorage.getItem('layer-erp-session');
    const session = raw ? JSON.parse(raw) as { accessToken?: string } : {};
    const result = await fetch(`${path}/${id}`, { headers: { authorization: `Bearer ${session.accessToken ?? ''}` } });
    return { status: result.status, body: await result.json() as unknown };
  }, { path: roleSchema.path, id: String(createdId) });
  expect(detail.status).toBe(200);
  expect(JSON.stringify(detail.body)).toContain(roleName);

  await page.getByPlaceholder('搜索当前记录').fill(roleName);
  await expect(page.getByRole('table')).toContainText(roleName);

  const isolationPage = await browser.newPage();
  await login(isolationPage, 'e2e.isolation.admin', testData.password, 'TGE');
  const isolationResult = await isolationPage.evaluate(async ({ path, name }) => {
    const raw = sessionStorage.getItem('layer-erp-session');
    const session = raw ? JSON.parse(raw) as { accessToken?: string } : {};
    const result = await fetch(`${path}?page=1&pageSize=200`, { headers: { authorization: `Bearer ${session.accessToken ?? ''}` } });
    const json = await result.json() as unknown;
    return { status: result.status, contains: JSON.stringify(json).includes(name) };
  }, { path: roleSchema.path, name: roleName });
  expect(isolationResult.status).toBe(200);
  expect(isolationResult.contains).toBe(false);
  await isolationPage.goto('/app/org-003');
  await isolationPage.getByPlaceholder('搜索当前记录').fill(roleName);
  await expect(isolationPage.getByRole('table')).not.toContainText(roleName);
  await isolationPage.close();
});
