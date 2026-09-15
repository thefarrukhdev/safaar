import { test, expect } from '@playwright/test';

/**
 * SAFE production admin login timing/stability probe.
 * Uses deliberately INVALID credentials only — never touches a real admin
 * account, never mutates data. Purpose: capture real round-trip timing for
 * repeated + idle-gapped login attempts against the REAL production
 * web-admin (https://web-admin-phi-beige.vercel.app), to characterize
 * whether the previously-reported idle-socket "fetch failed" regression is
 * currently observable. Does NOT intentionally break the tunnel or force a
 * stale socket — only observes real, naturally-occurring behavior.
 */

async function attemptLogin(page: import('@playwright/test').Page, label: string) {
  const t0 = Date.now();
  let transportError = false;
  page.once('pageerror', () => { transportError = true; });

  if (page.url() !== 'https://web-admin-phi-beige.vercel.app/login') {
    await page.goto('https://web-admin-phi-beige.vercel.app/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
  }
  const userField = page.locator('#admin-username, input[name="username"], input[placeholder="admin" i]').first();
  const passField = page.locator('#admin-password, input[type="password"]').first();
  await expect(userField).toBeVisible({ timeout: 10000 });
  await userField.fill(`qa-architecture-probe-${process.env.QA_PROBE_RUN_ID || 'default'}`);
  await passField.fill('not-a-real-password-000000');
  const submitBtn = page.getByRole('button', { name: /kirish|login|sign in/i }).first();
  await submitBtn.click();
  await page.waitForFunction(() => {
    const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    return !btn || !btn.disabled;
  }, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
  const ms = Date.now() - t0;
  const bodyText = await page.locator('body').innerText();
  // Matches either the generic invalid-credential message OR the rate-limit
  // lockout message ("Juda ko'p muvaffaqiyatsiz urinish...") — both are a
  // real, successfully-rendered backend response (not a transport failure).
  const genericErrorShown = /xato|noto.g.ri|xatolik|muvaffaqiyatsiz|urinish/i.test(bodyText);
  console.log(`${label}: ROUNDTRIP_MS=${ms} GENERIC_ERROR_SHOWN=${genericErrorShown} TRANSPORT_ERROR=${transportError}`);
  await page.screenshot({ path: `test-results/prod-admin-${label}.png` });
  return { ms, genericErrorShown, transportError };
}

test('5 consecutive production login attempts — timing + stability (invalid creds, no mutation)', async ({ page }) => {
  const results = [];
  for (let i = 1; i <= 5; i++) {
    results.push(await attemptLogin(page, `ATTEMPT_${i}`));
  }
  const allShowedGenericError = results.every((r) => r.genericErrorShown);
  const anyTransportError = results.some((r) => r.transportError);
  console.log('ALL_SHOWED_GENERIC_ERROR:', allShowedGenericError);
  console.log('ANY_TRANSPORT_ERROR:', anyTransportError);
  console.log('MAX_ROUNDTRIP_MS:', Math.max(...results.map((r) => r.ms)));
  console.log('MIN_ROUNDTRIP_MS:', Math.min(...results.map((r) => r.ms)));
  expect(allShowedGenericError, 'every attempt must show the generic invalid-credential message').toBe(true);
});

test('idle-gap production login — 3 minute wait between attempts', async ({ page }) => {
  test.setTimeout(240_000);
  const before = await attemptLogin(page, 'PRE_IDLE');
  console.log('WAITING_180S_TO_SIMULATE_IDLE_GAP...');
  await page.waitForTimeout(180_000);
  const after = await attemptLogin(page, 'POST_IDLE_180S');
  console.log('PRE_IDLE_MS:', before.ms, 'POST_IDLE_MS:', after.ms);
  console.log('POST_IDLE_TRANSPORT_ERROR:', after.transportError, 'POST_IDLE_GENERIC_ERROR_SHOWN:', after.genericErrorShown);
});
