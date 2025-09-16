/**
 * Comprehensive Test Suite for Cache Service
 * Tests all caching components including LRU, predictive, incremental, and performance monitoring
 */

import { jest } from '@jest/globals';
import { CacheService, CacheKey } from '../../../src/services/cache/CacheService';
import LRUCache from '../../../src/services/cache/LRUCache';
import { PredictiveCache } from '../../../src/services/cache/PredictiveCache';
import { IncrementalLoader } from '../../../src/services/cache/IncrementalLoader';

// Mock dependencies
jest.mock('../../../src/services/cache/LRUCache');
jest.mock('../../../src/services/cache/PredictiveCache');
jest.mock('../../../src/services/cache/IncrementalLoader');

const MockedLRUCache = LRUCache as jest.MockedClass<typeof LRUCache>;
const MockedPredictiveCache = PredictiveCache as jest.MockedClass<typeof PredictiveCache>;
const MockedIncrementalLoader = IncrementalLoader as jest.MockedClass<typeof IncrementalLoader>;

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockLRUCache: jest.Mocked<LRUCache>;
  let mockPredictiveCache: jest.Mocked<PredictiveCache>;
  let mockIncrementalLoader: jest.Mocked<IncrementalLoader>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup LRU cache mock
    mockLRUCache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      has: jest.fn(),
      clear: jest.fn(),
      getStats: jest.fn(),
      optimize: jest.fn(),
      destroy: jest.fn()
    } as any;

    // Setup predictive cache mock
    mockPredictiveCache = {
      recordSearchEvent: jest.fn(),
      getPredictions: jest.fn(),
      getStats: jest.fn(),
      trainModels: jest.fn()
    } as any;

    // Setup incremental loader mock
    mockIncrementalLoader = {
      load: jest.fn(),
      getStats: jest.fn(),
      optimizeChunkSizes: jest.fn()
    } as any;

    MockedLRUCache.mockImplementation(() => mockLRUCache);
    MockedPredictiveCache.mockImplementation(() => mockPredictiveCache);
    MockedIncrementalLoader.mockImplementation(() => mockIncrementalLoader);

    cacheService = new CacheService({
      lru: {
        maxSize: 1000,
        maxMemoryMB: 100,
        defaultTTL: 300000,
        evictionPolicy: 'LRU'
      },
      predictive: {
        enableMLPredictions: true,
        maxPredictions: 50,
        confidenceThreshold: 0.7,
        predictionHorizon: 30
      }
    });
  });

  afterEach(async () => {
    await cacheService.destroy();
  });

  describe('Basic Cache Operations', () => {
    test('should get value from cache', async () => {
      const key: CacheKey = { type: 'search', id: 'test-key' };
      const value = { data: 'test-value' };

      mockLRUCache.get.mockResolvedValue(value);

      const result = await cacheService.get(key);

      expect(result).toEqual(value);
      expect(mockLRUCache.get).toHaveBeenCalledWith('search:test-key');
    });

    test('should return null for cache miss', async () => {
      const key: CacheKey = { type: 'search', id: 'missing-key' };

      mockLRUCache.get.mockResolvedValue(null);

      const result = await cacheService.get(key);

      expect(result).toBeNull();
      expect(mockLRUCache.get).toHaveBeenCalledWith('search:missing-key');
    });

    test('should set value in cache', async () => {
      const key: CacheKey = { type: 'data', id: 'test-key' };
      const value = { data: 'test-value' };

      mockLRUCache.set.mockResolvedValue(true);

      const result = await cacheService.set(key, value, { ttl: 60000 });

      expect(result).toBe(true);
      expect(mockLRUCache.set).toHaveBeenCalledWith('data:test-key', value, 60000);
    });

    test('should delete value from cache', async () => {
      const key: CacheKey = { type: 'search', id: 'test-key' };

      mockLRUCache.delete.mockResolvedValue(true);

      const result = await cacheService.delete(key);

      expect(result).toBe(true);
      expect(mockLRUCache.delete).toHaveBeenCalledWith('search:test-key');
    });

    test('should check if key exists in cache', async () => {
      const key: CacheKey = { type: 'search', id: 'test-key' };

      mockLRUCache.has.mockResolvedValue(true);

      const result = await cacheService.has(key);

      expect(result).toBe(true);
      expect(mockLRUCache.has).toHaveBeenCalledWith('search:test-key');
    });

    test('should clear all cache entries', async () => {
      mockLRUCache.clear.mockResolvedValue(undefined);

      await cacheService.clear();

      expect(mockLRUCache.clear).toHaveBeenCalled();
    });
  });

  describe('Cache Key Generation', () => {
    test('should generate simple cache key', async () => {
      const key: CacheKey = { type: 'search', id: 'test' };

      mockLRUCache.get.mockResolvedValue(null);
      await cacheService.get(key);

      expect(mockLRUCache.get).toHaveBeenCalledWith('search:test');
    });

    test('should generate cache key with parameters', async () => {
      const key: CacheKey = {
        type: 'search',
        id: 'test',
        params: { query: 'hello', limit: 10 }
      };

      mockLRUCache.get.mockResolvedValue(null);
      await cacheService.get(key);

      expect(mockLRUCache.get).toHaveBeenCalledWith('search:test:limit:10|query:hello');
    });

    test('should generate cache key with user context', async () => {
      const key: CacheKey = {
        type: 'search',
        id: 'test',
        userContext: 'user123'
      };

      mockLRUCache.get.mockResolvedValue(null);
      await cacheService.get(key);

      expect(mockLRUCache.get).toHaveBeenCalledWith('search:test:user:user123');
    });

    test('should generate cache key with all components', async () => {
      const key: CacheKey = {
        type: 'computation',
        id: 'complex-calc',
        params: { x: 5, y: 10 },
        userContext: 'user456'
      };

      mockLRUCache.get.mockResolvedValue(null);
      await cacheService.get(key);

      expect(mockLRUCache.get).toHaveBeenCalledWith('computation:complex-calc:x:5|y:10:user:user456');
    });
  });

  describe('Incremental Loading', () => {
    test('should load data incrementally', async () => {
      const request = {
        id: 'load-test',
        query: 'test query',
        totalSize: 1000,
        chunkSize: 100,
        priority: 'medium' as const,
        loadStrategy: 'adaptive' as const,
        maxParallelChunks: 3
      };

      const mockData = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const dataSource = jest.fn().mockResolvedValue(mockData);

      mockIncrementalLoader.load.mockResolvedValue(mockData);
      mockLRUCache.set.mockResolvedValue(true);

      const result = await cacheService.loadIncremental(request, dataSource);

      expect(result).toEqual(mockData);
      expect(mockIncrementalLoader.load).toHaveBeenCalledWith(request, dataSource);
      expect(mockLRUCache.set).toHaveBeenCalled();
    });

    test('should prevent duplicate incremental loads', async () => {
      const request = {
        id: 'duplicate-load',
        query: 'test query',
        totalSize: 1000,
        chunkSize: 100,
        priority: 'medium' as const,
        loadStrategy: 'parallel' as const,
        maxParallelChunks: 2
      };

      const mockData = [{ id: 1 }];
      const dataSource = jest.fn().mockResolvedValue(mockData);

      mockIncrementalLoader.load.mockResolvedValue(mockData);

      // Start two loads simultaneously
      const load1 = cacheService.loadIncremental(request, dataSource);
      const load2 = cacheService.loadIncremental(request, dataSource);

      const results = await Promise.all([load1, load2]);

      // Both should get the same result
      expect(results[0]).toEqual(mockData);
      expect(results[1]).toEqual(mockData);

      // But the loader should only be called once
      expect(mockIncrementalLoader.load).toHaveBeenCalledTimes(1);
    });
  });

  describe('Predictive Caching', () => {
    test('should record search events', () => {
      const sessionId = 'session123';
      const event = {
        query: 'test query',
        timestamp: Date.now(),
        resultClicks: 5,
        sessionDuration: 30000,
        followupQueries: ['related query']
      };

      cacheService.recordSearchEvent(sessionId, event, 'user123');

      expect(mockPredictiveCache.recordSearchEvent).toHaveBeenCalledWith(sessionId, event, 'user123');
    });

    test('should get predictions for user', async () => {
      const predictions = [
        { key: 'pred1', query: 'predicted query', confidence: 0.8 }
      ];

      mockPredictiveCache.getPredictions.mockResolvedValue(predictions);

      const result = await cacheService.getPredictions('session123', 'user123', { context: 'search' });

      expect(result).toEqual(predictions);
      expect(mockPredictiveCache.getPredictions).toHaveBeenCalledWith('session123', 'user123', { context: 'search' });
    });

    test('should return empty predictions when predictive cache disabled', async () => {
      // Create service without predictive cache
      const serviceWithoutPredictive = new CacheService({
        predictive: { enableMLPredictions: false }
      });

      const result = await serviceWithoutPredictive.getPredictions('session123');

      expect(result).toEqual([]);
    });
  });

  describe('Performance Metrics', () => {
    test('should collect comprehensive metrics', () => {
      mockLRUCache.getStats.mockReturnValue({
        hitRate: 0.85,
        size: 500,
        memoryUsage: 50000000,
        evictions: 10
      });

      mockPredictiveCache.getStats.mockReturnValue({
        totalPredictions: 100,
        successfulPredictions: 75,
        predictionAccuracy: 0.75
      });

      mockIncrementalLoader.getStats.mockReturnValue({
        activeLoads: 2,
        averageLoadTime: 1500,
        cacheHitRate: 0.6
      });

      const metrics = cacheService.getMetrics();

      expect(metrics.lru.hitRate).toBe(0.85);
      expect(metrics.predictive.predictionAccuracy).toBe(0.75);
      expect(metrics.incremental.activeLoads).toBe(2);
    });

    test('should track performance statistics', () => {
      // Simulate some cache operations to generate stats
      const performanceStats = cacheService.getPerformanceStats();

      expect(performanceStats).toHaveProperty('hitRate');
      expect(performanceStats).toHaveProperty('averageResponseTime');
      expect(performanceStats).toHaveProperty('throughput');
      expect(performanceStats).toHaveProperty('hotKeys');
      expect(performanceStats).toHaveProperty('recommendations');
    });
  });

  describe('Cache Optimization', () => {
    test('should optimize cache performance', async () => {
      mockLRUCache.optimize.mockImplementation(() => {});
      mockIncrementalLoader.optimizeChunkSizes.mockImplementation(() => {});
      mockPredictiveCache.trainModels.mockResolvedValue(undefined);

      const result = await cacheService.optimize();

      expect(result.actionsPerformed).toContain('LRU cache optimization');
      expect(result.actionsPerformed).toContain('Incremental loader chunk size optimization');
      expect(result.actionsPerformed).toContain('Predictive model training');
      expect(result.estimatedImprovement).toBeGreaterThan(0);
      expect(result.newConfiguration).toBeDefined();
    });

    test('should handle optimization errors gracefully', async () => {
      mockPredictiveCache.trainModels.mockRejectedValue(new Error('Training failed'));

      const result = await cacheService.optimize();

      // Should still complete other optimizations
      expect(result.actionsPerformed.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle cache get errors gracefully', async () => {
      const key: CacheKey = { type: 'search', id: 'error-key' };

      mockLRUCache.get.mockRejectedValue(new Error('Cache error'));

      const result = await cacheService.get(key);

      expect(result).toBeNull();
    });

    test('should handle cache set errors gracefully', async () => {
      const key: CacheKey = { type: 'data', id: 'error-key' };
      const value = { data: 'test' };

      mockLRUCache.set.mockRejectedValue(new Error('Cache error'));

      const result = await cacheService.set(key, value);

      expect(result).toBe(false);
    });

    test('should handle incremental loading errors', async () => {
      const request = {
        id: 'error-load',
        query: 'test',
        totalSize: 100,
        chunkSize: 10,
        priority: 'low' as const,
        loadStrategy: 'sequential' as const,
        maxParallelChunks: 1
      };

      const dataSource = jest.fn();
      mockIncrementalLoader.load.mockRejectedValue(new Error('Load failed'));

      await expect(cacheService.loadIncremental(request, dataSource))
        .rejects.toThrow('Load failed');
    });
  });

  describe('Resource Management', () => {
    test('should properly destroy resources', async () => {
      mockLRUCache.destroy.mockImplementation(() => {});

      await cacheService.destroy();

      expect(mockLRUCache.destroy).toHaveBeenCalled();
    });

    test('should handle destruction errors', async () => {
      mockLRUCache.destroy.mockImplementation(() => {
        throw new Error('Destruction failed');
      });

      await expect(cacheService.destroy()).rejects.toThrow('Destruction failed');
    });
  });

  describe('Event Emission', () => {
    test('should emit cache events', async () => {
      const eventSpy = jest.fn();
      cacheService.on('cache-set', eventSpy);

      const key: CacheKey = { type: 'data', id: 'event-test' };
      const value = { data: 'test' };

      mockLRUCache.set.mockResolvedValue(true);

      await cacheService.set(key, value);

      expect(eventSpy).toHaveBeenCalledWith({
        key: 'data:event-test',
        size: expect.any(Number)
      });
    });

    test('should emit cache delete events', async () => {
      const eventSpy = jest.fn();
      cacheService.on('cache-delete', eventSpy);

      const key: CacheKey = { type: 'data', id: 'delete-test' };

      mockLRUCache.delete.mockResolvedValue(true);

      await cacheService.delete(key);

      expect(eventSpy).toHaveBeenCalledWith({
        key: 'data:delete-test'
      });
    });

    test('should emit cache clear events', async () => {
      const eventSpy = jest.fn();
      cacheService.on('cache-cleared', eventSpy);

      mockLRUCache.clear.mockResolvedValue(undefined);

      await cacheService.clear();

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    test('should use default configuration', () => {
      const defaultService = new CacheService();
      const metrics = defaultService.getMetrics();

      expect(metrics).toBeDefined();
    });

    test('should apply custom configuration', () => {
      const customConfig = {
        lru: {
          maxSize: 2000,
          maxMemoryMB: 200,
          defaultTTL: 600000,
          evictionPolicy: 'ADAPTIVE' as const
        },
        performance: {
          enableMetrics: false
        }
      };

      const customService = new CacheService(customConfig);
      expect(customService).toBeDefined();
    });
  });

  describe('Thread Safety', () => {
    test('should handle concurrent operations', async () => {
      const key: CacheKey = { type: 'concurrent', id: 'test' };
      const value = { data: 'concurrent-test' };

      mockLRUCache.get.mockResolvedValue(null);
      mockLRUCache.set.mockResolvedValue(true);

      // Simulate concurrent get/set operations
      const operations = Array.from({ length: 10 }, (_, i) =>
        i % 2 === 0
          ? cacheService.get({ ...key, id: `test-${i}` })
          : cacheService.set({ ...key, id: `test-${i}` }, { ...value, id: i })
      );

      const results = await Promise.all(operations);

      // All operations should complete without errors
      expect(results).toHaveLength(10);
    });
  });
});

describe('LRUCache Integration', () => {
  test('should perform basic LRU operations', async () => {
    // Remove the mock for this integration test
    jest.unmock('../../../src/services/cache/LRUCache');

    const { LRUCache } = await import('../../../src/services/cache/LRUCache');

    const cache = new LRUCache({
      maxSize: 3,
      defaultTTL: 1000
    });

    // Test basic operations
    await cache.set('key1', 'value1');
    await cache.set('key2', 'value2');
    await cache.set('key3', 'value3');

    expect(await cache.get('key1')).toBe('value1');
    expect(await cache.has('key2')).toBe(true);

    // Test eviction
    await cache.set('key4', 'value4');
    expect(await cache.get('key1')).toBeNull(); // Should be evicted

    // Test TTL
    await cache.set('expiring', 'value', 100);
    expect(await cache.get('expiring')).toBe('value');

    await new Promise(resolve => setTimeout(resolve, 150));
    expect(await cache.get('expiring')).toBeNull(); // Should be expired

    cache.destroy();
  });
});

describe('Performance Edge Cases', () => {
  test('should handle large data sets efficiently', async () => {
    const largeData = Array.from({ length: 10000 }, (_, i) => ({ id: i, data: `item-${i}` }));
    const key: CacheKey = { type: 'data', id: 'large-dataset' };

    mockLRUCache.set.mockResolvedValue(true);
    mockLRUCache.get.mockResolvedValue(largeData);

    const startTime = Date.now();

    await cacheService.set(key, largeData);
    const retrieved = await cacheService.get(key);

    const endTime = Date.now();

    expect(retrieved).toEqual(largeData);
    expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
  });

  test('should handle memory pressure gracefully', async () => {
    // Simulate high memory usage
    const originalMemoryUsage = process.memoryUsage;
    process.memoryUsage = jest.fn().mockReturnValue({
      rss: 1000000000,
      heapTotal: 800000000,
      heapUsed: 750000000, // 93.75% usage
      external: 50000000,
      arrayBuffers: 10000000
    });

    const key: CacheKey = { type: 'data', id: 'memory-test' };
    const value = { data: 'test-under-pressure' };

    mockLRUCache.set.mockResolvedValue(true);

    const result = await cacheService.set(key, value);

    expect(result).toBe(true);

    // Restore original function
    process.memoryUsage = originalMemoryUsage;
  });
});

// Performance benchmark test (optional, for CI environments with longer timeouts)
describe('Performance Benchmarks', () => {
  test.skip('should meet performance benchmarks', async () => {
    const iterations = 1000;
    const keys = Array.from({ length: iterations }, (_, i) => ({
      type: 'benchmark' as const,
      id: `key-${i}`
    }));
    const values = Array.from({ length: iterations }, (_, i) => ({ id: i, data: `value-${i}` }));

    mockLRUCache.set.mockResolvedValue(true);
    mockLRUCache.get.mockImplementation(async (key) => {
      const index = parseInt(key.split('-')[1]);
      return values[index] || null;
    });

    // Benchmark set operations
    const setStart = Date.now();
    await Promise.all(keys.map((key, i) => cacheService.set(key, values[i])));
    const setEnd = Date.now();

    // Benchmark get operations
    const getStart = Date.now();
    await Promise.all(keys.map(key => cacheService.get(key)));
    const getEnd = Date.now();

    const setTime = setEnd - setStart;
    const getTime = getEnd - getStart;

    console.log(`Set ${iterations} items in ${setTime}ms (${(setTime/iterations).toFixed(2)}ms per item)`);
    console.log(`Get ${iterations} items in ${getTime}ms (${(getTime/iterations).toFixed(2)}ms per item)`);

    // Performance assertions
    expect(setTime).toBeLessThan(5000); // 5 seconds for 1000 sets
    expect(getTime).toBeLessThan(2000); // 2 seconds for 1000 gets
    expect(setTime / iterations).toBeLessThan(10); // Less than 10ms per set
    expect(getTime / iterations).toBeLessThan(5); // Less than 5ms per get
  });
});