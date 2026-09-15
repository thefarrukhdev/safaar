import { test, expect } from '@playwright/test';

/**
 * READ-ONLY / SAFE production architecture check.
 * Does NOT use real admin credentials — submits a deliberately invalid
 * login to observe ONLY the network request pattern, which reveals which
 * login architecture is actually live:
 *   - OLD (client-side Zustand store, on origin/develop): browser sends the
 *     login request directly to https://api.safaar.uz/v1/auth/admin/login
 *   - NEW (Next.js Server Action, only on local temp/save-all-work branch):
 *     browser POSTs to the web-admin app's OWN origin (a Server Action
 *     request, identifiable by a `Next-Action` request header or a request
 *     whose URL host is web-admin-phi-beige.vercel.app, not api.safaar.uz).
 * This does not mutate any real data (invalid credentials -> rejected).
 */

test('production web-admin: identify live login architecture (no real credentials used)', async ({ page }) => {
  const requestsToApiHost: string[] = [];
  const requestsToOwnOrigin: { url: string; hasNextAction: boolean }[] = [];

  page.on('request', (req) => {
    const url = req.url();
    if (req.method() !== 'POST') return;
    if (url.includes('api.safaar.uz')) {
      requestsToApiHost.push(url);
    }
    if (url.includes('web-admin-phi-beige.vercel.app')) {
      requestsToOwnOrigin.push({
        url,
        hasNextAction: !!req.headers()['next-action'],
      });
    }
  });

  await page.goto('https://web-admin-phi-beige.vercel.app/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/prod-admin-login-page.png', fullPage: true });

  // Fill deliberately fake, non-existent credentials — this will be rejected,
  // no real account state changes.
  const userField = page.locator('#admin-username, input[name="username"], input[placeholder="admin" i]').first();
  const passField = page.locator('#admin-password, input[type="password"]').first();

  await expect(userField).toBeVisible({ timeout: 10000 });
  await userField.fill('qa-architecture-probe-does-not-exist');
  await passField.fill('not-a-real-password-000000');

  const submitBtn = page.getByRole('button', { name: /kirish|login|sign in/i }).first();
  const t0 = Date.now();
  await submitBtn.click();
  // Wait for the request to actually settle (spinner gone / error text appeared),
  // not a fixed guess — up to 15s, well above the 8s per-attempt timeout in backendPost.
  await page.waitForFunction(() => {
    const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    return !btn || !btn.disabled;
  }, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  const submitRoundtripMs = Date.now() - t0;
  console.log('SUBMIT_ROUNDTRIP_MS:', submitRoundtripMs);

  await page.screenshot({ path: 'test-results/prod-admin-login-after-submit.png', fullPage: true });

  console.log('DIRECT_BROWSER_TO_API_SAFAAR_UZ_COUNT:', requestsToApiHost.length);
  console.log('DIRECT_BROWSER_TO_API_SAFAAR_UZ_URLS:', JSON.stringify(requestsToApiHost));
  console.log('REQUESTS_TO_OWN_ORIGIN:', JSON.stringify(requestsToOwnOrigin));
  console.log('PAGE_URL_AFTER_SUBMIT:', page.url());

  const bodyText = await page.locator('body').innerText();
  console.log('ERROR_TEXT_VISIBLE:', /xato|error|noto.g.ri|invalid/i.test(bodyText));
});
