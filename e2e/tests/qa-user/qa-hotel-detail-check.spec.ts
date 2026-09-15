import { test } from '@playwright/test';
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
test('check hotel-detail + /uz/hotels contrast detail', async ({ page }) => {
  for (const route of ['/uz/hotels/qa-e2e-2026-09-hotel', '/uz/hotels']) {
    await page.goto(route, { waitUntil: 'networkidle' });
    await page.addScriptTag({ url: AXE_CDN });
    const detail = await page.evaluate(async () => {
      // @ts-ignore
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa'] } });
      const c = r.violations.find((v:any)=>v.id==='color-contrast');
      return c ? c.nodes.slice(0,2).map((n:any)=>({html:n.html.slice(0,150)})) : null;
    });
    console.log(`ROUTE=${route} DETAIL=${JSON.stringify(detail)}`);
  }
});
