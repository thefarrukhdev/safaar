import { test, expect, type Page } from '@playwright/test';

/**
 * EXHAUSTIVE AUDIT — web-user pages not yet covered in earlier passes.
 * Real-DOM element inventory + console/network cleanliness, unauthenticated
 * (public catalog/info pages) since these don't require login.
 */

const ROUTES = [
  '/uz', '/uz/hotels', '/uz/attractions', '/uz/restaurants', '/uz/transport',
  '/uz/dachas', '/uz/resorts', '/uz/sanatoriums', '/uz/about', '/uz/help',
  '/uz/terms', '/uz/theme-preview',
];

test.describe('EXHAUSTIVE: web-user full-page inventory + smoke (public)', () => {
  for (const route of ROUTES) {
    test(`inventory: ${route}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const failed4xx5xx: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error' && !m.text().includes('React DevTools')) consoleErrors.push(m.text());
      });
      page.on('response', (res) => {
        if (res.status() >= 400) failed4xx5xx.push(`${res.status()} ${res.url()}`);
      });

      const httpStatus = await page.goto(route, { waitUntil: 'networkidle', timeout: 20000 }).then((r) => r?.status());
      await page.waitForTimeout(600);

      const buttons = await page.locator('button:visible').allTextContents();
      const links = await page.locator('a:visible').evaluateAll((els) => els.map((e: any) => e.getAttribute('href')));
      const inputs = await page.locator('input:visible').count();

      console.log(`ROUTE=${route} HTTP=${httpStatus} BUTTONS=${buttons.length} LINKS=${links.length} INPUTS=${inputs}`);
      console.log(`  CONSOLE_ERRORS=${JSON.stringify(consoleErrors)}`);
      console.log(`  FAILED_REQUESTS=${JSON.stringify(failed4xx5xx)}`);
      await page.screenshot({ path: `test-results/inv-user-${route.replace(/\//g, '_')}.png`, fullPage: true });
    });
  }
});
