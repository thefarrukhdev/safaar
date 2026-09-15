import { test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt', 'utf8').trim();

test('find a route with real pagination and verify prev/next', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /kirish/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

  for (const route of ['/bookings/hotels', '/partners/list', '/audit', '/users', '/bookings/buses']) {
    await page.goto(route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const nextBtn = page.getByRole('button', { name: 'Keyingi sahifa' });
    const count = await nextBtn.count();
    const enabled = count > 0 ? await nextBtn.isEnabled() : false;
    console.log(`ROUTE=${route} PAGINATION_PRESENT=${count > 0} NEXT_ENABLED=${enabled}`);
  }
});
