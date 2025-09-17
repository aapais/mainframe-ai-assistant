import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'test-results/responsive-html-report' }],
    ['json', { outputFile: 'test-results/responsive-results.json' }],
    ['junit', { outputFile: 'test-results/responsive-junit.xml' }],
  ],
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Mobile Projects
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Galaxy S8'],
        // Override with specific mobile viewport
        viewport: { width: 360, height: 740 },
      },
      testMatch: ['**/responsive-mobile.spec.ts', '**/responsive-visual.spec.ts'],
    },
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 },
      },
      testMatch: ['**/responsive-mobile.spec.ts'],
    },
    {
      name: 'Mobile Firefox',
      use: {
        browserName: 'firefox',
        viewport: { width: 375, height: 667 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
      testMatch: ['**/responsive-mobile.spec.ts'],
    },

    // Tablet Projects
    {
      name: 'Tablet Chrome Portrait',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 834, height: 1194 },
      },
      testMatch: ['**/responsive-tablet.spec.ts', '**/responsive-visual.spec.ts'],
    },
    {
      name: 'Tablet Chrome Landscape',
      use: {
        browserName: 'chromium',
        viewport: { width: 1194, height: 834 },
        deviceScaleFactor: 2,
        hasTouch: true,
      },
      testMatch: ['**/responsive-tablet.spec.ts'],
    },
    {
      name: 'Tablet Safari',
      use: {
        ...devices['iPad Pro landscape'],
        viewport: { width: 1366, height: 1024 },
      },
      testMatch: ['**/responsive-tablet.spec.ts'],
    },

    // Desktop Projects
    {
      name: 'Desktop Chrome Small',
      use: {
        browserName: 'chromium',
        viewport: { width: 1366, height: 768 },
      },
      testMatch: ['**/responsive-desktop.spec.ts', '**/responsive-visual.spec.ts'],
    },
    {
      name: 'Desktop Chrome Large',
      use: {
        browserName: 'chromium',
        viewport: { width: 1920, height: 1080 },
      },
      testMatch: ['**/responsive-desktop.spec.ts'],
    },
    {
      name: 'Desktop Firefox',
      use: {
        browserName: 'firefox',
        viewport: { width: 1440, height: 900 },
      },
      testMatch: ['**/responsive-desktop.spec.ts'],
    },
    {
      name: 'Desktop Safari',
      use: {
        browserName: 'webkit',
        viewport: { width: 1536, height: 864 },
      },
      testMatch: ['**/responsive-desktop.spec.ts'],
    },
    {
      name: 'Desktop Edge',
      use: {
        browserName: 'chromium',
        channel: 'msedge',
        viewport: { width: 1600, height: 900 },
      },
      testMatch: ['**/responsive-desktop.spec.ts'],
    },

    // Ultra-wide and 4K
    {
      name: 'Desktop Ultrawide',
      use: {
        browserName: 'chromium',
        viewport: { width: 2560, height: 1440 },
      },
      testMatch: ['**/responsive-desktop.spec.ts'],
    },
    {
      name: 'Desktop 4K',
      use: {
        browserName: 'chromium',
        viewport: { width: 3840, height: 2160 },
        deviceScaleFactor: 2,
      },
      testMatch: ['**/responsive-desktop.spec.ts'],
    },

    // Performance Testing
    {
      name: 'Performance Mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 667 },
        launchOptions: {
          args: ['--enable-precise-memory-info'],
        },
      },
      testMatch: ['**/responsive-metrics.spec.ts'],
    },
    {
      name: 'Performance Tablet',
      use: {
        browserName: 'chromium',
        viewport: { width: 768, height: 1024 },
        launchOptions: {
          args: ['--enable-precise-memory-info'],
        },
      },
      testMatch: ['**/responsive-metrics.spec.ts'],
    },
    {
      name: 'Performance Desktop',
      use: {
        browserName: 'chromium',
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          args: ['--enable-precise-memory-info'],
        },
      },
      testMatch: ['**/responsive-metrics.spec.ts'],
    },

    // Accessibility Testing
    {
      name: 'Accessibility Mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 667 },
        hasTouch: true,
      },
      testMatch: ['**/responsive-accessibility.spec.ts'],
    },
    {
      name: 'Accessibility Tablet',
      use: {
        browserName: 'chromium',
        viewport: { width: 1024, height: 768 },
        hasTouch: true,
      },
      testMatch: ['**/responsive-accessibility.spec.ts'],
    },
    {
      name: 'Accessibility Desktop',
      use: {
        browserName: 'chromium',
        viewport: { width: 1366, height: 768 },
      },
      testMatch: ['**/responsive-accessibility.spec.ts'],
    },

    // Visual Regression Testing
    {
      name: 'Visual Regression',
      use: {
        browserName: 'chromium',
        // Use consistent viewport for visual tests
        viewport: { width: 1280, height: 720 },
      },
      testMatch: ['**/responsive-visual.spec.ts'],
    },

    // Reduced Motion Testing
    {
      name: 'Reduced Motion',
      use: {
        browserName: 'chromium',
        viewport: { width: 1366, height: 768 },
        reducedMotion: 'reduce',
      },
      testMatch: ['**/responsive-accessibility.spec.ts'],
    },

    // High Contrast Testing
    {
      name: 'High Contrast',
      use: {
        browserName: 'chromium',
        viewport: { width: 1366, height: 768 },
        colorScheme: 'dark',
        extraHTTPHeaders: {
          'Sec-CH-Prefers-Color-Scheme': 'dark',
        },
      },
      testMatch: ['**/responsive-accessibility.spec.ts'],
    },

    // Dark Mode Testing
    {
      name: 'Dark Mode Mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 667 },
        colorScheme: 'dark',
      },
      testMatch: ['**/responsive-visual.spec.ts'],
    },
    {
      name: 'Dark Mode Desktop',
      use: {
        browserName: 'chromium',
        viewport: { width: 1920, height: 1080 },
        colorScheme: 'dark',
      },
      testMatch: ['**/responsive-visual.spec.ts'],
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Global test settings
  timeout: 60000,
  expect: {
    timeout: 10000,
    // Visual comparison threshold
    toHaveScreenshot: {
      threshold: 0.2,
      mode: 'pixel',
    },
    toMatchSnapshot: {
      threshold: 0.2,
    },
  },

  // Test output configuration
  outputDir: 'test-results/responsive-output',
  
  // Global setup and teardown
  globalSetup: require.resolve('./tests/global-setup.ts'),
  globalTeardown: require.resolve('./tests/global-teardown.ts'),
});
