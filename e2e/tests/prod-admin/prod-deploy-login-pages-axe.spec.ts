import { test } from '@playwright/test';
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';

test('PROD: web-partner login page + web-admin login page basic checks', async ({ page }) => {
  for (const url of [
    'https://web-partner-khaki.vercel.app/login',
    'https://web-admin-phi-beige.vercel.app/login',
  ]) {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);
    await page.addScriptTag({ url: AXE_CDN });
    const results = await page.evaluate(async () => {
      // @ts-ignore
      return await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    });
    const violations = (results as any).violations.map((v: any) => ({ id: v.id, nodes: v.nodes.length }));
    console.log(`URL=${url} VIOLATIONS=${violations.length} ${JSON.stringify(violations)}`);
  }
});
