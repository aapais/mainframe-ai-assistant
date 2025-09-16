/**
 * IPC Performance Benchmark Tests
 * 
 * Comprehensive performance testing for IPC operations including
 * throughput, latency, memory usage, and scalability testing.
 */

import { IPCMainProcess } from '../../src/main/ipc/IPCMainProcess';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { MultiLayerCacheManager } from '../../src/caching/MultiLayerCacheManager';

import {
  validSearchRequest,
  validCreateRequest,
  validMetricsRequest,
  performanceTestData
} from '../fixtures/ipc-test-data';

import {
  PerformanceTracker,
  LoadTestRunner,
  LoadTestResults,
  delay,
  createTestCleanup,
  expectWithinTime
} from '../helpers/ipc-test-utils';

import {
  IPCChannel,
  BaseIPCRequest,
  BaseIPCResponse
} from '../../src/types/ipc';

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  search: {
    fast: 50,      // < 50ms for cached/simple searches
    normal: 200,   // < 200ms for complex searches
    slow: 1000     // < 1s for AI-enhanced searches
  },
  create: {
    fast: 100,     // < 100ms for simple entries
    normal: 300,   // < 300ms for complex entries
    slow: 1000     // < 1s for entries with AI processing
  },
  batch: {
    throughput: 100, // > 100 operations per second
    latency: 500     // < 500ms average latency
  },
  memory: {
    maxIncrease: 50 * 1024 * 1024, // < 50MB memory increase during tests
    leakThreshold: 10 * 1024 * 1024  // < 10MB potential memory leaks
  }
};

describe('IPC Performance Benchmarks', () => {
  let ipcMainProcess: IPCMainProcess;
  let performanceTracker: PerformanceTracker;
  let loadTestRunner: LoadTestRunner;
  let cleanup = createTestCleanup();
  let initialMemoryUsage: NodeJS.MemoryUsage;

  beforeAll(async () => {
    // Capture initial memory state
    initialMemoryUsage = process.memoryUsage();
    
    // Initialize IPC with optimized settings for performance testing
    ipcMainProcess = new IPCMainProcess({
      databasePath: ':memory:',
      enablePerformanceMonitoring: true,
      enableSecurityValidation: true, // Keep security enabled for realistic testing
      enableRequestLogging: false, // Disable logging to avoid I/O overhead
      maxConcurrentRequests: 200,
      requestTimeoutMs: 10000
    });

    await ipcMainProcess.initialize();
    
    cleanup.add(async () => {
      await ipcMainProcess.shutdown();
    });

    performanceTracker = new PerformanceTracker();
    loadTestRunner = new LoadTestRunner();
  });

  afterAll(async () => {
    await cleanup.cleanup();
    
    // Memory leak detection
    global.gc && global.gc(); // Force garbage collection if available
    const finalMemoryUsage = process.memoryUsage();
    const memoryIncrease = finalMemoryUsage.heapUsed - initialMemoryUsage.heapUsed;
    
    console.log('Memory Usage Analysis:', {
      initial: Math.round(initialMemoryUsage.heapUsed / 1024 / 1024),
      final: Math.round(finalMemoryUsage.heapUsed / 1024 / 1024),
      increase: Math.round(memoryIncrease / 1024 / 1024),
      threshold: Math.round(PERFORMANCE_THRESHOLDS.memory.leakThreshold / 1024 / 1024)
    });
    
    expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.memory.leakThreshold);
  });

  beforeEach(() => {
    performanceTracker.reset();
    loadTestRunner.reset();
  });

  describe('Single Operation Performance', () => {
    it('should handle simple search operations efficiently', async () => {
      const operationId = performanceTracker.start('simple-search');
      
      const response = await ipcMainProcess.handleRequest(performanceTestData.lightweightRequest);
      
      const duration = performanceTracker.end(operationId);
      
      expect(response.success).toBe(true);
      expectWithinTime(duration, PERFORMANCE_THRESHOLDS.search.fast, 'Simple search');
      expect(response.executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.search.fast);
    });

    it('should handle complex search operations within limits', async () => {
      const operationId = performanceTracker.start('complex-search');
      
      const response = await ipcMainProcess.handleRequest(performanceTestData.heavyRequest);
      
      const duration = performanceTracker.end(operationId);
      
      expect(response.success).toBe(true);
      expectWithinTime(duration, PERFORMANCE_THRESHOLDS.search.slow, 'Complex search');
    });

    it('should create entries efficiently', async () => {
      const operationId = performanceTracker.start('create-entry');
      
      const response = await ipcMainProcess.handleRequest(validCreateRequest);
      
      const duration = performanceTracker.end(operationId);
      
      expect(response.success).toBe(true);
      expectWithinTime(duration, PERFORMANCE_THRESHOLDS.create.normal, 'Create entry');
    });

    it('should handle large entries within performance bounds', async () => {
      const operationId = performanceTracker.start('large-entry');
      
      const response = await ipcMainProcess.handleRequest(performanceTestData.largeEntry);
      
      const duration = performanceTracker.end(operationId);
      
      expect(response.success).toBe(true);
      expectWithinTime(duration, PERFORMANCE_THRESHOLDS.create.slow, 'Large entry creation');
    });

    it('should retrieve metrics quickly', async () => {
      const operationId = performanceTracker.start('get-metrics');
      
      const response = await ipcMainProcess.handleRequest(validMetricsRequest);
      
      const duration = performanceTracker.end(operationId);
      
      expect(response.success).toBe(true);
      expectWithinTime(duration, PERFORMANCE_THRESHOLDS.search.normal, 'Get metrics');
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent searches efficiently', async () => {
      const concurrentRequests = Array.from({ length: 50 }, (_, i) => ({
        ...validSearchRequest,
        requestId: `concurrent-search-${i}`,
        query: `search term ${i % 10}` // Some repetition for cache testing
      }));

      const startTime = performance.now();
      
      const responses = await Promise.all(
        concurrentRequests.map(req => ipcMainProcess.handleRequest(req))
      );
      
      const totalTime = performance.now() - startTime;
      const avgTime = totalTime / concurrentRequests.length;

      // All should succeed
      expect(responses.every(r => r.success)).toBe(true);
      
      // Average time should be reasonable
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.search.normal);
      
      // Total time should show parallelization benefits
      expect(totalTime).toBeLessThan(concurrentRequests.length * PERFORMANCE_THRESHOLDS.search.fast);
    });

    it('should handle mixed operation types concurrently', async () => {
      const mixedRequests = [
        // Create operations
        ...Array.from({ length: 10 }, (_, i) => ({
          ...validCreateRequest,
          requestId: `mixed-create-${i}`,
          entry: {
            ...validCreateRequest.entry,
            title: `Mixed Test Entry ${i}`
          }
        })),
        // Search operations
        ...Array.from({ length: 20 }, (_, i) => ({
          ...validSearchRequest,
          requestId: `mixed-search-${i}`,
          query: `mixed search ${i % 5}`
        })),
        // Metrics operations
        ...Array.from({ length: 5 }, (_, i) => ({
          ...validMetricsRequest,
          requestId: `mixed-metrics-${i}`
        }))
      ];

      const startTime = performance.now();
      
      const responses = await Promise.all(
        mixedRequests.map(req => ipcMainProcess.handleRequest(req))
      );
      
      const totalTime = performance.now() - startTime;
      const avgTime = totalTime / mixedRequests.length;

      // All should succeed
      const successCount = responses.filter(r => r.success).length;
      expect(successCount).toBe(mixedRequests.length);
      
      // Performance should be reasonable
      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.batch.latency);
      
      console.log(`Mixed operations completed: ${mixedRequests.length} ops in ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Throughput Testing', () => {
    it('should achieve target throughput for read operations', async () => {
      const operationCount = 500;
      const requests = Array.from({ length: operationCount }, (_, i) => 
        () => ipcMainProcess.handleRequest({
          ...validSearchRequest,
          requestId: `throughput-${i}`,
          query: `query ${i % 20}` // Limited variety for caching benefits
        })
      );

      const results = await loadTestRunner.runConcurrentRequests(requests, 25);

      expect(results.successRate).toBeGreaterThan(0.95); // > 95% success rate
      expect(results.avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.batch.latency);
      
      const throughput = operationCount / (results.avgDuration / 1000) * results.successRate;
      expect(throughput).toBeGreaterThan(PERFORMANCE_THRESHOLDS.batch.throughput);

      console.log('Read Throughput Results:', {
        operations: operationCount,
        successRate: (results.successRate * 100).toFixed(2) + '%',
        avgDuration: results.avgDuration.toFixed(2) + 'ms',
        throughput: throughput.toFixed(2) + ' ops/sec'
      });
    });

    it('should achieve reasonable throughput for write operations', async () => {
      const operationCount = 200; // Lower count for write operations
      const requests = Array.from({ length: operationCount }, (_, i) => 
        () => ipcMainProcess.handleRequest({
          ...validCreateRequest,
          requestId: `write-throughput-${i}`,
          entry: {
            ...validCreateRequest.entry,
            title: `Throughput Test Entry ${i}`,
            problem: `Problem ${i}`,
            solution: `Solution ${i}`
          }
        })
      );

      const results = await loadTestRunner.runConcurrentRequests(requests, 10);

      expect(results.successRate).toBeGreaterThan(0.90); // > 90% success rate for writes
      expect(results.avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.create.slow);

      console.log('Write Throughput Results:', {
        operations: operationCount,
        successRate: (results.successRate * 100).toFixed(2) + '%',
        avgDuration: results.avgDuration.toFixed(2) + 'ms',
        failed: results.failed
      });
    });
  });

  describe('Caching Performance', () => {
    it('should demonstrate significant cache performance benefits', async () => {
      const testQuery = 'cache performance test query';
      const request = {
        ...validSearchRequest,
        query: testQuery
      };

      // First request - cold cache
      const coldId = performanceTracker.start('cold-cache');
      const coldResponse = await ipcMainProcess.handleRequest(request);
      const coldTime = performanceTracker.end(coldId);

      expect(coldResponse.success).toBe(true);
      expect(coldResponse.metadata?.cached).toBe(false);

      // Subsequent requests - warm cache
      const warmRequests = Array.from({ length: 100 }, (_, i) => ({
        ...request,
        requestId: `warm-cache-${i}`
      }));

      let totalWarmTime = 0;
      let cacheHits = 0;

      for (const warmRequest of warmRequests) {
        const warmId = performanceTracker.start(`warm-${warmRequest.requestId}`);
        const warmResponse = await ipcMainProcess.handleRequest(warmRequest);
        const warmTime = performanceTracker.end(warmId);

        totalWarmTime += warmTime;
        
        expect(warmResponse.success).toBe(true);
        if (warmResponse.metadata?.cached) {
          cacheHits++;
        }
      }

      const avgWarmTime = totalWarmTime / warmRequests.length;
      const cacheHitRate = cacheHits / warmRequests.length;

      // Cache should provide significant performance improvement
      expect(avgWarmTime).toBeLessThan(coldTime * 0.5); // At least 50% improvement
      expect(cacheHitRate).toBeGreaterThan(0.8); // > 80% cache hit rate

      console.log('Cache Performance Results:', {
        coldTime: coldTime.toFixed(2) + 'ms',
        avgWarmTime: avgWarmTime.toFixed(2) + 'ms',
        improvement: ((coldTime - avgWarmTime) / coldTime * 100).toFixed(1) + '%',
        cacheHitRate: (cacheHitRate * 100).toFixed(1) + '%'
      });
    });

    it('should handle cache invalidation efficiently', async () => {
      const testQuery = 'invalidation test';
      
      // Prime cache
      const primeResponse = await ipcMainProcess.handleRequest({
        ...validSearchRequest,
        query: testQuery
      });
      expect(primeResponse.metadata?.cached).toBe(false);

      // Verify cache hit
      const cachedResponse = await ipcMainProcess.handleRequest({
        ...validSearchRequest,
        query: testQuery
      });
      expect(cachedResponse.metadata?.cached).toBe(true);

      // Trigger cache invalidation by creating related content
      const invalidateId = performanceTracker.start('cache-invalidation');
      
      await ipcMainProcess.handleRequest({
        ...validCreateRequest,
        entry: {
          ...validCreateRequest.entry,
          title: testQuery, // Should invalidate related caches
          problem: 'Problem that invalidates cache'
        }
      });

      const invalidationTime = performanceTracker.end(invalidateId);

      // Next search should miss cache
      const postInvalidationResponse = await ipcMainProcess.handleRequest({
        ...validSearchRequest,
        query: testQuery
      });

      expect(postInvalidationResponse.metadata?.cached).toBe(false);
      expectWithinTime(invalidationTime, PERFORMANCE_THRESHOLDS.create.normal, 'Cache invalidation');
    });
  });

  describe('Memory Usage and Resource Management', () => {
    it('should maintain stable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Generate significant load
      const requests = Array.from({ length: 1000 }, (_, i) => ({
        ...validSearchRequest,
        requestId: `memory-test-${i}`,
        query: `memory test query ${i % 50}`
      }));

      // Process in batches to monitor memory growth
      const batchSize = 100;
      const memorySnapshots = [];

      for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(req => ipcMainProcess.handleRequest(req))
        );

        // Force garbage collection if available
        global.gc && global.gc();
        
        const currentMemory = process.memoryUsage();
        memorySnapshots.push({
          batch: Math.floor(i / batchSize),
          heapUsed: currentMemory.heapUsed,
          heapTotal: currentMemory.heapTotal,
          external: currentMemory.external
        });
      }

      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory growth should be reasonable
      expect(memoryGrowth).toBeLessThan(PERFORMANCE_THRESHOLDS.memory.maxIncrease);

      console.log('Memory Usage Analysis:', {
        initialMB: Math.round(initialMemory.heapUsed / 1024 / 1024),
        finalMB: Math.round(finalMemory.heapUsed / 1024 / 1024),
        growthMB: Math.round(memoryGrowth / 1024 / 1024),
        maxAllowedMB: Math.round(PERFORMANCE_THRESHOLDS.memory.maxIncrease / 1024 / 1024)
      });
    });

    it('should handle resource cleanup properly', async () => {
      // Create resources that need cleanup
      const createRequests = Array.from({ length: 50 }, (_, i) => ({
        ...validCreateRequest,
        requestId: `cleanup-${i}`,
        entry: {
          ...validCreateRequest.entry,
          title: `Cleanup Test Entry ${i}`,
          problem: 'P'.repeat(1000), // Larger entries
          solution: 'S'.repeat(1000)
        }
      }));

      const startMemory = process.memoryUsage();

      // Create entries
      await Promise.all(
        createRequests.map(req => ipcMainProcess.handleRequest(req))
      );

      const afterCreateMemory = process.memoryUsage();

      // Trigger garbage collection
      global.gc && global.gc();
      await delay(100); // Allow cleanup to complete

      const afterGCMemory = process.memoryUsage();

      const memoryGrowth = afterCreateMemory.heapUsed - startMemory.heapUsed;
      const memoryRecovered = afterCreateMemory.heapUsed - afterGCMemory.heapUsed;

      console.log('Resource Cleanup Analysis:', {
        memoryGrowthMB: Math.round(memoryGrowth / 1024 / 1024),
        memoryRecoveredMB: Math.round(memoryRecovered / 1024 / 1024),
        recoveryRate: ((memoryRecovered / memoryGrowth) * 100).toFixed(1) + '%'
      });

      // Should recover significant memory
      expect(memoryRecovered).toBeGreaterThan(memoryGrowth * 0.3); // At least 30% recovery
    });
  });

  describe('Scalability Testing', () => {
    it('should scale performance linearly with simple operations', async () => {
      const testSizes = [10, 50, 100, 200];
      const results = [];

      for (const size of testSizes) {
        const requests = Array.from({ length: size }, (_, i) => ({
          ...validSearchRequest,
          requestId: `scale-${size}-${i}`,
          query: `scale test ${i % 10}`
        }));

        const startTime = performance.now();
        
        const responses = await Promise.all(
          requests.map(req => ipcMainProcess.handleRequest(req))
        );
        
        const totalTime = performance.now() - startTime;
        const avgTime = totalTime / size;
        const successRate = responses.filter(r => r.success).length / size;

        results.push({ size, avgTime, totalTime, successRate });
      }

      // Performance should scale reasonably
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        
        // Average time shouldn't increase dramatically
        expect(curr.avgTime).toBeLessThan(prev.avgTime * 2);
        
        // Success rate should remain high
        expect(curr.successRate).toBeGreaterThan(0.95);
      }

      console.log('Scalability Results:', results.map(r => ({
        size: r.size,
        avgTime: r.avgTime.toFixed(2) + 'ms',
        successRate: (r.successRate * 100).toFixed(1) + '%'
      })));
    });

    it('should handle increasing database size efficiently', async () => {
      const baselines = [];
      const dbSizes = [100, 500, 1000];

      for (const targetSize of dbSizes) {
        // Populate database to target size
        const currentSize = await getCurrentDBSize();
        const entriesToAdd = targetSize - currentSize;

        if (entriesToAdd > 0) {
          const createRequests = Array.from({ length: entriesToAdd }, (_, i) => ({
            ...validCreateRequest,
            requestId: `db-size-${targetSize}-${i}`,
            entry: {
              ...validCreateRequest.entry,
              title: `DB Size Test Entry ${currentSize + i}`,
              problem: `Problem for entry ${currentSize + i}`,
              solution: `Solution for entry ${currentSize + i}`
            }
          }));

          await Promise.all(
            createRequests.map(req => ipcMainProcess.handleRequest(req))
          );
        }

        // Test search performance at this DB size
        const searchId = performanceTracker.start(`db-size-${targetSize}`);
        
        const searchResponse = await ipcMainProcess.handleRequest({
          ...validSearchRequest,
          query: 'test search for database size'
        });
        
        const searchTime = performanceTracker.end(searchId);

        baselines.push({ dbSize: targetSize, searchTime, success: searchResponse.success });
      }

      // Search performance should degrade gracefully
      for (let i = 1; i < baselines.length; i++) {
        const prev = baselines[i - 1];
        const curr = baselines[i];
        
        // Performance should not degrade more than 50% per 500 entries
        const performanceDegradation = (curr.searchTime - prev.searchTime) / prev.searchTime;
        expect(performanceDegradation).toBeLessThan(0.5);
        
        expect(curr.success).toBe(true);
      }

      console.log('Database Scaling Results:', baselines);

      async function getCurrentDBSize(): Promise<number> {
        const metricsResponse = await ipcMainProcess.handleRequest(validMetricsRequest);
        return metricsResponse.success ? metricsResponse.data.summary.totalEntries : 0;
      }
    });
  });

  describe('Performance Regression Detection', () => {
    it('should maintain consistent performance characteristics', async () => {
      // This test establishes baseline performance metrics
      // In a real CI/CD environment, these would be compared against historical data
      
      const performanceBaselines = {
        simpleSearch: { max: PERFORMANCE_THRESHOLDS.search.fast, samples: 100 },
        complexSearch: { max: PERFORMANCE_THRESHOLDS.search.normal, samples: 50 },
        createEntry: { max: PERFORMANCE_THRESHOLDS.create.normal, samples: 50 },
        getMetrics: { max: PERFORMANCE_THRESHOLDS.search.fast, samples: 20 }
      };

      const results: any = {};

      // Test simple searches
      const simpleTimes = [];
      for (let i = 0; i < performanceBaselines.simpleSearch.samples; i++) {
        const id = performanceTracker.start(`simple-${i}`);
        const response = await ipcMainProcess.handleRequest({
          ...validSearchRequest,
          requestId: `baseline-simple-${i}`,
          query: `simple ${i % 5}`
        });
        const time = performanceTracker.end(id);
        
        expect(response.success).toBe(true);
        simpleTimes.push(time);
      }

      results.simpleSearch = {
        avg: simpleTimes.reduce((a, b) => a + b) / simpleTimes.length,
        p95: simpleTimes.sort((a, b) => a - b)[Math.floor(simpleTimes.length * 0.95)],
        max: Math.max(...simpleTimes)
      };

      // Test complex searches
      const complexTimes = [];
      for (let i = 0; i < performanceBaselines.complexSearch.samples; i++) {
        const id = performanceTracker.start(`complex-${i}`);
        const response = await ipcMainProcess.handleRequest({
          ...performanceTestData.heavyRequest,
          requestId: `baseline-complex-${i}`
        });
        const time = performanceTracker.end(id);
        
        expect(response.success).toBe(true);
        complexTimes.push(time);
      }

      results.complexSearch = {
        avg: complexTimes.reduce((a, b) => a + b) / complexTimes.length,
        p95: complexTimes.sort((a, b) => a - b)[Math.floor(complexTimes.length * 0.95)],
        max: Math.max(...complexTimes)
      };

      // Verify performance against thresholds
      expect(results.simpleSearch.p95).toBeLessThan(performanceBaselines.simpleSearch.max);
      expect(results.complexSearch.p95).toBeLessThan(performanceBaselines.complexSearch.max);

      console.log('Performance Baseline Results:', results);
    });
  });
});