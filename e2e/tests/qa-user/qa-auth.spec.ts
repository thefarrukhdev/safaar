import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { trackPageIssues } from '../helpers/console-tracker';

/**
 * ISOLATED QA ENVIRONMENT — real authenticated user registration (phone
 * verified via real OTP flow, dev_code read from the isolated QA backend's
 * demo-auth response) against safaar-qa-backend. Never touches production.
 */

// QA now runs ENABLE_DEMO_AUTH=false with a narrow DEMO_AUTH_ALLOWED_PHONES
// allowlist (introduced by the develop merge) — dev_code OTP only works for
// these exact numbers, so a fully random phone no longer gets a dev_code
// (falls through to a real, unconfigured SMS provider and fails).
const QA_AUTH_PHONE = '+998900000100';
function randomQaPhone(): string {
  return QA_AUTH_PHONE;
}

async function readDevCode(page: import('@playwright/test').Page): Promise<string> {
  const devCodeStrong = page.locator('text=Test kodi (dev):').locator('..').locator('strong');
  await expect(devCodeStrong).toBeVisible({ timeout: 15_000 });
  const text = await devCodeStrong.textContent();
  return text!.trim();
}

/** Same pattern as qa-booking-payment.spec.ts's queryQaDb() — real psql
 * INSIDE the QA db container over SSH, no credentials ever leave it. */
async function queryQaDb(sql: string): Promise<string> {
  const out = execFileSync(
    'ssh',
    ['safaar-backend-new', `docker exec safaar-qa-db psql -U safaar_qa -d safaar_qa -tAc "${sql.replace(/"/g, '\\"')}"`],
    { encoding: 'utf8', timeout: 15000 },
  );
  return out.trim();
}

test('QA user: real phone+OTP registration establishes authenticated session', async ({ page, context }) => {
  const issues = trackPageIssues(page);
  const phone = randomQaPhone();
  const email = `qa-e2e-2026-09.${Date.now()}@safaar.test`;
  const password = 'QaE2e-2026-09!';

  // Reset this dedicated fixture user back to "phone-verified only" before
  // exercising the REAL registration flow — the frontend's verifyOtpAction
  // only calls complete-profile when result.user.firstName is still unset
  // (an existing complete profile is treated as a login, not a fresh
  // registration), so a completed profile from a prior run would silently
  // skip the exact code path (and terms enforcement) this test verifies.
  await queryQaDb(
    `update users set first_name=null, last_name=null, email=null, password_hash=null, terms_accepted_at=null, terms_version=null where phone='${phone}';`,
  );

  await page.goto('/uz/register', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'test-results/qa-user-register-page.png' });

  await page.locator('input[name="phone"]').first().fill(phone);
  await page.getByRole('button', { name: 'Kod yuborish' }).click();

  const code = await readDevCode(page);
  expect(code).toBeTruthy();
  await page.screenshot({ path: 'test-results/qa-user-otp-received.png' });

  await page.locator('input[name="code"]').fill(code);
  await page.locator('input[name="firstName"]').fill('QA-E2E');
  await page.locator('input[name="lastName"]').fill('2026-09');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  // 2026-09-15: backend now REQUIRES agree_terms=true (TERMS_NOT_ACCEPTED
  // otherwise) — the checkbox itself was already `required` in the DOM,
  // but this test never checked it before, meaning it was relying purely
  // on the (now also enforced server-side) native HTML validation.
  await page.locator('input[name="agreeTerms"]').check();
  await page.getByRole('button', { name: "Tasdiqlash va ro'yxatdan o'tish" }).click();

  await page.waitForURL((url) => !url.pathname.includes('/register'), { timeout: 15_000 });
  await page.screenshot({ path: 'test-results/qa-user-authenticated.png', fullPage: true });

  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === 'safaar_session');
  expect(session, 'safaar_session cookie must be set after registration').toBeTruthy();

  expect(issues.consoleErrors, issues.consoleErrors.join('\n')).toEqual([]);

  // Real DB verification — the product flow (not a manual INSERT) must
  // have persisted a real terms acceptance record for this exact user.
  const acceptance = await queryQaDb(
    `select terms_accepted_at is not null, terms_version from users where email='${email}';`,
  );
  console.log('TERMS_ACCEPTANCE_DB_ROW (registration):', acceptance);
  const [hasTimestamp, termsVersion] = acceptance.split('|');
  expect(hasTimestamp).toBe('t');
  expect(termsVersion).toBe('2026-09-15');
});
