'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SearchCache = void 0;
class SearchCache {
  l1Cache = new Map();
  l2Cache = new Map();
  persistentCache = new Map();
  stats = {
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
  config;
  cleanupTimer;
  accessTimes = [];
  constructor(config) {
    this.config = {
      maxSize: 100 * 1024 * 1024,
      defaultTTL: 300000,
      checkInterval: 60000,
      strategy: 'adaptive',
      layers: [
        { name: 'l1', maxSize: 1000, ttl: 60000, strategy: 'lfu', enabled: true },
        { name: 'l2', maxSize: 5000, ttl: 300000, strategy: 'lru', enabled: true },
      ],
      persistence: {
        enabled: false,
        interval: 300000,
        snapshotThreshold: 1000,
      },
      compression: {
        enabled: true,
        threshold: 1024,
        algorithm: 'gzip',
      },
      warming: {
        enabled: true,
        strategies: ['popular_queries', 'recent_searches'],
        schedule: '0 */6 * * *',
      },
      ...config,
    };
    this.startCleanupTimer();
  }
  async get(key) {
    const startTime = Date.now();
    try {
      const l1Entry = this.l1Cache.get(key);
      if (l1Entry && !this.isExpired(l1Entry)) {
        this.updateAccess(l1Entry);
        this.recordHit(startTime);
        return l1Entry.value;
      }
      const l2Entry = this.l2Cache.get(key);
      if (l2Entry && !this.isExpired(l2Entry)) {
        this.updateAccess(l2Entry);
        if (l2Entry.accessCount > 5) {
          await this.promoteToL1(key, l2Entry);
        }
        this.recordHit(startTime);
        return l2Entry.value;
      }
      if (this.config.persistence.enabled) {
        const persistentValue = this.persistentCache.get(key);
        if (persistentValue) {
          await this.set(key, persistentValue, this.config.defaultTTL);
          this.recordHit(startTime);
          return persistentValue;
        }
      }
      this.recordMiss(startTime);
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      this.recordMiss(startTime);
      return null;
    }
  }
  async set(key, value, ttl) {
    const effectiveTTL = ttl || this.config.defaultTTL;
    const size = this.estimateSize(value);
    const now = Date.now();
    const entry = {
      key,
      value,
      ttl: effectiveTTL,
      accessCount: 1,
      lastAccessed: now,
      created: now,
      size,
      metadata: {},
    };
    if (this.shouldUseL1(key, size)) {
      await this.setInL1(key, entry);
    } else {
      await this.setInL2(key, entry);
    }
    this.stats.entryCount++;
    this.stats.totalSize += size;
  }
  async mget(keys) {
    const results = [];
    for (const key of keys) {
      const value = await this.get(key);
      results.push(value);
    }
    return results;
  }
  async mset(items) {
    const promises = items.map(item => this.set(item.key, item.value, item.ttl));
    await Promise.all(promises);
  }
  async delete(key) {
    let found = false;
    if (this.l1Cache.has(key)) {
      const entry = this.l1Cache.get(key);
      this.stats.totalSize -= entry.size;
      this.l1Cache.delete(key);
      found = true;
    }
    if (this.l2Cache.has(key)) {
      const entry = this.l2Cache.get(key);
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
  async deletePattern(pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    let deleted = 0;
    const keysToDelete = [];
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
    for (const key of keysToDelete) {
      const wasDeleted = await this.delete(key);
      if (wasDeleted) deleted++;
    }
    return deleted;
  }
  async has(key) {
    return this.l1Cache.has(key) || this.l2Cache.has(key) || this.persistentCache.has(key);
  }
  async expire(key, ttl) {
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
  async clear() {
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
  async keys(pattern) {
    const allKeys = new Set([
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
  getStats() {
    this.updateStats();
    return { ...this.stats };
  }
  async warmCache(warmingData) {
    const { popularQueries = [], recentSearches = [], predictedTerms = [] } = warmingData;
    for (const query of popularQueries) {
      const cacheKey = this.generateQueryCacheKey(query, {});
      await this.set(`${cacheKey}:warm`, true, this.config.defaultTTL * 2);
    }
    console.log(
      `Cache warmed with ${popularQueries.length} popular queries, ${recentSearches.length} recent searches, ${predictedTerms.length} predicted terms`
    );
  }
  generateQueryCacheKey(query, options) {
    const normalized = query.toLowerCase().trim();
    const optionsHash = this.hashOptions(options);
    return `query:${normalized}:${optionsHash}`;
  }
  generateTermCacheKey(term) {
    return `term:${term.toLowerCase()}`;
  }
  generateIndexCacheKey(segment) {
    return `index:${segment}`;
  }
  async close() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    if (this.config.persistence.enabled) {
      await this.persist();
    }
  }
  shouldUseL1(key, size) {
    if (size > 10240) return false;
    const recentKey = this.l2Cache.get(key);
    if (recentKey && recentKey.accessCount > 3) {
      return true;
    }
    if (key.startsWith('query:')) {
      return true;
    }
    return false;
  }
  async setInL1(key, entry) {
    const l1Config = this.config.layers.find(l => l.name === 'l1');
    while (this.l1Cache.size >= l1Config.maxSize) {
      await this.evictFromL1();
    }
    this.l1Cache.set(key, entry);
  }
  async setInL2(key, entry) {
    const l2Config = this.config.layers.find(l => l.name === 'l2');
    while (this.l2Cache.size >= l2Config.maxSize) {
      await this.evictFromL2();
    }
    this.l2Cache.set(key, entry);
  }
  async promoteToL1(key, entry) {
    this.l2Cache.delete(key);
    await this.setInL1(key, entry);
  }
  async evictFromL1() {
    const l1Config = this.config.layers.find(l => l.name === 'l1');
    const victim = this.selectEvictionVictim(this.l1Cache, l1Config.strategy);
    if (victim) {
      const [key, entry] = victim;
      this.l1Cache.delete(key);
      if (entry.accessCount > 1) {
        await this.setInL2(key, entry);
      }
      this.stats.evictions++;
    }
  }
  async evictFromL2() {
    const l2Config = this.config.layers.find(l => l.name === 'l2');
    const victim = this.selectEvictionVictim(this.l2Cache, l2Config.strategy);
    if (victim) {
      const [key, entry] = victim;
      this.l2Cache.delete(key);
      if (this.config.persistence.enabled && entry.accessCount > 0) {
        this.persistentCache.set(key, entry.value);
      }
      this.stats.evictions++;
    }
  }
  selectEvictionVictim(cache, strategy) {
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
        return entries.reduce((worst, current) => {
          const currentScore = this.calculateAdaptiveScore(current[1]);
          const worstScore = this.calculateAdaptiveScore(worst[1]);
          return currentScore < worstScore ? current : worst;
        });
      default:
        return entries[0];
    }
  }
  calculateAdaptiveScore(entry) {
    const now = Date.now();
    const age = now - entry.created;
    const timeSinceAccess = now - entry.lastAccessed;
    let score = 0;
    score += Math.log(1 + entry.accessCount) * 10;
    score += Math.max(0, 100 - timeSinceAccess / 1000);
    score -= Math.sqrt(entry.size / 1024);
    const remainingTTL = entry.ttl - age;
    score += Math.max(0, remainingTTL / 1000);
    return score;
  }
  isExpired(entry) {
    const now = Date.now();
    return now - entry.created > entry.ttl;
  }
  updateAccess(entry) {
    entry.accessCount++;
    entry.lastAccessed = Date.now();
  }
  recordHit(startTime) {
    this.stats.hitCount++;
    this.recordAccessTime(startTime);
    this.updateHitRate();
  }
  recordMiss(startTime) {
    this.stats.missCount++;
    this.recordAccessTime(startTime);
    this.updateHitRate();
  }
  recordAccessTime(startTime) {
    const accessTime = Date.now() - startTime;
    this.accessTimes.push(accessTime);
    if (this.accessTimes.length > 1000) {
      this.accessTimes = this.accessTimes.slice(-1000);
    }
    this.stats.averageAccessTime =
      this.accessTimes.reduce((sum, time) => sum + time, 0) / this.accessTimes.length;
  }
  updateHitRate() {
    const total = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0;
  }
  updateStats() {
    this.stats.memoryUsage = 0;
    for (const entry of this.l1Cache.values()) {
      this.stats.memoryUsage += entry.size;
    }
    for (const entry of this.l2Cache.values()) {
      this.stats.memoryUsage += entry.size;
    }
    const allEntries = [
      ...Array.from(this.l1Cache.entries()),
      ...Array.from(this.l2Cache.entries()),
    ];
    this.stats.hotKeys = allEntries
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, 10)
      .map(([key]) => key);
  }
  estimateSize(value) {
    if (typeof value === 'string') {
      return value.length * 2;
    }
    if (typeof value === 'number') {
      return 8;
    }
    if (typeof value === 'boolean') {
      return 1;
    }
    if (Array.isArray(value)) {
      return value.reduce((sum, item) => sum + this.estimateSize(item), 0) + 24;
    }
    if (typeof value === 'object' && value !== null) {
      return (
        Object.entries(value).reduce(
          (sum, [key, val]) => sum + key.length * 2 + this.estimateSize(val),
          0
        ) + 32
      );
    }
    return 8;
  }
  hashOptions(options) {
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
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.checkInterval);
  }
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.l1Cache.entries()) {
      if (this.isExpired(entry)) {
        this.l1Cache.delete(key);
        this.stats.totalSize -= entry.size;
        this.stats.entryCount--;
      }
    }
    for (const [key, entry] of this.l2Cache.entries()) {
      if (this.isExpired(entry)) {
        this.l2Cache.delete(key);
        this.stats.totalSize -= entry.size;
        this.stats.entryCount--;
      }
    }
  }
  async persist() {
    console.log('Persisting cache to disk (simplified implementation)');
  }
}
exports.SearchCache = SearchCache;
exports.default = SearchCache;
//# sourceMappingURL=SearchCache.js.map
