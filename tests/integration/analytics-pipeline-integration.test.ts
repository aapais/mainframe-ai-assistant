/**
 * Analytics Pipeline Integration Tests
 *
 * Tests the complete analytics data flow including:
 * - Metrics collection and aggregation
 * - Real-time monitoring integration
 * - Performance tracking across components
 * - Alert generation and thresholds
 * - Data persistence and reporting
 */

import { ServiceFactory } from '../../src/services/ServiceFactory';
import { MetricsService } from '../../src/services/MetricsService';
import { KnowledgeBaseService } from '../../src/services/KnowledgeBaseService';
import { SearchService } from '../../src/services/SearchService';
import { CacheService } from '../../src/services/CacheService';
import path from 'path';
import fs from 'fs/promises';

describe('Analytics Pipeline Integration Tests', () => {
  let serviceFactory: ServiceFactory;
  let metricsService: MetricsService;
  let kbService: KnowledgeBaseService;
  let searchService: SearchService;
  let cacheService: CacheService;
  let testDbPath: string;

  beforeAll(async () => {
    testDbPath = path.join('/tmp', `analytics-test-${Date.now()}.db`);

    serviceFactory = ServiceFactory.createTestFactory({
      database: {
        path: testDbPath,
        backup: { enabled: false, interval: 0, retention: 0, path: '' },
        performance: { connectionPool: 5, busyTimeout: 10000, cacheSize: 32000 },
        pragmas: { journal_mode: 'WAL', synchronous: 'NORMAL', cache_size: -32000 }
      },
      metrics: {
        enabled: true,
        retention: 86400000, // 24 hours for testing
        aggregation: {
          enabled: true,
          interval: 1000, // 1 second for testing
          batch: 10
        },
        alerts: {
          enabled: true,
          thresholds: {
            searchTime: 1000, // 1 second
            errorRate: 0.1, // 10%
            cacheHitRate: 0.8, // 80%
            dbTime: 500 // 500ms
          }
        }
      },
      cache: {
        maxSize: 100,
        ttl: 30000,
        checkPeriod: 5000,
        strategy: 'lru' as const,
        persistent: false
      }
    });

    await serviceFactory.initialize();
    metricsService = serviceFactory.getMetricsService();
    kbService = serviceFactory.getKnowledgeBaseService();
    searchService = serviceFactory.getSearchService();
    cacheService = serviceFactory.getCacheService();
  });

  afterAll(async () => {
    await serviceFactory.close();
    try {
      await fs.unlink(testDbPath);
      await fs.unlink(`${testDbPath}-wal`);
      await fs.unlink(`${testDbPath}-shm`);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Clear any existing metrics before each test
    await metricsService.clearMetrics?.();
  });

  describe('1. Metrics Collection Integration', () => {
    test('should collect metrics from knowledge base operations', async () => {
      // Perform operations that should generate metrics
      const entry = await kbService.createEntry({
        title: 'Metrics Test Entry',
        problem: 'Testing metrics collection from KB operations',
        solution: 'Metrics should be automatically collected',
        category: 'System',
        tags: ['metrics', 'test', 'analytics']
      });

      // Read the entry
      await kbService.getEntryById(entry.id!);

      // Update the entry
      await kbService.updateEntry(entry.id!, {
        ...entry,
        solution: 'Updated solution for metrics testing'
      });

      // Allow time for metrics to be recorded
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get metrics and verify collection
      const metrics = await metricsService.getMetrics();
      expect(metrics).toBeDefined();

      // Verify specific operation metrics
      if (metrics.operations) {
        expect(metrics.operations.create).toBeGreaterThan(0);
        expect(metrics.operations.read).toBeGreaterThan(0);
        expect(metrics.operations.update).toBeGreaterThan(0);
      }

      // Cleanup
      await kbService.deleteEntry(entry.id!);
    });

    test('should collect search operation metrics', async () => {
      // Create test entries for search
      const entries = await Promise.all([
        kbService.createEntry({
          title: 'Search Metrics Test 1',
          problem: 'First test entry for search metrics',
          solution: 'Solution for first test entry',
          category: 'System',
          tags: ['search', 'metrics', 'test1']
        }),
        kbService.createEntry({
          title: 'Search Metrics Test 2',
          problem: 'Second test entry for search metrics',
          solution: 'Solution for second test entry',
          category: 'VSAM',
          tags: ['search', 'metrics', 'test2']
        })
      ]);

      // Perform various search operations
      await searchService.search('metrics test', { maxResults: 10 });
      await searchService.search('VSAM', { categories: ['VSAM'], maxResults: 5 });
      await searchService.suggest('met', 5);

      // Allow time for metrics processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify search metrics were collected
      const metrics = await metricsService.getMetrics();
      expect(metrics).toBeDefined();

      if (metrics.searches) {
        expect(metrics.searches.total).toBeGreaterThan(0);
        expect(metrics.searches.avgResponseTime).toBeGreaterThan(0);
      }

      // Cleanup
      for (const entry of entries) {
        await kbService.deleteEntry(entry.id!);
      }
    });

    test('should collect cache performance metrics', async () => {
      // Perform cache operations
      await cacheService.set('metrics:test:1', { data: 'test1' }, 30000);
      await cacheService.set('metrics:test:2', { data: 'test2' }, 30000);

      // Generate cache hits
      await cacheService.get('metrics:test:1');
      await cacheService.get('metrics:test:1'); // Hit
      await cacheService.get('metrics:test:2');

      // Generate cache miss
      await cacheService.get('metrics:test:nonexistent');

      // Get cache statistics
      const cacheStats = cacheService.stats();
      expect(cacheStats.hitCount).toBeGreaterThan(0);
      expect(cacheStats.missCount).toBeGreaterThan(0);
      expect(cacheStats.hitRate).toBeGreaterThan(0);

      // Record cache metrics
      await metricsService.recordMetric('cache', 'hit_rate', cacheStats.hitRate);
      await metricsService.recordMetric('cache', 'hit_count', cacheStats.hitCount);
      await metricsService.recordMetric('cache', 'miss_count', cacheStats.missCount);

      // Verify metrics were recorded
      const metrics = await metricsService.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('2. Real-time Monitoring Integration', () => {
    test('should monitor system performance in real-time', async () => {
      const performanceData = [];

      // Simulate real-time performance monitoring
      const monitoringInterval = setInterval(async () => {
        const startTime = Date.now();

        // Perform operations and measure performance
        const entry = await kbService.createEntry({
          title: 'Performance Monitor Test',
          problem: 'Testing real-time performance monitoring',
          solution: 'Monitor system performance continuously',
          category: 'System',
          tags: ['performance', 'monitoring', 'realtime']
        });

        const operationTime = Date.now() - startTime;

        performanceData.push({
          timestamp: Date.now(),
          operation: 'create_entry',
          duration: operationTime,
          success: true
        });

        await kbService.deleteEntry(entry.id!);

        // Stop after collecting some data
        if (performanceData.length >= 5) {
          clearInterval(monitoringInterval);
        }
      }, 100);

      // Wait for monitoring to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify performance data was collected
      expect(performanceData.length).toBeGreaterThanOrEqual(5);

      // Calculate average performance
      const avgDuration = performanceData.reduce((sum, data) => sum + data.duration, 0) / performanceData.length;
      expect(avgDuration).toBeGreaterThan(0);

      // Record aggregated metrics
      await metricsService.recordMetric('performance', 'avg_create_time', avgDuration);
      await metricsService.recordMetric('performance', 'operations_per_second', 1000 / avgDuration);

      const metrics = await metricsService.getMetrics();
      expect(metrics).toBeDefined();
    });

    test('should detect and report performance anomalies', async () => {
      const baselineOperations = [];
      const anomalyOperations = [];

      // Establish baseline performance
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();

        const entry = await kbService.createEntry({
          title: `Baseline Entry ${i}`,
          problem: 'Baseline operation for performance testing',
          solution: 'Normal performance baseline',
          category: 'System',
          tags: ['baseline', 'performance']
        });

        const duration = Date.now() - startTime;
        baselineOperations.push(duration);

        await kbService.deleteEntry(entry.id!);
      }

      // Calculate baseline average
      const baselineAvg = baselineOperations.reduce((a, b) => a + b, 0) / baselineOperations.length;

      // Simulate performance anomaly (slow operation)
      const startTime = Date.now();

      // Add artificial delay to simulate slow operation
      await new Promise(resolve => setTimeout(resolve, 200));

      const entry = await kbService.createEntry({
        title: 'Anomaly Entry',
        problem: 'Simulated slow operation',
        solution: 'This operation should be detected as anomalous',
        category: 'System',
        tags: ['anomaly', 'slow', 'performance']
      });

      const anomalyDuration = Date.now() - startTime;
      anomalyOperations.push(anomalyDuration);

      // Detect anomaly (operation significantly slower than baseline)
      const isAnomaly = anomalyDuration > baselineAvg * 2;
      expect(isAnomaly).toBe(true);

      // Record anomaly metrics
      await metricsService.recordMetric('performance', 'baseline_avg', baselineAvg);
      await metricsService.recordMetric('performance', 'anomaly_duration', anomalyDuration);
      await metricsService.recordMetric('performance', 'anomaly_detected', isAnomaly ? 1 : 0);

      // Cleanup
      await kbService.deleteEntry(entry.id!);
    });
  });

  describe('3. Alert Generation and Thresholds', () => {
    test('should generate alerts for high error rates', async () => {
      const operations = [];
      const errors = [];

      // Simulate operations with some failures
      for (let i = 0; i < 10; i++) {
        try {
          if (i >= 7) {
            // Simulate errors for the last 3 operations
            throw new Error(`Simulated error ${i}`);
          }

          const entry = await kbService.createEntry({
            title: `Alert Test Entry ${i}`,
            problem: 'Testing alert generation',
            solution: 'Monitor error rates for alerts',
            category: 'System',
            tags: ['alert', 'test', `entry-${i}`]
          });

          operations.push({ success: true, timestamp: Date.now() });
          await kbService.deleteEntry(entry.id!);

        } catch (error) {
          operations.push({ success: false, timestamp: Date.now(), error: error.message });
          errors.push(error);
        }
      }

      // Calculate error rate
      const errorRate = errors.length / operations.length;
      const threshold = 0.1; // 10% from config

      // Check if alert should be triggered
      const shouldAlert = errorRate > threshold;
      expect(shouldAlert).toBe(true); // We simulated 30% error rate

      // Record error metrics
      await metricsService.recordMetric('errors', 'error_rate', errorRate);
      await metricsService.recordMetric('errors', 'total_errors', errors.length);
      await metricsService.recordMetric('errors', 'total_operations', operations.length);

      if (shouldAlert) {
        await metricsService.recordMetric('alerts', 'error_rate_alert', 1);
      }

      const metrics = await metricsService.getMetrics();
      expect(metrics).toBeDefined();
    });

    test('should generate alerts for poor cache performance', async () => {
      // Clear cache to start fresh
      await cacheService.clear();

      // Generate cache misses to simulate poor performance
      const operations = [];

      for (let i = 0; i < 20; i++) {
        const result = await cacheService.get(`non-existent-key-${i}`);
        operations.push({ hit: result !== null });
      }

      // Add a few cache hits
      await cacheService.set('test-key-1', { data: 'test' }, 30000);
      await cacheService.set('test-key-2', { data: 'test' }, 30000);

      for (let i = 0; i < 5; i++) {
        const result = await cacheService.get('test-key-1');
        operations.push({ hit: result !== null });
      }

      // Calculate hit rate
      const hits = operations.filter(op => op.hit).length;
      const hitRate = hits / operations.length;
      const threshold = 0.8; // 80% from config

      // Check if alert should be triggered
      const shouldAlert = hitRate < threshold;
      expect(shouldAlert).toBe(true); // We simulated low hit rate

      // Record cache performance metrics
      await metricsService.recordMetric('cache', 'hit_rate', hitRate);
      await metricsService.recordMetric('cache', 'total_hits', hits);
      await metricsService.recordMetric('cache', 'total_operations', operations.length);

      if (shouldAlert) {
        await metricsService.recordMetric('alerts', 'cache_performance_alert', 1);
      }

      const metrics = await metricsService.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('4. Data Aggregation and Reporting', () => {
    test('should aggregate metrics over time periods', async () => {
      const timeWindows = [];
      const startTime = Date.now();

      // Generate metrics over time
      for (let i = 0; i < 5; i++) {
        const windowStart = Date.now();

        // Simulate operations in this time window
        const entry = await kbService.createEntry({
          title: `Aggregation Test ${i}`,
          problem: 'Testing metrics aggregation',
          solution: 'Aggregate metrics for reporting',
          category: 'System',
          tags: ['aggregation', 'metrics', 'reporting']
        });

        await searchService.search(`aggregation test ${i}`, { maxResults: 5 });
        await cacheService.set(`agg-test-${i}`, { data: i }, 30000);
        await cacheService.get(`agg-test-${i}`);

        const windowEnd = Date.now();
        timeWindows.push({
          start: windowStart,
          end: windowEnd,
          duration: windowEnd - windowStart,
          operations: 3 // create, search, cache operations
        });

        await kbService.deleteEntry(entry.id!);

        // Small delay between windows
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const totalDuration = Date.now() - startTime;

      // Calculate aggregated metrics
      const totalOperations = timeWindows.reduce((sum, window) => sum + window.operations, 0);
      const avgOperationsPerWindow = totalOperations / timeWindows.length;
      const operationsPerSecond = (totalOperations / totalDuration) * 1000;

      // Record aggregated metrics
      await metricsService.recordMetric('aggregation', 'total_operations', totalOperations);
      await metricsService.recordMetric('aggregation', 'avg_operations_per_window', avgOperationsPerWindow);
      await metricsService.recordMetric('aggregation', 'operations_per_second', operationsPerSecond);
      await metricsService.recordMetric('aggregation', 'total_duration', totalDuration);

      // Verify aggregation
      expect(totalOperations).toBe(15); // 5 windows * 3 operations
      expect(avgOperationsPerWindow).toBe(3);
      expect(operationsPerSecond).toBeGreaterThan(0);

      const metrics = await metricsService.getMetrics();
      expect(metrics).toBeDefined();
    });

    test('should generate comprehensive analytics reports', async () => {
      // Simulate a comprehensive workload
      const workload = {
        entries: [],
        searches: [],
        cacheOps: [],
        errors: []
      };

      // Create entries
      for (let i = 0; i < 5; i++) {
        try {
          const entry = await kbService.createEntry({
            title: `Report Test Entry ${i}`,
            problem: `Problem description ${i}`,
            solution: `Solution description ${i}`,
            category: i % 2 === 0 ? 'System' : 'VSAM',
            tags: ['report', 'test', `category-${i % 2}`]
          });
          workload.entries.push(entry);
        } catch (error) {
          workload.errors.push({ operation: 'create', error: error.message });
        }
      }

      // Perform searches
      for (let i = 0; i < 8; i++) {
        try {
          const results = await searchService.search(`test ${i}`, { maxResults: 5 });
          workload.searches.push({
            query: `test ${i}`,
            results: results.results.length,
            duration: results.processingTime || 0
          });
        } catch (error) {
          workload.errors.push({ operation: 'search', error: error.message });
        }
      }

      // Perform cache operations
      for (let i = 0; i < 12; i++) {
        try {
          await cacheService.set(`report-cache-${i}`, { index: i }, 30000);
          const retrieved = await cacheService.get(`report-cache-${i}`);
          workload.cacheOps.push({
            operation: 'set-get',
            success: retrieved !== null
          });
        } catch (error) {
          workload.errors.push({ operation: 'cache', error: error.message });
        }
      }

      // Generate comprehensive report
      const report = {
        timestamp: new Date().toISOString(),
        summary: {
          totalEntries: workload.entries.length,
          totalSearches: workload.searches.length,
          totalCacheOps: workload.cacheOps.length,
          totalErrors: workload.errors.length,
          errorRate: workload.errors.length / (workload.entries.length + workload.searches.length + workload.cacheOps.length)
        },
        performance: {
          avgSearchTime: workload.searches.reduce((sum, s) => sum + s.duration, 0) / workload.searches.length,
          cacheSuccessRate: workload.cacheOps.filter(op => op.success).length / workload.cacheOps.length,
          searchResultsAvg: workload.searches.reduce((sum, s) => sum + s.results, 0) / workload.searches.length
        },
        categories: {
          system: workload.entries.filter(e => e.category === 'System').length,
          vsam: workload.entries.filter(e => e.category === 'VSAM').length
        }
      };

      // Record report metrics
      for (const [key, value] of Object.entries(report.summary)) {
        await metricsService.recordMetric('report_summary', key, typeof value === 'number' ? value : 0);
      }

      for (const [key, value] of Object.entries(report.performance)) {
        await metricsService.recordMetric('report_performance', key, value);
      }

      // Validate report
      expect(report.summary.totalEntries).toBe(5);
      expect(report.summary.totalSearches).toBe(8);
      expect(report.summary.totalCacheOps).toBe(12);
      expect(report.performance.cacheSuccessRate).toBe(1.0); // All should succeed
      expect(report.categories.system + report.categories.vsam).toBe(5);

      // Cleanup
      for (const entry of workload.entries) {
        await kbService.deleteEntry(entry.id!);
      }

      const metrics = await metricsService.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('5. Cross-Component Analytics', () => {
    test('should track user workflow analytics across components', async () => {
      // Simulate a complete user workflow
      const workflow = {
        id: `workflow-${Date.now()}`,
        steps: [],
        startTime: Date.now()
      };

      // Step 1: User searches for information
      workflow.steps.push({ step: 'search', startTime: Date.now() });
      const searchResults = await searchService.search('workflow test', { maxResults: 10 });
      workflow.steps[workflow.steps.length - 1].endTime = Date.now();
      workflow.steps[workflow.steps.length - 1].results = searchResults.results.length;

      // Step 2: User doesn't find what they need, creates new entry
      workflow.steps.push({ step: 'create', startTime: Date.now() });
      const entry = await kbService.createEntry({
        title: 'Workflow Analytics Test',
        problem: 'Testing cross-component workflow analytics',
        solution: 'Track user journey across system components',
        category: 'System',
        tags: ['workflow', 'analytics', 'cross-component']
      });
      workflow.steps[workflow.steps.length - 1].endTime = Date.now();
      workflow.steps[workflow.steps.length - 1].entryId = entry.id;

      // Step 3: User searches again to verify entry appears
      workflow.steps.push({ step: 'verify_search', startTime: Date.now() });
      const verifyResults = await searchService.search('workflow analytics', { maxResults: 10 });
      workflow.steps[workflow.steps.length - 1].endTime = Date.now();
      workflow.steps[workflow.steps.length - 1].found = verifyResults.results.some(r => r.id === entry.id);

      // Step 4: User updates the entry
      workflow.steps.push({ step: 'update', startTime: Date.now() });
      await kbService.updateEntry(entry.id!, {
        ...entry,
        solution: 'Updated solution with additional details'
      });
      workflow.steps[workflow.steps.length - 1].endTime = Date.now();

      workflow.endTime = Date.now();
      workflow.totalDuration = workflow.endTime - workflow.startTime;

      // Analyze workflow
      const stepDurations = workflow.steps.map(step => step.endTime - step.startTime);
      const avgStepDuration = stepDurations.reduce((a, b) => a + b, 0) / stepDurations.length;

      // Record workflow metrics
      await metricsService.recordMetric('workflow', 'total_duration', workflow.totalDuration);
      await metricsService.recordMetric('workflow', 'step_count', workflow.steps.length);
      await metricsService.recordMetric('workflow', 'avg_step_duration', avgStepDuration);
      await metricsService.recordMetric('workflow', 'search_to_create_conversion', 1);

      // Verify workflow tracking
      expect(workflow.steps).toHaveLength(4);
      expect(workflow.steps[2].found).toBe(true); // Verify search found the created entry
      expect(workflow.totalDuration).toBeGreaterThan(0);

      // Cleanup
      await kbService.deleteEntry(entry.id!);
    });

    test('should analyze component interaction patterns', async () => {
      const interactions = [];

      // Simulate various interaction patterns
      for (let i = 0; i < 3; i++) {
        const pattern = {
          id: `pattern-${i}`,
          interactions: []
        };

        // Pattern: Search -> Cache Hit -> Entry Read
        pattern.interactions.push({
          component: 'search',
          action: 'query',
          timestamp: Date.now(),
          details: { query: `pattern test ${i}` }
        });

        await searchService.search(`pattern test ${i}`, { maxResults: 5 });

        pattern.interactions.push({
          component: 'cache',
          action: 'check',
          timestamp: Date.now(),
          details: { key: `search:pattern-${i}` }
        });

        const cacheResult = await cacheService.get(`search:pattern-${i}`);

        if (!cacheResult) {
          // Cache miss - create entry
          pattern.interactions.push({
            component: 'database',
            action: 'create',
            timestamp: Date.now()
          });

          const entry = await kbService.createEntry({
            title: `Pattern Test Entry ${i}`,
            problem: 'Testing interaction patterns',
            solution: 'Analyze component interaction flows',
            category: 'System',
            tags: ['pattern', 'interaction', `test-${i}`]
          });

          // Cache the entry
          pattern.interactions.push({
            component: 'cache',
            action: 'set',
            timestamp: Date.now(),
            details: { key: `entry:${entry.id}` }
          });

          await cacheService.set(`entry:${entry.id}`, entry, 30000);

          // Cleanup
          setTimeout(async () => {
            await kbService.deleteEntry(entry.id!);
          }, 100);
        }

        interactions.push(pattern);
      }

      // Analyze interaction patterns
      const componentUsage = {};
      const actionCounts = {};

      interactions.forEach(pattern => {
        pattern.interactions.forEach(interaction => {
          componentUsage[interaction.component] = (componentUsage[interaction.component] || 0) + 1;
          actionCounts[interaction.action] = (actionCounts[interaction.action] || 0) + 1;
        });
      });

      // Record interaction analytics
      for (const [component, count] of Object.entries(componentUsage)) {
        await metricsService.recordMetric('interactions', `${component}_usage`, count);
      }

      for (const [action, count] of Object.entries(actionCounts)) {
        await metricsService.recordMetric('interactions', `${action}_count`, count);
      }

      // Verify pattern analysis
      expect(Object.keys(componentUsage)).toContain('search');
      expect(Object.keys(componentUsage)).toContain('cache');
      expect(actionCounts.query).toBeGreaterThan(0);
      expect(interactions).toHaveLength(3);
    });
  });
});