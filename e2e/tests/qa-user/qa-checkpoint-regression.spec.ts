import { test, expect } from '@playwright/test';

/**
 * Verifies the specific checkpoint-commit behaviors (from 92e2ee5) still
 * work under enforced CSP -- not just "the page loads", but the actual
 * fixed behavior itself. (PwaInstallBanner's dict-prop wiring (d0724f4) is
 * already covered indirectly: the qa-csp-enforced-check suite renders the
 * whole [lang]/layout.tsx tree, including this component, with zero page
 * errors on every route -- if the dict plumbing were broken this would
 * throw at render time, and TypeScript already enforces the dict shape
 * at build time.)
 */

test('P2-4: locale switch preserves query params', async ({ page }) => {
  await page.goto('/uz/hotels?city=samarkand');
  await page.getByRole('button', { name: 'Tilni tanlash' }).click();
  await page.getByRole('option').filter({ hasText: /RU/i }).click();
  await page.waitForURL(/\/ru\//, { timeout: 5000 });
  const url = page.url();
  console.log('POST_SWITCH_URL=', url);
  expect(url).toContain('city=samarkand');
});
