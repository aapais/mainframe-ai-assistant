/**
 * Jest Configuration for KB Entry Form Tests
 * Specialized configuration for comprehensive form testing
 */

module.exports = {
  // Extend base Jest configuration
  preset: 'ts-jest',
  testEnvironment: 'jsdom',

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/src/test-setup.ts'
  ],

  // Test file patterns for forms
  testMatch: [
    '<rootDir>/implementation/frontend/**/__tests__/**/*.test.{ts,tsx}',
    '<rootDir>/implementation/frontend/**/*.test.{ts,tsx}'
  ],

  // Module name mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@implementation/(.*)$': '<rootDir>/implementation/$1',
    '^@components/(.*)$': '<rootDir>/implementation/frontend/components/$1',
    '^@hooks/(.*)$': '<rootDir>/implementation/frontend/hooks/$1',
    '^@types/(.*)$': '<rootDir>/implementation/frontend/types/$1'
  },

  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },

  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/dist-electron/',
    '/coverage/'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'implementation/frontend/**/*.{ts,tsx}',
    'implementation/frontend/hooks/**/*.{ts,tsx}',
    'implementation/frontend/components/forms/**/*.{ts,tsx}',
    '!implementation/frontend/**/*.d.ts',
    '!implementation/frontend/**/*.stories.{ts,tsx}',
    '!implementation/frontend/**/__tests__/**',
    '!implementation/frontend/**/index.{ts,tsx}'
  ],

  coverageDirectory: 'coverage/forms',

  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Higher thresholds for critical components
    'implementation/frontend/hooks/useKBEntryValidation.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'implementation/frontend/hooks/useFormAccessibility.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    'implementation/frontend/components/forms/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost'
  },

  // Global variables
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json'
    }
  },

  // Timeouts
  testTimeout: 30000, // 30 seconds for comprehensive tests

  // Verbose output for better debugging
  verbose: true,

  // Error handling
  bail: false, // Continue running tests even if some fail
  maxWorkers: '50%', // Use half of available CPU cores

  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/forms',
        filename: 'test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'KB Entry Form Tests'
      }
    ]
  ],

  // Clear mocks automatically
  clearMocks: true,
  restoreMocks: true,

  // Display individual test results
  displayName: {
    name: 'FORM-TESTS',
    color: 'blue'
  },

  // Performance monitoring
  logHeapUsage: true,
  detectLeaks: true,

  // Error handling for unhandled promises
  errorOnDeprecated: false,

  // Snapshot configuration
  snapshotSerializers: [
    'jest-serializer-html'
  ],

  // Custom matchers and utilities
  globalSetup: undefined,
  globalTeardown: undefined,

  // Watch mode configuration
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/',
    '\\.log$'
  ],

  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Accessibility testing configuration
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/src/test-setup.ts',
    'jest-axe/extend-expect'
  ]
};