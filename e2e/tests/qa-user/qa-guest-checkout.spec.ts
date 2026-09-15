import { test, expect } from '@playwright/test';

/**
 * Regression check for a past bug (d30fe1f2): "guest booking confirmation
 * page crashed after checkout". Tests the UNAUTHENTICATED (guest) checkout
 * path end-to-end, which the earlier logged-in E2E pass never covered.
 */
test('guest (unauthenticated) checkout: fills required guest fields, submits, confirmation page does not crash', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('React DevTools')) consoleErrors.push(m.text());
  });

  await page.goto('/uz/hotels/qa-e2e-2026-09-hotel', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Bron qilish' }).first().click();
  await page.waitForURL(/\/booking\?/);

  // Guest-only fields (isGuest path in CheckoutForm)
  await page.locator('input[name="firstName"]').fill('Guest');
  await page.locator('input[name="lastName"]').fill('Tester');
  await page.locator('input[name="email"]').fill(`qa.guest.${Date.now()}@example.com`);
  await page.locator('input[name="phone"]').fill('+998900000099');

  // Pick dates via the same DatePicker pattern
  async function pickDate(pickerIndex: number, target: Date) {
    const toggle = page.locator('button[aria-haspopup="dialog"]').nth(pickerIndex);
    await toggle.click();
    for (let i = 0; i < 3; i++) {
      const dayBtn = page.locator('button', { hasText: new RegExp(`^${target.getDate()}$`) });
      if (await dayBtn.count() > 0 && await dayBtn.first().isEnabled()) {
        await dayBtn.first().click();
        return;
      }
      await page.getByLabel('next').click();
    }
  }
  const checkIn = new Date(Date.now() + 86_400_000 * 8);
  const checkOut = new Date(Date.now() + 86_400_000 * 9);
  await pickDate(0, checkIn);
  await pickDate(1, checkOut);

  const confirmBtn = page.getByRole('button', { name: 'Bronni tasdiqlash' });
  await expect(confirmBtn).toBeEnabled({ timeout: 5000 });
  await page.screenshot({ path: 'test-results/qa-guest-checkout-filled.png', fullPage: true });
  await confirmBtn.click();
  await page.waitForURL(/\/booking\/[0-9a-f-]+\?/, { timeout: 15000 });

  console.log('GUEST_BOOKING_URL:', page.url());
  const bodyText = await page.locator('body').innerText();
  console.log('GUEST_CONFIRMATION_PAGE_TEXT:', bodyText.replace(/\n/g, ' | ').slice(0, 400));
  console.log('CONSOLE_ERRORS:', JSON.stringify(consoleErrors));
  await page.screenshot({ path: 'test-results/qa-guest-checkout-confirmation.png', fullPage: true });

  // The confirmation page must render real content, not crash/blank.
  expect(bodyText.length).toBeGreaterThan(50);
  expect(consoleErrors).toEqual([]);
});

test('guest confirmation page — proper wait, real content check', async ({ page }) => {
  await page.goto('/uz/hotels/qa-e2e-2026-09-hotel', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Bron qilish' }).first().click();
  await page.waitForURL(/\/booking\?/);
  await page.locator('input[name="firstName"]').fill('Guest');
  await page.locator('input[name="lastName"]').fill('Tester2');
  await page.locator('input[name="email"]').fill(`qa.guest2.${Date.now()}@example.com`);
  await page.locator('input[name="phone"]').fill('+998900000098');
  async function pickDate(pickerIndex: number, target: Date) {
    const toggle = page.locator('button[aria-haspopup="dialog"]').nth(pickerIndex);
    await toggle.click();
    for (let i = 0; i < 3; i++) {
      const dayBtn = page.locator('button', { hasText: new RegExp(`^${target.getDate()}$`) });
      if (await dayBtn.count() > 0 && await dayBtn.first().isEnabled()) {
        await dayBtn.first().click();
        return;
      }
      await page.getByLabel('next').click();
    }
  }
  const checkIn = new Date(Date.now() + 86_400_000 * 10);
  const checkOut = new Date(Date.now() + 86_400_000 * 11);
  await pickDate(0, checkIn);
  await pickDate(1, checkOut);
  await page.getByRole('button', { name: 'Bronni tasdiqlash' }).click();
  await page.waitForURL(/\/booking\/[0-9a-f-]+\?/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  const bodyText = await page.locator('body').innerText();
  console.log('GUEST_CONFIRMATION_REAL_CONTENT:', bodyText.replace(/\n/g, ' | ').slice(0, 500));
  await page.screenshot({ path: 'test-results/qa-guest-checkout-confirmation-v2.png', fullPage: true });
  expect(bodyText).toContain('Kutilmoqda');
});
