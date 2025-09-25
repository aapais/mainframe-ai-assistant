module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  displayName: 'Database Tests',
  testMatch: ['<rootDir>/**/*.test.ts', '<rootDir>/**/*.spec.ts'],
  setupFilesAfterEnv: ['<rootDir>/test-utils/setup.ts'],
  testTimeout: 30000,
  collectCoverageFrom: [
    '../**/*.ts',
    '!../**/*.d.ts',
    '!../**/*.test.ts',
    '!../**/*.spec.ts',
    '!../migrations/**',
    '!../seeds/**',
    '!../__tests__/**',
  ],
  coverageDirectory: '<rootDir>/../../../coverage/database',
  coverageReporters: ['text', 'lcov', 'html', 'cobertura'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  maxWorkers: 1, // Important for SQLite tests to avoid file locking issues
  forceExit: true,
  detectOpenHandles: true,
  verbose: true,
};
