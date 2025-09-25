/**
 * useSearchHistory Hook
 *
 * Manages search history state with:
 * - Persistent local storage
 * - Search frequency tracking
 * - Smart suggestions based on history
 * - Privacy-aware data management
 *
 * Performance optimizations:
 * - Lazy loading of history data
 * - Efficient deduplication
 * - Memory-conscious storage limits
 *
 * @author Frontend Team
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: Date;
  resultsCount: number;
  executionTime: number;
  selectedResult?: string;
  filters?: Record<string, any>;
  category?: string;
  success?: boolean;
}

export interface SearchHistoryOptions {
  /** Maximum number of items to store (default: 100) */
  maxItems?: number;
  /** Storage key prefix (default: 'search-history') */
  storageKey?: string;
  /** Enable persistent storage (default: true) */
  persist?: boolean;
  /** Auto-cleanup after days (default: 30) */
  retentionDays?: number;
  /** Group similar queries (default: true) */
  groupSimilar?: boolean;
  /** Track search success/failure (default: true) */
  trackSuccess?: boolean;
}

export interface SearchSuggestion {
  query: string;
  frequency: number;
  lastUsed: Date;
  avgResultsCount: number;
  successRate: number;
  category?: string;
}

const DEFAULT_OPTIONS: Required<SearchHistoryOptions> = {
  maxItems: 100,
  storageKey: 'mainframe-search-history',
  persist: true,
  retentionDays: 30,
  groupSimilar: true,
  trackSuccess: true,
};

/**
 * Generate unique ID for search history item
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Normalize query for similarity comparison
 */
function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Calculate similarity between two queries
 */
function calculateSimilarity(query1: string, query2: string): number {
  const norm1 = normalizeQuery(query1);
  const norm2 = normalizeQuery(query2);

  if (norm1 === norm2) return 1;

  const words1 = norm1.split(' ');
  const words2 = norm2.split(' ');
  const allWords = new Set([...words1, ...words2]);
  const intersection = words1.filter(word => words2.includes(word));

  return intersection.length / allWords.size;
}

/**
 * Load search history from storage
 */
function loadFromStorage(storageKey: string): SearchHistoryItem[] {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return parsed.map((item: any) => ({
      ...item,
      timestamp: new Date(item.timestamp),
    }));
  } catch (error) {
    console.warn('Failed to load search history:', error);
    return [];
  }
}

/**
 * Save search history to storage
 */
function saveToStorage(storageKey: string, history: SearchHistoryItem[]): void {
  try {
    const serializable = history.map(item => ({
      ...item,
      timestamp: item.timestamp.toISOString(),
    }));
    localStorage.setItem(storageKey, JSON.stringify(serializable));
  } catch (error) {
    console.warn('Failed to save search history:', error);
  }
}

/**
 * Hook for managing search history
 */
export function useSearchHistory(options: SearchHistoryOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load initial history
  useEffect(() => {
    if (config.persist) {
      const loaded = loadFromStorage(config.storageKey);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);

      // Filter out old items
      const filtered = loaded.filter(item => item.timestamp > cutoffDate);

      setHistory(filtered);
    }
    setLoading(false);
  }, [config.storageKey, config.persist, config.retentionDays]);

  // Save to storage when history changes
  useEffect(() => {
    if (config.persist && !loading) {
      saveToStorage(config.storageKey, history);
    }
  }, [history, config.storageKey, config.persist, loading]);

  // Add search to history
  const addSearch = useCallback(
    (
      query: string,
      resultsCount: number,
      executionTime: number,
      options: {
        selectedResult?: string;
        filters?: Record<string, any>;
        category?: string;
        success?: boolean;
      } = {}
    ) => {
      if (!query.trim()) return;

      const newItem: SearchHistoryItem = {
        id: generateId(),
        query: query.trim(),
        timestamp: new Date(),
        resultsCount,
        executionTime,
        ...options,
      };

      setHistory(prev => {
        let updated = [newItem, ...prev];

        // Group similar queries if enabled
        if (config.groupSimilar) {
          const similar = updated.find(
            (item, index) => index > 0 && calculateSimilarity(item.query, newItem.query) > 0.8
          );

          if (similar) {
            // Update the existing similar item instead of adding new one
            updated = updated
              .map(item =>
                item.id === similar.id
                  ? { ...item, timestamp: newItem.timestamp, resultsCount: newItem.resultsCount }
                  : item
              )
              .filter(item => item.id !== newItem.id);
          }
        }

        // Limit history size
        return updated.slice(0, config.maxItems);
      });
    },
    [config.groupSimilar, config.maxItems]
  );

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
    if (config.persist) {
      localStorage.removeItem(config.storageKey);
    }
  }, [config.persist, config.storageKey]);

  // Remove specific item
  const removeItem = useCallback((id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  }, []);

  // Get recent searches
  const getRecentSearches = useCallback(
    (count: number = 10): SearchHistoryItem[] => {
      return history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, count);
    },
    [history]
  );

  // Get popular searches
  const getPopularSearches = useCallback(
    (count: number = 5): SearchSuggestion[] => {
      const queryGroups = new Map<string, SearchHistoryItem[]>();

      // Group by normalized query
      history.forEach(item => {
        const normalized = normalizeQuery(item.query);
        if (!queryGroups.has(normalized)) {
          queryGroups.set(normalized, []);
        }
        queryGroups.get(normalized)!.push(item);
      });

      // Calculate popularity metrics
      const suggestions: SearchSuggestion[] = [];

      queryGroups.forEach((items, normalizedQuery) => {
        if (items.length === 0) return;

        const frequency = items.length;
        const lastUsed = new Date(Math.max(...items.map(item => item.timestamp.getTime())));
        const avgResultsCount =
          items.reduce((sum, item) => sum + item.resultsCount, 0) / items.length;
        const successCount = config.trackSuccess
          ? items.filter(item => item.success !== false).length
          : items.length;
        const successRate = successCount / frequency;

        // Use the most recent version of the query for display
        const mostRecent = items.reduce((latest, current) =>
          current.timestamp > latest.timestamp ? current : latest
        );

        suggestions.push({
          query: mostRecent.query,
          frequency,
          lastUsed,
          avgResultsCount,
          successRate,
          category: mostRecent.category,
        });
      });

      // Sort by popularity score (frequency * success rate * recency factor)
      return suggestions
        .map(suggestion => {
          const daysSinceLastUsed =
            (Date.now() - suggestion.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
          const recencyFactor = Math.max(0.1, 1 - daysSinceLastUsed / 30); // Decay over 30 days
          const popularityScore = suggestion.frequency * suggestion.successRate * recencyFactor;

          return { ...suggestion, popularityScore };
        })
        .sort((a: any, b: any) => b.popularityScore - a.popularityScore)
        .slice(0, count);
    },
    [history, config.trackSuccess]
  );

  // Get search suggestions based on partial query
  const getSuggestions = useCallback(
    (partialQuery: string, count: number = 5): SearchSuggestion[] => {
      if (!partialQuery.trim()) {
        return getPopularSearches(count);
      }

      const normalized = normalizeQuery(partialQuery);
      const matches = history
        .filter(item => normalizeQuery(item.query).includes(normalized))
        .reduce<Map<string, SearchHistoryItem[]>>((acc, item) => {
          const key = normalizeQuery(item.query);
          if (!acc.has(key)) {
            acc.set(key, []);
          }
          acc.get(key)!.push(item);
          return acc;
        }, new Map());

      const suggestions: SearchSuggestion[] = [];

      matches.forEach((items, normalizedQuery) => {
        const mostRecent = items.reduce((latest, current) =>
          current.timestamp > latest.timestamp ? current : latest
        );

        const frequency = items.length;
        const avgResultsCount =
          items.reduce((sum, item) => sum + item.resultsCount, 0) / items.length;
        const successCount = config.trackSuccess
          ? items.filter(item => item.success !== false).length
          : items.length;
        const successRate = successCount / frequency;

        suggestions.push({
          query: mostRecent.query,
          frequency,
          lastUsed: mostRecent.timestamp,
          avgResultsCount,
          successRate,
          category: mostRecent.category,
        });
      });

      // Sort by relevance (exact match first, then by frequency and success rate)
      return suggestions
        .sort((a, b) => {
          const aExact = normalizeQuery(a.query) === normalized ? 1 : 0;
          const bExact = normalizeQuery(b.query) === normalized ? 1 : 0;

          if (aExact !== bExact) return bExact - aExact;

          const aScore = a.frequency * a.successRate;
          const bScore = b.frequency * b.successRate;

          return bScore - aScore;
        })
        .slice(0, count);
    },
    [history, getPopularSearches, config.trackSuccess]
  );

  // Get search statistics
  const getStatistics = useMemo(
    () => ({
      totalSearches: history.length,
      uniqueQueries: new Set(history.map(item => normalizeQuery(item.query))).size,
      avgExecutionTime:
        history.length > 0
          ? history.reduce((sum, item) => sum + item.executionTime, 0) / history.length
          : 0,
      avgResultsCount:
        history.length > 0
          ? history.reduce((sum, item) => sum + item.resultsCount, 0) / history.length
          : 0,
      successRate:
        config.trackSuccess && history.length > 0
          ? history.filter(item => item.success !== false).length / history.length
          : 1,
      categories: Array.from(
        new Set(history.filter(item => item.category).map(item => item.category))
      ),
    }),
    [history, config.trackSuccess]
  );

  return {
    history,
    loading,
    addSearch,
    clearHistory,
    removeItem,
    getRecentSearches,
    getPopularSearches,
    getSuggestions,
    statistics: getStatistics,
  };
}
