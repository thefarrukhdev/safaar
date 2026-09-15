import { test } from '@playwright/test';
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
test('theme-preview contrast detail', async ({ page }) => {
  await page.goto('/uz/theme-preview', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.addScriptTag({ url: AXE_CDN });
  const r = await page.evaluate(async () => {
    // @ts-ignore
    const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    const c = res.violations.find((v: any) => v.id === 'color-contrast');
    return c ? { count: c.nodes.length, sample: c.nodes.slice(0,6).map((n:any)=>({html:n.html.slice(0,150)})) } : 'NONE';
  });
  console.log('DETAIL=' + JSON.stringify(r, null, 2));
});
