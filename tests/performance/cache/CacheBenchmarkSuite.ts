/**
 * Comprehensive Cache Benchmark Suite
 * Performance testing and optimization analysis
 */

import { performance } from 'perf_hooks';
import { LRUCache } from '../../../src/services/cache/LRUCache';
import { SearchCache } from '../../../src/services/search/SearchCache';
import { CacheService } from '../../../src/services/CacheService';
import { MultiLayerCacheManager } from '../../../src/caching/MultiLayerCacheManager';

interface BenchmarkResult {
  name: string;
  operations: number;
  duration: number;
  opsPerSecond: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  memoryUsage: number;
  cacheHitRate?: number;
  throughput?: number;
}

interface BenchmarkConfig {
  warmupIterations: number;
  testIterations: number;
  dataSizes: number[];
  concurrencyLevels: number[];
  cacheConfigs: any[];
}

class CacheBenchmarkSuite {
  private config: BenchmarkConfig;
  private results: BenchmarkResult[] = [];
  private latencies: Map<string, number[]> = new Map();

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = {
      warmupIterations: 1000,
      testIterations: 10000,
      dataSizes: [100, 1000, 10000, 100000],
      concurrencyLevels: [1, 10, 50, 100],
      cacheConfigs: [
        { maxSize: 1000, evictionPolicy: 'LRU' },
        { maxSize: 1000, evictionPolicy: 'LFU' },
        { maxSize: 1000, evictionPolicy: 'ADAPTIVE' },
        { maxSize: 5000, evictionPolicy: 'ADAPTIVE' },
        { maxSize: 10000, evictionPolicy: 'ADAPTIVE' }
      ],
      ...config
    };
  }

  async runAllBenchmarks(): Promise<BenchmarkResult[]> {
    console.log('🚀 Starting Comprehensive Cache Benchmark Suite');
    console.log('=''.repeat(60));

    await this.benchmarkBasicOperations();
    await this.benchmarkEvictionPolicies();
    await this.benchmarkConcurrency();
    await this.benchmarkMemoryEfficiency();
    await this.benchmarkRealWorldScenarios();
    await this.benchmarkMultiLayerCache();
    await this.benchmarkSearchCache();

    this.generateReport();
    return this.results;
  }

  private async benchmarkBasicOperations(): Promise<void> {
    console.log('\n📊 Benchmarking Basic Operations');
    console.log('-'.repeat(40));

    const cache = new LRUCache<string>({
      maxSize: 10000,
      evictionPolicy: 'LRU',
      enableStats: true
    });

    // Benchmark SET operations
    await this.runBenchmark('SET Operations', async () => {
      const key = `key_${Math.floor(Math.random() * 10000)}`;
      const value = `value_${Math.random().toString(36)}`;
      cache.set(key, value);
    }, this.config.testIterations);

    // Benchmark GET operations (populate cache first)
    for (let i = 0; i < 5000; i++) {
      cache.set(`get_key_${i}`, `value_${i}`);
    }

    await this.runBenchmark('GET Operations (Cache Hit)', async () => {
      const key = `get_key_${Math.floor(Math.random() * 5000)}`;
      cache.get(key);
    }, this.config.testIterations);

    await this.runBenchmark('GET Operations (Cache Miss)', async () => {
      const key = `miss_key_${Math.random()}`;
      cache.get(key);
    }, this.config.testIterations);

    // Benchmark DELETE operations
    await this.runBenchmark('DELETE Operations', async () => {
      const key = `get_key_${Math.floor(Math.random() * 5000)}`;
      cache.delete(key);
    }, this.config.testIterations / 10);

    // Benchmark HAS operations
    await this.runBenchmark('HAS Operations', async () => {
      const key = `get_key_${Math.floor(Math.random() * 5000)}`;
      cache.has(key);
    }, this.config.testIterations);

    cache.destroy();
  }

  private async benchmarkEvictionPolicies(): Promise<void> {
    console.log('\n🔄 Benchmarking Eviction Policies');
    console.log('-'.repeat(40));

    for (const config of this.config.cacheConfigs) {
      const cache = new LRUCache<string>({
        ...config,
        enableStats: true
      });

      const policyName = `${config.evictionPolicy}_${config.maxSize}`;
      
      // Fill cache beyond capacity to trigger evictions
      const operations = config.maxSize * 2;
      
      await this.runBenchmark(`Eviction Stress Test - ${policyName}`, async () => {
        const key = `evict_key_${Math.floor(Math.random() * operations)}`;
        const value = `value_${Math.random().toString(36).substring(2, 15)}`;
        cache.set(key, value);
      }, operations);

      const stats = cache.getStats();
      this.results[this.results.length - 1].cacheHitRate = stats.hitRate;

      cache.destroy();
    }
  }

  private async benchmarkConcurrency(): Promise<void> {
    console.log('\n⚡ Benchmarking Concurrency');
    console.log('-'.repeat(40));

    for (const concurrency of this.config.concurrencyLevels) {
      const cache = new LRUCache<string>({
        maxSize: 10000,
        evictionPolicy: 'ADAPTIVE',
        enableStats: true
      });

      // Pre-populate cache
      for (let i = 0; i < 5000; i++) {
        cache.set(`concurrent_key_${i}`, `value_${i}`);
      }

      await this.runConcurrentBenchmark(
        `Concurrent Operations (${concurrency} threads)`,
        async () => {
          const operation = Math.random();
          const keyId = Math.floor(Math.random() * 10000);
          
          if (operation < 0.7) {
            // 70% reads
            cache.get(`concurrent_key_${keyId}`);
          } else if (operation < 0.95) {
            // 25% writes
            cache.set(`concurrent_key_${keyId}`, `new_value_${Math.random()}`);
          } else {
            // 5% deletes
            cache.delete(`concurrent_key_${keyId}`);
          }
        },
        concurrency,
        this.config.testIterations / concurrency
      );

      cache.destroy();
    }
  }

  private async benchmarkMemoryEfficiency(): Promise<void> {
    console.log('\n💾 Benchmarking Memory Efficiency');
    console.log('-'.repeat(40));

    for (const dataSize of this.config.dataSizes) {
      const cache = new LRUCache<string>({
        maxSize: Math.min(dataSize, 10000),
        maxMemoryMB: 50,
        evictionPolicy: 'ADAPTIVE',
        enableStats: true
      });

      const valueSize = Math.max(100, Math.floor(1000000 / dataSize)); // Adjust value size
      const testValue = 'x'.repeat(valueSize);

      await this.runBenchmark(`Memory Test - ${dataSize} entries`, async () => {
        const key = `mem_key_${Math.floor(Math.random() * dataSize)}`;
        cache.set(key, testValue);
      }, dataSize);

      const stats = cache.getStats();
      this.results[this.results.length - 1].memoryUsage = stats.memoryUsage;

      cache.destroy();
    }
  }

  private async benchmarkRealWorldScenarios(): Promise<void> {
    console.log('\n🌍 Benchmarking Real-World Scenarios');
    console.log('-'.repeat(40));

    // Scenario 1: Web application cache (80/20 read/write)
    await this.runWebAppScenario();
    
    // Scenario 2: Database query cache (95/5 read/write)
    await this.runDatabaseCacheScenario();
    
    // Scenario 3: Session cache (frequent updates)
    await this.runSessionCacheScenario();
    
    // Scenario 4: Content cache (high hit rate)
    await this.runContentCacheScenario();
  }

  private async runWebAppScenario(): Promise<void> {
    const cache = new LRUCache<any>({
      maxSize: 5000,
      defaultTTL: 300000, // 5 minutes
      evictionPolicy: 'ADAPTIVE',
      enableStats: true
    });

    // Simulate web app data
    const users = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      profile: { preferences: {}, settings: {} }
    }));

    // Pre-populate with popular data
    for (let i = 0; i < 200; i++) {
      cache.set(`user:${i}`, users[i]);
      cache.set(`profile:${i}`, users[i].profile);
    }

    await this.runBenchmark('Web App Scenario (80/20 R/W)', async () => {
      const userId = Math.floor(Math.random() * 1000);
      
      if (Math.random() < 0.8) {
        // 80% reads
        cache.get(`user:${userId}`);
      } else {
        // 20% writes
        cache.set(`user:${userId}`, users[userId]);
      }
    }, 10000);

    const stats = cache.getStats();
    this.results[this.results.length - 1].cacheHitRate = stats.hitRate;

    cache.destroy();
  }

  private async runDatabaseCacheScenario(): Promise<void> {
    const cache = new LRUCache<any>({
      maxSize: 2000,
      defaultTTL: 600000, // 10 minutes
      evictionPolicy: 'LFU', // Favor frequently used queries
      enableStats: true
    });

    // Simulate database query results
    const queries = Array.from({ length: 500 }, (_, i) => ({
      sql: `SELECT * FROM table WHERE id = ${i}`,
      result: Array.from({ length: 10 }, (_, j) => ({ id: j, data: `data_${i}_${j}` }))
    }));

    // Pre-populate with common queries
    for (let i = 0; i < 100; i++) {
      cache.set(`query:${queries[i].sql}`, queries[i].result);
    }

    await this.runBenchmark('Database Cache Scenario (95/5 R/W)', async () => {
      const queryId = Math.floor(Math.random() * 500);
      const query = queries[queryId];
      
      if (Math.random() < 0.95) {
        // 95% reads
        cache.get(`query:${query.sql}`);
      } else {
        // 5% writes (cache updates)
        cache.set(`query:${query.sql}`, query.result);
      }
    }, 20000);

    const stats = cache.getStats();
    this.results[this.results.length - 1].cacheHitRate = stats.hitRate;

    cache.destroy();
  }

  private async runSessionCacheScenario(): Promise<void> {
    const cache = new LRUCache<any>({
      maxSize: 10000,
      defaultTTL: 1800000, // 30 minutes
      evictionPolicy: 'LRU', // Recent sessions more important
      enableStats: true
    });

    await this.runBenchmark('Session Cache Scenario (Frequent Updates)', async () => {
      const sessionId = `session_${Math.floor(Math.random() * 5000)}`;
      
      if (Math.random() < 0.6) {
        // 60% reads
        cache.get(sessionId);
      } else {
        // 40% writes (session updates)
        const sessionData = {
          userId: Math.floor(Math.random() * 1000),
          lastActivity: Date.now(),
          data: { cart: [], preferences: {} }
        };
        cache.set(sessionId, sessionData);
      }
    }, 15000);

    const stats = cache.getStats();
    this.results[this.results.length - 1].cacheHitRate = stats.hitRate;

    cache.destroy();
  }

  private async runContentCacheScenario(): Promise<void> {
    const cache = new LRUCache<string>({
      maxSize: 1000,
      defaultTTL: 3600000, // 1 hour
      evictionPolicy: 'LFU', // Popular content stays longer
      enableStats: true
    });

    // Simulate content with popularity distribution (Pareto principle)
    const content = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      content: `Content ${i}: ${'x'.repeat(1000 + Math.random() * 5000)}`,
      popularity: Math.random() < 0.2 ? Math.random() * 0.8 + 0.2 : Math.random() * 0.2
    }));

    // Pre-populate with popular content
    for (let i = 0; i < 200; i++) {
      cache.set(`content:${i}`, content[i].content);
    }

    await this.runBenchmark('Content Cache Scenario (High Hit Rate)', async () => {
      // Weighted selection based on popularity
      let contentId;
      if (Math.random() < 0.8) {
        // 80% requests go to 20% of content (popular items)
        contentId = Math.floor(Math.random() * 200);
      } else {
        // 20% requests go to 80% of content
        contentId = 200 + Math.floor(Math.random() * 800);
      }
      
      cache.get(`content:${contentId}`);
    }, 10000);

    const stats = cache.getStats();
    this.results[this.results.length - 1].cacheHitRate = stats.hitRate;

    cache.destroy();
  }

  private async benchmarkMultiLayerCache(): Promise<void> {
    console.log('\n🏗️ Benchmarking Multi-Layer Cache');
    console.log('-'.repeat(40));

    const multiCache = new MultiLayerCacheManager({
      l1: { maxSize: 1000, ttl: 60000, strategy: 'lfu' },
      l2: { maxSize: 5000, ttl: 300000, strategy: 'lru' },
      l3: { maxSize: 10000, ttl: 900000, strategy: 'adaptive' },
      monitoring: { enabled: true, metricsInterval: 5000 }
    });

    await multiCache.initialize();

    // Test multi-layer efficiency
    await this.runBenchmark('Multi-Layer Cache Operations', async () => {
      const key = `ml_key_${Math.floor(Math.random() * 5000)}`;
      
      if (Math.random() < 0.7) {
        // 70% reads
        await multiCache.get(key);
      } else {
        // 30% writes
        const value = { data: `value_${Math.random()}`, timestamp: Date.now() };
        await multiCache.set(key, value, 300000);
      }
    }, 5000);

    const metrics = await multiCache.getMetrics();
    this.results[this.results.length - 1].cacheHitRate = metrics.overall.hitRate;

    await multiCache.shutdown();
  }

  private async benchmarkSearchCache(): Promise<void> {
    console.log('\n🔍 Benchmarking Search Cache');
    console.log('-'.repeat(40));

    const searchCache = new SearchCache({
      maxSize: 100 * 1024 * 1024, // 100MB
      defaultTTL: 300000,
      strategy: 'adaptive',
      layers: [
        { name: 'l1', maxSize: 1000, ttl: 60000, strategy: 'lfu', enabled: true },
        { name: 'l2', maxSize: 5000, ttl: 300000, strategy: 'lru', enabled: true }
      ],
      compression: { enabled: true, threshold: 1024, algorithm: 'gzip' },
      warming: { enabled: true, strategies: ['popular_queries'], schedule: '0 * * * *' }
    });

    // Simulate search queries and results
    const queries = Array.from({ length: 1000 }, (_, i) => `query ${i}`);
    const results = queries.map(query => ({
      query,
      results: Array.from({ length: 10 }, (_, j) => ({
        id: `result_${j}`,
        title: `Result ${j} for ${query}`,
        content: 'x'.repeat(500 + Math.random() * 1000)
      }))
    }));

    // Pre-populate with some results
    for (let i = 0; i < 200; i++) {
      const cacheKey = searchCache.generateQueryCacheKey(queries[i], { limit: 10 });
      await searchCache.set(cacheKey, results[i]);
    }

    await this.runBenchmark('Search Cache Operations', async () => {
      const queryId = Math.floor(Math.random() * 1000);
      const query = queries[queryId];
      const cacheKey = searchCache.generateQueryCacheKey(query, { limit: 10 });
      
      if (Math.random() < 0.8) {
        // 80% reads (searches)
        await searchCache.get(cacheKey);
      } else {
        // 20% writes (new search results)
        await searchCache.set(cacheKey, results[queryId]);
      }
    }, 5000);

    const stats = searchCache.getStats();
    this.results[this.results.length - 1].cacheHitRate = stats.hitRate;

    await searchCache.close();
  }

  private async runBenchmark(
    name: string,
    operation: () => Promise<void> | void,
    iterations: number
  ): Promise<void> {
    // Warmup
    for (let i = 0; i < Math.min(this.config.warmupIterations, iterations / 10); i++) {
      await operation();
    }

    // Clear any warmup timing data
    if (global.gc) global.gc();

    // Measure
    const latencies: number[] = [];
    const memoryBefore = process.memoryUsage();
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      const opStart = performance.now();
      await operation();
      const opEnd = performance.now();
      latencies.push(opEnd - opStart);
    }

    const endTime = performance.now();
    const memoryAfter = process.memoryUsage();

    // Calculate metrics
    const duration = endTime - startTime;
    const opsPerSecond = (iterations / duration) * 1000;
    const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    
    latencies.sort((a, b) => a - b);
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
    const p99Latency = latencies[Math.floor(latencies.length * 0.99)];
    
    const memoryUsage = memoryAfter.heapUsed - memoryBefore.heapUsed;

    const result: BenchmarkResult = {
      name,
      operations: iterations,
      duration,
      opsPerSecond,
      avgLatency,
      p95Latency,
      p99Latency,
      memoryUsage
    };

    this.results.push(result);
    this.latencies.set(name, latencies);

    console.log(`${name}: ${opsPerSecond.toFixed(0)} ops/sec, ${avgLatency.toFixed(3)}ms avg`);
  }

  private async runConcurrentBenchmark(
    name: string,
    operation: () => Promise<void> | void,
    concurrency: number,
    operationsPerThread: number
  ): Promise<void> {
    const totalOperations = concurrency * operationsPerThread;
    const memoryBefore = process.memoryUsage();
    const startTime = performance.now();

    const promises = Array.from({ length: concurrency }, async () => {
      const latencies: number[] = [];
      
      for (let i = 0; i < operationsPerThread; i++) {
        const opStart = performance.now();
        await operation();
        const opEnd = performance.now();
        latencies.push(opEnd - opStart);
      }
      
      return latencies;
    });

    const allLatencies = (await Promise.all(promises)).flat();
    const endTime = performance.now();
    const memoryAfter = process.memoryUsage();

    // Calculate metrics
    const duration = endTime - startTime;
    const opsPerSecond = (totalOperations / duration) * 1000;
    const avgLatency = allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length;
    
    allLatencies.sort((a, b) => a - b);
    const p95Latency = allLatencies[Math.floor(allLatencies.length * 0.95)];
    const p99Latency = allLatencies[Math.floor(allLatencies.length * 0.99)];
    
    const memoryUsage = memoryAfter.heapUsed - memoryBefore.heapUsed;

    const result: BenchmarkResult = {
      name,
      operations: totalOperations,
      duration,
      opsPerSecond,
      avgLatency,
      p95Latency,
      p99Latency,
      memoryUsage,
      throughput: (totalOperations / (duration / 1000))
    };

    this.results.push(result);
    this.latencies.set(name, allLatencies);

    console.log(`${name}: ${opsPerSecond.toFixed(0)} ops/sec, ${avgLatency.toFixed(3)}ms avg, ${concurrency} threads`);
  }

  private generateReport(): void {
    console.log('\n📊 BENCHMARK REPORT');
    console.log('='.repeat(80));

    // Summary table
    console.log('\n🏆 Performance Summary:');
    console.log('-'.repeat(80));
    console.log(
      'Operation'.padEnd(30) +
      'Ops/Sec'.padStart(12) +
      'Avg (ms)'.padStart(12) +
      'P95 (ms)'.padStart(12) +
      'Hit Rate'.padStart(12)
    );
    console.log('-'.repeat(80));

    for (const result of this.results) {
      const hitRate = result.cacheHitRate ? `${(result.cacheHitRate * 100).toFixed(1)}%` : 'N/A';
      console.log(
        result.name.substring(0, 29).padEnd(30) +
        result.opsPerSecond.toFixed(0).padStart(12) +
        result.avgLatency.toFixed(3).padStart(12) +
        result.p95Latency.toFixed(3).padStart(12) +
        hitRate.padStart(12)
      );
    }

    // Performance insights
    console.log('\n💡 Performance Insights:');
    console.log('-'.repeat(40));
    
    const basicOps = this.results.filter(r => r.name.includes('Operations'));
    if (basicOps.length > 0) {
      const fastest = basicOps.reduce((prev, curr) => prev.opsPerSecond > curr.opsPerSecond ? prev : curr);
      console.log(`🚀 Fastest Operation: ${fastest.name} (${fastest.opsPerSecond.toFixed(0)} ops/sec)`);
    }

    const evictionTests = this.results.filter(r => r.name.includes('Eviction'));
    if (evictionTests.length > 0) {
      const bestEviction = evictionTests.reduce((prev, curr) => prev.opsPerSecond > curr.opsPerSecond ? prev : curr);
      console.log(`🔄 Best Eviction Policy: ${bestEviction.name}`);
    }

    const concurrentTests = this.results.filter(r => r.name.includes('Concurrent'));
    if (concurrentTests.length > 0) {
      const bestConcurrency = concurrentTests.reduce((prev, curr) => 
        (prev.throughput || 0) > (curr.throughput || 0) ? prev : curr
      );
      console.log(`⚡ Best Concurrency: ${bestConcurrency.name}`);
    }

    // Memory efficiency
    const memoryEfficient = this.results
      .filter(r => r.memoryUsage > 0)
      .reduce((prev, curr) => 
        (prev.opsPerSecond / prev.memoryUsage) > (curr.opsPerSecond / curr.memoryUsage) ? prev : curr
      );
    if (memoryEfficient) {
      console.log(`💾 Most Memory Efficient: ${memoryEfficient.name}`);
    }

    // Cache hit rates
    const highestHitRate = this.results
      .filter(r => r.cacheHitRate !== undefined)
      .reduce((prev, curr) => 
        (prev.cacheHitRate || 0) > (curr.cacheHitRate || 0) ? prev : curr
      );
    if (highestHitRate && highestHitRate.cacheHitRate) {
      console.log(`🎯 Highest Hit Rate: ${highestHitRate.name} (${(highestHitRate.cacheHitRate * 100).toFixed(1)}%)`);
    }

    console.log('\n✅ Benchmark suite completed successfully!');
  }

  getResults(): BenchmarkResult[] {
    return this.results;
  }

  getLatencyDistribution(operationName: string): number[] | undefined {
    return this.latencies.get(operationName);
  }

  exportResults(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        timestamp: new Date().toISOString(),
        config: this.config,
        results: this.results,
        summary: this.generateSummary()
      }, null, 2);
    } else {
      // CSV format
      const headers = [
        'name', 'operations', 'duration', 'opsPerSecond', 'avgLatency',
        'p95Latency', 'p99Latency', 'memoryUsage', 'cacheHitRate', 'throughput'
      ];
      
      const rows = this.results.map(result => 
        headers.map(header => result[header as keyof BenchmarkResult] || '').join(',')
      );
      
      return [headers.join(','), ...rows].join('\n');
    }
  }

  private generateSummary() {
    return {
      totalTests: this.results.length,
      averageOpsPerSecond: this.results.reduce((sum, r) => sum + r.opsPerSecond, 0) / this.results.length,
      averageLatency: this.results.reduce((sum, r) => sum + r.avgLatency, 0) / this.results.length,
      averageHitRate: this.results
        .filter(r => r.cacheHitRate !== undefined)
        .reduce((sum, r) => sum + (r.cacheHitRate || 0), 0) / 
        this.results.filter(r => r.cacheHitRate !== undefined).length
    };
  }
}

// Export for use in tests and scripts
export { CacheBenchmarkSuite, BenchmarkResult, BenchmarkConfig };

// CLI runner
if (require.main === module) {
  const suite = new CacheBenchmarkSuite();
  suite.runAllBenchmarks()
    .then(results => {
      console.log('\n📁 Saving results...');
      const fs = require('fs');
      fs.writeFileSync('cache-benchmark-results.json', suite.exportResults('json'));
      fs.writeFileSync('cache-benchmark-results.csv', suite.exportResults('csv'));
      console.log('✅ Results saved to cache-benchmark-results.json and .csv');
    })
    .catch(error => {
      console.error('❌ Benchmark failed:', error);
      process.exit(1);
    });
}
