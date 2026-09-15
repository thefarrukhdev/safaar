import { test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ADMIN_EMAIL = 'qa-e2e-admin@safaar.test';
const ADMIN_PASSWORD = readFileSync(
  '/tmp/claude-1000/-home-laziz-safaar/42ecd78b-2114-42ea-8d28-145ab01e69e5/scratchpad/qa_admin_password.txt',
  'utf8',
).trim();

test('inspect requests table row structure', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /kirish/i }).first().click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

  await page.goto('/partners/requests');
  await page.waitForTimeout(1000);

  const row = page.locator('tr', { hasText: 'QA-E2E Pending A' });
  const links = await row.locator('a').all();
  console.log('LINKS_IN_ROW:', links.length);
  for (const l of links) {
    console.log('  href=', await l.getAttribute('href'));
  }
  const buttons = await row.locator('button').all();
  console.log('BUTTONS_IN_ROW:', buttons.length);
  for (const b of buttons) {
    console.log('  button text=', await b.textContent(), 'aria-label=', await b.getAttribute('aria-label'));
  }
  const allClickableText = await row.innerHTML();
  console.log('ROW_HTML:', allClickableText.slice(0, 1500));
});
