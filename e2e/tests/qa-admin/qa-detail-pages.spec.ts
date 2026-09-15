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

const DETAIL_ROUTES = [
  '/bookings/93f91d73-c7cd-4fce-9a21-6c538a7d0c3d',
  '/users/a4f48524-b752-47d9-bf7c-a705a7ea3c2e',
  '/partners/ffa31212-ed37-45b3-8d2b-d66707e9291d',
];

const NONEXISTENT_ROUTES = [
  '/bookings/00000000-0000-0000-0000-000000000000',
  '/users/00000000-0000-0000-0000-000000000000',
  '/partners/00000000-0000-0000-0000-000000000000',
  '/bookings/not-a-uuid',
];

test.describe.serial('EXHAUSTIVE: web-admin dynamic detail pages (real IDs + nonexistent IDs)', () => {
  let sharedPage: Page;
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    sharedPage = await context.newPage();
    await loginAsAdmin(sharedPage);
  });
  test.afterAll(async () => { await sharedPage.context().close(); });

  for (const route of DETAIL_ROUTES) {
    test(`real-ID detail page: ${route}`, async () => {
      const page = sharedPage;
      const consoleErrors: string[] = [];
      const failed: string[] = [];
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
      page.on('response', (res) => { if (res.status() >= 500) failed.push(`${res.status()} ${res.url()}`); });

      const status = await page.goto(route, { waitUntil: 'networkidle', timeout: 20000 }).then((r) => r?.status());
      await page.waitForTimeout(700);
      const bodyText = await page.locator('body').innerText();
      console.log(`ROUTE=${route} HTTP=${status} BODY_LEN=${bodyText.length} CONSOLE_ERRORS=${JSON.stringify(consoleErrors)} 5XX=${JSON.stringify(failed)}`);
      console.log(`  SNIPPET=${bodyText.replace(/\n/g, ' | ').slice(0, 300)}`);
      await page.screenshot({ path: `test-results/detail-admin-${route.replace(/\//g, '_')}.png`, fullPage: true });
    });
  }

  for (const route of NONEXISTENT_ROUTES) {
    test(`nonexistent/malformed ID handling: ${route}`, async () => {
      const page = sharedPage;
      const consoleErrors: string[] = [];
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
      const status = await page.goto(route, { waitUntil: 'networkidle', timeout: 20000 }).then((r) => r?.status());
      await page.waitForTimeout(600);
      const bodyText = await page.locator('body').innerText();
      console.log(`ROUTE=${route} HTTP=${status} CONSOLE_ERRORS=${JSON.stringify(consoleErrors)}`);
      console.log(`  SNIPPET=${bodyText.replace(/\n/g, ' | ').slice(0, 200)}`);
    });
  }
});
