import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Enhanced Playwright Configuration for Electron App Testing
 * Supports comprehensive E2E, visual, and performance testing
 * with specialized Electron application testing capabilities
 */
export default defineConfig({
  // Test directories - supporting multiple test types
  testDir: './tests/playwright',

  // Enhanced test file patterns for comprehensive testing
  testMatch: [
    '**/*.e2e.{ts,js}',
    '**/*.electron.{ts,js}',
    '**/*.visual.{ts,js}',
    '**/visual-*.{ts,js}',
    '**/*.visual-regression.{ts,js}',
    '**/*.performance.{ts,js}',
    '**/*.accessibility.{ts,js}'
  ],

  // Global timeout for each test - increased for Electron app startup
  timeout: 120000,

  // Expect timeout for assertions - optimized for Electron app
  expect: {
    timeout: 15000,
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

  // Parallel workers - reduced for Electron stability
  workers: process.env.CI ? 1 : 2,

  // Enhanced reporter configuration for comprehensive reporting
  reporter: [
    ['list'],
    ['html', {
      outputFolder: 'test-reports/playwright-html',
      open: 'never'
    }],
    ['json', { outputFile: 'test-reports/playwright-json/results.json' }],
    ['junit', { outputFile: 'test-reports/playwright-junit/results.xml' }],
    ['./tests/playwright/reporters/electron-reporter.ts'],
    process.env.CI ? ['github'] : ['dot']
  ],

  // Global test configuration optimized for Electron testing
  use: {
    // Enhanced screenshot capture for better debugging
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true
    },

    // Enhanced video recording for Electron app testing
    video: {
      mode: 'retain-on-failure',
      size: { width: 1920, height: 1080 }
    },

    // Enhanced trace recording for detailed debugging
    trace: {
      mode: 'retain-on-failure',
      sources: true,
      screenshots: true,
      snapshots: true
    },

    // Accept downloads for file operations testing
    acceptDownloads: true,

    // Ignore HTTPS errors for local development
    ignoreHTTPSErrors: true,

    // Browser context options optimized for Electron
    viewport: { width: 1920, height: 1080 },

    // Reduce motion for consistent visual testing
    reducedMotion: 'reduce',

    // Color scheme for theme testing
    colorScheme: 'light',

    // Locale settings
    locale: 'en-US',

    // Timezone for consistent date/time testing
    timezoneId: 'UTC',

    // Additional Electron-specific settings
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9'
    }
  },

  // Test projects for different testing scenarios
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

    // Comprehensive Electron app testing project
    {
      name: 'electron-app',
      testDir: './tests/playwright/specs/electron',
      testMatch: ['**/*.electron.spec.{ts,js}'],
      use: {
        // Electron-specific configuration
        headless: false, // Always run headed for Electron
        channel: 'chrome', // Use Chrome for consistency
        launchOptions: {
          // Electron app will be launched via custom fixtures
          slowMo: process.env.CI ? 0 : 100,
          timeout: 60000
        }
      },
      dependencies: ['setup']
    },

    // Primary visual testing - Chrome Desktop (enhanced for consistency)
    {
      name: 'visual-chrome-desktop',
      testDir: './tests/playwright/specs/visual',
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
      ],
      dependencies: ['setup']
    },

    {
      name: 'firefox-desktop',
      testDir: './tests/playwright/specs/cross-browser',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
      testMatch: ['**/cross-browser-*.{ts,js}'],
      dependencies: ['setup']
    },

    {
      name: 'webkit-desktop',
      testDir: './tests/playwright/specs/cross-browser',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
      testMatch: ['**/cross-browser-*.{ts,js}'],
      dependencies: ['setup']
    },

    // Mobile browsers for responsive testing
    {
      name: 'mobile-chrome',
      testDir: './tests/playwright/specs/responsive',
      use: {
        ...devices['Pixel 5']
      },
      testMatch: ['**/responsive-*.{ts,js}'],
      dependencies: ['setup']
    },

    {
      name: 'mobile-safari',
      testDir: './tests/playwright/specs/responsive',
      use: {
        ...devices['iPhone 12']
      },
      testMatch: ['**/responsive-*.{ts,js}'],
      dependencies: ['setup']
    },

    // Tablet testing
    {
      name: 'tablet-chrome',
      testDir: './tests/playwright/specs/responsive',
      use: {
        ...devices['iPad Pro']
      },
      testMatch: ['**/responsive-*.{ts,js}'],
      dependencies: ['setup']
    },

    // Dark mode testing
    {
      name: 'dark-mode',
      testDir: './tests/playwright/specs/themes',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark'
      },
      testMatch: ['**/theme-*.{ts,js}'],
      dependencies: ['setup']
    },

    // High contrast testing
    {
      name: 'high-contrast',
      testDir: './tests/playwright/specs/accessibility',
      use: {
        ...devices['Desktop Chrome'],
        forcedColors: 'active'
      },
      testMatch: ['**/accessibility-*.{ts,js}'],
      dependencies: ['setup']
    },

    // Performance testing project
    {
      name: 'performance',
      testDir: './tests/playwright/specs/performance',
      testMatch: ['**/*.performance.spec.{ts,js}'],
      use: {
        ...devices['Desktop Chrome'],
        // Performance-specific settings
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--enable-precise-memory-info'
          ]
        }
      },
      dependencies: ['setup']
    },

    // Accessibility testing project
    {
      name: 'accessibility',
      testDir: './tests/playwright/specs/accessibility',
      testMatch: ['**/*.accessibility.spec.{ts,js}'],
      use: {
        ...devices['Desktop Chrome'],
        // A11y specific settings
        reducedMotion: 'reduce',
        forcedColors: 'none'
      },
      dependencies: ['setup']
    }
  ],

  // Enhanced web server configuration for hybrid testing
  webServer: process.env.TEST_WEB_APP ? {
    command: 'npm run dev:renderer',
    port: 3000,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test'
    }
  } : undefined,

  // Output directories
  outputDir: './test-results/playwright',

  // Enhanced global setup and teardown for Electron testing
  globalSetup: './tests/playwright/setup/global-setup.ts',
  globalTeardown: './tests/playwright/setup/global-teardown.ts',

  // Test metadata
  metadata: {
    testType: 'electron-e2e',
    version: '1.0.0',
    author: 'Mainframe Development Team'
  }
});