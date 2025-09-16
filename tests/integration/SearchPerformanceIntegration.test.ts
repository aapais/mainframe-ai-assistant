/**
 * Integration Tests for Complete Search Performance System
 *
 * Tests integration between SearchService, Performance Dashboard,
 * Pipeline Optimizer, and UI components
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'jest';
import { performance } from 'perf_hooks';
import { SearchService } from '../../src/services/SearchService';
import { SearchPerformanceDashboard } from '../../src/monitoring/SearchPerformanceDashboard';
import { SearchPipelineOptimizer } from '../../src/optimization/SearchPipelineOptimizer';

describe('Search Performance Integration Tests', () => {
  let searchService: SearchService;
  let dashboard: SearchPerformanceDashboard;
  let optimizer: SearchPipelineOptimizer;
  let testEntries: any[];

  beforeAll(async () => {
    // Initialize test components
    searchService = new SearchService({
      apiKey: 'test-key',
      model: 'gemini-pro',
      temperature: 0.3
    });

    dashboard = new SearchPerformanceDashboard(searchService);
    optimizer = new SearchPipelineOptimizer(dashboard, searchService, false);

    // Generate test data
    testEntries = generateTestEntries(500);
    await searchService.buildIndex(testEntries);

    dashboard.startMonitoring();
  });

  afterAll(async () => {
    dashboard.stopMonitoring();
  });

  beforeEach(() => {
    // Clear any previous state
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('Search Service Integration', () => {
    it('should record performance metrics during search operations', async () => {
      const query = 'test integration search';
      const startTime = performance.now();

      // Perform search
      const results = await searchService.search(query, testEntries, {
        limit: 20,
        includeHighlights: true
      });

      const responseTime = performance.now() - startTime;

      // Manually record metric (in real app this would be automatic)
      dashboard.recordSearchMetric(query, responseTime, results.length, false);

      // Verify results
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(responseTime).toBeLessThan(2000); // Should be fast for test data

      // Check that metrics were recorded
      const snapshot = dashboard.getCurrentSnapshot();
      expect(snapshot.components.search.avgResponseTime).toBeGreaterThan(0);
    });

    it('should handle cache performance correctly', async () => {
      const query = 'cache performance test';

      // First search - cache miss
      const firstStart = performance.now();
      const firstResults = await searchService.search(query, testEntries);
      const firstTime = performance.now() - firstStart;

      dashboard.recordSearchMetric(query, firstTime, firstResults.length, false);

      // Second search - should be cache hit
      const secondStart = performance.now();
      const secondResults = await searchService.search(query, testEntries);
      const secondTime = performance.now() - secondStart;

      // Cache hit should be significantly faster
      const isCacheHit = secondTime < firstTime * 0.8;
      dashboard.recordSearchMetric(query, secondTime, secondResults.length, isCacheHit);

      expect(secondResults).toEqual(firstResults);
      expect(secondTime).toBeLessThan(firstTime); // Cache should be faster
    });

    it('should track error rates properly', async () => {
      const errorQuery = null as any; // This should cause an error

      let errorCount = 0;
      const totalAttempts = 5;

      for (let i = 0; i < totalAttempts; i++) {
        try {
          await searchService.search(errorQuery, testEntries);
        } catch (error) {
          errorCount++;
          dashboard.recordSearchMetric('error-test', 0, 0, false, error.message);
        }
      }

      const snapshot = dashboard.getCurrentSnapshot();
      expect(snapshot.components.search.errorRate).toBeGreaterThan(0);
      expect(errorCount).toBe(totalAttempts);
    });
  });

  describe('Performance Dashboard Integration', () => {
    it('should provide real-time performance snapshots', async () => {
      // Perform several searches to generate metrics
      const queries = ['test1', 'test2', 'test3', 'test4', 'test5'];

      for (const query of queries) {
        const startTime = performance.now();
        const results = await searchService.search(query, testEntries);
        const responseTime = performance.now() - startTime;

        dashboard.recordSearchMetric(query, responseTime, results.length, false);
      }

      const snapshot = dashboard.getCurrentSnapshot();

      // Verify snapshot structure
      expect(snapshot.timestamp).toBeInstanceOf(Date);
      expect(snapshot.overall).toBeDefined();
      expect(snapshot.components).toBeDefined();
      expect(snapshot.trends).toBeDefined();

      // Verify components have data
      expect(snapshot.components.search.avgResponseTime).toBeGreaterThan(0);
      expect(snapshot.components.search.throughput).toBeGreaterThanOrEqual(0);
    });

    it('should identify bottlenecks correctly', async () => {
      // Simulate slow search
      dashboard.recordSearchMetric('slow-query', 1500, 10, false); // 1.5s response time
      dashboard.recordSearchMetric('slow-query-2', 2000, 5, false); // 2s response time

      const bottlenecks = dashboard.identifyBottlenecks();

      expect(Array.isArray(bottlenecks)).toBe(true);

      // Should detect high response time bottleneck
      const responseTimeBottleneck = bottlenecks.find(b =>
        b.component === 'search' && b.issue.includes('response time')
      );

      expect(responseTimeBottleneck).toBeDefined();
      if (responseTimeBottleneck) {
        expect(responseTimeBottleneck.severity).toBe('high');
      }
    });

    it('should generate optimization recommendations', async () => {
      // Simulate poor cache performance
      for (let i = 0; i < 10; i++) {
        dashboard.recordSearchMetric(`cache-test-${i}`, 800, 10, false); // All cache misses
      }

      const recommendations = dashboard.getOptimizationRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);

      // Should recommend cache optimization
      const cacheRecommendation = recommendations.find(r =>
        r.title.toLowerCase().includes('cache')
      );

      expect(cacheRecommendation).toBeDefined();
    });

    it('should export performance reports', async () => {
      // Generate some activity
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        await searchService.search(`report-test-${i}`, testEntries);
        const responseTime = performance.now() - startTime;
        dashboard.recordSearchMetric(`report-test-${i}`, responseTime, 10, i % 2 === 0);
      }

      const report = dashboard.exportReport();

      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.summary).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.bottlenecks).toBeDefined();
      expect(report.recommendations).toBeDefined();

      // Verify report structure
      expect(typeof report.summary.overallHealth).toBe('string');
      expect(typeof report.metrics.search.avgResponseTime).toBe('number');
      expect(Array.isArray(report.bottlenecks)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('Pipeline Optimizer Integration', () => {
    it('should generate applicable optimization recommendations', async () => {
      // Simulate performance issues to trigger recommendations
      dashboard.recordSearchMetric('slow-search-1', 1200, 5, false);
      dashboard.recordSearchMetric('slow-search-2', 1100, 3, false);
      dashboard.recordSearchMetric('slow-search-3', 1300, 8, false);

      const recommendations = optimizer.getOptimizationRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);

      // Should have applicable recommendations for slow performance
      const applicableRecommendations = recommendations.filter(r => r.applicable);
      expect(applicableRecommendations.length).toBeGreaterThan(0);

      // Verify recommendation structure
      applicableRecommendations.forEach(rec => {
        expect(rec.rule).toBeDefined();
        expect(rec.rule.name).toBeDefined();
        expect(rec.rule.description).toBeDefined();
        expect(rec.applicable).toBe(true);
        expect(rec.estimatedImprovement).toBeDefined();
      });
    });

    it('should track optimization status correctly', async () => {
      const status = optimizer.getOptimizationStatus();

      expect(status.isOptimizing).toBe(false); // Should not be optimizing initially
      expect(Array.isArray(status.appliedOptimizations)).toBe(true);
      expect(typeof status.totalOptimizations).toBe('number');
      expect(typeof status.successRate).toBe('number');

      expect(status.successRate).toBeGreaterThanOrEqual(0);
      expect(status.successRate).toBeLessThanOrEqual(1);
    });

    it('should handle manual optimization triggers', async () => {
      // Create conditions that trigger optimization
      dashboard.recordSearchMetric('optimization-trigger', 1500, 2, false);

      const results = await optimizer.optimizePipeline();

      expect(Array.isArray(results)).toBe(true);

      // Verify result structure if any optimizations were applied
      results.forEach(result => {
        expect(result.ruleId).toBeDefined();
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.improvement).toBe('number');
        expect(result.timestamp).toBeInstanceOf(Date);

        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });
    });
  });

  describe('End-to-End Performance Flow', () => {
    it('should handle complete performance monitoring and optimization cycle', async () => {
      console.log('🧪 Testing complete performance monitoring cycle...');

      // Phase 1: Generate baseline performance data
      const baselineQueries = ['baseline-1', 'baseline-2', 'baseline-3'];

      for (const query of baselineQueries) {
        const startTime = performance.now();
        const results = await searchService.search(query, testEntries);
        const responseTime = performance.now() - startTime;

        dashboard.recordSearchMetric(query, responseTime, results.length, false);
      }

      // Phase 2: Simulate performance degradation
      for (let i = 0; i < 5; i++) {
        dashboard.recordSearchMetric(`degraded-${i}`, 1200 + Math.random() * 500, 5, false);
      }

      // Phase 3: Check that dashboard detects issues
      const snapshot = dashboard.getCurrentSnapshot();
      expect(snapshot.components.search.p95ResponseTime).toBeGreaterThan(1000);

      // Phase 4: Get optimization recommendations
      const recommendations = optimizer.getOptimizationRecommendations();
      expect(recommendations.some(r => r.applicable)).toBe(true);

      // Phase 5: Apply optimizations
      const optimizationResults = await optimizer.optimizePipeline();
      expect(Array.isArray(optimizationResults)).toBe(true);

      // Phase 6: Verify optimization status
      const status = optimizer.getOptimizationStatus();
      expect(status.totalOptimizations).toBeGreaterThanOrEqual(optimizationResults.length);

      console.log('✅ Complete performance cycle test passed');
    });

    it('should maintain performance targets under load', async () => {
      console.log('🧪 Testing performance under simulated load...');

      const concurrentSearches = 10;
      const searchesPerBatch = 5;
      const batches = 3;

      for (let batch = 0; batch < batches; batch++) {
        console.log(`  Running batch ${batch + 1}/${batches}...`);

        const promises = [];

        for (let i = 0; i < concurrentSearches; i++) {
          const promise = (async () => {
            const batchResults = [];

            for (let j = 0; j < searchesPerBatch; j++) {
              const query = `load-test-b${batch}-i${i}-j${j}`;
              const startTime = performance.now();

              try {
                const results = await searchService.search(query, testEntries, { limit: 20 });
                const responseTime = performance.now() - startTime;

                batchResults.push({
                  query,
                  responseTime,
                  resultCount: results.length,
                  success: true
                });

                dashboard.recordSearchMetric(query, responseTime, results.length, false);
              } catch (error) {
                batchResults.push({
                  query,
                  responseTime: 0,
                  resultCount: 0,
                  success: false,
                  error: error.message
                });

                dashboard.recordSearchMetric(query, 0, 0, false, error.message);
              }
            }

            return batchResults;
          })();

          promises.push(promise);
        }

        const batchResults = await Promise.all(promises);
        const allResults = batchResults.flat();

        // Verify performance under load
        const successfulResults = allResults.filter(r => r.success);
        const avgResponseTime = successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / successfulResults.length;
        const successRate = successfulResults.length / allResults.length;

        expect(successRate).toBeGreaterThan(0.9); // 90% success rate minimum
        expect(avgResponseTime).toBeLessThan(3000); // 3s max under load

        console.log(`  Batch ${batch + 1}: ${(successRate * 100).toFixed(1)}% success, ${avgResponseTime.toFixed(2)}ms avg`);

        // Brief pause between batches
        if (batch < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log('✅ Load test completed successfully');
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions', async () => {
      // Establish baseline
      for (let i = 0; i < 10; i++) {
        dashboard.recordSearchMetric(`baseline-${i}`, 300 + Math.random() * 100, 10, false);
      }

      let snapshot = dashboard.getCurrentSnapshot();
      const baselineResponseTime = snapshot.components.search.avgResponseTime;

      // Introduce regression
      for (let i = 0; i < 5; i++) {
        dashboard.recordSearchMetric(`regression-${i}`, 1500 + Math.random() * 200, 8, false);
      }

      snapshot = dashboard.getCurrentSnapshot();
      const regressionResponseTime = snapshot.components.search.avgResponseTime;

      // Should detect significant increase
      expect(regressionResponseTime).toBeGreaterThan(baselineResponseTime * 1.5);

      const bottlenecks = dashboard.identifyBottlenecks();
      expect(bottlenecks.some(b => b.severity === 'high' || b.severity === 'medium')).toBe(true);
    });
  });
});

// Helper functions

function generateTestEntries(count: number): any[] {
  const categories = ['VSAM', 'JCL', 'DB2', 'Batch', 'Functional'];
  const terms = ['error', 'status', 'abend', 'failure', 'timeout', 'connection', 'dataset', 'program'];

  return Array.from({ length: count }, (_, index) => ({
    id: `test-entry-${index}`,
    title: `Test Entry ${index}: ${terms[index % terms.length]} in ${categories[index % categories.length]}`,
    problem: `This is a test problem description for entry ${index} related to ${terms[index % terms.length]}.`,
    solution: `Solution for test problem ${index}. This provides steps to resolve the issue.`,
    category: categories[index % categories.length],
    tags: [terms[index % terms.length], categories[index % categories.length].toLowerCase()],
    created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    updated_at: new Date(),
    usage_count: Math.floor(Math.random() * 50),
    success_count: Math.floor(Math.random() * 30),
    failure_count: Math.floor(Math.random() * 5)
  }));
}