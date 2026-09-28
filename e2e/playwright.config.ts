import { defineConfig, devices } from '@playwright/test';

const CHROME_PATH =
  process.env.CHROME_EXECUTABLE_PATH || '/home/laziz/.nix-profile/bin/google-chrome-stable';

// Sukut bo'yicha HAQIQIY deploy qilingan production URL'lar — local mock
// emas. Kerak bo'lsa E2E_*_URL orqali local dev serverlarga almashtirish
// mumkin (masalan `E2E_USER_URL=http://localhost:3000 pnpm playwright test`).
const USER_URL = process.env.E2E_USER_URL || 'https://web-user-rho.vercel.app';
const PARTNER_URL = process.env.E2E_PARTNER_URL || 'https://web-partner-khaki.vercel.app';
const ADMIN_URL = process.env.E2E_ADMIN_URL || 'https://web-admin-phi-beige.vercel.app';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      executablePath: CHROME_PATH,
    },
  },
  projects: [
    {
      name: 'web-user',
      testDir: './tests/user',
      use: { ...devices['Desktop Chrome'], baseURL: USER_URL },
    },
    {
      name: 'web-partner',
      testDir: './tests/partner',
      use: { ...devices['Desktop Chrome'], baseURL: PARTNER_URL },
    },
    {
      name: 'web-admin',
      testDir: './tests/admin',
      use: { ...devices['Desktop Chrome'], baseURL: ADMIN_URL },
    },
  ],
});
