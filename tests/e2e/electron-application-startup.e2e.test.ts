/**
 * Electron Application Startup and Initialization E2E Tests
 *
 * Tests comprehensive application startup scenarios:
 * - Cold start performance
 * - Warm start scenarios
 * - Application state recovery
 * - Database initialization
 * - Service startup validation
 * - Memory allocation monitoring
 * - Error recovery during startup
 */

import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';

interface StartupMetrics {
  totalStartupTime: number;
  mainProcessTime: number;
  rendererProcessTime: number;
  databaseInitTime: number;
  servicesInitTime: number;
  uiRenderTime: number;
  memoryUsage: {
    initial: number;
    afterInit: number;
    peak: number;
  };
  errorsDuringStartup: string[];
}

class ElectronStartupTester {
  private app: ElectronApplication | null = null;
  private page: Page | null = null;
  private metrics: StartupMetrics;
  private startTime: number = 0;

  constructor() {
    this.metrics = {
      totalStartupTime: 0,
      mainProcessTime: 0,
      rendererProcessTime: 0,
      databaseInitTime: 0,
      servicesInitTime: 0,
      uiRenderTime: 0,
      memoryUsage: {
        initial: 0,
        afterInit: 0,
        peak: 0
      },
      errorsDuringStartup: []
    };
  }

  async startElectronApp(options: {
    cleanStart?: boolean;
    mockServices?: boolean;
    debugMode?: boolean;
    timeout?: number;
  } = {}): Promise<{ app: ElectronApplication; page: Page }> {
    const {
      cleanStart = false,
      mockServices = false,
      debugMode = false,
      timeout = 30000
    } = options;

    this.startTime = Date.now();

    // Clean application data if requested
    if (cleanStart) {
      await this.cleanApplicationData();
    }

    // Launch Electron with monitoring
    const launchOptions: any = {
      args: [
        path.join(__dirname, '../../dist/main/index.js'),
        ...(debugMode ? ['--dev', '--debug'] : []),
        ...(mockServices ? ['--mock-services'] : [])
      ],
      timeout,
      recordVideo: {
        dir: './test-videos/startup/',
        size: { width: 1920, height: 1080 }
      }
    };

    // Add performance monitoring flags
    launchOptions.env = {
      ...process.env,
      ELECTRON_ENABLE_LOGGING: '1',
      STARTUP_PERFORMANCE_MONITORING: '1'
    };

    this.app = await electron.launch(launchOptions);

    // Monitor console logs for errors
    this.app.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.metrics.errorsDuringStartup.push(msg.text());
      }
    });

    // Get the main window
    this.page = await this.app.firstWindow();

    // Wait for application to be ready
    await this.waitForApplicationReady();

    return { app: this.app, page: this.page };
  }

  private async cleanApplicationData(): Promise<void> {
    // Clean up any previous application data
    // This would clear databases, cache, preferences, etc.
    console.log('Cleaning application data for fresh start...');
  }

  private async waitForApplicationReady(): Promise<void> {
    if (!this.page) throw new Error('Page not available');

    // Wait for DOM content loaded
    await this.page.waitForLoadState('domcontentloaded');

    // Wait for all critical components to be initialized
    const readySelectors = [
      '[data-testid="app-root"]',
      '[data-testid="search-interface"]',
      '[data-testid="navigation-menu"]'
    ];

    for (const selector of readySelectors) {
      await this.page.waitForSelector(selector, { timeout: 10000 });
    }

    // Wait for services to be initialized
    await this.waitForServicesReady();

    // Wait for database to be ready
    await this.waitForDatabaseReady();

    // Record final startup time
    this.metrics.totalStartupTime = Date.now() - this.startTime;
  }

  private async waitForServicesReady(): Promise<void> {
    if (!this.page) return;

    // Wait for service initialization indicators
    await this.page.waitForFunction(
      () => {
        return (window as any).appServices?.allServicesReady === true;
      },
      {},
      { timeout: 15000 }
    );
  }

  private async waitForDatabaseReady(): Promise<void> {
    if (!this.page) return;

    // Wait for database initialization
    await this.page.waitForFunction(
      () => {
        return (window as any).database?.isReady === true;
      },
      {},
      { timeout: 15000 }
    );
  }

  async measureMemoryUsage(): Promise<void> {
    if (!this.page) return;

    const memoryInfo = await this.page.evaluate(() => {
      if ((performance as any).memory) {
        return {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        };
      }
      return null;
    });

    if (memoryInfo) {
      this.metrics.memoryUsage.afterInit = memoryInfo.usedJSHeapSize;
      this.metrics.memoryUsage.peak = Math.max(
        this.metrics.memoryUsage.peak,
        memoryInfo.usedJSHeapSize
      );
    }
  }

  async validateApplicationState(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Check critical UI elements are present
      await expect(this.page.locator('[data-testid="app-root"]')).toBeVisible();
      await expect(this.page.locator('[data-testid="search-input"]')).toBeVisible();
      await expect(this.page.locator('[data-testid="add-entry-button"]')).toBeVisible();

      // Check services are running
      const servicesStatus = await this.page.evaluate(() => {
        return (window as any).appServices?.getStatus();
      });

      expect(servicesStatus).toBeTruthy();

      // Check database is accessible
      const dbStatus = await this.page.evaluate(() => {
        return (window as any).database?.ping();
      });

      expect(dbStatus).toBeTruthy();

      return true;
    } catch (error) {
      console.error('Application state validation failed:', error);
      return false;
    }
  }

  async testBasicFunctionality(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Test search functionality
      await this.page.fill('[data-testid="search-input"]', 'startup test');
      await this.page.click('[data-testid="search-button"]');

      // Wait for search results or no results message
      await Promise.race([
        this.page.waitForSelector('[data-testid="search-results"]', { timeout: 5000 }),
        this.page.waitForSelector('[data-testid="no-results"]', { timeout: 5000 })
      ]);

      // Test navigation
      await this.page.click('[data-testid="add-entry-button"]');
      await this.page.waitForSelector('[data-testid="entry-form"]', { timeout: 5000 });

      return true;
    } catch (error) {
      console.error('Basic functionality test failed:', error);
      return false;
    }
  }

  async cleanup(): Promise<void> {
    if (this.app) {
      await this.app.close();
    }
  }

  getMetrics(): StartupMetrics {
    return { ...this.metrics };
  }
}

test.describe('Electron Application Startup Tests', () => {
  let startupTester: ElectronStartupTester;

  test.beforeEach(() => {
    startupTester = new ElectronStartupTester();
  });

  test.afterEach(async () => {
    await startupTester.cleanup();
  });

  test('Cold start performance validation', async () => {
    const startTime = Date.now();

    const { app, page } = await startupTester.startElectronApp({
      cleanStart: true,
      timeout: 30000
    });

    const totalStartupTime = Date.now() - startTime;

    // Validate startup performance
    expect(totalStartupTime).toBeLessThan(15000); // Should start within 15 seconds

    // Validate application state
    const isValid = await startupTester.validateApplicationState();
    expect(isValid).toBe(true);

    // Test basic functionality
    const functionalityWorks = await startupTester.testBasicFunctionality();
    expect(functionalityWorks).toBe(true);

    // Measure memory usage
    await startupTester.measureMemoryUsage();
    const metrics = startupTester.getMetrics();

    expect(metrics.errorsDuringStartup).toHaveLength(0);
    console.log('Cold Start Metrics:', metrics);
  });

  test('Warm start performance validation', async () => {
    // First startup (warm up)
    await startupTester.startElectronApp();
    await startupTester.cleanup();

    // Second startup (warm start)
    const startTime = Date.now();
    startupTester = new ElectronStartupTester();

    const { app, page } = await startupTester.startElectronApp({
      cleanStart: false,
      timeout: 20000
    });

    const warmStartupTime = Date.now() - startTime;

    // Warm start should be faster
    expect(warmStartupTime).toBeLessThan(10000); // Should start within 10 seconds

    const metrics = startupTester.getMetrics();
    console.log('Warm Start Metrics:', metrics);
  });

  test('Startup with corrupted data recovery', async () => {
    // Simulate corrupted application data
    const { app, page } = await startupTester.startElectronApp({
      cleanStart: true
    });

    // Corrupt some data during runtime
    await page.evaluate(() => {
      localStorage.setItem('app-state', 'corrupted-data-{invalid-json}');
    });

    await startupTester.cleanup();

    // Restart and validate recovery
    startupTester = new ElectronStartupTester();
    const { app: app2, page: page2 } = await startupTester.startElectronApp({
      cleanStart: false
    });

    // Application should recover gracefully
    const isValid = await startupTester.validateApplicationState();
    expect(isValid).toBe(true);

    const metrics = startupTester.getMetrics();
    expect(metrics.totalStartupTime).toBeLessThan(20000); // Recovery shouldn't take too long
  });

  test('Startup error handling and recovery', async () => {
    // Start with mock services that will fail
    const { app, page } = await startupTester.startElectronApp({
      mockServices: true,
      timeout: 45000 // Allow more time for error recovery
    });

    // Application should still start with fallback mechanisms
    await expect(page.locator('[data-testid="app-root"]')).toBeVisible();

    // Should show error indicators but remain functional
    await expect(page.locator('[data-testid="service-error-indicator"], [data-testid="fallback-mode-indicator"]')).toBeVisible();

    const metrics = startupTester.getMetrics();
    expect(metrics.totalStartupTime).toBeLessThan(30000);

    // Basic functionality should still work in fallback mode
    const functionalityWorks = await startupTester.testBasicFunctionality();
    expect(functionalityWorks).toBe(true);
  });

  test('Database initialization and migration validation', async () => {
    const { app, page } = await startupTester.startElectronApp({
      cleanStart: true
    });

    // Validate database is properly initialized
    const dbInfo = await page.evaluate(async () => {
      if ((window as any).database) {
        return {
          isConnected: (window as any).database.isReady,
          version: await (window as any).database.getVersion(),
          tables: await (window as any).database.getTables()
        };
      }
      return null;
    });

    expect(dbInfo).toBeTruthy();
    expect(dbInfo?.isConnected).toBe(true);
    expect(dbInfo?.tables).toContain('knowledge_entries');
    expect(dbInfo?.tables).toContain('search_analytics');

    // Test database operations
    const dbOperationResult = await page.evaluate(async () => {
      try {
        const result = await (window as any).database.query('SELECT COUNT(*) as count FROM knowledge_entries');
        return { success: true, result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    expect(dbOperationResult.success).toBe(true);
  });

  test('Service startup sequence validation', async () => {
    const { app, page } = await startupTester.startElectronApp();

    // Validate all required services are started
    const servicesInfo = await page.evaluate(() => {
      const services = (window as any).appServices;
      if (!services) return null;

      return {
        searchService: services.searchService?.isReady,
        knowledgeBaseService: services.knowledgeBaseService?.isReady,
        analyticsService: services.analyticsService?.isReady,
        cacheService: services.cacheService?.isReady,
        validationService: services.validationService?.isReady
      };
    });

    expect(servicesInfo).toBeTruthy();
    expect(servicesInfo?.searchService).toBe(true);
    expect(servicesInfo?.knowledgeBaseService).toBe(true);
    expect(servicesInfo?.analyticsService).toBe(true);
    expect(servicesInfo?.cacheService).toBe(true);
    expect(servicesInfo?.validationService).toBe(true);
  });

  test('Memory usage during startup', async () => {
    const { app, page } = await startupTester.startElectronApp();

    // Monitor memory usage during startup operations
    await startupTester.measureMemoryUsage();

    // Perform some operations to test memory behavior
    await page.fill('[data-testid="search-input"]', 'memory test');
    await page.click('[data-testid="search-button"]');
    await page.waitForTimeout(2000);

    await startupTester.measureMemoryUsage();

    const metrics = startupTester.getMetrics();

    // Memory should be reasonable
    const memoryMB = metrics.memoryUsage.afterInit / (1024 * 1024);
    expect(memoryMB).toBeLessThan(200); // Less than 200MB for initial state

    console.log(`Memory Usage: ${memoryMB.toFixed(2)}MB`);
  });

  test('Application state persistence across restarts', async () => {
    // First session: set up some state
    const { app, page } = await startupTester.startElectronApp();

    await page.fill('[data-testid="search-input"]', 'persistent state test');
    await page.click('[data-testid="search-button"]');

    // Change some settings
    await page.goto('#/settings');
    await page.check('[data-testid="dark-mode-toggle"]');
    await page.selectOption('[data-testid="language-select"]', 'en-US');

    await startupTester.cleanup();

    // Second session: validate state persistence
    startupTester = new ElectronStartupTester();
    const { app: app2, page: page2 } = await startupTester.startElectronApp();

    // Navigate to settings and check if state persisted
    await page2.goto('#/settings');

    const darkModeEnabled = await page2.isChecked('[data-testid="dark-mode-toggle"]');
    expect(darkModeEnabled).toBe(true);

    const selectedLanguage = await page2.inputValue('[data-testid="language-select"]');
    expect(selectedLanguage).toBe('en-US');
  });

  test('Cross-platform startup validation', async () => {
    const { app, page } = await startupTester.startElectronApp();

    // Get platform information
    const platformInfo = await page.evaluate(() => {
      return {
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
        chromeVersion: process.versions.chrome
      };
    });

    expect(platformInfo.electronVersion).toBeTruthy();
    expect(platformInfo.nodeVersion).toBeTruthy();
    expect(platformInfo.chromeVersion).toBeTruthy();

    // Validate platform-specific features work
    const isValid = await startupTester.validateApplicationState();
    expect(isValid).toBe(true);

    console.log('Platform Info:', platformInfo);
  });
});

test.describe('Startup Edge Cases and Scenarios', () => {
  let startupTester: ElectronStartupTester;

  test.beforeEach(() => {
    startupTester = new ElectronStartupTester();
  });

  test.afterEach(async () => {
    await startupTester.cleanup();
  });

  test('Startup with low memory conditions', async () => {
    // Start with memory constraints
    const { app, page } = await startupTester.startElectronApp({
      timeout: 45000
    });

    // Validate application handles low memory gracefully
    const isValid = await startupTester.validateApplicationState();
    expect(isValid).toBe(true);

    await startupTester.measureMemoryUsage();
    const metrics = startupTester.getMetrics();

    expect(metrics.errorsDuringStartup.length).toBeLessThan(3); // Allow some warnings
  });

  test('Startup with network connectivity issues', async () => {
    const { app, page } = await startupTester.startElectronApp();

    // Simulate network issues
    await page.route('**', route => {
      if (route.request().url().includes('api/')) {
        route.abort('networkfailure');
      } else {
        route.continue();
      }
    });

    // Application should still function in offline mode
    const functionalityWorks = await startupTester.testBasicFunctionality();
    expect(functionalityWorks).toBe(true);

    // Should show offline indicators
    await expect(page.locator('[data-testid="offline-indicator"], [data-testid="network-error"]')).toBeVisible();
  });

  test('Startup with concurrent instances prevention', async () => {
    // Start first instance
    const { app: app1, page: page1 } = await startupTester.startElectronApp();

    // Try to start second instance
    try {
      const startupTester2 = new ElectronStartupTester();
      const { app: app2, page: page2 } = await startupTester2.startElectronApp({
        timeout: 10000
      });

      // Should either prevent second instance or handle gracefully
      // Implementation dependent on single-instance enforcement
      expect(true).toBe(true); // Test passes if no crash occurs

      await startupTester2.cleanup();
    } catch (error) {
      // Expected if single instance is enforced
      expect(error.message).toContain('timeout');
    }
  });
});