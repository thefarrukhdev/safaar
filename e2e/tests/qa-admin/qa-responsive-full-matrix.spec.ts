import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt',
  'utf8',
).trim();

const VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x800', width: 360, height: 800 },
  { name: '412x915', width: 412, height: 915 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 },
];

test.describe.serial('EXHAUSTIVE: web-admin responsive matrix (dashboard + partners/requests)', () => {
  let sharedPage: Page;
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    sharedPage = await context.newPage();
    await sharedPage.goto('/login');
    await sharedPage.getByPlaceholder('admin').fill(ADMIN_EMAIL);
    await sharedPage.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
    await sharedPage.getByRole('button', { name: /kirish/i }).first().click();
    await sharedPage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
  });
  test.afterAll(async () => { await sharedPage.context().close(); });

  for (const vp of VIEWPORTS) {
    test(`dashboard @ ${vp.name}`, async () => {
      const page = sharedPage;
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/dashboard', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      console.log(`ADMIN_DASHBOARD ${vp.name}: scrollWidth=${scrollWidth} overflow=${scrollWidth > vp.width + 5}`);
      await page.screenshot({ path: `test-results/responsive-admin-dash-${vp.name}.png`, fullPage: true });
      expect(scrollWidth).toBeLessThanOrEqual(vp.width + 5);
    });

    test(`partners/requests @ ${vp.name}`, async () => {
      const page = sharedPage;
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/partners/requests', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      console.log(`ADMIN_REQUESTS ${vp.name}: scrollWidth=${scrollWidth} overflow=${scrollWidth > vp.width + 5}`);
      await page.screenshot({ path: `test-results/responsive-admin-requests-${vp.name}.png`, fullPage: true });
      expect(scrollWidth).toBeLessThanOrEqual(vp.width + 5);
    });
  }
});
