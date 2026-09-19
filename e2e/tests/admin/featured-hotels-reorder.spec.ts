import { test, expect, type Page } from '@playwright/test';

/**
 * Regression: cms/featured-hotels' "Tartibni saqlash" called
 * AdminApi.reorderFeaturedListings(), which only console.log'd the new
 * order and never persisted it (no `featured_order` column existed at
 * all) — every page refresh silently reverted to whatever order
 * getListings() happened to return.
 *
 * Full chain verified here: ADMIN (reorder + save) -> DB (featured_order
 * persists) -> refresh (survives) -> PUBLIC API (GET /hotels?featured=true
 * respects it) -> WEB-USER (renders in that order).
 *
 * Fixture: 3 QA test hotels (safaar-test-hotel-01/02/03, "Safaar Test
 * Hotel 01/02/03") were marked featured=true via a scoped, one-time SQL
 * UPDATE for this test — production had zero featured hotels and no way
 * to create one through the UI (AdminApi.toggleListingFeatured() also has
 * no backend route, a separate, out-of-scope gap).
 */

const ADMIN_EMAIL = 'admin@safaar.uz';
const ADMIN_PASSWORD = 'Admin12345!';
const WEB_USER_URL = 'https://web-user-rho.vercel.app';

const HOTEL_1 = 'Safaar Test Hotel 01';
const HOTEL_2 = 'Safaar Test Hotel 02';

async function loginAdmin(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Boshqaruv Paneliga Kirish' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

async function featuredOrderText(page: Page): Promise<string> {
  await page.waitForLoadState('networkidle');
  return page.locator('body').innerText();
}

function indexOfHotel(bodyText: string, name: string): number {
  const i = bodyText.indexOf(name);
  expect(i, `${name} not found on featured-hotels page`).toBeGreaterThanOrEqual(0);
  return i;
}

async function moveRowDown(page: Page, hotelName: string) {
  // `.group` (Tailwind's group-hover marker) is unique to each row
  // container on this page — more reliable than a `has:` text filter,
  // which was silently matching the wrong scope.
  const rows = page.locator('div.group');
  await rows.first().waitFor({ state: 'visible', timeout: 15_000 });
  const count = await rows.count();
  for (let i = 0; i < count; i += 1) {
    const text = await rows.nth(i).innerText();
    if (text.includes(hotelName)) {
      await rows.nth(i).locator('button').nth(1).click();
      // moveDown/moveUp set hasChanges=true synchronously — confirms the
      // click actually landed on a working control before we try to save.
      await expect(page.getByRole('button', { name: 'Tartibni saqlash' })).toBeEnabled();
      return;
    }
  }
  throw new Error(`Row for "${hotelName}" not found among ${count} rows`);
}

test.describe('Admin featured-hotels reorder — full chain (admin -> DB -> public API -> web-user)', () => {
  test.setTimeout(360_000);

  test('reorder persists after refresh and web-user renders the same order', async ({ page }) => {
    await loginAdmin(page);

    // Deterministic baseline (hotel 1 before hotel 2), set directly via the
    // same endpoint under test, so this test doesn't depend on — or get
    // thrown off by — whatever order a previous run/manual check left in
    // the DB.
    const HOTEL_1_ID = '00000000-0000-9203-0000-000000000001';
    const HOTEL_2_ID = '00000000-0000-9203-0000-000000000002';
    const HOTEL_3_ID = '00000000-0000-9203-0000-000000000003';
    await page.evaluate(
      async ([id1, id2, id3]) => {
        const token = document.cookie
          .split('; ')
          .find((c) => c.startsWith('admin_token='))
          ?.split('=')[1];
        await fetch('/api/backend/admin/hotels/featured/reorder', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ orderedIds: [id3, id1, id2] }),
        });
      },
      [HOTEL_1_ID, HOTEL_2_ID, HOTEL_3_ID],
    );

    await page.goto('/cms/featured-hotels');
    let bodyText = await featuredOrderText(page);
    expect(
      indexOfHotel(bodyText, HOTEL_1),
      'baseline setup should put hotel 1 before hotel 2',
    ).toBeLessThan(indexOfHotel(bodyText, HOTEL_2));

    // The actual action under test: move hotel 1 down past hotel 2.
    await moveRowDown(page, HOTEL_1);

    // Wait on the actual network response, not the toast — sonner's toast
    // can render/dismiss faster than Playwright's assertion polling picks
    // it up even though the save itself succeeded (confirmed via trace:
    // POST .../featured/reorder -> 201 in ~375ms), so it's a flaky signal
    // for something that already has a much more direct one.
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/admin/hotels/featured/reorder') && res.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Tartibni saqlash' }).click(),
    ]);
    expect(response.ok(), `reorder save should succeed, got ${response.status()}`).toBeTruthy();

    // Refresh — order must survive (real persistence, not local state).
    await page.reload();
    bodyText = await featuredOrderText(page);
    const idx1 = indexOfHotel(bodyText, HOTEL_1);
    const idx2 = indexOfHotel(bodyText, HOTEL_2);
    expect(idx2, 'hotel 2 should now come before hotel 1 after refresh').toBeLessThan(idx1);

    // Public API must reflect the same order (cache-busted, bypasses any
    // Next.js ISR window on web-user).
    const apiResponse = await page.request.get(
      `https://api.safaar.uz/v1/hotels?featured=true&limit=20&_=${Date.now()}`,
    );
    expect(apiResponse.ok()).toBeTruthy();
    const apiBody = await apiResponse.json();
    const apiItems: Array<{ name?: Record<string, string> }> =
      apiBody?.data?.items ?? apiBody?.items ?? [];
    const apiNames = apiItems.map((it) => it.name?.uz ?? '');
    const apiIdx1 = apiNames.findIndex((n) => n === HOTEL_1);
    const apiIdx2 = apiNames.findIndex((n) => n === HOTEL_2);
    expect(apiIdx1).toBeGreaterThanOrEqual(0);
    expect(apiIdx2).toBeGreaterThanOrEqual(0);
    expect(apiIdx2, 'public API order should match admin-set order').toBeLessThan(apiIdx1);

    // web-user must render the same order — allow for the existing
    // `next: { revalidate: 60 }` ISR window (same as every other CMS
    // section in this codebase; there's no on-demand revalidation
    // mechanism anywhere in the app to bypass it) by retrying briefly.
    let webUserOrderMatches = false;
    for (let attempt = 0; attempt < 16; attempt += 1) {
      await page.goto(`${WEB_USER_URL}/uz`, { waitUntil: 'domcontentloaded' });
      const homeText = await page.locator('body').innerText();
      if (homeText.includes(HOTEL_1) && homeText.includes(HOTEL_2)) {
        webUserOrderMatches = homeText.indexOf(HOTEL_2) < homeText.indexOf(HOTEL_1);
        if (webUserOrderMatches) break;
      }
      console.log(`[attempt ${attempt}] web-user order not yet updated, retrying...`);
      await page.waitForTimeout(10_000);
    }
    expect(webUserOrderMatches, 'web-user home page should show hotel 2 before hotel 1').toBe(true);

    // Change the order AGAIN — verify a second change also propagates
    // (not a one-time fluke / cached first result).
    await page.goto('/cms/featured-hotels');
    await featuredOrderText(page); // wait for the list to actually render
    await moveRowDown(page, HOTEL_2); // swap back: hotel 1 before hotel 2
    const [secondResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/admin/hotels/featured/reorder') && res.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Tartibni saqlash' }).click(),
    ]);
    expect(secondResponse.ok()).toBeTruthy();

    let secondChangeReflected = false;
    for (let attempt = 0; attempt < 16; attempt += 1) {
      await page.goto(`${WEB_USER_URL}/uz`, { waitUntil: 'domcontentloaded' });
      const homeText = await page.locator('body').innerText();
      if (homeText.includes(HOTEL_1) && homeText.includes(HOTEL_2)) {
        secondChangeReflected = homeText.indexOf(HOTEL_1) < homeText.indexOf(HOTEL_2);
        if (secondChangeReflected) break;
      }
      console.log(`[attempt ${attempt}] web-user 2nd order not yet updated, retrying...`);
      await page.waitForTimeout(10_000);
    }
    expect(secondChangeReflected, 'web-user should reflect the second reorder too').toBe(true);
  });

  test('rejects a non-featured/unknown hotel ID (server-side validation, not just UI trust)', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/cms/featured-hotels');

    // Calls through the app's own proxy (/api/backend/... -> next.config.ts
    // rewrite -> api.safaar.uz), same path AdminApi itself uses. axios's
    // interceptor normally reads the `admin_token` cookie and attaches it
    // as `Authorization: Bearer` — replicated manually here since this is
    // a raw fetch, not routed through apiClient.
    const status = await page.evaluate(async () => {
      const token = document.cookie
        .split('; ')
        .find((c) => c.startsWith('admin_token='))
        ?.split('=')[1];
      const res = await fetch('/api/backend/admin/hotels/featured/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          orderedIds: ['00000000-0000-0000-0000-000000000000'],
        }),
      });
      return res.status;
    });
    // Structurally-valid but non-existent/non-featured UUID must be
    // rejected server-side (HOTEL_NOT_FEATURED), never silently accepted.
    expect([400, 401, 403]).toContain(status);
  });
});
