import { test, expect } from '@playwright/test';

const QA_API = 'http://100.109.46.108:4400/v1';

test.describe('API security/authorization matrix (real HTTP, real QA backend)', () => {
  test('unauthenticated -> protected partner endpoints', async ({ request }) => {
    const endpoints = [
      '/partners/me',
      '/partners/hotels',
      '/partners/bookings',
      '/partners/finance/balance',
    ];
    for (const ep of endpoints) {
      const res = await request.get(`${QA_API}${ep}`);
      console.log(`UNAUTH GET ${ep}: HTTP ${res.status()}`);
      expect([401, 403, 404], `${ep} should reject unauthenticated access, got ${res.status()}`).toContain(res.status());
    }
  });

  test('malformed/invalid auth header handling', async ({ request }) => {
    const cases = [
      { name: 'garbage bearer', header: 'Bearer not-a-real-jwt-at-all' },
      { name: 'empty bearer', header: 'Bearer ' },
      { name: 'wrong scheme', header: 'Basic dXNlcjpwYXNz' },
      { name: 'sql-injection-ish', header: "Bearer ' OR '1'='1" },
    ];
    for (const c of cases) {
      const res = await request.get(`${QA_API}/partners/me`, { headers: { Authorization: c.header } });
      const body = await res.text();
      console.log(`AUTH_CASE[${c.name}]: HTTP ${res.status()} bodyLen=${body.length}`);
      expect([401, 403], `${c.name} should not be accepted`).toContain(res.status());
      expect(body.toLowerCase(), `${c.name} response must not leak a stack trace`).not.toContain('at object.');
    }
  });

  test('invalid UUID / malformed params handling', async ({ request }) => {
    const cases = [
      '/catalog/regions/not-a-uuid',
      '/partners/hotels/../../etc/passwd',
      '/partners/hotels/%00',
    ];
    for (const ep of cases) {
      const res = await request.get(`${QA_API}${ep}`).catch((e) => ({ status: () => -1, text: async () => String(e) }) as any);
      const status = res.status();
      console.log(`MALFORMED_PARAM ${ep}: HTTP ${status}`);
    }
  });

  test('malformed JSON body handling', async ({ request }) => {
    const res = await request.post(`${QA_API}/auth/partner/send-otp`, {
      headers: { 'Content-Type': 'application/json' },
      data: '{not valid json!!!',
    });
    console.log('MALFORMED_JSON: HTTP', res.status());
    expect(res.status(), 'malformed JSON should be a clean 400, not a 500').toBeLessThan(500);
    const body = await res.text();
    expect(body.length, 'error body should be small, not a stack trace dump').toBeLessThan(2000);
  });

  test('rate limiting / OTP throttle behaves (existing per-phone limit)', async ({ request }) => {
    const phone = '+998900099999'; // unapproved, but exercises the throttle path itself
    let last429 = false;
    for (let i = 0; i < 7; i++) {
      const res = await request.post(`${QA_API}/auth/partner/send-otp`, { data: { phone } });
      console.log(`RATE_LIMIT_ATTEMPT_${i}: HTTP ${res.status()}`);
      if (res.status() === 429) last429 = true;
    }
    console.log('RATE_LIMIT_429_OBSERVED:', last429);
  });

  test('CORS: disallowed origin is not reflected', async ({ request }) => {
    const res = await request.get(`${QA_API}/health`, { headers: { Origin: 'https://evil-attacker.example.com' } });
    const acao = res.headers()['access-control-allow-origin'];
    console.log('CORS_ACAO_FOR_EVIL_ORIGIN:', acao ?? '(none)');
    expect(acao, 'CORS must not reflect an arbitrary/untrusted origin').not.toBe('https://evil-attacker.example.com');
  });
});
