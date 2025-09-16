/**
 * Unit tests for useKBListing custom hook
 * Tests the main data fetching and state management hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useKBListing } from '../../../../../src/renderer/hooks/useKBListing';
import { ListingOptions } from '../../../../../src/main/services/KBListingService';

// Mock the electron IPC
const mockIpcRenderer = {
  invoke: jest.fn()
};

(global as any).window = {
  electronAPI: mockIpcRenderer
};

describe('useKBListing', () => {
  const mockListingResponse = {
    success: true,
    data: {
      items: [
        {
          id: '1',
          title: 'Test Entry 1',
          category: 'VSAM',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:00:00Z',
          usage_count: 5,
          success_count: 4,
          failure_count: 1
        },
        {
          id: '2',
          title: 'Test Entry 2',
          category: 'JCL',
          created_at: '2024-01-02T10:00:00Z',
          updated_at: '2024-01-02T10:00:00Z',
          usage_count: 10,
          success_count: 8,
          failure_count: 2
        }
      ],
      pagination: {
        currentPage: 1,
        pageSize: 20,
        totalItems: 2,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
        nextCursor: null,
        previousCursor: null
      },
      sorting: {
        sortBy: 'updated_at',
        sortDirection: 'desc',
        multiSort: [],
        availableSorts: [
          { field: 'title', label: 'Title', defaultDirection: 'asc' },
          { field: 'updated_at', label: 'Last Updated', defaultDirection: 'desc' }
        ]
      },
      filtering: {
        activeFilters: [],
        availableFilters: [],
        quickFilters: [
          { type: 'recent', label: 'Recently Added', count: 1, active: false },
          { type: 'popular', label: 'Most Popular', count: 1, active: false }
        ],
        filterCounts: {}
      },
      aggregations: {
        categoryStats: [
          { category: 'VSAM', count: 1, percentage: 50, avgRating: 4.0, avgUsage: 5 },
          { category: 'JCL', count: 1, percentage: 50, avgRating: 4.5, avgUsage: 10 }
        ],
        tagCloud: [],
        severityDistribution: [],
        usageStats: {
          totalViews: 15,
          uniqueUsers: 3,
          avgSessionTime: 250,
          bounceRate: 0.2,
          conversionRate: 0.8
        },
        timelineStats: []
      },
      metadata: {
        totalTime: 45,
        cacheHit: false,
        queryComplexity: 1,
        recommendations: []
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIpcRenderer.invoke.mockResolvedValue(mockListingResponse);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================
  // BASIC HOOK FUNCTIONALITY
  // =========================

  describe('Basic Hook Functionality', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useKBListing());

      expect(result.current.data).toBeNull();
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.refetch).toBe('function');
      expect(typeof result.current.invalidateCache).toBe('function');
    });

    it('should fetch data on mount', async () => {
      const { result } = renderHook(() => useKBListing());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('kb-listing:get-entries', {});
      expect(result.current.data).toEqual(mockListingResponse.data);
      expect(result.current.error).toBeNull();
    });

    it('should fetch data with custom options', async () => {
      const options: ListingOptions = {
        page: 2,
        pageSize: 10,
        sortBy: 'title',
        sortDirection: 'asc'
      };

      const { result } = renderHook(() => useKBListing(options));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('kb-listing:get-entries', options);
    });

    it('should handle loading states correctly', async () => {
      // Mock delayed response
      mockIpcRenderer.invoke.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockListingResponse), 100))
      );

      const { result } = renderHook(() => useKBListing());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeNull();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockListingResponse.data);
    });
  });

  // =========================
  // ERROR HANDLING
  // =========================

  describe('Error Handling', () => {
    it('should handle API errors', async () => {
      const errorResponse = {
        success: false,
        error: 'Failed to fetch entries',
        code: 'FETCH_ENTRIES_ERROR'
      };

      mockIpcRenderer.invoke.mockResolvedValue(errorResponse);

      const { result } = renderHook(() => useKBListing());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toEqual(
        expect.objectContaining({
          message: 'Failed to fetch entries',
          code: 'FETCH_ENTRIES_ERROR'
        })
      );
      expect(result.current.data).toBeNull();
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network request failed');
      mockIpcRenderer.invoke.mockRejectedValue(networkError);

      const { result } = renderHook(() => useKBListing());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toEqual(networkError);
      expect(result.current.data).toBeNull();
    });

    it('should reset error on successful retry', async () => {
      // First call fails
      const errorResponse = {
        success: false,
        error: 'Initial error',
        code: 'FETCH_ERROR'
      };

      mockIpcRenderer.invoke
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(mockListingResponse);

      const { result } = renderHook(() => useKBListing());

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Retry
      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(result.current.data).toEqual(mockListingResponse.data);
    });

    it('should maintain previous data during error states', async () => {
      const { result } = renderHook(() => useKBListing());

      // Wait for initial successful load
      await waitFor(() => {
        expect(result.current.data).toBeTruthy();
      });

      const initialData = result.current.data;

      // Mock error for refetch
      mockIpcRenderer.invoke.mockResolvedValue({
        success: false,
        error: 'Temporary error',
        code: 'TEMP_ERROR'
      });

      act(() => {
        result.current.refetch({ page: 2 });
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Should keep previous data
      expect(result.current.data).toEqual(initialData);
    });
  });

  // =========================
  // REFETCH FUNCTIONALITY
  // =========================

  describe('Refetch Functionality', () => {
    it('should refetch with same options', async () => {
      const { result } = renderHook(() => useKBListing({ page: 1, pageSize: 10 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      jest.clearAllMocks();

      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('kb-listing:get-entries', {
        page: 1,
        pageSize: 10
      });
    });

    it('should refetch with updated options', async () => {
      const { result } = renderHook(() => useKBListing({ page: 1 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      jest.clearAllMocks();

      act(() => {
        result.current.refetch({ page: 2, sortBy: 'title' });
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('kb-listing:get-entries', {
        page: 2,
        sortBy: 'title'
      });
    });

    it('should merge refetch options with existing options', async () => {
      const initialOptions = {
        page: 1,
        pageSize: 20,
        sortBy: 'updated_at' as const,
        filters: [{ field: 'category', operator: 'eq' as const, value: 'VSAM' }]
      };

      const { result } = renderHook(() => useKBListing(initialOptions));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      jest.clearAllMocks();

      act(() => {
        result.current.refetch({ page: 3, sortDirection: 'asc' });
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('kb-listing:get-entries', {
        page: 3,
        pageSize: 20,
        sortBy: 'updated_at',
        sortDirection: 'asc',
        filters: [{ field: 'category', operator: 'eq', value: 'VSAM' }]
      });
    });

    it('should handle concurrent refetch requests', async () => {
      const { result } = renderHook(() => useKBListing());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Mock delayed responses
      mockIpcRenderer.invoke
        .mockImplementationOnce(() => new Promise(resolve =>
          setTimeout(() => resolve({
            ...mockListingResponse,
            data: { ...mockListingResponse.data, items: [{ ...mockListingResponse.data.items[0], title: 'First Request' }] }
          }), 100)
        ))
        .mockImplementationOnce(() => new Promise(resolve =>
          setTimeout(() => resolve({
            ...mockListingResponse,
            data: { ...mockListingResponse.data, items: [{ ...mockListingResponse.data.items[0], title: 'Second Request' }] }
          }), 50)
        ));

      // Trigger concurrent requests
      act(() => {
        result.current.refetch({ page: 1 });
        result.current.refetch({ page: 2 });
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should use result from latest request (page 2)
      expect(result.current.data?.items[0]?.title).toBe('Second Request');
    });
  });

  // =========================
  // CACHE INVALIDATION
  // =========================

  describe('Cache Invalidation', () => {
    it('should invalidate cache and refetch', async () => {
      mockIpcRenderer.invoke
        .mockResolvedValueOnce(mockListingResponse)
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({
          ...mockListingResponse,
          data: {
            ...mockListingResponse.data,
            metadata: { ...mockListingResponse.data.metadata, cacheHit: false }
          }
        });

      const { result } = renderHook(() => useKBListing());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.invalidateCache();
      });

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('kb-listing:invalidate-cache');
      });

      // Should automatically refetch after cache invalidation
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('kb-listing:get-entries', {});
    });

    it('should handle cache invalidation errors', async () => {
      mockIpcRenderer.invoke
        .mockResolvedValueOnce(mockListingResponse)
        .mockRejectedValueOnce(new Error('Cache invalidation failed'));

      const { result } = renderHook(() => useKBListing());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.invalidateCache();
      });

      // Should not affect current data on cache invalidation error
      await waitFor(() => {
        expect(result.current.data).toBeTruthy();
        expect(result.current.error).toBeFalsy();
      });
    });
  });

  // =========================
  // OPTIONS CHANGE HANDLING
  // =========================

  describe('Options Change Handling', () => {
    it('should refetch when options change', async () => {
      const initialOptions = { page: 1, pageSize: 10 };
      const { result, rerender } = renderHook(
        (props) => useKBListing(props),
        { initialProps: initialOptions }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockIpcRenderer.invoke).toHaveBeenCalledTimes(1);
      jest.clearAllMocks();

      // Change options
      const newOptions = { page: 2, pageSize: 10 };
      rerender(newOptions);

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('kb-listing:get-entries', newOptions);
      });
    });

    it('should not refetch when options are unchanged', async () => {
      const options = { page: 1, pageSize: 10 };
      const { result, rerender } = renderHook(
        (props) => useKBListing(props),
        { initialProps: options }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockIpcRenderer.invoke).toHaveBeenCalledTimes(1);
      jest.clearAllMocks();

      // Re-render with same options
      rerender({ ...options });

      // Should not trigger new fetch
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).not.toHaveBeenCalled();
      });
    });

    it('should deep compare complex options', async () => {
      const initialOptions = {
        page: 1,
        filters: [{ field: 'category', operator: 'eq' as const, value: 'VSAM' }]
      };

      const { result, rerender } = renderHook(
        (props) => useKBListing(props),
        { initialProps: initialOptions }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      jest.clearAllMocks();

      // Re-render with structurally identical options
      const sameOptions = {
        page: 1,
        filters: [{ field: 'category', operator: 'eq' as const, value: 'VSAM' }]
      };
      rerender(sameOptions);

      // Should not refetch
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).not.toHaveBeenCalled();
      });

      // Change nested option
      const changedOptions = {
        page: 1,
        filters: [{ field: 'category', operator: 'eq' as const, value: 'JCL' }]
      };
      rerender(changedOptions);

      // Should refetch
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('kb-listing:get-entries', changedOptions);
      });
    });

    it('should debounce rapid option changes', async () => {
      jest.useFakeTimers();

      const { result, rerender } = renderHook(
        (props) => useKBListing(props),
        { initialProps: { page: 1 } }
      );

      // Fast forward initial fetch
      await act(async () => {
        jest.runAllTimers();
      });

      jest.clearAllMocks();

      // Make rapid changes
      rerender({ page: 2 });
      rerender({ page: 3 });
      rerender({ page: 4 });

      // Should not fetch immediately
      expect(mockIpcRenderer.invoke).not.toHaveBeenCalled();

      // Fast forward debounce timer
      await act(async () => {
        jest.runAllTimers();
      });

      // Should only fetch once with final options
      expect(mockIpcRenderer.invoke).toHaveBeenCalledTimes(1);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('kb-listing:get-entries', { page: 4 });

      jest.useRealTimers();
    });
  });

  // =========================
  // PERFORMANCE OPTIMIZATIONS
  // =========================

  describe('Performance Optimizations', () => {
    it('should memoize stable functions', () => {
      const { result, rerender } = renderHook(() => useKBListing({ page: 1 }));

      const firstRefetch = result.current.refetch;
      const firstInvalidateCache = result.current.invalidateCache;

      rerender();

      expect(result.current.refetch).toBe(firstRefetch);
      expect(result.current.invalidateCache).toBe(firstInvalidateCache);
    });

    it('should cleanup on unmount', async () => {
      const abortSpy = jest.spyOn(AbortController.prototype, 'abort');

      const { result, unmount } = renderHook(() => useKBListing());

      act(() => {
        result.current.refetch();
      });

      unmount();

      expect(abortSpy).toHaveBeenCalled();
      abortSpy.mockRestore();
    });

    it('should handle stale closures correctly', async () => {
      let capturedRefetch: any;

      const { result } = renderHook(() => useKBListing({ page: 1 }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      capturedRefetch = result.current.refetch;
      jest.clearAllMocks();

      // Call captured refetch after component re-renders
      act(() => {
        capturedRefetch({ page: 5 });
      });

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('kb-listing:get-entries', { page: 5 });
      });
    });
  });

  // =========================
  // EDGE CASES
  // =========================

  describe('Edge Cases', () => {
    it('should handle empty response data', async () => {
      const emptyResponse = {
        success: true,
        data: {
          items: [],
          pagination: {
            currentPage: 1,
            pageSize: 20,
            totalItems: 0,
            totalPages: 0,
            hasNext: false,
            hasPrevious: false
          },
          sorting: { sortBy: 'updated_at', sortDirection: 'desc', availableSorts: [] },
          filtering: { activeFilters: [], availableFilters: [], quickFilters: [], filterCounts: {} },
          aggregations: {
            categoryStats: [],
            tagCloud: [],
            severityDistribution: [],
            usageStats: { totalViews: 0, uniqueUsers: 0, avgSessionTime: 0, bounceRate: 0, conversionRate: 0 },
            timelineStats: []
          },
          metadata: { totalTime: 10, cacheHit: true, queryComplexity: 0 }
        }
      };

      mockIpcRenderer.invoke.mockResolvedValue(emptyResponse);

      const { result } = renderHook(() => useKBListing());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(emptyResponse.data);
      expect(result.current.error).toBeNull();
    });

    it('should handle malformed response data', async () => {
      const malformedResponse = {
        success: true,
        data: {
          items: 'not an array',
          pagination: null
        }
      };

      mockIpcRenderer.invoke.mockResolvedValue(malformedResponse);

      const { result } = renderHook(() => useKBListing());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeNull();
    });

    it('should handle undefined options gracefully', () => {
      const { result } = renderHook(() => useKBListing(undefined));

      expect(result.current.isLoading).toBe(true);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('kb-listing:get-entries', {});
    });

    it('should handle very large datasets', async () => {
      const largeResponse = {
        ...mockListingResponse,
        data: {
          ...mockListingResponse.data,
          items: Array.from({ length: 10000 }, (_, i) => ({
            id: `entry-${i}`,
            title: `Entry ${i}`,
            category: 'VSAM',
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-01T10:00:00Z'
          }))
        }
      };

      mockIpcRenderer.invoke.mockResolvedValue(largeResponse);

      const startTime = performance.now();
      const { result } = renderHook(() => useKBListing());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const duration = performance.now() - startTime;

      expect(result.current.data?.items).toHaveLength(10000);
      expect(duration).toBeLessThan(1000); // Should handle large datasets efficiently
    });
  });
});