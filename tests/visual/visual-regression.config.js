const { defineConfig, devices } = require('@playwright/test');

/**
 * Visual Regression Testing Configuration
 * Comprehensive visual validation for design system components
 */
module.exports = defineConfig({
  testDir: './visual',
  timeout: 30000,
  expect: {
    // Visual comparison threshold
    threshold: 0.2,
    toHaveScreenshot: {
      // Pixel difference threshold
      threshold: 0.1,
      // Maximum allowed pixel difference
      maxDiffPixelRatio: 0.05,
      // Animation handling
      animations: 'disabled',
      // Color scheme
      colorScheme: 'light'
    }
  },
  use: {
    // Base URL
    baseURL: 'http://localhost:5173',
    // Browser settings
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    // Disable animations for consistent screenshots
    reducedMotion: 'reduce'
  },
  // Test projects for different browsers and viewports
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Desktop Firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'Desktop Safari',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'Tablet',
      use: { ...devices['iPad Pro'] },
    },
    // High contrast mode testing
    {
      name: 'High Contrast',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        forcedColors: 'active'
      }
    },
    // Reduced motion testing
    {
      name: 'Reduced Motion',
      use: {
        ...devices['Desktop Chrome'],
        reducedMotion: 'reduce'
      }
    }
  ],
  // Web server configuration
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI
  },
  // Output directory for screenshots
  outputDir: './test-results/visual',
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: './test-results/visual-report' }],
    ['json', { outputFile: './test-results/visual-results.json' }],
    ['junit', { outputFile: './test-results/visual-junit.xml' }]
  ]
});
