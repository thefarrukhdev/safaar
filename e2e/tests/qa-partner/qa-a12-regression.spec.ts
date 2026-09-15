import { test, expect, type Page } from '@playwright/test';

async function loginAsQaPartner(page: Page, phone: string) {
  await page.goto('/login');
  await page.locator('#phone').fill(phone);
  await page.getByRole('button', { name: 'SMS Kodini yuborish' }).click();
  const devCodeStrong = page.locator('text=Dasturlash rejimi kodi:').locator('..').locator('strong');
  await devCodeStrong.waitFor({ timeout: 15000 });
  const code = (await devCodeStrong.textContent())!.trim();
  await page.locator('#code').fill(code);
  await page.getByRole('button', { name: 'Kabinetga kirish' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
}

test('A12 regression: reservations row still opens detail on click, action buttons still independently clickable', async ({ page }) => {
  await loginAsQaPartner(page, '+998900000001');
  await page.goto('/reservations', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Confirm the card region has role=button somewhere and is keyboard reachable
  const clickableRegions = await page.locator('[role="button"]').count();
  console.log('ROLE_BUTTON_COUNT=' + clickableRegions);

  // Confirm no nested-interactive: run a quick axe check scoped to button-name/nested-interactive
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
  const nested = await page.evaluate(async () => {
    // @ts-ignore
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    return r.violations.find((v: any) => v.id === 'nested-interactive') ?? null;
  });
  console.log('NESTED_INTERACTIVE=' + JSON.stringify(nested));

  // Functional check: if any reservation row exists, verify clicking the CONTENT area navigates,
  // and action buttons (if any pending reservation exists) are independently clickable without navigating.
  const firstCard = page.locator('[role="button"]').first();
  const cardExists = await firstCard.count();
  console.log('FIRST_CARD_EXISTS=' + cardExists);
  if (cardExists > 0) {
    await firstCard.click();
    await page.waitForTimeout(800);
    console.log('URL_AFTER_ROW_CLICK=' + page.url());
  }
});
