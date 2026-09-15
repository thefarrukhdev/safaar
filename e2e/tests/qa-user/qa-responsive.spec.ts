import { test, expect } from '@playwright/test';

test('user homepage responsive: 390x844 no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/uz');
  await page.waitForTimeout(1000);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const innerWidth = await page.evaluate(() => window.innerWidth);
  console.log(`USER_MOBILE_SCROLLWIDTH=${scrollWidth} INNERWIDTH=${innerWidth}`);
  await page.screenshot({ path: 'test-results/qa-user-mobile-390.png', fullPage: true });
  expect(scrollWidth, 'no horizontal overflow at 390px').toBeLessThanOrEqual(innerWidth + 5);
});

test('user homepage responsive: 768x1024 tablet', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/uz');
  await page.waitForTimeout(1000);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const innerWidth = await page.evaluate(() => window.innerWidth);
  console.log(`USER_TABLET_SCROLLWIDTH=${scrollWidth} INNERWIDTH=${innerWidth}`);
  await page.screenshot({ path: 'test-results/qa-user-tablet-768.png' });
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 5);
});
