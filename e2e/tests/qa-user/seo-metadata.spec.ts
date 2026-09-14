import { test, expect, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { trackPageIssues } from '../helpers/console-tracker';

/**
 * 2026-09-14 SAFAAR — public SEO closure.
 *
 * Verifies the actual, live gap this suite exists to close: SEO fields
 * saved by the admin panel (cms_entries.metadata.seo via the existing
 * PATCH /admin/cms/:resource/:id) are now read by web-user's
 * generateMetadata() (apps/web-user/app/[lang]/(main)/pages/[slug]/page.tsx
 * + lib/seo/cms-metadata.ts) and rendered into the real public <head>.
 *
 * Runs against the isolated QA backend (100.109.46.108:4400) and a local
 * web-user dev server (baseURL, qa-user project) — never production. Uses
 * the existing `pages` CMS resource and its one real seeded entry
 * (slug=`about`) rather than inventing fixtures, and restores its
 * `metadata.seo` to null (its original state) after each test that
 * mutates it, since this is shared QA data other suites may also read.
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

async function findAboutPageEntry(request: APIRequestContext, token: string) {
  const res = await request.get(`${QA_API}/admin/cms/pages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `GET /admin/cms/pages failed: HTTP ${res.status()}`).toBeTruthy();
  const body = await res.json();
  const items: Array<{ id: string; slug: string }> = body?.data ?? body ?? [];
  return items.find((item) => item.slug === 'about');
}

async function patchSeo(
  request: APIRequestContext,
  token: string,
  entryId: string,
  seo: Record<string, string> | null,
) {
  const res = await request.patch(`${QA_API}/admin/cms/pages/${entryId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { metadata: { seo } },
  });
  expect(res.ok(), `PATCH seo failed: HTTP ${res.status()}`).toBeTruthy();
}

test.describe('SEO — admin save -> web-user generateMetadata() consumption', () => {
  let token: string;
  let entryId: string | null = null;

  test.beforeAll(async ({ request }) => {
    token = await adminToken(request);
    const entry = await findAboutPageEntry(request, token);
    entryId = entry?.id ?? null;
  });

  test.afterEach(async ({ request }) => {
    if (entryId) {
      // Reset to the pre-existing (legacy flat metadata.seoTitle/seoDescription)
      // state so other suites reading this shared QA fixture are unaffected.
      await patchSeo(request, token, entryId, null);
    }
  });

  test('saved metaTitle/metaDescription/canonical/robots/OG render on the public page', async ({
    page,
    request,
  }) => {
    test.skip(!entryId, "QA fixture 'pages' entry with slug=about not found");

    await patchSeo(request, token, entryId!, {
      metaTitle: 'Safaar haqida — QA E2E',
      metaDescription: 'QA E2E orqali saqlangan meta tavsif',
      canonical: 'https://safaar.uz/uz/pages/about',
      robots: 'index,follow',
      ogTitle: 'Safaar — biz haqimizda',
      ogDescription: 'OG tavsif QA E2E',
      ogImage: 'https://safaar.uz/og/about.jpg',
    });

    await page.goto('/uz/pages/about');
    await expect(page).toHaveTitle('Safaar haqida — QA E2E — Safaar');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'QA E2E orqali saqlangan meta tavsif',
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://safaar.uz/uz/pages/about',
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      'Safaar — biz haqimizda',
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://safaar.uz/og/about.jpg',
    );
  });

  test('locale-specific canonical/hreflang/og:locale — no cross-language leak', async ({
    page,
    request,
  }) => {
    test.skip(!entryId, "QA fixture 'pages' entry with slug=about not found");
    await patchSeo(request, token, entryId!, { metaTitle: 'Locale check' });

    await page.goto('/ru/pages/about');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://safaar.uz/ru/pages/about',
    );
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'ru_RU');
    await expect(page.locator('link[rel="alternate"][hreflang="uz"]')).toHaveAttribute(
      'href',
      'https://safaar.uz/uz/pages/about',
    );
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      'https://safaar.uz/en/pages/about',
    );
  });

  test('fallback: no metadata.seo saved -> legacy/content fallback still renders (no empty <head>)', async ({
    page,
    request,
  }) => {
    test.skip(!entryId, "QA fixture 'pages' entry with slug=about not found");
    await patchSeo(request, token, entryId!, null);

    await page.goto('/uz/pages/about');
    const title = await page.title();
    expect(title.length, 'title must not be empty when no SEO override is saved').toBeGreaterThan(0);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description, 'description must fall back, not render empty').toBeTruthy();
  });

  test('security: unsafe URL scheme / injected markup in saved SEO fields must never render', async ({
    page,
    request,
  }) => {
    test.skip(!entryId, "QA fixture 'pages' entry with slug=about not found");

    await patchSeo(request, token, entryId!, {
      metaTitle: 'Safe title',
      canonical: 'javascript:alert(1)//',
      ogImage: 'javascript:alert(2)',
      ogTitle: '<script>alert(1)</script>Unsafe OG',
    });

    await page.goto('/uz/pages/about');
    const html = await page.content();
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<script>alert');

    // canonical must fall back to a real, safe, path-based URL — never be dropped to nothing.
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBe('https://safaar.uz/uz/pages/about');

    // og:image must be omitted entirely rather than emit the unsafe scheme.
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);

    // og:title must fall back to the sanitized page title, not the injected markup.
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Safe title');
  });

  test('browser health: the new /pages/:slug route has no console errors or hydration issues', async ({
    page,
    request,
  }) => {
    test.skip(!entryId, "QA fixture 'pages' entry with slug=about not found");
    await patchSeo(request, token, entryId!, null);

    const issues = trackPageIssues(page);
    await page.goto('/uz/pages/about');
    await page.waitForLoadState('networkidle');
    expect(issues.consoleErrors, `Console errors: ${issues.consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(
      issues.unexpectedResponses,
      `Unexpected network errors: ${JSON.stringify(issues.unexpectedResponses)}`,
    ).toHaveLength(0);
  });
});
