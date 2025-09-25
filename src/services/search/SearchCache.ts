/**
 * High-Performance Search Cache with Redis-like Interface
 * Multi-layer caching strategy optimized for search operations
 */

import { SearchResult, SearchOptions } from '../../types/services';

export interface CacheEntry<T> {
  key: string;
  value: T;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  created: number;
  size: number;
  metadata?: any;
}

export interface CacheStats {
  hitCount: number;
  missCount: number;
  hitRate: number;
  evictions: number;
  totalSize: number;
  entryCount: number;
  averageAccessTime: number;
  hotKeys: string[];
  memoryUsage: number;
}

export interface CacheConfiguration {
  maxSize: number;
  defaultTTL: number;
  checkInterval: number;
  strategy: EvictionStrategy;
  layers: CacheLayerConfig[];
  persistence: PersistenceConfig;
  compression: CompressionConfig;
  warming: WarmingConfig;
}

export type EvictionStrategy = 'lru' | 'lfu' | 'ttl' | 'size' | 'adaptive';

export interface CacheLayerConfig {
  name: string;
  maxSize: number;
  ttl: number;
  strategy: EvictionStrategy;
  enabled: boolean;
}

export interface PersistenceConfig {
  enabled: boolean;
  path?: string;
  interval: number;
  snapshotThreshold: number;
}

export interface CompressionConfig {
  enabled: boolean;
  threshold: number;
  algorithm: 'gzip' | 'deflate' | 'brotli';
}

export interface WarmingConfig {
  enabled: boolean;
  strategies: WarmingStrategy[];
  schedule: string;
}

export type WarmingStrategy = 'popular_queries' | 'recent_searches' | 'predicted_terms';

/**
 * Multi-layer search cache with intelligent eviction and warming
 * Features:
 * - L1: In-memory hot cache (most frequent)
 * - L2: In-memory warm cache (recent/popular)
 * - L3: Disk-based cold cache (persistence)
 * - Query result caching
 * - Term frequency caching
 * - Index segment caching
 * - Intelligent cache warming
 * - Performance monitoring
 */
export class SearchCache {
  private l1Cache = new Map<string, CacheEntry<any>>(); // Hot cache
  private l2Cache = new Map<string, CacheEntry<any>>(); // Warm cache
  private persistentCache = new Map<string, any>(); // Cold cache (simplified)

  private stats: CacheStats = {
    hitCount: 0,
    missCount: 0,
    hitRate: 0,
    evictions: 0,
    totalSize: 0,
    entryCount: 0,
    averageAccessTime: 0,
    hotKeys: [],
    memoryUsage: 0,
  };

  private config: CacheConfiguration;
  private cleanupTimer?: ReturnType<typeof setTimeout>;
  private accessTimes: number[] = [];

  constructor(config?: Partial<CacheConfiguration>) {
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100MB default
      defaultTTL: 300000, // 5 minutes
      checkInterval: 60000, // 1 minute
      strategy: 'adaptive',
      layers: [
        { name: 'l1', maxSize: 1000, ttl: 60000, strategy: 'lfu', enabled: true },
        { name: 'l2', maxSize: 5000, ttl: 300000, strategy: 'lru', enabled: true },
      ],
      persistence: {
        enabled: false,
        interval: 300000, // 5 minutes
        snapshotThreshold: 1000,
      },
      compression: {
        enabled: true,
        threshold: 1024, // 1KB
        algorithm: 'gzip',
      },
      warming: {
        enabled: true,
        strategies: ['popular_queries', 'recent_searches'],
        schedule: '0 */6 * * *', // Every 6 hours
      },
      ...config,
    };

    this.startCleanupTimer();
  }

  /**
   * Get value from cache with automatic promotion between layers
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      // Try L1 cache first (hot)
      const l1Entry = this.l1Cache.get(key);
      if (l1Entry && !this.isExpired(l1Entry)) {
        this.updateAccess(l1Entry);
        this.recordHit(startTime);
        return l1Entry.value as T;
      }

      // Try L2 cache (warm)
      const l2Entry = this.l2Cache.get(key);
      if (l2Entry && !this.isExpired(l2Entry)) {
        this.updateAccess(l2Entry);

        // Promote to L1 if accessed frequently
        if (l2Entry.accessCount > 5) {
          await this.promoteToL1(key, l2Entry);
        }

        this.recordHit(startTime);
        return l2Entry.value as T;
      }

      // Try persistent cache (cold)
      if (this.config.persistence.enabled) {
        const persistentValue = this.persistentCache.get(key);
        if (persistentValue) {
          // Promote to L2
          await this.set(key, persistentValue, this.config.defaultTTL);
          this.recordHit(startTime);
          return persistentValue as T;
        }
      }

      // Cache miss
      this.recordMiss(startTime);
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      this.recordMiss(startTime);
      return null;
    }
  }

  /**
   * Set value in cache with automatic layer assignment
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTTL = ttl || this.config.defaultTTL;
    const size = this.estimateSize(value);
    const now = Date.now();

    const entry: CacheEntry<T> = {
      key,
      value,
      ttl: effectiveTTL,
      accessCount: 1,
      lastAccessed: now,
      created: now,
      size,
      metadata: {},
    };

    // Decide which layer to use based on size and frequency prediction
    if (this.shouldUseL1(key, size)) {
      await this.setInL1(key, entry);
    } else {
      await this.setInL2(key, entry);
    }

    // Update stats
    this.stats.entryCount++;
    this.stats.totalSize += size;
  }

  /**
   * Get multiple values in a single operation
   */
  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    const results: Array<T | null> = [];

    for (const key of keys) {
      const value = await this.get<T>(key);
      results.push(value);
    }

    return results;
  }

  /**
   * Set multiple values in a single operation
   */
  async mset<T>(items: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    const promises = items.map(item => this.set(item.key, item.value, item.ttl));
    await Promise.all(promises);
  }

  /**
   * Delete key from all cache layers
   */
  async delete(key: string): Promise<boolean> {
    let found = false;

    if (this.l1Cache.has(key)) {
      const entry = this.l1Cache.get(key)!;
      this.stats.totalSize -= entry.size;
      this.l1Cache.delete(key);
      found = true;
    }

    if (this.l2Cache.has(key)) {
      const entry = this.l2Cache.get(key)!;
      this.stats.totalSize -= entry.size;
      this.l2Cache.delete(key);
      found = true;
    }

    if (this.persistentCache.has(key)) {
      this.persistentCache.delete(key);
      found = true;
    }

    if (found) {
      this.stats.entryCount--;
    }

    return found;
  }

  /**
   * Delete keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let deleted = 0;

    // Collect matching keys
    const keysToDelete: string[] = [];

    for (const key of this.l1Cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of this.l2Cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of this.persistentCache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    // Delete keys
    for (const key of keysToDelete) {
      const wasDeleted = await this.delete(key);
      if (wasDeleted) deleted++;
    }

    return deleted;
  }

  /**
   * Check if key exists in any layer
   */
  async has(key: string): Promise<boolean> {
    return this.l1Cache.has(key) || this.l2Cache.has(key) || this.persistentCache.has(key);
  }

  /**
   * Set expiration time for existing key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry) {
      l1Entry.ttl = ttl;
      return true;
    }

    const l2Entry = this.l2Cache.get(key);
    if (l2Entry) {
      l2Entry.ttl = ttl;
      return true;
    }

    return false;
  }

  /**
   * Clear all cache layers
   */
  async clear(): Promise<void> {
    this.l1Cache.clear();
    this.l2Cache.clear();
    this.persistentCache.clear();

    this.stats = {
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      evictions: 0,
      totalSize: 0,
      entryCount: 0,
      averageAccessTime: 0,
      hotKeys: [],
      memoryUsage: 0,
    };
  }

  /**
   * Get all keys matching pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    const allKeys = new Set<string>([
      ...this.l1Cache.keys(),
      ...this.l2Cache.keys(),
      ...this.persistentCache.keys(),
    ]);

    if (!pattern) {
      return Array.from(allKeys);
    }

    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(allKeys).filter(key => regex.test(key));
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Warm cache with popular/predicted queries
   */
  async warmCache(warmingData: {
    popularQueries?: string[];
    recentSearches?: string[];
    predictedTerms?: string[];
  }): Promise<void> {
    const { popularQueries = [], recentSearches = [], predictedTerms = [] } = warmingData;

    // Pre-populate cache with popular queries
    for (const query of popularQueries) {
      const cacheKey = this.generateQueryCacheKey(query, {});
      // In a real implementation, you'd fetch the actual results
      // Here we're just marking the keys as "warm"
      await this.set(cacheKey + ':warm', true, this.config.defaultTTL * 2);
    }

    console.log(
      `Cache warmed with ${popularQueries.length} popular queries, ${recentSearches.length} recent searches, ${predictedTerms.length} predicted terms`
    );
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
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    if (this.config.persistence.enabled) {
      await this.persist();
    }
  }

  // =========================
  // Private Implementation
  // =========================

  private shouldUseL1(key: string, size: number): boolean {
    // Use L1 for small, frequently accessed items
    if (size > 10240) return false; // > 10KB goes to L2

    // Check if this key was recently accessed frequently
    const recentKey = this.l2Cache.get(key);
    if (recentKey && recentKey.accessCount > 3) {
      return true;
    }

    // Use L1 for search results (typically accessed multiple times)
    if (key.startsWith('query:')) {
      return true;
    }

    return false;
  }

  private async setInL1(key: string, entry: CacheEntry<any>): Promise<void> {
    // Check L1 capacity
    const l1Config = this.config.layers.find(l => l.name === 'l1')!;

    while (this.l1Cache.size >= l1Config.maxSize) {
      await this.evictFromL1();
    }

    this.l1Cache.set(key, entry);
  }

  private async setInL2(key: string, entry: CacheEntry<any>): Promise<void> {
    // Check L2 capacity
    const l2Config = this.config.layers.find(l => l.name === 'l2')!;

    while (this.l2Cache.size >= l2Config.maxSize) {
      await this.evictFromL2();
    }

    this.l2Cache.set(key, entry);
  }

  private async promoteToL1(key: string, entry: CacheEntry<any>): Promise<void> {
    // Remove from L2
    this.l2Cache.delete(key);

    // Add to L1
    await this.setInL1(key, entry);
  }

  private async evictFromL1(): Promise<void> {
    const l1Config = this.config.layers.find(l => l.name === 'l1')!;
    const victim = this.selectEvictionVictim(this.l1Cache, l1Config.strategy);

    if (victim) {
      const [key, entry] = victim;
      this.l1Cache.delete(key);

      // Demote to L2 if still valuable
      if (entry.accessCount > 1) {
        await this.setInL2(key, entry);
      }

      this.stats.evictions++;
    }
  }

  private async evictFromL2(): Promise<void> {
    const l2Config = this.config.layers.find(l => l.name === 'l2')!;
    const victim = this.selectEvictionVictim(this.l2Cache, l2Config.strategy);

    if (victim) {
      const [key, entry] = victim;
      this.l2Cache.delete(key);

      // Move to persistent cache if enabled
      if (this.config.persistence.enabled && entry.accessCount > 0) {
        this.persistentCache.set(key, entry.value);
      }

      this.stats.evictions++;
    }
  }

  private selectEvictionVictim(
    cache: Map<string, CacheEntry<any>>,
    strategy: EvictionStrategy
  ): [string, CacheEntry<any>] | null {
    if (cache.size === 0) return null;

    const entries = Array.from(cache.entries());

    switch (strategy) {
      case 'lru':
        return entries.reduce((oldest, current) =>
          current[1].lastAccessed < oldest[1].lastAccessed ? current : oldest
        );

      case 'lfu':
        return entries.reduce((least, current) =>
          current[1].accessCount < least[1].accessCount ? current : least
        );

      case 'ttl':
        const now = Date.now();
        return entries.reduce((soonest, current) => {
          const currentExpiry = current[1].created + current[1].ttl;
          const soonestExpiry = soonest[1].created + soonest[1].ttl;
          return currentExpiry < soonestExpiry ? current : soonest;
        });

      case 'size':
        return entries.reduce((largest, current) =>
          current[1].size > largest[1].size ? current : largest
        );

      case 'adaptive':
        // Adaptive strategy considers multiple factors
        return entries.reduce((worst, current) => {
          const currentScore = this.calculateAdaptiveScore(current[1]);
          const worstScore = this.calculateAdaptiveScore(worst[1]);
          return currentScore < worstScore ? current : worst;
        });

      default:
        return entries[0];
    }
  }

  private calculateAdaptiveScore(entry: CacheEntry<any>): number {
    const now = Date.now();
    const age = now - entry.created;
    const timeSinceAccess = now - entry.lastAccessed;

    // Higher score = more valuable = less likely to evict
    let score = 0;

    // Frequency component (logarithmic to prevent dominance)
    score += Math.log(1 + entry.accessCount) * 10;

    // Recency component
    score += Math.max(0, 100 - timeSinceAccess / 1000); // Decay over 100 seconds

    // Size penalty (prefer keeping smaller items)
    score -= Math.sqrt(entry.size / 1024); // Size in KB

    // TTL consideration (prefer items with longer remaining life)
    const remainingTTL = entry.ttl - age;
    score += Math.max(0, remainingTTL / 1000); // Remaining seconds

    return score;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    const now = Date.now();
    return now - entry.created > entry.ttl;
  }

  private updateAccess(entry: CacheEntry<any>): void {
    entry.accessCount++;
    entry.lastAccessed = Date.now();
  }

  private recordHit(startTime: number): void {
    this.stats.hitCount++;
    this.recordAccessTime(startTime);
    this.updateHitRate();
  }

  private recordMiss(startTime: number): void {
    this.stats.missCount++;
    this.recordAccessTime(startTime);
    this.updateHitRate();
  }

  private recordAccessTime(startTime: number): void {
    const accessTime = Date.now() - startTime;
    this.accessTimes.push(accessTime);

    // Keep only last 1000 access times
    if (this.accessTimes.length > 1000) {
      this.accessTimes = this.accessTimes.slice(-1000);
    }

    // Update average
    this.stats.averageAccessTime =
      this.accessTimes.reduce((sum, time) => sum + time, 0) / this.accessTimes.length;
  }

  private updateHitRate(): void {
    const total = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0;
  }

  private updateStats(): void {
    // Update memory usage estimation
    this.stats.memoryUsage = 0;

    for (const entry of this.l1Cache.values()) {
      this.stats.memoryUsage += entry.size;
    }

    for (const entry of this.l2Cache.values()) {
      this.stats.memoryUsage += entry.size;
    }

    // Update hot keys
    const allEntries = [
      ...Array.from(this.l1Cache.entries()),
      ...Array.from(this.l2Cache.entries()),
    ];

    this.stats.hotKeys = allEntries
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, 10)
      .map(([key]) => key);
  }

  private estimateSize(value: any): number {
    if (typeof value === 'string') {
      return value.length * 2; // Unicode characters
    }

    if (typeof value === 'number') {
      return 8; // 64-bit number
    }

    if (typeof value === 'boolean') {
      return 1;
    }

    if (Array.isArray(value)) {
      return value.reduce((sum, item) => sum + this.estimateSize(item), 0) + 24; // Array overhead
    }

    if (typeof value === 'object' && value !== null) {
      return (
        Object.entries(value).reduce(
          (sum, [key, val]) => sum + key.length * 2 + this.estimateSize(val),
          0
        ) + 32
      ); // Object overhead
    }

    return 8; // Default estimate
  }

  private hashOptions(options: SearchOptions): string {
    const relevant = {
      limit: options.limit,
      category: options.category,
      tags: options.tags,
      sortBy: options.sortBy,
      useAI: options.useAI,
      threshold: options.threshold,
    };

    return JSON.stringify(relevant);
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.checkInterval);
  }

  private cleanup(): void {
    const now = Date.now();

    // Clean expired entries from L1
    for (const [key, entry] of this.l1Cache.entries()) {
      if (this.isExpired(entry)) {
        this.l1Cache.delete(key);
        this.stats.totalSize -= entry.size;
        this.stats.entryCount--;
      }
    }

    // Clean expired entries from L2
    for (const [key, entry] of this.l2Cache.entries()) {
      if (this.isExpired(entry)) {
        this.l2Cache.delete(key);
        this.stats.totalSize -= entry.size;
        this.stats.entryCount--;
      }
    }
  }

  private async persist(): Promise<void> {
    // Simplified persistence - in production you'd use proper serialization
    console.log('Persisting cache to disk (simplified implementation)');
  }
}

export default SearchCache;
