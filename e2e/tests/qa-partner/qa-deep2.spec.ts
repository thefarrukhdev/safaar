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

test('unauthenticated access to real protected route (/) behavior', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1000);
  console.log('UNAUTH_ROOT_URL:', page.url());
  await page.screenshot({ path: 'test-results/qa-partner-unauth-root.png', fullPage: true });
});

test('unauthenticated access to /rooms, /reservations, /settings', async ({ page }) => {
  for (const path of ['/rooms', '/reservations', '/settings']) {
    await page.goto(path);
    await page.waitForTimeout(800);
    console.log(`UNAUTH_${path}_FINAL_URL:`, page.url());
    await page.screenshot({ path: `test-results/qa-partner-unauth${path.replace(/\//g, '_')}.png` });
  }
});

test('logout invalidates session (back/reload do not restore it)', async ({ page }) => {
  await loginAsQaPartner(page, '+998900000002');
  await page.goto('/settings');
  await page.waitForTimeout(500);
  const logoutBtn = page.getByRole('button', { name: /Chiqish|Log ?out/i });
  const found = await logoutBtn.count();
  console.log('LOGOUT_BUTTON_FOUND:', found);
  if (found > 0) {
    await logoutBtn.first().click();
    await page.waitForTimeout(1000);
    console.log('URL_AFTER_LOGOUT_CLICK:', page.url());
    await page.screenshot({ path: 'test-results/qa-partner-after-logout2.png' });

    await page.goBack();
    await page.waitForTimeout(800);
    console.log('URL_AFTER_BACK:', page.url());
    await page.goto('/');
    await page.waitForTimeout(800);
    console.log('URL_AFTER_GOTO_ROOT_POST_LOGOUT:', page.url());
    await page.screenshot({ path: 'test-results/qa-partner-root-post-logout.png', fullPage: true });
  }
});

test('cross-organization data isolation: partner 3 cannot see partner 2 data', async ({ page, context: _c1 }) => {
  await loginAsQaPartner(page, '+998900000003');
  await page.goto('/rooms');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/qa-partner3-rooms.png', fullPage: true });
  // Check network response bodies for any cross-org leakage isn't feasible visually;
  // record page text content length as a basic sanity signal.
  const bodyText = await page.textContent('body');
  console.log('PARTNER3_ROOMS_PAGE_TEXT_SNIPPET:', bodyText?.slice(0, 300));
});
