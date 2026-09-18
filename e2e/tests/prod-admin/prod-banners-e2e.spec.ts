import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CMS Banners — audit paytida topilgan "100% mock CRUD + web-user'da
 * umuman iste'molchisi yo'q" muammosi tuzatilgandan keyingi real
 * production E2E: admin banner yaratadi (real rasm yuklash bilan) ->
 * generic CMS (`/admin/cms/banners`) orqali saqlanadi -> web-user bosh
 * sahifasida (`GET /cms/banners`) haqiqatan ko'rinadi.
 */

const ADMIN_URL = 'https://web-admin-phi-beige.vercel.app';
const USER_URL = 'https://web-user-rho.vercel.app';
const ADMIN_EMAIL = 'admin@safaar.uz';
const ADMIN_PASSWORD = 'Admin12345!';

test.setTimeout(180_000);

test('Banners production E2E — admin create -> real image upload -> visible on web-user home', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Boshqaruv Paneliga Kirish' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });

  await page.goto(`${ADMIN_URL}/cms/banners`, { waitUntil: 'networkidle', timeout: 30000 });
  await expect(page.getByRole('main').getByRole('heading', { name: 'Bannerlar' })).toBeVisible();

  const title = `E2E Prod Banner ${Date.now()}`;
  await page.getByRole('button', { name: "Yangi banner qo'shish" }).click();
  await page.getByPlaceholder('Masalan: Qishki takliflar').fill(title);
  await page.getByPlaceholder('/hotels yoki /uz/deals').fill('/uz/hotels');

  const pngPath = path.join('/tmp', `e2e-banner-pixel-${Date.now()}.png`);
  fs.writeFileSync(
    pngPath,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  );
  await page.locator('input[type="file"]').setInputFiles(pngPath);
  await expect(page.locator('img[alt="Preview"]')).toBeVisible({ timeout: 15000 });

  // Real yuklangan URL bo'lishi kerak — blob: EMAS (avvalgi bug shu edi).
  const previewSrc = await page.locator('img[alt="Preview"]').getAttribute('src');
  expect(previewSrc).toBeTruthy();
  expect(previewSrc).not.toContain('blob:');

  await page.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

  // web-user bosh sahifasida ko'rinishini tasdiqlaymiz (300s cache TTL bor,
  // shuning uchun bir necha marta poll qilamiz).
  let visibleOnUser = false;
  for (let i = 0; i < 8; i++) {
    await page.goto(`${USER_URL}/uz`, { waitUntil: 'networkidle', timeout: 30000 });
    const banner = page.getByText(title, { exact: false });
    if (await banner.count()) {
      visibleOnUser = true;
      break;
    }
    await page.waitForTimeout(15000);
  }
  console.log('BANNER_VISIBLE_ON_USER=' + visibleOnUser);
  expect(visibleOnUser).toBe(true);

  // ---- Tozalash: yaratilgan test bannerini o'chiramiz ----
  await page.goto(`${ADMIN_URL}/cms/banners`, { waitUntil: 'networkidle', timeout: 30000 });
  const row = page.locator('tr', { hasText: title });
  page.once('dialog', (dialog) => dialog.accept());
  await row.locator('td').last().locator('button').last().click();
  await expect(page.getByText(title)).not.toBeVisible({ timeout: 10000 });
});
