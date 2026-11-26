import { readFileSync } from 'node:fs';
import { devices, expect, test } from '@playwright/test';

const testData = JSON.parse(readFileSync(new URL('./test-data.json', import.meta.url), 'utf8')) as {
  account: string;
  password: string;
};
const formSchemas = JSON.parse(readFileSync(new URL('../apps/web/src/generated/form-schemas.json', import.meta.url), 'utf8')) as {
  pages: Record<string, {
    fields: Array<{ name: string; label: string }>;
  }>;
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

test('移动端全部创建弹层均展示 Schema 业务字段且不再显示添加字段', async ({ page }) => {
  test.setTimeout(300_000);
  for (const [pageId, schema] of Object.entries(formSchemas.pages)) {
    test.info().annotations.push({ type: 'mobile-create-form', description: pageId });
    await page.goto(`/h5/${pageId}`);
    await expect(page.getByRole('button', { name: '新建' })).toBeVisible();
    await page.getByRole('button', { name: '新建' }).click();

    const form = page.locator('.mobile-schema-form');
    await expect(form).toBeVisible();
    await expect(page.getByRole('button', { name: '添加字段' })).toHaveCount(0);
    for (const field of schema.fields) {
      await expect(form).toContainText(field.label);
    }
    await form.getByRole('button', { name: '取消' }).click();
    await expect(form).toBeHidden();
  }
});
