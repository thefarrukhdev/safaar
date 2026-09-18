import { test, expect } from '@playwright/test';

/**
 * proxy.ts root-cause fix — regression tekshiruvi.
 *
 * Ilgari: proxy faqat `admin_token` cookie BOR-YO'QligIni tekshirar edi,
 * uning HAQIQATAN amaldaligini emas. Natijada, cookie muddati o'tgan
 * (lekin brauzerda hali "present") bo'lsa ham, proxy uni "bor" deb
 * hisoblab, /login'ga kirishga urinishni /dashboard'ga qaytarib
 * yuborardi — u yerda 401 bo'lib, client yana /login'ga qaytardi —
 * production'da kuzatilgan uzluksiz /login<->/dashboard 307/304 loop
 * aynan shu tuzilmaviy kamchilik edi.
 *
 * Bu test HAQIQIY, real muddati o'tgan (lekin struktura jihatdan to'g'ri
 * JWT shaklidagi) tokenni cookie sifatida qo'yadi va ikkala yo'nalishni
 * ham tekshiradi:
 *   1) /login'ga kirish -> /dashboard'ga qaytarilmasligi kerak (loop'ning
 *      "isAuthPage" tomoni).
 *   2) /dashboard'ga to'g'ridan-to'g'ri kirish -> /login'ga
 *      yo'naltirilishi kerak (loop'ning boshqa tomoni, va bu HTTP
 *      darajasida, sahifa hatto yuklanmasdan sodir bo'lishi kerak).
 */

const ADMIN_URL = 'https://web-admin-phi-beige.vercel.app';
const ADMIN_EMAIL = 'admin@safaar.uz';
const ADMIN_PASSWORD = 'Admin12345!';

function buildExpiredToken(realToken: string): string {
  const parts = realToken.split('.');
  const json = Buffer.from(
    parts[1].replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  ).toString();
  const payload = JSON.parse(json);
  payload.exp = Math.floor(Date.now() / 1000) - 3600;
  const expiredPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${parts[0]}.${expiredPayload}.${parts[2]}`;
}

test('proxy no longer bounces an expired-but-present token cookie', async ({ page, request, context }) => {
  const loginRes = await request.post('https://api.safaar.uz/v1/auth/admin/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const loginJson = await loginRes.json();
  const realToken: string = loginJson.data.accessToken;
  const expiredToken = buildExpiredToken(realToken);

  await context.addCookies([
    {
      name: 'admin_token',
      value: expiredToken,
      domain: new URL(ADMIN_URL).hostname,
      path: '/',
    },
  ]);

  // 1) /login with an expired-but-present cookie must NOT bounce to /dashboard.
  await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  expect(page.url()).toBe(`${ADMIN_URL}/login`);
  await expect(page.getByPlaceholder('admin')).toBeVisible();

  // 2) Direct /dashboard access with the same expired cookie must redirect
  //    straight to /login at the HTTP level (no dashboard shell loads first).
  const dashRes = await page.request.get(`${ADMIN_URL}/dashboard`, { maxRedirects: 0 });
  expect(dashRes.status()).toBe(307);
  const location = dashRes.headers()['location'];
  expect(location).toContain('/login');
});
