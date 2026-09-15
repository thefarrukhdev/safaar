import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { trackPageIssues } from '../helpers/console-tracker';

/**
 * 2026-09-15 — "SAFAAR — MAKE PARTNER REGISTRATION PHONE VERIFICATION REAL".
 * Real backend coverage for register/page.tsx's phone-ownership step,
 * replacing the old `code === devCode || code === '000000'` client-side
 * check with `POST /auth/partner/registration-otp/request` + `.../verify`
 * + a server-issued, one-time proof that `POST /partners/requests` now
 * requires. Runs against the isolated QA backend (its own DB/Redis,
 * ENABLE_DEMO_AUTH=false — only DEMO_AUTH_ALLOWED_PHONES
 * +998900000100-109 get a real dev_code without a real SMS provider).
 *
 * TEST 1 (happy path) drives the real browser UI end-to-end. The
 * rejection-path tests (2, 4, 5, 6, 7) call the backend directly — they
 * are about the API contract itself (wrong code, replay, cross-phone),
 * not about any UI affordance, and the existing qa-auth.spec.ts already
 * establishes that this app's forms correctly surface backend error
 * messages. TEST 9 drives the UI and asserts on network traffic.
 *
 * NOT covered here (documented, not silently skipped — see the final
 * report): "expired OTP" (task's TEST 3) would need a real 5-minute
 * wall-clock wait to observe honestly; the expiry mechanism itself
 * (otpStore's shared TTL logic) is already covered with a mocked clock
 * in apps/backend/src/auth/auth.service.spec.ts and
 * registration-verification-store.spec.ts. TESTS 8/10/11 (normal
 * password login success/failure, logout) are already covered by
 * qa-auth.spec.ts and are not duplicated here.
 */

const QA_API = 'http://100.109.46.108:4400/v1';

function uniquePhone(seed: string): string {
  // +998 + 9 digits, deterministic-ish per seed + time so re-runs don't
  // collide with each other or with other spec files.
  const suffix = `${Date.now()}`.slice(-6);
  return `+9989${seed}${suffix}`.slice(0, 13);
}

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

async function requestRegistrationOtp(
  request: APIRequestContext,
  phone: string,
): Promise<{ challenge_id: string; dev_code: string }> {
  const res = await request.post(`${QA_API}/auth/partner/registration-otp/request`, {
    data: { phone },
  });
  expect(res.ok(), `registration-otp/request failed: HTTP ${res.status()}`).toBeTruthy();
  const body = await res.json();
  expect(
    body.data.dev_code,
    'QA (DEMO_AUTH_ALLOWED_PHONES) must return a real dev_code — this phone must be in that allowlist',
  ).toBeTruthy();
  return { challenge_id: body.data.challenge_id, dev_code: body.data.dev_code };
}

test.describe.configure({ mode: 'serial' });

test.describe('QA partner registration — real phone verification (2026-09-15)', () => {
  test('TEST 1 (happy path, real browser): phone -> real SMS OTP -> server verify -> proof -> application form -> submit -> created', async ({
    page,
  }) => {
    const issues = trackPageIssues(page);
    const phone = '+998900000103'; // demo-allowed, dedicated to this test
    const stamp = Date.now();

    // register/page.tsx's `Field`/`Label` wrapper does not associate the
    // label with its control (sibling <label>, not `htmlFor`/nested) — so
    // name-attribute locators (react-hook-form's register() sets `name`
    // reliably) are used instead of getByLabel, which would not match.
    await page.goto('/register');
    await page.locator('input[name="phone"]').fill(phone);
    await page.getByRole('button', { name: 'Kodni yuborish' }).click();

    const devCodeStrong = page
      .locator('text=Dasturlash rejimi kodi:')
      .locator('..')
      .locator('strong');
    await expect(devCodeStrong).toBeVisible({ timeout: 15_000 });
    const code = (await devCodeStrong.textContent())!.trim();
    expect(code).toBeTruthy();

    // The code-step input is plain local state (codeValue), not react-hook-
    // form — no `name` attribute, so it's targeted by its placeholder.
    await page.getByPlaceholder('000000').fill(code);

    const [verifyResp] = await Promise.all([
      page.waitForResponse((r) =>
        r.url().includes('/auth/partner/registration-otp/verify'),
      ),
      page.getByRole('button', { name: 'Tasdiqlash' }).click(),
    ]);
    expect(verifyResp.status()).toBe(201);

    // Now on the application form — phone recap should show it's verified.
    await expect(page.getByText('Raqam tasdiqlangan:')).toBeVisible({ timeout: 10_000 });

    await page.locator('select[name="type"]').selectOption('hotel');
    await page.locator('input[name="companyName"]').fill(`QA Reg Hotel ${stamp}`);
    await page.locator('input[name="contactPerson"]').fill('QA Registration Test');
    await page.locator('input[name="password"]').fill('RegTestPass123!');
    await page.locator('input[name="email"]').fill(`qa-reg-${stamp}@safaar.test`);
    await page.locator('input[name="city"]').fill('Toshkent');
    await page.locator('input[name="taxId"]').fill(`9${String(stamp).slice(-8)}`);
    await page.locator('input[name="address"]').fill('QA registration test manzili');

    const [submitResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/partners/requests') && r.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Arizani yuborish' }).click(),
    ]);
    expect(submitResp.status(), 'a genuinely server-verified phone must be accepted').toBe(201);
    await expect(page.getByText('Ariza yuborildi')).toBeVisible({ timeout: 10_000 });

    expect(issues.consoleErrors, `Console errors: ${issues.consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test('TEST 2: wrong OTP code is rejected by the backend (not a fake client-side pass)', async ({
    request,
  }) => {
    const phone = '+998900000104';
    const { challenge_id } = await requestRegistrationOtp(request, phone);

    const res = await request.post(`${QA_API}/auth/partner/registration-otp/verify`, {
      data: { phone, code: '000000', challenge_id },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('OTP_INVALID');
  });

  test('TEST 4: OTP replay — verifying the same code twice fails the second time', async ({
    request,
  }) => {
    const phone = '+998900000106';
    const { challenge_id, dev_code } = await requestRegistrationOtp(request, phone);

    const first = await request.post(`${QA_API}/auth/partner/registration-otp/verify`, {
      data: { phone, code: dev_code, challenge_id },
    });
    expect(first.status()).toBe(201);

    const replay = await request.post(`${QA_API}/auth/partner/registration-otp/verify`, {
      data: { phone, code: dev_code, challenge_id },
    });
    expect(replay.status()).toBe(401);
    const body = await replay.json();
    expect(body.error.code).toBe('OTP_EXPIRED'); // consumeOtp's "already used" code
  });

  test('TEST 5: verification proof replay — submitting a second application with an already-used proof fails', async ({
    request,
  }) => {
    const phone = '+998900000107';
    const { challenge_id, dev_code } = await requestRegistrationOtp(request, phone);
    const verify = await request.post(`${QA_API}/auth/partner/registration-otp/verify`, {
      data: { phone, code: dev_code, challenge_id },
    });
    expect(verify.status()).toBe(201);
    const { verification_token: token } = (await verify.json()).data;

    const stamp = Date.now();
    const first = await request.post(`${QA_API}/partners/requests`, {
      data: {
        type: 'hotel',
        companyName: `QA Reg Replay ${stamp}`,
        contactPerson: 'QA Test',
        phone,
        email: `qa-reg-replay-${stamp}@safaar.test`,
        city: 'Toshkent',
        address: 'QA test manzili',
        taxId: `9${String(stamp).slice(-8)}`,
        phoneVerificationToken: token,
      },
    });
    expect(first.status(), 'first submit with a fresh proof must succeed').toBe(201);

    // Second application, DIFFERENT everything except the SAME (already
    // consumed) proof token — must fail regardless of how "fresh" the
    // rest of the payload looks.
    const second = await request.post(`${QA_API}/partners/requests`, {
      data: {
        type: 'hotel',
        companyName: `QA Reg Replay 2 ${stamp}`,
        contactPerson: 'QA Test',
        phone,
        email: `qa-reg-replay-2-${stamp}@safaar.test`,
        city: 'Toshkent',
        address: 'QA test manzili',
        taxId: `8${String(stamp).slice(-8)}`,
        phoneVerificationToken: token,
      },
    });
    expect(second.status()).toBe(401);
    const body = await second.json();
    expect(body.error.code).toBe('PARTNER_PHONE_NOT_VERIFIED');
  });

  test('TEST 6: an application submitted with NO verification proof at all is rejected', async ({
    request,
  }) => {
    const phone = uniquePhone('11');
    const stamp = Date.now();
    const res = await request.post(`${QA_API}/partners/requests`, {
      data: {
        type: 'hotel',
        companyName: `QA Reg NoProof ${stamp}`,
        contactPerson: 'QA Test',
        phone,
        email: `qa-reg-noproof-${stamp}@safaar.test`,
        city: 'Toshkent',
        address: 'QA test manzili',
        taxId: `7${String(stamp).slice(-8)}`,
        // phoneVerificationToken intentionally omitted
      },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('PARTNER_PHONE_NOT_VERIFIED');
  });

  test('TEST 7: a proof issued for one phone is rejected when submitted for a different phone', async ({
    request,
  }) => {
    const verifiedPhone = '+998900000108';
    const differentPhone = uniquePhone('22');
    const { challenge_id, dev_code } = await requestRegistrationOtp(request, verifiedPhone);
    const verify = await request.post(`${QA_API}/auth/partner/registration-otp/verify`, {
      data: { phone: verifiedPhone, code: dev_code, challenge_id },
    });
    expect(verify.status()).toBe(201);
    const { verification_token: token } = (await verify.json()).data;

    const stamp = Date.now();
    const res = await request.post(`${QA_API}/partners/requests`, {
      data: {
        type: 'hotel',
        companyName: `QA Reg CrossPhone ${stamp}`,
        contactPerson: 'QA Test',
        phone: differentPhone, // NOT verifiedPhone
        email: `qa-reg-crossphone-${stamp}@safaar.test`,
        city: 'Toshkent',
        address: 'QA test manzili',
        taxId: `6${String(stamp).slice(-8)}`,
        phoneVerificationToken: token,
      },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('PARTNER_PHONE_NOT_VERIFIED');
  });

  test('TEST 9: ordinary phone+password login sends NO OTP request (registration and password-recovery are the only SMS-sending flows)', async ({
    page,
  }) => {
    const otpRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/otp/') || req.url().includes('-otp/')) {
        otpRequests.push(`${req.method()} ${req.url()}`);
      }
    });

    await page.goto('/login');
    await page.locator('#phone').fill('+998900000102'); // qa-auth.spec.ts's account (real password already set there)
    await page.locator('#password').fill('QaE2eAuthSpec123!');
    await page.getByRole('button', { name: 'Tizimga kirish' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });

    expect(
      otpRequests,
      `Password login must never trigger an OTP/SMS request, but saw: ${otpRequests.join(', ')}`,
    ).toHaveLength(0);
  });
});
