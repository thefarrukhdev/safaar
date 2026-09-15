import { test, expect } from '@playwright/test';

/**
 * P2 fix verification — hotel detail room cards must show a real room name
 * (never blank), for every locale the app supports.
 */

test('room card shows the real room name (uz) — no blank heading', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('React DevTools')) consoleErrors.push(m.text());
  });

  await page.goto('/uz/hotels/qa-e2e-2026-09-hotel', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'QA-E2E-2026-09 Hotel' })).toBeVisible({ timeout: 10000 });

  const roomHeading = page.locator('li:has-text("Bron qilish") h3').first();
  const text = (await roomHeading.textContent())?.trim();
  console.log('ROOM_CARD_HEADING_TEXT_UZ:', JSON.stringify(text));
  expect(text, 'room card heading must not be blank').not.toBe('');
  expect(text).not.toBeNull();

  console.log('CONSOLE_ERRORS_UZ:', JSON.stringify(consoleErrors));
  expect(consoleErrors).toEqual([]);
  await page.screenshot({ path: 'test-results/qa-room-name-fix-uz.png', fullPage: true });
});

test('room card shows a real room name in another supported locale (ru)', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('React DevTools')) consoleErrors.push(m.text());
  });

  await page.goto('/ru/hotels/qa-e2e-2026-09-hotel', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const roomHeading = page.locator('h3').first();
  const bodyText = await page.locator('body').innerText();
  console.log('RU_PAGE_LOADED:', bodyText.length > 0);
  console.log('ROOM_HEADINGS_ON_PAGE:', await page.locator('li h3').allTextContents());

  const anyBlankHeading = (await page.locator('li h3').allTextContents()).some((t) => t.trim() === '');
  console.log('ANY_BLANK_ROOM_HEADING_RU (expect false):', anyBlankHeading);
  expect(anyBlankHeading).toBe(false);

  console.log('CONSOLE_ERRORS_RU:', JSON.stringify(consoleErrors));
  await page.screenshot({ path: 'test-results/qa-room-name-fix-ru.png', fullPage: true });
});
