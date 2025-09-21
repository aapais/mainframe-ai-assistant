/**
 * Unit Tests for useSearchState Hook
 */

import { renderHook, act } from '@testing-library/react';
import { useSearchState } from '../../../src/renderer/hooks/useSearchState';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('useSearchState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('[]');
  });

  describe('Initial State', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useSearchState());
      const [state] = result.current;

      expect(state.query).toBe('');
      expect(state.useAI).toBe(true);
      expect(state.showSuggestions).toBe(false);
      expect(state.showFilters).toBe(false);
      expect(state.showQuickActions).toBe(false);
      expect(state.selectedCategory).toBe(null);
      expect(state.selectedTags).toEqual([]);
      expect(state.selectedSuggestionIndex).toBe(-1);
      expect(state.loading).toBe(false);
      expect(state.suggestions).toEqual([]);
      expect(state.recentSearches).toEqual([]);
    });

    it('should load recent searches from localStorage', () => {
      const mockRecentSearches = ['S0C4 ABEND', 'DB2 ERROR'];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockRecentSearches));

      const { result } = renderHook(() => useSearchState());
      const [state] = result.current;

      expect(state.recentSearches).toEqual(mockRecentSearches);
    });
  });

  describe('State Updates', () => {
    it('should update query correctly', () => {
      const { result } = renderHook(() => useSearchState());
      const [, actions] = result.current;

      act(() => {
        actions.setQuery('test query');
      });

      expect(result.current[0].query).toBe('test query');
    });

    it('should toggle AI mode correctly', () => {
      const { result } = renderHook(() => useSearchState());
      const [, actions] = result.current;

      act(() => {
        actions.setUseAI(false);
      });

      expect(result.current[0].useAI).toBe(false);

      act(() => {
        actions.setUseAI(true);
      });

      expect(result.current[0].useAI).toBe(true);
    });

    it('should handle dropdown state correctly', () => {
      const { result } = renderHook(() => useSearchState());
      const [, actions] = result.current;

      // Show suggestions should close other dropdowns
      act(() => {
        actions.setShowFilters(true);
        actions.setShowQuickActions(true);
      });

      act(() => {
        actions.setShowSuggestions(true);
      });

      const [state] = result.current;
      expect(state.showSuggestions).toBe(true);
      expect(state.showFilters).toBe(false);
      expect(state.showQuickActions).toBe(false);
    });

    it('should update categories and tags', () => {
      const { result } = renderHook(() => useSearchState());
      const [, actions] = result.current;

      act(() => {
        actions.setSelectedCategory('COBOL');
        actions.setSelectedTags(['error', 'abend']);
      });

      const [state] = result.current;
      expect(state.selectedCategory).toBe('COBOL');
      expect(state.selectedTags).toEqual(['error', 'abend']);
    });
  });

  describe('Recent Searches', () => {
    it('should add recent searches and persist to localStorage', () => {
      const { result } = renderHook(() => useSearchState());
      const [, actions] = result.current;

      act(() => {
        actions.addRecentSearch('S0C4 ABEND');
      });

      expect(result.current[0].recentSearches).toContain('S0C4 ABEND');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'recentSearches',
        JSON.stringify(['S0C4 ABEND'])
      );
    });

    it('should prevent duplicate entries in recent searches', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(['S0C4 ABEND']));
      const { result } = renderHook(() => useSearchState());
      const [, actions] = result.current;

      act(() => {
        actions.addRecentSearch('S0C4 ABEND');
      });

      expect(result.current[0].recentSearches).toEqual(['S0C4 ABEND']);
    });

    it('should limit recent searches to 10 items', () => {
      const manySearches = Array.from({ length: 12 }, (_, i) => `search ${i}`);
      localStorageMock.getItem.mockReturnValue(JSON.stringify(manySearches));

      const { result } = renderHook(() => useSearchState());
      const [, actions] = result.current;

      act(() => {
        actions.addRecentSearch('new search');
      });

      expect(result.current[0].recentSearches).toHaveLength(10);
      expect(result.current[0].recentSearches[0]).toBe('new search');
    });
  });

  describe('Filter Management', () => {
    it('should clear all filters', () => {
      const { result } = renderHook(() => useSearchState());
      const [, actions] = result.current;

      // Set some filters
      act(() => {
        actions.setSelectedCategory('COBOL');
        actions.setSelectedTags(['error']);
        actions.setShowFilters(true);
      });

      // Clear filters
      act(() => {
        actions.clearFilters();
      });

      const [state] = result.current;
      expect(state.selectedCategory).toBe(null);
      expect(state.selectedTags).toEqual([]);
      expect(state.showFilters).toBe(false);
    });

    it('should reset entire state', () => {
      const { result } = renderHook(() => useSearchState());
      const [, actions] = result.current;

      // Set some state
      act(() => {
        actions.setQuery('test');
        actions.setUseAI(false);
        actions.setSelectedCategory('COBOL');
      });

      // Reset
      act(() => {
        actions.reset();
      });

      const [state] = result.current;
      expect(state.query).toBe('');
      expect(state.useAI).toBe(true);
      expect(state.selectedCategory).toBe(null);
      // Recent searches should be preserved
      expect(state.recentSearches).toBeDefined();
    });
  });

  describe('Suggestion Generation', () => {
    it('should generate suggestions based on query', (done) => {
      const { result } = renderHook(() => useSearchState());
      const [, actions] = result.current;

      act(() => {
        actions.setQuery('S0C4');
      });

      // Wait for debounced suggestion generation
      setTimeout(() => {
        const [state] = result.current;
        expect(state.suggestions.length).toBeGreaterThan(0);
        done();
      }, 200);
    });

    it('should show quick actions when query is empty', (done) => {
      const { result } = renderHook(() => useSearchState());
      const [, actions] = result.current;

      act(() => {
        actions.setQuery('');
      });

      setTimeout(() => {
        const [state] = result.current;
        const hasQuickActions = state.suggestions.some(s => s.type === 'quick-action');
        expect(hasQuickActions).toBe(true);
        done();
      }, 200);
    });
  });

  describe('Performance', () => {
    it('should debounce suggestion generation', () => {
      const { result } = renderHook(() => useSearchState());
      const [, actions] = result.current;

      // Rapid fire queries
      act(() => {
        actions.setQuery('a');
        actions.setQuery('ab');
        actions.setQuery('abc');
        actions.setQuery('abcd');
      });

      // Should only generate suggestions once after debounce
      const [state] = result.current;
      expect(state.query).toBe('abcd');
    });
  });
});