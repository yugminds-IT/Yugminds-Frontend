import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e/admin',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // specs share one QA fixture school — avoid cross-spec races
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-admin' }]],
  globalSetup: require.resolve('./e2e/admin/global-setup.ts'),
  globalTeardown: require.resolve('./e2e/admin/global-teardown.ts'),
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    cwd: path.resolve(__dirname),
  },
});
