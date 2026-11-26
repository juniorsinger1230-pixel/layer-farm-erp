import { readFileSync } from 'node:fs';
import { devices, expect, test } from '@playwright/test';

const testData = JSON.parse(readFileSync(new URL('./test-data.json', import.meta.url), 'utf8')) as {
  companyCode: string;
  account: string;
  password: string;
};
const pages = JSON.parse(readFileSync(new URL('../apps/web/src/data/pageRegistry.json', import.meta.url), 'utf8')) as Array<{
  pageId: string;
  title: string;
}>;
const pageApiMap = JSON.parse(readFileSync(new URL('../apps/web/src/generated/page-api-map.json', import.meta.url), 'utf8')) as {
  total: number;
  mappedCount: number;
  gapCount: number;
  mapped: Record<string, { path: string }>;
};

test.use({ ...devices['Pixel 7'] });
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('员工账号').fill(testData.account);
  await page.getByLabel('密码').fill(testData.password);
  await page.getByRole('button', { name: '登录工作台' }).click();
  await page.waitForURL('**/app/workbench');
});

test('移动端全部注册页面均由真实 API 契约支撑且不显示 GAP 提示', async ({ page }) => {
  test.setTimeout(300_000);
  expect(pageApiMap.gapCount).toBe(0);
  expect(pageApiMap.mappedCount).toBe(pages.length);
  expect(pageApiMap.total).toBe(pages.length);

  for (const definition of pages) {
    test.info().annotations.push({ type: 'mobile-page', description: definition.pageId });
    const contract = pageApiMap.mapped[definition.pageId];
    expect(contract, `missing contract for ${definition.pageId}`).toBeTruthy();
    if (!contract) throw new Error(`missing contract for ${definition.pageId}`);

    const responsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === contract.path && response.status() === 200;
    }, { timeout: 20_000 });

    await page.goto(`/h5/${definition.pageId}`);
    await responsePromise;
    await expect(page.getByText('该页面尚未登记真实 API 映射')).toHaveCount(0);
    await expect(page.getByText('该页面已完成高保真入口，但真实 API 契约尚未闭合')).toHaveCount(0);
    await expect(page.getByText('访问被拒绝')).toHaveCount(0);
  }
});
