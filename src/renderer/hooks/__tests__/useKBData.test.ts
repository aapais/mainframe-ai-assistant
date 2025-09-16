/**
 * Unit Tests for Knowledge Base Data Hooks
 * 
 * Tests for custom React hooks for KB data operations including:
 * - useKBEntries hook with filtering, pagination, and performance monitoring
 * - useKBEntry hook for single entry management with real-time updates
 * - useKBMutation hook for CRUD operations with optimizations
 * - useKBSearch hook with caching and analytics
 * - useKBStats hook for statistics and insights
 * - useKBOffline hook for offline support
 * - Error handling and edge cases
 * - Performance optimizations and caching mechanisms
 * 
 * @author Test Engineer
 * @version 1.0.0
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { 
  useKBEntries, 
  useKBEntry, 
  useKBMutation, 
  useKBSearch,
  useKBStats,
  useKBOffline,
  UseKBEntriesOptions,
  UseKBEntryOptions,
  UseKBMutationOptions,
  UseKBSearchOptions
} from '../useKBData';
import { KBEntry, KBEntryInput, KBEntryUpdate, KBCategory } from '../../../types/services';

// Mock dependencies
jest.mock('../contexts/KBDataContext');
jest.mock('../contexts/SearchContext');
jest.mock('../contexts/MetricsContext');

// Mock the context hooks
const mockUseKBDataContext = jest.fn();
const mockUseSearch = jest.fn();
const mockUseMetrics = jest.fn();

// Set up imports
import { useKBData } from '../contexts/KBDataContext';
import { useSearch } from '../contexts/SearchContext';
import { useMetrics } from '../contexts/MetricsContext';

(useKBData as jest.Mock).mockImplementation(mockUseKBDataContext);
(useSearch as jest.Mock).mockImplementation(mockUseSearch);
(useMetrics as jest.Mock).mockImplementation(mockUseMetrics);

// Test data
const mockKBEntry: KBEntry = {
  id: 'entry-1',
  title: 'Test Entry',
  problem: 'Test problem',
  solution: 'Test solution',
  category: 'VSAM',
  tags: ['test', 'vsam'],
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  usage_count: 5,
  success_count: 4,
  failure_count: 1,
};

const mockKBEntry2: KBEntry = {
  id: 'entry-2',
  title: 'Another Entry',
  problem: 'Another problem',
  solution: 'Another solution',
  category: 'JCL',
  tags: ['test', 'jcl'],
  created_at: new Date('2024-01-02'),
  updated_at: new Date('2024-01-02'),
  usage_count: 3,
  success_count: 2,
  failure_count: 1,
};

const createMockContexts = (overrides = {}) => {
  const defaultKBData = {
    state: {
      entries: new Map([
        ['entry-1', mockKBEntry],
        ['entry-2', mockKBEntry2],
      ]),
      totalEntries: 2,
      isLoading: false,
      error: null,
      pagination: { currentPage: 1, pageSize: 50, hasMore: false },
    },
    loadEntries: jest.fn(),
    refreshEntries: jest.fn(),
    updateFilters: jest.fn(),
    updatePagination: jest.fn(),
    getEntry: jest.fn((id: string) => {
      const entries = new Map([['entry-1', mockKBEntry], ['entry-2', mockKBEntry2]]);
      return entries.get(id) || null;
    }),
    getEntriesByCategory: jest.fn((category: KBCategory) => [mockKBEntry, mockKBEntry2].filter(e => e.category === category)),
    getEntriesByTags: jest.fn((tags: string[]) => [mockKBEntry, mockKBEntry2].filter(e => e.tags?.some(tag => tags.includes(tag)))),
    preloadEntries: jest.fn(),
    createEntry: jest.fn(),
    updateEntry: jest.fn(),
    deleteEntry: jest.fn(),
    createEntries: jest.fn(),
    updateEntries: jest.fn(),
    deleteEntries: jest.fn(),
    recordEntryView: jest.fn(),
    ...overrides,
  };

  const defaultSearch = {
    state: {
      query: '',
      results: [],
      isSearching: false,
      searchError: undefined,
      filters: { sortBy: 'relevance', sortOrder: 'desc' },
      searchMetrics: undefined,
    },
    performSearch: jest.fn(),
    performSearchWithCache: jest.fn(),
    generateSuggestions: jest.fn(),
    setQuery: jest.fn(),
    getSearchAnalytics: jest.fn(() => ({
      totalSearches: 10,
      averageResponseTime: 250,
      successRate: 0.85,
      noResultQueries: [],
      popularQueries: [],
    })),
    getCacheStats: jest.fn(() => ({
      hitCount: 5,
      missCount: 3,
      hitRate: 0.625,
    })),
    ...overrides,
  };

  const defaultMetrics = {
    recordUsageActivity: jest.fn(),
    startOperation: jest.fn(() => 'operation-id'),
    endOperation: jest.fn(),
    recordSearch: jest.fn(),
    getKBMetrics: jest.fn(() => Promise.resolve({})),
    getHealthScore: jest.fn(() => Promise.resolve(85)),
    getDailyStats: jest.fn(() => Promise.resolve({})),
    ...overrides,
  };

  mockUseKBDataContext.mockReturnValue(defaultKBData);
  mockUseSearch.mockReturnValue(defaultSearch);
  mockUseMetrics.mockReturnValue(defaultMetrics);

  return { defaultKBData, defaultSearch, defaultMetrics };
};

describe('useKBEntries Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createMockContexts();
  });

  it('should return filtered entries with basic configuration', () => {
    const { result } = renderHook(() => useKBEntries());

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.totalEntries).toBe(2);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should filter entries by category', () => {
    const { result } = renderHook(() => useKBEntries({ category: 'VSAM' }));

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].category).toBe('VSAM');
  });

  it('should filter entries by tags', () => {
    const { result } = renderHook(() => useKBEntries({ tags: ['vsam'] }));

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].tags).toContain('vsam');
  });

  it('should sort entries by specified field', () => {
    const entriesMap = new Map([
      ['entry-1', { ...mockKBEntry, usage_count: 5 }],
      ['entry-2', { ...mockKBEntry2, usage_count: 10 }],
    ]);

    createMockContexts({
      state: {
        entries: entriesMap,
        totalEntries: 2,
        isLoading: false,
        pagination: { currentPage: 1, pageSize: 50, hasMore: false },
      }
    });

    const { result } = renderHook(() => useKBEntries({ sortBy: 'usage_count', sortOrder: 'desc' }));

    expect(result.current.entries[0].usage_count).toBe(10);
    expect(result.current.entries[1].usage_count).toBe(5);
  });

  it('should apply pagination correctly', () => {
    const manyEntries = Array.from({ length: 100 }, (_, i) => [`entry-${i}`, {
      ...mockKBEntry,
      id: `entry-${i}`,
      title: `Entry ${i}`,
    }]);

    createMockContexts({
      state: {
        entries: new Map(manyEntries),
        totalEntries: 100,
        isLoading: false,
        pagination: { currentPage: 2, pageSize: 10, hasMore: true },
      }
    });

    const { result } = renderHook(() => useKBEntries({ 
      limit: 10, 
      enablePagination: true 
    }));

    expect(result.current.entries).toHaveLength(10);
    expect(result.current.currentPage).toBe(2);
    expect(result.current.pageSize).toBe(10);
  });

  it('should load entries with monitoring', async () => {
    const { defaultKBData, defaultMetrics } = createMockContexts();
    defaultKBData.loadEntries.mockResolvedValue(undefined);

    const { result } = renderHook(() => useKBEntries());

    await act(async () => {
      await result.current.refresh();
    });

    expect(defaultMetrics.startOperation).toHaveBeenCalledWith('load-entries');
    expect(defaultMetrics.endOperation).toHaveBeenCalledWith('operation-id');
    expect(defaultMetrics.recordUsageActivity).toHaveBeenCalled();
  });

  it('should handle loading errors gracefully', async () => {
    const { defaultKBData } = createMockContexts();
    defaultKBData.loadEntries.mockRejectedValue(new Error('Load failed'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { result } = renderHook(() => useKBEntries());

    await act(async () => {
      await result.current.refresh();
    });

    expect(consoleSpy).toHaveBeenCalledWith('Failed to load entries:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('should debounce filter updates', async () => {
    jest.useFakeTimers();
    const { defaultKBData } = createMockContexts();
    
    const { result } = renderHook(() => useKBEntries());

    act(() => {
      result.current.updateFilters({ category: 'VSAM' });
      result.current.updateFilters({ category: 'JCL' });
      result.current.updateFilters({ category: 'DB2' });
    });

    // Fast-forward time to trigger debounce
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(defaultKBData.updateFilters).toHaveBeenCalledTimes(1);
    expect(defaultKBData.updateFilters).toHaveBeenCalledWith({ category: 'DB2' });
    
    jest.useRealTimers();
  });

  it('should handle pagination navigation', async () => {
    const { defaultKBData } = createMockContexts({
      state: {
        entries: new Map(),
        pagination: { currentPage: 1, pageSize: 10, hasMore: true },
      }
    });

    const { result } = renderHook(() => useKBEntries({ enablePagination: true }));

    await act(async () => {
      await result.current.loadNextPage();
    });

    expect(defaultKBData.updatePagination).toHaveBeenCalledWith({ currentPage: 2 });
    expect(defaultKBData.loadEntries).toHaveBeenCalled();
  });

  it('should prefetch next page when enabled', async () => {
    const entriesMap = new Map();
    for (let i = 0; i < 30; i++) {
      entriesMap.set(`entry-${i}`, { ...mockKBEntry, id: `entry-${i}` });
    }

    createMockContexts({
      state: {
        entries: entriesMap,
        pagination: { currentPage: 1, pageSize: 10, hasMore: true },
      }
    });

    const { defaultKBData } = createMockContexts();

    const { result } = renderHook(() => useKBEntries({ 
      enablePagination: true, 
      prefetchNext: true 
    }));

    await act(async () => {
      await result.current.loadNextPage();
    });

    expect(defaultKBData.preloadEntries).toHaveBeenCalled();
  });

  it('should support auto-refresh functionality', async () => {
    jest.useFakeTimers();
    const { defaultKBData } = createMockContexts();

    renderHook(() => useKBEntries({ 
      autoRefresh: true, 
      refreshInterval: 5000 
    }));

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(defaultKBData.loadEntries).toHaveBeenCalled();
    
    jest.useRealTimers();
  });
});

describe('useKBEntry Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createMockContexts();
  });

  it('should return entry data and related entries', () => {
    const { result } = renderHook(() => useKBEntry('entry-1'));

    expect(result.current.entry).toEqual(mockKBEntry);
    expect(result.current.relatedEntries).toHaveLength(0); // No related entries with different categories
  });

  it('should return null for non-existent entry', () => {
    createMockContexts({
      getEntry: jest.fn(() => null),
    });

    const { result } = renderHook(() => useKBEntry('non-existent'));

    expect(result.current.entry).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('should find related entries by category and tags', () => {
    const relatedEntry = { ...mockKBEntry2, category: 'VSAM' }; // Same category as entry-1
    const entriesMap = new Map([
      ['entry-1', mockKBEntry],
      ['entry-2', relatedEntry],
    ]);

    createMockContexts({
      state: {
        entries: entriesMap,
        totalEntries: 2,
      },
    });

    const { result } = renderHook(() => useKBEntry('entry-1'));

    expect(result.current.relatedEntries).toHaveLength(1);
    expect(result.current.relatedEntries[0].id).toBe('entry-2');
  });

  it('should track entry view when enabled', async () => {
    const { defaultKBData, defaultMetrics } = createMockContexts();
    
    renderHook(() => useKBEntry('entry-1', { trackViews: true }));

    await waitFor(() => {
      expect(defaultKBData.recordEntryView).toHaveBeenCalledWith('entry-1');
      expect(defaultMetrics.recordUsageActivity).toHaveBeenCalled();
    });
  });

  it('should not track view for non-existent entry', async () => {
    const { defaultKBData } = createMockContexts({
      getEntry: jest.fn(() => null),
    });

    renderHook(() => useKBEntry('non-existent', { trackViews: true }));

    await waitFor(() => {
      expect(defaultKBData.recordEntryView).not.toHaveBeenCalled();
    });
  });

  it('should preload related entries when enabled', async () => {
    const relatedEntry = { ...mockKBEntry2, category: 'VSAM' };
    const entriesMap = new Map([
      ['entry-1', mockKBEntry],
      ['entry-2', relatedEntry],
    ]);

    const { defaultKBData } = createMockContexts({
      state: { entries: entriesMap, totalEntries: 2 },
    });

    renderHook(() => useKBEntry('entry-1', { preloadRelated: true }));

    await waitFor(() => {
      expect(defaultKBData.preloadEntries).toHaveBeenCalledWith(['entry-2']);
    });
  });

  it('should handle view tracking errors gracefully', async () => {
    const { defaultKBData } = createMockContexts();
    defaultKBData.recordEntryView.mockRejectedValue(new Error('Tracking failed'));
    
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    renderHook(() => useKBEntry('entry-1', { trackViews: true }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to track entry view:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should support auto-refresh functionality', async () => {
    jest.useFakeTimers();
    const { defaultMetrics } = createMockContexts();

    renderHook(() => useKBEntry('entry-1', { 
      enableAutoRefresh: true, 
      refreshInterval: 30000 
    }));

    act(() => {
      jest.advanceTimersByTime(30000);
    });

    expect(defaultMetrics.recordUsageActivity).toHaveBeenCalledWith({
      entryId: 'entry-1',
      action: 'view',
      metadata: { autoRefresh: true },
    });

    jest.useRealTimers();
  });
});

describe('useKBMutation Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createMockContexts();
  });

  it('should create entry successfully', async () => {
    const newEntry: KBEntryInput = {
      title: 'New Entry',
      problem: 'New problem',
      solution: 'New solution',
      category: 'DB2',
      tags: ['new'],
    };

    const createdEntry: KBEntry = {
      ...newEntry,
      id: 'new-entry',
      created_at: new Date(),
      updated_at: new Date(),
      usage_count: 0,
      success_count: 0,
      failure_count: 0,
    };

    const { defaultKBData, defaultMetrics } = createMockContexts();
    defaultKBData.createEntry.mockResolvedValue(createdEntry);

    const onSuccess = jest.fn();
    const { result } = renderHook(() => useKBMutation({ onSuccess }));

    let resultEntry: KBEntry;
    await act(async () => {
      resultEntry = await result.current.create(newEntry);
    });

    expect(resultEntry!).toEqual(createdEntry);
    expect(defaultKBData.createEntry).toHaveBeenCalledWith(newEntry);
    expect(defaultMetrics.recordUsageActivity).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(createdEntry);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should handle create errors', async () => {
    const newEntry: KBEntryInput = {
      title: 'New Entry',
      problem: 'New problem',
      solution: 'New solution',
      category: 'DB2',
      tags: ['new'],
    };

    const error = new Error('Create failed');
    const { defaultKBData } = createMockContexts();
    defaultKBData.createEntry.mockRejectedValue(error);

    const onError = jest.fn();
    const { result } = renderHook(() => useKBMutation({ onError }));

    await expect(async () => {
      await act(async () => {
        await result.current.create(newEntry);
      });
    }).rejects.toThrow('Create failed');

    expect(onError).toHaveBeenCalledWith(error);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(error);
  });

  it('should update entry successfully', async () => {
    const updates: KBEntryUpdate = { title: 'Updated Title' };
    const updatedEntry: KBEntry = { ...mockKBEntry, ...updates, updated_at: new Date() };

    const { defaultKBData } = createMockContexts();
    defaultKBData.updateEntry.mockResolvedValue(updatedEntry);

    const { result } = renderHook(() => useKBMutation());

    let resultEntry: KBEntry;
    await act(async () => {
      resultEntry = await result.current.update('entry-1', updates);
    });

    expect(resultEntry!).toEqual(updatedEntry);
    expect(defaultKBData.updateEntry).toHaveBeenCalledWith('entry-1', updates);
  });

  it('should delete entry successfully', async () => {
    const { defaultKBData } = createMockContexts();
    defaultKBData.deleteEntry.mockResolvedValue(undefined);

    const { result } = renderHook(() => useKBMutation());

    await act(async () => {
      await result.current.remove('entry-1');
    });

    expect(defaultKBData.deleteEntry).toHaveBeenCalledWith('entry-1');
  });

  it('should rate entry successfully', async () => {
    const { defaultMetrics } = createMockContexts();
    
    const { result } = renderHook(() => useKBMutation());

    await act(async () => {
      await result.current.rate('entry-1', true, 'Helpful!');
    });

    expect(defaultMetrics.recordUsageActivity).toHaveBeenCalledWith({
      entryId: 'entry-1',
      action: 'rate_success',
      metadata: {
        comment: 'Helpful!',
        rating: true,
      },
    });
  });

  it('should support retry mechanism', async () => {
    const newEntry: KBEntryInput = {
      title: 'New Entry',
      problem: 'New problem',
      solution: 'New solution',
      category: 'DB2',
      tags: ['new'],
    };

    const { defaultKBData } = createMockContexts();
    defaultKBData.createEntry
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockRejectedValueOnce(new Error('Another failure'))
      .mockResolvedValueOnce({
        ...newEntry,
        id: 'new-entry',
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: 0,
        success_count: 0,
        failure_count: 0,
      });

    const { result } = renderHook(() => useKBMutation({ retryAttempts: 3 }));

    let resultEntry: KBEntry;
    await act(async () => {
      resultEntry = await result.current.create(newEntry);
    });

    expect(defaultKBData.createEntry).toHaveBeenCalledTimes(3);
    expect(resultEntry!).toBeDefined();
  });

  it('should support batch operations', async () => {
    jest.useFakeTimers();
    
    const { defaultKBData } = createMockContexts();
    defaultKBData.createEntries.mockResolvedValue([]);

    const { result } = renderHook(() => useKBMutation({ 
      enableBatching: true,
      batchDelay: 1000 
    }));

    const newEntry1: KBEntryInput = {
      title: 'Entry 1',
      problem: 'Problem 1',
      solution: 'Solution 1',
      category: 'JCL',
      tags: [],
    };

    const newEntry2: KBEntryInput = {
      title: 'Entry 2',
      problem: 'Problem 2',
      solution: 'Solution 2',
      category: 'VSAM',
      tags: [],
    };

    act(() => {
      result.current.create(newEntry1);
      result.current.create(newEntry2);
    });

    // Fast-forward time to trigger batch execution
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(defaultKBData.createEntries).toHaveBeenCalledWith([newEntry1, newEntry2]);
    });

    jest.useRealTimers();
  });

  it('should execute pending batch operations on unmount', async () => {
    jest.useFakeTimers();
    
    const { defaultKBData } = createMockContexts();
    defaultKBData.createEntries.mockResolvedValue([]);

    const { result, unmount } = renderHook(() => useKBMutation({ 
      enableBatching: true,
      batchDelay: 5000 
    }));

    const newEntry: KBEntryInput = {
      title: 'Entry',
      problem: 'Problem',
      solution: 'Solution',
      category: 'JCL',
      tags: [],
    };

    act(() => {
      result.current.create(newEntry);
    });

    // Unmount before batch delay completes
    unmount();

    expect(defaultKBData.createEntries).toHaveBeenCalledWith([newEntry]);

    jest.useRealTimers();
  });
});

describe('useKBSearch Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createMockContexts();
  });

  it('should perform search with debouncing', async () => {
    jest.useFakeTimers();
    
    const { defaultSearch, defaultMetrics } = createMockContexts();
    defaultSearch.performSearchWithCache.mockResolvedValue(undefined);

    const { result } = renderHook(() => useKBSearch({ 
      debounceDelay: 300,
      autoSearch: true 
    }));

    act(() => {
      result.current.search('query 1');
      result.current.search('query 2');
      result.current.search('query 3');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(defaultSearch.performSearchWithCache).toHaveBeenCalledTimes(1);
    expect(defaultSearch.performSearchWithCache).toHaveBeenCalledWith('query 3');

    jest.useRealTimers();
  });

  it('should generate suggestions with debouncing', async () => {
    jest.useFakeTimers();
    
    const { defaultSearch } = createMockContexts();
    defaultSearch.generateSuggestions.mockResolvedValue(['suggestion 1', 'suggestion 2']);

    const { result } = renderHook(() => useKBSearch({ enableSuggestions: true }));

    act(() => {
      result.current.search('test');
    });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(result.current.suggestions).toEqual(['suggestion 1', 'suggestion 2']);
    });

    jest.useRealTimers();
  });

  it('should perform immediate search without debouncing', async () => {
    const { defaultSearch, defaultMetrics } = createMockContexts();
    defaultSearch.performSearchWithCache.mockResolvedValue(undefined);

    const { result } = renderHook(() => useKBSearch());

    await act(async () => {
      await result.current.searchImmediate('immediate query');
    });

    expect(defaultSearch.performSearchWithCache).toHaveBeenCalledWith('immediate query');
    expect(defaultMetrics.recordUsageActivity).toHaveBeenCalled();
  });

  it('should respect minimum query length', async () => {
    jest.useFakeTimers();
    
    const { defaultSearch } = createMockContexts();

    const { result } = renderHook(() => useKBSearch({ 
      minQueryLength: 3,
      autoSearch: true 
    }));

    act(() => {
      result.current.search('ab'); // Too short
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(defaultSearch.performSearchWithCache).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should handle search errors gracefully', async () => {
    const { defaultSearch, defaultMetrics } = createMockContexts();
    defaultSearch.performSearchWithCache.mockRejectedValue(new Error('Search failed'));
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { result } = renderHook(() => useKBSearch());

    await act(async () => {
      await result.current.searchImmediate('failing query');
    });

    expect(consoleSpy).toHaveBeenCalledWith('Immediate search failed:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('should provide analytics when enabled', () => {
    const { result } = renderHook(() => useKBSearch({ enableAnalytics: true }));

    expect(result.current.analytics).toBeDefined();
    expect(result.current.analytics?.searchAnalytics).toBeDefined();
    expect(result.current.analytics?.cacheStats).toBeDefined();
  });

  it('should not provide analytics when disabled', () => {
    const { result } = renderHook(() => useKBSearch({ enableAnalytics: false }));

    expect(result.current.analytics).toBeNull();
  });

  it('should limit suggestions to max count', async () => {
    const { defaultSearch } = createMockContexts();
    defaultSearch.generateSuggestions.mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => `suggestion ${i}`)
    );

    const { result } = renderHook(() => useKBSearch({ 
      enableSuggestions: true,
      maxSuggestions: 5 
    }));

    await act(async () => {
      result.current.search('test');
    });

    // Allow debounced suggestions to complete
    await waitFor(() => {
      expect(result.current.suggestions.length).toBe(5);
    });
  });
});

describe('useKBStats Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createMockContexts();
  });

  it('should load and return KB statistics', async () => {
    const { defaultMetrics } = createMockContexts();
    defaultMetrics.getKBMetrics.mockResolvedValue({ totalQueries: 100 });
    defaultMetrics.getHealthScore.mockResolvedValue(92);
    defaultMetrics.getDailyStats.mockResolvedValue({ entriesCreated: 5 });

    const { result } = renderHook(() => useKBStats());

    await waitFor(() => {
      expect(result.current.totalEntries).toBe(2);
      expect(result.current.entriesCount).toBe(2);
      expect(result.current.healthScore).toBe(92);
      expect(result.current.dailyStats).toEqual({ entriesCreated: 5 });
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should handle stats loading errors', async () => {
    const { defaultMetrics } = createMockContexts();
    defaultMetrics.getKBMetrics.mockRejectedValue(new Error('Stats failed'));
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { result } = renderHook(() => useKBStats());

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load stats:', expect.any(Error));
      expect(result.current.isLoading).toBe(false);
    });

    consoleSpy.mockRestore();
  });

  it('should refresh stats manually', async () => {
    const { defaultMetrics } = createMockContexts();
    defaultMetrics.getHealthScore.mockResolvedValue(88);

    const { result } = renderHook(() => useKBStats());

    await act(async () => {
      await result.current.refresh();
    });

    expect(defaultMetrics.getKBMetrics).toHaveBeenCalledTimes(2); // Initial load + manual refresh
    expect(defaultMetrics.getHealthScore).toHaveBeenCalledTimes(2);
    expect(defaultMetrics.getDailyStats).toHaveBeenCalledTimes(2);
  });
});

describe('useKBOffline Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  it('should detect initial online status', () => {
    const { result } = renderHook(() => useKBOffline());

    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
    expect(result.current.pendingSyncs).toEqual([]);
    expect(result.current.syncCount).toBe(0);
  });

  it('should detect offline status', () => {
    Object.defineProperty(navigator, 'onLine', { value: false });

    const { result } = renderHook(() => useKBOffline());

    expect(result.current.isOnline).toBe(false);
    expect(result.current.isOffline).toBe(true);
  });

  it('should respond to online/offline events', () => {
    const { result } = renderHook(() => useKBOffline());

    expect(result.current.isOnline).toBe(true);

    // Simulate going offline
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.isOffline).toBe(true);

    // Simulate going back online
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true });
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
  });

  it('should cleanup event listeners on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    
    const { unmount } = renderHook(() => useKBOffline());
    
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    
    removeEventListenerSpy.mockRestore();
  });
});

describe('Performance and Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createMockContexts();
  });

  it('should handle large datasets efficiently in useKBEntries', () => {
    // Create a large dataset
    const largeEntriesMap = new Map();
    for (let i = 0; i < 10000; i++) {
      largeEntriesMap.set(`entry-${i}`, {
        ...mockKBEntry,
        id: `entry-${i}`,
        title: `Entry ${i}`,
      });
    }

    createMockContexts({
      state: {
        entries: largeEntriesMap,
        totalEntries: 10000,
        isLoading: false,
        pagination: { currentPage: 1, pageSize: 50, hasMore: true },
      }
    });

    const startTime = performance.now();
    
    const { result } = renderHook(() => useKBEntries({ limit: 50 }));
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    expect(result.current.entries).toHaveLength(50);
    expect(processingTime).toBeLessThan(10); // Should process in under 10ms
  });

  it('should handle concurrent mutations gracefully', async () => {
    const { defaultKBData } = createMockContexts();
    defaultKBData.createEntry.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ...mockKBEntry,
        id: `entry-${Date.now()}`,
      }), 100))
    );

    const { result } = renderHook(() => useKBMutation());

    const newEntry: KBEntryInput = {
      title: 'Concurrent Entry',
      problem: 'Problem',
      solution: 'Solution',
      category: 'JCL',
      tags: [],
    };

    // Start multiple concurrent operations
    const promises = Array.from({ length: 5 }, () => 
      result.current.create(newEntry)
    );

    const results = await Promise.allSettled(promises);
    
    expect(results.every(result => result.status === 'fulfilled')).toBe(true);
    expect(defaultKBData.createEntry).toHaveBeenCalledTimes(5);
  });

  it('should handle memory cleanup properly', () => {
    const { unmount } = renderHook(() => useKBEntries({ autoRefresh: true }));
    
    // Should not throw any errors on unmount
    expect(() => unmount()).not.toThrow();
  });

  it('should handle null/undefined values gracefully', () => {
    createMockContexts({
      getEntry: jest.fn(() => null),
      state: {
        entries: new Map(),
        totalEntries: 0,
      }
    });

    const { result } = renderHook(() => useKBEntries());

    expect(result.current.entries).toEqual([]);
    expect(result.current.totalEntries).toBe(0);
    expect(() => result.current.getEntriesByCategory('VSAM')).not.toThrow();
    expect(() => result.current.getEntriesByTags(['test'])).not.toThrow();
  });
});