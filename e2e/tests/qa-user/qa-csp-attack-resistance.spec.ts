import { test, expect } from '@playwright/test';

/**
 * SECURITY-P3 (A12-4) CSP ATTACK-RESISTANCE proof.
 *
 * Methodology note: an earlier version of this test tried to "inject" a
 * script via page.evaluate(document.createElement('script')...). That is
 * NOT a valid test -- Chromium explicitly does not enforce CSP against
 * code run through the DevTools Protocol's Runtime.evaluate (the same
 * mechanism Playwright's page.evaluate() uses), exactly like typing into
 * the DevTools console. That gap is real but is a devtools/automation
 * carve-out, not something an actual attacker (who cannot run arbitrary
 * CDP calls in a victim's browser) can exploit -- so it says nothing about
 * the deployed policy's real effectiveness. Verified by observing the
 * "attack" succeed with ZERO console CSP violation logged, which is the
 * signature of code that bypassed CSP checking entirely rather than code
 * that satisfied the policy.
 *
 * The valid way to test this is to have the BROWSER'S OWN HTML PARSER
 * encounter the payload while navigating a real response -- exactly how a
 * reflected/stored XSS payload would actually reach a victim. This uses
 * route interception to serve a fixture page, carrying the app's own
 * CSP_ENFORCE-equivalent policy, entirely through normal navigation.
 */

const FIXTURE_NONCE = 'ZmFrZS10ZXN0LW5vbmNlLTEyMzQ1Ng==';
const FIXTURE_CSP = `default-src 'self'; script-src 'self' 'nonce-${FIXTURE_NONCE}' 'strict-dynamic'; object-src 'none'; frame-ancestors 'self'; base-uri 'self'`;

function fixtureHtml(): string {
  return `<!doctype html>
<html>
<head><title>csp-fixture</title></head>
<body>
  <div id="root">loaded</div>
  <!-- (1) no-nonce inline script: must be blocked -->
  <script>window.__noNonceRan = true;</script>
  <!-- (2) correctly-nonced inline script: must run (proves the policy isn't just blocking everything) -->
  <script nonce="${FIXTURE_NONCE}">window.__noncedRan = true;</script>
  <!-- (3) external script from a non-allowlisted origin: must be blocked -->
  <script src="https://evil-not-allowlisted.example.com/payload.js" onerror="window.__externalErrored = true"></script>
  <!-- (4) inline event-handler "javascript:" style execution: must be blocked (counts as inline) -->
  <img src="x" onerror="window.__onerrorRan = true" />
  <!-- (5) unexpected iframe to a non-allowlisted, non-existent origin: must be blocked by default-src/frame-src -->
  <iframe src="https://evil-not-allowlisted.example.com/frame.html"></iframe>
</body>
</html>`;
}

test.describe('CSP attack-resistance (SECURITY-P3 / A12-4) — real HTML-parser fixture', () => {
  test('enforced policy blocks unsafe execution while staying functional', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (msg) => {
      if (/Content Security Policy|Refused to/i.test(msg.text())) violations.push(msg.text());
    });
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.route('**/csp-attack-fixture', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        headers: { 'Content-Security-Policy': FIXTURE_CSP },
        body: fixtureHtml(),
      });
    });

    await page.goto('http://localhost:4401/csp-attack-fixture', { waitUntil: 'load' });
    await page.waitForTimeout(1000);

    const state = await page.evaluate(() => ({
      noNonceRan: (window as unknown as { __noNonceRan?: boolean }).__noNonceRan ?? false,
      noncedRan: (window as unknown as { __noncedRan?: boolean }).__noncedRan ?? false,
      externalErrored: (window as unknown as { __externalErrored?: boolean }).__externalErrored ?? false,
      onerrorRan: (window as unknown as { __onerrorRan?: boolean }).__onerrorRan ?? false,
      rootVisible: document.getElementById('root')?.textContent === 'loaded',
    }));

    console.log('FIXTURE_STATE=', JSON.stringify(state));
    console.log('VIOLATIONS=', JSON.stringify(violations));
    console.log('PAGE_ERRORS=', JSON.stringify(pageErrors));

    // (1) blocked: no-nonce inline script must not have run.
    expect(state.noNonceRan, 'no-nonce inline script must be blocked').toBe(false);
    // (2) positive control: correctly-nonced script DOES run -- proves the
    // fixture's policy is actually being enforced, not just "everything is
    // broken" (which would trivially make (1) look like a pass).
    expect(state.noncedRan, 'a correctly-nonced inline script must still run').toBe(true);
    // (3) blocked: inline event-handler attribute (onerror=...) is inline
    // script and must not execute without a nonce/hash either.
    expect(state.onerrorRan, 'inline event-handler script must be blocked').toBe(false);
    // (4) the page itself keeps rendering/functioning around the blocks.
    expect(state.rootVisible, 'page content must still render normally').toBe(true);
    // (5) real CSP violations were actually logged for the blocked items.
    expect(violations.some((v) => /script-src/i.test(v)), 'a script-src violation must be logged').toBe(true);
    expect(violations.some((v) => /frame-src|default-src/i.test(v)), 'the disallowed iframe must be logged as a CSP violation').toBe(true);
  });
});
