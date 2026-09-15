import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * SECURITY-P3 (A12-4) CSP ENFORCEMENT verification for web-admin. See
 * qa-user/qa-csp-enforced-check.spec.ts for the full methodology note.
 * Requires the app to be started with CSP_ENFORCE=true.
 */
const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt',
  'utf8',
).trim();

const ROUTES = ['/dashboard', '/partners/requests', '/partners/listings', '/bookings/hotels', '/finance/payments', '/catalog', '/cms/banners', '/support', '/settings'];
const KNOWN_LOCAL_TEST_ARTIFACT = /100\.109\.46\.108:4400/;

test.describe('CSP ENFORCED check (SECURITY-P3 / A12-4) — web-admin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.getByPlaceholder('admin');
    const passInput = page.locator('input[type="password"]').first();
    await emailInput.fill(ADMIN_EMAIL);
    await passInput.fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /kirish|login|sign in/i }).first().click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  });

  for (const route of ROUTES) {
    test(`enforced, no unexpected violations on ${route}`, async ({ page }) => {
      const violations: string[] = [];
      page.on('console', (msg) => {
        const text = msg.text();
        if (/Content Security Policy|Refused to/i.test(text)) violations.push(text);
      });
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      const response = await page.goto(route, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1000);

      const headers = response?.headers() ?? {};
      const enforced = headers['content-security-policy'];
      const reportOnly = headers['content-security-policy-report-only'];
      const headerNonce = enforced?.match(/'nonce-([^']+)'/)?.[1];
      const scriptNonce = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[nonce]'));
        return scripts.length > 0 ? (scripts[0] as HTMLScriptElement).nonce : null;
      });

      const unexplained = violations.filter((v) => !KNOWN_LOCAL_TEST_ARTIFACT.test(v));

      console.log(`ROUTE=${route} ENFORCED_HEADER_PRESENT=${Boolean(enforced)} REPORT_ONLY_HEADER_PRESENT=${Boolean(reportOnly)}`);
      console.log(`ROUTE=${route} HEADER_NONCE=${headerNonce ?? 'NONE'} SCRIPT_NONCE=${scriptNonce ?? 'NONE'} MATCH=${headerNonce === scriptNonce}`);
      console.log(`ROUTE=${route} ALL_VIOLATIONS=${violations.length} ${JSON.stringify(violations)}`);
      console.log(`ROUTE=${route} UNEXPLAINED_VIOLATIONS=${unexplained.length} ${JSON.stringify(unexplained)}`);
      console.log(`ROUTE=${route} PAGE_ERRORS=${pageErrors.length} ${JSON.stringify(pageErrors)}`);

      expect(enforced, 'enforced CSP header must be present').toBeTruthy();
      expect(reportOnly, 'report-only header must NOT also be present').toBeFalsy();
      expect(headerNonce).toBeTruthy();
      expect(scriptNonce).toBe(headerNonce);
      expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
      expect(unexplained, `unexplained CSP violations: ${unexplained.join(' | ')}`).toHaveLength(0);
    });
  }
});
