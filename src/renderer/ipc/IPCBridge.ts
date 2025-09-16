/**
 * IPC Bridge with Caching and Optimistic Updates
 * Provides high-level interface with caching, optimistic updates, and offline support
 */

import { EventEmitter } from 'events';
import type {
  KBEntry,
  KBEntryInput,
  KBEntryUpdate,
  SearchResult,
  SearchQuery,
  DatabaseMetrics
} from '../../types';
import { ipcClient, IPCClient, IPCResponse, IPCOptions } from './IPCClient';

// Cache configuration
interface CacheConfig {
  searchTTL: number;
  metricsTTL: number;
  entryTTL: number;
  maxSize: number;
}

// Cache entry
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

// Optimistic update types
type OptimisticUpdateType = 'create' | 'update' | 'delete' | 'rate';

interface OptimisticUpdate {
  id: string;
  type: OptimisticUpdateType;
  data: any;
  timestamp: number;
  rollback?: () => void;
}

// Bridge events
export interface BridgeEvents {
  'cache:hit': (key: string) => void;
  'cache:miss': (key: string) => void;
  'cache:invalidate': (key: string) => void;
  'optimistic:applied': (update: OptimisticUpdate) => void;
  'optimistic:confirmed': (update: OptimisticUpdate) => void;
  'optimistic:rollback': (update: OptimisticUpdate) => void;
  'offline:detected': () => void;
  'online:detected': () => void;
  'error': (error: Error) => void;
}

/**
 * IPC Bridge with advanced caching and optimistic updates
 */
export class IPCBridge extends EventEmitter {
  private client: IPCClient;
  private cache = new Map<string, CacheEntry<any>>();
  private optimisticUpdates = new Map<string, OptimisticUpdate>();
  private isOnline = true;
  private cacheConfig: CacheConfig = {
    searchTTL: 5 * 60 * 1000, // 5 minutes
    metricsTTL: 30 * 1000, // 30 seconds
    entryTTL: 10 * 60 * 1000, // 10 minutes
    maxSize: 1000
  };

  constructor(client?: IPCClient) {
    super();
    this.client = client || ipcClient;
    this.setupOnlineOfflineDetection();
    this.startCacheCleanup();
  }

  /**
   * Knowledge Base Operations with Optimistic Updates
   */
  
  async getKBEntries(query?: SearchQuery, options?: IPCOptions): Promise<SearchResult[]> {
    const cacheKey = this.generateCacheKey('kb-entries', query);
    
    // Check cache first
    const cached = this.getFromCache<SearchResult[]>(cacheKey, this.cacheConfig.searchTTL);
    if (cached) {
      this.emit('cache:hit', cacheKey);
      return cached;
    }

    this.emit('cache:miss', cacheKey);
    
    const response = await this.client.getKBEntries(query, options);
    
    if (response.success && response.data) {
      // Apply any pending optimistic updates
      const entries = this.applyOptimisticUpdates(response.data);
      this.setCache(cacheKey, entries, this.cacheConfig.searchTTL);
      return entries;
    }
    
    throw new Error(response.error?.message || 'Failed to get KB entries');
  }

  async addKBEntry(entry: KBEntryInput, options?: IPCOptions): Promise<string> {
    // Generate optimistic ID
    const optimisticId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticEntry: KBEntry = {
      ...entry,
      id: optimisticId,
      created_at: new Date(),
      updated_at: new Date(),
      usage_count: 0,
      success_count: 0,
      failure_count: 0,
      version: 1,
      created_by: entry.created_by || 'current-user'
    };

    // Apply optimistic update
    const optimisticUpdate: OptimisticUpdate = {
      id: optimisticId,
      type: 'create',
      data: optimisticEntry,
      timestamp: Date.now(),
      rollback: () => {
        // Remove optimistic entry from any cached results
        this.invalidateSearchCache();
      }
    };

    this.optimisticUpdates.set(optimisticId, optimisticUpdate);
    this.emit('optimistic:applied', optimisticUpdate);
    
    // Invalidate search cache to force refresh with optimistic data
    this.invalidateSearchCache();

    try {
      const response = await this.client.addKBEntry(entry, options);
      
      if (response.success && response.data) {
        // Remove optimistic update and replace with real ID
        this.optimisticUpdates.delete(optimisticId);
        this.emit('optimistic:confirmed', optimisticUpdate);
        this.invalidateCache(`entry-${response.data}`);
        return response.data;
      }
      
      throw new Error(response.error?.message || 'Failed to add KB entry');
      
    } catch (error) {
      // Rollback optimistic update
      this.optimisticUpdates.delete(optimisticId);
      this.emit('optimistic:rollback', optimisticUpdate);
      this.invalidateSearchCache();
      throw error;
    }
  }

  async updateKBEntry(id: string, updates: KBEntryUpdate, options?: IPCOptions): Promise<void> {
    // Create optimistic update
    const optimisticUpdate: OptimisticUpdate = {
      id,
      type: 'update',
      data: updates,
      timestamp: Date.now(),
      rollback: () => {
        this.invalidateCache(`entry-${id}`);
      }
    };

    this.optimisticUpdates.set(`update-${id}`, optimisticUpdate);
    this.emit('optimistic:applied', optimisticUpdate);
    
    // Invalidate related cache entries
    this.invalidateCache(`entry-${id}`);

    try {
      const response = await this.client.updateKBEntry(id, updates, options);
      
      if (response.success) {
        this.optimisticUpdates.delete(`update-${id}`);
        this.emit('optimistic:confirmed', optimisticUpdate);
        return;
      }
      
      throw new Error(response.error?.message || 'Failed to update KB entry');
      
    } catch (error) {
      // Rollback optimistic update
      this.optimisticUpdates.delete(`update-${id}`);
      this.emit('optimistic:rollback', optimisticUpdate);
      this.invalidateCache(`entry-${id}`);
      throw error;
    }
  }

  async deleteKBEntry(id: string, options?: IPCOptions): Promise<void> {
    // Create optimistic delete
    const optimisticUpdate: OptimisticUpdate = {
      id,
      type: 'delete',
      data: { deleted: true },
      timestamp: Date.now(),
      rollback: () => {
        this.invalidateCache(`entry-${id}`);
        this.invalidateSearchCache();
      }
    };

    this.optimisticUpdates.set(`delete-${id}`, optimisticUpdate);
    this.emit('optimistic:applied', optimisticUpdate);
    
    // Invalidate caches
    this.invalidateCache(`entry-${id}`);
    this.invalidateSearchCache();

    try {
      const response = await this.client.deleteKBEntry(id, options);
      
      if (response.success) {
        this.optimisticUpdates.delete(`delete-${id}`);
        this.emit('optimistic:confirmed', optimisticUpdate);
        return;
      }
      
      throw new Error(response.error?.message || 'Failed to delete KB entry');
      
    } catch (error) {
      // Rollback optimistic update
      this.optimisticUpdates.delete(`delete-${id}`);
      this.emit('optimistic:rollback', optimisticUpdate);
      this.invalidateCache(`entry-${id}`);
      this.invalidateSearchCache();
      throw error;
    }
  }

  async getEntry(id: string, options?: IPCOptions): Promise<KBEntry | null> {
    const cacheKey = `entry-${id}`;
    
    // Check cache first
    const cached = this.getFromCache<KBEntry>(cacheKey, this.cacheConfig.entryTTL);
    if (cached) {
      this.emit('cache:hit', cacheKey);
      return this.applyOptimisticUpdatesToEntry(cached);
    }

    this.emit('cache:miss', cacheKey);
    
    const response = await this.client.getEntry(id, options);
    
    if (response.success) {
      if (response.data) {
        const entry = this.applyOptimisticUpdatesToEntry(response.data);
        this.setCache(cacheKey, entry, this.cacheConfig.entryTTL);
        return entry;
      }
      return null;
    }
    
    throw new Error(response.error?.message || 'Failed to get KB entry');
  }

  /**
   * Search Operations with Smart Caching
   */
  
  async searchLocal(query: string, searchOptions?: SearchQuery, options?: IPCOptions): Promise<SearchResult[]> {
    const cacheKey = this.generateCacheKey('search-local', { query, ...searchOptions });
    
    // Check cache first
    const cached = this.getFromCache<SearchResult[]>(cacheKey, this.cacheConfig.searchTTL);
    if (cached) {
      this.emit('cache:hit', cacheKey);
      return this.applyOptimisticUpdates(cached);
    }

    this.emit('cache:miss', cacheKey);
    
    const response = await this.client.searchLocal(query, searchOptions, options);
    
    if (response.success && response.data) {
      const results = this.applyOptimisticUpdates(response.data);
      this.setCache(cacheKey, results, this.cacheConfig.searchTTL);
      return results;
    }
    
    throw new Error(response.error?.message || 'Failed to search locally');
  }

  async searchWithAI(query: string, searchOptions?: SearchQuery, options?: IPCOptions): Promise<SearchResult[]> {
    const cacheKey = this.generateCacheKey('search-ai', { query, ...searchOptions });
    
    // Check cache first
    const cached = this.getFromCache<SearchResult[]>(cacheKey, this.cacheConfig.searchTTL);
    if (cached) {
      this.emit('cache:hit', cacheKey);
      return this.applyOptimisticUpdates(cached);
    }

    this.emit('cache:miss', cacheKey);
    
    const response = await this.client.searchWithAI(query, searchOptions, options);
    
    if (response.success && response.data) {
      const results = this.applyOptimisticUpdates(response.data);
      this.setCache(cacheKey, results, this.cacheConfig.searchTTL);
      return results;
    }
    
    throw new Error(response.error?.message || 'Failed to search with AI');
  }

  /**
   * Rating and Feedback with Optimistic Updates
   */
  
  async rateEntry(id: string, successful: boolean, comment?: string, options?: IPCOptions): Promise<void> {
    const optimisticUpdate: OptimisticUpdate = {
      id: `rate-${id}`,
      type: 'rate',
      data: { successful, comment },
      timestamp: Date.now(),
      rollback: () => {
        this.invalidateCache(`entry-${id}`);
      }
    };

    this.optimisticUpdates.set(`rate-${id}`, optimisticUpdate);
    this.emit('optimistic:applied', optimisticUpdate);
    
    // Invalidate entry cache to refresh with optimistic rating
    this.invalidateCache(`entry-${id}`);

    try {
      const response = await this.client.rateEntry(id, successful, comment, options);
      
      if (response.success) {
        this.optimisticUpdates.delete(`rate-${id}`);
        this.emit('optimistic:confirmed', optimisticUpdate);
        return;
      }
      
      throw new Error(response.error?.message || 'Failed to rate entry');
      
    } catch (error) {
      this.optimisticUpdates.delete(`rate-${id}`);
      this.emit('optimistic:rollback', optimisticUpdate);
      this.invalidateCache(`entry-${id}`);
      throw error;
    }
  }

  /**
   * System Operations with Caching
   */
  
  async getMetrics(options?: IPCOptions): Promise<DatabaseMetrics> {
    const cacheKey = 'metrics';
    
    // Check cache first (shorter TTL for metrics)
    const cached = this.getFromCache<DatabaseMetrics>(cacheKey, this.cacheConfig.metricsTTL);
    if (cached) {
      this.emit('cache:hit', cacheKey);
      return cached;
    }

    this.emit('cache:miss', cacheKey);
    
    const response = await this.client.getMetrics(options);
    
    if (response.success && response.data) {
      this.setCache(cacheKey, response.data, this.cacheConfig.metricsTTL);
      return response.data;
    }
    
    throw new Error(response.error?.message || 'Failed to get metrics');
  }

  /**
   * Cache Management
   */
  
  private generateCacheKey(prefix: string, data?: any): string {
    if (!data) return prefix;
    return `${prefix}:${JSON.stringify(data)}`;
  }

  private getFromCache<T>(key: string, ttl: number): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    // Cleanup if cache is getting too large
    if (this.cache.size >= this.cacheConfig.maxSize) {
      this.cleanupOldestEntries();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      key
    });
  }

  private invalidateCache(keyPattern: string): void {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => 
      key.includes(keyPattern) || key.startsWith(keyPattern)
    );
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.emit('cache:invalidate', key);
    });
  }

  private invalidateSearchCache(): void {
    this.invalidateCache('search');
    this.invalidateCache('kb-entries');
  }

  private cleanupOldestEntries(): void {
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);
    
    // Remove oldest 10% of entries
    const toRemove = Math.floor(entries.length * 0.1);
    
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  private startCacheCleanup(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Optimistic Updates Management
   */
  
  private applyOptimisticUpdates(results: SearchResult[]): SearchResult[] {
    // Apply any pending optimistic updates to search results
    return results.map(result => ({
      ...result,
      entry: this.applyOptimisticUpdatesToEntry(result.entry)
    })).filter(result => {
      // Filter out deleted entries
      const deleteUpdate = this.optimisticUpdates.get(`delete-${result.entry.id}`);
      return !deleteUpdate;
    });
  }

  private applyOptimisticUpdatesToEntry(entry: KBEntry): KBEntry {
    let modifiedEntry = { ...entry };
    
    // Apply update optimistic changes
    const updateKey = `update-${entry.id}`;
    const update = this.optimisticUpdates.get(updateKey);
    if (update) {
      modifiedEntry = { ...modifiedEntry, ...update.data, updated_at: new Date() };
    }
    
    // Apply rating optimistic changes
    const rateKey = `rate-${entry.id}`;
    const rating = this.optimisticUpdates.get(rateKey);
    if (rating) {
      if (rating.data.successful) {
        modifiedEntry.success_count = (modifiedEntry.success_count || 0) + 1;
      } else {
        modifiedEntry.failure_count = (modifiedEntry.failure_count || 0) + 1;
      }
      modifiedEntry.usage_count = (modifiedEntry.usage_count || 0) + 1;
    }
    
    return modifiedEntry;
  }

  /**
   * Online/Offline Detection
   */
  
  private setupOnlineOfflineDetection(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.emit('online:detected');
      });
      
      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.emit('offline:detected');
      });
    }
  }

  /**
   * Public API
   */
  
  isOffline(): boolean {
    return !this.isOnline;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.values());
    
    return {
      size: this.cache.size,
      maxSize: this.cacheConfig.maxSize,
      expired: entries.filter(entry => now - entry.timestamp > entry.ttl).length,
      hitRatio: 0 // Would need to track hits/misses for accurate ratio
    };
  }

  getOptimisticUpdates(): OptimisticUpdate[] {
    return Array.from(this.optimisticUpdates.values());
  }

  // Event listener type safety
  on<K extends keyof BridgeEvents>(event: K, listener: BridgeEvents[K]): this {
    return super.on(event, listener);
  }

  emit<K extends keyof BridgeEvents>(event: K, ...args: Parameters<BridgeEvents[K]>): boolean {
    return super.emit(event, ...args);
  }
}

// Export singleton instance
export const ipcBridge = new IPCBridge();
export default ipcBridge;