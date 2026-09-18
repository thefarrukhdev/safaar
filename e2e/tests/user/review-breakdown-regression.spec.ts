import { test, expect } from '@playwright/test';

/**
 * Regression: hotel detail sahifasidagi sharh kategoriya breakdown har
 * doim, real sharh ma'lumotlaridan MUSTAQIL, qattiq yozilgan inglizcha
 * "Cleanliness"/"Location"/"Service" yorliqlari va 4.9/5.0/4.8
 * qiymatlarini ko'rsatardi (kod ichida "(Mocked)" deb izohlangan edi).
 * Bu O'ZBEK (/uz/) sahifa bo'lgani uchun, agar bu qattiq yozilgan
 * INGLIZCHA matn hali ham ko'rinsa — bu eski mock qaytganini bildiradi;
 * endi kategoriya nomlari lokalizatsiya qilingan ("Tozalik"/"Joylashuv"/
 * "Xizmat") va faqat haqiqiy sharh ma'lumoti bo'lganda ko'rinadi.
 */

test.describe('Hotel review category breakdown', () => {
  test('the hardcoded English "Cleanliness"/"Location"/"Service" mock block is gone from the /uz page', async ({ page, request }) => {
    const hotelsRes = await request.get('https://api.safaar.uz/v1/hotels?limit=1');
    const hotelsBody = await hotelsRes.json().catch(() => null);
    const items = hotelsBody?.data?.items ?? hotelsBody?.items ?? [];
    test.skip(items.length === 0, 'No hotels available in production to check');

    const slug = items[0].slug ?? items[0].id;
    await page.goto(`/uz/hotels/${slug}`, { waitUntil: 'networkidle' });

    const legacyMockLabelCount =
      (await page.getByText('Cleanliness', { exact: true }).count()) +
      (await page.getByText('Location', { exact: true }).count()) +
      (await page.getByText('Service', { exact: true }).count());

    expect(legacyMockLabelCount).toBe(0);
  });
});
