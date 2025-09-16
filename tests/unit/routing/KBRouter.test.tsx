/**
 * Unit Tests for KB Router
 * Tests core router functionality, state preservation, and URL synchronization
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

import { 
  KBRouterProvider, 
  useKBRouter, 
  useKBNavigation,
  useSearchURL,
  useNavigationHistory,
  NavigationState 
} from '../../../src/renderer/routing/KBRouter';
import { SearchProvider } from '../../../src/renderer/contexts/SearchContext';
import { AppProvider } from '../../../src/renderer/context/AppContext';
import { mockSearchResults } from '../../fixtures/searchResults';
import { mockKBEntries } from '../../fixtures/kbEntries';

// Mock the contexts
jest.mock('../../../src/renderer/contexts/SearchContext');
jest.mock('../../../src/renderer/context/AppContext');

const mockNavigate = jest.fn();
const mockUseLocation = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation.mockReturnValue({
    pathname: '/search',
    search: '?q=test&category=VSAM',
    hash: '',
  }),
}));

describe('KBRouter Core Functionality', () => {
  const mockSearchState = {
    query: 'test query',
    results: mockSearchResults,
    isSearching: false,
    filters: { category: 'VSAM' as const },
    useAI: true,
    history: [],
  };

  const mockAppState = {
    selectedEntry: mockKBEntries[0],
    recentEntries: [],
    isLoading: false,
    error: null,
  };

  const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <MemoryRouter initialEntries={['/search?q=test&category=VSAM']}>
      <AppProvider>
        <SearchProvider>
          <KBRouterProvider>
            {children}
          </KBRouterProvider>
        </SearchProvider>
      </AppProvider>
    </MemoryRouter>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    
    // Mock search context
    require('../../../src/renderer/contexts/SearchContext').useSearch.mockReturnValue({
      state: mockSearchState,
      performSearch: jest.fn(),
      setQuery: jest.fn(),
      updateFilters: jest.fn(),
    });

    // Mock app context
    require('../../../src/renderer/context/AppContext').useApp.mockReturnValue({
      state: mockAppState,
      selectEntry: jest.fn(),
    });
  });

  describe('useKBRouter Hook', () => {
    it('should provide navigation methods', () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      expect(result.current).toHaveProperty('navigateToSearch');
      expect(result.current).toHaveProperty('navigateToEntry');
      expect(result.current).toHaveProperty('navigateToAddEntry');
      expect(result.current).toHaveProperty('navigateToMetrics');
      expect(result.current).toHaveProperty('navigateToHistory');
      expect(result.current).toHaveProperty('navigateBack');
      expect(result.current).toHaveProperty('navigateForward');
    });

    it('should provide state management methods', () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      expect(result.current).toHaveProperty('preserveSearchContext');
      expect(result.current).toHaveProperty('restoreSearchContext');
      expect(result.current).toHaveProperty('clearNavigationHistory');
    });

    it('should provide URL utilities', () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      expect(result.current).toHaveProperty('generateShareableURL');
      expect(result.current).toHaveProperty('parseURLParams');
      expect(result.current).toHaveProperty('updateURLWithState');
    });

    it('should throw error when used outside provider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      expect(() => {
        renderHook(() => useKBRouter());
      }).toThrow('useKBRouter must be used within KBRouterProvider');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Navigation Methods', () => {
    it('should navigate to search with query and category', () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.navigateToSearch('test query', 'JCL');
      });

      expect(mockNavigate).toHaveBeenCalledWith('/search/test%20query?category=JCL');
    });

    it('should navigate to search without parameters', () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.navigateToSearch();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/search');
    });

    it('should navigate to entry with context preservation', () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.navigateToEntry('entry-123', 'search');
      });

      expect(mockNavigate).toHaveBeenCalledWith('/entry/entry-123?source=search&return_query=test%20query');
    });

    it('should navigate to add entry with prefilled data', () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.navigateToAddEntry({ category: 'VSAM' });
      });

      expect(mockNavigate).toHaveBeenCalledWith('/add?category=VSAM&related_query=test%20query');
    });

    it('should navigate to metrics', () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.navigateToMetrics();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/metrics');
    });

    it('should navigate to history', () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.navigateToHistory();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/history');
    });
  });

  describe('State Preservation', () => {
    it('should preserve search context', () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      const searchContext = {
        query: 'preserved query',
        category: 'DB2' as const,
        results: mockSearchResults,
        useAI: false,
      };

      act(() => {
        result.current.preserveSearchContext(searchContext);
      });

      expect(result.current.state.searchContext).toEqual(searchContext);
    });

    it('should restore search context from localStorage', () => {
      const savedContext = {
        query: 'saved query',
        category: 'VSAM',
        results: [],
        useAI: true,
      };

      localStorage.setItem('kb-search-context', JSON.stringify(savedContext));

      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      act(() => {
        const restored = result.current.restoreSearchContext();
        expect(restored).toEqual(savedContext);
      });
    });

    it('should handle localStorage errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockGetItem = jest.spyOn(Storage.prototype, 'getItem')
        .mockImplementation(() => {
          throw new Error('Storage error');
        });

      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      act(() => {
        const restored = result.current.restoreSearchContext();
        expect(restored).toBeUndefined();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to restore search context:', expect.any(Error));
      
      consoleSpy.mockRestore();
      mockGetItem.mockRestore();
    });
  });

  describe('Navigation History', () => {
    it('should track navigation history', async () => {
      mockUseLocation.mockReturnValue({
        pathname: '/search/test-query',
        search: '?category=VSAM',
        hash: '',
      });

      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      await waitFor(() => {
        expect(result.current.state.navigationHistory).toHaveLength(1);
        expect(result.current.state.navigationHistory[0].route).toBe('/search/test-query');
        expect(result.current.state.navigationHistory[0].searchQuery).toBe('test-query');
      });
    });

    it('should limit navigation history to 20 items', () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      // Simulate adding 25 items
      act(() => {
        for (let i = 0; i < 25; i++) {
          result.current.state.navigationHistory.push({
            route: `/test-route-${i}`,
            timestamp: new Date(),
          });
        }
      });

      expect(result.current.state.navigationHistory.length).toBeLessThanOrEqual(20);
    });

    it('should clear navigation history', () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.clearNavigationHistory();
      });

      expect(result.current.state.navigationHistory).toHaveLength(0);
    });
  });

  describe('URL Utilities', () => {
    it('should generate shareable URL', () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      const url = result.current.generateShareableURL('test query', 'VSAM');
      expect(url).toBe(`${window.location.origin}${window.location.pathname}#/search/test%20query?q=test%20query&category=VSAM`);
    });

    it('should parse URL parameters', () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      const params = result.current.parseURLParams();
      expect(params.get('q')).toBe('test');
      expect(params.get('category')).toBe('VSAM');
    });

    it('should update URL with state changes', () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.updateURLWithState({
          query: 'new query',
          category: 'JCL',
          useAI: false,
        });
      });

      expect(mockNavigate).toHaveBeenCalledWith('/search?q=new%20query&category=JCL&ai=false', { replace: true });
    });
  });

  describe('Browser Navigation', () => {
    it('should navigate back using history', () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      // Add some history
      act(() => {
        result.current.state.navigationHistory.push(
          { route: '/search', timestamp: new Date() },
          { route: '/entry/123', timestamp: new Date() }
        );
      });

      act(() => {
        result.current.navigateBack();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/search');
    });

    it('should use browser back when no history available', () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.navigateBack();
      });

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('should navigate forward', () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.navigateForward();
      });

      expect(mockNavigate).toHaveBeenCalledWith(1);
    });
  });
});

describe('Convenience Hooks', () => {
  const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <MemoryRouter>
      <AppProvider>
        <SearchProvider>
          <KBRouterProvider>
            {children}
          </KBRouterProvider>
        </SearchProvider>
      </AppProvider>
    </MemoryRouter>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    
    require('../../../src/renderer/contexts/SearchContext').useSearch.mockReturnValue({
      state: { query: 'test', filters: { category: 'VSAM' }, useAI: true },
    });
  });

  describe('useKBNavigation', () => {
    it('should provide simplified navigation methods', () => {
      const { result } = renderHook(() => useKBNavigation(), {
        wrapper: TestWrapper,
      });

      expect(result.current).toHaveProperty('toSearch');
      expect(result.current).toHaveProperty('toEntry');
      expect(result.current).toHaveProperty('toAddEntry');
      expect(result.current).toHaveProperty('toMetrics');
      expect(result.current).toHaveProperty('toHistory');
      expect(result.current).toHaveProperty('back');

      act(() => {
        result.current.toSearch('test', 'JCL');
      });

      expect(mockNavigate).toHaveBeenCalledWith('/search/test?category=JCL');
    });
  });

  describe('useSearchURL', () => {
    it('should provide URL management for search state', () => {
      const { result } = renderHook(() => useSearchURL(), {
        wrapper: TestWrapper,
      });

      expect(result.current).toHaveProperty('getCurrentSearchURL');
      expect(result.current).toHaveProperty('syncURLWithSearch');
      expect(result.current).toHaveProperty('generateShareableURL');

      const currentURL = result.current.getCurrentSearchURL();
      expect(currentURL).toContain('test');
      expect(currentURL).toContain('VSAM');
    });

    it('should sync URL with search state', () => {
      const { result } = renderHook(() => useSearchURL(), {
        wrapper: TestWrapper,
      });

      act(() => {
        result.current.syncURLWithSearch();
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining('q=test'),
        { replace: true }
      );
    });
  });

  describe('useNavigationHistory', () => {
    it('should provide navigation history management', () => {
      const { result } = renderHook(() => useNavigationHistory(), {
        wrapper: TestWrapper,
      });

      expect(result.current).toHaveProperty('history');
      expect(result.current).toHaveProperty('clearHistory');
      expect(Array.isArray(result.current.history)).toBe(true);

      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.history).toHaveLength(0);
    });
  });
});

describe('Error Handling', () => {
  it('should handle malformed URL parameters gracefully', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/search',
      search: '?q=%E0%A4%A&category=invalid',
      hash: '',
    });

    const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <MemoryRouter>
        <AppProvider>
          <SearchProvider>
            <KBRouterProvider>
              {children}
            </KBRouterProvider>
          </SearchProvider>
        </AppProvider>
      </MemoryRouter>
    );

    expect(() => {
      renderHook(() => useKBRouter(), { wrapper: TestWrapper });
    }).not.toThrow();
  });

  it('should handle navigation errors gracefully', () => {
    mockNavigate.mockImplementation(() => {
      throw new Error('Navigation error');
    });

    const { result } = renderHook(() => useKBRouter(), {
      wrapper: ({ children }) => (
        <MemoryRouter>
          <AppProvider>
            <SearchProvider>
              <KBRouterProvider>
                {children}
              </KBRouterProvider>
            </SearchProvider>
          </AppProvider>
        </MemoryRouter>
      ),
    });

    expect(() => {
      act(() => {
        result.current.navigateToSearch('test');
      });
    }).not.toThrow();
  });
});