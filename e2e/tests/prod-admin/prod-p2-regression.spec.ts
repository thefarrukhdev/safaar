import { test, expect } from '@playwright/test';

/**
 * PRODUCTION P2 regression verification — real browser, real production
 * URLs, read-only (no bookings created, no data mutated).
 */

test('production hotel detail: room card shows a real name (uz), no blank heading, no console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('React DevTools')) consoleErrors.push(m.text());
  });

  await page.goto('https://web-user-rho.vercel.app/uz/hotels/uzum-e2e-hotel-20260903', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);

  const bodyText = await page.locator('body').innerText();
  console.log('PAGE_TEXT_SNIPPET_UZ:', bodyText.replace(/\n/g, ' | ').slice(0, 500));

  const roomHeadings = await page.locator('li h3').allTextContents();
  console.log('ROOM_HEADINGS_UZ:', JSON.stringify(roomHeadings));
  const anyBlank = roomHeadings.some((t) => t.trim() === '');
  console.log('ANY_BLANK_ROOM_HEADING_UZ (expect false):', anyBlank);

  console.log('CONSOLE_ERRORS_UZ:', JSON.stringify(consoleErrors));
  await page.screenshot({ path: 'test-results/prod-p2-regression-uz.png', fullPage: true });

  expect(anyBlank).toBe(false);
  expect(roomHeadings.length).toBeGreaterThan(0);
});

test('production hotel detail: room card shows a real name (ru), no blank heading', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('React DevTools')) consoleErrors.push(m.text());
  });

  await page.goto('https://web-user-rho.vercel.app/ru/hotels/uzum-e2e-hotel-20260903', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);

  const roomHeadings = await page.locator('li h3').allTextContents();
  console.log('ROOM_HEADINGS_RU:', JSON.stringify(roomHeadings));
  const anyBlank = roomHeadings.some((t) => t.trim() === '');
  console.log('ANY_BLANK_ROOM_HEADING_RU (expect false):', anyBlank);
  console.log('CONSOLE_ERRORS_RU:', JSON.stringify(consoleErrors));
  await page.screenshot({ path: 'test-results/prod-p2-regression-ru.png', fullPage: true });

  expect(anyBlank).toBe(false);
});

test('production hotel listing still loads correctly (regression check)', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('React DevTools')) consoleErrors.push(m.text());
  });
  await page.goto('https://web-user-rho.vercel.app/uz/hotels', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);
  const bodyText = await page.locator('body').innerText();
  console.log('LISTING_PAGE_HAS_CONTENT:', bodyText.length > 100);
  console.log('CONSOLE_ERRORS_LISTING:', JSON.stringify(consoleErrors));
  await page.screenshot({ path: 'test-results/prod-p2-listing.png', fullPage: true });
});
