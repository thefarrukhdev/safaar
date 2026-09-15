import { test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt',
  'utf8',
).trim();
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
const ROUTES = [
  '/dashboard', '/partners/requests', '/partners/list', '/partners/listings', '/bookings/hotels',
  '/bookings/buses', '/bookings/restaurants', '/finance/overview', '/finance/payments',
  '/finance/refunds', '/finance/reports', '/finance/withdrawals', '/cms/banners', '/cms/broadcasts',
  '/cms/news', '/cms/offers', '/cms/pages', '/cms/templates', '/users', '/promos', '/catalog',
  '/audit', '/team', '/developer', '/support', '/settings',
];

test.describe.serial('POST-FIX FULL AUDIT: web-admin all routes', () => {
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

  for (const route of ROUTES) {
    test(`scan: ${route}`, async () => {
      const page = sharedPage;
      await page.goto(route, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(500);
      await page.addScriptTag({ url: AXE_CDN });
      const results = await page.evaluate(async () => {
        // @ts-ignore
        return await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
      });
      const violations = (results as any).violations.map((v: any) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
      console.log(`ROUTE=${route} VIOLATIONS=${violations.length} ${JSON.stringify(violations)}`);
    });
  }
});
