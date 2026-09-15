import { test } from '@playwright/test';

test('P2-4 screenshot evidence: before/after locale switch', async ({ page }) => {
  await page.goto('/uz/hotels?city=samarkand&stars=3', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/p2-4-before.png' });
  await page.getByRole('button', { name: 'Tilni tanlash' }).click();
  await page.getByRole('option', { name: /RU|Русский/i }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/ru'), { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/p2-4-after.png' });
  console.log('FINAL_URL=' + page.url());
});
