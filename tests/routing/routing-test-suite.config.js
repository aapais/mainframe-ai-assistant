/**
 * Routing Test Suite Configuration
 * Comprehensive test runner configuration for KB routing system
 */

const path = require('path');

// Jest configuration for routing tests
const jestConfig = {
  displayName: 'KB Routing Tests',
  
  // Test environment
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/helpers/jest.setup.js',
  ],
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/unit/routing/**/*.test.{ts,tsx}',
    '<rootDir>/tests/integration/routing/**/*.test.{ts,tsx}',
    '<rootDir>/tests/performance/routing/**/*.test.{ts,tsx}',
    '<rootDir>/tests/accessibility/routing/**/*.test.{ts,tsx}',
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage/routing',
  collectCoverageFrom: [
    'src/renderer/routing/**/*.{ts,tsx}',
    'src/renderer/routes/**/*.{ts,tsx}',
    'src/renderer/components/navigation/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/*.stories.{ts,tsx}',
    '!**/node_modules/**',
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    'src/renderer/routing/KBRouter.tsx': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    'src/renderer/routes/KBRoutes.tsx': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  
  // Module paths
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
  
  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/',
  ],
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(react-router|@testing-library)/)',
  ],
  
  // Test timeout
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Reset modules between tests
  resetMocks: true,
  
  // Error handling
  errorOnDeprecated: true,
};

// Playwright configuration for E2E tests
const playwrightConfig = {
  testDir: './tests/e2e/routing',
  
  // Global test timeout
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  
  // Test configuration
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'coverage/playwright-report' }],
    ['json', { outputFile: 'coverage/test-results.json' }],
    ['junit', { outputFile: 'coverage/test-results.xml' }],
  ],
  
  // Browser projects
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
    // Mobile testing
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  
  // Web server configuration
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  
  use: {
    // Base URL
    baseURL: 'http://localhost:3000',
    
    // Browser context options
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Viewport
    viewport: { width: 1280, height: 720 },
  },
};

// Accessibility testing configuration
const axeConfig = {
  rules: {
    // WCAG 2.1 AA rules
    'color-contrast': { enabled: true },
    'keyboard-navigation': { enabled: true },
    'focus-management': { enabled: true },
    'aria-labels': { enabled: true },
    'heading-order': { enabled: true },
    'landmark-roles': { enabled: true },
    
    // Custom rules for routing
    'route-announcements': { enabled: true },
    'skip-links': { enabled: true },
    'focus-restoration': { enabled: true },
  },
  
  tags: [
    'wcag2a',
    'wcag2aa',
    'wcag21aa',
    'best-practice',
  ],
};

// Performance testing configuration
const performanceConfig = {
  // Performance budgets
  budgets: {
    'router-initialization': 50, // ms
    'route-navigation': 100, // ms
    'state-preservation': 20, // ms
    'url-synchronization': 10, // ms
    'memory-usage': 50 * 1024 * 1024, // 50MB
  },
  
  // Metrics to collect
  metrics: [
    'route-load-time',
    'navigation-response-time',
    'memory-usage',
    'cpu-usage',
    'bundle-size-impact',
  ],
  
  // Thresholds
  thresholds: {
    'route-load-time': { max: 100 },
    'navigation-response-time': { max: 50 },
    'memory-usage': { max: 10 * 1024 * 1024 },
    'cpu-usage': { max: 30 }, // percentage
  },
};

// Test suite orchestration
const testSuites = {
  unit: {
    description: 'Unit tests for routing components and hooks',
    command: 'jest --config=tests/routing/routing-test-suite.config.js --testPathPattern=unit',
    timeout: 30000,
    parallel: true,
  },
  
  integration: {
    description: 'Integration tests for route navigation and state management',
    command: 'jest --config=tests/routing/routing-test-suite.config.js --testPathPattern=integration',
    timeout: 60000,
    parallel: true,
  },
  
  e2e: {
    description: 'End-to-end user workflow tests',
    command: 'playwright test --config=tests/routing/routing-test-suite.config.js',
    timeout: 300000,
    parallel: false,
  },
  
  performance: {
    description: 'Performance benchmarks and regression tests',
    command: 'jest --config=tests/routing/routing-test-suite.config.js --testPathPattern=performance',
    timeout: 120000,
    parallel: false,
  },
  
  accessibility: {
    description: 'Accessibility compliance and usability tests',
    command: 'jest --config=tests/routing/routing-test-suite.config.js --testPathPattern=accessibility',
    timeout: 60000,
    parallel: true,
  },
  
  all: {
    description: 'Complete routing test suite',
    command: 'npm run test:routing:ci',
    timeout: 600000,
    parallel: false,
  },
};

// CI/CD configuration
const ciConfig = {
  // GitHub Actions workflow
  github: {
    name: 'KB Routing Tests',
    on: {
      push: { branches: ['main', 'develop'] },
      pull_request: { branches: ['main'] },
    },
    jobs: {
      'routing-tests': {
        'runs-on': 'ubuntu-latest',
        strategy: {
          matrix: {
            'node-version': ['18.x', '20.x'],
            'test-suite': ['unit', 'integration', 'accessibility'],
          },
        },
        steps: [
          'actions/checkout@v3',
          'actions/setup-node@v3',
          'npm ci',
          'npm run test:routing:${{ matrix.test-suite }}',
          'actions/upload-artifact@v3',
        ],
      },
      
      'e2e-tests': {
        'runs-on': 'ubuntu-latest',
        steps: [
          'actions/checkout@v3',
          'actions/setup-node@v3',
          'npm ci',
          'npx playwright install',
          'npm run test:routing:e2e',
        ],
      },
      
      'performance-tests': {
        'runs-on': 'ubuntu-latest',
        steps: [
          'actions/checkout@v3',
          'actions/setup-node@v3',
          'npm ci',
          'npm run test:routing:performance',
          'npm run performance:report',
        ],
      },
    },
  },
};

// Reporting configuration
const reportingConfig = {
  // Coverage reports
  coverage: {
    formats: ['html', 'json', 'lcov', 'text'],
    directory: 'coverage/routing',
    include: [
      'src/renderer/routing/**',
      'src/renderer/routes/**',
    ],
  },
  
  // Performance reports
  performance: {
    format: 'html',
    directory: 'reports/performance',
    includeGraphs: true,
    includeTrends: true,
  },
  
  // Accessibility reports
  accessibility: {
    format: 'html',
    directory: 'reports/accessibility',
    includeScreenshots: true,
    includeRecommendations: true,
  },
  
  // Consolidated report
  consolidated: {
    format: 'html',
    directory: 'reports/routing-test-suite',
    includeSummary: true,
    includeDetails: true,
  },
};

module.exports = {
  jestConfig,
  playwrightConfig,
  axeConfig,
  performanceConfig,
  testSuites,
  ciConfig,
  reportingConfig,
};