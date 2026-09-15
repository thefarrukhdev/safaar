import { test } from '@playwright/test';
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';

test('root-cause A8: web-user label violation detail', async ({ page }) => {
  await page.goto('/uz/hotels', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.addScriptTag({ url: AXE_CDN });
  const result = await page.evaluate(async () => {
    // @ts-ignore
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    const v = r.violations.find((v: any) => v.id === 'label');
    return v ? v.nodes.map((n: any) => ({ html: n.html, target: n.target })) : null;
  });
  console.log('DETAIL=' + JSON.stringify(result, null, 2));
});
