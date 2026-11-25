import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = (process.env.BASE_URL ?? '').replace(/\/$/, '');
const companyCode = process.env.TRIAL_COMPANY_CODE ?? 'THL';
const passwordFile = resolve(process.env.TRIAL_PASSWORD_FILE ?? '.runtime/trial-passwords.json');
const outputFile = resolve(process.env.PUBLIC_PAGE_VERIFY_OUTPUT ?? '.runtime/public-page-acceptance-result.json');

if (!baseUrl) throw new Error('BASE_URL is required');

const allPages = JSON.parse(readFileSync(resolve(root, 'apps/web/src/data/pageRegistry.json'), 'utf8'));
const pageLimit = Number(process.env.PAGE_LIMIT ?? 0);
const pages = pageLimit > 0 ? allPages.slice(0, pageLimit) : allPages;
const pageMap = JSON.parse(readFileSync(resolve(root, 'apps/web/src/generated/page-api-map.json'), 'utf8'));
const passwordPayload = JSON.parse(readFileSync(passwordFile, 'utf8'));
const allAccounts = passwordPayload.accounts;
const roleLimit = Number(process.env.ROLE_LIMIT ?? 0);
const accounts = roleLimit > 0 ? allAccounts.slice(0, roleLimit) : allAccounts;
const mappedContracts = pageMap.mapped;
const gapPageIds = new Set(pageMap.gap.map((item) => item.pageId));

const gapReadPermissionByDomain = {
  ORG: 'org:read',
  FARM: 'production:read',
  VET: 'vet:read',
  PROC: 'purchase:read',
  INV: 'inventory:read',
  SALES: 'sales:read',
  LOG: 'report:read',
  FIN: 'finance:read',
  EQP: 'equipment:read',
  RPT: 'report:read',
  PRINT: 'report:read',
  TRACE: 'report:read',
  PLAT: 'report:read',
};

function hasPermission(permissions, required) {
  if (permissions.includes('*') || permissions.includes(required)) return true;
  const [module, action] = required.split(':');
  if (module && permissions.includes(`${module}:*`)) return true;
  if (module && permissions.includes(`${module}:manage`)) return true;
  if (action && permissions.includes(`*:${action}`)) return true;
  return false;
}

function canRead(profile, page) {
  const contract = mappedContracts[page.pageId];
  const required = contract ? `${contract.permission}:read` : gapReadPermissionByDomain[page.domain];
  return hasPermission(profile.permissions, required);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true });
const page = await context.newPage();

async function passTrustScreen() {
  const loginInput = page.getByPlaceholder('例如 trial.admin');
  if (await loginInput.count() > 0) return;

  const html = await page.content();
  const match = html.match(/tunnel_phishing_protection','([^';]+)/);
  if (match) {
    const url = new URL(page.url());
    await context.addCookies([{
      name: 'tunnel_phishing_protection',
      value: match[1],
      domain: url.hostname,
      path: '/',
      secure: true,
      sameSite: 'None',
    }]);
    await page.reload({ waitUntil: 'domcontentloaded' });
  }

  await loginInput.waitFor({ timeout: 30000 });
}

let currentEvents = { apiResponses: [], failedRequests: [], consoleErrors: [] };

page.on('response', (response) => {
  const url = new URL(response.url());
  if (url.pathname.startsWith('/api/v1')) {
    currentEvents.apiResponses.push({ path: url.pathname, status: response.status() });
  }
});
page.on('requestfailed', (request) => {
  const url = new URL(request.url());
  currentEvents.failedRequests.push({ path: url.pathname, error: request.failure()?.errorText ?? 'request failed' });
});
page.on('console', (message) => {
  if (message.type() === 'error') currentEvents.consoleErrors.push(message.text());
});

async function waitForApiResponse(path) {
  const existing = currentEvents.apiResponses.find((item) => item.path === path);
  if (existing) return existing;
  const response = await page.waitForResponse(
    (candidate) => new URL(candidate.url()).pathname === path,
    { timeout: 30000 },
  );
  return { path, status: response.status() };
}

async function loginAs(account) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await passTrustScreen();
    const loginInput = page.getByPlaceholder('例如 trial.admin');
    await loginInput.fill(account.account);
    await page.locator('input[type="password"]').fill(account.password);
    await page.getByRole('button', { name: '登录工作台' }).click();
    await page.waitForURL('**/app/workbench', { timeout: 30000 });

    const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem('layer-erp-session')));
    if (session?.accessToken) {
      const meEnvelope = await page.evaluate(async (token) => {
        const response = await fetch('/api/v1/auth/me', { headers: { authorization: `Bearer ${token}` } });
        return response.json();
      }, session.accessToken);
      if (meEnvelope.data) return { session, profile: meEnvelope.data };
    }

    await page.evaluate(() => sessionStorage.clear());
    await page.waitForTimeout(1000);
  }
  throw new Error(`login failed for ${account.account}`);
}

const roleResults = [];

try {
  for (const account of accounts) {
    currentEvents = { apiResponses: [], failedRequests: [], consoleErrors: [] };
    const { profile } = await loginAs(account);

    const pageResults = [];
    for (const businessPage of pages) {
      currentEvents = { apiResponses: [], failedRequests: [], consoleErrors: [] };
      const expectedAccess = canRead(profile, businessPage);
      const contract = mappedContracts[businessPage.pageId];
      const isGap = gapPageIds.has(businessPage.pageId);

      await page.goto(`${baseUrl}${businessPage.route}`, { waitUntil: 'domcontentloaded' });
      let kind = 'unknown';
      const deniedLocator = page.locator('[data-testid="access-denied"]');
      const businessLocator = page.locator('.business-page');
      try {
        await page.waitForFunction(
          () => document.querySelector('[data-testid="access-denied"]') || document.querySelector('.business-page'),
          null,
          { timeout: 15000 },
        );
      } catch (error) {
        const debugPath = resolve(root, `.runtime/debug-route-${businessPage.pageId}`);
        await page.screenshot({ path: `${debugPath}.png`, fullPage: true });
        writeFileSync(`${debugPath}.html`, await page.content());
        writeFileSync(
          `${debugPath}.json`,
          JSON.stringify({
            pageId: businessPage.pageId,
            route: businessPage.route,
            url: page.url(),
            account: account.account,
            expectedAccess,
            isGap,
            events: currentEvents,
            error: error instanceof Error ? error.message : String(error),
          }, null, 2),
        );
        throw error;
      }
      if (await deniedLocator.count() > 0) {
        kind = 'denied';
      } else {
        await businessLocator.first().waitFor({ timeout: 5000 });
        kind = isGap ? 'gap' : 'business';
      }

      if (kind === 'gap' && businessPage.pattern === 'dashboard') {
        await page.waitForFunction(
          () => {
            const dashboard = document.querySelector('.dashboard-page');
            return Boolean(dashboard) && !dashboard.querySelector('.ant-spin-spinning');
          },
          null,
          { timeout: 60000 },
        );
      }

      const unresolvedFailedRequests = currentEvents.failedRequests.filter((failed) =>
        !currentEvents.apiResponses.some((response) => response.path === failed.path && response.status === 200));
      const resolvedFailedRequestCount = currentEvents.failedRequests.length - unresolvedFailedRequests.length;
      const onlyResolvedTransportErrors = currentEvents.consoleErrors.length > 0
        && currentEvents.consoleErrors.every((error) => error.startsWith('Failed to load resource'))
        && currentEvents.consoleErrors.length <= resolvedFailedRequestCount;
      const checks = {
        expectedClass: expectedAccess ? kind !== 'denied' : kind === 'denied',
        deniedShown: expectedAccess ? true : kind === 'denied',
        gapShown: expectedAccess && isGap ? kind === 'gap' : true,
        businessShown: expectedAccess && !isGap ? kind === 'business' : true,
        noConsoleErrors: currentEvents.consoleErrors.length === 0 || (onlyResolvedTransportErrors && unresolvedFailedRequests.length === 0),
        noFailedRequests: unresolvedFailedRequests.length === 0,
      };

      if (kind === 'business') {
        await page.locator('.ant-table').first().waitFor({ timeout: 15000 });
        const apiResponse = await waitForApiResponse(contract.path);
        checks.api200 = apiResponse.status === 200;
        checks.noUnexpectedDenied = !currentEvents.apiResponses.some((item) => item.path === contract.path && item.status === 403);
      } else {
        checks.api200 = true;
        checks.noUnexpectedDenied = true;
      }

      if (kind === 'gap') {
        const bodyText = await page.locator('body').innerText();
        checks.noMockData = !bodyText.includes('模拟数据') && !bodyText.includes('Mock Factory');
      } else {
        checks.noMockData = true;
      }

      if (kind === 'denied' && contract) {
        checks.noDataLeak = !currentEvents.apiResponses.some((item) => item.path === contract.path && item.status === 200);
      } else {
        checks.noDataLeak = true;
      }

      const passed = Object.values(checks).every(Boolean);
      pageResults.push({
        pageId: businessPage.pageId,
        title: businessPage.title,
        domain: businessPage.domain,
        expectedAccess,
        renderedKind: kind,
        events: currentEvents,
        checks,
        passed,
      });
    }

    const passCount = pageResults.filter((item) => item.passed).length;
    const roleResult = {
      account: account.account,
      role: account.role,
      companyMatch: profile.companyCode === companyCode,
      totalPages: pages.length,
      passCount,
      failCount: pages.length - passCount,
      allPagesPassed: passCount === pages.length,
      pages: pageResults,
    };
    roleResults.push(roleResult);

    const partial = {
      event: 'public_page_acceptance_progress',
      completedRoles: roleResults.length,
      totalRoles: accounts.length,
      latestRole: account.account,
      roleResults: roleResults.map((item) => ({ ...item, pages: undefined })),
    };
    writeFileSync(`${outputFile}.progress`, `${JSON.stringify(partial, null, 2)}\n`);

    await page.evaluate(() => sessionStorage.clear());
  }

  const totalPageChecks = roleResults.reduce((sum, item) => sum + item.totalPages, 0);
  const passedPageChecks = roleResults.reduce((sum, item) => sum + item.passCount, 0);
  const result = {
    event: 'public_page_acceptance_completed',
    baseUrl,
    companyCode,
    totalRoles: roleResults.length,
    totalPageChecks,
    passedPageChecks,
    failedPageChecks: totalPageChecks - passedPageChecks,
    allPassed: passedPageChecks === totalPageChecks && roleResults.every((item) => item.companyMatch),
    generatedAt: new Date().toISOString(),
    roleResults,
  };
  writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({
    event: 'public_page_acceptance_ready',
    outputFile,
    totalRoles: result.totalRoles,
    totalPageChecks,
    passedPageChecks,
    failedPageChecks: result.failedPageChecks,
    allPassed: result.allPassed,
  }));
  if (!result.allPassed) process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
