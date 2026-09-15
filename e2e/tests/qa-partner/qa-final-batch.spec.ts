import { test, type Page } from '@playwright/test';

const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
const ROUTES = ['/guests', '/reports', '/settings/developer', '/settings/documents', '/settings/hotel', '/settings/team', '/support'];

test.describe.serial('FINAL BATCH: web-partner remaining accessibility + button coverage', () => {
  let sharedPage: Page;
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    sharedPage = await context.newPage();
    await sharedPage.goto('/login');
    await sharedPage.locator('#phone').fill('+998900000001');
    await sharedPage.getByRole('button', { name: 'SMS Kodini yuborish' }).click();
    const devCodeStrong = sharedPage.locator('text=Dasturlash rejimi kodi:').locator('..').locator('strong');
    await devCodeStrong.waitFor({ timeout: 15000 });
    const code = (await devCodeStrong.textContent())!.trim();
    await sharedPage.locator('#code').fill(code);
    await sharedPage.getByRole('button', { name: 'Kabinetga kirish' }).click();
    await sharedPage.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
  });
  test.afterAll(async () => { await sharedPage.context().close(); });

  for (const route of ROUTES) {
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

  test('button coverage: enumerate all buttons across the 7 remaining routes', async () => {
    const page = sharedPage;
    let total = 0;
    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'networkidle', timeout: 20000 });
      const buttons = await page.getByRole('button').all();
      total += buttons.length;
      console.log(`ROUTE=${route} BUTTON_COUNT=${buttons.length}`);
    }
    console.log(`TOTAL_BUTTONS_ACROSS_7_ROUTES=${total}`);
  });
});
