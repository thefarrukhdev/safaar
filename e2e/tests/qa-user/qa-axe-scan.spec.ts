import { test } from '@playwright/test';

const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
const ROUTES = ['/uz', '/uz/hotels', '/uz/hotels/qa-e2e-2026-09-hotel', '/uz/attractions', '/uz/login', '/uz/register'];

test.describe('EXHAUSTIVE: automated accessibility scan (axe-core) — web-user', () => {
  for (const route of ROUTES) {
    test(`axe scan: ${route}`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(500);
      await page.addScriptTag({ url: AXE_CDN });
      const results = await page.evaluate(async () => {
        // @ts-ignore
        return await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
      });
      const violations = (results as any).violations.map((v: any) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
      console.log(`ROUTE=${route} VIOLATIONS=${violations.length} ${JSON.stringify(violations)}`);
    });
  }
});
