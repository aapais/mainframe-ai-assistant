import { defineConfig, devices } from '@playwright/test';

/**
 * E2E Playwright Configuration for Mainframe AI Assistant
 * Tests complete end-to-end workflows including authentication, authorization, and cost tracking
 */
export default defineConfig({
  testDir: './tests/integration/e2e',
  outputDir: './tests/integration/e2e/test-results',

  // Timeout configuration
  timeout: 60000,
  expect: { timeout: 15000 },

  // Global setup
  globalSetup: './tests/integration/e2e/global-setup.ts',
  globalTeardown: './tests/integration/e2e/global-teardown.ts',

  // Test configuration
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporting
  reporter: [
    ['html', { outputFolder: './tests/integration/e2e/reports/html' }],
    ['json', { outputFile: './tests/integration/e2e/reports/results.json' }],
    ['junit', { outputFile: './tests/integration/e2e/reports/junit.xml' }],
    ['allure-playwright', { outputFolder: './tests/integration/e2e/reports/allure' }]
  ],

  use: {
    // Base URL for the application
    baseURL: 'http://localhost:3000',

    // Browser context
    headless: !!process.env.CI,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
    navigationTimeout: 30000,

    // Recording
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    // Authentication state directory
    storageState: './tests/integration/e2e/auth/storage-state.json'
  },

  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },

    // Main E2E tests
    {
      name: 'e2e-workflows',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
      testMatch: [
        '**/search-workflow.e2e.ts',
        '**/admin-config.e2e.ts',
        '**/transparency-dashboard.e2e.ts',
        '**/crud-operations.e2e.ts',
        '**/budget-limits.e2e.ts',
        '**/multi-user.e2e.ts',
        '**/error-recovery.e2e.ts'
      ]
    },

    // Mobile testing
    {
      name: 'mobile',
      dependencies: ['setup'],
      use: { ...devices['Pixel 5'] },
      testMatch: '**/mobile-*.e2e.ts'
    },

    // Performance testing
    {
      name: 'performance',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
      testMatch: '**/performance-*.e2e.ts'
    }
  ],

  // Web server configuration
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});