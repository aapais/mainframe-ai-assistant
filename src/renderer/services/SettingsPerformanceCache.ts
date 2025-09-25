/**
 * Settings Performance Cache - Multi-Layer Caching Strategy
 *
 * Features:
 * - Memory cache with LRU eviction
 * - LocalStorage persistent cache
 * - Service Worker integration
 * - Optimistic updates
 * - Cache invalidation strategies
 * - Compression support
 * - Metrics tracking
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  compressed?: boolean;
  size: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  memoryUsage: number;
  storageUsage: number;
  compressionRatio: number;
  averageAccessTime: number;
}

interface CacheConfig {
  maxMemorySize: number; // bytes
  maxStorageSize: number; // bytes
  defaultTTL: number; // milliseconds
  compressionThreshold: number; // bytes
  enableCompression: boolean;
  enableServiceWorker: boolean;
  enableMetrics: boolean;
  syncInterval: number; // milliseconds
}

interface CacheLayer {
  name: string;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<boolean>;
  size(): Promise<number>;
}

// ============================================================================
// COMPRESSION UTILITIES
// ============================================================================

class CompressionUtils {
  static async compress(data: string): Promise<string> {
    if (typeof CompressionStream !== 'undefined') {
      try {
        const stream = new CompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        writer.write(encoder.encode(data));
        writer.close();

        const compressed = await reader.read();
        return btoa(String.fromCharCode(...compressed.value!));
      } catch (error) {
        console.warn('Compression failed, falling back to uncompressed:', error);
        return data;
      }
    }

    // Fallback to simple base64 encoding for size estimation
    return btoa(data);
  }

  static async decompress(compressedData: string): Promise<string> {
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const stream = new DecompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        const decoder = new TextDecoder();
        const compressed = Uint8Array.from(atob(compressedData), c => c.charCodeAt(0));

        writer.write(compressed);
        writer.close();

        const decompressed = await reader.read();
        return decoder.decode(decompressed.value);
      } catch (error) {
        console.warn('Decompression failed, assuming uncompressed:', error);
        return atob(compressedData);
      }
    }

    // Fallback to simple base64 decoding
    return atob(compressedData);
  }

  static estimateSize(data: any): number {
    return new Blob([JSON.stringify(data)]).size;
  }
}

// ============================================================================
// MEMORY CACHE LAYER (LRU)
// ============================================================================

class MemoryCache implements CacheLayer {
  name = 'memory';
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check TTL
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.updateAccessOrder(key);

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const size = CompressionUtils.estimateSize(value);
      const entryTTL = ttl || this.config.defaultTTL;

      // Check if compression is needed
      let compressed = false;
      let finalValue = serialized;

      if (this.config.enableCompression && size > this.config.compressionThreshold) {
        finalValue = await CompressionUtils.compress(serialized);
        compressed = true;
      }

      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: Date.now(),
        ttl: entryTTL,
        compressed,
        size,
        accessCount: 0,
        lastAccessed: Date.now(),
      };

      // Evict if necessary
      await this.evictIfNecessary(size);

      this.cache.set(key, entry);
      this.updateAccessOrder(key);

      return true;
    } catch (error) {
      console.error('Failed to set cache entry:', error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    this.removeFromAccessOrder(key);
    return deleted;
  }

  async clear(): Promise<boolean> {
    this.cache.clear();
    this.accessOrder = [];
    return true;
  }

  async size(): Promise<number> {
    return Array.from(this.cache.values()).reduce((total, entry) => total + entry.size, 0);
  }

  private async evictIfNecessary(newEntrySize: number): Promise<void> {
    const currentSize = await this.size();

    if (currentSize + newEntrySize <= this.config.maxMemorySize) {
      return;
    }

    // Evict LRU entries until we have enough space
    while (this.cache.size > 0 && (await this.size()) + newEntrySize > this.config.maxMemorySize) {
      const lruKey = this.accessOrder[0];
      if (lruKey) {
        await this.delete(lruKey);
      }
    }
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  getStats(): {
    entryCount: number;
    totalSize: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    const entries = Array.from(this.cache.values());
    return {
      entryCount: entries.length,
      totalSize: entries.reduce((sum, entry) => sum + entry.size, 0),
      oldestEntry: Math.min(...entries.map(e => e.timestamp)),
      newestEntry: Math.max(...entries.map(e => e.timestamp)),
    };
  }
}

// ============================================================================
// LOCALSTORAGE CACHE LAYER
// ============================================================================

class LocalStorageCache implements CacheLayer {
  name = 'localStorage';
  private prefix = 'settings-cache-';
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const stored = localStorage.getItem(this.prefix + key);
      if (!stored) return null;

      const entry: CacheEntry<T> = JSON.parse(stored);

      // Check TTL
      if (Date.now() > entry.timestamp + entry.ttl) {
        await this.delete(key);
        return null;
      }

      // Decompress if needed
      let value = entry.value;
      if (entry.compressed && typeof entry.value === 'string') {
        const decompressed = await CompressionUtils.decompress(entry.value as string);
        value = JSON.parse(decompressed);
      }

      return value;
    } catch (error) {
      console.error('Failed to get from localStorage cache:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const size = CompressionUtils.estimateSize(value);
      const entryTTL = ttl || this.config.defaultTTL;

      // Check storage quota
      await this.evictIfNecessary(size);

      let compressed = false;
      let finalValue: any = value;

      if (this.config.enableCompression && size > this.config.compressionThreshold) {
        const serialized = JSON.stringify(value);
        finalValue = await CompressionUtils.compress(serialized);
        compressed = true;
      }

      const entry: CacheEntry<T> = {
        key,
        value: finalValue,
        timestamp: Date.now(),
        ttl: entryTTL,
        compressed,
        size,
        accessCount: 0,
        lastAccessed: Date.now(),
      };

      localStorage.setItem(this.prefix + key, JSON.stringify(entry));
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.code === 22) {
        // Quota exceeded, try to free some space
        await this.cleanup();
        return false;
      }
      console.error('Failed to set localStorage cache entry:', error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      localStorage.removeItem(this.prefix + key);
      return true;
    } catch (error) {
      console.error('Failed to delete from localStorage cache:', error);
      return false;
    }
  }

  async clear(): Promise<boolean> {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.prefix));
      keys.forEach(key => localStorage.removeItem(key));
      return true;
    } catch (error) {
      console.error('Failed to clear localStorage cache:', error);
      return false;
    }
  }

  async size(): Promise<number> {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.prefix));
      let totalSize = 0;

      for (const key of keys) {
        const stored = localStorage.getItem(key);
        if (stored) {
          const entry = JSON.parse(stored);
          totalSize += entry.size || 0;
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Failed to calculate localStorage cache size:', error);
      return 0;
    }
  }

  private async evictIfNecessary(newEntrySize: number): Promise<void> {
    const currentSize = await this.size();

    if (currentSize + newEntrySize <= this.config.maxStorageSize) {
      return;
    }

    await this.cleanup();
  }

  private async cleanup(): Promise<void> {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.prefix));
      const entries: Array<{ key: string; entry: CacheEntry; storageKey: string }> = [];

      // Collect all entries with metadata
      for (const storageKey of keys) {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          try {
            const entry = JSON.parse(stored);
            const key = storageKey.replace(this.prefix, '');

            // Remove expired entries
            if (Date.now() > entry.timestamp + entry.ttl) {
              localStorage.removeItem(storageKey);
              continue;
            }

            entries.push({ key, entry, storageKey });
          } catch (error) {
            // Remove corrupted entries
            localStorage.removeItem(storageKey);
          }
        }
      }

      // Sort by last accessed time (LRU)
      entries.sort((a, b) => a.entry.lastAccessed - b.entry.lastAccessed);

      // Remove oldest entries until under quota
      let currentSize = await this.size();
      for (const { storageKey } of entries) {
        if (currentSize <= this.config.maxStorageSize * 0.8) break; // Keep some buffer

        localStorage.removeItem(storageKey);
        currentSize = await this.size();
      }
    } catch (error) {
      console.error('Failed to cleanup localStorage cache:', error);
    }
  }
}

// ============================================================================
// SERVICE WORKER CACHE LAYER
// ============================================================================

class ServiceWorkerCache implements CacheLayer {
  name = 'serviceWorker';
  private config: CacheConfig;
  private cacheName = 'settings-cache-v1';

  constructor(config: CacheConfig) {
    this.config = config;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.config.enableServiceWorker || !('caches' in window)) {
      return null;
    }

    try {
      const cache = await caches.open(this.cacheName);
      const response = await cache.match(key);

      if (!response) return null;

      const entry: CacheEntry<T> = await response.json();

      // Check TTL
      if (Date.now() > entry.timestamp + entry.ttl) {
        await cache.delete(key);
        return null;
      }

      return entry.value;
    } catch (error) {
      console.error('Failed to get from Service Worker cache:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    if (!this.config.enableServiceWorker || !('caches' in window)) {
      return false;
    }

    try {
      const cache = await caches.open(this.cacheName);
      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: Date.now(),
        ttl: ttl || this.config.defaultTTL,
        size: CompressionUtils.estimateSize(value),
        accessCount: 0,
        lastAccessed: Date.now(),
      };

      const response = new Response(JSON.stringify(entry), {
        headers: { 'Content-Type': 'application/json' },
      });

      await cache.put(key, response);
      return true;
    } catch (error) {
      console.error('Failed to set Service Worker cache entry:', error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.config.enableServiceWorker || !('caches' in window)) {
      return false;
    }

    try {
      const cache = await caches.open(this.cacheName);
      return await cache.delete(key);
    } catch (error) {
      console.error('Failed to delete from Service Worker cache:', error);
      return false;
    }
  }

  async clear(): Promise<boolean> {
    if (!this.config.enableServiceWorker || !('caches' in window)) {
      return false;
    }

    try {
      return await caches.delete(this.cacheName);
    } catch (error) {
      console.error('Failed to clear Service Worker cache:', error);
      return false;
    }
  }

  async size(): Promise<number> {
    if (!this.config.enableServiceWorker || !('caches' in window)) {
      return 0;
    }

    try {
      const cache = await caches.open(this.cacheName);
      const keys = await cache.keys();
      let totalSize = 0;

      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const entry = await response.json();
          totalSize += entry.size || 0;
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Failed to calculate Service Worker cache size:', error);
      return 0;
    }
  }
}

// ============================================================================
// MULTI-LAYER PERFORMANCE CACHE
// ============================================================================

export class SettingsPerformanceCache {
  private layers: CacheLayer[];
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private syncInterval?: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxMemorySize: 50 * 1024 * 1024, // 50MB
      maxStorageSize: 100 * 1024 * 1024, // 100MB
      defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
      compressionThreshold: 1024, // 1KB
      enableCompression: true,
      enableServiceWorker: true,
      enableMetrics: true,
      syncInterval: 5 * 60 * 1000, // 5 minutes
      ...config,
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      memoryUsage: 0,
      storageUsage: 0,
      compressionRatio: 0,
      averageAccessTime: 0,
    };

    this.layers = [
      new MemoryCache(this.config),
      new LocalStorageCache(this.config),
      new ServiceWorkerCache(this.config),
    ];

    this.startSync();
  }

  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      const value = await layer.get<T>(key);

      if (value !== null) {
        this.metrics.hits++;

        // Promote to higher layers
        for (let j = 0; j < i; j++) {
          await this.layers[j].set(key, value);
        }

        this.updateMetrics(startTime);
        return value;
      }
    }

    this.metrics.misses++;
    this.updateMetrics(startTime);
    return null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    const results = await Promise.allSettled(this.layers.map(layer => layer.set(key, value, ttl)));

    return results.some(result => result.status === 'fulfilled' && result.value);
  }

  async delete(key: string): Promise<boolean> {
    const results = await Promise.allSettled(this.layers.map(layer => layer.delete(key)));

    return results.some(result => result.status === 'fulfilled' && result.value);
  }

  async clear(): Promise<boolean> {
    const results = await Promise.allSettled(this.layers.map(layer => layer.clear()));

    return results.every(result => result.status === 'fulfilled' && result.value);
  }

  async invalidatePattern(pattern: string | RegExp): Promise<number> {
    let invalidated = 0;

    // For now, only implemented for memory cache
    const memoryCache = this.layers[0] as MemoryCache;
    if (memoryCache) {
      const keys = Object.keys((memoryCache as any).cache);
      for (const key of keys) {
        if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
          await this.delete(key);
          invalidated++;
        }
      }
    }

    return invalidated;
  }

  // Optimistic update: set immediately in memory, sync to other layers later
  async optimisticSet<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    const memoryCache = this.layers[0];
    const success = await memoryCache.set(key, value, ttl);

    // Async sync to other layers
    setTimeout(async () => {
      for (let i = 1; i < this.layers.length; i++) {
        await this.layers[i].set(key, value, ttl);
      }
    }, 0);

    return success;
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  async getStats(): Promise<{
    layers: Array<{ name: string; size: number }>;
    totalSize: number;
    hitRate: number;
    missRate: number;
  }> {
    const layerStats = await Promise.all(
      this.layers.map(async layer => ({
        name: layer.name,
        size: await layer.size(),
      }))
    );

    const totalSize = layerStats.reduce((sum, layer) => sum + layer.size, 0);
    const totalRequests = this.metrics.hits + this.metrics.misses;

    return {
      layers: layerStats,
      totalSize,
      hitRate: totalRequests > 0 ? this.metrics.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.metrics.misses / totalRequests : 0,
    };
  }

  private updateMetrics(startTime: number): void {
    if (this.config.enableMetrics) {
      const accessTime = performance.now() - startTime;
      this.metrics.averageAccessTime = (this.metrics.averageAccessTime + accessTime) / 2;
    }
  }

  private startSync(): void {
    if (this.config.syncInterval > 0) {
      this.syncInterval = setInterval(async () => {
        await this.syncLayers();
      }, this.config.syncInterval);
    }
  }

  private async syncLayers(): Promise<void> {
    // Implementation would sync between layers
    // For now, just update metrics
    this.metrics.memoryUsage = await this.layers[0].size();
    this.metrics.storageUsage = await this.layers[1].size();
  }

  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

// ============================================================================
// CACHE MANAGER SINGLETON
// ============================================================================

class CacheManager {
  private static instance: SettingsPerformanceCache;

  static getInstance(config?: Partial<CacheConfig>): SettingsPerformanceCache {
    if (!this.instance) {
      this.instance = new SettingsPerformanceCache(config);
    }
    return this.instance;
  }

  static destroy(): void {
    if (this.instance) {
      this.instance.destroy();
      this.instance = undefined as any;
    }
  }
}

export { CacheManager };
export default SettingsPerformanceCache;
