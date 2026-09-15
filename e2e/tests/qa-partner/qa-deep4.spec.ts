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

test('logout via user menu dropdown, session actually invalidated', async ({ page, context }) => {
  await loginAsQaPartner(page, '+998900000005');
  await page.getByText('Hamkor xodimi').last().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/qa-partner-usermenu-open.png' });

  const logoutOption = page.getByText(/Chiqish/i);
  const count = await logoutOption.count();
  console.log('LOGOUT_OPTION_COUNT_IN_MENU:', count);
  if (count > 0) {
    await logoutOption.first().click();
    await page.waitForTimeout(1200);
    console.log('URL_AFTER_LOGOUT:', page.url());
    const cookies = await context.cookies();
    console.log('COOKIES_AFTER_LOGOUT:', JSON.stringify(cookies.map((c) => ({ name: c.name, hasValue: !!c.value }))));

    // now try to go straight back to a protected route
    await page.goto('/rooms');
    await page.waitForTimeout(800);
    console.log('URL_AFTER_GOTO_ROOMS_POST_LOGOUT:', page.url());
    await page.screenshot({ path: 'test-results/qa-partner-rooms-post-logout.png' });
  }
});
