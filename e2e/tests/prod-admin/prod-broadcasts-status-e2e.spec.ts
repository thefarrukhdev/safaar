import { test, expect } from '@playwright/test';

/**
 * Broadcasts — audit paytida topilgan status-mapping bugi: action='send'
 * literal 'send' satrini status ustuniga yozar edi (na UI, na CMS status
 * lug'atiga mos kelmaydigan), shuning uchun "Yuborishni boshlash" bosilgach
 * qator abadiy "hech qanday amal yo'q" holatida qotib qolardi. Bu test
 * haqiqiy production'da: yaratish -> "Yuborishni boshlash" -> holat
 * "Yuborilmoqda" (sending) ga o'tishini va "Bekor qilish" amali
 * ko'rinishini tasdiqlaydi (haqiqiy yetkazib berish emas — u alohida,
 * hali yopilmagan blocker sifatida hujjatlashtirilgan).
 */

const ADMIN_URL = 'https://web-admin-phi-beige.vercel.app';
const ADMIN_EMAIL = 'admin@safaar.uz';
const ADMIN_PASSWORD = 'Admin12345!';

test.setTimeout(120_000);

test('broadcast send action transitions status to a real, UI-recognized value (not the literal string "send")', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Boshqaruv Paneliga Kirish' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });

  await page.goto(`${ADMIN_URL}/cms/broadcasts`, { waitUntil: 'networkidle', timeout: 30000 });
  await expect(page.getByRole('main').getByRole('heading', { name: 'Ommaviy Xabarnomalar' })).toBeVisible();

  const title = `E2E Broadcast ${Date.now()}`;
  await page.getByRole('button', { name: 'Yangi xabarnoma' }).click();
  await page.getByPlaceholder('Xabarnoma sarlavhasi').fill(title);
  await page.getByPlaceholder("Asosiy matn...").fill('E2E test matni');
  await page.getByRole('button', { name: /Saqlash/ }).click();
  await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

  const row = page.locator('tr', { hasText: title });
  await row.getByRole('button').last().click();
  await page.getByRole('button', { name: 'Yuborishni boshlash' }).click();

  // Toast o'tkinchi bo'lgani uchun emas, balki qatorning DOIMIY holatiga
  // (status ustuniga) qarab tekshiramiz — bu haqiqiy, saqlangan dalil.
  const row1 = page.locator('tr', { hasText: title });
  await expect(row1.getByText('Yuborilmoqda')).toBeVisible({ timeout: 10000 });

  await page.reload({ waitUntil: 'networkidle' });
  const rowAfter = page.locator('tr', { hasText: title });
  await expect(rowAfter.getByText('Yuborilmoqda')).toBeVisible({ timeout: 10000 });

  // Endi "Bekor qilish" amali ko'rinishi kerak (avval statusi noto'g'ri
  // 'send' satri bo'lgani uchun na bu, na "Yuborishni boshlash" ko'rinmasdi).
  await rowAfter.getByRole('button').last().click();
  await expect(page.getByRole('button', { name: /Bekor qilish/ })).toBeVisible({ timeout: 5000 });
});
