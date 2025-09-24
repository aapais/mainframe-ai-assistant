/**
 * Comprehensive Jest Configuration for AI Incident Resolution System
 * Covering unit, integration, performance, security, compliance, and AI testing
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Root directories for tests
  roots: [
    '<rootDir>/tests'
  ],

  // Test patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  // Module paths
  moduleDirectories: ['node_modules', 'tests'],

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/jest.setup.js'
  ],

  // Global setup and teardown
  globalSetup: '<rootDir>/tests/global.setup.js',
  globalTeardown: '<rootDir>/tests/global.teardown.js',

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'scripts/**/*.py',
    '**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/dist/**',
    '!jest.config.js',
    '!**/*.config.js',
    '!**/*.setup.js'
  ],

  coverageDirectory: 'tests/coverage',

  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json',
    'cobertura' // For CI/CD integration
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Stricter thresholds for critical components
    './tests/security/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './tests/compliance/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './tests/ai/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  // Test timeout
  testTimeout: 30000, // 30 seconds for complex tests

  // Reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'tests/reports',
        outputName: 'junit.xml',
        ancestorSeparator: ' › ',
        uniqueOutputName: 'false',
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}'
      }
    ],
    [
      'jest-html-reporters',
      {
        publicPath: 'tests/reports',
        filename: 'test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'AI Incident Resolution System - Test Report'
      }
    ]
  ],

  // Verbose output
  verbose: true,

  // Transform files
  transform: {
    '^.+\\.js$': 'babel-jest'
  },

  // Module name mapping for absolute imports
  moduleNameMapper: {
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@unit/(.*)$': '<rootDir>/tests/unit/$1',
    '^@integration/(.*)$': '<rootDir>/tests/integration/$1',
    '^@performance/(.*)$': '<rootDir>/tests/performance/$1',
    '^@security/(.*)$': '<rootDir>/tests/security/$1',
    '^@compliance/(.*)$': '<rootDir>/tests/compliance/$1',
    '^@ai/(.*)$': '<rootDir>/tests/ai/$1'
  },

  // Test projects for different test types
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/unit/jest.setup.js']
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/integration/jest.setup.js'],
      testTimeout: 60000 // Longer timeout for integration tests
    },
    {
      displayName: 'Performance Tests',
      testMatch: ['<rootDir>/tests/performance/**/*.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/performance/jest.setup.js'],
      testTimeout: 120000, // 2 minutes for performance tests
      maxWorkers: 1 // Run performance tests sequentially
    },
    {
      displayName: 'Security Tests',
      testMatch: ['<rootDir>/tests/security/**/*.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/security/jest.setup.js'],
      testTimeout: 45000
    },
    {
      displayName: 'Compliance Tests',
      testMatch: ['<rootDir>/tests/compliance/**/*.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/compliance/jest.setup.js'],
      testTimeout: 60000
    },
    {
      displayName: 'AI/ML Tests',
      testMatch: ['<rootDir>/tests/ai/**/*.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/ai/jest.setup.js'],
      testTimeout: 90000 // Longer timeout for AI model tests
    }
  ],

  // Custom matchers and utilities
  setupFiles: [
    '<rootDir>/tests/custom-matchers.js'
  ],

  // Watch mode configuration
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Notification settings for watch mode
  notify: true,
  notifyMode: 'failure-change',

  // Error handling
  errorOnDeprecated: true,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Force exit after tests
  forceExit: true,

  // Handle unhandled promise rejections
  unhandledPromiseRejectionMode: 'strict',

  // Maximum worker configuration
  maxWorkers: '50%',

  // Cache configuration
  cache: true,
  cacheDirectory: '<rootDir>/tests/.jest-cache',

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/build/'
  ],

  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(some-es-module)/)'
  ],

  // Mock configuration
  mockPathIgnorePatterns: [
    '/node_modules/'
  ],

  // Bail configuration for CI
  bail: process.env.CI ? 1 : 0,

  // Silent mode for CI
  silent: process.env.CI === 'true',

  // Custom test result processor
  testResultsProcessor: '<rootDir>/tests/test-results-processor.js'
};