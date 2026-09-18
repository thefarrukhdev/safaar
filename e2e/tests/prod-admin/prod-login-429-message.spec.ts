import { test, expect } from '@playwright/test';

/**
 * Login formasi 429 (rate-limited) javobini qanday ko'rsatishini tekshiradi.
 * Muammo: handleLogin'ning catch bloki `err.message`ni ishlatardi — bu
 * axios'ning o'zining umumiy, inglizcha matni ("Request failed with status
 * code 429"), backend'ning haqiqiy xabari (`err.response.data.error.message`)
 * EMAS. `finally` bloki loading'ni har doim to'g'ri false qilib
 * qo'yganini ham (tugma abadiy "disabled" bo'lib qolmasligini) tasdiqlaydi.
 *
 * Bu test HAQIQIY production backend'ni haqiqatan rate-limit qilib (10
 * so'rov/60s, admin/login), keyin brauzerda REAL 11-chi urinishni qilib
 * ko'radi — mock/fake javob emas.
 */

const ADMIN_URL = 'https://web-admin-phi-beige.vercel.app';
const ADMIN_EMAIL = 'admin@safaar.uz';
const ADMIN_PASSWORD = 'Admin12345!';

test.setTimeout(60_000);

test('429 response: spinner stops, button re-enables, a real (non-generic) message is shown', async ({ page, request }) => {
  // Backend'ni haqiqatan 429'ga olib boramiz (10/60s limit) — real login
  // POST orqali, brauzerdan tashqarida, tezkor ravishda.
  let saw429 = false;
  for (let i = 0; i < 12 && !saw429; i++) {
    const res = await request.post('https://api.safaar.uz/v1/auth/admin/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (res.status() === 429) saw429 = true;
  }
  expect(saw429).toBe(true);

  // Endi haqiqiy brauzerda, xuddi shu oynada, formani submit qilamiz —
  // bu ham 429 olishi kerak (limit hali tiklanmagan).
  await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);

  const submitButton = page.getByRole('button', { name: 'Boshqaruv Paneliga Kirish' });
  await submitButton.click();

  // Spinner tugashini kutamiz (loading=false -> tugma matni qaytadi).
  await expect(submitButton).toBeEnabled({ timeout: 15000 });
  await expect(page.getByText('Boshqaruv Paneliga Kirish')).toBeVisible();

  // Sahifa /login'da qolishi kerak (dashboard'ga o'tmagan).
  expect(page.url()).toContain('/login');

  // Xato xabari ko'rinishi va GENERIC axios matni EMASLIGINI tasdiqlaymiz.
  const errorLocator = page.locator('.text-rose-700, [class*="rose"]').first();
  const errorText = await errorLocator.textContent().catch(() => null);
  console.log('SHOWN_ERROR_TEXT=' + errorText);
  expect(errorText).toBeTruthy();
  expect(errorText).not.toContain('Request failed with status code');
  expect(errorText).not.toContain('status code 429');

  // Tugma qayta ishlatilishi mumkinligini haqiqatan sinaymiz (yana bosish).
  await submitButton.click();
  // Hali ham rate-limited bo'lishi mumkin — muhimi, click qabul qilinadi
  // (tugma disabled bo'lib qolmagan) va yana bir marta spinner/tugash sodir bo'ladi.
  await expect(submitButton).toBeEnabled({ timeout: 15000 });
});
