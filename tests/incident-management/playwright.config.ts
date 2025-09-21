/**
 * Playwright Configuration for Incident Management E2E Tests
 * Specific configuration for end-to-end testing
 */

import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', {
      outputFolder: '../../coverage/incident-management/playwright-report',
      open: 'never'
    }],
    ['json', {
      outputFile: '../../coverage/incident-management/playwright-results.json'
    }],
    ['junit', {
      outputFile: '../../coverage/incident-management/playwright-junit.xml'
    }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',

    /* Timeout for each action */
    actionTimeout: 10000,

    /* Timeout for navigation */
    navigationTimeout: 30000,
  },

  /* Timeout for each test */
  timeout: 60000,

  /* Timeout for expect() calls */
  expect: {
    timeout: 10000
  },

  /* Configure projects for major browsers */
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

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    /* Test against branded browsers. */
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  /* Global setup and teardown */
  globalSetup: require.resolve('./e2e-setup.ts'),
  globalTeardown: require.resolve('./e2e-teardown.ts'),

  /* Test output directory */
  outputDir: '../../coverage/incident-management/test-results/',

  /* Configure test metadata */
  metadata: {
    testSuite: 'Incident Management E2E Tests',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'test',
    timestamp: new Date().toISOString()
  },

  /* Incident-specific test configuration */
  grep: [
    /incident/i,  // Only run tests with 'incident' in the name
  ],

  /* Test tags for organizing incident tests */
  testMatch: [
    '**/e2e/**/*.e2e.test.ts',
    '**/e2e/**/*.spec.ts'
  ],

  /* Configure test fixtures */
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**'
  ],
});";