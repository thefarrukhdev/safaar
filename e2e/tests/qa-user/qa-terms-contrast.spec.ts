import { test } from '@playwright/test';
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
test('terms exact contrast detail', async ({ page }) => {
  await page.goto('/uz/terms', { waitUntil: 'networkidle' });
  await page.addScriptTag({ url: AXE_CDN });
  const r = await page.evaluate(async () => {
    // @ts-ignore
    const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    const c = res.violations.find((v: any) => v.id === 'color-contrast');
    return c ? c.nodes[0].failureSummary : null;
  });
  console.log('SUMMARY=' + r);
});
