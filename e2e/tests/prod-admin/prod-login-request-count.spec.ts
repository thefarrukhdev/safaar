import { test, expect } from '@playwright/test';

const ADMIN_URL = 'https://web-admin-phi-beige.vercel.app';
const ADMIN_EMAIL = 'admin@safaar.uz';
const ADMIN_PASSWORD = 'Admin12345!';

test('exactly one /auth/admin/login POST per single submit click', async ({ page }) => {
  const loginRequests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/v1/auth/admin/login') && req.method() === 'POST') {
      loginRequests.push(new Date().toISOString());
    }
  });

  await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);

  // Exactly one real click.
  await page.getByRole('button', { name: 'Boshqaruv Paneliga Kirish' }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 20000 });

  console.log('LOGIN_POST_COUNT=' + loginRequests.length);
  console.log('TIMESTAMPS=' + JSON.stringify(loginRequests));
  expect(loginRequests.length).toBe(1);
});
