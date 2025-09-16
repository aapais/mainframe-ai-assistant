/**
 * Jest Configuration for FTS5 Search Tests
 */

module.exports = {
  displayName: 'FTS5 Search Tests',
  testMatch: [
    '<rootDir>/tests/search/**/*.test.js'
  ],

  // Test environment
  testEnvironment: 'node',

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/search/setup.js'
  ],

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/services/search/**/*.js',
    '!src/services/search/**/*.test.js',
    '!src/services/search/**/index.js'
  ],
  coverageDirectory: '<rootDir>/coverage/search',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/services/search/fts5-search.js': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/services/search/bm25-ranking.js': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },

  // Performance and timeout settings
  testTimeout: 30000,
  slowTestThreshold: 5,

  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // Transform configuration for ES modules
  transform: {
    '^.+\\.js$': 'babel-jest'
  },

  // Test categories
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/tests/search/datasets/'
  ],

  // Global test setup
  globalSetup: '<rootDir>/tests/search/global-setup.js',
  globalTeardown: '<rootDir>/tests/search/global-teardown.js',

  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/search/html-report',
        filename: 'test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'FTS5 Search Test Report'
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './coverage/search',
        outputName: 'junit.xml',
        suiteName: 'FTS5 Search Tests'
      }
    ]
  ],

  // Verbose output for CI
  verbose: process.env.CI === 'true',

  // Error handling
  errorOnDeprecated: true,

  // Performance monitoring
  logHeapUsage: true,
  detectOpenHandles: true,
  detectLeaks: true,

  // Custom test sequencer for performance tests
  testSequencer: '<rootDir>/tests/search/test-sequencer.js'
};