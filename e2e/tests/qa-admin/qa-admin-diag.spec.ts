import { test } from '@playwright/test';

test('diagnose blank admin login page', async ({ page }) => {
  const consoleMsgs: string[] = [];
  page.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => consoleMsgs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => consoleMsgs.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));

  await page.goto('/login', { waitUntil: 'networkidle', timeout: 20000 }).catch((e) => consoleMsgs.push(`[goto-error] ${e.message}`));
  await page.waitForTimeout(2000);

  const bodyHTML = await page.evaluate(() => document.body.innerHTML.slice(0, 500));
  console.log('BODY_HTML_SNIPPET:', bodyHTML);
  console.log('CONSOLE_MESSAGES:', JSON.stringify(consoleMsgs, null, 2));
});
