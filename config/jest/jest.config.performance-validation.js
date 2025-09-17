/**
 * Jest Configuration for Performance Validation Tests
 */

module.exports = {
  displayName: 'Performance Validation',
  testMatch: [
    '<rootDir>/tests/performance/performance-validation.test.js'
  ],
  testTimeout: 300000, // 5 minutes for comprehensive tests
  setupFilesAfterEnv: [
    '<rootDir>/tests/performance/setup/performance-test-setup.js'
  ],
  collectCoverage: false, // Performance tests don't need coverage
  verbose: true,
  
  // Performance test specific settings
  maxWorkers: 1, // Run performance tests sequentially
  detectOpenHandles: true,
  forceExit: true,
  
  // Node environment settings
  testEnvironment: 'node',
  
  // Custom reporters for performance metrics
  reporters: [
    'default',
    ['<rootDir>/tests/performance/reporters/performance-reporter.js', {
      outputFile: 'tests/performance/reports/performance-test-results.json'
    }]
  ],
  
  // Global setup and teardown
  globalSetup: '<rootDir>/tests/performance/setup/global-setup.js',
  globalTeardown: '<rootDir>/tests/performance/setup/global-teardown.js',
  
  // Memory and resource management
  workerIdleMemoryLimit: '1GB',
  
  // Transform settings
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Module paths
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Test environment variables
  testEnvironmentOptions: {
    NODE_ENV: 'test',
    PERFORMANCE_TEST: 'true'
  }
};
