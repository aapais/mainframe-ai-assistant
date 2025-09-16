/**
 * Visual Regression Testing Configuration
 *
 * Comprehensive configuration for visual regression testing across
 * all breakpoints and component states
 *
 * @version 1.0.0
 * @author Visual Consistency Specialist
 */

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/visual-regression-results.json' }],
    ['junit', { outputFile: 'test-results/visual-regression-junit.xml' }]
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  // Visual regression specific settings
  expect: {
    // Configure screenshot comparisons
    toHaveScreenshot: {
      threshold: 0.3, // Allow 30% difference
      maxDiffPixels: 1000,
      animations: 'disabled', // Disable animations for consistent screenshots
    },
    toMatchScreenshot: {
      threshold: 0.3,
      maxDiffPixels: 1000,
      animations: 'disabled',
    }
  },

  projects: [
    // Mobile devices
    {
      name: 'Mobile Portrait',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 375, height: 667 }
      },
    },
    {
      name: 'Mobile Landscape',
      use: {
        ...devices['iPhone 12 landscape'],
        viewport: { width: 667, height: 375 }
      },
    },
    {
      name: 'Mobile Large',
      use: {
        viewport: { width: 414, height: 896 }
      },
    },

    // Tablet devices
    {
      name: 'Tablet Portrait',
      use: {
        ...devices['iPad'],
        viewport: { width: 768, height: 1024 }
      },
    },
    {
      name: 'Tablet Landscape',
      use: {
        ...devices['iPad landscape'],
        viewport: { width: 1024, height: 768 }
      },
    },

    // Desktop browsers
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
    },
    {
      name: 'Desktop Firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 }
      },
    },
    {
      name: 'Desktop Safari',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 }
      },
    },

    // Large screens
    {
      name: 'Desktop Large',
      use: {
        viewport: { width: 1440, height: 900 }
      },
    },
    {
      name: 'Desktop Wide',
      use: {
        viewport: { width: 1920, height: 1080 }
      },
    },

    // Dark mode testing
    {
      name: 'Desktop Dark Mode',
      use: {
        viewport: { width: 1280, height: 720 },
        colorScheme: 'dark',
      },
    },

    // High contrast mode
    {
      name: 'Desktop High Contrast',
      use: {
        viewport: { width: 1280, height: 720 },
        forcedColors: 'active',
      },
    },

    // Reduced motion
    {
      name: 'Desktop Reduced Motion',
      use: {
        viewport: { width: 1280, height: 720 },
        reducedMotion: 'reduce',
      },
    },
  ],

  // Web server configuration
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  // Global setup and teardown
  globalSetup: require.resolve('./tests/setup/global-setup.js'),
  globalTeardown: require.resolve('./tests/setup/global-teardown.js'),
});

// Additional configuration for visual regression
const visualRegressionConfig = {
  // Screenshot configuration
  screenshots: {
    // Directory for storing baseline screenshots
    baseline: './tests/screenshots/baseline',
    // Directory for actual screenshots during test runs
    actual: './tests/screenshots/actual',
    // Directory for diff images
    diff: './tests/screenshots/diff',

    // File naming convention
    naming: {
      pattern: '{testName}--{projectName}--{platform}',
      sanitize: true
    },

    // Quality settings
    quality: 90,

    // Comparison settings
    comparison: {
      threshold: 0.3,
      includeAA: false,
      ignoreAntialiasing: true,
      ignoreColors: false
    }
  },

  // Performance thresholds
  performance: {
    // Core Web Vitals thresholds
    lcp: 2.5, // Largest Contentful Paint (seconds)
    fid: 100, // First Input Delay (milliseconds)
    cls: 0.1, // Cumulative Layout Shift

    // Additional performance metrics
    fcp: 1.8, // First Contentful Paint (seconds)
    ttfb: 0.8, // Time to First Byte (seconds)

    // Custom thresholds
    responsiveness: 100, // Max time for UI response (milliseconds)
    smoothness: 60 // Target FPS for animations
  },

  // Elements to ignore in visual comparisons
  ignore: [
    // Dynamic content selectors
    '[data-testid="current-time"]',
    '[data-testid="random-content"]',
    '.loading-spinner',
    '.live-data',

    // Third-party content
    '.advertisement',
    '.social-media-embed',
    'iframe[src*="youtube"]',
    'iframe[src*="twitter"]',

    // User-specific content
    '.user-avatar',
    '.personalized-content'
  ],

  // Mask areas (hide sensitive content)
  mask: [
    '.sensitive-data',
    '.personal-info',
    '[data-sensitive="true"]'
  ],

  // Wait conditions before taking screenshots
  waitConditions: {
    // Network idle
    networkIdle: true,

    // Custom conditions
    customSelectors: [
      '.content-loaded',
      '[data-loaded="true"]'
    ],

    // Animations complete
    animationsComplete: true,

    // Fonts loaded
    fontsLoaded: true
  },

  // Accessibility testing integration
  accessibility: {
    enabled: true,
    standards: ['wcag2a', 'wcag2aa'],
    rules: {
      // Disable flaky rules for visual regression
      'color-contrast': false, // Handled separately
      'landmark-one-main': false,
      'page-has-heading-one': false
    }
  },

  // Component-specific configurations
  components: {
    'search-interface': {
      threshold: 0.2,
      mask: ['.search-results-count'],
      ignore: ['.search-timing']
    },
    'form-field': {
      threshold: 0.1,
      states: ['default', 'focus', 'error', 'disabled']
    },
    'navigation': {
      threshold: 0.15,
      responsive: true,
      states: ['collapsed', 'expanded']
    },
    'data-table': {
      threshold: 0.25,
      ignore: ['.sort-indicators'],
      mask: ['.row-count']
    }
  },

  // Reporting configuration
  reporting: {
    // Generate HTML report
    html: {
      enabled: true,
      outputDir: './test-results/visual-regression-report',
      includePassedTests: false
    },

    // Generate JSON report
    json: {
      enabled: true,
      outputFile: './test-results/visual-regression-data.json'
    },

    // Integration with external services
    integrations: {
      // Slack notifications
      slack: {
        enabled: process.env.SLACK_WEBHOOK_URL !== undefined,
        webhook: process.env.SLACK_WEBHOOK_URL,
        channel: '#visual-regression',
        onFailure: true,
        onSuccess: false
      },

      // Email notifications
      email: {
        enabled: process.env.EMAIL_NOTIFICATIONS === 'true',
        recipients: process.env.EMAIL_RECIPIENTS?.split(',') || [],
        onFailure: true,
        onSuccess: false
      }
    }
  },

  // Parallel execution settings
  parallel: {
    maxWorkers: process.env.CI ? 2 : 4,
    shardTests: true,
    retryFailures: 2
  }
};

module.exports.visualRegressionConfig = visualRegressionConfig;