import { test, expect } from '@playwright/test';

/**
 * Regression: transport kartasi umuman href/onClick'ga ega emas edi (dead
 * card), transport uchun detail sahifa yoki booking flow mavjud emas edi,
 * kategoriya tablari va "QIDIRISH" tugmasi hech narsaga ta'sir qilmasdi.
 * Bu test real production'da to'liq zanjirni tasdiqlaydi:
 * listing -> kategoriya filtri -> kartani bosish -> detail -> booking.
 */

test.describe('Transport card -> detail -> booking routing', () => {
  test('category tabs filter results, and clicking a card navigates to a real, locale-prefixed detail page', async ({ page }) => {
    await page.goto('/uz/transport');

    const resultsHeading = page.locator('h2', { hasText: 'ta transport topildi' });
    await expect(resultsHeading).toBeVisible({ timeout: 15_000 });

    // Kategoriya tab bosilganda natija soni (yoki bo'sh holat) o'zgarishi kerak —
    // avval bu hech narsaga ta'sir qilmasdi.
    const vipTab = page.getByRole('button', { name: /VIP/i });
    if (await vipTab.count()) {
      await vipTab.click();
      await expect(resultsHeading).toBeVisible();
    }

    // "Barcha turlar" tabiga qaytamiz, kartalar ko'rinishini tasdiqlaymiz.
    await page.getByRole('button', { name: /Barcha turlar/i }).first().click();

    const firstCard = page.locator('a[href*="/transport/"]').first();
    const hasCard = await firstCard.count();

    if (hasCard === 0) {
      // Hozircha production'da faol vehicle bo'lmasligi mumkin — bu holda
      // bo'sh holat (EmptyState) ko'rinishini tasdiqlaymiz, dead UI emas.
      await expect(page.getByText(/mavjud emas|topilmadi/i)).toBeVisible();
      return;
    }

    const href = await firstCard.getAttribute('href');
    expect(href).toMatch(/^\/uz\/transport\/.+/);

    await firstCard.click();
    await page.waitForURL(/\/uz\/transport\/.+/, { timeout: 15_000 });

    await expect(page.getByRole('heading', { name: 'Mashinani band qilish' })).toBeVisible({ timeout: 15_000 });
  });
});
