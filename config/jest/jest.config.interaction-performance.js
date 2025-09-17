/**
 * Jest Configuration for Interaction Performance Tests
 *
 * Specialized configuration for running interaction responsiveness and
 * performance tests with appropriate timeouts and environment setup.
 */

module.exports = {
  // Base configuration
  preset: 'ts-jest',
  testEnvironment: 'jsdom',

  // Test discovery
  displayName: 'Interaction Performance Tests',
  testMatch: [
    '<rootDir>/tests/performance/interaction-responsiveness.test.ts',
    '<rootDir>/tests/performance/frame-rate-monitor.test.ts',
    '<rootDir>/tests/performance/scroll-jank-detection.test.ts',
    '<rootDir>/tests/performance/click-response-time.test.ts',
    '<rootDir>/tests/performance/debounce-throttle-effectiveness.test.ts'
  ],

  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/performance/setup/interaction-performance-setup.ts'
  ],

  // Timeouts and performance
  testTimeout: 30000, // 30 seconds for performance tests
  slowTestThreshold: 10000, // 10 seconds

  // Coverage
  collectCoverageFrom: [
    'src/components/**/*.{ts,tsx}',
    'src/hooks/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/*.test.{ts,tsx}'
  ],

  // Coverage thresholds for performance-critical components
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    },
    './src/components/search/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/components/performance/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  // Reporters
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './tests/performance/reports',
        filename: 'interaction-performance-report.html',
        pageTitle: 'Interaction Performance Test Report',
        expand: true
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './tests/performance/reports',
        outputName: 'interaction-performance-junit.xml',
        suiteName: 'Interaction Performance Tests'
      }
    ]
  ],

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },

  // Mock configuration
  clearMocks: true,
  restoreMocks: true,

  // Global variables for performance testing
  globals: {
    'ts-jest': {
      useESM: true
    },
    // Performance test configuration
    PERFORMANCE_TEST_CONFIG: {
      INPUT_LATENCY_THRESHOLD: 50,
      FRAME_RATE_THRESHOLD: 55,
      CLICK_RESPONSE_THRESHOLD: 100,
      SCROLL_JANK_THRESHOLD: 3,
      DEBOUNCE_EFFECTIVENESS_THRESHOLD: 75
    }
  },

  // Test environment configuration
  testEnvironmentOptions: {
    url: 'http://localhost:3000'
  },

  // Verbose output for debugging
  verbose: true,

  // Error handling
  errorOnDeprecated: true,

  // Memory management for performance tests
  maxWorkers: '50%',
  workerIdleMemoryLimit: '512MB'
};