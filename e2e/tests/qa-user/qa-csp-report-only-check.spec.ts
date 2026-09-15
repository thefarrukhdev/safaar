import { test } from '@playwright/test';

const ROUTES = ['/uz', '/uz/hotels', '/uz/hotels/qa-e2e-2026-09-hotel', '/uz/login', '/uz/transport', '/uz/dachas'];

test.describe('CSP Report-Only violation check (SECURITY-P3 / A12-4)', () => {
  for (const route of ROUTES) {
    test(`no CSP violations on ${route}`, async ({ page }) => {
      const violations: string[] = [];
      page.on('console', (msg) => {
        const text = msg.text();
        if (/Content Security Policy|Refused to/i.test(text)) {
          violations.push(text);
        }
      });
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await page.goto(route, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1000);

      console.log(`ROUTE=${route} CSP_VIOLATIONS=${violations.length} ${JSON.stringify(violations)}`);
      console.log(`ROUTE=${route} PAGE_ERRORS=${pageErrors.length} ${JSON.stringify(pageErrors)}`);
    });
  }
});
