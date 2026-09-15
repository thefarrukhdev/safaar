import { test } from '@playwright/test';
const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
test('account + theme-preview contrast root cause', async ({ page }) => {
  await page.goto('/uz/account', { waitUntil: 'networkidle' });
  await page.addScriptTag({ url: AXE_CDN });
  const account = await page.evaluate(async () => {
    // @ts-ignore
    const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    const c = res.violations.find((v: any) => v.id === 'color-contrast');
    return c ? c.nodes.map((n:any)=>({html:n.html})) : null;
  });
  console.log('ACCOUNT=' + JSON.stringify(account, null, 2));

  await page.goto('/uz/theme-preview', { waitUntil: 'networkidle' });
  const theme = await page.evaluate(async () => {
    // @ts-ignore
    const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    const c = res.violations.find((v: any) => v.id === 'color-contrast');
    return c ? c.nodes.slice(0,5).map((n:any)=>({html:n.html})) : null;
  });
  console.log('THEME_PREVIEW=' + JSON.stringify(theme, null, 2));
});
