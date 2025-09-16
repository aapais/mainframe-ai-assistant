const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('../../../../tsconfig.json');

module.exports = {
  displayName: 'Interaction Tests',
  testMatch: [
    '<rootDir>/src/renderer/components/__tests__/interaction/**/*.test.{ts,tsx}'
  ],

  // Test Environment
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/src/renderer/components/__tests__/interaction/setup.ts'
  ],

  // Module Resolution
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths || {}, {
      prefix: '<rootDir>/'
    }),
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/src/renderer/components/__tests__/__mocks__/fileMock.js'
  },

  // Transform Configuration
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
        isolatedModules: true
      }
    ]
  },

  // Coverage Configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage/interaction',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json-summary'
  ],

  collectCoverageFrom: [
    // Include interaction-related components
    'src/renderer/components/search/**/*.{ts,tsx}',
    'src/renderer/components/forms/**/*.{ts,tsx}',
    'src/renderer/components/common/**/*.{ts,tsx}',
    'src/renderer/components/ui/**/*.{ts,tsx}',

    // Exclude test files and setup
    '!**/__tests__/**',
    '!**/__mocks__/**',
    '!**/*.test.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
    '!**/*.d.ts',

    // Exclude non-interactive components
    '!**/examples/**',
    '!**/stories/**'
  ],

  // Coverage Thresholds
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    // Component-specific thresholds
    'src/renderer/components/search/SearchInterface.tsx': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    'src/renderer/components/forms/KBEntryForm.tsx': {
      branches: 88,
      functions: 92,
      lines: 92,
      statements: 92
    },
    'src/renderer/components/common/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },

  // Test Timeout
  testTimeout: 10000, // 10 seconds for interaction tests

  // Globals
  globals: {
    'ts-jest': {
      isolatedModules: true,
      tsconfig: 'tsconfig.test.json'
    }
  },

  // Performance
  maxWorkers: '50%',
  cacheDirectory: '<rootDir>/node_modules/.cache/jest-interaction',

  // Reporter Configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: '<rootDir>/coverage/interaction',
        filename: 'interaction-test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Interaction Test Report',
        logoImgPath: undefined,
        includeFailureMsg: true,
        includeSuiteFailure: true
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/coverage/interaction',
        outputName: 'junit-interaction.xml',
        suiteName: 'Interaction Tests',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}'
      }
    ]
  ],

  // Mock Configuration
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/build/',
    '<rootDir>/node_modules/'
  ],

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Error Handling
  errorOnDeprecated: true,
  verbose: true,

  // Custom Test Matchers
  setupFiles: [
    '<rootDir>/src/renderer/components/__tests__/interaction/jest.setup.js'
  ]
};