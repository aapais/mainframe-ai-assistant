/**
 * Cache Performance Benchmarks
 * Comprehensive performance testing of the intelligent search caching layer
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { performance } from 'perf_hooks';
import { LRUCache } from '../../../src/services/cache/LRUCache';
import { RedisCache } from '../../../src/services/cache/RedisCache';
import { PredictiveCache } from '../../../src/services/cache/PredictiveCache';
import { IncrementalLoader } from '../../../src/services/cache/IncrementalLoader';
import { CacheKeyStrategy } from '../../../src/services/cache/CacheKeyStrategy';

// Performance measurement utilities
class PerformanceProfiler {
  private measurements: Array<{
    name: string;
    duration: number;
    timestamp: number;
    metadata?: Record<string, any>;
  }> = [];
  
  async measure<T>(name: string, operation: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - start;
      
      this.measurements.push({
        name,
        duration,
        timestamp: Date.now(),
        metadata
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      
      this.measurements.push({
        name: `${name}-error`,
        duration,
        timestamp: Date.now(),
        metadata: { ...metadata, error: error.message }
      });
      
      throw error;
    }
  }
  
  measureSync<T>(name: string, operation: () => T, metadata?: Record<string, any>): T {
    const start = performance.now();
    
    try {
      const result = operation();
      const duration = performance.now() - start;
      
      this.measurements.push({
        name,
        duration,
        timestamp: Date.now(),
        metadata
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      
      this.measurements.push({
        name: `${name}-error`,
        duration,
        timestamp: Date.now(),
        metadata: { ...metadata, error: error.message }
      });
      
      throw error;
    }
  }
  
  getStats(operationName?: string) {
    const filtered = operationName 
      ? this.measurements.filter(m => m.name === operationName)
      : this.measurements;
    
    if (filtered.length === 0) {
      return null;
    }
    
    const durations = filtered.map(m => m.duration);
    const sorted = [...durations].sort((a, b) => a - b);
    
    return {
      count: filtered.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      throughput: filtered.length / (Math.max(...filtered.map(m => m.timestamp)) - Math.min(...filtered.map(m => m.timestamp))) * 1000
    };
  }
  
  getAllStats() {
    const operationNames = [...new Set(this.measurements.map(m => m.name))];
    const stats: Record<string, any> = {};
    
    operationNames.forEach(name => {
      stats[name] = this.getStats(name);
    });
    
    return stats;
  }
  
  reset() {
    this.measurements = [];
  }
}

// Cache benchmark suite
class CacheBenchmarkSuite {
  private profiler: PerformanceProfiler;
  private l1Cache: LRUCache<any>;
  private l2Cache: RedisCache;
  private predictiveCache: PredictiveCache;
  private loader: IncrementalLoader<any>;
  private keyStrategy: CacheKeyStrategy;
  
  constructor() {
    this.profiler = new PerformanceProfiler();
    
    this.l1Cache = new LRUCache({
      maxSize: 1000,
      defaultTTL: 300000,
      evictionPolicy: 'LRU',
      enableStats: true
    });
    
    this.l2Cache = new RedisCache({
      keyPrefix: 'benchmark:',
      defaultTTL: 900
    });
    
    this.predictiveCache = new PredictiveCache({
      enableMLPredictions: true,
      maxPredictions: 100,
      confidenceThreshold: 0.5
    });
    
    // Create simple chunk cache for loader
    const chunkCache = {
      cache: new Map(),
      get(key: string) { return this.cache.get(key) || null; },
      set(key: string, value: any) { this.cache.set(key, value); },
      delete(key: string) { return this.cache.delete(key); },
      clear() { this.cache.clear(); },
      get size() { return this.cache.size; }
    };
    
    this.loader = new IncrementalLoader(chunkCache, {
      defaultChunkSize: 50,
      maxParallelLoads: 5,
      enableCaching: true
    });
    
    this.keyStrategy = new CacheKeyStrategy();
  }
  
  // LRU Cache benchmarks
  async benchmarkLRUOperations(iterations: number = 10000): Promise<{
    setPerformance: any;
    getPerformance: any;
    deletePerformance: any;
    evictionPerformance: any;
  }> {
    console.log(`Running LRU cache benchmark with ${iterations} iterations...`);
    
    // Benchmark SET operations
    for (let i = 0; i < iterations; i++) {
      await this.profiler.measure('lru-set', async () => {
        this.l1Cache.set(`key-${i}`, `value-${i}`);
      }, { iteration: i });
    }
    
    // Benchmark GET operations
    for (let i = 0; i < iterations; i++) {
      await this.profiler.measure('lru-get', async () => {
        this.l1Cache.get(`key-${i}`);
      }, { iteration: i });
    }
    
    // Benchmark DELETE operations
    for (let i = 0; i < Math.min(iterations, 100); i++) {
      await this.profiler.measure('lru-delete', async () => {
        this.l1Cache.delete(`key-${i}`);
      }, { iteration: i });
    }
    
    // Benchmark eviction performance by filling beyond capacity
    const evictionTestSize = Math.min(this.l1Cache.getStats().size + 500, iterations);
    for (let i = iterations; i < iterations + evictionTestSize; i++) {
      await this.profiler.measure('lru-eviction', async () => {
        this.l1Cache.set(`eviction-key-${i}`, `eviction-value-${i}`);
      }, { iteration: i });
    }
    
    return {
      setPerformance: this.profiler.getStats('lru-set'),
      getPerformance: this.profiler.getStats('lru-get'),
      deletePerformance: this.profiler.getStats('lru-delete'),
      evictionPerformance: this.profiler.getStats('lru-eviction')
    };
  }
  
  // Redis Cache benchmarks
  async benchmarkRedisOperations(iterations: number = 1000): Promise<{
    setPerformance: any;
    getPerformance: any;
    msetPerformance: any;
    mgetPerformance: any;
  }> {
    console.log(`Running Redis cache benchmark with ${iterations} iterations...`);
    
    // Benchmark SET operations
    for (let i = 0; i < iterations; i++) {
      await this.profiler.measure('redis-set', async () => {
        await this.l2Cache.set(`redis-key-${i}`, `redis-value-${i}`);
      }, { iteration: i });
    }
    
    // Benchmark GET operations
    for (let i = 0; i < iterations; i++) {
      await this.profiler.measure('redis-get', async () => {
        await this.l2Cache.get(`redis-key-${i}`);
      }, { iteration: i });
    }
    
    // Benchmark batch operations
    const batchSize = 50;
    const batches = Math.ceil(iterations / batchSize);
    
    for (let batch = 0; batch < batches; batch++) {
      const items = Array.from({ length: batchSize }, (_, i) => ({
        key: `batch-key-${batch}-${i}`,
        value: `batch-value-${batch}-${i}`
      }));
      
      await this.profiler.measure('redis-mset', async () => {
        await this.l2Cache.mset(items);
      }, { batch, batchSize });
      
      const keys = items.map(item => item.key);
      await this.profiler.measure('redis-mget', async () => {
        await this.l2Cache.mget(keys);
      }, { batch, batchSize });
    }
    
    return {
      setPerformance: this.profiler.getStats('redis-set'),
      getPerformance: this.profiler.getStats('redis-get'),
      msetPerformance: this.profiler.getStats('redis-mset'),
      mgetPerformance: this.profiler.getStats('redis-mget')
    };
  }
  
  // Predictive Cache benchmarks
  async benchmarkPredictiveCache(iterations: number = 500): Promise<{
    recordEventPerformance: any;
    getPredictionsPerformance: any;
    trainModelsPerformance: any;
  }> {
    console.log(`Running Predictive cache benchmark with ${iterations} iterations...`);
    
    const sessionId = 'benchmark-session';
    const userId = 'benchmark-user';
    
    // Benchmark event recording
    for (let i = 0; i < iterations; i++) {
      await this.profiler.measure('predictive-record', async () => {
        this.predictiveCache.recordSearchEvent(sessionId, {
          query: `benchmark query ${i}`,
          timestamp: Date.now(),
          category: `Category${i % 5}`,
          resultClicks: Math.floor(Math.random() * 5),
          sessionDuration: Math.floor(Math.random() * 10000),
          followupQueries: [`followup ${i}`]
        }, userId);
      }, { iteration: i });
    }
    
    // Benchmark prediction generation
    for (let i = 0; i < Math.min(iterations, 100); i++) {
      await this.profiler.measure('predictive-predict', async () => {
        await this.predictiveCache.getPredictions(sessionId, userId);
      }, { iteration: i });
    }
    
    // Generate training data
    for (let i = 0; i < 200; i++) {
      if (i % 2 === 0) {
        this.predictiveCache.markPredictionSuccess(`training-key-${i}`);
      } else {
        this.predictiveCache.markPredictionFailure(`training-key-${i}`);
      }
    }
    
    // Benchmark model training
    await this.profiler.measure('predictive-train', async () => {
      await this.predictiveCache.trainModels();
    });
    
    return {
      recordEventPerformance: this.profiler.getStats('predictive-record'),
      getPredictionsPerformance: this.profiler.getStats('predictive-predict'),
      trainModelsPerformance: this.profiler.getStats('predictive-train')
    };
  }
  
  // Incremental Loader benchmarks
  async benchmarkIncrementalLoader(dataSize: number = 1000): Promise<{
    sequentialPerformance: any;
    parallelPerformance: any;
    cachedPerformance: any;
  }> {
    console.log(`Running Incremental loader benchmark with ${dataSize} items...`);
    
    // Mock data source
    const dataSource = async (offset: number, limit: number) => {
      await new Promise(resolve => setTimeout(resolve, 1)); // Simulate latency
      return Array.from({ length: limit }, (_, i) => `item-${offset + i}`);
    };
    
    // Benchmark sequential loading
    await this.profiler.measure('loader-sequential', async () => {
      await this.loader.load({
        id: 'sequential-test',
        query: 'sequential benchmark',
        totalSize: dataSize,
        chunkSize: 100,
        priority: 'medium',
        loadStrategy: 'sequential',
        maxParallelChunks: 1
      }, dataSource);
    });
    
    // Benchmark parallel loading
    await this.profiler.measure('loader-parallel', async () => {
      await this.loader.load({
        id: 'parallel-test',
        query: 'parallel benchmark',
        totalSize: dataSize,
        chunkSize: 100,
        priority: 'high',
        loadStrategy: 'parallel',
        maxParallelChunks: 5
      }, dataSource);
    });
    
    // Benchmark cached loading (should be faster)
    await this.profiler.measure('loader-cached', async () => {
      await this.loader.load({
        id: 'parallel-test', // Same ID as previous
        query: 'parallel benchmark',
        totalSize: dataSize,
        chunkSize: 100,
        priority: 'high',
        loadStrategy: 'parallel',
        maxParallelChunks: 5
      }, dataSource);
    });
    
    return {
      sequentialPerformance: this.profiler.getStats('loader-sequential'),
      parallelPerformance: this.profiler.getStats('loader-parallel'),
      cachedPerformance: this.profiler.getStats('loader-cached')
    };
  }
  
  // Key Strategy benchmarks
  async benchmarkKeyStrategy(iterations: number = 10000): Promise<{
    generateKeyPerformance: any;
    parseKeyPerformance: any;
    invalidationPerformance: any;
  }> {
    console.log(`Running Key strategy benchmark with ${iterations} iterations...`);
    
    const generatedKeys: string[] = [];
    
    // Benchmark key generation
    for (let i = 0; i < iterations; i++) {
      const key = this.profiler.measureSync('key-generate', () => {
        return this.keyStrategy.generateSearchKey(
          `benchmark query ${i}`,
          { limit: 10, category: `Category${i % 5}` },
          `user${i % 100}`
        );
      }, { iteration: i });
      
      generatedKeys.push(key);
    }
    
    // Benchmark key parsing
    for (let i = 0; i < Math.min(iterations, 1000); i++) {
      this.profiler.measureSync('key-parse', () => {
        this.keyStrategy.parseKey(generatedKeys[i]);
      }, { iteration: i });
    }
    
    // Benchmark invalidation
    await this.profiler.measure('key-invalidation', async () => {
      await this.keyStrategy.invalidate(['*benchmark*']);
    });
    
    return {
      generateKeyPerformance: this.profiler.getStats('key-generate'),
      parseKeyPerformance: this.profiler.getStats('key-parse'),
      invalidationPerformance: this.profiler.getStats('key-invalidation')
    };
  }
  
  // Integrated cache system benchmark
  async benchmarkIntegratedSystem(iterations: number = 1000): Promise<{
    coldCachePerformance: any;
    warmCachePerformance: any;
    mixedWorkloadPerformance: any;
  }> {
    console.log(`Running integrated system benchmark with ${iterations} iterations...`);
    
    const queries = [
      'system error analysis',
      'performance optimization',
      'database configuration',
      'network troubleshooting',
      'security audit'
    ];
    
    // Benchmark cold cache (first access)
    for (let i = 0; i < iterations; i++) {
      const query = `${queries[i % queries.length]} ${i}`;
      
      await this.profiler.measure('integrated-cold', async () => {
        // Simulate integrated cache lookup
        const key = this.keyStrategy.generateSearchKey(query, { limit: 10 });
        
        // L1 miss
        let result = this.l1Cache.get(key);
        if (!result) {
          // L2 miss
          result = await this.l2Cache.get(key);
          if (!result) {
            // Generate mock result
            result = Array.from({ length: 10 }, (_, j) => `result-${i}-${j}`);
            
            // Cache in both layers
            this.l1Cache.set(key, result);
            await this.l2Cache.set(key, result);
          } else {
            // Promote to L1
            this.l1Cache.set(key, result);
          }
        }
        
        return result;
      }, { iteration: i, query });
    }
    
    // Benchmark warm cache (repeat queries)
    for (let i = 0; i < iterations; i++) {
      const query = `${queries[i % queries.length]} ${i % 100}`; // More repetition
      
      await this.profiler.measure('integrated-warm', async () => {
        const key = this.keyStrategy.generateSearchKey(query, { limit: 10 });
        
        let result = this.l1Cache.get(key);
        if (!result) {
          result = await this.l2Cache.get(key);
          if (!result) {
            result = Array.from({ length: 10 }, (_, j) => `result-${i}-${j}`);
            this.l1Cache.set(key, result);
            await this.l2Cache.set(key, result);
          } else {
            this.l1Cache.set(key, result);
          }
        }
        
        return result;
      }, { iteration: i, query });
    }
    
    // Benchmark mixed workload (reads, writes, invalidations)
    for (let i = 0; i < iterations; i++) {
      await this.profiler.measure('integrated-mixed', async () => {
        const operation = i % 10;
        
        if (operation < 7) {
          // 70% reads
          const query = `${queries[i % queries.length]} ${i % 50}`;
          const key = this.keyStrategy.generateSearchKey(query, { limit: 10 });
          
          let result = this.l1Cache.get(key);
          if (!result) {
            result = await this.l2Cache.get(key);
            if (!result) {
              result = Array.from({ length: 10 }, (_, j) => `result-${i}-${j}`);
              this.l1Cache.set(key, result);
              await this.l2Cache.set(key, result);
            }
          }
        } else if (operation < 9) {
          // 20% writes
          const query = `new query ${i}`;
          const key = this.keyStrategy.generateSearchKey(query, { limit: 10 });
          const result = Array.from({ length: 10 }, (_, j) => `new-result-${i}-${j}`);
          
          this.l1Cache.set(key, result);
          await this.l2Cache.set(key, result);
        } else {
          // 10% invalidations
          await this.keyStrategy.invalidate([`*query*${i % 100}*`]);
        }
      }, { iteration: i, operation });
    }
    
    return {
      coldCachePerformance: this.profiler.getStats('integrated-cold'),
      warmCachePerformance: this.profiler.getStats('integrated-warm'),
      mixedWorkloadPerformance: this.profiler.getStats('integrated-mixed')
    };
  }
  
  // Memory usage benchmark
  async benchmarkMemoryUsage(): Promise<{
    initialMemory: number;
    afterL1Cache: number;
    afterL2Cache: number;
    afterPredictive: number;
    finalMemory: number;
  }> {
    console.log('Running memory usage benchmark...');
    
    // Note: In Node.js, we can't get exact memory usage of specific objects
    // This is a simplified representation
    
    const getMemoryUsage = () => {
      const used = process.memoryUsage();
      return used.heapUsed / 1024 / 1024; // MB
    };
    
    const initialMemory = getMemoryUsage();
    
    // Fill L1 cache
    for (let i = 0; i < 1000; i++) {
      this.l1Cache.set(`mem-test-l1-${i}`, { data: `large-value-${i}`.repeat(100) });
    }
    
    const afterL1Cache = getMemoryUsage();
    
    // Fill L2 cache
    for (let i = 0; i < 500; i++) {
      await this.l2Cache.set(`mem-test-l2-${i}`, { data: `large-value-${i}`.repeat(200) });
    }
    
    const afterL2Cache = getMemoryUsage();
    
    // Generate predictive cache data
    for (let i = 0; i < 200; i++) {
      this.predictiveCache.recordSearchEvent('mem-session', {
        query: `memory test query ${i}`,
        timestamp: Date.now(),
        resultClicks: 1,
        sessionDuration: 1000,
        followupQueries: []
      });
    }
    
    const afterPredictive = getMemoryUsage();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = getMemoryUsage();
    
    return {
      initialMemory,
      afterL1Cache,
      afterL2Cache,
      afterPredictive,
      finalMemory
    };
  }
  
  // Concurrent operations benchmark
  async benchmarkConcurrency(concurrency: number = 50): Promise<{
    concurrentReads: any;
    concurrentWrites: any;
    concurrentMixed: any;
  }> {
    console.log(`Running concurrency benchmark with ${concurrency} concurrent operations...`);
    
    // Benchmark concurrent reads
    const readPromises = Array.from({ length: concurrency }, async (_, i) => {
      return this.profiler.measure('concurrent-read', async () => {
        const key = this.keyStrategy.generateSearchKey(`concurrent read ${i % 10}`, { limit: 10 });
        
        let result = this.l1Cache.get(key);
        if (!result) {
          result = await this.l2Cache.get(key);
          if (!result) {
            result = Array.from({ length: 10 }, (_, j) => `concurrent-result-${i}-${j}`);
            this.l1Cache.set(key, result);
            await this.l2Cache.set(key, result);
          }
        }
        
        return result;
      }, { thread: i });
    });
    
    await Promise.all(readPromises);
    
    // Benchmark concurrent writes
    const writePromises = Array.from({ length: concurrency }, async (_, i) => {
      return this.profiler.measure('concurrent-write', async () => {
        const key = this.keyStrategy.generateSearchKey(`concurrent write ${i}`, { limit: 10 });
        const result = Array.from({ length: 10 }, (_, j) => `write-result-${i}-${j}`);
        
        this.l1Cache.set(key, result);
        await this.l2Cache.set(key, result);
        
        return result;
      }, { thread: i });
    });
    
    await Promise.all(writePromises);
    
    // Benchmark mixed concurrent operations
    const mixedPromises = Array.from({ length: concurrency }, async (_, i) => {
      return this.profiler.measure('concurrent-mixed', async () => {
        if (i % 3 === 0) {
          // Read operation
          const key = this.keyStrategy.generateSearchKey(`mixed read ${i % 20}`, { limit: 10 });
          return this.l1Cache.get(key) || await this.l2Cache.get(key);
        } else if (i % 3 === 1) {
          // Write operation
          const key = this.keyStrategy.generateSearchKey(`mixed write ${i}`, { limit: 10 });
          const result = Array.from({ length: 10 }, (_, j) => `mixed-result-${i}-${j}`);
          this.l1Cache.set(key, result);
          await this.l2Cache.set(key, result);
          return result;
        } else {
          // Invalidation operation
          await this.keyStrategy.invalidate([`*mixed*${i % 10}*`]);
          return null;
        }
      }, { thread: i, operation: i % 3 });
    });
    
    await Promise.all(mixedPromises);
    
    return {
      concurrentReads: this.profiler.getStats('concurrent-read'),
      concurrentWrites: this.profiler.getStats('concurrent-write'),
      concurrentMixed: this.profiler.getStats('concurrent-mixed')
    };
  }
  
  getProfiler() {
    return this.profiler;
  }
  
  async cleanup() {
    this.l1Cache.destroy();
    await this.l2Cache.close();
    this.predictiveCache.reset();
    this.profiler.reset();
  }
}

// Performance validation
function validatePerformanceRequirements(stats: any, requirements: {
  maxAvgResponseTime?: number;
  minThroughput?: number;
  maxP95ResponseTime?: number;
}) {
  const issues: string[] = [];
  
  if (requirements.maxAvgResponseTime && stats.avg > requirements.maxAvgResponseTime) {
    issues.push(`Average response time ${stats.avg.toFixed(2)}ms exceeds requirement ${requirements.maxAvgResponseTime}ms`);
  }
  
  if (requirements.minThroughput && stats.throughput < requirements.minThroughput) {
    issues.push(`Throughput ${stats.throughput.toFixed(2)} ops/sec below requirement ${requirements.minThroughput} ops/sec`);
  }
  
  if (requirements.maxP95ResponseTime && stats.p95 > requirements.maxP95ResponseTime) {
    issues.push(`P95 response time ${stats.p95.toFixed(2)}ms exceeds requirement ${requirements.maxP95ResponseTime}ms`);
  }
  
  return {
    passed: issues.length === 0,
    issues
  };
}

describe('Cache Performance Benchmarks', () => {
  let benchmarkSuite: CacheBenchmarkSuite;
  
  // Increase timeout for performance tests
  jest.setTimeout(300000); // 5 minutes

  beforeEach(() => {
    benchmarkSuite = new CacheBenchmarkSuite();
  });

  afterEach(async () => {
    await benchmarkSuite.cleanup();
  });

  describe('LRU Cache Performance', () => {
    it('should meet LRU cache performance requirements', async () => {
      const results = await benchmarkSuite.benchmarkLRUOperations(5000);
      
      console.log('LRU Cache Benchmark Results:', {
        setStats: results.setPerformance,
        getStats: results.getPerformance,
        deleteStats: results.deletePerformance,
        evictionStats: results.evictionPerformance
      });
      
      // Validate requirements
      const setValidation = validatePerformanceRequirements(results.setPerformance, {
        maxAvgResponseTime: 1, // 1ms average
        minThroughput: 1000 // 1000 ops/sec
      });
      
      const getValidation = validatePerformanceRequirements(results.getPerformance, {
        maxAvgResponseTime: 0.5, // 0.5ms average
        minThroughput: 2000 // 2000 ops/sec
      });
      
      expect(setValidation.passed).toBe(true);
      expect(getValidation.passed).toBe(true);
      
      // Set operations should be fast
      expect(results.setPerformance.avg).toBeLessThan(10);
      
      // Get operations should be faster than set
      expect(results.getPerformance.avg).toBeLessThan(results.setPerformance.avg);
      
      // Eviction should not significantly impact performance
      expect(results.evictionPerformance.avg).toBeLessThan(results.setPerformance.avg * 2);
    });
  });

  describe('Redis Cache Performance', () => {
    it('should meet Redis cache performance requirements', async () => {
      const results = await benchmarkSuite.benchmarkRedisOperations(500);
      
      console.log('Redis Cache Benchmark Results:', {
        setStats: results.setPerformance,
        getStats: results.getPerformance,
        msetStats: results.msetPerformance,
        mgetStats: results.mgetPerformance
      });
      
      // Redis operations are naturally slower due to mock implementation
      const setValidation = validatePerformanceRequirements(results.setPerformance, {
        maxAvgResponseTime: 100, // 100ms average for mock
        minThroughput: 10 // 10 ops/sec for mock
      });
      
      expect(setValidation.passed).toBe(true);
      
      // Batch operations should be more efficient per item
      const avgMsetTimePerItem = results.msetPerformance.avg / 50; // 50 items per batch
      expect(avgMsetTimePerItem).toBeLessThan(results.setPerformance.avg);
    });
  });

  describe('Predictive Cache Performance', () => {
    it('should meet predictive cache performance requirements', async () => {
      const results = await benchmarkSuite.benchmarkPredictiveCache(200);
      
      console.log('Predictive Cache Benchmark Results:', {
        recordStats: results.recordEventPerformance,
        predictStats: results.getPredictionsPerformance,
        trainStats: results.trainModelsPerformance
      });
      
      // Event recording should be fast
      expect(results.recordEventPerformance.avg).toBeLessThan(10);
      
      // Prediction generation should be reasonable
      expect(results.getPredictionsPerformance.avg).toBeLessThan(100);
      
      // Model training should complete in reasonable time
      expect(results.trainModelsPerformance.avg).toBeLessThan(5000);
    });
  });

  describe('Incremental Loader Performance', () => {
    it('should meet incremental loader performance requirements', async () => {
      const results = await benchmarkSuite.benchmarkIncrementalLoader(500);
      
      console.log('Incremental Loader Benchmark Results:', {
        sequentialStats: results.sequentialPerformance,
        parallelStats: results.parallelPerformance,
        cachedStats: results.cachedPerformance
      });
      
      // Parallel loading should be faster than sequential
      expect(results.parallelPerformance.avg).toBeLessThan(results.sequentialPerformance.avg);
      
      // Cached loading should be significantly faster
      expect(results.cachedPerformance.avg).toBeLessThan(results.parallelPerformance.avg * 0.5);
      
      // All loading strategies should complete in reasonable time
      expect(results.sequentialPerformance.avg).toBeLessThan(10000);
      expect(results.parallelPerformance.avg).toBeLessThan(5000);
      expect(results.cachedPerformance.avg).toBeLessThan(1000);
    });
  });

  describe('Key Strategy Performance', () => {
    it('should meet key strategy performance requirements', async () => {
      const results = await benchmarkSuite.benchmarkKeyStrategy(5000);
      
      console.log('Key Strategy Benchmark Results:', {
        generateStats: results.generateKeyPerformance,
        parseStats: results.parseKeyPerformance,
        invalidationStats: results.invalidationPerformance
      });
      
      // Key generation should be very fast
      expect(results.generateKeyPerformance.avg).toBeLessThan(1);
      
      // Key parsing should be fast
      expect(results.parseKeyPerformance.avg).toBeLessThan(2);
      
      // Invalidation should complete quickly
      expect(results.invalidationPerformance.avg).toBeLessThan(100);
    });
  });

  describe('Integrated System Performance', () => {
    it('should meet integrated system performance requirements', async () => {
      const results = await benchmarkSuite.benchmarkIntegratedSystem(1000);
      
      console.log('Integrated System Benchmark Results:', {
        coldStats: results.coldCachePerformance,
        warmStats: results.warmCachePerformance,
        mixedStats: results.mixedWorkloadPerformance
      });
      
      // Warm cache should be significantly faster than cold cache
      expect(results.warmCachePerformance.avg).toBeLessThan(results.coldCachePerformance.avg * 0.3);
      
      // Cache hit should be under 1ms
      expect(results.warmCachePerformance.avg).toBeLessThan(1);
      
      // Cold cache should still be reasonable
      expect(results.coldCachePerformance.avg).toBeLessThan(100);
      
      // Mixed workload should handle various operations efficiently
      expect(results.mixedWorkloadPerformance.avg).toBeLessThan(50);
    });
  });

  describe('Memory Usage', () => {
    it('should monitor memory usage patterns', async () => {
      const results = await benchmarkSuite.benchmarkMemoryUsage();
      
      console.log('Memory Usage Benchmark Results:', results);
      
      // Memory usage should increase with cache usage
      expect(results.afterL1Cache).toBeGreaterThan(results.initialMemory);
      expect(results.afterL2Cache).toBeGreaterThan(results.afterL1Cache);
      
      // Memory usage should be reasonable (not excessive)
      const totalIncrease = results.finalMemory - results.initialMemory;
      expect(totalIncrease).toBeLessThan(500); // Less than 500MB increase
    });
  });

  describe('Concurrency Performance', () => {
    it('should handle concurrent operations efficiently', async () => {
      const results = await benchmarkSuite.benchmarkConcurrency(20);
      
      console.log('Concurrency Benchmark Results:', {
        readStats: results.concurrentReads,
        writeStats: results.concurrentWrites,
        mixedStats: results.concurrentMixed
      });
      
      // Concurrent operations should not degrade significantly
      expect(results.concurrentReads.avg).toBeLessThan(100);
      expect(results.concurrentWrites.avg).toBeLessThan(200);
      expect(results.concurrentMixed.avg).toBeLessThan(150);
      
      // Should maintain reasonable throughput under concurrency
      expect(results.concurrentReads.throughput).toBeGreaterThan(1);
      expect(results.concurrentWrites.throughput).toBeGreaterThan(1);
    });
  });

  describe('End-to-End Performance', () => {
    it('should demonstrate overall system performance improvement', async () => {
      const profiler = benchmarkSuite.getProfiler();
      
      // Simulate realistic usage pattern
      const queries = [
        'system error troubleshooting',
        'database performance optimization',
        'network connectivity issues',
        'security audit procedures',
        'configuration management'
      ];
      
      // Cold system (no cache)
      for (let i = 0; i < 100; i++) {
        const query = `${queries[i % queries.length]} scenario ${i}`;
        
        await profiler.measure('e2e-cold', async () => {
          // Simulate full search without cache
          await new Promise(resolve => setTimeout(resolve, 10)); // Simulate search time
          return Array.from({ length: 10 }, (_, j) => `result-${i}-${j}`);
        });
      }
      
      // Warm system (with cache)
      for (let i = 0; i < 100; i++) {
        const query = `${queries[i % queries.length]} scenario ${i % 20}`; // More repetition
        
        await profiler.measure('e2e-warm', async () => {
          const key = benchmarkSuite['keyStrategy'].generateSearchKey(query, { limit: 10 });
          
          // Check cache first
          let result = benchmarkSuite['l1Cache'].get(key);
          if (result) {
            return result; // Cache hit - very fast
          }
          
          // Simulate search and cache
          await new Promise(resolve => setTimeout(resolve, 10));
          result = Array.from({ length: 10 }, (_, j) => `cached-result-${i}-${j}`);
          benchmarkSuite['l1Cache'].set(key, result);
          
          return result;
        });
      }
      
      const coldStats = profiler.getStats('e2e-cold');
      const warmStats = profiler.getStats('e2e-warm');
      
      console.log('End-to-End Performance:', {
        coldSystem: coldStats,
        warmSystem: warmStats,
        improvement: `${((coldStats.avg - warmStats.avg) / coldStats.avg * 100).toFixed(1)}%`
      });
      
      // Cache should provide significant improvement
      expect(warmStats.avg).toBeLessThan(coldStats.avg * 0.5); // At least 50% improvement
      
      // Overall performance should meet requirements
      expect(warmStats.avg).toBeLessThan(5); // Under 5ms with cache
      expect(coldStats.avg).toBeLessThan(20); // Under 20ms without cache
    });
  });
});