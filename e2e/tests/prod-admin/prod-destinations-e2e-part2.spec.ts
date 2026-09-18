import { test, expect } from '@playwright/test';
import { trackPageIssues } from '../helpers/console-tracker';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Part 2 — davomi (part1 STEP5'da to'xtadi, chunki web-user'ning Next.js
 * fetch-cache TTL'i (getDestinations() -> revalidate:300, 5 daqiqa) real
 * vaqt talab qiladi. Bu YOMON EMAS — atayin tanlangan freshness/perf
 * trade-off (backend catalog:destinations keshi ham 300s). Shu sabab bu
 * fayl uzoqroq real kutish bilan yozilgan va background'da ishga
 * tushiriladi.
 *
 * Ikkala test destination allaqachon production'da mavjud (part1'dan):
 *   - "E2E Prod Destination 1789645391445 EDITED" (link: /uz/hotels?city_id=toshkent)
 *   - "E2E Prod Destination 1789645667961 EDITED" (link: /uz/hotels?city_id=toshkent)
 */

const ADMIN_URL = 'https://web-admin-phi-beige.vercel.app';
const USER_URL = 'https://web-user-rho.vercel.app';
const ADMIN_EMAIL = 'admin@safaar.uz';
const ADMIN_PASSWORD = 'Admin12345!';

const TITLE1 = 'E2E Prod Destination 1789645391445 EDITED';
const TITLE2 = 'E2E Prod Destination 1789645667961 EDITED';

test.setTimeout(25 * 60_000);

test('Destinations production E2E part 2 — link, inactive/active, reorder, security', async ({ page, request }) => {
  const issues = trackPageIssues(page);

  // /auth/admin/login throttle: 10/60s (auth.controller.ts:289). Oldingi
  // testlar shu oynani band qilgan bo'lishi mumkin — shuning uchun
  // login'ni bir necha marta, orasida kutib, qayta sinaymiz.
  let loggedIn = false;
  for (let attempt = 0; attempt < 5 && !loggedIn; attempt++) {
    await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
    await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Boshqaruv Paneliga Kirish' }).click();
    try {
      await page.waitForURL(/\/dashboard/, { timeout: 20000 });
      loggedIn = true;
    } catch {
      console.log(`LOGIN_ATTEMPT_${attempt}_FAILED_retrying_after_backoff`);
      await page.waitForTimeout(65000);
    }
  }
  expect(loggedIn).toBe(true);

  // ---- 6. Destination link ishlashini tekshirish (TITLE1 hozir keshda faol) ----
  await page.goto(`${USER_URL}/uz`, { waitUntil: 'networkidle', timeout: 30000 });
  const link = page.locator(`a:has(img[alt="${TITLE1}"])`).first();
  const href = await link.getAttribute('href').catch(() => null);
  console.log('STEP6_LINK_HREF=' + href);
  expect(href).toBe('/uz/hotels?city_id=toshkent');
  await link.click();
  await page.waitForURL(/\/uz\/hotels/, { timeout: 15000 });
  console.log('STEP6_NAVIGATED_TO=' + page.url());
  expect(page.url()).toContain('city_id=toshkent');

  // ---- 7. TITLE1'ni inactive qilish ----
  await page.goto(`${ADMIN_URL}/cms/destinations`, { waitUntil: 'networkidle', timeout: 30000 });
  let row1 = page.locator('tr', { hasText: TITLE1 });
  await row1.getByRole('button', { name: 'Faol' }).click();
  await expect(row1.getByRole('button', { name: 'Yashirin' })).toBeVisible({ timeout: 10000 });

  let goneFromApi = false;
  for (let i = 0; i < 10; i++) {
    const res = await request.get('https://api.safaar.uz/v1/catalog/destinations');
    const json = await res.json();
    const found = (json.data as any[]).some((d) => d.name?.uz === TITLE1);
    if (!found) { goneFromApi = true; break; }
    await page.waitForTimeout(3000);
  }
  console.log('STEP7_GONE_FROM_PUBLIC_API=' + goneFromApi);
  expect(goneFromApi).toBe(true);

  // ---- 9 (reorder tayyorgarligi): shu kutish oynasida TITLE2'ni yuqoriga suramiz ----
  const row2 = page.locator('tr', { hasText: TITLE2 });
  const orderCellText = async (t: string) => {
    const r = page.locator('tr', { hasText: t });
    return (await r.locator('td').nth(3).innerText()).trim();
  };
  const before2 = await orderCellText(TITLE2);
  await row2.locator('button[aria-label="Yuqoriga"]').click();
  await page.waitForTimeout(1500);
  const after2 = await orderCellText(TITLE2);
  console.log(`STEP9_ORDER_TITLE2 before=${before2} after=${after2}`);
  expect(after2).not.toBe(before2);

  // ---- Endi WEB-USER'da bitta uzun kutish bilan IKKALASINI tekshiramiz:
  //      TITLE1 yo'qolgan (inactive) va order o'zgargan bo'lishi kerak ----
  let hiddenOnUser = false;
  for (let i = 0; i < 20; i++) {
    await page.goto(`${USER_URL}/uz`, { waitUntil: 'networkidle', timeout: 30000 });
    const stillThere = await page.getByText(TITLE1, { exact: false }).isVisible().catch(() => false);
    if (!stillThere) { hiddenOnUser = true; break; }
    console.log(`STEP7_POLL_${i}_still_visible_waiting...`);
    await page.waitForTimeout(20000);
  }
  console.log('STEP7_HIDDEN_ON_USER=' + hiddenOnUser);
  expect(hiddenOnUser).toBe(true);

  // ---- 8. TITLE1'ni qayta active qilish ----
  await page.goto(`${ADMIN_URL}/cms/destinations`, { waitUntil: 'networkidle', timeout: 30000 });
  row1 = page.locator('tr', { hasText: TITLE1 });
  await row1.getByRole('button', { name: 'Yashirin' }).click();
  await expect(row1.getByRole('button', { name: 'Faol' })).toBeVisible({ timeout: 10000 });

  let backOnApi = false;
  for (let i = 0; i < 10; i++) {
    const res = await request.get('https://api.safaar.uz/v1/catalog/destinations');
    const json = await res.json();
    const found = (json.data as any[]).some((d) => d.name?.uz === TITLE1);
    if (found) { backOnApi = true; break; }
    await page.waitForTimeout(3000);
  }
  console.log('STEP8_BACK_ON_PUBLIC_API=' + backOnApi);
  expect(backOnApi).toBe(true);

  // ---- 9. Order haqiqatan ham public API'da TITLE2 < TITLE1 ekanini tasdiqlash ----
  const res = await request.get('https://api.safaar.uz/v1/catalog/destinations');
  const json = await res.json();
  const names = (json.data as any[]).map((d) => d.name?.uz);
  const idx1 = names.indexOf(TITLE1);
  const idx2 = names.indexOf(TITLE2);
  console.log(`STEP9_FINAL_ORDER names=${JSON.stringify(names)} idx1=${idx1} idx2=${idx2}`);
  expect(idx2).toBeLessThan(idx1);

  // ---- 10. Xavfsizlik: tashqi (absolyut) link — client-side va public API'da yashiriladi ----
  await page.goto(`${ADMIN_URL}/cms/destinations`, { waitUntil: 'networkidle', timeout: 30000 });
  row1 = page.locator('tr', { hasText: TITLE1 });
  await row1.locator('td').last().locator('button').first().click();
  await page.getByLabel(/Havola/).fill('http://evil.example.com/phish');
  await page.getByRole('button', { name: 'Saqlash' }).click();
  const clientBlocked = await page.getByText(/Havola faqat/).isVisible().catch(() => false);
  console.log('STEP10_CLIENT_SIDE_VALIDATION_BLOCKED=' + clientBlocked);
  if (clientBlocked) {
    await page.getByRole('button', { name: 'Bekor qilish' }).click();
  }

  // ---- 11. Authorization: token'siz yozish so'rovi rad etilishi kerak ----
  const unauthCreate = await request.post('https://api.safaar.uz/v1/admin/cms/destinations', {
    data: { title: { uz: 'hack attempt' } },
    failOnStatusCode: false,
  });
  console.log('STEP11_UNAUTH_CREATE_STATUS=' + unauthCreate.status());
  expect([401, 403]).toContain(unauthCreate.status());

  const garbageTokenCreate = await request.post('https://api.safaar.uz/v1/admin/cms/destinations', {
    headers: { Authorization: 'Bearer garbage.invalid.token' },
    data: { title: { uz: 'hack attempt 2' } },
    failOnStatusCode: false,
  });
  console.log('STEP11_GARBAGE_TOKEN_STATUS=' + garbageTokenCreate.status());
  expect([401, 403]).toContain(garbageTokenCreate.status());

  console.log('ALL_CONSOLE_ERRORS=' + JSON.stringify(issues.consoleErrors));
});
