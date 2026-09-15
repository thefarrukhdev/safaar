import { test } from '@playwright/test';
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';

test('root-cause A7: web-user color-contrast sample', async ({ page }) => {
  await page.goto('/uz/hotels', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.addScriptTag({ url: AXE_CDN });
  const result = await page.evaluate(async () => {
    // @ts-ignore
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    const v = r.violations.find((v: any) => v.id === 'color-contrast');
    return v ? v.nodes.slice(0, 4).map((n: any) => ({ html: n.html, summary: n.failureSummary })) : null;
  });
  console.log('DETAIL=' + JSON.stringify(result, null, 2));
});
