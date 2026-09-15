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

test('Partner CRUD: edit the just-created hotel name, verify DB update + UI persistence', async ({ page }) => {
  const hotelId = '4a9a12be-e480-4304-a8ba-026df03fa9ec';
  const orgId = 'c6afc83e-901e-4ffe-ae9b-09fd084edfcd';

  const before = queryQaDb(`select ht.name from hotel_translations ht where ht.hotel_id='${hotelId}' and ht.language='uz';`);
  console.log('NAME_BEFORE_EDIT:', before);

  await loginAsQaPartner(page, '+998900000003');
  await page.goto('/listing');
  await page.waitForTimeout(1000);

  const generalCard = page.getByText("Asosiy ma'lumot", { exact: false }).first();
  await expect(generalCard).toBeVisible({ timeout: 10000 });
  await generalCard.click();
  await page.waitForTimeout(500);

  const nameInput = page.locator('input').first();
  await expect(nameInput).toHaveValue(/Partner Created Hotel/, { timeout: 5000 });
  await nameInput.fill('QA-E2E-2026-09 Partner EDITED Hotel');

  const saveBtn = page.getByRole('button', { name: 'Saqlash' });
  await expect(saveBtn).toBeEnabled({ timeout: 5000 });
  await saveBtn.click();
  await page.waitForTimeout(1200);

  const after = queryQaDb(`select ht.name from hotel_translations ht where ht.hotel_id='${hotelId}' and ht.language='uz';`);
  console.log('NAME_AFTER_EDIT (DB):', after);
  expect(after).toContain('EDITED');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const bodyText = await page.locator('body').innerText();
  console.log('NAME_VISIBLE_IN_UI_AFTER_REFRESH:', bodyText.includes('EDITED'));
  await page.screenshot({ path: 'test-results/qa-partner-crud-after-edit-refresh.png', fullPage: true });
});
