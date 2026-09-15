import { test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt', 'utf8').trim();

test('pagination click regression on /bookings/hotels', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /kirish/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await page.goto('/bookings/hotels', { waitUntil: 'networkidle' });

  const pageLabel = () => page.locator('text=/Sahifa \\d+ \\/ \\d+/').textContent();
  console.log('BEFORE=' + await pageLabel());
  await page.getByRole('button', { name: 'Keyingi sahifa' }).click();
  await page.waitForTimeout(500);
  console.log('AFTER_NEXT=' + await pageLabel());
  await page.getByRole('button', { name: 'Oldingi sahifa' }).click();
  await page.waitForTimeout(500);
  console.log('AFTER_PREV=' + await pageLabel());
  // keyboard activation check
  await page.getByRole('button', { name: 'Keyingi sahifa' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  console.log('AFTER_KEYBOARD_ENTER=' + await pageLabel());
});
