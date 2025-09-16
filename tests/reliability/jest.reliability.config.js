/**
 * Jest Configuration for Reliability Tests
 * Specialized configuration for long-running reliability and stress tests
 */

module.exports = {
  // Use the same basic config as main jest config but with reliability-specific settings
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Only run reliability tests
  testMatch: [
    '**/tests/reliability/**/*.test.ts',
    '**/tests/reliability/**/*.test.js'
  ],
  
  // Longer timeouts for reliability tests
  testTimeout: 120000, // 2 minutes per test
  
  // Run reliability tests in sequence (not parallel) to avoid resource conflicts
  maxWorkers: 1,
  
  // Coverage settings for reliability tests
  collectCoverage: false, // Disable for performance during long tests
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/reliability/jest.reliability.setup.js'
  ],
  
  // Module paths
  moduleDirectories: ['node_modules', '<rootDir>/src', '<rootDir>/tests'],
  
  // Transform settings
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  
  // File extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Global settings for reliability tests
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
      // Disable type checking for faster compilation in reliability tests
      isolatedModules: true
    },
    // Reliability test configuration
    RELIABILITY_TEST_CONFIG: {
      ENABLE_MEMORY_LEAK_DETECTION: true,
      ENABLE_PERFORMANCE_MONITORING: true,
      ENABLE_LONG_RUNNING_TESTS: true,
      CLEANUP_TEMP_FILES: true,
      GENERATE_REPORTS: true
    }
  },
  
  // Reporter configuration for detailed reliability reports
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './tests/reliability/reports',
        filename: 'reliability-test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Mainframe KB Assistant - Reliability Test Report',
        logoImgPath: undefined,
        includeFailureMsg: true,
        includeSuiteFailure: true
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './tests/reliability/reports',
        outputName: 'reliability-junit.xml',
        suiteName: 'Reliability Tests',
        suiteNameTemplate: '{title}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ]
  ],
  
  // Verbose output for reliability test debugging
  verbose: true,
  
  // Error handling
  bail: false, // Don't stop on first failure
  errorOnDeprecated: false,
  
  // Cache settings (disabled for reliability tests to ensure clean state)
  cache: false,
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Node-specific settings
  testEnvironmentOptions: {
    // Increase memory limit for reliability tests
    maxBuffer: 1024 * 1024 * 100, // 100MB
  }
};