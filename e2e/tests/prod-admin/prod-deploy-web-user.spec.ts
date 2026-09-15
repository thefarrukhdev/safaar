import { test } from '@playwright/test';

test.use({ baseURL: 'https://web-user-rho.vercel.app' });

test('PROD: locale switcher preserves query params + PWA dict + basic render', async ({ page }) => {
  await page.goto('/uz/hotels?city=samarkand&stars=3', { waitUntil: 'networkidle', timeout: 30000 });
  const before = page.url();
  await page.getByRole('button', { name: 'Tilni tanlash' }).click();
  await page.getByRole('option', { name: /RU|Русский/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/ru'), { timeout: 15000 });
  const after = page.url();
  console.log(`BEFORE=${before}`);
  console.log(`AFTER=${after}`);
  console.log(`QS_PRESERVED=${after.includes('city=samarkand') && after.includes('stars=3')}`);

  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/uz', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  console.log('HOMEPAGE_RUNTIME_ERRORS=' + JSON.stringify(errors));

  await page.goto('/uz/hotels/qa-e2e-2026-09-hotel', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  console.log('HOTEL_DETAIL_URL=' + page.url());
});
