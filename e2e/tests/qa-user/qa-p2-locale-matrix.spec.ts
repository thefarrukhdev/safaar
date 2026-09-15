import { test, expect, type Page } from '@playwright/test';

async function switchLocaleTo(page: Page, targetLabel: RegExp) {
  await page.getByRole('button', { name: 'Tilni tanlash' }).click();
  await page.getByRole('option', { name: targetLabel }).click();
}

const cases: { from: string; to: RegExp; toCode: string }[] = [
  { from: '/uz/hotels?city=samarkand&stars=3', to: /RU|Русский/i, toCode: 'ru' },
  { from: '/ru/hotels?city=samarkand&stars=3', to: /UZ|O'zbek|Ozbek/i, toCode: 'uz' },
  { from: '/uz/hotels?city=samarkand&stars=3', to: /EN|English/i, toCode: 'en' },
  { from: '/en/hotels?city=samarkand&stars=3', to: /UZ|O'zbek|Ozbek/i, toCode: 'uz' },
];

for (const c of cases) {
  test(`P2-4 locale regression: ${c.from} -> ${c.toCode}`, async ({ page }) => {
    await page.goto(c.from, { waitUntil: 'networkidle' });
    const beforeUrl = page.url();
    await switchLocaleTo(page, c.to);
    await page.waitForURL((url) => url.pathname.startsWith(`/${c.toCode}`), { timeout: 10000 });
    const afterUrl = page.url();
    console.log(`CASE=${c.from}->${c.toCode} BEFORE=${beforeUrl} AFTER=${afterUrl} QS_PRESERVED=${afterUrl.includes('city=samarkand') && afterUrl.includes('stars=3')}`);
  });
}
