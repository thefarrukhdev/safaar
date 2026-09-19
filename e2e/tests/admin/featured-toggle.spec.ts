import { test, expect, type Page } from '@playwright/test';

/**
 * Regression: AdminApi.toggleListingFeatured() (partners/listings "Mashhur"/
 * "Odatiy" button) called PATCH /admin/hotels/:id/featured, but that route
 * never existed — the button only ever changed local React state, never
 * the database.
 *
 * Full chain verified here: ADMIN (toggle ON) -> DB (featured=true,
 * featured_order appended) -> refresh (survives) -> admin featured-hotels
 * list (appears) -> public API / web-user (shows up) -> ADMIN (toggle OFF)
 * -> refresh -> disappears from admin list and web-user. Finishes with a
 * regression pass on the reorder feature (previous task) to prove the two
 * don't interfere with each other.
 */

const ADMIN_EMAIL = 'admin@safaar.uz';
const ADMIN_PASSWORD = 'Admin12345!';
const WEB_USER_URL = 'https://web-user-rho.vercel.app';

const TOGGLE_HOTEL = 'Safaar Test Hotel 04';
const REORDER_HOTEL_1 = 'Safaar Test Hotel 01';
const REORDER_HOTEL_2 = 'Safaar Test Hotel 02';

async function loginAdmin(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Boshqaruv Paneliga Kirish' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

async function goToPublishedListings(page: Page) {
  await page.goto('/partners/listings');
  await page.getByRole('button', { name: 'Tasdiqlangan' }).click();
  await page.waitForLoadState('networkidle');
}

/** Locates the toggle button in the row for `hotelName` and clicks it,
 * waiting on the actual PATCH response (not a toast — same lesson learned
 * with the reorder save button: the network response is the reliable
 * signal, sonner's toast timing is not). */
async function toggleFeaturedRow(page: Page, hotelName: string) {
  const row = page.locator('tr', { hasText: hotelName });
  await row.waitFor({ state: 'visible', timeout: 15_000 });
  const button = row.getByRole('button', { name: /^(Mashhur|Odatiy)$/ });
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => /\/admin\/hotels\/[^/]+\/featured$/.test(new URL(res.url()).pathname) && res.request().method() === 'PATCH',
    ),
    button.click(),
  ]);
  return response;
}

async function isRowFeatured(page: Page, hotelName: string): Promise<boolean> {
  const row = page.locator('tr', { hasText: hotelName });
  await row.waitFor({ state: 'visible', timeout: 15_000 });
  const text = await row.innerText();
  return /\bMashhur\b/.test(text);
}

test.describe('Admin featured toggle (ON/OFF) — full chain (admin -> DB -> public API -> web-user)', () => {
  test.setTimeout(360_000);

  test('toggling ON then OFF updates DB, admin featured-hotels list, and web-user', async ({ page }) => {
    await loginAdmin(page);
    await goToPublishedListings(page);

    const startedFeatured = await isRowFeatured(page, TOGGLE_HOTEL);
    expect(startedFeatured, `${TOGGLE_HOTEL} must start non-featured for this test to be meaningful`).toBe(false);

    // ── ON ──────────────────────────────────────────────────────────────
    const onResponse = await toggleFeaturedRow(page, TOGGLE_HOTEL);
    expect(onResponse.ok(), `toggle ON should succeed, got ${onResponse.status()}`).toBeTruthy();
    const onBody = await onResponse.json();
    const onData = onBody?.data ?? onBody;
    expect(onData.featured).toBe(true);
    expect(onData.featured_order, 'server must assign an order, never leave it to the client').not.toBeNull();

    // (Not asserting on the success toast here — sonner's render/dismiss
    // timing is not reliably in sync with Playwright's assertion polling,
    // as already found and fixed the same way for the reorder feature.
    // The network response above is the real, direct signal.)

    // Refresh — survives (real persistence, not local state).
    await page.reload();
    await goToPublishedListingsIfNeeded(page);
    expect(await isRowFeatured(page, TOGGLE_HOTEL)).toBe(true);

    // Appears in the admin featured-hotels reorder list.
    await page.goto('/cms/featured-hotels');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(TOGGLE_HOTEL)).toBeVisible({ timeout: 10_000 });

    // Public API includes it.
    const apiResponseOn = await page.request.get(
      `https://api.safaar.uz/v1/hotels?featured=true&limit=50&_=${Date.now()}`,
    );
    expect(apiResponseOn.ok()).toBeTruthy();
    const apiBodyOn = await apiResponseOn.json();
    const apiItemsOn: Array<{ name?: Record<string, string> }> = apiBodyOn?.data?.items ?? apiBodyOn?.items ?? [];
    expect(apiItemsOn.some((it) => it.name?.uz === TOGGLE_HOTEL)).toBe(true);

    // web-user shows it in the featured section (allow for the same
    // stale-while-revalidate propagation delay observed for reorder).
    let appearedOnWebUser = false;
    for (let attempt = 0; attempt < 16; attempt += 1) {
      await page.goto(`${WEB_USER_URL}/uz`, { waitUntil: 'domcontentloaded' });
      const homeText = await page.locator('body').innerText();
      if (homeText.includes(TOGGLE_HOTEL)) {
        appearedOnWebUser = true;
        break;
      }
      console.log(`[ON attempt ${attempt}] not yet visible on web-user, retrying...`);
      await page.waitForTimeout(10_000);
    }
    expect(appearedOnWebUser, 'web-user should show the newly-featured hotel').toBe(true);

    // ── OFF ─────────────────────────────────────────────────────────────
    await goToPublishedListings(page);
    const offResponse = await toggleFeaturedRow(page, TOGGLE_HOTEL);
    expect(offResponse.ok(), `toggle OFF should succeed, got ${offResponse.status()}`).toBeTruthy();
    const offBody = await offResponse.json();
    const offData = offBody?.data ?? offBody;
    expect(offData.featured).toBe(false);
    expect(offData.featured_order, 'order must be cleared when un-featuring').toBeNull();

    await page.reload();
    await goToPublishedListingsIfNeeded(page);
    expect(await isRowFeatured(page, TOGGLE_HOTEL)).toBe(false);

    // Disappears from the admin featured-hotels list.
    await page.goto('/cms/featured-hotels');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(TOGGLE_HOTEL)).toHaveCount(0);

    // Disappears from web-user.
    let disappearedFromWebUser = false;
    for (let attempt = 0; attempt < 16; attempt += 1) {
      await page.goto(`${WEB_USER_URL}/uz`, { waitUntil: 'domcontentloaded' });
      const homeText = await page.locator('body').innerText();
      if (!homeText.includes(TOGGLE_HOTEL)) {
        disappearedFromWebUser = true;
        break;
      }
      console.log(`[OFF attempt ${attempt}] still visible on web-user, retrying...`);
      await page.waitForTimeout(10_000);
    }
    expect(disappearedFromWebUser, 'web-user should no longer show the un-featured hotel').toBe(true);

    // ── Regression: reorder still works after toggling a different hotel ──
    await page.goto('/cms/featured-hotels');
    await page.waitForLoadState('networkidle');
    const rows = page.locator('div.group');
    await rows.first().waitFor({ state: 'visible', timeout: 15_000 });
    const count = await rows.count();
    let reordered = false;
    for (let i = 0; i < count; i += 1) {
      const text = await rows.nth(i).innerText();
      if (text.includes(REORDER_HOTEL_1) || text.includes(REORDER_HOTEL_2)) {
        await rows.nth(i).locator('button').nth(1).click(); // moveDown
        reordered = true;
        break;
      }
    }
    expect(reordered, 'expected to find hotel 1 or 2 still present for the reorder regression check').toBe(true);
    const [reorderResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/admin/hotels/featured/reorder') && res.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Tartibni saqlash' }).click(),
    ]);
    expect(reorderResponse.ok(), 'reorder feature must still work after a toggle').toBeTruthy();
  });

  test('unauthorized / non-existent hotel are rejected server-side', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/cms/featured-hotels');

    const status = await page.evaluate(async () => {
      const token = document.cookie
        .split('; ')
        .find((c) => c.startsWith('admin_token='))
        ?.split('=')[1];
      const res = await fetch('/api/backend/admin/hotels/00000000-0000-0000-0000-000000000000/featured', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ featured: true }),
      });
      return res.status;
    });
    expect(status, 'a structurally-valid but non-existent hotel ID must 404, never silently succeed').toBe(404);

    const unauthStatus = await page.evaluate(async () => {
      const res = await fetch('https://api.safaar.uz/v1/admin/hotels/00000000-0000-0000-0000-000000000000/featured', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured: true }),
      });
      return res.status;
    });
    expect([401, 403]).toContain(unauthStatus);
  });
});

/** After a full page reload, the "Tasdiqlangan" tab resets to whatever the
 * Tabs component's default is (first tab) — re-select it. */
async function goToPublishedListingsIfNeeded(page: Page) {
  const publishedTab = page.getByRole('button', { name: 'Tasdiqlangan' });
  await publishedTab.click();
  await page.waitForLoadState('networkidle');
}
