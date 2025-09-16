/**
 * Jest Configuration for IPC Testing Suite
 * Specialized configuration for comprehensive IPC communication tests
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test files pattern
  testMatch: [
    '**/tests/ipc/**/*.test.ts',
    '**/tests/ipc/**/*.test.js'
  ],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/ipc/setup.ts'
  ],
  
  // TypeScript handling
  preset: 'ts-jest',
  
  // Module name mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/main/ipc/**/*.ts',
    'src/main/preload.ts',
    'src/main/ipc-handlers.ts',
    '!src/main/ipc/**/*.d.ts',
    '!src/main/ipc/**/*.test.ts'
  ],
  
  coverageDirectory: 'coverage/ipc',
  
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 85,
      statements: 85
    },
    './src/main/preload.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/main/ipc/': {
      branches: 80,
      functions: 85,
      lines: 80,
      statements: 80
    }
  },
  
  // Test timeouts
  testTimeout: 30000, // 30 seconds for IPC operations
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Verbose output for debugging
  verbose: true,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Performance monitoring
  detectOpenHandles: true,
  detectLeaks: true,
  
  // Global setup and teardown
  globalSetup: '<rootDir>/tests/ipc/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/ipc/globalTeardown.ts',
  
  // Test runner options
  maxWorkers: '50%', // Use half of available CPU cores
  
  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  
  // File extensions to consider
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  
  // Mock configuration
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/ipc/html-report',
        filename: 'ipc-test-report.html',
        pageTitle: 'IPC Communication Test Results',
        logoImgPath: './assets/logo.png',
        expand: true,
        hideIcon: false,
        includeFailureMsg: true,
        includeSuiteFailure: true
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './coverage/ipc/',
        outputName: 'ipc-junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ]
  ],
  
  // Custom test sequencer for IPC tests
  testSequencer: '<rootDir>/tests/ipc/testSequencer.js'
};
