import { test, expect } from '@playwright/test';

const ADMIN_URL = 'https://web-admin-phi-beige.vercel.app';
const ADMIN_EMAIL = 'admin@safaar.uz';
const ADMIN_PASSWORD = 'Admin12345!';

test.setTimeout(60_000);

test('full login checklist: 1 click = 1 request, invalid password, valid login, logout, re-login', async ({ page }) => {
  const loginRequests: number[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/v1/auth/admin/login') && req.method() === 'POST') {
      loginRequests.push(Date.now());
    }
  });

  // 1) fresh /login
  await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  const submitButton = page.getByRole('button', { name: 'Boshqaruv Paneliga Kirish' });

  // 2) invalid password -> 401, spinner stops, real error message shown.
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('••••••••').fill('WrongPassword123!');
  await submitButton.click();
  await expect(submitButton).toBeEnabled({ timeout: 15000 });
  expect(page.url()).toContain('/login');
  const invalidErrorText = await page.locator('.text-rose-700').first().textContent();
  console.log('INVALID_PASSWORD_ERROR=' + invalidErrorText);
  expect(invalidErrorText).toBeTruthy();
  expect(invalidErrorText).not.toContain('status code');

  // 3) valid credentials -> exactly 1 request this click, 201, dashboard.
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
  const countBeforeValidClick = loginRequests.length;
  await submitButton.click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  const requestsForThisClick = loginRequests.length - countBeforeValidClick;
  console.log('REQUESTS_FOR_VALID_CLICK=' + requestsForThisClick);
  expect(requestsForThisClick).toBe(1);
  expect(page.url()).toContain('/dashboard');

  // 4) logout
  await page.goto(`${ADMIN_URL}/logout`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForURL(/\/login/, { timeout: 15000 });

  // 5) re-login with valid credentials
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
  await submitButton.click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  expect(page.url()).toContain('/dashboard');

  console.log('ALL_LOGIN_REQUEST_TIMESTAMPS=' + JSON.stringify(loginRequests));
  console.log('TOTAL_LOGIN_REQUESTS=' + loginRequests.length);
});
