import { expect, type Page } from '@playwright/test';

export type FieldValue = string | number | boolean;
export type FieldPair = readonly [string, FieldValue];

export async function login(page: Page, account: string, password: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('员工账号').fill(account);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: '登录工作台' }).click();
  await expect(page.getByRole('menuitem', { name: '经营驾驶舱' })).toBeVisible();
}

export async function openMenu(page: Page, name: string): Promise<void> {
  await page.getByRole('menuitem', { name }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.waitForLoadState('networkidle');
}

async function closeDrawer(drawer: ReturnType<Page['getByRole']>): Promise<void> {
  try {
    await expect(drawer).toBeHidden({ timeout: 2000 });
    return;
  } catch {
    // Drawer may be in its closing animation when the save action resolves.
  }
  if (await drawer.isVisible().catch(() => false)) {
    try {
      await drawer.getByRole('button', { name: '关闭' }).click({ timeout: 5000 });
    } catch {
      if (await drawer.isVisible().catch(() => false)) {
        await drawer.press('Escape');
      }
    }
  }
  await expect(drawer).toBeHidden();
}

export async function createRecord(page: Page, buttonName: string, fields: readonly FieldPair[]): Promise<void> {
  await page.getByRole('button', { name: buttonName }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  for (const [index, [key, value]] of fields.entries()) {
    await drawer.getByRole('button', { name: '添加字段' }).click();
    const row = drawer.locator('.editor-row').nth(index);
    await row.locator('input').nth(0).fill(key);
    await row.locator('input').nth(1).fill(String(value));
  }
  await drawer.getByRole('button', { name: /保\s*存/ }).click();
  await expect(page.getByText('已保存并通过领域校验').first()).toBeVisible();
  await closeDrawer(drawer);
}

type Envelope<T> = { data: T };
type ItemEnvelope<T> = { items: T[] };

async function readJson<T>(page: Page, path: string): Promise<Envelope<T>> {
  return page.evaluate(async (url): Promise<Envelope<T>> => {
    const rawSession = sessionStorage.getItem('layer-erp-session');
    const parsedSession = rawSession ? JSON.parse(rawSession) as { accessToken?: string } : {};
    const headers = parsedSession.accessToken ? { authorization: `Bearer ${parsedSession.accessToken}` } : {};
    const response = await fetch(url, { headers, cache: 'no-store' });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return (await response.json()) as Envelope<T>;
  }, path);
}

export async function executeAction(page: Page, search: string, fields: readonly FieldPair[]): Promise<void> {
  await page.getByPlaceholder('搜索当前记录').fill(search);
  await page.getByRole('button', { name: '执行动作' }).first().click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  for (const [index, [key, value]] of fields.entries()) {
    if (index > 0) await drawer.getByRole('button', { name: '添加字段' }).click();
    const row = drawer.locator('.editor-row').nth(index);
    await row.locator('input').nth(0).fill(key);
    await row.locator('input').nth(1).fill(String(value));
  }
  await drawer.getByRole('button', { name: /保\s*存/ }).click();
  await expect(page.getByText('已保存并通过领域校验').first()).toBeVisible();
  await closeDrawer(drawer);
  await page.getByPlaceholder('搜索当前记录').fill('');
}

export async function listItems<T>(page: Page, path: string): Promise<T[]> {
  const envelope = await readJson<T[] | ItemEnvelope<T>>(page, `${path}?page=1&pageSize=200`);
  const payload = envelope.data;
  return Array.isArray(payload) ? payload : payload.items;
}

export async function findItem<T>(page: Page, path: string, predicate: (item: T) => boolean): Promise<T> {
  const item = (await listItems<T>(page, path)).find(predicate);
  if (!item) throw new Error(`Item not found: ${path}`);
  return item;
}
