import { test, expect } from '@playwright/test';

async function loginAsQaPartner(page: import('@playwright/test').Page, phone: string) {
  await page.goto('/login');
  await page.locator('#phone').fill(phone);
  await page.getByRole('button', { name: 'SMS Kodini yuborish' }).click();
  const devCodeStrong = page.locator('text=Dasturlash rejimi kodi:').locator('..').locator('strong');
  await expect(devCodeStrong).toBeVisible({ timeout: 15_000 });
  const code = (await devCodeStrong.textContent())!.trim();
  await page.locator('#code').fill(code);
  await page.getByRole('button', { name: 'Kabinetga kirish' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
}

test('deep CRUD: listing page renders, empty state, form discovery', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('React DevTools')) consoleErrors.push(m.text()); });
  let postCount = 0;
  page.on('request', (req) => { if (req.method() === 'POST' && req.url().includes('/hotels')) postCount++; });

  await loginAsQaPartner(page, '+998900000007');
  await page.goto('/listing');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/qa-partner-listing-empty.png', fullPage: true });
  console.log('LISTING_CONSOLE_ERRORS:', JSON.stringify(consoleErrors));

  // Look for a create/start button
  const createBtn = page.getByRole('button', { name: /Qo'shish|Yaratish|Boshlash|E'lon/i }).or(page.getByRole('link', { name: /Qo'shish|Yaratish|Boshlash|E'lon/i }));
  const count = await createBtn.count();
  console.log('CREATE_BUTTON_CANDIDATES:', count);
  if (count > 0) {
    await createBtn.first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/qa-partner-listing-create-step1.png', fullPage: true });
    console.log('URL_AFTER_CREATE_CLICK:', page.url());
  }
  console.log('POST_TO_HOTELS_COUNT (expect 0, no submit yet):', postCount);
});

test('deep CRUD: rooms page for org with no hotel yet — empty state check', async ({ page }) => {
  await loginAsQaPartner(page, '+998900000008');
  await page.goto('/rooms');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/qa-partner-rooms-empty.png', fullPage: true });
});

test('deep CRUD: reservations page empty state + filters render', async ({ page }) => {
  await loginAsQaPartner(page, '+998900000009');
  await page.goto('/reservations');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/qa-partner-reservations-empty.png', fullPage: true });
});
