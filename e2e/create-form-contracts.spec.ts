import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { login } from './helpers.js';

const testData = JSON.parse(readFileSync(new URL('./test-data.json', import.meta.url), 'utf8')) as {
  account: string;
  password: string;
};
const formSchemas = JSON.parse(readFileSync(new URL('../apps/web/src/generated/form-schemas.json', import.meta.url), 'utf8')) as {
  pages: Record<string, {
    fields: Array<{ name: string; label: string }>;
  }>;
};

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await login(page, testData.account, testData.password);
});

test('桌面端全部创建抽屉均展示 Schema 业务字段且不再显示添加字段', async ({ page }) => {
  test.setTimeout(300_000);
  for (const [pageId, schema] of Object.entries(formSchemas.pages)) {
    test.info().annotations.push({ type: 'create-drawer', description: pageId });
    await page.goto(`/app/${pageId}`);
    await expect(page.getByRole('table')).toBeVisible();
    await page.getByRole('button', { name: /新建/ }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: '添加字段' })).toHaveCount(0);
    expect(await dialog.locator('.ant-form-item').count()).toBeGreaterThanOrEqual(schema.fields.length);
    for (const field of schema.fields) {
      await expect(dialog.getByText(field.label, { exact: true }).first()).toBeVisible();
    }
    await dialog.getByRole('button', { name: /取\s*消/ }).click();
    await expect(dialog).toBeHidden();
  }
});
