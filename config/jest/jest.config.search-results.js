/**
 * Jest Configuration for SearchResults Component Testing
 * 
 * Optimized for:
 * - Component testing with React Testing Library
 * - Performance testing with memory monitoring
 * - Accessibility testing with jest-axe
 * - Visual regression testing support
 * - Comprehensive coverage reporting
 */

module.exports = {
  displayName: 'SearchResults Component Tests',
  
  // Test environment
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
    userAgent: 'Mozilla/5.0 (jsdom)',
    pretendToBeVisual: true,
    resources: 'usable'
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/components/search/setup.ts'
  ],
  
  // Module resolution
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@renderer/(.*)$': '<rootDir>/src/renderer/$1',
    '^@main/(.*)$': '<rootDir>/src/main/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    
    // Handle CSS imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    
    // Handle image imports
    '\\.(png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/tests/components/search/__mocks__/fileMock.js',
    
    // Handle font imports
    '\\.(woff|woff2|eot|ttf|otf)$': '<rootDir>/tests/components/search/__mocks__/fileMock.js'
  },
  
  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: false,
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }],
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // File extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Test patterns
  testMatch: [
    '<rootDir>/tests/components/search/**/*.test.(ts|tsx)',
    '<rootDir>/tests/components/search/**/*.spec.(ts|tsx)'
  ],
  
  // Test path ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/',
    '<rootDir>/coverage/'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/renderer/components/search/SearchResults.tsx',
    'src/renderer/components/search/SearchResultsVirtualized.tsx',
    'src/renderer/components/search/*.tsx',
    '!src/renderer/components/search/**/*.d.ts',
    '!src/renderer/components/search/**/__tests__/**',
    '!src/renderer/components/search/**/*.stories.(ts|tsx)'
  ],
  
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json',
    'json-summary',
    'clover'
  ],
  
  coverageDirectory: '<rootDir>/coverage/search-results',
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/renderer/components/search/SearchResults.tsx': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/renderer/components/search/SearchResultsVirtualized.tsx': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // Performance and timeout settings
  testTimeout: 10000,
  slowTestThreshold: 5,
  
  // Memory and performance monitoring
  logHeapUsage: true,
  detectLeaks: true,
  
  // Error handling
  errorOnDeprecated: true,
  bail: false,
  
  // Mocking
  clearMocks: true,
  restoreMocks: true,
  resetMocks: false,
  
  // Verbose output for debugging
  verbose: true,
  
  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/search-results',
        filename: 'test-report.html',
        pageTitle: 'SearchResults Component Test Report',
        logoImgPath: './assets/logo.png',
        expand: true,
        hideIcon: false,
        includeFailureMsg: true,
        includeSuiteFailure: true
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './coverage/search-results',
        outputName: 'junit-report.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ]
  ],
  
  // Watch mode configuration
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/'
  ],
  
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // Global configuration
  globals: {
    'ts-jest': {
      useESM: false,
      tsconfig: {
        jsx: 'react-jsx'
      }
    },
    // Performance budgets for tests
    PERFORMANCE_BUDGETS: {
      RENDER_TIME: 100,
      MEMORY_USAGE: 50 * 1024 * 1024,
      LARGE_DATASET_RENDER: 300,
      RE_RENDER_TIME: 50
    },
    // Test environment flags
    TEST_ENV: {
      ENABLE_PERFORMANCE_TESTS: true,
      ENABLE_VISUAL_TESTS: false, // Set to true for visual regression tests
      ENABLE_ACCESSIBILITY_TESTS: true,
      MOCK_VIRTUAL_SCROLLING: true
    }
  },
  
  // Custom test sequences
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: [
        '<rootDir>/tests/components/search/SearchResults.test.tsx',
        '<rootDir>/tests/components/search/SearchResultsVirtualized.test.tsx'
      ],
      setupFilesAfterEnv: [
        '<rootDir>/tests/components/search/setup.ts'
      ]
    },
    {
      displayName: 'Performance Tests',
      testMatch: [
        '<rootDir>/tests/components/search/SearchResults.performance.test.tsx'
      ],
      setupFilesAfterEnv: [
        '<rootDir>/tests/components/search/setup.ts'
      ],
      testTimeout: 30000,
      globals: {
        'ts-jest': {
          useESM: false
        },
        ENABLE_PERFORMANCE_MONITORING: true
      }
    },
    {
      displayName: 'Accessibility Tests',
      testMatch: [
        '<rootDir>/tests/components/search/SearchResults.accessibility.test.tsx'
      ],
      setupFilesAfterEnv: [
        '<rootDir>/tests/components/search/setup.ts'
      ],
      testTimeout: 15000,
      globals: {
        'ts-jest': {
          useESM: false
        },
        ACCESSIBILITY_TESTING: true
      }
    },
    {
      displayName: 'Visual Regression Tests',
      testMatch: [
        '<rootDir>/tests/components/search/SearchResults.visual.test.tsx'
      ],
      setupFilesAfterEnv: [
        '<rootDir>/tests/components/search/setup.ts'
      ],
      testTimeout: 20000,
      runner: 'jest-runner',
      globals: {
        'ts-jest': {
          useESM: false
        },
        VISUAL_TESTING: true
      }
    }
  ],
  
  // Test result formatting
  collectCoverageOnlyFrom: {
    '<rootDir>/src/renderer/components/search/**/*.{ts,tsx}': true
  },
  
  // Custom test environment variables
  testEnvironmentVariables: {
    NODE_ENV: 'test',
    REACT_APP_TEST_MODE: 'true',
    DISABLE_ANIMATIONS: 'true',
    MOCK_API_CALLS: 'true'
  },
  
  // Snapshot configuration
  snapshotSerializers: [
    'enzyme-to-json/serializer'
  ],
  
  // Custom test utilities
  setupFiles: [
    '<rootDir>/tests/components/search/__mocks__/browserMocks.js'
  ],
  
  // Transform ignore patterns (for node_modules)
  transformIgnorePatterns: [
    'node_modules/(?!(react-window|react-virtualized|react-window-infinite-loader)/)',
    '\\.(css|less|scss|sass)$'
  ]
};