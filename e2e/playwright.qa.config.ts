import { defineConfig, devices } from '@playwright/test';

const CHROME_PATH =
  process.env.CHROME_EXECUTABLE_PATH || '/home/laziz/.nix-profile/bin/google-chrome-stable';

// Isolated QA environment — local Next.js dev servers pointed at the
// isolated QA backend (safaar-qa-backend, 100.109.46.108:4400), which has
// its own DB/Redis and ENABLE_DEMO_AUTH=true. Never touches production.
const PARTNER_QA_URL = 'http://localhost:4402';
const USER_QA_URL = 'http://localhost:4401';
const ADMIN_QA_URL = 'http://localhost:4403';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/qa-results.json' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: { executablePath: CHROME_PATH },
  },
  projects: [
    { name: 'qa-partner', testDir: './tests/qa-partner', use: { ...devices['Desktop Chrome'], baseURL: PARTNER_QA_URL } },
    { name: 'qa-user', testDir: './tests/qa-user', use: { ...devices['Desktop Chrome'], baseURL: USER_QA_URL } },
    { name: 'qa-admin', testDir: './tests/qa-admin', use: { ...devices['Desktop Chrome'], baseURL: ADMIN_QA_URL } },
    // Real production smoke — read-only / safe checks only, no baseURL (each test uses full URLs).
    { name: 'prod-admin', testDir: './tests/prod-admin', use: { ...devices['Desktop Chrome'] } },
  ],
});
