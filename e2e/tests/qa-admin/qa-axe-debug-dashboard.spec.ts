import { test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt', 'utf8').trim();
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';

test('debug: dashboard remaining findings + heading hierarchy check', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /kirish/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await page.goto('/dashboard', { waitUntil: 'networkidle' });
  await page.addScriptTag({ url: AXE_CDN });
  const detail = await page.evaluate(async () => {
    // @ts-ignore
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa'] } });
    const c = r.violations.find((v:any)=>v.id==='color-contrast');
    const s = r.violations.find((v:any)=>v.id==='scrollable-region-focusable');
    return {
      contrast: c ? c.nodes.map((n:any)=>({html:n.html.slice(0,150), summary: n.failureSummary})) : null,
      scroll: s ? s.nodes.map((n:any)=>({html:n.html.slice(0,150)})) : null,
    };
  });
  console.log('DETAIL=' + JSON.stringify(detail, null, 2));
  const headings = await page.evaluate(() => Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => h.tagName));
  console.log('HEADINGS=' + JSON.stringify(headings));
});
