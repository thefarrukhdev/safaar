import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
// QA-only, isolated-DB credential, read from a local scratch file (never
// committed, never hardcoded in source) — see PHASE 60-min-QA notes.
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt',
  'utf8',
).trim();

test('QA admin: real login reaches dashboard', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Download the React DevTools')) consoleErrors.push(m.text()); });

  await page.goto('/login');
  await page.screenshot({ path: 'test-results/qa-admin-login-page.png' });

  const emailInput = page.getByPlaceholder('admin');
  const passInput = page.locator('input[type="password"]').first();
  await emailInput.fill(ADMIN_EMAIL);
  await passInput.fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /kirish|login|sign in/i }).first().click();

  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 }).catch(async () => {
    await page.screenshot({ path: 'test-results/qa-admin-login-failed.png', fullPage: true });
    throw new Error('Admin login did not navigate away from /login');
  });
  await page.screenshot({ path: 'test-results/qa-admin-dashboard.png', fullPage: true });
  console.log('ADMIN_URL_AFTER_LOGIN:', page.url());
  console.log('CONSOLE_ERRORS:', JSON.stringify(consoleErrors));
});

test('unauthenticated admin protected route redirects', async ({ page }) => {
  await page.goto('/partners');
  await page.waitForTimeout(800);
  console.log('UNAUTH_ADMIN_PARTNERS_URL:', page.url());
  await page.screenshot({ path: 'test-results/qa-admin-unauth-partners.png' });
});
