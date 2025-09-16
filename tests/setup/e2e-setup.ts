/**
 * End-to-End Test Setup
 * Configuration for testing complete user journeys and system interactions
 */

import { jest } from '@jest/globals';
import { Page, Browser, BrowserContext, chromium, firefox, webkit } from 'playwright';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

// E2E Test Configuration
export const e2eConfig = {
  // Application configuration
  app: {
    url: 'http://localhost:3000',
    electronPath: path.join(process.cwd(), 'node_modules/.bin/electron'),
    appPath: path.join(process.cwd(), 'dist/main/index.js'),
    timeout: 30000,
    slowMo: process.env.E2E_SLOW_MO ? parseInt(process.env.E2E_SLOW_MO) : 0
  },

  // Browser configuration for web-based tests
  browser: {
    headless: process.env.E2E_HEADLESS !== 'false',
    viewport: { width: 1280, height: 720 },
    video: process.env.E2E_VIDEO === 'true' ? 'on' : 'off',
    screenshot: 'only-on-failure',
    trace: process.env.E2E_TRACE === 'true'
  },

  // Test data configuration
  testData: {
    searchQueries: [
      'VSAM Status 35',
      'S0C7 data exception',
      'DB2 SQLCODE -904',
      'JCL dataset not found',
      'memory allocation failure',
      'CICS timeout',
      'sort utility error',
      'FTP connection failed'
    ],
    performanceQueries: [
      'error',
      'status',
      'VSAM',
      'DB2',
      'JCL',
      'batch'
    ],
    stressTestQueries: Array.from({ length: 100 }, (_, i) => `test query ${i + 1}`)
  },

  // Performance thresholds
  performance: {
    searchResponse: 2000, // 2 seconds max
    pageLoad: 5000, // 5 seconds max
    indexing: 10000, // 10 seconds max for large datasets
    memoryUsage: 512 * 1024 * 1024, // 512MB max
    cpuUsage: 80 // 80% max
  },

  // Accessibility configuration
  accessibility: {
    standards: ['wcag2a', 'wcag2aa'],
    tags: ['cat.keyboard', 'cat.forms', 'cat.navigation', 'cat.structure'],
    rules: {
      'color-contrast': { enabled: true },
      'keyboard-navigation': { enabled: true },
      'focus-management': { enabled: true },
      'semantic-markup': { enabled: true }
    }
  }
};

// Browser Management
export class BrowserManager {
  private browsers: Map<string, Browser> = new Map();
  private contexts: Map<string, BrowserContext> = new Map();

  async launchBrowser(browserType: 'chromium' | 'firefox' | 'webkit' = 'chromium'): Promise<Browser> {
    if (this.browsers.has(browserType)) {
      return this.browsers.get(browserType)!;
    }

    let browser: Browser;
    const launchOptions = {
      headless: e2eConfig.browser.headless,
      slowMo: e2eConfig.app.slowMo,
      args: browserType === 'chromium' ? [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-extensions'
      ] : []
    };

    switch (browserType) {
      case 'chromium':
        browser = await chromium.launch(launchOptions);
        break;
      case 'firefox':
        browser = await firefox.launch(launchOptions);
        break;
      case 'webkit':
        browser = await webkit.launch(launchOptions);
        break;
      default:
        throw new Error(`Unsupported browser type: ${browserType}`);
    }

    this.browsers.set(browserType, browser);
    return browser;
  }

  async createContext(browserType: string = 'chromium'): Promise<BrowserContext> {
    const browser = await this.launchBrowser(browserType as any);
    const contextId = `${browserType}_${Date.now()}`;

    const context = await browser.newContext({
      viewport: e2eConfig.browser.viewport,
      recordVideo: e2eConfig.browser.video === 'on' ? {
        dir: path.join(process.cwd(), 'test-results', 'videos')
      } : undefined,
      recordHar: process.env.E2E_HAR === 'true' ? {
        path: path.join(process.cwd(), 'test-results', 'har', `${contextId}.har`)
      } : undefined
    });

    // Enable trace if configured
    if (e2eConfig.browser.trace) {
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true
      });
    }

    this.contexts.set(contextId, context);
    return context;
  }

  async closeBrowsers(): Promise<void> {
    for (const [id, context] of this.contexts) {
      try {
        if (e2eConfig.browser.trace) {
          await context.tracing.stop({
            path: path.join(process.cwd(), 'test-results', 'traces', `${id}.zip`)
          });
        }
        await context.close();
      } catch (error) {
        console.warn(`Failed to close context ${id}:`, error);
      }
    }

    for (const browser of this.browsers.values()) {
      try {
        await browser.close();
      } catch (error) {
        console.warn('Failed to close browser:', error);
      }
    }

    this.browsers.clear();
    this.contexts.clear();
  }
}

// Electron Application Manager
export class ElectronManager {
  private electronProcess: ChildProcess | null = null;
  private isReady = false;

  async startElectronApp(): Promise<void> {
    if (this.electronProcess && !this.electronProcess.killed) {
      return;
    }

    return new Promise((resolve, reject) => {
      const args = [
        e2eConfig.app.appPath,
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--remote-debugging-port=9222'
      ];

      this.electronProcess = spawn(e2eConfig.app.electronPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          E2E_TEST: 'true'
        }
      });

      // Handle startup
      const timeout = setTimeout(() => {
        this.killElectronApp();
        reject(new Error('Electron app startup timeout'));
      }, e2eConfig.app.timeout);

      this.electronProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('[Electron stdout]:', output);

        if (output.includes('Main window created') || output.includes('App ready')) {
          this.isReady = true;
          clearTimeout(timeout);
          resolve();
        }
      });

      this.electronProcess.stderr?.on('data', (data) => {
        console.error('[Electron stderr]:', data.toString());
      });

      this.electronProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.electronProcess.on('exit', (code, signal) => {
        this.isReady = false;
        console.log(`Electron process exited with code ${code} and signal ${signal}`);
      });
    });
  }

  async killElectronApp(): Promise<void> {
    if (this.electronProcess && !this.electronProcess.killed) {
      this.electronProcess.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        if (!this.electronProcess) {
          resolve();
          return;
        }

        const timeout = setTimeout(() => {
          if (this.electronProcess && !this.electronProcess.killed) {
            this.electronProcess.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.electronProcess.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    this.electronProcess = null;
    this.isReady = false;
  }

  isAppReady(): boolean {
    return this.isReady;
  }
}

// Page Helper for common operations
export class PageHelper {
  constructor(private page: Page) {}

  async waitForSearchInterface(): Promise<void> {
    await this.page.waitForSelector('[data-testid="search-input"]', {
      timeout: e2eConfig.app.timeout
    });
    await this.page.waitForSelector('[data-testid="search-button"]', {
      timeout: e2eConfig.app.timeout
    });
  }

  async performSearch(query: string): Promise<void> {
    await this.page.fill('[data-testid="search-input"]', query);
    await this.page.click('[data-testid="search-button"]');

    // Wait for results or no results message
    await Promise.race([
      this.page.waitForSelector('[data-testid="search-results"]'),
      this.page.waitForSelector('[data-testid="no-results"]'),
      this.page.waitForSelector('[data-testid="search-error"]')
    ]);
  }

  async waitForResults(timeout: number = 5000): Promise<number> {
    try {
      await this.page.waitForSelector('[data-testid="search-results"]', { timeout });
      const results = await this.page.locator('[data-testid="search-result-item"]').count();
      return results;
    } catch {
      // Check for no results or error state
      const noResults = await this.page.locator('[data-testid="no-results"]').count();
      const error = await this.page.locator('[data-testid="search-error"]').count();

      if (noResults > 0 || error > 0) {
        return 0;
      }
      throw new Error('Search results did not appear within timeout');
    }
  }

  async selectSearchResult(index: number): Promise<void> {
    const results = this.page.locator('[data-testid="search-result-item"]');
    await results.nth(index).click();

    // Wait for detail view
    await this.page.waitForSelector('[data-testid="entry-detail"]');
  }

  async measureSearchPerformance(query: string): Promise<{
    searchTime: number;
    resultCount: number;
    firstPaintTime?: number;
  }> {
    const startTime = performance.now();

    await this.performSearch(query);
    const resultCount = await this.waitForResults();

    const searchTime = performance.now() - startTime;

    // Measure first paint time
    const navigationTiming = await this.page.evaluate(() => {
      const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return timing.loadEventEnd - timing.navigationStart;
    });

    return {
      searchTime,
      resultCount,
      firstPaintTime: navigationTiming
    };
  }

  async checkAccessibility(): Promise<any> {
    // This would integrate with axe-core or similar
    return await this.page.evaluate(() => {
      // Mock accessibility check for now
      return {
        violations: [],
        passes: [],
        incomplete: [],
        inapplicable: []
      };
    });
  }

  async takeScreenshot(name: string): Promise<string> {
    const screenshotPath = path.join(
      process.cwd(),
      'test-results',
      'screenshots',
      `${name}-${Date.now()}.png`
    );

    await this.page.screenshot({
      path: screenshotPath,
      fullPage: true
    });

    return screenshotPath;
  }

  async getPerformanceMetrics(): Promise<any> {
    return await this.page.evaluate(() => {
      const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const memory = (performance as any).memory;

      return {
        timing: {
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          load: timing.loadEventEnd - timing.navigationStart,
          firstPaint: timing.responseEnd - timing.navigationStart
        },
        memory: memory ? {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        } : null
      };
    });
  }
}

// Test Data Generator for E2E
export class E2ETestDataGenerator {
  static generateSearchScenarios() {
    return [
      {
        name: 'basic_search',
        query: 'VSAM Status 35',
        expectedMinResults: 1,
        maxResponseTime: 2000
      },
      {
        name: 'fuzzy_search',
        query: 'VSAM Staus 35', // Typo
        expectedMinResults: 0, // May or may not find results
        maxResponseTime: 2000
      },
      {
        name: 'broad_search',
        query: 'error',
        expectedMinResults: 5,
        maxResponseTime: 3000
      },
      {
        name: 'specific_search',
        query: 'S0C7 data exception COBOL',
        expectedMinResults: 1,
        maxResponseTime: 2000
      },
      {
        name: 'no_results',
        query: 'nonexistent xyz 123 query',
        expectedMinResults: 0,
        maxResponseTime: 1000
      },
      {
        name: 'special_characters',
        query: 'S0C7 @#$% error',
        expectedMinResults: 0,
        maxResponseTime: 2000
      },
      {
        name: 'long_query',
        query: 'very long query with many words that should still work correctly and return appropriate results',
        expectedMinResults: 0,
        maxResponseTime: 3000
      }
    ];
  }

  static generateUserJourneys() {
    return [
      {
        name: 'search_and_view_entry',
        steps: [
          { action: 'search', query: 'VSAM Status 35' },
          { action: 'select_result', index: 0 },
          { action: 'view_details' },
          { action: 'rate_helpful', rating: true }
        ]
      },
      {
        name: 'search_refine_and_export',
        steps: [
          { action: 'search', query: 'error' },
          { action: 'filter_category', category: 'VSAM' },
          { action: 'select_multiple_results', indices: [0, 1, 2] },
          { action: 'export_results' }
        ]
      },
      {
        name: 'add_new_entry',
        steps: [
          { action: 'open_add_dialog' },
          { action: 'fill_form', data: {
            title: 'E2E Test Entry',
            problem: 'E2E test problem',
            solution: 'E2E test solution',
            category: 'Other'
          }},
          { action: 'submit_form' },
          { action: 'verify_entry_added' }
        ]
      },
      {
        name: 'search_no_results_and_suggest',
        steps: [
          { action: 'search', query: 'nonexistent problem' },
          { action: 'verify_no_results' },
          { action: 'click_add_suggestion' },
          { action: 'prefill_form_from_search' }
        ]
      }
    ];
  }

  static generatePerformanceScenarios() {
    return [
      {
        name: 'rapid_searches',
        searches: Array.from({ length: 20 }, (_, i) => `search ${i + 1}`),
        interval: 100, // 100ms between searches
        maxTotalTime: 10000 // 10 seconds total
      },
      {
        name: 'concurrent_searches',
        searches: ['VSAM', 'DB2', 'JCL', 'error', 'status'],
        concurrent: true,
        maxResponseTime: 3000
      },
      {
        name: 'memory_stress',
        searches: e2eConfig.testData.stressTestQueries,
        checkMemoryAfter: 50,
        maxMemoryIncrease: 100 * 1024 * 1024 // 100MB
      }
    ];
  }
}

// Global managers
let browserManager: BrowserManager;
let electronManager: ElectronManager;

export const getBrowserManager = (): BrowserManager => {
  if (!browserManager) {
    browserManager = new BrowserManager();
  }
  return browserManager;
};

export const getElectronManager = (): ElectronManager => {
  if (!electronManager) {
    electronManager = new ElectronManager();
  }
  return electronManager;
};

// Cleanup function
export const cleanupE2E = async (): Promise<void> => {
  if (browserManager) {
    await browserManager.closeBrowsers();
  }

  if (electronManager) {
    await electronManager.killElectronApp();
  }
};

// Utility functions
export const waitForCondition = async (
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
};

export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        console.warn(`Operation failed (attempt ${attempt}/${maxRetries}):`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
};

export default {
  e2eConfig,
  BrowserManager,
  ElectronManager,
  PageHelper,
  E2ETestDataGenerator,
  getBrowserManager,
  getElectronManager,
  cleanupE2E,
  waitForCondition,
  retryOperation
};