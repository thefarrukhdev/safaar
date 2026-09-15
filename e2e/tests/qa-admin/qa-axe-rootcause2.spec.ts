import { test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt',
  'utf8',
).trim();
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';

test('root-cause: finance/payments button-name(19) and finance/reports scrollable-region-focusable', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /kirish/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });

  for (const [route, id] of [['/finance/payments', 'button-name'], ['/finance/reports', 'scrollable-region-focusable']] as const) {
    await page.goto(route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.addScriptTag({ url: AXE_CDN });
    const result = await page.evaluate(async (targetId) => {
      // @ts-ignore
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
      const v = r.violations.find((v: any) => v.id === targetId);
      return v ? v.nodes.slice(0, 5).map((n: any) => ({ html: n.html, target: n.target, summary: n.failureSummary })) : null;
    }, id);
    console.log(`ROUTE=${route} ID=${id} DETAIL=${JSON.stringify(result, null, 2)}`);
  }
});
