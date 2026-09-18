import { test } from '@playwright/test';

const ADMIN_URL = 'https://web-admin-phi-beige.vercel.app';
const ADMIN_EMAIL = 'admin@safaar.uz';
const ADMIN_PASSWORD = 'Admin12345!';

test.setTimeout(60_000);

test('reload/redirect loop repro: expired token — full unfiltered capture', async ({ page }) => {
  const events: string[] = [];

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      events.push(`NAV  ${Date.now()} ${frame.url()}`);
    }
  });
  page.on('response', (res) => {
    events.push(`RESP ${Date.now()} ${res.status()} ${res.request().method()} ${res.url()}`);
  });
  page.on('request', (req) => {
    events.push(`REQ  ${Date.now()} ${req.method()} ${req.url()}`);
  });

  await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Boshqaruv Paneliga Kirish' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });

  events.push(`MARK ${Date.now()} ---corrupting-token---`);
  await page.context().addCookies([
    {
      name: 'admin_token',
      value: 'expired.invalid.token',
      domain: new URL(ADMIN_URL).hostname,
      path: '/',
    },
  ]);

  await page.waitForTimeout(15_000);

  console.log('=== FULL EVENT LOG ===');
  console.log(events.join('\n'));
  console.log('=== FINAL URL ===' + page.url());
});
