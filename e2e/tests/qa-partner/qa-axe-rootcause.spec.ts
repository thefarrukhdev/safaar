import { test, type Page } from '@playwright/test';

const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';

async function loginAsQaPartner(page: Page, phone: string) {
  await page.goto('/login');
  await page.locator('#phone').fill(phone);
  await page.getByRole('button', { name: 'SMS Kodini yuborish' }).click();
  const devCodeStrong = page.locator('text=Dasturlash rejimi kodi:').locator('..').locator('strong');
  await devCodeStrong.waitFor({ timeout: 15000 });
  const code = (await devCodeStrong.textContent())!.trim();
  await page.locator('#code').fill(code);
  await page.getByRole('button', { name: 'Kabinetga kirish' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
}

test('root-cause web-partner axe findings: link-name, nested-interactive, label, button-name', async ({ page }) => {
  await loginAsQaPartner(page, '+998900000001');

  for (const [route, ids] of [
    ['/', ['link-name']],
    ['/rooms', ['label']],
    ['/reservations', ['nested-interactive']],
    ['/listing', ['button-name']],
  ] as [string, string[]][]) {
    await page.goto(route, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(500);
    await page.addScriptTag({ url: AXE_CDN });
    const results = await page.evaluate(async (targetIds) => {
      // @ts-ignore
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
      const out: Record<string, any> = {};
      for (const id of targetIds) {
        const v = r.violations.find((v: any) => v.id === id);
        out[id] = v ? v.nodes.map((n: any) => ({ html: n.html, target: n.target, summary: n.failureSummary })) : null;
      }
      return out;
    }, ids);
    console.log(`ROUTE=${route} DETAIL=${JSON.stringify(results, null, 2)}`);
  }
});
