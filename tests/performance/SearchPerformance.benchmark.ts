/**
 * Performance Benchmarking Suite for Enhanced Search Infrastructure
 * Validates <1s response time requirements and system performance under load
 */

import { SearchService } from '../../src/services/SearchService';
import SearchOptimizer from '../../src/services/SearchOptimizer';
import SearchMetrics from '../../src/services/SearchMetrics';
import { MultiLayerCacheManager } from '../../src/caching/MultiLayerCacheManager';
import { KBEntry, SearchOptions } from '../../src/types/services';

interface BenchmarkResult {
  operation: string;
  averageTime: number;
  p95Time: number;
  p99Time: number;
  throughput: number;
  memoryUsage: number;
  cacheHitRate?: number;
}

describe('Search Infrastructure Performance Benchmarks', () => {
  let searchService: SearchService;
  let searchOptimizer: SearchOptimizer;
  let searchMetrics: SearchMetrics;
  let cacheManager: MultiLayerCacheManager;
  let testDataset: KBEntry[];

  beforeAll(async () => {
    // Create comprehensive test dataset
    testDataset = generateTestDataset(10000);

    // Initialize services
    const mockDatabase = createMockDatabase();
    cacheManager = new MultiLayerCacheManager(mockDatabase, 1);
    searchService = new SearchService(
      { apiKey: 'test-key', model: 'gemini-pro' },
      mockDatabase,
      cacheManager
    );
    searchOptimizer = new SearchOptimizer();
    searchMetrics = new SearchMetrics(mockDatabase);

    console.log(`🚀 Performance benchmarks initialized with ${testDataset.length} entries`);
  });

  afterAll(() => {
    console.log('📊 Performance benchmarking completed');
  });

  describe('Core Performance Requirements', () => {
    test('should meet <1s response time for single searches', async () => {
      const queries = [
        'VSAM status 35 error',
        'JCL allocation failure',
        'S0C7 data exception COBOL',
        'DB2 SQLCODE -904 resource',
        'CICS ASRA program check'
      ];

      const results: number[] = [];

      for (const query of queries) {
        const startTime = performance.now();
        await searchService.search(query, testDataset, { limit: 50 });
        const duration = performance.now() - startTime;
        results.push(duration);
      }

      const averageTime = results.reduce((a, b) => a + b, 0) / results.length;
      const maxTime = Math.max(...results);

      console.log(`Average search time: ${averageTime.toFixed(2)}ms`);
      console.log(`Maximum search time: ${maxTime.toFixed(2)}ms`);

      // Validate requirements
      expect(averageTime).toBeLessThan(500); // <500ms average
      expect(maxTime).toBeLessThan(1000); // <1s maximum
    });

    test('should maintain performance under concurrent load', async () => {
      const concurrentQueries = 20;
      const queries = Array.from({ length: concurrentQueries }, (_, i) =>
        `performance test query ${i} with mainframe keywords`
      );

      const startTime = performance.now();
      const promises = queries.map(query =>
        searchService.search(query, testDataset.slice(0, 1000), { limit: 20 })
      );

      const results = await Promise.all(promises);
      const totalTime = performance.now() - startTime;
      const throughput = (concurrentQueries / totalTime) * 1000; // queries per second

      console.log(`Concurrent load: ${concurrentQueries} queries in ${totalTime.toFixed(2)}ms`);
      console.log(`Throughput: ${throughput.toFixed(2)} queries/second`);

      // Validate requirements
      expect(totalTime).toBeLessThan(5000); // All queries complete in <5s
      expect(results.every(r => Array.isArray(r))).toBe(true);
      expect(throughput).toBeGreaterThan(2); // At least 2 QPS under load
    });

    test('should demonstrate cache performance improvements', async () => {
      const query = 'cache performance test query';
      const options: SearchOptions = { limit: 30 };

      // Cold search (no cache)
      const coldStart = performance.now();
      await searchService.search(query, testDataset.slice(0, 2000), options);
      const coldTime = performance.now() - coldStart;

      // Warm search (L0 instant cache hit)
      const warmStart = performance.now();
      await searchService.search(query, testDataset.slice(0, 2000), options);
      const warmTime = performance.now() - warmStart;

      console.log(`Cold search time: ${coldTime.toFixed(2)}ms`);
      console.log(`Warm search time: ${warmTime.toFixed(2)}ms`);
      console.log(`Cache improvement: ${((coldTime - warmTime) / coldTime * 100).toFixed(1)}%`);

      // Validate cache performance
      expect(warmTime).toBeLessThan(50); // <50ms cache hit
      expect(warmTime).toBeLessThan(coldTime * 0.3); // At least 70% improvement
    });
  });

  describe('Search Optimizer Benchmarks', () => {
    test('should optimize complex queries within performance bounds', async () => {
      const complexQueries = [
        'how to troubleshoot VSAM file access errors with status codes 35 and 37',
        'JCL dataset allocation problems causing IEF212I messages in batch jobs',
        'COBOL program S0C7 data exception debugging and resolution procedures'
      ];

      const mockSearchMethods = createMockSearchMethods();
      const results: number[] = [];

      for (const query of complexQueries) {
        const startTime = performance.now();
        await searchOptimizer.optimizeSearch(query, testDataset.slice(0, 500), {}, mockSearchMethods);
        const duration = performance.now() - startTime;
        results.push(duration);
      }

      const averageTime = results.reduce((a, b) => a + b, 0) / results.length;
      const maxTime = Math.max(...results);

      console.log(`Query optimization average: ${averageTime.toFixed(2)}ms`);
      console.log(`Query optimization maximum: ${maxTime.toFixed(2)}ms`);

      // Validate optimizer performance
      expect(averageTime).toBeLessThan(800); // <800ms average optimization
      expect(maxTime).toBeLessThan(1500); // <1.5s maximum optimization
    });

    test('should handle parallel strategy execution efficiently', async () => {
      const query = 'parallel strategy benchmark';
      const mockSearchMethods = createMockSearchMethods();

      const startTime = performance.now();

      // Execute 10 optimization requests in parallel
      const promises = Array.from({ length: 10 }, () =>
        searchOptimizer.optimizeSearch(query, testDataset.slice(0, 200), {}, mockSearchMethods)
      );

      const results = await Promise.all(promises);
      const totalTime = performance.now() - startTime;

      console.log(`Parallel optimization: 10 requests in ${totalTime.toFixed(2)}ms`);

      // Should complete all optimizations efficiently
      expect(totalTime).toBeLessThan(3000); // <3s for 10 parallel optimizations
      expect(results.every(r => Array.isArray(r))).toBe(true);
    });
  });

  describe('Multi-Layer Cache Performance', () => {
    test('should meet L0 instant cache access time requirements', async () => {
      const testKey = 'instant-cache-test';
      const testValue = { data: 'test cache value', size: 100 };

      // Measure cache set performance
      const setStart = performance.now();
      await cacheManager.set(testKey, testValue, { priority: 'critical' });
      const setTime = performance.now() - setStart;

      // Measure cache get performance (should hit L0)
      const getStart = performance.now();
      const retrieved = await cacheManager.get(testKey, () => testValue);
      const getTime = performance.now() - getStart;

      console.log(`L0 cache set time: ${setTime.toFixed(2)}ms`);
      console.log(`L0 cache get time: ${getTime.toFixed(2)}ms`);

      // Validate L0 instant cache performance
      expect(getTime).toBeLessThan(10); // <10ms access requirement
      expect(retrieved).toEqual(testValue);
    });

    test('should maintain cache hit rates under load', async () => {
      const queries = Array.from({ length: 100 }, (_, i) => `cache load test ${i}`);
      let cacheHits = 0;
      let totalRequests = 0;

      // First pass - populate cache
      for (const query of queries) {
        await cacheManager.get(query, () => ({ query, result: 'cached' }));
        totalRequests++;
      }

      // Second pass - should hit cache
      for (const query of queries) {
        const startTime = performance.now();
        await cacheManager.get(query, () => ({ query, result: 'computed' }));
        const accessTime = performance.now() - startTime;

        totalRequests++;
        if (accessTime < 20) { // Assume cache hit if < 20ms
          cacheHits++;
        }
      }

      const hitRate = cacheHits / totalRequests;
      console.log(`Cache hit rate under load: ${(hitRate * 100).toFixed(1)}%`);

      // Validate cache performance under load
      expect(hitRate).toBeGreaterThan(0.8); // >80% hit rate
    });
  });

  describe('Memory and Resource Efficiency', () => {
    test('should maintain memory efficiency during extended operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform extensive search operations
      for (let i = 0; i < 200; i++) {
        const query = `memory efficiency test ${i} ${Date.now()}`;
        await searchService.search(query, testDataset.slice(0, 500), { limit: 20 });

        // Periodic garbage collection hint
        if (i % 50 === 0) {
          global.gc?.();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      console.log(`Memory increase after 200 searches: ${memoryIncreaseMB.toFixed(2)}MB`);

      // Validate memory efficiency
      expect(memoryIncreaseMB).toBeLessThan(100); // <100MB increase
    });

    test('should handle large datasets efficiently', async () => {
      const largeDataset = generateTestDataset(50000); // 50k entries
      const queries = [
        'large dataset performance test',
        'mainframe error resolution',
        'system administration guide'
      ];

      const results: BenchmarkResult[] = [];

      for (const query of queries) {
        const startTime = performance.now();
        const searchResults = await searchService.search(query, largeDataset, { limit: 100 });
        const duration = performance.now() - startTime;

        results.push({
          operation: query,
          averageTime: duration,
          p95Time: duration,
          p99Time: duration,
          throughput: 1000 / duration,
          memoryUsage: process.memoryUsage().heapUsed
        });
      }

      console.log('Large dataset performance:');
      results.forEach(result => {
        console.log(`  ${result.operation}: ${result.averageTime.toFixed(2)}ms`);
      });

      // Validate large dataset performance
      const averageTime = results.reduce((sum, r) => sum + r.averageTime, 0) / results.length;
      expect(averageTime).toBeLessThan(2000); // <2s for 50k entries
    });
  });

  describe('Search Metrics Performance', () => {
    test('should handle high-volume metric recording efficiently', async () => {
      const metricCount = 10000;
      const startTime = performance.now();

      // Record large number of metrics
      for (let i = 0; i < metricCount; i++) {
        searchMetrics.recordMetric(
          'performance_test',
          Math.random() * 1000,
          Math.random() > 0.1,
          { iteration: i }
        );
      }

      const recordingTime = performance.now() - startTime;
      const throughput = (metricCount / recordingTime) * 1000;

      console.log(`Metrics recording: ${metricCount} metrics in ${recordingTime.toFixed(2)}ms`);
      console.log(`Metrics throughput: ${throughput.toFixed(0)} metrics/second`);

      // Validate metrics performance
      expect(recordingTime).toBeLessThan(5000); // <5s for 10k metrics
      expect(throughput).toBeGreaterThan(1000); // >1000 metrics/second
    });

    test('should generate analytics reports efficiently', async () => {
      // Populate with sample metrics
      for (let i = 0; i < 1000; i++) {
        searchMetrics.recordMetric('search', 100 + Math.random() * 500, Math.random() > 0.05);
      }

      const startTime = performance.now();
      const analytics = await searchMetrics.getSearchAnalytics('24h');
      const analyticsTime = performance.now() - startTime;

      console.log(`Analytics generation time: ${analyticsTime.toFixed(2)}ms`);

      // Validate analytics performance
      expect(analyticsTime).toBeLessThan(100); // <100ms for analytics
      expect(analytics.totalSearches).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Performance Validation', () => {
    test('should meet all performance SLAs in integrated scenario', async () => {
      const scenario = {
        queries: [
          'integrated performance test VSAM error',
          'complete system benchmark JCL failure',
          'end to end validation COBOL abend'
        ],
        concurrent: 5,
        iterations: 10
      };

      const allTimes: number[] = [];
      const cachePerformance: number[] = [];

      // Execute integrated performance test
      for (let iteration = 0; iteration < scenario.iterations; iteration++) {
        const iterationStart = performance.now();

        const promises = Array.from({ length: scenario.concurrent }, (_, i) => {
          const query = `${scenario.queries[i % scenario.queries.length]} iteration ${iteration}`;
          return searchService.search(query, testDataset.slice(0, 1000), { limit: 25 });
        });

        await Promise.all(promises);
        const iterationTime = performance.now() - iterationStart;
        allTimes.push(iterationTime);

        // Measure cache performance
        const cacheStart = performance.now();
        await searchService.search(scenario.queries[0], testDataset.slice(0, 100), { limit: 10 });
        const cacheTime = performance.now() - cacheStart;
        cachePerformance.push(cacheTime);
      }

      // Calculate performance metrics
      const avgIterationTime = allTimes.reduce((a, b) => a + b, 0) / allTimes.length;
      const p95IterationTime = allTimes.sort((a, b) => a - b)[Math.floor(allTimes.length * 0.95)];
      const avgCacheTime = cachePerformance.reduce((a, b) => a + b, 0) / cachePerformance.length;

      console.log('📈 Integrated Performance Results:');
      console.log(`  Average iteration time: ${avgIterationTime.toFixed(2)}ms`);
      console.log(`  P95 iteration time: ${p95IterationTime.toFixed(2)}ms`);
      console.log(`  Average cache time: ${avgCacheTime.toFixed(2)}ms`);

      // Validate integrated performance SLAs
      expect(avgIterationTime).toBeLessThan(1000); // <1s average
      expect(p95IterationTime).toBeLessThan(2000); // <2s P95
      expect(avgCacheTime).toBeLessThan(50); // <50ms cache
    });
  });
});

// Helper functions for test setup

function generateTestDataset(size: number): KBEntry[] {
  const categories = ['VSAM', 'JCL', 'DB2', 'Batch', 'CICS', 'IMS', 'TSO', 'ISPF'];
  const errorCodes = ['S0C7', 'S0C4', 'S013', 'U0778', 'IEF212I', 'SQLCODE-904'];
  const systems = ['mainframe', 'cobol', 'jcl', 'vsam', 'db2', 'cics', 'ims'];

  return Array.from({ length: size }, (_, i) => {
    const category = categories[i % categories.length];
    const errorCode = errorCodes[i % errorCodes.length];
    const system = systems[i % systems.length];

    return {
      id: `perf_test_${i}`,
      title: `${category} ${errorCode} Error Resolution #${i}`,
      problem: `Performance test entry ${i} describing ${system} ${errorCode} error with detailed context and multiple keywords for comprehensive testing`,
      solution: `Detailed solution for ${system} ${errorCode} involving step-by-step instructions, troubleshooting guides, and preventive measures for entry ${i}`,
      category,
      tags: [system, errorCode.toLowerCase(), 'performance', 'test', `tag${i % 20}`],
      created_at: new Date(Date.now() - (i * 10000)), // Staggered creation times
      updated_at: new Date(Date.now() - (i * 5000)),
      usage_count: Math.floor(Math.random() * 100),
      success_count: Math.floor(Math.random() * 80),
      failure_count: Math.floor(Math.random() * 20)
    };
  });
}

function createMockDatabase() {
  const mockResults = [
    {
      id: 'mock1',
      title: 'Mock VSAM Error',
      problem: 'Mock problem description',
      solution: 'Mock solution steps',
      category: 'VSAM',
      tags: 'vsam,mock,test',
      created_at: '2024-01-01',
      usage_count: 5,
      success_count: 4,
      failure_count: 1,
      relevance_score: -1.5,
      title_highlight: 'Mock <mark>VSAM</mark> Error',
      snippet: 'Mock problem description...'
    }
  ];

  return {
    exec: jest.fn(),
    prepare: jest.fn(() => ({
      all: jest.fn(() => mockResults),
      run: jest.fn(),
      get: jest.fn(() => mockResults[0])
    })),
    pragma: jest.fn(),
    transaction: jest.fn(fn => fn),
    close: jest.fn()
  };
}

function createMockSearchMethods(): Map<string, Function> {
  const methods = new Map();

  methods.set('fts5', async (query: string, entries: KBEntry[]) => {
    await new Promise(resolve => setTimeout(resolve, 30));
    return entries.slice(0, 10).map(entry => ({
      entry,
      score: 85 + Math.random() * 10,
      matchType: 'exact' as const,
      metadata: { source: 'fts5', processingTime: 30 }
    }));
  });

  methods.set('ai', async (query: string, entries: KBEntry[]) => {
    await new Promise(resolve => setTimeout(resolve, 120));
    return entries.slice(0, 5).map(entry => ({
      entry,
      score: 90 + Math.random() * 8,
      matchType: 'ai' as const,
      metadata: { source: 'ai', processingTime: 120 }
    }));
  });

  methods.set('local', async (query: string, entries: KBEntry[]) => {
    await new Promise(resolve => setTimeout(resolve, 50));
    return entries.slice(0, 15).map(entry => ({
      entry,
      score: 70 + Math.random() * 20,
      matchType: 'fuzzy' as const,
      metadata: { source: 'local', processingTime: 50 }
    }));
  });

  return methods;
}