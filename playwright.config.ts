import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for browser-based E2E testing.
 * 
 * Usage:
 *   npx playwright test           # Run all tests
 *   npx playwright test --ui      # Run with UI mode
 *   npx playwright test --debug  # Debug mode
 *   npx playwright show-report   # View HTML report
 */
export default defineConfig({
  testDir: './tests/e2e',  // Package-level tests
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile for CI coverage (skip by default)
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Note: webServer is disabled by default. This project is a library/extension.
  // For projects with a dev server, set INTEGRATION_TEST=1 or configure webServer.
  webServer: process.env.INTEGRATION_TEST ? {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  } : undefined,
});
