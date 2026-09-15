import { test } from '@playwright/test';
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';

test('detail on web-partner login page finding', async ({ page }) => {
  await page.goto('https://web-partner-khaki.vercel.app/login', { waitUntil: 'networkidle' });
  await page.addScriptTag({ url: AXE_CDN });
  const detail = await page.evaluate(async () => {
    // @ts-ignore
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa'] } });
    const c = r.violations.find((v:any)=>v.id==='color-contrast');
    return c ? c.nodes.map((n:any) => n.html.slice(0,150)) : null;
  });
  console.log('DETAIL=' + JSON.stringify(detail));
});
