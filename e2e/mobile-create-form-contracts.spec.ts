import { readFileSync } from 'node:fs';
import { devices, expect, test, type Page } from '@playwright/test';

const testData = JSON.parse(readFileSync(new URL('./test-data.json', import.meta.url), 'utf8')) as {
  account: string;
  password: string;
};
const formSchemas = JSON.parse(readFileSync(new URL('../apps/web/src/generated/form-schemas.json', import.meta.url), 'utf8')) as {
  pages: Record<string, {
    path: string;
    fields: Array<{ name: string; label: string; required: boolean; control: string; enum: string[] | null }>;
  }>;
};

test.use({ viewport: devices['Pixel 7'].viewport, isMobile: true, hasTouch: true });
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('员工账号').fill(testData.account);
  await page.getByLabel('密码').fill(testData.password);
  await page.getByRole('button', { name: '登录工作台' }).click();
  await page.waitForURL('**/app/workbench');
});

test('移动端74个人工创建页核对字段与必填标记，空表单阻断且不发送POST', async ({ page }) => {
  test.setTimeout(600_000);
  for (const [pageId, schema] of Object.entries(formSchemas.pages)) {
    test.info().annotations.push({ type: 'mobile-create-contract', description: pageId });
    const postRequests: string[] = [];
    const listener = (request: { method: () => string; url: () => string }): void => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === schema.path) postRequests.push(request.url());
    };
    page.on('request', listener);
    try {
      await page.goto(`/h5/${pageId}`);
      await page.getByRole('button', { name: '新建' }).click();
      const form = page.locator('.mobile-schema-form');
      await expect(form).toBeVisible();
      await expect(form.locator('[data-field]')).toHaveCount(schema.fields.length);
      const requiredCount = schema.fields.filter((field) => field.required).length;
      await expect(form.locator('.mobile-required-mark')).toHaveCount(requiredCount);
      for (const field of schema.fields) {
        await expect(form.locator(`[data-field="${field.name}"]`)).toContainText(field.label);
      }
      const saveButton = form.getByRole('button', { name: '保存' });
      await saveButton.focus();
      await saveButton.press('Enter');
      await expect(form.getByText(/^请填写/).first()).toBeVisible();
      await expect(form).toBeVisible();
      expect(postRequests, `${pageId}空表单不得发送POST`).toHaveLength(0);
      await form.getByRole('button', { name: '取消' }).click();
      await expect(form).toBeHidden();
    } finally {
      page.off('request', listener);
    }
  }
});

async function chooseFirstPicker(page: Page, fieldName: string): Promise<void> {
  const form = page.locator('.mobile-schema-form');
  await form.locator(`[data-field="${fieldName}"]`).getByRole('button', { name: '请选择' }).click();
  const picker = page.locator('.adm-picker').last();
  await expect(picker).toBeVisible();
  await picker.locator('.adm-picker-view-column-item').first().click();
  await picker.getByRole('button', { name: '确定' }).click();
}

test('移动端真实创建、创建后查询及同步双击只提交一次', async ({ page }) => {
  const schema = formSchemas.pages['org-003'];
  if (!schema) throw new Error('Missing org-003 schema');
  const suffix = Date.now().toString(36);
  const roleCode = `E2E-H-${suffix}`.slice(0, 32);
  const roleName = `E2E H5 Role ${suffix}`;
  const postRequests: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === schema.path) postRequests.push(request.url());
  });
  await page.goto('/h5/org-003');
  await page.getByRole('button', { name: '新建' }).click();
  const form = page.locator('.mobile-schema-form');
  await expect(form).toBeVisible();
  await form.locator('[data-field="role_code"] input').fill(roleCode);
  await form.locator('[data-field="role_name"] input').fill(roleName);
  await form.locator('[data-field="role_status"]').getByText('active', { exact: true }).click();
  await chooseFirstPicker(page, 'position_id');

  const responsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST' && new URL(response.url()).pathname === schema.path,
  );
  await form.getByRole('button', { name: '保存' }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBe(201);
  await expect(form).toBeHidden();
  expect(postRequests).toHaveLength(1);
  const body = await response.json() as { data?: { id?: string | number } };
  const createdId = body.data?.id;
  expect(createdId).toBeDefined();

  const detail = await page.evaluate(async ({ path, id }) => {
    const raw = sessionStorage.getItem('layer-erp-session');
    const session = raw ? JSON.parse(raw) as { accessToken?: string } : {};
    const result = await fetch(`${path}/${id}`, { headers: { authorization: `Bearer ${session.accessToken ?? ''}` } });
    return { status: result.status, body: await result.json() as unknown };
  }, { path: schema.path, id: String(createdId) });
  expect(detail.status).toBe(200);
  expect(JSON.stringify(detail.body)).toContain(roleName);

  await page.getByPlaceholder('搜索真实数据').fill(roleName);
  await expect(page.locator('.mobile-record-card').filter({ hasText: roleName })).toHaveCount(1);
});
