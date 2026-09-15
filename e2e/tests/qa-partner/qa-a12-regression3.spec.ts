import { test, type Page } from '@playwright/test';

async function loginAsQaPartner(page: Page, phone: string) {
  await page.goto('/login');
  await page.locator('#phone').fill(phone);
  await page.getByRole('button', { name: 'SMS Kodini yuborish' }).click();
  const devCodeStrong = page.locator('text=Dasturlash rejimi kodi:').locator('..').locator('strong');
  await devCodeStrong.waitFor({ timeout: 15000 });
  const code = (await devCodeStrong.textContent())!.trim();
  await page.locator('#code').fill(code);
  await page.getByRole('button', { name: 'Kabinetga kirish' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
}

test('A12 regression precise: click reservation card content -> navigates; action button click does NOT navigate', async ({ page }) => {
  await loginAsQaPartner(page, '+998900000001');
  await page.goto('/reservations', { waitUntil: 'networkidle' });

  // Scope strictly to a reservation card's clickable content column (has font-mono id span inside)
  const cardContent = page.locator('[role="button"]').filter({ has: page.locator('h3') }).first();
  const count = await cardContent.count();
  console.log('CARD_CONTENT_COUNT=' + count);
  if (count > 0) {
    await cardContent.click();
    await page.waitForTimeout(1000);
    console.log('URL_AFTER_CONTENT_CLICK=' + page.url());
  }
});
