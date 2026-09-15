import { test, type Page } from '@playwright/test';

const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
const PUBLIC_ROUTES = [
  '/uz/about', '/uz/dachas', '/uz/help', '/uz/resorts',
  '/uz/restaurants', '/uz/sanatoriums', '/uz/terms', '/uz/theme-preview', '/uz/transport',
];
const ACCOUNT_ROUTES = ['/uz/account', '/uz/account/bookings', '/uz/account/favorites', '/uz/account/refunds', '/uz/account/bonuses'];

async function scan(page: Page, route: string) {
  await page.goto(route, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(500);
  await page.addScriptTag({ url: AXE_CDN });
  const results = await page.evaluate(async () => {
    // @ts-ignore
    return await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
  });
  const violations = (results as any).violations.map((v: any) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  console.log(`ROUTE=${route} VIOLATIONS=${violations.length} ${JSON.stringify(violations)}`);
}

test.describe('EXHAUSTIVE: axe scan — web-user batch 2 (public remaining routes)', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`axe scan: ${route}`, async ({ page }) => { await scan(page, route); });
  }
});

test.describe.serial('EXHAUSTIVE: axe scan — web-user batch 2 (account/* routes, authenticated)', () => {
  let sharedPage: Page;
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    sharedPage = await context.newPage();
    await sharedPage.goto('/uz/login');
    await sharedPage.locator('input[name="phone"]').first().fill('+998901112233');
    await sharedPage.getByRole('button', { name: /sms|kod|yubor/i }).first().click();
    const devCodeStrong = sharedPage.locator('text=Dasturlash rejimi kodi:').locator('..').locator('strong');
    await devCodeStrong.waitFor({ timeout: 15000 });
    const code = (await devCodeStrong.textContent())!.trim();
    const codeInputs = sharedPage.locator('input').filter({ hasText: '' });
    await sharedPage.locator('input[name="code"], input#code').first().fill(code).catch(async () => {
      // fallback: OTP might be split into multiple single-digit inputs
      const inputs = await sharedPage.locator('input[inputmode="numeric"], input[maxlength="1"]').all();
      for (let i = 0; i < inputs.length && i < code.length; i++) await inputs[i].fill(code[i]);
    });
    await sharedPage.getByRole('button', { name: /kirish|tasdiqla|davom/i }).first().click();
    await sharedPage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  });
  test.afterAll(async () => { await sharedPage.context().close(); });

  for (const route of ACCOUNT_ROUTES) {
    test(`axe scan: ${route}`, async () => { await scan(sharedPage, route); });
  }
});
