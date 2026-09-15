import { test } from '@playwright/test';
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
test('check /uz homepage contrast detail', async ({ page }) => {
  await page.goto('/uz', { waitUntil: 'networkidle' });
  await page.addScriptTag({ url: AXE_CDN });
  const detail = await page.evaluate(async () => {
    // @ts-ignore
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa'] } });
    const c = r.violations.find((v:any)=>v.id==='color-contrast');
    return c ? c.nodes.slice(0,3).map((n:any)=>({html:n.html.slice(0,150), summary:n.failureSummary.split('\n').pop()})) : null;
  });
  console.log('DETAIL=' + JSON.stringify(detail, null, 2));
});
