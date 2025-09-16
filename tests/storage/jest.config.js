/**
 * Jest Configuration for Storage Service Tests
 * Optimized configuration for comprehensive test suite
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Root directory for tests
  rootDir: '../..',
  
  // Test match patterns
  testMatch: [
    '<rootDir>/tests/storage/**/*.test.ts',
    '<rootDir>/tests/storage/**/*.spec.ts'
  ],
  
  // Transform TypeScript files
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  
  // File extensions to consider
  moduleFileExtensions: ['ts', 'js', 'json'],
  
  // Module name mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@storage/(.*)$': '<rootDir>/src/services/storage/$1'
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/storage/setup/jest.setup.ts'
  ],
  
  // Global setup and teardown
  globalSetup: '<rootDir>/tests/storage/setup/global.setup.ts',
  globalTeardown: '<rootDir>/tests/storage/setup/global.teardown.ts',
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage/storage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],
  
  // Coverage collection patterns
  collectCoverageFrom: [
    'src/services/storage/**/*.ts',
    '!src/services/storage/**/*.d.ts',
    '!src/services/storage/**/*.test.ts',
    '!src/services/storage/**/*.spec.ts',
    '!src/services/storage/**/demo.ts',
    '!src/services/storage/**/index.ts'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/services/storage/StorageService.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/services/storage/adapters/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // Test timeouts
  testTimeout: 30000, // 30 seconds for integration tests
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Max workers for parallel execution
  maxWorkers: '50%',
  
  // Test sequencer for performance tests
  testSequencer: '<rootDir>/tests/storage/setup/testSequencer.js',
  
  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: '<rootDir>/coverage/storage/html-report',
        filename: 'storage-test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Storage Service Test Report',
        urlForTestFiles: 'file://',
        includeFailureMsg: true,
        includeSuiteFailure: true
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/coverage/storage',
        outputName: 'junit.xml',
        suiteName: 'Storage Service Tests',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ]
  ],
  
  // Mock configuration
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/node_modules/'
  ],
  
  // Test environment options
  testEnvironmentOptions: {
    // Node environment specific options
  },
  
  // Projects configuration for different test types
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: ['<rootDir>/tests/storage/unit/**/*.test.ts'],
      testTimeout: 10000,
      maxWorkers: '75%'
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/tests/storage/integration/**/*.test.ts'],
      testTimeout: 30000,
      maxWorkers: '50%',
      setupFilesAfterEnv: [
        '<rootDir>/tests/storage/setup/jest.setup.ts',
        '<rootDir>/tests/storage/setup/integration.setup.ts'
      ]
    },
    {
      displayName: 'Performance Tests',
      testMatch: ['<rootDir>/tests/storage/performance/**/*.test.ts'],
      testTimeout: 60000,
      maxWorkers: 1, // Run performance tests serially
      setupFilesAfterEnv: [
        '<rootDir>/tests/storage/setup/jest.setup.ts',
        '<rootDir>/tests/storage/setup/performance.setup.ts'
      ]
    },
    {
      displayName: 'E2E Tests',
      testMatch: ['<rootDir>/tests/storage/e2e/**/*.test.ts'],
      testTimeout: 120000, // 2 minutes for E2E tests
      maxWorkers: 1,
      setupFilesAfterEnv: [
        '<rootDir>/tests/storage/setup/jest.setup.ts',
        '<rootDir>/tests/storage/setup/e2e.setup.ts'
      ]
    }
  ],
  
  // Watch mode configuration
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // Custom watch ignore patterns
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/tests/storage/temp/'
  ]
};