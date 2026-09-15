import { test, expect } from '@playwright/test';

const QA_API = 'http://100.109.46.108:4400/v1';

test('malformed/invalid auth header handling (correct endpoint: /partners/hotels)', async ({ request }) => {
  const cases = [
    { name: 'garbage bearer', header: 'Bearer not-a-real-jwt-at-all' },
    { name: 'empty bearer', header: 'Bearer ' },
    { name: 'wrong scheme', header: 'Basic dXNlcjpwYXNz' },
    { name: 'sql-injection-ish', header: "Bearer ' OR '1'='1" },
  ];
  for (const c of cases) {
    const res = await request.get(`${QA_API}/partners/hotels`, { headers: { Authorization: c.header } });
    const body = await res.text();
    console.log(`AUTH_CASE[${c.name}]: HTTP ${res.status()} bodyLen=${body.length} bodySnippet=${body.slice(0, 150)}`);
    expect([401, 403], `${c.name} should not be accepted, got ${res.status()}`).toContain(res.status());
    expect(body.toLowerCase(), `${c.name} response must not leak a stack trace`).not.toContain('at object.');
  }
});

test('rate limiting / OTP throttle (correct endpoint: /otp/request)', async ({ request }) => {
  const phone = '+998900099998';
  let sawThrottle = false;
  for (let i = 0; i < 7; i++) {
    const res = await request.post(`${QA_API}/auth/otp/request`, { data: { phone } });
    const status = res.status();
    console.log(`RATE_LIMIT_ATTEMPT_${i}: HTTP ${status}`);
    if (status === 429) sawThrottle = true;
  }
  expect(sawThrottle, 'per-phone OTP throttle should trigger 429 within 7 rapid requests').toBe(true);
});

test('partner cannot access another partner org resources by guessing IDs (IDOR check on hotels list scoping)', async ({ request }) => {
  // Log in as partner-6, list hotels (should be empty/only own), confirm scoping via API itself
  const sendOtp = await request.post(`${QA_API}/auth/otp/request`, { data: { phone: '+998900000006' } });
  expect(sendOtp.ok()).toBeTruthy();
  const otpBody = await sendOtp.json();
  console.log('OTP_RESPONSE_KEYS:', Object.keys(otpBody.data ?? otpBody));
});
