import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { login } from './helpers.js';

const testData = JSON.parse(readFileSync(new URL('./test-data.json', import.meta.url), 'utf8')) as {
  account: string;
  password: string;
};
const formSchemas = JSON.parse(readFileSync(new URL('../apps/web/src/generated/form-schemas.json', import.meta.url), 'utf8')) as {
  pages: Record<string, {
    path: string;
    fields: Array<{ name: string; label: string; required: boolean }>;
  }>;
};

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await login(page, testData.account, testData.password);
});

test('桌面端74个人工创建页核对字段与必填标记，空表单阻断且不发送POST', async ({ page }) => {
  test.setTimeout(600_000);
  for (const [pageId, schema] of Object.entries(formSchemas.pages)) {
    test.info().annotations.push({ type: 'desktop-create-contract', description: pageId });
    const postRequests: string[] = [];
    const listener = (request: { method: () => string; url: () => string }): void => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === schema.path) postRequests.push(request.url());
    };
    page.on('request', listener);
    try {
      await page.goto(`/app/${pageId}`);
      await expect(page.getByRole('table')).toBeVisible();
      await page.getByRole('button', { name: /新建/ }).first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.ant-form-item')).toHaveCount(schema.fields.length);
      const requiredCount = schema.fields.filter((field) => field.required).length;
      await expect(dialog.locator('.ant-form-item-required')).toHaveCount(requiredCount);
      for (const field of schema.fields) {
        await expect(dialog.getByText(field.label, { exact: true }).first()).toBeVisible();
      }
      await dialog.getByRole('button', { name: /保\s*存/ }).click();
      await expect(dialog.locator('.ant-form-item-explain-error').first()).toBeVisible();
      await expect(dialog).toBeVisible();
      expect(postRequests, `${pageId}空表单不得发送POST`).toHaveLength(0);
      await dialog.getByRole('button', { name: /取\s*消/ }).click();
      await expect(dialog).toBeHidden();
    } finally {
      page.off('request', listener);
    }
  }
});
