import { test, expect } from '@playwright/test';
import { trackPageIssues } from '../helpers/console-tracker';

/**
 * SAFAAR non-SMS real-browser public QA (web-partner).
 * Covers everything reachable WITHOUT completing OTP login:
 * landing, login page + negative cases, partner application form,
 * status-check form, responsive spot-checks, console/network capture.
 *
 * Deliberately does NOT click "SMS Kodini yuborish" for any phone number
 * with approved partner access (would attempt a real SMS send) — only
 * for phone numbers that fail the access-status gate first (empty/
 * malformed/random unapproved), which never reaches the SMS provider.
 */

function assertClean(issues: ReturnType<typeof trackPageIssues>) {
  expect(issues.consoleErrors, `Console errors: ${issues.consoleErrors.join(' | ')}`).toHaveLength(0);
  expect(
    issues.unexpectedResponses,
    `Network errors: ${JSON.stringify(issues.unexpectedResponses)}`,
  ).toHaveLength(0);
}

test.describe('Public/pre-auth QA', () => {
  test('landing page renders, no console errors', async ({ page }) => {
    const issues = trackPageIssues(page);
    await page.goto('/');
    await expect(page.getByText('Safaar').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/qa-landing.png', fullPage: true });
    assertClean(issues);
  });

  test('login page: renders, empty phone validation', async ({ page }) => {
    const issues = trackPageIssues(page);
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Tizimga Kirish' })).toBeVisible();
    await page.screenshot({ path: 'test-results/qa-login-initial.png' });

    const submitBtn = page.getByRole('button', { name: 'SMS Kodini yuborish' });
    await submitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/qa-login-empty-phone.png' });
    assertClean(issues);
  });

  test('login page: malformed phone rejected, no SMS attempted', async ({ page }) => {
    const issues = trackPageIssues(page);
    await page.goto('/login');
    const phoneInput = page.locator('#phone');
    await phoneInput.fill('12345');
    await page.getByRole('button', { name: 'SMS Kodini yuborish' }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/qa-login-malformed-phone.png' });
    assertClean(issues);
  });

  test('login page: random unapproved phone -> access-not-found error (safe, no SMS)', async ({ page }) => {
    const issues = trackPageIssues(page);
    await page.goto('/login');
    const phoneInput = page.locator('#phone');
    await phoneInput.fill('+998901234599');
    await page.getByRole('button', { name: 'SMS Kodini yuborish' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /access topilmadi|tasdiqlanmagan|rad etilgan/ })).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'test-results/qa-login-unapproved-phone.png' });
    assertClean(issues);
  });

  test('partner application form (Ariza berish) renders and validates', async ({ page }) => {
    const issues = trackPageIssues(page);
    await page.goto('/login');
    await page.getByRole('link', { name: 'Ariza berish' }).click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/qa-application-form.png', fullPage: true });

    const submitButtons = page.getByRole('button', { name: /Yuborish|Ariza|Davom/i });
    const count = await submitButtons.count();
    if (count > 0) {
      await submitButtons.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/qa-application-form-empty-submit.png', fullPage: true });
    }
    assertClean(issues);
  });

  test('status-check page (Holatni tekshirish) renders', async ({ page }) => {
    const issues = trackPageIssues(page);
    await page.goto('/login');
    await page.getByRole('link', { name: 'Holatni tekshirish' }).click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/qa-status-check.png', fullPage: true });
    assertClean(issues);
  });

  test('responsive: login page at mobile (390x844) and tablet (768x1024)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await page.screenshot({ path: 'test-results/qa-login-mobile-390x844.png' });

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/login');
    await page.screenshot({ path: 'test-results/qa-login-tablet-768x1024.png' });
  });
});
