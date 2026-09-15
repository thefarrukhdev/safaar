import { test } from '@playwright/test';
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';

test('detail on web-admin login page findings', async ({ page }) => {
  await page.goto('https://web-admin-phi-beige.vercel.app/login', { waitUntil: 'networkidle' });
  await page.addScriptTag({ url: AXE_CDN });
  const detail = await page.evaluate(async () => {
    // @ts-ignore
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa'] } });
    return r.violations.map((v:any) => ({ id: v.id, nodes: v.nodes.map((n:any) => n.html.slice(0,150)) }));
  });
  console.log('DETAIL=' + JSON.stringify(detail, null, 2));
});
