/**
 * Cache-Aware Search Hook
 *
 * Enhanced search hook with intelligent caching:
 * - Automatic cache management for search results
 * - Predictive prefetching based on user patterns
 * - Incremental result loading with cache optimization
 * - Real-time performance monitoring
 * - Intelligent cache invalidation
 *
 * @author Frontend Cache Team
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useCacheManager } from './useCacheManager';
import {
  getCacheApiClient,
  CacheApiResponse,
  SearchCacheResponse,
} from '../services/api/CacheApiClient';
import { useDebounce } from './useDebounce';
import {
  IncrementalResult,
  CachePerformanceMetrics,
  PredictiveCacheEntry,
} from '../services/cache/CacheTypes';

// ========================
// Types & Interfaces
// ========================

export interface SearchOptions {
  limit?: number;
  offset?: number;
  enablePrediction?: boolean;
  enableIncremental?: boolean;
  cacheStrategy?: 'aggressive' | 'conservative' | 'adaptive';
  maxCacheAge?: number;
  prefetchNext?: boolean;
}

export interface SearchState {
  query: string;
  results: IncrementalResult[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  totalCount: number;
  loadedCount: number;
  progress: number;
  nextToken?: string;
}

export interface SearchMetrics {
  responseTime: number;
  cacheHitRatio: number;
  totalRequests: number;
  cachedRequests: number;
  networkRequests: number;
  bytesTransferred: number;
  bytesSaved: number;
  averageResponseTime: number;
  searchesPerformed: number;
  predictiveHits: number;
}

export interface UseCacheAwareSearchOptions {
  enableCache?: boolean;
  enablePrediction?: boolean;
  enableIncremental?: boolean;
  defaultLimit?: number;
  cacheTimeout?: number;
  prefetchThreshold?: number;
  maxConcurrentRequests?: number;
  retryAttempts?: number;
  enableMetrics?: boolean;
}

export interface UseCacheAwareSearchReturn {
  // Search state
  state: SearchState;
  metrics: SearchMetrics;
  cacheMetrics?: CachePerformanceMetrics;

  // Search functions
  search: (query: string, options?: SearchOptions) => Promise<void>;
  loadMore: () => Promise<void>;
  clear: () => void;
  retry: () => Promise<void>;

  // Cache functions
  prefetch: (queries: string[]) => Promise<void>;
  invalidateCache: (pattern?: string) => Promise<void>;
  warmCache: (queries: string[]) => Promise<void>;

  // Prediction functions
  getSuggestions: (partialQuery: string) => Promise<any[]>;
  updatePredictionModel: (feedback: {
    query: string;
    selected: boolean;
    resultIndex?: number;
  }) => void;

  // Utility functions
  exportMetrics: () => SearchMetrics;
  getPerformanceReport: () => string;
}

// ========================
// Constants
// ========================

const DEFAULT_OPTIONS: Required<UseCacheAwareSearchOptions> = {
  enableCache: true,
  enablePrediction: true,
  enableIncremental: true,
  defaultLimit: 20,
  cacheTimeout: 10 * 60 * 1000, // 10 minutes
  prefetchThreshold: 0.7,
  maxConcurrentRequests: 3,
  retryAttempts: 3,
  enableMetrics: true,
};

const CACHE_KEYS = {
  SEARCH_RESULTS: (query: string) => `search_results:${query}`,
  SEARCH_METADATA: (query: string) => `search_metadata:${query}`,
  SUGGESTIONS: (query: string) => `suggestions:${query}`,
  PREDICTION_MODEL: 'prediction_model',
  SEARCH_PATTERNS: 'search_patterns',
};

// ========================
// Hook Implementation
// ========================

export const useCacheAwareSearch = (
  options: UseCacheAwareSearchOptions = {}
): UseCacheAwareSearchReturn => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const cacheManager = useCacheManager({
    maxMemorySize: 100 * 1024 * 1024, // 100MB
    defaultTTL: config.cacheTimeout,
    enableMetrics: config.enableMetrics,
  });

  // API client
  const apiClient = useMemo(() => getCacheApiClient(), []);

  // State
  const [state, setState] = useState<SearchState>({
    query: '',
    results: [],
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    error: null,
    totalCount: 0,
    loadedCount: 0,
    progress: 0,
  });

  const [metrics, setMetrics] = useState<SearchMetrics>({
    responseTime: 0,
    cacheHitRatio: 0,
    totalRequests: 0,
    cachedRequests: 0,
    networkRequests: 0,
    bytesTransferred: 0,
    bytesSaved: 0,
    averageResponseTime: 0,
    searchesPerformed: 0,
    predictiveHits: 0,
  });

  const [cacheMetrics, setCacheMetrics] = useState<CachePerformanceMetrics | undefined>();

  // Refs
  const currentRequestRef = useRef<string | null>(null);
  const responseTimesRef = useRef<number[]>([]);
  const predictionModelRef = useRef<Map<string, PredictiveCacheEntry>>(new Map());
  const searchPatternsRef = useRef<string[]>([]);

  // Debounced query for suggestions
  const [debouncedQuery] = useDebounce(state.query, { delay: 300 });

  // ========================
  // Cache Management
  // ========================

  const getCacheKey = useCallback((query: string, options?: SearchOptions): string => {
    const optionsHash = options ? btoa(JSON.stringify(options)).slice(0, 8) : 'default';
    return `${CACHE_KEYS.SEARCH_RESULTS(query)}:${optionsHash}`;
  }, []);

  const checkCache = useCallback(
    async (
      query: string,
      options?: SearchOptions
    ): Promise<{
      results: IncrementalResult[];
      metadata: any;
      fromCache: boolean;
    } | null> => {
      if (!config.enableCache) return null;

      try {
        const cacheKey = getCacheKey(query, options);
        const cachedData = await cacheManager.get<{
          results: IncrementalResult[];
          metadata: any;
          timestamp: number;
        }>(cacheKey);

        if (cachedData) {
          // Check if cache is still valid
          const age = Date.now() - cachedData.timestamp;
          if (age < config.cacheTimeout) {
            return {
              results: cachedData.results,
              metadata: cachedData.metadata,
              fromCache: true,
            };
          } else {
            // Cache expired, remove it
            await cacheManager.delete(cacheKey);
          }
        }
      } catch (error) {
        console.warn('Cache check failed:', error);
      }

      return null;
    },
    [config.enableCache, config.cacheTimeout, cacheManager, getCacheKey]
  );

  const storeInCache = useCallback(
    async (
      query: string,
      results: IncrementalResult[],
      metadata: any,
      options?: SearchOptions
    ): Promise<void> => {
      if (!config.enableCache) return;

      try {
        const cacheKey = getCacheKey(query, options);
        await cacheManager.set(
          cacheKey,
          {
            results,
            metadata,
            timestamp: Date.now(),
          },
          {
            ttl: config.cacheTimeout,
            tags: ['search_results', query],
          }
        );
      } catch (error) {
        console.warn('Cache store failed:', error);
      }
    },
    [config.enableCache, config.cacheTimeout, cacheManager, getCacheKey]
  );

  // ========================
  // Prediction & Prefetching
  // ========================

  const updatePredictionModel = useCallback(
    (feedback: { query: string; selected: boolean; resultIndex?: number }) => {
      if (!config.enablePrediction) return;

      const existing = predictionModelRef.current.get(feedback.query) || {
        pattern: feedback.query,
        probability: 0.5,
        lastUsed: Date.now(),
        frequency: 0,
        context: {},
      };

      // Update prediction model based on feedback
      existing.frequency += 1;
      existing.lastUsed = Date.now();
      existing.probability = feedback.selected
        ? Math.min(1, existing.probability + 0.1)
        : Math.max(0, existing.probability - 0.05);

      if (feedback.resultIndex !== undefined) {
        existing.context.averageClickPosition =
          ((existing.context.averageClickPosition || 0) + feedback.resultIndex) / 2;
      }

      predictionModelRef.current.set(feedback.query, existing);

      // Store updated model in cache
      cacheManager
        .set(CACHE_KEYS.PREDICTION_MODEL, Array.from(predictionModelRef.current.entries()))
        .catch(console.warn);
    },
    [config.enablePrediction, cacheManager]
  );

  const predictQueries = useCallback(
    (partialQuery: string): string[] => {
      if (!config.enablePrediction || partialQuery.length < 2) return [];

      const predictions: Array<{ query: string; score: number }> = [];

      // Get predictions from model
      for (const [query, entry] of predictionModelRef.current.entries()) {
        if (query.toLowerCase().includes(partialQuery.toLowerCase())) {
          const recencyFactor = Math.max(
            0,
            1 - (Date.now() - entry.lastUsed) / (24 * 60 * 60 * 1000)
          );
          const score = entry.probability * entry.frequency * recencyFactor;
          predictions.push({ query, score });
        }
      }

      // Get predictions from search patterns
      for (const pattern of searchPatternsRef.current) {
        if (
          pattern.toLowerCase().includes(partialQuery.toLowerCase()) &&
          !predictions.find(p => p.query === pattern)
        ) {
          predictions.push({ query: pattern, score: 0.3 });
        }
      }

      return predictions
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(p => p.query);
    },
    [config.enablePrediction]
  );

  const prefetchPredictions = useCallback(
    async (currentQuery: string): Promise<void> => {
      if (!config.enablePrediction) return;

      const predictions = predictQueries(currentQuery);
      const prefetchPromises = predictions
        .slice(0, 3) // Limit prefetch to top 3 predictions
        .map(async query => {
          try {
            const cached = await checkCache(query);
            if (!cached) {
              // Prefetch in background
              apiClient
                .search({ query, options: { limit: config.defaultLimit } })
                .then(response => {
                  if (response.success && response.data) {
                    storeInCache(query, response.data.results, {
                      totalCount: response.data.totalCount,
                      cacheMetrics: response.data.cacheMetrics,
                    });
                  }
                })
                .catch(() => {
                  /* Ignore prefetch errors */
                });
            }
          } catch (error) {
            console.warn(`Prefetch failed for query: ${query}`, error);
          }
        });

      await Promise.allSettled(prefetchPromises);
    },
    [
      config.enablePrediction,
      config.defaultLimit,
      predictQueries,
      checkCache,
      apiClient,
      storeInCache,
    ]
  );

  // ========================
  // Search Functions
  // ========================

  const performSearch = useCallback(
    async (
      query: string,
      options: SearchOptions = {},
      isLoadMore: boolean = false
    ): Promise<void> => {
      const requestId = `${query}-${Date.now()}`;
      currentRequestRef.current = requestId;

      const startTime = performance.now();

      try {
        // Update loading state
        setState(prev => ({
          ...prev,
          query,
          isLoading: !isLoadMore,
          isLoadingMore: isLoadMore,
          error: null,
          ...(isLoadMore ? {} : { results: [], loadedCount: 0, totalCount: 0 }),
        }));

        // Check cache first
        let cachedData: any = null;
        if (!isLoadMore) {
          cachedData = await checkCache(query, options);
        }

        let response: CacheApiResponse<SearchCacheResponse>;
        let fromCache = false;

        if (cachedData) {
          // Use cached data
          response = {
            success: true,
            data: {
              results: cachedData.results,
              totalCount: cachedData.metadata.totalCount,
              hasMore: cachedData.results.length < cachedData.metadata.totalCount,
              cacheMetrics: cachedData.metadata.cacheMetrics,
              suggestions: [],
            },
            timestamp: Date.now(),
            requestId,
            cached: true,
          };
          fromCache = true;

          // Update metrics for cache hit
          setMetrics(prev => ({
            ...prev,
            cachedRequests: prev.cachedRequests + 1,
            totalRequests: prev.totalRequests + 1,
            cacheHitRatio: (prev.cachedRequests + 1) / (prev.totalRequests + 1),
          }));
        } else {
          // Fetch from API
          if (config.enableIncremental && isLoadMore && state.nextToken) {
            response = await apiClient.searchIncremental(query, state.nextToken, {
              batchSize: options.limit || config.defaultLimit,
              enablePrediction: config.enablePrediction,
            });
          } else {
            response = await apiClient.search({
              query,
              options: {
                limit: options.limit || config.defaultLimit,
                offset: isLoadMore ? state.loadedCount : 0,
                includeMetadata: true,
                enablePrediction: config.enablePrediction,
                cacheStrategy: options.cacheStrategy || 'adaptive',
              },
            });
          }

          // Update metrics for network request
          setMetrics(prev => ({
            ...prev,
            networkRequests: prev.networkRequests + 1,
            totalRequests: prev.totalRequests + 1,
            cacheHitRatio: prev.cachedRequests / (prev.totalRequests + 1),
            bytesTransferred: prev.bytesTransferred + (response.performance?.bytesTransferred || 0),
          }));
        }

        // Check if this is still the current request
        if (currentRequestRef.current !== requestId) {
          return; // Request was superseded
        }

        if (!response.success) {
          throw new Error(response.error || 'Search failed');
        }

        const data = response.data!;
        const responseTime = performance.now() - startTime;

        // Update response times for metrics
        responseTimesRef.current.push(responseTime);
        if (responseTimesRef.current.length > 100) {
          responseTimesRef.current = responseTimesRef.current.slice(-100);
        }

        // Store in cache if not from cache and not incremental
        if (!fromCache && !isLoadMore) {
          await storeInCache(
            query,
            data.results,
            {
              totalCount: data.totalCount,
              cacheMetrics: data.cacheMetrics,
            },
            options
          );
        }

        // Update state
        setState(prev => {
          const newResults = isLoadMore ? [...prev.results, ...data.results] : data.results;

          return {
            ...prev,
            results: newResults,
            isLoading: false,
            isLoadingMore: false,
            hasMore: data.hasMore,
            totalCount: data.totalCount,
            loadedCount: newResults.length,
            progress: data.totalCount > 0 ? newResults.length / data.totalCount : 1,
            nextToken: data.nextToken,
          };
        });

        // Update cache metrics
        if (data.cacheMetrics) {
          setCacheMetrics(data.cacheMetrics);
        }

        // Update overall metrics
        const averageResponseTime =
          responseTimesRef.current.reduce((sum, time) => sum + time, 0) /
          responseTimesRef.current.length;
        setMetrics(prev => ({
          ...prev,
          responseTime,
          averageResponseTime,
          searchesPerformed: prev.searchesPerformed + 1,
          ...(fromCache && { predictiveHits: prev.predictiveHits + 1 }),
        }));

        // Update search patterns
        if (!searchPatternsRef.current.includes(query)) {
          searchPatternsRef.current.unshift(query);
          searchPatternsRef.current = searchPatternsRef.current.slice(0, 100); // Keep last 100 patterns

          // Store patterns in cache
          cacheManager
            .set(CACHE_KEYS.SEARCH_PATTERNS, searchPatternsRef.current)
            .catch(console.warn);
        }

        // Trigger prefetching for predictions
        if (config.enablePrediction && !isLoadMore) {
          prefetchPredictions(query).catch(console.warn);
        }
      } catch (error) {
        // Check if this is still the current request
        if (currentRequestRef.current !== requestId) {
          return;
        }

        const errorMessage = error instanceof Error ? error.message : 'Search failed';
        setState(prev => ({
          ...prev,
          isLoading: false,
          isLoadingMore: false,
          error: errorMessage,
        }));
      }
    },
    [
      config.enableIncremental,
      config.enablePrediction,
      config.defaultLimit,
      checkCache,
      apiClient,
      storeInCache,
      state.nextToken,
      state.loadedCount,
      cacheManager,
      prefetchPredictions,
    ]
  );

  const search = useCallback(
    async (query: string, options?: SearchOptions): Promise<void> => {
      await performSearch(query, options, false);
    },
    [performSearch]
  );

  const loadMore = useCallback(async (): Promise<void> => {
    if (!state.hasMore || state.isLoading || state.isLoadingMore) return;
    await performSearch(state.query, {}, true);
  }, [state.hasMore, state.isLoading, state.isLoadingMore, state.query, performSearch]);

  const clear = useCallback(() => {
    currentRequestRef.current = null;
    setState({
      query: '',
      results: [],
      isLoading: false,
      isLoadingMore: false,
      hasMore: false,
      error: null,
      totalCount: 0,
      loadedCount: 0,
      progress: 0,
    });
  }, []);

  const retry = useCallback(async (): Promise<void> => {
    if (state.query) {
      await search(state.query);
    }
  }, [state.query, search]);

  // ========================
  // Cache Functions
  // ========================

  const prefetch = useCallback(
    async (queries: string[]): Promise<void> => {
      const prefetchPromises = queries.map(async query => {
        try {
          const cached = await checkCache(query);
          if (!cached) {
            const response = await apiClient.search({
              query,
              options: { limit: config.defaultLimit },
            });

            if (response.success && response.data) {
              await storeInCache(query, response.data.results, {
                totalCount: response.data.totalCount,
                cacheMetrics: response.data.cacheMetrics,
              });
            }
          }
        } catch (error) {
          console.warn(`Prefetch failed for query: ${query}`, error);
        }
      });

      await Promise.allSettled(prefetchPromises);
    },
    [checkCache, apiClient, config.defaultLimit, storeInCache]
  );

  const invalidateCache = useCallback(
    async (pattern?: string): Promise<void> => {
      try {
        if (pattern) {
          await cacheManager.clear(pattern);
        } else {
          await cacheManager.clear('search_*');
        }

        // Also invalidate on backend
        await apiClient.invalidate({
          patterns: pattern ? [pattern] : ['search_*'],
        });
      } catch (error) {
        console.warn('Cache invalidation failed:', error);
      }
    },
    [cacheManager, apiClient]
  );

  const warmCache = useCallback(
    async (queries: string[]): Promise<void> => {
      try {
        await apiClient.warmup({
          patterns: queries,
          priority: 'normal',
          batchSize: 5,
        });

        // Also prefetch locally
        await prefetch(queries);
      } catch (error) {
        console.warn('Cache warming failed:', error);
      }
    },
    [apiClient, prefetch]
  );

  // ========================
  // Suggestion Functions
  // ========================

  const getSuggestions = useCallback(
    async (partialQuery: string): Promise<any[]> => {
      if (partialQuery.length < 2) return [];

      try {
        // Check cache first
        const cacheKey = CACHE_KEYS.SUGGESTIONS(partialQuery);
        const cached = await cacheManager.get<any[]>(cacheKey);

        if (cached) {
          return cached;
        }

        // Get from API
        const response = await apiClient.getSuggestions(partialQuery, {
          maxSuggestions: 10,
          enableML: config.enablePrediction,
        });

        if (response.success && response.data) {
          // Cache suggestions
          await cacheManager.set(cacheKey, response.data, {
            ttl: 5 * 60 * 1000, // 5 minutes
            tags: ['suggestions'],
          });

          return response.data;
        }
      } catch (error) {
        console.warn('Failed to get suggestions:', error);
      }

      // Fallback to local predictions
      const predictions = predictQueries(partialQuery);
      return predictions.map(query => ({
        text: query,
        type: 'prediction',
        confidence: 0.7,
        source: 'local_prediction',
      }));
    },
    [cacheManager, apiClient, config.enablePrediction, predictQueries]
  );

  // ========================
  // Utility Functions
  // ========================

  const exportMetrics = useCallback((): SearchMetrics => {
    return { ...metrics };
  }, [metrics]);

  const getPerformanceReport = useCallback((): string => {
    const report = [
      `Search Performance Report`,
      `========================`,
      `Total Searches: ${metrics.searchesPerformed}`,
      `Cache Hit Ratio: ${(metrics.cacheHitRatio * 100).toFixed(1)}%`,
      `Average Response Time: ${metrics.averageResponseTime.toFixed(0)}ms`,
      `Network Requests: ${metrics.networkRequests}`,
      `Cached Requests: ${metrics.cachedRequests}`,
      `Data Transferred: ${(metrics.bytesTransferred / 1024).toFixed(1)} KB`,
      `Data Saved: ${(metrics.bytesSaved / 1024).toFixed(1)} KB`,
      `Predictive Hits: ${metrics.predictiveHits}`,
      ``,
    ];

    if (cacheMetrics) {
      report.push(
        `Cache Metrics:`,
        `- Memory Pressure: ${(cacheMetrics.memoryPressure * 100).toFixed(1)}%`,
        `- Eviction Rate: ${cacheMetrics.evictionRate.toFixed(2)}/min`,
        `- Network Savings: ${(cacheMetrics.networkSavings / 1024).toFixed(1)} KB`
      );
    }

    return report.join('\n');
  }, [metrics, cacheMetrics]);

  // ========================
  // Effects
  // ========================

  // Load prediction model on mount
  useEffect(() => {
    const loadPredictionModel = async () => {
      try {
        const stored = await cacheManager.get<Array<[string, PredictiveCacheEntry]>>(
          CACHE_KEYS.PREDICTION_MODEL
        );
        if (stored) {
          predictionModelRef.current = new Map(stored);
        }

        const patterns = await cacheManager.get<string[]>(CACHE_KEYS.SEARCH_PATTERNS);
        if (patterns) {
          searchPatternsRef.current = patterns;
        }
      } catch (error) {
        console.warn('Failed to load prediction model:', error);
      }
    };

    loadPredictionModel();
  }, [cacheManager]);

  // Subscribe to cache metrics updates
  useEffect(() => {
    if (!config.enableMetrics) return;

    const unsubscribe = apiClient.subscribeToMetrics(newMetrics => {
      setCacheMetrics(newMetrics);
    });

    return () => {
      unsubscribe.then(fn => fn()).catch(console.warn);
    };
  }, [apiClient, config.enableMetrics]);

  return {
    state,
    metrics,
    cacheMetrics,
    search,
    loadMore,
    clear,
    retry,
    prefetch,
    invalidateCache,
    warmCache,
    getSuggestions,
    updatePredictionModel,
    exportMetrics,
    getPerformanceReport,
  };
};

export default useCacheAwareSearch;
