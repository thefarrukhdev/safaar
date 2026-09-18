import { test, expect, type APIRequestContext } from '@playwright/test';
import { execFileSync } from 'node:child_process';

/**
 * DIRECT-API (non-UI) verification that terms-of-service acceptance is
 * enforced SERVER-SIDE, for both registration (POST /auth/user/complete-
 * profile) and hotel checkout (POST /bookings/hotel). The browser-driven
 * specs (qa-auth, qa-guest-checkout, qa-booking-payment) prove the real UI
 * wiring; this file proves the enforcement itself cannot be bypassed by a
 * client that skips the UI entirely and calls the API with a missing,
 * false, or malformed `agree_terms` value. Runs against the isolated QA
 * backend only (never production).
 *
 * QA has ENABLE_DEMO_AUTH=false with a narrow DEMO_AUTH_ALLOWED_PHONES
 * allowlist (introduced by the develop merge) — dev_code OTP only works
 * for those exact numbers, and both send-otp's IP throttle (5/60s) and the
 * per-phone throttle (5/10min) are real. So this file uses ONE fixed
 * allowlisted phone per describe block, registered ONCE in beforeAll and
 * reused by every test in that block, instead of a fresh phone per test.
 */

const QA_API_URL = 'http://100.109.46.108:4400/v1';
const QA_HOTEL_ID = '00000000-0000-9001-0000-000000000001'; // qa-e2e-2026-09-hotel
const QA_ROOM_ID = '00000000-0000-9003-0000-000000000001';

async function queryQaDb(sql: string): Promise<string> {
  const out = execFileSync(
    'ssh',
    ['safaar-backend-new', `docker exec safaar-qa-db psql -U safaar_qa -d safaar_qa -tAc "${sql.replace(/"/g, '\\"')}"`],
    { encoding: 'utf8', timeout: 15000 },
  );
  return out.trim();
}

/** Real phone+OTP flow up to (but excluding) complete-profile — returns a
 * USER-role access token for `phone` (existing or newly created by
 * verify-otp). Uses the QA-only DEMO_AUTH_ALLOWED_PHONES dev_code, same
 * underlying mechanism as the UI specs' readDevCode(). */
async function beginRegistration(request: APIRequestContext, phone: string) {
  const sendRes = await request.post(`${QA_API_URL}/auth/user/send-otp`, { data: { phone } });
  expect(sendRes.ok(), await sendRes.text()).toBeTruthy();
  const sendBody = (await sendRes.json()).data;
  const devCode = sendBody.dev_code;
  expect(devCode, 'phone must be in QA DEMO_AUTH_ALLOWED_PHONES for dev_code').toBeTruthy();

  const verifyRes = await request.post(`${QA_API_URL}/auth/user/verify-otp`, {
    data: { phone, code: devCode },
  });
  expect(verifyRes.ok(), await verifyRes.text()).toBeTruthy();
  const verifyBody = (await verifyRes.json()).data;
  const accessToken = verifyBody.accessToken as string;
  const userId = verifyBody.user.id as string;
  expect(accessToken).toBeTruthy();
  expect(userId).toBeTruthy();
  return { phone, accessToken, userId };
}

test.describe.serial('Direct API — registration terms enforcement (POST /auth/user/complete-profile)', () => {
  const PHONE = '+998900000102'; // QA DEMO_AUTH_ALLOWED_PHONES entry, dedicated to this describe block
  let accessToken: string;
  let userId: string;

  test.beforeAll(async ({ request }) => {
    ({ accessToken, userId } = await beginRegistration(request, PHONE));
  });

  test('missing agree_terms is rejected with 400 TERMS_NOT_ACCEPTED', async ({ request }) => {
    const before = await queryQaDb(`select terms_accepted_at is null from users where id='${userId}';`);
    const res = await request.post(`${QA_API_URL}/auth/user/complete-profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { first_name: 'API', last_name: 'Test' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('TERMS_NOT_ACCEPTED');

    // acceptance state (accepted or not) must be UNCHANGED by a rejected call
    const after = await queryQaDb(`select terms_accepted_at is null from users where id='${userId}';`);
    expect(after).toBe(before);
  });

  test('agree_terms=false is rejected with 400 TERMS_NOT_ACCEPTED', async ({ request }) => {
    const before = await queryQaDb(`select terms_accepted_at is null from users where id='${userId}';`);
    const res = await request.post(`${QA_API_URL}/auth/user/complete-profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { first_name: 'API', last_name: 'Test', agree_terms: false },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('TERMS_NOT_ACCEPTED');

    const after = await queryQaDb(`select terms_accepted_at is null from users where id='${userId}';`);
    expect(after).toBe(before);
  });

  test('agree_terms as a string "true" is rejected at the DTO boundary (not treated as boolean true)', async ({ request }) => {
    const before = await queryQaDb(`select terms_accepted_at is null from users where id='${userId}';`);
    const res = await request.post(`${QA_API_URL}/auth/user/complete-profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { first_name: 'API', last_name: 'Test', agree_terms: 'true' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    // class-validator @IsBoolean rejects a non-boolean type before the
    // service's own TERMS_NOT_ACCEPTED check ever runs — different error
    // shape (no domain `code`), asserted precisely rather than loosely.
    expect(Array.isArray(body.error.fields)).toBeTruthy();
    expect(body.error.fields.join(' ')).toContain('agree_terms');

    const after = await queryQaDb(`select terms_accepted_at is null from users where id='${userId}';`);
    expect(after).toBe(before);
  });

  test('agree_terms=true succeeds: DB persists terms_accepted_at/terms_version, audit log written, idempotent on repeat', async ({ request }) => {
    const res = await request.post(`${QA_API_URL}/auth/user/complete-profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { first_name: 'API', last_name: 'Test', agree_terms: true },
    });
    expect(res.status(), await res.text()).toBe(201);

    const acceptance = await queryQaDb(
      `select terms_accepted_at is not null, terms_version from users where id='${userId}';`,
    );
    const [hasTimestamp, termsVersion] = acceptance.split('|');
    expect(hasTimestamp).toBe('t');
    expect(termsVersion).toBe('2026-09-15');

    const firstAcceptedAt = await queryQaDb(`select terms_accepted_at::text from users where id='${userId}';`);

    const auditRow = await queryQaDb(
      `select count(*) from audit_logs where actor_type='user' and actor_id='${userId}' and action='user.terms_accepted';`,
    );
    expect(auditRow).toBe('1');

    // Repeat call (idempotent registration retry) must NOT overwrite the
    // original acceptance timestamp/version and must NOT write a 2nd audit row.
    const res2 = await request.post(`${QA_API_URL}/auth/user/complete-profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { first_name: 'API', last_name: 'Test', agree_terms: true },
    });
    expect(res2.status(), await res2.text()).toBe(201);

    const secondAcceptedAt = await queryQaDb(`select terms_accepted_at::text from users where id='${userId}';`);
    expect(secondAcceptedAt).toBe(firstAcceptedAt);

    const auditRowAfterRepeat = await queryQaDb(
      `select count(*) from audit_logs where actor_type='user' and actor_id='${userId}' and action='user.terms_accepted';`,
    );
    expect(auditRowAfterRepeat).toBe('1');
  });
});

test.describe.serial('Direct API — checkout terms enforcement (POST /bookings/hotel)', () => {
  const PHONE = '+998900000103'; // QA DEMO_AUTH_ALLOWED_PHONES entry, dedicated to this describe block
  let accessToken: string;

  function bookingPayload(overrides: Record<string, unknown>, offsetDays: number) {
    const checkIn = new Date(Date.now() + 86_400_000 * offsetDays);
    const checkOut = new Date(Date.now() + 86_400_000 * (offsetDays + 2));
    return {
      hotel_id: QA_HOTEL_ID,
      room_id: QA_ROOM_ID,
      check_in: checkIn.toISOString().slice(0, 10),
      check_out: checkOut.toISOString().slice(0, 10),
      payment_method: 'click',
      ...overrides,
    };
  }

  test.beforeAll(async ({ request }) => {
    const reg = await beginRegistration(request, PHONE);
    accessToken = reg.accessToken;
    const complete = await request.post(`${QA_API_URL}/auth/user/complete-profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { first_name: 'API', last_name: 'Checkout', agree_terms: true },
    });
    expect(complete.ok(), await complete.text()).toBeTruthy();
  });

  test('missing agree_terms is rejected with 400 TERMS_NOT_ACCEPTED, no booking created', async ({ request }) => {
    const before = await queryQaDb(`select count(*) from bookings;`);

    const res = await request.post(`${QA_API_URL}/bookings/hotel`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: bookingPayload({}, 60),
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('TERMS_NOT_ACCEPTED');

    const after = await queryQaDb(`select count(*) from bookings;`);
    expect(after).toBe(before);
  });

  test('agree_terms=false is rejected with 400 TERMS_NOT_ACCEPTED, no booking created', async ({ request }) => {
    const before = await queryQaDb(`select count(*) from bookings;`);

    const res = await request.post(`${QA_API_URL}/bookings/hotel`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: bookingPayload({ agree_terms: false }, 60),
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('TERMS_NOT_ACCEPTED');

    const after = await queryQaDb(`select count(*) from bookings;`);
    expect(after).toBe(before);
  });

  test('agree_terms as a string "true" is rejected at the DTO boundary, no booking created', async ({ request }) => {
    const before = await queryQaDb(`select count(*) from bookings;`);

    const res = await request.post(`${QA_API_URL}/bookings/hotel`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: bookingPayload({ agree_terms: 'true' }, 60),
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(Array.isArray(body.error.fields)).toBeTruthy();
    expect(body.error.fields.join(' ')).toContain('agree_terms');

    const after = await queryQaDb(`select count(*) from bookings;`);
    expect(after).toBe(before);
  });

  test('agree_terms=true succeeds: booking created atomically with terms_accepted_at/terms_version and an audit row', async ({ request }) => {
    const res = await request.post(`${QA_API_URL}/bookings/hotel`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: bookingPayload({ agree_terms: true }, 64),
    });
    expect(res.status(), await res.text()).toBe(201);
    const body = (await res.json()).data;
    const bookingId = body.booking.id as string;
    expect(bookingId).toBeTruthy();

    const acceptance = await queryQaDb(
      `select terms_accepted_at is not null, terms_version from bookings where id='${bookingId}';`,
    );
    const [hasTimestamp, termsVersion] = acceptance.split('|');
    expect(hasTimestamp).toBe('t');
    expect(termsVersion).toBe('2026-09-15');

    const auditRow = await queryQaDb(
      `select count(*) from audit_logs where entity_type='booking' and entity_id='${bookingId}' and action='booking.terms_accepted';`,
    );
    expect(auditRow).toBe('1');
  });
});
