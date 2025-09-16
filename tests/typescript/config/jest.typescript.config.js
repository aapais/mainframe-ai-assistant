/**
 * Jest configuration for TypeScript type testing
 * Specialized configuration for running TypeScript type tests
 */

const path = require('path');

module.exports = {
  // Display name for this configuration
  displayName: 'TypeScript Type Tests',

  // Test environment
  testEnvironment: 'node',

  // Root directory for tests
  rootDir: path.resolve(__dirname, '../../../'),

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/typescript/**/*.test.ts',
    '<rootDir>/tests/typescript/**/*.test.tsx',
    '<rootDir>/tests/typescript/**/*.spec.ts',
    '<rootDir>/tests/typescript/**/*.spec.tsx'
  ],

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/tests/typescript/config/tsconfig.test.json',
      useESM: true,
      isolatedModules: true
    }]
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Module name mapping
  moduleNameMapper: {
    '^@/tests/typescript/(.*)$': '<rootDir>/tests/typescript/$1',
    '^@/tests/(.*)$': '<rootDir>/tests/$1',
    '^@/src/(.*)$': '<rootDir>/src/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1'
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/typescript/config/jest.setup.ts'
  ],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage/typescript',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  collectCoverageFrom: [
    'tests/typescript/core/**/*.ts',
    'tests/typescript/utils/**/*.ts',
    'tests/typescript/patterns/**/*.ts',
    '!tests/typescript/**/*.test.ts',
    '!tests/typescript/**/*.spec.ts',
    '!tests/typescript/**/*.d.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Test timeout
  testTimeout: 10000,

  // Globals
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: {
        strict: true,
        noImplicitAny: true,
        strictNullChecks: true,
        exactOptionalPropertyTypes: true
      }
    }
  },

  // Module resolution
  resolver: 'ts-jest-resolver',

  // Verbose output
  verbose: true,

  // Error handling
  errorOnDeprecated: true,

  // Cache configuration
  cache: true,
  cacheDirectory: '<rootDir>/node_modules/.cache/jest-typescript',

  // Parallel testing
  maxWorkers: '50%',

  // Watch mode configuration
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/'
  ],

  // Test result processors
  testResultsProcessor: '<rootDir>/tests/typescript/config/test-results-processor.js',

  // Custom reporters
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: '<rootDir>/coverage/typescript/html-report',
        filename: 'typescript-test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'TypeScript Type Tests Report'
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/coverage/typescript',
        outputName: 'typescript-junit.xml',
        suiteName: 'TypeScript Type Tests'
      }
    ]
  ],

  // Preset for TypeScript
  preset: 'ts-jest/presets/default-esm',

  // Extensions to resolve
  extensionsToTreatAsEsm: ['.ts', '.tsx'],

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Test environment options
  testEnvironmentOptions: {
    // Add any Node.js environment options here
  },

  // Custom matchers
  setupFilesAfterEnv: [
    '<rootDir>/tests/typescript/config/jest.setup.ts'
  ],

  // Snapshot configuration
  snapshotSerializers: [
    'jest-serializer-html'
  ],

  // Force exit after tests complete
  forceExit: false,

  // Detect open handles
  detectOpenHandles: true,

  // Detect leaked timers
  detectLeakedTimers: true
};