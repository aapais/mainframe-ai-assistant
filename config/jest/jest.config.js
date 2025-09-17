module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/src/renderer/components/__tests__/setup.ts'
  ],
  
  // Module paths
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  
  // Module name mapping for absolute imports
  moduleNameMap: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@renderer/(.*)$': '<rootDir>/src/renderer/$1',
    '^@main/(.*)$': '<rootDir>/src/main/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1'
  },
  
  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // File extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Test match patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.(ts|tsx|js|jsx)',
    '<rootDir>/src/**/*.(test|spec).(ts|tsx|js|jsx)',
    '<rootDir>/tests/**/*.(test|spec).(ts|tsx|js|jsx)'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/renderer/**/*.{ts,tsx}',
    '!src/renderer/**/*.d.ts',
    '!src/renderer/**/__tests__/**/*',
    '!src/renderer/**/node_modules/**',
    '!src/renderer/**/dist/**',
    '!src/renderer/**/coverage/**'
  ],
  
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov'
  ],
  
  coverageDirectory: 'coverage',
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/renderer/components/forms/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/renderer/utils/validation.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // Module mock patterns
  moduleNameMapper: {
    // Handle CSS imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    
    // Handle image imports
    '\\.(png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/src/renderer/components/__tests__/__mocks__/fileMock.js',
    
    // Handle font imports
    '\\.(woff|woff2|eot|ttf|otf)$': '<rootDir>/src/renderer/components/__tests__/__mocks__/fileMock.js'
  },
  
  // Globals
  globals: {
    'ts-jest': {
      useESM: false,
      tsconfig: {
        jsx: 'react-jsx'
      }
    }
  },
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Test timeout
  testTimeout: 10000,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Watch plugins for interactive testing
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // Presets for different environments
  projects: [
    {
      displayName: 'unit',
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.(ts|tsx)',
        '<rootDir>/src/**/*.(test|spec).(ts|tsx)'
      ],
      setupFilesAfterEnv: [
        '<rootDir>/src/renderer/components/__tests__/setup.ts'
      ]
    },
    {
      displayName: 'integration',
      testMatch: [
        '<rootDir>/tests/integration/**/*.(test|spec).(ts|tsx|js|jsx)'
      ],
      setupFilesAfterEnv: [
        '<rootDir>/tests/integration/setup.ts'
      ]
    }
  ]
};