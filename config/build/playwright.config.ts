import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for E2E and Visual Testing
 * Supports Electron app testing and web-based testing
 */
export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Test file patterns
  testMatch: [
    '**/*.e2e.{ts,js}',
    '**/*.visual.{ts,js}',
    '**/visual-*.{ts,js}',
    '**/*.visual-regression.{ts,js}'
  ],

  // Global timeout for each test
  timeout: 60000,

  // Expect timeout for assertions
  expect: {
    timeout: 10000,
    // Enhanced visual comparison settings
    toHaveScreenshot: {
      threshold: 0.001, // 0.1% pixel difference threshold for strict visual testing
      mode: 'image',
      animations: 'disabled',
      caret: 'hide',
      clip: undefined,
      fullPage: false,
      mask: [],
      maskColor: '#FF00FF',
      omitBackground: false,
      scale: 'device'
    }
  },

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry configuration
  retries: process.env.CI ? 2 : 0,

  // Parallel workers
  workers: process.env.CI ? 2 : 4,

  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-reports/playwright-html' }],
    ['json', { outputFile: 'test-reports/playwright-json/results.json' }],
    ['junit', { outputFile: 'test-reports/playwright-junit/results.xml' }]
  ],

  // Global test configuration
  use: {
    // Base URL for web tests (if not testing Electron)
    // baseURL: 'http://localhost:3000',

    // Capture screenshot only on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'retain-on-failure',

    // Record trace on failure
    trace: 'retain-on-failure',

    // Accept downloads
    acceptDownloads: true,

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,

    // Browser context options
    viewport: { width: 1920, height: 1080 },

    // Reduce motion for consistent screenshots
    reducedMotion: 'reduce',

    // Color scheme
    colorScheme: 'light',

    // Locale
    locale: 'en-US',

    // Timezone
    timezoneId: 'UTC'
  },

  // Test projects for different browsers and scenarios
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'cleanup'
    },

    {
      name: 'cleanup',
      testMatch: /.*\.cleanup\.ts/
    },

    // Electron app testing
    {
      name: 'electron-app',
      testMatch: ['**/electron-*.e2e.{ts,js}'],
      use: {
        // Electron-specific configuration will be handled in tests
      }
    },

    // Primary visual testing - Chrome Desktop (enhanced for consistency)
    {
      name: 'visual-chrome-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
        colorScheme: 'light',
        // Force GPU rendering for consistency
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-gpu-sandbox',
            '--use-gl=swiftshader',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
          ]
        }
      },
      testMatch: [
        '**/visual-*.{ts,js}',
        '**/*.visual.{ts,js}',
        '**/tests/visual-regression/**/*.test.{ts,js}'
      ]
    },

    {
      name: 'firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
      testMatch: ['**/cross-browser-*.{ts,js}']
    },

    {
      name: 'webkit-desktop',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
      testMatch: ['**/cross-browser-*.{ts,js}']
    },

    // Mobile browsers for responsive testing
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5']
      },
      testMatch: ['**/responsive-*.{ts,js}']
    },

    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12']
      },
      testMatch: ['**/responsive-*.{ts,js}']
    },

    // Tablet testing
    {
      name: 'tablet-chrome',
      use: {
        ...devices['iPad Pro']
      },
      testMatch: ['**/responsive-*.{ts,js}']
    },

    // Dark mode testing
    {
      name: 'dark-mode',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark'
      },
      testMatch: ['**/theme-*.{ts,js}']
    },

    // High contrast testing
    {
      name: 'high-contrast',
      use: {
        ...devices['Desktop Chrome'],
        forcedColors: 'active'
      },
      testMatch: ['**/accessibility-*.{ts,js}']
    },

    // Performance testing with throttling
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        // Network throttling
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ]
        }
      },
      testMatch: ['**/performance-*.{ts,js}']
    }
  ],

  // Web server configuration (if testing web version)
  webServer: process.env.TEST_WEB_APP ? {
    command: 'npm run dev',
    port: 3000,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI
  } : undefined,

  // Output directories
  outputDir: './test-results/playwright',

  // Global setup and teardown
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts'
});