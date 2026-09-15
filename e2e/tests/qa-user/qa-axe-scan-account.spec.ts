import { test, type Page } from '@playwright/test';

const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
const ACCOUNT_ROUTES = ['/uz/account', '/uz/account/bookings', '/uz/account/favorites', '/uz/account/refunds', '/uz/account/bonuses'];
const phone = `+99890${Math.floor(1000000 + Math.random() * 8999999)}`;

async function readDevCode(page: Page) {
  const el = page.locator('text=Test kodi (dev):').locator('..').locator('strong');
  await el.waitFor({ timeout: 15000 });
  return (await el.textContent())!.trim();
}

test.describe.serial('EXHAUSTIVE: axe scan — web-user account/* (authenticated)', () => {
  let sharedPage: Page;
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    sharedPage = await context.newPage();
    await sharedPage.goto('/uz/register', { waitUntil: 'networkidle' });
    await sharedPage.locator('input[name="phone"]').first().fill(phone);
    await sharedPage.getByRole('button', { name: 'Kod yuborish' }).click();
    const code = await readDevCode(sharedPage);
    await sharedPage.locator('input[name="code"]').fill(code);
    await sharedPage.locator('input[name="firstName"]').fill('QA');
    await sharedPage.locator('input[name="lastName"]').fill('AxeAccount');
    await sharedPage.locator('input[name="email"]').fill(`qa.axe.account.${Date.now()}@example.com`);
    await sharedPage.locator('input[name="password"]').fill('QaAxeTest!2026');
    await sharedPage.getByRole('button', { name: "Tasdiqlash va ro'yxatdan o'tish" }).click();
    await sharedPage.waitForURL((url) => !url.pathname.includes('/register'), { timeout: 15000 });
  });
  test.afterAll(async () => { await sharedPage.context().close(); });

  for (const route of ACCOUNT_ROUTES) {
    test(`axe scan: ${route}`, async () => {
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
