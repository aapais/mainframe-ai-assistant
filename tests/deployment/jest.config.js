/** @type {import('jest').Config} */
module.exports = {
  displayName: 'Deployment Tests',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    '**/*.{ts,js}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/jest.config.js',
    '!**/coverage/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js'
  ],
  testTimeout: 30000, // 30 seconds for deployment tests
  maxWorkers: 1, // Run tests sequentially to avoid conflicts
  verbose: true,

  // Environment variables for testing
  setupFiles: ['<rootDir>/jest.env.js'],

  // Custom matchers and utilities
  moduleFileExtensions: [
    'js',
    'ts',
    'tsx',
    'json'
  ],

  // Test grouping and organization
  projects: [
    {
      displayName: 'Package Integrity',
      testMatch: ['<rootDir>/package-integrity.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/setup/package-integrity.setup.js']
    },
    {
      displayName: 'Installer Validation',
      testMatch: ['<rootDir>/installer-validation.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/setup/installer.setup.js']
    },
    {
      displayName: 'Update Mechanism',
      testMatch: ['<rootDir>/update-mechanism.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/setup/update.setup.js']
    },
    {
      displayName: 'Auto-Updater',
      testMatch: ['<rootDir>/auto-updater.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/setup/auto-updater.setup.js']
    }
  ],

  // Performance monitoring
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'coverage',
      outputName: 'junit.xml',
      suiteName: 'Deployment Tests'
    }],
    ['jest-html-reporters', {
      publicPath: 'coverage/html-report',
      filename: 'deployment-test-report.html',
      expand: true,
      hideIcon: false
    }]
  ],

  // Global test configuration
  globals: {
    'ts-jest': {
      useESM: false,
      tsconfig: {
        compilerOptions: {
          target: 'es2020',
          module: 'commonjs',
          lib: ['es2020'],
          allowJs: true,
          skipLibCheck: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
          forceConsistentCasingInFileNames: true,
          moduleResolution: 'node',
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true
        }
      }
    }
  },

  // Mock configuration
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true
};