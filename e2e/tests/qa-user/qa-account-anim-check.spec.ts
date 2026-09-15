import { test } from '@playwright/test';
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
test('account contrast after animation settles', async ({ page }) => {
  await page.goto('/uz/account', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500); // let the 1.3s entrance animation fully settle
  await page.addScriptTag({ url: AXE_CDN });
  const r = await page.evaluate(async () => {
    // @ts-ignore
    const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    const c = res.violations.find((v: any) => v.id === 'color-contrast');
    return c ? c.nodes.map((n:any)=>({html:n.html, summary:n.failureSummary})) : 'NONE';
  });
  console.log('AFTER_SETTLE=' + JSON.stringify(r, null, 2));
});
