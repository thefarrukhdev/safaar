import { test, expect } from '@playwright/test';

/**
 * PRODUCTION smoke after the P3 (Modal Escape stacking) deploy.
 * Unauthenticated only — this session has no real production admin
 * credentials and must not obtain/guess any. Confirms the new deployment
 * serves correctly and the login page itself is unaffected by the Modal.tsx
 * change (login page doesn't use Modal, but this confirms no bundling
 * regression either way).
 */
test('production login page loads on the new P3 deployment, no console errors, no 5xx', async ({ page }) => {
  const consoleErrors: string[] = [];
  const http5xx: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('React DevTools')) consoleErrors.push(m.text());
  });
  page.on('response', (res) => {
    if (res.status() >= 500) http5xx.push(`${res.status()} ${res.url()}`);
  });

  await page.goto('https://web-admin-phi-beige.vercel.app/login', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);

  console.log('URL:', page.url());
  console.log('CONSOLE_ERRORS:', JSON.stringify(consoleErrors));
  console.log('HTTP_5XX:', JSON.stringify(http5xx));
  await page.screenshot({ path: 'test-results/prod-p3-login-smoke.png', fullPage: true });

  const userField = page.getByPlaceholder('admin');
  await expect(userField).toBeVisible({ timeout: 10000 });
  expect(consoleErrors).toEqual([]);
  expect(http5xx).toEqual([]);
});

test('production dashboard/partners-requests redirect unauthenticated users (no crash)', async ({ page }) => {
  const http5xx: string[] = [];
  page.on('response', (res) => {
    if (res.status() >= 500) http5xx.push(`${res.status()} ${res.url()}`);
  });
  for (const path of ['/dashboard', '/partners/requests']) {
    await page.goto(`https://web-admin-phi-beige.vercel.app${path}`, { waitUntil: 'networkidle', timeout: 20000 });
    console.log(`URL_AFTER_VISITING_${path}:`, page.url());
  }
  console.log('HTTP_5XX:', JSON.stringify(http5xx));
  expect(http5xx).toEqual([]);
});
