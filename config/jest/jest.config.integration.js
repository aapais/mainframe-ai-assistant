/**
 * Jest Configuration for Comprehensive Testing
 * Optimized for CI/CD pipeline integration and coverage reporting
 */

const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,

  // Test Discovery
  testMatch: [
    '<rootDir>/tests/**/*.test.{ts,tsx}',
    '<rootDir>/tests/**/*.spec.{ts,tsx}',
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}'
  ],

  // Test Categories via Tags
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/dist-electron/',
    '/coverage/'
  ],

  // Projects for different test types
  projects: [
    // Unit Tests
    {
      displayName: 'Unit Tests',
      testMatch: [
        '<rootDir>/tests/unit/**/*.test.{ts,tsx}',
        '<rootDir>/src/**/__tests__/**/*.{ts,tsx}'
      ],
      setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
      testEnvironment: 'jsdom',
      collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/test-setup.ts',
        '!src/main/**/*.ts'
      ],
      coverageThreshold: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    },

    // Integration Tests
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/tests/integration/**/*.test.{ts,tsx}'],
      setupFilesAfterEnv: [
        '<rootDir>/tests/integration/setup.ts'
      ],
      testEnvironment: 'node', // Changed to node for integration tests
      testTimeout: 120000, // Extended timeout for integration tests
      maxWorkers: process.env.CI ? 1 : 2, // Limited concurrency for integration tests
      collectCoverageFrom: [
        'src/services/**/*.{ts,tsx}',
        'src/database/**/*.{ts,tsx}',
        'src/caching/**/*.{ts,tsx}',
        'src/monitoring/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/test-utils/**',
        '!src/**/fixtures/**'
      ],
      coverageThreshold: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        },
        // Higher thresholds for critical integration points
        'src/services/ServiceFactory.ts': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        },
        'src/database/DatabaseManager.ts': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      },
      // Integration test specific settings
      forceExit: true,
      detectOpenHandles: true
    },

    // E2E Tests
    {
      displayName: 'E2E Tests',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.{ts,tsx}'],
      setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
      testEnvironment: 'jsdom',
      testTimeout: 60000,
      slowTestThreshold: 30000,
      collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/test-setup.ts'
      ]
    },

    // Performance Tests
    {
      displayName: 'Performance Tests',
      testMatch: ['<rootDir>/tests/performance/**/*.test.{ts,tsx}'],
      setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
      testEnvironment: 'jsdom',
      testTimeout: 120000,
      slowTestThreshold: 60000,
      collectCoverage: false // Skip coverage for performance tests
    },

    // Accessibility Tests
    {
      displayName: 'Accessibility Tests',
      testMatch: ['<rootDir>/tests/accessibility/**/*.test.{ts,tsx}'],
      setupFilesAfterEnv: [
        '<rootDir>/src/test-setup.ts',
        'jest-axe/extend-expect'
      ],
      testEnvironment: 'jsdom',
      testTimeout: 30000,
      collectCoverageFrom: [
        'src/renderer/components/**/*.{ts,tsx}',
        '!**/*.d.ts'
      ]
    },

    // Edge Cases and Error Handling
    {
      displayName: 'Edge Cases',
      testMatch: ['<rootDir>/tests/edge-cases/**/*.test.{ts,tsx}'],
      setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
      testEnvironment: 'jsdom',
      testTimeout: 45000,
      collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/test-setup.ts'
      ]
    }
  ],

  // Coverage Configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test-setup.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/main/preload.ts' // Electron preload scripts
  ],

  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json',
    'json-summary',
    'cobertura', // For GitLab CI
    'clover'     // For other CI systems
  ],

  coverageDirectory: 'coverage',

  // Global Coverage Thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Specific thresholds for critical components
    'src/services/*.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'src/renderer/components/ui/*.tsx': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  // Test Results Processing
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/html-report',
        filename: 'test-results.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'KB Management Test Results',
        logoImgPath: './assets/logo.png',
        includeFailureMsg: true,
        includeSuiteFailure: true
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './coverage',
        outputName: 'junit.xml',
        ancestorSeparator: ' › ',
        uniqueOutputName: false,
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        includeConsoleOutput: true,
        usePathForSuiteName: true
      }
    ]
  ],

  // Performance Monitoring
  detectOpenHandles: true,
  detectLeaks: true,
  logHeapUsage: true,
  maxWorkers: process.env.CI ? 2 : '50%',

  // CI/CD Optimizations
  ...(process.env.CI && {
    // CI-specific settings
    bail: 1, // Stop after first test failure
    ci: true,
    coverage: true,
    forceExit: true,
    maxWorkers: 2,
    passWithNoTests: false,
    silent: false,
    verbose: true,
    watchman: false
  }),

  // Module Resolution
  moduleNameMapping: {
    ...baseConfig.moduleNameMapping,
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@mocks/(.*)$': '<rootDir>/tests/__mocks__/$1'
  },

  // Setup and Teardown
  setupFiles: [
    '<rootDir>/tests/setup/global-setup.ts'
  ],

  setupFilesAfterEnv: [
    '<rootDir>/src/test-setup.ts'
  ],

  globalSetup: '<rootDir>/tests/setup/jest-global-setup.ts',
  globalTeardown: '<rootDir>/tests/setup/jest-global-teardown.ts',

  // Transform Configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      isolatedModules: true
    }],
    '^.+\\.(css|scss|sass|less)$': 'jest-transform-stub',
    '^.+\\.(jpg|jpeg|png|gif|webp|svg)$': 'jest-transform-stub'
  },

  // Module File Extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json'
  ],

  // Test Timeout
  testTimeout: 30000,

  // Retry Configuration
  retry: process.env.CI ? 2 : 0,

  // Watch Mode (for local development)
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],

  // Cache Configuration
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',

  // Error Handling
  errorOnDeprecated: true,
  testFailureExitCode: 1,

  // Custom Test Sequencer for Optimal CI Performance
  testSequencer: '<rootDir>/tests/setup/test-sequencer.js'
};