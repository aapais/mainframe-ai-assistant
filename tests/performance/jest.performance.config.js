/**
 * Jest Configuration for Performance Tests
 * Specialized configuration for running performance benchmarks and UI tests
 */

const baseConfig = require('../../jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'Performance Tests',
  testMatch: [
    '<rootDir>/tests/performance/**/*.test.ts',
    '<rootDir>/tests/performance/**/*.test.tsx'
  ],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/tests/performance/performance-test-setup.ts'
  ],
  testTimeout: 120000, // 2 minutes for performance tests
  maxWorkers: 1, // Run performance tests sequentially to avoid interference
  clearMocks: true,
  restoreMocks: true,

  // Performance-specific configuration
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      }
    }
  },

  // Module name mapping for performance tests
  moduleNameMapping: {
    ...baseConfig.moduleNameMapping,
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@performance/(.*)$': '<rootDir>/tests/performance/$1',
    '^@test-utils/(.*)$': '<rootDir>/tests/helpers/$1',
  },

  // Collect coverage from performance-critical files
  collectCoverageFrom: [
    'src/renderer/components/**/*.{ts,tsx}',
    'src/components/**/*.{ts,tsx}',
    'src/hooks/**/*.{ts,tsx}',
    'tests/performance/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/*.stories.{ts,tsx}',
    '!**/__tests__/**',
    '!**/__mocks__/**',
  ],

  // Coverage thresholds specific to performance testing
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Per-file thresholds for critical performance components
    'src/renderer/components/common/SearchInput.tsx': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },

  // Performance test reporters
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './performance-reports/html',
        filename: 'performance-report.html',
        pageTitle: 'UI Performance Test Results',
        logoImgPath: './assets/icons/icon.png',
        hideIcon: false,
        expand: true,
        openReport: false,
        includeFailureMsg: true,
        includeSuiteFailure: true,
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './performance-reports/junit',
        outputName: 'performance-results.xml',
        suiteName: 'UI Performance Tests',
        suiteNameTemplate: '{title}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      }
    ]
  ],

  // Transform configuration for performance tests
  transform: {
    ...baseConfig.transform,
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },

  // Module file extensions
  moduleFileExtensions: [
    'js',
    'jsx',
    'ts',
    'tsx',
    'json',
  ],

  // Ignore patterns for performance tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/dist-electron/',
    '/performance-reports/',
    '/test-dashboard/',
  ],

  // Watch mode configuration
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/performance-reports/',
    '/test-dashboard/',
    '/coverage/',
  ],

  // Performance test specific environment variables
  testEnvironmentOptions: {
    jsdom: {
      resources: 'usable',
      runScripts: 'dangerously',
    },
  },

  // Slow test threshold
  slowTestThreshold: 10000, // 10 seconds

  // Verbose output for performance debugging
  verbose: true,

  // Performance-optimized settings
  cache: false, // Disable cache to ensure accurate performance measurements
  detectOpenHandles: true, // Detect memory leaks
  forceExit: true, // Force exit to prevent hanging
  logHeapUsage: true, // Log heap usage for memory analysis
};