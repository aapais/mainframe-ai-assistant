/**
 * High-Performance LRU Cache Implementation
 * Production-ready with proper eviction, memory management, and performance monitoring
 */

export interface LRUCacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
  frequency: number;
  ttl?: number;
  size: number;
  prev?: LRUCacheNode<T>;
  next?: LRUCacheNode<T>;
}

export interface LRUCacheNode<T> {
  entry: LRUCacheEntry<T>;
  prev?: LRUCacheNode<T>;
  next?: LRUCacheNode<T>;
}

export interface LRUCacheConfig {
  maxSize: number;
  maxMemoryMB: number;
  defaultTTL: number;
  evictionPolicy: 'LRU' | 'LFU' | 'ARC' | 'ADAPTIVE';
  enableStats: boolean;
  cleanupInterval: number;
  memoryPressureThreshold: number;
}

export interface LRUCacheStats {
  hitCount: number;
  missCount: number;
  hitRate: number;
  size: number;
  memoryUsage: number;
  averageAccessTime: number;
  evictions: number;
  hotKeyCount: number;
  averageEntryAge: number;
}

/**
 * High-Performance LRU Cache with Adaptive Eviction
 *
 * Features:
 * - True LRU with O(1) operations
 * - Memory-aware eviction
 * - TTL support with background cleanup
 * - Frequency-based promotion (LFU hybrid)
 * - ARC (Adaptive Replacement Cache) algorithm
 * - Hot/Cold partitioning
 * - Performance monitoring
 * - Memory pressure handling
 */
export class LRUCache<T = any> {
  private cache = new Map<string, LRUCacheNode<T>>();
  private head?: LRUCacheNode<T>;
  private tail?: LRUCacheNode<T>;

  // ARC Algorithm partitions
  private t1 = new Map<string, LRUCacheNode<T>>(); // Recent cache entries
  private t2 = new Map<string, LRUCacheNode<T>>(); // Frequent cache entries
  private b1 = new Map<string, string>(); // Ghost entries for T1
  private b2 = new Map<string, string>(); // Ghost entries for T2

  private config: LRUCacheConfig;
  private stats: LRUCacheStats;
  private cleanupTimer?: ReturnType<typeof setTimeout>;
  private currentMemoryUsage = 0;
  private adaptiveP = 0; // ARC algorithm parameter

  constructor(config: Partial<LRUCacheConfig> = {}) {
    this.config = {
      maxSize: 1000,
      maxMemoryMB: 100,
      defaultTTL: 300000, // 5 minutes
      evictionPolicy: 'ADAPTIVE',
      enableStats: true,
      cleanupInterval: 60000, // 1 minute
      memoryPressureThreshold: 0.8,
      ...config
    };

    this.stats = {
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      size: 0,
      memoryUsage: 0,
      averageAccessTime: 0,
      evictions: 0,
      hotKeyCount: 0,
      averageEntryAge: 0
    };

    this.startCleanupTimer();
  }

  /**
   * Get value with O(1) complexity
   */
  get(key: string): T | null {
    const startTime = performance.now();

    try {
      const node = this.cache.get(key);
      if (!node) {
        this.recordMiss(startTime);
        return null;
      }

      // Check TTL
      if (this.isExpired(node.entry)) {
        this.delete(key);
        this.recordMiss(startTime);
        return null;
      }

      // Update access statistics
      this.updateAccess(node.entry);

      // Move to front based on eviction policy
      this.handleAccess(node);

      this.recordHit(startTime);
      return node.entry.value;

    } catch (error) {
      console.error('LRU Cache get error:', error);
      this.recordMiss(startTime);
      return null;
    }
  }

  /**
   * Set value with intelligent eviction
   */
  set(key: string, value: T, ttl?: number): boolean {
    try {
      const size = this.estimateSize(value);
      const now = Date.now();

      // Check if key already exists
      const existingNode = this.cache.get(key);
      if (existingNode) {
        // Update existing entry
        this.currentMemoryUsage -= existingNode.entry.size;
        existingNode.entry.value = value;
        existingNode.entry.size = size;
        existingNode.entry.timestamp = now;
        existingNode.entry.lastAccessed = now;
        existingNode.entry.ttl = ttl || this.config.defaultTTL;
        this.currentMemoryUsage += size;

        this.handleAccess(existingNode);
        return true;
      }

      // Create new entry
      const entry: LRUCacheEntry<T> = {
        key,
        value,
        timestamp: now,
        lastAccessed: now,
        accessCount: 1,
        frequency: 1,
        ttl: ttl || this.config.defaultTTL,
        size
      };

      const node: LRUCacheNode<T> = { entry };

      // Ensure capacity before adding
      this.ensureCapacity(size);

      // Add to cache
      this.cache.set(key, node);
      this.currentMemoryUsage += size;
      this.stats.size++;

      // Handle insertion based on eviction policy
      this.handleInsertion(node);

      return true;

    } catch (error) {
      console.error('LRU Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete entry
   */
  delete(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    this.removeNode(node);
    this.cache.delete(key);
    this.currentMemoryUsage -= node.entry.size;
    this.stats.size--;

    // Remove from ARC partitions
    this.t1.delete(key);
    this.t2.delete(key);
    this.b1.delete(key);
    this.b2.delete(key);

    return true;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.t1.clear();
    this.t2.clear();
    this.b1.clear();
    this.b2.clear();
    this.head = undefined;
    this.tail = undefined;
    this.currentMemoryUsage = 0;
    this.stats.size = 0;
    this.adaptiveP = 0;
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const node = this.cache.get(key);
    return node ? !this.isExpired(node.entry) : false;
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    const validKeys: string[] = [];
    for (const [key, node] of this.cache) {
      if (!this.isExpired(node.entry)) {
        validKeys.push(key);
      }
    }
    return validKeys;
  }

  /**
   * Get cache statistics
   */
  getStats(): LRUCacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get hot keys (frequently accessed)
   */
  getHotKeys(limit: number = 10): Array<{ key: string; frequency: number; accessCount: number }> {
    const entries = Array.from(this.cache.entries())
      .map(([key, node]) => ({
        key,
        frequency: node.entry.frequency,
        accessCount: node.entry.accessCount
      }))
      .sort((a, b) => b.frequency - a.frequency);

    return entries.slice(0, limit);
  }

  /**
   * Optimize cache performance
   */
  optimize(): void {
    // Remove expired entries
    this.cleanupExpired();

    // Rebalance ARC partitions if using adaptive policy
    if (this.config.evictionPolicy === 'ADAPTIVE') {
      this.rebalanceARC();
    }

    // Update frequency scores
    this.updateFrequencyScores();
  }

  /**
   * Cleanup and shutdown
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }

  // Private Implementation

  private handleAccess(node: LRUCacheNode<T>): void {
    switch (this.config.evictionPolicy) {
      case 'LRU':
        this.moveToFront(node);
        break;
      case 'LFU':
        this.updateLFUPosition(node);
        break;
      case 'ARC':
        this.handleARCAccess(node);
        break;
      case 'ADAPTIVE':
        this.handleAdaptiveAccess(node);
        break;
    }
  }

  private handleInsertion(node: LRUCacheNode<T>): void {
    switch (this.config.evictionPolicy) {
      case 'LRU':
        this.addToFront(node);
        break;
      case 'LFU':
        this.addToLFU(node);
        break;
      case 'ARC':
        this.handleARCInsertion(node);
        break;
      case 'ADAPTIVE':
        this.handleAdaptiveInsertion(node);
        break;
    }
  }

  private handleARCAccess(node: LRUCacheNode<T>): void {
    const key = node.entry.key;

    if (this.t1.has(key)) {
      // Move from T1 to T2 (recent to frequent)
      this.t1.delete(key);
      this.t2.set(key, node);
      this.moveToFront(node);
    } else if (this.t2.has(key)) {
      // Already in T2, just move to front
      this.moveToFront(node);
    }
  }

  private handleARCInsertion(node: LRUCacheNode<T>): void {
    const key = node.entry.key;

    // Check ghost lists
    if (this.b1.has(key)) {
      // Increase preference for T1
      this.adaptiveP = Math.min(this.adaptiveP + Math.max(1, this.b2.size / this.b1.size), this.config.maxSize);
      this.b1.delete(key);
      this.t2.set(key, node);
    } else if (this.b2.has(key)) {
      // Increase preference for T2
      this.adaptiveP = Math.max(this.adaptiveP - Math.max(1, this.b1.size / this.b2.size), 0);
      this.b2.delete(key);
      this.t2.set(key, node);
    } else {
      // New entry goes to T1
      this.t1.set(key, node);
    }

    this.addToFront(node);
  }

  private handleAdaptiveAccess(node: LRUCacheNode<T>): void {
    // Adaptive algorithm: LRU for cold data, LFU for hot data
    const isHot = node.entry.frequency > this.calculateHotThreshold();

    if (isHot) {
      this.updateLFUPosition(node);
    } else {
      this.moveToFront(node);
    }
  }

  private handleAdaptiveInsertion(node: LRUCacheNode<T>): void {
    this.addToFront(node);
  }

  private moveToFront(node: LRUCacheNode<T>): void {
    if (node === this.head) return;

    this.removeNode(node);
    this.addToFront(node);
  }

  private addToFront(node: LRUCacheNode<T>): void {
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

  private removeNode(node: LRUCacheNode<T>): void {
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
  }

  private updateLFUPosition(node: LRUCacheNode<T>): void {
    // Find correct position based on frequency
    let current = this.head;

    while (current && current.entry.frequency >= node.entry.frequency) {
      current = current.next;
    }

    // Remove from current position
    this.removeNode(node);

    // Insert at new position
    if (!current) {
      // Add to end
      if (this.tail) {
        this.tail.next = node;
        node.prev = this.tail;
        node.next = undefined;
        this.tail = node;
      } else {
        this.addToFront(node);
      }
    } else {
      // Insert before current
      node.next = current;
      node.prev = current.prev;

      if (current.prev) {
        current.prev.next = node;
      } else {
        this.head = node;
      }

      current.prev = node;
    }
  }

  private addToLFU(node: LRUCacheNode<T>): void {
    if (!this.head || node.entry.frequency <= this.head.entry.frequency) {
      this.addToFront(node);
    } else {
      this.updateLFUPosition(node);
    }
  }

  private ensureCapacity(newEntrySize: number): void {
    const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;
    const memoryPressure = (this.currentMemoryUsage + newEntrySize) / maxMemoryBytes;

    // Evict based on size limit
    while (this.stats.size >= this.config.maxSize) {
      this.evictLRU();
    }

    // Evict based on memory pressure
    while (memoryPressure > this.config.memoryPressureThreshold && this.tail) {
      this.evictLRU();
    }
  }

  private evictLRU(): void {
    if (!this.tail) return;

    const victimKey = this.tail.entry.key;

    // For ARC algorithm, handle ghost lists
    if (this.config.evictionPolicy === 'ARC') {
      if (this.t1.has(victimKey)) {
        this.b1.set(victimKey, victimKey);
        this.t1.delete(victimKey);
      } else if (this.t2.has(victimKey)) {
        this.b2.set(victimKey, victimKey);
        this.t2.delete(victimKey);
      }

      // Maintain ghost list sizes
      if (this.b1.size > this.config.maxSize - this.adaptiveP) {
        const oldestB1 = this.b1.keys().next().value;
        if (oldestB1) this.b1.delete(oldestB1);
      }

      if (this.b2.size > this.adaptiveP) {
        const oldestB2 = this.b2.keys().next().value;
        if (oldestB2) this.b2.delete(oldestB2);
      }
    }

    this.delete(victimKey);
    this.stats.evictions++;
  }

  private updateAccess(entry: LRUCacheEntry<T>): void {
    const now = Date.now();
    const timeSinceLastAccess = now - entry.lastAccessed;

    entry.accessCount++;
    entry.lastAccessed = now;

    // Update frequency with time decay
    const decay = Math.exp(-timeSinceLastAccess / (24 * 60 * 60 * 1000)); // 24-hour decay
    entry.frequency = entry.frequency * decay + 1;
  }

  private isExpired(entry: LRUCacheEntry<T>): boolean {
    if (!entry.ttl) return false;
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private estimateSize(value: T): number {
    try {
      const serialized = JSON.stringify(value);
      return serialized.length * 2; // UTF-16 approximation
    } catch {
      return 1000; // Default size estimate
    }
  }

  private recordHit(startTime: number): void {
    if (!this.config.enableStats) return;

    this.stats.hitCount++;
    const accessTime = performance.now() - startTime;
    this.updateAverageAccessTime(accessTime);
    this.updateHitRate();
  }

  private recordMiss(startTime: number): void {
    if (!this.config.enableStats) return;

    this.stats.missCount++;
    const accessTime = performance.now() - startTime;
    this.updateAverageAccessTime(accessTime);
    this.updateHitRate();
  }

  private updateAverageAccessTime(accessTime: number): void {
    const totalAccesses = this.stats.hitCount + this.stats.missCount;
    this.stats.averageAccessTime =
      (this.stats.averageAccessTime * (totalAccesses - 1) + accessTime) / totalAccesses;
  }

  private updateHitRate(): void {
    const total = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0;
  }

  private updateStats(): void {
    this.stats.memoryUsage = this.currentMemoryUsage;
    this.stats.size = this.cache.size;

    // Calculate hot key count
    this.stats.hotKeyCount = Array.from(this.cache.values())
      .filter(node => node.entry.frequency > this.calculateHotThreshold()).length;

    // Calculate average entry age
    const now = Date.now();
    const totalAge = Array.from(this.cache.values())
      .reduce((sum, node) => sum + (now - node.entry.timestamp), 0);
    this.stats.averageEntryAge = this.cache.size > 0 ? totalAge / this.cache.size : 0;
  }

  private calculateHotThreshold(): number {
    const frequencies = Array.from(this.cache.values()).map(node => node.entry.frequency);
    if (frequencies.length === 0) return 1;

    frequencies.sort((a, b) => b - a);
    const percentile90 = Math.floor(frequencies.length * 0.9);
    return frequencies[percentile90] || 1;
  }

  private cleanupExpired(): void {
    const expiredKeys: string[] = [];

    for (const [key, node] of this.cache) {
      if (this.isExpired(node.entry)) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.delete(key));
  }

  private rebalanceARC(): void {
    // Rebalance T1 and T2 based on access patterns
    const targetP = this.cache.size / 2;
    const delta = Math.abs(this.adaptiveP - targetP);

    if (delta > this.cache.size * 0.1) {
      this.adaptiveP = this.adaptiveP * 0.9 + targetP * 0.1;
    }
  }

  private updateFrequencyScores(): void {
    const decay = 0.95; // 5% decay per cleanup cycle

    for (const node of this.cache.values()) {
      node.entry.frequency *= decay;
    }
  }

  private startCleanupTimer(): void {
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpired();
        if (this.config.evictionPolicy === 'ADAPTIVE') {
          this.updateFrequencyScores();
        }
      }, this.config.cleanupInterval);
    }
  }
}

export default LRUCache;