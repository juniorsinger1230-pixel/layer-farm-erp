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
let shippedSalesOrderId: number | undefined;
let consumedReservationId: number | undefined;
let eggCollectionHouseId: number | undefined;
let eggCollectionBatchId: number | undefined;
let livestockSaleBatchId: number | undefined;
let livestockSalesOrderId: number | undefined;
let driverTaskSalesOrderId: number | undefined;
let approvedDisbursementVoucherId: number | undefined;

function recordsFromPayload(payload: unknown): Record<string, unknown>[] {
  const records = Array.isArray(payload)
    ? payload
    : typeof payload === 'object' && payload !== null && Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: unknown[] }).items
      : [];
  return records.filter((record): record is Record<string, unknown> => typeof record === 'object' && record !== null);
}

function shortToken(value: string): string {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(36).padStart(7, '0');
}


async function evaluateFetch(page: Page, url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<unknown> {
  return page.evaluate(async ({ targetUrl, requestInit }) => {
    const rawSession = sessionStorage.getItem('layer-erp-session');
    const session = rawSession ? (JSON.parse(rawSession) as { accessToken?: string }) : {};
    const headers = { ...(session.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {}), ...requestInit?.headers };
    const response = await fetch(targetUrl, { ...requestInit, headers, cache: 'no-store' });
    const json = (await response.json()) as unknown;
    if (!response.ok) throw new Error(`Request failed: ${response.status} ${response.url} ${JSON.stringify(json)}`);
    return json;
  }, { targetUrl: url, requestInit: init });
}

async function fetchRecords(page: Page, path: string, cache: Map<string, Record<string, unknown>[]>): Promise<Record<string, unknown>[]> {
  const cached = cache.get(path);
  if (cached) return cached;
  const json = await evaluateFetch(page, `${path}?page=1&pageSize=200`) as {
    data?: unknown;
    items?: unknown;
  };
  const payload = json.data ?? json;
  const records = recordsFromPayload(payload);
  cache.set(path, records);
  return records;
}

async function fetchCurrentCompanyId(page: Page): Promise<number> {
  const json = await evaluateFetch(page, '/api/v1/org/organizations?page=1&pageSize=200') as {
    data?: unknown;
    items?: unknown;
  };
  const payload = json.data ?? json;
  const records = recordsFromPayload(payload);
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
    const printTemplateTypes = pageId === 'print-002' ? ['delivery', 'delivery_note']
      : pageId === 'print-003' ? ['cash', 'check', 'cash_voucher', 'check_voucher']
      : pageId === 'print-004' ? ['label', 'business', 'business_document'] : null;
    const printTemplate = printTemplateTypes && field.name === 'templateId'
      ? records.find((record) => printTemplateTypes.includes(String(record.template_type).toLowerCase())) : undefined;
    const expectedDeviceModel = pageId === 'print-002' ? 'L3110' : pageId === 'print-003' ? 'LX-310' : 'M421';
    const printDevice = printTemplateTypes && field.name === 'deviceId'
      ? records.find((record) => record.device_status === 'online' && record.device_model === expectedDeviceModel) : undefined;
    const activeDeliveryEmployee = ['log-003', 'log-006'].includes(pageId)
      && ['driver_no', 'courier_no'].includes(field.name)
      ? records.find((record) => record.employment_status === 'active') : undefined;
    const targetId = activeDeliveryEmployee ? Number(activeDeliveryEmployee.id)
      : printTemplate
      ? Number(printTemplate.template_id ?? printTemplate.id)
      : printDevice ? Number(printDevice.id)
      : pageId === 'fin-010' && ['voucher_id', 'voucherId'].includes(field.name)
      ? approvedDisbursementVoucherId
      : pageId === 'sales-006' && field.name === 'sales_order_id'
      ? shippedSalesOrderId
      : pageId === 'log-003' && field.name === 'order_id'
      ? livestockSalesOrderId
      : pageId === 'log-006' && field.name === 'order_id'
      ? driverTaskSalesOrderId
      : pageId === 'sales-006' && field.name === 'original_reservation_id'
        ? consumedReservationId
        : pageId === 'farm-011' && field.name === 'batchId'
          ? eggCollectionBatchId
        : pageId === 'farm-011' && field.name === 'houseId'
          ? eggCollectionHouseId
        : undefined;
    if (targetId !== undefined) {
      const targetIndex = records.findIndex((record) => Number(record.id) === targetId);
      if (targetIndex < 0) return false;
      const combobox = item.getByRole('combobox');
      await combobox.click();
      for (let step = 0; step < targetIndex; step += 1) await combobox.press('ArrowDown');
      await combobox.press('Enter');
      return true;
    }
    const reuseWarehouseLocation = (pageId === 'farm-011' || pageId === 'proc-005')
      && ['warehouseId', 'locationId', 'warehouse_id', 'location_id'].includes(field.name);
    const optionIndex = reuseWarehouseLocation ? 0 : referenceSelection.get(field.reference.path) ?? 0;
    const selectedIndex = pageId === 'farm-012' && field.name === 'batch_id' ? 1 : optionIndex % records.length;
    if (!reuseWarehouseLocation) referenceSelection.set(field.reference.path, optionIndex + 1);
    if (!records[selectedIndex]) return false;
    const combobox = item.getByRole('combobox');
    await item.locator('.ant-select-selector').click();
    for (let step = 0; step < selectedIndex; step += 1) await combobox.press('ArrowDown');
    await combobox.press('Enter');
    return true;
  }

  if (field.control === 'select') {
    const value = pageId === 'fin-009' && field.name === 'approval_status' ? 'approved'
      : pageId === 'proc-004' && field.name === 'quality_status' ? 'accepted'
      : pageId === 'print-006' && field.name === 'device_status' ? 'online' : field.enum?.[0];
    if (!value) throw new Error(`Missing enum options for ${field.name}`);
    const optionIndex = field.enum?.indexOf(value) ?? 0;
    const combobox = item.getByRole('combobox');
    await item.locator('.ant-select-selector').click();
    for (let step = 0; step < optionIndex; step += 1) await combobox.press('ArrowDown');
    await combobox.press('Enter');
    return true;
  }

  if (field.control === 'switch') {
    const control = item.getByRole('switch');
    const desired = !(pageId === 'vet-005' && field.name === 'executed');
    if ((await control.getAttribute('aria-checked')) !== String(desired)) await control.click();
    return true;
  }

  if (field.control === 'number') {
    if (['print-002', 'print-003', 'print-004'].includes(pageId) && field.name === 'designVersion') return true;
    if (pageId === 'sales-007' && field.name === 'flock_batch_id') {
      if (livestockSaleBatchId === undefined) throw new Error('Missing livestock sale batch');
      await item.getByRole('spinbutton').fill(String(livestockSaleBatchId));
      return true;
    }
    if (pageId === 'sales-007' && field.name === 'quantity') {
      await item.getByRole('spinbutton').fill('1');
      return true;
    }

    if (pageId === 'sales-006' && field.name === 'original_reservation_id') {
      if (consumedReservationId === undefined) throw new Error('Missing consumed reservation id');
      await item.getByRole('spinbutton').fill(String(consumedReservationId));
      return true;
    }

    if (pageId === 'sales-006' && field.name === 'quantity') {
      await item.getByRole('spinbutton').fill('1');
      return true;
    }
    if (pageId === 'proc-005' && field.name === 'quantity') {
      await item.getByRole('spinbutton').fill('0.25');
      return true;
    }
    if (pageId === 'fin-010' && ['checkAmount', 'writeoff'].includes(field.name)) {
      await item.getByRole('spinbutton').fill(field.name === 'checkAmount' ? '1' : '0');
      return true;
    }
    if (pageId === 'fin-010' && field.name === 'voucherId') {
      if (approvedDisbursementVoucherId === undefined) throw new Error('Missing approved voucher id');
      await item.getByRole('spinbutton').fill(String(approvedDisbursementVoucherId));
      return true;
    }
    if (pageId === 'fin-010' && field.name === 'cashierId') {
      await item.getByRole('spinbutton').fill('1');
      return true;
    }

    const value = pageId === 'fin-009' && field.name === 'withholding_tax_amount'
      ? 0
      : pageId === 'farm-011' && ['goodEggs', 'brokenEggs', 'dirtyEggs'].includes(field.name)
      ? (field.name === 'goodEggs' ? 1 : 0)
      : pageId === 'print-005' && field.name === 'print_by'
      ? 1
      : pageId === 'farm-011' && ['goodEggs', 'brokenEggs', 'dirtyEggs'].includes(field.name)
        ? (field.name === 'goodEggs' ? 1 : 0)
      : field.name === 'version'
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
    const value = pageId === 'print-001' && field.name === 'elements'
      ? JSON.stringify([{ id: 'e2e-title', type: 'text', xMm: 0, yMm: 0, widthMm: 1, heightMm: 1, content: 'E2E', fontSizePt: 4 }])
      : ['print-002', 'print-003', 'print-004'].includes(pageId) && field.name === 'lines' ? '["E2E print document"]'
      : pageId === 'farm-011' && field.name === 'gradeDetail' ? '{"large":1}'
      : field.jsonShape === 'array' || field.name === 'elements' ? '[]' : '{"test":true}';
    await item.locator('textarea').first().fill(value);
    return true;
  }

  const pageToken = shortToken(`${pageId}:${runToken}:${attempt}`);
  const base = pageId === 'sales-007' && field.name === 'sale_type' ? 'cull'
    : pageId === 'print-006' && field.name === 'device_brand' ? 'Gprinter'
    : pageId === 'print-006' && field.name === 'device_model' ? 'M421'
    : pageId === 'print-006' && field.name === 'supported_paper' ? '80x60'
    : pageId === 'print-006' && field.name === 'device_status' ? 'online'
    : pageId === 'print-005' && field.name === 'void_status' ? 'valid'
    : pageId === 'farm-011' && field.name === 'collectionNo' ? `E2E-${runToken}-${attempt}`
    : `E2E ${field.name} ${pageToken}`;
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

async function ensureLivestockSalePrerequisites(page: Page): Promise<void> {
  const batch = await createOne(page, 'farm-001', formSchemaFile.pages['farm-001']!, 1, 2);
  livestockSaleBatchId = Number(batch.id);
  const houseRecords = await fetchRecords(page, '/api/v1/farm/houses-and-pens', new Map());
  const houseId = Number(houseRecords[0]?.id);
  if (!Number.isInteger(livestockSaleBatchId) || livestockSaleBatchId <= 0 || !Number.isInteger(houseId) || houseId <= 0) {
    throw new Error('Livestock sale prerequisites not found');
  }
  await placeFlockAction(page, livestockSaleBatchId, houseId);
}

async function ensureEggCollectionPrerequisites(page: Page): Promise<void> {
  const batch = await createOne(page, 'farm-001', formSchemaFile.pages['farm-001']!, 1, 1);
  eggCollectionBatchId = Number(batch.id);
  const houseRecords = await fetchRecords(page, '/api/v1/farm/houses-and-pens', new Map());
  const houseId = Number(houseRecords[0]?.id);
  if (!Number.isInteger(eggCollectionBatchId) || eggCollectionBatchId <= 0 || !Number.isInteger(houseId) || houseId <= 0) {
    throw new Error('Egg collection prerequisites not found');
  }
  await placeFlockAction(page, eggCollectionBatchId, houseId);
  eggCollectionHouseId = houseId;
}

async function createOne(
  page: Page,
  pageId: string,
  schema: PageFormSchema,
  pass: number,
  attempt = 0,
): Promise<Record<string, unknown>> {
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
      `POST ${pageId} ${schema.path} failed with ${response.status()}: ${await response.text()}; payload=${response.request().postData() ?? 'null'}`,
    );
  }
  await expect(dialog).toBeHidden({ timeout: 30_000 });

  const body = await response.json() as { data?: Record<string, unknown> & { task?: Record<string, unknown> } };
  const payload = (body.data ?? body) as Record<string, unknown> & { task?: Record<string, unknown> };
  const created = ['log-003', 'log-006'].includes(pageId) && payload.task ? payload.task : payload;
  const itemKey = pageId === 'fin-007' ? 'batch_id' : pageId === 'plat-001' ? 'session_id' : 'id';
  const createdId = created[itemKey];
  if (typeof createdId !== 'string' && typeof createdId !== 'number') throw new Error(`Created record missing id: ${pageId}`);

  if (pageId === 'org-001') {
    const directory = await evaluateFetch(page, '/api/v1/auth/companies') as { data?: Array<Record<string, unknown>> };
    const companies = directory.data ?? [];
    const fetched = companies.find((company) => company.company_code === created.company_code);
    expect(fetched?.company_code).toBe(created.company_code);
    return fetched!;
  }

  const fetchedJson = await evaluateFetch(page, `${schema.path}/${encodeURIComponent(String(createdId))}`) as {
    data?: Record<string, unknown>;
  };
  const fetched: Record<string, unknown> = fetchedJson.data ?? fetchedJson;
  expect(fetched[itemKey]).toBe(createdId);
  if (schema.companyField) {
    if (/^(BIGINT|INTEGER|SMALLINT|NUMERIC)/.test(schema.companyFieldType ?? '')) {
      const companyId = await fetchCurrentCompanyId(page);
      expect(Number(fetched[schema.companyField])).toBe(companyId);
    } else {
      expect(fetched[schema.companyField]).toBe(testData.companyCode);
    }
  }
  return fetched;
}

async function salesOrderAction(page: Page, orderId: number, action: string, lines?: unknown[]): Promise<unknown> {
  return evaluateFetch(page, `/api/v1/sales/sales-orders/${orderId}/actions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': `create-e2e-${action}-${orderId}-${Date.now()}` },
    body: JSON.stringify(lines ? { action, lines } : { action }),
  });
}

async function prepareInventoryReceipt(page: Page, goodsReceiptId: number, warehouseId: number, locationId: number): Promise<void> {
  await evaluateFetch(page, `/api/v1/proc/receipt-inspections/${goodsReceiptId}/actions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': `create-e2e-receive-${goodsReceiptId}-${Date.now()}` },
    body: JSON.stringify({
      action: 'receive',
      warehouseId,
      locationId,
      batchNo: 'E2E-STOCK',
      productionDate: '2026-11-01',
      expiryDate: '2027-11-01',
      unitCost: 1.25,
    }),
  });
}

async function ensureDriverTaskPrerequisites(page: Page): Promise<void> {
  const order = await createOne(page, 'sales-003', formSchemaFile.pages['sales-003']!, 1, 3);
  const orderId = Number(order.id);
  if (!Number.isInteger(orderId) || orderId <= 0) throw new Error('Driver task sales order not found');
  await salesOrderAction(page, orderId, 'submit');
  await salesOrderAction(page, orderId, 'approve');
  await salesOrderAction(page, orderId, 'allocate', [{ materialId: 1, quantity: 1, unitPrice: 2.5, uom: 'kg' }]);
  await salesOrderAction(page, orderId, 'ship');
  driverTaskSalesOrderId = orderId;
}

async function prepareSalesReturn(page: Page, orderId: number): Promise<void> {
  await salesOrderAction(page, orderId, 'submit');
  await salesOrderAction(page, orderId, 'approve');
  await salesOrderAction(page, orderId, 'allocate', [{ materialId: 1, quantity: 1, unitPrice: 2.5, uom: 'kg' }]);
  const shipment = await salesOrderAction(page, orderId, 'ship') as { data?: { consumedReservationIds?: unknown[] } };
  shippedSalesOrderId = orderId;
  const consumedIds = shipment.data?.consumedReservationIds;
  if (!Array.isArray(consumedIds) || consumedIds.length !== 1) throw new Error(`No consumed reservation found for sales order ${orderId}`);
  consumedReservationId = Number(consumedIds[0]);
}

test('桌面端全部创建表单完成真实 POST 创建与 GET 查询', async ({ page }) => {
  test.setTimeout(600_000);
  await login(page, testData.account, testData.password);

  const pageIds = Object.keys(formSchemaFile.pages);
  const prerequisitePageIds = ['org-001', 'proc-001', 'proc-002', 'proc-003', 'inv-005', 'proc-004', 'proc-005'];
  const orderedPageIds = [...prerequisitePageIds, ...pageIds.filter((pageId) => !prerequisitePageIds.includes(pageId))];
  const pending = new Set(orderedPageIds);
  const optionCache = new Map<string, Record<string, unknown>[]>();
  let pass = 0;
  let createdLocationId: number | undefined;

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
      if (pageId === 'sales-003' && pending.has('proc-004')) continue;
      if (pageId === 'farm-009') await ensureTransferPrerequisites(page);
      if (pageId === 'farm-011') await ensureEggCollectionPrerequisites(page);
      if (pageId === 'sales-007') await ensureLivestockSalePrerequisites(page);
      if (pageId === 'log-006') await ensureDriverTaskPrerequisites(page);
      const created = await createOne(page, pageId, schema, pass);
      if (pageId === 'fin-009') approvedDisbursementVoucherId = Number(created.id);
      if (pageId === 'inv-005') createdLocationId = Number(created.id);
      if (pageId === 'proc-004') {
        if (createdLocationId === undefined) throw new Error('Missing UI-created warehouse/location');
        await prepareInventoryReceipt(page, Number(created.id), createdLocationId, createdLocationId);
      }
      if (pageId === 'sales-003') await prepareSalesReturn(page, Number(created.id));
      if (pageId === 'sales-007') livestockSalesOrderId = Number(created.sales_order_id);
      pending.delete(pageId);
      optionCache.clear();
      progressed = true;
    }
    if (!progressed) {
      throw new Error(`Unresolved create dependencies: ${[...pending].join(', ')}`);
    }
  }
});
