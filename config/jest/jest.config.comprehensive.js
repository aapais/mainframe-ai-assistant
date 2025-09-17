/**
 * Comprehensive Jest Configuration for Intelligent Search System
 * Supports unit, integration, E2E, and performance testing with high coverage
 */

module.exports = {
  // Test environment configuration
  preset: 'ts-jest',
  testEnvironment: 'jsdom',

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/test-setup.ts',
    '<rootDir>/tests/setup/search-test-setup.ts',
    '<rootDir>/tests/setup/performance-setup.ts'
  ],

  // Test matching patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}',
    '<rootDir>/tests/**/*.{test,spec}.{ts,tsx}'
  ],

  // Test path ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/dist-electron/',
    '/coverage/',
    '/.next/',
    '/build/'
  ],

  // Coverage configuration for comprehensive testing
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/main/**/*.ts', // Exclude Electron main process
    '!src/types/**/*.ts',
    '!src/**/*.config.{ts,js}',
    '!src/**/*.benchmark.{ts,js}'
  ],

  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json',
    'json-summary',
    'cobertura',
    'clover'
  ],

  coverageDirectory: 'coverage',

  // High coverage thresholds for production quality
  coverageThreshold: {
    global: {
      branches: 92,
      functions: 95,
      lines: 95,
      statements: 95
    },
    // Critical search components must have higher coverage
    'src/services/search/': {
      branches: 95,
      functions: 98,
      lines: 98,
      statements: 98
    },
    'src/database/': {
      branches: 90,
      functions: 92,
      lines: 92,
      statements: 92
    },
    'src/renderer/components/search/': {
      branches: 88,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },

  // Module name mapping for path resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@mocks/(.*)$': '<rootDir>/tests/__mocks__/$1',
    '^@fixtures/(.*)$': '<rootDir>/tests/fixtures/$1',
    '^@helpers/(.*)$': '<rootDir>/tests/helpers/$1'
  },

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      isolatedModules: true
    }],
    '^.+\\.(js|jsx)$': 'babel-jest'
  },

  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(react-dnd|dnd-core|@react-dnd|react-dnd-html5-backend)/)',
    '\\.(css|less|scss|sass)$'
  ],

  // Module file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],

  // Test timeout configuration
  testTimeout: 30000, // 30 seconds for comprehensive tests

  // Globals configuration
  globals: {
    'ts-jest': {
      isolatedModules: true,
      tsconfig: 'tsconfig.test.json'
    }
  },

  // Reporter configuration
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './coverage/html-report',
      filename: 'comprehensive-test-report.html',
      expand: true,
      hideIcon: false,
      pageTitle: 'Intelligent Search System - Test Report',
      logoImgPath: './assets/icons/test-logo.png'
    }],
    ['jest-junit', {
      outputDirectory: './coverage/junit',
      outputName: 'comprehensive-junit.xml',
      suiteName: 'Intelligent Search System Tests',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }],
    ['./tests/reporters/performance-reporter.js', {
      outputFile: './coverage/performance-report.json',
      threshold: {
        searchResponse: 1000, // 1 second max
        indexing: 5000,      // 5 seconds max
        cacheHit: 50,        // 50ms max
        memoryUsage: 512     // 512MB max
      }
    }]
  ],

  // Verbose output for comprehensive testing
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Error handling
  errorOnDeprecated: true,
  detectOpenHandles: true,
  detectLeaks: false, // Disabled for performance (enable for debugging)

  // Parallel execution
  maxWorkers: '50%', // Use half of available cores

  // Cache configuration
  cache: true,
  cacheDirectory: './node_modules/.cache/jest',

  // Watch configuration
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/'
  ],

  // Additional configuration for different test types
  projects: [
    // Unit tests
    {
      displayName: 'Unit Tests',
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.unit.{test,spec}.{ts,tsx}',
        '<rootDir>/tests/unit/**/*.{test,spec}.{ts,tsx}'
      ],
      testTimeout: 10000
    },

    // Integration tests
    {
      displayName: 'Integration Tests',
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.integration.{test,spec}.{ts,tsx}',
        '<rootDir>/tests/integration/**/*.{test,spec}.{ts,tsx}'
      ],
      testTimeout: 30000,
      setupFilesAfterEnv: ['<rootDir>/tests/setup/integration-setup.ts']
    },

    // Performance tests
    {
      displayName: 'Performance Tests',
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.performance.{test,spec}.{ts,tsx}',
        '<rootDir>/tests/performance/**/*.{test,spec}.{ts,tsx}'
      ],
      testTimeout: 120000,
      setupFilesAfterEnv: ['<rootDir>/tests/setup/performance-setup.ts']
    },

    // E2E tests
    {
      displayName: 'E2E Tests',
      testMatch: [
        '<rootDir>/tests/e2e/**/*.{test,spec}.{ts,tsx}'
      ],
      testTimeout: 60000,
      setupFilesAfterEnv: ['<rootDir>/tests/setup/e2e-setup.ts']
    }
  ]
};