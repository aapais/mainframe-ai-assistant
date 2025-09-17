module.exports = {
  displayName: 'Performance Tests',
  testMatch: [
    '<rootDir>/tests/performance/**/*.test.{js,ts}',
    '<rootDir>/src/**/*.performance.test.{js,ts}'
  ],
  testTimeout: 60000, // 60 seconds for performance tests
  setupFilesAfterEnv: [
    '<rootDir>/tests/performance/setup.js'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,ts}',
    '!src/**/*.test.{js,ts}'
  ],
  coverageDirectory: 'coverage/performance',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results/performance',
      outputName: 'junit.xml',
      suiteName: 'Performance Tests'
    }],
    ['./tests/performance/performance-reporter.js', {}]
  ],
  globalSetup: '<rootDir>/tests/performance/global-setup.js',
  globalTeardown: '<rootDir>/tests/performance/global-teardown.js',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json'
    },
    PERFORMANCE_THRESHOLDS: {
      responseTime: {
        p50: 500,
        p95: 2000,
        p99: 5000
      },
      throughput: {
        minRps: 100,
        minConcurrentUsers: 50
      },
      resources: {
        maxMemoryMB: 512,
        maxCpuPercent: 80
      },
      errors: {
        maxErrorRate: 1,
        maxTimeoutRate: 0.5
      }
    }
  }
};
