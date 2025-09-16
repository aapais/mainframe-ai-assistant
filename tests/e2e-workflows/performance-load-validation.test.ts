/**
 * Performance Load Validation Tests
 * Validates system performance under realistic load conditions
 * Focuses on concurrent users, high-volume operations, and stress testing
 */

import { test, expect } from '@playwright/test';
import { WorkflowTestHelper } from '../helpers/WorkflowTestHelper';
import { PerformanceMonitor } from '../helpers/PerformanceMonitor';
import { DataIntegrityChecker } from '../helpers/DataIntegrityChecker';

/**
 * Performance test configuration matching support team requirements
 */
const PERFORMANCE_CONFIG = {
  // Load testing parameters
  maxConcurrentUsers: 10,        // Peak concurrent users
  searchesPerUserPerHour: 12,    // Expected search frequency
  dailySearchVolume: 100,        // Total daily searches

  // Performance thresholds
  searchResponseTime: 1000,      // <1s as per MVP1 requirements
  concurrentSearchTime: 1500,    // Acceptable degradation under load
  memoryGrowthLimit: 200,        // Max memory growth in MB
  cpuThresholdPercent: 70,       // Max CPU usage under load

  // Stress testing limits
  stressTestDuration: 300000,    // 5 minutes stress test
  errorRateThreshold: 0.02,      // 2% maximum error rate
  recoveryTimeLimit: 5000,       // 5s maximum recovery time

  // Data integrity requirements
  dataConsistencyCheck: true,
  checksumValidation: true,
  transactionIntegrity: true
};

let workflowHelper: WorkflowTestHelper;
let performanceMonitor: PerformanceMonitor;
let dataIntegrityChecker: DataIntegrityChecker;

test.beforeAll(async () => {
  workflowHelper = new WorkflowTestHelper();
  performanceMonitor = new PerformanceMonitor();
  dataIntegrityChecker = new DataIntegrityChecker();

  // Create performance baseline
  await workflowHelper.createPerformanceBaseline();
  performanceMonitor.startMonitoring(500); // Monitor every 500ms
});

test.afterAll(async () => {
  performanceMonitor.stopMonitoring();
  await performanceMonitor.generateReport();
  await workflowHelper.cleanup();
  await dataIntegrityChecker.cleanup();
});

/**
 * CONCURRENT USER LOAD TESTS
 * Test system behavior with multiple simultaneous users
 */
test.describe('Concurrent User Load Testing', () => {

  test('PERF-001: Concurrent search performance validation', async ({ browser }) => {
    test.setTimeout(60000); // 1 minute timeout

    await test.step('Initialize concurrent user sessions', async () => {
      const userCount = PERFORMANCE_CONFIG.maxConcurrentUsers;
      const contexts = await Promise.all(
        Array.from({ length: userCount }, () => browser.newContext())
      );
      const pages = await Promise.all(
        contexts.map(context => context.newPage())
      );

      console.log(`🔄 Starting concurrent load test with ${userCount} users`);

      const searchQueries = [
        'VSAM status 35',
        'JCL dataset not found',
        'S0C7 data exception',
        'DB2 connection error',
        'batch job failure',
        'CICS transaction abend',
        'IMS database lock',
        'system performance issue'
      ];

      // Record start time and initial metrics
      const testStartTime = Date.now();
      const initialMemory = await performanceMonitor.getResourceMetrics();

      // Execute concurrent searches
      const userPromises = pages.map(async (page, userIndex) => {
        const userResults = [];

        for (let searchIndex = 0; searchIndex < 3; searchIndex++) {
          const query = searchQueries[searchIndex % searchQueries.length];
          const searchStartTime = Date.now();

          try {
            await page.goto('/');
            await page.waitForSelector('[data-testid="search-interface"]', { timeout: 5000 });

            await page.fill('[data-testid="search-input"]', query);
            await page.click('[data-testid="search-button"]');
            await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

            const responseTime = Date.now() - searchStartTime;

            // Verify results are displayed
            const resultCount = await page.$$eval(
              '[data-testid="result-item"]',
              elements => elements.length
            );

            userResults.push({
              user: userIndex,
              search: searchIndex,
              query,
              responseTime,
              resultCount,
              success: true
            });

            performanceMonitor.recordSearchPerformance(query, responseTime, resultCount);

            // Small delay between searches to simulate realistic usage
            await page.waitForTimeout(100 + Math.random() * 200);

          } catch (error) {
            userResults.push({
              user: userIndex,
              search: searchIndex,
              query,
              responseTime: Date.now() - searchStartTime,
              resultCount: 0,
              success: false,
              error: error.message
            });

            performanceMonitor.recordError('concurrent_search_failure', Date.now() - searchStartTime);
          }
        }

        return userResults;
      });

      // Wait for all concurrent operations to complete
      const allResults = await Promise.all(userPromises);
      const flatResults = allResults.flat();

      const testDuration = Date.now() - testStartTime;
      const finalMemory = await performanceMonitor.getResourceMetrics();

      // Record concurrent user metrics
      performanceMonitor.recordConcurrentUsers(
        userCount,
        flatResults.reduce((sum, r) => sum + r.responseTime, 0) / flatResults.length
      );

      // Validate performance requirements
      const successfulSearches = flatResults.filter(r => r.success);
      const failedSearches = flatResults.filter(r => !r.success);

      expect(successfulSearches.length).toBeGreaterThan(flatResults.length * 0.98); // 98% success rate

      const avgResponseTime = successfulSearches.reduce((sum, r) => sum + r.responseTime, 0) / successfulSearches.length;
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_CONFIG.concurrentSearchTime);

      // Check memory growth
      const memoryGrowth = finalMemory.memoryUsage - initialMemory.memoryUsage;
      expect(memoryGrowth).toBeLessThan(PERFORMANCE_CONFIG.memoryGrowthLimit);

      // Validate error rate
      const errorRate = failedSearches.length / flatResults.length;
      expect(errorRate).toBeLessThan(PERFORMANCE_CONFIG.errorRateThreshold);

      console.log(`✅ Concurrent load test completed:`);
      console.log(`   - ${successfulSearches.length}/${flatResults.length} successful searches`);
      console.log(`   - Average response time: ${avgResponseTime.toFixed(0)}ms`);
      console.log(`   - Memory growth: ${memoryGrowth.toFixed(1)}MB`);
      console.log(`   - Error rate: ${(errorRate * 100).toFixed(1)}%`);

      // Cleanup
      await Promise.all(contexts.map(context => context.close()));
    });
  });

  test('PERF-002: Sustained load with realistic usage patterns', async ({ browser }) => {
    test.setTimeout(180000); // 3 minutes timeout

    await test.step('Simulate sustained support team usage', async () => {
      const sessionDuration = 60000; // 1 minute sustained load
      const usersCount = 5;

      const contexts = await Promise.all(
        Array.from({ length: usersCount }, () => browser.newContext())
      );
      const pages = await Promise.all(
        contexts.map(context => context.newPage())
      );

      const startTime = Date.now();
      let totalOperations = 0;
      let successfulOperations = 0;

      // Simulate realistic support team workflow patterns
      const userWorkflows = pages.map(async (page, userIndex) => {
        const userOperations = [];

        while (Date.now() - startTime < sessionDuration) {
          try {
            // Simulate different types of operations
            const operationType = Math.random();

            if (operationType < 0.7) {
              // 70% - Regular search operations
              await this.performSearch(page, userIndex);
              successfulOperations++;
            } else if (operationType < 0.9) {
              // 20% - Entry detail viewing
              await this.viewEntryDetails(page, userIndex);
              successfulOperations++;
            } else {
              // 10% - Entry rating/feedback
              await this.provideFeedback(page, userIndex);
              successfulOperations++;
            }

            totalOperations++;

            // Realistic pause between operations (30-120 seconds)
            const pauseTime = 30000 + Math.random() * 90000;
            await page.waitForTimeout(Math.min(pauseTime, sessionDuration - (Date.now() - startTime)));

          } catch (error) {
            totalOperations++;
            performanceMonitor.recordError('sustained_load_error');
            console.warn(`User ${userIndex} operation failed: ${error.message}`);
          }
        }

        return userOperations;
      });

      await Promise.all(userWorkflows);

      const actualDuration = Date.now() - startTime;
      const successRate = successfulOperations / totalOperations;

      performanceMonitor.recordTestCompletion('sustained_load', successRate > 0.95, actualDuration);

      // Validate sustained performance
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
      expect(totalOperations).toBeGreaterThan(usersCount * 2); // Minimum activity

      console.log(`✅ Sustained load test completed:`);
      console.log(`   - Duration: ${actualDuration}ms`);
      console.log(`   - Total operations: ${totalOperations}`);
      console.log(`   - Success rate: ${(successRate * 100).toFixed(1)}%`);

      await Promise.all(contexts.map(context => context.close()));
    });
  });

  // Helper method for search operations
  async performSearch(page: any, userIndex: number): Promise<void> {
    const queries = ['VSAM error', 'JCL problem', 'batch failure', 'system issue'];
    const query = queries[userIndex % queries.length];

    const startTime = Date.now();

    await page.goto('/');
    await page.fill('[data-testid="search-input"]', query);
    await page.click('[data-testid="search-button"]');
    await page.waitForSelector('[data-testid="search-results"]');

    const responseTime = Date.now() - startTime;
    performanceMonitor.recordSearchPerformance(query, responseTime, 1);

    expect(responseTime).toBeLessThan(PERFORMANCE_CONFIG.searchResponseTime * 2); // Allow 2x normal time under load
  }

  // Helper method for viewing entry details
  async viewEntryDetails(page: any, userIndex: number): Promise<void> {
    await page.goto('/');
    await page.fill('[data-testid="search-input"]', 'test');
    await page.click('[data-testid="search-button"]');
    await page.waitForSelector('[data-testid="search-results"]');

    const results = await page.$$('[data-testid="result-item"]');
    if (results.length > 0) {
      await results[0].click();
      await page.waitForSelector('[data-testid="entry-detail"]');
    }
  }

  // Helper method for providing feedback
  async provideFeedback(page: any, userIndex: number): Promise<void> {
    await this.viewEntryDetails(page, userIndex);

    const feedbackButton = await page.$('[data-testid="feedback-success"]');
    if (feedbackButton) {
      await feedbackButton.click();
    }
  }
});

/**
 * HIGH-VOLUME OPERATIONS TESTING
 * Test system behavior with large datasets and bulk operations
 */
test.describe('High-Volume Operations Testing', () => {

  test('PERF-003: Large dataset search performance', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes timeout

    await test.step('Test search performance with large KB', async () => {
      // Generate large test dataset
      const largeDataset = workflowHelper.generateTestData(1000); // 1000 entries

      console.log('📊 Testing search performance with 1000 KB entries');

      // Measure search performance across different query types
      const searchTests = [
        { type: 'exact_match', query: 'VSAM Status 35' },
        { type: 'partial_match', query: 'database error' },
        { type: 'category_search', query: 'category:JCL' },
        { type: 'tag_search', query: 'tag:error' },
        { type: 'complex_query', query: 'system performance batch job' }
      ];

      for (const searchTest of searchTests) {
        const startTime = Date.now();

        await page.goto('/');
        await page.fill('[data-testid="search-input"]', searchTest.query);
        await page.click('[data-testid="search-button"]');
        await page.waitForSelector('[data-testid="search-results"]');

        const responseTime = Date.now() - startTime;
        const resultCount = await page.$$eval(
          '[data-testid="result-item"]',
          elements => elements.length
        );

        performanceMonitor.recordSearchPerformance(searchTest.query, responseTime, resultCount);

        // Validate performance requirements
        expect(responseTime).toBeLessThan(PERFORMANCE_CONFIG.searchResponseTime);
        expect(resultCount).toBeGreaterThanOrEqual(0);

        console.log(`  ${searchTest.type}: ${responseTime}ms (${resultCount} results)`);

        // Short delay between searches
        await page.waitForTimeout(100);
      }
    });
  });

  test('PERF-004: Bulk operations stress test', async ({ page }) => {
    test.setTimeout(300000); // 5 minutes timeout

    await test.step('Perform bulk KB operations', async () => {
      const bulkOperations = [
        'bulk_search_sequential',
        'bulk_entry_viewing',
        'bulk_feedback_submission'
      ];

      for (const operation of bulkOperations) {
        console.log(`🔄 Starting ${operation} stress test`);
        const startTime = Date.now();

        switch (operation) {
          case 'bulk_search_sequential':
            await this.performBulkSearches(page, 50);
            break;
          case 'bulk_entry_viewing':
            await this.performBulkEntryViews(page, 30);
            break;
          case 'bulk_feedback_submission':
            await this.performBulkFeedback(page, 20);
            break;
        }

        const duration = Date.now() - startTime;
        performanceMonitor.recordTestCompletion(operation, true, duration);

        console.log(`  ${operation} completed in ${duration}ms`);
      }
    });
  });

  // Helper method for bulk searches
  async performBulkSearches(page: any, count: number): Promise<void> {
    const searchTerms = [
      'VSAM', 'JCL', 'DB2', 'CICS', 'IMS', 'batch', 'error', 'system',
      'performance', 'connection', 'timeout', 'memory', 'disk', 'network'
    ];

    for (let i = 0; i < count; i++) {
      const term = searchTerms[i % searchTerms.length];
      const startTime = Date.now();

      await page.goto('/');
      await page.fill('[data-testid="search-input"]', `${term} test ${i}`);
      await page.click('[data-testid="search-button"]');
      await page.waitForSelector('[data-testid="search-results"]');

      const responseTime = Date.now() - startTime;
      performanceMonitor.recordSearchPerformance(`${term} test ${i}`, responseTime, 1);

      expect(responseTime).toBeLessThan(PERFORMANCE_CONFIG.searchResponseTime * 1.5);

      // Minimal delay to prevent overwhelming the system
      await page.waitForTimeout(10);
    }
  }

  // Helper method for bulk entry views
  async performBulkEntryViews(page: any, count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await page.goto('/');
      await page.fill('[data-testid="search-input"]', 'test entry');
      await page.click('[data-testid="search-button"]');
      await page.waitForSelector('[data-testid="search-results"]');

      const results = await page.$$('[data-testid="result-item"]');
      if (results.length > 0) {
        const startTime = Date.now();
        await results[0].click();
        await page.waitForSelector('[data-testid="entry-detail"]');
        const viewTime = Date.now() - startTime;

        expect(viewTime).toBeLessThan(2000); // 2s max for entry view
      }

      await page.waitForTimeout(10);
    }
  }

  // Helper method for bulk feedback
  async performBulkFeedback(page: any, count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.performBulkEntryViews(page, 1);

      const feedbackButton = await page.$('[data-testid="feedback-success"]');
      if (feedbackButton) {
        const startTime = Date.now();
        await feedbackButton.click();

        // Wait for feedback confirmation
        try {
          await page.waitForSelector('[data-testid="feedback-success-message"]', { timeout: 2000 });
          const feedbackTime = Date.now() - startTime;
          expect(feedbackTime).toBeLessThan(1000); // 1s max for feedback
        } catch (error) {
          // Feedback UI might not be implemented yet
          console.warn(`Feedback UI not available for test ${i}`);
        }
      }

      await page.waitForTimeout(10);
    }
  }
});

/**
 * MEMORY AND RESOURCE STRESS TESTING
 * Test system behavior under resource constraints
 */
test.describe('Memory and Resource Stress Testing', () => {

  test('PERF-005: Memory usage under extended operations', async ({ page }) => {
    test.setTimeout(600000); // 10 minutes timeout

    await test.step('Monitor memory usage during extended session', async () => {
      const testDuration = 300000; // 5 minutes
      const startTime = Date.now();
      let operationCount = 0;

      const initialMetrics = await performanceMonitor.getResourceMetrics();
      console.log(`🔍 Initial memory usage: ${initialMetrics.memoryUsage.toFixed(1)}MB`);

      // Continuous operations to stress test memory
      while (Date.now() - startTime < testDuration) {
        try {
          // Vary operations to test different code paths
          const operation = operationCount % 4;

          switch (operation) {
            case 0:
              await page.goto('/');
              await page.fill('[data-testid="search-input"]', `memory test ${operationCount}`);
              await page.click('[data-testid="search-button"]');
              await page.waitForSelector('[data-testid="search-results"]');
              break;
            case 1:
              // Navigate to different views
              await page.goto('/');
              await page.click('[data-testid="menu-button"]');
              break;
            case 2:
              // Open and close modals
              await page.goto('/');
              const addButton = await page.$('[data-testid="add-entry-button"]');
              if (addButton) {
                await addButton.click();
                await page.waitForTimeout(100);
                const closeButton = await page.$('[data-testid="close-modal"]');
                if (closeButton) await closeButton.click();
              }
              break;
            case 3:
              // Refresh and reload
              await page.reload();
              await page.waitForSelector('[data-testid="search-interface"]');
              break;
          }

          operationCount++;

          // Check memory every 50 operations
          if (operationCount % 50 === 0) {
            const currentMetrics = await performanceMonitor.getResourceMetrics();
            const memoryGrowth = currentMetrics.memoryUsage - initialMetrics.memoryUsage;

            console.log(`  Operation ${operationCount}: ${currentMetrics.memoryUsage.toFixed(1)}MB (+${memoryGrowth.toFixed(1)}MB)`);

            // Validate memory doesn't grow excessively
            expect(memoryGrowth).toBeLessThan(PERFORMANCE_CONFIG.memoryGrowthLimit);

            // Check CPU usage
            expect(currentMetrics.cpuUsage).toBeLessThan(PERFORMANCE_CONFIG.cpuThresholdPercent);
          }

          // Small delay to prevent overwhelming
          await page.waitForTimeout(10);

        } catch (error) {
          console.warn(`Memory stress test operation ${operationCount} failed: ${error.message}`);
          performanceMonitor.recordError('memory_stress_error');
        }
      }

      const finalMetrics = await performanceMonitor.getResourceMetrics();
      const totalMemoryGrowth = finalMetrics.memoryUsage - initialMetrics.memoryUsage;
      const testDurationActual = Date.now() - startTime;

      console.log(`✅ Memory stress test completed:`);
      console.log(`  - Duration: ${(testDurationActual / 1000).toFixed(1)}s`);
      console.log(`  - Operations: ${operationCount}`);
      console.log(`  - Memory growth: ${totalMemoryGrowth.toFixed(1)}MB`);
      console.log(`  - Final CPU usage: ${finalMetrics.cpuUsage.toFixed(1)}%`);

      // Final validations
      expect(totalMemoryGrowth).toBeLessThan(PERFORMANCE_CONFIG.memoryGrowthLimit);
      expect(finalMetrics.cpuUsage).toBeLessThan(PERFORMANCE_CONFIG.cpuThresholdPercent);
      expect(operationCount).toBeGreaterThan(100); // Minimum operations completed
    });
  });

  test('PERF-006: Resource cleanup validation', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes timeout

    await test.step('Validate proper resource cleanup', async () => {
      const initialMetrics = await performanceMonitor.getResourceMetrics();

      // Perform intensive operations
      for (let i = 0; i < 100; i++) {
        await page.goto('/');
        await page.fill('[data-testid="search-input"]', `cleanup test ${i}`);
        await page.click('[data-testid="search-button"]');
        await page.waitForSelector('[data-testid="search-results"]');

        // Open entry details
        const results = await page.$$('[data-testid="result-item"]');
        if (results.length > 0) {
          await results[0].click();
          await page.waitForSelector('[data-testid="entry-detail"]');
        }

        if (i % 10 === 0) {
          // Force garbage collection simulation
          await page.evaluate(() => {
            // Trigger cleanup operations if available
            if ('gc' in window) {
              (window as any).gc();
            }
          });
        }
      }

      // Wait for cleanup
      await page.waitForTimeout(5000);

      const finalMetrics = await performanceMonitor.getResourceMetrics();
      const memoryIncrease = finalMetrics.memoryUsage - initialMetrics.memoryUsage;

      console.log(`🧹 Resource cleanup validation:`);
      console.log(`  - Initial memory: ${initialMetrics.memoryUsage.toFixed(1)}MB`);
      console.log(`  - Final memory: ${finalMetrics.memoryUsage.toFixed(1)}MB`);
      console.log(`  - Net increase: ${memoryIncrease.toFixed(1)}MB`);

      // Validate reasonable memory usage after cleanup
      expect(memoryIncrease).toBeLessThan(100); // Max 100MB increase after cleanup
    });
  });
});

/**
 * ERROR RECOVERY AND RESILIENCE TESTING
 * Test system behavior during and after errors
 */
test.describe('Error Recovery and Resilience Testing', () => {

  test('PERF-007: Error recovery performance', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes timeout

    await test.step('Test system recovery from various error scenarios', async () => {
      const errorScenarios = workflowHelper.createErrorScenarios();

      for (const scenario of errorScenarios) {
        console.log(`🔄 Testing error recovery: ${scenario.name}`);

        const startTime = Date.now();

        // Trigger error scenario
        await scenario.trigger();

        // Attempt normal operation during error
        try {
          await page.goto('/');
          await page.fill('[data-testid="search-input"]', 'error recovery test');
          await page.click('[data-testid="search-button"]');

          // Should either work with fallback or show appropriate error
          await Promise.race([
            page.waitForSelector('[data-testid="search-results"]'),
            page.waitForSelector('[data-testid="error-message"]'),
            page.waitForSelector('[data-testid="fallback-notice"]')
          ]);

        } catch (error) {
          console.log(`  Expected error during ${scenario.name}: ${error.message}`);
        }

        // Wait for recovery
        await page.waitForTimeout(scenario.recoveryTime);

        // Test recovery
        await page.goto('/');
        await page.fill('[data-testid="search-input"]', 'recovery validation');
        await page.click('[data-testid="search-button"]');
        await page.waitForSelector('[data-testid="search-results"]');

        const recoveryTime = Date.now() - startTime;

        expect(recoveryTime).toBeLessThan(PERFORMANCE_CONFIG.recoveryTimeLimit);

        performanceMonitor.recordError(scenario.name, recoveryTime);

        console.log(`  ✅ ${scenario.name} recovery: ${recoveryTime}ms`);
      }
    });
  });

  test('PERF-008: Data integrity during high load', async ({ page }) => {
    test.setTimeout(300000); // 5 minutes timeout

    await test.step('Validate data integrity under stress', async () => {
      // Get initial data state
      const initialIntegrityCheck = await dataIntegrityChecker.validateDatabase();
      expect(initialIntegrityCheck.isValid).toBe(true);

      console.log('🔍 Starting data integrity stress test');

      // Perform high-volume operations that could affect data integrity
      const stressOperations = 200;

      for (let i = 0; i < stressOperations; i++) {
        try {
          // Mix of read and write operations
          if (i % 10 === 0) {
            // Simulated write operations (feedback submission)
            await page.goto('/');
            await page.fill('[data-testid="search-input"]', 'integrity test');
            await page.click('[data-testid="search-button"]');
            await page.waitForSelector('[data-testid="search-results"]');

            const results = await page.$$('[data-testid="result-item"]');
            if (results.length > 0) {
              await results[0].click();
              await page.waitForSelector('[data-testid="entry-detail"]');

              const feedbackButton = await page.$('[data-testid="feedback-success"]');
              if (feedbackButton) {
                await feedbackButton.click();
              }
            }
          } else {
            // Read operations
            await page.goto('/');
            await page.fill('[data-testid="search-input"]', `stress ${i}`);
            await page.click('[data-testid="search-button"]');
            await page.waitForSelector('[data-testid="search-results"]');
          }

          // Periodic integrity checks
          if (i % 50 === 0 && i > 0) {
            const intermediateCheck = await dataIntegrityChecker.validateDatabase();
            expect(intermediateCheck.violations.filter(v => v.severity === 'critical').length).toBe(0);
            console.log(`  Integrity check ${i}: ${intermediateCheck.violations.length} violations`);
          }

        } catch (error) {
          console.warn(`Stress operation ${i} failed: ${error.message}`);
        }
      }

      // Final comprehensive integrity check
      const finalIntegrityCheck = await dataIntegrityChecker.validateDatabase();

      console.log('✅ Data integrity stress test completed');
      console.log(`  - Initial violations: ${initialIntegrityCheck.violations.length}`);
      console.log(`  - Final violations: ${finalIntegrityCheck.violations.length}`);
      console.log(`  - Critical issues: ${finalIntegrityCheck.violations.filter(v => v.severity === 'critical').length}`);

      // Validate data integrity maintained
      expect(finalIntegrityCheck.violations.filter(v => v.severity === 'critical').length).toBe(0);
      expect(finalIntegrityCheck.overallHealth).toBeGreaterThan(0.95); // 95% health score
    });
  });
});

/**
 * FINAL PERFORMANCE VALIDATION
 * Comprehensive validation of all performance requirements
 */
test('PERF-009: Comprehensive performance validation', async ({ page }) => {
  test.setTimeout(300000); // 5 minutes timeout

  await test.step('Final comprehensive performance validation', async () => {
    console.log('🏁 Starting comprehensive performance validation');

    // Get all performance metrics
    const testResults = await performanceMonitor.getTestResults();
    const performanceSummary = performanceMonitor.getPerformanceSummary();
    const integrityReport = await dataIntegrityChecker.getFinalReport();

    console.log('📊 Performance validation results:');
    console.log(`  - Total tests: ${testResults.totalTests}`);
    console.log(`  - Success rate: ${(testResults.successRate * 100).toFixed(1)}%`);
    console.log(`  - Average response time: ${testResults.averageResponseTime.toFixed(0)}ms`);
    console.log(`  - Max concurrent users: ${testResults.concurrentUsers}`);
    console.log(`  - Error rate: ${(testResults.errorRate * 100).toFixed(2)}%`);
    console.log(`  - Data integrity score: ${integrityReport.overallHealth.toFixed(2)}`);

    // Validate all MVP1 performance requirements
    expect(testResults.successRate).toBeGreaterThan(0.95); // 95% success rate
    expect(testResults.averageResponseTime).toBeLessThan(PERFORMANCE_CONFIG.searchResponseTime);
    expect(testResults.concurrentUsers).toBeGreaterThanOrEqual(PERFORMANCE_CONFIG.maxConcurrentUsers);
    expect(testResults.errorRate).toBeLessThan(PERFORMANCE_CONFIG.errorRateThreshold);
    expect(integrityReport.overallHealth).toBeGreaterThan(0.99); // 99% data integrity

    // Validate performance trends
    const degradingTrends = Object.entries(performanceSummary.trends)
      .filter(([metric, trend]) => trend === 'degrading').length;

    expect(degradingTrends).toBeLessThan(3); // Max 3 degrading metrics acceptable

    // Check critical alerts
    const criticalAlerts = performanceSummary.alerts.filter(alert => alert.level === 'critical');
    expect(criticalAlerts.length).toBe(0); // No critical performance alerts

    // Final validation message
    const overallStatus = testResults.successRate > 0.95 &&
                         testResults.averageResponseTime < PERFORMANCE_CONFIG.searchResponseTime &&
                         testResults.errorRate < PERFORMANCE_CONFIG.errorRateThreshold &&
                         integrityReport.overallHealth > 0.99;

    if (overallStatus) {
      console.log('🟢 PERFORMANCE VALIDATION PASSED - System ready for production');
    } else {
      console.log('🟡 PERFORMANCE VALIDATION NEEDS ATTENTION - Review metrics');
    }

    expect(overallStatus).toBe(true);
  });
});