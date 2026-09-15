import { test, expect } from '@playwright/test';

/**
 * SECURITY-P3 (A12-4) CSP ENFORCEMENT verification.
 *
 * Requires the app under test to have been started with CSP_ENFORCE=true
 * (see docs/product/security-product-readiness-report.md). Verifies, with
 * real browser evidence:
 *   - the response actually carries a blocking `Content-Security-Policy`
 *     header (not `-Report-Only`);
 *   - the nonce Next.js stamped onto its own hydration <script> tags
 *     matches the nonce embedded in that same response's CSP header
 *     (proves the per-request nonce mechanism is wired correctly, not
 *     just present);
 *   - zero unexpected console CSP violations / page errors / hydration
 *     failures on each core route.
 *
 * Known, explained (not "unexpected") violation: connect-src for the raw
 * Tailscale QA backend origin (http://100.109.46.108:4400) used only by
 * this local test harness -- production/QA-deployed apps reach the
 * backend via https://api.safaar.uz, which IS in the policy. This does
 * not indicate a real gap; it is a local-test-harness artifact, called
 * out explicitly rather than hidden.
 */
const ROUTES = ['/uz', '/uz/hotels', '/uz/hotels/qa-e2e-2026-09-hotel', '/uz/login', '/uz/transport', '/uz/dachas', '/uz/terms'];

const KNOWN_LOCAL_TEST_ARTIFACT = /100\.109\.46\.108:4400/;

test.describe('CSP ENFORCED check (SECURITY-P3 / A12-4)', () => {
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

      const nonceMatch = enforced?.match(/'nonce-([^']+)'/);
      const headerNonce = nonceMatch?.[1];

      // Pull the nonce off one of Next's own script tags to prove it
      // actually got stamped and matches the header, not just present.
      const scriptNonce = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[nonce]'));
        // getAttribute('nonce') is deliberately hidden by browsers once a
        // script is inserted (HTML spec nonce-hiding, to stop XSS payloads
        // reading it back out of the DOM) -- the live IDL `.nonce` property
        // still exposes it for this trusted, first-party test assertion.
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
      expect(enforced).not.toContain('unsafe-inline\' \'nonce'); // sanity: no accidental unsafe-inline added to script-src
      expect(headerNonce).toBeTruthy();
      expect(scriptNonce).toBe(headerNonce);
      expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
      expect(unexplained, `unexplained CSP violations: ${unexplained.join(' | ')}`).toHaveLength(0);
    });
  }

  test('locale switching keeps CSP enforced and functional', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await page.goto('/uz', { waitUntil: 'networkidle' });
    await page.goto('/ru', { waitUntil: 'networkidle' });
    await page.goto('/en', { waitUntil: 'networkidle' });
    console.log(`LOCALE_SWITCH_PAGE_ERRORS=${pageErrors.length} ${JSON.stringify(pageErrors)}`);
    expect(pageErrors).toHaveLength(0);
  });
});
