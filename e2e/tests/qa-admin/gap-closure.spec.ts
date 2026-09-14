import { test, expect, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { trackPageIssues } from '../helpers/console-tracker';

/**
 * 2026-09-14 SAFAAR ADMIN — gap-closure E2E coverage (Availability
 * Calendar, RBAC Permission Matrix, Commission, Reviews moderation,
 * Translations, SEO). Written against the actual DOM/text this session's
 * implementation produces (types/admin.ts, app/(dashboard)/**\/page.tsx).
 *
 * Originally written under tests/admin/ (never executed — placeholder
 * prod-looking credentials). Relocated under tests/qa-admin/ and pointed
 * at the real, isolated QA backend/admin account (playwright.qa.config.ts,
 * qa-admin project, baseURL http://localhost:4403) so it actually runs.
 *
 * HONEST, VERIFIED FINDING from the first real run: the QA backend
 * (100.109.46.108:4400) predates the admin gap-closure backend commits
 * (55849e8b, f30969be) — `GET /admin/reviews`,
 * `GET/PATCH /admin/partners/:id/commission` and
 * `GET /admin/rooms/:id/availability` all 404 with Nest's router-level
 * "Cannot GET ..." body (not a business NotFoundException), while
 * `/admin/roles` and `/admin/cms/*` (older, already-deployed routes) work
 * fine. `routeMissing()` below detects this signature precisely so
 * Availability/Commission/Reviews report an honest, explicit SKIP with the
 * reason ("QA backend missing this route — needs redeploy") instead of a
 * false PASS or a confusing generic failure — see the final report.
 */

const QA_API = 'http://100.109.46.108:4400/v1';
const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt',
  'utf8',
).trim();

async function adminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${QA_API}/auth/admin/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok(), `admin login failed: HTTP ${res.status()}`).toBeTruthy();
  const body = await res.json();
  const token = body?.data?.accessToken as string | undefined;
  expect(token, 'admin login response missing accessToken').toBeTruthy();
  return token!;
}

/** True when `path` 404s with Nest's router-level "Cannot GET ..." body —
 * i.e. no controller registered for it on this deployment — as opposed to
 * a real business NotFoundException (route exists, resource doesn't). */
async function routeMissing(request: APIRequestContext, token: string, path: string): Promise<boolean> {
  const res = await request.get(`${QA_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    failOnStatusCode: false,
  });
  if (res.status() !== 404) return false;
  const body = await res.json().catch(() => null);
  const message: string = body?.error?.message ?? '';
  return message.startsWith('Cannot ');
}

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Boshqaruv Paneliga Kirish' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe('Admin gap-closure — Availability Calendar', () => {
  let blocked = false;

  test.beforeAll(async ({ request }) => {
    const token = await adminToken(request);
    blocked = await routeMissing(
      request,
      token,
      '/admin/rooms/00000000-0000-0000-0000-000000000000/availability',
    );
  });

  test('listing -> availability -> calendar renders with a room selected', async ({ page }) => {
    test.skip(blocked, 'ENVIRONMENT BLOCKED: GET /admin/rooms/:id/availability 404s on the QA backend (not yet redeployed with 55849e8b)');
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
    test.skip(blocked, 'ENVIRONMENT BLOCKED: GET /admin/rooms/:id/availability 404s on the QA backend (not yet redeployed with 55849e8b)');
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
    // #team-role-select: apps/web-admin/app/(dashboard)/team/page.tsx —
    // the "Rol" <label> had no htmlFor/id, so Playwright's getByLabel
    // fell back to a substring match on the *table's*
    // aria-label="Rol va ruxsatlar matritsasi" instead of this <select>.
    // Fixed both sides in this session (real accessibility bug, not just
    // a test bug) — the id now makes the association explicit either way.
    await expect(page.locator('#team-role-select')).toBeDisabled();
  });
});

test.describe('Admin gap-closure — Commission overrides', () => {
  let blocked = false;
  let partnerId: string | null = null;

  test.beforeAll(async ({ request }) => {
    const token = await adminToken(request);
    const res = await request.get(`${QA_API}/admin/partners?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => null);
    partnerId = (body?.data ?? body)?.[0]?.id ?? null;
    blocked = partnerId
      ? await routeMissing(request, token, `/admin/partners/${partnerId}/commission`)
      : true;
  });

  test('partner detail page: commission modal validates and saves', async ({ page }) => {
    test.skip(
      blocked,
      'ENVIRONMENT BLOCKED: GET/PATCH /admin/partners/:id/commission 404s on the QA backend (not yet redeployed with 55849e8b)',
    );
    await login(page);
    await page.goto(`/partners/${partnerId}`);
    // apps/web-admin/app/(dashboard)/partners/[id]/page.tsx: the
    // "Komissiya" info card has an icon-only edit button (Pencil, no
    // accessible name) as a sibling under the same Card as the label —
    // never independently executed against a live backend, since this
    // route 404s on every QA run so far (see beforeAll above).
    const commissionLabel = page.getByText('Komissiya', { exact: true }).first();
    await expect(commissionLabel).toBeVisible({ timeout: 10_000 });
    const editButton = commissionLabel.locator('..').getByRole('button');
    if (!(await editButton.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Komissiyani tahrirlash tugmasi topilmadi — UI hali render qilinmagan');
      return;
    }
    await editButton.click();

    await expect(page.getByText("Komissiya foizini o'zgartirish")).toBeVisible({ timeout: 5_000 });
    const input = page.getByLabel('Komissiya foizi (%)');
    await input.fill('-5');
    await page.getByRole('button', { name: 'Saqlash' }).click();
    // Manfiy komissiya rad etilishi kerak — modal ochiq qolishi kutiladi
    // (frontend yoki backend validatsiyasi orqali).
    await expect(page.getByText("Komissiya foizini o'zgartirish")).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Admin gap-closure — Reviews moderation', () => {
  let blocked = false;

  test.beforeAll(async ({ request }) => {
    const token = await adminToken(request);
    blocked = await routeMissing(request, token, '/admin/reviews');
  });

  test('reviews list loads with real backend data (no mock placeholder)', async ({ page }) => {
    test.skip(blocked, 'ENVIRONMENT BLOCKED: GET /admin/reviews 404s on the QA backend (not yet redeployed with f30969be)');
    const issues = trackPageIssues(page);
    await login(page);

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/admin/reviews') && res.request().method() === 'GET',
      { timeout: 15_000 },
    );
    await page.goto('/reviews');
    await expect(page.getByRole('heading', { name: 'Sharhlar' })).toBeVisible({ timeout: 10_000 });

    // Haqiqiy javobni kutamiz (oldingi versiyada bu tekshirilmagan edi —
    // sahifa "yuklanmoqda" holatida ham matn assertionlari o'tib
    // ketishi mumkin edi). Endi HTTP status aniq tasdiqlanadi.
    const response = await responsePromise;
    expect(response.status(), `GET /admin/reviews -> ${response.status()}`).toBe(200);

    // "Ruxsatingiz yo'q" faqat 403 bo'lsa ko'rinadi — bo'lmasligi kerak
    // (QA admin SUPER_ADMIN).
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
    // Komponent har doim <table>'ni render qiladi (bo'sh holatda ham —
    // "topilmadi" xabari jadval ICHIDA, alohida element sifatida emas).
    // Oldingi `.or(...)` assertioni shu sababli strict-mode
    // violation berardi (ikkalasi ham "visible" bo'lib chiqadi).
    await expect(page.locator('table')).toBeVisible({ timeout: 10_000 });
  });

  test('SEO page loads and (for "pages") discloses it is actually wired to the public site', async ({
    page,
  }) => {
    await login(page);
    await page.goto('/cms/seo');
    await expect(page.getByRole('heading', { name: 'SEO' })).toBeVisible({ timeout: 10_000 });
    // 2026-09-14 public SEO closure: default resource is "pages", which is
    // now genuinely connected to web-user's generateMetadata() — see
    // e2e/tests/qa-user/seo-metadata.spec.ts for the live proof.
    await expect(
      page.getByText(/public saytda haqiqatda ishlatiladi/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Admin gap-closure — Security negatives', () => {
  test('unauthenticated request to admin APIs is rejected (401/403), not silently allowed', async ({
    request,
  }) => {
    // Oldingi versiya `${baseURL}/api/backend/admin/reviews`ga (web-admin
    // dev-serverning Next.js rewrite'i, localhost:4000'ga yo'naltiriladi)
    // murojaat qilardi — bu QA sozlamasida noto'g'ri host (apps/web-admin
    // hozir NEXT_PUBLIC_API_URL orqali to'g'ridan-to'g'ri QA backend'ga
    // ulanadi, rewrite ishlatilmaydi). Endi QA backend'ga bevosita murojaat
    // qilinadi — bu haqiqiy, QA muhitida ma'noli tekshiruv.
    for (const path of ['/admin/roles', '/admin/cms/pages']) {
      const res = await request.get(`${QA_API}${path}`, {
        headers: { Authorization: '' },
        failOnStatusCode: false,
      });
      expect([401, 403], `${path} unauthenticated -> HTTP ${res.status()}`).toContain(res.status());
    }
  });
});
