/**
 * Jest Configuration for Enhanced Search Infrastructure Tests
 * Optimized for high-performance backend search testing with coverage tracking
 */

module.exports = {
  displayName: 'Enhanced Search Infrastructure',
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/services/SearchService.enhanced.test.ts',
    '<rootDir>/tests/services/SearchOptimizer.test.ts',
    '<rootDir>/tests/services/SearchMetrics.test.ts',
    '<rootDir>/tests/performance/SearchPerformance.benchmark.ts'
  ],

  // TypeScript configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      isolatedModules: true
    }]
  },

  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // Setup and teardown
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/search-test-setup.ts'
  ],

  // Coverage configuration for >90% target
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage/search-enhanced',
  collectCoverageFrom: [
    'src/services/SearchService.ts',
    'src/services/SearchOptimizer.ts',
    'src/services/SearchMetrics.ts',
    'src/caching/MultiLayerCacheManager.ts',
    '!**/*.d.ts',
    '!**/*.test.ts',
    '!**/node_modules/**'
  ],

  // Coverage thresholds (>90% requirement)
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/services/SearchService.ts': {
      branches: 92,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/services/SearchOptimizer.ts': {
      branches: 88,
      functions: 90,
      lines: 92,
      statements: 92
    },
    './src/services/SearchMetrics.ts': {
      branches: 85,
      functions: 88,
      lines: 90,
      statements: 90
    }
  },

  // Test timeout for performance tests
  testTimeout: 30000, // 30 seconds for performance benchmarks

  // Reporter configuration
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './coverage/search-enhanced',
      filename: 'test-report.html',
      expand: true
    }],
    ['jest-junit', {
      outputDirectory: './coverage/search-enhanced',
      outputName: 'junit.xml'
    }]
  ],

  // Performance and resource limits
  maxWorkers: '50%',
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache/search-enhanced',

  // Global configuration
  globals: {
    'ts-jest': {
      isolatedModules: true,
      useESM: false
    }
  },

  // Test categorization
  runner: 'jest-runner',
  testSequencer: '<rootDir>/tests/utils/performance-test-sequencer.js',

  // Error handling
  errorOnDeprecated: false,
  verbose: true,

  // Environment variables for testing
  setupFiles: ['<rootDir>/tests/setup/test-env.ts'],

  // Mock configuration
  clearMocks: true,
  restoreMocks: true,
  resetMocks: false,

  // File watching (for development)
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Performance monitoring during tests
  logHeapUsage: true,
  detectOpenHandles: true,
  detectLeaks: false, // Disabled for performance tests

  // Test result processing
  testResultsProcessor: '<rootDir>/tests/utils/performance-results-processor.js'
};