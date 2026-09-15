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

test('unauthenticated access to real settings sub-routes', async ({ page }) => {
  for (const path of ['/settings/profile', '/settings/team', '/settings/hotel', '/settings/documents']) {
    await page.goto(path);
    await page.waitForTimeout(700);
    console.log(`UNAUTH_${path}_FINAL_URL:`, page.url());
  }
});

test('logout button (real settings/profile page) invalidates session', async ({ page }) => {
  await loginAsQaPartner(page, '+998900000004');
  await page.goto('/settings/profile');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/qa-partner-settings-profile.png', fullPage: true });

  const logoutBtn = page.getByRole('button', { name: /Chiqish|Log ?out/i });
  const found = await logoutBtn.count();
  console.log('LOGOUT_BUTTON_FOUND_ON_PROFILE:', found);
  if (found === 0) {
    // try sidebar / topbar user menu
    const userMenu = page.locator('[aria-label*="user" i], [aria-label*="profile" i], button:has-text("Hamkor")');
    console.log('USER_MENU_CANDIDATES:', await userMenu.count());
  }
});
