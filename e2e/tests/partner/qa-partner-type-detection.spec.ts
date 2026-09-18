import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';

/**
 * Regression: web-partner's password-login (the actual primary flow on
 * the real /login page — SMS OTP is now only used for password reset)
 * hardcoded partnerType='hotel' unconditionally, regardless of the real
 * partner_organizations.type. Confirmed live in production for the
 * restaurant and transport QA test partners before this fix: both showed
 * a hotel-style dashboard ("Front Desk"/"Mehmonxona") after a real login.
 *
 * Fix: issuePartnerTokensByPhone (auth.service.ts) now returns the real
 * organization_type/organizationType, and every web-partner login hook
 * (phone-login, OTP-verify, password-login, set-password) prefers it
 * over any hardcoded default.
 *
 * Credentials are intentionally NOT in this file. Set QA_PARTNER_CREDS_FILE
 * to a local, never-committed file of `+998...:password` lines (one per
 * QA test partner, see apps/backend/prisma/qa-test-accounts-seed.sql for
 * the phone numbers) before running this suite; it's skipped otherwise.
 */

const PARTNER_URL = 'https://web-partner-khaki.vercel.app';
const CREDS_FILE = process.env.QA_PARTNER_CREDS_FILE;

function getPassword(phone: string): string | undefined {
  if (!CREDS_FILE || !fs.existsSync(CREDS_FILE)) return undefined;
  const lines = fs.readFileSync(CREDS_FILE, 'utf-8').split('\n');
  for (const line of lines) {
    const [p, pass] = line.split(':');
    if (p?.trim() === phone) return pass?.trim();
  }
  return undefined;
}

async function loginAndGetPartnerType(page: Page, phone: string, password: string) {
  await page.goto(`${PARTNER_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const phoneField = page.locator('#phone');
  await phoneField.click();
  await phoneField.pressSequentially(phone, { delay: 15 });
  await page.locator('#password').pressSequentially(password, { delay: 15 });
  await page.getByRole('button', { name: 'Tizimga kirish' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 });

  const authStoreRaw = await page.evaluate(() => localStorage.getItem('uzbron-partner-auth'));
  const authStore = authStoreRaw ? JSON.parse(authStoreRaw) : null;
  return authStore?.state?.user?.partnerType as string | undefined;
}

test.setTimeout(60_000);

for (const account of [
  { phone: '+998900003010', expectedType: 'hotel', label: 'partner01 (hotel)' },
  { phone: '+998900003150', expectedType: 'restaurant', label: 'partner15 (restaurant)' },
  { phone: '+998900003160', expectedType: 'bus', label: 'partner16 (transport)' },
] as const) {
  test(`${account.label} — password login resolves the real organization type, not a hotel default`, async ({ page }) => {
    const password = getPassword(account.phone);
    test.skip(!password, 'QA_PARTNER_CREDS_FILE not set or phone not found — see file header');

    const partnerType = await loginAndGetPartnerType(page, account.phone, password!);
    console.log(`${account.label} partnerType=${partnerType}`);
    expect(partnerType).toBe(account.expectedType);
  });
}
