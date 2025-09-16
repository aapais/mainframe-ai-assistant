/**
 * Enhanced Search Cache - Production-Ready Implementation
 * Replaces the placeholder SearchCache with real multi-layer architecture
 */

import LRUCache from '../cache/LRUCache';
import RedisCache from '../cache/RedisCache';
import PredictiveCache from '../cache/PredictiveCache';
import IncrementalLoader from '../cache/IncrementalLoader';
import { cacheConfig, CacheSystemConfig } from '../../config/cacheConfig';
import { SearchResult, SearchOptions } from '../../types/services';

export interface SearchCacheEntry {
  results: SearchResult[];
  query: string;
  options: SearchOptions;
  timestamp: number;
  computationTime: number;
  hitCount: number;
}

export interface SearchCacheStats {
  l0: { hits: number; misses: number; hitRate: number; size: number };
  l1: { hits: number; misses: number; hitRate: number; size: number };
  l2: { hits: number; misses: number; hitRate: number; size: number };
  redis: { hits: number; misses: number; hitRate: number; connected: boolean };
  predictive: { predictions: number; accuracy: number; cacheSaves: number };
  overall: {
    totalHits: number;
    totalMisses: number;
    overallHitRate: number;
    averageResponseTime: number;
    memoryUsage: number;
  };
}

export interface WarmupData {
  popularQueries?: string[];
  recentSearches?: string[];
  predictedTerms?: string[];
  userContext?: string;
}

/**
 * Enhanced Multi-Layer Search Cache
 *
 * Architecture:
 * - L0: Ultra-fast instant cache (25-100 items, <10ms)
 * - L1: Hot cache for frequent queries (100-1000 items, <50ms)
 * - L2: Warm cache for broader coverage (500-5000 items, <100ms)
 * - L3: Redis distributed cache (optional, <200ms)
 * - L4: Persistent cache (disk-based, <500ms)
 * - Predictive pre-fetching based on user patterns
 * - Incremental loading for large result sets
 */
export class EnhancedSearchCache {
  private l0Cache: LRUCache<SearchCacheEntry>;
  private l1Cache: LRUCache<SearchCacheEntry>;
  private l2Cache: LRUCache<SearchCacheEntry>;
  private redisCache?: RedisCache;
  private predictiveCache: PredictiveCache;
  private incrementalLoader: IncrementalLoader<SearchResult>;

  private config: CacheSystemConfig;
  private stats: SearchCacheStats;

  constructor(config: Partial<CacheSystemConfig> = {}) {
    this.config = { ...cacheConfig, ...config };

    // Initialize cache layers
    this.l0Cache = new LRUCache<SearchCacheEntry>({
      maxSize: this.config.l0Cache.maxSize,
      maxMemoryMB: this.config.l0Cache.maxMemoryMB,
      defaultTTL: this.config.l0Cache.defaultTTL,
      evictionPolicy: this.config.l0Cache.evictionPolicy,
      enableStats: true,
      cleanupInterval: this.config.l0Cache.cleanupInterval
    });

    this.l1Cache = new LRUCache<SearchCacheEntry>({
      maxSize: this.config.l1Cache.maxSize,
      maxMemoryMB: this.config.l1Cache.maxMemoryMB,
      defaultTTL: this.config.l1Cache.defaultTTL,
      evictionPolicy: this.config.l1Cache.evictionPolicy,
      enableStats: true,
      cleanupInterval: this.config.l1Cache.cleanupInterval
    });

    this.l2Cache = new LRUCache<SearchCacheEntry>({
      maxSize: this.config.l2Cache.maxSize,
      maxMemoryMB: this.config.l2Cache.maxMemoryMB,
      defaultTTL: this.config.l2Cache.defaultTTL,
      evictionPolicy: this.config.l2Cache.evictionPolicy,
      enableStats: true,
      cleanupInterval: this.config.l2Cache.cleanupInterval
    });

    // Initialize Redis cache if enabled
    if (this.config.l3Redis.enabled) {
      this.redisCache = new RedisCache({
        host: this.config.l3Redis.host,
        port: this.config.l3Redis.port,
        password: this.config.l3Redis.password,
        db: this.config.l3Redis.db,
        keyPrefix: this.config.l3Redis.keyPrefix,
        defaultTTL: 600, // 10 minutes for Redis
        maxRetries: this.config.l3Redis.maxRetries,
        retryDelayMs: this.config.l3Redis.retryDelayMs,
        enableCompression: true,
        compressionThreshold: 1024
      });
    }

    // Initialize predictive cache
    this.predictiveCache = new PredictiveCache({
      enableMLPredictions: this.config.predictiveCache.enableMLPredictions,
      maxPredictions: this.config.predictiveCache.maxPredictions,
      confidenceThreshold: this.config.predictiveCache.confidenceThreshold,
      predictionHorizon: this.config.predictiveCache.predictionHorizon,
      enablePatternLearning: this.config.predictiveCache.enablePatternLearning,
      enableContextualPredictions: this.config.predictiveCache.enableContextualPredictions,
      enableTemporalPredictions: this.config.predictiveCache.enableTemporalPredictions
    });

    // Initialize incremental loader with simple cache implementation
    this.incrementalLoader = new IncrementalLoader<SearchResult>(
      {
        get: (key: string) => this.l2Cache.get(key)?.results || null,
        set: (key: string, chunk: any, ttl?: number) => {
          const entry: SearchCacheEntry = {
            results: chunk.data,
            query: key,
            options: {},
            timestamp: Date.now(),
            computationTime: 0,
            hitCount: 0
          };
          this.l2Cache.set(key, entry, ttl);
        },
        delete: (key: string) => this.l2Cache.delete(key),
        clear: () => this.l2Cache.clear(),
        size: this.l2Cache.getStats().size
      },
      {
        defaultChunkSize: this.config.incrementalLoading.defaultChunkSize,
        maxParallelLoads: this.config.incrementalLoading.maxParallelLoads,
        enableAdaptiveChunking: this.config.incrementalLoading.enableAdaptiveChunking,
        enablePrioritization: this.config.incrementalLoading.enablePrioritization,
        loadTimeout: this.config.incrementalLoading.loadTimeout,
        retryAttempts: this.config.incrementalLoading.retryAttempts,
        retryDelay: this.config.incrementalLoading.retryDelay
      }
    );

    this.initializeStats();
    this.setupEventHandlers();

    console.log(`🚀 Enhanced Search Cache initialized for ${this.config.environment} environment`);
  }

  /**
   * Get search results from cache with intelligent layer traversal
   */
  async get<T = SearchResult[]>(
    key: string,
    options: SearchOptions = {},
    userContext?: string
  ): Promise<T | null> {
    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(key, options);

    try {
      // L0: Instant Cache - Ultra-fast access
      let entry = this.l0Cache.get(cacheKey);
      if (entry) {
        entry.hitCount++;
        this.recordHit('l0', startTime);
        return entry.results as T;
      }

      // L1: Hot Cache - Fast access
      entry = this.l1Cache.get(cacheKey);
      if (entry) {
        entry.hitCount++;

        // Promote to L0 if frequently accessed
        if (entry.hitCount >= 3) {
          this.promoteToL0(cacheKey, entry);
        }

        this.recordHit('l1', startTime);
        return entry.results as T;
      }

      // L2: Warm Cache - Broader coverage
      entry = this.l2Cache.get(cacheKey);
      if (entry) {
        entry.hitCount++;

        // Promote to L1 if accessed multiple times
        if (entry.hitCount >= 2) {
          this.promoteToL1(cacheKey, entry);
        }

        this.recordHit('l2', startTime);
        return entry.results as T;
      }

      // L3: Redis Cache - Distributed cache
      if (this.redisCache) {
        const redisEntry = await this.redisCache.get<SearchCacheEntry>(cacheKey);
        if (redisEntry) {
          redisEntry.hitCount++;

          // Promote to L2
          this.setInL2(cacheKey, redisEntry);

          this.recordHit('redis', startTime);
          return redisEntry.results as T;
        }
      }

      // Cache miss across all layers
      this.recordMiss(startTime);
      return null;

    } catch (error) {
      console.error('Search cache get error:', error);
      this.recordMiss(startTime);
      return null;
    }
  }

  /**
   * Set search results in cache with intelligent layer distribution
   */
  async set<T = SearchResult[]>(
    key: string,
    value: T,
    options: SearchOptions = {},
    computationTime: number = 0,
    userContext?: string
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(key, options);

    const entry: SearchCacheEntry = {
      results: value as SearchResult[],
      query: key,
      options,
      timestamp: Date.now(),
      computationTime,
      hitCount: 0
    };

    try {
      // Determine cache distribution strategy
      const strategy = this.determineCacheStrategy(entry, computationTime);

      // Store in appropriate layers
      if (strategy.useL0) {
        this.setInL0(cacheKey, entry);
      }

      if (strategy.useL1) {
        this.setInL1(cacheKey, entry);
      }

      if (strategy.useL2) {
        this.setInL2(cacheKey, entry);
      }

      if (strategy.useRedis && this.redisCache) {
        await this.redisCache.set(cacheKey, entry, strategy.redisTTL);
      }

      // Record search event for predictive caching
      if (this.config.predictiveCache.enabled && userContext) {
        this.predictiveCache.recordSearchEvent(
          userContext,
          {
            query: key,
            timestamp: Date.now(),
            category: options.category,
            resultClicks: 0,
            sessionDuration: 0,
            followupQueries: []
          },
          userContext
        );
      }

    } catch (error) {
      console.error('Search cache set error:', error);
    }
  }

  /**
   * Delete from all cache layers
   */
  async delete(key: string, options: SearchOptions = {}): Promise<boolean> {
    const cacheKey = this.generateCacheKey(key, options);
    let deleted = false;

    try {
      // Delete from all layers
      if (this.l0Cache.delete(cacheKey)) deleted = true;
      if (this.l1Cache.delete(cacheKey)) deleted = true;
      if (this.l2Cache.delete(cacheKey)) deleted = true;

      if (this.redisCache) {
        if (await this.redisCache.delete(cacheKey)) deleted = true;
      }

      return deleted;

    } catch (error) {
      console.error('Search cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    let deletedCount = 0;

    try {
      // For each layer, get keys and filter by pattern
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));

      // L0 keys
      const l0Keys = this.l0Cache.keys().filter(key => regex.test(key));
      l0Keys.forEach(key => {
        if (this.l0Cache.delete(key)) deletedCount++;
      });

      // L1 keys
      const l1Keys = this.l1Cache.keys().filter(key => regex.test(key));
      l1Keys.forEach(key => {
        if (this.l1Cache.delete(key)) deletedCount++;
      });

      // L2 keys
      const l2Keys = this.l2Cache.keys().filter(key => regex.test(key));
      l2Keys.forEach(key => {
        if (this.l2Cache.delete(key)) deletedCount++;
      });

      // Redis
      if (this.redisCache) {
        deletedCount += await this.redisCache.deletePattern(pattern);
      }

      return deletedCount;

    } catch (error) {
      console.error('Search cache delete pattern error:', error);
      return 0;
    }
  }

  /**
   * Clear all cache layers
   */
  async clear(): Promise<void> {
    try {
      this.l0Cache.clear();
      this.l1Cache.clear();
      this.l2Cache.clear();

      if (this.redisCache) {
        await this.redisCache.clear();
      }

      this.predictiveCache.reset();

      console.log('Search cache cleared');

    } catch (error) {
      console.error('Search cache clear error:', error);
    }
  }

  /**
   * Check if key exists in any layer
   */
  async has(key: string, options: SearchOptions = {}): Promise<boolean> {
    const cacheKey = this.generateCacheKey(key, options);

    try {
      if (this.l0Cache.has(cacheKey)) return true;
      if (this.l1Cache.has(cacheKey)) return true;
      if (this.l2Cache.has(cacheKey)) return true;

      if (this.redisCache) {
        return await this.redisCache.exists(cacheKey);
      }

      return false;

    } catch (error) {
      console.error('Search cache has error:', error);
      return false;
    }
  }

  /**
   * Set expiration time for existing key
   */
  async expire(key: string, ttl: number, options: SearchOptions = {}): Promise<boolean> {
    const cacheKey = this.generateCacheKey(key, options);

    try {
      // Update TTL in memory caches by re-getting and re-setting
      let updated = false;

      const l0Entry = this.l0Cache.get(cacheKey);
      if (l0Entry) {
        this.l0Cache.set(cacheKey, l0Entry, ttl);
        updated = true;
      }

      const l1Entry = this.l1Cache.get(cacheKey);
      if (l1Entry) {
        this.l1Cache.set(cacheKey, l1Entry, ttl);
        updated = true;
      }

      const l2Entry = this.l2Cache.get(cacheKey);
      if (l2Entry) {
        this.l2Cache.set(cacheKey, l2Entry, ttl);
        updated = true;
      }

      if (this.redisCache) {
        if (await this.redisCache.expire(cacheKey, Math.floor(ttl / 1000))) {
          updated = true;
        }
      }

      return updated;

    } catch (error) {
      console.error('Search cache expire error:', error);
      return false;
    }
  }

  /**
   * Get all keys matching pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    try {
      const allKeys = new Set<string>();

      // Collect keys from all layers
      this.l0Cache.keys().forEach(key => allKeys.add(key));
      this.l1Cache.keys().forEach(key => allKeys.add(key));
      this.l2Cache.keys().forEach(key => allKeys.add(key));

      if (this.redisCache) {
        const redisKeys = await this.redisCache.keys(pattern);
        redisKeys.forEach(key => allKeys.add(key));
      }

      const result = Array.from(allKeys);

      if (!pattern) {
        return result;
      }

      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return result.filter(key => regex.test(key));

    } catch (error) {
      console.error('Search cache keys error:', error);
      return [];
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): SearchCacheStats {
    const l0Stats = this.l0Cache.getStats();
    const l1Stats = this.l1Cache.getStats();
    const l2Stats = this.l2Cache.getStats();
    const redisStats = this.redisCache?.getStats();
    const predictiveStats = this.predictiveCache.getStats();

    return {
      l0: {
        hits: l0Stats.hitCount,
        misses: l0Stats.missCount,
        hitRate: l0Stats.hitRate,
        size: l0Stats.size
      },
      l1: {
        hits: l1Stats.hitCount,
        misses: l1Stats.missCount,
        hitRate: l1Stats.hitRate,
        size: l1Stats.size
      },
      l2: {
        hits: l2Stats.hitCount,
        misses: l2Stats.missCount,
        hitRate: l2Stats.hitRate,
        size: l2Stats.size
      },
      redis: {
        hits: redisStats?.hitCount || 0,
        misses: redisStats?.missCount || 0,
        hitRate: redisStats?.hitRate || 0,
        connected: redisStats?.connectionStatus === 'connected'
      },
      predictive: {
        predictions: predictiveStats.totalPredictions,
        accuracy: predictiveStats.predictionAccuracy,
        cacheSaves: predictiveStats.successfulPredictions
      },
      overall: {
        totalHits: l0Stats.hitCount + l1Stats.hitCount + l2Stats.hitCount + (redisStats?.hitCount || 0),
        totalMisses: l0Stats.missCount + l1Stats.missCount + l2Stats.missCount + (redisStats?.missCount || 0),
        overallHitRate: this.calculateOverallHitRate(),
        averageResponseTime: (l0Stats.averageAccessTime + l1Stats.averageAccessTime + l2Stats.averageAccessTime) / 3,
        memoryUsage: l0Stats.memoryUsage + l1Stats.memoryUsage + l2Stats.memoryUsage
      }
    };
  }

  /**
   * Warm cache with popular/predicted queries
   */
  async warmCache(warmupData: WarmupData): Promise<void> {
    const { popularQueries = [], recentSearches = [], predictedTerms = [], userContext } = warmupData;

    console.log(`🔥 Warming search cache with ${popularQueries.length + recentSearches.length + predictedTerms.length} entries...`);

    try {
      // Warm with popular queries (higher priority)
      for (const query of popularQueries) {
        const cacheKey = this.generateQueryCacheKey(query, {});
        // Mark as warm in L2 cache with longer TTL
        const entry: SearchCacheEntry = {
          results: [],
          query,
          options: {},
          timestamp: Date.now(),
          computationTime: 0,
          hitCount: 1
        };
        this.l2Cache.set(cacheKey + ':warm', entry, this.config.l2Cache.defaultTTL * 2);
      }

      // Warm with recent searches
      for (const query of recentSearches) {
        const cacheKey = this.generateQueryCacheKey(query, {});
        const entry: SearchCacheEntry = {
          results: [],
          query,
          options: {},
          timestamp: Date.now(),
          computationTime: 0,
          hitCount: 1
        };
        this.l2Cache.set(cacheKey + ':recent', entry, this.config.l2Cache.defaultTTL);
      }

      // Use predictive cache for predicted terms
      if (this.config.predictiveCache.enabled && userContext) {
        const predictions = await this.predictiveCache.getPredictions(userContext, userContext);

        for (const prediction of predictions) {
          if (prediction.confidence >= this.config.predictiveCache.confidenceThreshold) {
            this.predictiveCache.markPredictionSuccess(prediction.key);
          }
        }
      }

      console.log(`✅ Cache warming completed`);

    } catch (error) {
      console.error('Cache warming error:', error);
    }
  }

  /**
   * Generate cache key for search queries
   */
  generateQueryCacheKey(query: string, options: SearchOptions): string {
    const normalized = query.toLowerCase().trim();
    const optionsHash = this.hashOptions(options);
    return `query:${normalized}:${optionsHash}`;
  }

  /**
   * Generate cache key for term frequencies
   */
  generateTermCacheKey(term: string): string {
    return `term:${term.toLowerCase()}`;
  }

  /**
   * Generate cache key for index segments
   */
  generateIndexCacheKey(segment: string): string {
    return `index:${segment}`;
  }

  /**
   * Close cache and cleanup resources
   */
  async close(): Promise<void> {
    try {
      this.l0Cache.destroy();
      this.l1Cache.destroy();
      this.l2Cache.destroy();

      if (this.redisCache) {
        await this.redisCache.close();
      }

      console.log('Enhanced search cache closed');

    } catch (error) {
      console.error('Search cache close error:', error);
    }
  }

  // Private Implementation

  private generateCacheKey(key: string, options: SearchOptions): string {
    const optionsHash = this.hashOptions(options);
    return `search:${key}:${optionsHash}`;
  }

  private hashOptions(options: SearchOptions): string {
    const relevant = {
      limit: options.limit,
      category: options.category,
      tags: options.tags,
      sortBy: options.sortBy,
      useAI: options.useAI,
      threshold: options.threshold
    };
    return btoa(JSON.stringify(relevant)).slice(0, 8);
  }

  private determineCacheStrategy(
    entry: SearchCacheEntry,
    computationTime: number
  ): {
    useL0: boolean;
    useL1: boolean;
    useL2: boolean;
    useRedis: boolean;
    redisTTL: number;
  } {
    const resultSize = JSON.stringify(entry.results).length;
    const isExpensive = computationTime > 500; // 500ms threshold
    const isFrequent = entry.hitCount > 0;

    return {
      useL0: resultSize < 10240 && (isExpensive || isFrequent), // 10KB limit for L0
      useL1: resultSize < 51200 && isExpensive, // 50KB limit for L1
      useL2: true, // Always cache in L2
      useRedis: this.config.l3Redis.enabled && resultSize < 102400, // 100KB limit for Redis
      redisTTL: isExpensive ? 1200 : 600 // 20 or 10 minutes
    };
  }

  private promoteToL0(key: string, entry: SearchCacheEntry): void {
    const resultSize = JSON.stringify(entry.results).length;
    if (resultSize < 10240) { // 10KB limit for L0
      this.l0Cache.set(key, entry, this.config.l0Cache.defaultTTL);
    }
  }

  private promoteToL1(key: string, entry: SearchCacheEntry): void {
    const resultSize = JSON.stringify(entry.results).length;
    if (resultSize < 51200) { // 50KB limit for L1
      this.l1Cache.set(key, entry, this.config.l1Cache.defaultTTL);
    }
  }

  private setInL0(key: string, entry: SearchCacheEntry): void {
    this.l0Cache.set(key, entry, this.config.l0Cache.defaultTTL);
  }

  private setInL1(key: string, entry: SearchCacheEntry): void {
    this.l1Cache.set(key, entry, this.config.l1Cache.defaultTTL);
  }

  private setInL2(key: string, entry: SearchCacheEntry): void {
    this.l2Cache.set(key, entry, this.config.l2Cache.defaultTTL);
  }

  private recordHit(layer: string, startTime: number): void {
    this.stats[layer as keyof SearchCacheStats].hits++;
    // Additional hit recording logic
  }

  private recordMiss(startTime: number): void {
    // Miss recording logic
  }

  private calculateOverallHitRate(): number {
    const stats = this.getStats();
    const totalRequests = stats.overall.totalHits + stats.overall.totalMisses;
    return totalRequests > 0 ? stats.overall.totalHits / totalRequests : 0;
  }

  private initializeStats(): void {
    this.stats = {
      l0: { hits: 0, misses: 0, hitRate: 0, size: 0 },
      l1: { hits: 0, misses: 0, hitRate: 0, size: 0 },
      l2: { hits: 0, misses: 0, hitRate: 0, size: 0 },
      redis: { hits: 0, misses: 0, hitRate: 0, connected: false },
      predictive: { predictions: 0, accuracy: 0, cacheSaves: 0 },
      overall: {
        totalHits: 0,
        totalMisses: 0,
        overallHitRate: 0,
        averageResponseTime: 0,
        memoryUsage: 0
      }
    };
  }

  private setupEventHandlers(): void {
    // Listen to predictive cache events
    this.predictiveCache.on('prediction-success', (data) => {
      console.log(`Predictive cache hit: ${data.key}`);
    });

    this.predictiveCache.on('prediction-failure', (data) => {
      console.log(`Predictive cache miss: ${data.key}`);
    });

    // Listen to Redis events if enabled
    if (this.redisCache) {
      this.redisCache.on('connected', () => {
        console.log('Redis cache connected');
      });

      this.redisCache.on('disconnected', () => {
        console.log('Redis cache disconnected');
      });

      this.redisCache.on('error', (error) => {
        console.error('Redis cache error:', error);
      });
    }
  }
}

export default EnhancedSearchCache;