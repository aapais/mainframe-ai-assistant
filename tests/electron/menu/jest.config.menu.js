/**
 * Jest Configuration for Menu Tests
 *
 * Specialized Jest configuration for testing Electron menu functionality
 * with proper mocking, timeout handling, and coverage reporting.
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/electron/menu/setup.ts'
  ],

  // TypeScript handling
  preset: 'ts-jest',

  // Module paths and mapping
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  moduleNameMap: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@main/(.*)$': '<rootDir>/src/main/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1'
  },

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/electron/menu/**/*.test.ts'
  ],

  // Files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/'
  ],

  // Transform files
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },

  // File extensions
  moduleFileExtensions: ['ts', 'js', 'json'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/main/menu.ts',
    'src/main/**/*.ts',
    '!src/main/**/*.d.ts',
    '!src/main/**/*.test.ts',
    '!src/main/**/__tests__/**',
    '!src/main/**/node_modules/**'
  ],

  coverageDirectory: 'coverage/menu-tests',

  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/main/menu.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },

  // Timeouts
  testTimeout: 30000,

  // Error handling
  bail: false,
  verbose: true,

  // Handle async operations
  detectOpenHandles: true,
  forceExit: true,

  // Globals for TypeScript
  globals: {
    'ts-jest': {
      useESM: false,
      tsconfig: {
        target: 'es2020',
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true
      }
    }
  },

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: 'coverage/menu-tests/html-report',
        filename: 'report.html',
        pageTitle: 'Menu Tests Report',
        openReport: false,
        expand: true,
        hideIcon: false,
        includeFailureMsg: true,
        includeSuiteFailure: true
      }
    ]
  ],

  // Test categories
  projects: [
    {
      displayName: 'Menu Unit Tests',
      testMatch: [
        '<rootDir>/tests/electron/menu/menu-interactions.test.ts',
        '<rootDir>/tests/electron/menu/context-menu.test.ts',
        '<rootDir>/tests/electron/menu/tray-menu.test.ts'
      ],
      setupFilesAfterEnv: [
        '<rootDir>/tests/electron/menu/setup.ts'
      ]
    },
    {
      displayName: 'Menu Integration Tests',
      testMatch: [
        '<rootDir>/tests/electron/menu/keyboard-shortcuts.test.ts',
        '<rootDir>/tests/electron/menu/dynamic-menu-updates.test.ts'
      ],
      setupFilesAfterEnv: [
        '<rootDir>/tests/electron/menu/setup.ts'
      ]
    },
    {
      displayName: 'Platform Tests',
      testMatch: [
        '<rootDir>/tests/electron/menu/platform-specific.test.ts'
      ],
      setupFilesAfterEnv: [
        '<rootDir>/tests/electron/menu/setup.ts'
      ]
    }
  ],

  // Performance monitoring
  maxWorkers: '50%',

  // Error output
  errorOnDeprecated: false,

  // Watch mode configuration
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Mock configuration
  moduleNameMapper: {
    // Handle module mocks
    '^electron$': '<rootDir>/tests/integration/__mocks__/electron.js',
    '^electron-updater$': '<rootDir>/tests/electron/menu/__mocks__/electron-updater.js'
  }
};