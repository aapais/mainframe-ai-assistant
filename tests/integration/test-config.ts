/**
 * Test Configuration Management System
 * 
 * Centralized configuration for all test execution scenarios including:
 * - Test suite definitions
 * - Environment configurations
 * - Performance thresholds
 * - Coverage requirements
 * - CI/CD integration settings
 */

import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

export interface TestRunConfig {
  // Suite selection
  suites?: string[];
  skipSuites?: string[];
  
  // Execution control
  parallel?: boolean;
  maxWorkers?: number;
  testTimeout?: number;
  failFast?: boolean;
  
  // Reporting
  reportFormat?: 'summary' | 'detailed' | 'comprehensive' | 'json' | 'junit';
  verbose?: boolean;
  coverage?: boolean;
  
  // MVP1 specific
  validateMVP1?: boolean;
  
  // Cleanup
  cleanOldReports?: boolean;
  reportRetentionDays?: number;
  
  // Environment
  environment?: 'development' | 'test' | 'ci' | 'production';
  
  // Thresholds
  performanceThresholds?: PerformanceThresholds;
  coverageThresholds?: CoverageThresholds;
  qualityGates?: QualityGates;
}

export interface TestSuiteConfig {
  name: string;
  category: string;
  path: string;
  pattern?: string;
  priority: number;
  timeout?: number;
  parallel?: boolean;
  dependencies?: string[];
  args?: string[];
  environment?: string[];
  tags?: string[];
  mvp1Requirements?: string[];
}

export interface PerformanceThresholds {
  search?: {
    maxAvgResponseTimeMs: number;
    maxP95ResponseTimeMs: number;
    maxP99ResponseTimeMs: number;
    minThroughputOpsPerSec: number;
  };
  memory?: {
    maxMemoryUsageMB: number;
    maxMemoryGrowthMB: number;
    maxHeapSizeMB: number;
  };
  database?: {
    maxQueryTimeMs: number;
    maxConnectionTimeMs: number;
    maxTransactionTimeMs: number;
  };
  ui?: {
    maxRenderTimeMs: number;
    maxInteractionDelayMs: number;
    maxPageLoadTimeMs: number;
  };
  overall?: {
    maxStartupTimeMs: number;
    maxEventLoopDelayMs: number;
    maxCpuUsagePercent: number;
  };
}

export interface CoverageThresholds {
  global: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  critical: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  excludePatterns?: string[];
}

export interface QualityGates {
  minSuccessRate: number;
  maxFailedTests: number;
  maxCriticalFailures: number;
  maxPerformanceRegressions: number;
  requiredMVP1Features: string[];
}

export interface EnvironmentConfig {
  name: string;
  description: string;
  variables: Record<string, string>;
  setup?: string[];
  teardown?: string[];
}

export class TestConfig {
  private static readonly DEFAULT_CONFIG: Required<TestRunConfig> = {
    suites: [],
    skipSuites: [],
    parallel: true,
    maxWorkers: Math.min(4, os.cpus().length),
    testTimeout: 30000,
    failFast: false,
    reportFormat: 'comprehensive',
    verbose: false,
    coverage: true,
    validateMVP1: true,
    cleanOldReports: true,
    reportRetentionDays: 30,
    environment: 'test',
    performanceThresholds: {
      search: {
        maxAvgResponseTimeMs: 1000,
        maxP95ResponseTimeMs: 2000,
        maxP99ResponseTimeMs: 5000,
        minThroughputOpsPerSec: 100
      },
      memory: {
        maxMemoryUsageMB: 512,
        maxMemoryGrowthMB: 100,
        maxHeapSizeMB: 1024
      },
      database: {
        maxQueryTimeMs: 500,
        maxConnectionTimeMs: 1000,
        maxTransactionTimeMs: 2000
      },
      ui: {
        maxRenderTimeMs: 100,
        maxInteractionDelayMs: 50,
        maxPageLoadTimeMs: 3000
      },
      overall: {
        maxStartupTimeMs: 5000,
        maxEventLoopDelayMs: 10,
        maxCpuUsagePercent: 80
      }
    },
    coverageThresholds: {
      global: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80
      },
      critical: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95
      },
      excludePatterns: [
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/node_modules/**',
        '**/coverage/**',
        '**/dist/**'
      ]
    },
    qualityGates: {
      minSuccessRate: 95,
      maxFailedTests: 5,
      maxCriticalFailures: 0,
      maxPerformanceRegressions: 2,
      requiredMVP1Features: [
        'knowledge-base-search',
        'entry-management',
        'basic-ui',
        'data-persistence',
        'error-handling'
      ]
    }
  };

  private static readonly TEST_SUITES: TestSuiteConfig[] = [
    // Unit Tests
    {
      name: 'components-unit',
      category: 'unit',
      path: 'src/renderer/components/**/*.test.tsx',
      priority: 1,
      timeout: 10000,
      parallel: true,
      tags: ['unit', 'components', 'fast'],
      mvp1Requirements: ['basic-ui', 'component-functionality']
    },
    {
      name: 'services-unit',
      category: 'unit',
      path: 'src/renderer/services/**/*.test.ts',
      priority: 1,
      timeout: 15000,
      parallel: true,
      tags: ['unit', 'services', 'fast'],
      mvp1Requirements: ['knowledge-base-search', 'data-services']
    },
    {
      name: 'utils-unit',
      category: 'unit',
      path: 'src/renderer/utils/**/*.test.ts',
      priority: 1,
      timeout: 5000,
      parallel: true,
      tags: ['unit', 'utilities', 'fast'],
      mvp1Requirements: ['utility-functions']
    },
    {
      name: 'database-unit',
      category: 'unit',
      path: 'tests/unit/**/*database*.test.ts',
      priority: 1,
      timeout: 15000,
      parallel: false, // Database tests should not run in parallel
      tags: ['unit', 'database', 'critical'],
      mvp1Requirements: ['data-persistence', 'knowledge-base-storage']
    },

    // Integration Tests
    {
      name: 'database-integration',
      category: 'integration',
      path: 'tests/integration/database/**/*.test.ts',
      priority: 2,
      timeout: 30000,
      parallel: false,
      tags: ['integration', 'database', 'critical'],
      mvp1Requirements: ['data-persistence', 'knowledge-base-storage', 'search-functionality']
    },
    {
      name: 'services-integration',
      category: 'integration',
      path: 'tests/integration/services/**/*.test.ts',
      priority: 2,
      timeout: 20000,
      parallel: true,
      tags: ['integration', 'services'],
      mvp1Requirements: ['knowledge-base-search', 'data-services', 'api-integration']
    },
    {
      name: 'components-integration',
      category: 'integration',
      path: 'tests/integration/components/**/*.test.ts',
      priority: 2,
      timeout: 25000,
      parallel: true,
      tags: ['integration', 'components'],
      mvp1Requirements: ['basic-ui', 'user-interactions']
    },
    {
      name: 'flows-integration',
      category: 'integration',
      path: 'tests/integration/flows/**/*.test.ts',
      priority: 2,
      timeout: 45000,
      parallel: false,
      tags: ['integration', 'flows', 'critical'],
      mvp1Requirements: ['user-workflows', 'end-to-end-functionality']
    },

    // Error Handling Tests
    {
      name: 'error-handling',
      category: 'error-handling',
      path: 'tests/integration/error-handling/**/*.test.ts',
      priority: 3,
      timeout: 60000,
      parallel: true,
      tags: ['error-handling', 'reliability', 'critical'],
      mvp1Requirements: ['error-handling', 'system-resilience']
    },

    // Performance Tests
    {
      name: 'search-performance',
      category: 'performance',
      path: 'tests/integration/performance/search-benchmark.integration.test.ts',
      priority: 4,
      timeout: 120000,
      parallel: false,
      tags: ['performance', 'search', 'critical'],
      mvp1Requirements: ['search-performance']
    },
    {
      name: 'memory-performance',
      category: 'performance',
      path: 'tests/integration/performance/memory-usage.test.ts',
      priority: 4,
      timeout: 90000,
      parallel: false,
      tags: ['performance', 'memory'],
      mvp1Requirements: ['memory-efficiency']
    },
    {
      name: 'load-testing',
      category: 'performance',
      path: 'tests/integration/performance/load-testing.integration.test.ts',
      priority: 4,
      timeout: 180000,
      parallel: false,
      tags: ['performance', 'load', 'stress'],
      mvp1Requirements: ['system-capacity']
    },

    // Reliability Tests
    {
      name: 'reliability-stress',
      category: 'reliability',
      path: 'tests/reliability/**/*.test.ts',
      priority: 5,
      timeout: 300000,
      parallel: false,
      tags: ['reliability', 'stress', 'long-running'],
      mvp1Requirements: ['system-stability', 'long-term-reliability']
    },

    // E2E Tests
    {
      name: 'user-workflows-e2e',
      category: 'e2e',
      path: 'tests/e2e/**/*.test.ts',
      priority: 6,
      timeout: 180000,
      parallel: false,
      dependencies: ['database-integration', 'services-integration'],
      tags: ['e2e', 'user-workflows', 'critical'],
      mvp1Requirements: ['end-to-end-functionality', 'user-workflows', 'complete-system']
    },

    // Accessibility Tests
    {
      name: 'accessibility',
      category: 'accessibility',
      path: 'tests/accessibility/**/*.test.ts',
      priority: 7,
      timeout: 60000,
      parallel: true,
      tags: ['accessibility', 'a11y'],
      mvp1Requirements: ['accessibility-compliance']
    },

    // Storage Tests
    {
      name: 'storage-comprehensive',
      category: 'storage',
      path: 'tests/storage/**/*.test.ts',
      priority: 3,
      timeout: 120000,
      parallel: false,
      tags: ['storage', 'data', 'critical'],
      mvp1Requirements: ['data-persistence', 'storage-reliability', 'backup-restore']
    }
  ];

  private static readonly ENVIRONMENTS: EnvironmentConfig[] = [
    {
      name: 'development',
      description: 'Local development environment',
      variables: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug',
        ENABLE_DEVTOOLS: 'true',
        DB_PATH: './dev-knowledge.db'
      }
    },
    {
      name: 'test',
      description: 'Automated testing environment',
      variables: {
        NODE_ENV: 'test',
        LOG_LEVEL: 'warn',
        ENABLE_DEVTOOLS: 'false',
        DB_PATH: ':memory:',
        DISABLE_ANIMATIONS: 'true',
        MOCK_EXTERNAL_APIS: 'true'
      }
    },
    {
      name: 'ci',
      description: 'Continuous Integration environment',
      variables: {
        NODE_ENV: 'test',
        LOG_LEVEL: 'error',
        ENABLE_DEVTOOLS: 'false',
        DB_PATH: './ci-test.db',
        DISABLE_ANIMATIONS: 'true',
        MOCK_EXTERNAL_APIS: 'true',
        HEADLESS: 'true',
        COVERAGE: 'true'
      }
    },
    {
      name: 'production',
      description: 'Production-like testing environment',
      variables: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'error',
        ENABLE_DEVTOOLS: 'false',
        DB_PATH: './prod-test-knowledge.db',
        DISABLE_ANIMATIONS: 'false',
        MOCK_EXTERNAL_APIS: 'false'
      }
    }
  ];

  constructor() {
    // Initialize configuration
  }

  mergeWithDefaults(config: TestRunConfig): Required<TestRunConfig> {
    return {
      ...TestConfig.DEFAULT_CONFIG,
      ...config,
      performanceThresholds: {
        ...TestConfig.DEFAULT_CONFIG.performanceThresholds,
        ...config.performanceThresholds
      },
      coverageThresholds: {
        ...TestConfig.DEFAULT_CONFIG.coverageThresholds,
        ...config.coverageThresholds
      },
      qualityGates: {
        ...TestConfig.DEFAULT_CONFIG.qualityGates,
        ...config.qualityGates
      }
    };
  }

  getTestSuites(): TestSuiteConfig[] {
    return [...TestConfig.TEST_SUITES].sort((a, b) => a.priority - b.priority);
  }

  getSuitesByCategory(category: string): TestSuiteConfig[] {
    return this.getTestSuites().filter(suite => suite.category === category);
  }

  getSuitesByTag(tag: string): TestSuiteConfig[] {
    return this.getTestSuites().filter(suite => suite.tags?.includes(tag));
  }

  getSuitesByMVP1Requirement(requirement: string): TestSuiteConfig[] {
    return this.getTestSuites().filter(suite => 
      suite.mvp1Requirements?.includes(requirement)
    );
  }

  getCriticalSuites(): TestSuiteConfig[] {
    return this.getTestSuites().filter(suite => suite.tags?.includes('critical'));
  }

  getFastSuites(): TestSuiteConfig[] {
    return this.getTestSuites().filter(suite => suite.tags?.includes('fast'));
  }

  getEnvironmentConfig(environment: string): EnvironmentConfig | undefined {
    return TestConfig.ENVIRONMENTS.find(env => env.name === environment);
  }

  getAllEnvironments(): EnvironmentConfig[] {
    return [...TestConfig.ENVIRONMENTS];
  }

  getCoverageConfig(): any {
    const config = TestConfig.DEFAULT_CONFIG.coverageThresholds;
    
    return {
      all: true,
      include: [
        'src/renderer/**/*.ts',
        'src/renderer/**/*.tsx',
        'src/main/**/*.ts',
        'src/shared/**/*.ts'
      ],
      exclude: config.excludePatterns,
      reporter: [
        'text',
        'text-summary',
        'html',
        'json',
        'lcov'
      ],
      reportDir: 'coverage',
      watermarks: {
        statements: [config.global.statements, config.critical.statements],
        functions: [config.global.functions, config.critical.functions],
        branches: [config.global.branches, config.critical.branches],
        lines: [config.global.lines, config.critical.lines]
      }
    };
  }

  getJestConfig(suite?: TestSuiteConfig): any {
    const baseConfig = {
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@renderer/(.*)$': '<rootDir>/src/renderer/$1',
        '^@main/(.*)$': '<rootDir>/src/main/$1',
        '^@shared/(.*)$': '<rootDir>/src/shared/$1',
        '\\.(css|less|scss)$': 'identity-obj-proxy'
      },
      transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
        '^.+\\.(js|jsx)$': 'babel-jest'
      },
      testTimeout: suite?.timeout || TestConfig.DEFAULT_CONFIG.testTimeout,
      verbose: true,
      collectCoverage: true,
      collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/__tests__/**',
        '!src/**/__mocks__/**'
      ],
      coverageThreshold: {
        global: TestConfig.DEFAULT_CONFIG.coverageThresholds.global
      }
    };

    if (suite) {
      baseConfig.displayName = `${suite.category}/${suite.name}`;
      baseConfig.testMatch = [suite.path];
    }

    return baseConfig;
  }

  async loadCustomConfig(configPath?: string): Promise<TestRunConfig> {
    const configFile = configPath || path.join(process.cwd(), 'test.config.json');
    
    try {
      const configData = await fs.readFile(configFile, 'utf-8');
      const customConfig = JSON.parse(configData);
      
      console.log(`📄 Loaded custom configuration from ${configFile}`);
      return customConfig;
    } catch (error) {
      if (configPath) {
        console.warn(`⚠️  Could not load custom configuration from ${configPath}:`, error.message);
      }
      return {};
    }
  }

  async saveConfig(config: TestRunConfig, outputPath?: string): Promise<void> {
    const configFile = outputPath || path.join(process.cwd(), 'test.config.json');
    
    const configToSave = {
      ...config,
      _generated: new Date().toISOString(),
      _version: '1.0.0'
    };

    await fs.writeFile(configFile, JSON.stringify(configToSave, null, 2));
    console.log(`💾 Configuration saved to ${configFile}`);
  }

  validateConfig(config: TestRunConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate basic constraints
    if (config.maxWorkers && config.maxWorkers < 1) {
      errors.push('maxWorkers must be at least 1');
    }

    if (config.testTimeout && config.testTimeout < 1000) {
      errors.push('testTimeout must be at least 1000ms');
    }

    if (config.reportRetentionDays && config.reportRetentionDays < 1) {
      errors.push('reportRetentionDays must be at least 1');
    }

    // Validate thresholds
    if (config.performanceThresholds?.search?.maxAvgResponseTimeMs && 
        config.performanceThresholds.search.maxAvgResponseTimeMs < 0) {
      errors.push('Performance thresholds must be positive numbers');
    }

    if (config.coverageThresholds?.global) {
      const coverage = config.coverageThresholds.global;
      const invalidCoverage = [coverage.statements, coverage.branches, coverage.functions, coverage.lines]
        .some(val => val < 0 || val > 100);
      
      if (invalidCoverage) {
        errors.push('Coverage thresholds must be between 0 and 100');
      }
    }

    // Validate suite selection
    if (config.suites) {
      const validSuiteNames = TestConfig.TEST_SUITES.map(s => s.name);
      const validCategories = [...new Set(TestConfig.TEST_SUITES.map(s => s.category))];
      
      const invalidSuites = config.suites.filter(suite => 
        !validSuiteNames.includes(suite) && !validCategories.includes(suite)
      );
      
      if (invalidSuites.length > 0) {
        errors.push(`Invalid suites specified: ${invalidSuites.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static getConfigTemplate(): TestRunConfig {
    return {
      // Suite selection
      suites: ['unit', 'integration', 'e2e'],
      skipSuites: ['performance', 'reliability'],
      
      // Execution
      parallel: true,
      maxWorkers: 4,
      testTimeout: 30000,
      failFast: false,
      
      // Reporting
      reportFormat: 'comprehensive',
      verbose: false,
      coverage: true,
      
      // MVP1
      validateMVP1: true,
      
      // Environment
      environment: 'test',
      
      // Performance thresholds
      performanceThresholds: {
        search: {
          maxAvgResponseTimeMs: 1000,
          maxP95ResponseTimeMs: 2000,
          maxP99ResponseTimeMs: 5000,
          minThroughputOpsPerSec: 100
        }
      },
      
      // Coverage thresholds
      coverageThresholds: {
        global: {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80
        },
        critical: {
          statements: 95,
          branches: 90,
          functions: 95,
          lines: 95
        }
      }
    };
  }

  static getMVP1TestMatrix(): Record<string, string[]> {
    return {
      'knowledge-base-search': [
        'components-unit',
        'services-unit',
        'database-integration',
        'search-performance'
      ],
      'entry-management': [
        'components-unit',
        'services-integration',
        'flows-integration'
      ],
      'basic-ui': [
        'components-unit',
        'components-integration',
        'accessibility'
      ],
      'data-persistence': [
        'database-unit',
        'database-integration',
        'storage-comprehensive'
      ],
      'error-handling': [
        'error-handling',
        'reliability-stress'
      ],
      'system-performance': [
        'search-performance',
        'memory-performance',
        'load-testing'
      ],
      'end-to-end-functionality': [
        'user-workflows-e2e',
        'flows-integration'
      ]
    };
  }

  static getQuickTestConfiguration(): TestRunConfig {
    return {
      suites: ['unit', 'components-integration'],
      parallel: true,
      maxWorkers: 4,
      testTimeout: 15000,
      reportFormat: 'summary',
      coverage: false,
      validateMVP1: false
    };
  }

  static getFullTestConfiguration(): TestRunConfig {
    return {
      suites: [],  // All suites
      parallel: true,
      maxWorkers: 4,
      testTimeout: 300000,
      reportFormat: 'comprehensive',
      coverage: true,
      validateMVP1: true,
      cleanOldReports: true
    };
  }

  static getCITestConfiguration(): TestRunConfig {
    return {
      suites: ['unit', 'integration', 'error-handling', 'e2e'],
      skipSuites: ['reliability'],  // Skip long-running reliability tests in CI
      parallel: true,
      maxWorkers: 2, // Limited workers for CI environment
      testTimeout: 60000,
      reportFormat: 'junit',
      coverage: true,
      validateMVP1: true,
      failFast: false, // Continue running all tests for comprehensive results
      environment: 'ci'
    };
  }
}

export default TestConfig;