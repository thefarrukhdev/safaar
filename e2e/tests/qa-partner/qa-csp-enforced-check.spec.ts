import { test, expect } from '@playwright/test';

/**
 * SECURITY-P3 (A12-4) CSP ENFORCEMENT verification for web-partner. See
 * qa-user/qa-csp-enforced-check.spec.ts for the full methodology note.
 * Requires the app to be started with CSP_ENFORCE=true.
 *
 * One login for the whole file (not one per route): the backend throttles
 * repeated OTP requests for the same phone number (see
 * apps/backend/src/.../phone throttle guard), so requesting a fresh code
 * per route made most of a 6-route run fail to even reach a page --
 * caught live, not assumed, after the first attempt at "one login per
 * route" produced flaky beforeEach failures.
 */
// +998900000001 got exhausted against the backend's per-phone OTP
// throttle (5 requests / 10 minutes) by earlier iterations of this same
// test while debugging -- switched to another pre-provisioned QA partner
// account to get a clean run rather than waiting out the window blind.
const QA_PARTNER_PHONE = '+998900000002';
const ROUTES = ['/', '/reservations', '/rooms', '/listing', '/calendar', '/settings/hotel'];
const KNOWN_LOCAL_TEST_ARTIFACT = /100\.109\.46\.108:4400/;

test('CSP ENFORCED check (SECURITY-P3 / A12-4) — web-partner, all core routes', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#phone').fill(QA_PARTNER_PHONE);
  await page.getByRole('button', { name: 'SMS Kodini yuborish' }).click();
  const devCodeStrong = page.locator('text=Dasturlash rejimi kodi:').locator('..').locator('strong');
  await expect(devCodeStrong).toBeVisible({ timeout: 15000 });
  const code = (await devCodeStrong.textContent())!.trim();
  await page.locator('#code').fill(code);
  await page.getByRole('button', { name: 'Kabinetga kirish' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });

  const failures: string[] = [];

  for (const route of ROUTES) {
    const violations: string[] = [];
    const consoleHandler = (msg: import('@playwright/test').ConsoleMessage) => {
      const text = msg.text();
      if (/Content Security Policy|Refused to/i.test(text)) violations.push(text);
    };
    const pageErrors: string[] = [];
    const errorHandler = (err: Error) => pageErrors.push(err.message);
    page.on('console', consoleHandler);
    page.on('pageerror', errorHandler);

    const response = await page.goto(route, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1500); // extra settle time for the /listing Leaflet map

    page.off('console', consoleHandler);
    page.off('pageerror', errorHandler);

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

    if (!enforced) failures.push(`${route}: enforced CSP header missing`);
    if (reportOnly) failures.push(`${route}: report-only header must not also be present`);
    if (!headerNonce) failures.push(`${route}: no nonce in header`);
    if (scriptNonce !== headerNonce) failures.push(`${route}: script nonce (${scriptNonce}) != header nonce (${headerNonce})`);
    if (pageErrors.length) failures.push(`${route}: page errors: ${pageErrors.join(' | ')}`);
    if (unexplained.length) failures.push(`${route}: unexplained CSP violations: ${unexplained.join(' | ')}`);
  }

  expect(failures, failures.join('\n')).toHaveLength(0);
});
