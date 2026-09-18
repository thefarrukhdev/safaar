import { test } from '@playwright/test';

const ADMIN_URL = 'https://web-admin-phi-beige.vercel.app';
const ADMIN_EMAIL = 'admin@safaar.uz';
const ADMIN_PASSWORD = 'Admin12345!';

test.setTimeout(180_000);

test('deep organic repro: fresh context, real login, raw network+redirect+cookie capture', async ({ browser }) => {
  // 2. Fresh, isolated context — no cookies, no localStorage, nothing carried over.
  const context = await browser.newContext();
  const page = await context.newPage();

  const log: string[] = [];
  const t0 = Date.now();
  const ts = () => `+${(Date.now() - t0).toString().padStart(6)}ms`;

  page.on('request', (req) => {
    const headers = req.headers();
    const hasCookie = 'cookie' in headers;
    const cookieHasToken = hasCookie && headers['cookie'].includes('admin_token');
    log.push(
      `${ts()} REQ  ${req.method()} ${req.url()} ${req.isNavigationRequest() ? '[NAV]' : ''} cookie=${hasCookie ? (cookieHasToken ? 'HAS_TOKEN' : 'PRESENT_NO_TOKEN') : 'NONE'}`,
    );
  });
  page.on('response', async (res) => {
    const req = res.request();
    const chain = req.redirectedFrom();
    const chainInfo = chain ? ` (redirectedFrom=${chain.url()})` : '';
    log.push(`${ts()} RESP ${res.status()} ${req.method()} ${res.url()}${chainInfo}`);
  });
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      log.push(`${ts()} NAV  ${frame.url()}`);
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') log.push(`${ts()} CONSOLE_ERROR ${msg.text().slice(0, 200)}`);
  });
  page.on('pageerror', (err) => {
    log.push(`${ts()} PAGEERROR ${err.message}`);
  });

  try {
    // 1+3. Fresh production URL, real login (with backoff retry — this
    // shared demo account is rate-limited 10 logins/60s and has been
    // hit hard this session).
    let loggedIn = false;
    for (let attempt = 0; attempt < 4 && !loggedIn; attempt++) {
      await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      log.push(`${ts()} MARK page-loaded-login attempt=${attempt}`);
      await page.getByPlaceholder('admin').fill(ADMIN_EMAIL);
      await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
      await page.getByRole('button', { name: 'Boshqaruv Paneliga Kirish' }).click();
      try {
        await page.waitForURL(/\/dashboard/, { timeout: 20000 });
        loggedIn = true;
      } catch {
        log.push(`${ts()} MARK login-attempt-${attempt}-failed, backing off`);
        await page.waitForTimeout(65_000);
      }
    }
    if (!loggedIn) throw new Error('could not log in after retries');
    log.push(`${ts()} MARK reached-dashboard url=${page.url()}`);

    // Let mount-time fetches/polling settle and see if anything spontaneously loops.
    await page.waitForTimeout(8_000);
    log.push(`${ts()} MARK settled-8s url=${page.url()}`);

    // Hard refresh.
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    log.push(`${ts()} MARK after-hard-refresh url=${page.url()}`);
    await page.waitForTimeout(3_000);

    // Navigate to /audit.
    await page.goto(`${ADMIN_URL}/audit`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    log.push(`${ts()} MARK reached-audit url=${page.url()}`);
    await page.waitForTimeout(3_000);

    // Navigate back to /dashboard.
    await page.goto(`${ADMIN_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    log.push(`${ts()} MARK back-to-dashboard url=${page.url()}`);
    await page.waitForTimeout(5_000);
  } catch (e) {
    log.push(`${ts()} MARK EXCEPTION ${(e as Error).message}`);
  } finally {
    console.log('=== FULL EVENT LOG ===');
    console.log(log.join('\n'));
    console.log('=== FINAL URL ===' + page.url());

    const cookies = await context.cookies();
    console.log('=== COOKIES AT END ===');
    console.log(JSON.stringify(cookies.map((c) => ({
      name: c.name,
      domain: c.domain,
      path: c.path,
      sameSite: c.sameSite,
      secure: c.secure,
      httpOnly: c.httpOnly,
      expires: c.expires,
    })), null, 2));

    await context.close();
  }
});
