/**
 * Jest Configuration for Responsive UI Testing
 *
 * Specialized Jest configuration optimized for responsive UI testing:
 * - Extended timeouts for viewport changes and animations
 * - Performance monitoring setup
 * - Touch device simulation support
 * - Memory leak detection
 * - Visual regression testing integration
 *
 * @author UI Responsiveness Testing Specialist
 * @version 1.0.0
 */

const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,

  // Display name for this test configuration
  displayName: {
    name: 'Responsive UI Tests',
    color: 'blue'
  },

  // Test file patterns specific to responsive testing
  testMatch: [
    '<rootDir>/tests/responsive/**/*.test.{ts,tsx,js,jsx}',
    '<rootDir>/tests/**/ResponsiveDesign.test.{ts,tsx}',
    '<rootDir>/tests/**/responsive-*.test.{ts,tsx}',
    '<rootDir>/tests/**/*Responsive*.test.{ts,tsx}',
    '<rootDir>/tests/visual-regression/**/responsive-*.test.{ts,tsx}'
  ],

  // Extended timeouts for responsive tests
  testTimeout: 30000, // 30 seconds for complex viewport changes

  // Setup files for responsive testing
  setupFilesAfterEnv: [
    '<rootDir>/src/test-setup.ts',
    '<rootDir>/tests/responsive/setup/ResponsiveTestSetup.ts'
  ],

  // Test environment with extended capabilities
  testEnvironment: 'jsdom',

  // Global configuration for responsive tests
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json'
    },
    // Performance monitoring settings
    PERFORMANCE_MONITORING: true,
    VISUAL_REGRESSION_ENABLED: process.env.VISUAL_REGRESSION === 'true',
    TOUCH_SIMULATION_ENABLED: true,
    VIEWPORT_SIMULATION_ENABLED: true
  },

  // Module name mapping with responsive test utilities
  moduleNameMapping: {
    ...baseConfig.moduleNameMapping,
    '^@responsive-utils/(.*)$': '<rootDir>/tests/responsive/ResponsiveTestUtils',
    '^@responsive-config/(.*)$': '<rootDir>/tests/responsive/ResponsiveTestConfig',
    '^@test-fixtures/(.*)$': '<rootDir>/tests/fixtures/$1'
  },

  // Coverage configuration focused on responsive components
  collectCoverageFrom: [
    'src/renderer/components/**/*.{ts,tsx}',
    'src/components/**/*.{ts,tsx}',
    'src/renderer/hooks/useMediaQuery.{ts,tsx}',
    'src/renderer/hooks/useWindowSize.{ts,tsx}',
    'src/renderer/hooks/useKeyboardShortcuts.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/test-utils/**'
  ],

  // Coverage thresholds for responsive features
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Stricter thresholds for responsive components
    'src/components/search/ResponsiveSearchLayout.tsx': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'src/renderer/hooks/useMediaQuery.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },

  // Reporters with performance metrics
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './test-reports/responsive',
        filename: 'responsive-test-report.html',
        openReport: false,
        pageTitle: 'Responsive UI Test Report',
        logoImgPath: './assets/icons/icon.png',
        hideIcon: false,
        includeFailureMsg: true,
        includeSuiteFailure: true
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './test-reports/responsive',
        outputName: 'responsive-test-results.xml',
        suiteName: 'Responsive UI Tests',
        includeShortConsoleOutput: true
      }
    ]
  ],

  // Transform configuration for responsive tests
  transform: {
    ...baseConfig.transform,
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          compilerOptions: {
            jsx: 'react-jsx',
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            target: 'es2020',
            lib: ['es2020', 'dom', 'dom.iterable']
          }
        }
      }
    ]
  },

  // Module file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],

  // Mock configuration for responsive testing
  moduleNameMapping: {
    ...baseConfig.moduleNameMapping,
    // Mock CSS modules for responsive tests
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Mock image files
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/tests/__mocks__/fileMock.js'
  },

  // Setup files to run before tests
  setupFiles: [
    '<rootDir>/tests/responsive/setup/GlobalResponsiveSetup.ts'
  ],

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Verbose output for debugging responsive tests
  verbose: process.env.VERBOSE_TESTS === 'true',

  // Test result processor for performance metrics
  testResultsProcessor: '<rootDir>/tests/responsive/processors/ResponsiveTestProcessor.js',

  // Custom test environment options
  testEnvironmentOptions: {
    // URL for the test environment
    url: 'http://localhost:3000',
    // Viewport settings
    viewport: {
      width: 1920,
      height: 1080
    },
    // Device pixel ratio
    devicePixelRatio: 1,
    // User agent
    userAgent: 'Mozilla/5.0 (compatible; ResponsiveTestRunner/1.0)',
    // Enable performance API
    performance: true
  },

  // Cache configuration
  cacheDirectory: '<rootDir>/node_modules/.cache/jest-responsive',

  // Error handling
  errorOnDeprecated: true,

  // Watch plugins for responsive development
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
    '<rootDir>/tests/responsive/plugins/ResponsiveWatchPlugin.js'
  ],

  // Maximum number of concurrent tests (reduce for performance testing)
  maxConcurrency: process.env.CI ? 2 : 4,
  maxWorkers: process.env.CI ? 2 : '50%',

  // Snapshot serializers for responsive components
  snapshotSerializers: [
    '@emotion/jest/serializer',
    'enzyme-to-json/serializer'
  ],

  // Test sequences for responsive testing
  testSequencer: '<rootDir>/tests/responsive/sequencers/ResponsiveTestSequencer.js',

  // Notify configuration for responsive test completion
  notify: process.env.NODE_ENV !== 'ci',
  notifyMode: 'failure-change',

  // Collect test coverage
  collectCoverage: process.env.COVERAGE === 'true',
  coverageDirectory: './test-reports/responsive/coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'clover',
    'json'
  ],

  // Force exit after tests complete
  forceExit: false,
  detectOpenHandles: true,

  // Performance monitoring
  performance: {
    // Enable performance monitoring
    enabled: true,
    // Memory monitoring
    memory: {
      enabled: true,
      threshold: 50 * 1024 * 1024, // 50MB threshold
    },
    // Timing monitoring
    timing: {
      enabled: true,
      threshold: 1000, // 1 second threshold
    }
  }
};