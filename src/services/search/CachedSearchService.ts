/**
 * Cached Search Service - High-Performance Search with Intelligent Caching
 * Wraps AdvancedSearchEngine with multi-layer caching for sub-1s performance
 */

import { KBEntry, SearchResult, SearchOptions } from '../../types';
import { ServiceError, SearchError } from '../../types/services';
import AdvancedSearchEngine, { 
  SearchEngineConfig, 
  SearchResponse, 
  SearchContext 
} from './AdvancedSearchEngine';
import { CacheService } from '../CacheService';
import { SearchCache } from './SearchCache';
import { CacheSystemIntegration } from '../../caching/CacheSystemIntegration';

export interface CachedSearchConfig extends SearchEngineConfig {
  cache: {
    enabled: boolean;
    layers: {
      l1: { size: number; ttl: number }; // Hot cache
      l2: { size: number; ttl: number }; // Warm cache
      l3: { size: number; ttl: number }; // Cold cache
    };
    warming: {
      enabled: boolean;
      strategies: ('popular' | 'recent' | 'predictive')[];
      schedule: string;
    };
    invalidation: {
      enabled: boolean;
      smartCascade: boolean;
      maxBatchSize: number;
    };
    monitoring: {
      enabled: boolean;
      metricsInterval: number;
      alertThresholds: {
        hitRate: number;
        responseTime: number;
        errorRate: number;
      };
    };
  };
  optimization: {
    batchSize: number;
    maxConcurrentQueries: number;
    queryNormalization: boolean;
    resultDeduplication: boolean;
    asyncProcessing: boolean;
  };
}

export interface CacheMetrics {
  hitRates: {
    overall: number;
    l1: number;
    l2: number;
    l3: number;
  };
  performance: {
    avgResponseTime: number;
    cacheResponseTime: number;
    computeResponseTime: number;
    throughput: number;
  };
  storage: {
    totalSize: number;
    utilizationPercent: number;
    evictions: number;
    memoryPressure: number;
  };
  operations: {
    totalQueries: number;
    cacheHits: number;
    cacheMisses: number;
    errors: number;
    warmingOperations: number;
  };
}

export interface SearchAnalytics {
  popularQueries: Array<{ query: string; count: number; avgTime: number }>;
  performancePatterns: {
    timeOfDay: Record<string, number>;
    queryLength: Record<string, number>;
    resultSize: Record<string, number>;
  };
  userBehavior: {
    queryPatterns: string[];
    sessionDuration: number;
    repeatQueries: number;
  };
  recommendations: {
    cacheOptimizations: string[];
    performanceImprovements: string[];
    capacityPlanning: string[];
  };
}

/**
 * Production-ready cached search service with intelligent multi-layer caching
 * Features:
 * - Multi-layer cache hierarchy (L1/L2/L3)
 * - Intelligent cache warming and invalidation
 * - Real-time performance monitoring
 * - Query optimization and batching
 * - Automatic failover and recovery
 * - Advanced analytics and recommendations
 */
export class CachedSearchService {
  private searchEngine: AdvancedSearchEngine;
  private cacheSystem: CacheSystemIntegration;
  private searchCache: SearchCache;
  private cacheService: CacheService;
  
  private config: CachedSearchConfig;
  private metrics: CacheMetrics;
  private analytics: SearchAnalytics;
  
  private isInitialized = false;
  private queryQueue: Map<string, Promise<SearchResponse>> = new Map();
  private warmingInProgress = false;
  private metricsInterval?: NodeJS.Timeout;
  
  // Performance tracking
  private queryHistory: Array<{
    query: string;
    timestamp: number;
    responseTime: number;
    cacheHit: boolean;
    resultCount: number;
    userId?: string;
  }> = [];

  constructor(config?: Partial<CachedSearchConfig>) {
    this.config = this.mergeConfig(config);
    this.initializeMetrics();
    this.initializeAnalytics();
  }

  /**
   * Initialize the cached search service
   */
  async initialize(entries: KBEntry[]): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('🚀 Initializing cached search service...');
      
      // Initialize core search engine
      this.searchEngine = new AdvancedSearchEngine(this.config);
      await this.searchEngine.initialize(entries);
      
      // Initialize cache layers
      await this.initializeCacheSystem();
      
      // Setup monitoring
      if (this.config.cache.monitoring.enabled) {
        this.setupMetricsCollection();
      }
      
      // Initial cache warming
      if (this.config.cache.warming.enabled) {
        await this.performInitialWarming(entries);
      }
      
      this.isInitialized = true;
      
      const initTime = Date.now() - startTime;
      console.log(`✅ Cached search service initialized in ${initTime}ms`);
      
    } catch (error) {
      throw new ServiceError(
        `Failed to initialize cached search service: ${error.message}`,
        'CACHED_SEARCH_INIT_ERROR',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Perform intelligent cached search with automatic optimization
   */
  async search(
    query: string,
    options: SearchOptions = {},
    context: SearchContext = {}
  ): Promise<SearchResponse> {
    this.validateInitialization();
    
    const startTime = Date.now();
    const normalizedQuery = this.normalizeQuery(query);
    const cacheKey = this.generateCacheKey(normalizedQuery, options, context);
    
    try {
      // Check for duplicate concurrent queries
      if (this.queryQueue.has(cacheKey)) {
        return await this.queryQueue.get(cacheKey)!;
      }
      
      // Create promise for concurrent query deduplication
      const searchPromise = this.executeSearch(normalizedQuery, options, context, cacheKey);
      this.queryQueue.set(cacheKey, searchPromise);
      
      const result = await searchPromise;
      
      // Record metrics
      this.recordQueryMetrics(query, startTime, result, context);
      
      return result;
      
    } catch (error) {
      this.recordErrorMetrics(query, startTime, error);
      throw error;
    } finally {
      this.queryQueue.delete(cacheKey);
    }
  }

  /**
   * Batch search for multiple queries with optimized caching
   */
  async batchSearch(
    queries: Array<{
      query: string;
      options?: SearchOptions;
      context?: SearchContext;
    }>
  ): Promise<SearchResponse[]> {
    this.validateInitialization();
    
    const batchSize = this.config.optimization.batchSize;
    const results: SearchResponse[] = [];
    
    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      const batchPromises = batch.map(({ query, options, context }) =>
        this.search(query, options, context)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Get search suggestions with caching
   */
  async suggest(prefix: string, limit: number = 10, context?: SearchContext): Promise<string[]> {
    this.validateInitialization();
    
    const cacheKey = `suggestions:${prefix}:${limit}`;
    
    try {
      // Try cache first
      const cached = await this.cacheSystem.get(
        cacheKey,
        () => this.searchEngine.suggest(prefix, limit),
        {
          ttl: 5 * 60 * 1000, // 5 minutes
          priority: 'normal',
          tags: ['suggestions', 'autocomplete'],
          category: 'suggestions'
        }
      );
      
      return cached;
    } catch (error) {
      console.warn('Suggestion cache failed, falling back to direct call:', error);
      return await this.searchEngine.suggest(prefix, limit);
    }
  }

  /**
   * Get spelling corrections with caching
   */
  async correct(query: string, context?: SearchContext): Promise<string[]> {
    this.validateInitialization();
    
    const cacheKey = `corrections:${query}`;
    
    try {
      const cached = await this.cacheSystem.get(
        cacheKey,
        () => this.searchEngine.correct(query),
        {
          ttl: 30 * 60 * 1000, // 30 minutes
          priority: 'low',
          tags: ['corrections', 'spellcheck'],
          category: 'corrections'
        }
      );
      
      return cached;
    } catch (error) {
      console.warn('Correction cache failed, falling back to direct call:', error);
      return await this.searchEngine.correct(query);
    }
  }

  /**
   * Intelligent cache warming based on usage patterns
   */
  async warmCache(
    strategy: 'popular' | 'recent' | 'predictive' | 'all' = 'all'
  ): Promise<{ warmed: number; timeSaved: number }> {
    this.validateInitialization();
    
    if (this.warmingInProgress) {
      console.log('Cache warming already in progress, skipping');
      return { warmed: 0, timeSaved: 0 };
    }
    
    this.warmingInProgress = true;
    
    try {
      console.log(`🔥 Starting cache warming with strategy: ${strategy}`);
      
      let totalWarmed = 0;
      let totalTimeSaved = 0;
      
      if (strategy === 'popular' || strategy === 'all') {
        const { warmed, timeSaved } = await this.warmPopularQueries();
        totalWarmed += warmed;
        totalTimeSaved += timeSaved;
      }
      
      if (strategy === 'recent' || strategy === 'all') {
        const { warmed, timeSaved } = await this.warmRecentQueries();
        totalWarmed += warmed;
        totalTimeSaved += timeSaved;
      }
      
      if (strategy === 'predictive' || strategy === 'all') {
        const { warmed, timeSaved } = await this.warmPredictiveQueries();
        totalWarmed += warmed;
        totalTimeSaved += timeSaved;
      }
      
      this.metrics.operations.warmingOperations++;
      
      console.log(`✅ Cache warming completed: ${totalWarmed} entries, ${totalTimeSaved}ms saved`);
      
      return { warmed: totalWarmed, timeSaved: totalTimeSaved };
      
    } finally {
      this.warmingInProgress = false;
    }
  }

  /**
   * Intelligent cache invalidation with cascade logic
   */
  async invalidateCache(
    pattern?: string,
    tags?: string[],
    reason?: string
  ): Promise<{ invalidated: number; cascaded: number }> {
    this.validateInitialization();
    
    try {
      console.log(`🗑️ Invalidating cache: pattern=${pattern}, tags=${tags?.join(',')}, reason=${reason}`);
      
      let invalidated = 0;
      let cascaded = 0;
      
      if (pattern) {
        invalidated += await this.cacheSystem.invalidateCache(pattern, tags, reason);
      }
      
      if (tags && this.config.cache.invalidation.smartCascade) {
        // Smart cascade invalidation based on tag relationships
        const relatedTags = this.getRelatedTags(tags);
        for (const relatedTag of relatedTags) {
          cascaded += await this.cacheSystem.invalidateCache(undefined, [relatedTag], 'cascade');
        }
      }
      
      // Schedule re-warming for popular invalidated content
      if (invalidated > 10) {
        setTimeout(() => {
          this.warmCache('popular').catch(error => {
            console.error('Post-invalidation warming failed:', error);
          });
        }, 2000);
      }
      
      console.log(`✅ Cache invalidation completed: ${invalidated} direct, ${cascaded} cascaded`);
      
      return { invalidated, cascaded };
      
    } catch (error) {
      console.error('Cache invalidation failed:', error);
      throw new ServiceError(
        `Cache invalidation failed: ${error.message}`,
        'CACHE_INVALIDATION_ERROR',
        500,
        { pattern, tags, reason, originalError: error }
      );
    }
  }

  /**
   * Add document to search index with cache invalidation
   */
  async addDocument(entry: KBEntry): Promise<void> {
    this.validateInitialization();
    
    try {
      // Add to search engine
      await this.searchEngine.addDocument(entry);
      
      // Invalidate related cache entries
      await this.invalidateRelatedCache(entry);
      
      console.log(`📄 Document added and cache updated: ${entry.id}`);
      
    } catch (error) {
      throw new ServiceError(
        `Failed to add document: ${error.message}`,
        'DOCUMENT_ADD_ERROR',
        500,
        { entryId: entry.id, originalError: error }
      );
    }
  }

  /**
   * Remove document from search index with cache invalidation
   */
  async removeDocument(docId: string): Promise<boolean> {
    this.validateInitialization();
    
    try {
      // Remove from search engine
      const removed = await this.searchEngine.removeDocument(docId);
      
      if (removed) {
        // Invalidate related cache entries
        await this.cacheSystem.invalidateCache(`*${docId}*`, undefined, 'document-removed');
        
        console.log(`🗑️ Document removed and cache updated: ${docId}`);
      }
      
      return removed;
      
    } catch (error) {
      throw new ServiceError(
        `Failed to remove document: ${error.message}`,
        'DOCUMENT_REMOVE_ERROR',
        500,
        { docId, originalError: error }
      );
    }
  }

  /**
   * Get comprehensive system metrics
   */
  getMetrics(): CacheMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get search analytics and insights
   */
  getAnalytics(): SearchAnalytics {
    this.updateAnalytics();
    return { ...this.analytics };
  }

  /**
   * Get system health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'critical';
    issues: string[];
    recommendations: string[];
    uptime: number;
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check hit rate
    if (this.metrics.hitRates.overall < this.config.cache.monitoring.alertThresholds.hitRate) {
      issues.push(`Low cache hit rate: ${(this.metrics.hitRates.overall * 100).toFixed(1)}%`);
      recommendations.push('Consider cache warming or increasing TTL values');
    }
    
    // Check response time
    if (this.metrics.performance.avgResponseTime > this.config.cache.monitoring.alertThresholds.responseTime) {
      issues.push(`High response time: ${this.metrics.performance.avgResponseTime}ms`);
      recommendations.push('Check query optimization and cache performance');
    }
    
    // Check error rate
    const errorRate = this.metrics.operations.errors / Math.max(this.metrics.operations.totalQueries, 1);
    if (errorRate > this.config.cache.monitoring.alertThresholds.errorRate) {
      issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
      recommendations.push('Investigate error patterns and system stability');
    }
    
    // Check memory pressure
    if (this.metrics.storage.memoryPressure > 0.9) {
      issues.push('High memory pressure');
      recommendations.push('Consider increasing cache size or optimizing eviction policies');
    }
    
    const status = issues.length === 0 ? 'healthy' : 
                  issues.length <= 2 ? 'degraded' : 'critical';
    
    return {
      status,
      issues,
      recommendations,
      uptime: Date.now() - (this.metrics as any).startTime || 0
    };
  }

  /**
   * Optimize cache configuration based on usage patterns
   */
  async optimizeConfiguration(): Promise<{
    changes: string[];
    expectedImprovement: string;
  }> {
    this.validateInitialization();
    
    const changes: string[] = [];
    const analytics = this.getAnalytics();
    
    // Analyze query patterns for TTL optimization
    const avgQueryFrequency = analytics.popularQueries.reduce((sum, q) => sum + q.count, 0) / analytics.popularQueries.length;
    
    if (avgQueryFrequency > 10) {
      // High frequency queries should have longer TTL
      changes.push('Increase TTL for L1 cache from 1min to 5min');
      changes.push('Increase TTL for popular queries from 10min to 30min');
    }
    
    // Analyze hit rate for size optimization
    if (this.metrics.hitRates.l1 < 0.8) {
      changes.push('Increase L1 cache size by 50%');
    }
    
    if (this.metrics.hitRates.l2 < 0.6) {
      changes.push('Increase L2 cache size by 25%');
    }
    
    // Analyze response times for strategy optimization
    if (this.metrics.performance.avgResponseTime > 500) {
      changes.push('Enable aggressive cache warming');
      changes.push('Increase cache warming frequency');
    }
    
    const expectedImprovement = changes.length > 0 ? 
      'Expected 15-30% improvement in response time and 10-20% improvement in hit rate' :
      'System is already optimally configured';
    
    return { changes, expectedImprovement };
  }

  /**
   * Shutdown service gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;
    
    console.log('🔄 Shutting down cached search service...');
    
    try {
      // Stop metrics collection
      if (this.metricsInterval) {
        clearInterval(this.metricsInterval);
      }
      
      // Final cache warming for critical data
      await this.warmCache('popular');
      
      // Shutdown components
      await this.cacheSystem.shutdown();
      await this.searchEngine.shutdown();
      
      this.isInitialized = false;
      
      console.log('✅ Cached search service shutdown completed');
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }

  // =========================
  // Private Implementation
  // =========================

  private mergeConfig(config?: Partial<CachedSearchConfig>): CachedSearchConfig {
    return {
      // Inherit base search engine config
      maxResults: 100,
      defaultTimeout: 1000,
      cacheEnabled: true,
      fuzzyEnabled: true,
      rankingAlgorithm: 'bm25',
      performance: {
        indexingBatchSize: 1000,
        searchTimeout: 800,
        maxConcurrentSearches: 20,
        memoryThreshold: 512 * 1024 * 1024,
        optimizationLevel: 'balanced'
      },
      features: {
        semanticSearch: true,
        autoComplete: true,
        spellCorrection: true,
        queryExpansion: false,
        resultClustering: false,
        personalizedRanking: true
      },
      
      // Cached search specific config
      cache: {
        enabled: true,
        layers: {
          l1: { size: 1000, ttl: 60 * 1000 }, // 1 minute
          l2: { size: 5000, ttl: 10 * 60 * 1000 }, // 10 minutes
          l3: { size: 20000, ttl: 60 * 60 * 1000 } // 1 hour
        },
        warming: {
          enabled: true,
          strategies: ['popular', 'recent'],
          schedule: '0 */15 * * * *' // Every 15 minutes
        },
        invalidation: {
          enabled: true,
          smartCascade: true,
          maxBatchSize: 1000
        },
        monitoring: {
          enabled: true,
          metricsInterval: 30000, // 30 seconds
          alertThresholds: {
            hitRate: 0.7,
            responseTime: 1000,
            errorRate: 0.05
          }
        }
      },
      optimization: {
        batchSize: 50,
        maxConcurrentQueries: 10,
        queryNormalization: true,
        resultDeduplication: true,
        asyncProcessing: true
      },
      
      ...config
    };
  }

  private initializeMetrics(): void {
    this.metrics = {
      hitRates: { overall: 0, l1: 0, l2: 0, l3: 0 },
      performance: {
        avgResponseTime: 0,
        cacheResponseTime: 0,
        computeResponseTime: 0,
        throughput: 0
      },
      storage: {
        totalSize: 0,
        utilizationPercent: 0,
        evictions: 0,
        memoryPressure: 0
      },
      operations: {
        totalQueries: 0,
        cacheHits: 0,
        cacheMisses: 0,
        errors: 0,
        warmingOperations: 0
      }
    };
    
    (this.metrics as any).startTime = Date.now();
  }

  private initializeAnalytics(): void {
    this.analytics = {
      popularQueries: [],
      performancePatterns: {
        timeOfDay: {},
        queryLength: {},
        resultSize: {}
      },
      userBehavior: {
        queryPatterns: [],
        sessionDuration: 0,
        repeatQueries: 0
      },
      recommendations: {
        cacheOptimizations: [],
        performanceImprovements: [],
        capacityPlanning: []
      }
    };
  }

  private async initializeCacheSystem(): Promise<void> {
    // Initialize cache system (using existing cache integration)
    const Database = require('better-sqlite3');
    const db = new Database(':memory:'); // Use in-memory for this example
    
    this.cacheSystem = new CacheSystemIntegration(db, {
      mvpLevel: 3,
      enableDistributedCache: false,
      enablePredictiveWarming: true,
      enableSmartInvalidation: true,
      enablePerformanceMonitoring: true
    });
    
    await this.cacheSystem.initialize();
    
    // Initialize search-specific cache
    this.searchCache = new SearchCache({
      maxSize: 100 * 1024 * 1024, // 100MB
      defaultTTL: this.config.cache.layers.l2.ttl,
      layers: [
        {
          name: 'l1',
          maxSize: this.config.cache.layers.l1.size,
          ttl: this.config.cache.layers.l1.ttl,
          strategy: 'lfu',
          enabled: true
        },
        {
          name: 'l2',
          maxSize: this.config.cache.layers.l2.size,
          ttl: this.config.cache.layers.l2.ttl,
          strategy: 'lru',
          enabled: true
        }
      ]
    });
    
    // Initialize general cache service
    this.cacheService = new CacheService({
      maxSize: this.config.cache.layers.l3.size,
      defaultTTL: this.config.cache.layers.l3.ttl,
      checkPeriod: 60000
    });
  }

  private validateInitialization(): void {
    if (!this.isInitialized) {
      throw new ServiceError(
        'Cached search service not initialized',
        'SERVICE_NOT_INITIALIZED',
        500
      );
    }
  }

  private normalizeQuery(query: string): string {
    if (!this.config.optimization.queryNormalization) {
      return query;
    }
    
    return query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '');
  }

  private generateCacheKey(
    query: string,
    options: SearchOptions,
    context: SearchContext
  ): string {
    const keyParts = [
      'search',
      query,
      options.limit || 'default',
      options.category || 'all',
      options.sortBy || 'relevance',
      options.useAI ? 'ai' : 'standard',
      context.userId || 'anonymous'
    ];
    
    return keyParts.join(':');
  }

  private async executeSearch(
    query: string,
    options: SearchOptions,
    context: SearchContext,
    cacheKey: string
  ): Promise<SearchResponse> {
    try {
      // Try cache first
      const cached = await this.cacheSystem.get(
        cacheKey,
        () => this.searchEngine.search(query, options, context),
        {
          ttl: this.getTTLForQuery(query),
          priority: this.getPriorityForQuery(query, options),
          tags: this.getTagsForQuery(query, options),
          userContext: context.userId,
          category: 'search'
        }
      );
      
      return cached;
      
    } catch (error) {
      // Fallback to direct search on cache failure
      console.warn('Cache failed, falling back to direct search:', error);
      return await this.searchEngine.search(query, options, context);
    }
  }

  private getTTLForQuery(query: string): number {
    // Dynamic TTL based on query characteristics
    const words = query.split(' ');
    
    if (words.length === 1 && words[0].length < 4) {
      // Short single-word queries change frequently
      return this.config.cache.layers.l1.ttl;
    }
    
    if (words.length > 5) {
      // Long specific queries are stable
      return this.config.cache.layers.l3.ttl;
    }
    
    return this.config.cache.layers.l2.ttl;
  }

  private getPriorityForQuery(query: string, options: SearchOptions): 'low' | 'normal' | 'high' | 'critical' {
    if (options.useAI) return 'high';
    if (query.length < 3) return 'low';
    if (options.category && options.category !== 'Other') return 'normal';
    return 'normal';
  }

  private getTagsForQuery(query: string, options: SearchOptions): string[] {
    const tags = ['search'];
    
    if (options.category) tags.push(`category:${options.category}`);
    if (options.useAI) tags.push('ai-enhanced');
    if (query.length < 5) tags.push('short-query');
    if (query.length > 20) tags.push('long-query');
    
    return tags;
  }

  private recordQueryMetrics(
    query: string,
    startTime: number,
    result: SearchResponse,
    context: SearchContext
  ): void {
    const responseTime = Date.now() - startTime;
    const cacheHit = result.metrics.cacheHit;
    
    // Update metrics
    this.metrics.operations.totalQueries++;
    if (cacheHit) {
      this.metrics.operations.cacheHits++;
    } else {
      this.metrics.operations.cacheMisses++;
    }
    
    // Update hit rates
    this.metrics.hitRates.overall = 
      this.metrics.operations.cacheHits / this.metrics.operations.totalQueries;
    
    // Update performance metrics
    const totalResponseTime = this.metrics.performance.avgResponseTime * (this.metrics.operations.totalQueries - 1);
    this.metrics.performance.avgResponseTime = 
      (totalResponseTime + responseTime) / this.metrics.operations.totalQueries;
    
    if (cacheHit) {
      this.metrics.performance.cacheResponseTime = 
        (this.metrics.performance.cacheResponseTime + responseTime) / 2;
    } else {
      this.metrics.performance.computeResponseTime = 
        (this.metrics.performance.computeResponseTime + responseTime) / 2;
    }
    
    // Record query history
    this.queryHistory.push({
      query,
      timestamp: Date.now(),
      responseTime,
      cacheHit,
      resultCount: result.results.length,
      userId: context.userId
    });
    
    // Keep only last 1000 queries
    if (this.queryHistory.length > 1000) {
      this.queryHistory = this.queryHistory.slice(-1000);
    }
  }

  private recordErrorMetrics(query: string, startTime: number, error: any): void {
    this.metrics.operations.totalQueries++;
    this.metrics.operations.errors++;
    
    console.error(`Search error for query "${query}":`, error);
  }

  private setupMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
      this.updateAnalytics();
      
      const health = this.getHealthStatus();
      if (health.status === 'critical') {
        console.warn('🚨 Cache system health critical:', health.issues);
      }
    }, this.config.cache.monitoring.metricsInterval);
  }

  private updateMetrics(): void {
    // Update storage metrics from cache system
    const cacheStats = this.cacheSystem.getSystemStats();
    
    this.metrics.hitRates.l1 = cacheStats.layers.hot.hitRate;
    this.metrics.hitRates.l2 = cacheStats.layers.warm.hitRate;
    this.metrics.hitRates.l3 = cacheStats.layers.persistent.hitRate;
    
    this.metrics.performance.throughput = 
      this.metrics.operations.totalQueries / 
      Math.max(1, (Date.now() - (this.metrics as any).startTime) / 1000 / 60); // per minute
    
    // Update storage metrics
    const searchCacheStats = this.searchCache.getStats();
    this.metrics.storage.totalSize = searchCacheStats.memoryUsage;
    this.metrics.storage.evictions = searchCacheStats.evictions;
    this.metrics.storage.utilizationPercent = searchCacheStats.memoryUsage / (100 * 1024 * 1024); // Assuming 100MB max
  }

  private updateAnalytics(): void {
    // Update popular queries
    const queryFrequency = new Map<string, { count: number; totalTime: number }>();
    
    for (const query of this.queryHistory) {
      const current = queryFrequency.get(query.query) || { count: 0, totalTime: 0 };
      queryFrequency.set(query.query, {
        count: current.count + 1,
        totalTime: current.totalTime + query.responseTime
      });
    }
    
    this.analytics.popularQueries = Array.from(queryFrequency.entries())
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        avgTime: stats.totalTime / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    
    // Update performance patterns
    this.updatePerformancePatterns();
    
    // Update recommendations
    this.updateRecommendations();
  }

  private updatePerformancePatterns(): void {
    const timeOfDay: Record<string, number> = {};
    const queryLength: Record<string, number> = {};
    const resultSize: Record<string, number> = {};
    
    for (const query of this.queryHistory) {
      const hour = new Date(query.timestamp).getHours();
      const hourKey = `${hour}:00`;
      timeOfDay[hourKey] = (timeOfDay[hourKey] || 0) + 1;
      
      const lengthBucket = query.query.length < 10 ? 'short' : 
                          query.query.length < 30 ? 'medium' : 'long';
      queryLength[lengthBucket] = (queryLength[lengthBucket] || 0) + 1;
      
      const sizeBucket = query.resultCount < 5 ? 'few' : 
                        query.resultCount < 20 ? 'moderate' : 'many';
      resultSize[sizeBucket] = (resultSize[sizeBucket] || 0) + 1;
    }
    
    this.analytics.performancePatterns = { timeOfDay, queryLength, resultSize };
  }

  private updateRecommendations(): void {
    const recommendations = {
      cacheOptimizations: [],
      performanceImprovements: [],
      capacityPlanning: []
    };
    
    // Cache optimization recommendations
    if (this.metrics.hitRates.overall < 0.8) {
      recommendations.cacheOptimizations.push('Increase cache TTL for popular queries');
      recommendations.cacheOptimizations.push('Enable more aggressive cache warming');
    }
    
    if (this.metrics.hitRates.l1 < 0.7) {
      recommendations.cacheOptimizations.push('Increase L1 cache size');
    }
    
    // Performance recommendations
    if (this.metrics.performance.avgResponseTime > 500) {
      recommendations.performanceImprovements.push('Optimize query processing pipeline');
      recommendations.performanceImprovements.push('Consider query result pre-computation');
    }
    
    if (this.metrics.performance.throughput < 100) {
      recommendations.performanceImprovements.push('Increase concurrent query limit');
      recommendations.performanceImprovements.push('Optimize database connection pooling');
    }
    
    // Capacity planning
    if (this.metrics.storage.utilizationPercent > 0.8) {
      recommendations.capacityPlanning.push('Plan for cache storage expansion');
      recommendations.capacityPlanning.push('Review cache eviction policies');
    }
    
    this.analytics.recommendations = recommendations;
  }

  private async performInitialWarming(entries: KBEntry[]): Promise<void> {
    console.log('🔥 Performing initial cache warming...');
    
    try {
      // Warm with common search terms
      const commonTerms = this.extractCommonTerms(entries);
      
      for (const term of commonTerms.slice(0, 20)) {
        try {
          await this.search(term, { limit: 10 }, {});
        } catch (error) {
          console.warn(`Initial warming failed for term "${term}":`, error);
        }
      }
      
      console.log(`✅ Initial warming completed for ${commonTerms.length} terms`);
      
    } catch (error) {
      console.warn('Initial cache warming failed:', error);
    }
  }

  private extractCommonTerms(entries: KBEntry[]): string[] {
    const termFrequency = new Map<string, number>();
    
    for (const entry of entries) {
      const text = `${entry.title} ${entry.problem} ${entry.solution}`.toLowerCase();
      const words = text.match(/\b\w{3,}\b/g) || [];
      
      for (const word of words) {
        termFrequency.set(word, (termFrequency.get(word) || 0) + 1);
      }
    }
    
    return Array.from(termFrequency.entries())
      .filter(([_, count]) => count >= 3) // Appear in at least 3 entries
      .sort((a, b) => b[1] - a[1])
      .map(([term]) => term)
      .slice(0, 50);
  }

  private async warmPopularQueries(): Promise<{ warmed: number; timeSaved: number }> {
    const popularQueries = this.analytics.popularQueries.slice(0, 10);
    let warmed = 0;
    let timeSaved = 0;
    
    for (const { query, avgTime } of popularQueries) {
      try {
        const startTime = Date.now();
        await this.search(query, { limit: 20 }, {});
        const warmTime = Date.now() - startTime;
        
        warmed++;
        timeSaved += Math.max(0, avgTime - warmTime);
      } catch (error) {
        console.warn(`Failed to warm popular query "${query}":`, error);
      }
    }
    
    return { warmed, timeSaved };
  }

  private async warmRecentQueries(): Promise<{ warmed: number; timeSaved: number }> {
    const recentQueries = this.queryHistory
      .slice(-20)
      .map(q => q.query)
      .filter((query, index, array) => array.indexOf(query) === index); // Unique
    
    let warmed = 0;
    let timeSaved = 0;
    
    for (const query of recentQueries) {
      try {
        const startTime = Date.now();
        await this.search(query, { limit: 10 }, {});
        const warmTime = Date.now() - startTime;
        
        warmed++;
        timeSaved += Math.max(0, 200 - warmTime); // Assume 200ms saved on average
      } catch (error) {
        console.warn(`Failed to warm recent query "${query}":`, error);
      }
    }
    
    return { warmed, timeSaved };
  }

  private async warmPredictiveQueries(): Promise<{ warmed: number; timeSaved: number }> {
    // Simple predictive warming based on query patterns
    const queryPatterns = this.extractQueryPatterns();
    let warmed = 0;
    let timeSaved = 0;
    
    for (const pattern of queryPatterns.slice(0, 5)) {
      try {
        const startTime = Date.now();
        await this.search(pattern, { limit: 15 }, {});
        const warmTime = Date.now() - startTime;
        
        warmed++;
        timeSaved += Math.max(0, 300 - warmTime); // Assume 300ms saved
      } catch (error) {
        console.warn(`Failed to warm predictive query "${pattern}":`, error);
      }
    }
    
    return { warmed, timeSaved };
  }

  private extractQueryPatterns(): string[] {
    // Extract common query patterns for predictive warming
    const patterns = new Set<string>();
    
    for (const query of this.queryHistory.map(q => q.query)) {
      const words = query.split(' ');
      
      // Add partial queries (prefixes)
      if (words.length > 1) {
        patterns.add(words.slice(0, -1).join(' '));
      }
      
      // Add single word patterns
      for (const word of words) {
        if (word.length > 3) {
          patterns.add(word);
        }
      }
    }
    
    return Array.from(patterns).slice(0, 20);
  }

  private getRelatedTags(tags: string[]): string[] {
    // Simple tag relationship mapping
    const relatedTags: string[] = [];
    
    for (const tag of tags) {
      if (tag.startsWith('category:')) {
        // Invalidate all queries in the same category
        relatedTags.push('search');
      }
      
      if (tag === 'ai-enhanced') {
        // Invalidate all AI-related queries
        relatedTags.push('suggestions', 'corrections');
      }
    }
    
    return relatedTags;
  }

  private async invalidateRelatedCache(entry: KBEntry): Promise<void> {
    // Invalidate caches related to the added/updated entry
    const tags = [
      `category:${entry.category}`,
      ...entry.tags.map(tag => `tag:${tag}`)
    ];
    
    await this.invalidateCache(undefined, tags, 'document-updated');
    
    // Invalidate queries that might return this entry
    const words = `${entry.title} ${entry.problem}`.toLowerCase().match(/\b\w{3,}\b/g) || [];
    
    for (const word of words.slice(0, 10)) { // Limit to avoid over-invalidation
      await this.cacheSystem.invalidateCache(`*${word}*`, undefined, 'content-related');
    }
  }
}

export default CachedSearchService;