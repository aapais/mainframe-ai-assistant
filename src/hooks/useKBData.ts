/**
 * KB Data Management Hook
 *
 * Custom React hook for managing knowledge base data with:
 * - Real-time data synchronization
 * - Optimistic updates
 * - Error handling and recovery
 * - Caching and performance optimization
 * - Search and filtering capabilities
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { KnowledgeDB, KBEntry, SearchResult, DatabaseStats } from '../database/KnowledgeDB';
import { KBCategory } from '../types/services';

// ========================
// Types & Interfaces
// ========================

export interface KBDataState {
  /** All KB entries */
  entries: KBEntry[];
  /** Current search results */
  searchResults: SearchResult[];
  /** Database statistics */
  stats: DatabaseStats | null;
  /** Loading states */
  loading: {
    entries: boolean;
    search: boolean;
    stats: boolean;
    operation: boolean;
  };
  /** Error states */
  error: {
    entries: Error | null;
    search: Error | null;
    stats: Error | null;
    operation: Error | null;
  };
  /** Last update timestamp */
  lastUpdated: Date | null;
  /** Cache status */
  cache: {
    entries: Date | null;
    stats: Date | null;
    searchResults: Map<string, { results: SearchResult[]; timestamp: Date }>;
  };
}

export interface SearchOptions {
  /** Search query */
  query?: string;
  /** Category filter */
  category?: KBCategory;
  /** Tag filters */
  tags?: string[];
  /** Sort options */
  sortBy?: 'relevance' | 'usage' | 'created' | 'updated' | 'title';
  sortOrder?: 'asc' | 'desc';
  /** Pagination */
  limit?: number;
  offset?: number;
  /** Use AI for semantic search */
  useAI?: boolean;
}

export interface UseKBDataOptions {
  /** Auto-refresh interval in milliseconds */
  autoRefresh?: number;
  /** Enable real-time updates */
  realTimeUpdates?: boolean;
  /** Cache duration in milliseconds */
  cacheDuration?: number;
  /** Enable optimistic updates */
  optimisticUpdates?: boolean;
  /** Auto-load entries on mount */
  autoLoadEntries?: boolean;
  /** Auto-load stats on mount */
  autoLoadStats?: boolean;
}

export interface UseKBDataReturn {
  // State
  entries: KBEntry[];
  searchResults: SearchResult[];
  stats: DatabaseStats | null;
  loading: KBDataState['loading'];
  error: KBDataState['error'];
  lastUpdated: Date | null;

  // Data operations
  loadEntries: (force?: boolean) => Promise<KBEntry[]>;
  searchEntries: (options: SearchOptions) => Promise<SearchResult[]>;
  loadStats: (force?: boolean) => Promise<DatabaseStats>;
  refresh: () => Promise<void>;

  // Entry operations
  getEntry: (id: string) => KBEntry | undefined;
  addEntry: (entry: Omit<KBEntry, 'id'>) => Promise<string>;
  updateEntry: (id: string, updates: Partial<KBEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  duplicateEntry: (id: string) => Promise<string>;

  // Bulk operations
  addMultipleEntries: (entries: Omit<KBEntry, 'id'>[]) => Promise<string[]>;
  updateMultipleEntries: (updates: Array<{ id: string; data: Partial<KBEntry> }>) => Promise<void>;
  deleteMultipleEntries: (ids: string[]) => Promise<void>;

  // Search helpers
  clearSearch: () => void;
  getRecentSearches: () => string[];
  getSuggestions: (query: string) => Promise<string[]>;

  // Cache management
  clearCache: () => void;
  getCacheInfo: () => KBDataState['cache'];

  // Utility functions
  exportEntries: (format?: 'json' | 'csv') => Promise<string>;
  importEntries: (data: string, format?: 'json' | 'csv') => Promise<number>;
}

// ========================
// Hook Implementation
// ========================

export const useKBData = (
  db: KnowledgeDB,
  options: UseKBDataOptions = {}
): UseKBDataReturn => {
  const {
    autoRefresh,
    realTimeUpdates = true,
    cacheDuration = 5 * 60 * 1000, // 5 minutes
    optimisticUpdates = true,
    autoLoadEntries = true,
    autoLoadStats = false
  } = options;

  // State management
  const [state, setState] = useState<KBDataState>({
    entries: [],
    searchResults: [],
    stats: null,
    loading: {
      entries: false,
      search: false,
      stats: false,
      operation: false
    },
    error: {
      entries: null,
      search: null,
      stats: null,
      operation: null
    },
    lastUpdated: null,
    cache: {
      entries: null,
      stats: null,
      searchResults: new Map()
    }
  });

  // Refs for cleanup and consistency
  const mountedRef = useRef(true);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const recentSearchesRef = useRef<string[]>([]);

  // Update state helper
  const updateState = useCallback((updates: Partial<KBDataState>) => {
    if (!mountedRef.current) return;
    setState(prevState => ({ ...prevState, ...updates }));
  }, []);

  // Update loading state helper
  const updateLoading = useCallback((key: keyof KBDataState['loading'], value: boolean) => {
    updateState({
      loading: { ...state.loading, [key]: value }
    });
  }, [state.loading, updateState]);

  // Update error state helper
  const updateError = useCallback((key: keyof KBDataState['error'], value: Error | null) => {
    updateState({
      error: { ...state.error, [key]: value }
    });
  }, [state.error, updateState]);

  // Check cache validity
  const isCacheValid = useCallback((timestamp: Date | null): boolean => {
    if (!timestamp) return false;
    return Date.now() - timestamp.getTime() < cacheDuration;
  }, [cacheDuration]);

  // Load entries from database
  const loadEntries = useCallback(async (force = false): Promise<KBEntry[]> => {
    if (!force && isCacheValid(state.cache.entries)) {
      return state.entries;
    }

    updateLoading('entries', true);
    updateError('entries', null);

    try {
      // Get popular entries as a starting point
      const popularResults = await db.getPopular(100);
      const popularEntries = popularResults.map(result => result.entry);

      // Get recent entries to supplement
      const recentResults = await db.getRecent(50);
      const recentEntries = recentResults.map(result => result.entry);

      // Combine and deduplicate
      const entryMap = new Map<string, KBEntry>();
      [...popularEntries, ...recentEntries].forEach(entry => {
        if (entry.id) {
          entryMap.set(entry.id, entry);
        }
      });

      const entries = Array.from(entryMap.values());

      updateState({
        entries,
        cache: {
          ...state.cache,
          entries: new Date()
        },
        lastUpdated: new Date()
      });

      return entries;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load entries');
      updateError('entries', err);
      throw err;
    } finally {
      updateLoading('entries', false);
    }
  }, [db, force, isCacheValid, state.cache, state.entries, updateState, updateLoading, updateError]);

  // Search entries
  const searchEntries = useCallback(async (options: SearchOptions): Promise<SearchResult[]> => {
    const { query = '', category, tags, sortBy, sortOrder, limit, offset, useAI } = options;

    // Cancel previous search
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }

    searchAbortControllerRef.current = new AbortController();

    // Check cache for this search
    const cacheKey = JSON.stringify(options);
    const cachedResult = state.cache.searchResults.get(cacheKey);
    if (cachedResult && isCacheValid(cachedResult.timestamp)) {
      updateState({ searchResults: cachedResult.results });
      return cachedResult.results;
    }

    updateLoading('search', true);
    updateError('search', null);

    try {
      let results: SearchResult[] = [];

      if (query.trim()) {
        // Perform search query
        results = await db.search(query, {
          category,
          tags,
          sortBy,
          sortOrder,
          limit,
          offset,
          includeArchived: false
        });
      } else if (category || (tags && tags.length > 0)) {
        // Filter-only search (no text query)
        const allResults = await db.getPopular(1000);
        results = allResults.filter(result => {
          const entry = result.entry;

          // Category filter
          if (category && entry.category !== category) {
            return false;
          }

          // Tag filter
          if (tags && tags.length > 0) {
            const entryTags = entry.tags || [];
            const hasAllTags = tags.every(tag =>
              entryTags.some(entryTag =>
                entryTag.toLowerCase().includes(tag.toLowerCase())
              )
            );
            if (!hasAllTags) return false;
          }

          return true;
        }).slice(0, limit || 50);
      } else {
        // No filters - return popular entries
        results = await db.getPopular(limit || 50);
      }

      // Cache the results
      const newCache = new Map(state.cache.searchResults);
      newCache.set(cacheKey, {
        results,
        timestamp: new Date()
      });

      // Limit cache size
      if (newCache.size > 20) {
        const oldestKey = Array.from(newCache.keys())[0];
        newCache.delete(oldestKey);
      }

      updateState({
        searchResults: results,
        cache: {
          ...state.cache,
          searchResults: newCache
        }
      });

      // Update recent searches
      if (query.trim()) {
        recentSearchesRef.current = [
          query,
          ...recentSearchesRef.current.filter(s => s !== query)
        ].slice(0, 10);
      }

      return results;
    } catch (error) {
      if (error.name === 'AbortError') {
        return []; // Search was cancelled
      }

      const err = error instanceof Error ? error : new Error('Search failed');
      updateError('search', err);
      throw err;
    } finally {
      updateLoading('search', false);
    }
  }, [db, state.cache, isCacheValid, updateState, updateLoading, updateError]);

  // Load database statistics
  const loadStats = useCallback(async (force = false): Promise<DatabaseStats> => {
    if (!force && isCacheValid(state.cache.stats) && state.stats) {
      return state.stats;
    }

    updateLoading('stats', true);
    updateError('stats', null);

    try {
      const stats = await db.getStats();

      updateState({
        stats,
        cache: {
          ...state.cache,
          stats: new Date()
        }
      });

      return stats;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load stats');
      updateError('stats', err);
      throw err;
    } finally {
      updateLoading('stats', false);
    }
  }, [db, force, isCacheValid, state.cache.stats, state.stats, updateState, updateLoading, updateError]);

  // Refresh all data
  const refresh = useCallback(async (): Promise<void> => {
    await Promise.allSettled([
      loadEntries(true),
      loadStats(true)
    ]);
  }, [loadEntries, loadStats]);

  // Get entry by ID
  const getEntry = useCallback((id: string): KBEntry | undefined => {
    return state.entries.find(entry => entry.id === id);
  }, [state.entries]);

  // Add new entry
  const addEntry = useCallback(async (entry: Omit<KBEntry, 'id'>): Promise<string> => {
    updateLoading('operation', true);
    updateError('operation', null);

    try {
      const newId = await db.addEntry(entry);

      if (optimisticUpdates) {
        const newEntry: KBEntry = {
          ...entry,
          id: newId,
          created_at: new Date(),
          updated_at: new Date(),
          usage_count: 0,
          success_count: 0,
          failure_count: 0
        };

        updateState({
          entries: [...state.entries, newEntry],
          cache: { ...state.cache, entries: null } // Invalidate cache
        });
      } else {
        await loadEntries(true);
      }

      return newId;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to add entry');
      updateError('operation', err);
      throw err;
    } finally {
      updateLoading('operation', false);
    }
  }, [db, optimisticUpdates, state.entries, updateState, updateLoading, updateError, loadEntries]);

  // Update entry
  const updateEntry = useCallback(async (id: string, updates: Partial<KBEntry>): Promise<void> => {
    updateLoading('operation', true);
    updateError('operation', null);

    try {
      await db.updateEntry(id, updates);

      if (optimisticUpdates) {
        updateState({
          entries: state.entries.map(entry =>
            entry.id === id
              ? { ...entry, ...updates, updated_at: new Date() }
              : entry
          ),
          cache: { ...state.cache, entries: null } // Invalidate cache
        });
      } else {
        await loadEntries(true);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to update entry');
      updateError('operation', err);
      throw err;
    } finally {
      updateLoading('operation', false);
    }
  }, [db, id, updates, optimisticUpdates, state.entries, updateState, updateLoading, updateError, loadEntries]);

  // Delete entry
  const deleteEntry = useCallback(async (id: string): Promise<void> => {
    updateLoading('operation', true);
    updateError('operation', null);

    try {
      await db.updateEntry(id, { archived: true }); // Soft delete

      if (optimisticUpdates) {
        updateState({
          entries: state.entries.filter(entry => entry.id !== id),
          cache: { ...state.cache, entries: null } // Invalidate cache
        });
      } else {
        await loadEntries(true);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to delete entry');
      updateError('operation', err);
      throw err;
    } finally {
      updateLoading('operation', false);
    }
  }, [db, id, optimisticUpdates, state.entries, updateState, updateLoading, updateError, loadEntries]);

  // Duplicate entry
  const duplicateEntry = useCallback(async (id: string): Promise<string> => {
    const originalEntry = getEntry(id);
    if (!originalEntry) {
      throw new Error('Entry not found');
    }

    const duplicatedEntry: Omit<KBEntry, 'id'> = {
      ...originalEntry,
      title: `${originalEntry.title} (Copy)`,
      created_at: new Date(),
      updated_at: new Date(),
      usage_count: 0,
      success_count: 0,
      failure_count: 0
    };

    return await addEntry(duplicatedEntry);
  }, [getEntry, addEntry]);

  // Bulk operations
  const addMultipleEntries = useCallback(async (entries: Omit<KBEntry, 'id'>[]): Promise<string[]> => {
    updateLoading('operation', true);
    updateError('operation', null);

    try {
      const ids: string[] = [];
      for (const entry of entries) {
        const id = await db.addEntry(entry);
        ids.push(id);
      }

      if (!optimisticUpdates) {
        await loadEntries(true);
      }

      return ids;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to add multiple entries');
      updateError('operation', err);
      throw err;
    } finally {
      updateLoading('operation', false);
    }
  }, [db, entries, optimisticUpdates, updateLoading, updateError, loadEntries]);

  const updateMultipleEntries = useCallback(async (
    updates: Array<{ id: string; data: Partial<KBEntry> }>
  ): Promise<void> => {
    updateLoading('operation', true);
    updateError('operation', null);

    try {
      for (const { id, data } of updates) {
        await db.updateEntry(id, data);
      }

      if (!optimisticUpdates) {
        await loadEntries(true);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to update multiple entries');
      updateError('operation', err);
      throw err;
    } finally {
      updateLoading('operation', false);
    }
  }, [db, updates, optimisticUpdates, updateLoading, updateError, loadEntries]);

  const deleteMultipleEntries = useCallback(async (ids: string[]): Promise<void> => {
    updateLoading('operation', true);
    updateError('operation', null);

    try {
      for (const id of ids) {
        await db.updateEntry(id, { archived: true }); // Soft delete
      }

      if (optimisticUpdates) {
        updateState({
          entries: state.entries.filter(entry => !ids.includes(entry.id!)),
          cache: { ...state.cache, entries: null }
        });
      } else {
        await loadEntries(true);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to delete multiple entries');
      updateError('operation', err);
      throw err;
    } finally {
      updateLoading('operation', false);
    }
  }, [db, ids, optimisticUpdates, state.entries, updateState, updateLoading, updateError, loadEntries]);

  // Search helpers
  const clearSearch = useCallback(() => {
    updateState({
      searchResults: [],
      cache: { ...state.cache, searchResults: new Map() }
    });
  }, [state.cache, updateState]);

  const getRecentSearches = useCallback((): string[] => {
    return [...recentSearchesRef.current];
  }, []);

  const getSuggestions = useCallback(async (query: string): Promise<string[]> => {
    try {
      const suggestions = await db.autoComplete(query, 5);
      return suggestions.map(s => s.suggestion);
    } catch (error) {
      console.warn('Failed to get suggestions:', error);
      return [];
    }
  }, [db, query]);

  // Cache management
  const clearCache = useCallback(() => {
    updateState({
      cache: {
        entries: null,
        stats: null,
        searchResults: new Map()
      }
    });
  }, [updateState]);

  const getCacheInfo = useCallback((): KBDataState['cache'] => {
    return state.cache;
  }, [state.cache]);

  // Utility functions
  const exportEntries = useCallback(async (format: 'json' | 'csv' = 'json'): Promise<string> => {
    const entries = state.entries;

    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    } else if (format === 'csv') {
      const headers = ['id', 'title', 'problem', 'solution', 'category', 'tags', 'created_at', 'usage_count'];
      const csvRows = [
        headers.join(','),
        ...entries.map(entry => [
          entry.id,
          `"${entry.title?.replace(/"/g, '""')}"`,
          `"${entry.problem?.replace(/"/g, '""')}"`,
          `"${entry.solution?.replace(/"/g, '""')}"`,
          entry.category,
          `"${entry.tags?.join(', ') || ''}"`,
          entry.created_at?.toISOString(),
          entry.usage_count || 0
        ].join(','))
      ];
      return csvRows.join('\n');
    }

    throw new Error(`Unsupported export format: ${format}`);
  }, [state.entries]);

  const importEntries = useCallback(async (
    data: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<number> => {
    let entries: Omit<KBEntry, 'id'>[] = [];

    if (format === 'json') {
      const parsed = JSON.parse(data);
      entries = Array.isArray(parsed) ? parsed : [parsed];
    } else {
      throw new Error(`Unsupported import format: ${format}`);
    }

    await addMultipleEntries(entries);
    return entries.length;
  }, [addMultipleEntries]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoadEntries) {
      loadEntries();
    }
    if (autoLoadStats) {
      loadStats();
    }
  }, [autoLoadEntries, autoLoadStats, loadEntries, loadStats]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      if (realTimeUpdates) {
        refresh();
      }
    }, autoRefresh);

    return () => clearInterval(interval);
  }, [autoRefresh, realTimeUpdates, refresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Memoized return value
  return useMemo(() => ({
    // State
    entries: state.entries,
    searchResults: state.searchResults,
    stats: state.stats,
    loading: state.loading,
    error: state.error,
    lastUpdated: state.lastUpdated,

    // Data operations
    loadEntries,
    searchEntries,
    loadStats,
    refresh,

    // Entry operations
    getEntry,
    addEntry,
    updateEntry,
    deleteEntry,
    duplicateEntry,

    // Bulk operations
    addMultipleEntries,
    updateMultipleEntries,
    deleteMultipleEntries,

    // Search helpers
    clearSearch,
    getRecentSearches,
    getSuggestions,

    // Cache management
    clearCache,
    getCacheInfo,

    // Utility functions
    exportEntries,
    importEntries
  }), [
    state,
    loadEntries,
    searchEntries,
    loadStats,
    refresh,
    getEntry,
    addEntry,
    updateEntry,
    deleteEntry,
    duplicateEntry,
    addMultipleEntries,
    updateMultipleEntries,
    deleteMultipleEntries,
    clearSearch,
    getRecentSearches,
    getSuggestions,
    clearCache,
    getCacheInfo,
    exportEntries,
    importEntries
  ]);
};

export default useKBData;