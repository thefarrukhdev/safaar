import { test, expect } from '@playwright/test';

test('REGRESSION (02fc37d): switching locale preserves query string filters', async ({ page }) => {
  await page.goto('/uz/hotels?city=samarkand&stars=3', { waitUntil: 'networkidle' });
  expect(page.url()).toContain('city=samarkand');
  expect(page.url()).toContain('stars=3');

  await page.getByRole('button', { name: 'Tilni tanlash' }).click();
  await page.getByRole('option', { name: /RU|Русский/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/ru'), { timeout: 10000 });

  const finalUrl = page.url();
  console.log('FINAL_URL_AFTER_LOCALE_SWITCH=' + finalUrl);
  expect(finalUrl).toContain('/ru/hotels');
  expect(finalUrl).toContain('city=samarkand');
  expect(finalUrl).toContain('stars=3');
});
