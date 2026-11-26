import { expect, type Page, type Response } from '@playwright/test';
import rawFormSchemas from '../apps/web/src/generated/form-schemas.json' with { type: 'json' };

export type FieldValue = string | number | boolean | Record<string, unknown>;
export type FieldPair = readonly [string, FieldValue];

type FormFieldSchema = {
  name: string;
  label: string;
  control: string;
  reference?: { path: string; valueField: string; labelFields: string[] };
  enum?: string[] | null;
};
type PageFormSchema = {
  path: string;
  fields: FormFieldSchema[];
};
type FormSchemas = {
  pages: Record<string, PageFormSchema>;
};

const formSchemas = rawFormSchemas as FormSchemas;

function formatFieldValue(value: FieldValue): string {
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export async function login(page: Page, account: string, password: string, companyCode = 'THL'): Promise<void> {
  const companyDirectory = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/auth/companies' && response.status() === 200);
  await page.goto('/');
  if (companyCode !== 'THL') {
    await companyDirectory;
    await page.locator('.ant-select-selector').first().click();
    const companyInput = page.getByLabel('公司');
    await companyInput.press('ArrowUp');
    await companyInput.press('Enter');
    await expect(page.locator('.ant-select-selection-item')).toHaveAttribute('title', new RegExp(`^${companyCode}\\b`));
  }
  await page.getByLabel('员工账号').fill(account);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: '登录工作台' }).click();
  await expect(page.getByRole('menuitem', { name: '我的工作台' })).toBeVisible();
}

const pageAliases: Record<string, string> = {
  '物料主数据': 'inv-001',
  '仓库与库位': 'inv-005',
  '栋舍与栏位': 'farm-003',
  '供应商主数据': 'proc-003',
  '采购与 MRP': 'proc-002',
  '收货检验': 'proc-004',
  '鸡群与生产': 'farm-002',
  '集蛋分级': 'farm-011',
  '价格目录': 'sales-002',
  '客户主数据': 'sales-001',
  '信用额度': 'sales-004',
  '销售与配送': 'sales-003',
  '打印与附件': 'print-001',
};

export async function openMenu(page: Page, name: string): Promise<void> {
  const pageId = pageAliases[name] ?? name;
  await page.goto(`/app/${pageId}`);
  await expect(page.getByRole('table')).toBeVisible();
  await page.waitForLoadState('networkidle').catch(() => undefined);
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

function waitForApiResponse(
  page: Page,
  method: string,
  statuses: number[],
  urlMatcher: (url: string) => boolean,
): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      statuses.includes(response.status()) &&
      urlMatcher(response.url()),
    { timeout: 30000 },
  );
}

function getPageId(page: Page): string {
  const match = /\/(?:app|h5)\/([^/?#]+)/.exec(page.url());
  if (!match?.[1]) throw new Error('Unable to resolve page id');
  return match[1];
}

function getSchema(page: Page): PageFormSchema {
  const pageId = getPageId(page);
  const schema = formSchemas.pages[pageId];
  if (!schema) throw new Error(`Missing form schema for ${pageId}`);
  return schema;
}

async function fillField(
  page: Page,
  dialog: ReturnType<Page['getByRole']>,
  field: FormFieldSchema,
  value: FieldValue,
  fieldIndex: number,
): Promise<void> {
  const item = dialog.locator('.ant-form-item').nth(fieldIndex);
  if (field.control === 'switch') {
    const control = item.getByRole('switch');
    const checked = (await control.getAttribute('aria-checked')) === 'true';
    if (checked !== Boolean(value)) await control.click();
    return;
  }
  if (field.control === 'select' || field.control === 'reference') {
    let optionLabel = formatFieldValue(value);
    const reference = field.reference;
    if (field.control === 'reference' && reference) {
      const records = await listItems<Record<string, unknown>>(page, reference.path);
      const record = records.find((candidate) => {
        const selected = candidate[reference.valueField];
        return (typeof selected === 'string' || typeof selected === 'number') && String(selected) === optionLabel;
      });
      if (!record) throw new Error(`Reference value not found: ${field.name}=${optionLabel}`);
      const labelField = reference.labelFields.find((name) => {
        const candidate = record[name];
        return (typeof candidate === 'string' || typeof candidate === 'number') && String(candidate) !== '';
      });
      optionLabel = labelField ? String(record[labelField]) : optionLabel;
    }
    const combobox = item.getByRole('combobox');
    await combobox.click();
    if (field.control === 'select') {
      const optionIndex = field.enum?.indexOf(optionLabel) ?? -1;
      if (optionIndex < 0) throw new Error(`Enum option not found: ${field.name}=${optionLabel}`);
      for (let index = 0; index < optionIndex; index += 1) await combobox.press('ArrowDown');
      await combobox.press('Enter');
    } else {
      await combobox.fill(optionLabel);
      await combobox.press('Enter');
    }
    return;
  }
  if (field.control === 'number') {
    await item.getByRole('spinbutton').fill(formatFieldValue(value));
    return;
  }
  if (field.control === 'date' || field.control === 'date-time') {
    const control = item.locator('input').first();
    await control.fill(formatFieldValue(value));
    await control.press('Tab');
    return;
  }
  if (field.control === 'json' || field.control === 'textarea') {
    const rendered = typeof value === 'object' ? JSON.stringify(value) : formatFieldValue(value);
    await item.locator('textarea').first().fill(rendered);
    return;
  }
  await item.getByRole('textbox').first().fill(formatFieldValue(value));
}

export async function createRecord(
  page: Page,
  buttonName: string,
  fields: readonly FieldPair[],
): Promise<void> {
  const schema = getSchema(page);
  const responsePromise = waitForApiResponse(
    page,
    'POST',
    [200, 201],
    (url) => new URL(url).pathname === schema.path,
  );
  await page.getByRole('button', { name: buttonName }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  for (const [name, value] of fields) {
    const fieldIndex = schema.fields.findIndex((candidate) => candidate.name === name);
    const field = schema.fields[fieldIndex];
    if (!field) throw new Error(`Missing field schema for ${name}`);
    await fillField(page, drawer, field, value, fieldIndex);
  }
  await drawer.getByRole('button', { name: /保\s*存/ }).click();
  await responsePromise;
  await closeDrawer(drawer);
}

type Envelope<T> = { data: T };
type ItemEnvelope<T> = { items: T[] };

async function readJson<T>(page: Page, path: string): Promise<Envelope<T>> {
  return page.evaluate(async (url): Promise<Envelope<T>> => {
    const rawSession = sessionStorage.getItem('layer-erp-session');
    const parsedSession = rawSession ? (JSON.parse(rawSession) as { accessToken?: string }) : {};
    const headers = parsedSession.accessToken ? { authorization: `Bearer ${parsedSession.accessToken}` } : {};
    const response = await fetch(url, { headers, cache: 'no-store' });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return (await response.json()) as Envelope<T>;
  }, path);
}

export async function executeAction(
  page: Page,
  search: string,
  fields: readonly FieldPair[],
): Promise<void> {
  const responsePromise = waitForApiResponse(
    page,
    'POST',
    [200],
    (url) => url.includes('/actions'),
  );
  await page.getByPlaceholder('搜索当前记录').fill(search);
  await page.getByRole('button', { name: '执行动作' }).first().click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  for (const [index, [key, value]] of fields.entries()) {
    if (index > 0) await drawer.getByRole('button', { name: '添加字段' }).click();
    const row = drawer.locator('.editor-row').nth(index);
    await row.locator('input').nth(0).fill(key);
    await row.locator('input').nth(1).fill(formatFieldValue(value));
  }
  await drawer.getByRole('button', { name: /执\s*行/ }).click();
  await responsePromise;
  await closeDrawer(drawer);
  await page.getByPlaceholder('搜索当前记录').fill('');
}

export async function listItems<T>(page: Page, path: string): Promise<T[]> {
  const envelope = await readJson<T[] | ItemEnvelope<T>>(page, `${path}?page=1&pageSize=200`);
  const payload = envelope.data;
  return Array.isArray(payload) ? payload : payload.items;
}

export async function findItem<T>(
  page: Page,
  path: string,
  predicate: (item: T) => boolean,
): Promise<T> {
  const item = (await listItems<T>(page, path)).find(predicate);
  if (!item) throw new Error(`Item not found: ${path}`);
  return item;
}
