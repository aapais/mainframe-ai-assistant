/**
 * Frontend Cache Manager Hook
 * 
 * Provides client-side caching with:
 * - Browser storage integration (localStorage, sessionStorage, IndexedDB)
 * - Automatic cache invalidation and TTL management
 * - Memory-first caching with persistent fallback
 * - Cache performance monitoring
 * - Predictive prefetching
 * 
 * @author Frontend Cache Team
 * @version 1.0.0
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { CacheStats, CacheConfiguration } from '../services/cache/CacheTypes';

// ========================
// Types & Interfaces
// ========================

export interface CacheEntry<T> {
  key: string;
  value: T;
  ttl: number;
  created: number;
  accessed: number;
  accessCount: number;
  size: number;
  source: 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB';
  metadata?: Record<string, any>;
}

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  cacheSize: number;
  memoryUsage: number;
  averageAccessTime: number;
  evictionCount: number;
  errorCount: number;
}

export interface CacheOptions {
  ttl?: number;
  priority?: 'low' | 'normal' | 'high';
  storage?: 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB' | 'auto';
  compress?: boolean;
  encrypt?: boolean;
  tags?: string[];
}

export interface PrefetchOptions {
  keys: string[];
  priority: 'low' | 'normal' | 'high';
  batchSize?: number;
  concurrency?: number;
}

export interface UseCacheManagerOptions {
  maxMemorySize?: number;
  defaultTTL?: number;
  enableCompression?: boolean;
  enableEncryption?: boolean;
  enableMetrics?: boolean;
  cleanupInterval?: number;
  storageQuota?: number;
  fallbackToStorage?: boolean;
}

export interface UseCacheManagerReturn {
  // Core cache operations
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T, options?: CacheOptions) => Promise<void>;
  has: (key: string) => Promise<boolean>;
  delete: (key: string) => Promise<boolean>;
  clear: (pattern?: string) => Promise<void>;
  
  // Batch operations
  getMany: <T>(keys: string[]) => Promise<Array<T | null>>;
  setMany: <T>(entries: Array<{ key: string; value: T; options?: CacheOptions }>) => Promise<void>;
  deleteMany: (keys: string[]) => Promise<number>;
  
  // Cache management
  evict: (strategy?: 'lru' | 'lfu' | 'ttl' | 'size') => Promise<number>;
  optimize: () => Promise<void>;
  prefetch: (options: PrefetchOptions) => Promise<void>;
  warm: (entries: Array<{ key: string; loader: () => Promise<any> }>) => Promise<void>;
  
  // Monitoring
  getMetrics: () => CacheMetrics;
  getStats: () => CacheStats;
  getStorageInfo: () => Promise<{ quota: number; usage: number; available: number }>;
  
  // State
  isLoading: boolean;
  error: string | null;
  metrics: CacheMetrics;
  
  // Cache status
  isOnline: boolean;
  storageSupported: boolean;
}

// ========================
// Constants
// ========================

const DEFAULT_OPTIONS: Required<UseCacheManagerOptions> = {
  maxMemorySize: 50 * 1024 * 1024, // 50MB
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  enableCompression: true,
  enableEncryption: false,
  enableMetrics: true,
  cleanupInterval: 60 * 1000, // 1 minute
  storageQuota: 100 * 1024 * 1024, // 100MB
  fallbackToStorage: true
};

const STORAGE_KEYS = {
  CACHE_DATA: 'cache_data',
  CACHE_INDEX: 'cache_index',
  CACHE_METRICS: 'cache_metrics'
};

// ========================
// Utility Functions
// ========================

const estimateSize = (value: any): number => {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 1024; // Default fallback
  }
};

const compress = async (data: string): Promise<string> => {
  if (typeof CompressionStream !== 'undefined') {
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    
    writer.write(new TextEncoder().encode(data));
    writer.close();
    
    const chunks: Uint8Array[] = [];
    let done = false;
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) chunks.push(value);
    }
    
    const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      compressed.set(chunk, offset);
      offset += chunk.length;
    }
    
    return btoa(String.fromCharCode(...compressed));
  }
  return data; // Fallback to uncompressed
};

const decompress = async (compressedData: string): Promise<string> => {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const compressed = Uint8Array.from(atob(compressedData), c => c.charCodeAt(0));
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      writer.write(compressed);
      writer.close();
      
      const chunks: Uint8Array[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }
      
      const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        decompressed.set(chunk, offset);
        offset += chunk.length;
      }
      
      return new TextDecoder().decode(decompressed);
    } catch {
      return compressedData; // Fallback if decompression fails
    }
  }
  return compressedData;
};

const checkStorageSupport = (): { localStorage: boolean; sessionStorage: boolean; indexedDB: boolean } => {
  return {
    localStorage: typeof Storage !== 'undefined' && !!window.localStorage,
    sessionStorage: typeof Storage !== 'undefined' && !!window.sessionStorage,
    indexedDB: typeof indexedDB !== 'undefined'
  };
};

const getStorageQuota = async (): Promise<{ quota: number; usage: number; available: number }> => {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota || 0;
      const usage = estimate.usage || 0;
      return {
        quota,
        usage,
        available: quota - usage
      };
    } catch {
      return { quota: 0, usage: 0, available: 0 };
    }
  }
  return { quota: 0, usage: 0, available: 0 };
};

// ========================
// Hook Implementation
// ========================

export const useCacheManager = (options: UseCacheManagerOptions = {}): UseCacheManagerReturn => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Refs for performance
  const memoryCache = useRef<Map<string, CacheEntry<any>>>(new Map());
  const metricsRef = useRef<CacheMetrics>({
    hitRate: 0,
    missRate: 0,
    totalRequests: 0,
    cacheSize: 0,
    memoryUsage: 0,
    averageAccessTime: 0,
    evictionCount: 0,
    errorCount: 0
  });
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accessTimesRef = useRef<number[]>([]);
  
  // Storage support detection
  const storageSupported = useMemo(() => {
    const support = checkStorageSupport();
    return support.localStorage || support.sessionStorage || support.indexedDB;
  }, []);
  
  // Metrics state
  const [metrics, setMetrics] = useState<CacheMetrics>(metricsRef.current);
  
  // Update metrics helper
  const updateMetrics = useCallback((updates: Partial<CacheMetrics>) => {
    metricsRef.current = { ...metricsRef.current, ...updates };
    setMetrics({ ...metricsRef.current });
  }, []);
  
  // Record access time
  const recordAccessTime = useCallback((startTime: number) => {
    const accessTime = performance.now() - startTime;
    accessTimesRef.current.push(accessTime);
    
    // Keep only last 100 access times
    if (accessTimesRef.current.length > 100) {
      accessTimesRef.current = accessTimesRef.current.slice(-100);
    }
    
    const averageAccessTime = accessTimesRef.current.reduce((sum, time) => sum + time, 0) / accessTimesRef.current.length;
    updateMetrics({ averageAccessTime });
  }, [updateMetrics]);
  
  // Get from storage
  const getFromStorage = useCallback(async <T>(key: string): Promise<CacheEntry<T> | null> => {
    try {
      // Try localStorage first
      const localItem = localStorage.getItem(`${STORAGE_KEYS.CACHE_DATA}:${key}`);
      if (localItem) {
        const entry = JSON.parse(localItem) as CacheEntry<T>;
        if (entry.ttl === 0 || Date.now() - entry.created < entry.ttl) {
          return entry;
        } else {
          localStorage.removeItem(`${STORAGE_KEYS.CACHE_DATA}:${key}`);
        }
      }
      
      // Try sessionStorage
      const sessionItem = sessionStorage.getItem(`${STORAGE_KEYS.CACHE_DATA}:${key}`);
      if (sessionItem) {
        const entry = JSON.parse(sessionItem) as CacheEntry<T>;
        if (entry.ttl === 0 || Date.now() - entry.created < entry.ttl) {
          return entry;
        } else {
          sessionStorage.removeItem(`${STORAGE_KEYS.CACHE_DATA}:${key}`);
        }
      }
      
      return null;
    } catch (err) {
      console.warn('Cache storage read error:', err);
      return null;
    }
  }, []);
  
  // Set to storage
  const setToStorage = useCallback(async <T>(entry: CacheEntry<T>, storage: 'localStorage' | 'sessionStorage' | 'auto' = 'auto'): Promise<void> => {
    try {
      const serialized = JSON.stringify(entry);
      const compressed = config.enableCompression ? await compress(serialized) : serialized;
      
      if (storage === 'auto') {
        // Try localStorage first, fallback to sessionStorage
        try {
          localStorage.setItem(`${STORAGE_KEYS.CACHE_DATA}:${entry.key}`, compressed);
          entry.source = 'localStorage';
        } catch {
          sessionStorage.setItem(`${STORAGE_KEYS.CACHE_DATA}:${entry.key}`, compressed);
          entry.source = 'sessionStorage';
        }
      } else {
        const targetStorage = storage === 'localStorage' ? localStorage : sessionStorage;
        targetStorage.setItem(`${STORAGE_KEYS.CACHE_DATA}:${entry.key}`, compressed);
        entry.source = storage;
      }
    } catch (err) {
      console.warn('Cache storage write error:', err);
    }
  }, [config.enableCompression]);
  
  // Core cache operations
  const get = useCallback(async <T>(key: string): Promise<T | null> => {
    const startTime = performance.now();
    setError(null);
    
    try {
      metricsRef.current.totalRequests++;
      
      // Check memory cache first
      const memoryEntry = memoryCache.current.get(key);
      if (memoryEntry) {
        if (memoryEntry.ttl === 0 || Date.now() - memoryEntry.created < memoryEntry.ttl) {
          memoryEntry.accessed = Date.now();
          memoryEntry.accessCount++;
          
          const hitRate = metricsRef.current.totalRequests > 0 
            ? (metricsRef.current.totalRequests - metricsRef.current.errorCount) / metricsRef.current.totalRequests 
            : 0;
          updateMetrics({ hitRate });
          recordAccessTime(startTime);
          
          return memoryEntry.value as T;
        } else {
          memoryCache.current.delete(key);
        }
      }
      
      // Check persistent storage if enabled
      if (config.fallbackToStorage && storageSupported) {
        const storageEntry = await getFromStorage<T>(key);
        if (storageEntry) {
          // Promote to memory cache
          memoryCache.current.set(key, {
            ...storageEntry,
            accessed: Date.now(),
            accessCount: storageEntry.accessCount + 1,
            source: 'memory'
          });
          
          const hitRate = metricsRef.current.totalRequests > 0 
            ? (metricsRef.current.totalRequests - metricsRef.current.errorCount) / metricsRef.current.totalRequests 
            : 0;
          updateMetrics({ hitRate });
          recordAccessTime(startTime);
          
          return storageEntry.value as T;
        }
      }
      
      // Cache miss
      const missRate = metricsRef.current.totalRequests > 0 
        ? metricsRef.current.errorCount / metricsRef.current.totalRequests 
        : 0;
      updateMetrics({ missRate });
      recordAccessTime(startTime);
      
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Cache get operation failed';
      setError(errorMessage);
      metricsRef.current.errorCount++;
      recordAccessTime(startTime);
      return null;
    }
  }, [config.fallbackToStorage, storageSupported, getFromStorage, updateMetrics, recordAccessTime]);
  
  const set = useCallback(async <T>(key: string, value: T, options: CacheOptions = {}): Promise<void> => {
    const startTime = performance.now();
    setError(null);
    
    try {
      const now = Date.now();
      const ttl = options.ttl || config.defaultTTL;
      const size = estimateSize(value);
      
      const entry: CacheEntry<T> = {
        key,
        value,
        ttl,
        created: now,
        accessed: now,
        accessCount: 1,
        size,
        source: 'memory',
        metadata: {
          priority: options.priority || 'normal',
          compressed: config.enableCompression,
          encrypted: config.enableEncryption,
          tags: options.tags || []
        }
      };
      
      // Check memory capacity
      const currentMemoryUsage = Array.from(memoryCache.current.values())
        .reduce((sum, entry) => sum + entry.size, 0);
      
      if (currentMemoryUsage + size > config.maxMemorySize) {
        await evictLRU();
      }
      
      // Set in memory cache
      memoryCache.current.set(key, entry);
      
      // Persist to storage if enabled
      if (config.fallbackToStorage && storageSupported) {
        await setToStorage(entry, options.storage || 'auto');
      }
      
      // Update metrics
      const cacheSize = memoryCache.current.size;
      const memoryUsage = Array.from(memoryCache.current.values())
        .reduce((sum, entry) => sum + entry.size, 0);
      
      updateMetrics({ cacheSize, memoryUsage });
      recordAccessTime(startTime);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Cache set operation failed';
      setError(errorMessage);
      metricsRef.current.errorCount++;
      recordAccessTime(startTime);
    }
  }, [config.defaultTTL, config.maxMemorySize, config.fallbackToStorage, config.enableCompression, config.enableEncryption, storageSupported, setToStorage, updateMetrics, recordAccessTime]);
  
  // LRU eviction
  const evictLRU = useCallback(async (): Promise<void> => {
    const entries = Array.from(memoryCache.current.entries());
    if (entries.length === 0) return;
    
    // Sort by last accessed time (oldest first)
    entries.sort((a, b) => a[1].accessed - b[1].accessed);
    
    // Remove oldest 10% of entries
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1));
    
    for (let i = 0; i < toRemove; i++) {
      const [key] = entries[i];
      memoryCache.current.delete(key);
      metricsRef.current.evictionCount++;
    }
  }, []);
  
  const has = useCallback(async (key: string): Promise<boolean> => {
    const value = await get(key);
    return value !== null;
  }, [get]);
  
  const deleteItem = useCallback(async (key: string): Promise<boolean> => {
    try {
      let found = false;
      
      // Remove from memory
      if (memoryCache.current.has(key)) {
        memoryCache.current.delete(key);
        found = true;
      }
      
      // Remove from storage
      if (storageSupported) {
        try {
          localStorage.removeItem(`${STORAGE_KEYS.CACHE_DATA}:${key}`);
          sessionStorage.removeItem(`${STORAGE_KEYS.CACHE_DATA}:${key}`);
        } catch {
          // Ignore storage errors
        }
      }
      
      if (found) {
        const cacheSize = memoryCache.current.size;
        const memoryUsage = Array.from(memoryCache.current.values())
          .reduce((sum, entry) => sum + entry.size, 0);
        updateMetrics({ cacheSize, memoryUsage });
      }
      
      return found;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Cache delete operation failed';
      setError(errorMessage);
      return false;
    }
  }, [storageSupported, updateMetrics]);
  
  const clear = useCallback(async (pattern?: string): Promise<void> => {
    try {
      if (pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        const keysToDelete = Array.from(memoryCache.current.keys()).filter(key => regex.test(key));
        
        for (const key of keysToDelete) {
          await deleteItem(key);
        }
      } else {
        memoryCache.current.clear();
        
        if (storageSupported) {
          try {
            // Clear cache-related items from storage
            const keysToRemove: string[] = [];
            
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith(STORAGE_KEYS.CACHE_DATA)) {
                keysToRemove.push(key);
              }
            }
            
            keysToRemove.forEach(key => localStorage.removeItem(key));
            
            // Clear session storage
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              if (key && key.startsWith(STORAGE_KEYS.CACHE_DATA)) {
                keysToRemove.push(key);
              }
            }
            
            keysToRemove.forEach(key => sessionStorage.removeItem(key));
          } catch {
            // Ignore storage errors
          }
        }
        
        updateMetrics({ cacheSize: 0, memoryUsage: 0 });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Cache clear operation failed';
      setError(errorMessage);
    }
  }, [deleteItem, storageSupported, updateMetrics]);
  
  // Batch operations
  const getMany = useCallback(async <T>(keys: string[]): Promise<Array<T | null>> => {
    const promises = keys.map(key => get<T>(key));
    return Promise.all(promises);
  }, [get]);
  
  const setMany = useCallback(async <T>(entries: Array<{ key: string; value: T; options?: CacheOptions }>): Promise<void> => {
    const promises = entries.map(({ key, value, options }) => set(key, value, options));
    await Promise.all(promises);
  }, [set]);
  
  const deleteMany = useCallback(async (keys: string[]): Promise<number> => {
    const results = await Promise.all(keys.map(key => deleteItem(key)));
    return results.filter(result => result).length;
  }, [deleteItem]);
  
  // Cache management
  const evict = useCallback(async (strategy: 'lru' | 'lfu' | 'ttl' | 'size' = 'lru'): Promise<number> => {
    const entries = Array.from(memoryCache.current.entries());
    if (entries.length === 0) return 0;
    
    let toEvict: string[] = [];
    
    switch (strategy) {
      case 'lru':
        entries.sort((a, b) => a[1].accessed - b[1].accessed);
        toEvict = entries.slice(0, Math.floor(entries.length * 0.1)).map(([key]) => key);
        break;
        
      case 'lfu':
        entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
        toEvict = entries.slice(0, Math.floor(entries.length * 0.1)).map(([key]) => key);
        break;
        
      case 'ttl':
        const now = Date.now();
        entries.forEach(([key, entry]) => {
          if (entry.ttl > 0 && now - entry.created > entry.ttl) {
            toEvict.push(key);
          }
        });
        break;
        
      case 'size':
        entries.sort((a, b) => b[1].size - a[1].size);
        toEvict = entries.slice(0, Math.floor(entries.length * 0.1)).map(([key]) => key);
        break;
    }
    
    let evictedCount = 0;
    for (const key of toEvict) {
      const success = await deleteItem(key);
      if (success) evictedCount++;
    }
    
    metricsRef.current.evictionCount += evictedCount;
    return evictedCount;
  }, [deleteItem]);
  
  const optimize = useCallback(async (): Promise<void> => {
    // Remove expired entries
    await evict('ttl');
    
    // Compact memory if over threshold
    const memoryUsage = Array.from(memoryCache.current.values())
      .reduce((sum, entry) => sum + entry.size, 0);
    
    if (memoryUsage > config.maxMemorySize * 0.8) {
      await evict('lru');
    }
  }, [evict, config.maxMemorySize]);
  
  const prefetch = useCallback(async (options: PrefetchOptions): Promise<void> => {
    setIsLoading(true);
    
    try {
      const { keys, batchSize = 5, concurrency = 3 } = options;
      
      // Process keys in batches
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        
        // Process batch with concurrency limit
        const promises = batch.slice(0, concurrency).map(async (key) => {
          try {
            const exists = await has(key);
            if (!exists) {
              // In a real implementation, you'd fetch the data here
              console.log(`Prefetching key: ${key}`);
            }
          } catch (err) {
            console.warn(`Prefetch failed for key ${key}:`, err);
          }
        });
        
        await Promise.all(promises);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Prefetch operation failed';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [has]);
  
  const warm = useCallback(async (entries: Array<{ key: string; loader: () => Promise<any> }>): Promise<void> => {
    setIsLoading(true);
    
    try {
      const promises = entries.map(async ({ key, loader }) => {
        try {
          const exists = await has(key);
          if (!exists) {
            const value = await loader();
            await set(key, value);
          }
        } catch (err) {
          console.warn(`Cache warming failed for key ${key}:`, err);
        }
      });
      
      await Promise.all(promises);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Cache warming failed';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [has, set]);
  
  // Monitoring
  const getMetrics = useCallback((): CacheMetrics => {
    return { ...metricsRef.current };
  }, []);
  
  const getStats = useCallback((): CacheStats => {
    const entries = Array.from(memoryCache.current.values());
    
    return {
      hitCount: Math.floor(metricsRef.current.totalRequests * metricsRef.current.hitRate),
      missCount: Math.floor(metricsRef.current.totalRequests * metricsRef.current.missRate),
      hitRate: metricsRef.current.hitRate,
      size: memoryCache.current.size,
      maxSize: config.maxMemorySize,
      memoryUsage: metricsRef.current.memoryUsage,
      evictions: metricsRef.current.evictionCount,
      averageAge: entries.length > 0 
        ? entries.reduce((sum, entry) => sum + (Date.now() - entry.created), 0) / entries.length
        : 0,
      oldestEntry: entries.length > 0 
        ? new Date(Math.min(...entries.map(entry => entry.created)))
        : new Date(),
      newestEntry: entries.length > 0 
        ? new Date(Math.max(...entries.map(entry => entry.created)))
        : new Date()
    };
  }, [config.maxMemorySize]);
  
  const getStorageInfo = useCallback(async () => {
    return await getStorageQuota();
  }, []);
  
  // Cleanup effect
  useEffect(() => {
    if (config.cleanupInterval > 0) {
      cleanupTimerRef.current = setInterval(() => {
        optimize();
      }, config.cleanupInterval);
      
      return () => {
        if (cleanupTimerRef.current) {
          clearInterval(cleanupTimerRef.current);
        }
      };
    }
  }, [config.cleanupInterval, optimize]);
  
  // Online status effect
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return {
    // Core operations
    get,
    set,
    has,
    delete: deleteItem,
    clear,
    
    // Batch operations
    getMany,
    setMany,
    deleteMany,
    
    // Cache management
    evict,
    optimize,
    prefetch,
    warm,
    
    // Monitoring
    getMetrics,
    getStats,
    getStorageInfo,
    
    // State
    isLoading,
    error,
    metrics,
    isOnline,
    storageSupported
  };
};

export default useCacheManager;