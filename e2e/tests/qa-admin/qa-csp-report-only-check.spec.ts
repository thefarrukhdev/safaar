import { test, type Page } from '@playwright/test';

async function loginAsQaAdmin(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill('qa-e2e-admin@safaar.test');
  const pass = require('node:fs').readFileSync(
    '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt',
    'utf8',
  ).trim();
  await page.locator('input[type="password"]').first().fill(pass);
  await page.getByRole('button', { name: /kirish|login/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
}

const ROUTES = ['/dashboard', '/partners/requests', '/bookings/hotels', '/finance/payments', '/users', '/settings', '/cms/templates'];

test.describe('web-admin CSP Report-Only violation check (SECURITY-P3 / A12-4)', () => {
  let sharedPage: Page;
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    sharedPage = await context.newPage();
    await loginAsQaAdmin(sharedPage);
  });
  test.afterAll(async () => { await sharedPage.context().close(); });

  for (const route of ROUTES) {
    test(`no unexpected CSP violations on ${route}`, async () => {
      const violations: string[] = [];
      const listener = (msg: import('@playwright/test').ConsoleMessage) => {
        const text = msg.text();
        if (/Content Security Policy|Refused to/i.test(text)) violations.push(text);
      };
      const pageErrors: string[] = [];
      const errListener = (err: Error) => pageErrors.push(err.message);
      sharedPage.on('console', listener);
      sharedPage.on('pageerror', errListener);

      await sharedPage.goto(route, { waitUntil: 'networkidle', timeout: 20000 });
      await sharedPage.waitForTimeout(1000);

      sharedPage.off('console', listener);
      sharedPage.off('pageerror', errListener);

      console.log(`ROUTE=${route} CSP_VIOLATIONS=${violations.length}`);
      const uniqueTypes = [...new Set(violations.map((v) => v.split("'")[1] || v.slice(0, 60)))];
      console.log(`ROUTE=${route} UNIQUE_VIOLATION_SOURCES=${JSON.stringify(uniqueTypes)}`);
      console.log(`ROUTE=${route} PAGE_ERRORS=${pageErrors.length} ${JSON.stringify(pageErrors)}`);
    });
  }
});
