export interface MemoryCacheConfig {
  maxSize: number;
  defaultTTL: number;
  cleanupInterval: number;
  enableLRU: boolean;
  maxMemoryUsage: number; // bytes
}

export interface CacheItem<T = any> {
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  tags?: string[];
}

export class MemoryCache<T = any> {
  private cache = new Map<string, CacheItem<T>>();
  private accessOrder: string[] = [];
  private config: MemoryCacheConfig;
  private cleanupTimer?: NodeJS.Timeout;
  private currentMemoryUsage = 0;
  private metrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    memoryUsage: 0
  };

  constructor(config: MemoryCacheConfig) {
    this.config = config;
    this.startCleanupTimer();
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      this.metrics.misses++;
      return null;
    }

    // Check if expired
    if (this.isExpired(item)) {
      this.delete(key);
      this.metrics.misses++;
      return null;
    }

    // Update LRU order
    item.lastAccessed = Date.now();
    item.accessCount++;
    this.updateAccessOrder(key);
    
    this.metrics.hits++;
    return item.value;
  }

  set(key: string, value: T, ttl?: number, tags?: string[]): boolean {
    const size = this.estimateSize(value);
    
    // Check memory limits
    if (this.currentMemoryUsage + size > this.config.maxMemoryUsage) {
      this.evictLRU(size);
    }

    // Check size limits
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    const item: CacheItem<T> = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      accessCount: 1,
      lastAccessed: Date.now(),
      size,
      tags
    };

    // Remove old item if exists
    if (this.cache.has(key)) {
      const oldItem = this.cache.get(key)!;
      this.currentMemoryUsage -= oldItem.size;
    }

    this.cache.set(key, item);
    this.currentMemoryUsage += size;
    this.updateAccessOrder(key);
    
    return true;
  }

  delete(key: string): boolean {
    const item = this.cache.get(key);
    if (item) {
      this.currentMemoryUsage -= item.size;
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return true;
    }
    return false;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    return item ? !this.isExpired(item) : false;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.currentMemoryUsage = 0;
    this.metrics.evictions += this.cache.size;
  }

  invalidateByTag(tag: string): number {
    let invalidated = 0;
    for (const [key, item] of this.cache.entries()) {
      if (item.tags && item.tags.includes(tag)) {
        this.delete(key);
        invalidated++;
      }
    }
    return invalidated;
  }

  getStats() {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: total > 0 ? (this.metrics.hits / total) * 100 : 0,
      memoryUsage: this.currentMemoryUsage,
      maxMemoryUsage: this.config.maxMemoryUsage,
      memoryUtilization: (this.currentMemoryUsage / this.config.maxMemoryUsage) * 100,
      ...this.metrics
    };
  }

  // Get keys by pattern (simple wildcard support)
  keys(pattern?: string): string[] {
    const keys = Array.from(this.cache.keys());
    if (!pattern) return keys;
    
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return keys.filter(key => regex.test(key));
  }

  // Get multiple values at once
  mget(keys: string[]): (T | null)[] {
    return keys.map(key => this.get(key));
  }

  // Set multiple values at once
  mset(entries: Array<{ key: string; value: T; ttl?: number; tags?: string[] }>): boolean {
    try {
      entries.forEach(({ key, value, ttl, tags }) => {
        this.set(key, value, ttl, tags);
      });
      return true;
    } catch (error) {
      console.error('Batch set error:', error);
      return false;
    }
  }

  private isExpired(item: CacheItem<T>): boolean {
    return Date.now() > item.timestamp + (item.ttl * 1000);
  }

  private evictLRU(requiredSize?: number): void {
    const targetSize = requiredSize || 0;
    
    while (
      (this.cache.size >= this.config.maxSize) ||
      (this.currentMemoryUsage + targetSize > this.config.maxMemoryUsage)
    ) {
      if (this.accessOrder.length === 0) break;
      
      const lruKey = this.accessOrder[0];
      this.delete(lruKey);
      this.metrics.evictions++;
    }
  }

  private updateAccessOrder(key: string): void {
    if (!this.config.enableLRU) return;
    
    // Remove from current position
    this.removeFromAccessOrder(key);
    // Add to end (most recent)
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private estimateSize(value: T): number {
    try {
      return Buffer.byteLength(JSON.stringify(value), 'utf8');
    } catch {
      return 1024; // Default size estimate
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (this.isExpired(item)) {
        this.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`Memory cache cleanup: removed ${cleaned} expired items`);
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}