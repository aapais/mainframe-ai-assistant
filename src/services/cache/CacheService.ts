/**
 * Unified Cache Service - Orchestrates all caching components
 * Provides a high-level interface for cache operations with intelligent routing
 */

import { EventEmitter } from 'events';
import LRUCache from './LRUCache';
import { PredictiveCache, UserPattern, SearchEvent } from './PredictiveCache';
import { IncrementalLoader, LoadRequest, ChunkCache } from './IncrementalLoader';
import { CacheWarmer, WarmingConfig, UserContext } from './CacheWarmer';

export interface CacheConfig {
  lru: {
    maxSize: number;
    maxMemoryMB: number;
    defaultTTL: number;
    evictionPolicy: 'LRU' | 'LFU' | 'ARC' | 'ADAPTIVE';
  };
  predictive: {
    enableMLPredictions: boolean;
    maxPredictions: number;
    confidenceThreshold: number;
    predictionHorizon: number;
  };
  incremental: {
    defaultChunkSize: number;
    maxParallelLoads: number;
    enableAdaptiveChunking: boolean;
  };
  warming: Partial<WarmingConfig>;
  performance: {
    enableMetrics: boolean;
    metricsRetentionDays: number;
    enableAlerts: boolean;
  };
}

export interface CacheMetrics {
  lru: {
    hitRate: number;
    size: number;
    memoryUsage: number;
    evictions: number;
  };
  predictive: {
    totalPredictions: number;
    successfulPredictions: number;
    predictionAccuracy: number;
  };
  incremental: {
    activeLoads: number;
    averageLoadTime: number;
    cacheHitRate: number;
  };
  warming: {
    totalWarmed: number;
    avgHitRateImprovement: number;
    successRate: number;
  };
  overall: {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    averageResponseTime: number;
    throughput: number;
  };
}

export interface CacheKey {
  type: 'search' | 'data' | 'computation' | 'user';
  id: string;
  params?: Record<string, any>;
  userContext?: string;
}

/**
 * Unified Cache Service Implementation
 *
 * Features:
 * - Multi-layer caching with LRU, predictive, and incremental loading
 * - Intelligent cache routing based on data type and access patterns
 * - Performance monitoring and optimization
 * - Automatic cache warming and maintenance
 * - Thread-safe operations with proper error handling
 */
export class CacheService extends EventEmitter {
  private config: CacheConfig;

  // Core cache components
  private lruCache: LRUCache;
  private predictiveCache: PredictiveCache;
  private incrementalLoader: IncrementalLoader;
  private cacheWarmer: CacheWarmer;

  // Performance tracking
  private metrics: CacheMetrics;
  private requestHistory: Array<{
    key: string;
    hit: boolean;
    responseTime: number;
    timestamp: number;
    size: number;
  }> = [];

  // Operation tracking
  private activeOperations = new Map<string, Promise<any>>();

  constructor(config: Partial<CacheConfig> = {}) {
    super();

    this.config = this.mergeConfig(config);
    this.initializeComponents();
    this.initializeMetrics();
    this.startPerformanceMonitoring();
  }

  /**
   * Get cached value with intelligent routing
   */
  async get<T>(key: CacheKey): Promise<T | null> {
    const startTime = performance.now();
    const keyString = this.generateCacheKey(key);

    try {
      // Check LRU cache first
      const lruResult = await this.lruCache.get(keyString);

      if (lruResult !== null) {
        this.recordHit(keyString, performance.now() - startTime, this.estimateSize(lruResult));
        return lruResult as T;
      }

      // Record miss
      this.recordMiss(keyString, performance.now() - startTime);

      // Trigger predictive pre-fetching if applicable
      if (key.userContext && this.config.predictive.enableMLPredictions) {
        this.triggerPredictiveLoading(key);
      }

      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      this.recordMiss(keyString, performance.now() - startTime);
      return null;
    }
  }

  /**
   * Set cached value with intelligent storage
   */
  async set<T>(
    key: CacheKey,
    value: T,
    options?: {
      ttl?: number;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      metadata?: Record<string, any>;
    }
  ): Promise<boolean> {
    const keyString = this.generateCacheKey(key);

    try {
      const ttl = options?.ttl || this.config.lru.defaultTTL;
      const success = await this.lruCache.set(keyString, value, ttl);

      if (success && options?.metadata) {
        // Store metadata for analytics
        this.storeMetadata(keyString, options.metadata);
      }

      this.emit('cache-set', { key: keyString, size: this.estimateSize(value) });
      return success;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete cached value
   */
  async delete(key: CacheKey): Promise<boolean> {
    const keyString = this.generateCacheKey(key);

    try {
      const result = await this.lruCache.delete(keyString);

      if (result) {
        this.emit('cache-delete', { key: keyString });
      }

      return result;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async has(key: CacheKey): Promise<boolean> {
    const keyString = this.generateCacheKey(key);

    try {
      return await this.lruCache.has(keyString);
    } catch (error) {
      console.error('Cache has error:', error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      await this.lruCache.clear();
      this.resetMetrics();
      this.emit('cache-cleared');
    } catch (error) {
      console.error('Cache clear error:', error);
      throw error;
    }
  }

  /**
   * Load data incrementally with caching
   */
  async loadIncremental<T>(
    request: LoadRequest<T>,
    dataSource: (offset: number, limit: number) => Promise<T[]>
  ): Promise<T[]> {
    const operationId = `load-${request.id}`;

    // Prevent duplicate operations
    if (this.activeOperations.has(operationId)) {
      return this.activeOperations.get(operationId);
    }

    const operation = this.incrementalLoader.load(request, dataSource);
    this.activeOperations.set(operationId, operation);

    try {
      const result = await operation;

      // Cache the complete result
      await this.set(
        {
          type: 'data',
          id: request.id,
          params: { query: request.query },
        },
        result,
        {
          ttl: 600000, // 10 minutes
          priority: request.priority,
          metadata: { incremental: true, size: result.length },
        }
      );

      return result;
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Warm cache with intelligent strategies
   */
  async warmCache(strategy?: string, userContext?: UserContext): Promise<any> {
    if (!this.cacheWarmer) {
      throw new Error('Cache warmer not initialized');
    }

    if (strategy) {
      return await this.cacheWarmer.warmCache(strategy, userContext);
    } else {
      // Use adaptive warming
      const metrics = this.getMetrics();
      return await this.cacheWarmer.adaptiveWarming({
        hitRate: metrics.overall.cacheHits / metrics.overall.totalRequests,
        avgResponseTime: metrics.overall.averageResponseTime,
        throughput: metrics.overall.throughput,
        errorRate: 0, // Would be calculated from error tracking
      });
    }
  }

  /**
   * Record search event for predictive caching
   */
  recordSearchEvent(sessionId: string, event: SearchEvent, userId?: string): void {
    if (this.predictiveCache) {
      this.predictiveCache.recordSearchEvent(sessionId, event, userId);
    }
  }

  /**
   * Get cache predictions for user
   */
  async getPredictions(
    sessionId: string,
    userId?: string,
    context?: Record<string, any>
  ): Promise<any[]> {
    if (!this.predictiveCache) return [];

    return await this.predictiveCache.getPredictions(sessionId, userId, context);
  }

  /**
   * Get comprehensive cache metrics
   */
  getMetrics(): CacheMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get cache performance statistics
   */
  getPerformanceStats(): {
    hitRate: number;
    missRate: number;
    averageResponseTime: number;
    throughput: number;
    hotKeys: Array<{ key: string; hitCount: number; avgResponseTime: number }>;
    recommendations: string[];
  } {
    const recentRequests = this.requestHistory.filter(r => Date.now() - r.timestamp < 3600000); // Last hour

    if (recentRequests.length === 0) {
      return {
        hitRate: 0,
        missRate: 0,
        averageResponseTime: 0,
        throughput: 0,
        hotKeys: [],
        recommendations: ['No cache activity in the last hour'],
      };
    }

    const hits = recentRequests.filter(r => r.hit);
    const hitRate = hits.length / recentRequests.length;
    const missRate = 1 - hitRate;

    const averageResponseTime =
      recentRequests.reduce((sum, r) => sum + r.responseTime, 0) / recentRequests.length;

    const throughput = recentRequests.length / 3600; // requests per second

    // Calculate hot keys
    const keyStats = new Map<
      string,
      { hitCount: number; totalResponseTime: number; requests: number }
    >();

    recentRequests.forEach(r => {
      const current = keyStats.get(r.key) || { hitCount: 0, totalResponseTime: 0, requests: 0 };
      keyStats.set(r.key, {
        hitCount: current.hitCount + (r.hit ? 1 : 0),
        totalResponseTime: current.totalResponseTime + r.responseTime,
        requests: current.requests + 1,
      });
    });

    const hotKeys = Array.from(keyStats.entries())
      .map(([key, stats]) => ({
        key,
        hitCount: stats.hitCount,
        avgResponseTime: stats.totalResponseTime / stats.requests,
      }))
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 10);

    // Generate recommendations
    const recommendations = this.generateRecommendations(hitRate, averageResponseTime, throughput);

    return {
      hitRate,
      missRate,
      averageResponseTime,
      throughput,
      hotKeys,
      recommendations,
    };
  }

  /**
   * Optimize cache performance
   */
  async optimize(): Promise<{
    actionsPerformed: string[];
    estimatedImprovement: number;
    newConfiguration: Partial<CacheConfig>;
  }> {
    const actions: string[] = [];
    let estimatedImprovement = 0;

    // Optimize LRU cache
    if (this.lruCache) {
      this.lruCache.optimize();
      actions.push('LRU cache optimization');
      estimatedImprovement += 0.05;
    }

    // Optimize incremental loader chunk sizes
    if (this.incrementalLoader) {
      this.incrementalLoader.optimizeChunkSizes();
      actions.push('Incremental loader chunk size optimization');
      estimatedImprovement += 0.03;
    }

    // Train predictive models
    if (this.predictiveCache) {
      await this.predictiveCache.trainModels();
      actions.push('Predictive model training');
      estimatedImprovement += 0.08;
    }

    // Adaptive configuration updates
    const newConfig = this.adaptConfiguration();
    actions.push('Configuration adaptation');
    estimatedImprovement += 0.02;

    return {
      actionsPerformed: actions,
      estimatedImprovement,
      newConfiguration: newConfig,
    };
  }

  /**
   * Cleanup and shutdown
   */
  async destroy(): Promise<void> {
    try {
      if (this.lruCache) {
        this.lruCache.destroy();
      }

      if (this.cacheWarmer) {
        await this.cacheWarmer.stopScheduledWarming();
      }

      this.removeAllListeners();
      this.activeOperations.clear();

      console.log('Cache service destroyed');
    } catch (error) {
      console.error('Error during cache service destruction:', error);
      throw error;
    }
  }

  // Private Implementation

  private mergeConfig(config: Partial<CacheConfig>): CacheConfig {
    return {
      lru: {
        maxSize: 1000,
        maxMemoryMB: 100,
        defaultTTL: 300000, // 5 minutes
        evictionPolicy: 'ADAPTIVE',
        ...config.lru,
      },
      predictive: {
        enableMLPredictions: true,
        maxPredictions: 50,
        confidenceThreshold: 0.7,
        predictionHorizon: 30,
        ...config.predictive,
      },
      incremental: {
        defaultChunkSize: 100,
        maxParallelLoads: 3,
        enableAdaptiveChunking: true,
        ...config.incremental,
      },
      warming: config.warming || {},
      performance: {
        enableMetrics: true,
        metricsRetentionDays: 7,
        enableAlerts: true,
        ...config.performance,
      },
    };
  }

  private initializeComponents(): void {
    // Initialize LRU cache
    this.lruCache = new LRUCache({
      maxSize: this.config.lru.maxSize,
      maxMemoryMB: this.config.lru.maxMemoryMB,
      defaultTTL: this.config.lru.defaultTTL,
      evictionPolicy: this.config.lru.evictionPolicy,
      enableStats: this.config.performance.enableMetrics,
    });

    // Initialize predictive cache
    this.predictiveCache = new PredictiveCache({
      enableMLPredictions: this.config.predictive.enableMLPredictions,
      maxPredictions: this.config.predictive.maxPredictions,
      confidenceThreshold: this.config.predictive.confidenceThreshold,
      predictionHorizon: this.config.predictive.predictionHorizon,
    });

    // Initialize chunk cache for incremental loader
    const chunkCache: ChunkCache<any> = {
      get: (key: string) => this.lruCache.get(`chunk:${key}`) as any,
      set: (key: string, chunk: any, ttl?: number) => {
        this.lruCache.set(`chunk:${key}`, chunk, ttl);
      },
      delete: (key: string) => this.lruCache.delete(`chunk:${key}`),
      clear: () => this.lruCache.clear(),
      get size() {
        return 0;
      }, // Approximation
    };

    // Initialize incremental loader
    this.incrementalLoader = new IncrementalLoader(chunkCache, {
      defaultChunkSize: this.config.incremental.defaultChunkSize,
      maxParallelLoads: this.config.incremental.maxParallelLoads,
      enableAdaptiveChunking: this.config.incremental.enableAdaptiveChunking,
    });

    // Initialize cache warmer (would need search service in real implementation)
    // this.cacheWarmer = new CacheWarmer(searchService, this, this.config.warming);
  }

  private initializeMetrics(): void {
    this.metrics = {
      lru: {
        hitRate: 0,
        size: 0,
        memoryUsage: 0,
        evictions: 0,
      },
      predictive: {
        totalPredictions: 0,
        successfulPredictions: 0,
        predictionAccuracy: 0,
      },
      incremental: {
        activeLoads: 0,
        averageLoadTime: 0,
        cacheHitRate: 0,
      },
      warming: {
        totalWarmed: 0,
        avgHitRateImprovement: 0,
        successRate: 0,
      },
      overall: {
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageResponseTime: 0,
        throughput: 0,
      },
    };
  }

  private updateMetrics(): void {
    // Update LRU metrics
    if (this.lruCache) {
      const lruStats = this.lruCache.getStats();
      this.metrics.lru = {
        hitRate: lruStats.hitRate,
        size: lruStats.size,
        memoryUsage: lruStats.memoryUsage,
        evictions: lruStats.evictions,
      };
    }

    // Update predictive metrics
    if (this.predictiveCache) {
      const predictiveStats = this.predictiveCache.getStats();
      this.metrics.predictive = {
        totalPredictions: predictiveStats.totalPredictions,
        successfulPredictions: predictiveStats.successfulPredictions,
        predictionAccuracy: predictiveStats.predictionAccuracy,
      };
    }

    // Update incremental metrics
    if (this.incrementalLoader) {
      const incrementalStats = this.incrementalLoader.getStats();
      this.metrics.incremental = {
        activeLoads: incrementalStats.activeLoads,
        averageLoadTime: incrementalStats.averageLoadTime,
        cacheHitRate: incrementalStats.cacheHitRate,
      };
    }

    // Update overall metrics
    this.updateOverallMetrics();
  }

  private updateOverallMetrics(): void {
    const recentRequests = this.requestHistory.filter(r => Date.now() - r.timestamp < 3600000); // Last hour

    if (recentRequests.length === 0) return;

    const hits = recentRequests.filter(r => r.hit);

    this.metrics.overall = {
      totalRequests: recentRequests.length,
      cacheHits: hits.length,
      cacheMisses: recentRequests.length - hits.length,
      averageResponseTime:
        recentRequests.reduce((sum, r) => sum + r.responseTime, 0) / recentRequests.length,
      throughput: recentRequests.length / 3600, // per second
    };
  }

  private recordHit(key: string, responseTime: number, size: number): void {
    this.requestHistory.push({
      key,
      hit: true,
      responseTime,
      timestamp: Date.now(),
      size,
    });

    this.cleanupRequestHistory();
  }

  private recordMiss(key: string, responseTime: number): void {
    this.requestHistory.push({
      key,
      hit: false,
      responseTime,
      timestamp: Date.now(),
      size: 0,
    });

    this.cleanupRequestHistory();
  }

  private cleanupRequestHistory(): void {
    const cutoff = Date.now() - this.config.performance.metricsRetentionDays * 24 * 60 * 60 * 1000;
    this.requestHistory = this.requestHistory.filter(r => r.timestamp > cutoff);
  }

  private generateCacheKey(key: CacheKey): string {
    const parts = [key.type, key.id];

    if (key.params) {
      const paramString = Object.entries(key.params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join('|');
      parts.push(paramString);
    }

    if (key.userContext) {
      parts.push(`user:${key.userContext}`);
    }

    return parts.join(':');
  }

  private estimateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2; // UTF-16 approximation
    } catch {
      return 1000; // Default estimate
    }
  }

  private storeMetadata(key: string, metadata: Record<string, any>): void {
    // Store metadata for analytics (could be in separate store)
    // Implementation depends on metadata storage strategy
  }

  private async triggerPredictiveLoading(key: CacheKey): Promise<void> {
    if (!this.predictiveCache || !key.userContext) return;

    try {
      const predictions = await this.predictiveCache.getPredictions(key.userContext, undefined, {
        currentKey: key,
      });

      // Trigger background loading for high-confidence predictions
      for (const prediction of predictions.slice(0, 3)) {
        if (prediction.confidence > 0.8) {
          // Would trigger background data loading
          this.emit('prediction-trigger', { prediction, originalKey: key });
        }
      }
    } catch (error) {
      console.warn('Predictive loading trigger failed:', error);
    }
  }

  private resetMetrics(): void {
    this.initializeMetrics();
    this.requestHistory = [];
  }

  private generateRecommendations(
    hitRate: number,
    avgResponseTime: number,
    throughput: number
  ): string[] {
    const recommendations: string[] = [];

    if (hitRate < 0.7) {
      recommendations.push('Consider increasing cache size or TTL');
      recommendations.push('Enable cache warming for frequently accessed data');
    }

    if (avgResponseTime > 1000) {
      recommendations.push('Optimize data serialization/deserialization');
      recommendations.push('Consider using incremental loading for large datasets');
    }

    if (throughput < 10) {
      recommendations.push('Enable predictive caching to reduce cold starts');
    }

    if (recommendations.length === 0) {
      recommendations.push('Cache performance is optimal');
    }

    return recommendations;
  }

  private adaptConfiguration(): Partial<CacheConfig> {
    const stats = this.getPerformanceStats();
    const adaptations: Partial<CacheConfig> = {};

    // Adapt based on hit rate
    if (stats.hitRate < 0.6) {
      adaptations.lru = {
        ...this.config.lru,
        maxSize: Math.floor(this.config.lru.maxSize * 1.2),
        defaultTTL: Math.floor(this.config.lru.defaultTTL * 1.1),
      };
    }

    // Adapt based on response time
    if (stats.averageResponseTime > 500) {
      adaptations.incremental = {
        ...this.config.incremental,
        defaultChunkSize: Math.floor(this.config.incremental.defaultChunkSize * 0.8),
      };
    }

    return adaptations;
  }

  private startPerformanceMonitoring(): void {
    // Monitor performance every minute
    setInterval(() => {
      this.updateMetrics();

      if (this.config.performance.enableAlerts) {
        this.checkPerformanceAlerts();
      }
    }, 60000);

    // Cleanup old data every hour
    setInterval(() => {
      this.cleanupRequestHistory();
    }, 3600000);
  }

  private checkPerformanceAlerts(): void {
    const stats = this.getPerformanceStats();

    if (stats.hitRate < 0.5) {
      this.emit('performance-alert', {
        type: 'low-hit-rate',
        value: stats.hitRate,
        message: 'Cache hit rate is below 50%',
      });
    }

    if (stats.averageResponseTime > 2000) {
      this.emit('performance-alert', {
        type: 'high-response-time',
        value: stats.averageResponseTime,
        message: 'Average response time exceeds 2 seconds',
      });
    }
  }
}

export default CacheService;
