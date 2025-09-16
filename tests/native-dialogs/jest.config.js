/**
 * Jest configuration for native dialog tests
 * Optimized for Electron testing environment
 */

module.exports = {
  displayName: 'Native Dialogs',
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/native-dialogs/**/*.test.ts',
    '<rootDir>/tests/native-dialogs/**/*.test.js'
  ],

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/native-dialogs/jest.setup.js'
  ],

  // TypeScript support
  preset: 'ts-jest',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'babel-jest'
  },

  // Module resolution
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage/native-dialogs',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  collectCoverageFrom: [
    'tests/native-dialogs/**/*.{ts,js}',
    '!tests/native-dialogs/**/*.test.{ts,js}',
    '!tests/native-dialogs/jest.*.js',
    '!tests/native-dialogs/index.ts'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Test timeout (30 seconds for Electron tests)
  testTimeout: 30000,

  // Electron-specific configuration
  testEnvironmentOptions: {
    electron: {
      app: {
        enableLogging: false,
        show: false
      }
    }
  },

  // Global setup and teardown
  globalSetup: '<rootDir>/tests/native-dialogs/global.setup.js',
  globalTeardown: '<rootDir>/tests/native-dialogs/global.teardown.js',

  // Mock configuration
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Verbose output for detailed test results
  verbose: true,

  // Fail fast on first test failure (useful for development)
  bail: false,

  // Maximum number of concurrent workers
  maxWorkers: '50%',

  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/native-dialogs/html-report',
        filename: 'report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Native Dialog Tests Report'
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './coverage/native-dialogs',
        outputName: 'junit.xml',
        suiteName: 'Native Dialog Tests'
      }
    ]
  ]
};