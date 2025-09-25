/**
 * Advanced Caching Service for KB Listing Performance
 * Multi-level caching with intelligent invalidation and performance optimization
 */

import { Database } from 'better-sqlite3';
import { EventEmitter } from 'events';
import { ListingOptions } from './KBListingService';

// =========================
// CORE INTERFACES
// =========================

export interface CacheConfig {
  // Memory cache settings
  memoryMaxSize: number;
  memoryTTL: number;

  // Database cache settings
  dbCacheEnabled: boolean;
  dbCacheTTL: number;
  dbCacheMaxSize: number;

  // Performance settings
  compressionEnabled: boolean;
  batchInvalidation: boolean;
  preloadStrategies: PreloadStrategy[];

  // Monitoring
  performanceMonitoring: boolean;
  hitRateThreshold: number;
}

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;
  tags: string[];
  priority: CachePriority;
  compressed?: boolean;
}

export interface CacheStats {
  memoryCache: {
    size: number;
    entries: number;
    hitRate: number;
    missRate: number;
    evictionRate: number;
  };
  dbCache: {
    size: number;
    entries: number;
    hitRate: number;
    missRate: number;
  };
  overall: {
    hitRate: number;
    averageResponseTime: number;
    cacheEfficiency: number;
  };
}

export type CachePriority = 'low' | 'normal' | 'high' | 'critical';
export type PreloadStrategy = 'popular' | 'recent' | 'predictive' | 'user_based';

// =========================
// CACHE KEY STRATEGIES
// =========================

export class CacheKeyGenerator {
  /**
   * Generate cache key for listing queries
   */
  static generateListingKey(options: ListingOptions): string {
    const normalized = {
      page: options.page || 1,
      pageSize: options.pageSize || 20,
      sortBy: options.sortBy || 'updated_at',
      sortDirection: options.sortDirection || 'desc',
      filters: options.filters || [],
      quickFilters: options.quickFilters || [],
      searchQuery: options.searchQuery || '',
      includeArchived: options.includeArchived || false,
    };

    // Create deterministic key
    const keyData = JSON.stringify(normalized, Object.keys(normalized).sort());
    return `listing:${this.hashString(keyData)}`;
  }

  /**
   * Generate cache key for aggregations
   */
  static generateAggregationKey(type: string, options?: any): string {
    const keyData = JSON.stringify({ type, ...options }, Object.keys({ type, ...options }).sort());
    return `agg:${type}:${this.hashString(keyData)}`;
  }

  /**
   * Generate cache key for filter options
   */
  static generateFilterOptionsKey(context?: any): string {
    const keyData = JSON.stringify(context || {});
    return `filters:${this.hashString(keyData)}`;
  }

  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

// =========================
// MAIN CACHE SERVICE
// =========================

export class CacheService extends EventEmitter {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private db: Database;
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
  };

  constructor(db: Database, config: Partial<CacheConfig> = {}) {
    super();

    this.db = db;
    this.config = {
      memoryMaxSize: 100 * 1024 * 1024, // 100MB
      memoryTTL: 5 * 60 * 1000, // 5 minutes
      dbCacheEnabled: true,
      dbCacheTTL: 30 * 60 * 1000, // 30 minutes
      dbCacheMaxSize: 500 * 1024 * 1024, // 500MB
      compressionEnabled: true,
      batchInvalidation: true,
      preloadStrategies: ['popular', 'recent'],
      performanceMonitoring: true,
      hitRateThreshold: 0.7,
      ...config,
    };

    this.initializeDbCache();
    this.startMaintenanceTasks();
  }

  // =========================
  // CORE CACHE OPERATIONS
  // =========================

  /**
   * Get item from cache with multi-level lookup
   */
  async get<T>(
    key: string,
    fallback?: () => Promise<T>,
    options?: {
      ttl?: number;
      tags?: string[];
      priority?: CachePriority;
    }
  ): Promise<T | null> {
    const startTime = performance.now();

    // Level 1: Memory cache
    const memoryEntry = this.getFromMemory<T>(key);
    if (memoryEntry) {
      this.recordHit('memory', performance.now() - startTime);
      return memoryEntry;
    }

    // Level 2: Database cache
    if (this.config.dbCacheEnabled) {
      const dbEntry = await this.getFromDb<T>(key);
      if (dbEntry) {
        // Promote to memory cache
        this.setInMemory(key, dbEntry, options?.ttl, options?.tags, options?.priority);
        this.recordHit('database', performance.now() - startTime);
        return dbEntry;
      }
    }

    // Level 3: Fallback function
    if (fallback) {
      const data = await fallback();
      if (data !== null && data !== undefined) {
        await this.set(key, data, options?.ttl, options?.tags, options?.priority);
      }
      this.recordMiss(performance.now() - startTime);
      return data;
    }

    this.recordMiss(performance.now() - startTime);
    return null;
  }

  /**
   * Set item in cache with intelligent storage
   */
  async set<T>(
    key: string,
    data: T,
    ttl?: number,
    tags?: string[],
    priority: CachePriority = 'normal'
  ): Promise<void> {
    const effectiveTTL = ttl || this.config.memoryTTL;

    // Always store in memory cache
    this.setInMemory(key, data, effectiveTTL, tags, priority);

    // Conditionally store in database cache for important items
    if (this.config.dbCacheEnabled && this.shouldPersistToDb(key, priority)) {
      await this.setInDb(key, data, effectiveTTL, tags, priority);
    }

    this.emit('cache:set', { key, size: this.calculateSize(data), priority });
  }

  /**
   * Remove item from all cache levels
   */
  async delete(key: string): Promise<boolean> {
    let deleted = false;

    // Remove from memory
    if (this.memoryCache.has(key)) {
      this.memoryCache.delete(key);
      deleted = true;
    }

    // Remove from database
    if (this.config.dbCacheEnabled) {
      const result = this.db.prepare('DELETE FROM query_cache WHERE cache_key = ?').run(key);
      deleted = deleted || result.changes > 0;
    }

    if (deleted) {
      this.emit('cache:delete', { key });
    }

    return deleted;
  }

  /**
   * Invalidate cache entries by pattern or tags
   */
  async invalidate(pattern?: string, tags?: string[]): Promise<number> {
    let invalidatedCount = 0;

    if (pattern) {
      invalidatedCount += await this.invalidateByPattern(pattern);
    }

    if (tags && tags.length > 0) {
      invalidatedCount += await this.invalidateByTags(tags);
    }

    this.emit('cache:invalidated', { count: invalidatedCount, pattern, tags });
    return invalidatedCount;
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    const entryCount = this.memoryCache.size;

    this.memoryCache.clear();

    if (this.config.dbCacheEnabled) {
      this.db.prepare('DELETE FROM query_cache').run();
    }

    this.emit('cache:cleared', { entries: entryCount });
  }

  // =========================
  // SPECIALIZED CACHE METHODS
  // =========================

  /**
   * Cache listing results with intelligent tagging
   */
  async cacheListingResult(options: ListingOptions, data: any): Promise<void> {
    const key = CacheKeyGenerator.generateListingKey(options);
    const tags = this.generateListingTags(options);
    const priority = this.calculateListingPriority(options);

    await this.set(key, data, undefined, tags, priority);
  }

  /**
   * Cache aggregation data
   */
  async cacheAggregation(type: string, data: any, context?: any): Promise<void> {
    const key = CacheKeyGenerator.generateAggregationKey(type, context);
    const tags = [`agg:${type}`, 'aggregations'];
    const priority: CachePriority = 'high'; // Aggregations are expensive to compute

    await this.set(key, data, this.config.dbCacheTTL, tags, priority);
  }

  /**
   * Get cached listing result
   */
  async getCachedListing(options: ListingOptions): Promise<any> {
    const key = CacheKeyGenerator.generateListingKey(options);
    return this.get(key);
  }

  /**
   * Preload popular searches
   */
  async preloadPopularSearches(): Promise<void> {
    if (!this.config.preloadStrategies.includes('popular')) return;

    // Get popular searches from usage metrics
    const popularQueries = this.db
      .prepare(
        `
      SELECT search_query, filter_context, COUNT(*) as usage_count
      FROM usage_metrics
      WHERE search_query IS NOT NULL
        AND timestamp >= datetime('now', '-7 days')
      GROUP BY search_query, filter_context
      ORDER BY usage_count DESC
      LIMIT 20
    `
      )
      .all();

    // Preload these searches
    for (const query of popularQueries) {
      try {
        const options = JSON.parse(query.filter_context || '{}');
        const key = CacheKeyGenerator.generateListingKey(options);

        if (!this.memoryCache.has(key)) {
          // This would trigger actual data loading in real implementation
          console.log(`Preloading popular search: ${query.search_query}`);
        }
      } catch (error) {
        console.warn(`Failed to preload search: ${query.search_query}`, error);
      }
    }
  }

  // =========================
  // PERFORMANCE MONITORING
  // =========================

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats {
    const memoryStats = this.getMemoryStats();
    const dbStats = this.getDbStats();

    return {
      memoryCache: memoryStats,
      dbCache: dbStats,
      overall: {
        hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
        averageResponseTime: 0, // Would be calculated from performance data
        cacheEfficiency: this.calculateCacheEfficiency(),
      },
    };
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getStats();

    if (stats.overall.hitRate < this.config.hitRateThreshold) {
      recommendations.push('Consider increasing cache TTL or memory allocation');
    }

    if (stats.memoryCache.evictionRate > 0.1) {
      recommendations.push('Memory cache is under pressure - consider increasing size');
    }

    if (stats.memoryCache.size / this.config.memoryMaxSize > 0.9) {
      recommendations.push('Memory cache is near capacity');
    }

    return recommendations;
  }

  // =========================
  // PRIVATE METHODS
  // =========================

  private initializeDbCache(): void {
    if (!this.config.dbCacheEnabled) return;

    // Ensure cache table exists (already created in migration)
    // Clean up expired entries
    this.db.prepare('DELETE FROM query_cache WHERE expires_at < datetime("now")').run();
  }

  private startMaintenanceTasks(): void {
    // Cleanup expired entries every minute
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60 * 1000);

    // Preload strategies every 5 minutes
    setInterval(
      () => {
        this.runPreloadStrategies();
      },
      5 * 60 * 1000
    );

    // Performance monitoring every 30 seconds
    if (this.config.performanceMonitoring) {
      setInterval(() => {
        this.monitorPerformance();
      }, 30 * 1000);
    }
  }

  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.timestamp + entry.ttl) {
      this.memoryCache.delete(key);
      return null;
    }

    // Update hit count and timestamp
    entry.hits++;
    return entry.data as T;
  }

  private async getFromDb<T>(key: string): Promise<T | null> {
    try {
      const row = this.db
        .prepare(
          `
        SELECT result_json, expires_at FROM query_cache
        WHERE cache_key = ? AND expires_at > datetime('now')
      `
        )
        .get(key);

      if (!row) return null;

      // Update hit count
      this.db
        .prepare('UPDATE query_cache SET hit_count = hit_count + 1 WHERE cache_key = ?')
        .run(key);

      return JSON.parse(row.result_json) as T;
    } catch (error) {
      console.warn('Database cache read error:', error);
      return null;
    }
  }

  private setInMemory<T>(
    key: string,
    data: T,
    ttl?: number,
    tags?: string[],
    priority: CachePriority = 'normal'
  ): void {
    const size = this.calculateSize(data);
    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.memoryTTL,
      hits: 0,
      size,
      tags: tags || [],
      priority,
    };

    // Check if we need to evict entries
    if (this.stats.totalSize + size > this.config.memoryMaxSize) {
      this.evictEntries(size);
    }

    this.memoryCache.set(key, entry);
    this.stats.totalSize += size;
  }

  private async setInDb<T>(
    key: string,
    data: T,
    ttl: number,
    tags?: string[],
    priority: CachePriority = 'normal'
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttl).toISOString();
      const resultJson = JSON.stringify(data);
      const sizeBytes = Buffer.byteLength(resultJson, 'utf8');

      this.db
        .prepare(
          `
        INSERT OR REPLACE INTO query_cache
        (cache_key, result_json, expires_at, size_bytes, hit_count)
        VALUES (?, ?, ?, ?, 0)
      `
        )
        .run(key, resultJson, expiresAt, sizeBytes);
    } catch (error) {
      console.warn('Database cache write error:', error);
    }
  }

  private shouldPersistToDb(key: string, priority: CachePriority): boolean {
    // Persist high-priority items and aggregations
    return priority === 'high' || priority === 'critical' || key.startsWith('agg:');
  }

  private generateListingTags(options: ListingOptions): string[] {
    const tags: string[] = ['listing'];

    if (options.category) tags.push(`category:${options.category}`);
    if (options.sortBy) tags.push(`sort:${options.sortBy}`);
    if (options.searchQuery) tags.push('search');
    if (options.filters && options.filters.length > 0) tags.push('filtered');

    return tags;
  }

  private calculateListingPriority(options: ListingOptions): CachePriority {
    // Higher priority for common queries
    if (!options.filters || options.filters.length === 0) {
      return 'high'; // Common unfiltered queries
    }

    if (options.searchQuery) {
      return 'normal'; // Search queries are moderately important
    }

    return 'low'; // Complex filtered queries
  }

  private async invalidateByPattern(pattern: string): Promise<number> {
    let count = 0;

    // Memory cache invalidation
    for (const [key] of this.memoryCache) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
        count++;
      }
    }

    // Database cache invalidation
    if (this.config.dbCacheEnabled) {
      const result = this.db
        .prepare('DELETE FROM query_cache WHERE cache_key LIKE ?')
        .run(`%${pattern}%`);
      count += result.changes;
    }

    return count;
  }

  private async invalidateByTags(tags: string[]): Promise<number> {
    let count = 0;

    // Memory cache invalidation by tags
    for (const [key, entry] of this.memoryCache) {
      if (tags.some(tag => entry.tags.includes(tag))) {
        this.memoryCache.delete(key);
        count++;
      }
    }

    return count;
  }

  private evictEntries(sizeNeeded: number): void {
    // LRU eviction with priority consideration
    const entries = Array.from(this.memoryCache.entries());

    entries.sort((a, b) => {
      const priorityWeight = { low: 1, normal: 2, high: 3, critical: 4 };
      const priorityA = priorityWeight[a[1].priority];
      const priorityB = priorityWeight[b[1].priority];

      if (priorityA !== priorityB) {
        return priorityA - priorityB; // Lower priority first
      }

      return a[1].timestamp - b[1].timestamp; // Older first
    });

    let freedSpace = 0;
    for (const [key, entry] of entries) {
      if (freedSpace >= sizeNeeded) break;

      this.memoryCache.delete(key);
      this.stats.totalSize -= entry.size;
      freedSpace += entry.size;
      this.stats.evictions++;
    }
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.memoryCache) {
      if (now > entry.timestamp + entry.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      const entry = this.memoryCache.get(key);
      if (entry) {
        this.stats.totalSize -= entry.size;
        this.memoryCache.delete(key);
      }
    });

    // Database cleanup
    if (this.config.dbCacheEnabled) {
      this.db.prepare('DELETE FROM query_cache WHERE expires_at < datetime("now")').run();
    }
  }

  private async runPreloadStrategies(): Promise<void> {
    for (const strategy of this.config.preloadStrategies) {
      try {
        switch (strategy) {
          case 'popular':
            await this.preloadPopularSearches();
            break;
          // Add other strategies as needed
        }
      } catch (error) {
        console.warn(`Preload strategy ${strategy} failed:`, error);
      }
    }
  }

  private recordHit(source: string, responseTime: number): void {
    this.stats.hits++;
    this.emit('cache:hit', { source, responseTime });
  }

  private recordMiss(responseTime: number): void {
    this.stats.misses++;
    this.emit('cache:miss', { responseTime });
  }

  private calculateSize(data: any): number {
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  }

  private getMemoryStats() {
    const entries = Array.from(this.memoryCache.values());
    return {
      size: this.stats.totalSize,
      entries: entries.length,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      missRate: this.stats.misses / (this.stats.hits + this.stats.misses) || 0,
      evictionRate: this.stats.evictions / Math.max(this.stats.hits + this.stats.misses, 1),
    };
  }

  private getDbStats() {
    if (!this.config.dbCacheEnabled) {
      return { size: 0, entries: 0, hitRate: 0, missRate: 0 };
    }

    const stats = this.db
      .prepare(
        `
      SELECT
        COUNT(*) as entries,
        SUM(size_bytes) as total_size,
        SUM(hit_count) as total_hits
      FROM query_cache
      WHERE expires_at > datetime('now')
    `
      )
      .get() as any;

    return {
      size: stats.total_size || 0,
      entries: stats.entries || 0,
      hitRate: 0, // Would need more sophisticated tracking
      missRate: 0,
    };
  }

  private calculateCacheEfficiency(): number {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    const memoryUtilization = this.stats.totalSize / this.config.memoryMaxSize;

    // Balance hit rate with memory efficiency
    return hitRate * 0.7 + (1 - memoryUtilization) * 0.3;
  }

  private monitorPerformance(): void {
    const stats = this.getStats();

    if (stats.overall.hitRate < this.config.hitRateThreshold) {
      this.emit('performance:warning', {
        type: 'low_hit_rate',
        hitRate: stats.overall.hitRate,
        threshold: this.config.hitRateThreshold,
      });
    }

    if (stats.memoryCache.size / this.config.memoryMaxSize > 0.9) {
      this.emit('performance:warning', {
        type: 'memory_pressure',
        utilization: stats.memoryCache.size / this.config.memoryMaxSize,
      });
    }
  }
}
