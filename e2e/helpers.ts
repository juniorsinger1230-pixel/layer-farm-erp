import { createHmac } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

export type FieldValue = string | number | boolean;
export type FieldPair = readonly [string, FieldValue];

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function createTotp(secret: string, at = new Date()): string {
  let bits = '';
  for (const character of secret.toUpperCase().replace(/=+$/u, '')) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid Base32 secret');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  const counter = Math.floor(at.getTime() / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', Buffer.from(bytes)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const code = ((digest[offset]! & 0x7f) << 24
    | (digest[offset + 1]! & 0xff) << 16
    | (digest[offset + 2]! & 0xff) << 8
    | digest[offset + 3]! & 0xff) >>> 0;
  return String(code % 1_000_000).padStart(6, '0');
}

export async function fillOtp(page: Page, code: string): Promise<void> {
  for (let index = 1; index <= 6; index += 1) {
    await page.getByRole('textbox', { name: `OTP Input ${index}` }).fill(code[index - 1]!);
  }
}

export async function login(page: Page, account: string, password: string, mfaSecret: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('员工账号').fill(account);
  await page.getByLabel('密码').fill(password);
  await fillOtp(page, createTotp(mfaSecret));
  await page.getByRole('button', { name: '安全登录' }).click();
  await expect(page.getByRole('menuitem', { name: '经营驾驶舱' })).toBeVisible();
}

export async function openMenu(page: Page, name: string): Promise<void> {
  await page.getByRole('menuitem', { name }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.waitForLoadState('networkidle');
}

export async function createRecord(page: Page, buttonName: string, fields: readonly FieldPair[]): Promise<void> {
  await page.getByRole('button', { name: buttonName }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  for (const [index, [key, value]] of fields.entries()) {
    await drawer.getByRole('button', { name: '添加字段' }).click();
    const row = drawer.locator('.editor-row').nth(index);
    await row.locator('input').nth(0).fill(key);
    await row.locator('input').nth(1).fill(String(value));
  }
  await drawer.getByRole('button', { name: /保\s*存/ }).click();
  await expect(page.getByText('已保存并通过领域校验').first()).toBeVisible();
  try {
    await expect(drawer).toBeHidden({ timeout: 2000 });
  } catch {
    await drawer.getByRole('button', { name: '关闭' }).click();
    await expect(drawer).toBeHidden();
  }
}

type Envelope<T> = { data: T };
type ItemEnvelope<T> = { items: T[] };

async function readJson<T>(page: Page, path: string): Promise<Envelope<T>> {
  return page.evaluate(async (url): Promise<Envelope<T>> => {
    const rawSession = sessionStorage.getItem('layer-erp-session');
    const parsedSession = rawSession ? JSON.parse(rawSession) as { accessToken?: string } : {};
    const headers = parsedSession.accessToken ? { authorization: `Bearer ${parsedSession.accessToken}` } : {};
    const response = await fetch(url, { headers, cache: 'no-store' });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return (await response.json()) as Envelope<T>;
  }, path);
}

export async function executeAction(page: Page, search: string, fields: readonly FieldPair[]): Promise<void> {
  await page.getByPlaceholder('搜索当前记录').fill(search);
  await page.getByRole('button', { name: '执行动作' }).first().click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  for (const [index, [key, value]] of fields.entries()) {
    if (index > 0) await drawer.getByRole('button', { name: '添加字段' }).click();
    const row = drawer.locator('.editor-row').nth(index);
    await row.locator('input').nth(0).fill(key);
    await row.locator('input').nth(1).fill(String(value));
  }
  await drawer.getByRole('button', { name: /保\s*存/ }).click();
  await expect(page.getByText('已保存并通过领域校验').first()).toBeVisible();
  try {
    await expect(drawer).toBeHidden({ timeout: 2000 });
  } catch {
    await drawer.getByRole('button', { name: '关闭' }).click();
    await expect(drawer).toBeHidden();
  }
  await page.getByPlaceholder('搜索当前记录').fill('');
}

export async function listItems<T>(page: Page, path: string): Promise<T[]> {
  const envelope = await readJson<T[] | ItemEnvelope<T>>(page, `${path}?page=1&pageSize=200`);
  const payload = envelope.data;
  return Array.isArray(payload) ? payload : payload.items;
}

export async function findItem<T>(page: Page, path: string, predicate: (item: T) => boolean): Promise<T> {
  const item = (await listItems<T>(page, path)).find(predicate);
  if (!item) throw new Error(`Item not found: ${path}`);
  return item;
}
