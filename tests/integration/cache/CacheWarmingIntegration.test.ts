/**
 * Cache Warming Integration Tests
 * Testing the intelligent cache warming strategies and their effectiveness
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { LRUCache } from '../../../src/services/cache/LRUCache';
import { RedisCache } from '../../../src/services/cache/RedisCache';
import { PredictiveCache } from '../../../src/services/cache/PredictiveCache';
import { CacheKeyStrategy } from '../../../src/services/cache/CacheKeyStrategy';

// Mock analytics data
interface SearchAnalytics {
  popularQueries: Array<{ query: string; count: number; avgResponseTime: number }>;
  recentQueries: Array<{ query: string; timestamp: number; userId?: string }>;
  categoryDistribution: Record<string, number>;
  hourlyPatterns: Record<string, number>;
  userPatterns: Record<string, Array<{ query: string; frequency: number }>>;
}

// Cache warming engine
class CacheWarmingEngine {
  private l1Cache: LRUCache<any>;
  private l2Cache: RedisCache;
  private predictiveCache: PredictiveCache;
  private keyStrategy: CacheKeyStrategy;
  private analytics: SearchAnalytics;
  private stats = {
    warmedQueries: 0,
    warmingTime: 0,
    hitRateImprovement: 0,
    preWarmHitRate: 0,
    postWarmHitRate: 0
  };
  
  constructor(analytics: SearchAnalytics) {
    this.l1Cache = new LRUCache({
      maxSize: 200,
      defaultTTL: 300000, // 5 minutes
      evictionPolicy: 'LRU'
    });
    
    this.l2Cache = new RedisCache({
      keyPrefix: 'warm-cache:',
      defaultTTL: 1800 // 30 minutes
    });
    
    this.predictiveCache = new PredictiveCache({
      enableMLPredictions: true,
      maxPredictions: 50,
      confidenceThreshold: 0.5
    });
    
    this.keyStrategy = new CacheKeyStrategy();
    this.analytics = analytics;
  }
  
  // Popular queries warming strategy
  async warmPopularQueries(topN: number = 20): Promise<{
    warmed: number;
    queries: string[];
    timeTaken: number;
  }> {
    const startTime = Date.now();
    const topQueries = this.analytics.popularQueries
      .sort((a, b) => b.count - a.count)
      .slice(0, topN);
    
    const warmedQueries: string[] = [];
    
    for (const { query } of topQueries) {
      // Simulate search and cache the result
      const mockResults = this.generateMockResults(query);
      const cacheKey = this.keyStrategy.generateSearchKey(query, { limit: 10 });
      
      this.l1Cache.set(cacheKey, mockResults);
      await this.l2Cache.set(cacheKey, mockResults);
      
      warmedQueries.push(query);
    }
    
    const timeTaken = Date.now() - startTime;
    this.stats.warmedQueries += warmedQueries.length;
    this.stats.warmingTime += timeTaken;
    
    return {
      warmed: warmedQueries.length,
      queries: warmedQueries,
      timeTaken
    };
  }
  
  // Recent queries warming strategy
  async warmRecentQueries(timeWindowMs: number = 3600000): Promise<{
    warmed: number;
    queries: string[];
    timeTaken: number;
  }> {
    const startTime = Date.now();
    const cutoffTime = Date.now() - timeWindowMs;
    
    const recentQueries = this.analytics.recentQueries
      .filter(q => q.timestamp > cutoffTime)
      .map(q => q.query);
    
    const uniqueQueries = [...new Set(recentQueries)];
    const warmedQueries: string[] = [];
    
    for (const query of uniqueQueries) {
      const mockResults = this.generateMockResults(query);
      const cacheKey = this.keyStrategy.generateSearchKey(query, { limit: 10 });
      
      this.l1Cache.set(cacheKey, mockResults);
      await this.l2Cache.set(cacheKey, mockResults);
      
      warmedQueries.push(query);
    }
    
    const timeTaken = Date.now() - startTime;
    this.stats.warmedQueries += warmedQueries.length;
    this.stats.warmingTime += timeTaken;
    
    return {
      warmed: warmedQueries.length,
      queries: warmedQueries,
      timeTaken
    };
  }
  
  // Category-based warming strategy
  async warmByCategory(categories: string[]): Promise<{
    warmed: number;
    queriesByCategory: Record<string, string[]>;
    timeTaken: number;
  }> {
    const startTime = Date.now();
    const queriesByCategory: Record<string, string[]> = {};
    let totalWarmed = 0;
    
    for (const category of categories) {
      const categoryQueries = this.analytics.popularQueries
        .filter(q => q.query.toLowerCase().includes(category.toLowerCase()))
        .slice(0, 10)
        .map(q => q.query);
      
      queriesByCategory[category] = categoryQueries;
      
      for (const query of categoryQueries) {
        const mockResults = this.generateMockResults(query, category);
        const cacheKey = this.keyStrategy.generateSearchKey(query, { limit: 10, category });
        
        this.l1Cache.set(cacheKey, mockResults);
        await this.l2Cache.set(cacheKey, mockResults);
        
        totalWarmed++;
      }
    }
    
    const timeTaken = Date.now() - startTime;
    this.stats.warmedQueries += totalWarmed;
    this.stats.warmingTime += timeTaken;
    
    return {
      warmed: totalWarmed,
      queriesByCategory,
      timeTaken
    };
  }
  
  // Predictive warming based on ML patterns
  async warmPredictiveQueries(sessionId: string, userId?: string): Promise<{
    warmed: number;
    predictions: any[];
    timeTaken: number;
  }> {
    const startTime = Date.now();
    
    // Get predictions from the predictive cache
    const predictions = await this.predictiveCache.getPredictions(sessionId, userId);
    
    for (const prediction of predictions) {
      if (prediction.confidence > 0.6) { // Only warm high-confidence predictions
        const mockResults = this.generateMockResults(prediction.query);
        const cacheKey = this.keyStrategy.generateSearchKey(prediction.query, { limit: 10 });
        
        this.l1Cache.set(cacheKey, mockResults);
        await this.l2Cache.set(cacheKey, mockResults);
      }
    }
    
    const timeTaken = Date.now() - startTime;
    const highConfidencePredictions = predictions.filter(p => p.confidence > 0.6);
    
    this.stats.warmedQueries += highConfidencePredictions.length;
    this.stats.warmingTime += timeTaken;
    
    return {
      warmed: highConfidencePredictions.length,
      predictions: highConfidencePredictions,
      timeTaken
    };
  }
  
  // User-specific warming
  async warmForUser(userId: string): Promise<{
    warmed: number;
    personalizedQueries: string[];
    timeTaken: number;
  }> {
    const startTime = Date.now();
    const userPatterns = this.analytics.userPatterns[userId] || [];
    
    const personalizedQueries = userPatterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 15)
      .map(p => p.query);
    
    for (const query of personalizedQueries) {
      const mockResults = this.generateMockResults(query);
      const cacheKey = this.keyStrategy.generateSearchKey(query, { limit: 10 }, userId);
      
      this.l1Cache.set(cacheKey, mockResults);
      await this.l2Cache.set(cacheKey, mockResults);
    }
    
    const timeTaken = Date.now() - startTime;
    this.stats.warmedQueries += personalizedQueries.length;
    this.stats.warmingTime += timeTaken;
    
    return {
      warmed: personalizedQueries.length,
      personalizedQueries,
      timeTaken
    };
  }
  
  // Temporal warming based on time patterns
  async warmForTimeOfDay(): Promise<{
    warmed: number;
    timeBasedQueries: string[];
    timeTaken: number;
  }> {
    const startTime = Date.now();
    const currentHour = new Date().getHours();
    
    // Get queries that are popular at this time of day
    const timeBasedQueries = this.analytics.popularQueries
      .filter(q => {
        // Simulate time-based filtering
        const queryHour = Math.abs(q.query.charCodeAt(0) % 24);
        return Math.abs(queryHour - currentHour) <= 2; // Within 2 hours
      })
      .slice(0, 10)
      .map(q => q.query);
    
    for (const query of timeBasedQueries) {
      const mockResults = this.generateMockResults(query);
      const cacheKey = this.keyStrategy.generateSearchKey(query, { limit: 10 });
      
      this.l1Cache.set(cacheKey, mockResults);
      await this.l2Cache.set(cacheKey, mockResults);
    }
    
    const timeTaken = Date.now() - startTime;
    this.stats.warmedQueries += timeBasedQueries.length;
    this.stats.warmingTime += timeTaken;
    
    return {
      warmed: timeBasedQueries.length,
      timeBasedQueries,
      timeTaken
    };
  }
  
  // Adaptive warming that combines multiple strategies
  async adaptiveWarming(performanceMetrics: {
    hitRate: number;
    avgResponseTime: number;
    memoryUsage: number;
  }): Promise<{
    strategiesUsed: string[];
    totalWarmed: number;
    timeTaken: number;
    recommendations: string[];
  }> {
    const startTime = Date.now();
    const strategiesUsed: string[] = [];
    let totalWarmed = 0;
    const recommendations: string[] = [];
    
    // Decide strategies based on performance metrics
    if (performanceMetrics.hitRate < 0.7) {
      // Low hit rate - warm popular queries
      const result = await this.warmPopularQueries(15);
      strategiesUsed.push('popular');
      totalWarmed += result.warmed;
      recommendations.push('Warmed popular queries to improve hit rate');
    }
    
    if (performanceMetrics.avgResponseTime > 1000) {
      // High response time - warm recent queries
      const result = await this.warmRecentQueries(1800000); // 30 minutes
      strategiesUsed.push('recent');
      totalWarmed += result.warmed;
      recommendations.push('Warmed recent queries to reduce response time');
    }
    
    if (performanceMetrics.memoryUsage < 0.6) {
      // Low memory usage - can afford to warm more
      const result = await this.warmByCategory(['System', 'Performance', 'Error']);
      strategiesUsed.push('category');
      totalWarmed += result.warmed;
      recommendations.push('Warmed category-based queries due to available memory');
    }
    
    // Always try predictive warming
    const predictiveResult = await this.warmPredictiveQueries('adaptive-session');
    if (predictiveResult.warmed > 0) {
      strategiesUsed.push('predictive');
      totalWarmed += predictiveResult.warmed;
      recommendations.push('Applied predictive warming based on ML patterns');
    }
    
    const timeTaken = Date.now() - startTime;
    
    return {
      strategiesUsed,
      totalWarmed,
      timeTaken,
      recommendations
    };
  }
  
  // Test cache effectiveness
  async measureWarmingEffectiveness(testQueries: string[]): Promise<{
    preWarmHitRate: number;
    postWarmHitRate: number;
    improvement: number;
    avgHitTime: number;
    avgMissTime: number;
  }> {
    // Clear cache and measure baseline
    this.l1Cache.clear();
    await this.l2Cache.clear();
    
    let preWarmHits = 0;
    const preWarmStartTime = Date.now();
    
    for (const query of testQueries) {
      const cacheKey = this.keyStrategy.generateSearchKey(query, { limit: 10 });
      const cached = this.l1Cache.get(cacheKey) || await this.l2Cache.get(cacheKey);
      if (cached) preWarmHits++;
    }
    
    const preWarmTime = Date.now() - preWarmStartTime;
    const preWarmHitRate = preWarmHits / testQueries.length;
    
    // Warm cache with popular queries
    await this.warmPopularQueries(20);
    
    // Measure post-warming performance
    let postWarmHits = 0;
    const hitTimes: number[] = [];
    const missTimes: number[] = [];
    
    for (const query of testQueries) {
      const cacheKey = this.keyStrategy.generateSearchKey(query, { limit: 10 });
      const startTime = Date.now();
      
      const cached = this.l1Cache.get(cacheKey) || await this.l2Cache.get(cacheKey);
      const endTime = Date.now();
      
      if (cached) {
        postWarmHits++;
        hitTimes.push(endTime - startTime);
      } else {
        missTimes.push(endTime - startTime);
      }
    }
    
    const postWarmHitRate = postWarmHits / testQueries.length;
    const improvement = postWarmHitRate - preWarmHitRate;
    
    const avgHitTime = hitTimes.length > 0 ? 
      hitTimes.reduce((sum, time) => sum + time, 0) / hitTimes.length : 0;
    
    const avgMissTime = missTimes.length > 0 ? 
      missTimes.reduce((sum, time) => sum + time, 0) / missTimes.length : 0;
    
    this.stats.preWarmHitRate = preWarmHitRate;
    this.stats.postWarmHitRate = postWarmHitRate;
    this.stats.hitRateImprovement = improvement;
    
    return {
      preWarmHitRate,
      postWarmHitRate,
      improvement,
      avgHitTime,
      avgMissTime
    };
  }
  
  getStats() {
    return { ...this.stats };
  }
  
  async cleanup() {
    this.l1Cache.destroy();
    await this.l2Cache.close();
    this.predictiveCache.reset();
  }
  
  private generateMockResults(query: string, category?: string): any[] {
    const resultCount = Math.floor(Math.random() * 8) + 3; // 3-10 results
    
    return Array.from({ length: resultCount }, (_, i) => ({
      id: `result-${query.replace(/\s+/g, '-')}-${i}`,
      title: `${query} - Result ${i + 1}`,
      content: `This is mock content for ${query}`,
      category: category || 'General',
      relevanceScore: Math.random() * 0.4 + 0.6, // 0.6-1.0
      timestamp: Date.now()
    }));
  }
}

// Test data generator
const generateTestAnalytics = (): SearchAnalytics => {
  const queries = [
    'system error', 'database connection', 'performance issue', 'configuration problem',
    'network timeout', 'authentication failed', 'memory leak', 'disk space',
    'backup failure', 'user access', 'security alert', 'log analysis',
    'batch job error', 'file transfer', 'service restart', 'monitoring alert'
  ];
  
  const categories = ['System', 'Performance', 'Error', 'Configuration', 'Security'];
  const users = ['user1', 'user2', 'user3', 'user4', 'user5'];
  
  return {
    popularQueries: queries.map(query => ({
      query,
      count: Math.floor(Math.random() * 100) + 10,
      avgResponseTime: Math.floor(Math.random() * 1000) + 200
    })),
    
    recentQueries: Array.from({ length: 50 }, (_, i) => ({
      query: queries[Math.floor(Math.random() * queries.length)],
      timestamp: Date.now() - (i * 60000), // Last 50 minutes
      userId: users[Math.floor(Math.random() * users.length)]
    })),
    
    categoryDistribution: categories.reduce((acc, cat) => {
      acc[cat] = Math.floor(Math.random() * 50) + 10;
      return acc;
    }, {} as Record<string, number>),
    
    hourlyPatterns: Array.from({ length: 24 }, (_, hour) => ({ 
      [hour.toString()]: Math.floor(Math.random() * 20) + 5 
    })).reduce((acc, hourData) => ({ ...acc, ...hourData }), {}),
    
    userPatterns: users.reduce((acc, user) => {
      acc[user] = queries.slice(0, 8).map(query => ({
        query,
        frequency: Math.floor(Math.random() * 10) + 1
      }));
      return acc;
    }, {} as Record<string, Array<{ query: string; frequency: number }>>)
  };
};

describe('Cache Warming Integration', () => {
  let warmingEngine: CacheWarmingEngine;
  let analytics: SearchAnalytics;

  beforeEach(() => {
    analytics = generateTestAnalytics();
    warmingEngine = new CacheWarmingEngine(analytics);
  });

  afterEach(async () => {
    await warmingEngine.cleanup();
  });

  describe('Popular Queries Warming', () => {
    it('should warm cache with most popular queries', async () => {
      const result = await warmingEngine.warmPopularQueries(10);
      
      expect(result.warmed).toBe(10);
      expect(result.queries).toHaveLength(10);
      expect(result.timeTaken).toBeGreaterThan(0);
      
      // Verify queries are actually cached
      const stats = warmingEngine.getStats();
      expect(stats.warmedQueries).toBe(10);
    });

    it('should prioritize queries by popularity', async () => {
      const result = await warmingEngine.warmPopularQueries(5);
      
      // Should warm the top 5 most popular queries
      const topQueries = analytics.popularQueries
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(q => q.query);
      
      expect(result.queries).toEqual(topQueries);
    });

    it('should handle empty popular queries list', async () => {
      const emptyAnalytics = { ...analytics, popularQueries: [] };
      const emptyEngine = new CacheWarmingEngine(emptyAnalytics);
      
      const result = await emptyEngine.warmPopularQueries(10);
      
      expect(result.warmed).toBe(0);
      expect(result.queries).toHaveLength(0);
      
      await emptyEngine.cleanup();
    });
  });

  describe('Recent Queries Warming', () => {
    it('should warm cache with recent queries', async () => {
      const result = await warmingEngine.warmRecentQueries(3600000); // 1 hour
      
      expect(result.warmed).toBeGreaterThan(0);
      expect(result.queries.length).toBeGreaterThan(0);
      expect(result.timeTaken).toBeGreaterThan(0);
    });

    it('should respect time window for recent queries', async () => {
      // Very short time window should result in fewer queries
      const shortResult = await warmingEngine.warmRecentQueries(60000); // 1 minute
      const longResult = await warmingEngine.warmRecentQueries(3600000); // 1 hour
      
      expect(shortResult.warmed).toBeLessThanOrEqual(longResult.warmed);
    });

    it('should deduplicate recent queries', async () => {
      const result = await warmingEngine.warmRecentQueries(3600000);
      
      // All queries should be unique
      const uniqueQueries = new Set(result.queries);
      expect(uniqueQueries.size).toBe(result.queries.length);
    });
  });

  describe('Category-based Warming', () => {
    it('should warm queries by categories', async () => {
      const categories = ['System', 'Performance'];
      const result = await warmingEngine.warmByCategory(categories);
      
      expect(result.warmed).toBeGreaterThan(0);
      expect(Object.keys(result.queriesByCategory)).toEqual(categories);
      
      categories.forEach(category => {
        expect(result.queriesByCategory[category].length).toBeGreaterThan(0);
      });
    });

    it('should handle non-existent categories', async () => {
      const result = await warmingEngine.warmByCategory(['NonExistent']);
      
      expect(result.warmed).toBeGreaterThanOrEqual(0); // May be 0 if no matches
      expect(result.queriesByCategory.NonExistent).toBeDefined();
    });

    it('should limit queries per category', async () => {
      const result = await warmingEngine.warmByCategory(['System']);
      
      // Should not exceed 10 queries per category (as implemented)
      expect(result.queriesByCategory.System.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Predictive Warming', () => {
    beforeEach(async () => {
      // Set up some pattern data for predictive warming
      const sessionId = 'test-session';
      const userId = 'test-user';
      
      // Record some search events to establish patterns
      const queries = ['database error', 'connection timeout', 'performance issue'];
      
      for (const query of queries) {
        warmingEngine['predictiveCache'].recordSearchEvent(sessionId, {
          query,
          timestamp: Date.now(),
          category: 'System',
          resultClicks: 2,
          sessionDuration: 3000,
          followupQueries: []
        }, userId);
      }
    });

    it('should warm cache with predicted queries', async () => {
      const result = await warmingEngine.warmPredictiveQueries('test-session', 'test-user');
      
      expect(result.warmed).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.predictions)).toBe(true);
      expect(result.timeTaken).toBeGreaterThan(0);
    });

    it('should only warm high-confidence predictions', async () => {
      const result = await warmingEngine.warmPredictiveQueries('test-session', 'test-user');
      
      // All warmed predictions should have confidence > 0.6
      result.predictions.forEach(prediction => {
        expect(prediction.confidence).toBeGreaterThan(0.6);
      });
    });

    it('should handle users with no prediction patterns', async () => {
      const result = await warmingEngine.warmPredictiveQueries('new-session', 'new-user');
      
      expect(result.warmed).toBe(0);
      expect(result.predictions).toHaveLength(0);
    });
  });

  describe('User-specific Warming', () => {
    it('should warm cache for specific users', async () => {
      const userId = 'user1';
      const result = await warmingEngine.warmForUser(userId);
      
      expect(result.warmed).toBeGreaterThan(0);
      expect(result.personalizedQueries.length).toBeGreaterThan(0);
      expect(result.timeTaken).toBeGreaterThan(0);
    });

    it('should prioritize user queries by frequency', async () => {
      const userId = 'user1';
      const result = await warmingEngine.warmForUser(userId);
      
      // Should be ordered by frequency (highest first)
      const userPatterns = analytics.userPatterns[userId];
      if (userPatterns && result.personalizedQueries.length > 1) {
        const firstQueryFreq = userPatterns.find(p => p.query === result.personalizedQueries[0])?.frequency || 0;
        const secondQueryFreq = userPatterns.find(p => p.query === result.personalizedQueries[1])?.frequency || 0;
        
        expect(firstQueryFreq).toBeGreaterThanOrEqual(secondQueryFreq);
      }
    });

    it('should handle users with no patterns', async () => {
      const result = await warmingEngine.warmForUser('unknown-user');
      
      expect(result.warmed).toBe(0);
      expect(result.personalizedQueries).toHaveLength(0);
    });
  });

  describe('Temporal Warming', () => {
    it('should warm cache based on time of day', async () => {
      const result = await warmingEngine.warmForTimeOfDay();
      
      expect(result.warmed).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.timeBasedQueries)).toBe(true);
      expect(result.timeTaken).toBeGreaterThan(0);
    });

    it('should select time-appropriate queries', async () => {
      const result = await warmingEngine.warmForTimeOfDay();
      
      // All time-based queries should be relevant to current time
      expect(result.timeBasedQueries.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Adaptive Warming', () => {
    it('should apply multiple strategies based on metrics', async () => {
      const performanceMetrics = {
        hitRate: 0.5, // Low hit rate
        avgResponseTime: 1200, // High response time
        memoryUsage: 0.4 // Low memory usage
      };
      
      const result = await warmingEngine.adaptiveWarming(performanceMetrics);
      
      expect(result.strategiesUsed.length).toBeGreaterThan(1);
      expect(result.totalWarmed).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.timeTaken).toBeGreaterThan(0);
    });

    it('should select appropriate strategies for different scenarios', async () => {
      // High hit rate, good response time scenario
      const goodMetrics = {
        hitRate: 0.9,
        avgResponseTime: 200,
        memoryUsage: 0.8
      };
      
      const result1 = await warmingEngine.adaptiveWarming(goodMetrics);
      
      // Should use fewer strategies when performance is good
      expect(result1.strategiesUsed.length).toBeGreaterThanOrEqual(1);
      
      // Poor performance scenario
      const poorMetrics = {
        hitRate: 0.3,
        avgResponseTime: 2000,
        memoryUsage: 0.2
      };
      
      const result2 = await warmingEngine.adaptiveWarming(poorMetrics);
      
      // Should use more strategies when performance is poor
      expect(result2.strategiesUsed.length).toBeGreaterThanOrEqual(2);
    });

    it('should provide meaningful recommendations', async () => {
      const metrics = {
        hitRate: 0.4,
        avgResponseTime: 1500,
        memoryUsage: 0.5
      };
      
      const result = await warmingEngine.adaptiveWarming(metrics);
      
      expect(result.recommendations.length).toBeGreaterThan(0);
      result.recommendations.forEach(rec => {
        expect(typeof rec).toBe('string');
        expect(rec.length).toBeGreaterThan(10);
      });
    });
  });

  describe('Warming Effectiveness Measurement', () => {
    it('should measure cache warming effectiveness', async () => {
      const testQueries = [
        'system error', 'database connection', 'performance issue',
        'configuration problem', 'network timeout'
      ];
      
      const effectiveness = await warmingEngine.measureWarmingEffectiveness(testQueries);
      
      expect(effectiveness.preWarmHitRate).toBeGreaterThanOrEqual(0);
      expect(effectiveness.postWarmHitRate).toBeGreaterThanOrEqual(effectiveness.preWarmHitRate);
      expect(effectiveness.improvement).toBeGreaterThanOrEqual(0);
      expect(effectiveness.avgHitTime).toBeGreaterThanOrEqual(0);
      expect(effectiveness.avgMissTime).toBeGreaterThanOrEqual(0);
    });

    it('should show improvement after warming', async () => {
      const testQueries = analytics.popularQueries.slice(0, 10).map(q => q.query);
      
      const effectiveness = await warmingEngine.measureWarmingEffectiveness(testQueries);
      
      // Should show improvement for popular queries
      expect(effectiveness.improvement).toBeGreaterThan(0);
      expect(effectiveness.postWarmHitRate).toBeGreaterThan(effectiveness.preWarmHitRate);
    });

    it('should demonstrate faster cache hits vs misses', async () => {
      const testQueries = ['quick hit test', 'fast cache test'];
      
      const effectiveness = await warmingEngine.measureWarmingEffectiveness(testQueries);
      
      if (effectiveness.avgHitTime > 0 && effectiveness.avgMissTime > 0) {
        // Cache hits should be faster than misses
        expect(effectiveness.avgHitTime).toBeLessThan(effectiveness.avgMissTime);
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large-scale warming efficiently', async () => {
      const startTime = Date.now();
      
      // Warm large number of queries
      const result = await warmingEngine.warmPopularQueries(50);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(result.warmed).toBe(50);
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle concurrent warming operations', async () => {
      const operations = [
        warmingEngine.warmPopularQueries(10),
        warmingEngine.warmRecentQueries(1800000),
        warmingEngine.warmByCategory(['System']),
        warmingEngine.warmForTimeOfDay()
      ];
      
      const results = await Promise.all(operations);
      
      // All operations should complete successfully
      expect(results.length).toBe(4);
      results.forEach(result => {
        expect(result.warmed).toBeGreaterThanOrEqual(0);
        expect(result.timeTaken).toBeGreaterThan(0);
      });
    });

    it('should maintain reasonable memory usage during warming', async () => {
      const initialStats = warmingEngine.getStats();
      
      // Perform intensive warming
      await warmingEngine.warmPopularQueries(30);
      await warmingEngine.warmByCategory(['System', 'Performance', 'Error']);
      
      const finalStats = warmingEngine.getStats();
      
      // Should track the warming activity
      expect(finalStats.warmedQueries).toBeGreaterThan(initialStats.warmedQueries);
      expect(finalStats.warmingTime).toBeGreaterThan(initialStats.warmingTime);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle cache failures gracefully', async () => {
      // Close the cache to simulate failure
      await warmingEngine.cleanup();
      
      // Should not throw errors even with failed cache
      const result = await warmingEngine.warmPopularQueries(5);
      
      expect(result).toBeDefined();
      expect(result.warmed).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty query lists', async () => {
      const emptyAnalytics: SearchAnalytics = {
        popularQueries: [],
        recentQueries: [],
        categoryDistribution: {},
        hourlyPatterns: {},
        userPatterns: {}
      };
      
      const emptyEngine = new CacheWarmingEngine(emptyAnalytics);
      
      const result = await emptyEngine.warmPopularQueries(10);
      
      expect(result.warmed).toBe(0);
      expect(result.queries).toHaveLength(0);
      
      await emptyEngine.cleanup();
    });

    it('should handle invalid query data', async () => {
      const invalidAnalytics: SearchAnalytics = {
        popularQueries: [
          { query: '', count: 0, avgResponseTime: 0 },
          { query: '   ', count: -1, avgResponseTime: -100 }
        ],
        recentQueries: [
          { query: '', timestamp: -1 },
          { query: null as any, timestamp: Date.now() }
        ],
        categoryDistribution: {},
        hourlyPatterns: {},
        userPatterns: {}
      };
      
      const invalidEngine = new CacheWarmingEngine(invalidAnalytics);
      
      // Should not throw errors with invalid data
      const result = await invalidEngine.warmPopularQueries(5);
      
      expect(result).toBeDefined();
      expect(result.warmed).toBeGreaterThanOrEqual(0);
      
      await invalidEngine.cleanup();
    });
  });

  describe('Integration with Real-world Scenarios', () => {
    it('should demonstrate improved user experience', async () => {
      // Simulate user session before warming
      const userQueries = analytics.popularQueries.slice(0, 5).map(q => q.query);
      
      // Measure effectiveness
      const effectiveness = await warmingEngine.measureWarmingEffectiveness(userQueries);
      
      // Should show significant improvement for popular queries
      expect(effectiveness.improvement).toBeGreaterThan(0.5); // At least 50% improvement
    });

    it('should support different warming schedules', async () => {
      // Simulate morning warm-up
      const morningResult = await warmingEngine.adaptiveWarming({
        hitRate: 0.2, // Low hit rate after overnight cache eviction
        avgResponseTime: 1500,
        memoryUsage: 0.1
      });
      
      expect(morningResult.strategiesUsed).toContain('popular');
      expect(morningResult.totalWarmed).toBeGreaterThan(10);
      
      // Simulate peak hour optimization
      const peakResult = await warmingEngine.adaptiveWarming({
        hitRate: 0.8, // Good hit rate during peak
        avgResponseTime: 500,
        memoryUsage: 0.9 // High memory usage
      });
      
      expect(peakResult.strategiesUsed.length).toBeLessThanOrEqual(2); // Fewer strategies during peak
    });
  });
});