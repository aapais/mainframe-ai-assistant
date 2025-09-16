/**
 * Jest Configuration for KnowledgeDB Integration Tests
 * 
 * Specialized configuration for database integration testing with:
 * - Extended timeouts for database operations
 * - Memory leak detection
 * - Performance monitoring
 * - Isolated test environments
 */

module.exports = {
  // Test environment configuration
  testEnvironment: 'node',
  preset: 'ts-jest',
  
  // File patterns and locations
  testMatch: [
    '<rootDir>/tests/integration/database/**/*.test.ts'
  ],
  
  // Setup and teardown
  setupFilesAfterEnv: [
    '<rootDir>/tests/integration/database/setup.ts'
  ],
  
  // Timeout configuration for database operations
  testTimeout: 60000, // 60 seconds default
  
  // Performance and resource monitoring
  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: 1, // Run sequentially for database tests
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/database/**/*.ts',
    '!src/database/**/*.d.ts',
    '!src/database/**/*.test.ts',
    '!src/database/**/__tests__/**',
    '!src/database/migrations/**' // Exclude migration files
  ],
  
  coverageDirectory: '<rootDir>/coverage/integration',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],
  
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    },
    // Specific thresholds for core components
    'src/database/KnowledgeDB.ts': {
      branches: 80,
      functions: 85,
      lines: 90,
      statements: 90
    },
    'src/database/QueryOptimizer.ts': {
      branches: 75,
      functions: 80,
      lines: 85,
      statements: 85
    }
  },
  
  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Transform configuration
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  
  // Global configuration
  globals: {
    'ts-jest': {
      tsconfig: {
        compilerOptions: {
          // Enable decorators for testing
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          // Strict mode for better error detection
          strict: true,
          // Target ES2020 for modern features
          target: 'ES2020',
          module: 'commonjs'
        }
      }
    }
  },
  
  // Reporting configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/integration/html-report',
        filename: 'integration-test-report.html',
        openReport: false,
        expand: true,
        hideIcon: false,
        pageTitle: 'KnowledgeDB Integration Test Report',
        logoImgPath: undefined,
        includeFailureMsg: true,
        includeSuiteFailure: true
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './coverage/integration',
        outputName: 'junit.xml',
        ancestorSeparator: ' › ',
        uniqueOutputName: false,
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}'
      }
    ]
  ],
  
  // Verbose output for debugging
  verbose: false, // Set to true for detailed output
  
  // Error handling
  errorOnDeprecated: true,
  
  // Cache configuration
  cache: true,
  cacheDirectory: '<rootDir>/node_modules/.cache/jest/integration',
  
  // Test sequence control
  bail: false, // Continue running tests after failures
  
  // Mock configuration
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,
  
  // Watch mode (for development)
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/tests/temp/'
  ],
  
  // Performance monitoring
  slowTestThreshold: 10, // Log tests taking longer than 10 seconds
  
  // Environment variables for tests
  setupFiles: [
    '<rootDir>/tests/integration/database/jest.env.js'
  ]
};