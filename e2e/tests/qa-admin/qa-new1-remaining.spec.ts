import { test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt', 'utf8').trim();
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
const ROUTES = ['/partners/requests', '/finance/payments', '/finance/reports', '/cms/offers', '/cms/pages', '/cms/templates', '/audit', '/settings'];

test('debug remaining color-contrast instances', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /kirish/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.addScriptTag({ url: AXE_CDN });
    const detail = await page.evaluate(async () => {
      // @ts-ignore
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa'] } });
      const c = r.violations.find((v:any)=>v.id==='color-contrast');
      return c ? c.nodes.slice(0,3).map((n:any)=>({html:n.html.slice(0,180), summary: n.failureSummary.split('\n').pop()})) : null;
    });
    console.log(`ROUTE=${route} DETAIL=${JSON.stringify(detail)}`);
  }
});
