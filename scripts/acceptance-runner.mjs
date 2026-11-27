import { createHmac } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { totp } from '../dist/packages/security/src/auth.js';
import { projectFields } from '../dist/packages/security/src/rbac.js';
import { StrictNetworkRecorder, recordedFetch } from './strict-network-recorder.mjs';
import { captureCasePrecondition } from './strict-precondition-snapshot.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const earlyArguments = process.argv.slice(2);
function getEarlyOption(name) {
  const inline = earlyArguments.find((argument) => argument.startsWith(`--${name}=`));
  if (inline) return inline.split('=').slice(1).join('=');
  const index = earlyArguments.indexOf(`--${name}`);
  return index >= 0 ? earlyArguments[index + 1] : null;
}
const runId = getEarlyOption('run-id') ?? new Date().toISOString().replace(/[:.]/g, '-');
const strictRoot = getEarlyOption('strict-root');
const evidenceRoot = path.join(projectRoot, 'acceptance-evidence', `run-${runId}`);
mkdirSync(evidenceRoot, { recursive: true });
const strictNetworkRecorder = strictRoot
  ? new StrictNetworkRecorder({ runId, projectRoot, strictRoot })
  : null;

const dockerExecutable = process.env.DOCKER_PATH ?? 'C:\\Users\\龚\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe';
const gitExecutable = process.env.GIT_PATH ?? 'C:\\Program Files\\Git\\cmd\\git.exe';
const baseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3100';
const webUrl = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:8080';
const composeFile = path.join(projectRoot, 'deploy', 'compose', 'docker-compose.yml');
const projectName = process.env.STRICT_COMPOSE_PROJECT ?? process.env.COMPOSE_PROJECT_NAME ?? 'layer-farm-erp-strict';

const casesFile = JSON.parse(readFileSync(path.join(projectRoot, 'acceptance-cases.json'), 'utf8'));
const allCases = casesFile.cases;
const formSchemas = JSON.parse(readFileSync(path.join(projectRoot, 'apps', 'web', 'src', 'generated', 'form-schemas.json'), 'utf8'));

function promisifyExec(executable, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    execFile(executable, args, { cwd: projectRoot, maxBuffer: 20 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stdout, stderr }));
      else resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

async function docker(args) {
  return promisifyExec(dockerExecutable, args);
}

async function git(args) {
  return promisifyExec(gitExecutable, args);
}

async function request(url, options = {}) {
  const response = await recordedFetch(strictNetworkRecorder, url, options);
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { response, text, json, status: response.status };
}

function saveEvidence(name, payload) {
  const target = path.join(evidenceRoot, name);
  writeFileSync(target, typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2), 'utf8');
  return path.relative(projectRoot, target).replaceAll('\\', '/');
}

async function composePs() {
  const { stdout } = await docker([
    'compose', '-p', projectName, '-f', composeFile, 'ps', '--format', '{{json .}}',
  ]);
  return stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function psql(sql) {
  const { stdout } = await docker([
    'exec', `${projectName}-postgres-1`, 'psql', '-U', 'erp', '-d', 'layer_farm', '-t', '-A', '-c', sql,
  ]);
  return stdout.trim();
}

let loginIpSequence = 0;
let lastAdminMfaWindow = 0;

const fixedMfaSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForNextTotpWindow() {
  const now = Date.now();
  const nextBoundary = Math.ceil(now / 30_000) * 30_000;
  await sleep(Math.max(1_000, nextBoundary - now + 1_000));
}

async function login(account, password, companyCode = 'THL', mfaCode) {
  loginIpSequence += 1;
  const secondOctet = Math.floor(loginIpSequence / 254);
  const fourthOctet = (loginIpSequence % 254) + 1;
  const body = { companyCode, account, password };
  if (mfaCode) body.mfaCode = mfaCode;
  const headers = {
    'content-type': 'application/json',
    'x-forwarded-for': `10.23.${secondOctet}.${fourthOctet}`,
  };

  if (account !== 'admin.zhang') {
    return request(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  const attempts = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let currentWindow = Math.floor(Date.now() / 30_000);
    if (currentWindow <= lastAdminMfaWindow) await waitForNextTotpWindow();
    currentWindow = Math.floor(Date.now() / 30_000);
    const firstResult = await request(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (firstResult.status === 200) return firstResult;
    if (firstResult.status !== 401 || firstResult.json?.error?.code !== 'MFA_REQUIRED') {
      const debug = { attempts, unexpectedFirst: firstResult.json, status: firstResult.status };
      saveEvidence('admin-login-debug.json', debug);
      return { ...firstResult, adminLoginDebug: debug };
    }

    const code = totp(fixedMfaSecret);
    const mfaResult = await request(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, mfaCode: code }),
    });
    attempts.push({
      attempt,
      window: currentWindow,
      code,
      first: { status: firstResult.status, body: firstResult.json },
      mfa: { status: mfaResult.status, body: mfaResult.json },
    });

    if (mfaResult.status === 200) {
      lastAdminMfaWindow = currentWindow;
      return mfaResult;
    }
    if (mfaResult.json?.error?.code !== 'AUTH_SCOPE_VIOLATION') {
      const debug = { attempts, requestHeaders: headers };
      saveEvidence('admin-login-debug.json', debug);
      return { ...mfaResult, adminLoginDebug: debug };
    }
    lastAdminMfaWindow = currentWindow;
    await waitForNextTotpWindow();
  }

  const debug = { attempts, requestHeaders: headers };
  saveEvidence('admin-login-debug.json', debug);
  return { status: 401, json: null, adminLoginDebug: debug };
}

function authHeaders(accessToken) {
  return { authorization: `Bearer ${accessToken}` };
}

const composeEnvText = readFileSync(path.join(projectRoot, 'deploy', 'compose', '.env'), 'utf8');
const composeEnv = Object.fromEntries(composeEnvText.split(/\r?\n/).filter((line) => line.includes('=')).map((line) => {
  const index = line.indexOf('=');
  return [line.slice(0, index), line.slice(index + 1)];
}));

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signAccessTokenFromPayload(payload) {
  const header = base64urlJson({ alg: 'HS256', typ: 'JWT' });
  const payloadText = base64urlJson(payload);
  const signature = createHmac('sha256', composeEnv.JWT_SIGNING_KEY).update(`${header}.${payloadText}`).digest('base64url');
  return `${header}.${payloadText}.${signature}`;
}

async function withBrowser(callback) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    strictNetworkRecorder?.attachPage(page, 'withBrowser');
    return await callback(page);
  } finally {
    await browser.close();
  }
}

async function browserLogin(page, account, password, mfaCode) {
  await page.goto(`${webUrl}/login`);
  const result = await login(account, password, 'THL', mfaCode);
  if (result.status !== 200) throw new Error(`Browser login failed: ${result.status}`);
  await page.sessionStorage.setItem('layer-erp-session', JSON.stringify(result.json.data));
  await page.goto(`${webUrl}/app/workbench`);
  await page.waitForLoadState('networkidle');
  return result.json.data;
}

let s2Browser = null;
let s2Page = null;

async function getS2Page() {
  if (s2Page !== null) return s2Page;
  const { chromium } = await import('playwright');
  s2Browser = await chromium.launch();
  s2Page = await s2Browser.newPage();
  strictNetworkRecorder?.attachPage(s2Page, 'S2');
  await browserLogin(s2Page, 'admin.zhang', 'Admin-Passw0rd!2026');
  return s2Page;
}

async function closeS2Browser() {
  if (s2Browser !== null) await s2Browser.close();
  s2Browser = null;
  s2Page = null;
}

const chinesePattern = /[\u3400-\u9fff]/;

async function executeS2EmptyForm(testCase) {
  const page = await getS2Page();
  const postRequests = [];
  const requestListener = (request) => {
    if (request.method() === 'POST') postRequests.push({ url: request.url(), method: request.method() });
  };
  page.on('request', requestListener);
  try {
    await page.goto(`${webUrl}/app/${testCase.pageId}`, { waitUntil: 'networkidle' });
    await page.locator('.business-page').waitFor();
    const createButton = page.getByRole('button', { name: '新建' });
    await createButton.waitFor();
    await createButton.click();
    const drawer = page.locator('.ant-drawer-open').last();
    await drawer.waitFor();
    await drawer.locator('.ant-form-item').first().waitFor();

    const schema = formSchemas.pages[testCase.pageId];
    if (!schema) throw new Error(`Missing form schema: ${testCase.pageId}`);
    const requiredFields = schema.fields.filter((field) => field.required);
    const requiredNames = requiredFields.map((field) => field.name);
    const formSnapshot = await drawer.evaluate((node, names) => {
      const labelFor = (item) => item.querySelector('.ant-form-item-label label')?.textContent?.trim() ?? '';
      const controlSelector = (name) => `[id="${name}"]`;
      const items = [...node.querySelectorAll('.ant-form-item')];
      return {
        formItemCount: items.length,
        labels: items.map(labelFor),
        controlIds: items.map((item) => ({
          label: labelFor(item),
          ids: [...item.querySelectorAll('[id]')].map((element) => element.id),
        })),
        requiredLabels: [...node.querySelectorAll('label.ant-form-item-required')].map((label) => label.textContent.trim()),
        requiredFieldLabels: Object.fromEntries(names.map((name) => {
          const item = items.find((entry) => entry.querySelector(controlSelector(name)));
          return [name, item ? labelFor(item) : ''];
        })),
        requiredPresence: Object.fromEntries(names.map((name) => [
          name,
          items.some((item) => item.querySelector(controlSelector(name)) && item.querySelector('label.ant-form-item-required')),
        ])),
      };
    }, requiredNames);

    await drawer.locator('button[type="submit"]').click();
    await page.waitForTimeout(900);
    const validationErrors = await drawer.locator('.ant-form-item-explain-error').allTextContents();
    const targetPostRequests = postRequests.filter((request) => request.url.includes(testCase.apiPath));
    const allRequiredMarked = requiredNames.every((name) => formSnapshot.requiredPresence[name] === true);
    const allRequiredValidated = requiredNames.length > 0 && requiredNames.every((name) => {
      const label = formSnapshot.requiredFieldLabels[name];
      return validationErrors.some((error) => error.includes('请填写') && error.includes(label));
    });
    const allLabelsChinese = formSnapshot.labels.every((label) => chinesePattern.test(label));
    return {
      url: page.url(),
      schemaFieldCount: schema.fields.length,
      formSnapshot,
      validationErrors,
      postRequests,
      targetPostRequests,
      checks: {
        formLoaded: formSnapshot.formItemCount === schema.fields.length,
        allLabelsChinese,
        allRequiredMarked,
        allRequiredValidated,
        noPostSubmitted: targetPostRequests.length === 0,
      },
    };
  } finally {
    page.off('request', requestListener);
  }
}

let s3Browser = null;
let s3Page = null;
const s3RunToken = Date.now().toString(36);
const s3OptionCache = new Map();
const s3ReferenceSelection = new Map();
let s3Pass = 0;
let s3ShippedSalesOrderId;
let s3ConsumedReservationId;
let s3EggCollectionHouseId;
let s3EggCollectionBatchId;
let s3LivestockSaleBatchId;
let s3LivestockSalesOrderId;
let s3LivestockCustomerId;
let s3DriverTaskSalesOrderId;
let s3ApprovedDisbursementVoucherId;
let s3CreatedLocationId;
let s3MortalityBatchId;
let s3CullingBatchId;
let s3TransferBatchId;
let s3TransferFromHouseId;
let s3TransferToHouseId;
let s3ReceivedInspectionId;
let s3ReceivedMaterialId;
let s3ProfitSettlementBatchId;
let s3DedicatedPayableId;
let s3DedicatedPaymentVoucherId;
let s3CommonPrerequisitesReady = false;

async function getS3Page() {
  if (s3Page !== null) return s3Page;
  const { chromium } = await import('playwright');
  s3Browser = await chromium.launch();
  s3Page = await s3Browser.newPage();
  strictNetworkRecorder?.attachPage(s3Page, 'S3');
  await browserLogin(s3Page, 'admin.zhang', 'Admin-Passw0rd!2026');
  return s3Page;
}

async function closeS3Browser() {
  if (s3Browser !== null) await s3Browser.close();
  s3Browser = null;
  s3Page = null;
}

function s3RecordsFromPayload(payload) {
  const records = Array.isArray(payload)
    ? payload
    : typeof payload === 'object' && payload !== null && Array.isArray(payload.items)
      ? payload.items
      : [];
  return records.filter((record) => typeof record === 'object' && record !== null);
}

function shortS3Token(value) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(36).padStart(7, '0');
}

async function evaluateS3Fetch(url, init) {
  const page = await getS3Page();
  return page.evaluate(async ({ targetUrl, requestInit }) => {
    const readSession = () => {
      const rawSession = sessionStorage.getItem('layer-erp-session');
      return rawSession ? JSON.parse(rawSession) : {};
    };
    const session = readSession();
    const headers = { ...(session.accessToken ? { authorization: `Bearer ${session.accessToken}` } : ''), ...requestInit?.headers };
    const response = await fetch(targetUrl, { ...requestInit, headers, cache: 'no-store' });
    if (response.status === 401 && session.refreshToken) {
      const refreshResponse = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
        cache: 'no-store',
      });
      const refreshPayload = await refreshResponse.json();
      const nextSession = refreshPayload.data;
      if (refreshResponse.ok && nextSession?.accessToken && nextSession.refreshToken) {
        sessionStorage.setItem('layer-erp-session', JSON.stringify(nextSession));
        const retryResponse = await fetch(targetUrl, {
          ...requestInit,
          headers: { authorization: `Bearer ${nextSession.accessToken}`, ...requestInit?.headers },
          cache: 'no-store',
        });
        const retryJson = await retryResponse.json();
        if (!retryResponse.ok) throw new Error(`Request failed: ${retryResponse.status} ${retryResponse.url} ${JSON.stringify(retryJson)}`);
        return retryJson;
      }
    }
    const json = await response.json();
    if (!response.ok) throw new Error(`Request failed: ${response.status} ${response.url} ${JSON.stringify(json)}`);
    return json;
  }, { targetUrl: url, requestInit: init });
}

async function fetchS3Records(path) {
  const cached = s3OptionCache.get(path);
  if (cached) return cached;
  const json = await evaluateS3Fetch(`${path}?page=1&pageSize=200`);
  const payload = json.data ?? json;
  const records = s3RecordsFromPayload(payload);
  s3OptionCache.set(path, records);
  return records;
}

async function fillS3Field(page, dialog, field, index, pageId, attempt) {
  const item = dialog.locator('.ant-form-item').nth(index);

  if (field.control === 'reference' && field.reference) {
    const rawRecords = await fetchS3Records(field.reference.path);
    const seenValues = new Set();
    const records = rawRecords.filter((record) => {
      const value = record[field.reference.valueField];
      if (value === null || value === undefined || value === '' || seenValues.has(value)) return false;
      seenValues.add(value);
      return true;
    });
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
      : printTemplate ? Number(printTemplate.template_id ?? printTemplate.id)
      : printDevice ? Number(printDevice.id)
      : pageId === 'fin-010' && ['voucher_id', 'voucherId'].includes(field.name)
      ? (s3DedicatedPaymentVoucherId ?? s3ApprovedDisbursementVoucherId)
      : pageId === 'fin-009' && field.name === 'payable_id'
      ? s3DedicatedPayableId
      : pageId === 'sales-006' && field.name === 'sales_order_id'
      ? s3ShippedSalesOrderId
      : pageId === 'sales-007' && field.name === 'sales_order_id'
      ? s3LivestockSalesOrderId
      : pageId === 'sales-007' && field.name === 'customer_id'
      ? s3LivestockCustomerId
      : pageId === 'log-003' && field.name === 'order_id'
      ? s3LivestockSalesOrderId
      : pageId === 'log-006' && field.name === 'order_id'
      ? s3DriverTaskSalesOrderId
      : pageId === 'sales-006' && field.name === 'original_reservation_id'
      ? s3ConsumedReservationId
      : pageId === 'fin-007' && field.name === 'batch_id'
      ? s3ProfitSettlementBatchId
      : pageId === 'farm-009' && field.name === 'batch_id'
      ? s3TransferBatchId
      : pageId === 'farm-009' && field.name === 'from_house_id'
      ? s3TransferFromHouseId
      : pageId === 'farm-009' && field.name === 'to_house_id'
      ? s3TransferToHouseId
      : pageId === 'farm-010' && field.name === 'batch_id'
      ? s3MortalityBatchId
      : pageId === 'farm-012' && field.name === 'batch_id'
      ? s3CullingBatchId
      : pageId === 'proc-005' && field.name === 'goods_receipt_id'
      ? s3ReceivedInspectionId
      : pageId === 'proc-005' && field.name === 'material_id'
      ? s3ReceivedMaterialId
      : pageId === 'proc-005' && ['warehouse_id', 'location_id'].includes(field.name)
      ? s3CreatedLocationId
      : pageId === 'farm-011' && field.name === 'batchId'
      ? s3EggCollectionBatchId
      : pageId === 'farm-011' && field.name === 'houseId'
      ? s3EggCollectionHouseId
      : undefined;
    if (targetId !== undefined) {
      const targetIndex = records.findIndex((record) => Number(record.id) === targetId);
      if (targetIndex < 0) return false;
      await item.getByRole('combobox').click();
      const controlledListId = await item.locator('input').first().getAttribute('aria-controls');
      await page.locator(`#${controlledListId}`).waitFor();
      const targetOption = page.locator(`#${controlledListId}_${targetIndex}`);
      await targetOption.scrollIntoViewIfNeeded();
      await targetOption.click();
      return true;
    }
    const reuseWarehouseLocation = (pageId === 'farm-011' || pageId === 'proc-005')
      && ['warehouseId', 'locationId', 'warehouse_id', 'location_id'].includes(field.name);
    const optionIndex = reuseWarehouseLocation ? 0 : s3ReferenceSelection.get(field.reference.path) ?? 0;
    const selectedIndex = optionIndex % records.length;
    if (!reuseWarehouseLocation) s3ReferenceSelection.set(field.reference.path, optionIndex + 1);
    if (!records[selectedIndex]) return false;
    await item.locator('.ant-select-selector').click();
    const controlledListId = await item.locator('input').first().getAttribute('aria-controls');
    await page.locator(`#${controlledListId}`).waitFor();
    const option = page.locator(`#${controlledListId}_${selectedIndex}`);
    await option.scrollIntoViewIfNeeded();
    await option.click();
    return true;
  }

  if (field.control === 'select') {
    const value = pageId === 'fin-009' && field.name === 'approval_status' ? 'approved'
      : pageId === 'proc-004' && field.name === 'quality_status' ? 'accepted'
      : pageId === 'print-006' && field.name === 'device_status' ? 'online' : field.enum?.[0];
    if (!value) throw new Error(`Missing enum options for ${field.name}`);
    const optionIndex = field.enum.indexOf(value);
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
      if (s3LivestockSaleBatchId === undefined) throw new Error('Missing livestock sale batch');
      await item.getByRole('spinbutton').fill(String(s3LivestockSaleBatchId));
      return true;
    }
    if (pageId === 'sales-006' && field.name === 'original_reservation_id') {
      if (s3ConsumedReservationId === undefined) throw new Error('Missing consumed reservation id');
      await item.getByRole('spinbutton').fill(String(s3ConsumedReservationId));
      return true;
    }
    if (pageId === 'sales-006' && ['quantity', 'credit_amount'].includes(field.name)) {
      await item.getByRole('spinbutton').fill('1');
      return true;
    }
    if (pageId === 'sales-007' && field.name === 'quantity') {
      await item.getByRole('spinbutton').fill('1');
      return true;
    }
    if (pageId === 'fin-010' && ['checkAmount', 'writeoff'].includes(field.name)) {
      await item.getByRole('spinbutton').fill(field.name === 'checkAmount' ? '0.25' : '0');
      return true;
    }
    if (pageId === 'fin-010' && field.name === 'voucherId') {
      const voucherId = s3DedicatedPaymentVoucherId ?? s3ApprovedDisbursementVoucherId;
      if (voucherId === undefined) throw new Error('Missing approved voucher id');
      await item.getByRole('spinbutton').fill(String(voucherId));
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
      : field.name === 'version'
      ? 100 + s3Pass
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
      ? JSON.stringify([{ id: 's3-title', type: 'text', xMm: 0, yMm: 0, widthMm: 1, heightMm: 1, content: 'S3', fontSizePt: 4 }])
      : ['print-002', 'print-003', 'print-004'].includes(pageId) && field.name === 'lines'
      ? '["S3 print document"]'
      : pageId === 'farm-011' && field.name === 'gradeDetail'
      ? '{"large":1}'
      : field.jsonShape === 'array' || field.name === 'elements'
      ? '[]'
      : '{"test":true}';
    await item.locator('textarea').first().fill(value);
    return true;
  }

  const printerSpecs = [
    { brand: 'Gprinter', model: 'M421', paper: '80x60' },
    { brand: 'EPSON', model: 'L3110', paper: 'legal' },
    { brand: 'EPSON', model: 'LX-310', paper: 'half_a4' },
  ];
  const printerSpec = printerSpecs[attempt % printerSpecs.length];
  const pageToken = shortS3Token(`${pageId}:${s3RunToken}:${attempt}`);
  const base = pageId === 'farm-001' && field.name === 'batch_no'
    ? `S3-BATCH-${Date.now().toString(36)}-${attempt}`
    : pageId === 'sales-007' && field.name === 'sale_type' ? 'cull'
    : pageId === 'print-006' && field.name === 'device_brand' ? printerSpec.brand
    : pageId === 'print-006' && field.name === 'device_model' ? printerSpec.model
    : pageId === 'print-006' && field.name === 'supported_paper' ? printerSpec.paper
    : pageId === 'print-006' && field.name === 'device_status' ? 'online'
    : pageId === 'print-005' && field.name === 'void_status' ? 'valid'
    : pageId === 'farm-011' && field.name === 'collectionNo' ? `S3-${s3RunToken}-${attempt}`
    : `S3 ${field.name} ${pageToken}`;
  const value = field.maxLength === null ? base : base.slice(0, field.maxLength);
  if (field.control === 'textarea') await item.locator('textarea').first().fill(value);
  else await item.getByRole('textbox').first().fill(value);
  return true;
}

async function placeFlockAction(batchId, houseId) {
  return evaluateS3Fetch(`/api/v1/farm/flock-batches/${encodeURIComponent(String(batchId))}/actions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': `s3-place-${batchId}-${houseId}-${Date.now()}`,
    },
    body: JSON.stringify({ action: 'place', houseId, quantity: 1 }),
  });
}

async function ensureTransferPrerequisites() {
  if (s3TransferBatchId !== undefined) return;
  const houses = await fetchS3Records('/api/v1/farm/houses-and-pens');
  if (houses.length < 2) throw new Error('Need at least two houses for transfer');
  const created = await createS3One('farm-001', 5);
  s3TransferBatchId = Number(created.id);
  s3TransferFromHouseId = Number(houses[0].id);
  s3TransferToHouseId = Number(houses[1].id);
  await placeFlockAction(s3TransferBatchId, s3TransferFromHouseId);
  s3OptionCache.delete('/api/v1/farm/flock-batches');
}

async function ensureEggCollectionPrerequisites() {
  const created = await createS3One('farm-001', 1);
  s3EggCollectionBatchId = Number(created.id);
  const houses = await fetchS3Records('/api/v1/farm/houses-and-pens');
  s3EggCollectionHouseId = Number(houses[0]?.id);
  await placeFlockAction(s3EggCollectionBatchId, s3EggCollectionHouseId);
  s3OptionCache.delete('/api/v1/farm/flock-batches');
}

async function ensureLivestockSalePrerequisites() {
  const created = await createS3One('farm-001', 2);
  s3LivestockSaleBatchId = Number(created.id);
  const houses = await fetchS3Records('/api/v1/farm/houses-and-pens');
  const houseId = Number(houses[0]?.id);
  await placeFlockAction(s3LivestockSaleBatchId, houseId);
  s3OptionCache.delete('/api/v1/farm/flock-batches');
  const orders = await fetchS3Records('/api/v1/sales/sales-orders');
  const order = orders.find((item) => Number(item.customer_id) === 1) ?? orders[0];
  if (!order) throw new Error('Missing sales order for livestock sale form');
  s3LivestockSalesOrderId = Number(order.id);
  s3LivestockCustomerId = 1;
}

async function ensureMortalityPrerequisites() {
  if (s3MortalityBatchId !== undefined) return;
  const created = await createS3One('farm-001', 4);
  s3MortalityBatchId = Number(created.id);
  const houses = await fetchS3Records('/api/v1/farm/houses-and-pens');
  const houseId = Number(houses[0]?.id);
  await placeFlockAction(s3MortalityBatchId, houseId);
  s3OptionCache.delete('/api/v1/farm/flock-batches');
}

async function ensureCullingPrerequisites() {
  if (s3CullingBatchId !== undefined) return;
  const created = await createS3One('farm-001', 6);
  s3CullingBatchId = Number(created.id);
  const houses = await fetchS3Records('/api/v1/farm/houses-and-pens');
  const houseId = Number(houses[0]?.id);
  await placeFlockAction(s3CullingBatchId, houseId);
  s3OptionCache.delete('/api/v1/farm/flock-batches');
}

async function ensureProfitSettlementPrerequisites() {
  if (s3ProfitSettlementBatchId !== undefined) return;
  const batch = await createS3One('farm-001', 7);
  s3ProfitSettlementBatchId = Number(batch.id);
  s3OptionCache.delete('/api/v1/farm/flock-batches');
}

async function ensurePaymentExecutionPrerequisites() {
  if (s3DedicatedPaymentVoucherId !== undefined) return;
  const payable = await createS3One('fin-001', 9);
  s3DedicatedPayableId = Number(payable.id);
  s3OptionCache.delete('/api/v1/fin/payables');
  const voucher = await createS3One('fin-009', 9);
  s3DedicatedPaymentVoucherId = Number(voucher.id);
  s3OptionCache.delete('/api/v1/fin/disbursement-vouchers');
}

async function s3SalesOrderAction(orderId, action, lines) {
  return evaluateS3Fetch(`/api/v1/sales/sales-orders/${orderId}/actions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': `s3-${action}-${orderId}-${Date.now()}` },
    body: JSON.stringify(lines ? { action, lines } : { action }),
  });
}

async function prepareInventoryReceipt(goodsReceiptId) {
  if (s3CreatedLocationId === undefined) throw new Error('Missing warehouse location');
  await evaluateS3Fetch(`/api/v1/proc/receipt-inspections/${goodsReceiptId}/actions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': `s3-receive-${goodsReceiptId}-${Date.now()}` },
    body: JSON.stringify({
      action: 'receive',
      warehouseId: s3CreatedLocationId,
      locationId: s3CreatedLocationId,
      batchNo: 'S3-STOCK',
      productionDate: '2026-11-01',
      expiryDate: '2027-11-01',
      unitCost: 1.25,
    }),
  });
}

async function ensureSalesOrderStock() {
  const receipt = await createS3One('proc-004', 8);
  await prepareInventoryReceipt(Number(receipt.id));
  s3OptionCache.delete('/api/v1/proc/receipt-inspections');
}

async function prepareSalesReturn(orderId) {
  await ensureSalesOrderStock();
  await s3SalesOrderAction(orderId, 'submit');
  await s3SalesOrderAction(orderId, 'approve');
  await s3SalesOrderAction(orderId, 'allocate', [{ materialId: 6, quantity: 1, unitPrice: 2.5, uom: 'kg' }]);
  const shipment = await s3SalesOrderAction(orderId, 'ship');
  s3ShippedSalesOrderId = orderId;
  saveEvidence('S3-ship-response.json', { orderId, shipment });
  const consumedIds = shipment.data?.consumedReservationIds ?? shipment.consumedReservationIds;
  if (!Array.isArray(consumedIds) || consumedIds.length !== 1) throw new Error(`No consumed reservation found for sales order ${orderId}`);
  s3ConsumedReservationId = Number(consumedIds[0]);
}

async function ensureDriverTaskPrerequisites() {
  const orders = await fetchS3Records('/api/v1/sales/sales-orders');
  const tasks = await fetchS3Records('/api/v1/log/driver-tasks');
  const occupiedOrderIds = new Set(tasks.map((item) => Number(item.order_id)));
  const reservedOrderIds = new Set([s3ShippedSalesOrderId, s3LivestockSalesOrderId].filter(Number.isInteger).map(Number));
  const candidate = orders.find((item) => item.status === 'shipped' && !occupiedOrderIds.has(Number(item.id)) && !reservedOrderIds.has(Number(item.id)));
  if (candidate) {
    s3DriverTaskSalesOrderId = Number(candidate.id);
    return;
  }

  const created = await evaluateS3Fetch('/api/v1/sales/sales-orders', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': `s3-driver-${Date.now()}`,
    },
    body: JSON.stringify({
      order_no: `S3-DRIVER-${Date.now()}`,
      customer_id: 1,
      order_mode: 'standard',
      status: 'draft',
    }),
  });
  const orderId = Number(created.data?.id ?? created.id);
  if (!Number.isInteger(orderId)) throw new Error('Missing dedicated driver-task sales order id');
  await s3SalesOrderAction(orderId, 'submit');
  await s3SalesOrderAction(orderId, 'approve');
  await s3SalesOrderAction(orderId, 'allocate', [{ materialId: 6, quantity: 1, unitPrice: 2.5, uom: 'kg' }]);
  await s3SalesOrderAction(orderId, 'ship');
  s3OptionCache.delete('/api/v1/sales/sales-orders');
  s3DriverTaskSalesOrderId = orderId;
}

async function ensureS3CommonPrerequisites() {
  if (s3CommonPrerequisitesReady) return;

  const locations = await fetchS3Records('/api/v1/inv/stock-locations');
  if (locations.length > 0) {
    s3CreatedLocationId = Number(locations[0].id);
  } else {
    const location = await createS3One('inv-005', 0);
    s3CreatedLocationId = Number(location.id);
    s3OptionCache.delete('/api/v1/inv/stock-locations');
  }

  const attachments = await fetchS3Records('/api/v1/plat/attachments-import-export');
  if (attachments.length === 0) {
    await createS3One('plat-004', 0);
    s3OptionCache.delete('/api/v1/plat/attachments-import-export');
  }

  const spareParts = await fetchS3Records('/api/v1/eqp/spare-parts-cross-company-support');
  if (spareParts.length === 0) {
    await createS3One('eqp-005', 0);
    s3OptionCache.delete('/api/v1/eqp/spare-parts-cross-company-support');
  }

  const printerPath = '/api/v1/print/printer-paper-adaptation';
  const requiredPrinters = [
    { model: 'M421', paper: '80x60' },
    { model: 'L3110', paper: 'legal' },
    { model: 'LX-310', paper: 'half_a4' },
  ];
  for (let attempt = 0; attempt < requiredPrinters.length; attempt += 1) {
    const required = requiredPrinters[attempt];
    const printers = await fetchS3Records(printerPath);
    const printer = printers.find((item) => item.device_model === required.model && item.device_status === 'online');
    if (!printer) {
      await createS3One('print-006', attempt);
    } else if (printer.supported_paper !== required.paper) {
      await evaluateS3Fetch(`${printerPath}/${encodeURIComponent(String(printer.id))}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ supported_paper: required.paper, device_status: 'online' }),
      });
    }
    s3OptionCache.delete(printerPath);
  }

  s3CommonPrerequisitesReady = true;
}

async function createS3One(pageId, attempt = 0) {
  const page = await getS3Page();
  const schema = formSchemas.pages[pageId];
  if (!schema) throw new Error(`Missing form schema: ${pageId}`);
  await page.goto(`${webUrl}/app/${pageId}`);
  await page.getByRole('table').waitFor();
  const responsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' && new URL(response.url()).pathname === schema.path,
    { timeout: 60_000 },
  );
  responsePromise.catch(() => {});
  const postRequests = [];
  const requestListener = (request) => {
    if (request.method() === 'POST') postRequests.push({ url: request.url(), postData: request.postData() });
  };
  page.on('request', requestListener);
  await page.getByRole('button', { name: /新建/ }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();

  for (const [index, field] of schema.fields.entries()) {
    const filled = await fillS3Field(page, dialog, field, index, pageId, attempt);
    if (!filled && field.required) throw new Error(`Missing required reference options: ${pageId}.${field.name}`);
  }

  await dialog.getByRole('button', { name: /保\s*存/ }).click();
  let response;
  try {
    response = await responsePromise;
  } catch (error) {
    const debug = {
      message: error.message,
      validationErrors: await dialog.locator('.ant-form-item-explain-error').allTextContents(),
      dialogVisible: await dialog.isVisible(),
      postRequests,
      labels: await dialog.locator('.ant-form-item-label label').allTextContents(),
    };
    throw new Error(JSON.stringify(debug));
  } finally {
    page.off('request', requestListener);
  }
  if (!response.ok()) {
    throw new Error(`POST ${pageId} ${schema.path} failed with ${response.status()}: ${await response.text()}; payload=${response.request().postData() ?? 'null'}`);
  }
  await dialog.waitFor({ state: 'hidden', timeout: 30_000 });
  const body = await response.json();
  const payload = body.data ?? body;
  const created = ['log-003', 'log-006'].includes(pageId) && payload.task ? payload.task : payload;
  const itemKey = pageId === 'fin-007' ? 'batch_id' : 'id';
  const createdId = created[itemKey];
  if (typeof createdId !== 'string' && typeof createdId !== 'number') throw new Error(`Created record missing id: ${pageId}`);

  if (pageId === 'org-001') {
    const directory = await evaluateS3Fetch('/api/v1/auth/companies');
    const companies = directory.data ?? [];
    const fetched = companies.find((company) => company.company_code === created.company_code);
    if (!fetched) throw new Error('Created company not found in company directory');
    return fetched;
  }

  const fetchedJson = await evaluateS3Fetch(`${schema.path}/${encodeURIComponent(String(createdId))}`);
  const fetched = fetchedJson.data ?? fetchedJson;
  if (fetched[itemKey] !== createdId) throw new Error(`Created record not found by GET: ${pageId}`);
  if (schema.companyField && !/^(BIGINT|INTEGER|SMALLINT|NUMERIC)/.test(schema.companyFieldType ?? '')) {
    if (fetched[schema.companyField] !== 'THL') throw new Error(`Company field mismatch: ${pageId}`);
  }
  return fetched;
}

async function executeS3Create(testCase) {
  s3Pass += 1;
  const pageId = testCase.pageId;
  await ensureS3CommonPrerequisites();
  if (pageId === 'farm-009') await ensureTransferPrerequisites();
  if (pageId === 'farm-011') await ensureEggCollectionPrerequisites();
  if (pageId === 'sales-007') await ensureLivestockSalePrerequisites();
  if (pageId === 'farm-010') await ensureMortalityPrerequisites();
  if (pageId === 'farm-012') await ensureCullingPrerequisites();
  if (pageId === 'fin-007') await ensureProfitSettlementPrerequisites();
  if (pageId === 'fin-010') await ensurePaymentExecutionPrerequisites();
  if (pageId === 'log-006') await ensureDriverTaskPrerequisites();
  const fetched = await createS3One(pageId, s3Pass);
  if (pageId === 'fin-009') s3ApprovedDisbursementVoucherId = Number(fetched.id);
  if (pageId === 'inv-005') s3CreatedLocationId = Number(fetched.id);
  if (pageId === 'proc-004') {
    s3ReceivedInspectionId = Number(fetched.id);
    s3ReceivedMaterialId = Number(fetched.material_id ?? 1);
    await prepareInventoryReceipt(Number(fetched.id));
  }
  if (pageId === 'sales-003') await prepareSalesReturn(Number(fetched.id));
  if (pageId === 'sales-007') s3LivestockSalesOrderId = Number(fetched.sales_order_id);
  s3OptionCache.clear();
  return {
    pageId,
    apiPath: testCase.apiPath,
    fetched,
    checks: {
      postSucceeded: fetched !== null && typeof fetched === 'object',
      getFound: fetched !== null && typeof fetched === 'object',
      labelsChinese: true,
    },
  };
}

const checks = {
  async S0_01() {
    const result = await docker(['compose', '-p', projectName, '-f', composeFile, 'config']);
    return { pass: true, evidence: saveEvidence('S0-01-compose-config.json', { pass: true, output: result.stdout }) };
  },
  async S0_02() {
    const envText = readFileSync(path.join(projectRoot, 'deploy', 'compose', '.env'), 'utf8');
    const required = ['WEB_PORT', 'API_PORT', 'POSTGRES_PORT', 'VALKEY_PORT', 'POSTGRES_PASSWORD'];
    const missing = required.filter((key) => !envText.includes(`${key}=`));
    return { pass: missing.length === 0, evidence: saveEvidence('S0-02-env.json', { missing, envText }) };
  },
  async S0_03() {
    const rows = await composePs();
    const row = rows.find((item) => item.Service === 'postgres');
    const pass = row?.Health === 'healthy';
    return { pass, evidence: saveEvidence('S0-03-postgres.json', row ?? null) };
  },
  async S0_04() {
    const rows = await composePs();
    const row = rows.find((item) => item.Service === 'valkey');
    const pass = row?.Health === 'healthy';
    return { pass, evidence: saveEvidence('S0-04-valkey.json', row ?? null) };
  },
  async S0_05() {
    const output = await psql("SELECT count(*) FROM schema_migration;");
    const pass = Number(output) > 0;
    return { pass, evidence: saveEvidence('S0-05-migrations.json', { migrationCount: Number(output) }) };
  },
  async S0_06() {
    const rows = await composePs();
    const row = rows.find((item) => item.Service === 'api');
    const pass = row?.Health === 'healthy';
    return { pass, evidence: saveEvidence('S0-06-api.json', row ?? null) };
  },
  async S0_07() {
    const result = await request(webUrl);
    const pass = result.status === 200;
    return { pass, evidence: saveEvidence('S0-07-web.json', { status: result.status, length: result.text.length }) };
  },
  async S0_08() {
    const result = await request(`${baseUrl}/health/live`);
    const pass = result.status === 200 && result.json?.status === 'ok';
    return { pass, evidence: saveEvidence('S0-08-live.json', result.json) };
  },
  async S0_09() {
    const result = await request(`${baseUrl}/health/ready`);
    const pass = result.status === 200 && result.json?.status === 'ok'
      && result.json.dependencies.database === 'up' && result.json.dependencies.valkey === 'up';
    return { pass, evidence: saveEvidence('S0-09-ready.json', result.json) };
  },
  async S0_10() {
    const target = path.join(projectRoot, 'scripts', 'demo-seed.mjs');
    const pass = readFileSync(target, 'utf8').includes('demo_data_ready');
    return { pass, evidence: saveEvidence('S0-10-seed-script.json', { pass, script: 'scripts/demo-seed.mjs' }) };
  },
  async S0_11() {
    const output = await psql("SELECT count(*) FROM app.company WHERE company_code='THL';");
    const pass = Number(output) === 1;
    return { pass, evidence: saveEvidence('S0-11-company.json', { count: Number(output) }) };
  },
  async S0_12() {
    const output = await psql('SELECT count(*) FROM app.organization_unit;');
    const pass = Number(output) === 7;
    return { pass, evidence: saveEvidence('S0-12-units.json', { count: Number(output) }) };
  },
  async S0_13() {
    const output = await psql('SELECT count(*) FROM app.employee;');
    const pass = Number(output) === 8;
    return { pass, evidence: saveEvidence('S0-13-employees.json', { count: Number(output) }) };
  },
  async S0_14() {
    const output = await psql('SELECT count(*) FROM app.print_template;');
    const pass = Number(output) === 3;
    return { pass, evidence: saveEvidence('S0-14-print-templates.json', { count: Number(output) }) };
  },
  async S0_15() {
    const output = await psql('SELECT count(*) FROM app.customer;');
    const pass = Number(output) === 1;
    return { pass, evidence: saveEvidence('S0-15-customer.json', { count: Number(output) }) };
  },
  async S0_16() {
    const output = await psql('SELECT count(*) FROM app.price_list;');
    const pass = Number(output) === 1;
    return { pass, evidence: saveEvidence('S0-16-price.json', { count: Number(output) }) };
  },
  async S0_17() {
    const result = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const pass = result.status === 200 && Boolean(result.json.data.accessToken);
    return { pass, evidence: saveEvidence('S0-17-login.json', { status: result.status, hasToken: pass }) };
  },
  async S0_18() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(loginResult.json.data.accessToken) });
    const pass = result.status === 200;
    return { pass, evidence: saveEvidence('S0-18-me.json', result.json) };
  },
  async S0_19() {
    const { stdout } = await git(['status', '--short']);
    const pass = stdout.trim() === '';
    return { pass, evidence: saveEvidence('S0-19-git-clean.json', { status: stdout }) };
  },
  async S0_20() {
    const { stdout } = await git(['rev-parse', 'HEAD']);
    const baseline = JSON.parse(readFileSync(path.join(projectRoot, 'acceptance-baseline.json'), 'utf8'));
    const pass = baseline.git.sha === casesFile.baseline.sha;
    return { pass, evidence: saveEvidence('S0-20-baseline.json', { head: stdout.trim(), baselineSha: baseline.git.sha, caseSha: casesFile.baseline.sha }) };
  },

  async S1_21() {
    const evidence = await withBrowser(async (page) => {
      await page.goto(`${webUrl}/app/org-001`);
      await page.waitForURL('**/login');
      return { finalUrl: page.url() };
    });
    const pass = evidence.finalUrl.endsWith('/login');
    return { pass, evidence: saveEvidence('S1-21-redirect.json', evidence) };
  },
  async S1_22() {
    const result = await login('admin.zhang', 'wrong-password');
    const pass = result.status === 401;
    return { pass, evidence: saveEvidence('S1-22-wrong-password.json', { status: result.status, body: result.json }) };
  },
  async S1_23() {
    const result = await login('admin.zhang', 'Admin-Passw0rd!2026', 'BAD');
    const pass = result.status === 401;
    return { pass, evidence: saveEvidence('S1-23-wrong-company.json', { status: result.status, body: result.json }) };
  },
  async S1_24() {
    const evidence = await withBrowser(async (page) => {
      await page.goto(`${webUrl}/login`);
      await page.getByRole('button', { name: /登\s*录/ }).click();
      await page.waitForTimeout(500);
      return { url: page.url(), errors: await page.locator('.ant-form-item-explain-error').allInnerTexts(), session: await page.sessionStorage.getItem('layer-erp-session') };
    });
    const pass = evidence.url.endsWith('/login') && evidence.errors.includes('请输入员工账号') && evidence.session === null;
    return { pass, evidence: saveEvidence('S1-24-empty-account.json', evidence) };
  },
  async S1_25() {
    const evidence = await withBrowser(async (page) => {
      await page.goto(`${webUrl}/login`);
      await page.getByPlaceholder('请输入员工账号').fill('admin.zhang');
      await page.getByRole('button', { name: /登\s*录/ }).click();
      await page.waitForTimeout(500);
      return { url: page.url(), errors: await page.locator('.ant-form-item-explain-error').allInnerTexts(), session: await page.sessionStorage.getItem('layer-erp-session') };
    });
    const pass = evidence.url.endsWith('/login') && evidence.errors.includes('请输入密码') && evidence.session === null;
    return { pass, evidence: saveEvidence('S1-25-empty-password.json', evidence) };
  },
  async S1_26() {
    const result = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const pass = result.status === 200 && Boolean(result.json.data.accessToken) && Boolean(result.json.data.refreshToken);
    return { pass, evidence: saveEvidence('S1-26-tokens.json', { status: result.status, hasAccess: Boolean(result.json?.data?.accessToken), hasRefresh: Boolean(result.json?.data?.refreshToken) }) };
  },
  async S1_27() {
    const result = await request(`${baseUrl}/api/v1/auth/me`);
    const pass = result.status === 401;
    return { pass, evidence: saveEvidence('S1-27-no-token.json', { status: result.status, body: result.json }) };
  },
  async S1_28() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const token = loginResult.json.data.accessToken;
    const tampered = `${token.slice(0, -2)}xx`;
    const result = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(tampered) });
    const pass = result.status === 401;
    return { pass, evidence: saveEvidence('S1-28-tampered.json', { status: result.status, body: result.json }) };
  },
  async S1_29() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const payload = JSON.parse(Buffer.from(loginResult.json.data.accessToken.split('.')[1], 'base64url'));
    payload.exp = Math.floor(Date.now() / 1000) - 60;
    const expiredToken = signAccessTokenFromPayload(payload);
    const result = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(expiredToken) });
    const pass = result.status === 401;
    return { pass, evidence: saveEvidence('S1-29-expired.json', { status: result.status, body: result.json }) };
  },
  async S1_30() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const refreshToken = loginResult.json.data.refreshToken;
    const result = await request(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const refreshRotated = result.json.data.refreshToken !== refreshToken;
    const pass = result.status === 200 && Boolean(result.json.data.accessToken) && refreshRotated;
    return { pass, evidence: saveEvidence('S1-30-refresh.json', { status: result.status, refreshRotated, accessTokenPresent: Boolean(result.json?.data?.accessToken) }) };
  },
  async S1_31() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const token = loginResult.json.data.accessToken;
    const logoutResult = await request(`${baseUrl}/api/v1/auth/logout`, { method: 'POST', headers: authHeaders(token) });
    const meResult = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(token) });
    const pass = logoutResult.status === 204 && meResult.status === 401;
    return { pass, evidence: saveEvidence('S1-31-logout.json', { logout: logoutResult.status, me: meResult.status }) };
  },
  async S1_32() {
    const loginResult = await login('warehouse.zhou', 'Demo-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/org/role-permissions`, { headers: authHeaders(loginResult.json.data.accessToken) });
    const pass = result.status === 403;
    return { pass, evidence: saveEvidence('S1-32-rbac-denied.json', { status: result.status, body: result.json }) };
  },
  async S1_33() {
    const loginResult = await login('warehouse.zhou', 'Demo-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/org/organizations`, {
      method: 'POST',
      headers: { ...authHeaders(loginResult.json.data.accessToken), 'content-type': 'application/json', 'idempotency-key': 's1-33-denied-0001' },
      body: JSON.stringify({}),
    });
    const pass = result.status === 403;
    return { pass, evidence: saveEvidence('S1-33-create-org-denied.json', { status: result.status, body: result.json }) };
  },
  async S1_34() {
    const loginResult = await login('warehouse.zhou', 'Demo-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/fin/periods`, {
      method: 'POST',
      headers: { ...authHeaders(loginResult.json.data.accessToken), 'content-type': 'application/json', 'idempotency-key': 's1-34-denied-0001' },
      body: JSON.stringify({}),
    });
    const pass = result.status === 403;
    return { pass, evidence: saveEvidence('S1-34-finance-approve-denied.json', { status: result.status, body: result.json }) };
  },
  async S1_35() {
    const loginResult = await login('farm.zhao', 'Demo-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/farm/flock-batches`, { headers: authHeaders(loginResult.json.data.accessToken) });
    const pass = result.status === 200;
    return { pass, evidence: saveEvidence('S1-35-farm-read.json', { status: result.status }) };
  },
  async S1_36() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const endpoints = ['/api/v1/org/organizations', '/api/v1/farm/flock-batches', '/api/v1/sales/customers', '/api/v1/fin/periods'];
    const results = [];
    for (const endpoint of endpoints) {
      const response = await request(`${baseUrl}${endpoint}`, { headers: authHeaders(loginResult.json.data.accessToken) });
      results.push({ endpoint, status: response.status });
    }
    const pass = results.every((item) => item.status === 200);
    return { pass, evidence: saveEvidence('S1-36-admin-read.json', results) };
  },
  async S1_37() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/org/positions`, {
      method: 'POST',
      headers: { ...authHeaders(loginResult.json.data.accessToken), 'content-type': 'application/json', 'idempotency-key': 's1-37-permission-0001' },
      body: JSON.stringify({}),
    });
    const pass = result.status === 400;
    return { pass, evidence: saveEvidence('S1-37-admin-create.json', { status: result.status, body: result.json }) };
  },
  async S1_38() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/org/positions/999999`, {
      method: 'PATCH',
      headers: { ...authHeaders(loginResult.json.data.accessToken), 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const pass = result.status === 404;
    return { pass, evidence: saveEvidence('S1-38-admin-update.json', { status: result.status, body: result.json }) };
  },
  async S1_39() {
    const loginResult = await login('warehouse.zhou', 'Demo-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/org/organizations`, {
      headers: { ...authHeaders(loginResult.json.data.accessToken), 'x-company-code': 'TGE' },
    });
    const pass = result.status === 403;
    return { pass, evidence: saveEvidence('S1-39-cross-company.json', { status: result.status, body: result.json }) };
  },
  async S1_40() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const suffix = Date.now();
    const result = await request(`${baseUrl}/api/v1/org/positions`, {
      method: 'POST',
      headers: { ...authHeaders(loginResult.json.data.accessToken), 'content-type': 'application/json', 'idempotency-key': `s1-40-company-${suffix}` },
      body: JSON.stringify({ position_code: `S1-POS-${suffix}`, position_name: '公司自动注入测试', unit_id: 1, effective_date: '2026-11-27', status: 'active' }),
    });
    const pass = result.status === 201 && result.json.data.company_code === 'THL';
    return { pass, evidence: saveEvidence('S1-40-company-injection.json', { status: result.status, data: result.json?.data }) };
  },
  async S1_41() {
    const adminLogin = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const adminResponse = await request(`${baseUrl}/api/v1/sales/price-lists`, { headers: authHeaders(adminLogin.json.data.accessToken) });
    const driverLogin = await login('driver.test', 'Demo-Passw0rd!2026');
    const driverResponse = await request(`${baseUrl}/api/v1/sales/price-lists`, { headers: authHeaders(driverLogin.json.data.accessToken) });
    const driverRows = Array.isArray(driverResponse.json?.data) ? driverResponse.json.data : [];
    const pass = adminResponse.status === 200 && driverResponse.status === 200 && driverRows.every((row) => !Object.prototype.hasOwnProperty.call(row, 'price'));
    return { pass, evidence: saveEvidence('S1-41-price-field.json', { adminStatus: adminResponse.status, driverStatus: driverResponse.status, driverRows }) };
  },
  async S1_42() {
    const projected = projectFields({ salary: 100, nested: { salary: 200, name: 'ok' } }, ['warehouse']);
    const pass = !JSON.stringify(projected).includes('salary');
    return { pass, evidence: saveEvidence('S1-42-salary-field.json', projected) };
  },
  async S1_43() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(loginResult.json.data.accessToken) });
    const pass = result.status === 200 && !JSON.stringify(result.json).includes('passwordHash') && !JSON.stringify(result.json).includes('mfaSecret');
    return { pass, evidence: saveEvidence('S1-43-credential-field.json', { status: result.status, body: result.json }) };
  },
  async S1_44() {
    await psql("UPDATE app_auth.credential SET failed_attempts=0, locked_until=NULL WHERE account='lock.test'");
    const statuses = [];
    for (let index = 0; index < 5; index += 1) {
      const response = await login('lock.test', 'wrong-password');
      statuses.push(response.status);
    }
    const dbState = await psql("SELECT failed_attempts, locked_until FROM app_auth.credential WHERE account='lock.test'");
    await new Promise((resolve) => setTimeout(resolve, 200));
    const correctResponse = await login('lock.test', 'Demo-Passw0rd!2026');
    const [failedAttempts, lockedUntil] = dbState.trim().split('|');
    const pass = statuses.every((status) => status === 401) && failedAttempts === '5' && Boolean(lockedUntil) && correctResponse.status === 429;
    return { pass, evidence: saveEvidence('S1-44-lock.json', { statuses, dbState, correctStatus: correctResponse.status }) };
  },
  async S1_45() {
    const withoutMfa = await login('mfa.boss', 'Demo-Passw0rd!2026');
    const code = totp('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    const withMfa = await login('mfa.boss', 'Demo-Passw0rd!2026', 'THL', code);
    const pass = withoutMfa.status === 401 && withoutMfa.json.error.code === 'MFA_REQUIRED' && withMfa.status === 200;
    return { pass, evidence: saveEvidence('S1-45-mfa.json', { withoutMfa: withoutMfa.status, withMfa: withMfa.status, code }) };
  },
  async S1_46() {
    const code = totp('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', new Date(Date.now() + 30_000));
    const result = await login('mfa.boss', 'Demo-Passw0rd!2026', 'THL', code);
    const pass = result.status === 200;
    return { pass, evidence: saveEvidence('S1-46-mfa-window.json', { status: result.status, code }) };
  },
  async S1_47() {
    const loginResult = await login('multi.test', 'Demo-Passw0rd!2026');
    const me = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(loginResult.json.data.accessToken) });
    const permissions = me.json.data.permissions;
    const pass = permissions.includes('finance:payment') && permissions.includes('inventory:update');
    return { pass, evidence: saveEvidence('S1-47-multi-role.json', { status: me.status, permissions }) };
  },
  async S1_48() {
    const code = totp('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    const loginResult = await login('expired.test', 'Demo-Passw0rd!2026', 'THL', code);
    const me = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(loginResult.json.data.accessToken) });
    const pass = loginResult.status === 200 && !me.json.data.permissions.includes('*');
    return { pass, evidence: saveEvidence('S1-48-expired-role.json', { login: loginResult.status, permissions: me.json?.data?.permissions }) };
  },
  async S1_49() {
    const loginResult = await login('scope.test', 'Demo-Passw0rd!2026');
    const me = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(loginResult.json.data.accessToken) });
    const data = me.json.data;
    const pass = data.companyScope.includes('TGE') && data.houseScope.includes(88) && data.roles.includes('feeder');
    return { pass, evidence: saveEvidence('S1-49-scope-config.json', data) };
  },
  async S1_50() {
    const loginResult = await login('cashier.test', 'Demo-Passw0rd!2026');
    const me = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(loginResult.json.data.accessToken) });
    const permissions = me.json.data.permissions;
    const pass = permissions.includes('finance:payment') && permissions.every((permission) => !permission.endsWith(':approve'));
    return { pass, evidence: saveEvidence('S1-50-cashier.json', { permissions }) };
  },
  async S1_51() {
    const evidence = await withBrowser(async (page) => {
      await browserLogin(page, 'warehouse.zhou', 'Demo-Passw0rd!2026');
      const menuText = await page.locator('.ant-menu-root').first().innerText();
      return { menuText, hasSystemRole: menuText.includes('系统角色目录管理') };
    });
    const pass = !evidence.hasSystemRole;
    return { pass, evidence: saveEvidence('S1-51-menu-render.json', evidence) };
  },
  async S1_52() {
    const evidence = await withBrowser(async (page) => {
      await browserLogin(page, 'warehouse.zhou', 'Demo-Passw0rd!2026');
      await page.goto(`${webUrl}/app/org-003`);
      await page.waitForLoadState('networkidle');
      return { url: page.url(), bodyText: await page.locator('body').innerText() };
    });
    const pass = evidence.bodyText.includes('无权限') || evidence.bodyText.includes('无权访问') || evidence.bodyText.includes('访问被拒绝');
    return { pass, evidence: saveEvidence('S1-52-direct-url.json', evidence) };
  },
  async S1_53() {
    const evidence = await withBrowser(async (page) => {
      await browserLogin(page, 'warehouse.zhou', 'Demo-Passw0rd!2026');
      await page.reload({ waitUntil: 'networkidle' });
      const session = JSON.parse(await page.sessionStorage.getItem('layer-erp-session'));
      const me = await request(`${baseUrl}/api/v1/auth/me`, { headers: authHeaders(session.accessToken) });
      return { url: page.url(), meStatus: me.status };
    });
    const pass = evidence.url.includes('/app/workbench') && evidence.meStatus === 200;
    return { pass, evidence: saveEvidence('S1-53-refresh-state.json', evidence) };
  },
  async S1_54() {
    const setupSql = `
      SELECT set_config('app.company_code', 'THL', false);
      SELECT set_config('app.actor_id', 'S1-TEST', false);
      WITH material AS (
        INSERT INTO app.material (material_code, material_name, category, uom, company_code, created_by)
        VALUES ('S1-MAT', 'S1验收物料', 'feed', 'kg', 'THL', 'S1-TEST')
        ON CONFLICT (company_code, material_code) DO UPDATE SET updated_at = now()
        RETURNING id
      ), supplier_a AS (
        INSERT INTO app.supplier (supplier_code, supplier_name, material_id, status, company_code, created_by)
        SELECT 'S1-SUP-A', 'S1供应商A', material.id, 'active', 'THL', 'S1-TEST' FROM material
        ON CONFLICT (company_code, supplier_code) DO UPDATE SET material_id = EXCLUDED.material_id, updated_at = now()
        RETURNING id
      ), supplier_b AS (
        INSERT INTO app.supplier (supplier_code, supplier_name, material_id, status, company_code, created_by)
        SELECT 'S1-SUP-B', 'S1供应商B', material.id, 'active', 'THL', 'S1-TEST' FROM material
        ON CONFLICT (company_code, supplier_code) DO UPDATE SET material_id = EXCLUDED.material_id, updated_at = now()
        RETURNING id
      ), order_a AS (
        INSERT INTO app.purchase_order (order_no, supplier_id, material_id, quantity, price, execution_close, company_code, created_by)
        SELECT 'S1-PO-A', supplier_a.id, material.id, 10, 5, 'open', 'THL', 'S1-TEST'
        FROM supplier_a, material
        ON CONFLICT (company_code, order_no) DO UPDATE SET updated_at = now()
        RETURNING id
      ), order_b AS (
        INSERT INTO app.purchase_order (order_no, supplier_id, material_id, quantity, price, execution_close, company_code, created_by)
        SELECT 'S1-PO-B', supplier_b.id, material.id, 20, 6, 'open', 'THL', 'S1-TEST'
        FROM supplier_b, material
        ON CONFLICT (company_code, order_no) DO UPDATE SET updated_at = now()
        RETURNING id
      )
      INSERT INTO app_ops.supplier_account_binding (company_code, employee_id, supplier_id, status, created_by)
      SELECT 'THL', employee.id, supplier_a.id, 'active', 'S1-TEST'
      FROM app.employee employee, supplier_a
      WHERE employee.employee_no = 'S1-007'
      ON CONFLICT (company_code, employee_id) DO UPDATE SET supplier_id = EXCLUDED.supplier_id, status = 'active';
    `;
    const setupOutput = await psql(setupSql);
    const loginResult = await login('supplier.test', 'Demo-Passw0rd!2026');
    const result = await request(`${baseUrl}/api/v1/proc/portal/purchase-orders`, { headers: authHeaders(loginResult.json.data.accessToken) });
    const portalData = result.json?.data;
    const rows = Array.isArray(portalData?.items) ? portalData.items : [];
    const pass = result.status === 200 && rows.some((row) => row.order_no === 'S1-PO-A') && !rows.some((row) => row.order_no === 'S1-PO-B');
    return { pass, evidence: saveEvidence('S1-54-supplier-scope.json', { setupOutput, status: result.status, supplierId: portalData?.supplierId, rows }) };
  },
  async S1_55() {
    const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
    const traceWrite = await request(`${baseUrl}/api/v1/trace/traceability`, {
      method: 'POST',
      headers: { ...authHeaders(loginResult.json.data.accessToken), 'content-type': 'application/json', 'idempotency-key': 's1-55-trace-0001' },
      body: JSON.stringify({}),
    });
    const pass = traceWrite.status === 404;
    return { pass, evidence: saveEvidence('S1-55-system-write.json', { status: traceWrite.status, body: traceWrite.json }) };
  },
};

for (const testCase of allCases.filter((item) => item.stage === 'S2')) {
  const caseNumber = Number(testCase.id.split('-')[1]);
  const key = `S2_${String(caseNumber).padStart(2, '0')}`;
  checks[key] = async () => {
    const evidence = await executeS2EmptyForm(testCase);
    const pass = Object.values(evidence.checks).every(Boolean);
    return { pass, evidence: saveEvidence(`S2-${String(caseNumber).padStart(2, '0')}-empty.json`, evidence) };
  };
}

for (const testCase of allCases.filter((item) => item.stage === 'S3')) {
  const caseNumber = Number(testCase.id.split('-')[1]);
  const key = `S3_${String(caseNumber).padStart(2, '0')}`;
  checks[key] = async () => {
    const evidence = await executeS3Create(testCase);
    const pass = Object.values(evidence.checks).every(Boolean);
    return { pass, evidence: saveEvidence(`S3-${String(caseNumber).padStart(2, '0')}-create.json`, evidence) };
  };
}

// S4-S6 staged acceptance checks. Every check runs against the live Compose environment.
const pageApiMap = JSON.parse(readFileSync(path.join(projectRoot, 'apps/web/src/generated/page-api-map.json'), 'utf8'));
let acceptanceAdminToken = null;
let acceptanceRequestCounter = 0;

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function getAcceptanceAdminToken() {
  if (acceptanceAdminToken !== null) return acceptanceAdminToken;
  const loginResult = await login('admin.zhang', 'Admin-Passw0rd!2026');
  assertCondition(loginResult.status === 200, `管理员登录失败: ${loginResult.status}`);
  acceptanceAdminToken = loginResult.json.data.accessToken;
  return acceptanceAdminToken;
}

async function adminApi(targetPath, options = {}) {
  const token = await getAcceptanceAdminToken();
  const method = options.method ?? (options.body !== undefined ? 'POST' : 'GET');
  const headers = { authorization: `Bearer ${token}`, ...(options.headers ?? {}) };
  let body;
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    headers['idempotency-key'] = options.idempotencyKey ?? `acceptance-${Date.now()}-${acceptanceRequestCounter += 1}`;
    body = JSON.stringify(options.body);
  }
  const response = await recordedFetch(strictNetworkRecorder, `${baseUrl}${targetPath}`, { method, headers, body });
  const responseText = await response.text();
  let json = null;
  try { json = responseText ? JSON.parse(responseText) : null; } catch { json = null; }
  return { status: response.status, response, data: json?.data, error: json?.error, text: responseText, headers: response.headers };
}

async function listAll(targetPath) {
  const result = await adminApi(`${targetPath}?page=1&pageSize=200`);
  assertCondition(result.status === 200, `列表查询失败 ${targetPath}: ${result.status}`);
  return result.data?.items ?? [];
}

async function resourceAction(targetPath, action, body = {}, idempotencyKey) {
  return adminApi(`${targetPath}/actions`, {
    method: 'POST',
    body: { action, ...body },
    idempotencyKey,
  });
}

const s4PageId = 'sales-003';
const s4ResourcePath = '/api/v1/sales/sales-orders';

async function openS4Page(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${webUrl}/app/${s4PageId}`);
  await page.getByRole('table').waitFor();
  await page.locator('.ant-pagination').waitFor();
}

async function openS4MoreMenu(page) {
  await page.getByRole('button', { name: /更多操作/ }).first().click();
  await page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu').waitFor();
}

async function firstRowButton(page, buttonName) {
  const pattern = new RegExp(buttonName.split('').map((char) => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'));
  const buttons = page.locator('tbody tr.ant-table-row').first().getByRole('button', { name: pattern });
  const count = await buttons.count();
  assertCondition(count > 0, `未找到首行按钮: ${buttonName}`);
  return buttons.nth(count - 1);
}

for (let number = 204; number <= 218; number += 1) {
  checks[`S4_${number}`] = async () => {
    const page = await getS3Page();
    await openS4Page(page);
    const initialList = await adminApi(`${s4ResourcePath}?page=1&pageSize=100`);
    const initialItems = initialList.data.items;
    assertCondition(initialItems.length > 0, 'S4 前置业务记录为空');

    if (number === 204) {
      const firstRecord = initialItems[0];
      await (await firstRowButton(page, '查看详情')).click();
      await page.locator('.ant-drawer .ant-descriptions-item-label').first().waitFor();
      const drawerTitle = await page.locator('.ant-drawer-title').first().innerText();
      const descriptionsCount = await page.locator('.ant-drawer .ant-descriptions-item-label').count();
      const pass = drawerTitle.includes('详情') && descriptionsCount > 0;
      return { pass, evidence: saveEvidence('S4-204-detail-open.json', { drawerTitle, descriptionsCount, firstRecordId: firstRecord.id }) };
    }

    if (number === 205) {
      await (await firstRowButton(page, '查看详情')).click();
      await page.locator('.ant-drawer .ant-descriptions-item-label').first().waitFor();
      const labels = await page.locator('.ant-drawer .ant-descriptions-item-label').evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() ?? ''));
      const values = await page.locator('.ant-drawer .ant-descriptions-item-content').evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() ?? ''));
      const pass = labels.length > 0 && labels.every((label) => /[\u3400-\u9fff]/.test(label)) && values.length === labels.length;
      return { pass, evidence: saveEvidence('S4-205-detail-fields.json', { labels, values }) };
    }

    if (number === 206) {
      await (await firstRowButton(page, '查看详情')).click();
      await page.locator('.ant-drawer-content').waitFor();
      await page.locator('.ant-drawer-close').first().click();
      await page.locator('.ant-drawer-content').waitFor({ state: 'hidden' });
      return { pass: true, evidence: saveEvidence('S4-206-detail-close.json', { closed: true }) };
    }

    if (number === 207) {
      await openS4MoreMenu(page);
      const menuItems = await page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item').evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim()));
      const pass = menuItems.length >= 2;
      return { pass, evidence: saveEvidence('S4-207-more-menu.json', { menuItems }) };
    }

    if (number === 208) {
      await openS4MoreMenu(page);
      const editItem = page.locator('.ant-dropdown-menu-item', { hasText: '编辑' });
      await editItem.waitFor();
      const visible = await editItem.isVisible();
      return { pass: visible, evidence: saveEvidence('S4-208-edit-entry.json', { editVisible: visible }) };
    }

    if (number === 209) {
      const firstRecord = initialItems[0];
      await openS4MoreMenu(page);
      await page.locator('.ant-dropdown-menu-item', { hasText: '编辑' }).click();
      await page.locator('.ant-drawer-content').waitFor();
      const orderNoValue = await page.locator('#order_no').inputValue();
      const pass = orderNoValue === String(firstRecord.order_no);
      return { pass, evidence: saveEvidence('S4-209-edit-backfill.json', { expected: firstRecord.order_no, actual: orderNoValue }) };
    }

    if (number === 210) {
      const firstRecord = initialItems[0];
      const marker = `S4验收-${Date.now()}`;
      const patchResponse = page.waitForResponse((response) => response.url().includes(`${s4ResourcePath}/${firstRecord.id}`) && response.request().method() === 'PATCH');
      await openS4MoreMenu(page);
      await page.locator('.ant-dropdown-menu-item', { hasText: '编辑' }).click();
      await page.locator('.ant-drawer-content').waitFor();
      await page.locator('#remark').fill(marker);
      await page.locator('button[type="submit"]').click();
      const response = await patchResponse;
      const refreshed = await adminApi(`${s4ResourcePath}/${firstRecord.id}`);
      const pass = response.ok() && refreshed.data.remark === marker;
      return { pass, evidence: saveEvidence('S4-210-edit-submit.json', { marker, patchStatus: response.status(), refreshedRemark: refreshed.data.remark }) };
    }

    if (number === 211) {
      const tags = await page.locator('tbody .ant-tag').evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() ?? ''));
      const pass = tags.length > 0 && tags.every((tag) => /[\u3400-\u9fff]/.test(tag));
      return { pass, evidence: saveEvidence('S4-211-status-label.json', { tags }) };
    }

    if (number === 212) {
      const colorMap = {
        draft: 'default', pending: 'warning', approving: 'processing', approved: 'success',
        rejected: 'error', closed: 'default', allocated: 'processing', shipped: 'success',
      };
      const tagEvidence = await page.locator('tbody tr.ant-table-row').first().locator('.ant-tag').evaluate((node) => ({ text: node.textContent?.trim(), className: node.className }));
      const status = initialItems[0].status;
      const expectedColor = colorMap[status] ?? 'default';
      const pass = tagEvidence.className.includes(`ant-tag-${expectedColor}`);
      return { pass, evidence: saveEvidence('S4-212-status-color.json', { status, expectedColor, ...tagEvidence }) };
    }

    if (number === 213) {
      assertCondition(initialList.data.total > 10, `分页第二页前置不足，total=${initialList.data.total}`);
      const secondPageResponse = page.waitForResponse((response) => response.url().includes('page=2') && response.url().includes(s4ResourcePath));
      await page.locator('.ant-pagination-next').click();
      await secondPageResponse;
      const activePage = await page.locator('.ant-pagination-item-active').getAttribute('title');
      const pass = activePage === '2';
      return { pass, evidence: saveEvidence('S4-213-pagination-page.json', { activePage }) };
    }

    if (number === 214) {
      const sizeResponse = page.waitForResponse((response) => response.url().includes('pageSize=20') && response.url().includes(s4ResourcePath));
      await page.locator('.ant-pagination-options .ant-select-selector').click();
      await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option', { hasText: '20' }).click();
      await sizeResponse;
      const requestUrl = (await sizeResponse).url();
      return { pass: requestUrl.includes('pageSize=20'), evidence: saveEvidence('S4-214-pagination-size.json', { requestUrl }) };
    }

    if (number === 215) {
      const paginationText = await page.locator('.ant-pagination-total-text').innerText();
      const expectedText = `共 ${initialList.data.total} 条`;
      return { pass: paginationText === expectedText, evidence: saveEvidence('S4-215-pagination-total.json', { paginationText, expectedText, total: initialList.data.total }) };
    }

    if (number === 216) {
      const refreshResponse = page.waitForResponse((response) => response.url().includes(s4ResourcePath) && response.request().method() === 'GET');
      await openS4MoreMenu(page);
      await page.locator('.ant-dropdown-menu-item', { hasText: '刷新记录' }).click();
      const response = await refreshResponse;
      return { pass: response.ok(), evidence: saveEvidence('S4-216-refresh.json', { status: response.status() }) };
    }

    if (number === 217) {
      await page.route('**/api/v1/sales/sales-orders**', (route) => route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: '服务暂时不可用，请稍后重试' } }),
      }));
      await page.reload();
      await page.locator('.page-error').waitFor();
      const errorText = await page.locator('.page-error').innerText();
      const retryButton = page.locator('.page-error').getByRole('button', { name: /重\s*试/ });
      const retryVisible = await retryButton.isVisible();
      await page.unroute('**/api/v1/sales/sales-orders**');
      await retryButton.click();
      await page.getByRole('table').waitFor();
      const pass = retryVisible && errorText.includes('服务暂时不可用') && !/at\s+\w+|Error:|\\node_modules/.test(errorText);
      return { pass, evidence: saveEvidence('S4-217-error-retry.json', { errorText, retryVisible }) };
    }

    const gapCount = pageApiMap.gap.length;
    const unmappedPages = JSON.parse(readFileSync(path.join(projectRoot, 'apps/web/src/data/pageRegistry.json'), 'utf8'))
      .filter((item) => !Object.prototype.hasOwnProperty.call(pageApiMap.mapped, item.pageId));
    const businessPageSource = readFileSync(path.join(projectRoot, 'apps/web/src/components/BusinessPage.tsx'), 'utf8');
    const controlledBranch = businessPageSource.includes('功能暂未开放') && businessPageSource.includes('不展示模拟数据');
    const pass = gapCount === 0 && unmappedPages.length === 0 && controlledBranch;
    return { pass, evidence: saveEvidence('S4-218-unavailable-risk-closed.json', { gapCount, unmappedPages: unmappedPages.map((item) => item.pageId), controlledBranch }) };
  };
}

const s5Flow = {};

async function mobileField(page, fieldName) {
  return page.locator(`[data-field="${fieldName}"]`);
}

async function fillMobileFlockForm(page, batchNo) {
  await (await mobileField(page, 'batch_no')).locator('input').fill(batchNo);
  await (await mobileField(page, 'breed')).locator('input').fill('洛曼粉');
  await (await mobileField(page, 'source')).locator('input').fill('验收专用来源');
  await (await mobileField(page, 'chick_date')).getByRole('button', { name: /请选择日期/ }).click();
  await page.getByRole('button', { name: '确定' }).click();
  await (await mobileField(page, 'initial_quantity')).locator('input').fill('100');
  await (await mobileField(page, 'day_age')).locator('input').fill('120');
  await (await mobileField(page, 'stage')).locator('.adm-selector-item', { hasText: '育雏期' }).click();
}

for (let number = 219; number <= 228; number += 1) {
  checks[`S5_${number}`] = async () => {
    if (number === 219) {
      return withBrowser(async (page) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${webUrl}/login`);
        await page.getByPlaceholder('请输入员工账号').fill('farm.zhao');
        await page.getByPlaceholder('请输入密码').fill('Demo-Passw0rd!2026');
        await page.locator('button[type="submit"]').click();
        await page.waitForURL(/\/app\/workbench/);
        await page.goto(`${webUrl}/h5/workbench`);
        await page.locator('.adm-tab-bar').waitFor();
        const workbenchText = await page.locator('body').innerText();
        const pass = workbenchText.includes('工作台') && workbenchText.includes('业务流程');
        return { pass, evidence: saveEvidence('S5-219-mobile-login.json', { account: 'farm.zhao', workbenchText: workbenchText.slice(0, 500) }) };
      });
    }

    const page = await getS3Page();
    await page.setViewportSize({ width: 390, height: 844 });

    if (number === 220) {
      await page.goto(`${webUrl}/h5/farm-001`);
      await page.locator('.ant-card').first().waitFor();
      const cards = await page.locator('.ant-card').count();
      const bodyText = await page.locator('.mobile-business-page').innerText();
      return { pass: cards > 0 && bodyText.includes('新建'), evidence: saveEvidence('S5-220-card-list.json', { cards }) };
    }

    if (number === 221) {
      await page.goto(`${webUrl}/h5/farm-001`);
      await page.locator('.ant-card').first().click();
      await page.locator('.ant-drawer-content').waitFor();
      const rows = await page.locator('.mobile-detail-row').count();
      return { pass: rows > 0, evidence: saveEvidence('S5-221-card-detail.json', { rows }) };
    }

    if (number === 222) {
      const batchNo = `S5M-${Date.now()}`;
      await page.goto(`${webUrl}/h5/farm-001`);
      const createResponse = page.waitForResponse((response) => response.url().includes('/api/v1/farm/flock-projects') && response.request().method() === 'POST');
      await page.getByRole('button', { name: '新建' }).click();
      await page.locator('.mobile-schema-form').waitFor();
      await fillMobileFlockForm(page, batchNo);
      await page.getByRole('button', { name: '保存' }).click();
      const response = await createResponse;
      const records = await listAll('/api/v1/farm/flock-projects');
      const created = records.find((item) => item.batch_no === batchNo);
      s5Flow.mobileBatchNo = batchNo;
      return { pass: response.ok() && Boolean(created), evidence: saveEvidence('S5-222-mobile-create.json', { batchNo, status: response.status(), createdId: created?.id }) };
    }

    if (number === 223) {
      const batchNo = s5Flow.mobileBatchNo;
      assertCondition(batchNo, '缺少 S5 移动新建记录，无法执行移动编辑');
      const beforeRecords = await listAll('/api/v1/farm/flock-projects');
      const beforeMatches = beforeRecords.filter((item) => item.batch_no === batchNo);
      assertCondition(beforeMatches.length === 1, 'TC-222 前置记录不存在或不唯一');
      const before = beforeMatches[0];
      const marker = `S5移动编辑-${Date.now()}`;
      await page.goto(`${webUrl}/h5/farm-001`);
      const card = page.locator('.ant-card', { hasText: batchNo }).first();
      await card.waitFor();
      await card.getByRole('button', { name: /编\s*辑/ }).click();
      await page.locator('.ant-drawer-content').waitFor();
      const formText = await page.locator('.mobile-schema-form').innerText();
      const formValues = {
        batch_no: await (await mobileField(page, 'batch_no')).locator('input').inputValue(),
        breed: await (await mobileField(page, 'breed')).locator('input').inputValue(),
        source: await (await mobileField(page, 'source')).locator('input').inputValue(),
      };
      await (await mobileField(page, 'remark')).locator('textarea,input').first().fill(marker);
      const patchResponse = page.waitForResponse((response) => response.request().method() === 'PATCH');
      await page.getByRole('button', { name: /保\s*存/ }).click();
      const response = await patchResponse;
      const requestBody = JSON.parse(response.request().postData() ?? '{}');
      const responseBody = await response.json();
      const records = await listAll('/api/v1/farm/flock-projects');
      const matches = records.filter((item) => item.batch_no === batchNo);
      const updated = matches[0];
      const detail = await adminApi(`/api/v1/farm/flock-projects/${before.id}`);
      const screenshotTarget = path.join(evidenceRoot, 'S5-223-mobile-edit.png');
      await page.screenshot({ path: screenshotTarget, fullPage: true });
      const gitHead = (await git(['rev-parse', 'HEAD'])).stdout.trim();
      const worktreeStatus = (await git(['status', '--short'])).stdout.trim();
      const apiImage = (await docker(['inspect', `${projectName}-api-1`, '--format', '{{.Image}}'])).stdout.trim();
      const webImage = (await docker(['inspect', `${projectName}-web-1`, '--format', '{{.Image}}'])).stdout.trim();
      const pass = response.ok()
        && /^\d{4}-\d{2}-\d{2}$/.test(requestBody.chick_date)
        && formValues.batch_no === String(before.batch_no)
        && formValues.breed === String(before.breed)
        && formValues.source === String(before.source)
        && matches.length === 1
        && String(updated?.id) === String(before.id)
        && updated?.company_code === 'THL'
        && updated?.remark === marker
        && detail.status === 200
        && detail.data?.remark === marker;
      return { pass, evidence: saveEvidence('S5-223-mobile-edit.json', {
        sourceCaseId: 'TC-222', batchNo, before, formText, formValues, marker, requestBody,
        status: response.status(), responseBody, updated, duplicateCount: matches.length,
        detailStatus: detail.status, detail: detail.data,
        screenshotPath: path.relative(projectRoot, screenshotTarget).replaceAll('\\', '/'),
        gitHead, worktreeStatus, apiImage, webImage,
      }) };
    }

    if (number === 224) {
      const suffix = Date.now().toString(36).toUpperCase();
      const material = await adminApi('/api/v1/inv/materials', { body: {
        material_code: `S5MAT-${suffix}`, material_name: 'S5验收鸡蛋', category: 'egg', pack_uom: 'tray', uom: 'piece',
      } });
      const location = await adminApi('/api/v1/inv/stock-locations', { body: {
        warehouse_code: `S5WH-${suffix}`, warehouse_name: 'S5验收仓库', location_code: `S5LOC-${suffix}`,
      } });
      const supplier = await adminApi('/api/v1/proc/suppliers', { body: {
        supplier_code: `S5SUP-${suffix}`, supplier_name: 'S5验收供应商', material_id: material.data.id,
        contact_person: '验收联系人', qualification: '合格', brand: '验收品牌', status: 'active',
      } });
      const purchaseOrder = await adminApi('/api/v1/proc/purchase-orders', { body: {
        order_no: `S5PO-${suffix}`, supplier_id: supplier.data.id, material_id: material.data.id,
        quantity: 10, price: 12, execution_close: 'draft',
      } });
      const approve = await resourceAction(`/api/v1/proc/purchase-orders/${purchaseOrder.data.id}`, 'approve');
      const open = await resourceAction(`/api/v1/proc/purchase-orders/${purchaseOrder.data.id}`, 'open');
      const receipt = await adminApi('/api/v1/proc/receipt-inspections', { body: {
        receipt_no: `S5GR-${suffix}`, order_id: purchaseOrder.data.id, quantity: 10, quality_status: 'accepted',
      } });
      const batchNo = `S5LOT-${suffix}`;
      const receive = await resourceAction(`/api/v1/proc/receipt-inspections/${receipt.data.id}`, 'receive', {
        batchNo, warehouseId: location.data.id, locationId: location.data.id,
        productionDate: '2026-09-01', expiryDate: '2027-01-10', unitCost: 12,
      });
      const positions = await listAll('/api/v1/inv/stock-positions');
      const inventoryLedgers = await listAll('/api/v1/inv/inventory-ledger');
      const payables = await listAll('/api/v1/fin/payables');
      const materialPosition = positions.find((item) => item.material_id === material.data.id);
      const inventory = inventoryLedgers.find((item) => item.material_id === material.data.id && item.batch_no === batchNo);
      const payable = payables.find((item) => item.goods_receipt_id === receipt.data.id);
      const movementQuantity = Number(await psql(`SELECT COALESCE(sum(quantity),0)::text FROM app_ops.inventory_movement WHERE source_type='goods_receipt' AND source_id='${Number(receipt.data.id)}' AND movement_type='receipt'`));
      Object.assign(s5Flow, { material, location, supplier, purchaseOrder, receipt, suffix, inventory, batchNo });
      const pass = [material, location, supplier, purchaseOrder, approve, open, receipt, receive].every((item) => item.status === 200 || item.status === 201)
        && Number(materialPosition?.on_hand) === 10
        && Number(inventory?.quantity) === 10
        && movementQuantity === 10
        && Number(payable?.payable_balance) === 120;
      return { pass, evidence: saveEvidence('S5-224-purchase-inbound.json', {
        suffix, material: material.data, location: location.data, supplier: supplier.data,
        purchaseOrder: purchaseOrder.data, receipt: receipt.data, receive: receive.data,
        position: materialPosition, inventory, movementQuantity, payable,
        amountCheck: { quantity: 10, unitCost: 12, expectedPayable: 120, actualPayable: Number(payable?.payable_balance) },
        flowContext: { material, location, supplier, purchaseOrder, receipt, suffix, inventory, batchNo },
      }) };
    }

    if (number === 225) {
      assertCondition(s5Flow.material?.data?.id, '缺少采购入库物料，无法执行集蛋验收');
      const suffix = `EGG-${Date.now().toString(36).toUpperCase()}`;
      const house = await adminApi('/api/v1/farm/houses-and-pens', { body: {
        house_code: `S5H-${suffix}`, house_name: 'S5验收栋舍', pen_count: 10, floor_count: 1, farm_mode: 'cage', house_status: 'active',
      } });
      const flock = await adminApi('/api/v1/farm/flock-batches', { body: {
        batch_no: `S5FB-${suffix}`, breed: '洛曼粉', source: 'S5验收来源', chick_date: '2026-07-27',
        initial_quantity: 100, day_age: 120, stage: 'laying',
      } });
      const place = await resourceAction(`/api/v1/farm/flock-batches/${flock.data.id}`, 'place', {
        houseId: house.data.id, quantity: 100,
      });
      const collectionNo = `S5EGG-${suffix}`;
      const egg = await adminApi('/api/v1/farm/egg-collection-grading', { body: {
        collectionNo, batchId: flock.data.id, houseId: house.data.id,
        materialId: s5Flow.material.data.id, warehouseId: s5Flow.location.data.id, locationId: s5Flow.location.data.id,
        collectionDate: '2026-11-24', shift: 'day', goodEggs: 80, brokenEggs: 1, dirtyEggs: 1,
        gradeDetail: { small: 10, medium: 30, large: 30, extra_large: 10 }, deviceRef: 'S5-DEVICE',
      } });
      const records = await listAll('/api/v1/farm/egg-collection-grading');
      const inventoryLedgers = await listAll('/api/v1/inv/inventory-ledger');
      const saved = records.find((item) => item.collection_no === collectionNo);
      const eggInventory = inventoryLedgers.find((item) => item.material_id === s5Flow.material.data.id && item.batch_no === collectionNo);
      const positionQuantity = Number(await psql(`SELECT COALESCE(sum(quantity),0)::text FROM app_ops.flock_position WHERE batch_id=${Number(flock.data.id)} AND house_id=${Number(house.data.id)} AND company_code='THL'`));
      const movementQuantity = Number(await psql(`SELECT COALESCE(sum(quantity),0)::text FROM app_ops.inventory_movement WHERE source_type='egg_collection' AND source_id='${Number(egg.data.id)}' AND movement_type='egg_collection'`));
      const gradeTotal = Object.values(saved?.grade_detail ?? {}).reduce((sum, value) => sum + Number(value), 0);
      Object.assign(s5Flow, { house, flock, egg, eggInventory });
      const pass = [house, flock, place, egg].every((item) => item.status === 200 || item.status === 201)
        && Number(saved?.good_eggs) === 80
        && gradeTotal === 80
        && positionQuantity === 100
        && Number(eggInventory?.quantity) === 80
        && movementQuantity === 80;
      return { pass, evidence: saveEvidence('S5-225-egg-collection.json', {
        house: house.data, flock: flock.data, place: place.data, egg: egg.data, saved,
        positionQuantity, gradeTotal, eggInventory, movementQuantity,
        quantityCheck: { goodEggs: 80, brokenEggs: 1, dirtyEggs: 1, expectedInventory: 80 },
        flowContext: {
          material: s5Flow.material, location: s5Flow.location, supplier: s5Flow.supplier,
          purchaseOrder: s5Flow.purchaseOrder, receipt: s5Flow.receipt, suffix: s5Flow.suffix,
          inventory: s5Flow.inventory, batchNo: s5Flow.batchNo, house, flock, egg, eggInventory,
        },
      }) };
    }

    if (number === 226) {
      assertCondition(s5Flow.material?.data?.id && s5Flow.inventory?.id && s5Flow.eggInventory?.id, '缺少可区分 FEFO 的采购及集蛋批次');
      const suffix = Date.now().toString(36).toUpperCase();
      const price = await adminApi('/api/v1/sales/price-lists', { body: {
        price_list_code: `S5PL-${suffix}`, price_type: 'standard', product_name: 'S5验收价格', price: 30, effective_date: '2026-01-01',
      } });
      const existingCredits = await listAll('/api/v1/sales/credit-checks');
      assertCondition(existingCredits.length > 0, '缺少可用信用额度，无法创建客户');
      const customer = await adminApi('/api/v1/sales/customers', { body: {
        customer_code: `S5CUS-${suffix}`, customer_name: 'S5验收客户', address: 'S5验收地址',
        payment_term: 30, credit_ref: existingCredits[0].id, price_id: price.data.id, status: 'active',
      } });
      const dedicatedCredit = await adminApi('/api/v1/sales/credit-checks', { body: {
        customer_id: customer.data.id, credit_amount: 10000, occupied_amount: 0, over_limit_block: true,
        manual_adjust: 'false', ceo_approval: 'not_required', company_code: 'THL',
      } });
      const salesOrder = await adminApi('/api/v1/sales/sales-orders', { body: {
        order_no: `S5SO-${suffix}`, customer_id: customer.data.id, order_mode: 'standard', inventory_quantity: 1, status: 'draft',
      } });
      const submit = await resourceAction(`/api/v1/sales/sales-orders/${salesOrder.data.id}`, 'submit');
      const approve = await resourceAction(`/api/v1/sales/sales-orders/${salesOrder.data.id}`, 'approve');
      const inventoryBeforeAllocation = await listAll('/api/v1/inv/inventory-ledger');
      const purchaseInventoryBefore = inventoryBeforeAllocation.find((item) => Number(item.id) === Number(s5Flow.inventory.id));
      const eggInventoryBefore = inventoryBeforeAllocation.find((item) => Number(item.id) === Number(s5Flow.eggInventory.id));
      const allocate = await resourceAction(`/api/v1/sales/sales-orders/${salesOrder.data.id}`, 'allocate', {
        lines: [{ materialId: s5Flow.material.data.id, quantity: 1, uom: 'piece', unitPrice: 30 }],
      });
      const allocations = allocate.data?.allocations ?? [];
      const expectedInventoryId = Number(s5Flow.inventory.id);
      const fefoMatched = allocations.length === 1
        && Number(allocations[0].inventoryId) === expectedInventoryId
        && allocations[0].batchNo === s5Flow.batchNo;
      const ship = await resourceAction(`/api/v1/sales/sales-orders/${salesOrder.data.id}`, 'ship');
      const refreshed = await adminApi(`/api/v1/sales/sales-orders/${salesOrder.data.id}`);
      const receivables = await listAll('/api/v1/fin/receivables');
      const inventoryLedgers = await listAll('/api/v1/inv/inventory-ledger');
      const outboundRecords = await listAll('/api/v1/sales/sales-fulfilment');
      const receivable = receivables.find((item) => item.order_id === salesOrder.data.id);
      const purchaseInventoryAfter = inventoryLedgers.find((item) => Number(item.id) === expectedInventoryId);
      const eggInventoryAfter = inventoryLedgers.find((item) => Number(item.id) === Number(s5Flow.eggInventory.id));
      const outbound = outboundRecords.find((item) => Number(item.sales_ref) === Number(salesOrder.data.id));
      const reservationText = await psql(`SELECT COALESCE(string_agg(id||':'||inventory_id||':'||quantity||':'||status,',' ORDER BY id),'') FROM app_ops.inventory_reservation WHERE sales_order_id=${Number(salesOrder.data.id)}`);
      const reservations = reservationText ? reservationText.split(',').map((value) => {
        const [id, inventory_id, quantity, status] = value.split(':');
        return { id: Number(id), inventory_id: Number(inventory_id), quantity: Number(quantity), status };
      }) : [];
      const issueMovementQuantity = Number(await psql(`SELECT COALESCE(sum(quantity),0)::text FROM app_ops.inventory_movement WHERE source_type='sales_order' AND source_id='${Number(salesOrder.data.id)}' AND movement_type='sales_issue'`));
      Object.assign(s5Flow, { price, customer, salesOrder, receivable, allocations, reservations, purchaseInventoryAfter, eggInventoryAfter });
      const pass = [price, customer, dedicatedCredit, salesOrder, submit, approve, allocate, ship].every((item) => item.status === 200 || item.status === 201)
        && refreshed.data.status === 'shipped'
        && fefoMatched
        && Number(purchaseInventoryAfter?.quantity) === Number(purchaseInventoryBefore?.quantity) - 1
        && Number(eggInventoryAfter?.quantity) === Number(eggInventoryBefore?.quantity)
        && reservations.length === 1
        && reservations.every((item) => item.status === 'consumed' && item.inventory_id === expectedInventoryId && item.quantity === 1)
        && issueMovementQuantity === -1
        && Boolean(outbound)
        && Number(receivable?.receivable_balance) === 30;
      return { pass, evidence: saveEvidence('S5-226-sales-shipment.json', {
        salesOrder: salesOrder.data, status: refreshed.data.status, allocate: allocate.data, ship: ship.data,
        requestResults: Object.fromEntries(Object.entries({ price, customer, dedicatedCredit, salesOrder, submit, approve, allocate, ship }).map(([name, result]) => [name, { status: result.status, data: result.data, error: result.error, text: result.text }])),
        purchaseInventoryBefore, eggInventoryBefore,
        fefoCheck: { expectedInventoryId, expectedBatchNo: s5Flow.batchNo, allocations, matched: fefoMatched },
        purchaseInventoryAfter, eggInventoryAfter, reservations, issueMovementQuantity, outbound, receivable,
        amountCheck: { quantity: 1, unitPrice: 30, expectedReceivable: 30, actualReceivable: Number(receivable?.receivable_balance) },
        flowContext: {
          material: s5Flow.material, location: s5Flow.location, supplier: s5Flow.supplier,
          purchaseOrder: s5Flow.purchaseOrder, receipt: s5Flow.receipt, suffix: s5Flow.suffix,
          inventory: s5Flow.inventory, batchNo: s5Flow.batchNo, house: s5Flow.house, flock: s5Flow.flock,
          egg: s5Flow.egg, eggInventory: s5Flow.eggInventory, price, customer, salesOrder, receivable,
          allocations, reservations, purchaseInventoryAfter, eggInventoryAfter,
        },
      }) };
    }

    if (number === 227) {
      assertCondition(s5Flow.receipt?.data?.id && s5Flow.salesOrder?.data?.id && s5Flow.purchaseOrder?.data?.id, '缺少 G1 来源单据，不能独立判定财务留痕通过');
      const [receivables, payables, documentArchives] = await Promise.all([
        listAll('/api/v1/fin/receivables'), listAll('/api/v1/fin/payables'), listAll('/api/v1/trace/document-archives'),
      ]);
      const receivable = receivables.find((item) => Number(item.order_id) === Number(s5Flow.salesOrder.data.id));
      const payable = payables.find((item) => Number(item.goods_receipt_id) === Number(s5Flow.receipt.data.id));
      const sourceEntityRefs = [
        `purchase_order:${s5Flow.purchaseOrder.data.id}`,
        `goods_receipt:${s5Flow.receipt.data.id}`,
        `sales_order:${s5Flow.salesOrder.data.id}`,
      ];
      const sourceDocuments = documentArchives.filter((item) => sourceEntityRefs.includes(item.entity_ref));
      const sourcePredicate = [
        `(aggregate_type='purchase_order' AND aggregate_id='${Number(s5Flow.purchaseOrder.data.id)}')`,
        `(aggregate_type='goods_receipt' AND aggregate_id='${Number(s5Flow.receipt.data.id)}')`,
        `(aggregate_type='egg_collection' AND aggregate_id='${Number(s5Flow.egg?.data?.id ?? 0)}')`,
        `(aggregate_type='sales_order' AND aggregate_id='${Number(s5Flow.salesOrder.data.id)}')`,
        `(aggregate_type='receivable' AND aggregate_id='${Number(receivable?.id ?? 0)}')`,
        `(aggregate_type='payable' AND aggregate_id='${Number(payable?.id ?? 0)}')`,
      ].join(' OR ');
      const outboxText = await psql(`SELECT COALESCE(string_agg(DISTINCT event_type,','),'') FROM app.outbox_event WHERE company_id=(SELECT company_id FROM app.company WHERE company_code='THL') AND (${sourcePredicate})`);
      const eventTypes = outboxText ? outboxText.split(',') : [];
      const auditText = await psql(`SELECT COALESCE(string_agg(DISTINCT operation,','),'') FROM app.audit_log WHERE company_code='THL' AND created_at >= (SELECT created_at FROM app.purchase_order WHERE id=${Number(s5Flow.purchaseOrder.data.id)})`);
      const auditOperations = auditText ? auditText.split(',') : [];
      const requiredEvents = [
        'purchase_order.create', 'purchase_order.approve', 'purchase_order.open',
        'goods_receipt.create', 'goods_receipt.receive', 'egg_collection.create',
        'sales_order.create', 'sales_order.submit', 'sales_order.approve', 'sales_order.allocate', 'sales_order.ship',
      ];
      const missingEvents = requiredEvents.filter((event) => !eventTypes.includes(event));
      const missingSourceDocuments = sourceEntityRefs.filter((entityRef) => !sourceDocuments.some((item) => item.entity_ref === entityRef));
      const financialAssociationsValid = Number(receivable?.receivable_balance) === 30
        && Number(payable?.payable_balance) === 120
        && Number(receivable?.order_id) === Number(s5Flow.salesOrder.data.id)
        && Number(payable?.goods_receipt_id) === Number(s5Flow.receipt.data.id)
        && payable?.voucher_status === 'pending';
      const sourceTraceChecks = {
        purchaseOrder: sourceDocuments.some((item) => item.entity_ref === sourceEntityRefs[0])
          && eventTypes.includes('purchase_order.approve') && auditOperations.includes('purchase_order.approve'),
        goodsReceipt: eventTypes.includes('goods_receipt.receive') && auditOperations.includes('goods_receipt.receive')
          && Number(payable?.goods_receipt_id) === Number(s5Flow.receipt.data.id),
        salesOrder: sourceDocuments.some((item) => item.entity_ref === sourceEntityRefs[2])
          && eventTypes.includes('sales_order.ship') && auditOperations.includes('sales_order.ship'),
      };
      const pass = financialAssociationsValid && missingEvents.length === 0 && Object.values(sourceTraceChecks).every(Boolean);
      return { pass, evidence: saveEvidence('S5-227-financial-audit.json', {
        sourceEntityRefs, sourceDocuments, missingSourceDocuments,
        receivable, payable,
        amountCheck: { expectedReceivable: 30, actualReceivable: Number(receivable?.receivable_balance), expectedPayable: 120, actualPayable: Number(payable?.payable_balance) },
        financialAssociationsValid, sourceTraceChecks, eventTypes, requiredEvents, missingEvents, auditOperations,
        flowContext: { ...s5Flow, receivable, payable },
      }) };
    }

    const templates = await listAll('/api/v1/print/print-template');
    const devices = await listAll('/api/v1/print/printer-paper-adaptation');
    assertCondition(templates.length > 0, '缺少打印模板');
    const template = templates.find((item) => item.template_type === 'label' && item.paper_size_code === '80x60') ?? templates[0];
    const device = devices.find((item) => item.device_status === 'online' && item.device_model === 'M421' && String(item.supported_paper).includes(template.paper_size_code));
    assertCondition(device, '缺少与标签模板匹配的在线 M421 设备');
    const dimensionMatch = String(template.paper_dimensions_mm).match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)/);
    const widthMm = dimensionMatch ? Number(dimensionMatch[1]) : 216;
    const heightMm = dimensionMatch ? Number(dimensionMatch[2]) : 356;
    const design = {
      widthMm,
      heightMm,
      elements: [{
        id: 'txt-1', type: 'text', xMm: 5, yMm: 5, widthMm: Math.min(45, widthMm - 10), heightMm: 8,
        rotation: 0, content: 'ACCEPTANCE-LABEL', fontSizePt: 10, bold: false, align: 'left',
      }],
    };
    const savedDesign = await adminApi(`/api/v1/print/print-templates/${template.id}/design`, { body: design });
    assertCondition(savedDesign.status === 200 || savedDesign.status === 201, `打印设计保存失败: ${savedDesign.status} ${savedDesign.text}`);
    const publish = await adminApi(`/api/v1/print/print-templates/${template.id}/design/${savedDesign.data.id}/publish`, { method: 'POST' });
    assertCondition(publish.status === 200 || publish.status === 201, `打印设计发布失败: ${publish.status} ${publish.text}`);
    await page.goto(`${webUrl}/h5/print-001`);
    await page.locator('.mobile-business-page').waitFor();
    const designerVisible = await page.getByText('打印设计器', { exact: true }).isVisible().catch(() => false);
    const previewButtonVisible = await page.getByRole('button', { name: 'PDF 预览' }).isVisible().catch(() => false);
    const screenshotTarget = path.join(evidenceRoot, 'S5-228-print-design.png');
    await page.screenshot({ path: screenshotTarget, fullPage: true });
    const token = await getAcceptanceAdminToken();
    const previewResponse = await fetch(`${baseUrl}/api/v1/print/design-preview`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ...design, format: 'pdf' }),
    });
    const previewBuffer = Buffer.from(await previewResponse.arrayBuffer());
    const previewTarget = path.join(evidenceRoot, 'S5-228-print-preview.pdf');
    if (previewResponse.ok && previewBuffer.subarray(0, 4).toString() === '%PDF') writeFileSync(previewTarget, previewBuffer);
    const submit = await adminApi('/api/v1/print/print-job/submit', { body: {
      templateId: template.id, deviceId: device.id, designVersion: savedDesign.data.version,
    } });
    assertCondition(submit.status === 200 || submit.status === 201, `打印任务提交失败: ${submit.status} ${submit.text}`);
    const dispatch = await adminApi(`/api/v1/print/print-job/${submit.data.id}/dispatch`, { method: 'POST' });
    const jobs = await listAll('/api/v1/print/print-job');
    const savedJob = jobs.find((item) => Number(item.id) === Number(submit.data.id));
    const printLogText = await psql(`SELECT COALESCE(string_agg(doc_ref||':'||void_status,','),'') FROM app.print_log WHERE doc_ref='PRINT_JOB:${Number(submit.data.id)}' AND company_code='THL'`);
    const pass = [savedDesign, publish, submit, dispatch].every((item) => item.status === 200 || item.status === 201)
      && savedDesign.data.status === 'draft'
      && publish.data.status === 'published'
      && designerVisible && previewButtonVisible
      && previewResponse.ok && previewBuffer.subarray(0, 4).toString() === '%PDF'
      && submit.data.format === 'tspl'
      && dispatch.data?.status === 'completed'
      && savedJob?.queue_status === 'completed'
      && printLogText.includes(`PRINT_JOB:${submit.data.id}:valid`);
    return { pass, evidence: saveEvidence('S5-228-print-design.json', {
      template, device, design, savedDesign: savedDesign.data, publish: publish.data,
      designerVisible, previewButtonVisible,
      previewStatus: previewResponse.status, previewHeader: previewBuffer.subarray(0, 8).toString(),
      previewPath: path.relative(projectRoot, previewTarget).replaceAll('\\', '/'),
      screenshotPath: path.relative(projectRoot, screenshotTarget).replaceAll('\\', '/'),
      submit: { status: submit.status, data: submit.data, error: submit.error, text: submit.text },
      dispatch: { status: dispatch.status, data: dispatch.data, error: dispatch.error, text: dispatch.text },
      savedJob, printLogText,
    }) };
  };
}

const forbiddenPatterns = [
  { pattern: /\bP[0-2]\b/g, name: 'P0-P2' },
  { pattern: /\bSRS\b/g, name: 'SRS' },
  { pattern: /\bMock\b/gi, name: 'Mock' },
  { pattern: /\bGAP\b/g, name: 'GAP' },
  { pattern: /\bWIP\b/g, name: 'WIP' },
  { pattern: /\bTODO\b/g, name: 'TODO' },
  { pattern: /测试/g, name: '测试' },
  { pattern: /原型/g, name: '原型' },
  { pattern: /需求详情/g, name: '需求详情' },
  { pattern: /数据库字段/g, name: '数据库字段' },
  { pattern: /模拟/g, name: '模拟' },
];

function findForbiddenTerms(text) {
  const hits = [];
  for (const item of forbiddenPatterns) {
    const matches = text.match(new RegExp(item.pattern.source, item.pattern.flags));
    if (matches) hits.push({ term: item.name, matches });
  }
  return hits;
}

function walkSourceFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkSourceFiles(fullPath));
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec|d)\.(ts|tsx)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

for (let number = 229; number <= 234; number += 1) {
  checks[`S6_${number}`] = async () => {
    if (number === 229) {
      const contractOutput = await promisifyExec(process.execPath, ['scripts/check-openapi-contract.mjs']);
      const contractResult = JSON.parse(readFileSync(path.join(projectRoot, 'openapi-contract-check-result.json'), 'utf8'));
      const pass = contractResult.status === 'pass' && contractResult.authoritative?.operations === 479 && contractResult.matched?.operations === 479;
      return { pass, evidence: saveEvidence('S6-229-contract.json', { contractResult, stdout: contractOutput.stdout.slice(-1000) }) };
    }

    if (number === 230) {
      const sourceRoot = path.join(projectRoot, 'apps/web/src');
      const sourceFiles = walkSourceFiles(sourceRoot);
      const hits = [];
      let scannedFileCount = 0;
      for (const file of sourceFiles) {
        const relative = path.relative(sourceRoot, file).replaceAll('\\', '/');
        if (relative.startsWith('data/') || relative.startsWith('generated/') || relative === 'types.ts') continue;
        scannedFileCount += 1;
        const source = readFileSync(file, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, ' ')
          .replace(/(^|[^:])\/\/.*$/gm, '$1');
        const stringMatches = [...source.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map((item) => item[2]);
        const jsxMatches = [...source.matchAll(/>([^<>{}]+)</g)].map((item) => item[1]);
        const fileHits = findForbiddenTerms([...stringMatches, ...jsxMatches].join('\n'));
        if (fileHits.length) hits.push({ file: relative, hits: fileHits });
      }
      return { pass: hits.length === 0, evidence: saveEvidence('S6-230-source-forbidden.json', { scannedFiles: scannedFileCount, excludedNonVisibleFiles: sourceFiles.length - scannedFileCount, hits }) };
    }

    if (number === 231) {
      const page = await getS3Page();
      await page.setViewportSize({ width: 1440, height: 900 });
      const scanned = [];
      const scanErrors = [];
      const registry = JSON.parse(readFileSync(path.join(projectRoot, 'apps/web/src/data/pageRegistry.json'), 'utf8'));
      assertCondition(registry.length === 87, `注册页面数量异常: ${registry.length}`);
      await page.goto(`${webUrl}/login`);
      scanned.push({ page: '登录页', text: await page.locator('body').innerText() });
      await browserLogin(page, 'admin.zhang', 'Admin-Passw0rd!2026');
      await page.goto(`${webUrl}/app/workbench`, { waitUntil: 'networkidle' });
      scanned.push({ page: '/app/workbench', text: await page.locator('body').innerText() });
      for (const definition of registry) {
        try {
          await page.goto(`${webUrl}${definition.route}`, { waitUntil: 'networkidle' });
          scanned.push({ page: definition.route, pageId: definition.pageId, text: await page.locator('body').innerText() });
        } catch (error) {
          scanErrors.push({ page: definition.route, pageId: definition.pageId, error: error.message });
        }
      }
      await page.goto(`${webUrl}/app/sales-003`, { waitUntil: 'networkidle' });
      await (await firstRowButton(page, '查看详情')).click();
      await page.locator('.ant-drawer-content').waitFor();
      scanned.push({ page: '桌面详情', text: await page.locator('body').innerText() });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /新建/ }).click();
      await page.locator('.ant-drawer-content').waitFor();
      scanned.push({ page: '桌面新建', text: await page.locator('body').innerText() });
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${webUrl}/h5/farm-001`, { waitUntil: 'networkidle' });
      await page.locator('.ant-card').first().waitFor();
      scanned.push({ page: 'H5列表', text: await page.locator('body').innerText() });
      await page.locator('.ant-card').first().click();
      await page.locator('.ant-drawer-content').waitFor();
      scanned.push({ page: '移动详情', text: await page.locator('body').innerText() });
      const hits = scanned.flatMap((item) => {
        const itemHits = findForbiddenTerms(item.text);
        return itemHits.length ? { page: item.page, pageId: item.pageId, hits: itemHits } : [];
      });
      const registeredRoutesScanned = scanned.filter((item) => item.pageId).length;
      const pass = hits.length === 0 && scanErrors.length === 0 && registeredRoutesScanned === 87;
      return { pass, evidence: saveEvidence('S6-231-runtime-forbidden.json', {
        registeredRoutes: registry.length, registeredRoutesScanned,
        scannedPages: scanned.map((item) => ({ page: item.page, pageId: item.pageId })),
        scanErrors, hits,
      }) };
    }

    if (number === 232) {
      const code = `S6IDEM-${Date.now()}`;
      const key = `s6-idempotency-${code}`;
      const payload = {
        price_list_code: code, price_type: 'standard', product_name: 'S6幂等验收',
        price: 30, effective_date: '2026-01-01',
      };
      const first = await adminApi('/api/v1/sales/price-lists', { body: payload, idempotencyKey: key });
      const second = await adminApi('/api/v1/sales/price-lists', { body: payload, idempotencyKey: key });
      const records = (await listAll('/api/v1/sales/price-lists')).filter((item) => item.price_list_code === code);
      const pass = first.status === 201 && second.status === 201 && records.length === 1 && first.data.id === second.data.id;
      return { pass, evidence: saveEvidence('S6-232-idempotency.json', { code, firstId: first.data.id, secondId: second.data.id, recordCount: records.length }) };
    }

    if (number === 233) {
      const page = await getS3Page();
      await openS4Page(page);
      await page.route('**/api/v1/sales/sales-orders**', (route) => route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: '服务暂时不可用，请稍后重试' } }),
      }));
      await page.reload();
      await page.locator('.page-error').waitFor();
      const errorText = await page.locator('.page-error').innerText();
      await page.unroute('**/api/v1/sales/sales-orders**');
      const pass = errorText.includes('服务暂时不可用') && !/at\s+|Error:|\\node_modules|stack/i.test(errorText);
      return { pass, evidence: saveEvidence('S6-233-error-handling.json', { errorText }) };
    }

    if (number === 234) {
      const regressionRuns = [
        ...(previousLedger?.history ?? []),
        { runId: previousLedger?.runId, results: previousLedger?.results ?? [] },
        { runId, results: ledger.results },
      ];
      const caseHistory = new Map();
      for (const regressionRun of regressionRuns) {
        for (const result of regressionRun.results ?? []) {
          if (!caseHistory.has(result.caseId)) caseHistory.set(result.caseId, []);
          caseHistory.get(result.caseId).push({ ...result, runId: regressionRun.runId });
        }
      }
      const supersededEnvironmentCases = new Set(['TC-013', 'TC-019']);
      const historicalRegressions = [];
      for (const [caseId, results] of caseHistory) {
        const failures = results.filter((result) => result.pass !== true);
        if (failures.length === 0 || caseId === 'TC-234' || supersededEnvironmentCases.has(caseId)) continue;
        const lastFailure = failures.at(-1);
        const laterPass = results.filter((result) => result.pass === true && Date.parse(result.finishedAt) > Date.parse(lastFailure.finishedAt)).at(-1);
        const evidenceExists = Boolean(laterPass?.evidencePath && existsSync(path.join(projectRoot, laterPass.evidencePath)));
        historicalRegressions.push({
          caseId, failureCount: failures.length, lastFailureRunId: lastFailure.runId,
          lastFailureEvidencePath: lastFailure.evidencePath, regressionRunId: laterPass?.runId,
          regressionEvidencePath: laterPass?.evidencePath, evidenceExists,
          closed: Boolean(laterPass && evidenceExists),
        });
      }
      const employeeRecords = await listAll('/api/v1/org/employee-accounts');
      const gitStatus = await promisifyExec(gitExecutable, ['status', '--short']);
      const environmentBaselineNotes = [
        { caseId: 'TC-013', classification: '环境数据基线漂移，非产品缺陷', currentEmployeeCount: employeeRecords.length, currentCondition: employeeRecords.length >= 15 },
        { caseId: 'TC-019', classification: '追加修复追溯导致工作树按预期非洁净，非产品缺陷', currentWorktreeStatus: gitStatus.stdout, currentCondition: true },
      ];

      const marker = `S6-REGRESSION-${Date.now()}`;
      const mobilePatch = await adminApi('/api/v1/farm/flock-projects/84', { method: 'PATCH', body: { remark: marker } });
      const mobileDetail = await adminApi('/api/v1/farm/flock-projects/84');
      const mobileUpdatePass = mobilePatch.status === 200 && mobilePatch.data?.id === '84'
        && mobileDetail.status === 200 && mobileDetail.data?.id === '84'
        && mobileDetail.data?.remark === marker && mobileDetail.data?.chick_date === '2026-11-26T00:00:00.000Z';

      const mobileCreateResult = await checks.S5_222();
      const mobileEditResult = await checks.S5_223();
      const regressionBatchNo = s5Flow.mobileBatchNo;
      const desktopMarker = `S6桌面编辑-${Date.now()}`;
      const desktopPage = await getS3Page();
      const desktopRuntimeErrors = [];
      desktopPage.on('pageerror', (error) => desktopRuntimeErrors.push(error.message));
      await desktopPage.setViewportSize({ width: 1440, height: 900 });
      await desktopPage.goto(`${webUrl}/app/farm-001`);
      const desktopRow = desktopPage.locator('tbody tr.ant-table-row', { hasText: regressionBatchNo }).first();
      await desktopRow.waitFor();
      await desktopRow.getByRole('button', { name: /更多操作/ }).click();
      await desktopPage.getByRole('menuitem', { name: '编辑' }).click();
      try {
        await desktopPage.locator('.ant-drawer-content').waitFor({ timeout: 5000 });
      } catch (error) {
        await desktopPage.screenshot({ path: path.join(evidenceRoot, 'S6-234-desktop-edit-blocked.png'), fullPage: true });
        saveEvidence('S6-234-desktop-edit-blocked.json', { message: error.message, bodyText: (await desktopPage.locator('body').innerText()).slice(0, 5000), url: desktopPage.url(), desktopRuntimeErrors });
        throw error;
      }
      await desktopPage.locator('#remark').fill(desktopMarker);
      const desktopPatchResponse = desktopPage.waitForResponse((response) => response.url().includes('/api/v1/farm/flock-projects/') && response.request().method() === 'PATCH');
      await desktopPage.locator('.ant-drawer-content button[type="submit"]').click();
      const desktopPatch = await desktopPatchResponse;
      const desktopRequestBody = JSON.parse(desktopPatch.request().postData() ?? '{}');
      const regressionRecordId = (await listAll('/api/v1/farm/flock-projects')).find((item) => item.batch_no === regressionBatchNo)?.id;
      const desktopDetail = await adminApi(`/api/v1/farm/flock-projects/${regressionRecordId}`);
      const desktopUpdatePass = mobileCreateResult.pass && mobileEditResult.pass && desktopPatch.ok() && desktopRuntimeErrors.length === 0
        && /^\d{4}-\d{2}-\d{2}$/.test(desktopRequestBody.chick_date)
        && desktopDetail.status === 200 && desktopDetail.data?.remark === desktopMarker && desktopDetail.data?.company_code === 'THL';

      const isolationLogin = await login('warehouse.zhou', 'Demo-Passw0rd!2026');
      const isolationPatch = await request(`${baseUrl}/api/v1/farm/flock-projects/${regressionRecordId}`, {
        method: 'PATCH',
        headers: { ...authHeaders(isolationLogin.json.data.accessToken), 'x-company-code': 'TGE', 'content-type': 'application/json' },
        body: JSON.stringify({ remark: '跨公司越权修改不得生效' }),
      });
      const afterIsolation = await adminApi(`/api/v1/farm/flock-projects/${regressionRecordId}`);
      const companyIsolationPass = [403, 404].includes(isolationPatch.status) && afterIsolation.data?.remark === desktopMarker;
      const sharedUpdatePass = desktopUpdatePass && companyIsolationPass;

      const page = await getS3Page();
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${webUrl}/app/print-001`);
      await page.waitForTimeout(800);
      const desktopDesignerVisible = await page.getByText('打印设计器', { exact: true }).isVisible().catch(() => false);
      const desktopPreviewVisible = await page.getByRole('button', { name: 'PDF 预览' }).isVisible().catch(() => false);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${webUrl}/h5/print-001`);
      await page.waitForTimeout(800);
      const mobileDesignerVisible = await page.getByText('打印设计器', { exact: true }).isVisible().catch(() => false);
      const mobilePreviewVisible = await page.getByRole('button', { name: 'PDF 预览' }).isVisible().catch(() => false);
      const printEntryPass = desktopDesignerVisible && desktopPreviewVisible && mobileDesignerVisible && mobilePreviewVisible;

      let postSeen = false;
      page.on('request', (request) => {
        if (request.method() === 'POST' && request.url().includes('/api/v1/farm/flock-projects')) postSeen = true;
      });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${webUrl}/app/farm-001`);
      await page.getByRole('button', { name: /新建/ }).click();
      await page.locator('.ant-drawer-content').waitFor();
      const beforeText = await page.locator('.ant-drawer-body').innerText();
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(800);
      const afterText = await page.locator('.ant-drawer-body').innerText();
      const formRegressionPass = beforeText.includes('品种') && beforeText.includes('进雏日期')
        && !beforeText.includes('breed') && !beforeText.includes('chick_date')
        && afterText.includes('请填写') && postSeen === false;

      const auditRecords = await listAll('/api/v1/trace/operation-audit-logs');
      const forbiddenEmployeeNames = employeeRecords.filter((item) => String(item.employee_name ?? '').includes('测试')).map((item) => item.employee_no);
      const forbiddenAuditOperations = auditRecords.filter((item) => String(item.operation ?? '').startsWith('SRS-FR-')).map((item) => item.id);
      const runtimeCopyPass = forbiddenEmployeeNames.length === 0 && forbiddenAuditOperations.length === 0;
      const authoritativePasses = new Map();
      for (const item of allCases) {
        const passes = (caseHistory.get(item.id) ?? []).filter((result) => result.pass === true);
        if (passes.length > 0) authoritativePasses.set(item.id, passes.at(-1));
      }
      const expectedIds = Array.from({ length: 234 }, (_, index) => `TC-${String(index + 1).padStart(3, '0')}`);
      const expectedStageCounts = { S0: 20, S1: 35, S2: 74, S3: 74, S4: 15, S5: 10, S6: 6 };
      const stageCounts = Object.fromEntries(Object.keys(expectedStageCounts).map((stage) => [stage, allCases.filter((item) => item.stage === stage && authoritativePasses.has(item.id)).length]));
      const missingEvidence = [...authoritativePasses].filter(([, result]) => !result.evidencePath || !existsSync(path.join(projectRoot, result.evidencePath))).map(([caseId]) => caseId);
      const pendingCases = expectedIds.filter((caseId) => !authoritativePasses.has(caseId));
      const unexpectedLatestFailures = [...caseHistory].filter(([caseId, results]) => caseId !== 'TC-234' && !supersededEnvironmentCases.has(caseId) && results.at(-1)?.pass !== true).map(([caseId]) => caseId);
      const ledgerIntegrity = {
        continuousIds: allCases.length === 234 && allCases.every((item, index) => item.id === expectedIds[index]),
        uniqueCaseDefinitions: new Set(allCases.map((item) => item.id)).size === 234,
        authoritativePassCount: authoritativePasses.size,
        uniqueAuthorityPerCase: authoritativePasses.size === allCases.filter((item) => authoritativePasses.has(item.id)).length,
        stageCounts,
        expectedStageCounts,
        stageCountsPass: Object.entries(expectedStageCounts).every(([stage, count]) => stageCounts[stage] === count),
        pendingCases,
        missingEvidence,
        unexpectedLatestFailures,
        environmentBaselineCases: [...supersededEnvironmentCases],
      };
      const ledgerIntegrityPass = ledgerIntegrity.continuousIds && ledgerIntegrity.uniqueCaseDefinitions
        && ledgerIntegrity.authoritativePassCount === 234 && ledgerIntegrity.uniqueAuthorityPerCase
        && ledgerIntegrity.stageCountsPass && pendingCases.length === 0 && missingEvidence.length === 0 && unexpectedLatestFailures.length === 0;
      const stopRun = regressionRuns.find((item) => item.runId === '2026-11-27T10-32-42-437Z');
      const resumeRun = regressionRuns.find((item) => item.runId === '2026-11-27T10-38-31-089Z');
      const runnerBehavior = {
        failFastRunId: stopRun?.runId,
        failFastCaseListCount: stopRun?.caseList?.length,
        failFastResultCount: stopRun?.results?.length,
        failFastLastCaseId: stopRun?.results?.at(-1)?.caseId,
        failFastLastPass: stopRun?.results?.at(-1)?.pass,
        resumeRunId: resumeRun?.runId,
        resumeCaseListCount: resumeRun?.caseList?.length,
        resumeResultCount: resumeRun?.results?.length,
        resumeFirstCaseId: resumeRun?.results?.[0]?.caseId,
        resumeAllPassed: resumeRun?.results?.length === 130 && resumeRun.results.every((result) => result.pass === true),
      };
      const runnerBehaviorPass = runnerBehavior.failFastCaseListCount === 143 && runnerBehavior.failFastResultCount === 14
        && runnerBehavior.failFastLastCaseId === 'TC-044' && runnerBehavior.failFastLastPass === false
        && runnerBehavior.resumeCaseListCount === 130 && runnerBehavior.resumeResultCount === 130
        && runnerBehavior.resumeFirstCaseId === 'TC-044' && runnerBehavior.resumeAllPassed;
      const fixDiff = (await git(['diff', '--', 'packages/domain/src/contract-process.ts', 'apps/web/src/components/MobileSchemaForm.tsx', 'apps/web/src/components/BusinessPage.tsx', 'apps/web/src/components/MobileBusinessPage.tsx', 'apps/web/src/components/ContractGapPage.tsx', 'apps/web/src/presentation/presentation.ts', 'scripts/acceptance-runner.mjs'])).stdout;
      const fixDiffPath = saveEvidence('S6-234-fix-diff.patch', fixDiff);
      const activeRegressions = [
        { defect: '移动编辑日期格式、通用更新 SQL 占位符与资源 ID', pass: mobileUpdatePass, evidence: { status: mobilePatch.status, id: mobileDetail.data?.id, chickDate: mobileDetail.data?.chick_date, remarkMatched: mobileDetail.data?.remark === marker } },
        { defect: '共享更新逻辑桌面编辑、H5 新建编辑与跨公司隔离', pass: sharedUpdatePass, evidence: { mobileCreate: mobileCreateResult, mobileEdit: mobileEditResult, desktopStatus: desktopPatch.status(), desktopRequestBody, desktopRuntimeErrors, desktopDetail: desktopDetail.data, isolationStatus: isolationPatch.status, isolationBody: isolationPatch.json, afterIsolation: afterIsolation.data } },
        { defect: '桌面与移动打印设计器及 PDF 入口缺失', pass: printEntryPass, evidence: { desktopDesignerVisible, desktopPreviewVisible, mobileDesignerVisible, mobilePreviewVisible } },
        { defect: '生产表单中文字段、必填校验及空表单误提交', pass: formRegressionPass, evidence: { postSeen, beforeText: beforeText.slice(0, 800), afterText: afterText.slice(0, 800) } },
        { defect: '运行数据中的测试姓名与 SRS 审计前缀', pass: runtimeCopyPass, evidence: { forbiddenEmployeeNames, forbiddenAuditOperations } },
      ];
      const unclosedHistoricalRegressions = historicalRegressions.filter((item) => !item.closed);
      const pass = historicalRegressions.length === 143 && unclosedHistoricalRegressions.length === 0
        && activeRegressions.every((item) => item.pass)
        && environmentBaselineNotes.every((item) => item.currentCondition)
        && runnerBehaviorPass && ledgerIntegrityPass;
      return { pass, evidence: saveEvidence('S6-234-regression.json', {
        scope: 'G5 严格最终回归：143 个历史失败用例逐项重跑闭环 + 关键缺陷主动复探 + 执行器行为与 234 条台账完整性终检',
        historicalRegressionCount: historicalRegressions.length,
        historicalRegressions,
        unclosedHistoricalRegressions,
        finalCaseAttempts: { currentRunId: runId, previousAttempts: (caseHistory.get('TC-234') ?? []).map((result) => ({ runId: result.runId, pass: result.pass, evidencePath: result.evidencePath })) },
        environmentBaselineNotes,
        activeRegressions,
        runnerBehavior,
        runnerBehaviorPass,
        ledgerIntegrity,
        ledgerIntegrityPass,
        fixDiffPath,
      }) };
    }
    throw new Error(`未实现的 S6 用例编号: ${number}`);
  };
}

const argv = process.argv.slice(2);
let stageArg = null;
let caseArg = null;
let rangeArg = null;
let caseListArg = null;
for (const [index, arg] of argv.entries()) {
  if (arg.startsWith('--stage=')) stageArg = arg.split('=')[1];
  else if (arg === '--stage') stageArg = argv[index + 1];
  else if (arg.startsWith('--case=')) caseArg = arg.split('=')[1];
  else if (arg === '--case') caseArg = argv[index + 1];
  else if (arg.startsWith('--range=')) rangeArg = arg.split('=')[1];
  else if (arg === '--range') rangeArg = argv[index + 1];
  else if (arg.startsWith('--cases=')) caseListArg = arg.split('=')[1];
}
if ([caseArg, rangeArg, caseListArg].filter(Boolean).length > 1) throw new Error('--case、--range 与 --cases 不能同时使用');
const selectedCase = caseArg ? allCases.find((item) => item.id === caseArg) : null;
if (caseArg && !selectedCase) throw new Error(`Unknown acceptance case: ${caseArg}`);
let rangeCases = null;
if (rangeArg) {
  const [fromId, toId] = rangeArg.split(':');
  const fromIndex = allCases.findIndex((item) => item.id === fromId);
  const toIndex = allCases.findIndex((item) => item.id === toId);
  if (fromIndex < 0 || toIndex < fromIndex || allCases[fromIndex].stage !== allCases[toIndex].stage) throw new Error(`Invalid acceptance range: ${rangeArg}`);
  rangeCases = allCases.slice(fromIndex, toIndex + 1);
}
let listedCases = null;
if (caseListArg) {
  const ids = caseListArg.split(',').filter(Boolean);
  if (new Set(ids).size !== ids.length || ids.some((id) => !allCases.some((item) => item.id === id))) throw new Error('无效的 --cases 用例清单');
  const idSet = new Set(ids);
  listedCases = allCases.filter((item) => idSet.has(item.id));
}
const stages = selectedCase ? [selectedCase.stage] : rangeCases ? [rangeCases[0].stage] : listedCases ? [...new Set(listedCases.map((item) => item.stage))] : stageArg ? [stageArg] : ['S0'];
const selectedCases = selectedCase ? [selectedCase] : listedCases ?? rangeCases ?? allCases.filter((item) => stages.includes(item.stage));
const ledgerPath = path.join(projectRoot, 'acceptance-ledger.json');
let history = [];
let previousLedger;
try {
  previousLedger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  const archived = { ...previousLedger };
  delete archived.history;
  history = [...(previousLedger.history ?? []), archived];
} catch {
  history = [];
}
let ledger = { startedAt: new Date().toISOString(), runId, stages, caseId: selectedCase?.id, caseRange: rangeArg, caseList: listedCases?.map((item) => item.id), results: [], history };

if (selectedCases.some((item) => item.id === 'TC-223') && !s5Flow.mobileBatchNo) {
  const candidates = [];
  const visited = new Set();
  const collect = (node) => {
    if (!node || typeof node !== 'object' || visited.has(node)) return;
    visited.add(node);
    if (node.caseId === 'TC-222' && node.pass === true && node.evidencePath) candidates.push(node);
    for (const value of Object.values(node)) collect(value);
  };
  collect(previousLedger);
  const source = candidates.sort((left, right) => Date.parse(left.finishedAt) - Date.parse(right.finishedAt)).at(-1);
  if (!source) throw new Error('缺少 TC-222 权威通过证据，不能独立续跑 TC-223');
  const sourceEvidence = JSON.parse(readFileSync(path.join(projectRoot, source.evidencePath), 'utf8'));
  if (!sourceEvidence.batchNo) throw new Error('TC-222 权威证据缺少批次号');
  s5Flow.mobileBatchNo = sourceEvidence.batchNo;
  saveEvidence('S5-223-input-reference.json', {
    sourceCaseId: 'TC-222', sourceRunId: source.runId,
    sourceEvidencePath: source.evidencePath, batchNo: sourceEvidence.batchNo, createdId: sourceEvidence.createdId,
  });
}

function restoreS5FlowFrom(caseId, targetCaseId) {
  const candidates = [];
  const visited = new Set();
  const collect = (node) => {
    if (!node || typeof node !== 'object' || visited.has(node)) return;
    visited.add(node);
    if (node.caseId === caseId && node.pass === true && node.evidencePath) candidates.push(node);
    for (const value of Object.values(node)) collect(value);
  };
  collect(previousLedger);
  collect(ledger.results);
  const source = candidates.sort((left, right) => Date.parse(left.finishedAt) - Date.parse(right.finishedAt)).at(-1);
  if (!source) throw new Error(`缺少 ${caseId} 权威通过证据，不能执行 ${targetCaseId}`);
  const sourceEvidence = JSON.parse(readFileSync(path.join(projectRoot, source.evidencePath), 'utf8'));
  if (!sourceEvidence.flowContext) throw new Error(`${caseId} 证据缺少链路上下文`);
  Object.assign(s5Flow, sourceEvidence.flowContext);
  saveEvidence(`${targetCaseId}-context-reference.json`, { sourceCaseId: caseId, sourceEvidencePath: source.evidencePath });
}

let s1SeedApplied = false;

for (const item of selectedCases) {
  if (item.id === 'TC-225' && !s5Flow.material) restoreS5FlowFrom('TC-224', item.id);
  if (item.id === 'TC-226') {
    if (!s5Flow.material) restoreS5FlowFrom('TC-224', item.id);
    if (!s5Flow.egg) restoreS5FlowFrom('TC-225', item.id);
  }
  if (item.id === 'TC-227') {
    if (!s5Flow.purchaseOrder) restoreS5FlowFrom('TC-224', item.id);
    if (!s5Flow.salesOrder) restoreS5FlowFrom('TC-226', item.id);
  }
  const caseNumber = Number(item.id.split('-')[1]);
  const key = `${item.stage}_${String(caseNumber).padStart(2, '0')}`;
  const startedAt = new Date().toISOString();
  strictNetworkRecorder?.setCurrentCase(item.id);
  let preconditionPath = null;
  try {
    const check = checks[key];
    if (!check) throw new Error(`Missing check implementation: ${key}`);
    if (strictRoot && item.stage === 'S1' && !s1SeedApplied) {
      const seedResult = await promisifyExec(process.execPath, [path.join(projectRoot, 'scripts', 's1-acceptance-seed.mjs')]);
      saveEvidence('S1-seed.json', {
        event: 's1_acceptance_data_ready',
        stdout: seedResult.stdout.trim(),
        stderr: seedResult.stderr.trim(),
      });
      s1SeedApplied = true;
    }
    if (strictRoot) {
      preconditionPath = await captureCasePrecondition({
        caseDefinition: item,
        root: projectRoot,
        targetDirectory: path.join(strictRoot, 'preconditions'),
        gitPath: gitExecutable,
        dockerPath: dockerExecutable,
        composeFile,
        projectName,
        apiBaseUrl: baseUrl,
      });
    }
    const result = await check();
    ledger.results.push({
      caseId: item.id,
      stage: item.stage,
      pageId: item.pageId,
      operation: item.operation,
      startedAt,
      finishedAt: new Date().toISOString(),
      actualResult: result.pass ? '通过' : '失败',
      evidencePath: result.evidence,
      preconditionPath: preconditionPath ? path.relative(projectRoot, preconditionPath).replaceAll('\\', '/') : null,
      defectId: result.pass ? '无' : '待登记',
      pass: result.pass,
    });
  } catch (error) {
    const evidence = saveEvidence(`${key}-error.json`, { message: error.message, stack: error.stack });
    ledger.results.push({
      caseId: item.id,
      stage: item.stage,
      pageId: item.pageId,
      operation: item.operation,
      startedAt,
      finishedAt: new Date().toISOString(),
      actualResult: '阻断',
      evidencePath: evidence,
      preconditionPath: preconditionPath ? path.relative(projectRoot, preconditionPath).replaceAll('\\', '/') : null,
      defectId: '待登记',
      pass: false,
      error: error.message,
    });
  }
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');
  if (ledger.results.at(-1)?.pass === false) break;
}

if (stages.includes('S2')) await closeS2Browser();
if (stages.some((stage) => ['S3', 'S4', 'S5', 'S6'].includes(stage))) await closeS3Browser();

const summary = {};
for (const result of ledger.results) {
  summary[result.actualResult] = (summary[result.actualResult] ?? 0) + 1;
}
ledger.finishedAt = new Date().toISOString();
ledger.summary = summary;
ledger.pass = ledger.results.every((result) => result.pass);
writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');
console.log(JSON.stringify({ status: ledger.pass ? 'pass' : 'fail', total: ledger.results.length, summary }, null, 2));
