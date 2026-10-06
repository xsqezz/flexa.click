import { defineConfig, devices } from '@playwright/test'

const pagesOnly = process.env.PLAYWRIGHT_PAGES_ONLY === '1'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 12_000,
    timezoneId: 'Europe/Warsaw',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1050 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } },
  ],
  webServer: pagesOnly ? [{
    command: 'npm run preview:site',
    url: 'http://127.0.0.1:4175',
    env: { PORT: '4175' },
    reuseExistingServer: false,
    timeout: 45_000,
  }] : [
    {
      command: 'npm run preview --workspace app -- --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 45_000,
    },
    {
      command: 'npm run preview:site',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: false,
      timeout: 45_000,
    },
    {
      command: 'npm run dev --workspace app -- --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      timeout: 45_000,
      env: {
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_flexa_test_only',
        VITE_PRIVACY_OPERATOR: 'Testowy administrator',
        VITE_PRIVACY_CONTACT: 'privacy@example.invalid',
      },
    },
  ],
})
