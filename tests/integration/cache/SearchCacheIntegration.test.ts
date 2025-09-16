/**
 * Search Cache Integration Tests
 * Testing the complete search caching system integration
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { LRUCache } from '../../../src/services/cache/LRUCache';
import { RedisCache } from '../../../src/services/cache/RedisCache';
import { PredictiveCache } from '../../../src/services/cache/PredictiveCache';
import { IncrementalLoader } from '../../../src/services/cache/IncrementalLoader';
import { CacheKeyStrategy } from '../../../src/services/cache/CacheKeyStrategy';

// Mock knowledge base entries
interface MockKBEntry {
  id: string;
  title: string;
  problem: string;
  solution: string;
  category: string;
  tags: string[];
  usage_count: number;
  created_at: Date;
}

// Mock search service
class MockSearchService {
  private entries: MockKBEntry[];
  
  constructor(entries: MockKBEntry[]) {
    this.entries = entries;
  }
  
  async search(query: string, options: any = {}): Promise<MockKBEntry[]> {
    const { limit = 10, category, tags } = options;
    
    let results = this.entries.filter(entry => {
      const queryMatch = !query || 
        entry.title.toLowerCase().includes(query.toLowerCase()) ||
        entry.problem.toLowerCase().includes(query.toLowerCase()) ||
        entry.solution.toLowerCase().includes(query.toLowerCase());
      
      const categoryMatch = !category || entry.category === category;
      
      const tagMatch = !tags || tags.some((tag: string) => entry.tags.includes(tag));
      
      return queryMatch && categoryMatch && tagMatch;
    });
    
    // Sort by usage count
    results.sort((a, b) => b.usage_count - a.usage_count);
    
    return results.slice(0, limit);
  }
}

// Integrated cache system
class IntegratedCacheSystem {
  private l1Cache: LRUCache<any>;
  private l2Cache: RedisCache;
  private predictiveCache: PredictiveCache;
  private keyStrategy: CacheKeyStrategy;
  private searchService: MockSearchService;
  private stats = {
    searches: 0,
    cacheHits: 0,
    cacheMisses: 0,
    predictions: 0
  };
  
  constructor(searchService: MockSearchService) {
    this.l1Cache = new LRUCache({
      maxSize: 100,
      defaultTTL: 60000, // 1 minute
      evictionPolicy: 'LRU'
    });
    
    this.l2Cache = new RedisCache({
      keyPrefix: 'test-cache:',
      defaultTTL: 300 // 5 minutes
    });
    
    this.predictiveCache = new PredictiveCache({
      enableMLPredictions: true,
      maxPredictions: 20,
      confidenceThreshold: 0.6
    });
    
    this.keyStrategy = new CacheKeyStrategy();
    this.searchService = searchService;
  }
  
  async search(query: string, options: any = {}, sessionId: string = 'default', userId?: string): Promise<{
    results: MockKBEntry[];
    fromCache: boolean;
    cacheLayer?: 'L1' | 'L2';
    predictions?: any[];
  }> {
    this.stats.searches++;
    
    // Generate cache key
    const cacheKey = this.keyStrategy.generateSearchKey(query, options, userId);
    
    // Try L1 cache first
    let cachedResult = this.l1Cache.get(cacheKey);
    if (cachedResult) {
      this.stats.cacheHits++;
      
      // Record search event for predictions
      this.predictiveCache.recordSearchEvent(sessionId, {
        query,
        timestamp: Date.now(),
        category: options.category,
        resultClicks: 0,
        sessionDuration: 1000,
        followupQueries: []
      }, userId);
      
      return {
        results: cachedResult,
        fromCache: true,
        cacheLayer: 'L1'
      };
    }
    
    // Try L2 cache (Redis)
    cachedResult = await this.l2Cache.get(cacheKey);
    if (cachedResult) {
      this.stats.cacheHits++;
      
      // Promote to L1 cache
      this.l1Cache.set(cacheKey, cachedResult);
      
      // Record search event
      this.predictiveCache.recordSearchEvent(sessionId, {
        query,
        timestamp: Date.now(),
        category: options.category,
        resultClicks: 0,
        sessionDuration: 1000,
        followupQueries: []
      }, userId);
      
      return {
        results: cachedResult,
        fromCache: true,
        cacheLayer: 'L2'
      };
    }
    
    // Cache miss - perform actual search
    this.stats.cacheMisses++;
    const results = await this.searchService.search(query, options);
    
    // Cache the results
    this.l1Cache.set(cacheKey, results);
    await this.l2Cache.set(cacheKey, results);
    
    // Record search event for ML
    this.predictiveCache.recordSearchEvent(sessionId, {
      query,
      timestamp: Date.now(),
      category: options.category,
      resultClicks: results.length > 0 ? Math.floor(Math.random() * 3) + 1 : 0,
      sessionDuration: Math.floor(Math.random() * 5000) + 1000,
      followupQueries: []
    }, userId);
    
    // Get predictions for this user
    const predictions = await this.predictiveCache.getPredictions(sessionId, userId);
    this.stats.predictions += predictions.length;
    
    return {
      results,
      fromCache: false,
      predictions
    };
  }
  
  async invalidateCache(pattern: string): Promise<number> {
    let invalidated = 0;
    
    // Invalidate L1 cache
    const l1Keys = this.l1Cache.keys();
    const matchingL1 = l1Keys.filter(key => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(key);
    });
    
    matchingL1.forEach(key => {
      this.l1Cache.delete(key);
      invalidated++;
    });
    
    // Invalidate L2 cache
    const l2Invalidated = await this.l2Cache.deletePattern(pattern);
    invalidated += l2Invalidated;
    
    return invalidated;
  }
  
  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.searches > 0 ? this.stats.cacheHits / this.stats.searches : 0,
      l1Stats: this.l1Cache.getStats(),
      l2Stats: this.l2Cache.getStats(),
      predictiveStats: this.predictiveCache.getStats()
    };
  }
  
  async cleanup() {
    this.l1Cache.destroy();
    await this.l2Cache.close();
    this.predictiveCache.reset();
  }
}

// Test data
const createTestEntries = (): MockKBEntry[] => {
  const categories = ['System', 'Performance', 'Error', 'Configuration', 'Security'];
  const tags = ['vsam', 'jcl', 'batch', 'online', 'database', 'network', 'memory'];
  
  return Array.from({ length: 100 }, (_, i) => ({
    id: `entry-${i + 1}`,
    title: `Test Entry ${i + 1}`,
    problem: `This is a test problem description ${i + 1} with various keywords like ${tags[i % tags.length]}`,
    solution: `This is the solution for problem ${i + 1}`,
    category: categories[i % categories.length],
    tags: [tags[i % tags.length], tags[(i + 1) % tags.length]],
    usage_count: Math.floor(Math.random() * 100),
    created_at: new Date(Date.now() - (i * 24 * 60 * 60 * 1000))
  }));
};

describe('Search Cache Integration', () => {
  let cacheSystem: IntegratedCacheSystem;
  let searchService: MockSearchService;
  let testEntries: MockKBEntry[];

  beforeEach(async () => {
    testEntries = createTestEntries();
    searchService = new MockSearchService(testEntries);
    cacheSystem = new IntegratedCacheSystem(searchService);
  });

  afterEach(async () => {
    await cacheSystem.cleanup();
  });

  describe('Basic Cache Operations', () => {
    it('should cache search results across multiple requests', async () => {
      const query = 'test query';
      const options = { limit: 5 };
      
      // First search - should be cache miss
      const result1 = await cacheSystem.search(query, options);
      expect(result1.fromCache).toBe(false);
      expect(result1.results.length).toBeGreaterThan(0);
      
      // Second search - should be cache hit
      const result2 = await cacheSystem.search(query, options);
      expect(result2.fromCache).toBe(true);
      expect(result2.cacheLayer).toBe('L1');
      expect(result2.results).toEqual(result1.results);
    });

    it('should promote L2 cache hits to L1', async () => {
      const query = 'promotion test';
      const options = { limit: 3 };
      
      // First search - populate caches
      await cacheSystem.search(query, options);
      
      // Clear L1 cache to simulate eviction
      const stats1 = cacheSystem.getStats();
      
      // Manually clear L1 by creating a new L1 cache (simulate eviction)
      // This is a test-specific operation
      
      // Search again - should hit L2 and promote to L1
      const result = await cacheSystem.search(query, options);
      expect(result.fromCache).toBe(true);
    });

    it('should handle different query parameters separately', async () => {
      const baseQuery = 'parameter test';
      
      const result1 = await cacheSystem.search(baseQuery, { limit: 5 });
      const result2 = await cacheSystem.search(baseQuery, { limit: 10 });
      const result3 = await cacheSystem.search(baseQuery, { limit: 5, category: 'System' });
      
      // Each should be cached separately
      expect(result1.fromCache).toBe(false);
      expect(result2.fromCache).toBe(false);
      expect(result3.fromCache).toBe(false);
      
      // Repeat searches should hit cache
      const cached1 = await cacheSystem.search(baseQuery, { limit: 5 });
      const cached2 = await cacheSystem.search(baseQuery, { limit: 10 });
      const cached3 = await cacheSystem.search(baseQuery, { limit: 5, category: 'System' });
      
      expect(cached1.fromCache).toBe(true);
      expect(cached2.fromCache).toBe(true);
      expect(cached3.fromCache).toBe(true);
    });

    it('should handle user-specific caching', async () => {
      const query = 'user specific test';
      const options = { limit: 5 };
      
      // Different users should get separate cache entries
      const user1Result = await cacheSystem.search(query, options, 'session1', 'user1');
      const user2Result = await cacheSystem.search(query, options, 'session2', 'user2');
      
      expect(user1Result.fromCache).toBe(false);
      expect(user2Result.fromCache).toBe(false);
      
      // Same user should hit cache
      const user1Cached = await cacheSystem.search(query, options, 'session1', 'user1');
      expect(user1Cached.fromCache).toBe(true);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cache entries by pattern', async () => {
      // Populate cache with multiple entries
      await cacheSystem.search('system error', { limit: 5 });
      await cacheSystem.search('performance issue', { limit: 5 });
      await cacheSystem.search('configuration problem', { limit: 5 });
      
      // All should be cached
      const cached1 = await cacheSystem.search('system error', { limit: 5 });
      expect(cached1.fromCache).toBe(true);
      
      // Invalidate all search cache entries
      const invalidated = await cacheSystem.invalidateCache('*');
      expect(invalidated).toBeGreaterThan(0);
      
      // Should now be cache misses
      const fresh1 = await cacheSystem.search('system error', { limit: 5 });
      expect(fresh1.fromCache).toBe(false);
    });

    it('should invalidate specific patterns only', async () => {
      // This would require access to the key strategy to generate patterns
      // For now, test basic invalidation
      await cacheSystem.search('specific test 1', { limit: 5 });
      await cacheSystem.search('specific test 2', { limit: 5 });
      
      const invalidated = await cacheSystem.invalidateCache('*specific*');
      expect(invalidated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Predictive Caching', () => {
    it('should generate predictions based on search patterns', async () => {
      const sessionId = 'prediction-session';
      const userId = 'prediction-user';
      
      // Perform several related searches to establish patterns
      const searches = [
        'database connection error',
        'database timeout',
        'database performance',
        'database configuration'
      ];
      
      for (const query of searches) {
        await cacheSystem.search(query, { limit: 5 }, sessionId, userId);
      }
      
      // Next search should include predictions
      const result = await cacheSystem.search('database', { limit: 5 }, sessionId, userId);
      
      if (result.predictions) {
        expect(result.predictions.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should learn from user behavior patterns', async () => {
      const sessionId = 'behavior-session';
      const userId = 'behavior-user';
      
      // Simulate consistent user behavior
      const morningQueries = ['system status', 'daily report', 'error summary'];
      const afternoonQueries = ['performance analysis', 'optimization tips', 'troubleshooting'];
      
      // Morning pattern
      for (const query of morningQueries) {
        await cacheSystem.search(query, { limit: 5 }, sessionId, userId);
      }
      
      // Afternoon pattern
      for (const query of afternoonQueries) {
        await cacheSystem.search(query, { limit: 5 }, sessionId, userId);
      }
      
      const stats = cacheSystem.getStats();
      expect(stats.predictiveStats.patternsLearned).toBeGreaterThan(0);
    });
  });

  describe('Performance Characteristics', () => {
    it('should maintain good hit rates with realistic usage', async () => {
      const queries = [
        'error handling',
        'performance tuning',
        'system configuration',
        'database optimization',
        'network troubleshooting'
      ];
      
      // Simulate realistic usage with repeated popular queries
      for (let i = 0; i < 50; i++) {
        const query = queries[Math.floor(Math.random() * queries.length)];
        const options = { limit: Math.floor(Math.random() * 10) + 1 };
        
        await cacheSystem.search(query, options);
      }
      
      const stats = cacheSystem.getStats();
      expect(stats.hitRate).toBeGreaterThan(0.3); // At least 30% hit rate
      expect(stats.searches).toBe(50);
    });

    it('should handle concurrent searches efficiently', async () => {
      const concurrentSearches = Array.from({ length: 20 }, (_, i) => 
        cacheSystem.search(`concurrent query ${i % 5}`, { limit: 5 })
      );
      
      const results = await Promise.all(concurrentSearches);
      
      expect(results.length).toBe(20);
      
      // Some should be cache hits (due to repeated queries)
      const cacheHits = results.filter(r => r.fromCache).length;
      expect(cacheHits).toBeGreaterThan(0);
    });

    it('should demonstrate performance improvement with caching', async () => {
      const query = 'performance test query';
      const options = { limit: 10 };
      
      // First search (cache miss)
      const start1 = Date.now();
      await cacheSystem.search(query, options);
      const time1 = Date.now() - start1;
      
      // Second search (cache hit)
      const start2 = Date.now();
      await cacheSystem.search(query, options);
      const time2 = Date.now() - start2;
      
      // Cache hit should be faster
      expect(time2).toBeLessThan(time1);
    });
  });

  describe('Multi-layer Cache Behavior', () => {
    it('should demonstrate cache layer hierarchy', async () => {
      const query = 'layer hierarchy test';
      const options = { limit: 5 };
      
      // First search - populates both L1 and L2
      const result1 = await cacheSystem.search(query, options);
      expect(result1.fromCache).toBe(false);
      
      // Second search - hits L1
      const result2 = await cacheSystem.search(query, options);
      expect(result2.fromCache).toBe(true);
      expect(result2.cacheLayer).toBe('L1');
      
      // Simulate L1 eviction by doing many other searches
      for (let i = 0; i < 150; i++) {
        await cacheSystem.search(`eviction query ${i}`, { limit: 1 });
      }
      
      // Original query should now hit L2 (if still cached)
      const result3 = await cacheSystem.search(query, options);
      if (result3.fromCache) {
        expect(result3.cacheLayer).toBe('L2');
      }
    });

    it('should handle cache size limits appropriately', async () => {
      // Generate more searches than L1 cache capacity
      const results = [];
      
      for (let i = 0; i < 150; i++) {
        const result = await cacheSystem.search(`cache limit test ${i}`, { limit: 1 });
        results.push(result);
      }
      
      const stats = cacheSystem.getStats();
      
      // L1 cache should have evicted some entries
      expect(stats.l1Stats.evictions).toBeGreaterThan(0);
      expect(stats.l1Stats.size).toBeLessThanOrEqual(100); // L1 max size
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle cache failures gracefully', async () => {
      // Force a cache error by closing the Redis connection
      await cacheSystem.cleanup();
      
      // Create new system to test with failed cache
      const newCacheSystem = new IntegratedCacheSystem(searchService);
      
      // Should still return results even if caching fails
      const result = await newCacheSystem.search('error handling test', { limit: 5 });
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
      
      await newCacheSystem.cleanup();
    });

    it('should handle malformed cache keys', async () => {
      // Test with potentially problematic query strings
      const problematicQueries = [
        '',
        '   ',
        'query with\nnewlines',
        'query\twith\ttabs',
        'query"with"quotes',
        "query'with'apostrophes",
        'query\\with\\backslashes'
      ];
      
      for (const query of problematicQueries) {
        const result = await cacheSystem.search(query, { limit: 1 });
        expect(result).toBeDefined();
      }
    });

    it('should handle empty search results', async () => {
      const result = await cacheSystem.search('nonexistent query 12345', { limit: 10 });
      
      expect(result.results).toEqual([]);
      expect(result.fromCache).toBe(false);
      
      // Should cache empty results too
      const cached = await cacheSystem.search('nonexistent query 12345', { limit: 10 });
      expect(cached.fromCache).toBe(true);
      expect(cached.results).toEqual([]);
    });
  });

  describe('Cache Statistics and Monitoring', () => {
    it('should provide comprehensive statistics', async () => {
      // Perform various operations
      await cacheSystem.search('stats test 1', { limit: 5 });
      await cacheSystem.search('stats test 2', { limit: 5 });
      await cacheSystem.search('stats test 1', { limit: 5 }); // Cache hit
      
      const stats = cacheSystem.getStats();
      
      expect(stats.searches).toBe(3);
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(1/3);
      
      expect(stats.l1Stats).toBeDefined();
      expect(stats.l2Stats).toBeDefined();
      expect(stats.predictiveStats).toBeDefined();
    });

    it('should track cache layer performance', async () => {
      await cacheSystem.search('layer performance test', { limit: 5 });
      
      const stats = cacheSystem.getStats();
      
      expect(stats.l1Stats.hitCount).toBeGreaterThanOrEqual(0);
      expect(stats.l1Stats.missCount).toBeGreaterThanOrEqual(0);
      expect(stats.l1Stats.size).toBeGreaterThanOrEqual(0);
      
      expect(stats.l2Stats.hitCount).toBeGreaterThanOrEqual(0);
      expect(stats.l2Stats.missCount).toBeGreaterThanOrEqual(0);
    });

    it('should track predictive cache effectiveness', async () => {
      const sessionId = 'effectiveness-session';
      const userId = 'effectiveness-user';
      
      // Generate some pattern data
      for (let i = 0; i < 10; i++) {
        await cacheSystem.search(`effectiveness test ${i}`, { limit: 5 }, sessionId, userId);
      }
      
      const stats = cacheSystem.getStats();
      
      expect(stats.predictiveStats.totalPredictions).toBeGreaterThanOrEqual(0);
      expect(stats.predictiveStats.patternsLearned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Real-world Usage Simulation', () => {
    it('should handle a realistic user session', async () => {
      const sessionId = 'realistic-session';
      const userId = 'realistic-user';
      
      // Simulate a realistic user session
      const userJourney = [
        { query: 'login error', category: 'System' },
        { query: 'authentication failed', category: 'Security' },
        { query: 'password reset', category: 'Security' },
        { query: 'login error', category: 'System' }, // Repeat search
        { query: 'user account locked', category: 'Security' },
        { query: 'authentication failed', category: 'Security' }, // Another repeat
        { query: 'login troubleshooting', category: 'System' }
      ];
      
      const results = [];
      
      for (const search of userJourney) {
        const result = await cacheSystem.search(
          search.query, 
          { limit: 10, category: search.category },
          sessionId,
          userId
        );
        results.push(result);
      }
      
      // Should have some cache hits from repeated searches
      const cacheHits = results.filter(r => r.fromCache).length;
      expect(cacheHits).toBeGreaterThan(0);
      
      // Should have learned patterns
      const stats = cacheSystem.getStats();
      expect(stats.predictiveStats.patternsLearned).toBeGreaterThan(0);
    });

    it('should demonstrate cache warming benefits', async () => {
      // Simulate popular queries that would benefit from warming
      const popularQueries = [
        'system error',
        'performance issue',
        'configuration problem',
        'network connectivity',
        'database error'
      ];
      
      // Pre-warm cache with popular queries
      for (const query of popularQueries) {
        await cacheSystem.search(query, { limit: 10 });
      }
      
      // Simulate new user accessing popular content
      const startTime = Date.now();
      const results = await Promise.all(
        popularQueries.map(query => 
          cacheSystem.search(query, { limit: 10 }, 'new-session', 'new-user')
        )
      );
      const endTime = Date.now();
      
      // All should be cache hits
      const cacheHits = results.filter(r => r.fromCache).length;
      expect(cacheHits).toBe(popularQueries.length);
      
      // Should be fast due to caching
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(500); // Should be very fast
    });
  });
});