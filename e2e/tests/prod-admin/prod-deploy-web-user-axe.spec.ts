import { test } from '@playwright/test';

test.use({ baseURL: 'https://web-user-rho.vercel.app' });
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';

test('PROD: axe re-scan for A7/A8/A9 on real production', async ({ page }) => {
  for (const route of ['/uz/dachas', '/uz/transport', '/uz/terms']) {
    await page.goto(route, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);
    await page.addScriptTag({ url: AXE_CDN });
    const results = await page.evaluate(async () => {
      // @ts-ignore
      return await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    });
    const violations = (results as any).violations.map((v: any) => ({ id: v.id, nodes: v.nodes.length }));
    console.log(`ROUTE=${route} VIOLATIONS=${violations.length} ${JSON.stringify(violations)}`);
  }
});
