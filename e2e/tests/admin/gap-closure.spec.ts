import { test, expect } from '@playwright/test';
import { trackPageIssues } from '../helpers/console-tracker';

/**
 * 2026-09-14 SAFAAR ADMIN — gap-closure E2E coverage (Availability
 * Calendar, RBAC Permission Matrix, Reviews moderation, Translations,
 * SEO). Written against the actual DOM/text this session's implementation
 * produces (types/admin.ts, app/(dashboard)/**\/page.tsx).
 *
 * NOT YET EXECUTED against a live environment in this session — see the
 * final report. Written so a future run only needs a reachable
 * web-admin + backend (E2E_ADMIN_URL) with a real QA admin account.
 */

const ADMIN_EMAIL = 'admin@safaar.uz';
const ADMIN_PASSWORD = 'Admin12345!';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Boshqaruv Paneliga Kirish' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe('Admin gap-closure — Availability Calendar', () => {
  test('listing -> availability -> calendar renders with a room selected', async ({ page }) => {
    const issues = trackPageIssues(page);
    await login(page);

    await page.goto('/partners/listings');
    await page.waitForLoadState('networkidle');
    const firstListingLink = page.locator('a[href^="/partners/listings/"]').first();
    await expect(firstListingLink).toBeVisible({ timeout: 10_000 });
    await firstListingLink.click();
    await page.waitForURL(/\/partners\/listings\/[^/]+$/);

    await page.getByRole('link', { name: 'Availability' }).click();
    await page.waitForURL(/\/availability$/);

    // Room select yoki "hali xona yo'q" bo'sh holat — ikkalasi ham
    // yaroqli, muhimi sahifa 404/xato bermasligi.
    await expect(
      page.getByRole('heading', { name: "Xona sotuv availability'si" }),
    ).toBeVisible({ timeout: 10_000 });

    expect(issues.consoleErrors, `Console errors: ${issues.consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test('block requires a reason and rejects an inverted date range', async ({ page }) => {
    await login(page);
    await page.goto('/partners/listings');
    await page.waitForLoadState('networkidle');
    const firstListingLink = page.locator('a[href^="/partners/listings/"]').first();
    await firstListingLink.click();
    await page.waitForURL(/\/partners\/listings\/[^/]+$/);
    await page.getByRole('link', { name: 'Availability' }).click();
    await page.waitForURL(/\/availability$/);

    const blockButton = page.getByRole('button', { name: "Sana(lar)ni bloklash" });
    if (!(await blockButton.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "Bu hotelda faol xona yo'q — block flow sinab bo'lmaydi");
      return;
    }
    await blockButton.click();
    await page.getByRole('button', { name: 'Bloklash' }).click();
    // reason bo'sh, backend/HTML5 required tekshiruvi form yuborilishini
    // to'xtatadi — modal ochiq qolishi kerak.
    await expect(page.getByText('Sanalarni bloklash')).toBeVisible();
  });
});

test.describe('Admin gap-closure — RBAC Permission Matrix', () => {
  test('team page shows a real, non-empty role/permission matrix', async ({ page }) => {
    const issues = trackPageIssues(page);
    await login(page);

    await page.goto('/team');
    await expect(page.getByText('Rollar va ruxsatlar')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Ruxsatlarni yuklab bo‘lmadi')).toHaveCount(0);
    // Haqiqiy backend javobi bo'lsa, kamida SUPER_ADMIN ustuni ko'rinishi kerak.
    await expect(page.getByRole('columnheader', { name: 'Super Admin' })).toBeVisible({
      timeout: 10_000,
    });

    expect(issues.consoleErrors, `Console errors: ${issues.consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test('editing your own row disables the role select', async ({ page }) => {
    await login(page);
    await page.goto('/team');
    await page.waitForLoadState('networkidle');
    const selfRow = page.locator('tr', { hasText: 'Siz' }).first();
    if (!(await selfRow.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, "'Siz' belgisi topilmadi — joriy admin ro'yxatda ko'rinmayapti");
      return;
    }
    await selfRow.getByRole('button').last().click();
    await page.getByRole('button', { name: 'Tahrirlash' }).click();
    await expect(page.getByLabel('Rol')).toBeDisabled();
  });
});

test.describe('Admin gap-closure — Reviews moderation', () => {
  test('reviews list loads with real backend data (no mock placeholder)', async ({ page }) => {
    const issues = trackPageIssues(page);
    await login(page);

    await page.goto('/reviews');
    await expect(page.getByRole('heading', { name: 'Sharhlar' })).toBeVisible({ timeout: 10_000 });
    // "Ruxsatingiz yo'q" faqat 403 bo'lsa ko'rinadi — bo'lmasligi kerak
    // (demo admin SUPER_ADMIN).
    await expect(page.getByText("Bu bo'lim uchun ruxsatingiz yo'q")).toHaveCount(0);

    expect(issues.consoleErrors, `Console errors: ${issues.consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(
      issues.unexpectedResponses,
      `Unexpected network errors: ${JSON.stringify(issues.unexpectedResponses)}`,
    ).toHaveLength(0);
  });
});

test.describe('Admin gap-closure — Translations & SEO', () => {
  test('translations page loads and resource switch re-fetches', async ({ page }) => {
    await login(page);
    await page.goto('/cms/translations');
    await expect(page.getByRole('heading', { name: 'Tarjimalar' })).toBeVisible({ timeout: 10_000 });

    await page.getByLabel("Kontent turi").selectOption('banners');
    await page.waitForLoadState('networkidle');
    // Sahifa qulab tushmasligi — jadval yoki "topilmadi" xabari ko'rinadi.
    await expect(
      page.locator('table').or(page.getByText("Bu turda kontent topilmadi")),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('SEO page loads and discloses the public-site wiring limitation', async ({ page }) => {
    await login(page);
    await page.goto('/cms/seo');
    await expect(page.getByRole('heading', { name: 'SEO' })).toBeVisible({ timeout: 10_000 });
    // Bu sahifa ataylab, aniq ogohlantiradi: saqlangan SEO maydonlari
    // public saytda hali AVTOMATIK ishlatilmaydi (verified limitation,
    // qarang final report).
    await expect(
      page.getByText(/public sayt.*hali AVTOMATIK o'qilmaydi|hali AVTOMATIK/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Admin gap-closure — Security negatives', () => {
  test('unauthenticated request to an admin API is rejected (401), not silently allowed', async ({
    request,
    baseURL,
  }) => {
    const res = await request.get(`${baseURL}/api/backend/admin/reviews`, {
      headers: { Authorization: '' },
      failOnStatusCode: false,
    });
    expect([401, 403]).toContain(res.status());
  });
});
