/**
 * Incremental Loader Unit Tests
 * Testing the progressive data loading system with intelligent chunking
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import {
  IncrementalLoader,
  LoadRequest,
  LoadChunk,
  LoadProgress,
  LoadStats,
  ChunkCache,
  IncrementalLoaderConfig
} from '../../../src/services/cache/IncrementalLoader';

// Mock implementation of ChunkCache
class MockChunkCache<T> implements ChunkCache<T> {
  private cache = new Map<string, LoadChunk<T>>();
  
  get(key: string): LoadChunk<T> | null {
    return this.cache.get(key) || null;
  }
  
  set(key: string, chunk: LoadChunk<T>, ttl?: number): void {
    this.cache.set(key, chunk);
    
    if (ttl) {
      setTimeout(() => {
        this.cache.delete(key);
      }, ttl);
    }
  }
  
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  get size(): number {
    return this.cache.size;
  }
}

// Mock data source
const createMockDataSource = (totalSize: number, delay: number = 0) => {
  const data = Array.from({ length: totalSize }, (_, i) => `item-${i}`);
  
  return async (offset: number, limit: number): Promise<string[]> => {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    return data.slice(offset, offset + limit);
  };
};

describe('IncrementalLoader', () => {
  let loader: IncrementalLoader<string>;
  let mockCache: MockChunkCache<string>;
  let config: Partial<IncrementalLoaderConfig>;

  beforeEach(() => {
    mockCache = new MockChunkCache<string>();
    
    config = {
      defaultChunkSize: 10,
      maxParallelLoads: 3,
      enableAdaptiveChunking: true,
      enablePrioritization: true,
      enableCaching: true,
      chunkCacheTTL: 5000,
      loadTimeout: 30000,
      retryAttempts: 2,
      retryDelay: 100,
      throughputThreshold: 0.8,
      adaptiveThreshold: 0.1
    };
    
    loader = new IncrementalLoader<string>(mockCache, config);
  });

  afterEach(() => {
    // Cleanup any resources
  });

  describe('Basic Loading Operations', () => {
    it('should load data incrementally', async () => {
      const totalSize = 50;
      const dataSource = createMockDataSource(totalSize);
      
      const request: LoadRequest<string> = {
        id: 'test-load-1',
        query: 'test query',
        totalSize,
        chunkSize: 10,
        priority: 'medium',
        loadStrategy: 'sequential',
        maxParallelChunks: 1
      };
      
      const result = await loader.load(request, dataSource);
      
      expect(result).toHaveLength(totalSize);
      expect(result[0]).toBe('item-0');
      expect(result[totalSize - 1]).toBe(`item-${totalSize - 1}`);
    });

    it('should handle small datasets correctly', async () => {
      const totalSize = 5;
      const dataSource = createMockDataSource(totalSize);
      
      const request: LoadRequest<string> = {
        id: 'test-load-small',
        query: 'small dataset',
        totalSize,
        chunkSize: 10, // Larger than total size
        priority: 'high',
        loadStrategy: 'sequential',
        maxParallelChunks: 1
      };
      
      const result = await loader.load(request, dataSource);
      
      expect(result).toHaveLength(totalSize);
      expect(result).toEqual(['item-0', 'item-1', 'item-2', 'item-3', 'item-4']);
    });

    it('should handle empty datasets', async () => {
      const dataSource = createMockDataSource(0);
      
      const request: LoadRequest<string> = {
        id: 'test-load-empty',
        query: 'empty dataset',
        totalSize: 0,
        chunkSize: 10,
        priority: 'low',
        loadStrategy: 'sequential',
        maxParallelChunks: 1
      };
      
      const result = await loader.load(request, dataSource);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('Sequential Loading Strategy', () => {
    it('should load chunks sequentially', async () => {
      const loadOrder: number[] = [];
      const totalSize = 30;
      
      const trackingDataSource = async (offset: number, limit: number): Promise<string[]> => {
        loadOrder.push(offset);
        await new Promise(resolve => setTimeout(resolve, 10));
        return Array.from({ length: limit }, (_, i) => `item-${offset + i}`);
      };
      
      const request: LoadRequest<string> = {
        id: 'test-sequential',
        query: 'sequential test',
        totalSize,
        chunkSize: 10,
        priority: 'medium',
        loadStrategy: 'sequential',
        maxParallelChunks: 1
      };
      
      await loader.load(request, trackingDataSource);
      
      // Should load in order: 0, 10, 20
      expect(loadOrder).toEqual([0, 10, 20]);
    });
  });

  describe('Parallel Loading Strategy', () => {
    it('should load chunks in parallel', async () => {
      const startTimes: number[] = [];
      const totalSize = 30;
      
      const parallelDataSource = async (offset: number, limit: number): Promise<string[]> => {
        startTimes.push(Date.now());
        await new Promise(resolve => setTimeout(resolve, 50));
        return Array.from({ length: limit }, (_, i) => `item-${offset + i}`);
      };
      
      const request: LoadRequest<string> = {
        id: 'test-parallel',
        query: 'parallel test',
        totalSize,
        chunkSize: 10,
        priority: 'high',
        loadStrategy: 'parallel',
        maxParallelChunks: 3
      };
      
      const startTime = Date.now();
      const result = await loader.load(request, parallelDataSource);
      const endTime = Date.now();
      
      expect(result).toHaveLength(totalSize);
      
      // Parallel loading should be faster than sequential
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(150); // Much less than 150ms (3 * 50ms)
    });
  });

  describe('Adaptive Loading Strategy', () => {
    it('should choose parallel for large high-priority requests', async () => {
      const totalSize = 1500;
      const dataSource = createMockDataSource(totalSize, 1);
      
      const request: LoadRequest<string> = {
        id: 'test-adaptive-large',
        query: 'large adaptive test',
        totalSize,
        chunkSize: 50,
        priority: 'high',
        loadStrategy: 'adaptive',
        maxParallelChunks: 3
      };
      
      // Should adapt to parallel strategy
      const result = await loader.load(request, dataSource);
      expect(result).toHaveLength(totalSize);
    });

    it('should choose sequential for small requests', async () => {
      const totalSize = 50;
      const dataSource = createMockDataSource(totalSize, 1);
      
      const request: LoadRequest<string> = {
        id: 'test-adaptive-small',
        query: 'small adaptive test',
        totalSize,
        chunkSize: 10,
        priority: 'medium',
        loadStrategy: 'adaptive',
        maxParallelChunks: 3
      };
      
      // Should adapt to sequential strategy for small datasets
      const result = await loader.load(request, dataSource);
      expect(result).toHaveLength(totalSize);
    });
  });

  describe('Caching', () => {
    it('should cache chunks when caching is enabled', async () => {
      const totalSize = 30;
      let loadCallCount = 0;
      
      const countingDataSource = async (offset: number, limit: number): Promise<string[]> => {
        loadCallCount++;
        return Array.from({ length: limit }, (_, i) => `item-${offset + i}`);
      };
      
      const request: LoadRequest<string> = {
        id: 'test-caching',
        query: 'caching test',
        totalSize,
        chunkSize: 10,
        priority: 'medium',
        loadStrategy: 'sequential',
        maxParallelChunks: 1
      };
      
      // First load
      await loader.load(request, countingDataSource);
      expect(loadCallCount).toBe(3); // 3 chunks
      
      // Second load with same request - should use cache
      loadCallCount = 0;
      await loader.load(request, countingDataSource);
      expect(loadCallCount).toBe(0); // Should be fully cached
    });

    it('should respect cache TTL', async () => {
      jest.useFakeTimers();
      
      const totalSize = 20;
      let loadCallCount = 0;
      
      const dataSource = async (offset: number, limit: number): Promise<string[]> => {
        loadCallCount++;
        return Array.from({ length: limit }, (_, i) => `item-${offset + i}`);
      };
      
      // Create loader with short TTL
      const shortTTLLoader = new IncrementalLoader<string>(mockCache, {
        ...config,
        chunkCacheTTL: 1000 // 1 second
      });
      
      const request: LoadRequest<string> = {
        id: 'test-ttl',
        query: 'ttl test',
        totalSize,
        chunkSize: 10,
        priority: 'medium',
        loadStrategy: 'sequential',
        maxParallelChunks: 1
      };
      
      // First load
      await shortTTLLoader.load(request, dataSource);
      expect(loadCallCount).toBe(2);
      
      // Advance time beyond TTL
      jest.advanceTimersByTime(2000);
      
      // Second load - cache should be expired
      loadCallCount = 0;
      await shortTTLLoader.load(request, dataSource);
      expect(loadCallCount).toBe(2); // Should reload all chunks
      
      jest.useRealTimers();
    });

    it('should work without caching when disabled', async () => {
      const noCacheLoader = new IncrementalLoader<string>(mockCache, {
        ...config,
        enableCaching: false
      });
      
      const totalSize = 20;
      let loadCallCount = 0;
      
      const dataSource = async (offset: number, limit: number): Promise<string[]> => {
        loadCallCount++;
        return Array.from({ length: limit }, (_, i) => `item-${offset + i}`);
      };
      
      const request: LoadRequest<string> = {
        id: 'test-no-cache',
        query: 'no cache test',
        totalSize,
        chunkSize: 10,
        priority: 'medium',
        loadStrategy: 'sequential',
        maxParallelChunks: 1
      };
      
      // First load
      await noCacheLoader.load(request, dataSource);
      expect(loadCallCount).toBe(2);
      
      // Second load - should not use cache
      loadCallCount = 0;
      await noCacheLoader.load(request, dataSource);
      expect(loadCallCount).toBe(2); // Should reload everything
    });
  });

  describe('Progress Tracking', () => {
    it('should track load progress', async () => {
      const progressUpdates: LoadProgress[] = [];
      const totalSize = 50;
      const dataSource = createMockDataSource(totalSize, 10);
      
      const request: LoadRequest<string> = {
        id: 'test-progress',
        query: 'progress test',
        totalSize,
        chunkSize: 10,
        priority: 'medium',
        loadStrategy: 'sequential',
        maxParallelChunks: 1,
        onChunkLoaded: (chunk, progress) => {
          progressUpdates.push(progress);
        }
      };
      
      await loader.load(request, dataSource);
      
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Check that progress increases
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i].percentage).toBeGreaterThanOrEqual(
          progressUpdates[i - 1].percentage
        );
      }
      
      // Final progress should be 100%
      const finalProgress = progressUpdates[progressUpdates.length - 1];
      expect(finalProgress.percentage).toBe(100);
    });

    it('should provide accurate progress information', async () => {
      const totalSize = 30;
      const chunkSize = 10;
      let progressUpdate: LoadProgress | null = null;
      
      const request: LoadRequest<string> = {
        id: 'test-progress-accuracy',
        query: 'progress accuracy test',
        totalSize,
        chunkSize,
        priority: 'medium',
        loadStrategy: 'sequential',
        maxParallelChunks: 1,
        onChunkLoaded: (chunk, progress) => {
          progressUpdate = progress;
        }
      };
      
      await loader.load(request, createMockDataSource(totalSize));
      
      expect(progressUpdate).toBeDefined();
      expect(progressUpdate!.totalChunks).toBe(3); // 30 / 10 = 3 chunks
      expect(progressUpdate!.totalSize).toBe(totalSize);
      expect(progressUpdate!.loadedSize).toBe(totalSize);
    });
  });

  describe('Preloading', () => {
    it('should preload chunks successfully', async () => {
      const chunkIds = ['chunk-1', 'chunk-2', 'chunk-3'];
      
      const preloadDataSource = async (chunkId: string): Promise<string[]> => {
        return [`data-${chunkId}-1`, `data-${chunkId}-2`];
      };
      
      const preloadedCount = await loader.preload(
        'preload-test',
        'preload query',
        chunkIds,
        preloadDataSource
      );
      
      expect(preloadedCount).toBe(chunkIds.length);
      expect(mockCache.size).toBe(chunkIds.length);
    });

    it('should skip already cached chunks during preload', async () => {
      const chunkIds = ['chunk-1', 'chunk-2', 'chunk-3'];
      
      // Pre-cache one chunk
      mockCache.set('preload-test:chunk-1', {
        id: 'chunk-1',
        data: ['existing-data'],
        size: 1,
        priority: 1,
        timestamp: Date.now(),
        estimatedLoadTime: 100
      });
      
      let loadCallCount = 0;
      const preloadDataSource = async (chunkId: string): Promise<string[]> => {
        loadCallCount++;
        return [`data-${chunkId}-1`, `data-${chunkId}-2`];
      };
      
      const preloadedCount = await loader.preload(
        'preload-test',
        'preload query',
        chunkIds,
        preloadDataSource
      );
      
      expect(preloadedCount).toBe(2); // Only 2 new chunks loaded
      expect(loadCallCount).toBe(2); // Only called for non-cached chunks
    });
  });

  describe('Load Cancellation', () => {
    it('should cancel active loads', async () => {
      const totalSize = 100;
      const dataSource = createMockDataSource(totalSize, 100); // Slow data source
      
      const request: LoadRequest<string> = {
        id: 'test-cancellation',
        query: 'cancellation test',
        totalSize,
        chunkSize: 10,
        priority: 'medium',
        loadStrategy: 'sequential',
        maxParallelChunks: 1
      };
      
      // Start load
      const loadPromise = loader.load(request, dataSource);
      
      // Cancel immediately
      const cancelled = loader.cancelLoad('test-cancellation');
      expect(cancelled).toBe(true);
      
      // Load should be cancelled
      try {
        await loadPromise;
      } catch (error) {
        // Expected to be cancelled
      }
    });

    it('should return false when cancelling non-existent load', () => {
      const cancelled = loader.cancelLoad('non-existent-load');
      expect(cancelled).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle data source errors gracefully', async () => {
      const errorDataSource = async (offset: number, limit: number): Promise<string[]> => {
        if (offset === 10) {
          throw new Error('Data source error');
        }
        return Array.from({ length: limit }, (_, i) => `item-${offset + i}`);
      };
      
      const request: LoadRequest<string> = {
        id: 'test-error-handling',
        query: 'error handling test',
        totalSize: 30,
        chunkSize: 10,
        priority: 'medium',
        loadStrategy: 'sequential',
        maxParallelChunks: 1
      };
      
      await expect(loader.load(request, errorDataSource)).rejects.toThrow();
    });

    it('should retry failed chunks', async () => {
      let attemptCount = 0;
      
      const retryDataSource = async (offset: number, limit: number): Promise<string[]> => {
        attemptCount++;
        
        if (attemptCount <= 2) {
          throw new Error('Temporary failure');
        }
        
        return Array.from({ length: limit }, (_, i) => `item-${offset + i}`);
      };
      
      const request: LoadRequest<string> = {
        id: 'test-retry',
        query: 'retry test',
        totalSize: 10,
        chunkSize: 10,
        priority: 'medium',
        loadStrategy: 'sequential',
        maxParallelChunks: 1
      };
      
      const result = await loader.load(request, retryDataSource);
      
      expect(result).toHaveLength(10);
      expect(attemptCount).toBe(3); // Initial attempt + 2 retries
    });

    it('should fail after max retry attempts', async () => {
      const alwaysFailDataSource = async (offset: number, limit: number): Promise<string[]> => {
        throw new Error('Persistent failure');
      };
      
      const request: LoadRequest<string> = {
        id: 'test-max-retry',
        query: 'max retry test',
        totalSize: 10,
        chunkSize: 10,
        priority: 'medium',
        loadStrategy: 'sequential',
        maxParallelChunks: 1
      };
      
      await expect(loader.load(request, alwaysFailDataSource)).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      const timeoutDataSource = async (offset: number, limit: number): Promise<string[]> => {
        // Simulate very slow response
        await new Promise(resolve => setTimeout(resolve, 50000));
        return Array.from({ length: limit }, (_, i) => `item-${offset + i}`);
      };
      
      const fastTimeoutLoader = new IncrementalLoader<string>(mockCache, {
        ...config,
        loadTimeout: 100 // Very short timeout
      });
      
      const request: LoadRequest<string> = {
        id: 'test-timeout',
        query: 'timeout test',
        totalSize: 10,
        chunkSize: 10,
        priority: 'medium',
        loadStrategy: 'sequential',
        maxParallelChunks: 1
      };
      
      await expect(fastTimeoutLoader.load(request, timeoutDataSource)).rejects.toThrow();
    });
  });

  describe('Statistics and Metrics', () => {
    it('should provide loading statistics', async () => {
      const totalSize = 30;
      const dataSource = createMockDataSource(totalSize);
      
      const request: LoadRequest<string> = {
        id: 'test-stats',
        query: 'stats test',
        totalSize,
        chunkSize: 10,
        priority: 'medium',
        loadStrategy: 'sequential',
        maxParallelChunks: 1
      };
      
      await loader.load(request, dataSource);
      
      const stats = loader.getStats();
      
      expect(stats).toMatchObject({
        activeLoads: expect.any(Number),
        queuedLoads: expect.any(Number),
        cacheSize: expect.any(Number),
        averageLoadTime: expect.any(Number),
        averageThroughput: expect.any(Number),
        cacheHitRate: expect.any(Number)
      });
    });

    it('should track cache hit rate', async () => {
      const totalSize = 20;
      const dataSource = createMockDataSource(totalSize);
      
      const request: LoadRequest<string> = {
        id: 'test-hit-rate',
        query: 'hit rate test',
        totalSize,
        chunkSize: 10,
        priority: 'medium',
        loadStrategy: 'sequential',
        maxParallelChunks: 1
      };
      
      // First load - all cache misses
      await loader.load(request, dataSource);
      let stats = loader.getStats();
      
      // Second load - should have cache hits
      await loader.load(request, dataSource);
      stats = loader.getStats();
      
      expect(stats.cacheHitRate).toBeGreaterThan(0);
    });
  });

  describe('Adaptive Optimization', () => {
    it('should optimize chunk sizes based on performance', async () => {
      // Simulate multiple loads to generate performance data
      for (let i = 0; i < 5; i++) {
        const request: LoadRequest<string> = {
          id: `optimization-test-${i}`,
          query: `optimization test ${i}`,
          totalSize: 50,
          chunkSize: 10,
          priority: 'medium',
          loadStrategy: 'sequential',
          maxParallelChunks: 1
        };
        
        await loader.load(request, createMockDataSource(50, 5));
      }
      
      // Run optimization
      loader.optimizeChunkSizes();
      
      // Verify optimization ran (would need access to internal state for full verification)
      const stats = loader.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should work with minimal configuration', () => {
      const minimalLoader = new IncrementalLoader<string>(new MockChunkCache());
      expect(minimalLoader).toBeDefined();
      
      const stats = minimalLoader.getStats();
      expect(stats).toBeDefined();
    });

    it('should respect custom configuration', () => {
      const customConfig = {
        defaultChunkSize: 50,
        maxParallelLoads: 5,
        enableCaching: false,
        retryAttempts: 5
      };
      
      const customLoader = new IncrementalLoader<string>(new MockChunkCache(), customConfig);
      expect(customLoader).toBeDefined();
    });
  });

  describe('Complex Loading Scenarios', () => {
    it('should handle mixed priority loads', async () => {
      const highPriorityRequest: LoadRequest<string> = {
        id: 'high-priority',
        query: 'urgent query',
        totalSize: 20,
        chunkSize: 10,
        priority: 'critical',
        loadStrategy: 'parallel',
        maxParallelChunks: 2
      };
      
      const lowPriorityRequest: LoadRequest<string> = {
        id: 'low-priority',
        query: 'background query',
        totalSize: 30,
        chunkSize: 10,
        priority: 'low',
        loadStrategy: 'sequential',
        maxParallelChunks: 1
      };
      
      const results = await Promise.all([
        loader.load(highPriorityRequest, createMockDataSource(20)),
        loader.load(lowPriorityRequest, createMockDataSource(30))
      ]);
      
      expect(results[0]).toHaveLength(20);
      expect(results[1]).toHaveLength(30);
    });

    it('should handle large datasets efficiently', async () => {
      const largeRequest: LoadRequest<string> = {
        id: 'large-dataset',
        query: 'large data query',
        totalSize: 1000,
        chunkSize: 50,
        priority: 'high',
        loadStrategy: 'parallel',
        maxParallelChunks: 3
      };
      
      const startTime = Date.now();
      const result = await loader.load(largeRequest, createMockDataSource(1000, 1));
      const endTime = Date.now();
      
      expect(result).toHaveLength(1000);
      
      // Should complete in reasonable time with parallel loading
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(10000); // 10 seconds
    });
  });
});