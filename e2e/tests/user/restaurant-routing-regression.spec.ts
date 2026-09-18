import { test, expect } from '@playwright/test';

/**
 * Regression: restaurant kartasi href'ida locale prefiksi yo'q edi
 * (`/restaurants/{id}` o'rniga `/${locale}/restaurants/{id}` kerak edi),
 * bu haqiqiy production'da 404'ga olib kelardi. Bu test kartadan bosib
 * detail sahifaga real navigatsiya qilib, keyin booking bo'limi
 * ko'rinishini tasdiqlaydi.
 */

test.describe('Restaurant card -> detail -> booking routing', () => {
  test('clicking a restaurant card navigates to a locale-prefixed detail URL, not a 404', async ({ page }) => {
    await page.goto('/uz/restaurants');

    const firstCard = page.locator('a[href*="/restaurants/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });

    const href = await firstCard.getAttribute('href');
    expect(href, 'restoran kartasi href atributiga ega bo\'lishi kerak').toBeTruthy();
    expect(href).toMatch(/^\/uz\/restaurants\/.+/);

    await firstCard.click();
    await page.waitForURL(/\/uz\/restaurants\/.+/, { timeout: 15_000 });

    // 404 sahifasiga tushmaganini tasdiqlaymiz (Next.js not-found sahifasi
    // aniq matn ko'rsatadi va booking bo'limi bo'lmaydi).
    await expect(page.getByText('Stol bron qilish')).toBeVisible({ timeout: 15_000 });
  });
});
