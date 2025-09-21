/**
 * Unit Tests for useHybridSearch Hook
 * Testing React hook with performance validation and authorization flows
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useHybridSearch } from '../../../src/renderer/hooks/useHybridSearch';
import { hybridSearchService } from '../../../src/renderer/services/hybridSearchService';
import { KBCategory } from '../../../src/types/services';

// Mock the hybrid search service
jest.mock('../../../src/renderer/services/hybridSearchService', () => ({
  hybridSearchService: {
    search: jest.fn(),
    getHealthStatus: jest.fn(),
    cleanup: jest.fn()
  }
}));

// Mock React hooks
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: jest.fn(),
  useEffect: jest.fn(),
  useCallback: jest.fn(),
  useMemo: jest.fn(),
  useRef: jest.fn()
}));

const mockHybridSearchService = hybridSearchService as jest.Mocked<typeof hybridSearchService>;

describe('useHybridSearch Hook', () => {
  const mockSearchResult = {
    localResults: [
      {
        entry: {
          id: 'local-1',
          title: 'Local Test Result',
          problem: 'Test problem',
          solution: 'Test solution',
          category: 'VSAM' as KBCategory,
          tags: ['test'],
          created_at: new Date(),
          updated_at: new Date(),
          usage_count: 5,
          success_rate: 0.8,
          version: 1,
          status: 'active',
          created_by: 'test-user'
        },
        score: 85,
        matchType: 'exact' as any,
        highlights: ['Local Test Result'],
        metadata: {
          processingTime: 50,
          source: 'local',
          confidence: 0.85,
          fallback: false
        }
      }
    ],
    aiResults: [],
    mergedResults: [
      {
        entry: {
          id: 'local-1',
          title: 'Local Test Result',
          problem: 'Test problem',
          solution: 'Test solution',
          category: 'VSAM' as KBCategory,
          tags: ['test'],
          created_at: new Date(),
          updated_at: new Date(),
          usage_count: 5,
          success_rate: 0.8,
          version: 1,
          status: 'active',
          created_by: 'test-user'
        },
        score: 85,
        matchType: 'exact' as any,
        highlights: ['Local Test Result'],
        metadata: {
          processingTime: 50,
          source: 'local',
          confidence: 0.85,
          fallback: false,
          hybridRank: 1
        }
      }
    ],
    performance: {
      localSearchTime: 45,
      aiSearchTime: 0,
      totalTime: 50,
      localCompleted: true,
      aiCompleted: false,
      authorizationRequired: false
    },
    metadata: {
      localResultCount: 1,
      aiResultCount: 0,
      mergedResultCount: 1,
      duplicatesRemoved: 0,
      authorizationStatus: 'not_required',
      errorMessages: []
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockHybridSearchService.search.mockResolvedValue(mockSearchResult);
    mockHybridSearchService.getHealthStatus.mockResolvedValue({
      healthy: true,
      localSearchAvailable: true,
      aiSearchAvailable: true,
      authorizationAvailable: true,
      performanceMetrics: {
        averageLocalSearchTime: 150,
        averageAISearchTime: 300,
        averageAuthorizationTime: 50
      }
    });
  });

  describe('Hook Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useHybridSearch());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.results).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.searchHistory).toEqual([]);
      expect(result.current.performance).toBeNull();
    });

    it('should provide search function', () => {
      const { result } = renderHook(() => useHybridSearch());

      expect(typeof result.current.search).toBe('function');
      expect(typeof result.current.clearResults).toBe('function');
      expect(typeof result.current.retryLastSearch).toBe('function');
    });

    it('should check health status on mount', async () => {
      renderHook(() => useHybridSearch());

      await waitFor(() => {
        expect(mockHybridSearchService.getHealthStatus).toHaveBeenCalled();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should perform search and update state', async () => {
      const { result } = renderHook(() => useHybridSearch());

      await act(async () => {
        await result.current.search('test query');
      });

      expect(mockHybridSearchService.search).toHaveBeenCalledWith(
        'test query',
        undefined,
        expect.any(Object)
      );
      expect(result.current.results).toEqual(mockSearchResult);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle search with category', async () => {
      const { result } = renderHook(() => useHybridSearch());

      await act(async () => {
        await result.current.search('test query', 'JCL');
      });

      expect(mockHybridSearchService.search).toHaveBeenCalledWith(
        'test query',
        'JCL',
        expect.any(Object)
      );
    });

    it('should handle search with custom options', async () => {
      const { result } = renderHook(() => useHybridSearch());
      const options = {
        enableAI: false,
        maxLocalResults: 25,
        prioritizeLocal: true
      };

      await act(async () => {
        await result.current.search('test query', undefined, options);
      });

      expect(mockHybridSearchService.search).toHaveBeenCalledWith(
        'test query',
        undefined,
        options
      );
    });

    it('should set loading state during search', async () => {
      const { result } = renderHook(() => useHybridSearch());
      
      // Mock delayed response
      let resolveSearch: (value: any) => void;
      const searchPromise = new Promise((resolve) => {
        resolveSearch = resolve;
      });
      mockHybridSearchService.search.mockReturnValue(searchPromise as any);

      act(() => {
        result.current.search('test query');
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSearch!(mockSearchResult);
        await searchPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should prevent concurrent searches', async () => {
      const { result } = renderHook(() => useHybridSearch());
      
      // Start first search
      const firstSearch = act(async () => {
        await result.current.search('first query');
      });

      // Try to start second search while first is running
      const secondSearch = act(async () => {
        await result.current.search('second query');
      });

      await Promise.all([firstSearch, secondSearch]);

      // Should only call service once (second call should be ignored)
      expect(mockHybridSearchService.search).toHaveBeenCalledTimes(1);
    });

    it('should handle empty query gracefully', async () => {
      const { result } = renderHook(() => useHybridSearch());

      await act(async () => {
        await result.current.search('');
      });

      expect(result.current.error).toBe('Search query cannot be empty');
      expect(mockHybridSearchService.search).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only query', async () => {
      const { result } = renderHook(() => useHybridSearch());

      await act(async () => {
        await result.current.search('   ');
      });

      expect(result.current.error).toBe('Search query cannot be empty');
      expect(mockHybridSearchService.search).not.toHaveBeenCalled();
    });
  });

  describe('Performance Monitoring', () => {
    it('should track search performance metrics', async () => {
      const { result } = renderHook(() => useHybridSearch());

      await act(async () => {
        await result.current.search('performance test');
      });

      expect(result.current.performance).toEqual(mockSearchResult.performance);
      expect(result.current.performance?.localSearchTime).toBeLessThan(500);
    });

    it('should validate local search performance requirement (<500ms)', async () => {
      const slowResult = {
        ...mockSearchResult,
        performance: {
          ...mockSearchResult.performance,
          localSearchTime: 600, // Exceeds 500ms requirement
          totalTime: 650
        }
      };
      
      mockHybridSearchService.search.mockResolvedValue(slowResult);
      
      const { result } = renderHook(() => useHybridSearch());

      await act(async () => {
        await result.current.search('slow query');
      });

      expect(result.current.performance?.localSearchTime).toBeGreaterThan(500);
      expect(result.current.performanceWarning).toBe(
        'Local search took longer than expected (600ms). Consider optimizing your query.'
      );
    });

    it('should track cumulative performance statistics', async () => {
      const { result } = renderHook(() => useHybridSearch());

      // Perform multiple searches
      await act(async () => {
        await result.current.search('query 1');
      });
      
      await act(async () => {
        await result.current.search('query 2');
      });

      expect(result.current.performanceStats).toEqual(
        expect.objectContaining({
          totalSearches: 2,
          averageLocalTime: expect.any(Number),
          averageTotalTime: expect.any(Number),
          fastestSearch: expect.any(Number),
          slowestSearch: expect.any(Number)
        })
      );
    });

    it('should reset performance warning after successful fast search', async () => {
      const { result } = renderHook(() => useHybridSearch());

      // First slow search
      const slowResult = {
        ...mockSearchResult,
        performance: { ...mockSearchResult.performance, localSearchTime: 600 }
      };
      
      mockHybridSearchService.search.mockResolvedValueOnce(slowResult);
      
      await act(async () => {
        await result.current.search('slow query');
      });

      expect(result.current.performanceWarning).toBeTruthy();

      // Then fast search
      mockHybridSearchService.search.mockResolvedValueOnce(mockSearchResult);
      
      await act(async () => {
        await result.current.search('fast query');
      });

      expect(result.current.performanceWarning).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle search service errors', async () => {
      const searchError = new Error('Search service unavailable');
      mockHybridSearchService.search.mockRejectedValue(searchError);

      const { result } = renderHook(() => useHybridSearch());

      await act(async () => {
        await result.current.search('test query');
      });

      expect(result.current.error).toBe('Search service unavailable');
      expect(result.current.results).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle authorization errors', async () => {
      const authResult = {
        ...mockSearchResult,
        metadata: {
          ...mockSearchResult.metadata,
          authorizationStatus: 'denied',
          errorMessages: ['AI search not authorized']
        }
      };
      
      mockHybridSearchService.search.mockResolvedValue(authResult);

      const { result } = renderHook(() => useHybridSearch());

      await act(async () => {
        await result.current.search('sensitive query');
      });

      expect(result.current.results).toEqual(authResult);
      expect(result.current.authorizationStatus).toBe('denied');
    });

    it('should provide clear error messages', async () => {
      const networkError = new Error('Network timeout');
      mockHybridSearchService.search.mockRejectedValue(networkError);

      const { result } = renderHook(() => useHybridSearch());

      await act(async () => {
        await result.current.search('test query');
      });

      expect(result.current.error).toBe('Network timeout');
      expect(result.current.userFriendlyError).toBe(
        'Unable to complete search due to network issues. Please check your connection and try again.'
      );
    });

    it('should clear errors on successful search', async () => {
      const { result } = renderHook(() => useHybridSearch());

      // First search fails
      mockHybridSearchService.search.mockRejectedValueOnce(new Error('Service error'));
      
      await act(async () => {
        await result.current.search('failing query');
      });

      expect(result.current.error).toBeTruthy();

      // Second search succeeds
      mockHybridSearchService.search.mockResolvedValueOnce(mockSearchResult);
      
      await act(async () => {
        await result.current.search('working query');
      });

      expect(result.current.error).toBeNull();
      expect(result.current.userFriendlyError).toBeNull();
    });
  });

  describe('Search History', () => {
    it('should track search history', async () => {
      const { result } = renderHook(() => useHybridSearch());

      await act(async () => {
        await result.current.search('first query');
      });
      
      await act(async () => {
        await result.current.search('second query');
      });

      expect(result.current.searchHistory).toHaveLength(2);
      expect(result.current.searchHistory[0]).toEqual(
        expect.objectContaining({
          query: 'second query', // Most recent first
          timestamp: expect.any(Date),
          resultCount: 1,
          performance: expect.any(Object)
        })
      );
    });

    it('should limit search history size', async () => {
      const { result } = renderHook(() => useHybridSearch());

      // Perform more searches than the limit (assume limit is 10)
      for (let i = 0; i < 15; i++) {
        await act(async () => {
          await result.current.search(`query ${i}`);
        });
      }

      expect(result.current.searchHistory).toHaveLength(10);
    });

    it('should not duplicate consecutive identical searches in history', async () => {
      const { result } = renderHook(() => useHybridSearch());

      await act(async () => {
        await result.current.search('duplicate query');
      });
      
      await act(async () => {
        await result.current.search('duplicate query');
      });

      expect(result.current.searchHistory).toHaveLength(1);
    });

    it('should provide search suggestions from history', async () => {
      const { result } = renderHook(() => useHybridSearch());

      await act(async () => {
        await result.current.search('VSAM error');
      });
      
      await act(async () => {
        await result.current.search('VSAM status');
      });

      const suggestions = result.current.getSearchSuggestions('VSAM');
      
      expect(suggestions).toContain('VSAM error');
      expect(suggestions).toContain('VSAM status');
    });
  });

  describe('Utility Functions', () => {
    it('should clear results and state', async () => {
      const { result } = renderHook(() => useHybridSearch());

      // First perform a search
      await act(async () => {
        await result.current.search('test query');
      });

      expect(result.current.results).toBeTruthy();

      // Then clear results
      act(() => {
        result.current.clearResults();
      });

      expect(result.current.results).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.performance).toBeNull();
    });

    it('should retry last search', async () => {
      const { result } = renderHook(() => useHybridSearch());

      await act(async () => {
        await result.current.search('original query', 'VSAM');
      });

      // Clear the mock to verify retry call
      mockHybridSearchService.search.mockClear();

      await act(async () => {
        await result.current.retryLastSearch();
      });

      expect(mockHybridSearchService.search).toHaveBeenCalledWith(
        'original query',
        'VSAM',
        expect.any(Object)
      );
    });

    it('should handle retry when no previous search exists', async () => {
      const { result } = renderHook(() => useHybridSearch());

      await act(async () => {
        await result.current.retryLastSearch();
      });

      expect(result.current.error).toBe('No previous search to retry');
      expect(mockHybridSearchService.search).not.toHaveBeenCalled();
    });

    it('should get health status', async () => {
      const { result } = renderHook(() => useHybridSearch());

      await waitFor(() => {
        expect(result.current.healthStatus).toEqual({
          healthy: true,
          localSearchAvailable: true,
          aiSearchAvailable: true,
          authorizationAvailable: true,
          performanceMetrics: expect.any(Object)
        });
      });
    });
  });

  describe('Authorization Status Tracking', () => {
    it('should track authorization status from search results', async () => {
      const { result } = renderHook(() => useHybridSearch());

      const authorizedResult = {
        ...mockSearchResult,
        metadata: {
          ...mockSearchResult.metadata,
          authorizationStatus: 'approved'
        }
      };
      
      mockHybridSearchService.search.mockResolvedValue(authorizedResult);

      await act(async () => {
        await result.current.search('ai enhanced query');
      });

      expect(result.current.authorizationStatus).toBe('approved');
    });

    it('should provide authorization statistics', async () => {
      const { result } = renderHook(() => useHybridSearch());

      // Perform searches with different authorization outcomes
      const results = [
        { ...mockSearchResult, metadata: { ...mockSearchResult.metadata, authorizationStatus: 'approved' } },
        { ...mockSearchResult, metadata: { ...mockSearchResult.metadata, authorizationStatus: 'denied' } },
        { ...mockSearchResult, metadata: { ...mockSearchResult.metadata, authorizationStatus: 'not_required' } }
      ];

      for (let i = 0; i < results.length; i++) {
        mockHybridSearchService.search.mockResolvedValueOnce(results[i]);
        await act(async () => {
          await result.current.search(`query ${i}`);
        });
      }

      expect(result.current.authorizationStats).toEqual({
        totalRequests: 3,
        approved: 1,
        denied: 1,
        notRequired: 1,
        approvalRate: expect.any(Number)
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup service on unmount', () => {
      const { unmount } = renderHook(() => useHybridSearch());

      unmount();

      expect(mockHybridSearchService.cleanup).toHaveBeenCalled();
    });
  });

  describe('Hook Configuration', () => {
    it('should accept custom default options', () => {
      const customOptions = {
        enableAI: false,
        maxLocalResults: 30,
        prioritizeLocal: false
      };

      const { result } = renderHook(() => useHybridSearch(customOptions));

      expect(result.current.defaultOptions).toEqual(customOptions);
    });

    it('should merge custom options with defaults', async () => {
      const defaultOptions = {
        enableAI: false,
        maxLocalResults: 30
      };

      const { result } = renderHook(() => useHybridSearch(defaultOptions));

      await act(async () => {
        await result.current.search('test', undefined, { enableAI: true });
      });

      expect(mockHybridSearchService.search).toHaveBeenCalledWith(
        'test',
        undefined,
        expect.objectContaining({
          enableAI: true, // Override
          maxLocalResults: 30 // From default
        })
      );
    });
  });

  describe('Debouncing', () => {
    it('should debounce rapid search calls', async () => {
      const { result } = renderHook(() => useHybridSearch());

      // Make multiple rapid calls
      act(() => {
        result.current.search('query 1');
        result.current.search('query 2');
        result.current.search('query 3');
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 350)); // Wait for debounce
      });

      // Should only execute the last search
      expect(mockHybridSearchService.search).toHaveBeenCalledTimes(1);
      expect(mockHybridSearchService.search).toHaveBeenCalledWith(
        'query 3',
        undefined,
        expect.any(Object)
      );
    });

    it('should allow immediate search after debounce period', async () => {
      const { result } = renderHook(() => useHybridSearch());

      await act(async () => {
        await result.current.search('first query');
      });

      // Wait for debounce period
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 350));
      });

      await act(async () => {
        await result.current.search('second query');
      });

      expect(mockHybridSearchService.search).toHaveBeenCalledTimes(2);
    });
  });
});
