import { test, expect } from '@playwright/test';
import { Client } from 'pg';

/**
 * Regression: hujjat yuklash avval `URL.createObjectURL(file)` orqali
 * soxta (blob:) URL yaratib, uni to'g'ridan-to'g'ri `/partner/documents`ga
 * yuborar edi — bu endpoint aslida `file_id` talab qiladi (`name`/`url`
 * emas), shuning uchun bu chaqiruv har doim 400 bilan muvaffaqiyatsiz
 * tugar edi. Endi: presign -> real saqlash xizmatiga PUT -> `/uploads/
 * documents`da ro'yxatga olish -> `/partner/documents`ga bog'lash.
 *
 * `DATABASE_URL` talab qiladi (mavjud dacha-regression.spec.ts bilan bir
 * xil naqsh) — shu sabab CI/local muhitda ishlaydi, real production'da
 * emas (production'da demo OTP o'chirilgan).
 */

const DOC_PHONE = '+998901112298';
const DB_URL = process.env.DATABASE_URL;

test.describe('Partner document upload regression', () => {
  test.skip(!DB_URL, 'DATABASE_URL env var required for direct DB assertions');
  let pgClient: Client;

  test.beforeAll(async () => {
    pgClient = new Client({ connectionString: DB_URL });
    await pgClient.connect();

    const check = await pgClient.query(
      'SELECT id FROM partner_organizations WHERE phone = $1',
      [DOC_PHONE],
    );

    if (check.rows.length === 0) {
      const orgId = '00000000-0000-3001-0000-000000000098';
      await pgClient.query(
        `INSERT INTO partner_organizations (id, type, legal_name, brand_name, tax_id, phone, email, city_id, address, status, default_commission_rate, approved_by, approved_at, created_at, updated_at)
         VALUES ($1, 'hotel', 'Regression Docs LLC', 'Regression Docs', 'REGRESSION-DOCS-001', $2, 'docs@regression.uz', '00000000-0000-1002-0000-000000000001', 'Toshkent, Hujjat ko''chasi 1', 'approved', 10.00, '00000000-0000-1006-0000-000000000001', NOW(), NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [orgId, DOC_PHONE],
      );
      await pgClient.query(
        `INSERT INTO partner_users (id, organization_id, email, password_hash, full_name, status, created_at, updated_at)
         VALUES ('00000000-0000-3002-0000-000000000098', $1, 'docs@regression.uz', '$argon2id$v=19$m=65536,t=3,p=4$JY830cRTn6tOBJGtMMPuDQ$eFgy85wei//6a/ITO6qS/PCetIyqYaBQLg+q7JTXvKM', 'Docs Manager', 'active', NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [orgId],
      );
    }
  });

  test.afterAll(async () => {
    await pgClient.end();
  });

  test('uploading a document persists a real, non-blob URL and survives a reload', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#phone').fill(DOC_PHONE);
    await page.getByRole('button', { name: 'SMS Kodini yuborish' }).click();

    const devCodeStrong = page.locator('text=Dasturlash rejimi kodi:').locator('..').locator('strong');
    await expect(devCodeStrong).toBeVisible({ timeout: 15_000 });
    const code = await devCodeStrong.textContent();
    await page.locator('#code').fill(code!.trim());
    await page.getByRole('button', { name: 'Kabinetga kirish' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });

    await page.goto('/settings/documents', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Hujjatlar va Verifikatsiya' })).toBeVisible();

    const pdfBytes = Buffer.from('%PDF-1.4\n%%EOF');
    await page.setInputFiles('input[type="file"]', {
      name: `regression-doc-${Date.now()}.pdf`,
      mimeType: 'application/pdf',
      buffer: pdfBytes,
    });

    await expect(page.getByText('Hujjat yuklandi va tasdiqlash uchun yuborildi')).toBeVisible({ timeout: 20_000 });

    await page.reload({ waitUntil: 'networkidle' });
    const row = page.locator('tr', { hasText: '.pdf' }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.getByText("Ko'rib chiqilmoqda")).toBeVisible();
  });
});
