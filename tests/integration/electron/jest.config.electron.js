/**
 * Jest Configuration for Electron Window Management Tests
 */

module.exports = {
  displayName: 'Electron Window Management Tests',
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Test files
  testMatch: [
    '<rootDir>/tests/integration/electron/**/*.test.ts',
    '<rootDir>/tests/integration/electron/**/*.test.js'
  ],

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/integration/electron/setup-electron-tests.ts'
  ],

  // Module mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^electron$': '<rootDir>/tests/integration/__mocks__/electron.js'
  },

  // Transform configuration
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'babel-jest'
  },

  // File extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/main/windows/**/*.{ts,tsx}',
    'src/main/ipc/**/*.{ts,tsx}',
    '!src/main/windows/types/**',
    '!**/*.d.ts',
    '!**/*.stories.{ts,tsx}',
    '!**/*.test.{ts,tsx}'
  ],

  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageDirectory: '<rootDir>/coverage/electron',

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    },
    './src/main/windows/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Test timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Globals
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.test.json',
      isolatedModules: true
    }
  },

  // Error handling
  errorOnDeprecated: true,

  // Parallel execution
  maxWorkers: '50%',

  // Test result processor
  testResultsProcessor: 'jest-html-reporters',

  // Reporters
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: '<rootDir>/coverage/electron/html-report',
        filename: 'electron-test-report.html',
        pageTitle: 'Electron Window Management Test Report',
        logoImgPath: undefined,
        hideIcon: false,
        expand: true,
        openReport: false,
        includeFailureMsg: true,
        includeSuiteFailure: true
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/coverage/electron',
        outputName: 'electron-test-results.xml',
        suiteName: 'Electron Window Management Tests',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ]
  ],

  // Environment variables
  setupFiles: ['<rootDir>/tests/integration/electron/setup-electron-env.js'],

  // Module paths
  modulePaths: ['<rootDir>/src', '<rootDir>/tests'],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/dist-electron/',
    '/coverage/'
  ],

  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Snapshot serializers
  snapshotSerializers: [],

  // Custom test environment options
  testEnvironmentOptions: {
    // Node environment options
  },

  // Dependency extraction
  dependencyExtractor: undefined,

  // Force exit
  forceExit: true,

  // Detect open handles
  detectOpenHandles: true,

  // Detect memory leaks
  detectMemoryLeaks: false
};