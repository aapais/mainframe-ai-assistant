import { test, expect } from '../../fixtures/electron-fixtures';
import { PerformanceTestHelpers } from '../../fixtures/electron-fixtures';

/**
 * Electron Application Performance Tests
 * Tests application performance metrics, memory usage, and responsiveness
 */

test.describe('Application Performance', () => {
  test.beforeEach(async ({ electronHelpers }) => {
    await electronHelpers.clearAppData();
    await electronHelpers.startPerformanceMonitoring();
  });

  test('should meet startup performance benchmarks', async ({
    electronApp,
    electronHelpers
  }) => {
    // Measure startup time
    const startupTime = await PerformanceTestHelpers.measureStartupTime(electronApp);

    // Startup should be under 5 seconds
    expect(startupTime).toBeLessThan(5000);

    // Attach metrics for reporting
    await test.info().attach('startup-time', {
      body: startupTime.toString(),
      contentType: 'text/plain'
    });

    console.log(`App startup time: ${startupTime}ms`);
  });

  test('should maintain reasonable memory usage', async ({
    electronApp,
    appPage,
    electronHelpers
  }) => {
    await electronHelpers.waitForAppReady();

    // Get initial memory usage
    const initialMemory = await PerformanceTestHelpers.measureMemoryUsage(electronApp);
    expect(initialMemory).toBeTruthy();

    // Perform some operations to stress memory
    for (let i = 0; i < 10; i++) {
      await appPage.evaluate(() => {
        // Create some DOM elements
        const div = document.createElement('div');
        div.innerHTML = 'Test content ' + Math.random();
        document.body.appendChild(div);
      });

      await appPage.waitForTimeout(100);
    }

    // Get memory after operations
    const finalMemory = await PerformanceTestHelpers.measureMemoryUsage(electronApp);

    // Memory growth should be reasonable
    const memoryGrowth = finalMemory[0]?.memory?.workingSetSize - initialMemory[0]?.memory?.workingSetSize;

    if (memoryGrowth) {
      // Memory growth should be less than 100MB
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024);

      // Attach memory metrics
      await test.info().attach('memory-usage', {
        body: finalMemory[0].memory.workingSetSize.toString(),
        contentType: 'text/plain'
      });
    }
  });

  test('should render components quickly', async ({
    appPage,
    electronHelpers
  }) => {
    await electronHelpers.waitForAppReady();

    // Measure search bar render time
    const searchBarTime = await PerformanceTestHelpers.measureRenderTime(
      appPage,
      '[data-testid="search-bar"], input[type="search"], .search-input'
    );

    expect(searchBarTime).toBeLessThan(2000);

    // Measure knowledge base list render time
    const kbListTime = await PerformanceTestHelpers.measureRenderTime(
      appPage,
      '[data-testid="knowledge-base-list"], .kb-list, .entries-list'
    );

    expect(kbListTime).toBeLessThan(3000);

    console.log(`Search bar render time: ${searchBarTime}ms`);
    console.log(`KB list render time: ${kbListTime}ms`);
  });

  test('should handle search operations efficiently', async ({
    appPage,
    electronHelpers
  }) => {
    await electronHelpers.waitForAppReady();

    // Import test data for search testing
    const testDataPath = './tests/playwright/test-data/sample-kb.json';
    await electronHelpers.importTestData(testDataPath);

    // Wait for data to load
    await appPage.waitForSelector('[data-testid="kb-entry"]', { timeout: 10000 });

    const searchInput = appPage.locator('[data-testid="search-input"]')
      .or(appPage.locator('input[type="search"]'))
      .or(appPage.locator('.search-input'));

    await expect(searchInput).toBeVisible();

    // Measure search performance
    const { duration: searchDuration } = await electronHelpers.measureOperation(
      async () => {
        await searchInput.fill('COBOL');
        await searchInput.press('Enter');
        await appPage.waitForTimeout(500);
      },
      'search-operation'
    );

    // Search should complete quickly
    expect(searchDuration).toBeLessThan(2000);

    // Test typing performance (simulating real-time search)
    const typingSearches = ['C', 'CO', 'COB', 'COBO', 'COBOL'];

    for (const query of typingSearches) {
      const { duration: typingDuration } = await electronHelpers.measureOperation(
        async () => {
          await searchInput.fill(query);
          await appPage.waitForTimeout(100);
        },
        `typing-search-${query.length}`
      );

      // Each keystroke should be responsive
      expect(typingDuration).toBeLessThan(500);
    }
  });

  test('should handle large datasets without performance degradation', async ({
    appPage,
    electronHelpers
  }) => {
    await electronHelpers.waitForAppReady();

    // Create large dataset
    const largeDataset = [];
    for (let i = 0; i < 1000; i++) {
      largeDataset.push({
        id: `perf-test-${i}`,
        title: `Performance Test Entry ${i}`,
        category: i % 5 === 0 ? 'COBOL' : i % 5 === 1 ? 'JCL' : i % 5 === 2 ? 'VSAM' : i % 5 === 3 ? 'DB2' : 'CICS',
        content: `This is performance test content for entry number ${i}. It contains extensive mainframe information and details for testing search and rendering performance.`,
        tags: [`perf-tag-${i % 10}`, `category-${i % 5}`, `type-${i % 3}`],
        createdAt: new Date(Date.now() - i * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Seed database with large dataset
    await electronHelpers.seedDatabase(largeDataset);

    // Measure load time with large dataset
    const { duration: loadDuration } = await electronHelpers.measureOperation(
      async () => {
        await appPage.reload();
        await appPage.waitForSelector('[data-testid="kb-entry"]', { timeout: 20000 });
      },
      'large-dataset-load'
    );

    // Should handle large dataset reasonably well
    expect(loadDuration).toBeLessThan(15000);

    // Test search performance with large dataset
    const searchInput = appPage.locator('[data-testid="search-input"]')
      .or(appPage.locator('input[type="search"]'));

    if (await searchInput.isVisible()) {
      const { duration: searchDuration } = await electronHelpers.measureOperation(
        async () => {
          await searchInput.fill('Performance Test Entry 500');
          await appPage.waitForTimeout(1000);
        },
        'large-dataset-search'
      );

      // Search should remain fast even with large dataset
      expect(searchDuration).toBeLessThan(5000);
    }

    // Test scrolling performance
    const { duration: scrollDuration } = await electronHelpers.measureOperation(
      async () => {
        await appPage.keyboard.press('PageDown');
        await appPage.waitForTimeout(100);
        await appPage.keyboard.press('PageDown');
        await appPage.waitForTimeout(100);
        await appPage.keyboard.press('PageUp');
        await appPage.waitForTimeout(100);
      },
      'scrolling-performance'
    );

    // Scrolling should be smooth
    expect(scrollDuration).toBeLessThan(1000);
  });

  test('should maintain UI responsiveness under load', async ({
    appPage,
    electronHelpers
  }) => {
    await electronHelpers.waitForAppReady();

    // Create CPU-intensive task
    await appPage.evaluate(() => {
      // Simulate CPU-intensive work in background
      const worker = () => {
        let count = 0;
        const start = Date.now();
        while (Date.now() - start < 2000) {
          count++;
        }
        return count;
      };

      // Run worker in background
      setTimeout(worker, 100);
    });

    // Test UI responsiveness during CPU load
    const searchInput = appPage.locator('[data-testid="search-input"]')
      .or(appPage.locator('input[type="search"]'));

    if (await searchInput.isVisible()) {
      const { duration: responseDuration } = await electronHelpers.measureOperation(
        async () => {
          await searchInput.click();
          await searchInput.type('test', { delay: 100 });
        },
        'ui-responsiveness-under-load'
      );

      // UI should remain responsive even under CPU load
      expect(responseDuration).toBeLessThan(3000);
    }
  });

  test('should handle window resize and zoom efficiently', async ({
    appPage,
    electronHelpers
  }) => {
    await electronHelpers.waitForAppReady();

    const mainWindow = await electronHelpers.getMainWindow();

    // Test window resize performance
    const { duration: resizeDuration } = await electronHelpers.measureOperation(
      async () => {
        await mainWindow.setViewportSize({ width: 1200, height: 800 });
        await appPage.waitForTimeout(200);
        await mainWindow.setViewportSize({ width: 1600, height: 1000 });
        await appPage.waitForTimeout(200);
        await mainWindow.setViewportSize({ width: 1920, height: 1080 });
        await appPage.waitForTimeout(200);
      },
      'window-resize'
    );

    expect(resizeDuration).toBeLessThan(2000);

    // Test zoom performance
    const { duration: zoomDuration } = await electronHelpers.measureOperation(
      async () => {
        await appPage.keyboard.press('Control+=');
        await appPage.waitForTimeout(200);
        await appPage.keyboard.press('Control+=');
        await appPage.waitForTimeout(200);
        await appPage.keyboard.press('Control+-');
        await appPage.waitForTimeout(200);
        await appPage.keyboard.press('Control+0');
        await appPage.waitForTimeout(200);
      },
      'zoom-operations'
    );

    expect(zoomDuration).toBeLessThan(2000);
  });

  test('should optimize database operations', async ({
    appPage,
    electronHelpers
  }) => {
    await electronHelpers.waitForAppReady();

    // Test database query performance
    const { duration: queryDuration } = await electronHelpers.measureOperation(
      async () => {
        const dbStats = await electronHelpers.getDatabaseStats();
        expect(dbStats).toBeTruthy();
      },
      'database-query'
    );

    expect(queryDuration).toBeLessThan(1000);

    // Test batch operations
    const testEntries = [];
    for (let i = 0; i < 50; i++) {
      testEntries.push({
        id: `batch-test-${i}`,
        title: `Batch Test Entry ${i}`,
        category: 'TEST',
        content: `Test content ${i}`,
        tags: [`test-${i}`],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    const { duration: batchDuration } = await electronHelpers.measureOperation(
      async () => {
        await electronHelpers.seedDatabase(testEntries);
      },
      'batch-database-operations'
    );

    // Batch operations should be efficient
    expect(batchDuration).toBeLessThan(5000);
  });

  test('should monitor and report performance metrics', async ({
    electronApp,
    appPage,
    electronHelpers
  }) => {
    await electronHelpers.waitForAppReady();

    // Collect comprehensive performance data
    const performanceData = await electronHelpers.getPerformanceData();
    expect(performanceData).toBeTruthy();

    // Get app metrics
    const appMetrics = await electronHelpers.getAppMetrics();
    expect(appMetrics.metrics).toBeTruthy();

    // Generate performance report
    const performanceReport = {
      timestamp: new Date().toISOString(),
      metrics: {
        memory: appMetrics.metrics.map(m => ({
          type: m.type,
          memory: m.memory,
          cpu: m.cpu
        })),
        performance: performanceData,
        systemInfo: appMetrics.systemInfo
      }
    };

    // Attach comprehensive performance report
    await test.info().attach('performance-report', {
      body: JSON.stringify(performanceReport, null, 2),
      contentType: 'application/json'
    });

    // Verify critical performance thresholds
    const mainProcess = appMetrics.metrics.find(m => m.type === 'Browser');
    if (mainProcess) {
      // Main process memory should be reasonable
      expect(mainProcess.memory.workingSetSize).toBeLessThan(500 * 1024 * 1024); // 500MB

      // CPU usage should be reasonable
      if (mainProcess.cpu) {
        expect(mainProcess.cpu.percentCPUUsage).toBeLessThan(50);
      }
    }
  });
});

test.describe('Performance Regression Tests', () => {
  test('should maintain consistent performance across sessions', async ({
    electronApp,
    appPage,
    electronHelpers
  }) => {
    const sessionMetrics = [];

    // Run multiple sessions to test consistency
    for (let session = 0; session < 3; session++) {
      await electronHelpers.clearAppData();
      await electronHelpers.waitForAppReady();

      const startTime = Date.now();

      // Perform standard operations
      const testDataPath = './tests/playwright/test-data/sample-kb.json';
      await electronHelpers.importTestData(testDataPath);

      await appPage.waitForSelector('[data-testid="kb-entry"]', { timeout: 10000 });

      const searchInput = appPage.locator('[data-testid="search-input"]')
        .or(appPage.locator('input[type="search"]'));

      if (await searchInput.isVisible()) {
        await searchInput.fill('COBOL');
        await appPage.waitForTimeout(500);
      }

      const sessionTime = Date.now() - startTime;
      sessionMetrics.push(sessionTime);

      console.log(`Session ${session + 1} time: ${sessionTime}ms`);
    }

    // Check consistency - variance should be reasonable
    const avgTime = sessionMetrics.reduce((a, b) => a + b, 0) / sessionMetrics.length;
    const variance = sessionMetrics.reduce((acc, time) => acc + Math.pow(time - avgTime, 2), 0) / sessionMetrics.length;
    const stdDev = Math.sqrt(variance);

    // Standard deviation should be less than 20% of average
    expect(stdDev).toBeLessThan(avgTime * 0.2);
  });

  test('should handle memory cleanup properly', async ({
    electronApp,
    appPage,
    electronHelpers
  }) => {
    await electronHelpers.waitForAppReady();

    // Get baseline memory
    const baselineMemory = await PerformanceTestHelpers.measureMemoryUsage(electronApp);

    // Perform memory-intensive operations
    for (let i = 0; i < 5; i++) {
      // Create large dataset
      const largeDataset = Array.from({ length: 200 }, (_, index) => ({
        id: `memory-test-${i}-${index}`,
        title: `Memory Test Entry ${i}-${index}`,
        content: 'Large content '.repeat(100),
        category: 'TEST'
      }));

      await electronHelpers.seedDatabase(largeDataset);
      await appPage.waitForTimeout(1000);

      // Clear the data
      await electronHelpers.clearDatabase();
      await appPage.waitForTimeout(1000);
    }

    // Force garbage collection if available
    await appPage.evaluate(() => {
      if ((window as any).gc) {
        (window as any).gc();
      }
    });

    await appPage.waitForTimeout(2000);

    // Check final memory
    const finalMemory = await PerformanceTestHelpers.measureMemoryUsage(electronApp);

    // Memory should not have grown significantly
    const memoryGrowth = finalMemory[0]?.memory?.workingSetSize - baselineMemory[0]?.memory?.workingSetSize;

    if (memoryGrowth) {
      // Allow for some growth but not excessive
      expect(memoryGrowth).toBeLessThan(200 * 1024 * 1024); // 200MB threshold
    }
  });
});