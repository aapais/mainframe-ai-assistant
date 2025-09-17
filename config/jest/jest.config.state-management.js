/**
 * Jest Configuration for State Management Tests
 *
 * Specialized configuration for comprehensive state management testing:
 * - Context providers and hooks
 * - State immutability validation
 * - Performance benchmarking
 * - Memory leak detection
 * - Cross-context synchronization
 * - Persistence and hydration
 *
 * @author State Management Testing Specialist
 * @version 2.0.0
 */

const path = require('path');

module.exports = {
  displayName: 'State Management Tests',
  testEnvironment: 'jsdom',

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/state-management/**/*.test.{ts,tsx}',
    '<rootDir>/src/renderer/contexts/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/renderer/stores/**/__tests__/**/*.{ts,tsx}',
  ],

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.accessibility.js',
    '<rootDir>/tests/state-management/setup/state-management.setup.ts',
  ],

  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@renderer/(.*)$': '<rootDir>/src/renderer/$1',
    '^@main/(.*)$': '<rootDir>/src/main/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
  },

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.test.json',
      isolatedModules: true,
    }],
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-react',
        '@babel/preset-typescript',
      ],
    }],
  },

  // File extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/renderer/contexts/**/*.{ts,tsx}',
    'src/renderer/stores/**/*.{ts,tsx}',
    'src/renderer/hooks/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/node_modules/**',
  ],

  coverageDirectory: '<rootDir>/coverage/state-management',

  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary',
    'clover',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/renderer/contexts/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/renderer/stores/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },

  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
  },

  // Global test configuration
  globals: {
    'ts-jest': {
      isolatedModules: true,
      useESM: false,
    },
  },

  // Module directories
  moduleDirectories: ['node_modules', '<rootDir>/src'],

  // Test timeout
  testTimeout: 30000,

  // Memory and performance settings
  maxWorkers: '50%',

  // Verbose output for debugging
  verbose: true,

  // Error handling
  errorOnDeprecated: true,

  // Test result processor
  testResultsProcessor: '<rootDir>/tests/state-management/processors/results-processor.js',

  // Reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/test-results/state-management',
        outputName: 'state-management-results.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      },
    ],
    [
      'jest-html-reporters',
      {
        publicPath: '<rootDir>/test-results/state-management/html',
        filename: 'state-management-report.html',
        expand: true,
        hideIcon: false,
      },
    ],
  ],

  // Cache
  cacheDirectory: '<rootDir>/node_modules/.cache/jest/state-management',

  // Clear mocks
  clearMocks: true,
  restoreMocks: true,

  // Snapshot testing
  snapshotSerializers: [
    'enzyme-to-json/serializer',
  ],

  // Watch mode
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/',
    '<rootDir>/coverage/',
  ],

  // Test sequence
  testSequencer: '<rootDir>/tests/state-management/sequencer/state-test-sequencer.js',

  // Custom matchers
  setupFilesAfterEnv: [
    '<rootDir>/tests/state-management/matchers/state-matchers.ts',
  ],
};