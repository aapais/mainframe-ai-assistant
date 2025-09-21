/**
 * Jest Configuration for Incident Management Tests
 * Specific configuration for incident management test suite
 */

const baseConfig = require('../../jest.config.js');

module.exports = {
  ...baseConfig,
  displayName: 'Incident Management Tests',
  testMatch: [
    '<rootDir>/tests/incident-management/**/*.test.{ts,tsx}'
  ],
  collectCoverageFrom: [
    'src/renderer/components/incident/**/*.{ts,tsx}',
    'src/main/services/incident/**/*.{ts,tsx}',
    'src/types/incident.ts',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}'
  ],
  coverageDirectory: '<rootDir>/coverage/incident-management',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/renderer/components/incident/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/main/services/incident/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  setupFilesAfterEnv: [
    '<rootDir>/tests/incident-management/setup.ts'
  ],
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'http://localhost:3000'
  },
  moduleNameMapping: {
    ...baseConfig.moduleNameMapping,
    '^@incident-test-utils/(.*)$': '<rootDir>/tests/incident-management/utils/$1',
    '^@incident-mocks/(.*)$': '<rootDir>/tests/incident-management/mocks/$1'
  },
  transform: {
    ...baseConfig.transform,
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: {
        jsx: 'react-jsx'
      }
    }
  },
  testTimeout: 30000,
  maxWorkers: '50%',
  // Incident-specific test configurations
  globalSetup: '<rootDir>/tests/incident-management/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/incident-management/globalTeardown.ts',
  // Performance test specific settings
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/incident-management/html-report',
        filename: 'report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Incident Management Test Report'
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './coverage/incident-management/junit',
        outputName: 'junit.xml',
        suiteName: 'Incident Management Tests'
      }
    ]
  ],
  // Test categorization
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  // Specific settings for different test types
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: ['<rootDir>/tests/incident-management/unit/**/*.test.{ts,tsx}'],
      testTimeout: 10000
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/tests/incident-management/integration/**/*.test.{ts,tsx}'],
      testTimeout: 20000
    },
    {
      displayName: 'Performance Tests',
      testMatch: ['<rootDir>/tests/incident-management/performance/**/*.test.{ts,tsx}'],
      testTimeout: 60000,
      maxWorkers: 1 // Run performance tests sequentially
    },
    {
      displayName: 'User Acceptance Tests',
      testMatch: ['<rootDir>/tests/incident-management/user-acceptance/**/*.test.{ts,tsx}'],
      testTimeout: 45000
    }
  ]
};
