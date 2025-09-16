/**
 * Jest Configuration for v8 Transparency Integration Testing
 * Supports TypeScript, React/JSX, and comprehensive testing infrastructure
 */

module.exports = {
  // Test Environment Configuration
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts',
    '<rootDir>/tests/global-setup.ts'
  ],

  // TypeScript and JSX Support
  preset: 'ts-jest',
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

  // Coverage Configuration for v8 Transparency
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx,js,jsx}',
    '!src/**/*.spec.{ts,tsx,js,jsx}',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/main/main.ts',
    '!src/main/preload.ts',
    // Focus on v8 transparency features
    'src/components/transparency/**/*.{ts,tsx}',
    'src/services/transparency/**/*.{ts,tsx}',
    'src/hooks/transparency/**/*.{ts,tsx}',
    'src/utils/transparency/**/*.{ts,tsx}'
  ],

  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary',
    'clover'
  ],

  // Coverage Thresholds for v8 Transparency
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    // Stricter thresholds for transparency features
    'src/components/transparency/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    'src/services/transparency/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
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

  // Globals for testing environment
  globals: {
    'ts-jest': {
      useESM: true,
      isolatedModules: true,
      tsconfig: {
        jsx: 'react-jsx'
      }
    }
  },

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

  // Project-specific configurations
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.(ts|tsx|js|jsx)']
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.(ts|tsx|js|jsx)'],
      testTimeout: 60000
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.(ts|tsx|js|jsx)'],
      testTimeout: 120000
    },
    {
      displayName: 'transparency',
      testMatch: [
        '<rootDir>/tests/integration/ui/ai-authorization-dialog.test.tsx',
        '<rootDir>/tests/integration/v8-transparency/**/*.test.(ts|tsx)',
        '<rootDir>/tests/transparency/**/*.test.(ts|tsx)'
      ],
      testTimeout: 60000
    }
  ],

  // Custom reporters for detailed test reporting
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './coverage/html-report',
      filename: 'test-report.html',
      expand: true,
      hideIcon: false,
      pageTitle: 'v8 Transparency Integration Test Report'
    }],
    ['jest-junit', {
      outputDirectory: './coverage',
      outputName: 'junit.xml',
      suiteName: 'v8 Transparency Tests'
    }]
  ]
};