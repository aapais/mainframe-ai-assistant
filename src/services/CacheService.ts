/**
 * CacheService - High-performance caching layer with LRU eviction
 * Production-ready cache with TTL support, statistics, and memory management
 */

import {
  ICacheService,
  CacheStats,
  CacheConfig,
  CacheError,
  ServiceError
} from '../types/services';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl?: number;
  hitCount: number;
  size: number;
}

interface CacheNode<T> {
  key: string;
  entry: CacheEntry<T>;
  prev?: CacheNode<T>;
  next?: CacheNode<T>;
}

/**
 * High-Performance Cache Service Implementation
 * Features LRU eviction, TTL support, memory management, and comprehensive statistics
 */
export class CacheService implements ICacheService {
  private cache = new Map<string, CacheNode<any>>();
  private head?: CacheNode<any>;
  private tail?: CacheNode<any>;
  private currentSize = 0;
  private totalMemoryUsage = 0;
  
  // Statistics
  private stats = {
    hitCount: 0,
    missCount: 0,
    setCount: 0,
    deleteCount: 0,
    evictionCount: 0,
    startTime: Date.now()
  };

  private cleanupInterval?: ReturnType<typeof setTimeout>;

  constructor(private config: CacheConfig) {
    this.setupCleanupInterval();
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    this.validateKey(key);

    const node = this.cache.get(key);
    if (!node) {
      this.stats.missCount++;
      return null;
    }

    // Check TTL
    if (this.isExpired(node.entry)) {
      await this.delete(key);
      this.stats.missCount++;
      return null;
    }

    // Update access statistics
    node.entry.hitCount++;
    this.stats.hitCount++;

    // Move to front (most recently used)
    this.moveToFront(node);

    return node.entry.value as T;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.validateKey(key);
    this.validateValue(value);

    const entrySize = this.calculateSize(value);
    const now = Date.now();

    // Check if key already exists
    const existingNode = this.cache.get(key);
    if (existingNode) {
      // Update existing entry
      this.totalMemoryUsage -= existingNode.entry.size;
      existingNode.entry.value = value;
      existingNode.entry.timestamp = now;
      existingNode.entry.ttl = ttl;
      existingNode.entry.size = entrySize;
      this.totalMemoryUsage += entrySize;
      
      // Move to front
      this.moveToFront(existingNode);
    } else {
      // Create new entry
      const entry: CacheEntry<T> = {
        value,
        timestamp: now,
        ttl,
        hitCount: 0,
        size: entrySize
      };

      const node: CacheNode<T> = {
        key,
        entry
      };

      // Ensure capacity
      await this.ensureCapacity();

      // Add to cache
      this.cache.set(key, node);
      this.addToFront(node);
      this.currentSize++;
      this.totalMemoryUsage += entrySize;
    }

    this.stats.setCount++;
  }

  /**
   * Get multiple values at once
   */
  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  /**
   * Set multiple values at once
   */
  async mset<T>(items: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    for (const item of items) {
      await this.set(item.key, item.value, item.ttl);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    this.validateKey(key);

    const node = this.cache.get(key);
    if (!node) {
      return false;
    }

    // Remove from linked list
    this.removeFromList(node);

    // Remove from map
    this.cache.delete(key);
    this.currentSize--;
    this.totalMemoryUsage -= node.entry.size;
    this.stats.deleteCount++;

    return true;
  }

  /**
   * Delete multiple keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let deletedCount = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        const deleted = await this.delete(key);
        if (deleted) deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.head = undefined;
    this.tail = undefined;
    this.currentSize = 0;
    this.totalMemoryUsage = 0;

    // Reset stats except counters
    this.stats.hitCount = 0;
    this.stats.missCount = 0;
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    this.validateKey(key);

    const node = this.cache.get(key);
    if (!node) {
      return false;
    }

    // Check TTL
    if (this.isExpired(node.entry)) {
      await this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Set expiration time for existing key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    this.validateKey(key);

    if (ttl <= 0) {
      throw new CacheError('TTL must be positive', 'expire', { key, ttl });
    }

    const node = this.cache.get(key);
    if (!node) {
      return false;
    }

    node.entry.ttl = ttl;
    node.entry.timestamp = Date.now();
    
    return true;
  }

  /**
   * Get cache statistics
   */
  stats(): CacheStats {
    const uptime = Date.now() - this.stats.startTime;
    const hitRate = this.stats.hitCount / Math.max(1, this.stats.hitCount + this.stats.missCount);

    // Calculate average age of entries
    let totalAge = 0;
    let oldestEntry = Date.now();
    let newestEntry = 0;

    for (const node of this.cache.values()) {
      const age = Date.now() - node.entry.timestamp;
      totalAge += age;
      oldestEntry = Math.min(oldestEntry, node.entry.timestamp);
      newestEntry = Math.max(newestEntry, node.entry.timestamp);
    }

    const averageAge = this.currentSize > 0 ? totalAge / this.currentSize : 0;

    return {
      hitCount: this.stats.hitCount,
      missCount: this.stats.missCount,
      hitRate,
      size: this.currentSize,
      maxSize: this.config.maxSize,
      memoryUsage: this.totalMemoryUsage,
      evictions: this.stats.evictionCount,
      averageAge,
      oldestEntry: oldestEntry === Date.now() ? new Date() : new Date(oldestEntry),
      newestEntry: new Date(newestEntry)
    };
  }

  /**
   * Get all cache keys matching pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    if (!pattern) {
      return Array.from(this.cache.keys());
    }

    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }

  // =========================
  // Private Methods
  // =========================

  private validateKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new CacheError('Key must be a non-empty string', 'validation', { key });
    }
    
    if (key.length > 250) {
      throw new CacheError('Key too long (max 250 characters)', 'validation', { key, length: key.length });
    }
  }

  private validateValue(value: any): void {
    if (value === undefined) {
      throw new CacheError('Value cannot be undefined', 'validation', { value });
    }

    // Check for circular references
    try {
      JSON.stringify(value);
    } catch (error) {
      throw new CacheError('Value contains circular references', 'validation', { error: error.message });
    }
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    if (!entry.ttl) {
      return false;
    }

    return Date.now() - entry.timestamp > entry.ttl;
  }

  private calculateSize(value: any): number {
    try {
      // Rough estimation of memory usage
      const str = JSON.stringify(value);
      return str.length * 2; // UTF-16 characters are 2 bytes
    } catch {
      // Fallback for complex objects
      return 100; // Default size
    }
  }

  private async ensureCapacity(): Promise<void> {
    // Remove expired entries first
    await this.removeExpiredEntries();

    // If still over capacity, evict LRU entries
    while (this.currentSize >= this.config.maxSize) {
      await this.evictLRU();
    }
  }

  private async removeExpiredEntries(): Promise<number> {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, node] of this.cache.entries()) {
      if (this.isExpired(node.entry)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      await this.delete(key);
    }

    return keysToDelete.length;
  }

  private async evictLRU(): Promise<void> {
    if (!this.tail) {
      return;
    }

    const key = this.tail.key;
    await this.delete(key);
    this.stats.evictionCount++;
  }

  private moveToFront(node: CacheNode<any>): void {
    if (node === this.head) {
      return; // Already at front
    }

    // Remove from current position
    this.removeFromList(node);

    // Add to front
    this.addToFront(node);
  }

  private removeFromList(node: CacheNode<any>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    node.prev = undefined;
    node.next = undefined;
  }

  private addToFront(node: CacheNode<any>): void {
    node.next = this.head;
    node.prev = undefined;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  private setupCleanupInterval(): void {
    if (this.config.checkPeriod > 0) {
      this.cleanupInterval = setInterval(async () => {
        try {
          await this.removeExpiredEntries();
        } catch (error) {
          console.error('Cache cleanup error:', error);
        }
      }, this.config.checkPeriod);
    }
  }

  /**
   * Cleanup and close the cache service
   */
  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    await this.clear();
  }

  /**
   * Get detailed cache information for debugging
   */
  async debugInfo(): Promise<any> {
    const entries = [];
    
    for (const [key, node] of this.cache.entries()) {
      entries.push({
        key,
        size: node.entry.size,
        age: Date.now() - node.entry.timestamp,
        hitCount: node.entry.hitCount,
        ttl: node.entry.ttl,
        expired: this.isExpired(node.entry)
      });
    }

    return {
      configuration: this.config,
      statistics: this.stats(),
      entries: entries.sort((a, b) => b.hitCount - a.hitCount),
      memoryBreakdown: {
        totalMemory: this.totalMemoryUsage,
        averageEntrySize: this.currentSize > 0 ? this.totalMemoryUsage / this.currentSize : 0,
        utilizationPercent: this.config.maxSize > 0 ? (this.currentSize / this.config.maxSize) * 100 : 0
      }
    };
  }

  /**
   * Optimize cache by removing expired entries and reorganizing
   */
  async optimize(): Promise<void> {
    const removed = await this.removeExpiredEntries();
    
    console.info(`Cache optimization completed: removed ${removed} expired entries`);
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmup(data: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    console.info(`Warming up cache with ${data.length} entries`);
    
    for (const item of data) {
      await this.set(item.key, item.value, item.ttl);
    }
    
    console.info('Cache warmup completed');
  }

  /**
   * Export cache contents for backup
   */
  async export(): Promise<string> {
    const entries = [];
    
    for (const [key, node] of this.cache.entries()) {
      if (!this.isExpired(node.entry)) {
        entries.push({
          key,
          value: node.entry.value,
          timestamp: node.entry.timestamp,
          ttl: node.entry.ttl,
          hitCount: node.entry.hitCount
        });
      }
    }

    return JSON.stringify({
      version: '1.0',
      timestamp: new Date().toISOString(),
      entries,
      stats: this.stats()
    });
  }

  /**
   * Import cache contents from backup
   */
  async import(data: string): Promise<void> {
    try {
      const backup = JSON.parse(data);
      
      if (!backup.entries || !Array.isArray(backup.entries)) {
        throw new Error('Invalid backup format');
      }

      await this.clear();
      
      for (const entry of backup.entries) {
        // Calculate remaining TTL
        let remainingTTL = entry.ttl;
        if (entry.ttl && entry.timestamp) {
          const elapsed = Date.now() - entry.timestamp;
          remainingTTL = Math.max(0, entry.ttl - elapsed);
        }

        if (remainingTTL > 0 || !entry.ttl) {
          await this.set(entry.key, entry.value, remainingTTL || undefined);
          
          // Restore hit count
          const node = this.cache.get(entry.key);
          if (node) {
            node.entry.hitCount = entry.hitCount || 0;
          }
        }
      }

      console.info(`Cache imported: ${backup.entries.length} entries`);
    } catch (error) {
      throw new CacheError('Failed to import cache', 'import', { error: error.message });
    }
  }
}

export default CacheService;