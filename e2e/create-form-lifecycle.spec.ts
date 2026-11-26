import { expect, test, type Page } from '@playwright/test';
import rawFormSchemas from '../apps/web/src/generated/form-schemas.json' with { type: 'json' };
import { login } from './helpers.js';
import { readFileSync } from 'node:fs';

const testData = JSON.parse(readFileSync(new URL('./test-data.json', import.meta.url), 'utf8')) as {
  account: string;
  password: string;
  companyCode: string;
};

type ReferenceMeta = {
  path: string;
  valueField: string;
  labelFields: string[];
};
type FormFieldSchema = {
  name: string;
  label: string;
  type: string;
  control: string;
  required: boolean;
  enum: string[] | null;
  maxLength: number | null;
  jsonShape?: 'array' | 'object';
  reference?: ReferenceMeta;
};
type PageFormSchema = {
  path: string;
  companyField: string | null;
  companyFieldType: string | null;
  fields: FormFieldSchema[];
};
type FormSchemaFile = {
  pages: Record<string, PageFormSchema>;
};

const formSchemaFile = rawFormSchemas as FormSchemaFile;
const runToken = Date.now().toString(36);

function shortToken(value: string): string {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(36).padStart(7, '0');
}


async function evaluateFetch(page: Page, url: string): Promise<unknown> {
  return page.evaluate(async (targetUrl) => {
    const rawSession = sessionStorage.getItem('layer-erp-session');
    const session = rawSession ? (JSON.parse(rawSession) as { accessToken?: string }) : {};
    const headers = session.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {};
    const response = await fetch(targetUrl, { headers, cache: 'no-store' });
    const json = await response.json();
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return json;
  }, url);
}

async function fetchRecords(page: Page, path: string, cache: Map<string, Record<string, unknown>[]>): Promise<Record<string, unknown>[]> {
  const cached = cache.get(path);
  if (cached) return cached;
  const json = await evaluateFetch(page, `${path}?page=1&pageSize=200`) as {
    data?: unknown;
    items?: unknown;
  };
  const payload = json.data ?? json;
  const records = Array.isArray(payload)
    ? payload
    : typeof payload === 'object' && payload !== null && Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: Record<string, unknown>[] }).items
      : [];
  cache.set(path, records);
  return records;
}

async function fetchCurrentCompanyId(page: Page): Promise<number> {
  const json = await evaluateFetch(page, '/api/v1/org/organizations?page=1&pageSize=200') as {
    data?: unknown;
    items?: unknown;
  };
  const payload = json.data ?? json;
  const records = Array.isArray(payload)
    ? payload
    : typeof payload === 'object' && payload !== null && Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: Record<string, unknown>[] }).items
      : [];
  const current = records.find((record) => record.company_code === testData.companyCode);
  const id = Number(current?.id);
  if (!current || !Number.isInteger(id) || id <= 0) throw new Error('Current company not found');
  return id;
}

async function fillField(
  page: Page,
  dialog: ReturnType<Page['getByRole']>,
  field: FormFieldSchema,
  index: number,
  pass: number,
  pageId: string,
  attempt: number,
  optionCache: Map<string, Record<string, unknown>[]>,
  referenceSelection: Map<string, number>,
): Promise<boolean> {
  const item = dialog.locator('.ant-form-item').nth(index);

  if (field.control === 'reference' && field.reference) {
    const records = await fetchRecords(page, field.reference.path, optionCache);
    if (records.length === 0) return false;
    const optionIndex = referenceSelection.get(field.reference.path) ?? 0;
    const selectedIndex = pageId === 'farm-012' && field.name === 'batch_id' ? 1 : optionIndex;
    referenceSelection.set(field.reference.path, optionIndex + 1);
    if (!records[selectedIndex]) return false;
    const combobox = item.getByRole('combobox');
    await combobox.click();
    for (let step = 0; step < selectedIndex; step += 1) await combobox.press('ArrowDown');
    await combobox.press('Enter');
    return true;
  }

  if (field.control === 'select') {
    const value = field.enum?.[0];
    if (!value) throw new Error(`Missing enum options for ${field.name}`);
    const combobox = item.getByRole('combobox');
    await combobox.click();
    await combobox.press('ArrowDown');
    await combobox.press('Enter');
    return true;
  }

  if (field.control === 'switch') {
    const control = item.getByRole('switch');
    if ((await control.getAttribute('aria-checked')) !== 'true') await control.click();
    return true;
  }

  if (field.control === 'number') {
    const value = field.name === 'version'
      ? 100 + pass
      : pageId === 'inv-006'
        ? (field.name === 'book_quantity' ? 1 : field.name === 'actual_quantity' ? 2 : 1)
        : (pageId === 'farm-009' && field.name === 'headcount_check')
          || ((pageId === 'farm-010' || pageId === 'farm-012')
            && (field.name === 'quantity' || field.name === 'stock_update'))
          ? 1
          : field.type === 'integer'
            ? 1000 + index
            : 1.25;
    await item.getByRole('spinbutton').fill(String(value));
    return true;
  }

  if (field.control === 'date' || field.control === 'date-time') {
    const value = field.control === 'date'
      ? (field.name === 'production_date' ? '2026-11-01' : '2026-11-15')
      : '2026-11-15 08:30:00';
    const control = item.locator('input').first();
    await control.fill(value);
    await control.press('Tab');
    return true;
  }

  if (field.control === 'json') {
    const value = field.jsonShape === 'array' || field.name === 'elements' ? '[]' : '{"test":true}';
    await item.locator('textarea').first().fill(value);
    return true;
  }

  const pageToken = shortToken(`${pageId}:${runToken}:${attempt}`);
  const base = `E2E ${field.name} ${pageToken}`;
  const value = field.maxLength === null ? base : base.slice(0, field.maxLength);
  if (field.control === 'textarea') {
    await item.locator('textarea').first().fill(value);
  } else {
    await item.getByRole('textbox').first().fill(value);
  }
  return true;
}

async function placeFlockAction(page: Page, batchId: string | number, houseId: string | number): Promise<void> {
  await page.goto('/app/farm-001');
  await expect(page.getByRole('table')).toBeVisible();
  const actionResponse = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/actions'),
  );
  const targetRow = page.locator('.ant-table-row')
    .filter({ has: page.getByRole('cell', { name: String(batchId), exact: true }) })
    .first();
  await targetRow.getByRole('button', { name: /动\s*作/ }).click();
  const actionDrawer = page.getByRole('dialog', { name: '执行业务动作' });
  await expect(actionDrawer).toBeVisible();
  await actionDrawer.getByRole('button', { name: '添加字段' }).click();
  await actionDrawer.getByRole('button', { name: '添加字段' }).click();
  const keys = await actionDrawer.getByLabel('字段名').all();
  const values = await actionDrawer.getByLabel('字段值').all();
  const pairs: [string, string][] = [
    ['action', 'place'],
    ['houseId', String(houseId)],
    ['quantity', '1'],
  ];
  for (const [index, [key, value]] of pairs.entries()) {
    await keys[index]!.fill(key);
    await values[index]!.fill(value);
  }
  await actionDrawer.getByRole('button', { name: /执\s*行/ }).click();
  const response = await actionResponse;
  expect(response.ok(), `Place flock action failed with ${response.status()}`).toBe(true);
  await expect(actionDrawer).toBeHidden();
}

async function ensureTransferPrerequisites(page: Page): Promise<void> {
  const houseSchema = formSchemaFile.pages['farm-003']!;
  let houses = await fetchRecords(page, houseSchema.path, new Map());
  if (houses.length < 2) {
    await createOne(page, 'farm-003', houseSchema, 1, 1);
    houses = await fetchRecords(page, houseSchema.path, new Map());
  }
  const firstHouse = houses[0];
  const houseId = Number(firstHouse?.id);
  if (!Number.isInteger(houseId) || houseId <= 0) throw new Error('Source house not found');
  const batches = await fetchRecords(page, '/api/v1/farm/flock-batches', new Map());
  for (const batch of batches) {
    const batchId = Number(batch?.id);
    if (!Number.isInteger(batchId) || batchId <= 0) throw new Error('Source batch not found');
    const positions = await evaluateFetch(
      page,
      `/api/v1/farm/flock-batches/${encodeURIComponent(String(batchId))}/positions`,
    ) as { data?: { houses?: unknown[] } };
    const hasPosition = Array.isArray(positions.data?.houses) && positions.data.houses.length > 0;
    if (!hasPosition) await placeFlockAction(page, batchId, houseId);
  }
}

async function createOne(
  page: Page,
  pageId: string,
  schema: PageFormSchema,
  pass: number,
  attempt = 0,
): Promise<void> {
  const optionCache = new Map<string, Record<string, unknown>[]>();
  const referenceSelection = new Map<string, number>();
  await page.goto(`/app/${pageId}`);
  await expect(page.getByRole('table')).toBeVisible();

  const responsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' && new URL(response.url()).pathname === schema.path,
    { timeout: 60_000 },
  );
  await page.getByRole('button', { name: /新建/ }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  for (const [index, field] of schema.fields.entries()) {
    const filled = await fillField(
      page,
      dialog,
      field,
      index,
      pass,
      pageId,
      attempt,
      optionCache,
      referenceSelection,
    );
    if (!filled && field.required) throw new Error(`Missing required reference options: ${pageId}.${field.name}`);
  }

  await dialog.getByRole('button', { name: /保\s*存/ }).click();
  const response = await responsePromise;
  if (!response.ok()) {
    throw new Error(
      `POST failed with ${response.status()}: ${await response.text()}; payload=${response.request().postData() ?? 'null'}`,
    );
  }
  await expect(dialog).toBeHidden({ timeout: 30_000 });

  const body = await response.json() as { data?: Record<string, unknown> };
  const created = (body.data ?? body) as Record<string, unknown>;
  const createdId = created.id;
  if (createdId === undefined || createdId === null) throw new Error(`Created record missing id: ${pageId}`);

  const fetchedJson = await evaluateFetch(page, `${schema.path}/${encodeURIComponent(String(createdId))}`) as {
    data?: Record<string, unknown>;
  };
  const fetched = fetchedJson.data ?? (fetchedJson as Record<string, unknown>);
  expect(fetched.id).toBe(createdId);
  if (schema.companyField) {
    if (/^(BIGINT|INTEGER|SMALLINT|NUMERIC)/.test(schema.companyFieldType ?? '')) {
      const companyId = await fetchCurrentCompanyId(page);
      expect(Number(fetched[schema.companyField])).toBe(companyId);
    } else {
      expect(fetched[schema.companyField]).toBe(testData.companyCode);
    }
  }
}

test('桌面端全部创建表单完成真实 POST 创建与 GET 查询', async ({ page }) => {
  test.setTimeout(600_000);
  await login(page, testData.account, testData.password);

  const pageIds = Object.keys(formSchemaFile.pages);
  const orderedPageIds = ['org-001', ...pageIds.filter((pageId) => pageId !== 'org-001')];
  const pending = new Set(orderedPageIds);
  const optionCache = new Map<string, Record<string, unknown>[]>();
  let pass = 0;

  while (pending.size > 0) {
    pass += 1;
    let progressed = false;
    for (const pageId of [...pending]) {
      const schema = formSchemaFile.pages[pageId]!;
      let ready = true;
      for (const field of schema.fields) {
        if (field.required && field.control === 'reference' && field.reference) {
          const records = await fetchRecords(page, field.reference.path, optionCache);
          if (records.length === 0) {
            ready = false;
            break;
          }
        }
      }
      if (!ready) continue;
      if (pageId === 'farm-009') await ensureTransferPrerequisites(page);
      await createOne(page, pageId, schema, pass);
      pending.delete(pageId);
      optionCache.clear();
      progressed = true;
    }
    if (!progressed) {
      throw new Error(`Unresolved create dependencies: ${[...pending].join(', ')}`);
    }
  }
});
