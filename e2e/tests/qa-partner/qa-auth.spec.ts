import { test, expect, type APIRequestContext } from '@playwright/test';
import { trackPageIssues } from '../helpers/console-tracker';

/**
 * ISOLATED QA ENVIRONMENT — real authenticated partner auth against the
 * isolated QA backend (safaar-qa-backend, its own DB/Redis). Never touches
 * production. QA-only phone numbers (the DEMO_AUTH_ALLOWED_PHONES
 * allowlist, +998900000100-109) so real dev_code OTPs come back without
 * needing a real SMS provider.
 *
 * 2026-09-15 rewrite: the original version of this file predates the
 * password-login UI (commits 07586d0d/cd5a6af0) — it looked for
 * "SMS Kodini yuborish"/"Kabinetga kirish" buttons and a bare
 * phone-OTP-only login, none of which exist in the current login-form.tsx
 * (default mode is phone+password; phone-OTP now only appears inside the
 * "forgot/set password" step, and always ends in a password write, not a
 * bare OTP login — usePartnerPhoneLogin/usePartnerPhoneOtpVerify are real
 * but have no UI caller). Rewritten to match what the app actually does
 * today, and extended to cover password-login/refresh/logout per this
 * session's task.
 */

const QA_API = 'http://100.109.46.108:4400/v1';
const QA_PARTNER_PHONE = '+998900000102'; // demo-allowed, dedicated to this spec

async function adminToken(request: APIRequestContext): Promise<string> {
  const { readFileSync } = await import('node:fs');
  const password = readFileSync(
    '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt',
    'utf8',
  ).trim();
  const res = await request.post(`${QA_API}/auth/admin/login`, {
    data: { email: 'qa-e2e-admin@safaar.test', password },
  });
  expect(res.ok(), `admin login failed: HTTP ${res.status()}`).toBeTruthy();
  const body = await res.json();
  return body.data.accessToken as string;
}

/** Ensures an approved partner_organizations row exists for
 * QA_PARTNER_PHONE — submits a real public application and approves it
 * via the admin API if one doesn't already exist (idempotent: the
 * backend's own duplicate-phone check makes a second submit a no-op
 * failure we can safely ignore). */
async function ensureApprovedPartnerOrg(request: APIRequestContext): Promise<string> {
  const token = await adminToken(request);
  const list = await request.get(`${QA_API}/admin/partners?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const partners = (await list.json()).data as Array<{ id: string; phone: string; status: string }>;
  const existing = partners.find((p) => p.phone === QA_PARTNER_PHONE);
  if (existing) {
    if (existing.status !== 'approved') {
      await request.post(`${QA_API}/admin/partners/${existing.id}/approve`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {},
      });
    }
    return existing.id;
  }

  // Telefon raqamiga bog'liq email/STIR — bir nechta demo-allowed
  // raqamlar orasida almashtirilsa ham (masalan boshqa raqam rate-limit
  // oynasida bo'lib qolsa) email/STIR to'qnashuvi bo'lmasligi uchun.
  const suffix = QA_PARTNER_PHONE.replace(/\D/g, '').slice(-3);
  const submitted = await request.post(`${QA_API}/partners/requests`, {
    data: {
      type: 'hotel',
      companyName: `QA-E2E web-partner auth spec ${suffix}`,
      contactPerson: 'QA Test',
      phone: QA_PARTNER_PHONE,
      email: `qa-e2e-web-partner-auth-${suffix}@safaar.test`,
      city: 'Toshkent',
      address: 'QA test manzili',
      taxId: `98765${suffix}00`.slice(0, 9),
    },
  });
  const orgId = (await submitted.json()).data.item.id as string;
  await request.post(`${QA_API}/admin/partners/${orgId}/approve`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  });
  return orgId;
}

test.describe.configure({ mode: 'serial' });

test.describe('QA partner auth — real backend (2026-09-15 auth wiring)', () => {
  const PASSWORD = 'QaE2eAuthSpec123!';

  test.beforeAll(async ({ request }) => {
    await ensureApprovedPartnerOrg(request);
  });

  test('C) SET PASSWORD: phone -> OTP -> new password -> authenticated session', async ({ page }) => {
    const issues = trackPageIssues(page);
    await page.goto('/login');

    await page.getByRole('button', { name: /Parolni unutdingizmi/i }).click();
    await page.locator('#phone').fill(QA_PARTNER_PHONE);
    await page.getByRole('button', { name: 'Kodni yuborish' }).click();

    const devCodeStrong = page
      .locator('text=Dasturlash rejimi kodi:')
      .locator('..')
      .locator('strong');
    await expect(devCodeStrong).toBeVisible({ timeout: 15_000 });
    const code = (await devCodeStrong.textContent())!.trim();
    expect(code).toBeTruthy();

    await page.locator('#code').fill(code);
    await page.locator('#new_password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Parolni saqlash va kirish' }).click();

    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
    await expect(page.getByLabel('Safaar bosh sahifa')).toBeVisible({ timeout: 10_000 });

    expect(issues.consoleErrors, `Console errors: ${issues.consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test('B) PASSWORD LOGIN: wrong password is rejected, correct password reaches the dashboard', async ({
    page,
  }) => {
    const issues = trackPageIssues(page);
    await page.goto('/login');

    await page.locator('#phone').fill(QA_PARTNER_PHONE);
    await page.locator('#password').fill('DefinitelyWrong!');
    await page.getByRole('button', { name: 'Tizimga kirish' }).click();
    // Real backend AUTH_INVALID_CREDENTIALS -> toast, stays on /login.
    await expect(page.getByText(/Kirishda xatolik|noto.g.ri/i)).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);

    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Tizimga kirish' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
    await expect(page.getByLabel('Safaar bosh sahifa')).toBeVisible({ timeout: 10_000 });

    expect(issues.consoleErrors, `Console errors: ${issues.consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test('D) REFRESH: the session written by the real login above has a working refresh token', async ({
    page,
    request,
  }) => {
    await page.goto('/login');
    await page.locator('#phone').fill(QA_PARTNER_PHONE);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Tizimga kirish' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('uzbron-partner-auth');
      return raw ? JSON.parse(raw) : null;
    });
    const refreshToken = stored?.state?.tokens?.refreshToken as string | undefined;
    expect(refreshToken, 'refreshToken must be persisted by setSession()').toBeTruthy();

    // Exercises the exact endpoint client.ts's auto-refresh calls
    // (POST /auth/partner/refresh) with this real session's own token —
    // proves the browser can actually reach it (CORS etc.) and that it
    // rotates to a genuinely new access token.
    const res = await request.post(`${QA_API}/auth/partner/refresh`, {
      data: { refreshToken },
    });
    expect(res.ok(), `refresh failed: HTTP ${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(body.data.accessToken).toBeTruthy();
    expect(body.data.accessToken).not.toBe(stored.state.tokens.accessToken);
  });

  test('E) LOGOUT: clears the session and a protected route is denied afterward', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#phone').fill(QA_PARTNER_PHONE);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Tizimga kirish' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });

    // Brand-new org, zero rooms/listings yet -> the dashboard shows a
    // "Xush kelibsiz! Tizimni sozlaymiz" onboarding modal (its own data
    // check, so it can appear a moment after the URL change) that blocks
    // the rest of the page — unrelated to auth, just needs dismissing.
    // locator.isVisible() checks the CURRENT state only — it does not
    // poll/wait despite taking a timeout-shaped options bag (that's what
    // repeatedly made this check miss the modal, which renders a moment
    // after the URL change, pending its own "does this org have any
    // rooms yet" check). waitFor() is the one that actually polls.
    const onboardingClose = page.getByRole('button', { name: /Keyinroq qilish/ });
    const onboardingShown = await onboardingClose
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (onboardingShown) {
      await onboardingClose.click();
      await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    }

    // Not just [aria-haspopup="menu"] — Next.js's dev-tools button carries
    // the same attribute; scope to the user-menu trigger's own accessible
    // name (buildPartnerSession's placeholder full name) instead.
    await page.getByRole('button', { name: /Hamkor xodimi/ }).click();
    // Not getByText('Chiqish') — a front-desk "Chiqish (Check-out)" button
    // elsewhere on the dashboard shares that substring.
    await page.getByRole('menuitem', { name: 'Chiqish' }).click();

    await page.waitForURL(/\/login/, { timeout: 10_000 });
    const stored = await page.evaluate(() =>
      localStorage.getItem('uzbron-partner-auth'),
    );
    const state = stored ? JSON.parse(stored).state : null;
    expect(state?.user ?? null).toBeNull();
    expect(state?.tokens ?? null).toBeNull();

    // Protected route must bounce back to /login, not render the dashboard.
    await page.goto('/');
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  });
});
