/**
 * Integration Tests for Route Navigation
 * Tests complete navigation flows, state synchronization, and route transitions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { KBAppRouter } from '../../../src/renderer/routing/KBRouter';
import { KBRoutes } from '../../../src/renderer/routes/KBRoutes';
import App from '../../../src/renderer/App';
import { SearchProvider } from '../../../src/renderer/contexts/SearchContext';
import { AppProvider } from '../../../src/renderer/context/AppContext';
import { mockSearchResults, mockEmptySearchResults } from '../../fixtures/searchResults';
import { mockKBEntries } from '../../fixtures/kbEntries';

// Mock child components to focus on routing behavior
jest.mock('../../../src/renderer/components/search/SearchInterface', () => ({
  __esModule: true,
  default: ({ onSearch, placeholder }: any) => (
    <div data-testid="search-interface">
      <input
        data-testid="search-input"
        placeholder={placeholder}
        onChange={(e) => onSearch?.(e.target.value)}
      />
      <button data-testid="search-button" onClick={() => onSearch?.('test query')}>
        Search
      </button>
    </div>
  ),
}));

jest.mock('../../../src/renderer/components/search/SearchResults', () => ({
  __esModule: true,
  default: ({ results, onEntrySelect, query, isLoading }: any) => (
    <div data-testid="search-results">
      {isLoading && <div data-testid="loading">Loading...</div>}
      <div data-testid="results-count">{results?.length || 0} results for "{query}"</div>
      {results?.map((result: any, index: number) => (
        <div
          key={result.entry.id}
          data-testid={`result-${index}`}
          onClick={() => onEntrySelect?.(result.entry)}
        >
          {result.entry.title}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('../../../src/renderer/components/EntryDetailView', () => ({
  __esModule: true,
  default: ({ entry, showRelated, showActions }: any) => (
    <div data-testid="entry-detail">
      <h1 data-testid="entry-title">{entry?.title}</h1>
      <div data-testid="entry-category">{entry?.category}</div>
      <div data-testid="entry-problem">{entry?.problem}</div>
      <div data-testid="entry-solution">{entry?.solution}</div>
      {showActions && (
        <div data-testid="entry-actions">
          <button data-testid="edit-button">Edit</button>
          <button data-testid="copy-button">Copy</button>
        </div>
      )}
      {showRelated && <div data-testid="related-entries">Related entries</div>}
    </div>
  ),
}));

jest.mock('../../../src/renderer/components/forms/KBEntryForm', () => ({
  __esModule: true,
  default: ({ mode, initialData, onSubmit, onCancel }: any) => (
    <form data-testid="kb-entry-form" data-mode={mode}>
      <input 
        data-testid="form-title" 
        defaultValue={initialData?.title} 
        placeholder="Title"
      />
      <select data-testid="form-category" defaultValue={initialData?.category}>
        <option value="">Select category</option>
        <option value="JCL">JCL</option>
        <option value="VSAM">VSAM</option>
        <option value="DB2">DB2</option>
      </select>
      <button type="button" data-testid="form-submit" onClick={() => onSubmit?.({})}>
        {mode === 'edit' ? 'Update' : 'Save'}
      </button>
      <button type="button" data-testid="form-cancel" onClick={onCancel}>
        Cancel
      </button>
    </form>
  ),
}));

jest.mock('../../../src/renderer/components/MetricsDashboard', () => ({
  __esModule: true,
  default: ({ onClose, fullScreen }: any) => (
    <div data-testid="metrics-dashboard" data-fullscreen={fullScreen}>
      <h1>Metrics Dashboard</h1>
      <button data-testid="close-metrics" onClick={onClose}>Close</button>
    </div>
  ),
}));

jest.mock('../../../src/renderer/components/search/SearchHistory', () => ({
  __esModule: true,
  default: ({ onSearchSelect }: any) => (
    <div data-testid="search-history">
      <h1>Search History</h1>
      <button 
        data-testid="history-item" 
        onClick={() => onSearchSelect?.('previous query', 'VSAM')}
      >
        previous query
      </button>
    </div>
  ),
}));

jest.mock('../../../src/renderer/components/SettingsView', () => ({
  __esModule: true,
  default: () => (
    <div data-testid="settings-view">
      <h1>Settings</h1>
      <input data-testid="settings-input" placeholder="Setting value" />
    </div>
  ),
}));

// Mock search and app services
const mockSearchService = {
  search: jest.fn(),
  addEntry: jest.fn(),
  updateEntry: jest.fn(),
  deleteEntry: jest.fn(),
  getMetrics: jest.fn(),
  getRecentEntries: jest.fn(),
};

const mockPerformSearch = jest.fn();
const mockSetQuery = jest.fn();
const mockUpdateFilters = jest.fn();
const mockSelectEntry = jest.fn();

jest.mock('../../../src/renderer/contexts/SearchContext', () => ({
  SearchProvider: ({ children }: any) => children,
  useSearch: () => ({
    state: {
      query: '',
      results: mockSearchResults,
      isSearching: false,
      filters: { category: undefined },
      useAI: true,
      history: [],
    },
    performSearch: mockPerformSearch,
    setQuery: mockSetQuery,
    updateFilters: mockUpdateFilters,
  }),
}));

jest.mock('../../../src/renderer/context/AppContext', () => ({
  AppProvider: ({ children }: any) => children,
  useApp: () => ({
    state: {
      selectedEntry: null,
      recentEntries: mockKBEntries,
      isLoading: false,
      error: null,
    },
    selectEntry: mockSelectEntry,
  }),
}));

describe('Route Navigation Integration', () => {
  const user = userEvent.setup();

  const TestApp: React.FC<{ initialRoute?: string }> = ({ 
    initialRoute = '/' 
  }) => (
    <MemoryRouter initialEntries={[initialRoute]}>
      <AppProvider>
        <SearchProvider>
          <KBAppRouter>
            <KBRoutes />
          </KBAppRouter>
        </SearchProvider>
      </AppProvider>
    </MemoryRouter>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    mockPerformSearch.mockResolvedValue(mockSearchResults);
  });

  describe('Dashboard Navigation', () => {
    it('should render dashboard as default route', async () => {
      render(<TestApp />);
      
      expect(screen.getByText('Knowledge Base Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Recent entries and quick access')).toBeInTheDocument();
    });

    it('should navigate to search from dashboard', async () => {
      render(<TestApp />);
      
      const searchButton = screen.getByText('Advanced Search');
      await user.click(searchButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('search-interface')).toBeInTheDocument();
      });
    });

    it('should navigate to category-specific search from dashboard', async () => {
      render(<TestApp />);
      
      const jclButton = screen.getByText('JCL Issues');
      await user.click(jclButton);
      
      await waitFor(() => {
        expect(mockSetQuery).toHaveBeenCalledWith('');
        expect(mockUpdateFilters).toHaveBeenCalledWith({ category: 'JCL' });
      });
    });
  });

  describe('Search Route Navigation', () => {
    it('should render search interface on /search route', () => {
      render(<TestApp initialRoute="/search" />);
      
      expect(screen.getByTestId('search-interface')).toBeInTheDocument();
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });

    it('should parse query from URL parameters', async () => {
      render(<TestApp initialRoute="/search?q=test%20query&category=VSAM" />);
      
      await waitFor(() => {
        expect(mockSetQuery).toHaveBeenCalledWith('test query');
        expect(mockUpdateFilters).toHaveBeenCalledWith({ category: 'VSAM' });
      });
    });

    it('should parse query from URL path', async () => {
      render(<TestApp initialRoute="/search/encoded%20query" />);
      
      await waitFor(() => {
        expect(mockSetQuery).toHaveBeenCalledWith('encoded query');
      });
    });

    it('should handle AI parameter from URL', async () => {
      render(<TestApp initialRoute="/search?q=test&ai=false" />);
      
      await waitFor(() => {
        expect(mockPerformSearch).toHaveBeenCalledWith(
          'test', 
          expect.objectContaining({ useAI: false })
        );
      });
    });

    it('should perform search when search interface is used', async () => {
      render(<TestApp initialRoute="/search" />);
      
      const searchButton = screen.getByTestId('search-button');
      await user.click(searchButton);
      
      expect(mockPerformSearch).toHaveBeenCalledWith(
        'test query',
        expect.any(Object)
      );
    });
  });

  describe('Entry Detail Navigation', () => {
    it('should render entry detail when entry ID provided', () => {
      // Mock selected entry
      require('../../../src/renderer/context/AppContext').useApp.mockReturnValue({
        state: {
          selectedEntry: mockKBEntries[0],
          recentEntries: [],
          isLoading: false,
          error: null,
        },
        selectEntry: mockSelectEntry,
      });

      render(<TestApp initialRoute={`/entry/${mockKBEntries[0].id}`} />);
      
      expect(screen.getByTestId('entry-detail')).toBeInTheDocument();
      expect(screen.getByTestId('entry-title')).toHaveTextContent(mockKBEntries[0].title);
    });

    it('should show not found message for invalid entry ID', () => {
      render(<TestApp initialRoute="/entry/invalid-id" />);
      
      expect(screen.getByText('Entry Not Found')).toBeInTheDocument();
      expect(screen.getByText('Return to Search')).toBeInTheDocument();
    });

    it('should preserve return context in back button', () => {
      render(<TestApp initialRoute="/entry/123?return_query=test%20search&source=search" />);
      
      const backButton = screen.getByText('← Back to Search');
      expect(backButton).toBeInTheDocument();
    });

    it('should navigate back to search with preserved query', async () => {
      require('../../../src/renderer/context/AppContext').useApp.mockReturnValue({
        state: {
          selectedEntry: mockKBEntries[0],
          recentEntries: [],
          isLoading: false,
          error: null,
        },
        selectEntry: mockSelectEntry,
      });

      render(<TestApp initialRoute={`/entry/${mockKBEntries[0].id}?return_query=preserved`} />);
      
      const backButton = screen.getByText('← Back to Search');
      await user.click(backButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('search-interface')).toBeInTheDocument();
      });
    });
  });

  describe('Add Entry Navigation', () => {
    it('should render add entry form', () => {
      render(<TestApp initialRoute="/add" />);
      
      expect(screen.getByTestId('kb-entry-form')).toBeInTheDocument();
      expect(screen.getByTestId('kb-entry-form')).toHaveAttribute('data-mode', 'create');
      expect(screen.getByText('Add Knowledge Base Entry')).toBeInTheDocument();
    });

    it('should prefill category from URL parameter', () => {
      render(<TestApp initialRoute="/add?category=VSAM" />);
      
      const categorySelect = screen.getByTestId('form-category');
      expect(categorySelect).toHaveValue('VSAM');
    });

    it('should handle form submission', async () => {
      render(<TestApp initialRoute="/add" />);
      
      const submitButton = screen.getByTestId('form-submit');
      await user.click(submitButton);
      
      // Should navigate away from form after submission
      await waitFor(() => {
        expect(screen.queryByTestId('kb-entry-form')).not.toBeInTheDocument();
      });
    });

    it('should handle form cancellation', async () => {
      render(<TestApp initialRoute="/add" />);
      
      const cancelButton = screen.getByTestId('form-cancel');
      await user.click(cancelButton);
      
      // Should navigate away from form
      await waitFor(() => {
        expect(screen.queryByTestId('kb-entry-form')).not.toBeInTheDocument();
      });
    });
  });

  describe('Edit Entry Navigation', () => {
    it('should render edit entry form with existing data', () => {
      require('../../../src/renderer/context/AppContext').useApp.mockReturnValue({
        state: {
          selectedEntry: mockKBEntries[0],
          recentEntries: [],
          isLoading: false,
          error: null,
        },
        selectEntry: mockSelectEntry,
      });

      render(<TestApp initialRoute={`/entry/${mockKBEntries[0].id}/edit`} />);
      
      expect(screen.getByTestId('kb-entry-form')).toBeInTheDocument();
      expect(screen.getByTestId('kb-entry-form')).toHaveAttribute('data-mode', 'edit');
      expect(screen.getByText('Edit Entry')).toBeInTheDocument();
    });

    it('should show error for invalid entry edit', () => {
      render(<TestApp initialRoute="/entry/invalid-id/edit" />);
      
      expect(screen.getByText('Entry Not Found')).toBeInTheDocument();
      expect(screen.getByText('Cannot edit - entry not found.')).toBeInTheDocument();
    });

    it('should navigate to entry view after edit completion', async () => {
      require('../../../src/renderer/context/AppContext').useApp.mockReturnValue({
        state: {
          selectedEntry: mockKBEntries[0],
          recentEntries: [],
          isLoading: false,
          error: null,
        },
        selectEntry: mockSelectEntry,
      });

      render(<TestApp initialRoute={`/entry/${mockKBEntries[0].id}/edit`} />);
      
      const submitButton = screen.getByTestId('form-submit');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('entry-detail')).toBeInTheDocument();
      });
    });
  });

  describe('Utility Routes Navigation', () => {
    it('should render metrics dashboard', () => {
      render(<TestApp initialRoute="/metrics" />);
      
      expect(screen.getByTestId('metrics-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('metrics-dashboard')).toHaveAttribute('data-fullscreen', 'true');
    });

    it('should close metrics dashboard', async () => {
      render(<TestApp initialRoute="/metrics" />);
      
      const closeButton = screen.getByTestId('close-metrics');
      await user.click(closeButton);
      
      await waitFor(() => {
        expect(screen.queryByTestId('metrics-dashboard')).not.toBeInTheDocument();
      });
    });

    it('should render search history', () => {
      render(<TestApp initialRoute="/history" />);
      
      expect(screen.getByTestId('search-history')).toBeInTheDocument();
    });

    it('should handle history item selection', async () => {
      render(<TestApp initialRoute="/history" />);
      
      const historyItem = screen.getByTestId('history-item');
      await user.click(historyItem);
      
      await waitFor(() => {
        expect(screen.getByTestId('search-interface')).toBeInTheDocument();
      });
    });

    it('should render settings view', () => {
      render(<TestApp initialRoute="/settings" />);
      
      expect(screen.getByTestId('settings-view')).toBeInTheDocument();
    });
  });

  describe('Route Fallback', () => {
    it('should redirect invalid routes to dashboard', () => {
      render(<TestApp initialRoute="/invalid-route" />);
      
      expect(screen.getByText('Knowledge Base Dashboard')).toBeInTheDocument();
    });
  });

  describe('State Synchronization', () => {
    it('should maintain search state across route changes', async () => {
      const { rerender } = render(<TestApp initialRoute="/search?q=persistent" />);
      
      // Change to entry route
      rerender(<TestApp initialRoute="/entry/123?return_query=persistent" />);
      
      // Return to search should maintain query
      rerender(<TestApp initialRoute="/search" />);
      
      await waitFor(() => {
        expect(mockSetQuery).toHaveBeenCalledWith('persistent');
      });
    });

    it('should preserve entry selection across routes', async () => {
      require('../../../src/renderer/context/AppContext').useApp.mockReturnValue({
        state: {
          selectedEntry: mockKBEntries[0],
          recentEntries: [],
          isLoading: false,
          error: null,
        },
        selectEntry: mockSelectEntry,
      });

      const { rerender } = render(<TestApp initialRoute={`/entry/${mockKBEntries[0].id}`} />);
      
      // Navigate to different route and back
      rerender(<TestApp initialRoute="/search" />);
      rerender(<TestApp initialRoute={`/entry/${mockKBEntries[0].id}`} />);
      
      expect(screen.getByTestId('entry-title')).toHaveTextContent(mockKBEntries[0].title);
    });
  });

  describe('URL Parameter Handling', () => {
    it('should handle complex URL encoding', async () => {
      render(<TestApp initialRoute="/search/complex%20query%20with%20%26%20symbols?category=JCL" />);
      
      await waitFor(() => {
        expect(mockSetQuery).toHaveBeenCalledWith('complex query with & symbols');
        expect(mockUpdateFilters).toHaveBeenCalledWith({ category: 'JCL' });
      });
    });

    it('should handle missing parameters gracefully', async () => {
      render(<TestApp initialRoute="/search/" />);
      
      expect(screen.getByTestId('search-interface')).toBeInTheDocument();
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });

    it('should handle malformed parameters gracefully', async () => {
      render(<TestApp initialRoute="/search?q=%E0%A4%A&category=invalid" />);
      
      expect(screen.getByTestId('search-interface')).toBeInTheDocument();
      // Should not crash on malformed encoding
    });
  });
});

describe('Browser Navigation Integration', () => {
  const TestAppWithHistory: React.FC = () => (
    <MemoryRouter initialEntries={['/']}>
      <AppProvider>
        <SearchProvider>
          <KBAppRouter>
            <KBRoutes />
          </KBAppRouter>
        </SearchProvider>
      </AppProvider>
    </MemoryRouter>
  );

  it('should handle browser back/forward navigation', async () => {
    const user = userEvent.setup();
    render(<TestAppWithHistory />);
    
    // Navigate to search
    const searchButton = screen.getByText('Advanced Search');
    await user.click(searchButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('search-interface')).toBeInTheDocument();
    });

    // Browser back should return to dashboard
    act(() => {
      window.history.back();
    });

    await waitFor(() => {
      expect(screen.getByText('Knowledge Base Dashboard')).toBeInTheDocument();
    });
  });

  it('should handle deep linking', async () => {
    render(
      <MemoryRouter initialEntries={['/search/deep%20link%20query?category=VSAM']}>
        <AppProvider>
          <SearchProvider>
            <KBAppRouter>
              <KBRoutes />
            </KBAppRouter>
          </SearchProvider>
        </AppProvider>
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(mockSetQuery).toHaveBeenCalledWith('deep link query');
      expect(mockUpdateFilters).toHaveBeenCalledWith({ category: 'VSAM' });
    });
  });
});