import { test, expect, type Page } from '@playwright/test';

async function loginAsQaPartner(page: Page, phone: string) {
  await page.goto('/login');
  await page.locator('#phone').fill(phone);
  await page.getByRole('button', { name: 'SMS Kodini yuborish' }).click();
  const devCodeStrong = page.locator('text=Dasturlash rejimi kodi:').locator('..').locator('strong');
  await devCodeStrong.waitFor({ timeout: 15000 });
  const code = (await devCodeStrong.textContent())!.trim();
  await page.locator('#code').fill(code);
  await page.getByRole('button', { name: 'Kabinetga kirish' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
}

const VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x800', width: 360, height: 800 },
  { name: '412x915', width: 412, height: 915 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 },
];

test.describe.serial('EXHAUSTIVE: web-partner responsive matrix (dashboard + listing)', () => {
  let sharedPage: Page;
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    sharedPage = await context.newPage();
    await loginAsQaPartner(sharedPage, '+998900000001');
  });
  test.afterAll(async () => { await sharedPage.context().close(); });

  for (const vp of VIEWPORTS) {
    test(`dashboard @ ${vp.name}`, async () => {
      const page = sharedPage;
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      console.log(`PARTNER_DASHBOARD ${vp.name}: scrollWidth=${scrollWidth} overflow=${scrollWidth > vp.width + 5}`);
      await page.screenshot({ path: `test-results/responsive-partner-dash-${vp.name}.png`, fullPage: true });
      expect(scrollWidth).toBeLessThanOrEqual(vp.width + 5);
    });
  }
});
