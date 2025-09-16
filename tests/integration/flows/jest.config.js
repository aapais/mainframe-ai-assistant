/**
 * Jest configuration for integration flow tests
 * Optimized for comprehensive service interaction testing
 */

module.exports = {
  displayName: 'Integration Flows',
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/**/*.integration.test.ts',
    '<rootDir>/**/*.test.ts'
  ],
  
  // TypeScript support
  preset: 'ts-jest',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/../../../src/$1',
    '^@test/(.*)$': '<rootDir>/../test-utils/$1'
  },
  
  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  
  // Test timeout for complex workflows
  testTimeout: 60000, // 60 seconds
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/../../../coverage/integration-flows',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    '<rootDir>/../../../src/services/**/*.ts',
    '<rootDir>/../test-utils/**/*.ts',
    '!**/*.d.ts',
    '!**/*.test.ts',
    '!**/node_modules/**'
  ],
  
  // Performance monitoring
  maxWorkers: '50%', // Use half of available cores
  
  // Reporter configuration
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: '<rootDir>/../../../coverage/integration-flows',
      filename: 'integration-report.html',
      openReport: false,
      pageTitle: 'Integration Flow Tests',
      logoImgPath: undefined,
      hideIcon: false,
      expand: false,
      darkTheme: false
    }]
  ],
  
  // Global configuration
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/../../../tsconfig.test.json'
    }
  },
  
  // Memory management
  logHeapUsage: true,
  detectLeaks: true,
  
  // Verbose output for debugging
  verbose: true,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Test isolation
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};