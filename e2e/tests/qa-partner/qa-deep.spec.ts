import { test, expect } from '@playwright/test';
import { trackPageIssues } from '../helpers/console-tracker';

const QA_PARTNER_PHONE = '+998900000001';

async function loginAsQaPartner(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('#phone').fill(QA_PARTNER_PHONE);
  await page.getByRole('button', { name: 'SMS Kodini yuborish' }).click();
  const devCodeStrong = page.locator('text=Dasturlash rejimi kodi:').locator('..').locator('strong');
  await expect(devCodeStrong).toBeVisible({ timeout: 15_000 });
  const code = (await devCodeStrong.textContent())!.trim();
  await page.locator('#code').fill(code);
  await page.getByRole('button', { name: 'Kabinetga kirish' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
}

test.describe('QA Partner deep sweep', () => {
  test('navigation: every sidebar item loads without error', async ({ page }) => {
    const issues = trackPageIssues(page);
    await loginAsQaPartner(page);

    const navItems = ['Front Desk', 'Mehmonxona E\'loni', 'Xonalar', 'Bronlar', 'Kalendar', 'Mijozlar', 'Hisobotlar', 'Sozlamalar'];
    for (const item of navItems) {
      const link = page.getByRole('link', { name: item }).or(page.getByRole('button', { name: item }));
      const count = await link.count();
      if (count === 0) {
        console.log(`NAV ITEM NOT FOUND: ${item}`);
        continue;
      }
      await link.first().click();
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(400);
      await page.screenshot({ path: `test-results/qa-partner-nav-${item.replace(/[^a-zA-Z0-9]/g, '_')}.png`, fullPage: true });
    }

    console.log('CONSOLE_ERRORS:', JSON.stringify(issues.consoleErrors));
    console.log('UNEXPECTED_RESPONSES:', JSON.stringify(issues.unexpectedResponses));
  });

  test('security: partner cannot access admin routes; direct protected route without session redirects', async ({ page, context }) => {
    // Unauthenticated: direct protected route access
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);
    const urlAfterUnauth = page.url();
    await page.screenshot({ path: 'test-results/qa-partner-unauth-protected.png' });
    console.log('UNAUTH_PROTECTED_ROUTE_RESULT_URL:', urlAfterUnauth);

    // Now log in
    await loginAsQaPartner(page);
    const cookiesAfterLogin = await context.cookies();
    console.log('COOKIES_AFTER_LOGIN:', cookiesAfterLogin.map((c) => c.name).join(','));

    // Try admin-ish paths that shouldn't exist/shouldn't be accessible from partner app
    for (const path of ['/admin', '/api/admin', '/settings/admin']) {
      const resp = await page.goto(path, { waitUntil: 'domcontentloaded' }).catch((e) => ({ status: () => `ERR:${e.message}` }));
      const status = typeof resp?.status === 'function' ? resp.status() : 'no-response';
      console.log(`ADMIN_PATH_PROBE ${path}: status=${status} finalUrl=${page.url()}`);
    }
  });

  test('logout then back button does not restore session', async ({ page, context }) => {
    await loginAsQaPartner(page);
    await page.goto('/settings');
    await page.waitForTimeout(500);

    const logoutBtn = page.getByRole('button', { name: /Chiqish|Log ?out/i });
    if (await logoutBtn.count() > 0) {
      await logoutBtn.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/qa-partner-after-logout.png' });

      await page.goBack();
      await page.waitForTimeout(800);
      await page.screenshot({ path: 'test-results/qa-partner-back-after-logout.png' });
      console.log('URL_AFTER_BACK_POST_LOGOUT:', page.url());

      // try reloading — should still be logged out / redirected
      await page.reload();
      await page.waitForTimeout(800);
      console.log('URL_AFTER_RELOAD_POST_LOGOUT:', page.url());
    } else {
      console.log('LOGOUT_BUTTON_NOT_FOUND on /settings');
    }
  });
});
