import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  createRecord,
  executeAction,
  findItem,
  listItems,
  login,
  openMenu,
} from './helpers.js';

const testData = JSON.parse(readFileSync(new URL('./test-data.json', import.meta.url), 'utf8')) as {
  companyCode: string;
  account: string;
  password: string;
  mfaSecret: string;
};
const runtimeData = JSON.parse(readFileSync(new URL('./runtime-data.json', import.meta.url), 'utf8')) as {
  companyId: number;
  printTemplateId: number;
};

type IdRow = { id: number };
type CodeRow = IdRow & Record<string, unknown>;
type ReceivableRow = IdRow & { order_id: number; receivable_balance: string };
type PayableRow = IdRow & { goods_receipt_id: number; payable_balance: string };
type PositionRow = IdRow & { material_id: number; on_hand: string };

const runId = Date.now().toString(36).toUpperCase();
const materialCode = `M${runId}`;
const locationCode = `W${runId}`;
const houseCode = `H${runId}`;
const supplierCode = `S${runId}`;
const purchaseOrderNo = `PO${runId}`;
const receiptNo = `GR${runId}`;
const receivedBatchNo = `LOT${runId}`;
const batchNo = `B${runId}`;
const eggCollectionNo = `EGG${runId}`;
const priceCode = `PL${runId}`;
const customerCode = `C${runId}`;
const salesOrderNo = `SO${runId}`;

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await login(page, testData.account, testData.password, testData.mfaSecret);
});

test('浏览器端完成采购入库、生产集蛋、销售出库、财务留痕与打印设计闭环', async ({ page }) => {
  await openMenu(page, '物料主数据');
  await createRecord(page, '新建物料', [
    ['material_code', materialCode],
    ['material_name', 'E2E Shell Egg'],
    ['category', 'egg'],
    ['pack_uom', 'tray'],
    ['uom', 'piece'],
    ['company_code', testData.companyCode],
  ]);
  const material = await findItem<CodeRow>(page, '/api/v1/inv/materials', (item: CodeRow) => item.material_code === materialCode);

  await openMenu(page, '仓库与库位');
  await createRecord(page, '新建库位', [
    ['warehouse_code', locationCode],
    ['warehouse_name', 'E2E Cold Warehouse'],
    ['location_code', `${locationCode}-L`],
    ['company_code', runtimeData.companyId],
  ]);
  const location = await findItem<CodeRow>(page, '/api/v1/inv/stock-locations', (item: CodeRow) => item.warehouse_code === locationCode);

  await openMenu(page, '栋舍与栏位');
  await createRecord(page, '新建栋舍', [
    ['house_code', houseCode],
    ['house_name', 'E2E Layer House'],
    ['pen_count', 10],
    ['floor_count', 1],
    ['farm_mode', 'cage'],
    ['company_code', runtimeData.companyId],
    ['house_status', 'active'],
  ]);
  const house = await findItem<CodeRow>(page, '/api/v1/farm/houses-and-pens', (item: CodeRow) => item.house_code === houseCode);

  await openMenu(page, '供应商主数据');
  await createRecord(page, '新建供应商', [
    ['supplier_code', supplierCode],
    ['supplier_name', 'E2E Egg Supplier'],
    ['material_id', material.id],
    ['contact_person', 'E2E Contact'],
    ['qualification', 'BIR and FDA qualified'],
    ['brand', 'E2E Brand'],
    ['status', 'active'],
    ['company_code', testData.companyCode],
  ]);
  const supplier = await findItem<CodeRow>(page, '/api/v1/proc/suppliers', (item: CodeRow) => item.supplier_code === supplierCode);

  await openMenu(page, '采购与 MRP');
  await createRecord(page, '新建采购订单', [
    ['order_no', purchaseOrderNo],
    ['supplier_id', supplier.id],
    ['material_id', material.id],
    ['quantity', 100],
    ['price', 12],
    ['execution_close', 'draft'],
    ['company_code', testData.companyCode],
  ]);
  const purchaseOrder = await findItem<CodeRow>(page, '/api/v1/proc/purchase-orders', (item: CodeRow) => item.order_no === purchaseOrderNo);
  await executeAction(page, purchaseOrderNo, [['action', 'approve']]);
  await executeAction(page, purchaseOrderNo, [['action', 'open']]);

  await openMenu(page, '收货检验');
  await createRecord(page, '新建收货单', [
    ['receipt_no', receiptNo],
    ['order_id', purchaseOrder.id],
    ['quantity', 100],
    ['quality_status', 'accepted'],
    ['company_code', testData.companyCode],
  ]);
  const receipt = await findItem<CodeRow>(page, '/api/v1/proc/receipt-inspections', (item: CodeRow) => item.receipt_no === receiptNo);
  await executeAction(page, receiptNo, [
    ['action', 'receive'],
    ['batchNo', receivedBatchNo],
    ['warehouseId', location.id],
    ['locationId', location.id],
    ['productionDate', '2026-09-01'],
    ['expiryDate', '2027-01-10'],
    ['unitCost', 12],
  ]);

  await openMenu(page, '鸡群与生产');
  await createRecord(page, '新建鸡苗批次', [
    ['batch_no', batchNo],
    ['breed', 'Lohmann Pink'],
    ['source', 'E2E pullet delivery'],
    ['chick_date', '2026-07-27'],
    ['initial_quantity', 1000],
    ['day_age', 120],
    ['stage', 'laying'],
    ['company_code', testData.companyCode],
  ]);
  const flockBatch = await findItem<CodeRow>(page, '/api/v1/farm/flock-batches', (item: CodeRow) => item.batch_no === batchNo);
  await executeAction(page, batchNo, [
    ['action', 'place'],
    ['houseId', house.id],
    ['quantity', 1000],
  ]);

  await openMenu(page, '集蛋分级');
  await createRecord(page, '新建记录', [
    ['collectionNo', eggCollectionNo],
    ['batchId', flockBatch.id],
    ['houseId', house.id],
    ['materialId', material.id],
    ['warehouseId', location.id],
    ['locationId', location.id],
    ['collectionDate', '2026-11-24'],
    ['shift', 'day'],
    ['goodEggs', 800],
    ['brokenEggs', 5],
    ['dirtyEggs', 2],
    ['gradeDetail', '{"small":100,"medium":300,"large":300,"extra_large":100}'],
    ['deviceRef', 'MOBA-E2E'],
  ]);
  const eggCollection = await findItem<CodeRow>(page, '/api/v1/farm/egg-collection-grading', (item: CodeRow) => item.collection_no === eggCollectionNo);
  expect(Number(eggCollection.good_eggs)).toBe(800);

  await openMenu(page, '价格目录');
  await createRecord(page, '新建价格', [
    ['price_list_code', priceCode],
    ['price_type', 'standard'],
    ['product_name', 'E2E Shell Egg Price'],
    ['price', 30],
    ['effective_date', '2026-01-01'],
    ['company_code', testData.companyCode],
  ]);
  const price = await findItem<CodeRow>(page, '/api/v1/sales/price-lists', (item: CodeRow) => item.price_list_code === priceCode);

  await openMenu(page, '客户主数据');
  await createRecord(page, '新建客户', [
    ['customer_code', customerCode],
    ['customer_name', 'E2E Manila Customer'],
    ['address', 'E2E Manila Address'],
    ['payment_term', 30],
    ['credit_ref', 0],
    ['price_id', price.id],
    ['status', 'active'],
    ['company_code', testData.companyCode],
  ]);
  const customer = await findItem<CodeRow>(page, '/api/v1/sales/customers', (item: CodeRow) => item.customer_code === customerCode);

  await openMenu(page, '信用额度');
  await createRecord(page, '新建信用额度', [
    ['customer_id', customer.id],
    ['credit_amount', 10000],
    ['occupied_amount', 0],
    ['over_limit_block', true],
    ['manual_adjust', false],
    ['ceo_approval', 'not_required'],
    ['company_code', testData.companyCode],
  ]);

  await openMenu(page, '销售与配送');
  await createRecord(page, '新建销售订单', [
    ['order_no', salesOrderNo],
    ['customer_id', customer.id],
    ['order_mode', 'standard'],
    ['inventory_quantity', 10],
    ['status', 'draft'],
    ['company_code', testData.companyCode],
  ]);
  const salesOrder = await findItem<CodeRow>(page, '/api/v1/sales/sales-orders', (item: CodeRow) => item.order_no === salesOrderNo);
  await executeAction(page, salesOrderNo, [['action', 'submit']]);
  await executeAction(page, salesOrderNo, [['action', 'approve']]);
  await executeAction(page, salesOrderNo, [
    ['action', 'allocate'],
    ['lines', `[{"materialId":${material.id},"quantity":10,"uom":"egg","unitPrice":30}]`],
  ]);
  await executeAction(page, salesOrderNo, [['action', 'ship']]);
  const shippedOrder = await findItem<CodeRow>(page, '/api/v1/sales/sales-orders', (item: CodeRow) => item.id === salesOrder.id);
  expect(shippedOrder.status).toBe('shipped');

  const receivable = await findItem<ReceivableRow>(page, '/api/v1/fin/receivables', (item: ReceivableRow) => item.order_id === salesOrder.id);
  expect(receivable.receivable_balance).toBe('300.00');
  const payable = await findItem<PayableRow>(page, '/api/v1/fin/payables', (item: PayableRow) => item.goods_receipt_id === receipt.id);
  expect(payable.payable_balance).toBe('1200.00');

  const positions = await listItems<PositionRow>(page, '/api/v1/inv/stock-positions');
  const materialQuantity = positions
    .filter((item: PositionRow) => item.material_id === material.id)
    .reduce((sum: number, item: PositionRow) => sum + Number(item.on_hand), 0);
  expect(materialQuantity).toBe(890);

  await openMenu(page, '打印与附件');
  const designer = page.getByText('拖拽式打印设计器').locator('xpath=ancestor::div[contains(@class,"ant-card")]');
  await designer.locator('input').first().fill(String(runtimeData.printTemplateId));
  await designer.getByRole('button', { name: '添加元素' }).click();
  await designer.getByRole('button', { name: '保存并发布' }).click();
  await expect(page.getByText('设计已发布，可用于真实打印任务')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    designer.getByRole('button', { name: 'PDF 预览' }).click(),
  ]);
  expect(download.suggestedFilename()).toContain('preview.pdf');
});
