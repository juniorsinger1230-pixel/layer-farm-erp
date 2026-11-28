import { expect, test } from '@playwright/test';
import { login } from './helpers.js';
import testData from './test-data.json' with { type: 'json' };

const cases = [
  { pageId: 'trace-004', expectedStatus: 404, path: '/api/v1/trace/document-archives', payload: { entity_ref: 'E2E-READONLY', before_value: '{}', after_value: '{}', employee_no: 1 } },
  { pageId: 'plat-001', expectedStatus: 404, path: '/api/v1/plat/authentication-sessions', payload: { employee_id: 1, access_expires_at: '2027-01-01', refresh_expires_at: '2027-01-01', refresh_hash: 'E2E-INVALID' } },
] as const;

for (const item of cases) {
  test(`${item.pageId}系统生成页无人工创建入口且人工POST被服务端拒绝`, async ({ page }) => {
    await login(page, testData.account, testData.password);
    await page.goto(`/app/${item.pageId}`);
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('button', { name: /新建/ })).toHaveCount(0);
    const result = await page.evaluate(async ({ path, payload }) => {
      const raw = sessionStorage.getItem('layer-erp-session');
      const session = raw ? JSON.parse(raw) as { accessToken?: string } : {};
      const response = await fetch(path, {
        method: 'POST',
        headers: { authorization: `Bearer ${session.accessToken ?? ''}`, 'content-type': 'application/json', 'idempotency-key': `e2e-readonly-${Date.now()}` },
        body: JSON.stringify(payload),
      });
      return { status: response.status, body: await response.json() as { error?: { code?: string } } };
    }, { path: item.path, payload: item.payload });
    expect(result.status).toBe(item.expectedStatus);
    expect(['FORBIDDEN', 'NOT_FOUND']).toContain(result.body.error?.code);
  });
}
