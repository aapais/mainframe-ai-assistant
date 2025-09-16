/**
 * Multi-Layer Caching System for Backend Architecture
 * High-performance caching with multiple layers and intelligent invalidation
 */

import { EventEmitter } from 'events';
import { ICacheService, IBaseService, ServiceContext, ServiceHealth } from '../core/interfaces/ServiceInterfaces';

// ==============================
// Core Cache Interfaces
// ==============================

export interface CacheLayer {
  readonly name: string;
  readonly level: number;
  readonly capacity: number;
  readonly currentSize: number;

  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  keys(pattern?: string): Promise<string[]>;
  invalidatePattern(pattern: string): Promise<number>;
  getTtl(key: string): Promise<number>;
  getStats(): CacheLayerStats;
}

export interface CacheLayerStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  capacity: number;
  evictions: number;
  averageGetTime: number;
  averageSetTime: number;
}

export interface CacheInvalidationRule {
  name: string;
  pattern: string;
  triggers: string[];
  condition?: (data: any) => boolean;
  delay?: number; // Delay before invalidation
}

export interface CacheWarmingStrategy {
  name: string;
  keys: string[];
  loader: (key: string) => Promise<any>;
  schedule?: string; // Cron expression
  priority: number;
}

// ==============================
// Multi-Layer Cache Implementation
// ==============================

export class MultiLayerCache extends EventEmitter implements ICacheService {
  public readonly name = 'multi-layer-cache';
  public readonly version = '1.0.0';
  public readonly dependencies: string[] = [];

  private readonly layers: CacheLayer[];
  private readonly config: MultiLayerCacheConfig;
  private readonly invalidationManager: CacheInvalidationManager;
  private readonly warmingManager: CacheWarmingManager;
  private readonly compressionManager: CompressionManager;
  private readonly metrics: CacheMetrics;
  private context!: ServiceContext;

  constructor(config: MultiLayerCacheConfig) {
    super();
    this.config = config;
    this.layers = [];
    this.invalidationManager = new CacheInvalidationManager(this);
    this.warmingManager = new CacheWarmingManager(this);
    this.compressionManager = new CompressionManager(config.compression);
    this.metrics = new CacheMetrics();
  }

  async initialize(context: ServiceContext): Promise<void> {
    this.context = context;

    // Initialize cache layers in order
    await this.initializeLayers();

    // Setup invalidation rules
    await this.setupInvalidationRules();

    // Setup cache warming
    if (this.config.warming.enabled) {
      await this.warmingManager.initialize();
    }

    // Start metrics collection
    this.startMetricsCollection();

    this.emit('cache:initialized');
  }

  async shutdown(): Promise<void> {
    await this.warmingManager.shutdown();

    // Shutdown layers in reverse order
    for (let i = this.layers.length - 1; i >= 0; i--) {
      if ('shutdown' in this.layers[i]) {
        await (this.layers[i] as any).shutdown();
      }
    }

    this.emit('cache:shutdown');
  }

  async healthCheck(): Promise<ServiceHealth> {
    const layerHealths: Record<string, any> = {};
    let healthyLayers = 0;

    for (const layer of this.layers) {
      try {
        const stats = layer.getStats();
        layerHealths[layer.name] = {
          healthy: true,
          size: stats.size,
          hitRate: stats.hitRate,
          capacity: stats.capacity
        };
        healthyLayers++;
      } catch (error) {
        layerHealths[layer.name] = {
          healthy: false,
          error: (error as Error).message
        };
      }
    }

    const overallHealth = healthyLayers === this.layers.length;

    return {
      healthy: overallHealth,
      details: {
        totalLayers: this.layers.length,
        healthyLayers,
        layers: layerHealths,
        overallStats: this.getStats()
      },
      lastCheck: new Date()
    };
  }

  // Core Cache Operations

  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    const normalizedKey = this.normalizeKey(key);

    try {
      // Try each layer in order
      for (let i = 0; i < this.layers.length; i++) {
        const layer = this.layers[i];
        const value = await layer.get<T>(normalizedKey);

        if (value !== null) {
          this.metrics.recordHit(`L${i + 1}`, layer.name);

          // Promote to higher layers (cache promotion)
          await this.promoteToHigherLayers(normalizedKey, value, i);

          this.metrics.recordLatency('get', Date.now() - startTime);
          this.emit('cache:hit', { key: normalizedKey, layer: layer.name });

          return value;
        }
      }

      this.metrics.recordMiss();
      this.metrics.recordLatency('get', Date.now() - startTime);
      this.emit('cache:miss', { key: normalizedKey });

      return null;
    } catch (error) {
      this.metrics.recordError('get', error as Error);
      this.context?.logger?.error('Cache get error', error as Error, { key: normalizedKey });
      throw error;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const startTime = Date.now();
    const normalizedKey = this.normalizeKey(key);

    try {
      // Compress value if configured
      const processedValue = this.config.compression.enabled
        ? await this.compressionManager.compress(value)
        : value;

      // Set in all layers
      const setPromises = this.layers.map(layer =>
        layer.set(normalizedKey, processedValue, ttl)
      );

      await Promise.all(setPromises);

      this.metrics.recordLatency('set', Date.now() - startTime);
      this.emit('cache:set', { key: normalizedKey, ttl });

    } catch (error) {
      this.metrics.recordError('set', error as Error);
      this.context?.logger?.error('Cache set error', error as Error, { key: normalizedKey });
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    const normalizedKey = this.normalizeKey(key);

    try {
      let deleted = false;

      // Delete from all layers
      const deletePromises = this.layers.map(async layer => {
        const result = await layer.delete(normalizedKey);
        if (result) deleted = true;
        return result;
      });

      await Promise.all(deletePromises);

      this.emit('cache:delete', { key: normalizedKey });
      return deleted;

    } catch (error) {
      this.metrics.recordError('delete', error as Error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    const normalizedKey = this.normalizeKey(key);

    // Check only L1 cache for existence (fastest)
    if (this.layers.length > 0) {
      return this.layers[0].has(normalizedKey);
    }

    return false;
  }

  async clear(): Promise<void> {
    try {
      const clearPromises = this.layers.map(layer => layer.clear());
      await Promise.all(clearPromises);

      this.metrics.reset();
      this.emit('cache:cleared');

    } catch (error) {
      this.context?.logger?.error('Cache clear error', error as Error);
      throw error;
    }
  }

  // Advanced Operations

  async mget(keys: string[]): Promise<Array<any | null>> {
    const normalizedKeys = keys.map(key => this.normalizeKey(key));
    const results: Array<any | null> = new Array(keys.length).fill(null);

    // Track which keys we still need to find
    const missingKeys = new Set(normalizedKeys.map((key, index) => ({ key, index })));

    // Try each layer
    for (const layer of this.layers) {
      if (missingKeys.size === 0) break;

      const promises = Array.from(missingKeys).map(async ({ key, index }) => {
        const value = await layer.get(key);
        if (value !== null) {
          results[index] = value;
          missingKeys.delete({ key, index });
        }
      });

      await Promise.all(promises);
    }

    return results;
  }

  async mset(items: Array<{key: string, value: any, ttl?: number}>): Promise<void> {
    const processedItems = await Promise.all(
      items.map(async item => ({
        ...item,
        key: this.normalizeKey(item.key),
        value: this.config.compression.enabled
          ? await this.compressionManager.compress(item.value)
          : item.value
      }))
    );

    // Set in all layers
    const setPromises = this.layers.map(layer =>
      Promise.all(
        processedItems.map(item =>
          layer.set(item.key, item.value, item.ttl)
        )
      )
    );

    await Promise.all(setPromises);
  }

  async mdelete(keys: string[]): Promise<number> {
    const normalizedKeys = keys.map(key => this.normalizeKey(key));
    let deletedCount = 0;

    for (const layer of this.layers) {
      const deletePromises = normalizedKeys.map(key => layer.delete(key));
      const results = await Promise.all(deletePromises);
      deletedCount += results.filter(Boolean).length;
    }

    return deletedCount;
  }

  async invalidatePattern(pattern: string): Promise<number> {
    let totalInvalidated = 0;

    const invalidatePromises = this.layers.map(async layer => {
      const count = await layer.invalidatePattern(pattern);
      totalInvalidated += count;
      return count;
    });

    await Promise.all(invalidatePromises);

    this.metrics.recordInvalidation(totalInvalidated);
    this.emit('cache:pattern-invalidated', { pattern, count: totalInvalidated });

    return totalInvalidated;
  }

  async keys(pattern?: string): Promise<string[]> {
    // Get keys from L1 cache (most complete)
    if (this.layers.length > 0) {
      return this.layers[0].keys(pattern);
    }
    return [];
  }

  async flush(): Promise<void> {
    await this.clear();
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const normalizedKey = this.normalizeKey(key);

    // Get current value
    const value = await this.get(normalizedKey);
    if (value === null) return false;

    // Re-set with new TTL
    await this.set(normalizedKey, value, seconds * 1000);
    return true;
  }

  async ttl(key: string): Promise<number> {
    const normalizedKey = this.normalizeKey(key);

    // Check L1 cache for TTL
    if (this.layers.length > 0) {
      return this.layers[0].getTtl(normalizedKey);
    }

    return -1;
  }

  async size(): Promise<number> {
    if (this.layers.length > 0) {
      const stats = this.layers[0].getStats();
      return stats.size;
    }
    return 0;
  }

  // Statistics and Monitoring

  getStats(): any {
    const layerStats = this.layers.map(layer => ({
      name: layer.name,
      level: layer.level,
      ...layer.getStats()
    }));

    const overall = this.metrics.getOverallStats();

    return {
      layers: layerStats,
      overall,
      performance: {
        averageGetTime: overall.averageGetTime,
        averageSetTime: overall.averageSetTime,
        hitRate: overall.hitRate
      }
    };
  }

  getHitRate(): number {
    return this.metrics.getOverallStats().hitRate;
  }

  getMetrics(): any {
    return {
      cache: this.getStats(),
      invalidation: this.invalidationManager.getStats(),
      warming: this.warmingManager.getStats()
    };
  }

  resetMetrics(): void {
    this.metrics.reset();
  }

  // Private Methods

  private async initializeLayers(): Promise<void> {
    // L1: Memory cache (fastest, smallest)
    if (this.config.layers.memory.enabled) {
      const memoryLayer = new MemoryCacheLayer({
        name: 'Memory',
        level: 1,
        maxSize: this.config.layers.memory.maxSize,
        ttl: this.config.layers.memory.ttl,
        algorithm: this.config.layers.memory.algorithm
      });
      this.layers.push(memoryLayer);
    }

    // L2: SQLite cache (medium speed, medium size)
    if (this.config.layers.sqlite.enabled) {
      const sqliteLayer = new SQLiteCacheLayer({
        name: 'SQLite',
        level: 2,
        dbPath: this.config.layers.sqlite.dbPath,
        maxSize: this.config.layers.sqlite.maxSize,
        ttl: this.config.layers.sqlite.ttl,
        compressionLevel: this.config.layers.sqlite.compressionLevel
      });
      await sqliteLayer.initialize();
      this.layers.push(sqliteLayer);
    }

    // L3: File system cache (slowest, largest)
    if (this.config.layers.filesystem.enabled) {
      const fsLayer = new FileSystemCacheLayer({
        name: 'FileSystem',
        level: 3,
        basePath: this.config.layers.filesystem.basePath,
        maxSize: this.config.layers.filesystem.maxSize,
        ttl: this.config.layers.filesystem.ttl,
        compression: this.config.layers.filesystem.compression
      });
      await fsLayer.initialize();
      this.layers.push(fsLayer);
    }
  }

  private async promoteToHigherLayers(key: string, value: any, fromLevel: number): Promise<void> {
    // Promote to all layers above the one where we found the value
    const promotionPromises = this.layers
      .slice(0, fromLevel)
      .map(layer => layer.set(key, value));

    await Promise.all(promotionPromises);
  }

  private normalizeKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  private async setupInvalidationRules(): Promise<void> {
    const defaultRules: CacheInvalidationRule[] = [
      {
        name: 'kb-entry-updated',
        pattern: 'kb:entry:*',
        triggers: ['kb.entry.updated', 'kb.entry.deleted']
      },
      {
        name: 'search-cache-invalidation',
        pattern: 'search:*',
        triggers: ['kb.entry.created', 'kb.entry.updated', 'kb.entry.deleted']
      },
      {
        name: 'category-cache-invalidation',
        pattern: 'categories:*',
        triggers: ['kb.entry.created', 'kb.entry.updated', 'kb.entry.deleted']
      }
    ];

    for (const rule of defaultRules) {
      this.invalidationManager.addRule(rule);
    }
  }

  private startMetricsCollection(): void {
    // Collect metrics every minute
    setInterval(() => {
      this.collectAndEmitMetrics();
    }, 60000);
  }

  private collectAndEmitMetrics(): void {
    const stats = this.getStats();
    this.emit('cache:metrics', stats);

    // Check for alerts
    if (stats.overall.hitRate < this.config.alerts.lowHitRateThreshold) {
      this.emit('cache:alert', {
        type: 'low-hit-rate',
        hitRate: stats.overall.hitRate,
        threshold: this.config.alerts.lowHitRateThreshold
      });
    }

    if (stats.layers.some((layer: any) => layer.size / layer.capacity > this.config.alerts.highMemoryThreshold)) {
      this.emit('cache:alert', {
        type: 'high-memory-usage',
        layers: stats.layers.filter((layer: any) => layer.size / layer.capacity > this.config.alerts.highMemoryThreshold)
      });
    }
  }
}

// ==============================
// Cache Layer Implementations
// ==============================

class MemoryCacheLayer implements CacheLayer {
  public readonly name: string;
  public readonly level: number;
  public readonly capacity: number;

  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly config: MemoryCacheConfig;
  private readonly stats: CacheLayerStats;

  constructor(config: MemoryCacheConfig) {
    this.name = config.name;
    this.level = config.level;
    this.capacity = config.maxSize;
    this.config = config;
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      capacity: config.maxSize,
      evictions: 0,
      averageGetTime: 0,
      averageSetTime: 0
    };
  }

  get currentSize(): number {
    return this.cache.size;
  }

  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();

    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check TTL
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Update access time for LRU
    entry.accessedAt = Date.now();

    this.stats.hits++;
    this.updateHitRate();
    this.updateAverageTime('get', Date.now() - startTime);

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const startTime = Date.now();

    // Check capacity and evict if necessary
    if (this.cache.size >= this.capacity && !this.cache.has(key)) {
      this.evictLRU();
    }

    const expiresAt = ttl ? Date.now() + ttl : undefined;
    const entry: CacheEntry = {
      value,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      expiresAt
    };

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
    this.updateAverageTime('set', Date.now() - startTime);
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return deleted;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.size = 0;
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check TTL
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());

    if (!pattern) return allKeys;

    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  async invalidatePattern(pattern: string): Promise<number> {
    const keysToDelete = await this.keys(pattern);
    let count = 0;

    for (const key of keysToDelete) {
      if (await this.delete(key)) {
        count++;
      }
    }

    return count;
  }

  async getTtl(key: string): Promise<number> {
    const entry = this.cache.get(key);
    if (!entry || !entry.expiresAt) return -1;

    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? Math.floor(remaining / 1000) : -2;
  }

  getStats(): CacheLayerStats {
    return { ...this.stats };
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  private updateAverageTime(operation: 'get' | 'set', time: number): void {
    if (operation === 'get') {
      this.stats.averageGetTime = (this.stats.averageGetTime + time) / 2;
    } else {
      this.stats.averageSetTime = (this.stats.averageSetTime + time) / 2;
    }
  }
}

class SQLiteCacheLayer implements CacheLayer {
  public readonly name: string;
  public readonly level: number;
  public readonly capacity: number;
  public currentSize: number = 0;

  private db: any; // Database instance
  private initialized = false;

  constructor(private readonly config: SQLiteCacheConfig) {
    this.name = config.name;
    this.level = config.level;
    this.capacity = config.maxSize;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const Database = require('better-sqlite3');
    this.db = new Database(this.config.dbPath);

    // Create cache table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        key TEXT PRIMARY KEY,
        value BLOB,
        created_at INTEGER,
        expires_at INTEGER,
        size INTEGER
      )
    `);

    // Create indexes
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_expires_at ON cache_entries(expires_at)');

    // Clean expired entries
    await this.cleanExpired();

    this.initialized = true;
  }

  async get<T>(key: string): Promise<T | null> {
    const stmt = this.db.prepare('SELECT value, expires_at FROM cache_entries WHERE key = ?');
    const row = stmt.get(key);

    if (!row) return null;

    // Check expiration
    if (row.expires_at && Date.now() > row.expires_at) {
      await this.delete(key);
      return null;
    }

    // Decompress if needed
    return this.config.compressionLevel > 0
      ? await this.decompress(row.value)
      : JSON.parse(row.value);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    const compressed = this.config.compressionLevel > 0
      ? await this.compress(serialized)
      : serialized;

    const expiresAt = ttl ? Date.now() + ttl : null;
    const size = Buffer.byteLength(compressed);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cache_entries (key, value, created_at, expires_at, size)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(key, compressed, Date.now(), expiresAt, size);
  }

  async delete(key: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM cache_entries WHERE key = ?');
    const result = stmt.run(key);
    return result.changes > 0;
  }

  async clear(): Promise<void> {
    this.db.exec('DELETE FROM cache_entries');
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async keys(pattern?: string): Promise<string[]> {
    let sql = 'SELECT key FROM cache_entries';
    let params: any[] = [];

    if (pattern) {
      sql += ' WHERE key LIKE ?';
      params = [pattern.replace(/\*/g, '%')];
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);
    return rows.map((row: any) => row.key);
  }

  async invalidatePattern(pattern: string): Promise<number> {
    const sql = 'DELETE FROM cache_entries WHERE key LIKE ?';
    const stmt = this.db.prepare(sql);
    const result = stmt.run(pattern.replace(/\*/g, '%'));
    return result.changes;
  }

  async getTtl(key: string): Promise<number> {
    const stmt = this.db.prepare('SELECT expires_at FROM cache_entries WHERE key = ?');
    const row = stmt.get(key);

    if (!row || !row.expires_at) return -1;

    const remaining = row.expires_at - Date.now();
    return remaining > 0 ? Math.floor(remaining / 1000) : -2;
  }

  getStats(): CacheLayerStats {
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM cache_entries');
    const sizeStmt = this.db.prepare('SELECT SUM(size) as total_size FROM cache_entries');

    const count = countStmt.get().count;
    const totalSize = sizeStmt.get().total_size || 0;

    return {
      hits: 0, // Would need to track separately
      misses: 0,
      hitRate: 0,
      size: count,
      capacity: this.capacity,
      evictions: 0,
      averageGetTime: 0,
      averageSetTime: 0
    };
  }

  private async cleanExpired(): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM cache_entries WHERE expires_at < ?');
    stmt.run(Date.now());
  }

  private async compress(data: string): Promise<Buffer> {
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      zlib.gzip(data, { level: this.config.compressionLevel }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  private async decompress(data: Buffer): Promise<any> {
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      zlib.gunzip(data, (err, result) => {
        if (err) reject(err);
        else resolve(JSON.parse(result.toString()));
      });
    });
  }
}

class FileSystemCacheLayer implements CacheLayer {
  public readonly name: string;
  public readonly level: number;
  public readonly capacity: number;
  public currentSize: number = 0;

  constructor(private readonly config: FileSystemCacheConfig) {
    this.name = config.name;
    this.level = config.level;
    this.capacity = config.maxSize;
  }

  async initialize(): Promise<void> {
    const fs = require('fs');
    if (!fs.existsSync(this.config.basePath)) {
      fs.mkdirSync(this.config.basePath, { recursive: true });
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const filePath = this.getFilePath(key);
    const fs = require('fs');

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(filePath);
      const entry = JSON.parse(data.toString());

      // Check expiration
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        fs.unlinkSync(filePath);
        return null;
      }

      return this.config.compression
        ? await this.decompress(entry.value)
        : entry.value;
    } catch (error) {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const filePath = this.getFilePath(key);
    const fs = require('fs');

    const entry = {
      value: this.config.compression ? await this.compress(value) : value,
      createdAt: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : null
    };

    fs.writeFileSync(filePath, JSON.stringify(entry));
  }

  async delete(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);
    const fs = require('fs');

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
    } catch (error) {
      // Ignore errors
    }

    return false;
  }

  async clear(): Promise<void> {
    const fs = require('fs');
    const path = require('path');

    try {
      const files = fs.readdirSync(this.config.basePath);
      for (const file of files) {
        if (file.endsWith('.cache')) {
          fs.unlinkSync(path.join(this.config.basePath, file));
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async keys(pattern?: string): Promise<string[]> {
    const fs = require('fs');
    const path = require('path');

    try {
      const files = fs.readdirSync(this.config.basePath);
      let keys = files
        .filter((file: string) => file.endsWith('.cache'))
        .map((file: string) => this.decodeKey(path.basename(file, '.cache')));

      if (pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        keys = keys.filter(key => regex.test(key));
      }

      return keys;
    } catch (error) {
      return [];
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    const keys = await this.keys(pattern);
    let count = 0;

    for (const key of keys) {
      if (await this.delete(key)) {
        count++;
      }
    }

    return count;
  }

  async getTtl(key: string): Promise<number> {
    const filePath = this.getFilePath(key);
    const fs = require('fs');

    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath);
        const entry = JSON.parse(data.toString());

        if (!entry.expiresAt) return -1;

        const remaining = entry.expiresAt - Date.now();
        return remaining > 0 ? Math.floor(remaining / 1000) : -2;
      }
    } catch (error) {
      // Ignore errors
    }

    return -2;
  }

  getStats(): CacheLayerStats {
    // Would need to scan directory for accurate stats
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      capacity: this.capacity,
      evictions: 0,
      averageGetTime: 0,
      averageSetTime: 0
    };
  }

  private getFilePath(key: string): string {
    const path = require('path');
    const encodedKey = this.encodeKey(key);
    return path.join(this.config.basePath, `${encodedKey}.cache`);
  }

  private encodeKey(key: string): string {
    return Buffer.from(key).toString('base64').replace(/[/+=]/g, '_');
  }

  private decodeKey(encodedKey: string): string {
    return Buffer.from(encodedKey.replace(/_/g, '='), 'base64').toString();
  }

  private async compress(value: any): Promise<string> {
    const zlib = require('zlib');
    const data = JSON.stringify(value);
    return new Promise((resolve, reject) => {
      zlib.gzip(data, (err, result) => {
        if (err) reject(err);
        else resolve(result.toString('base64'));
      });
    });
  }

  private async decompress(data: string): Promise<any> {
    const zlib = require('zlib');
    const buffer = Buffer.from(data, 'base64');
    return new Promise((resolve, reject) => {
      zlib.gunzip(buffer, (err, result) => {
        if (err) reject(err);
        else resolve(JSON.parse(result.toString()));
      });
    });
  }
}

// ==============================
// Supporting Classes
// ==============================

class CacheInvalidationManager {
  private readonly rules: Map<string, CacheInvalidationRule> = new Map();
  private readonly cache: MultiLayerCache;

  constructor(cache: MultiLayerCache) {
    this.cache = cache;
  }

  addRule(rule: CacheInvalidationRule): void {
    this.rules.set(rule.name, rule);

    // Setup event listeners for triggers
    rule.triggers.forEach(trigger => {
      this.cache.on(trigger, async (data: any) => {
        if (!rule.condition || rule.condition(data)) {
          if (rule.delay) {
            setTimeout(() => {
              this.cache.invalidatePattern(rule.pattern);
            }, rule.delay);
          } else {
            await this.cache.invalidatePattern(rule.pattern);
          }
        }
      });
    });
  }

  removeRule(ruleName: string): void {
    this.rules.delete(ruleName);
  }

  getStats(): any {
    return {
      totalRules: this.rules.size,
      rules: Array.from(this.rules.values())
    };
  }
}

class CacheWarmingManager {
  private readonly strategies: Map<string, CacheWarmingStrategy> = new Map();
  private readonly cache: MultiLayerCache;
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(cache: MultiLayerCache) {
    this.cache = cache;
  }

  async initialize(): Promise<void> {
    // Start warming strategies
    for (const [name, strategy] of this.strategies) {
      await this.executeWarmingStrategy(strategy);

      if (strategy.schedule) {
        // Setup recurring warming (simplified - would use proper cron)
        const interval = setInterval(() => {
          this.executeWarmingStrategy(strategy);
        }, 60000); // Simplified to 1 minute intervals

        this.intervals.set(name, interval);
      }
    }
  }

  async shutdown(): Promise<void> {
    // Clear all intervals
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }

  addStrategy(strategy: CacheWarmingStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  private async executeWarmingStrategy(strategy: CacheWarmingStrategy): Promise<void> {
    try {
      for (const key of strategy.keys) {
        const value = await strategy.loader(key);
        if (value !== null) {
          await this.cache.set(key, value);
        }
      }
    } catch (error) {
      console.warn(`Cache warming failed for strategy ${strategy.name}:`, error);
    }
  }

  getStats(): any {
    return {
      totalStrategies: this.strategies.size,
      activeStrategies: this.intervals.size,
      strategies: Array.from(this.strategies.values())
    };
  }
}

class CompressionManager {
  constructor(private readonly config: CompressionConfig) {}

  async compress(value: any): Promise<any> {
    if (!this.config.enabled) return value;

    const zlib = require('zlib');
    const data = JSON.stringify(value);

    if (data.length < this.config.threshold) {
      return value; // Don't compress small values
    }

    return new Promise((resolve, reject) => {
      zlib.gzip(data, { level: this.config.level }, (err, result) => {
        if (err) reject(err);
        else resolve({
          __compressed: true,
          data: result.toString('base64')
        });
      });
    });
  }

  async decompress(value: any): Promise<any> {
    if (!value || !value.__compressed) return value;

    const zlib = require('zlib');
    const buffer = Buffer.from(value.data, 'base64');

    return new Promise((resolve, reject) => {
      zlib.gunzip(buffer, (err, result) => {
        if (err) reject(err);
        else resolve(JSON.parse(result.toString()));
      });
    });
  }
}

class CacheMetrics {
  private hits: Map<string, number> = new Map();
  private misses: number = 0;
  private totalLatency: Map<string, number> = new Map();
  private operationCounts: Map<string, number> = new Map();

  recordHit(level: string, layerName: string): void {
    const key = `${level}-${layerName}`;
    this.hits.set(key, (this.hits.get(key) || 0) + 1);
  }

  recordMiss(): void {
    this.misses++;
  }

  recordLatency(operation: string, latency: number): void {
    this.totalLatency.set(operation, (this.totalLatency.get(operation) || 0) + latency);
    this.operationCounts.set(operation, (this.operationCounts.get(operation) || 0) + 1);
  }

  recordError(operation: string, error: Error): void {
    // Record error metrics
  }

  recordInvalidation(count: number): void {
    // Record invalidation metrics
  }

  getOverallStats(): any {
    const totalHits = Array.from(this.hits.values()).reduce((sum, count) => sum + count, 0);
    const totalRequests = totalHits + this.misses;

    return {
      hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
      totalHits,
      totalMisses: this.misses,
      totalRequests,
      averageGetTime: this.getAverageLatency('get'),
      averageSetTime: this.getAverageLatency('set')
    };
  }

  private getAverageLatency(operation: string): number {
    const total = this.totalLatency.get(operation) || 0;
    const count = this.operationCounts.get(operation) || 0;
    return count > 0 ? total / count : 0;
  }

  reset(): void {
    this.hits.clear();
    this.misses = 0;
    this.totalLatency.clear();
    this.operationCounts.clear();
  }
}

// ==============================
// Type Definitions
// ==============================

interface CacheEntry {
  value: any;
  createdAt: number;
  accessedAt: number;
  expiresAt?: number;
}

interface MultiLayerCacheConfig {
  keyPrefix: string;
  layers: {
    memory: MemoryCacheConfig & { enabled: boolean };
    sqlite: SQLiteCacheConfig & { enabled: boolean };
    filesystem: FileSystemCacheConfig & { enabled: boolean };
  };
  compression: CompressionConfig;
  warming: {
    enabled: boolean;
    strategies: CacheWarmingStrategy[];
  };
  alerts: {
    lowHitRateThreshold: number;
    highMemoryThreshold: number;
  };
}

interface MemoryCacheConfig {
  name: string;
  level: number;
  maxSize: number;
  ttl: number;
  algorithm: 'lru' | 'lfu' | 'fifo';
}

interface SQLiteCacheConfig {
  name: string;
  level: number;
  dbPath: string;
  maxSize: number;
  ttl: number;
  compressionLevel: number;
}

interface FileSystemCacheConfig {
  name: string;
  level: number;
  basePath: string;
  maxSize: number;
  ttl: number;
  compression: boolean;
}

interface CompressionConfig {
  enabled: boolean;
  level: number; // 1-9
  threshold: number; // Minimum size to compress
}

export { MultiLayerCache as default };