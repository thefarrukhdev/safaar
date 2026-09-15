import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt',
  'utf8',
).trim();

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /kirish/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
}

const ROUTES = [
  '/dashboard', '/partners/requests', '/partners/list', '/partners/listings',
  '/bookings/hotels', '/bookings/buses', '/bookings/restaurants',
  '/finance/overview', '/finance/payments', '/finance/refunds', '/finance/reports', '/finance/withdrawals',
  '/cms/banners', '/cms/broadcasts', '/cms/news', '/cms/offers', '/cms/pages', '/cms/templates',
  '/users', '/promos', '/catalog', '/audit', '/team', '/developer', '/support', '/settings',
];

test.describe.serial('EXHAUSTIVE: web-admin full-page inventory + smoke', () => {
  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    sharedPage = await context.newPage();
    await loginAsAdmin(sharedPage);
  });

  test.afterAll(async () => {
    await sharedPage.context().close();
  });

  for (const route of ROUTES) {
    test(`inventory: ${route}`, async () => {
      const page = sharedPage;
      const consoleErrors: string[] = [];
      const failed4xx5xx: string[] = [];
      const errListener = (m: any) => {
        if (m.type() === 'error' && !m.text().includes('React DevTools')) consoleErrors.push(m.text());
      };
      const respListener = (res: any) => {
        if (res.status() >= 400) failed4xx5xx.push(`${res.status()} ${res.url()}`);
      };
      page.on('console', errListener);
      page.on('response', respListener);

      const httpStatus = await page.goto(route, { waitUntil: 'networkidle', timeout: 20000 }).then((r) => r?.status());
      await page.waitForTimeout(600);

      const buttons = await page.locator('button:visible').allTextContents();
      const links = await page.locator('a:visible').evaluateAll((els) => els.map((e: any) => e.getAttribute('href')));
      const inputs = await page.locator('input:visible').count();
      const selects = await page.locator('select:visible').count();
      const tables = await page.locator('table').count();
      const forms = await page.locator('form').count();

      console.log(`ROUTE=${route} HTTP=${httpStatus} BUTTONS=${buttons.length} LINKS=${links.length} INPUTS=${inputs} SELECTS=${selects} TABLES=${tables} FORMS=${forms}`);
      console.log(`  BUTTON_TEXTS=${JSON.stringify(buttons.filter(Boolean).slice(0, 25))}`);
      console.log(`  CONSOLE_ERRORS=${JSON.stringify(consoleErrors)}`);
      console.log(`  FAILED_REQUESTS=${JSON.stringify(failed4xx5xx)}`);

      await page.screenshot({ path: `test-results/inv-admin-${route.replace(/\//g, '_') || 'root'}.png`, fullPage: true });

      page.off('console', errListener);
      page.off('response', respListener);
    });
  }
});
