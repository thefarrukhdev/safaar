import { test } from '@playwright/test';

test.use({ baseURL: 'https://web-user-rho.vercel.app' });

test('PROD: PWA dict resolves per locale in SSR payload', async ({ page }) => {
  for (const [locale, expected] of [
    ['uz', "Safaar ilovasini o'rnating"],
    ['ru', 'Установите приложение Safaar'],
    ['en', 'Install Safaar app'],
  ] as const) {
    await page.goto(`/${locale}`, { waitUntil: 'networkidle', timeout: 30000 });
    const html = await page.content();
    console.log(`LOCALE=${locale} HAS_EXPECTED_STRING=${html.includes(expected)}`);
  }
});
