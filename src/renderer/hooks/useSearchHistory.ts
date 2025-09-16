/**
 * useSearchHistory - Hook for managing search history
 *
 * Features:
 * - Persistent search history with localStorage and IPC
 * - Popular searches tracking with usage counts
 * - History filtering and search capabilities
 * - Automatic cleanup and size management
 * - Performance optimized operations
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export interface SearchHistoryEntry {
  query: string;
  timestamp: Date;
  resultCount?: number;
  executionTime?: number;
  successful?: boolean;
  userId?: string;
  sessionId?: string;
}

export interface PopularSearch {
  query: string;
  count: number;
  lastUsed: Date;
  avgResultCount: number;
  successRate: number;
}

interface SearchHistoryOptions {
  maxHistorySize?: number;
  persistToServer?: boolean;
  enableAnalytics?: boolean;
  storageKey?: string;
}

export const useSearchHistory = (options: SearchHistoryOptions = {}) => {
  const {
    maxHistorySize = 100,
    persistToServer = true,
    enableAnalytics = true,
    storageKey = 'kb-search-history'
  } = options;

  // State
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [popularSearches, setPopularSearches] = useState<PopularSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load from localStorage first for immediate availability
        const localData = localStorage.getItem(storageKey);
        if (localData) {
          const parsed = JSON.parse(localData);
          setHistory(parsed.history || []);
          setPopularSearches(parsed.popular || []);
        }

        // Load from server if enabled
        if (persistToServer && window.electronAPI?.searchHistory) {
          try {
            const serverData = await window.electronAPI.searchHistory.getHistory(maxHistorySize);
            if (serverData && serverData.success !== false) {
              setHistory(serverData.history || []);
              setPopularSearches(serverData.popular || []);
            }
          } catch (serverError) {
            console.warn('Failed to load search history from server:', serverError);
            // Continue with localStorage data
          }
        }
      } catch (err) {
        console.error('Failed to load search history:', err);
        setError(err instanceof Error ? err.message : 'Failed to load search history');
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [storageKey, maxHistorySize, persistToServer]);

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (!loading) {
      try {
        const dataToSave = {
          history: history.slice(0, maxHistorySize),
          popular: popularSearches.slice(0, 50), // Limit popular searches
          lastUpdated: new Date().toISOString()
        };
        localStorage.setItem(storageKey, JSON.stringify(dataToSave));
      } catch (err) {
        console.warn('Failed to save to localStorage:', err);
      }
    }
  }, [history, popularSearches, loading, storageKey, maxHistorySize]);

  // Add search to history
  const addToHistory = useCallback(async (
    query: string,
    metadata?: {
      resultCount?: number;
      executionTime?: number;
      successful?: boolean;
      userId?: string;
      sessionId?: string;
    }
  ) => {
    if (!query.trim()) return;

    const newEntry: SearchHistoryEntry = {
      query: query.trim(),
      timestamp: new Date(),
      ...metadata
    };

    try {
      // Update local state
      setHistory(prev => {
        const updated = [newEntry, ...prev.filter(item => item.query !== newEntry.query)];
        return updated.slice(0, maxHistorySize);
      });

      // Update popular searches
      setPopularSearches(prev => {
        const existing = prev.find(item => item.query === newEntry.query);

        if (existing) {
          // Update existing entry
          return prev.map(item =>
            item.query === newEntry.query
              ? {
                  ...item,
                  count: item.count + 1,
                  lastUsed: newEntry.timestamp,
                  avgResultCount: metadata?.resultCount
                    ? (item.avgResultCount + metadata.resultCount) / 2
                    : item.avgResultCount,
                  successRate: metadata?.successful !== undefined
                    ? (item.successRate * item.count + (metadata.successful ? 1 : 0)) / (item.count + 1)
                    : item.successRate
                }
              : item
          ).sort((a, b) => b.count - a.count);
        } else {
          // Add new entry
          const newPopular: PopularSearch = {
            query: newEntry.query,
            count: 1,
            lastUsed: newEntry.timestamp,
            avgResultCount: metadata?.resultCount || 0,
            successRate: metadata?.successful !== undefined ? (metadata.successful ? 1 : 0) : 0.5
          };

          return [newPopular, ...prev].slice(0, 50); // Limit to top 50
        }
      });

      // Persist to server if enabled
      if (persistToServer && window.electronAPI?.searchHistory) {
        try {
          await window.electronAPI.searchHistory.addEntry(newEntry);
        } catch (serverError) {
          console.warn('Failed to persist search to server:', serverError);
          // Continue with local storage
        }
      }

      // Analytics
      if (enableAnalytics && window.electronAPI?.analytics) {
        window.electronAPI.analytics.trackEvent('search_performed', {
          query_length: query.length,
          has_results: metadata?.resultCount && metadata.resultCount > 0,
          execution_time: metadata?.executionTime
        });
      }

    } catch (err) {
      console.error('Failed to add search to history:', err);
      setError(err instanceof Error ? err.message : 'Failed to add search to history');
    }
  }, [maxHistorySize, persistToServer, enableAnalytics]);

  // Get recent searches
  const getRecentSearches = useCallback(async (limit = 20): Promise<string[]> => {
    return history
      .slice(0, limit)
      .map(entry => entry.query);
  }, [history]);

  // Get popular searches
  const getPopularSearches = useCallback(async (limit = 10): Promise<Array<{ query: string; count: number }>> => {
    return popularSearches
      .slice(0, limit)
      .map(({ query, count }) => ({ query, count }));
  }, [popularSearches]);

  // Search within history
  const searchHistory = useCallback((searchQuery: string): SearchHistoryEntry[] => {
    if (!searchQuery.trim()) return history;

    const query = searchQuery.toLowerCase();
    return history.filter(entry =>
      entry.query.toLowerCase().includes(query)
    );
  }, [history]);

  // Clear all history
  const clearHistory = useCallback(async () => {
    try {
      setHistory([]);
      setPopularSearches([]);
      localStorage.removeItem(storageKey);

      if (persistToServer && window.electronAPI?.searchHistory) {
        try {
          await window.electronAPI.searchHistory.clearHistory();
        } catch (serverError) {
          console.warn('Failed to clear server history:', serverError);
        }
      }

      if (enableAnalytics && window.electronAPI?.analytics) {
        window.electronAPI.analytics.trackEvent('search_history_cleared');
      }
    } catch (err) {
      console.error('Failed to clear history:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear history');
    }
  }, [storageKey, persistToServer, enableAnalytics]);

  // Remove specific entry
  const removeEntry = useCallback(async (query: string) => {
    try {
      setHistory(prev => prev.filter(entry => entry.query !== query));
      setPopularSearches(prev => prev.filter(entry => entry.query !== query));

      if (persistToServer && window.electronAPI?.searchHistory) {
        try {
          await window.electronAPI.searchHistory.removeEntry(query);
        } catch (serverError) {
          console.warn('Failed to remove entry from server:', serverError);
        }
      }
    } catch (err) {
      console.error('Failed to remove entry:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove entry');
    }
  }, [persistToServer]);

  // Get search analytics
  const getAnalytics = useCallback(() => {
    const totalSearches = history.length;
    const uniqueQueries = new Set(history.map(h => h.query)).size;
    const avgResultCount = history
      .filter(h => h.resultCount !== undefined)
      .reduce((acc, h) => acc + (h.resultCount || 0), 0) / totalSearches || 0;
    const successRate = history
      .filter(h => h.successful !== undefined)
      .reduce((acc, h) => acc + (h.successful ? 1 : 0), 0) / totalSearches || 0;

    return {
      totalSearches,
      uniqueQueries,
      averageResultCount: Math.round(avgResultCount * 10) / 10,
      successRate: Math.round(successRate * 100) / 100,
      topQueries: popularSearches.slice(0, 10)
    };
  }, [history, popularSearches]);

  // Export history
  const exportHistory = useCallback(() => {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      totalEntries: history.length,
      history: history,
      popularSearches: popularSearches,
      analytics: getAnalytics()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-history-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (enableAnalytics && window.electronAPI?.analytics) {
      window.electronAPI.analytics.trackEvent('search_history_exported', {
        entry_count: history.length
      });
    }
  }, [history, popularSearches, getAnalytics, enableAnalytics]);

  // Import history
  const importHistory = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.version && data.history && Array.isArray(data.history)) {
        // Merge with existing history, avoiding duplicates
        const existingQueries = new Set(history.map(h => h.query));
        const newEntries = data.history.filter((entry: SearchHistoryEntry) =>
          !existingQueries.has(entry.query)
        );

        setHistory(prev => [...newEntries, ...prev].slice(0, maxHistorySize));

        if (data.popularSearches && Array.isArray(data.popularSearches)) {
          setPopularSearches(prev => {
            const merged = [...data.popularSearches, ...prev];
            const unique = merged.reduce((acc, current) => {
              const existing = acc.find(item => item.query === current.query);
              if (existing) {
                existing.count += current.count;
                existing.lastUsed = new Date(Math.max(
                  new Date(existing.lastUsed).getTime(),
                  new Date(current.lastUsed).getTime()
                ));
              } else {
                acc.push(current);
              }
              return acc;
            }, [] as PopularSearch[]);

            return unique.sort((a, b) => b.count - a.count).slice(0, 50);
          });
        }

        if (enableAnalytics && window.electronAPI?.analytics) {
          window.electronAPI.analytics.trackEvent('search_history_imported', {
            entry_count: newEntries.length
          });
        }
      } else {
        throw new Error('Invalid file format');
      }
    } catch (err) {
      console.error('Failed to import history:', err);
      setError(err instanceof Error ? err.message : 'Failed to import history');
    }
  }, [history, maxHistorySize, enableAnalytics]);

  return {
    // State
    history,
    popularSearches,
    loading,
    error,

    // Actions
    addToHistory,
    clearHistory,
    removeEntry,

    // Queries
    getRecentSearches,
    getPopularSearches,
    searchHistory,
    getAnalytics,

    // Import/Export
    exportHistory,
    importHistory
  };
};