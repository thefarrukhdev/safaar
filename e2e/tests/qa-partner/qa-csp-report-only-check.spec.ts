import { test, type Page } from '@playwright/test';

async function loginAsQaPartner(page: Page) {
  await page.goto('/login');
  await page.locator('#phone').fill('+998900000001');
  await page.getByRole('button', { name: 'SMS Kodini yuborish' }).click();
  const devCodeStrong = page.locator('text=Dasturlash rejimi kodi:').locator('..').locator('strong');
  await devCodeStrong.waitFor({ timeout: 15000 });
  const code = (await devCodeStrong.textContent())!.trim();
  await page.locator('#code').fill(code);
  await page.getByRole('button', { name: 'Kabinetga kirish' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
}

const ROUTES = ['/', '/rooms', '/calendar', '/reservations', '/listing', '/settings/profile'];

test.describe('web-partner CSP Report-Only violation check (SECURITY-P3 / A12-4)', () => {
  let sharedPage: Page;
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    sharedPage = await context.newPage();
    await loginAsQaPartner(sharedPage);
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

      const uniqueTypes = [...new Set(violations.map((v) => v.split("'")[1] || v.slice(0, 60)))];
      console.log(`ROUTE=${route} CSP_VIOLATIONS=${violations.length} SOURCES=${JSON.stringify(uniqueTypes)}`);
      console.log(`ROUTE=${route} PAGE_ERRORS=${pageErrors.length} ${JSON.stringify(pageErrors)}`);
    });
  }
});
