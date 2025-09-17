/**
 * Jest Configuration for Cross-Platform Build Tests
 */

module.exports = {
  displayName: 'Cross-Platform Build Tests',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/build'],
  testMatch: [
    '**/tests/build/**/*.test.{js,ts}',
    '**/tests/build/**/*.spec.{js,ts}'
  ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'babel-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.build.js'],
  collectCoverageFrom: [
    'scripts/**/*.{js,ts}',
    'electron-builder-configs/**/*.json',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**'
  ],
  coverageDirectory: 'coverage/build',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  testTimeout: 60000, // 60 seconds for build tests
  verbose: true,

  // Platform-specific test configuration
  globalSetup: '<rootDir>/tests/build/setup.js',
  globalTeardown: '<rootDir>/tests/build/teardown.js',

  // Custom matchers for build testing
  setupFilesAfterEnv: ['<rootDir>/tests/build/matchers.js'],

  // Environment variables for testing
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  },

  // Module path mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@scripts/(.*)$': '<rootDir>/scripts/$1',
    '^@configs/(.*)$': '<rootDir>/electron-builder-configs/$1'
  },

  // Test result processors
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './coverage/build/html-report',
      filename: 'build-test-report.html',
      pageTitle: 'Cross-Platform Build Test Report',
      includeFailureMsg: true,
      includeSuiteFailure: true
    }],
    ['jest-junit', {
      outputDirectory: './coverage/build',
      outputName: 'build-test-results.xml',
      suiteName: 'Cross-Platform Build Tests'
    }]
  ],

  // Globals for platform detection
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json'
    },
    BUILD_PLATFORM: process.platform,
    BUILD_ARCH: process.arch,
    CI: process.env.CI === 'true'
  }
};