import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for CreateIncidentModal Tests
 * Optimized for comprehensive UI/UX and accessibility testing
 */

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/incident-modal.test.ts'],

  // Test execution settings
  timeout: 60000, // 60 seconds per test
  expect: {
    timeout: 10000 // 10 seconds for assertions
  },

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,

  // Reporter configuration
  reporter: [
    ['html', {
      outputFolder: 'tests/playwright/reports/incident-modal',
      open: 'never'
    }],
    ['json', {
      outputFile: 'tests/playwright/results/incident-modal-results.json'
    }],
    ['junit', {
      outputFile: 'tests/playwright/results/incident-modal-junit.xml'
    }],
    ['list'],
    // Custom reporter for accessibility results
    ['./tests/e2e/reporters/accessibility-reporter.ts']
  ],

  // Global test settings
  use: {
    // Base URL for the application
    baseURL: process.env.BASE_URL || 'http://localhost:5173',

    // Browser settings
    headless: process.env.CI ? true : false,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,

    // Interaction settings
    actionTimeout: 15000,
    navigationTimeout: 30000,

    // Debugging and reporting
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Accessibility testing
    contextOptions: {
      // Enable better contrast for accessibility testing
      forcedColors: 'none',
      reducedMotion: 'reduce'
    },

    // Locale settings for Portuguese testing
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',

    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
    }
  },

  // Test projects for different scenarios
  projects: [
    // Standard desktop testing
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      }
    },

    // Large screen testing
    {
      name: 'chromium-large',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      }
    },

    // Tablet testing
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 768 }
      }
    },

    // Mobile testing
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 }
      }
    },

    // Accessibility testing with Firefox
    {
      name: 'firefox-accessibility',
      use: {
        ...devices['Desktop Firefox'],
        contextOptions: {
          reducedMotion: 'reduce',
          forcedColors: 'active'
        }
      }
    },

    // High contrast testing
    {
      name: 'high-contrast',
      use: {
        ...devices['Desktop Chrome'],
        contextOptions: {
          forcedColors: 'active'
        }
      }
    },

    // Performance testing
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        // Throttle network for performance testing
        launchOptions: {
          args: ['--enable-features=NetworkServiceLogging']
        }
      }
    }
  ],

  // Web server configuration
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NODE_ENV: 'test',
      REACT_APP_API_URL: 'http://localhost:3001/api',
      VITE_API_URL: 'http://localhost:3001/api'
    }
  },

  // Global setup and teardown
  globalSetup: './tests/e2e/setup/global-setup.ts',
  globalTeardown: './tests/e2e/setup/global-teardown.ts',

  // Test output directories
  outputDir: './tests/playwright/test-results/incident-modal',

  // Metadata for reporting
  metadata: {
    testType: 'E2E UI/UX Testing',
    component: 'CreateIncidentModal',
    framework: 'React + TypeScript',
    language: 'Portuguese (pt-BR)',
    accessibility: 'WCAG 2.1 AA',
    browsers: ['Chromium', 'Firefox'],
    devices: ['Desktop', 'Tablet', 'Mobile']
  }
});