import { test, expect } from '@playwright/test';
import { trackPageIssues } from '../helpers/console-tracker';

/**
 * ISOLATED QA ENVIRONMENT — real authenticated partner login against the
 * isolated QA backend (safaar-qa-backend), which has its own DB/Redis and
 * ENABLE_DEMO_AUTH=true. Never touches production. QA-only phone number.
 */
const QA_PARTNER_PHONE = '+998900000001'; // "QA-E2E-2026-09 Partner Org"

test('QA partner: real phone+OTP login reaches dashboard', async ({ page }) => {
  const issues = trackPageIssues(page);
  await page.goto('/login');
  await page.locator('#phone').fill(QA_PARTNER_PHONE);
  await page.getByRole('button', { name: 'SMS Kodini yuborish' }).click();

  const devCodeStrong = page.locator('text=Dasturlash rejimi kodi:').locator('..').locator('strong');
  await expect(devCodeStrong).toBeVisible({ timeout: 15_000 });
  const code = (await devCodeStrong.textContent())!.trim();
  expect(code).toBeTruthy();
  await page.screenshot({ path: 'test-results/qa-partner-otp-received.png' });

  await page.locator('#code').fill(code);
  await page.getByRole('button', { name: 'Kabinetga kirish' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
  await page.screenshot({ path: 'test-results/qa-partner-dashboard.png', fullPage: true });

  expect(issues.consoleErrors, `Console errors: ${issues.consoleErrors.join(' | ')}`).toHaveLength(0);
});
