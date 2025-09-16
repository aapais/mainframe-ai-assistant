/**
 * Comprehensive Test Configuration
 * Central configuration for all testing frameworks and CI/CD integration
 */

import { vi } from 'vitest';

/**
 * Global Test Configuration
 */
export interface GlobalTestConfig {
  // Environment settings
  environment: 'development' | 'testing' | 'ci' | 'production';
  testTimeout: number;
  retries: number;
  parallel: boolean;
  maxWorkers: number;

  // Coverage settings
  coverage: {
    enabled: boolean;
    threshold: {
      global: {
        branches: number;
        functions: number;
        lines: number;
        statements: number;
      };
      perFile: {
        branches: number;
        functions: number;
        lines: number;
        statements: number;
      };
    };
    exclude: string[];
    reporters: string[];
    outputDir: string;
  };

  // Database testing
  database: {
    testDbPath: string;
    useInMemory: boolean;
    seedData: boolean;
    seedSize: number;
    resetBetweenTests: boolean;
  };

  // Performance testing
  performance: {
    enabled: boolean;
    searchResponseTime: number;
    databaseQueryTime: number;
    memoryUsageLimit: number;
    reportFormat: 'json' | 'html' | 'markdown';
  };

  // Accessibility testing
  accessibility: {
    enabled: boolean;
    wcagLevel: 'A' | 'AA' | 'AAA';
    runAxeTests: boolean;
    checkColorContrast: boolean;
    testKeyboardNavigation: boolean;
  };

  // Visual regression testing
  visual: {
    enabled: boolean;
    updateBaselines: boolean;
    threshold: number;
    browsers: string[];
    viewports: Array<{ width: number; height: number; name: string }>;
  };

  // E2E testing
  e2e: {
    enabled: boolean;
    headless: boolean;
    recordVideo: boolean;
    takeScreenshots: boolean;
    appPath: string;
    baseUrl?: string;
  };

  // Mocking and fixtures
  mocking: {
    mockElectronAPI: boolean;
    mockGeminiService: boolean;
    mockFileSystem: boolean;
    fixturesPath: string;
  };

  // Reporting
  reporting: {
    outputDir: string;
    formats: string[];
    includeSourceCode: boolean;
    generateBadges: boolean;
  };
}

/**
 * Default Test Configuration
 */
export const DEFAULT_TEST_CONFIG: GlobalTestConfig = {
  environment: 'testing',
  testTimeout: 30000,
  retries: 2,
  parallel: true,
  maxWorkers: 4,

  coverage: {
    enabled: true,
    threshold: {
      global: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70
      },
      perFile: {
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60
      }
    },
    exclude: [
      '**/*.d.ts',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/test-utils/**',
      '**/fixtures/**',
      '**/mocks/**',
      '**/node_modules/**'
    ],
    reporters: ['text', 'html', 'lcov', 'cobertura'],
    outputDir: './coverage'
  },

  database: {
    testDbPath: ':memory:',
    useInMemory: true,
    seedData: true,
    seedSize: 100,
    resetBetweenTests: true
  },

  performance: {
    enabled: true,
    searchResponseTime: 1000,
    databaseQueryTime: 500,
    memoryUsageLimit: 200,
    reportFormat: 'html'
  },

  accessibility: {
    enabled: true,
    wcagLevel: 'AA',
    runAxeTests: true,
    checkColorContrast: true,
    testKeyboardNavigation: true
  },

  visual: {
    enabled: false, // Disabled by default in CI
    updateBaselines: false,
    threshold: 0.2,
    browsers: ['chromium'],
    viewports: [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ]
  },

  e2e: {
    enabled: false, // Disabled by default in unit tests
    headless: true,
    recordVideo: false,
    takeScreenshots: true,
    appPath: './dist/main/index.js'
  },

  mocking: {
    mockElectronAPI: true,
    mockGeminiService: true,
    mockFileSystem: false,
    fixturesPath: './tests/fixtures'
  },

  reporting: {
    outputDir: './test-reports',
    formats: ['html', 'json', 'junit'],
    includeSourceCode: false,
    generateBadges: true
  }
};

/**
 * Environment-specific configurations
 */
export const CI_TEST_CONFIG: Partial<GlobalTestConfig> = {
  environment: 'ci',
  parallel: true,
  maxWorkers: 2,
  e2e: {
    enabled: true,
    headless: true,
    recordVideo: false,
    takeScreenshots: true,
    appPath: './dist/main/index.js'
  },
  visual: {
    enabled: true,
    updateBaselines: false,
    threshold: 0.5, // More lenient in CI
    browsers: ['chromium'] // Only test chromium in CI
  },
  coverage: {
    enabled: true,
    threshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      },
      perFile: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70
      }
    },
    exclude: [
      '**/*.d.ts',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/test-utils/**',
      '**/fixtures/**',
      '**/mocks/**',
      '**/node_modules/**'
    ],
    reporters: ['text', 'lcov', 'cobertura'],
    outputDir: './coverage'
  }
};

export const DEVELOPMENT_TEST_CONFIG: Partial<GlobalTestConfig> = {
  environment: 'development',
  parallel: false,
  maxWorkers: 1,
  testTimeout: 60000,
  retries: 0,
  e2e: {
    enabled: false,
    headless: false,
    recordVideo: true,
    takeScreenshots: true,
    appPath: './dist/main/index.js'
  },
  visual: {
    enabled: true,
    updateBaselines: true,
    threshold: 0.1,
    browsers: ['chromium', 'firefox', 'webkit']
  },
  coverage: {
    enabled: true,
    threshold: {
      global: {
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60
      },
      perFile: {
        branches: 50,
        functions: 50,
        lines: 50,
        statements: 50
      }
    },
    exclude: [
      '**/*.d.ts',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/test-utils/**',
      '**/fixtures/**',
      '**/mocks/**',
      '**/node_modules/**'
    ],
    reporters: ['text', 'html'],
    outputDir: './coverage'
  }
};

/**
 * Test Configuration Manager
 */
export class TestConfigManager {
  private static instance: TestConfigManager;
  private config: GlobalTestConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  static getInstance(): TestConfigManager {
    if (!TestConfigManager.instance) {
      TestConfigManager.instance = new TestConfigManager();
    }
    return TestConfigManager.instance;
  }

  private loadConfiguration(): GlobalTestConfig {
    const environment = process.env.NODE_ENV || 'testing';
    const isCI = process.env.CI === 'true';

    let config = { ...DEFAULT_TEST_CONFIG };

    if (isCI) {
      config = { ...config, ...CI_TEST_CONFIG };
    } else if (environment === 'development') {
      config = { ...config, ...DEVELOPMENT_TEST_CONFIG };
    }

    // Override with environment variables
    this.applyEnvironmentOverrides(config);

    return config;
  }

  private applyEnvironmentOverrides(config: GlobalTestConfig): void {
    // Test timeout
    if (process.env.TEST_TIMEOUT) {
      config.testTimeout = parseInt(process.env.TEST_TIMEOUT, 10);
    }

    // Coverage thresholds
    if (process.env.COVERAGE_THRESHOLD) {
      const threshold = parseInt(process.env.COVERAGE_THRESHOLD, 10);
      config.coverage.threshold.global.branches = threshold;
      config.coverage.threshold.global.functions = threshold;
      config.coverage.threshold.global.lines = threshold;
      config.coverage.threshold.global.statements = threshold;
    }

    // E2E settings
    if (process.env.E2E_HEADLESS) {
      config.e2e.headless = process.env.E2E_HEADLESS === 'true';
    }

    if (process.env.E2E_BASE_URL) {
      config.e2e.baseUrl = process.env.E2E_BASE_URL;
    }

    // Visual testing
    if (process.env.VISUAL_UPDATE_BASELINES) {
      config.visual.updateBaselines = process.env.VISUAL_UPDATE_BASELINES === 'true';
    }

    if (process.env.VISUAL_THRESHOLD) {
      config.visual.threshold = parseFloat(process.env.VISUAL_THRESHOLD);
    }

    // Database settings
    if (process.env.TEST_DB_PATH) {
      config.database.testDbPath = process.env.TEST_DB_PATH;
      config.database.useInMemory = false;
    }

    // Performance settings
    if (process.env.PERF_SEARCH_TIMEOUT) {
      config.performance.searchResponseTime = parseInt(process.env.PERF_SEARCH_TIMEOUT, 10);
    }

    if (process.env.PERF_MEMORY_LIMIT) {
      config.performance.memoryUsageLimit = parseInt(process.env.PERF_MEMORY_LIMIT, 10);
    }
  }

  getConfig(): GlobalTestConfig {
    return this.config;
  }

  updateConfig(updates: Partial<GlobalTestConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  isFeatureEnabled(feature: keyof GlobalTestConfig): boolean {
    const featureConfig = this.config[feature];
    if (typeof featureConfig === 'object' && 'enabled' in featureConfig) {
      return featureConfig.enabled;
    }
    return true;
  }

  isDevelopment(): boolean {
    return this.config.environment === 'development';
  }

  isCI(): boolean {
    return this.config.environment === 'ci';
  }

  isTesting(): boolean {
    return this.config.environment === 'testing';
  }

  getPerformanceConfig() {
    return this.config.performance;
  }

  getAccessibilityConfig() {
    return this.config.accessibility;
  }

  getVisualConfig() {
    return this.config.visual;
  }

  getE2EConfig() {
    return this.config.e2e;
  }

  getCoverageConfig() {
    return this.config.coverage;
  }

  getDatabaseConfig() {
    return this.config.database;
  }
}

/**
 * Test Setup Utilities
 */
export class TestSetup {
  private config: GlobalTestConfig;

  constructor() {
    this.config = TestConfigManager.getInstance().getConfig();
  }

  async setupGlobalMocks(): Promise<void> {
    if (this.config.mocking.mockElectronAPI) {
      this.setupElectronMocks();
    }

    if (this.config.mocking.mockGeminiService) {
      this.setupGeminiMocks();
    }

    if (this.config.mocking.mockFileSystem) {
      this.setupFileSystemMocks();
    }
  }

  private setupElectronMocks(): void {
    const mockElectronAPI = {
      searchKB: vi.fn().mockResolvedValue([]),
      addKBEntry: vi.fn().mockResolvedValue('test-id'),
      getKBEntry: vi.fn().mockResolvedValue(null),
      getGeminiConfig: vi.fn().mockResolvedValue({ apiKey: 'test-key' }),
      showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
      showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: '/test/path' }),
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/test/path'] })
    };

    (global as any).window = {
      electronAPI: mockElectronAPI
    };
  }

  private setupGeminiMocks(): void {
    vi.mock('../../src/services/GeminiService', () => ({
      GeminiService: vi.fn().mockImplementation(() => ({
        findSimilar: vi.fn().mockResolvedValue([]),
        explainError: vi.fn().mockResolvedValue('Mock explanation'),
        analyzeCode: vi.fn().mockResolvedValue('Mock analysis'),
        generateSummary: vi.fn().mockResolvedValue('Mock summary')
      }))
    }));
  }

  private setupFileSystemMocks(): void {
    vi.mock('fs', () => ({
      readFileSync: vi.fn().mockReturnValue('mock file content'),
      writeFileSync: vi.fn(),
      existsSync: vi.fn().mockReturnValue(true),
      mkdirSync: vi.fn(),
      unlinkSync: vi.fn()
    }));
  }

  async setupTestDatabase(): Promise<any> {
    if (this.config.database.useInMemory) {
      const { TestDatabaseFactory } = await import('./utils/TestingUtilities');
      return TestDatabaseFactory.createTestDatabaseManager({
        path: ':memory:',
        enableMonitoring: false
      });
    }

    // Setup file-based test database
    const { TestDatabaseFactory } = await import('./utils/TestingUtilities');
    return TestDatabaseFactory.createTestDatabaseManager({
      path: this.config.database.testDbPath,
      enableMonitoring: false
    });
  }

  async cleanupTestDatabase(db: any): Promise<void> {
    if (db && typeof db.close === 'function') {
      await db.close();
    }
  }

  setupPerformanceMonitoring(): void {
    if (!this.config.performance.enabled) return;

    // Setup performance observers
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > this.config.performance.searchResponseTime) {
            console.warn(`Slow operation detected: ${entry.name} took ${entry.duration}ms`);
          }
        }
      });

      observer.observe({ entryTypes: ['measure'] });
    }
  }

  generateTestReport(): void {
    const report = {
      timestamp: new Date().toISOString(),
      environment: this.config.environment,
      configuration: this.config,
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      }
    };

    console.log('Test Configuration Report:', JSON.stringify(report, null, 2));
  }
}

/**
 * Jest/Vitest Configuration Generator
 */
export function generateVitestConfig(customConfig?: Partial<GlobalTestConfig>) {
  const config = TestConfigManager.getInstance().getConfig();
  const finalConfig = { ...config, ...customConfig };

  return {
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      coverage: {
        enabled: finalConfig.coverage.enabled,
        provider: 'v8',
        reporter: finalConfig.coverage.reporters,
        reportsDirectory: finalConfig.coverage.outputDir,
        thresholds: finalConfig.coverage.threshold.global,
        exclude: finalConfig.coverage.exclude
      },
      testTimeout: finalConfig.testTimeout,
      pool: finalConfig.parallel ? 'threads' : 'forks',
      poolOptions: {
        threads: {
          maxThreads: finalConfig.maxWorkers,
          minThreads: 1
        }
      }
    }
  };
}

export function generatePlaywrightConfig(customConfig?: Partial<GlobalTestConfig>) {
  const config = TestConfigManager.getInstance().getConfig();
  const finalConfig = { ...config, ...customConfig };

  return {
    testDir: './tests/e2e',
    timeout: finalConfig.testTimeout,
    retries: finalConfig.retries,
    workers: finalConfig.maxWorkers,
    use: {
      headless: finalConfig.e2e.headless,
      screenshot: finalConfig.e2e.takeScreenshots ? 'only-on-failure' : 'off',
      video: finalConfig.e2e.recordVideo ? 'retain-on-failure' : 'off'
    },
    projects: finalConfig.visual.browsers.map(browser => ({
      name: browser,
      use: { ...require(`@playwright/test`).devices[browser] }
    }))
  };
}

// Export configuration utilities
export {
  TestConfigManager,
  TestSetup,
  generateVitestConfig,
  generatePlaywrightConfig
};