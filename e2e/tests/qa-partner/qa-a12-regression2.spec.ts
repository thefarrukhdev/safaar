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

test('A12 regression detail: what happens on row click + screenshot', async ({ page }) => {
  await loginAsQaPartner(page, '+998900000001');
  await page.goto('/reservations', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/a12-before-click.png' });
  const firstCard = page.locator('[role="button"]').first();
  await firstCard.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/a12-after-click.png' });
  const dialogCount = await page.locator('[role="dialog"]').count();
  console.log('DIALOG_COUNT_AFTER_CLICK=' + dialogCount);
});
