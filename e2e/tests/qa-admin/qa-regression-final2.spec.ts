import { test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt', 'utf8').trim();

test.describe.serial('FINAL REGRESSION 2: dashboard, nav, modal, mobile', () => {
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

  test('dashboard: live badge visible, activity region focusable', async () => {
    const page = sharedPage;
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    console.log('LIVE_BADGE_VISIBLE=' + await page.getByText('Jonli rejim').count());
    const region = page.getByRole('region', { name: "So'nggi harakatlar ro'yxati" });
    console.log('ACTIVITY_REGION_FOUND=' + await region.count());
    if (await region.count() > 0) {
      await region.focus();
      console.log('ACTIVITY_REGION_FOCUSABLE=' + await region.evaluate((el) => el === document.activeElement));
    }
    await page.screenshot({ path: '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/final-dashboard.png', fullPage: true });
  });

  test('nav: sidebar navigation works', async () => {
    const page = sharedPage;
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /Foydalanuvchilar/i }).first().click();
    await page.waitForURL((url) => url.pathname.includes('/users'), { timeout: 5000 }).catch(() => {});
    console.log('NAV_URL_AFTER_CLICK=' + page.url());
  });

  test('modal Escape: partner-request reject confirmation still closes only itself', async () => {
    const page = sharedPage;
    await page.goto('/partners/requests', { waitUntil: 'networkidle' });
    const rejectBtn = page.getByRole('button', { name: /Rad etish/i }).first();
    if (await rejectBtn.count() > 0) {
      await rejectBtn.click();
      await page.waitForTimeout(300);
      const confirmDialogVisible = await page.getByText(/Rad etish sababi|tasdiqla/i).first().isVisible().catch(() => false);
      console.log('CONFIRM_DIALOG_OPENED=' + confirmDialogVisible);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const stillOnRequestsPage = page.url().includes('/partners/requests');
      console.log('STILL_ON_REQUESTS_PAGE_AFTER_ESCAPE=' + stillOnRequestsPage);
    } else {
      console.log('no reject button found (no pending requests) -- modal Escape not re-tested live this pass (files unchanged since prior verified pass)');
    }
  });

  test('mobile layout: no horizontal overflow at 390px on dashboard', async () => {
    const page = sharedPage;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    console.log('MOBILE_HORIZONTAL_OVERFLOW=' + hasOverflow);
    await page.screenshot({ path: '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/final-mobile-dashboard.png' });
  });
});
