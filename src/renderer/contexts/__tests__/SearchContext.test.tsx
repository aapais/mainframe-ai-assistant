/**
 * Unit Tests for SearchContext
 * 
 * Tests for the Enhanced Search Context provider including:
 * - Context provider initialization and state management
 * - Search execution with debouncing and caching
 * - AI and local search fallback mechanisms
 * - Search filters and pagination
 * - Search history and suggestions
 * - Performance monitoring and analytics
 * - Cache management and optimization
 * - Error handling and offline functionality
 * 
 * @author Test Engineer
 * @version 2.0.0
 */

import React from 'react';
import { render, renderHook, act, waitFor, screen } from '@testing-library/react';
import { SearchProvider, useSearch, useSearchQuery, useSearchResults, SearchState } from '../SearchContext';
import { SearchResult, SearchOptions, KBCategory } from '../../../types/services';
import { useApp } from '../AppContext';

// Mock dependencies
jest.mock('../AppContext');
const mockUseApp = useApp as jest.MockedFunction<typeof useApp>;

// Mock electron API
const mockElectronAPI = {
  searchWithAI: jest.fn(),
  searchLocal: jest.fn(),
};

// @ts-ignore
global.window.electronAPI = mockElectronAPI;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Test utilities
const mockSearchResult: SearchResult = {
  entry: {
    id: 'test-entry-1',
    title: 'Test Entry',
    problem: 'Test problem',
    solution: 'Test solution',
    category: 'VSAM',
    tags: ['test', 'vsam'],
    created_at: new Date(),
    updated_at: new Date(),
    usage_count: 5,
    success_count: 4,
    failure_count: 1,
  },
  score: 0.95,
  matchType: 'ai',
};

const mockSearchResult2: SearchResult = {
  entry: {
    id: 'test-entry-2',
    title: 'Another Entry',
    problem: 'Another problem',
    solution: 'Another solution',
    category: 'JCL',
    tags: ['test', 'jcl'],
    created_at: new Date(),
    updated_at: new Date(),
    usage_count: 3,
    success_count: 2,
    failure_count: 1,
  },
  score: 0.87,
  matchType: 'fuzzy',
};

const createTestWrapper = (
  initialState?: Partial<SearchState>,
  options: {
    cacheTimeout?: number;
    debounceDelay?: number;
    enableOfflineSearch?: boolean;
  } = {}
) => {
  return ({ children }: { children: React.ReactNode }) => {
    // Mock app context
    mockUseApp.mockReturnValue({
      addNotification: jest.fn(),
      setLoading: jest.fn(),
      updateLastActivity: jest.fn(),
    } as any);

    return (
      <SearchProvider 
        initialState={initialState}
        cacheTimeout={options.cacheTimeout}
        debounceDelay={options.debounceDelay}
        enableOfflineSearch={options.enableOfflineSearch}
      >
        {children}
      </SearchProvider>
    );
  };
};

describe('SearchContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockReturnValue(undefined);
  });

  describe('Provider Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      expect(result.current.state.query).toBe('');
      expect(result.current.state.results).toEqual([]);
      expect(result.current.state.isSearching).toBe(false);
      expect(result.current.state.useAI).toBe(true);
      expect(result.current.state.searchHistory).toEqual([]);
      expect(result.current.state.suggestions).toEqual([]);
      expect(result.current.state.filters.sortBy).toBe('relevance');
      expect(result.current.state.filters.sortOrder).toBe('desc');
    });

    it('should initialize with custom initial state', () => {
      const initialState = {
        query: 'test query',
        useAI: false,
        filters: { sortBy: 'usage' as const, sortOrder: 'asc' as const },
        pageSize: 10,
      };

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(initialState),
      });

      expect(result.current.state.query).toBe('test query');
      expect(result.current.state.useAI).toBe(false);
      expect(result.current.state.filters.sortBy).toBe('usage');
      expect(result.current.state.filters.sortOrder).toBe('asc');
      expect(result.current.state.pageSize).toBe(10);
    });

    it('should throw error when used outside provider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      expect(() => {
        renderHook(() => useSearch());
      }).toThrow('useSearch must be used within a SearchProvider');
      
      consoleSpy.mockRestore();
    });

    it('should load search history from localStorage on mount', () => {
      const savedHistory = ['query 1', 'query 2', 'query 3'];
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'kb-search-history') {
          return JSON.stringify(savedHistory);
        }
        return null;
      });

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      expect(result.current.state.searchHistory).toEqual(savedHistory);
    });
  });

  describe('Search Execution', () => {
    it('should perform AI search successfully', async () => {
      mockElectronAPI.searchWithAI.mockResolvedValue({
        results: [mockSearchResult],
        totalResults: 1,
      });

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      await act(async () => {
        await result.current.performSearch('test query');
      });

      expect(result.current.state.results).toEqual([mockSearchResult]);
      expect(result.current.state.totalResults).toBe(1);
      expect(result.current.state.isSearching).toBe(false);
      expect(result.current.state.searchError).toBeUndefined();
      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledWith('test query', expect.any(Object));
    });

    it('should handle array response format', async () => {
      mockElectronAPI.searchWithAI.mockResolvedValue([mockSearchResult, mockSearchResult2]);

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      await act(async () => {
        await result.current.performSearch('test query');
      });

      expect(result.current.state.results).toEqual([mockSearchResult, mockSearchResult2]);
      expect(result.current.state.totalResults).toBe(2);
    });

    it('should fallback to local search when AI fails', async () => {
      mockElectronAPI.searchWithAI.mockRejectedValue(new Error('AI search failed'));
      mockElectronAPI.searchLocal.mockResolvedValue([mockSearchResult2]);

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      await act(async () => {
        await result.current.performSearch('test query');
      });

      expect(result.current.state.results).toEqual([mockSearchResult2]);
      expect(result.current.state.searchMetrics?.fallbackUsed).toBe(true);
      expect(mockElectronAPI.searchLocal).toHaveBeenCalled();
    });

    it('should perform local search when AI is disabled', async () => {
      mockElectronAPI.searchLocal.mockResolvedValue([mockSearchResult2]);

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({ useAI: false }),
      });

      await act(async () => {
        await result.current.performSearch('test query');
      });

      expect(result.current.state.results).toEqual([mockSearchResult2]);
      expect(mockElectronAPI.searchLocal).toHaveBeenCalled();
      expect(mockElectronAPI.searchWithAI).not.toHaveBeenCalled();
    });

    it('should handle search errors', async () => {
      const error = new Error('Search failed');
      mockElectronAPI.searchWithAI.mockRejectedValue(error);
      mockElectronAPI.searchLocal.mockRejectedValue(error);

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      await act(async () => {
        await result.current.performSearch('test query');
      });

      expect(result.current.state.isSearching).toBe(false);
      expect(result.current.state.searchError).toBe('Search failed');
      expect(result.current.state.results).toEqual([]);
    });

    it('should not search with empty query', async () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      await act(async () => {
        await result.current.performSearch('');
      });

      expect(mockElectronAPI.searchWithAI).not.toHaveBeenCalled();
      expect(mockElectronAPI.searchLocal).not.toHaveBeenCalled();
    });

    it('should include search options in request', async () => {
      mockElectronAPI.searchWithAI.mockResolvedValue([mockSearchResult]);

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      // Set filters first
      act(() => {
        result.current.updateFilters({ 
          category: 'VSAM',
          tags: ['test'],
          sortBy: 'usage',
          sortOrder: 'asc'
        });
      });

      await act(async () => {
        await result.current.performSearch('test query');
      });

      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledWith('test query', {
        query: 'test query',
        category: 'VSAM',
        tags: ['test'],
        sortBy: 'usage',
        sortOrder: 'asc',
        useAI: true,
        page: 1,
        pageSize: 20,
      });
    });
  });

  describe('Search with Cache', () => {
    it('should use cached results when available', async () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(undefined, { cacheTimeout: 10000 }),
      });

      // First search - should hit API
      mockElectronAPI.searchWithAI.mockResolvedValue([mockSearchResult]);

      await act(async () => {
        await result.current.performSearchWithCache('test query');
      });

      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledTimes(1);

      // Second search - should use cache
      await act(async () => {
        await result.current.performSearchWithCache('test query');
      });

      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledTimes(1); // No additional API call
      expect(result.current.state.searchMetrics?.cacheHit).toBe(true);
    });

    it('should update cache statistics correctly', async () => {
      mockElectronAPI.searchWithAI.mockResolvedValue([mockSearchResult]);

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      // Cache miss
      await act(async () => {
        await result.current.performSearchWithCache('test query 1');
      });

      // Cache hit
      await act(async () => {
        await result.current.performSearchWithCache('test query 1');
      });

      const cacheStats = result.current.getCacheStats();
      expect(cacheStats.hitCount).toBe(1);
      expect(cacheStats.missCount).toBe(1);
      expect(cacheStats.hitRate).toBe(0.5);
    });
  });

  describe('Query Management', () => {
    it('should set query and reset page', () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({ currentPage: 3 }),
      });

      act(() => {
        result.current.setQuery('new query');
      });

      expect(result.current.state.query).toBe('new query');
      expect(result.current.state.currentPage).toBe(1);
    });

    it('should clear query', () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({ query: 'existing query' }),
      });

      act(() => {
        result.current.clearQuery();
      });

      expect(result.current.state.query).toBe('');
    });
  });

  describe('Filters and Options', () => {
    it('should update filters and reset page', () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({ currentPage: 3 }),
      });

      act(() => {
        result.current.updateFilters({ 
          category: 'DB2',
          tags: ['database'],
          sortBy: 'recent'
        });
      });

      expect(result.current.state.filters.category).toBe('DB2');
      expect(result.current.state.filters.tags).toEqual(['database']);
      expect(result.current.state.filters.sortBy).toBe('recent');
      expect(result.current.state.currentPage).toBe(1);
    });

    it('should reset filters', () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({
          filters: { 
            category: 'VSAM',
            tags: ['test'],
            sortBy: 'usage',
            sortOrder: 'asc'
          }
        }),
      });

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.state.filters).toEqual({
        sortBy: 'relevance',
        sortOrder: 'desc',
      });
    });

    it('should toggle AI usage', () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({ useAI: true }),
      });

      act(() => {
        result.current.setUseAI(false);
      });

      expect(result.current.state.useAI).toBe(false);
    });
  });

  describe('Search History', () => {
    it('should add query to history', () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.addToHistory('test query');
      });

      expect(result.current.state.searchHistory).toEqual(['test query']);
    });

    it('should not add duplicate queries to history', () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({
          searchHistory: ['test query'],
        }),
      });

      act(() => {
        result.current.addToHistory('test query');
      });

      expect(result.current.state.searchHistory).toEqual(['test query']);
    });

    it('should limit history to 20 items', () => {
      const existingHistory = Array.from({ length: 20 }, (_, i) => `query ${i}`);
      
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({ searchHistory: existingHistory }),
      });

      act(() => {
        result.current.addToHistory('new query');
      });

      expect(result.current.state.searchHistory).toHaveLength(20);
      expect(result.current.state.searchHistory[0]).toBe('new query');
      expect(result.current.state.searchHistory).not.toContain('query 19');
    });

    it('should clear search history', () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({
          searchHistory: ['query 1', 'query 2'],
        }),
      });

      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.state.searchHistory).toEqual([]);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('kb-search-history');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('kb-search-analytics');
    });

    it('should get search history', () => {
      const history = ['query 1', 'query 2'];
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({ searchHistory: history }),
      });

      const retrievedHistory = result.current.getSearchHistory();
      expect(retrievedHistory).toEqual(history);
    });
  });

  describe('Suggestions', () => {
    it('should update suggestions', () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      const suggestions = ['suggestion 1', 'suggestion 2'];
      act(() => {
        result.current.updateSuggestions(suggestions);
      });

      expect(result.current.state.suggestions).toEqual(suggestions);
    });

    it('should generate suggestions from history and popular queries', async () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({
          searchHistory: ['VSAM error', 'VSAM status 35', 'JCL error'],
          searchAnalytics: {
            totalSearches: 10,
            averageResponseTime: 500,
            successRate: 0.8,
            noResultQueries: [],
            popularQueries: [
              { query: 'VSAM file error', count: 5 },
              { query: 'DB2 connection', count: 3 },
            ],
          },
        }),
      });

      const suggestions = await result.current.generateSuggestions('VSAM');

      expect(suggestions).toContain('VSAM error');
      expect(suggestions).toContain('VSAM status 35');
      expect(suggestions).toContain('VSAM file error');
      expect(suggestions).not.toContain('JCL error');
      expect(suggestions).not.toContain('DB2 connection');
    });

    it('should return empty suggestions for empty query', async () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      const suggestions = await result.current.generateSuggestions('');
      expect(suggestions).toEqual([]);
    });

    it('should limit suggestions to 8 items', async () => {
      const longHistory = Array.from({ length: 15 }, (_, i) => `VSAM query ${i}`);
      
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({
          searchHistory: longHistory,
        }),
      });

      const suggestions = await result.current.generateSuggestions('VSAM');
      expect(suggestions.length).toBeLessThanOrEqual(8);
    });
  });

  describe('Pagination', () => {
    it('should set page number', () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.setPage(3);
      });

      expect(result.current.state.currentPage).toBe(3);
    });
  });

  describe('Analytics', () => {
    it('should track search analytics', async () => {
      mockElectronAPI.searchWithAI.mockResolvedValue([mockSearchResult]);

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      await act(async () => {
        await result.current.performSearch('test query');
      });

      const analytics = result.current.getSearchAnalytics();
      expect(analytics.totalSearches).toBe(1);
      expect(analytics.successRate).toBe(1); // 100% success rate
      expect(analytics.popularQueries).toContainEqual({ query: 'test query', count: 1 });
    });

    it('should track no-result queries', async () => {
      mockElectronAPI.searchWithAI.mockResolvedValue([]);

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      await act(async () => {
        await result.current.performSearch('no results query');
      });

      const analytics = result.current.getSearchAnalytics();
      expect(analytics.noResultQueries).toContain('no results query');
      expect(analytics.successRate).toBe(0);
    });

    it('should increment popular query counts', async () => {
      mockElectronAPI.searchWithAI.mockResolvedValue([mockSearchResult]);

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      // Search same query multiple times
      await act(async () => {
        await result.current.performSearch('popular query');
      });

      await act(async () => {
        await result.current.performSearch('popular query');
      });

      const analytics = result.current.getSearchAnalytics();
      const popularQuery = analytics.popularQueries.find(pq => pq.query === 'popular query');
      expect(popularQuery?.count).toBe(2);
    });

    it('should limit popular queries to 20 items', async () => {
      mockElectronAPI.searchWithAI.mockResolvedValue([mockSearchResult]);

      // Pre-populate with 20 popular queries
      const existingPopularQueries = Array.from({ length: 20 }, (_, i) => ({
        query: `query ${i}`,
        count: i + 1,
      }));

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({
          searchAnalytics: {
            totalSearches: 0,
            averageResponseTime: 0,
            successRate: 1,
            noResultQueries: [],
            popularQueries: existingPopularQueries,
          },
        }),
      });

      await act(async () => {
        await result.current.performSearch('new popular query');
      });

      const analytics = result.current.getSearchAnalytics();
      expect(analytics.popularQueries).toHaveLength(20);
      expect(analytics.popularQueries[0].query).toBe('query 19'); // Highest count should be first
    });

    it('should calculate average response time correctly', async () => {
      mockElectronAPI.searchWithAI.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve([mockSearchResult]), 100);
        });
      });

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      await act(async () => {
        await result.current.performSearch('test query');
      });

      const analytics = result.current.getSearchAnalytics();
      expect(analytics.averageResponseTime).toBeGreaterThan(90); // Should be around 100ms
    });
  });

  describe('Cache Management', () => {
    it('should clear search cache', () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.clearSearchCache();
      });

      // Should not throw any errors
      expect(result.current.state.suggestions).toEqual([]);
    });

    it('should preload search results', async () => {
      mockElectronAPI.searchWithAI.mockResolvedValue([mockSearchResult]);

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      await act(async () => {
        await result.current.preloadSearchResults(['query 1', 'query 2']);
      });

      // Should have attempted to search for both queries
      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledTimes(2);
    });

    it('should handle preload errors gracefully', async () => {
      mockElectronAPI.searchWithAI.mockRejectedValue(new Error('Preload failed'));
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      await act(async () => {
        await result.current.preloadSearchResults(['failing query']);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to preload results for query: failing query',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Reset and Cleanup', () => {
    it('should reset search state', () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({
          query: 'test query',
          results: [mockSearchResult],
          totalResults: 1,
          searchError: 'Some error',
          currentPage: 3,
          filters: { category: 'VSAM' },
        }),
      });

      act(() => {
        result.current.resetSearch();
      });

      expect(result.current.state.query).toBe('');
      expect(result.current.state.results).toEqual([]);
      expect(result.current.state.totalResults).toBe(0);
      expect(result.current.state.searchError).toBeUndefined();
      expect(result.current.state.currentPage).toBe(1);
      expect(result.current.state.filters.category).toBeUndefined();
    });

    it('should clear results', () => {
      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper({
          results: [mockSearchResult],
          totalResults: 1,
        }),
      });

      act(() => {
        result.current.clearResults();
      });

      expect(result.current.state.results).toEqual([]);
      expect(result.current.state.totalResults).toBe(0);
    });
  });

  describe('Persistence', () => {
    it('should save search data to localStorage', async () => {
      mockElectronAPI.searchWithAI.mockResolvedValue([mockSearchResult]);

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      await act(async () => {
        await result.current.performSearch('test query');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'kb-search-history',
        JSON.stringify(['test query'])
      );
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'kb-search-analytics',
        expect.stringContaining('totalSearches')
      );
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      renderHook(() => useSearch(), {
        wrapper: createTestWrapper(),
      });

      // Should not throw error despite localStorage failure
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save search data:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Convenience Hooks', () => {
    it('should provide useSearchQuery hook', () => {
      const TestComponent = () => {
        const { query, setQuery, clearQuery } = useSearchQuery();
        return (
          <div>
            <span data-testid="query">{query}</span>
            <button onClick={() => setQuery('test')}>Set Query</button>
            <button onClick={clearQuery}>Clear Query</button>
          </div>
        );
      };

      render(
        <SearchProvider>
          <TestComponent />
        </SearchProvider>
      );

      expect(screen.getByTestId('query')).toHaveTextContent('');
    });

    it('should provide useSearchResults hook', () => {
      const TestComponent = () => {
        const { results, isSearching, searchError } = useSearchResults();
        return (
          <div>
            <span data-testid="results-count">{results.length}</span>
            <span data-testid="searching">{isSearching.toString()}</span>
            <span data-testid="error">{searchError || ''}</span>
          </div>
        );
      };

      render(
        <SearchProvider>
          <TestComponent />
        </SearchProvider>
      );

      expect(screen.getByTestId('results-count')).toHaveTextContent('0');
      expect(screen.getByTestId('searching')).toHaveTextContent('false');
    });

    it('should provide useSearchFilters hook', () => {
      const TestComponent = () => {
        const { filters } = useSearchFilters();
        return (
          <div>
            <span data-testid="sort-by">{filters.sortBy}</span>
            <span data-testid="sort-order">{filters.sortOrder}</span>
          </div>
        );
      };

      render(
        <SearchProvider>
          <TestComponent />
        </SearchProvider>
      );

      expect(screen.getByTestId('sort-by')).toHaveTextContent('relevance');
      expect(screen.getByTestId('sort-order')).toHaveTextContent('desc');
    });

    it('should provide useSearchHistory hook', () => {
      const TestComponent = () => {
        const { searchHistory } = useSearchHistory();
        return (
          <div>
            <span data-testid="history-count">{searchHistory.length}</span>
          </div>
        );
      };

      render(
        <SearchProvider>
          <TestComponent />
        </SearchProvider>
      );

      expect(screen.getByTestId('history-count')).toHaveTextContent('0');
    });
  });

  describe('Debouncing', () => {
    it('should debounce search execution', async () => {
      mockElectronAPI.searchWithAI.mockResolvedValue([mockSearchResult]);

      const { result } = renderHook(() => useSearch(), {
        wrapper: createTestWrapper(undefined, { debounceDelay: 100 }),
      });

      // Rapid successive searches
      act(() => {
        result.current.performSearch('query 1');
        result.current.performSearch('query 2');
        result.current.performSearch('query 3');
      });

      // Wait for debounce delay plus some buffer
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      // Should only have called the API once with the last query
      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledTimes(1);
      expect(mockElectronAPI.searchWithAI).toHaveBeenCalledWith(
        'query 3',
        expect.any(Object)
      );
    });
  });
});