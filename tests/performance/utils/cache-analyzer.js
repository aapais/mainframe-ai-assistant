/**
 * Cache Analyzer Utility
 * Analyzes cache performance and hit rates
 */

class CacheAnalyzer {
  constructor() {
    this.reset();
  }

  reset() {
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitsByQuery: new Map(),
      missesByQuery: new Map(),
      hitRateHistory: [],
      timeToLive: new Map(),
      evictions: 0
    };
    this.startTime = Date.now();
  }

  recordCacheAccess(query, hit, responseTime, metadata = {}) {
    this.metrics.totalRequests++;
    
    if (hit) {
      this.metrics.cacheHits++;
      this.updateQueryMetrics(this.metrics.hitsByQuery, query, responseTime);
    } else {
      this.metrics.cacheMisses++;
      this.updateQueryMetrics(this.metrics.missesByQuery, query, responseTime);
    }
    
    // Record hit rate at regular intervals
    if (this.metrics.totalRequests % 100 === 0) {
      this.recordHitRateSnapshot();
    }
    
    // Track TTL if provided
    if (metadata.ttl) {
      this.metrics.timeToLive.set(query, metadata.ttl);
    }
    
    // Track evictions
    if (metadata.evicted) {
      this.metrics.evictions++;
    }
  }

  updateQueryMetrics(map, query, responseTime) {
    if (!map.has(query)) {
      map.set(query, {
        count: 0,
        totalResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        firstSeen: Date.now(),
        lastSeen: Date.now()
      });
    }
    
    const metrics = map.get(query);
    metrics.count++;
    metrics.totalResponseTime += responseTime;
    metrics.minResponseTime = Math.min(metrics.minResponseTime, responseTime);
    metrics.maxResponseTime = Math.max(metrics.maxResponseTime, responseTime);
    metrics.lastSeen = Date.now();
  }

  recordHitRateSnapshot() {
    const currentHitRate = this.getCurrentHitRate();
    this.metrics.hitRateHistory.push({
      timestamp: Date.now(),
      hitRate: currentHitRate,
      totalRequests: this.metrics.totalRequests
    });
  }

  getCurrentHitRate() {
    if (this.metrics.totalRequests === 0) return 0;
    return (this.metrics.cacheHits / this.metrics.totalRequests) * 100;
  }

  getHitRateOverTime(windowMs = 60000) {
    const now = Date.now();
    const cutoff = now - windowMs;
    
    return this.metrics.hitRateHistory
      .filter(snapshot => snapshot.timestamp >= cutoff)
      .map(snapshot => ({
        timestamp: snapshot.timestamp,
        hitRate: snapshot.hitRate,
        relativeTime: snapshot.timestamp - this.startTime
      }));
  }

  analyzeQueryPatterns() {
    const patterns = {
      mostCachedQueries: this.getTopQueries(this.metrics.hitsByQuery, 10),
      leastCachedQueries: this.getTopQueries(this.metrics.missesByQuery, 10),
      repeatQueries: this.getRepeatQueries(),
      uniqueQueries: this.getUniqueQueries(),
      queryDistribution: this.getQueryDistribution()
    };
    
    return patterns;
  }

  getTopQueries(queryMap, limit = 10) {
    return Array.from(queryMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([query, metrics]) => ({
        query,
        count: metrics.count,
        averageResponseTime: metrics.totalResponseTime / metrics.count,
        frequency: (metrics.count / this.metrics.totalRequests) * 100
      }));
  }

  getRepeatQueries() {
    const repeatHits = Array.from(this.metrics.hitsByQuery.entries())
      .filter(([_, metrics]) => metrics.count > 1);
    
    const repeatMisses = Array.from(this.metrics.missesByQuery.entries())
      .filter(([_, metrics]) => metrics.count > 1);
    
    return {
      hitRepeats: repeatHits.length,
      missRepeats: repeatMisses.length,
      totalRepeats: repeatHits.length + repeatMisses.length
    };
  }

  getUniqueQueries() {
    const uniqueHits = Array.from(this.metrics.hitsByQuery.entries())
      .filter(([_, metrics]) => metrics.count === 1);
    
    const uniqueMisses = Array.from(this.metrics.missesByQuery.entries())
      .filter(([_, metrics]) => metrics.count === 1);
    
    return {
      hitUniques: uniqueHits.length,
      missUniques: uniqueMisses.length,
      totalUniques: uniqueHits.length + uniqueMisses.length
    };
  }

  getQueryDistribution() {
    const allQueries = new Map();
    
    // Combine hits and misses
    for (const [query, hitMetrics] of this.metrics.hitsByQuery.entries()) {
      allQueries.set(query, {
        hits: hitMetrics.count,
        misses: this.metrics.missesByQuery.get(query)?.count || 0
      });
    }
    
    for (const [query, missMetrics] of this.metrics.missesByQuery.entries()) {
      if (!allQueries.has(query)) {
        allQueries.set(query, {
          hits: 0,
          misses: missMetrics.count
        });
      }
    }
    
    // Calculate hit rates per query
    const queryHitRates = Array.from(allQueries.entries())
      .map(([query, stats]) => {
        const total = stats.hits + stats.misses;
        return {
          query,
          hits: stats.hits,
          misses: stats.misses,
          total,
          hitRate: (stats.hits / total) * 100
        };
      })
      .sort((a, b) => b.hitRate - a.hitRate);
    
    return queryHitRates;
  }

  predictCacheEffectiveness(queryPattern) {
    const { repetitionRate, uniqueQueryRate, queryVolume } = queryPattern;
    
    // Predict based on repetition patterns
    const predictedHitRate = Math.min(95, repetitionRate * 90);
    
    // Adjust for cache size limitations
    const cacheCapacityFactor = Math.min(1, 1000 / (queryVolume * uniqueQueryRate));
    const adjustedHitRate = predictedHitRate * cacheCapacityFactor;
    
    return {
      predictedHitRate: adjustedHitRate,
      confidence: this.calculatePredictionConfidence(queryPattern),
      factors: {
        repetitionRate,
        uniqueQueryRate,
        queryVolume,
        cacheCapacityFactor
      }
    };
  }

  calculatePredictionConfidence(pattern) {
    // Higher confidence for patterns with more data
    const volumeConfidence = Math.min(1, pattern.queryVolume / 1000);
    
    // Higher confidence for clear patterns (very high or very low repetition)
    const clarityConfidence = Math.abs(pattern.repetitionRate - 0.5) * 2;
    
    return (volumeConfidence + clarityConfidence) / 2;
  }

  analyzeCacheTemporalPatterns() {
    const timeWindows = [1000, 5000, 10000, 30000, 60000]; // ms
    const temporalAnalysis = {};
    
    timeWindows.forEach(window => {
      const hitRateData = this.getHitRateOverTime(window);
      
      if (hitRateData.length > 1) {
        const hitRates = hitRateData.map(d => d.hitRate);
        
        temporalAnalysis[`${window}ms`] = {
          average: hitRates.reduce((a, b) => a + b) / hitRates.length,
          min: Math.min(...hitRates),
          max: Math.max(...hitRates),
          variance: this.calculateVariance(hitRates),
          trend: this.calculateTrend(hitRateData)
        };
      }
    });
    
    return temporalAnalysis;
  }

  calculateVariance(values) {
    const mean = values.reduce((a, b) => a + b) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b) / squaredDiffs.length;
  }

  calculateTrend(timeSeriesData) {
    if (timeSeriesData.length < 2) return 'insufficient_data';
    
    const first = timeSeriesData[0].hitRate;
    const last = timeSeriesData[timeSeriesData.length - 1].hitRate;
    const change = last - first;
    
    if (Math.abs(change) < 1) return 'stable';
    return change > 0 ? 'improving' : 'declining';
  }

  generateCacheReport() {
    const currentHitRate = this.getCurrentHitRate();
    const queryPatterns = this.analyzeQueryPatterns();
    const temporalPatterns = this.analyzeCacheTemporalPatterns();
    
    return {
      timestamp: new Date().toISOString(),
      testDuration: Date.now() - this.startTime,
      
      summary: {
        totalRequests: this.metrics.totalRequests,
        cacheHits: this.metrics.cacheHits,
        cacheMisses: this.metrics.cacheMisses,
        currentHitRate,
        evictions: this.metrics.evictions,
        passed: currentHitRate >= 90
      },
      
      queryPatterns,
      temporalPatterns,
      
      performance: {
        hitRateHistory: this.metrics.hitRateHistory,
        uniqueQueriesCount: this.metrics.hitsByQuery.size + this.metrics.missesByQuery.size,
        averageHitRateStability: this.calculateVariance(
          this.metrics.hitRateHistory.map(h => h.hitRate)
        )
      },
      
      recommendations: this.generateRecommendations(currentHitRate, queryPatterns)
    };
  }

  generateRecommendations(hitRate, patterns) {
    const recommendations = [];
    
    if (hitRate < 90) {
      recommendations.push({
        type: 'hit_rate_low',
        priority: 'high',
        message: `Hit rate ${hitRate.toFixed(1)}% is below 90% target`,
        suggestions: [
          'Increase cache size',
          'Optimize cache TTL settings',
          'Implement query normalization',
          'Add cache warming strategies'
        ]
      });
    }
    
    if (this.metrics.evictions > this.metrics.totalRequests * 0.1) {
      recommendations.push({
        type: 'high_eviction_rate',
        priority: 'medium',
        message: 'High cache eviction rate detected',
        suggestions: [
          'Increase cache capacity',
          'Implement LRU eviction policy',
          'Analyze query frequency patterns'
        ]
      });
    }
    
    const uniqueRate = (patterns.uniqueQueries.totalUniques / this.metrics.totalRequests) * 100;
    if (uniqueRate > 70) {
      recommendations.push({
        type: 'high_unique_queries',
        priority: 'medium',
        message: `${uniqueRate.toFixed(1)}% of queries are unique`,
        suggestions: [
          'Implement query generalization',
          'Add query suggestion features',
          'Optimize cache for unique query patterns'
        ]
      });
    }
    
    return recommendations;
  }

  async clearCache() {
    // Simulate cache clearing
    this.reset();
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

module.exports = CacheAnalyzer;
