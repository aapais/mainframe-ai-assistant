/**
 * Advanced SearchContext State Flow Tests
 *
 * Comprehensive test suite for search state management with edge cases:
 * - Complex search flow scenarios
 * - Debounce and throttling behavior
 * - Cache management and invalidation
 * - Search result pagination and filtering
 * - AI/Local search fallback mechanisms
 * - Analytics and metrics tracking
 * - Error recovery and retry logic
 * - Race condition handling
 * - Memory optimization and cleanup
 * - Cross-session persistence
 *
 * @author State Management Testing Specialist
 * @version 2.0.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { render, renderHook, act, waitFor, screen, fireEvent } from '@testing-library/react';
import { SearchProvider, useSearch, useSearchQuery, useSearchResults, useSearchFilters, SearchState, SearchContextValue } from '../../src/renderer/contexts/SearchContext';
import { useApp } from '../../src/renderer/contexts/AppContext';
import { SearchResult, SearchOptions, KBCategory } from '../../src/types/services';

// Mock timers for debounce testing
jest.useFakeTimers();

// Mock dependencies
jest.mock('../../src/renderer/contexts/AppContext');
const mockUseApp = useApp as jest.MockedFunction<typeof useApp>;

// Mock localStorage with quota simulation
class MockLocalStorage {
  private store: Record<string, string> = {};
  private quota = 5 * 1024 * 1024; // 5MB quota
  private used = 0;

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    const size = new Blob([value]).size;
    if (this.used + size > this.quota) {
      throw new Error('QuotaExceededError: localStorage quota exceeded');
    }

    const oldSize = this.store[key] ? new Blob([this.store[key]]).size : 0;
    this.used = this.used - oldSize + size;
    this.store[key] = value;
  }

  removeItem(key: string): void {
    if (this.store[key]) {
      const size = new Blob([this.store[key]]).size;
      this.used -= size;
      delete this.store[key];
    }
  }

  clear(): void {
    this.store = {};
    this.used = 0;
  }

  setQuota(quota: number): void {
    this.quota = quota;
  }

  getUsage(): number {
    return this.used;
  }
}

const mockLocalStorage = new MockLocalStorage();
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Enhanced mock electronAPI with network simulation
const mockElectronAPI = {
  searchWithAI: jest.fn(),
  searchLocal: jest.fn(),
  _networkDelay: 0,
  _failureRate: 0,
  _responseSize: 'normal',

  setNetworkDelay: (delay: number) => {
    mockElectronAPI._networkDelay = delay;
  },

  setFailureRate: (rate: number) => {
    mockElectronAPI._failureRate = rate;
  },

  setResponseSize: (size: 'small' | 'normal' | 'large') => {
    mockElectronAPI._responseSize = size;
  },

  reset: () => {
    mockElectronAPI._networkDelay = 0;
    mockElectronAPI._failureRate = 0;
    mockElectronAPI._responseSize = 'normal';
  },
};

// Mock search with network simulation
const createMockSearch = (response: any) => {
  return jest.fn().mockImplementation(() => {
    return new Promise((resolve, reject) => {
      // Simulate network delay
      setTimeout(() => {
        // Simulate random failures
        if (Math.random() < mockElectronAPI._failureRate) {
          reject(new Error('Network error'));
          return;
        }

        // Simulate different response sizes
        let results = Array.isArray(response) ? response : response.results || [];

        switch (mockElectronAPI._responseSize) {
          case 'small':
            results = results.slice(0, 2);
            break;
          case 'large':
            results = [...results, ...Array(100).fill(results[0]).map((r, i) => ({ ...r, id: `${r.id}-${i}` }))];
            break;
        }

        resolve(Array.isArray(response) ? results : { ...response, results });
      }, mockElectronAPI._networkDelay);
    });
  });
};

// @ts-ignore
global.window.electronAPI = mockElectronAPI;

// Test data generators
const generateMockResult = (id: string, score: number = 0.9): SearchResult => ({
  entry: {
    id,
    title: `Test Entry ${id}`,
    problem: `Problem description for ${id}`,
    solution: `Solution for ${id}`,
    category: 'VSAM',
    tags: ['test', 'mock'],
    created_at: new Date(),
    updated_at: new Date(),
    usage_count: Math.floor(Math.random() * 100),
    success_count: Math.floor(Math.random() * 50),
    failure_count: Math.floor(Math.random() * 10),
  },
  score,
  matchType: 'ai',
});

const generateMockResults = (count: number): SearchResult[] => {
  return Array.from({ length: count }, (_, i) => generateMockResult(`entry-${i}`, 0.9 - i * 0.1));
};

// Performance monitoring
interface SearchPerformanceMetrics {
  searchCount: number;
  totalSearchTime: number;
  averageSearchTime: number;
  cacheHitRate: number;
  memoryUsage: number;
}

const useSearchPerformanceMonitor = () => {
  const metricsRef = useRef<SearchPerformanceMetrics>({
    searchCount: 0,
    totalSearchTime: 0,
    averageSearchTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
  });

  const startTimer = () => performance.now();

  const endTimer = (startTime: number, cacheHit = false) => {
    const endTime = performance.now();
    const searchTime = endTime - startTime;

    metricsRef.current.searchCount++;
    metricsRef.current.totalSearchTime += searchTime;
    metricsRef.current.averageSearchTime = metricsRef.current.totalSearchTime / metricsRef.current.searchCount;

    if (cacheHit) {
      metricsRef.current.cacheHitRate =
        (metricsRef.current.cacheHitRate * (metricsRef.current.searchCount - 1) + 1) / metricsRef.current.searchCount;
    }

    if ((performance as any).memory) {
      metricsRef.current.memoryUsage = (performance as any).memory.usedJSHeapSize;
    }
  };

  return { metrics: metricsRef.current, startTimer, endTimer };
};

// Test wrapper with configuration options
interface TestWrapperOptions {
  initialState?: Partial<SearchState>;
  cacheTimeout?: number;
  debounceDelay?: number;
  enableOfflineSearch?: boolean;
  enablePerformanceMonitoring?: boolean;
}

const createTestWrapper = (options: TestWrapperOptions = {}) => {
  const {
    initialState,
    cacheTimeout = 5000,
    debounceDelay = 300,
    enableOfflineSearch = true,
    enablePerformanceMonitoring = false,
  } = options;

  return ({ children }: { children: React.ReactNode }) => {
    // Mock app context
    mockUseApp.mockReturnValue({
      addNotification: jest.fn(),
      setLoading: jest.fn(),
      updateLastActivity: jest.fn(),
      state: {
        isLoading: false,
        notifications: [],
        currentView: 'search',
        theme: 'system',
        accessibility: {
          isScreenReaderActive: false,
          isHighContrastMode: false,
          isReducedMotionMode: false,
          fontSize: 'medium',
        },
        status: {
          isOnline: true,
          isDatabaseConnected: true,
          isAIServiceAvailable: true,
          lastActivity: new Date(),
        },
      },
    } as any);

    return (
      <SearchProvider
        initialState={initialState}
        cacheTimeout={cacheTimeout}
        debounceDelay={debounceDelay}
        enableOfflineSearch={enableOfflineSearch}
      >
        {enablePerformanceMonitoring && <PerformanceMonitor />}
        {children}
      </SearchProvider>
    );
  };
};

// Performance monitoring component
const PerformanceMonitor = () => {
  const { metrics } = useSearchPerformanceMonitor();
  const search = useSearch();

  useEffect(() => {
    // Monitor search state changes
    console.log('Search state changed:', {
      query: search.state.query,
      resultCount: search.state.results.length,
      isSearching: search.state.isSearching,
    });
  }, [search.state.query, search.state.results.length, search.state.isSearching]);

  return (
    <div
      data-testid="performance-monitor"
      data-search-count={metrics.searchCount}
      data-average-time={metrics.averageSearchTime}
      data-cache-hit-rate={metrics.cacheHitRate}
      data-memory-usage={metrics.memoryUsage}
    />
  );
};

describe('SearchContext - Advanced State Flow Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    mockLocalStorage.clear();
    mockElectronAPI.reset();

    // Reset mock implementations
    mockElectronAPI.searchWithAI = createMockSearch(generateMockResults(5));
    mockElectronAPI.searchLocal = createMockSearch(generateMockResults(3));
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('Complex Search Flow Scenarios', () => {
    it('should handle rapid consecutive searches with debouncing', async () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({ debounceDelay: 300 }),
      });

      // Rapid fire multiple searches
      act(() => {
        result.current.setQuery('query1');
        result.current.performSearch();
      });

      act(() => {
        result.current.setQuery('query2');
        result.current.performSearch();
      });

      act(() => {
        result.current.setQuery('query3');
        result.current.performSearch();
      });

      act(() => {
        result.current.setQuery('query4');
        result.current.performSearch();
      });

      // Only one search should be pending due to debouncing
      expect(result.current.state.isSearching).toBe(true);

      // Fast-forward to trigger debounced search
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Wait for async operations
      await waitFor(() => {
        expect(result.current.state.isSearching).toBe(false);
      });

      // Only the last query should have been executed
      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledTimes(1);
      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledWith('query4', expect.any(Object));
    });

    it('should handle search cancellation and new search initiation', async () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({ debounceDelay: 500 }),
      });

      // Start first search
      act(() => {
        result.current.setQuery('first search');
        result.current.performSearch();
      });

      expect(result.current.state.isSearching).toBe(true);

      // Immediately start second search (should cancel first)
      act(() => {
        result.current.setQuery('second search');
        result.current.performSearch();
      });

      // Fast-forward to complete debounce
      act(() => {
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(result.current.state.isSearching).toBe(false);
      });

      // Only second search should execute
      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledTimes(1);
      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledWith('second search', expect.any(Object));
    });

    it('should handle concurrent AI and local search requests gracefully', async () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      // Mock AI search to fail
      mockElectronAPI.searchWithAI = createMockSearch(new Error('AI service unavailable'));
      mockElectronAPI.searchLocal = createMockSearch(generateMockResults(2));

      act(() => {
        result.current.setQuery('test query');
      });

      await act(async () => {
        await result.current.performSearch();
      });

      await waitFor(() => {
        expect(result.current.state.isSearching).toBe(false);
      });

      // Should fallback to local search
      expect(mockElectronAPI.searchWithAI).toHaveBeenCalled();
      expect(mockElectronAPI.searchLocal).toHaveBeenCalled();
      expect(result.current.state.results).toHaveLength(2);
      expect(result.current.state.searchMetrics?.fallbackUsed).toBe(true);
    });

    it('should handle search with dynamic filter changes', async () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      // Initial search
      act(() => {
        result.current.setQuery('initial query');
      });

      await act(async () => {
        await result.current.performSearch();
      });

      expect(result.current.state.results).toHaveLength(5);

      // Change filters mid-search session
      act(() => {
        result.current.updateFilters({
          category: 'JCL',
          sortBy: 'usage',
          sortOrder: 'desc',
        });
      });

      // Search with new filters
      await act(async () => {
        await result.current.performSearch();
      });

      expect(mockElectronAPI.searchWithAI).toHaveBeenLastCalledWith(
        'initial query',
        expect.objectContaining({
          category: 'JCL',
          sortBy: 'usage',
          sortOrder: 'desc',
        })
      );
    });
  });

  describe('Cache Management and Performance', () => {
    it('should cache search results effectively', async () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({ cacheTimeout: 10000 }),
      });

      const query = 'cacheable query';

      // First search - should hit API
      await act(async () => {
        await result.current.performSearchWithCache(query);
      });

      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledTimes(1);

      // Second search - should use cache
      await act(async () => {
        await result.current.performSearchWithCache(query);
      });

      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledTimes(1); // No additional calls
      expect(result.current.state.searchMetrics?.cacheHit).toBe(true);
    });

    it('should handle cache invalidation correctly', async () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({ cacheTimeout: 10000 }),
      });

      const query = 'invalidation test';

      // Initial search
      await act(async () => {
        await result.current.performSearchWithCache(query);
      });

      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledTimes(1);

      // Clear cache
      act(() => {
        result.current.clearSearchCache();
      });

      // Search again - should hit API
      await act(async () => {
        await result.current.performSearchWithCache(query);
      });

      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledTimes(2);
    });

    it('should handle cache expiration', async () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({ cacheTimeout: 100 }),
      });

      const query = 'expiring cache test';

      // Initial search
      await act(async () => {
        await result.current.performSearchWithCache(query);
      });

      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      act(() => {
        jest.advanceTimersByTime(150);
      });

      // Search again - should hit API due to expired cache
      await act(async () => {
        await result.current.performSearchWithCache(query);
      });

      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledTimes(2);
    });

    it('should manage memory efficiently with large result sets', async () => {
      mockElectronAPI.setResponseSize('large');

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({ enablePerformanceMonitoring: true }),
      });

      const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Perform multiple searches with large result sets
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          result.current.setQuery(`large search ${i}`);
          await result.current.performSearch();
        });

        act(() => {
          jest.advanceTimersByTime(50);
        });
      }

      const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = endMemory - startMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Analytics and Metrics Tracking', () => {
    it('should track comprehensive search analytics', async () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      // Perform multiple searches with different outcomes
      const searches = [
        { query: 'successful query 1', shouldSucceed: true },
        { query: 'successful query 2', shouldSucceed: true },
        { query: 'failing query', shouldSucceed: false },
        { query: 'successful query 1', shouldSucceed: true }, // Repeat query
      ];

      for (const { query, shouldSucceed } of searches) {
        if (shouldSucceed) {
          mockElectronAPI.searchWithAI = createMockSearch(generateMockResults(3));
        } else {
          mockElectronAPI.searchWithAI = createMockSearch([]);
        }

        await act(async () => {
          result.current.setQuery(query);
          await result.current.performSearch();
        });

        act(() => {
          jest.advanceTimersByTime(100);
        });
      }

      const analytics = result.current.getSearchAnalytics();

      expect(analytics.totalSearches).toBe(4);
      expect(analytics.successRate).toBe(0.75); // 3 successful out of 4
      expect(analytics.noResultQueries).toContain('failing query');
      expect(analytics.popularQueries.find(pq => pq.query === 'successful query 1')?.count).toBe(2);
    });

    it('should track cache performance metrics', async () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({ cacheTimeout: 10000 }),
      });

      const queries = ['query1', 'query2', 'query1', 'query3', 'query2'];

      for (const query of queries) {
        await act(async () => {
          await result.current.performSearchWithCache(query);
        });
      }

      const cacheStats = result.current.getCacheStats();

      expect(cacheStats.hitCount).toBe(2); // query1 and query2 repeated
      expect(cacheStats.missCount).toBe(3); // First occurrence of each query
      expect(cacheStats.hitRate).toBe(0.4); // 2/5
    });

    it('should track response time metrics accurately', async () => {
      mockElectronAPI.setNetworkDelay(100);

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      await act(async () => {
        result.current.setQuery('response time test');
        await result.current.performSearch();
      });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      await waitFor(() => {
        expect(result.current.state.isSearching).toBe(false);
      });

      const analytics = result.current.getSearchAnalytics();
      expect(analytics.averageResponseTime).toBeGreaterThan(100);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network failures gracefully', async () => {
      mockElectronAPI.setFailureRate(1.0); // 100% failure rate

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      await act(async () => {
        result.current.setQuery('network failure test');
        await result.current.performSearch();
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(result.current.state.isSearching).toBe(false);
      });

      expect(result.current.state.searchError).toBeTruthy();
      expect(result.current.state.results).toHaveLength(0);
    });

    it('should implement exponential backoff for retries', async () => {
      let attemptCount = 0;
      mockElectronAPI.searchWithAI = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve(generateMockResults(2));
      });

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      // Mock retry mechanism (simplified for testing)
      const performSearchWithRetry = async (query: string, maxRetries = 3) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            await result.current.performSearch(query);
            return;
          } catch (error) {
            if (attempt === maxRetries) throw error;

            // Exponential backoff: 100ms, 200ms, 400ms
            const delay = 100 * Math.pow(2, attempt - 1);
            act(() => {
              jest.advanceTimersByTime(delay);
            });
          }
        }
      };

      await act(async () => {
        result.current.setQuery('retry test');
        await performSearchWithRetry('retry test');
      });

      expect(attemptCount).toBe(3);
      expect(result.current.state.results).toHaveLength(2);
    });

    it('should handle corrupted localStorage gracefully', async () => {
      // Corrupt localStorage
      mockLocalStorage.setItem('kb-search-history', 'invalid-json{');
      mockLocalStorage.setItem('kb-search-analytics', 'also-invalid}');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      // Should not crash and should fall back to empty state
      expect(result.current.state.searchHistory).toEqual([]);
      expect(result.current.state.searchAnalytics.totalSearches).toBe(0);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load search data:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle localStorage quota exceeded', async () => {
      mockLocalStorage.setQuota(1024); // Very small quota

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Generate large search history
      const largeHistory = Array.from({ length: 1000 }, (_, i) => `very long query number ${i} with lots of text to exceed quota`);

      act(() => {
        largeHistory.forEach(query => {
          result.current.addToHistory(query);
        });
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save search data:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Race Condition Handling', () => {
    it('should handle overlapping search requests correctly', async () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({ debounceDelay: 0 }), // Disable debouncing for this test
      });

      // Mock slow network response
      let resolveCount = 0;
      const resolvers: Array<(value: any) => void> = [];

      mockElectronAPI.searchWithAI = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolvers.push(resolve);
        });
      });

      // Start multiple concurrent searches
      const promises = [
        act(async () => {
          result.current.setQuery('query1');
          return result.current.performSearch();
        }),
        act(async () => {
          result.current.setQuery('query2');
          return result.current.performSearch();
        }),
        act(async () => {
          result.current.setQuery('query3');
          return result.current.performSearch();
        }),
      ];

      // Resolve requests in reverse order (simulate race condition)
      act(() => {
        resolvers[2]?.(generateMockResults(3));
        resolvers[1]?.(generateMockResults(2));
        resolvers[0]?.(generateMockResults(1));
      });

      await Promise.all(promises);

      // Should use the result from the last query
      expect(result.current.state.query).toBe('query3');
      expect(result.current.state.results).toHaveLength(3);
    });

    it('should handle rapid filter changes during search', async () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      // Start search
      await act(async () => {
        result.current.setQuery('filter race test');
        result.current.performSearch();
      });

      // Rapidly change filters while search is in progress
      act(() => {
        result.current.updateFilters({ category: 'JCL' });
        result.current.updateFilters({ category: 'VSAM' });
        result.current.updateFilters({ category: 'DB2' });
        result.current.updateFilters({ sortBy: 'usage' });
      });

      await waitFor(() => {
        expect(result.current.state.isSearching).toBe(false);
      });

      // Final filter state should be consistent
      expect(result.current.state.filters.category).toBe('DB2');
      expect(result.current.state.filters.sortBy).toBe('usage');
    });
  });

  describe('Suggestion Generation', () => {
    it('should generate intelligent suggestions based on history and patterns', async () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({
          initialState: {
            searchHistory: [
              'VSAM error handling',
              'VSAM file allocation',
              'JCL step error',
              'DB2 connection pool',
              'VSAM performance tuning',
            ],
            searchAnalytics: {
              totalSearches: 10,
              averageResponseTime: 500,
              successRate: 0.8,
              noResultQueries: [],
              popularQueries: [
                { query: 'VSAM catalog error', count: 5 },
                { query: 'JCL compilation error', count: 3 },
                { query: 'DB2 deadlock resolution', count: 2 },
              ],
            },
          },
        }),
      });

      const suggestions = await result.current.generateSuggestions('VSAM');

      expect(suggestions).toContain('VSAM error handling');
      expect(suggestions).toContain('VSAM file allocation');
      expect(suggestions).toContain('VSAM performance tuning');
      expect(suggestions).toContain('VSAM catalog error');
      expect(suggestions).not.toContain('JCL step error');
      expect(suggestions).not.toContain('DB2 connection pool');
    });

    it('should cache suggestions for performance', async () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({
          initialState: {
            searchHistory: ['VSAM test 1', 'VSAM test 2'],
          },
        }),
      });

      // First call
      const suggestions1 = await result.current.generateSuggestions('VSAM');

      // Second call with same query - should be instant
      const startTime = performance.now();
      const suggestions2 = await result.current.generateSuggestions('VSAM');
      const endTime = performance.now();

      expect(suggestions1).toEqual(suggestions2);
      expect(endTime - startTime).toBeLessThan(5); // Should be very fast due to caching
    });

    it('should limit suggestions appropriately', async () => {
      const longHistory = Array.from({ length: 50 }, (_, i) => `VSAM query ${i}`);

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({
          initialState: {
            searchHistory: longHistory,
          },
        }),
      });

      const suggestions = await result.current.generateSuggestions('VSAM');

      expect(suggestions.length).toBeLessThanOrEqual(8);
    });
  });

  describe('Preloading and Optimization', () => {
    it('should preload search results effectively', async () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      const queriesToPreload = ['preload query 1', 'preload query 2', 'preload query 3'];

      await act(async () => {
        await result.current.preloadSearchResults(queriesToPreload);
      });

      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledTimes(3);

      // Subsequent searches should use cached results
      for (const query of queriesToPreload) {
        await act(async () => {
          await result.current.performSearchWithCache(query);
        });
      }

      // Should not make additional API calls
      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledTimes(3);
    });

    it('should handle preload errors gracefully', async () => {
      mockElectronAPI.setFailureRate(0.5); // 50% failure rate

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await act(async () => {
        await result.current.preloadSearchResults(['failing query 1', 'failing query 2']);
      });

      // Should have attempted both preloads
      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledTimes(2);

      // Should log warnings for failures but not crash
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Cross-Session Persistence', () => {
    it('should persist and restore search state across sessions', async () => {
      // First session
      {
        const { result } = renderHook(() => useSearch(), {
          wrapper: createTestWrapper(),
        });

        await act(async () => {
          result.current.setQuery('persistent query');
          await result.current.performSearch();
        });

        act(() => {
          result.current.addToHistory('session query 1');
          result.current.addToHistory('session query 2');
        });
      }

      // Simulate page reload - second session
      {
        const { result } = renderHook(() => useSearch(), {
          wrapper: createTestWrapper(),
        });

        await waitFor(() => {
          expect(result.current.state.searchHistory).toContain('session query 1');
          expect(result.current.state.searchHistory).toContain('session query 2');
        });

        expect(result.current.state.searchAnalytics.totalSearches).toBe(1);
      }
    });

    it('should handle corrupted persistence data gracefully', async () => {
      // Corrupt the stored data
      mockLocalStorage.setItem('kb-search-history', '{"invalid": json}');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      // Should not crash and should use default state
      expect(result.current.state.searchHistory).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});