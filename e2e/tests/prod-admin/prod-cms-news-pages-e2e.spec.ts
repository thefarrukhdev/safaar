import { test, expect } from '@playwright/test';

/**
 * CMS News/Pages admin CRUD — audit paytida topilgan muammo:
 * CmsArticleManager faqat local React state'ni o'zgartirar edi (hech
 * qanday backend so'rovisiz), shuning uchun "yaratilgan" kontent sahifa
 * yangilanganda (reload) g'oyib bo'lardi. Bu test aynan shu regressionni
 * tekshiradi: yaratish -> reload -> hali ham mavjud -> o'chirish.
 */

const ADMIN_URL = 'https://web-admin-phi-beige.vercel.app';
const ADMIN_EMAIL = 'admin@safaar.uz';
const ADMIN_PASSWORD = 'Admin12345!';

test.setTimeout(180_000);

async function login(page: import('@playwright/test').Page) {
  await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Boshqaruv Paneliga Kirish' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
}

for (const resource of [
  { path: '/cms/news', addLabel: "Yangilik qo'shish", heading: 'Yangiliklar' },
  { path: '/cms/pages', addLabel: 'Sahifa qo\'shish', heading: 'Statik sahifalar' },
] as const) {
  test(`CMS ${resource.heading} — create survives reload (was local-state-only mock)`, async ({ page }) => {
    await login(page);
    await page.goto(`${ADMIN_URL}${resource.path}`, { waitUntil: 'networkidle', timeout: 30000 });
    await expect(page.getByRole('heading', { name: resource.heading })).toBeVisible();

    const title = `E2E ${resource.heading} ${Date.now()}`;
    await page.getByRole('button', { name: resource.addLabel }).click();
    await page.getByLabel('Sarlavha').fill(title);
    await page.getByRole('button', { name: 'Saqlash' }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

    // Regression tekshiruvi: reload'dan keyin ham bor bo'lishi kerak —
    // eski implementatsiya faqat setState edi, reload'da yo'qolardi.
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText(title)).toBeVisible({ timeout: 15000 });

    // Tozalash
    const row = page.locator('tr', { hasText: title });
    page.once('dialog', (dialog) => dialog.accept());
    await row.locator('td').last().locator('button').last().click();
    await expect(page.getByText(title)).not.toBeVisible({ timeout: 10000 });

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText(title)).not.toBeVisible();
  });
}
