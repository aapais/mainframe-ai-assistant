/**
 * Advanced Search Cache Manager
 *
 * Multi-layered caching system for search results with:
 * - L1: In-memory cache (fastest)
 * - L2: IndexedDB cache (persistent)
 * - L3: Service worker cache (offline)
 * - LRU eviction policy
 * - Cache warming and prefetching
 * - Analytics and metrics
 *
 * @version 1.0.0
 */

import { SearchResult, SearchOptions } from '../types/services';

export interface CacheEntry {
  key: string;
  results: SearchResult[];
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccess: number;
  metadata: {
    query: string;
    options: SearchOptions;
    resultCount: number;
    searchDuration: number;
  };
}

export interface CacheMetrics {
  hitCount: number;
  missCount: number;
  hitRate: number;
  totalEntries: number;
  totalSize: number;
  averageAccessTime: number;
  evictionCount: number;
  l1Hits: number;
  l2Hits: number;
  l3Hits: number;
}

export interface CacheConfig {
  l1MaxSize: number;
  l2MaxSize: number;
  defaultTTL: number;
  cleanupInterval: number;
  compressionEnabled: boolean;
  persistentCacheEnabled: boolean;
  serviceWorkerCacheEnabled: boolean;
}

/**
 * Advanced multi-layer cache manager
 */
export class SearchCacheManager {
  private l1Cache: Map<string, CacheEntry> = new Map(); // Memory cache
  private l2Cache: IDBDatabase | null = null; // IndexedDB cache
  private l3CacheName = 'search-cache-v1'; // Service worker cache

  private metrics: CacheMetrics = {
    hitCount: 0,
    missCount: 0,
    hitRate: 0,
    totalEntries: 0,
    totalSize: 0,
    averageAccessTime: 0,
    evictionCount: 0,
    l1Hits: 0,
    l2Hits: 0,
    l3Hits: 0,
  };

  private config: CacheConfig;
  private cleanupInterval: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      l1MaxSize: 100,
      l2MaxSize: 1000,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 2 * 60 * 1000, // 2 minutes
      compressionEnabled: true,
      persistentCacheEnabled: true,
      serviceWorkerCacheEnabled: false,
      ...config,
    };

    this.initialize();
  }

  /**
   * Initialize cache system
   */
  private async initialize(): Promise<void> {
    try {
      // Initialize IndexedDB cache
      if (this.config.persistentCacheEnabled) {
        await this.initializeIndexedDB();
      }

      // Initialize service worker cache
      if (this.config.serviceWorkerCacheEnabled && 'caches' in window) {
        await this.initializeServiceWorkerCache();
      }

      // Start cleanup interval
      this.startCleanup();

      console.log('SearchCacheManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize cache manager:', error);
    }
  }

  /**
   * Initialize IndexedDB for L2 cache
   */
  private initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('SearchCacheDB', 1);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.l2Cache = request.result;
        resolve();
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('searchCache')) {
          const store = db.createObjectStore('searchCache', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('lastAccess', 'lastAccess', { unique: false });
        }
      };
    });
  }

  /**
   * Initialize service worker cache for L3
   */
  private async initializeServiceWorkerCache(): Promise<void> {
    try {
      await caches.open(this.l3CacheName);
      console.log('Service worker cache initialized');
    } catch (error) {
      console.warn('Service worker cache initialization failed:', error);
    }
  }

  /**
   * Generate cache key from query and options
   */
  private generateCacheKey(query: string, options: SearchOptions = {}): string {
    const normalizedQuery = query.toLowerCase().trim();
    const keyObject = {
      query: normalizedQuery,
      category: options.category,
      tags: options.tags?.sort(),
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
      filters: options.filters,
    };

    return btoa(JSON.stringify(keyObject)).replace(/[+/=]/g, '');
  }

  /**
   * Get search results from cache (tries all layers)
   */
  async get(query: string, options: SearchOptions = {}): Promise<SearchResult[] | null> {
    const startTime = performance.now();
    const key = this.generateCacheKey(query, options);

    try {
      // L1: Memory cache (fastest)
      const l1Result = this.getFromL1(key);
      if (l1Result) {
        this.updateMetrics('l1_hit', performance.now() - startTime);
        return l1Result;
      }

      // L2: IndexedDB cache
      if (this.config.persistentCacheEnabled && this.l2Cache) {
        const l2Result = await this.getFromL2(key);
        if (l2Result) {
          // Promote to L1 cache
          this.setInL1(key, l2Result, query, options);
          this.updateMetrics('l2_hit', performance.now() - startTime);
          return l2Result.results;
        }
      }

      // L3: Service worker cache
      if (this.config.serviceWorkerCacheEnabled && 'caches' in window) {
        const l3Result = await this.getFromL3(key);
        if (l3Result) {
          // Promote to L1 and L2
          this.setInL1(key, l3Result, query, options);
          if (this.l2Cache) {
            await this.setInL2(key, l3Result);
          }
          this.updateMetrics('l3_hit', performance.now() - startTime);
          return l3Result.results;
        }
      }

      this.updateMetrics('cache_miss', performance.now() - startTime);
      return null;
    } catch (error) {
      console.error('Cache get operation failed:', error);
      this.updateMetrics('cache_miss', performance.now() - startTime);
      return null;
    }
  }

  /**
   * Set search results in cache (all layers)
   */
  async set(
    query: string,
    results: SearchResult[],
    options: SearchOptions = {},
    searchDuration: number = 0
  ): Promise<void> {
    const key = this.generateCacheKey(query, options);

    try {
      const entry: CacheEntry = {
        key,
        results,
        timestamp: Date.now(),
        ttl: this.config.defaultTTL,
        accessCount: 1,
        lastAccess: Date.now(),
        metadata: {
          query,
          options,
          resultCount: results.length,
          searchDuration,
        },
      };

      // Set in all cache layers
      this.setInL1(key, entry, query, options);

      if (this.config.persistentCacheEnabled && this.l2Cache) {
        await this.setInL2(key, entry);
      }

      if (this.config.serviceWorkerCacheEnabled && 'caches' in window) {
        await this.setInL3(key, entry);
      }

      this.updateCacheMetrics();
    } catch (error) {
      console.error('Cache set operation failed:', error);
    }
  }

  /**
   * L1 Cache Operations (Memory)
   */
  private getFromL1(key: string): SearchResult[] | null {
    const entry = this.l1Cache.get(key);

    if (!entry) return null;

    // Check TTL
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.l1Cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccess = Date.now();

    return entry.results;
  }

  private setInL1(key: string, entry: CacheEntry, query: string, options: SearchOptions): void {
    // Implement LRU eviction if cache is full
    if (this.l1Cache.size >= this.config.l1MaxSize) {
      this.evictLRUFromL1();
    }

    this.l1Cache.set(key, entry);
  }

  private evictLRUFromL1(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.l1Cache) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.l1Cache.delete(oldestKey);
      this.metrics.evictionCount++;
    }
  }

  /**
   * L2 Cache Operations (IndexedDB)
   */
  private async getFromL2(key: string): Promise<CacheEntry | null> {
    if (!this.l2Cache) return null;

    return new Promise(resolve => {
      const transaction = this.l2Cache!.transaction(['searchCache'], 'readonly');
      const store = transaction.objectStore('searchCache');
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result as CacheEntry;

        if (!entry) {
          resolve(null);
          return;
        }

        // Check TTL
        if (Date.now() > entry.timestamp + entry.ttl) {
          this.deleteFromL2(key);
          resolve(null);
          return;
        }

        // Update access statistics
        entry.accessCount++;
        entry.lastAccess = Date.now();

        // Update in database
        this.setInL2(key, entry);

        resolve(entry);
      };

      request.onerror = () => resolve(null);
    });
  }

  private async setInL2(key: string, entry: CacheEntry): Promise<void> {
    if (!this.l2Cache) return;

    return new Promise(resolve => {
      const transaction = this.l2Cache!.transaction(['searchCache'], 'readwrite');
      const store = transaction.objectStore('searchCache');

      // Compress data if enabled
      if (this.config.compressionEnabled) {
        entry = this.compressEntry(entry);
      }

      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => resolve(); // Fail silently for cache operations
    });
  }

  private async deleteFromL2(key: string): Promise<void> {
    if (!this.l2Cache) return;

    return new Promise(resolve => {
      const transaction = this.l2Cache!.transaction(['searchCache'], 'readwrite');
      const store = transaction.objectStore('searchCache');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  /**
   * L3 Cache Operations (Service Worker)
   */
  private async getFromL3(key: string): Promise<CacheEntry | null> {
    try {
      if (!('caches' in window)) return null;

      const cache = await caches.open(this.l3CacheName);
      const response = await cache.match(key);

      if (!response) return null;

      const entry: CacheEntry = await response.json();

      // Check TTL
      if (Date.now() > entry.timestamp + entry.ttl) {
        await cache.delete(key);
        return null;
      }

      return entry;
    } catch (error) {
      console.warn('L3 cache get failed:', error);
      return null;
    }
  }

  private async setInL3(key: string, entry: CacheEntry): Promise<void> {
    try {
      if (!('caches' in window)) return;

      const cache = await caches.open(this.l3CacheName);
      const response = new Response(JSON.stringify(entry), {
        headers: { 'Content-Type': 'application/json' },
      });

      await cache.put(key, response);
    } catch (error) {
      console.warn('L3 cache set failed:', error);
    }
  }

  /**
   * Cache warming and prefetching
   */
  async warmCache(queries: Array<{ query: string; options?: SearchOptions }>): Promise<void> {
    console.log(`Warming cache with ${queries.length} queries...`);

    const warmingPromises = queries.map(async ({ query, options }) => {
      try {
        // Only warm if not already cached
        const cached = await this.get(query, options);
        if (!cached) {
          // This would trigger a search that would populate the cache
          console.log(`Cache warming needed for query: ${query}`);
          // Implementation would depend on how search is triggered
        }
      } catch (error) {
        console.warn(`Cache warming failed for query "${query}":`, error);
      }
    });

    await Promise.allSettled(warmingPromises);
    console.log('Cache warming completed');
  }

  /**
   * Prefetch likely next queries
   */
  async prefetchQueries(baseQuery: string, variations: string[]): Promise<void> {
    const prefetchPromises = variations.map(async variation => {
      try {
        const query = baseQuery + ' ' + variation;
        const cached = await this.get(query);

        if (!cached) {
          // Mark for prefetching
          console.log(`Prefetch candidate: ${query}`);
        }
      } catch (error) {
        console.warn(`Prefetch failed for variation "${variation}":`, error);
      }
    });

    await Promise.allSettled(prefetchPromises);
  }

  /**
   * Cache maintenance and cleanup
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }

  private async performCleanup(): Promise<void> {
    try {
      // Clean L1 cache
      this.cleanupL1();

      // Clean L2 cache
      if (this.config.persistentCacheEnabled && this.l2Cache) {
        await this.cleanupL2();
      }

      // Update metrics
      this.updateCacheMetrics();

      console.log('Cache cleanup completed');
    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }
  }

  private cleanupL1(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.l1Cache) {
      if (now > entry.timestamp + entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.l1Cache.delete(key));
  }

  private async cleanupL2(): Promise<void> {
    if (!this.l2Cache) return;

    return new Promise(resolve => {
      const transaction = this.l2Cache!.transaction(['searchCache'], 'readwrite');
      const store = transaction.objectStore('searchCache');
      const index = store.index('timestamp');

      const now = Date.now();
      const cutoff = now - this.config.defaultTTL;

      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.openCursor(range);

      request.onsuccess = event => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => resolve();
    });
  }

  /**
   * Compression utilities
   */
  private compressEntry(entry: CacheEntry): CacheEntry {
    // Simple compression by removing redundant data
    // In a real implementation, you might use a compression library
    const compressed = {
      ...entry,
      results: entry.results.map(result => ({
        ...result,
        // Remove redundant fields or compress content
        entry: {
          ...result.entry,
          problem:
            result.entry.problem.length > 500
              ? result.entry.problem.substring(0, 500) + '...'
              : result.entry.problem,
          solution:
            result.entry.solution.length > 500
              ? result.entry.solution.substring(0, 500) + '...'
              : result.entry.solution,
        },
      })),
    };

    return compressed;
  }

  /**
   * Metrics and analytics
   */
  private updateMetrics(operation: string, duration: number): void {
    switch (operation) {
      case 'l1_hit':
        this.metrics.hitCount++;
        this.metrics.l1Hits++;
        break;
      case 'l2_hit':
        this.metrics.hitCount++;
        this.metrics.l2Hits++;
        break;
      case 'l3_hit':
        this.metrics.hitCount++;
        this.metrics.l3Hits++;
        break;
      case 'cache_miss':
        this.metrics.missCount++;
        break;
    }

    // Update hit rate
    const totalRequests = this.metrics.hitCount + this.metrics.missCount;
    this.metrics.hitRate = totalRequests > 0 ? this.metrics.hitCount / totalRequests : 0;

    // Update average access time
    this.metrics.averageAccessTime = (this.metrics.averageAccessTime + duration) / 2;
  }

  private updateCacheMetrics(): void {
    this.metrics.totalEntries = this.l1Cache.size;

    // Calculate total size (approximation)
    let totalSize = 0;
    for (const entry of this.l1Cache.values()) {
      totalSize += JSON.stringify(entry).length;
    }
    this.metrics.totalSize = totalSize;
  }

  /**
   * Public API methods
   */

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    try {
      // Clear L1
      this.l1Cache.clear();

      // Clear L2
      if (this.l2Cache) {
        const transaction = this.l2Cache.transaction(['searchCache'], 'readwrite');
        const store = transaction.objectStore('searchCache');
        await new Promise<void>(resolve => {
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
        });
      }

      // Clear L3
      if ('caches' in window) {
        await caches.delete(this.l3CacheName);
        await caches.open(this.l3CacheName); // Recreate
      }

      // Reset metrics
      this.metrics = {
        hitCount: 0,
        missCount: 0,
        hitRate: 0,
        totalEntries: 0,
        totalSize: 0,
        averageAccessTime: 0,
        evictionCount: 0,
        l1Hits: 0,
        l2Hits: 0,
        l3Hits: 0,
      };

      console.log('All caches cleared');
    } catch (error) {
      console.error('Failed to clear caches:', error);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.l1Cache.clear();

    if (this.l2Cache) {
      this.l2Cache.close();
    }
  }
}

export default SearchCacheManager;
