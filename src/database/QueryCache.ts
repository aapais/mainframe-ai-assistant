/**
 * Intelligent Query Cache for Sub-1s Performance
 *
 * Implements multi-level caching with TTL, LRU eviction, and smart invalidation
 * to ensure search operations complete in under 1 second.
 */

import Database from 'better-sqlite3';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  hitCount: number;
  lastAccessed: number;
  computeTime: number;
  size: number;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  avgResponseTime: number;
  evictionCount: number;
  topQueries: Array<{ query: string; hitCount: number; avgTime: number }>;
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  maxMemoryMB: number;
  persistToDisk: boolean;
  compressionEnabled: boolean;
}

export class QueryCache {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private db: Database.Database;
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalResponseTime: 0,
    operations: 0,
  };

  constructor(db: Database.Database, config?: Partial<CacheConfig>) {
    this.db = db;
    this.config = {
      maxSize: 1000,
      defaultTTL: 300000, // 5 minutes
      maxMemoryMB: 100,
      persistToDisk: true,
      compressionEnabled: true,
      ...config,
    };

    this.initializePersistentCache();
    this.startMaintenanceTimer();
  }

  /**
   * Initialize persistent cache table for cross-session caching
   */
  private initializePersistentCache(): void {
    if (!this.config.persistToDisk) return;

    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS query_cache (
          cache_key TEXT PRIMARY KEY,
          value_data TEXT NOT NULL,
          value_type TEXT DEFAULT 'json',
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          hit_count INTEGER DEFAULT 0,
          last_accessed INTEGER NOT NULL,
          compute_time INTEGER DEFAULT 0,
          data_size INTEGER DEFAULT 0,
          compression_used BOOLEAN DEFAULT FALSE
        )
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_cache_expires 
        ON query_cache(expires_at)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_cache_accessed 
        ON query_cache(last_accessed DESC)
      `);

      console.log('✅ Persistent query cache initialized');
    } catch (error) {
      console.error('❌ Failed to initialize persistent cache:', error);
    }
  }

  /**
   * Get cached query result with intelligent fallback
   */
  async get<T>(
    key: string,
    computeFn: () => Promise<T> | T,
    options?: {
      ttl?: number;
      tags?: string[];
      forceRefresh?: boolean;
    }
  ): Promise<T> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(key, options?.tags);

    // Check if force refresh is requested
    if (options?.forceRefresh) {
      return this.computeAndCache(cacheKey, computeFn, options);
    }

    // Try memory cache first (fastest)
    const memoryResult = this.getFromMemory<T>(cacheKey);
    if (memoryResult !== null) {
      this.updateStats('hit', Date.now() - startTime);
      return memoryResult;
    }

    // Try persistent cache (slower but still fast)
    if (this.config.persistToDisk) {
      const persistentResult = await this.getFromDisk<T>(cacheKey);
      if (persistentResult !== null) {
        // Promote to memory cache
        this.setInMemory(cacheKey, persistentResult, options?.ttl);
        this.updateStats('hit', Date.now() - startTime);
        return persistentResult;
      }
    }

    // Cache miss - compute and store
    this.updateStats('miss', Date.now() - startTime);
    return this.computeAndCache(cacheKey, computeFn, options);
  }

  /**
   * Set value in cache with intelligent storage strategy
   */
  async set<T>(
    key: string,
    value: T,
    options?: {
      ttl?: number;
      tags?: string[];
      priority?: 'low' | 'normal' | 'high';
    }
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(key, options?.tags);
    const ttl = options?.ttl || this.config.defaultTTL;

    // Always store in memory for fast access
    this.setInMemory(cacheKey, value, ttl, options?.priority);

    // Store in persistent cache if enabled
    if (this.config.persistToDisk) {
      await this.setOnDisk(cacheKey, value, ttl);
    }
  }

  /**
   * Invalidate cache entries by key pattern or tags
   */
  async invalidate(pattern?: string, tags?: string[]): Promise<number> {
    let invalidated = 0;

    // Invalidate memory cache
    if (pattern) {
      const regex = new RegExp(pattern);
      for (const [key] of this.memoryCache) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
          invalidated++;
        }
      }
    }

    if (tags && tags.length > 0) {
      for (const [key] of this.memoryCache) {
        if (tags.some(tag => key.includes(`tag:${tag}`))) {
          this.memoryCache.delete(key);
          invalidated++;
        }
      }
    }

    // Invalidate persistent cache
    if (this.config.persistToDisk) {
      try {
        let sql = 'DELETE FROM query_cache WHERE 1=1';
        const params: any[] = [];

        if (pattern) {
          sql += ' AND cache_key LIKE ?';
          params.push(`%${pattern}%`);
        }

        if (tags && tags.length > 0) {
          const tagConditions = tags.map(() => 'cache_key LIKE ?').join(' OR ');
          sql += ` AND (${tagConditions})`;
          params.push(...tags.map(tag => `%tag:${tag}%`));
        }

        const result = this.db.prepare(sql).run(...params);
        invalidated += result.changes || 0;
      } catch (error) {
        console.error('Error invalidating persistent cache:', error);
      }
    }

    console.log(`🗑️ Invalidated ${invalidated} cache entries`);
    return invalidated;
  }

  /**
   * Pre-warm cache with commonly accessed queries
   * Enhanced for 1000+ entries with intelligent pre-loading
   */
  async preWarm(): Promise<void> {
    console.log('🔥 Pre-warming query cache for large dataset...');
    const startTime = Date.now();

    // Analyze recent search patterns to pre-warm intelligently
    const frequentQueries = await this.analyzeFrequentQueries();

    const commonQueries = [
      { key: 'popular_entries', fn: () => this.getPopularEntries(), priority: 'high' },
      { key: 'recent_entries', fn: () => this.getRecentEntries(), priority: 'high' },
      { key: 'category_stats', fn: () => this.getCategoryStats(), priority: 'medium' },
      { key: 'usage_trends', fn: () => this.getUsageTrends(), priority: 'medium' },
      { key: 'search_autocomplete', fn: () => this.getSearchAutoComplete(), priority: 'high' },
    ];

    // Pre-warm critical queries with parallel execution
    const highPriorityQueries = commonQueries.filter(q => q.priority === 'high');
    await Promise.all(
      highPriorityQueries.map(async ({ key, fn }) => {
        try {
          await this.get(key, fn, { ttl: 900000 }); // 15 minutes TTL for high-priority
        } catch (error) {
          console.error(`Failed to pre-warm ${key}:`, error);
        }
      })
    );

    // Pre-warm medium priority queries
    const mediumPriorityQueries = commonQueries.filter(q => q.priority === 'medium');
    await Promise.all(
      mediumPriorityQueries.map(async ({ key, fn }) => {
        try {
          await this.get(key, fn, { ttl: 600000 }); // 10 minutes TTL for medium-priority
        } catch (error) {
          console.error(`Failed to pre-warm ${key}:`, error);
        }
      })
    );

    // Pre-warm frequent search categories with dynamic analysis
    const categoryStats = await this.getCategoryUsageStats();
    const topCategories = categoryStats
      .sort((a, b) => b.searchFrequency - a.searchFrequency)
      .slice(0, 8); // Top 8 categories

    await Promise.all(
      topCategories.map(async ({ category, searchFrequency }) => {
        const ttl = this.calculateTTLBasedOnUsage(searchFrequency);
        await this.get(`category:${category}`, () => this.getCategoryEntries(category), { ttl });
      })
    );

    // Pre-warm frequent user queries from history
    await Promise.all(
      frequentQueries.slice(0, 20).map(async query => {
        try {
          await this.get(`frequent:${query.normalized}`, () => this.executeFrequentQuery(query), {
            ttl: this.calculateTTLBasedOnUsage(query.frequency),
          });
        } catch (error) {
          console.error(`Failed to pre-warm frequent query: ${query.normalized}`, error);
        }
      })
    );

    // Pre-warm search result pages for pagination
    const popularSearches = await this.getPopularSearches();
    for (const search of popularSearches.slice(0, 10)) {
      for (let offset = 0; offset < 50; offset += 10) {
        await this.get(
          `paginated:${search.query}:${offset}`,
          () => this.executePaginatedSearch(search.query, offset),
          { ttl: 300000 } // 5 minutes for pagination
        );
      }
    }

    console.log(`✅ Intelligent cache pre-warming completed in ${Date.now() - startTime}ms`);
  }

  /**
   * Analyze frequent queries from search history
   */
  private async analyzeFrequentQueries(): Promise<
    Array<{
      normalized: string;
      original: string;
      frequency: number;
      avgTime: number;
    }>
  > {
    if (!this.config.persistToDisk) return [];

    return this.db
      .prepare(
        `
      SELECT 
        LOWER(TRIM(query)) as normalized,
        query as original,
        COUNT(*) as frequency,
        AVG(search_time_ms) as avgTime
      FROM search_history 
      WHERE timestamp > datetime('now', '-14 days')
        AND LENGTH(query) > 2
      GROUP BY LOWER(TRIM(query))
      HAVING frequency >= 3
      ORDER BY frequency DESC, avgTime DESC
      LIMIT 50
    `
      )
      .all() as any[];
  }

  /**
   * Get category usage statistics
   */
  private async getCategoryUsageStats(): Promise<
    Array<{
      category: string;
      searchFrequency: number;
      avgResultsReturned: number;
    }>
  > {
    return this.db
      .prepare(
        `
      SELECT 
        SUBSTR(query, 10) as category,
        COUNT(*) as searchFrequency,
        AVG(results_count) as avgResultsReturned
      FROM search_history 
      WHERE timestamp > datetime('now', '-7 days')
        AND query LIKE 'category:%'
      GROUP BY SUBSTR(query, 10)
      ORDER BY searchFrequency DESC
    `
      )
      .all() as any[];
  }

  /**
   * Calculate TTL based on usage frequency
   */
  private calculateTTLBasedOnUsage(frequency: number): number {
    // More frequent queries get longer TTL
    if (frequency > 100) return 1800000; // 30 minutes
    if (frequency > 50) return 900000; // 15 minutes
    if (frequency > 20) return 600000; // 10 minutes
    if (frequency > 10) return 300000; // 5 minutes
    return 180000; // 3 minutes for low-frequency
  }

  /**
   * Execute frequent query for caching
   */
  private async executeFrequentQuery(query: any): Promise<any[]> {
    // This would execute the actual search query
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Execute paginated search for caching
   */
  private async executePaginatedSearch(query: string, offset: number): Promise<any[]> {
    // Execute the search with pagination
    return [];
  }

  /**
   * Get popular searches from history
   */
  private async getPopularSearches(): Promise<
    Array<{
      query: string;
      frequency: number;
    }>
  > {
    return this.db
      .prepare(
        `
      SELECT query, COUNT(*) as frequency
      FROM search_history 
      WHERE timestamp > datetime('now', '-7 days')
        AND LENGTH(query) > 2
      GROUP BY query
      ORDER BY frequency DESC
      LIMIT 20
    `
      )
      .all() as any[];
  }

  /**
   * Get search autocomplete data
   */
  private async getSearchAutoComplete(): Promise<any[]> {
    return this.db
      .prepare(
        `
      SELECT DISTINCT 
        SUBSTR(query, 1, 20) as suggestion,
        COUNT(*) as frequency
      FROM search_history 
      WHERE timestamp > datetime('now', '-30 days')
        AND LENGTH(query) >= 3
      GROUP BY SUBSTR(query, 1, 20)
      ORDER BY frequency DESC
      LIMIT 100
    `
      )
      .all();
  }

  /**
   * Get memory cache entry
   */
  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.memoryCache.delete(key);
      return null;
    }

    // Update access stats
    entry.hitCount++;
    entry.lastAccessed = Date.now();

    return entry.value;
  }

  /**
   * Set memory cache entry with LRU eviction
   */
  private setInMemory<T>(
    key: string,
    value: T,
    ttl?: number,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): void {
    // Check memory limit and evict if necessary
    this.enforceMemoryLimit();

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      hitCount: 1,
      lastAccessed: Date.now(),
      computeTime: 0,
      size: this.estimateSize(value),
    };

    // Adjust TTL based on priority
    if (priority === 'high') {
      entry.ttl *= 2;
    } else if (priority === 'low') {
      entry.ttl *= 0.5;
    }

    this.memoryCache.set(key, entry);
  }

  /**
   * Get from persistent cache
   */
  private async getFromDisk<T>(key: string): Promise<T | null> {
    if (!this.config.persistToDisk) return null;

    try {
      const result = this.db
        .prepare(
          `
        SELECT 
          value_data,
          value_type,
          expires_at,
          hit_count,
          compression_used
        FROM query_cache 
        WHERE cache_key = ? AND expires_at > ?
      `
        )
        .get(key, Date.now()) as any;

      if (!result) return null;

      // Update access stats
      this.db
        .prepare(
          `
        UPDATE query_cache 
        SET hit_count = hit_count + 1, last_accessed = ?
        WHERE cache_key = ?
      `
        )
        .run(Date.now(), key);

      // Deserialize value
      let value = result.value_data;
      if (result.compression_used) {
        value = this.decompress(value);
      }

      if (result.value_type === 'json') {
        return JSON.parse(value);
      }

      return value;
    } catch (error) {
      console.error('Error reading from persistent cache:', error);
      return null;
    }
  }

  /**
   * Set on persistent cache
   */
  private async setOnDisk<T>(key: string, value: T, ttl: number): Promise<void> {
    if (!this.config.persistToDisk) return;

    try {
      let serializedValue = JSON.stringify(value);
      let compressed = false;

      // Compress large values
      if (this.config.compressionEnabled && serializedValue.length > 1000) {
        serializedValue = this.compress(serializedValue);
        compressed = true;
      }

      const expiresAt = Date.now() + ttl;
      const dataSize = serializedValue.length;

      this.db
        .prepare(
          `
        INSERT OR REPLACE INTO query_cache (
          cache_key, value_data, value_type, created_at, expires_at,
          last_accessed, data_size, compression_used
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(key, serializedValue, 'json', Date.now(), expiresAt, Date.now(), dataSize, compressed);
    } catch (error) {
      console.error('Error writing to persistent cache:', error);
    }
  }

  /**
   * Compute value and cache result
   */
  private async computeAndCache<T>(
    key: string,
    computeFn: () => Promise<T> | T,
    options?: { ttl?: number; tags?: string[] }
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const value = await computeFn();
      const computeTime = Date.now() - startTime;

      // Cache the computed value
      await this.set(key, value, {
        ttl: options?.ttl,
        tags: options?.tags,
        priority: computeTime > 100 ? 'high' : 'normal', // Cache slow computations longer
      });

      return value;
    } catch (error) {
      console.error('Error computing cached value:', error);
      throw error;
    }
  }

  /**
   * Generate cache key with tags
   */
  private generateCacheKey(key: string, tags?: string[]): string {
    let cacheKey = `qc:${key}`;
    if (tags && tags.length > 0) {
      cacheKey += `:tags:${tags.sort().join(',')}`;
    }
    return cacheKey;
  }

  /**
   * Enforce memory limits with intelligent eviction
   */
  private enforceMemoryLimit(): void {
    const currentSize = this.getCurrentMemoryUsage();
    const maxSize = this.config.maxMemoryMB * 1024 * 1024;

    if (currentSize <= maxSize && this.memoryCache.size < this.config.maxSize) {
      return;
    }

    // Sort entries by LRU with consideration for hit count and compute time
    const entries = Array.from(this.memoryCache.entries()).sort((a, b) => {
      const [, entryA] = a;
      const [, entryB] = b;

      // Prefer keeping high-value entries (frequently accessed, expensive to compute)
      const scoreA = entryA.hitCount * Math.log(entryA.computeTime + 1);
      const scoreB = entryB.hitCount * Math.log(entryB.computeTime + 1);

      if (scoreA !== scoreB) {
        return scoreA - scoreB; // Lower score gets evicted first
      }

      return entryA.lastAccessed - entryB.lastAccessed; // Older gets evicted first
    });

    // Evict least valuable entries
    const targetEviction = Math.max(
      Math.ceil(this.memoryCache.size * 0.1), // At least 10%
      this.memoryCache.size - this.config.maxSize + 100 // Plus buffer
    );

    for (let i = 0; i < targetEviction && i < entries.length; i++) {
      const [key] = entries[i];
      this.memoryCache.delete(key);
      this.stats.evictions++;
    }

    console.log(`🗑️ Evicted ${targetEviction} cache entries to maintain memory limit`);
  }

  /**
   * Get current memory usage in bytes
   */
  private getCurrentMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.memoryCache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  /**
   * Estimate object size in bytes
   */
  private estimateSize(obj: any): number {
    const json = JSON.stringify(obj);
    return new Blob([json]).size;
  }

  /**
   * Update cache statistics
   */
  private updateStats(type: 'hit' | 'miss', responseTime: number): void {
    if (type === 'hit') {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }

    this.stats.totalResponseTime += responseTime;
    this.stats.operations++;
  }

  /**
   * Start maintenance timer for cleanup
   */
  private startMaintenanceTimer(): void {
    // Clean up expired entries every 5 minutes
    setInterval(
      () => {
        this.cleanupExpiredEntries();
      },
      5 * 60 * 1000
    );

    // Full maintenance every hour
    setInterval(
      () => {
        this.performMaintenance();
      },
      60 * 60 * 1000
    );
  }

  /**
   * Clean up expired entries from both caches
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleaned = 0;

    // Clean memory cache
    for (const [key, entry] of this.memoryCache) {
      if (now > entry.timestamp + entry.ttl) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    // Clean persistent cache
    if (this.config.persistToDisk) {
      try {
        const result = this.db
          .prepare(
            `
          DELETE FROM query_cache WHERE expires_at < ?
        `
          )
          .run(now);
        cleaned += result.changes || 0;
      } catch (error) {
        console.error('Error cleaning persistent cache:', error);
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired cache entries`);
    }
  }

  /**
   * Perform comprehensive cache maintenance
   */
  private performMaintenance(): void {
    console.log('🔧 Performing cache maintenance...');

    this.cleanupExpiredEntries();
    this.enforceMemoryLimit();

    // Vacuum persistent cache if it exists
    if (this.config.persistToDisk) {
      try {
        // Remove old entries beyond retention period
        const retentionDays = 7;
        const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

        this.db
          .prepare(
            `
          DELETE FROM query_cache 
          WHERE created_at < ? AND hit_count < 5
        `
          )
          .run(cutoff);

        console.log('✅ Cache maintenance completed');
      } catch (error) {
        console.error('Error during cache maintenance:', error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalOperations = this.stats.hits + this.stats.misses;
    const hitRate = totalOperations > 0 ? this.stats.hits / totalOperations : 0;
    const avgResponseTime =
      this.stats.operations > 0 ? this.stats.totalResponseTime / this.stats.operations : 0;

    // Get top queries from persistent cache
    const topQueries = this.config.persistToDisk
      ? this.db
          .prepare(
            `
        SELECT 
          cache_key as query,
          hit_count,
          AVG(data_size) as avg_time
        FROM query_cache
        GROUP BY cache_key
        ORDER BY hit_count DESC
        LIMIT 10
      `
          )
          .all()
      : [];

    return {
      totalEntries: this.memoryCache.size,
      totalSize: this.getCurrentMemoryUsage(),
      hitRate: Math.round(hitRate * 100) / 100,
      missRate: Math.round((1 - hitRate) * 100) / 100,
      avgResponseTime: Math.round(avgResponseTime),
      evictionCount: this.stats.evictions,
      topQueries: topQueries as any[],
    };
  }

  /**
   * Compress string data (simplified implementation)
   */
  private compress(data: string): string {
    // In a real implementation, use a proper compression library
    // This is a placeholder
    return data;
  }

  /**
   * Decompress string data
   */
  private decompress(data: string): string {
    // In a real implementation, use a proper compression library
    // This is a placeholder
    return data;
  }

  // Helper methods for common queries (used in pre-warming)

  private async getPopularEntries(): Promise<any[]> {
    return this.db
      .prepare(
        `
      SELECT id, title, category, usage_count, success_count
      FROM kb_entries
      WHERE archived = FALSE
      ORDER BY usage_count DESC, success_count DESC
      LIMIT 20
    `
      )
      .all();
  }

  private async getRecentEntries(): Promise<any[]> {
    return this.db
      .prepare(
        `
      SELECT id, title, category, created_at
      FROM kb_entries
      WHERE archived = FALSE
      ORDER BY created_at DESC
      LIMIT 20
    `
      )
      .all();
  }

  private async getCategoryStats(): Promise<any[]> {
    return this.db
      .prepare(
        `
      SELECT 
        category,
        COUNT(*) as total,
        SUM(usage_count) as total_usage,
        AVG(CASE WHEN (success_count + failure_count) > 0 
                 THEN CAST(success_count AS REAL) / (success_count + failure_count)
                 ELSE 0 END) as avg_success_rate
      FROM kb_entries
      WHERE archived = FALSE
      GROUP BY category
    `
      )
      .all();
  }

  private async getUsageTrends(): Promise<any[]> {
    return this.db
      .prepare(
        `
      SELECT 
        date(timestamp) as date,
        COUNT(*) as searches,
        COUNT(DISTINCT user_id) as unique_users
      FROM search_history
      WHERE timestamp > datetime('now', '-30 days')
      GROUP BY date(timestamp)
      ORDER BY date DESC
    `
      )
      .all();
  }

  private async getCategoryEntries(category: string): Promise<any[]> {
    return this.db
      .prepare(
        `
      SELECT id, title, problem, solution, usage_count, success_count
      FROM kb_entries
      WHERE category = ? AND archived = FALSE
      ORDER BY usage_count DESC
      LIMIT 50
    `
      )
      .all(category);
  }
}
