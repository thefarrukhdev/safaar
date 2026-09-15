import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt',
  'utf8',
).trim();

test('a11y spot check: login form — label association, keyboard-only submit, focus visible', async ({ page }) => {
  await page.goto('/login');

  // Label association
  const userInput = page.getByPlaceholder('admin');
  const userId = await userInput.getAttribute('id');
  const hasLabelFor = userId ? await page.locator(`label[for="${userId}"]`).count() : 0;
  console.log('USERNAME_INPUT_ID:', userId, 'HAS_LABEL_FOR:', hasLabelFor);

  const passInput = page.locator('input[type="password"]').first();
  const passId = await passInput.getAttribute('id');
  const passHasLabelFor = passId ? await page.locator(`label[for="${passId}"]`).count() : 0;
  console.log('PASSWORD_INPUT_ID:', passId, 'HAS_LABEL_FOR:', passHasLabelFor);

  // Keyboard-only flow: Tab to username, type, Tab to password, type, Enter to submit
  await page.keyboard.press('Tab');
  const firstFocused = await page.evaluate(() => document.activeElement?.getAttribute('placeholder'));
  console.log('FIRST_TAB_STOP_PLACEHOLDER (expect admin):', firstFocused);

  await page.keyboard.type(ADMIN_EMAIL);
  await page.keyboard.press('Tab');
  const secondFocusedType = await page.evaluate(() => (document.activeElement as HTMLInputElement)?.type);
  console.log('SECOND_TAB_STOP_TYPE (expect password):', secondFocusedType);
  await page.keyboard.type(ADMIN_PASSWORD);

  // focus-visible check: does the currently focused element have a visible outline/ring?
  const outlineInfo = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const cs = getComputedStyle(el);
    return { outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, boxShadow: cs.boxShadow };
  });
  console.log('FOCUSED_ELEMENT_OUTLINE_INFO:', JSON.stringify(outlineInfo));

  await page.keyboard.press('Enter');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  console.log('KEYBOARD_ONLY_LOGIN_SUCCEEDED:', !page.url().includes('/login'));
});

test('a11y spot check: heading hierarchy on dashboard + partners/requests', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /kirish/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

  for (const path of ['/dashboard', '/partners/requests']) {
    await page.goto(path, { waitUntil: 'networkidle' });
    const levels = await page.evaluate(() =>
      Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => Number(h.tagName[1])),
    );
    console.log(`HEADING_LEVELS[${path}]:`, JSON.stringify(levels));
    const h1Count = levels.filter((l) => l === 1).length;
    console.log(`H1_COUNT[${path}] (expect exactly 1, or 0 if using a different landmark pattern):`, h1Count);
  }
});

test('a11y spot check: reject-modal focus trap + button accessible names', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /kirish/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

  await page.goto('/partners/requests', { waitUntil: 'networkidle' });
  const anyRow = page.locator('tr', { hasText: 'QA-E2E Pending' }).first();
  if (await anyRow.count() === 0) {
    console.log('NO_PENDING_ROW_AVAILABLE_FOR_FOCUS_TEST — skipping (data state, not a defect)');
    return;
  }
  await anyRow.getByRole('button', { name: "Ko'rish" }).click();
  await page.waitForTimeout(600);
  const rejectTrigger = page.getByRole('button', { name: /Rad etish/i }).first();
  if (await rejectTrigger.count() === 0) {
    console.log('NO_REJECT_BUTTON_ON_THIS_ROW — skipping (likely already actioned)');
    return;
  }
  await rejectTrigger.click();
  await page.waitForTimeout(400);

  // Is focus inside the modal right after opening? (a real focus-trap check)
  const focusInsideModal = await page.evaluate(() => {
    const active = document.activeElement;
    const dialogHeading = Array.from(document.querySelectorAll('h3')).find((h) => h.textContent?.includes('rad etish'));
    if (!dialogHeading) return 'NO_DIALOG_HEADING_FOUND';
    const dialogRoot = dialogHeading.closest('div')?.parentElement ?? dialogHeading.parentElement;
    return dialogRoot?.contains(active) ?? 'UNKNOWN';
  });
  console.log('FOCUS_MOVED_INTO_REJECT_MODAL_ON_OPEN:', focusInsideModal);

  const cancelBtn = page.getByRole('button', { name: /Bekor qilish/i }).first();
  const confirmBtn = page.getByRole('button', { name: 'Rad etish', exact: true }).last();
  console.log('CANCEL_BUTTON_ACCESSIBLE_NAME_OK:', await cancelBtn.count() > 0);
  console.log('CONFIRM_BUTTON_ACCESSIBLE_NAME_OK:', await confirmBtn.count() > 0);
  console.log('CONFIRM_BUTTON_DISABLED_STATE (expect true, empty reason):', await confirmBtn.isDisabled());

  // Close without mutating (Cancel), leave data untouched for other tests
  await page.keyboard.press('Escape');
});
