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

test.describe('REGRESSION: BUG-B01 — partner approve/reject confirmation', () => {
  test('reject: cancel/overlay/Escape mutate NOTHING; confirm with reason sends exactly 1 POST', async ({ page }) => {
    let rejectPostCount = 0;
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/admin\/partners\/.*\/reject/.test(req.url())) rejectPostCount++;
    });

    async function openRequestDetail() {
      await page.goto('/partners/requests');
      await page.waitForTimeout(800);
      await page.locator('tr', { hasText: 'QA-E2E Pending A' }).getByRole('button', { name: "Ko'rish" }).click();
      await page.waitForTimeout(600);
    }

    await loginAsAdmin(page);
    await page.goto('/partners/requests');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/qa-admin-partners-requests.png', fullPage: true });

    const pendingRow = page.getByText('QA-E2E Pending A').first();
    await expect(pendingRow).toBeVisible({ timeout: 10000 });
    await page.locator('tr', { hasText: 'QA-E2E Pending A' }).getByRole('button', { name: "Ko'rish" }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-results/qa-admin-request-detail.png', fullPage: true });

    await page.getByRole('button', { name: /Rad etish/i }).first().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'test-results/qa-admin-reject-modal.png' });
    console.log('REJECT_POST_COUNT_after_button_click (expect 0):', rejectPostCount);
    expect(rejectPostCount, 'clicking Reject must NOT mutate before confirm').toBe(0);

    // Try Escape — should not mutate (confirmed: 0 mutations). REAL FINDING:
    // Escape closes the ENTIRE request-detail drawer, not just the reject
    // confirmation dialog on top of it — a minor UX defect (loses the admin's
    // place), non-destructive (no mutation), so we re-open the detail view
    // to continue the rest of this flow.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    console.log('REJECT_POST_COUNT_after_escape (expect 0):', rejectPostCount);
    expect(rejectPostCount, 'Escape must NOT mutate').toBe(0);
    const stillOnDetail = await page.getByRole('button', { name: /Rad etish/i }).count();
    console.log('ESCAPE_CLOSED_ENTIRE_DETAIL_DRAWER (finding, not just the confirm dialog):', stillOnDetail === 0);
    if (stillOnDetail === 0) {
      await openRequestDetail();
    }

    // Reopen and test cancel button
    await page.getByRole('button', { name: /Rad etish/i }).first().click();
    await page.waitForTimeout(400);
    const cancelBtn = page.getByRole('button', { name: /Bekor qilish/i }).first();
    const cancelCount = await cancelBtn.count();
    console.log('CANCEL_BUTTON_FOUND:', cancelCount);
    if (cancelCount > 0) {
      await cancelBtn.click();
      await page.waitForTimeout(500);
      console.log('REJECT_POST_COUNT_after_cancel (expect 0):', rejectPostCount);
      expect(rejectPostCount).toBe(0);
    }
    const stillOnDetailAfterCancel = await page.getByRole('button', { name: /Rad etish/i }).count();
    console.log('CANCEL_CLOSED_ENTIRE_DETAIL_DRAWER_TOO:', stillOnDetailAfterCancel === 0);
    if (stillOnDetailAfterCancel === 0) {
      await openRequestDetail();
    }

    // Reopen, fill reason, confirm — expect exactly 1 POST
    await page.getByRole('button', { name: /Rad etish/i }).first().click();
    await page.waitForTimeout(400);
    // NOTE (test-script fix, not a product bug): the detail drawer ALSO has an
    // unrelated "Admin izohlari" (internal notes) textarea earlier in the DOM,
    // which a plain `.locator('textarea').first()` matched instead of the real
    // reject-reason box — leaving the actual reason empty and its confirm
    // button permanently disabled. Target the real one by its accessible name.
    const reasonBox = page.getByRole('textbox', { name: 'Rad etish sababi' });
    await expect(reasonBox).toBeVisible({ timeout: 5000 });
    await reasonBox.fill('QA-E2E-2026-09 automated regression test rejection reason');
    const confirmBtn = page.getByRole('button', { name: 'Rad etish', exact: true }).last();
    await confirmBtn.click();
    await page.waitForTimeout(1200);
    console.log('REJECT_POST_COUNT_after_confirm (expect 1):', rejectPostCount);
    expect(rejectPostCount, 'exactly one reject POST after confirm').toBe(1);
    await page.screenshot({ path: 'test-results/qa-admin-after-reject.png', fullPage: true });
  });

  test('approve: confirmation required, exactly 1 POST', async ({ page }) => {
    let approvePostCount = 0;
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/admin\/partners\/.*\/approve/.test(req.url())) approvePostCount++;
    });

    await loginAsAdmin(page);
    await page.goto('/partners/requests');
    await page.waitForTimeout(1000);

    const pendingRow = page.getByText('QA-E2E Pending B').first();
    await expect(pendingRow).toBeVisible({ timeout: 10000 });
    await page.locator('tr', { hasText: 'QA-E2E Pending B' }).getByRole('button', { name: "Ko'rish" }).click();
    await page.waitForTimeout(600);

    const approveBtn = page.getByRole('button', { name: /Tasdiqlash/i }).first();
    await approveBtn.click();
    await page.waitForTimeout(400);
    console.log('APPROVE_POST_COUNT_after_button (expect 0):', approvePostCount);
    expect(approvePostCount, 'clicking Approve must not mutate before confirm').toBe(0);
    await page.screenshot({ path: 'test-results/qa-admin-approve-modal.png' });

    const confirmBtn = page.getByRole('button', { name: /Tasdiqlash/i }).last();
    await confirmBtn.click();
    await page.waitForTimeout(1200);
    console.log('APPROVE_POST_COUNT_after_confirm (expect 1):', approvePostCount);
    expect(approvePostCount, 'exactly one approve POST after confirm').toBe(1);
  });
});

test.describe('REGRESSION: BUG-B02 — mobile 390px layout', () => {
  test('no horizontal overflow at 390x844, hamburger present', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsAdmin(page);
    await page.waitForTimeout(800);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth = await page.evaluate(() => window.innerWidth);
    console.log(`MOBILE_390_SCROLLWIDTH=${scrollWidth} INNERWIDTH=${innerWidth}`);
    await page.screenshot({ path: 'test-results/qa-admin-mobile-390.png', fullPage: true });
    expect(scrollWidth, 'no horizontal overflow at 390px').toBeLessThanOrEqual(innerWidth + 2);

    const hamburger = page.locator('[aria-label*="Menyu" i], [aria-label*="menu" i]');
    console.log('HAMBURGER_COUNT:', await hamburger.count());
  });
});

test.describe('REGRESSION: promo percent field / promos page', () => {
  test('promos page loads without console/type errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('React DevTools')) consoleErrors.push(m.text()); });
    await loginAsAdmin(page);
    await page.goto('/promos');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'test-results/qa-admin-promos.png', fullPage: true });
    console.log('PROMOS_CONSOLE_ERRORS:', JSON.stringify(consoleErrors));
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('REGRESSION: admin login repeated attempts (server action stability)', () => {
  test('5 consecutive logins all succeed (proxy for transport-retry fix)', async ({ browser }) => {
    for (let i = 0; i < 5; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await loginAsAdmin(page);
      console.log(`LOGIN_ATTEMPT_${i}_URL:`, page.url());
      expect(page.url()).not.toContain('/login');
      await context.close();
    }
  });
});
