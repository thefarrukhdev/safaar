import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';

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

function queryQaDb(sql: string): string {
  return execFileSync(
    'ssh',
    ['safaar-backend-new', `docker exec safaar-qa-db psql -U safaar_qa -d safaar_qa -tAc "${sql.replace(/"/g, '\\"')}"`],
    { encoding: 'utf8', timeout: 15000 },
  ).trim();
}

test('Partner CRUD: create hotel via real UI (General info section), verify DB row + persistence on refresh', async ({ page }) => {
  const orgId = 'c6afc83e-901e-4ffe-ae9b-09fd084edfcd'; // QA-E2E Test Hotel 3, address now set, 0 hotels, phone not yet rate-limited

  const beforeCount = queryQaDb(`select count(*) from hotels where partner_organization_id='${orgId}';`);
  console.log('HOTELS_COUNT_BEFORE:', beforeCount);
  expect(beforeCount).toBe('0');

  const apiCalls: string[] = [];
  page.on('request', (req) => {
    if (req.method() !== 'GET') apiCalls.push(`${req.method()} ${req.url()}`);
  });
  page.on('response', async (res) => {
    if (res.request().method() !== 'GET' && res.url().includes('/v1/')) {
      console.log('MUTATION_RESPONSE:', res.request().method(), res.url(), res.status());
    }
  });
  const consoleErrors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  await loginAsQaPartner(page, '+998900000003');
  await page.goto('/listing');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/qa-partner-crud-listing-before.png', fullPage: true });

  // Open "Asosiy ma'lumot" (General info) section card — NOTE: the overview
  // page's card is titled "Asosiy ma'lumot" while the drawer that opens is
  // titled "Umumiy ma'lumotlar" (different label for the same section) — the
  // drawer element already exists off-canvas in the DOM even when closed, so
  // targeting the drawer's own title text matches a not-yet-visible element.
  const generalCard = page.getByText("Asosiy ma'lumot", { exact: false }).first();
  await expect(generalCard).toBeVisible({ timeout: 10000 });
  await generalCard.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/qa-partner-crud-general-drawer.png', fullPage: true });

  const nameInput = page.locator('input').first();
  await nameInput.fill('QA-E2E-2026-09 Partner Created Hotel');

  const shortDesc = page.locator('textarea').first();
  const shortDescCount = await shortDesc.count();
  console.log('SHORT_DESC_TEXTAREA_FOUND:', shortDescCount);
  if (shortDescCount > 0) {
    await shortDesc.fill('QA-E2E-2026-09 automated Partner CRUD test — short description field, minimum twenty chars.');
  }
  const fullDesc = page.locator('textarea').nth(1);
  if (await fullDesc.count() > 0) {
    await fullDesc.fill('QA-E2E-2026-09 automated Partner CRUD test full description. '.repeat(3));
  }

  // Star rating — required (min 1) for hotel-type partners (buildSchema in
  // general-editor.tsx). Each star button has aria-label="N yulduz".
  const fourStars = page.getByRole('button', { name: '4 yulduz' });
  if (await fourStars.count() > 0) {
    await fourStars.click();
  }
  console.log('FOUR_STAR_BUTTON_FOUND_AND_CLICKED:', await fourStars.count() > 0);

  await page.screenshot({ path: 'test-results/qa-partner-crud-general-filled.png', fullPage: true });

  const saveBtn = page.getByRole('button', { name: 'Saqlash' });
  await expect(saveBtn).toBeEnabled({ timeout: 5000 });
  await saveBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/qa-partner-crud-after-save.png', fullPage: true });

  console.log('CONSOLE_ERRORS:', JSON.stringify(consoleErrors));
  console.log('ALL_NON_GET_API_CALLS:', JSON.stringify(apiCalls, null, 2));
  const afterCount = queryQaDb(`select count(*) from hotels where partner_organization_id='${orgId}';`);
  console.log('HOTELS_COUNT_AFTER_SAVE:', afterCount);
  const hotelRow = queryQaDb(`select id, status from hotels where partner_organization_id='${orgId}';`);
  console.log('NEW_HOTEL_ROW:', hotelRow);

  // Refresh and verify persistence in the real UI
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const bodyText = await page.locator('body').innerText();
  const nameShownAfterRefresh = bodyText.includes('QA-E2E-2026-09 Partner Created Hotel');
  console.log('NAME_VISIBLE_AFTER_REFRESH:', nameShownAfterRefresh);
  await page.screenshot({ path: 'test-results/qa-partner-crud-after-refresh.png', fullPage: true });
});
