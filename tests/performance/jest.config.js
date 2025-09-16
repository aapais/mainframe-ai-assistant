const baseConfig = require('../../jest.config');

module.exports = {
  ...baseConfig,
  displayName: 'Performance Tests',
  testMatch: [
    '<rootDir>/tests/performance/**/*.test.ts',
    '<rootDir>/tests/performance/**/*.test.js'
  ],
  testTimeout: 300000, // 5 minutes for performance tests
  maxWorkers: 1, // Run performance tests sequentially
  setupFilesAfterEnv: [
    '<rootDir>/tests/performance/setup.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main/preload.ts', // Exclude preload script
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**'
  ],
  coverageDirectory: '<rootDir>/coverage/performance',
  coverageReporters: ['text', 'lcov', 'html'],
  testEnvironment: 'node',
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  globalSetup: '<rootDir>/tests/performance/global-setup.ts',
  globalTeardown: '<rootDir>/tests/performance/global-teardown.ts',
  // Extended timeout for individual tests
  testTimeout: 120000,
  // Longer timeouts for specific test patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/'
  ],
  // Performance test specific configuration
  slowTestThreshold: 30, // 30 seconds
  verbose: true,
  bail: false, // Don't stop on first failure
  // Memory and resource limits
  maxConcurrency: 1,
  detectOpenHandles: true,
  forceExit: false,
  // Custom matchers for performance assertions
  setupFilesAfterEnv: [
    '<rootDir>/tests/performance/setup.ts',
    '<rootDir>/tests/performance/matchers.ts'
  ]
};