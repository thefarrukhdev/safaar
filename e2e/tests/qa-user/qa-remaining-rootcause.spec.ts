import { test } from '@playwright/test';
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';

test('root-cause remaining: terms, transport, account color-contrast/button-name', async ({ page }) => {
  for (const route of ['/uz/terms', '/uz/transport']) {
    await page.goto(route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.addScriptTag({ url: AXE_CDN });
    const result = await page.evaluate(async () => {
      // @ts-ignore
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
      const contrast = r.violations.find((v: any) => v.id === 'color-contrast');
      const btn = r.violations.find((v: any) => v.id === 'button-name');
      return {
        contrast: contrast ? contrast.nodes.slice(0,3).map((n:any)=>({html:n.html})) : null,
        button: btn ? btn.nodes.slice(0,3).map((n:any)=>({html:n.html})) : null,
      };
    });
    console.log(`ROUTE=${route} DETAIL=${JSON.stringify(result, null, 2)}`);
  }
});
