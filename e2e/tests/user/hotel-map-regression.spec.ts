import { test, expect } from '@playwright/test';

/**
 * Regression: HotelLocation avval hech qanday prop qabul qilmasdan
 * (`<HotelLocation />`) Toshkentning bitta qattiq yozilgan nuqtasiga
 * (41.311081, 69.240562) markazlashtirilgan, haqiqiy API kalitisiz
 * "signature=mock" bilan soxta xarita ko'rsatardi va har bir mehmonxona
 * uchun bir xil, haqiqiy bo'lmagan masofalarni (5 km / 2 km / 3.5 km / 1 km)
 * ko'rsatardi. Endi bu blok yo'q — mehmonxonaning haqiqiy manzili va
 * "Google Maps'da ochish" havolasi ko'rinadi.
 */

test.describe('Hotel detail location section', () => {
  test('no longer renders the fake static-map image or the hardcoded distance rows', async ({ page, request }) => {
    const hotelsRes = await request.get('https://api.safaar.uz/v1/hotels?limit=1');
    const hotelsBody = await hotelsRes.json().catch(() => null);
    const items = hotelsBody?.data?.items ?? hotelsBody?.items ?? [];
    test.skip(items.length === 0, 'No hotels available in production to check');

    const slug = items[0].slug ?? items[0].id;
    await page.goto(`/uz/hotels/${slug}`, { waitUntil: 'networkidle' });

    // Eski soxta static-map so'rovi hech qachon yuklanmasligi kerak.
    const fakeMapImage = page.locator('[style*="signature=mock"]');
    await expect(fakeMapImage).toHaveCount(0);

    // Eski qattiq yozilgan masofa qatorlari (4 tasi bir vaqtda) ko'rinmasligi kerak.
    const legacyDistanceLabels =
      (await page.getByText('International Airport', { exact: true }).count()) +
      (await page.getByText('Main Train Station', { exact: true }).count()) +
      (await page.getByText('Shopping Mall', { exact: true }).count());
    expect(legacyDistanceLabels).toBe(0);

    // Real, ishlaydigan Google Maps havolasi ko'rinishi kerak.
    await expect(page.getByRole('link', { name: /Google Maps/i })).toBeVisible();
  });
});
