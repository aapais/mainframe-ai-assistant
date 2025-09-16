/**
 * Jest Configuration for UI Integration Tests
 * Specialized configuration for MVP1 v8 transparency features testing
 */

module.exports = {
  displayName: 'UI Integration Tests',
  testEnvironment: 'jsdom',

  // Test patterns
  testMatch: [
    '<rootDir>/tests/integration/ui/**/*.test.{ts,tsx}',
  ],

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/utils/jest.setup.ui-integration.js',
  ],

  // Module name mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@mocks/(.*)$': '<rootDir>/tests/__mocks__/$1',
  },

  // Transform patterns
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
    }],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  // Handle static assets
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@mocks/(.*)$': '<rootDir>/tests/__mocks__/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/__mocks__/styleMock.js',
    '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/tests/__mocks__/fileMock.js',
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/renderer/components/**/*.{ts,tsx}',
    'src/renderer/components/dialogs/**/*.{ts,tsx}',
    'src/renderer/components/dashboard/**/*.{ts,tsx}',
    'src/renderer/components/settings/**/*.{ts,tsx}',
    'src/renderer/components/KB/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/__tests__/**',
  ],

  coverageDirectory: '<rootDir>/coverage/ui-integration',

  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json-summary',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    },
    './src/renderer/components/dialogs/': {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
    },
    './src/renderer/components/dashboard/': {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
    },
  },

  // Test timeout
  testTimeout: 10000,

  // Globals
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },

  // Module resolution (using default resolver)
  // resolver: undefined,

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/temp/',
  ],

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Verbose output
  verbose: true,

  // Error handling
  errorOnDeprecated: true,

  // Performance monitoring
  logHeapUsage: true,

  // Watch mode configuration
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
  ],

  // Reporters
  reporters: [
    'default',
  ],

  // Custom environment variables
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
    userAgent: 'jest-environment-jsdom',
  },

  // Max worker configuration
  maxWorkers: '50%',

  // Cache configuration
  cacheDirectory: '<rootDir>/node_modules/.cache/jest-ui-integration',
};