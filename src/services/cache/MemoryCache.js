'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.MemoryCache = void 0;
class MemoryCache {
  cache = new Map();
  accessOrder = [];
  config;
  cleanupTimer;
  currentMemoryUsage = 0;
  metrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    memoryUsage: 0,
  };
  constructor(config) {
    this.config = config;
    this.startCleanupTimer();
  }
  get(key) {
    const item = this.cache.get(key);
    if (!item) {
      this.metrics.misses++;
      return null;
    }
    if (this.isExpired(item)) {
      this.delete(key);
      this.metrics.misses++;
      return null;
    }
    item.lastAccessed = Date.now();
    item.accessCount++;
    this.updateAccessOrder(key);
    this.metrics.hits++;
    return item.value;
  }
  set(key, value, ttl, tags) {
    const size = this.estimateSize(value);
    if (this.currentMemoryUsage + size > this.config.maxMemoryUsage) {
      this.evictLRU(size);
    }
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }
    const item = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      accessCount: 1,
      lastAccessed: Date.now(),
      size,
      tags,
    };
    if (this.cache.has(key)) {
      const oldItem = this.cache.get(key);
      this.currentMemoryUsage -= oldItem.size;
    }
    this.cache.set(key, item);
    this.currentMemoryUsage += size;
    this.updateAccessOrder(key);
    return true;
  }
  delete(key) {
    const item = this.cache.get(key);
    if (item) {
      this.currentMemoryUsage -= item.size;
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return true;
    }
    return false;
  }
  has(key) {
    const item = this.cache.get(key);
    return item ? !this.isExpired(item) : false;
  }
  clear() {
    this.cache.clear();
    this.accessOrder = [];
    this.currentMemoryUsage = 0;
    this.metrics.evictions += this.cache.size;
  }
  invalidateByTag(tag) {
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
      ...this.metrics,
    };
  }
  keys(pattern) {
    const keys = Array.from(this.cache.keys());
    if (!pattern) return keys;
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return keys.filter(key => regex.test(key));
  }
  mget(keys) {
    return keys.map(key => this.get(key));
  }
  mset(entries) {
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
  isExpired(item) {
    return Date.now() > item.timestamp + item.ttl * 1000;
  }
  evictLRU(requiredSize) {
    const targetSize = requiredSize || 0;
    while (
      this.cache.size >= this.config.maxSize ||
      this.currentMemoryUsage + targetSize > this.config.maxMemoryUsage
    ) {
      if (this.accessOrder.length === 0) break;
      const lruKey = this.accessOrder[0];
      this.delete(lruKey);
      this.metrics.evictions++;
    }
  }
  updateAccessOrder(key) {
    if (!this.config.enableLRU) return;
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }
  removeFromAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
  estimateSize(value) {
    try {
      return Buffer.byteLength(JSON.stringify(value), 'utf8');
    } catch {
      return 1024;
    }
  }
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }
  cleanup() {
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
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}
exports.MemoryCache = MemoryCache;
//# sourceMappingURL=MemoryCache.js.map
