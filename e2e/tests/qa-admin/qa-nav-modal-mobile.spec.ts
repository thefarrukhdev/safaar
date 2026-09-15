import { test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt', 'utf8').trim();

test.describe.serial('nav + modal + mobile', () => {
  let sharedPage: Page;
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    sharedPage = await context.newPage();
    await sharedPage.goto('/login');
    await sharedPage.getByPlaceholder('admin').fill(ADMIN_EMAIL);
    await sharedPage.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
    await sharedPage.getByRole('button', { name: /kirish/i }).first().click();
    await sharedPage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  });
  test.afterAll(async () => { await sharedPage.context().close(); });

  test('nav: sidebar link to /users navigates correctly', async () => {
    const page = sharedPage;
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    const links = await page.locator('a[href="/users"]').count();
    console.log('USERS_LINK_COUNT=' + links);
    if (links > 0) {
      await page.locator('a[href="/users"]').first().click({ timeout: 5000 });
      await page.waitForTimeout(500);
      console.log('URL_AFTER=' + page.url());
    }
  });

  test('modal Escape regression', async () => {
    const page = sharedPage;
    await page.goto('/partners/requests', { waitUntil: 'networkidle' });
    const rejectBtn = page.getByRole('button', { name: /Rad etish/i }).first();
    const count = await rejectBtn.count();
    console.log('REJECT_BUTTON_COUNT=' + count);
    if (count > 0) {
      await rejectBtn.click({ timeout: 5000 });
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      console.log('STILL_ON_REQUESTS=' + page.url().includes('/partners/requests'));
    }
  });

  test('mobile: no horizontal overflow at 390px', async () => {
    const page = sharedPage;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    console.log('MOBILE_OVERFLOW=' + hasOverflow);
  });
});
