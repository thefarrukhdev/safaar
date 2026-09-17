import { test, expect } from '@playwright/test';
import { trackPageIssues } from '../helpers/console-tracker';

const ADMIN_URL = 'https://web-admin-phi-beige.vercel.app';
const ADMIN_EMAIL = 'admin@safaar.uz';
const ADMIN_PASSWORD = 'Admin12345!';

test.setTimeout(120_000);

test('normal session: login -> dashboard -> audit -> settings -> cms/destinations -> nav -> refresh -> logout -> re-login', async ({ page }) => {
  const navCounts: Record<string, number> = {};
  const reqCounts: Record<string, number> = {};
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      const u = frame.url();
      navCounts[u] = (navCounts[u] || 0) + 1;
    }
  });
  page.on('request', (req) => {
    if (req.url().startsWith(ADMIN_URL) && !req.url().includes('/_next/')) {
      reqCounts[req.url()] = (reqCounts[req.url()] || 0) + 1;
    }
  });
  const issues = trackPageIssues(page);

  // 1. /login
  await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // 2. real login
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Boshqaruv Paneliga Kirish' }).click();

  // 3. /dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  await page.waitForTimeout(3000); // let mount-time fetches/polling settle
  expect(page.url()).toContain('/dashboard');

  // 4. /audit
  await page.goto(`${ADMIN_URL}/audit`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  expect(page.url()).toContain('/audit');

  // 5. /settings
  await page.goto(`${ADMIN_URL}/settings`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  expect(page.url()).toContain('/settings');

  // 6. /cms/destinations
  await page.goto(`${ADMIN_URL}/cms/destinations`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  expect(page.url()).toContain('/cms/destinations');

  // 7. page navigation (a few more hops)
  await page.goto(`${ADMIN_URL}/users`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.goto(`${ADMIN_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // 8. browser refresh
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  expect(page.url()).toContain('/dashboard');

  // 9. logout (dedicated /logout route — deterministic, matches TopBar's own flow)
  await page.goto(`${ADMIN_URL}/logout`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForURL(/\/login/, { timeout: 15000 });
  expect(page.url()).toContain('/login');

  // 10. re-login
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Boshqaruv Paneliga Kirish' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  expect(page.url()).toContain('/dashboard');

  console.log('=== NAV COUNTS (top URLs) ===');
  const sortedNav = Object.entries(navCounts).sort((a, b) => b[1] - a[1]);
  console.log(JSON.stringify(sortedNav, null, 2));

  console.log('=== SAME-URL API REQUEST COUNTS (>2 repeats) ===');
  const repeated = Object.entries(reqCounts).filter(([, c]) => c > 2);
  console.log(JSON.stringify(repeated, null, 2));

  console.log('=== CONSOLE ERRORS ===');
  console.log(JSON.stringify(issues.consoleErrors, null, 2));
  console.log('=== UNEXPECTED RESPONSES (401/403/404/422/500) ===');
  console.log(JSON.stringify(issues.unexpectedResponses, null, 2));

  // This script deliberately visits /dashboard 4x (initial landing, mid-flow
  // return, post-refresh, post-relogin) and /login 2x (initial + post-logout)
  // — each of which can double-report via a harmless Playwright/Next.js
  // framenavigated quirk already confirmed in prod-reload-loop-repro.spec.ts
  // (one real network request, two 'framenavigated' events). Anything
  // beyond ~2x the number of DELIBERATE script visits would indicate a
  // genuine, unprompted reload/redirect loop.
  const expectedVisits: Record<string, number> = {
    [`${ADMIN_URL}/dashboard`]: 4,
    [`${ADMIN_URL}/login`]: 2,
  };
  for (const [url, count] of sortedNav) {
    const expected = expectedVisits[url] ?? 1;
    expect(count, `unexpected repeated navigation to ${url} (${count}x, expected <= ${expected * 2})`).toBeLessThanOrEqual(expected * 2);
  }
});
