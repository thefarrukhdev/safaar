import { test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt', 'utf8').trim();

test('sidebar nav click regression', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /kirish/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await page.goto('/dashboard', { waitUntil: 'networkidle' });
  await page.locator('a[href="/audit"]').first().click();
  await page.waitForURL((url) => url.pathname.includes('/audit'), { timeout: 5000 });
  console.log('NAV_URL=' + page.url());
});
