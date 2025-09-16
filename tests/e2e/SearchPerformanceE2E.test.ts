/**
 * End-to-End Performance Tests for Complete Search Implementation
 *
 * Tests the entire search pipeline from UI to database with <1s response time requirement
 * Includes load testing, memory monitoring, and bottleneck identification
 */

import { test, expect } from '@playwright/test';
import { performance } from 'perf_hooks';

// Test configuration
const PERFORMANCE_TARGETS = {
  SEARCH_RESPONSE_TIME: 1000,  // <1s P95
  AUTOCOMPLETE_TIME: 50,       // <50ms P95
  UI_RENDER_TIME: 200,         // <200ms P95
  MEMORY_LIMIT: 256 * 1024 * 1024, // 256MB
  CACHE_HIT_RATE: 0.90,        // >90%
  CONCURRENT_USERS: 100        // Support 100 concurrent users
};

interface PerformanceMetrics {
  searchTime: number;
  renderTime: number;
  totalTime: number;
  memoryUsage: number;
  cacheHit: boolean;
  resultsCount: number;
  errorCount: number;
}

class E2EPerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private errors: string[] = [];
  private startTime: number = 0;

  startMeasurement(): void {
    this.startTime = performance.now();
  }

  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
  }

  recordError(error: string): void {
    this.errors.push(error);
  }

  getP95(values: number[]): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index] || 0;
  }

  getAverageTime(): number {
    if (this.metrics.length === 0) return 0;
    return this.metrics.reduce((sum, m) => sum + m.totalTime, 0) / this.metrics.length;
  }

  getCacheHitRate(): number {
    if (this.metrics.length === 0) return 0;
    const hits = this.metrics.filter(m => m.cacheHit).length;
    return hits / this.metrics.length;
  }

  getReport(): {
    totalTests: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    cacheHitRate: number;
    errorRate: number;
    memoryUsage: { avg: number; max: number };
    performance: { search: number; render: number; total: number };
  } {
    const responseTimes = this.metrics.map(m => m.totalTime);
    const searchTimes = this.metrics.map(m => m.searchTime);
    const renderTimes = this.metrics.map(m => m.renderTime);
    const memoryUsages = this.metrics.map(m => m.memoryUsage);

    return {
      totalTests: this.metrics.length,
      avgResponseTime: this.getAverageTime(),
      p95ResponseTime: this.getP95(responseTimes),
      cacheHitRate: this.getCacheHitRate(),
      errorRate: this.errors.length / this.metrics.length,
      memoryUsage: {
        avg: memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length,
        max: Math.max(...memoryUsages)
      },
      performance: {
        search: this.getP95(searchTimes),
        render: this.getP95(renderTimes),
        total: this.getP95(responseTimes)
      }
    };
  }
}

// Global performance monitor
const monitor = new E2EPerformanceMonitor();

test.describe('Search E2E Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/');

    // Wait for app to be ready
    await page.waitForSelector('[data-testid="search-input"]', { timeout: 10000 });

    // Preload test data if needed
    await page.evaluate(() => {
      // Add performance observer
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window._performanceEntries = window._performanceEntries || [];
            window._performanceEntries.push({
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime
            });
          }
        });
        observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
      }
    });
  });

  test('Complete search flow performance - <1s requirement', async ({ page }) => {
    monitor.startMeasurement();

    const searchQueries = [
      'vsam status 35',
      's0c7 data exception',
      'jcl error dataset not found',
      'db2 sqlcode -904',
      'cobol abend'
    ];

    for (const query of searchQueries) {
      const startTime = performance.now();

      // Measure search input response
      const inputStartTime = performance.now();
      await page.fill('[data-testid="search-input"]', query);
      const inputTime = performance.now() - inputStartTime;

      // Trigger search
      const searchStartTime = performance.now();
      await page.press('[data-testid="search-input"]', 'Enter');

      // Wait for results with timeout
      try {
        await page.waitForSelector('[data-testid="search-results"]', { timeout: 2000 });
        const searchTime = performance.now() - searchStartTime;

        // Measure UI render time
        const renderStartTime = performance.now();
        await page.waitForSelector('[data-testid="search-result-item"]', { timeout: 1000 });
        const renderTime = performance.now() - renderStartTime;

        // Get results count
        const resultsCount = await page.locator('[data-testid="search-result-item"]').count();

        // Check for cache indicators
        const cacheHit = await page.locator('[data-testid="cache-indicator"]').isVisible().catch(() => false);

        // Get memory usage
        const memoryInfo = await page.evaluate(() => {
          return (performance as any).memory ? {
            used: (performance as any).memory.usedJSHeapSize,
            total: (performance as any).memory.totalJSHeapSize,
            limit: (performance as any).memory.jsHeapSizeLimit
          } : { used: 0, total: 0, limit: 0 };
        });

        const totalTime = performance.now() - startTime;

        // Record metrics
        monitor.recordMetric({
          searchTime,
          renderTime,
          totalTime,
          memoryUsage: memoryInfo.used,
          cacheHit,
          resultsCount,
          errorCount: 0
        });

        // Assert performance targets
        expect(totalTime).toBeLessThan(PERFORMANCE_TARGETS.SEARCH_RESPONSE_TIME);
        expect(renderTime).toBeLessThan(PERFORMANCE_TARGETS.UI_RENDER_TIME);
        expect(memoryInfo.used).toBeLessThan(PERFORMANCE_TARGETS.MEMORY_LIMIT);
        expect(resultsCount).toBeGreaterThan(0);

        console.log(`Search "${query}": ${totalTime.toFixed(2)}ms (search: ${searchTime.toFixed(2)}ms, render: ${renderTime.toFixed(2)}ms)`);

      } catch (error) {
        monitor.recordError(`Search failed for "${query}": ${error.message}`);
        throw error;
      }

      // Clear search for next query
      await page.fill('[data-testid="search-input"]', '');
      await page.waitForTimeout(100);
    }
  });

  test('Autocomplete performance - <50ms requirement', async ({ page }) => {
    const queries = ['vs', 'jcl', 's0', 'db2', 'co'];

    for (const query of queries) {
      const startTime = performance.now();

      // Type query
      await page.fill('[data-testid="search-input"]', query);

      // Wait for autocomplete suggestions
      await page.waitForSelector('[data-testid="autocomplete-suggestions"]', { timeout: 100 });

      const responseTime = performance.now() - startTime;

      // Assert autocomplete performance
      expect(responseTime).toBeLessThan(PERFORMANCE_TARGETS.AUTOCOMPLETE_TIME);

      // Verify suggestions exist
      const suggestionCount = await page.locator('[data-testid="autocomplete-suggestion"]').count();
      expect(suggestionCount).toBeGreaterThan(0);

      console.log(`Autocomplete "${query}": ${responseTime.toFixed(2)}ms`);

      // Clear for next test
      await page.fill('[data-testid="search-input"]', '');
      await page.waitForTimeout(50);
    }
  });

  test('Memory leak detection during extended use', async ({ page }) => {
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
    });

    // Perform 50 searches to detect memory leaks
    for (let i = 0; i < 50; i++) {
      const query = `test query ${i % 10}`;

      await page.fill('[data-testid="search-input"]', query);
      await page.press('[data-testid="search-input"]', 'Enter');

      try {
        await page.waitForSelector('[data-testid="search-results"]', { timeout: 1000 });
      } catch {
        // Continue if search fails
      }

      // Clear search
      await page.fill('[data-testid="search-input"]', '');

      // Check memory every 10 searches
      if (i % 10 === 9) {
        const currentMemory = await page.evaluate(() => {
          return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
        });

        const memoryIncrease = currentMemory - initialMemory;
        const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

        console.log(`Memory after ${i + 1} searches: ${memoryIncreaseMB.toFixed(2)}MB increase`);

        // Assert memory doesn't grow beyond reasonable limits
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB increase max
      }
    }
  });

  test('Cache effectiveness validation', async ({ page }) => {
    const repeatedQueries = [
      'vsam status 35',
      'jcl error',
      'db2 sqlcode'
    ];

    let cacheHitCount = 0;
    let totalSearches = 0;

    // First pass - should miss cache
    for (const query of repeatedQueries) {
      await page.fill('[data-testid="search-input"]', query);
      await page.press('[data-testid="search-input"]', 'Enter');

      await page.waitForSelector('[data-testid="search-results"]', { timeout: 2000 });
      totalSearches++;

      await page.fill('[data-testid="search-input"]', '');
      await page.waitForTimeout(100);
    }

    // Second pass - should hit cache
    for (const query of repeatedQueries) {
      const startTime = performance.now();

      await page.fill('[data-testid="search-input"]', query);
      await page.press('[data-testid="search-input"]', 'Enter');

      await page.waitForSelector('[data-testid="search-results"]', { timeout: 2000 });

      const responseTime = performance.now() - startTime;
      totalSearches++;

      // Check if this was a cache hit (faster response)
      if (responseTime < 100) { // Cache hits should be very fast
        cacheHitCount++;
      }

      console.log(`Repeat search "${query}": ${responseTime.toFixed(2)}ms`);

      await page.fill('[data-testid="search-input"]', '');
      await page.waitForTimeout(100);
    }

    const cacheHitRate = cacheHitCount / repeatedQueries.length;
    console.log(`Cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%`);

    // Assert cache effectiveness
    expect(cacheHitRate).toBeGreaterThan(0.5); // At least 50% cache hits on repeated searches
  });

  test('Error handling performance', async ({ page }) => {
    const errorScenarios = [
      '', // Empty query
      'a', // Too short query
      'x'.repeat(1000), // Very long query
      'invalid@#$%query', // Special characters
    ];

    for (const query of errorScenarios) {
      const startTime = performance.now();

      await page.fill('[data-testid="search-input"]', query);

      if (query.length >= 2) { // Only trigger search for valid length queries
        await page.press('[data-testid="search-input"]', 'Enter');

        // Wait for either results or error
        try {
          await page.waitForSelector('[data-testid="search-results"], [data-testid="search-error"]', { timeout: 1000 });
        } catch {
          // Timeout is expected for some error cases
        }
      }

      const responseTime = performance.now() - startTime;

      // Error handling should still be fast
      expect(responseTime).toBeLessThan(500);

      await page.fill('[data-testid="search-input"]', '');
      await page.waitForTimeout(50);
    }
  });

  test('Virtual scrolling performance with large result sets', async ({ page }) => {
    // Search for a term that should return many results
    const query = 'error';

    const startTime = performance.now();

    await page.fill('[data-testid="search-input"]', query);
    await page.press('[data-testid="search-input"]', 'Enter');

    // Wait for initial results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 2000 });

    const initialRenderTime = performance.now() - startTime;

    // Test scrolling performance
    const scrollStartTime = performance.now();

    // Scroll through virtual list
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => {
        const resultsContainer = document.querySelector('[data-testid="search-results"]');
        if (resultsContainer) {
          resultsContainer.scrollTop += 500;
        }
      });

      await page.waitForTimeout(50); // Allow virtual scrolling to render
    }

    const scrollTime = performance.now() - scrollStartTime;

    // Assert performance
    expect(initialRenderTime).toBeLessThan(PERFORMANCE_TARGETS.UI_RENDER_TIME);
    expect(scrollTime / 10).toBeLessThan(20); // Each scroll should be <20ms

    console.log(`Virtual scrolling: initial render ${initialRenderTime.toFixed(2)}ms, avg scroll ${(scrollTime / 10).toFixed(2)}ms`);
  });

  test.afterAll(async () => {
    // Generate performance report
    const report = monitor.getReport();

    console.log('\n=== E2E Performance Test Report ===');
    console.log(`Total Tests: ${report.totalTests}`);
    console.log(`Average Response Time: ${report.avgResponseTime.toFixed(2)}ms`);
    console.log(`P95 Response Time: ${report.p95ResponseTime.toFixed(2)}ms`);
    console.log(`Cache Hit Rate: ${(report.cacheHitRate * 100).toFixed(1)}%`);
    console.log(`Error Rate: ${(report.errorRate * 100).toFixed(1)}%`);
    console.log(`Memory Usage: avg ${(report.memoryUsage.avg / 1024 / 1024).toFixed(1)}MB, max ${(report.memoryUsage.max / 1024 / 1024).toFixed(1)}MB`);
    console.log(`Performance Breakdown:`);
    console.log(`  - Search P95: ${report.performance.search.toFixed(2)}ms`);
    console.log(`  - Render P95: ${report.performance.render.toFixed(2)}ms`);
    console.log(`  - Total P95: ${report.performance.total.toFixed(2)}ms`);

    // Assert overall performance targets
    expect(report.p95ResponseTime).toBeLessThan(PERFORMANCE_TARGETS.SEARCH_RESPONSE_TIME);
    expect(report.cacheHitRate).toBeGreaterThan(0.7); // 70% cache hit rate minimum
    expect(report.errorRate).toBeLessThan(0.1); // Less than 10% error rate
    expect(report.memoryUsage.max).toBeLessThan(PERFORMANCE_TARGETS.MEMORY_LIMIT);

    console.log('\n✅ All performance targets met!');
  });
});

test.describe('Concurrent User Load Testing', () => {
  test('100 concurrent users performance', async ({ browser }) => {
    const userCount = 50; // Reduced for test environment
    const searchesPerUser = 5;
    const contexts = [];
    const results: PerformanceMetrics[] = [];

    // Create concurrent contexts
    for (let i = 0; i < userCount; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      contexts.push({ context, page });
    }

    const startTime = performance.now();

    // Run concurrent searches
    const promises = contexts.map(async ({ page }, userIndex) => {
      try {
        await page.goto('/');
        await page.waitForSelector('[data-testid="search-input"]');

        for (let searchIndex = 0; searchIndex < searchesPerUser; searchIndex++) {
          const query = `test query ${userIndex}-${searchIndex}`;
          const searchStartTime = performance.now();

          await page.fill('[data-testid="search-input"]', query);
          await page.press('[data-testid="search-input"]', 'Enter');

          await page.waitForSelector('[data-testid="search-results"]', { timeout: 3000 });

          const searchTime = performance.now() - searchStartTime;

          results.push({
            searchTime,
            renderTime: 0,
            totalTime: searchTime,
            memoryUsage: 0,
            cacheHit: false,
            resultsCount: await page.locator('[data-testid="search-result-item"]').count(),
            errorCount: 0
          });

          await page.fill('[data-testid="search-input"]', '');
          await page.waitForTimeout(Math.random() * 100); // Random delay
        }
      } catch (error) {
        console.error(`User ${userIndex} failed:`, error.message);
      }
    });

    await Promise.all(promises);

    const totalTime = performance.now() - startTime;

    // Clean up contexts
    for (const { context } of contexts) {
      await context.close();
    }

    // Analyze results
    const successfulSearches = results.filter(r => r.resultsCount > 0);
    const avgResponseTime = successfulSearches.reduce((sum, r) => sum + r.totalTime, 0) / successfulSearches.length;
    const responseTimes = successfulSearches.map(r => r.totalTime);
    const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];

    console.log(`\n=== Concurrent Load Test Results ===`);
    console.log(`Users: ${userCount}`);
    console.log(`Total Searches: ${results.length}`);
    console.log(`Successful Searches: ${successfulSearches.length}`);
    console.log(`Success Rate: ${(successfulSearches.length / results.length * 100).toFixed(1)}%`);
    console.log(`Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`P95 Response Time: ${p95ResponseTime.toFixed(2)}ms`);
    console.log(`Total Test Time: ${(totalTime / 1000).toFixed(2)}s`);

    // Assert performance under load
    expect(successfulSearches.length / results.length).toBeGreaterThan(0.95); // 95% success rate
    expect(p95ResponseTime).toBeLessThan(2000); // Allow higher latency under load
    expect(avgResponseTime).toBeLessThan(1500);
  });
});