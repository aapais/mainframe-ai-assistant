/**
 * Jest Configuration for Migration Validation Testing
 * Simplified configuration for basic testing without complex TypeScript setup
 */

module.exports = {
  // Test Environment Configuration
  testEnvironment: 'node',
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],

  // Simplified preset without ts-jest
  // preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        module: 'esnext',
        target: 'es2022',
        moduleResolution: 'node',
        skipLibCheck: true
      }
    }],
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }]
  },

  // Module Resolution
  moduleNameMapper: {
    // Path aliases from tsconfig
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@main/(.*)$': '<rootDir>/src/main/$1',
    '^@renderer/(.*)$': '<rootDir>/src/renderer/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@components/(.*)$': '<rootDir>/src/renderer/components/$1',
    '^@hooks/(.*)$': '<rootDir>/src/renderer/hooks/$1',
    '^@utils/(.*)$': '<rootDir>/src/shared/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@assets/(.*)$': '<rootDir>/assets/$1',

    // Mock static assets
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg|ico)$': '<rootDir>/tests/__mocks__/fileMock.js',
    '\\.(woff|woff2|eot|ttf|otf)$': '<rootDir>/tests/__mocks__/fileMock.js'
  },

  // File Extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Test File Patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.(ts|tsx|js|jsx)',
    '<rootDir>/tests/**/*.spec.(ts|tsx|js|jsx)',
    '<rootDir>/src/**/__tests__/**/*.(ts|tsx|js|jsx)',
    '<rootDir>/src/**/*.(test|spec).(ts|tsx|js|jsx)'
  ],

  // Coverage Configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx,js,jsx}',
    '!src/**/*.spec.{ts,tsx,js,jsx}',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/main/main.ts',
    '!src/main/preload.ts'
  ],

  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary',
    'clover'
  ],

  // Coverage Thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Performance Configuration
  maxWorkers: '50%',
  testTimeout: 30000,
  slowTestThreshold: 5,

  // Advanced Configuration
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  resetModules: true,

  // Verbose output for debugging
  verbose: true,
  silent: false,

  // Error Handling
  bail: 0,
  errorOnDeprecated: true,

  // Transform ignore patterns for node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/',
    '\\.min\\.'
  ],

  // Watch mode configuration
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/',
    '\\.git/',
    '\\.db$',
    '\\.sqlite$',
    '\\.log$'
  ],

  // Single project configuration for simplicity
  // Note: Complex project configurations can be added later as needed

  // Custom reporters for detailed test reporting
  reporters: [
    'default'
  ]
};