import { test, expect, type Page } from '@playwright/test';

/**
 * EXHAUSTIVE AUDIT — Phase: real-DOM element inventory + basic smoke for
 * every web-partner page not yet covered in earlier passes. For each route:
 * navigate, capture console errors/failed requests, and inventory every
 * button/link/input/select/table actually rendered (not guessed from source).
 */

async function loginAsQaPartner(page: Page, phone: string) {
  await page.goto('/login');
  await page.locator('#phone').fill(phone);
  await page.getByRole('button', { name: 'SMS Kodini yuborish' }).click();
  const devCodeStrong = page.locator('text=Dasturlash rejimi kodi:').locator('..').locator('strong');
  await expect(devCodeStrong).toBeVisible({ timeout: 15_000 });
  const code = (await devCodeStrong.textContent())!.trim();
  await page.locator('#code').fill(code);
  await page.getByRole('button', { name: 'Kabinetga kirish' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
}

const ROUTES = [
  '/', '/rooms', '/calendar', '/reservations', '/guests', '/reports',
  '/listing', '/settings/profile', '/settings/hotel', '/settings/documents',
  '/settings/team', '/settings/developer', '/support',
];

test.describe.serial('EXHAUSTIVE: web-partner full-page inventory + smoke', () => {
  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    sharedPage = await context.newPage();
    await loginAsQaPartner(sharedPage, '+998900000001');
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
      console.log(`  BUTTON_TEXTS=${JSON.stringify(buttons.filter(Boolean).slice(0, 30))}`);
      console.log(`  CONSOLE_ERRORS=${JSON.stringify(consoleErrors)}`);
      console.log(`  FAILED_REQUESTS=${JSON.stringify(failed4xx5xx)}`);

      await page.screenshot({ path: `test-results/inv-partner-${route.replace(/\//g, '_') || 'root'}.png`, fullPage: true });

      page.off('console', errListener);
      page.off('response', respListener);
    });
  }
});
