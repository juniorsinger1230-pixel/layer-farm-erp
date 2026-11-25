import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { login } from './helpers.js';

const testData = JSON.parse(readFileSync(new URL('./test-data.json', import.meta.url), 'utf8')) as {
  account: string;
  password: string;
};

test.describe('认证与登录', () => {
  test('错误凭据显示友好错误且不进入系统', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('员工账号').fill(testData.account);
    await page.getByLabel('密码').fill('Wrong-Password-0000!');
    await page.getByRole('button', { name: '登录工作台' }).click();
    await expect(page.getByText('账号或凭据无效')).toBeVisible();
    await expect(page.getByRole('menuitem', { name: '经营驾驶舱' })).toBeHidden();
  });

  test('管理员使用账号密码登录并进入经营驾驶舱', async ({ page }) => {
    await login(page, testData.account, testData.password);
    await expect(page.getByText('THL', { exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: '经营驾驶舱' })).toBeVisible();
  });
});
