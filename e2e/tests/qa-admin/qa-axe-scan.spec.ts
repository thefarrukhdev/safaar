import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt',
  'utf8',
).trim();

const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';

const ROUTES = [
  '/dashboard', '/partners/requests', '/partners/list', '/bookings/hotels',
  '/finance/overview', '/cms/banners', '/users', '/promos', '/catalog',
  '/audit', '/team', '/developer', '/support', '/settings',
];

test.describe.serial('EXHAUSTIVE: automated accessibility scan (axe-core) — web-admin', () => {
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
    test(`axe scan: ${route}`, async () => {
      const page = sharedPage;
      await page.goto(route, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(500);
      await page.addScriptTag({ url: AXE_CDN });
      const results = await page.evaluate(async () => {
        // @ts-ignore
        return await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        });
      });
      const violations = (results as any).violations.map((v: any) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
      }));
      console.log(`ROUTE=${route} VIOLATIONS=${violations.length}`);
      if (violations.length) console.log(`  ${JSON.stringify(violations)}`);
    });
  }
});


test('identify root cause of recurring button-name / color-contrast violations', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /kirish/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
  await page.goto('/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.addScriptTag({ url: AXE_CDN });
  const results = await page.evaluate(async () => {
    // @ts-ignore
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    const btn = r.violations.find((v: any) => v.id === 'button-name');
    const contrast = r.violations.find((v: any) => v.id === 'color-contrast');
    return {
      buttonName: btn ? btn.nodes.map((n: any) => ({ html: n.html, target: n.target })) : [],
      contrastSample: contrast ? contrast.nodes.slice(0, 3).map((n: any) => ({ html: n.html, summary: n.failureSummary })) : [],
    };
  });
  console.log('BUTTON_NAME_DETAIL:', JSON.stringify(results.buttonName, null, 2));
  console.log('CONTRAST_SAMPLE:', JSON.stringify(results.contrastSample, null, 2));
});

test('identify select-name and label violation details', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /kirish/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });

  for (const route of ['/users', '/settings']) {
    await page.goto(route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.addScriptTag({ url: AXE_CDN });
    const results = await page.evaluate(async () => {
      // @ts-ignore
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
      const sel = r.violations.find((v: any) => v.id === 'select-name');
      const lbl = r.violations.find((v: any) => v.id === 'label');
      return {
        selectName: sel ? sel.nodes.slice(0,2).map((n: any) => n.html) : [],
        label: lbl ? lbl.nodes.slice(0,3).map((n: any) => n.html) : [],
      };
    });
    console.log(`ROUTE=${route} SELECT_NAME=${JSON.stringify(results.selectName)}`);
    console.log(`ROUTE=${route} LABEL=${JSON.stringify(results.label)}`);
  }
});
