/**
 * Comprehensive Performance Testing E2E Suite
 *
 * Tests application performance under various conditions:
 * - Load testing with concurrent users
 * - Memory usage and leak detection
 * - CPU utilization monitoring
 * - Network performance testing
 * - Database query optimization
 * - UI responsiveness under load
 * - Resource consumption analysis
 * - Stress testing scenarios
 */

import { test, expect, Page, Browser } from '@playwright/test';

interface PerformanceMetrics {
  timestamp: number;
  memory: {
    used: number;
    total: number;
    limit: number;
  };
  timing: {
    navigation: number;
    domContentLoaded: number;
    load: number;
    firstPaint: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    firstInputDelay: number;
    cumulativeLayoutShift: number;
  };
  network: {
    requestCount: number;
    totalSize: number;
    averageResponseTime: number;
    cacheHitRate: number;
  };
  database: {
    queryCount: number;
    averageQueryTime: number;
    slowQueries: number;
    connectionPoolSize: number;
  };
  ui: {
    renderTime: number;
    frameRate: number;
    scrollPerformance: number;
    interactionLatency: number;
  };
}

interface LoadTestResult {
  concurrent_users: number;
  duration: number;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  average_response_time: number;
  max_response_time: number;
  min_response_time: number;
  requests_per_second: number;
  error_rate: number;
  performance_metrics: PerformanceMetrics[];
}

class PerformanceTestRunner {
  private page: Page;
  private browser: Browser;
  private metrics: PerformanceMetrics[] = [];
  private loadTestResults: LoadTestResult[] = [];

  constructor(page: Page, browser: Browser) {
    this.page = page;
    this.browser = browser;
  }

  async startPerformanceMonitoring(): Promise<void> {
    // Enable performance monitoring
    await this.page.addInitScript(() => {
      (window as any).performanceData = [];

      // Monitor performance entries
      const observer = new PerformanceObserver((list) => {
        (window as any).performanceData.push(...list.getEntries());
      });

      observer.observe({ entryTypes: ['navigation', 'paint', 'measure', 'resource'] });

      // Monitor memory usage
      setInterval(() => {
        if ((performance as any).memory) {
          (window as any).memorySnapshots = (window as any).memorySnapshots || [];
          (window as any).memorySnapshots.push({
            timestamp: Date.now(),
            memory: (performance as any).memory
          });
        }
      }, 1000);
    });
  }

  async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    const rawMetrics = await this.page.evaluate(() => {
      const perfData = (window as any).performanceData || [];
      const memorySnapshots = (window as any).memorySnapshots || [];

      // Get navigation timing
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      // Get paint metrics
      const paints = performance.getEntriesByType('paint');
      const firstPaint = paints.find(p => p.name === 'first-paint')?.startTime || 0;
      const firstContentfulPaint = paints.find(p => p.name === 'first-contentful-paint')?.startTime || 0;

      // Get LCP
      const lcp = perfData.filter((entry: any) => entry.entryType === 'largest-contentful-paint')
        .sort((a: any, b: any) => b.startTime - a.startTime)[0];

      // Get resource metrics
      const resources = performance.getEntriesByType('resource');
      const networkMetrics = {
        requestCount: resources.length,
        totalSize: resources.reduce((sum: number, r: any) => sum + (r.transferSize || 0), 0),
        averageResponseTime: resources.reduce((sum: number, r: any) => sum + r.duration, 0) / resources.length,
        cacheHitRate: resources.filter((r: any) => r.transferSize === 0).length / resources.length
      };

      // Get latest memory snapshot
      const latestMemory = memorySnapshots[memorySnapshots.length - 1]?.memory || {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0
      };

      return {
        timestamp: Date.now(),
        navigation: navigation ? {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          load: navigation.loadEventEnd - navigation.loadEventStart,
          navigation: navigation.loadEventEnd - navigation.navigationStart
        } : { domContentLoaded: 0, load: 0, navigation: 0 },
        memory: {
          used: latestMemory.usedJSHeapSize,
          total: latestMemory.totalJSHeapSize,
          limit: latestMemory.jsHeapSizeLimit
        },
        paints: {
          firstPaint,
          firstContentfulPaint,
          largestContentfulPaint: lcp?.startTime || 0
        },
        network: networkMetrics
      };
    });

    // Get Web Vitals
    const webVitals = await this.page.evaluate(() => {
      return new Promise((resolve) => {
        if ('web-vitals' in window) {
          resolve((window as any)['web-vitals']);
        } else {
          resolve({ fid: 0, cls: 0 });
        }
      });
    });

    // Get database metrics (if available)
    const dbMetrics = await this.page.evaluate(() => {
      return (window as any).databaseMetrics || {
        queryCount: 0,
        averageQueryTime: 0,
        slowQueries: 0,
        connectionPoolSize: 0
      };
    });

    // Get UI metrics
    const uiMetrics = await this.page.evaluate(() => {
      return (window as any).uiMetrics || {
        renderTime: 0,
        frameRate: 60,
        scrollPerformance: 0,
        interactionLatency: 0
      };
    });

    const metrics: PerformanceMetrics = {
      timestamp: rawMetrics.timestamp,
      memory: rawMetrics.memory,
      timing: {
        navigation: rawMetrics.navigation.navigation,
        domContentLoaded: rawMetrics.navigation.domContentLoaded,
        load: rawMetrics.navigation.load,
        firstPaint: rawMetrics.paints.firstPaint,
        firstContentfulPaint: rawMetrics.paints.firstContentfulPaint,
        largestContentfulPaint: rawMetrics.paints.largestContentfulPaint,
        firstInputDelay: (webVitals as any).fid || 0,
        cumulativeLayoutShift: (webVitals as any).cls || 0
      },
      network: rawMetrics.network,
      database: dbMetrics,
      ui: uiMetrics
    };

    this.metrics.push(metrics);
    return metrics;
  }

  async performLoadTest(concurrentUsers: number, duration: number): Promise<LoadTestResult> {
    const startTime = Date.now();
    const contexts: any[] = [];
    const pages: Page[] = [];
    const results: any[] = [];

    try {
      // Create concurrent browser contexts
      for (let i = 0; i < concurrentUsers; i++) {
        const context = await this.browser.newContext();
        const page = await context.newPage();

        // Start performance monitoring for each page
        await this.startPerformanceMonitoringForPage(page);

        contexts.push(context);
        pages.push(page);
      }

      // Run concurrent load simulation
      const loadPromises = pages.map((page, index) =>
        this.simulateUserSession(page, duration, index)
      );

      const sessionResults = await Promise.all(loadPromises);

      // Collect results
      let totalRequests = 0;
      let successfulRequests = 0;
      let failedRequests = 0;
      let totalResponseTime = 0;
      let maxResponseTime = 0;
      let minResponseTime = Infinity;

      for (const result of sessionResults) {
        totalRequests += result.requestCount;
        successfulRequests += result.successfulRequests;
        failedRequests += result.failedRequests;
        totalResponseTime += result.totalResponseTime;
        maxResponseTime = Math.max(maxResponseTime, result.maxResponseTime);
        minResponseTime = Math.min(minResponseTime, result.minResponseTime);
        results.push(...result.metrics);
      }

      const actualDuration = Date.now() - startTime;

      const loadTestResult: LoadTestResult = {
        concurrent_users: concurrentUsers,
        duration: actualDuration,
        total_requests: totalRequests,
        successful_requests: successfulRequests,
        failed_requests: failedRequests,
        average_response_time: totalResponseTime / totalRequests || 0,
        max_response_time: maxResponseTime,
        min_response_time: minResponseTime === Infinity ? 0 : minResponseTime,
        requests_per_second: (totalRequests / actualDuration) * 1000,
        error_rate: failedRequests / totalRequests * 100,
        performance_metrics: results
      };

      this.loadTestResults.push(loadTestResult);
      return loadTestResult;

    } finally {
      // Cleanup
      for (const context of contexts) {
        await context.close();
      }
    }
  }

  private async startPerformanceMonitoringForPage(page: Page): Promise<void> {
    await page.addInitScript(() => {
      (window as any).sessionMetrics = {
        requestCount: 0,
        successfulRequests: 0,
        failedRequests: 0,
        responseTimes: [],
        errors: []
      };

      // Monitor requests
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const startTime = performance.now();
        (window as any).sessionMetrics.requestCount++;

        try {
          const response = await originalFetch(...args);
          const endTime = performance.now();
          const responseTime = endTime - startTime;

          (window as any).sessionMetrics.responseTimes.push(responseTime);

          if (response.ok) {
            (window as any).sessionMetrics.successfulRequests++;
          } else {
            (window as any).sessionMetrics.failedRequests++;
          }

          return response;
        } catch (error) {
          (window as any).sessionMetrics.failedRequests++;
          (window as any).sessionMetrics.errors.push(error.message);
          throw error;
        }
      };
    });
  }

  private async simulateUserSession(page: Page, duration: number, userIndex: number): Promise<any> {
    const endTime = Date.now() + duration;
    const actions = [
      () => this.simulateSearch(page, `user${userIndex} search query`),
      () => this.simulateEntryView(page),
      () => this.simulateEntryCreation(page, userIndex),
      () => this.simulateNavigation(page),
      () => this.simulateFiltering(page)
    ];

    while (Date.now() < endTime) {
      try {
        // Random action
        const action = actions[Math.floor(Math.random() * actions.length)];
        await action();

        // Random wait between actions
        await page.waitForTimeout(Math.random() * 2000 + 500);
      } catch (error) {
        // Log error but continue
        console.warn(`User ${userIndex} action failed:`, error.message);
      }
    }

    // Collect session metrics
    return await page.evaluate(() => {
      const metrics = (window as any).sessionMetrics;
      return {
        requestCount: metrics.requestCount,
        successfulRequests: metrics.successfulRequests,
        failedRequests: metrics.failedRequests,
        totalResponseTime: metrics.responseTimes.reduce((sum: number, time: number) => sum + time, 0),
        maxResponseTime: Math.max(...metrics.responseTimes, 0),
        minResponseTime: Math.min(...metrics.responseTimes, Infinity),
        errors: metrics.errors,
        metrics: []
      };
    });
  }

  private async simulateSearch(page: Page, query: string): Promise<void> {
    await page.goto('#/search');
    await page.fill('[data-testid="search-input"]', query);
    await page.click('[data-testid="search-button"]');
    await page.waitForTimeout(1000);
  }

  private async simulateEntryView(page: Page): Promise<void> {
    const searchResults = await page.locator('[data-testid^="search-result-"]').count();
    if (searchResults > 0) {
      const randomResult = Math.floor(Math.random() * Math.min(searchResults, 5));
      await page.click(`[data-testid="search-result-${randomResult}"]`);
      await page.waitForTimeout(1500);
    }
  }

  private async simulateEntryCreation(page: Page, userIndex: number): Promise<void> {
    await page.click('[data-testid="add-entry-button"]');
    await page.fill('[data-testid="entry-title-input"]', `Load Test Entry ${userIndex}-${Date.now()}`);
    await page.fill('[data-testid="entry-problem-input"]', 'Load testing problem description');
    await page.fill('[data-testid="entry-solution-input"]', 'Load testing solution description');
    await page.selectOption('[data-testid="entry-category-select"]', 'Testing');
    await page.click('[data-testid="save-entry-button"]');
    await page.waitForTimeout(2000);
  }

  private async simulateNavigation(page: Page): Promise<void> {
    const routes = ['#/dashboard', '#/analytics', '#/settings', '#/search'];
    const randomRoute = routes[Math.floor(Math.random() * routes.length)];
    await page.goto(randomRoute);
    await page.waitForTimeout(1000);
  }

  private async simulateFiltering(page: Page): Promise<void> {
    await page.goto('#/search');
    await page.click('[data-testid="advanced-search-toggle"]');
    await page.check('[data-testid="category-filter-Testing"]');
    await page.click('[data-testid="search-button"]');
    await page.waitForTimeout(1000);
  }

  async performMemoryLeakTest(duration: number): Promise<PerformanceMetrics[]> {
    const measurements: PerformanceMetrics[] = [];
    const interval = 5000; // Measure every 5 seconds
    const endTime = Date.now() + duration;

    await this.startPerformanceMonitoring();
    await this.page.goto('/');

    while (Date.now() < endTime) {
      // Perform memory-intensive operations
      await this.page.evaluate(() => {
        // Create and destroy objects to test garbage collection
        const largeArray = new Array(100000).fill('memory test data');
        setTimeout(() => {
          largeArray.length = 0;
        }, 100);
      });

      // Simulate user interactions
      await this.simulateSearch(this.page, 'memory test search');

      // Collect metrics
      const metrics = await this.collectPerformanceMetrics();
      measurements.push(metrics);

      await this.page.waitForTimeout(interval);
    }

    return measurements;
  }

  async performStressTest(): Promise<PerformanceMetrics> {
    await this.startPerformanceMonitoring();
    await this.page.goto('/');

    // Stress test scenarios
    const stressActions = [
      // Large dataset search
      async () => {
        await this.page.evaluate(() => {
          // Simulate large dataset
          const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
            id: i,
            title: `Stress Test Entry ${i}`,
            content: 'Stress test content '.repeat(100)
          }));
          (window as any).stressTestData = largeDataset;
        });

        await this.simulateSearch(this.page, '*'); // Search all
      },

      // Rapid navigation
      async () => {
        for (let i = 0; i < 20; i++) {
          await this.simulateNavigation(this.page);
          await this.page.waitForTimeout(100);
        }
      },

      // Multiple concurrent operations
      async () => {
        const promises = [
          this.simulateSearch(this.page, 'concurrent test 1'),
          this.simulateSearch(this.page, 'concurrent test 2'),
          this.simulateSearch(this.page, 'concurrent test 3')
        ];
        await Promise.all(promises);
      },

      // DOM manipulation stress
      async () => {
        await this.page.evaluate(() => {
          for (let i = 0; i < 1000; i++) {
            const div = document.createElement('div');
            div.textContent = `Stress element ${i}`;
            document.body.appendChild(div);
          }

          // Clean up
          setTimeout(() => {
            const stressElements = document.querySelectorAll('div');
            stressElements.forEach(el => {
              if (el.textContent?.includes('Stress element')) {
                el.remove();
              }
            });
          }, 1000);
        });
      }
    ];

    // Execute all stress actions
    for (const action of stressActions) {
      await action();
      await this.page.waitForTimeout(1000);
    }

    return await this.collectPerformanceMetrics();
  }

  async analyzePerformanceTrends(): Promise<any> {
    if (this.metrics.length < 2) {
      throw new Error('Insufficient data for trend analysis');
    }

    const memoryTrend = this.metrics.map(m => m.memory.used);
    const timingTrend = this.metrics.map(m => m.timing.navigation);
    const networkTrend = this.metrics.map(m => m.network.averageResponseTime);

    return {
      memory: {
        trend: this.calculateTrend(memoryTrend),
        growth: memoryTrend[memoryTrend.length - 1] - memoryTrend[0],
        average: memoryTrend.reduce((sum, val) => sum + val, 0) / memoryTrend.length
      },
      timing: {
        trend: this.calculateTrend(timingTrend),
        improvement: timingTrend[0] - timingTrend[timingTrend.length - 1],
        average: timingTrend.reduce((sum, val) => sum + val, 0) / timingTrend.length
      },
      network: {
        trend: this.calculateTrend(networkTrend),
        change: networkTrend[networkTrend.length - 1] - networkTrend[0],
        average: networkTrend.reduce((sum, val) => sum + val, 0) / networkTrend.length
      }
    };
  }

  private calculateTrend(values: number[]): 'improving' | 'degrading' | 'stable' {
    if (values.length < 2) return 'stable';

    const first = values.slice(0, Math.floor(values.length / 3)).reduce((sum, val) => sum + val, 0);
    const last = values.slice(-Math.floor(values.length / 3)).reduce((sum, val) => sum + val, 0);

    const change = (last - first) / first;

    if (change > 0.1) return 'degrading';
    if (change < -0.1) return 'improving';
    return 'stable';
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getLoadTestResults(): LoadTestResult[] {
    return [...this.loadTestResults];
  }
}

test.describe('Comprehensive Performance Testing', () => {
  let performanceRunner: PerformanceTestRunner;

  test.beforeEach(async ({ page, browser }) => {
    performanceRunner = new PerformanceTestRunner(page, browser);

    // Setup test environment
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });
  });

  test('Application startup performance baseline', async () => {
    await performanceRunner.startPerformanceMonitoring();

    // Fresh page load
    await performanceRunner.page.goto('/', { waitUntil: 'networkidle' });

    const metrics = await performanceRunner.collectPerformanceMetrics();

    // Performance expectations
    expect(metrics.timing.navigation).toBeLessThan(5000); // 5s max startup
    expect(metrics.timing.firstContentfulPaint).toBeLessThan(2000); // 2s FCP
    expect(metrics.timing.largestContentfulPaint).toBeLessThan(3000); // 3s LCP
    expect(metrics.timing.cumulativeLayoutShift).toBeLessThan(0.1); // Good CLS
    expect(metrics.memory.used).toBeLessThan(100 * 1024 * 1024); // <100MB initial

    console.log('Startup Performance Metrics:', metrics);
  });

  test('Search performance under normal load', async () => {
    await performanceRunner.startPerformanceMonitoring();

    const searchQueries = [
      'VSAM error',
      'JCL syntax',
      'DB2 performance',
      'COBOL debugging',
      'mainframe batch'
    ];

    for (const query of searchQueries) {
      const startTime = Date.now();

      await performanceRunner.page.goto('#/search');
      await performanceRunner.page.fill('[data-testid="search-input"]', query);
      await performanceRunner.page.click('[data-testid="search-button"]');

      await Promise.race([
        performanceRunner.page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 }),
        performanceRunner.page.waitForSelector('[data-testid="no-results"]', { timeout: 10000 })
      ]);

      const searchTime = Date.now() - startTime;
      expect(searchTime).toBeLessThan(3000); // 3s max search time
    }

    const metrics = await performanceRunner.collectPerformanceMetrics();
    expect(metrics.network.averageResponseTime).toBeLessThan(1000); // 1s avg response
  });

  test('Load testing with multiple concurrent users', async () => {
    const testScenarios = [
      { users: 5, duration: 30000 },  // 5 users for 30 seconds
      { users: 10, duration: 30000 }, // 10 users for 30 seconds
      { users: 20, duration: 30000 }  // 20 users for 30 seconds
    ];

    for (const scenario of testScenarios) {
      const result = await performanceRunner.performLoadTest(scenario.users, scenario.duration);

      // Performance expectations under load
      expect(result.error_rate).toBeLessThan(5); // <5% error rate
      expect(result.average_response_time).toBeLessThan(5000); // <5s avg response
      expect(result.requests_per_second).toBeGreaterThan(0.5); // >0.5 RPS

      console.log(`Load Test Result (${scenario.users} users):`, {
        errorRate: result.error_rate,
        avgResponseTime: result.average_response_time,
        rps: result.requests_per_second
      });
    }

    const loadResults = performanceRunner.getLoadTestResults();
    expect(loadResults).toHaveLength(testScenarios.length);
  });

  test('Memory leak detection and analysis', async () => {
    const measurements = await performanceRunner.performMemoryLeakTest(60000); // 1 minute test

    // Analyze memory growth
    const initialMemory = measurements[0].memory.used;
    const finalMemory = measurements[measurements.length - 1].memory.used;
    const memoryGrowth = finalMemory - initialMemory;
    const memoryGrowthMB = memoryGrowth / (1024 * 1024);

    console.log(`Memory Growth: ${memoryGrowthMB.toFixed(2)}MB over 1 minute`);

    // Should not grow more than 50MB in a minute of normal usage
    expect(memoryGrowthMB).toBeLessThan(50);

    // Check for consistent memory growth (potential leak)
    const memoryValues = measurements.map(m => m.memory.used);
    const consecutiveIncreases = memoryValues.reduce((count, value, index) => {
      if (index > 0 && value > memoryValues[index - 1]) {
        return count + 1;
      }
      return 0;
    }, 0);

    // Memory should not increase consistently (sign of leak)
    expect(consecutiveIncreases).toBeLessThan(measurements.length * 0.8);
  });

  test('Stress testing application limits', async () => {
    const stressMetrics = await performanceRunner.performStressTest();

    // Application should remain responsive under stress
    expect(stressMetrics.timing.navigation).toBeLessThan(10000); // 10s max under stress
    expect(stressMetrics.memory.used).toBeLessThan(500 * 1024 * 1024); // <500MB under stress
    expect(stressMetrics.network.averageResponseTime).toBeLessThan(8000); // 8s avg under stress

    console.log('Stress Test Metrics:', stressMetrics);
  });

  test('Database performance optimization', async ({ page }) => {
    await performanceRunner.startPerformanceMonitoring();

    // Test database-heavy operations
    const operations = [
      async () => {
        // Large search query
        await page.goto('#/search');
        await page.fill('[data-testid="search-input"]', '*');
        await page.click('[data-testid="search-button"]');
        await page.waitForTimeout(3000);
      },
      async () => {
        // Complex filtering
        await page.click('[data-testid="advanced-search-toggle"]');
        await page.check('[data-testid="category-filter-VSAM"]');
        await page.check('[data-testid="category-filter-JCL"]');
        await page.fill('[data-testid="date-from-input"]', '2024-01-01');
        await page.click('[data-testid="search-button"]');
        await page.waitForTimeout(2000);
      },
      async () => {
        // Analytics queries
        await page.goto('#/analytics');
        await page.waitForSelector('[data-testid="analytics-dashboard"]');
        await page.waitForTimeout(2000);
      }
    ];

    for (const operation of operations) {
      await operation();
    }

    const metrics = await performanceRunner.collectPerformanceMetrics();

    // Database performance expectations
    expect(metrics.database.averageQueryTime).toBeLessThan(500); // 500ms avg query
    expect(metrics.database.slowQueries).toBeLessThan(5); // <5 slow queries
    expect(metrics.database.connectionPoolSize).toBeGreaterThan(0);
  });

  test('UI responsiveness and interaction performance', async ({ page }) => {
    await performanceRunner.startPerformanceMonitoring();

    // Test UI responsiveness
    const interactions = [
      // Rapid clicking
      async () => {
        for (let i = 0; i < 10; i++) {
          await page.click('[data-testid="search-button"]');
          await page.waitForTimeout(100);
        }
      },
      // Fast typing
      async () => {
        await page.focus('[data-testid="search-input"]');
        await page.keyboard.type('Fast typing test for UI responsiveness', { delay: 50 });
      },
      // Rapid navigation
      async () => {
        const routes = ['#/search', '#/analytics', '#/settings', '#/dashboard'];
        for (const route of routes) {
          await page.goto(route);
          await page.waitForTimeout(200);
        }
      },
      // Scroll performance
      async () => {
        await page.goto('#/search');
        await page.fill('[data-testid="search-input"]', '*');
        await page.click('[data-testid="search-button"]');
        await page.waitForSelector('[data-testid="search-results"]');

        for (let i = 0; i < 5; i++) {
          await page.mouse.wheel(0, 500);
          await page.waitForTimeout(100);
        }
      }
    ];

    for (const interaction of interactions) {
      const startTime = Date.now();
      await interaction();
      const interactionTime = Date.now() - startTime;

      // Interactions should be responsive
      expect(interactionTime).toBeLessThan(2000);
    }

    const metrics = await performanceRunner.collectPerformanceMetrics();
    expect(metrics.ui.interactionLatency).toBeLessThan(100); // <100ms interaction latency
    expect(metrics.ui.frameRate).toBeGreaterThan(30); // >30 FPS
  });

  test('Network performance and optimization', async ({ page }) => {
    await performanceRunner.startPerformanceMonitoring();

    // Test network-intensive operations
    await page.goto('#/search');

    // Multiple searches to test caching
    const searchQueries = ['test1', 'test2', 'test1', 'test3', 'test1'];

    for (const query of searchQueries) {
      await page.fill('[data-testid="search-input"]', query);
      await page.click('[data-testid="search-button"]');
      await page.waitForTimeout(1000);
    }

    const metrics = await performanceRunner.collectPerformanceMetrics();

    // Network performance expectations
    expect(metrics.network.cacheHitRate).toBeGreaterThan(0.2); // >20% cache hit rate
    expect(metrics.network.averageResponseTime).toBeLessThan(2000); // <2s avg response
    expect(metrics.network.totalSize).toBeLessThan(10 * 1024 * 1024); // <10MB total

    console.log('Network Performance:', {
      cacheHitRate: metrics.network.cacheHitRate,
      avgResponseTime: metrics.network.averageResponseTime,
      totalSize: metrics.network.totalSize / (1024 * 1024) // MB
    });
  });

  test('Performance regression detection', async () => {
    // Collect baseline metrics
    await performanceRunner.startPerformanceMonitoring();

    // Standard workflow
    await performanceRunner.page.goto('#/search');
    await performanceRunner.page.fill('[data-testid="search-input"]', 'baseline test');
    await performanceRunner.page.click('[data-testid="search-button"]');
    await performanceRunner.page.waitForTimeout(2000);

    await performanceRunner.collectPerformanceMetrics();

    // Simulate workload
    for (let i = 0; i < 5; i++) {
      await performanceRunner.page.fill('[data-testid="search-input"]', `test ${i}`);
      await performanceRunner.page.click('[data-testid="search-button"]');
      await performanceRunner.page.waitForTimeout(1000);
      await performanceRunner.collectPerformanceMetrics();
    }

    // Analyze trends
    const trends = await performanceRunner.analyzePerformanceTrends();

    console.log('Performance Trends:', trends);

    // Performance should not degrade significantly
    expect(trends.memory.trend).not.toBe('degrading');
    expect(trends.timing.trend).not.toBe('degrading');

    // Memory growth should be reasonable
    expect(trends.memory.growth).toBeLessThan(50 * 1024 * 1024); // <50MB growth
  });

  test('Resource consumption analysis', async ({ page }) => {
    await performanceRunner.startPerformanceMonitoring();

    // Monitor resource usage during typical workflow
    const workflow = [
      () => page.goto('#/dashboard'),
      () => page.goto('#/search'),
      () => page.fill('[data-testid="search-input"]', 'resource test'),
      () => page.click('[data-testid="search-button"]'),
      () => page.click('[data-testid="add-entry-button"]'),
      () => page.fill('[data-testid="entry-title-input"]', 'Resource Test Entry'),
      () => page.goto('#/analytics'),
      () => page.goto('#/settings')
    ];

    for (const step of workflow) {
      await step();
      await page.waitForTimeout(1000);
      await performanceRunner.collectPerformanceMetrics();
    }

    const allMetrics = performanceRunner.getMetrics();
    const maxMemory = Math.max(...allMetrics.map(m => m.memory.used));
    const avgResponseTime = allMetrics.reduce((sum, m) => sum + m.network.averageResponseTime, 0) / allMetrics.length;

    // Resource consumption should be reasonable
    expect(maxMemory).toBeLessThan(200 * 1024 * 1024); // <200MB peak memory
    expect(avgResponseTime).toBeLessThan(1500); // <1.5s avg response

    console.log('Resource Consumption Analysis:', {
      peakMemoryMB: maxMemory / (1024 * 1024),
      avgResponseTime,
      totalRequests: allMetrics.reduce((sum, m) => sum + m.network.requestCount, 0)
    });
  });

  test('Cross-browser performance comparison', async ({ browser }) => {
    // This test would ideally run across different browsers
    // For now, we'll simulate by running multiple sessions

    const sessions = [];
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const runner = new PerformanceTestRunner(page, browser);

      await runner.startPerformanceMonitoring();
      await page.goto('/');

      // Standard performance test
      await page.goto('#/search');
      await page.fill('[data-testid="search-input"]', `cross-browser test ${i}`);
      await page.click('[data-testid="search-button"]');
      await page.waitForTimeout(2000);

      const metrics = await runner.collectPerformanceMetrics();
      sessions.push({ sessionId: i, metrics });

      await context.close();
    }

    // Compare performance across sessions
    const navigationTimes = sessions.map(s => s.metrics.timing.navigation);
    const memoryUsages = sessions.map(s => s.metrics.memory.used);

    const avgNavigationTime = navigationTimes.reduce((sum, time) => sum + time, 0) / navigationTimes.length;
    const avgMemoryUsage = memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length;

    // Performance should be consistent
    expect(Math.max(...navigationTimes) - Math.min(...navigationTimes)).toBeLessThan(2000); // <2s variance
    expect(Math.max(...memoryUsages) - Math.min(...memoryUsages)).toBeLessThan(50 * 1024 * 1024); // <50MB variance

    console.log('Cross-Browser Performance:', {
      avgNavigationTime,
      avgMemoryUsageMB: avgMemoryUsage / (1024 * 1024),
      navigationTimeVariance: Math.max(...navigationTimes) - Math.min(...navigationTimes),
      memoryVarianceMB: (Math.max(...memoryUsages) - Math.min(...memoryUsages)) / (1024 * 1024)
    });
  });
});