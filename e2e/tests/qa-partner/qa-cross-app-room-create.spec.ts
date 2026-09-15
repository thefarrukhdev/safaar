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

const ROOM_NAME = 'QA CrossApp Room 20260906';

test('CROSS-APP MATRIX: partner creates a new room type via real UI form', async ({ page }) => {
  await loginAsQaPartner(page, '+998900000001');
  await page.goto('/rooms', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: "Yangi xona qo'shish" }).click();
  await page.waitForTimeout(300);

  await page.getByPlaceholder('Standart, Lyuks...').fill(ROOM_NAME);
  await page.getByPlaceholder('400000').fill('650000');

  // find and click submit button inside the dialog (likely at the bottom, may need scroll)
  const dialog = page.locator('text=Yangi xona qo\'shish').locator('../..');
  const submitCandidates = await page.getByRole('button', { name: /qo'sh|saqla|yarat|submit|add/i }).all();
  const names = await Promise.all(submitCandidates.map(b => b.textContent()));
  console.log('SUBMIT_CANDIDATES=' + JSON.stringify(names));
  // click the last one that isn't the "Yangi xona qo'shish" trigger itself (that one is now hidden behind modal)
  const submit = page.getByRole('button', { name: /^(Qo'shish|Saqlash|Yaratish)$/i }).last();
  await submit.scrollIntoViewIfNeeded().catch(() => {});
  await submit.click({ timeout: 5000 }).catch(async (e) => {
    console.log('DIRECT_CLICK_FAILED: ' + e.message);
  });
  await page.waitForTimeout(1500);
  console.log('URL_AFTER_SUBMIT=' + page.url());
  const stillOpen = await page.locator('text=Yangi xona qo\'shish').isVisible().catch(() => false);
  console.log('MODAL_STILL_OPEN=' + stillOpen);
  await page.screenshot({ path: '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/room-form-after-submit.png', fullPage: true });
});
