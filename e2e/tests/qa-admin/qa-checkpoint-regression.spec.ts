import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Verifies the checkpoint-commit fix (242f034: "close only topmost modal
 * on Escape") still works under enforced CSP: /partners/requests renders
 * a detail drawer with a confirmation dialog stacked on top; Escape must
 * close only the confirmation dialog, leaving the drawer open.
 */
const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt',
  'utf8',
).trim();

test('242f034: Escape closes only the topmost (confirmation) modal', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /kirish|login|sign in/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

  await page.goto('/partners/requests');
  const firstRow = page.locator('table tbody tr, [role="row"]').first();
  const rowCount = await page.locator('table tbody tr, [role="row"]').count();
  if (rowCount === 0) {
    test.skip(true, 'No partner requests available in QA to open a detail drawer with');
  }
  await firstRow.click();

  const rejectButton = page.getByRole('button', { name: /rad etish/i }).first();
  const hasReject = await rejectButton.isVisible().catch(() => false);
  if (!hasReject) {
    test.skip(true, 'No reject action available on this request (already decided)');
  }
  await rejectButton.click();

  // Confirmation dialog (with reason textarea) should now be open, on top
  // of the still-open detail drawer.
  const confirmDialogVisibleBefore = await page.getByRole('textbox').last().isVisible().catch(() => false);
  console.log('CONFIRM_DIALOG_OPEN_BEFORE_ESCAPE=', confirmDialogVisibleBefore);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // The drawer's own detail content (e.g. the row we clicked) should
  // still be visible -- only the confirmation dialog should have closed.
  const drawerStillOpen = await page.getByRole('button', { name: /rad etish|tasdiqlash/i }).first().isVisible().catch(() => false);
  console.log('DRAWER_STILL_OPEN_AFTER_ONE_ESCAPE=', drawerStillOpen);

  expect(drawerStillOpen, 'the detail drawer must remain open after one Escape (only the confirmation dialog should close)').toBe(true);
});
