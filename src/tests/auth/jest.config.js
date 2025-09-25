module.exports = {
  displayName: 'SSO Auth Tests',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.{js,ts}', '**/?(*.)+(spec|test).{js,ts}'],
  transform: {
    '^.+\\.(js|ts)$': 'babel-jest',
  },
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts',
    '!src/tests/**/*',
    '!src/**/__tests__/**/*',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/config/setup.js'],
  testTimeout: 30000,
  maxWorkers: '50%',
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/tests/auth/unit/**/*.test.{js,ts}'],
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/src/tests/auth/integration/**/*.test.{js,ts}'],
    },
    {
      displayName: 'security',
      testMatch: ['<rootDir>/src/tests/auth/security/**/*.test.{js,ts}'],
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/src/tests/auth/performance/**/*.test.{js,ts}'],
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/src/tests/auth/e2e/**/*.test.{js,ts}'],
      testEnvironment: 'jsdom',
    },
  ],
};
