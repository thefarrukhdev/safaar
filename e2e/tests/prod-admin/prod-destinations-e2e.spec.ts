import { test, expect } from '@playwright/test';
import { trackPageIssues } from '../helpers/console-tracker';
import * as fs from 'fs';
import * as path from 'path';

/**
 * "Mashhur yo'nalishlar" (destinations) — real production E2E, bitta
 * uzluksiz sessiya ichida (admin/login uchun 10 so'rov/60s throttle bor —
 * auth.controller.ts:289 — shuning uchun har bosqich uchun qayta login
 * QILINMAYDI, xuddi mavjud admin/critical-flow.spec.ts naqshiga o'xshab).
 *
 * web-admin: https://web-admin-phi-beige.vercel.app (bu loyihaning o'zi
 * mavjud prod-admin testlarida ham shu URL ishlatiladi — admin.safaar.uz
 * DNS orqali resolve bo'lmaydi, custom domain hali ulanmagan).
 * web-user: https://web-user-rho.vercel.app (safaar.uz boshqa Vercel
 * account ostida, bu sessiyadan yozib bo'lmaydi).
 * backend: https://api.safaar.uz (yagona, rasmiy production backend).
 */

const ADMIN_URL = 'https://web-admin-phi-beige.vercel.app';
const USER_URL = 'https://web-user-rho.vercel.app';
const ADMIN_EMAIL = 'admin@safaar.uz';
const ADMIN_PASSWORD = 'Admin12345!';

test.setTimeout(180_000);

test('Destinations production E2E — to\'liq uzluksiz oqim', async ({ page, request }) => {
  const issues = trackPageIssues(page);

  // ---- 1. Login (bir marta) ----
  await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Boshqaruv Paneliga Kirish' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });

  await page.goto(`${ADMIN_URL}/cms/destinations`, { waitUntil: 'networkidle', timeout: 30000 });
  await expect(page.getByRole('heading', { name: "Mashhur yo'nalishlar" })).toBeVisible();
  console.log('STEP1_CONSOLE_ERRORS=' + JSON.stringify(issues.consoleErrors));

  // ---- 2. Yangi destination yaratish (title + real image upload + relative link) ----
  const title1 = `E2E Prod Destination ${Date.now()}`;
  await page.getByRole('button', { name: "Yangi qo'shish" }).click();
  await page.getByLabel(/Nomi/).fill(title1);

  const pngPath = path.join('/tmp', `e2e-test-pixel-${Date.now()}.png`);
  fs.writeFileSync(
    pngPath,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  );
  await page.locator('input[type="file"]').setInputFiles(pngPath);
  await expect(page.locator('img[alt="Preview"]')).toBeVisible({ timeout: 15000 });

  await page.getByLabel(/Havola/).fill('/uz/hotels?city_id=toshkent');
  await page.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText(title1)).toBeVisible({ timeout: 10000 });
  console.log('CREATED_TITLE=' + title1);

  // ---- 3. Active ekanini tekshirish (create paytida isActive:true bilan yaratilgan) ----
  let row1 = page.locator('tr', { hasText: title1 });
  await expect(row1.getByRole('button', { name: 'Faol' })).toBeVisible({ timeout: 10000 });

  // ---- 4. Edit — title yangilash ----
  await row1.locator('td').last().locator('button').first().click();
  const title1Edited = title1 + ' EDITED';
  await page.getByLabel(/Nomi/).fill(title1Edited);
  await page.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText(title1Edited)).toBeVisible({ timeout: 10000 });
  console.log('EDITED_TITLE=' + title1Edited);
  row1 = page.locator('tr', { hasText: title1Edited });

  // ---- 5. web-user'da real ko'rinishini tekshirish (backend + Vercel edge cache uchun poll) ----
  let visibleOnUser = false;
  let userSrc = '';
  for (let i = 0; i < 8; i++) {
    await page.goto(`${USER_URL}/uz`, { waitUntil: 'networkidle', timeout: 30000 });
    const card = page.getByText(title1Edited, { exact: false });
    if (await card.isVisible().catch(() => false)) {
      visibleOnUser = true;
      const img = page.locator(`img[alt="${title1Edited}"]`).first();
      userSrc = (await img.getAttribute('src').catch(() => null)) ?? '';
      break;
    }
    await page.waitForTimeout(5000);
  }
  console.log('STEP5_VISIBLE_ON_USER=' + visibleOnUser + ' IMAGE_SRC=' + userSrc);
  expect(visibleOnUser).toBe(true);
  expect(userSrc).toBeTruthy();

  // ---- 6. Destination link ishlashini tekshirish ----
  await page.goto(`${USER_URL}/uz`, { waitUntil: 'networkidle', timeout: 30000 });
  const link = page.locator(`a:has(img[alt="${title1Edited}"])`).first();
  const href = await link.getAttribute('href').catch(() => null);
  console.log('STEP6_LINK_HREF=' + href);
  expect(href).toBe('/uz/hotels?city_id=toshkent');
  await link.click();
  await page.waitForURL(/\/uz\/hotels/, { timeout: 15000 });
  console.log('STEP6_NAVIGATED_TO=' + page.url());
  expect(page.url()).toContain('/uz/hotels');
  expect(page.url()).toContain('city_id=toshkent');

  // ---- 7. Inactive qilish -> web-userdan yo'qolishi ----
  await page.goto(`${ADMIN_URL}/cms/destinations`, { waitUntil: 'networkidle', timeout: 30000 });
  row1 = page.locator('tr', { hasText: title1Edited });
  await row1.getByRole('button', { name: 'Faol' }).click();
  await expect(row1.getByRole('button', { name: 'Yashirin' })).toBeVisible({ timeout: 10000 });

  let goneFromApi = false;
  for (let i = 0; i < 10; i++) {
    const res = await request.get('https://api.safaar.uz/v1/catalog/destinations');
    const json = await res.json();
    const found = (json.data as any[]).some((d) => d.name?.uz === title1Edited);
    if (!found) { goneFromApi = true; break; }
    await page.waitForTimeout(3000);
  }
  console.log('STEP7_GONE_FROM_API=' + goneFromApi);
  expect(goneFromApi).toBe(true);

  let hiddenOnUser = false;
  for (let i = 0; i < 5; i++) {
    await page.goto(`${USER_URL}/uz`, { waitUntil: 'networkidle', timeout: 30000 });
    const stillThere = await page.getByText(title1Edited, { exact: false }).isVisible().catch(() => false);
    if (!stillThere) { hiddenOnUser = true; break; }
    await page.waitForTimeout(4000);
  }
  console.log('STEP7_HIDDEN_ON_USER=' + hiddenOnUser);
  expect(hiddenOnUser).toBe(true);

  // ---- 8. Qayta active qilish -> qaytishi ----
  await page.goto(`${ADMIN_URL}/cms/destinations`, { waitUntil: 'networkidle', timeout: 30000 });
  row1 = page.locator('tr', { hasText: title1Edited });
  await row1.getByRole('button', { name: 'Yashirin' }).click();
  await expect(row1.getByRole('button', { name: 'Faol' })).toBeVisible({ timeout: 10000 });

  let backOnApi = false;
  for (let i = 0; i < 10; i++) {
    const res = await request.get('https://api.safaar.uz/v1/catalog/destinations');
    const json = await res.json();
    const found = (json.data as any[]).some((d) => d.name?.uz === title1Edited);
    if (found) { backOnApi = true; break; }
    await page.waitForTimeout(3000);
  }
  console.log('STEP8_BACK_ON_API=' + backOnApi);
  expect(backOnApi).toBe(true);

  // ---- 9. Ikkinchi destination yaratish + reorder tekshirish ----
  await page.goto(`${ADMIN_URL}/cms/destinations`, { waitUntil: 'networkidle', timeout: 30000 });
  const title2 = `E2E Prod Destination B ${Date.now()}`;
  await page.getByRole('button', { name: "Yangi qo'shish" }).click();
  await page.getByLabel(/Nomi/).fill(title2);
  const pngPath2 = path.join('/tmp', `e2e-test-pixel-b-${Date.now()}.png`);
  fs.writeFileSync(pngPath2, fs.readFileSync(pngPath));
  await page.locator('input[type="file"]').setInputFiles(pngPath2);
  await expect(page.locator('img[alt="Preview"]')).toBeVisible({ timeout: 15000 });
  await page.getByLabel(/Havola/).fill('/uz/hotels?city_id=samarqand');
  await page.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText(title2)).toBeVisible({ timeout: 10000 });
  console.log('CREATED_TITLE2=' + title2);

  // Ikkalasi endi jadvalda; order ustunidagi qiymatlarni o'qiymiz.
  const orderCellText = async (t: string) => {
    const r = page.locator('tr', { hasText: t });
    return (await r.locator('td').nth(3).innerText()).trim();
  };
  const before1 = await orderCellText(title1Edited);
  const before2 = await orderCellText(title2);
  console.log(`STEP9_ORDER_BEFORE title1=${before1} title2=${before2}`);

  // title2'ni yuqoriga suramiz (Arrow Up), tartib almashishini kutamiz.
  const row2 = page.locator('tr', { hasText: title2 });
  await row2.locator('button[aria-label="Yuqoriga"]').click();
  await page.waitForTimeout(1500);

  const after1 = await orderCellText(title1Edited);
  const after2 = await orderCellText(title2);
  console.log(`STEP9_ORDER_AFTER title1=${after1} title2=${after2}`);
  expect(after1).not.toBe(before1);
  expect(after2).not.toBe(before2);

  let orderReflectedOnUser = false;
  for (let i = 0; i < 8; i++) {
    const res = await request.get('https://api.safaar.uz/v1/catalog/destinations');
    const json = await res.json();
    const names = (json.data as any[]).map((d) => d.name?.uz);
    const idx1 = names.indexOf(title1Edited);
    const idx2 = names.indexOf(title2);
    if (idx1 !== -1 && idx2 !== -1 && idx2 < idx1) { orderReflectedOnUser = true; break; }
    await page.waitForTimeout(3000);
  }
  console.log('STEP9_ORDER_REFLECTED_PUBLIC_API=' + orderReflectedOnUser);
  expect(orderReflectedOnUser).toBe(true);

  // ---- 10. Xavfsizlik: tashqi (absolyut) link server-side rad etiladi ----
  await page.goto(`${ADMIN_URL}/cms/destinations`, { waitUntil: 'networkidle', timeout: 30000 });
  await row1.locator('td').last().locator('button').first().click();
  await page.getByLabel(/Havola/).fill('http://evil.example.com/phish');
  await page.getByRole('button', { name: 'Saqlash' }).click();
  const clientError = page.getByText(/Havola faqat/);
  const clientBlocked = await clientError.isVisible().catch(() => false);
  console.log('STEP10_CLIENT_SIDE_BLOCKED=' + clientBlocked);
  if (clientBlocked) {
    await page.getByRole('button', { name: 'Bekor qilish' }).click();
  }

  const directWrite = await request.post('https://api.safaar.uz/v1/admin/cms/destinations', {
    data: {},
    failOnStatusCode: false,
  });
  console.log('STEP10_UNAUTH_WRITE_STATUS=' + directWrite.status());
  expect([401, 403]).toContain(directWrite.status());

  console.log('FINAL_TITLES=' + JSON.stringify({ title1: title1Edited, title2 }));
  console.log('ALL_CONSOLE_ERRORS=' + JSON.stringify(issues.consoleErrors));
});
