/**
 * Search Performance Validation Tests
 * Tests performance characteristics of the search functionality
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Search Performance Tests', () => {
  let performanceMetrics: {
    searchTimes: number[];
    clearTimes: number[];
    memoryUsage: number[];
  };

  test.beforeEach(async ({ page }) => {
    performanceMetrics = {
      searchTimes: [],
      clearTimes: [],
      memoryUsage: []
    };

    await page.goto('http://localhost:3000/incidents');
    await page.waitForLoadState('networkidle');

    const listTab = page.locator('button:has-text("Lista de Incidentes")');
    if (await listTab.isVisible()) {
      await listTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('Search performance benchmarks', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    const testQueries = ['J', 'JC', 'JCL', 'DB2', 'VSAM', 'ABEND', 'Connection'];

    // Warm up
    await searchInput.fill('test');
    await page.waitForTimeout(100);
    await searchInput.fill('');
    await page.waitForTimeout(100);

    // Benchmark search operations
    for (const query of testQueries) {
      const startTime = performance.now();

      await searchInput.fill(query);
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => {
        const loadingSpinner = document.querySelector('[data-testid="loading-spinner"]');
        return !loadingSpinner || loadingSpinner.classList.contains('hidden');
      }, { timeout: 5000 });

      const endTime = performance.now();
      const searchTime = endTime - startTime;
      performanceMetrics.searchTimes.push(searchTime);

      console.log(`Search for "${query}": ${searchTime.toFixed(2)}ms`);

      // Assert performance threshold
      expect(searchTime).toBeLessThan(500); // 500ms max per search
    }

    // Calculate averages
    const avgSearchTime = performanceMetrics.searchTimes.reduce((a, b) => a + b, 0) / performanceMetrics.searchTimes.length;
    console.log(`Average search time: ${avgSearchTime.toFixed(2)}ms`);

    expect(avgSearchTime).toBeLessThan(300); // 300ms average max
  });

  test('Clear operation performance', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');

    // Test multiple clear operations
    for (let i = 0; i < 5; i++) {
      // Set search
      await searchInput.fill('JCL ABEND ERROR');
      await page.waitForTimeout(100);

      // Time clear operation
      const startTime = performance.now();
      await searchInput.fill('');
      await page.waitForLoadState('networkidle');
      const endTime = performance.now();

      const clearTime = endTime - startTime;
      performanceMetrics.clearTimes.push(clearTime);

      expect(clearTime).toBeLessThan(200); // 200ms max for clear
    }

    const avgClearTime = performanceMetrics.clearTimes.reduce((a, b) => a + b, 0) / performanceMetrics.clearTimes.length;
    console.log(`Average clear time: ${avgClearTime.toFixed(2)}ms`);
  });

  test('Rapid typing performance', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    const rapidSequence = 'JCLABENDERROR';

    const startTime = performance.now();

    // Simulate rapid typing
    for (let i = 0; i < rapidSequence.length; i++) {
      const partial = rapidSequence.substring(0, i + 1);
      await searchInput.fill(partial);
      await page.waitForTimeout(10); // Very fast typing
    }

    await page.waitForLoadState('networkidle');
    const endTime = performance.now();

    const totalTime = endTime - startTime;
    console.log(`Rapid typing sequence completed in: ${totalTime.toFixed(2)}ms`);

    expect(totalTime).toBeLessThan(2000); // Should handle rapid typing smoothly
  });

  test('Memory usage during extended search session', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    const queries = ['JCL', 'DB2', 'VSAM', 'ABEND', 'Connection', 'Pool', 'Error', 'System'];

    // Perform extended search session
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const query of queries) {
        await searchInput.fill(query);
        await page.waitForTimeout(50);
        await searchInput.fill('');
        await page.waitForTimeout(50);
      }

      // Check memory usage (basic client-side memory check)
      const memoryInfo = await page.evaluate(() => {
        // @ts-ignore
        return (performance as any).memory ? {
          // @ts-ignore
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          // @ts-ignore
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize
        } : null;
      });

      if (memoryInfo) {
        performanceMetrics.memoryUsage.push(memoryInfo.usedJSHeapSize);
        console.log(`Memory usage after cycle ${cycle + 1}: ${(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
      }
    }

    // Memory should not grow excessively
    if (performanceMetrics.memoryUsage.length > 1) {
      const initialMemory = performanceMetrics.memoryUsage[0];
      const finalMemory = performanceMetrics.memoryUsage[performanceMetrics.memoryUsage.length - 1];
      const memoryGrowth = finalMemory - initialMemory;

      console.log(`Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`);

      // Should not grow by more than 10MB during testing
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
    }
  });

  test('Debouncing effectiveness', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');

    // Track network requests
    const requestCount = { value: 0 };
    page.on('request', (request) => {
      if (request.url().includes('search') || request.url().includes('incident')) {
        requestCount.value++;
      }
    });

    // Type rapidly and then stop
    const rapidText = 'JCLABEND';
    for (let i = 0; i < rapidText.length; i++) {
      await searchInput.fill(rapidText.substring(0, i + 1));
      await page.waitForTimeout(50); // Rapid typing
    }

    // Wait for debouncing to settle
    await page.waitForTimeout(1000);

    console.log(`Network requests during rapid typing: ${requestCount.value}`);

    // Should have fewer requests than characters typed (due to debouncing)
    expect(requestCount.value).toBeLessThan(rapidText.length);
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Log performance summary
    if (performanceMetrics.searchTimes.length > 0) {
      const summary = {
        test: testInfo.title,
        avgSearchTime: performanceMetrics.searchTimes.reduce((a, b) => a + b, 0) / performanceMetrics.searchTimes.length,
        maxSearchTime: Math.max(...performanceMetrics.searchTimes),
        minSearchTime: Math.min(...performanceMetrics.searchTimes),
        totalOperations: performanceMetrics.searchTimes.length
      };

      console.log('Performance Summary:', JSON.stringify(summary, null, 2));
    }
  });
});