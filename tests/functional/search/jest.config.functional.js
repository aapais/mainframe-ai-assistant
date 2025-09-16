/**
 * Jest Configuration for Search Functional Tests
 * Comprehensive testing configuration for functional validation
 */

module.exports = {
  displayName: 'Search Functional Tests',
  testMatch: [
    '<rootDir>/tests/functional/search/**/*.test.ts',
    '<rootDir>/tests/functional/search/**/*.test.js'
  ],

  // Test environment
  testEnvironment: 'node',

  // TypeScript support
  preset: 'ts-jest',

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/functional/search/setup.ts'
  ],

  // Global setup and teardown
  globalSetup: '<rootDir>/tests/functional/search/global-setup.ts',
  globalTeardown: '<rootDir>/tests/functional/search/global-teardown.ts',

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/services/search/**/*.ts',
    'src/services/search/**/*.js',
    'src/services/SearchService.ts',
    'src/services/KnowledgeBaseService.ts',
    '!src/services/search/**/*.test.ts',
    '!src/services/search/**/*.test.js',
    '!src/services/search/**/index.ts',
    '!src/services/search/**/*.d.ts'
  ],
  coverageDirectory: '<rootDir>/coverage/functional',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary',
    'cobertura'
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/services/search/AdvancedSearchEngine.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/services/search/QueryParser.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/services/search/RankingEngine.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/services/search/SearchCache.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },

  // Performance and timeout settings
  testTimeout: 60000, // 60 seconds for comprehensive tests
  slowTestThreshold: 10, // 10 seconds warning threshold

  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@fixtures/(.*)$': '<rootDir>/tests/functional/search/fixtures/$1',
    '^@helpers/(.*)$': '<rootDir>/tests/functional/search/helpers/$1'
  },

  // Transform configuration
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.test.json',
      isolatedModules: true
    }],
    '^.+\\.js$': 'babel-jest'
  },

  // Test file patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/tests/functional/search/fixtures/',
    '<rootDir>/tests/functional/search/reports/'
  ],

  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/functional/html-report',
        filename: 'functional-test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Search Functional Test Report',
        logoImgPath: './assets/logo.png',
        darkTheme: false
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './coverage/functional',
        outputName: 'functional-junit.xml',
        suiteName: 'Search Functional Tests',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ],
    [
      './tests/functional/search/reporters/CustomFunctionalReporter.js',
      {
        outputFile: './coverage/functional/custom-report.json',
        includeMetrics: true,
        includePerformance: true
      }
    ]
  ],

  // Verbose output
  verbose: true,

  // Error handling
  errorOnDeprecated: true,
  bail: false, // Continue all tests even if some fail

  // Performance monitoring
  logHeapUsage: true,
  detectOpenHandles: true,
  detectLeaks: false, // Disabled for performance

  // Parallel execution
  maxWorkers: '50%', // Use half of available CPU cores

  // Cache configuration
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache/functional',

  // Watch mode configuration
  watchPathIgnorePatterns: [
    '<rootDir>/coverage/',
    '<rootDir>/dist/',
    '<rootDir>/node_modules/',
    '<rootDir>/tests/functional/search/reports/'
  ],

  // Custom matchers and utilities
  setupFiles: [
    '<rootDir>/tests/functional/search/jest.setup.js'
  ],

  // Test sequencing
  testSequencer: '<rootDir>/tests/functional/search/testSequencer.js',

  // Environment variables for tests
  testEnvironmentOptions: {
    url: 'http://localhost'
  },

  // Global configuration
  globals: {
    'ts-jest': {
      isolatedModules: true,
      useESM: false
    },
    FUNCTIONAL_TEST_MODE: true,
    TEST_TIMEOUT: 60000,
    ENABLE_PERFORMANCE_TESTS: true,
    ENABLE_STRESS_TESTS: false,
    LOG_LEVEL: 'warn'
  },

  // Coverage exclusions for functional tests
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/coverage/',
    '\\.d\\.ts$',
    '/src/main/',
    '/src/test-setup.ts'
  ],

  // Test categories and tagging
  runner: 'jest-runner',

  // Custom test environment for search testing
  testEnvironment: '<rootDir>/tests/functional/search/SearchTestEnvironment.js',

  // Force exit after tests complete
  forceExit: true,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Snapshot configuration
  updateSnapshot: false,

  // Custom matchers for search testing
  setupFilesAfterEnv: [
    '<rootDir>/tests/functional/search/setup.ts',
    '<rootDir>/tests/functional/search/matchers/SearchMatchers.ts'
  ]
};