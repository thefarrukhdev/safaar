import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
];

test.describe('EXHAUSTIVE: full responsive matrix — web-user homepage + hotel detail', () => {
  for (const vp of VIEWPORTS) {
    test(`homepage @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/uz', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      console.log(`HOMEPAGE ${vp.name}: scrollWidth=${scrollWidth} innerWidth=${vp.width} overflow=${scrollWidth > vp.width + 5}`);
      await page.screenshot({ path: `test-results/responsive-user-home-${vp.name}.png`, fullPage: true });
      expect(scrollWidth, `no horizontal overflow at ${vp.name}`).toBeLessThanOrEqual(vp.width + 5);
    });

    test(`hotel detail @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/uz/hotels/qa-e2e-2026-09-hotel', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      console.log(`HOTEL_DETAIL ${vp.name}: scrollWidth=${scrollWidth} innerWidth=${vp.width} overflow=${scrollWidth > vp.width + 5}`);
      await page.screenshot({ path: `test-results/responsive-user-hotel-${vp.name}.png`, fullPage: true });
      expect(scrollWidth).toBeLessThanOrEqual(vp.width + 5);
    });
  }
});
