import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';

/**
 * Regression: web-partner's password-login hardcoded partnerType='hotel'
 * unconditionally, regardless of the real partner_organizations.type.
 * Confirmed live in production for the restaurant and transport QA test
 * partners before this fix: both showed a hotel-style dashboard
 * ("Front Desk"/"Mehmonxona") after a real login.
 *
 * The login mechanism itself changed mid-fix (phone+password -> email+
 * password, a concurrent, unrelated change), so the same bug existed in
 * two sibling backend methods: issuePartnerTokensByPhone (phone paths)
 * and partnerLogin (email path). Both now return the real
 * organization_type/organizationType, and every web-partner login hook
 * prefers it over any hardcoded default.
 *
 * Credentials are intentionally NOT in this file. Set QA_PARTNER_CREDS_FILE
 * to a local, never-committed file of `email:password` lines (one per QA
 * test partner — emails are `owner.partner<NN>@safaar.uz`, see
 * apps/backend/prisma/qa-test-accounts-seed.sql for the account numbering)
 * before running this suite; it's skipped otherwise.
 */

const PARTNER_URL = 'https://web-partner-khaki.vercel.app';
const CREDS_FILE = process.env.QA_PARTNER_CREDS_FILE;

function getPassword(email: string): string | undefined {
  if (!CREDS_FILE || !fs.existsSync(CREDS_FILE)) return undefined;
  const lines = fs.readFileSync(CREDS_FILE, 'utf-8').split('\n');
  for (const line of lines) {
    const [e, pass] = line.split(':');
    if (e?.trim() === email) return pass?.trim();
  }
  return undefined;
}

async function loginAndGetPartnerType(page: Page, email: string, password: string) {
  await page.goto(`${PARTNER_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const emailField = page.locator('#email');
  await emailField.click();
  await emailField.pressSequentially(email, { delay: 15 });
  await page.locator('#password').pressSequentially(password, { delay: 15 });
  await page.getByRole('button', { name: 'Tizimga kirish' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 });

  const authStoreRaw = await page.evaluate(() => localStorage.getItem('uzbron-partner-auth'));
  const authStore = authStoreRaw ? JSON.parse(authStoreRaw) : null;
  return authStore?.state?.user?.partnerType as string | undefined;
}

for (const account of [
  { email: 'owner.partner01@safaar.uz', expectedType: 'hotel', label: 'partner01 (hotel)' },
  { email: 'owner.partner15@safaar.uz', expectedType: 'restaurant', label: 'partner15 (restaurant)' },
  { email: 'owner.partner16@safaar.uz', expectedType: 'bus', label: 'partner16 (transport)' },
] as const) {
  test(`${account.label} — email+password login resolves the real organization type, not a hotel default`, async ({ page }) => {
    test.setTimeout(60_000);
    const password = getPassword(account.email);
    test.skip(!password, 'QA_PARTNER_CREDS_FILE not set or email not found — see file header');

    const partnerType = await loginAndGetPartnerType(page, account.email, password!);
    console.log(`${account.label} partnerType=${partnerType}`);
    expect(partnerType).toBe(account.expectedType);
  });
}
