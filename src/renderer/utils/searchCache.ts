/**
 * Advanced Search Results Caching System
 *
 * Implements a high-performance LRU cache with:
 * - Memory-efficient storage
 * - TTL-based expiration
 * - Search query normalization
 * - Cache hit analytics
 * - Automatic cleanup
 *
 * @author Performance Optimizer
 * @version 1.0.0
 */

import { SearchResult, SearchOptions } from '../../types/services';

// ===========================================
// Types and Interfaces
// ===========================================

export interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;
}

export interface CacheStats {
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  totalEntries: number;
  memoryUsage: number;
  averageResponseTime: number;
}

export interface SearchCacheConfig {
  maxSize: number; // Maximum memory usage in bytes
  maxEntries: number; // Maximum number of entries
  defaultTTL: number; // Default TTL in milliseconds
  cleanupInterval: number; // Cleanup interval in milliseconds
  enableAnalytics: boolean;
}

// ===========================================
// Default Configuration
// ===========================================

const DEFAULT_CACHE_CONFIG: SearchCacheConfig = {
  maxSize: 10 * 1024 * 1024, // 10MB
  maxEntries: 500,
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  cleanupInterval: 60 * 1000, // 1 minute
  enableAnalytics: true,
};

// ===========================================
// Search Query Normalizer
// ===========================================

export class SearchQueryNormalizer {
  private static readonly STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'the', 'this', 'but', 'they', 'have',
    'had', 'what', 'said', 'each', 'which', 'their', 'time', 'will'
  ]);

  static normalize(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, ' ') // Remove special characters except hyphens
      .replace(/\s+/g, ' ') // Normalize whitespace
      .split(' ')
      .filter(word => word.length > 1 && !this.STOP_WORDS.has(word))
      .sort() // Sort for consistent cache keys
      .join(' ');
  }

  static createCacheKey(query: string, options?: Partial<SearchOptions>): string {
    const normalizedQuery = this.normalize(query);

    const keyParts = [normalizedQuery];

    if (options?.category) {
      keyParts.push(`cat:${options.category}`);
    }

    if (options?.useAI) {
      keyParts.push('ai:true');
    }

    if (options?.sortBy && options.sortBy !== 'relevance') {
      keyParts.push(`sort:${options.sortBy}:${options.sortOrder || 'desc'}`);
    }

    if (options?.limit && options.limit !== 50) {
      keyParts.push(`limit:${options.limit}`);
    }

    return keyParts.join('|');
  }
}

// ===========================================
// LRU Cache Implementation
// ===========================================

export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Map<string, number>(); // Track access order
  private config: SearchCacheConfig;
  private stats: CacheStats;
  private currentMemoryUsage = 0;
  private accessCounter = 0;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<SearchCacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.stats = {
      totalHits: 0,
      totalMisses: 0,
      hitRate: 0,
      totalEntries: 0,
      memoryUsage: 0,
      averageResponseTime: 0,
    };

    this.startCleanupTimer();
  }

  private startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private calculateSize(data: T): number {
    try {
      // Rough estimation of memory usage
      const jsonString = JSON.stringify(data);
      return new Blob([jsonString]).size;
    } catch {
      // Fallback estimation
      return 1024; // 1KB default
    }
  }

  private evictLRU() {
    if (this.cache.size === 0) return;

    // Find least recently used entry
    let oldestKey = '';
    let oldestAccess = Infinity;

    for (const [key, accessTime] of this.accessOrder) {
      if (accessTime < oldestAccess) {
        oldestAccess = accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  private evictExpired() {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.delete(key));
    return expiredKeys.length;
  }

  private updateStats() {
    this.stats.totalEntries = this.cache.size;
    this.stats.memoryUsage = this.currentMemoryUsage;
    this.stats.hitRate = this.stats.totalHits / (this.stats.totalHits + this.stats.totalMisses) * 100;
  }

  set(key: string, data: T, ttl: number = this.config.defaultTTL): void {
    const size = this.calculateSize(data);

    // Check if we need to evict entries
    while (
      (this.currentMemoryUsage + size > this.config.maxSize) ||
      (this.cache.size >= this.config.maxEntries)
    ) {
      this.evictLRU();
    }

    // Remove existing entry if updating
    if (this.cache.has(key)) {
      const existingEntry = this.cache.get(key)!;
      this.currentMemoryUsage -= existingEntry.size;
    }

    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      size,
    };

    this.cache.set(key, entry);
    this.accessOrder.set(key, this.accessCounter++);
    this.currentMemoryUsage += size;

    this.updateStats();
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.totalMisses++;
      this.updateStats();
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      this.stats.totalMisses++;
      this.updateStats();
      return null;
    }

    // Update access tracking
    entry.hits++;
    this.accessOrder.set(key, this.accessCounter++);
    this.stats.totalHits++;
    this.updateStats();

    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentMemoryUsage -= entry.size;
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.updateStats();
      return true;
    }
    return false;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.currentMemoryUsage = 0;
    this.accessCounter = 0;
    this.stats = {
      totalHits: 0,
      totalMisses: 0,
      hitRate: 0,
      totalEntries: 0,
      memoryUsage: 0,
      averageResponseTime: 0,
    };
  }

  cleanup(): number {
    const expiredCount = this.evictExpired();

    // Also evict if we're over memory limit
    while (this.currentMemoryUsage > this.config.maxSize * 0.9) {
      this.evictLRU();
    }

    this.updateStats();
    return expiredCount;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  getTopEntries(limit: number = 10): Array<{ key: string; hits: number; size: number }> {
    return Array.from(this.cache.values())
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit)
      .map(entry => ({
        key: entry.key,
        hits: entry.hits,
        size: entry.size,
      }));
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

// ===========================================
// Search-Specific Cache
// ===========================================

export interface SearchCacheEntry {
  results: SearchResult[];
  totalResults: number;
  searchTime: number;
  source: 'cache' | 'database' | 'ai';
  metadata?: any;
}

export class SearchResultsCache extends LRUCache<SearchCacheEntry> {
  private responseTimeTracker: number[] = [];

  constructor(config?: Partial<SearchCacheConfig>) {
    super(config);
  }

  cacheSearchResults(
    query: string,
    options: Partial<SearchOptions>,
    results: SearchResult[],
    totalResults: number,
    searchTime: number,
    metadata?: any
  ): void {
    const key = SearchQueryNormalizer.createCacheKey(query, options);

    const entry: SearchCacheEntry = {
      results: results.map(result => ({
        ...result,
        // Clone to prevent mutations affecting cache
        entry: { ...result.entry },
      })),
      totalResults,
      searchTime,
      source: 'database',
      metadata,
    };

    this.set(key, entry);

    // Track response times for analytics
    this.responseTimeTracker.push(searchTime);
    if (this.responseTimeTracker.length > 100) {
      this.responseTimeTracker.shift();
    }
  }

  getCachedResults(
    query: string,
    options: Partial<SearchOptions>
  ): SearchCacheEntry | null {
    const key = SearchQueryNormalizer.createCacheKey(query, options);
    const entry = this.get(key);

    if (entry) {
      // Mark as cached result
      return {
        ...entry,
        source: 'cache' as const,
      };
    }

    return null;
  }

  getAverageResponseTime(): number {
    if (this.responseTimeTracker.length === 0) return 0;
    return this.responseTimeTracker.reduce((sum, time) => sum + time, 0) / this.responseTimeTracker.length;
  }

  getCacheEfficiency(): {
    hitRate: number;
    averageResponseTime: number;
    memorySavings: number;
    totalQueries: number;
  } {
    const stats = this.getStats();
    const avgResponseTime = this.getAverageResponseTime();

    // Estimate memory savings from cache hits
    const avgCacheSize = stats.memoryUsage / Math.max(1, stats.totalEntries);
    const memorySavings = stats.totalHits * avgCacheSize;

    return {
      hitRate: stats.hitRate,
      averageResponseTime: avgResponseTime,
      memorySavings,
      totalQueries: stats.totalHits + stats.totalMisses,
    };
  }

  // Preload common searches
  preloadCommonSearches(commonQueries: Array<{ query: string; options?: Partial<SearchOptions> }>) {
    // This would be implemented to preload frequently searched terms
    console.log('Preloading common searches:', commonQueries);
  }

  // Invalidate cache entries based on patterns
  invalidatePattern(pattern: string): number {
    let invalidatedCount = 0;
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.delete(key);
      invalidatedCount++;
    });

    return invalidatedCount;
  }
}

// ===========================================
// Global Cache Instance
// ===========================================

export const searchCache = new SearchResultsCache({
  maxSize: 15 * 1024 * 1024, // 15MB for search results
  maxEntries: 200,
  defaultTTL: 10 * 60 * 1000, // 10 minutes for search results
  cleanupInterval: 2 * 60 * 1000, // Cleanup every 2 minutes
  enableAnalytics: true,
});

// ===========================================
// Cache Management Utilities
// ===========================================

export class CacheManager {
  private static instance: CacheManager;
  private caches = new Map<string, LRUCache<any>>();

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  registerCache<T>(name: string, cache: LRUCache<T>): void {
    this.caches.set(name, cache);
  }

  getCache<T>(name: string): LRUCache<T> | undefined {
    return this.caches.get(name);
  }

  clearAllCaches(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  getGlobalStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    for (const [name, cache] of this.caches) {
      stats[name] = cache.getStats();
    }
    return stats;
  }

  cleanup(): void {
    for (const cache of this.caches.values()) {
      cache.cleanup();
    }
  }

  destroy(): void {
    for (const cache of this.caches.values()) {
      cache.destroy();
    }
    this.caches.clear();
  }
}

// Register the search cache
CacheManager.getInstance().registerCache('search', searchCache);

// Export utilities
export { SearchQueryNormalizer };
export default searchCache;