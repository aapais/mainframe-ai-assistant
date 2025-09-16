/**
 * Multi-layer Cache Manager for Electron Main Process
 * Handles memory and disk caching with TTL expiration, size-based eviction, and warming strategies
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  created: Date;
  accessed: Date;
  ttl: number;
  size: number;
  hits: number;
  tags?: string[];
}

export interface CacheConfig {
  maxMemorySize: number; // bytes
  maxDiskSize?: number; // bytes
  defaultTTL: number; // ms
  enableDiskCache: boolean;
  diskCachePath: string;
  cleanupInterval: number; // ms
  enableMetrics: boolean;
  compressionThreshold?: number; // bytes
  warmupStrategies?: string[];
}

export interface CacheMetrics {
  memory: {
    size: number;
    entries: number;
    hits: number;
    misses: number;
    hitRatio: number;
  };
  disk: {
    size: number;
    entries: number;
    hits: number;
    misses: number;
  };
  total: {
    hits: number;
    misses: number;
    hitRatio: number;
  };
  evictions: number;
  lastCleanup: Date;
}

export interface CacheHealth {
  healthy: boolean;
  memoryUsage: number; // percentage
  diskUsage?: number; // percentage
  issues: string[];
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxMemorySize: 100 * 1024 * 1024, // 100MB
  maxDiskSize: 500 * 1024 * 1024,   // 500MB
  defaultTTL: 300000, // 5 minutes
  enableDiskCache: true,
  diskCachePath: './cache',
  cleanupInterval: 60000, // 1 minute
  enableMetrics: true,
  compressionThreshold: 1024, // 1KB
  warmupStrategies: ['recent', 'frequent']
};

export class CacheManager extends EventEmitter {
  private config: CacheConfig;
  private memoryCache = new Map<string, CacheEntry>();
  private diskCacheIndex = new Map<string, { file: string; size: number; created: Date; accessed: Date }>();
  
  private metrics: CacheMetrics = {
    memory: { size: 0, entries: 0, hits: 0, misses: 0, hitRatio: 0 },
    disk: { size: 0, entries: 0, hits: 0, misses: 0 },
    total: { hits: 0, misses: 0, hitRatio: 0 },
    evictions: 0,
    lastCleanup: new Date()
  };
  
  private cleanupInterval?: NodeJS.Timeout;
  private accessOrder: string[] = []; // For LRU eviction
  private isInitialized = false;
  private isShuttingDown = false;

  constructor(config: Partial<CacheConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Create cache directory
    if (this.config.enableDiskCache) {
      await this.ensureCacheDirectory();
      await this.loadDiskCacheIndex();
    }

    // Start cleanup interval
    this.startCleanup();
    
    // Perform warmup if configured
    await this.performWarmup();
    
    this.isInitialized = true;
    this.emit('cache:initialized', {
      memoryEntries: this.memoryCache.size,
      diskEntries: this.diskCacheIndex.size,
      config: this.config
    });
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    
    // Stop cleanup
    this.stopCleanup();
    
    // Save important cache entries to disk
    if (this.config.enableDiskCache) {
      await this.flushToDisk();
    }
    
    // Clear memory cache
    this.memoryCache.clear();
    this.accessOrder.length = 0;
    
    this.emit('cache:shutdown', this.metrics);
  }

  // ========================
  // Core Cache Operations
  // ========================

  async get<T = any>(key: string): Promise<T | null> {
    if (this.isShuttingDown) return null;

    // Try memory cache first
    const memoryEntry = await this.getFromMemory<T>(key);
    if (memoryEntry !== null) {
      this.recordHit('memory');
      this.updateAccessOrder(key);
      return memoryEntry;
    }

    // Try disk cache
    if (this.config.enableDiskCache) {
      const diskEntry = await this.getFromDisk<T>(key);
      if (diskEntry !== null) {
        this.recordHit('disk');
        
        // Promote to memory cache
        await this.set(key, diskEntry.value, diskEntry.ttl - (Date.now() - diskEntry.created.getTime()));
        
        return diskEntry.value;
      }
    }

    this.recordMiss();
    return null;
  }

  async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    if (this.isShuttingDown) return;

    const actualTTL = ttl || this.config.defaultTTL;
    const size = this.calculateSize(value);
    
    const entry: CacheEntry<T> = {
      key,
      value,
      created: new Date(),
      accessed: new Date(),
      ttl: actualTTL,
      size,
      hits: 0
    };

    // Store in memory cache
    await this.setInMemory(entry);
    
    // Store in disk cache if enabled and entry is large enough
    if (this.config.enableDiskCache && size > (this.config.compressionThreshold || 0)) {
      await this.setOnDisk(entry);
    }

    this.emit('cache:set', { key, size, ttl: actualTTL, location: 'memory' });
  }

  async delete(key: string): Promise<boolean> {
    let deleted = false;

    // Delete from memory
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key)!;
      this.memoryCache.delete(key);
      this.metrics.memory.size -= entry.size;
      this.metrics.memory.entries--;
      this.removeFromAccessOrder(key);
      deleted = true;
    }

    // Delete from disk
    if (this.config.enableDiskCache && this.diskCacheIndex.has(key)) {
      await this.deleteFromDisk(key);
      deleted = true;
    }

    if (deleted) {
      this.emit('cache:delete', { key });
    }

    return deleted;
  }

  async has(key: string): Promise<boolean> {
    return this.memoryCache.has(key) || 
           (this.config.enableDiskCache && this.diskCacheIndex.has(key));
  }

  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();
    this.accessOrder.length = 0;
    this.metrics.memory = { size: 0, entries: 0, hits: 0, misses: 0, hitRatio: 0 };

    // Clear disk cache
    if (this.config.enableDiskCache) {
      await this.clearDiskCache();
    }

    this.emit('cache:cleared');
  }

  // ========================
  // Memory Cache Operations
  // ========================

  private async getFromMemory<T>(key: string): Promise<T | null> {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    // Check TTL
    if (this.isExpired(entry)) {
      this.memoryCache.delete(key);
      this.metrics.memory.size -= entry.size;
      this.metrics.memory.entries--;
      this.removeFromAccessOrder(key);
      return null;
    }

    // Update access info
    entry.accessed = new Date();
    entry.hits++;

    return entry.value as T;
  }

  private async setInMemory<T>(entry: CacheEntry<T>): Promise<void> {
    // Check if we need to evict
    while (this.needsEviction(entry.size)) {
      await this.evictLeastRecentlyUsed();
    }

    // Store entry
    this.memoryCache.set(entry.key, entry);
    this.metrics.memory.size += entry.size;
    this.metrics.memory.entries++;
    this.updateAccessOrder(entry.key);
  }

  private needsEviction(newEntrySize: number): boolean {
    return this.metrics.memory.size + newEntrySize > this.config.maxMemorySize;
  }

  private async evictLeastRecentlyUsed(): Promise<void> {
    if (this.accessOrder.length === 0) return;

    const keyToEvict = this.accessOrder.shift()!;
    const entry = this.memoryCache.get(keyToEvict);
    
    if (entry) {
      // Try to save to disk before evicting
      if (this.config.enableDiskCache && !this.diskCacheIndex.has(keyToEvict)) {
        try {
          await this.setOnDisk(entry);
        } catch (error) {
          // If disk save fails, just evict
        }
      }

      this.memoryCache.delete(keyToEvict);
      this.metrics.memory.size -= entry.size;
      this.metrics.memory.entries--;
      this.metrics.evictions++;
      
      this.emit('cache:evicted', { key: keyToEvict, reason: 'lru', size: entry.size });
    }
  }

  // ========================
  // Disk Cache Operations
  // ========================

  private async getFromDisk<T>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.diskCacheIndex.has(key)) return null;

    const indexEntry = this.diskCacheIndex.get(key)!;
    const filePath = path.join(this.config.diskCachePath, indexEntry.file);

    try {
      const data = await readFile(filePath, 'utf8');
      const entry: CacheEntry<T> = JSON.parse(data);

      // Check TTL
      if (this.isExpired(entry)) {
        await this.deleteFromDisk(key);
        return null;
      }

      // Update access time in index
      indexEntry.accessed = new Date();

      return entry;
    } catch (error) {
      // File might be corrupted or missing, remove from index
      this.diskCacheIndex.delete(key);
      return null;
    }
  }

  private async setOnDisk<T>(entry: CacheEntry<T>): Promise<void> {
    const fileName = `${this.sanitizeKey(entry.key)}.json`;
    const filePath = path.join(this.config.diskCachePath, fileName);

    try {
      const data = JSON.stringify(entry, null, 2);
      await writeFile(filePath, data, 'utf8');

      // Update index
      this.diskCacheIndex.set(entry.key, {
        file: fileName,
        size: entry.size,
        created: entry.created,
        accessed: entry.accessed
      });

      this.metrics.disk.size += entry.size;
      this.metrics.disk.entries++;

      // Check disk size limits
      await this.enforceDiskSizeLimit();

    } catch (error) {
      throw new Error(`Failed to write cache entry to disk: ${error.message}`);
    }
  }

  private async deleteFromDisk(key: string): Promise<void> {
    const indexEntry = this.diskCacheIndex.get(key);
    if (!indexEntry) return;

    const filePath = path.join(this.config.diskCachePath, indexEntry.file);

    try {
      await unlink(filePath);
      this.diskCacheIndex.delete(key);
      this.metrics.disk.size -= indexEntry.size;
      this.metrics.disk.entries--;
    } catch (error) {
      // File might already be deleted, just remove from index
      this.diskCacheIndex.delete(key);
    }
  }

  private async clearDiskCache(): Promise<void> {
    try {
      const files = await readdir(this.config.diskCachePath);
      
      const deletePromises = files
        .filter(file => file.endsWith('.json'))
        .map(file => unlink(path.join(this.config.diskCachePath, file)));
      
      await Promise.allSettled(deletePromises);
      
      this.diskCacheIndex.clear();
      this.metrics.disk = { size: 0, entries: 0, hits: 0, misses: 0 };
      
    } catch (error) {
      // Directory might not exist or be empty
    }
  }

  private async enforceDiskSizeLimit(): Promise<void> {
    if (!this.config.maxDiskSize || this.metrics.disk.size <= this.config.maxDiskSize) {
      return;
    }

    // Sort by access time (oldest first)
    const entries = Array.from(this.diskCacheIndex.entries())
      .sort(([, a], [, b]) => a.accessed.getTime() - b.accessed.getTime());

    // Remove oldest entries until under limit
    for (const [key] of entries) {
      if (this.metrics.disk.size <= this.config.maxDiskSize * 0.8) { // 80% of limit
        break;
      }
      await this.deleteFromDisk(key);
    }
  }

  private async loadDiskCacheIndex(): Promise<void> {
    try {
      const files = await readdir(this.config.diskCachePath);
      let totalSize = 0;
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(this.config.diskCachePath, file);
        
        try {
          const stats = await stat(filePath);
          const data = await readFile(filePath, 'utf8');
          const entry: CacheEntry = JSON.parse(data);
          
          // Check if entry is expired
          if (this.isExpired(entry)) {
            await unlink(filePath);
            continue;
          }
          
          this.diskCacheIndex.set(entry.key, {
            file,
            size: entry.size,
            created: entry.created,
            accessed: entry.accessed
          });
          
          totalSize += entry.size;
          
        } catch (error) {
          // Remove corrupted files
          try {
            await unlink(filePath);
          } catch {
            // Ignore unlink errors
          }
        }
      }
      
      this.metrics.disk.size = totalSize;
      this.metrics.disk.entries = this.diskCacheIndex.size;
      
    } catch (error) {
      // Cache directory doesn't exist or is inaccessible
    }
  }

  // ========================
  // Advanced Operations
  // ========================

  async getByTags(tags: string[]): Promise<Array<{ key: string; value: any }>> {
    const results: Array<{ key: string; value: any }> = [];
    
    for (const [key, entry] of this.memoryCache) {
      if (entry.tags && tags.some(tag => entry.tags!.includes(tag))) {
        if (!this.isExpired(entry)) {
          results.push({ key, value: entry.value });
        }
      }
    }
    
    return results;
  }

  async deleteByTags(tags: string[]): Promise<number> {
    let deleted = 0;
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.memoryCache) {
      if (entry.tags && tags.some(tag => entry.tags!.includes(tag))) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      if (await this.delete(key)) {
        deleted++;
      }
    }
    
    return deleted;
  }

  async touch(key: string): Promise<boolean> {
    const entry = this.memoryCache.get(key);
    if (entry && !this.isExpired(entry)) {
      entry.accessed = new Date();
      this.updateAccessOrder(key);
      return true;
    }
    return false;
  }

  async extend(key: string, additionalTTL: number): Promise<boolean> {
    const entry = this.memoryCache.get(key);
    if (entry && !this.isExpired(entry)) {
      entry.ttl += additionalTTL;
      return true;
    }
    return false;
  }

  // ========================
  // Cleanup and Maintenance
  // ========================

  private startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }

  private stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  private async performCleanup(): Promise<void> {
    if (this.isShuttingDown) return;

    let cleaned = 0;

    // Clean expired entries from memory
    for (const [key, entry] of this.memoryCache) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
        this.metrics.memory.size -= entry.size;
        this.metrics.memory.entries--;
        this.removeFromAccessOrder(key);
        cleaned++;
      }
    }

    // Clean expired entries from disk
    if (this.config.enableDiskCache) {
      const expiredDiskKeys: string[] = [];
      
      for (const [key, indexEntry] of this.diskCacheIndex) {
        const ageMs = Date.now() - indexEntry.created.getTime();
        if (ageMs > this.config.defaultTTL) {
          expiredDiskKeys.push(key);
        }
      }
      
      for (const key of expiredDiskKeys) {
        await this.deleteFromDisk(key);
        cleaned++;
      }
    }

    this.metrics.lastCleanup = new Date();

    if (cleaned > 0) {
      this.emit('cache:cleanup', { entriesRemoved: cleaned });
    }
  }

  async cleanup(): Promise<void> {
    await this.performCleanup();
  }

  private async flushToDisk(): Promise<void> {
    if (!this.config.enableDiskCache) return;

    const flushPromises: Promise<void>[] = [];
    
    for (const entry of this.memoryCache.values()) {
      if (!this.diskCacheIndex.has(entry.key) && entry.size > (this.config.compressionThreshold || 0)) {
        flushPromises.push(this.setOnDisk(entry));
      }
    }

    await Promise.allSettled(flushPromises);
  }

  // ========================
  // Warmup Strategies
  // ========================

  private async performWarmup(): Promise<void> {
    if (!this.config.warmupStrategies || this.config.warmupStrategies.length === 0) {
      return;
    }

    for (const strategy of this.config.warmupStrategies) {
      try {
        await this.executeWarmupStrategy(strategy);
      } catch (error) {
        this.emit('cache:warmup-error', { strategy, error });
      }
    }
  }

  private async executeWarmupStrategy(strategy: string): Promise<void> {
    switch (strategy) {
      case 'recent':
        await this.warmupRecentEntries();
        break;
      case 'frequent':
        await this.warmupFrequentEntries();
        break;
      default:
        // Custom strategies can be implemented here
        break;
    }
  }

  private async warmupRecentEntries(): Promise<void> {
    if (!this.config.enableDiskCache) return;

    const recentEntries = Array.from(this.diskCacheIndex.entries())
      .sort(([, a], [, b]) => b.accessed.getTime() - a.accessed.getTime())
      .slice(0, 50); // Warm up top 50 recent entries

    for (const [key] of recentEntries) {
      try {
        await this.get(key); // This will load into memory cache
      } catch (error) {
        // Ignore individual entry errors
      }
    }
  }

  private async warmupFrequentEntries(): Promise<void> {
    // This would require storing hit counts in the disk cache index
    // For now, just warm up recently accessed entries
    await this.warmupRecentEntries();
  }

  // ========================
  // Metrics and Health
  // ========================

  private recordHit(location: 'memory' | 'disk'): void {
    if (!this.config.enableMetrics) return;

    if (location === 'memory') {
      this.metrics.memory.hits++;
    } else {
      this.metrics.disk.hits++;
    }
    
    this.metrics.total.hits++;
    this.updateHitRatios();
  }

  private recordMiss(): void {
    if (!this.config.enableMetrics) return;

    this.metrics.memory.misses++;
    this.metrics.disk.misses++;
    this.metrics.total.misses++;
    this.updateHitRatios();
  }

  private updateHitRatios(): void {
    // Memory hit ratio
    const memoryTotal = this.metrics.memory.hits + this.metrics.memory.misses;
    this.metrics.memory.hitRatio = memoryTotal > 0 ? this.metrics.memory.hits / memoryTotal : 0;

    // Total hit ratio
    const totalRequests = this.metrics.total.hits + this.metrics.total.misses;
    this.metrics.total.hitRatio = totalRequests > 0 ? this.metrics.total.hits / totalRequests : 0;
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  async getHealth(): Promise<CacheHealth> {
    const issues: string[] = [];
    
    // Check memory usage
    const memoryUsagePercent = (this.metrics.memory.size / this.config.maxMemorySize) * 100;
    
    if (memoryUsagePercent > 90) {
      issues.push('Memory cache usage above 90%');
    }
    
    // Check disk usage if enabled
    let diskUsagePercent = 0;
    if (this.config.enableDiskCache && this.config.maxDiskSize) {
      diskUsagePercent = (this.metrics.disk.size / this.config.maxDiskSize) * 100;
      
      if (diskUsagePercent > 90) {
        issues.push('Disk cache usage above 90%');
      }
    }
    
    // Check hit ratio
    if (this.metrics.total.hitRatio < 0.5 && this.metrics.total.hits + this.metrics.total.misses > 100) {
      issues.push('Low cache hit ratio (< 50%)');
    }
    
    return {
      healthy: issues.length === 0,
      memoryUsage: memoryUsagePercent,
      diskUsage: this.config.enableDiskCache ? diskUsagePercent : undefined,
      issues
    };
  }

  // ========================
  // Utility Methods
  // ========================

  private isExpired(entry: CacheEntry): boolean {
    const age = Date.now() - entry.created.getTime();
    return age > entry.ttl;
  }

  private calculateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate (2 bytes per character)
    } catch {
      return 1024; // Default size if can't calculate
    }
  }

  private updateAccessOrder(key: string): void {
    // Remove from current position
    this.removeFromAccessOrder(key);
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private sanitizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private async ensureCacheDirectory(): Promise<void> {
    try {
      await mkdir(this.config.diskCachePath, { recursive: true });
    } catch (error) {
      if ((error as any).code !== 'EEXIST') {
        throw new Error(`Failed to create cache directory: ${error.message}`);
      }
    }
  }

  // ========================
  // Public API Extensions
  // ========================

  getSize(): number {
    return this.metrics.memory.size + this.metrics.disk.size;
  }

  getEntryCount(): number {
    return this.metrics.memory.entries + this.metrics.disk.entries;
  }

  getHitRatio(): number {
    return this.metrics.total.hitRatio;
  }

  async optimize(): Promise<void> {
    await this.performCleanup();
    await this.flushToDisk();
    
    if (this.config.enableDiskCache) {
      await this.enforceDiskSizeLimit();
    }
  }
}

export default CacheManager;