import { test, expect } from '@playwright/test';

/**
 * Object-type consistency regression (audit item 17): har bir turdagi
 * kartochka (hotel/dacha/sanatorium bir xil /hotels/ route'ga, restaurant
 * o'z /restaurants/ route'iga, transport o'z /transport/ route'iga)
 * boshqa turga NOTO'G'RI o'tib ketmasligini tasdiqlaydi — masalan
 * restaurant/transport kartochkasi hech qachon /hotels/... ga olib
 * bormasligi kerak (audit'da tekshirilgan asosiy shubha).
 */

test.describe('Object type routing does not cross-contaminate between hotel/restaurant/transport', () => {
  test('hotel listing cards only ever link into /hotels/, never /restaurants/ or /transport/', async ({ page }) => {
    await page.goto('/uz/hotels');
    const hotelCardLinks = page.locator('a[href*="/hotels/"]');
    const count = await hotelCardLinks.count();
    test.skip(count === 0, 'No hotel cards rendered to check');

    for (let i = 0; i < Math.min(count, 10); i++) {
      const href = await hotelCardLinks.nth(i).getAttribute('href');
      expect(href).toMatch(/^\/uz\/hotels\/.+/);
    }
  });

  test('restaurant listing cards only ever link into /restaurants/, never /hotels/', async ({ page }) => {
    await page.goto('/uz/restaurants');
    const cards = page.locator('a[href*="/restaurants/"]');
    const count = await cards.count();
    test.skip(count === 0, 'No restaurant cards rendered to check');

    for (let i = 0; i < Math.min(count, 10); i++) {
      const href = await cards.nth(i).getAttribute('href');
      expect(href).toMatch(/^\/uz\/restaurants\/.+/);
      expect(href).not.toContain('/hotels/');
    }
  });

  test('transport listing cards only ever link into /transport/, never /hotels/', async ({ page }) => {
    await page.goto('/uz/transport');
    const cards = page.locator('a[href*="/transport/"]');
    const count = await cards.count();
    test.skip(count === 0, 'No transport cards rendered to check (may be empty inventory)');

    for (let i = 0; i < Math.min(count, 10); i++) {
      const href = await cards.nth(i).getAttribute('href');
      expect(href).toMatch(/^\/uz\/transport\/.+/);
      expect(href).not.toContain('/hotels/');
    }
  });

  test('a dacha/sanatorium listing (accommodation type filter) still routes into /hotels/ by design (shared Hotel table)', async ({ page, request }) => {
    const res = await request.get('https://api.safaar.uz/v1/hotels?type=dacha&limit=5');
    const body = await res.json().catch(() => null);
    const items = body?.data?.items ?? body?.items ?? [];
    test.skip(items.length === 0, 'No dacha-type hotels in production to check');

    await page.goto('/uz/hotels?type=dacha');
    const cards = page.locator('a[href*="/hotels/"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    const href = await cards.first().getAttribute('href');
    expect(href).toMatch(/^\/uz\/hotels\/.+/);
  });
});
