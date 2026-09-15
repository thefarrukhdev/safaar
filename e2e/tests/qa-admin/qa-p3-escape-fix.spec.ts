import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt',
  'utf8',
).trim();

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /kirish/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
}

test.describe('P3 FIX REGRESSION: Escape closes only the topmost (Reject) dialog, not the parent drawer', () => {
  test('Escape closes Reject dialog only; parent drawer stays open; no mutation', async ({ page }) => {
    let rejectPostCount = 0;
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/admin\/partners\/.*\/reject/.test(req.url())) rejectPostCount++;
    });

    await loginAsAdmin(page);
    await page.goto('/partners/requests');
    await page.waitForTimeout(1000);

    await page.locator('tr', { hasText: 'QA-E2E Pending A' }).getByRole('button', { name: "Ko'rish" }).click();
    await page.waitForTimeout(600);

    // Fresh locator: confirm the parent detail drawer is open (its own title heading visible).
    const drawerHeading = page.getByRole('heading', { name: /^Ariza:/ });
    await expect(drawerHeading).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /Rad etish/i }).first().click();
    await page.waitForTimeout(400);
    const rejectDialogHeading = page.getByRole('heading', { name: 'Arizani rad etish' });
    await expect(rejectDialogHeading).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/qa-p3-before-escape.png', fullPage: true });

    // Press Escape — expect ONLY the Reject dialog to close.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/qa-p3-after-escape.png', fullPage: true });

    console.log('REJECT_DIALOG_VISIBLE_AFTER_ESCAPE (expect false):', await rejectDialogHeading.isVisible());
    console.log('PARENT_DRAWER_VISIBLE_AFTER_ESCAPE (expect true):', await drawerHeading.isVisible());
    console.log('REJECT_POST_COUNT_after_escape (expect 0):', rejectPostCount);

    await expect(rejectDialogHeading).toBeHidden({ timeout: 3000 });
    await expect(drawerHeading, 'parent request-detail drawer must remain open after Escape').toBeVisible();
    expect(rejectPostCount, 'Escape must not mutate anything').toBe(0);

    // --- Reopen Reject, use Cancel this time ---
    const freshRejectTrigger = page.getByRole('button', { name: /Rad etish/i }).first();
    await freshRejectTrigger.click();
    await page.waitForTimeout(400);
    await expect(page.getByRole('heading', { name: 'Arizani rad etish' })).toBeVisible({ timeout: 5000 });

    const cancelBtn = page.getByRole('button', { name: /Bekor qilish/i }).first();
    await cancelBtn.click();
    await page.waitForTimeout(400);

    console.log('REJECT_POST_COUNT_after_cancel (expect 0):', rejectPostCount);
    console.log('PARENT_DRAWER_VISIBLE_AFTER_CANCEL (expect true):', await drawerHeading.isVisible());
    await expect(page.getByRole('heading', { name: 'Arizani rad etish' })).toBeHidden({ timeout: 3000 });
    await expect(drawerHeading, 'parent drawer must remain open after Cancel too').toBeVisible();
    expect(rejectPostCount).toBe(0);

    // --- Reopen Reject, fill a valid reason, Confirm — expect exactly 1 POST ---
    await page.getByRole('button', { name: /Rad etish/i }).first().click();
    await page.waitForTimeout(400);
    const reasonBox = page.getByRole('textbox', { name: 'Rad etish sababi' });
    await expect(reasonBox).toBeVisible({ timeout: 5000 });
    await reasonBox.fill('QA-E2E-2026-09 P3-fix regression test rejection reason');
    const confirmBtn = page.getByRole('button', { name: 'Rad etish', exact: true }).last();
    await confirmBtn.click();
    await page.waitForTimeout(1200);

    console.log('REJECT_POST_COUNT_after_confirm (expect 1):', rejectPostCount);
    expect(rejectPostCount, 'exactly one reject POST after confirm').toBe(1);
    await page.screenshot({ path: 'test-results/qa-p3-after-confirm.png', fullPage: true });
  });
});
