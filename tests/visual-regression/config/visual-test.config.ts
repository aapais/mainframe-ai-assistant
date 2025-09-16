/**
 * Visual Regression Testing Configuration
 * Enhanced setup for comprehensive UI testing with cross-browser support
 */

import { devices, PlaywrightTestConfig } from '@playwright/test';

export const visualTestConfig: PlaywrightTestConfig = {
  // Test directory
  testDir: '../tests',

  // Test file patterns for visual regression
  testMatch: [
    '**/*.visual.{ts,js}',
    '**/visual-*.{ts,js}',
    '**/*.visual-regression.{ts,js}'
  ],

  // Global timeout for visual tests (longer for screenshot processing)
  timeout: 120000,

  // Expect timeout for visual assertions
  expect: {
    timeout: 30000,
    // Enhanced screenshot comparison settings
    toHaveScreenshot: {
      threshold: 0.001, // 0.1% pixel difference threshold
      mode: 'image',
      animations: 'disabled',
      caret: 'hide',
      clip: undefined, // Full page by default
      fullPage: false, // Element-specific by default
      mask: [], // Areas to mask during comparison
      maskColor: '#FF00FF', // Magenta mask color
      omitBackground: false,
      scale: 'device' // Respect device pixel ratio
    }
  },

  // Retry configuration for visual tests
  retries: process.env.CI ? 3 : 1,

  // Parallel workers (reduced for visual consistency)
  workers: process.env.CI ? 1 : 2,

  // Enhanced reporter configuration for visual tests
  reporter: [
    ['list'],
    ['html', {
      outputFolder: 'test-reports/visual-regression-html',
      open: 'never'
    }],
    ['json', {
      outputFile: 'test-reports/visual-regression-json/results.json'
    }],
    ['junit', {
      outputFile: 'test-reports/visual-regression-junit/results.xml'
    }]
  ],

  // Global test configuration optimized for visual consistency
  use: {
    // Browser context options for consistent rendering
    viewport: { width: 1920, height: 1080 },

    // Disable animations for consistent screenshots
    reducedMotion: 'reduce',

    // Force color scheme for consistency
    colorScheme: 'light',

    // Locale and timezone for consistent text rendering
    locale: 'en-US',
    timezoneId: 'UTC',

    // Font settings for consistent rendering
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9'
    },

    // Screenshot settings
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true
    },

    // Video recording for debugging
    video: {
      mode: 'retain-on-failure',
      size: { width: 1920, height: 1080 }
    },

    // Trace collection for debugging
    trace: 'retain-on-failure',

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,

    // Device scale factor
    deviceScaleFactor: 1,

    // Disable JavaScript for pure visual testing (when needed)
    javaScriptEnabled: true
  },

  // Visual test projects for different scenarios
  projects: [
    // Setup project
    {
      name: 'visual-setup',
      testMatch: /.*\.visual-setup\.ts/,
      teardown: 'visual-cleanup'
    },

    // Cleanup project
    {
      name: 'visual-cleanup',
      testMatch: /.*\.visual-cleanup\.ts/
    },

    // Primary visual testing - Chrome Desktop
    {
      name: 'visual-chrome-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
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
      testMatch: ['**/visual-*.{ts,js}', '**/*.visual.{ts,js}']
    },

    // Cross-browser testing - Firefox
    {
      name: 'visual-firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
      testMatch: ['**/cross-browser-*.{ts,js}']
    },

    // Cross-browser testing - Safari/WebKit
    {
      name: 'visual-webkit-desktop',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
      testMatch: ['**/cross-browser-*.{ts,js}']
    },

    // Responsive testing - Mobile Chrome
    {
      name: 'visual-mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        // Override viewport for consistency
        viewport: { width: 393, height: 851 }
      },
      testMatch: ['**/responsive-*.{ts,js}']
    },

    // Responsive testing - Mobile Safari
    {
      name: 'visual-mobile-safari',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 }
      },
      testMatch: ['**/responsive-*.{ts,js}']
    },

    // Responsive testing - Tablet
    {
      name: 'visual-tablet',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 1366 }
      },
      testMatch: ['**/responsive-*.{ts,js}']
    },

    // Dark mode testing
    {
      name: 'visual-dark-mode',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        colorScheme: 'dark'
      },
      testMatch: ['**/theme-*.{ts,js}', '**/*.dark-mode.{ts,js}']
    },

    // High contrast testing
    {
      name: 'visual-high-contrast',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        forcedColors: 'active'
      },
      testMatch: ['**/accessibility-visual-*.{ts,js}']
    },

    // RTL (Right-to-Left) language testing
    {
      name: 'visual-rtl',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        locale: 'ar-EG' // Arabic locale for RTL testing
      },
      testMatch: ['**/rtl-*.{ts,js}']
    }
  ],

  // Output directories
  outputDir: './test-results/visual-regression',

  // Global setup and teardown
  globalSetup: './config/visual-global-setup.ts',
  globalTeardown: './config/visual-global-teardown.ts'
};

// Visual test thresholds for different types of content
export const visualThresholds = {
  // Strict threshold for UI components
  component: 0.001,

  // Relaxed threshold for text-heavy content
  text: 0.01,

  // Medium threshold for charts/graphs
  charts: 0.005,

  // Strict threshold for icons and buttons
  icons: 0.0005,

  // Medium threshold for layouts
  layout: 0.002
};

// Screen sizes for responsive testing
export const testViewports = {
  mobile: { width: 393, height: 851 },
  tablet: { width: 1024, height: 1366 },
  desktop: { width: 1920, height: 1080 },
  ultrawide: { width: 2560, height: 1440 }
};

// Component categories for organized testing
export const componentCategories = {
  forms: ['SearchBar', 'KBSearchBar', 'SimpleSearchBar', 'EnhancedKBSearchBar'],
  display: ['ResultsList', 'EntryDetail', 'MetricsDashboard'],
  navigation: ['AppLayout', 'DetailPanel', 'LayoutPanel'],
  interactive: ['Button', 'Modal', 'Dropdown', 'Tabs'],
  accessibility: ['AccessibilityChecker', 'AriaPatterns', 'AlertMessage']
};

export default visualTestConfig;