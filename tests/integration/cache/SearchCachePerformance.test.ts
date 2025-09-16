/**
 * Search Cache Performance Integration Tests
 * End-to-end testing with real API endpoints and performance validation
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { SearchCache } from '../../../src/services/search/SearchCache';
import { CachedSearchService } from '../../../src/services/search/CachedSearchService';
import { KnowledgeBaseService } from '../../../src/services/KnowledgeBaseService';
import { CacheService } from '../../../src/services/CacheService';
import { SearchService } from '../../../src/services/SearchService';
import { KBEntry, SearchResult, SearchOptions } from '../../../src/types';

// Performance testing utilities
class PerformanceProfiler {
  private metrics: Map<string, number[]> = new Map();
  private memorySnapshots: Map<string, NodeJS.MemoryUsage> = new Map();

  startProfile(name: string): void {
    this.memorySnapshots.set(name, process.memoryUsage());
  }

  endProfile(name: string, duration: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
  }

  getStats(name: string) {
    const durations = this.metrics.get(name) || [];
    if (durations.length === 0) return null;

    const sorted = [...durations].sort((a, b) => a - b);
    return {
      count: durations.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  clear(): void {
    this.metrics.clear();
    this.memorySnapshots.clear();
  }
}

// Mock data generator
class MockDataGenerator {
  static generateKBEntries(count: number): KBEntry[] {
    const categories = ['System', 'Performance', 'Error', 'Configuration', 'Security'];
    const tags = ['vsam', 'jcl', 'batch', 'online', 'database', 'network', 'mainframe'];
    const problems = [
      'System performance degradation',
      'Database connection timeout',
      'Memory allocation error',
      'Network connectivity issues',
      'Configuration parameter invalid',
      'Security authentication failure',
      'Batch job processing delay'
    ];
    
    return Array.from({ length: count }, (_, i) => ({
      id: `entry-${i.toString().padStart(6, '0')}`,
      title: `Entry ${i}: ${problems[i % problems.length]}`,
      problem: `Detailed problem description for ${problems[i % problems.length]}. ${this.generateRandomText(100, 300)}`,
      solution: `Comprehensive solution for ${problems[i % problems.length]}. ${this.generateRandomText(200, 500)}`,
      category: categories[i % categories.length],
      tags: this.selectRandomItems(tags, 2, 4),
      created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      updated_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      usage_count: Math.floor(Math.random() * 1000),
      success_count: Math.floor(Math.random() * 800),
      failure_count: Math.floor(Math.random() * 100)
    }));
  }

  static generateRandomText(minLength: number, maxLength: number): string {
    const words = [
      'system', 'performance', 'database', 'network', 'configuration', 'security',
      'mainframe', 'batch', 'online', 'processing', 'error', 'timeout', 'memory',
      'allocation', 'connection', 'authentication', 'parameter', 'optimization',
      'monitoring', 'troubleshooting', 'analysis', 'solution', 'implementation'
    ];
    
    const targetLength = minLength + Math.random() * (maxLength - minLength);
    const result = [];
    let currentLength = 0;
    
    while (currentLength < targetLength) {
      const word = words[Math.floor(Math.random() * words.length)];
      result.push(word);
      currentLength += word.length + 1;
    }
    
    return result.join(' ');
  }

  static selectRandomItems<T>(array: T[], min: number, max: number): T[] {
    const count = min + Math.floor(Math.random() * (max - min + 1));
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  static generateSearchQueries(count: number): string[] {
    const terms = [
      'error', 'performance', 'timeout', 'memory', 'database', 'connection',
      'system', 'configuration', 'security', 'batch', 'online', 'network',
      'processing', 'authentication', 'optimization', 'monitoring'
    ];
    
    return Array.from({ length: count }, () => {
      const queryTerms = this.selectRandomItems(terms, 1, 3);
      return queryTerms.join(' ');
    });
  }
}

describe('Search Cache Performance Integration Tests', () => {
  let searchCache: SearchCache;
  let cachedSearchService: CachedSearchService;
  let knowledgeBaseService: KnowledgeBaseService;
  let cacheService: CacheService;
  let searchService: SearchService;
  let profiler: PerformanceProfiler;
  let mockEntries: KBEntry[];
  let testQueries: string[];

  beforeAll(async () => {
    // Generate comprehensive test data
    mockEntries = MockDataGenerator.generateKBEntries(10000);
    testQueries = MockDataGenerator.generateSearchQueries(1000);
    
    console.log(`Generated ${mockEntries.length} test entries and ${testQueries.length} test queries`);
  });

  beforeEach(async () => {
    profiler = new PerformanceProfiler();
    
    // Initialize search cache with performance-optimized configuration
    searchCache = new SearchCache({
      maxSize: 50 * 1024 * 1024, // 50MB
      defaultTTL: 300000, // 5 minutes
      checkInterval: 30000, // 30 seconds
      strategy: 'adaptive',
      layers: [
        { name: 'l1', maxSize: 1000, ttl: 60000, strategy: 'lfu', enabled: true },
        { name: 'l2', maxSize: 5000, ttl: 300000, strategy: 'lru', enabled: true }
      ],
      persistence: {
        enabled: false, // Disable for testing
        interval: 300000,
        snapshotThreshold: 1000
      },
      compression: {
        enabled: true,
        threshold: 1024,
        algorithm: 'gzip'
      },
      warming: {
        enabled: true,
        strategies: ['popular_queries', 'recent_searches'],
        schedule: '0 */6 * * *'
      }
    });
    
    // Initialize cache service
    cacheService = new CacheService({
      maxSize: 10000,
      defaultTTL: 300000,
      checkPeriod: 30000
    });
    
    // Initialize search service with mock data
    searchService = new SearchService();
    await searchService.initialize(mockEntries);
    
    // Initialize knowledge base service
    knowledgeBaseService = new KnowledgeBaseService();
    await knowledgeBaseService.initialize(mockEntries);
    
    // Initialize cached search service
    cachedSearchService = new CachedSearchService({
      searchService,
      searchCache,
      cacheService,
      cache: {
        enabled: true,
        layers: {
          l1: { size: 500, ttl: 60000 },
          l2: { size: 2000, ttl: 300000 },
          l3: { size: 5000, ttl: 900000 }
        },
        warming: {
          enabled: true,
          strategies: ['popular', 'recent'],
          schedule: '*/5 * * * *'
        },
        invalidation: {
          enabled: true,
          smartCascade: true,
          maxBatchSize: 100
        },
        monitoring: {
          enabled: true,
          metricsInterval: 30000,
          alertThresholds: {
            hitRate: 0.7,
            responseTime: 1000,
            errorRate: 0.05
          }
        }
      }
    });
    
    await cachedSearchService.initialize(mockEntries);
  });

  afterEach(async () => {
    await cachedSearchService.shutdown();
    await searchCache.close();
    await cacheService.close();
    profiler.clear();
  });

  describe('Cache Performance Benchmarks', () => {
    it('should meet <1s response time SLA for cached queries', async () => {
      const sampleQueries = testQueries.slice(0, 100);
      const responseTimes: number[] = [];
      
      // Warm up cache
      for (const query of sampleQueries.slice(0, 20)) {
        await cachedSearchService.search(query, { limit: 10 });
      }
      
      // Measure cached performance
      for (const query of sampleQueries) {
        const start = Date.now();
        await cachedSearchService.search(query, { limit: 10 });
        const duration = Date.now() - start;
        responseTimes.push(duration);
      }
      
      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];
      
      console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`P95 response time: ${p95ResponseTime.toFixed(2)}ms`);
      console.log(`Max response time: ${maxResponseTime.toFixed(2)}ms`);
      
      // SLA requirements
      expect(avgResponseTime).toBeLessThan(100); // Average under 100ms
      expect(p95ResponseTime).toBeLessThan(500); // P95 under 500ms
      expect(maxResponseTime).toBeLessThan(1000); // Max under 1s
    });

    it('should achieve >80% cache hit rate under normal load', async () => {
      const popularQueries = testQueries.slice(0, 50);
      const totalRequests = 500;
      
      // Simulate realistic usage pattern (80% popular, 20% new queries)
      const requests: string[] = [];
      
      for (let i = 0; i < totalRequests; i++) {
        if (Math.random() < 0.8) {
          // Use popular query
          requests.push(popularQueries[Math.floor(Math.random() * popularQueries.length)]);
        } else {
          // Use new query
          requests.push(testQueries[50 + (i % (testQueries.length - 50))]);
        }
      }
      
      // Execute requests
      const results = [];
      for (const query of requests) {
        const result = await cachedSearchService.search(query, { limit: 10 });
        results.push(result);
      }
      
      // Calculate hit rate
      const hits = results.filter(r => r.metrics?.cacheHit).length;
      const hitRate = hits / totalRequests;
      
      console.log(`Cache hit rate: ${(hitRate * 100).toFixed(1)}%`);
      console.log(`Cache hits: ${hits}/${totalRequests}`);
      
      expect(hitRate).toBeGreaterThan(0.8); // >80% hit rate
    });

    it('should handle high concurrency without performance degradation', async () => {
      const concurrentQueries = 100;
      const querySubset = testQueries.slice(0, 20); // Reuse queries for cache hits
      
      // Pre-warm cache
      for (const query of querySubset) {
        await cachedSearchService.search(query, { limit: 10 });
      }
      
      // Execute concurrent requests
      const startTime = Date.now();
      
      const promises = Array.from({ length: concurrentQueries }, (_, i) => {
        const query = querySubset[i % querySubset.length];
        return cachedSearchService.search(query, { limit: 10 });
      });
      
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      const avgResponseTime = totalTime / concurrentQueries;
      const successfulRequests = results.filter(r => r && r.results).length;
      
      console.log(`Concurrent requests: ${concurrentQueries}`);
      console.log(`Total time: ${totalTime}ms`);
      console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`Successful requests: ${successfulRequests}/${concurrentQueries}`);
      
      expect(successfulRequests).toBe(concurrentQueries); // All requests succeed
      expect(avgResponseTime).toBeLessThan(200); // Average under 200ms
    });

    it('should maintain performance under memory pressure', async () => {
      const largeBatch = testQueries.slice(0, 500);
      const memoryBefore = process.memoryUsage();
      
      // Execute large batch of queries
      for (const query of largeBatch) {
        await cachedSearchService.search(query, { limit: 20 });
      }
      
      const memoryAfter = process.memoryUsage();
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
      
      // Test performance under memory pressure
      const performanceQueries = testQueries.slice(500, 550);
      const responseTimes: number[] = [];
      
      for (const query of performanceQueries) {
        const start = Date.now();
        await cachedSearchService.search(query, { limit: 10 });
        responseTimes.push(Date.now() - start);
      }
      
      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Performance under pressure: ${avgResponseTime.toFixed(2)}ms`);
      
      // Performance should not degrade significantly
      expect(avgResponseTime).toBeLessThan(300); // Still under 300ms
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Under 100MB increase
    });
  });

  describe('Cache Optimization Tests', () => {
    it('should automatically optimize cache layout for query patterns', async () => {
      const hotQueries = testQueries.slice(0, 10);
      const warmQueries = testQueries.slice(10, 30);
      const coldQueries = testQueries.slice(30, 100);
      
      // Create access pattern
      // Hot queries - access 20 times each
      for (let i = 0; i < 20; i++) {
        for (const query of hotQueries) {
          await cachedSearchService.search(query, { limit: 10 });
        }
      }
      
      // Warm queries - access 5 times each
      for (let i = 0; i < 5; i++) {
        for (const query of warmQueries) {
          await cachedSearchService.search(query, { limit: 10 });
        }
      }
      
      // Cold queries - access once each
      for (const query of coldQueries) {
        await cachedSearchService.search(query, { limit: 10 });
      }
      
      // Test that hot queries have better performance
      const hotPerformance = await this.measureQueryPerformance(cachedSearchService, hotQueries.slice(0, 5));
      const coldPerformance = await this.measureQueryPerformance(cachedSearchService, coldQueries.slice(0, 5));
      
      console.log(`Hot query avg: ${hotPerformance.avg.toFixed(2)}ms`);
      console.log(`Cold query avg: ${coldPerformance.avg.toFixed(2)}ms`);
      
      // Hot queries should be significantly faster
      expect(hotPerformance.avg).toBeLessThan(coldPerformance.avg * 0.5);
    });

    it('should optimize memory usage through intelligent eviction', async () => {
      const cacheStats = searchCache.getStats();
      const initialMemory = cacheStats.memoryUsage;
      
      // Fill cache beyond capacity to trigger evictions
      for (let i = 0; i < 1000; i++) {
        const query = testQueries[i % testQueries.length];
        await cachedSearchService.search(query, { limit: 15 });
      }
      
      const finalStats = searchCache.getStats();
      
      console.log(`Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Final memory: ${(finalStats.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Cache hit rate: ${(finalStats.hitRate * 100).toFixed(1)}%`);
      console.log(`Evictions: ${finalStats.evictions}`);
      
      // Memory should be managed efficiently
      expect(finalStats.memoryUsage).toBeLessThan(60 * 1024 * 1024); // Under 60MB
      expect(finalStats.hitRate).toBeGreaterThan(0.6); // Maintain good hit rate
      expect(finalStats.evictions).toBeGreaterThan(0); // Evictions occurred
    });

    it('should adapt to changing query patterns', async () => {
      const phase1Queries = testQueries.slice(0, 50);
      const phase2Queries = testQueries.slice(50, 100);
      
      // Phase 1: Establish pattern
      for (let i = 0; i < 10; i++) {
        for (const query of phase1Queries) {
          await cachedSearchService.search(query, { limit: 10 });
        }
      }
      
      const phase1Stats = searchCache.getStats();
      
      // Phase 2: Shift to different pattern
      for (let i = 0; i < 10; i++) {
        for (const query of phase2Queries) {
          await cachedSearchService.search(query, { limit: 10 });
        }
      }
      
      const phase2Stats = searchCache.getStats();
      
      // Test adaptation performance
      const adaptationPerformance = await this.measureQueryPerformance(cachedSearchService, phase2Queries.slice(0, 10));
      
      console.log(`Phase 1 hit rate: ${(phase1Stats.hitRate * 100).toFixed(1)}%`);
      console.log(`Phase 2 hit rate: ${(phase2Stats.hitRate * 100).toFixed(1)}%`);
      console.log(`Adaptation performance: ${adaptationPerformance.avg.toFixed(2)}ms`);
      
      // Should adapt reasonably well
      expect(adaptationPerformance.avg).toBeLessThan(200); // Reasonable performance
    });
  });

  describe('Load Testing Scenarios', () => {
    it('should handle sustained high load', async () => {
      const loadDuration = 30000; // 30 seconds
      const requestsPerSecond = 50;
      const totalRequests = (loadDuration / 1000) * requestsPerSecond;
      
      const requests: Promise<any>[] = [];
      const startTime = Date.now();
      
      let requestCount = 0;
      const interval = setInterval(() => {
        if (Date.now() - startTime >= loadDuration) {
          clearInterval(interval);
          return;
        }
        
        for (let i = 0; i < requestsPerSecond && requestCount < totalRequests; i++) {
          const query = testQueries[requestCount % testQueries.length];
          const promise = cachedSearchService.search(query, { limit: 10 })
            .then(result => ({
              success: true,
              duration: Date.now() - startTime,
              cacheHit: result.metrics?.cacheHit || false
            }))
            .catch(error => ({
              success: false,
              error: error.message,
              duration: Date.now() - startTime
            }));
          
          requests.push(promise);
          requestCount++;
        }
      }, 1000);
      
      // Wait for all requests to complete
      const results = await Promise.all(requests);
      const endTime = Date.now();
      
      const successfulRequests = results.filter(r => r.success).length;
      const cacheHits = results.filter(r => r.success && r.cacheHit).length;
      const hitRate = cacheHits / successfulRequests;
      
      console.log(`Load test duration: ${endTime - startTime}ms`);
      console.log(`Total requests: ${results.length}`);
      console.log(`Successful requests: ${successfulRequests}`);
      console.log(`Cache hit rate: ${(hitRate * 100).toFixed(1)}%`);
      
      expect(successfulRequests / results.length).toBeGreaterThan(0.95); // >95% success rate
      expect(hitRate).toBeGreaterThan(0.7); // >70% hit rate under load
    });

    it('should handle burst traffic patterns', async () => {
      const burstSize = 200;
      const burstQueries = testQueries.slice(0, 20); // Focused queries for better cache hits
      
      // Pre-warm cache
      for (const query of burstQueries) {
        await cachedSearchService.search(query, { limit: 10 });
      }
      
      // Execute burst
      const burstStart = Date.now();
      const promises = Array.from({ length: burstSize }, (_, i) => {
        const query = burstQueries[i % burstQueries.length];
        return cachedSearchService.search(query, { limit: 10 });
      });
      
      const results = await Promise.all(promises);
      const burstDuration = Date.now() - burstStart;
      
      const successfulRequests = results.filter(r => r && r.results).length;
      const cacheHits = results.filter(r => r && r.metrics?.cacheHit).length;
      
      console.log(`Burst duration: ${burstDuration}ms`);
      console.log(`Requests per second: ${(burstSize / (burstDuration / 1000)).toFixed(1)}`);
      console.log(`Success rate: ${(successfulRequests / burstSize * 100).toFixed(1)}%`);
      console.log(`Cache hit rate: ${(cacheHits / successfulRequests * 100).toFixed(1)}%`);
      
      expect(successfulRequests).toBe(burstSize); // All requests succeed
      expect(burstDuration).toBeLessThan(10000); // Complete within 10 seconds
      expect(cacheHits / successfulRequests).toBeGreaterThan(0.8); // High hit rate
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should gracefully handle cache failures', async () => {
      // Simulate cache failure
      await searchCache.close();
      
      // Requests should still work (fallback to direct search)
      const query = testQueries[0];
      const result = await cachedSearchService.search(query, { limit: 10 });
      
      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(result.metrics?.cacheHit).toBe(false);
    });

    it('should recover from temporary service interruptions', async () => {
      const query = testQueries[0];
      
      // Normal operation
      const result1 = await cachedSearchService.search(query, { limit: 10 });
      expect(result1).toBeDefined();
      
      // Simulate temporary interruption (restart cache)
      await searchCache.close();
      searchCache = new SearchCache({
        maxSize: 50 * 1024 * 1024,
        defaultTTL: 300000
      });
      
      // Should continue working
      const result2 = await cachedSearchService.search(query, { limit: 10 });
      expect(result2).toBeDefined();
      expect(result2.metrics?.cacheHit).toBe(false); // Cache was reset
    });
  });

  // Helper method
  private async measureQueryPerformance(service: CachedSearchService, queries: string[]) {
    const times: number[] = [];
    
    for (const query of queries) {
      const start = Date.now();
      await service.search(query, { limit: 10 });
      times.push(Date.now() - start);
    }
    
    times.sort((a, b) => a - b);
    
    return {
      min: times[0],
      max: times[times.length - 1],
      avg: times.reduce((sum, time) => sum + time, 0) / times.length,
      p50: times[Math.floor(times.length * 0.5)],
      p95: times[Math.floor(times.length * 0.95)]
    };
  }
});
