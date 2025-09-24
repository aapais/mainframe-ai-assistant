module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '<rootDir>/scripts/test-*.js',
    '<rootDir>/tests/**/*.test.{js,ts,tsx}',
    '<rootDir>/src/**/*.test.{js,ts,tsx}'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/old/',
    '/dist/',
    '/portable-app/'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: false,
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }],
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,ts,tsx}',
    'scripts/**/*.js',
    '!src/**/*.d.ts',
    '!src/**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  bail: false,
  maxWorkers: '50%',
  testTimeout: 30000
};