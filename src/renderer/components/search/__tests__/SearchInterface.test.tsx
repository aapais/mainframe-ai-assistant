import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { SearchInterface } from '../SearchInterface';
import { MockDataGenerator } from '../../__tests__/test-utils';

// Mock the child components
jest.mock('../SearchResults', () => ({
  SearchResults: ({ results, onSelect }: any) => (
    <div data-testid="search-results">
      {results.map((result: any, index: number) => (
        <div key={index} onClick={() => onSelect(result)}>
          {result.entry.title}
        </div>
      ))}
    </div>
  )
}));

jest.mock('../SearchFilters', () => ({
  SearchFilters: ({ onFiltersChange }: any) => (
    <div data-testid="search-filters">
      <button onClick={() => onFiltersChange({ category: 'VSAM' })}>
        Apply Filters
      </button>
    </div>
  )
}));

describe('SearchInterface Component', () => {
  const defaultProps = {
    onSearch: jest.fn(),
    onResultSelect: jest.fn(),
    isLoading: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders search interface correctly', () => {
      render(<SearchInterface {...defaultProps} />);
      
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
      expect(screen.getByTestId('search-filters')).toBeInTheDocument();
    });

    it('renders with initial query', () => {
      render(<SearchInterface {...defaultProps} initialQuery="test query" />);
      
      const searchInput = screen.getByRole('textbox');
      expect(searchInput).toHaveValue('test query');
    });

    it('renders with custom placeholder', () => {
      render(<SearchInterface {...defaultProps} placeholder="Custom placeholder" />);
      
      const searchInput = screen.getByRole('textbox');
      expect(searchInput).toHaveAttribute('placeholder', 'Custom placeholder');
    });
  });

  describe('Search Functionality', () => {
    it('calls onSearch when search button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnSearch = jest.fn();
      
      render(<SearchInterface {...defaultProps} onSearch={mockOnSearch} />);
      
      const searchInput = screen.getByRole('textbox');
      const searchButton = screen.getByRole('button', { name: /search/i });
      
      await user.type(searchInput, 'test query');
      await user.click(searchButton);
      
      expect(mockOnSearch).toHaveBeenCalledWith({
        query: 'test query',
        filters: {}
      });
    });

    it('calls onSearch when Enter key is pressed', async () => {
      const user = userEvent.setup();
      const mockOnSearch = jest.fn();
      
      render(<SearchInterface {...defaultProps} onSearch={mockOnSearch} />);
      
      const searchInput = screen.getByRole('textbox');
      
      await user.type(searchInput, 'test query{Enter}');
      
      expect(mockOnSearch).toHaveBeenCalledWith({
        query: 'test query',
        filters: {}
      });
    });

    it('debounces search when enabled', async () => {
      const user = userEvent.setup();
      const mockOnSearch = jest.fn();
      
      render(
        <SearchInterface 
          {...defaultProps} 
          onSearch={mockOnSearch}
          debounceMs={100}
        />
      );
      
      const searchInput = screen.getByRole('textbox');
      
      await user.type(searchInput, 'test');
      
      // Should not call immediately
      expect(mockOnSearch).not.toHaveBeenCalled();
      
      // Should call after debounce period
      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith({
          query: 'test',
          filters: {}
        });
      }, { timeout: 200 });
    });

    it('does not search with empty query', async () => {
      const user = userEvent.setup();
      const mockOnSearch = jest.fn();
      
      render(<SearchInterface {...defaultProps} onSearch={mockOnSearch} />);
      
      const searchButton = screen.getByRole('button', { name: /search/i });
      await user.click(searchButton);
      
      expect(mockOnSearch).not.toHaveBeenCalled();
    });

    it('trims whitespace from search query', async () => {
      const user = userEvent.setup();
      const mockOnSearch = jest.fn();
      
      render(<SearchInterface {...defaultProps} onSearch={mockOnSearch} />);
      
      const searchInput = screen.getByRole('textbox');
      const searchButton = screen.getByRole('button', { name: /search/i });
      
      await user.type(searchInput, '  test query  ');
      await user.click(searchButton);
      
      expect(mockOnSearch).toHaveBeenCalledWith({
        query: 'test query',
        filters: {}
      });
    });
  });

  describe('Filter Integration', () => {
    it('applies filters to search', async () => {
      const user = userEvent.setup();
      const mockOnSearch = jest.fn();
      
      render(<SearchInterface {...defaultProps} onSearch={mockOnSearch} />);
      
      const searchInput = screen.getByRole('textbox');
      const applyFiltersButton = screen.getByText('Apply Filters');
      
      await user.type(searchInput, 'test');
      await user.click(applyFiltersButton);
      
      // Search should be triggered with filters
      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith({
          query: 'test',
          filters: { category: 'VSAM' }
        });
      });
    });

    it('maintains filters across searches', async () => {
      const user = userEvent.setup();
      const mockOnSearch = jest.fn();
      
      render(<SearchInterface {...defaultProps} onSearch={mockOnSearch} />);
      
      const searchInput = screen.getByRole('textbox');
      const searchButton = screen.getByRole('button', { name: /search/i });
      const applyFiltersButton = screen.getByText('Apply Filters');
      
      // Apply filters first
      await user.click(applyFiltersButton);
      
      // Then search
      await user.type(searchInput, 'test');
      await user.click(searchButton);
      
      expect(mockOnSearch).toHaveBeenCalledWith({
        query: 'test',
        filters: { category: 'VSAM' }
      });
    });
  });

  describe('Results Display', () => {
    it('displays search results when provided', () => {
      const results = MockDataGenerator.searchResults(3);
      
      render(<SearchInterface {...defaultProps} results={results} />);
      
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
      
      results.forEach(result => {
        expect(screen.getByText(result.entry.title)).toBeInTheDocument();
      });
    });

    it('handles result selection', async () => {
      const user = userEvent.setup();
      const mockOnResultSelect = jest.fn();
      const results = MockDataGenerator.searchResults(2);
      
      render(
        <SearchInterface 
          {...defaultProps} 
          onResultSelect={mockOnResultSelect}
          results={results}
        />
      );
      
      const firstResult = screen.getByText(results[0].entry.title);
      await user.click(firstResult);
      
      expect(mockOnResultSelect).toHaveBeenCalledWith(results[0]);
    });

    it('shows empty state when no results', () => {
      render(<SearchInterface {...defaultProps} results={[]} hasSearched />);
      
      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
    });

    it('shows initial state when no search performed', () => {
      render(<SearchInterface {...defaultProps} />);
      
      expect(screen.getByText(/enter a search query/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator when loading', () => {
      render(<SearchInterface {...defaultProps} isLoading />);
      
      expect(screen.getByText(/searching/i)).toBeInTheDocument();
    });

    it('disables search button when loading', () => {
      render(<SearchInterface {...defaultProps} isLoading />);
      
      const searchButton = screen.getByRole('button', { name: /search/i });
      expect(searchButton).toBeDisabled();
    });

    it('shows loading in search results area', () => {
      render(<SearchInterface {...defaultProps} isLoading />);
      
      expect(screen.getByTestId('search-loading')).toBeInTheDocument();
    });
  });

  describe('Advanced Features', () => {
    it('supports search history', async () => {
      const user = userEvent.setup();
      const mockOnSearch = jest.fn();
      
      render(<SearchInterface {...defaultProps} onSearch={mockOnSearch} showHistory />);
      
      const searchInput = screen.getByRole('textbox');
      
      // Perform searches to build history
      await user.type(searchInput, 'first query');
      await user.keyboard('{Enter}');
      
      await user.clear(searchInput);
      await user.type(searchInput, 'second query');
      await user.keyboard('{Enter}');
      
      // Focus search input to show history
      await user.click(searchInput);
      
      expect(screen.getByText('Recent Searches')).toBeInTheDocument();
    });

    it('supports search suggestions', async () => {
      const user = userEvent.setup();
      const suggestions = ['VSAM error', 'JCL issue', 'DB2 problem'];
      
      render(
        <SearchInterface 
          {...defaultProps} 
          suggestions={suggestions}
          showSuggestions 
        />
      );
      
      const searchInput = screen.getByRole('textbox');
      
      await user.type(searchInput, 'v');
      
      expect(screen.getByText('VSAM error')).toBeInTheDocument();
    });

    it('supports advanced search mode', async () => {
      const user = userEvent.setup();
      
      render(<SearchInterface {...defaultProps} showAdvancedSearch />);
      
      const advancedButton = screen.getByText(/advanced search/i);
      await user.click(advancedButton);
      
      expect(screen.getByText(/advanced search options/i)).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports keyboard navigation through results', async () => {
      const user = userEvent.setup();
      const results = MockDataGenerator.searchResults(3);
      
      render(<SearchInterface {...defaultProps} results={results} />);
      
      const searchInput = screen.getByRole('textbox');
      
      // Focus search input and use arrow keys
      await user.click(searchInput);
      await user.keyboard('{ArrowDown}');
      
      // First result should be highlighted
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });

    it('supports Escape key to clear search', async () => {
      const user = userEvent.setup();
      
      render(<SearchInterface {...defaultProps} />);
      
      const searchInput = screen.getByRole('textbox');
      
      await user.type(searchInput, 'test query');
      await user.keyboard('{Escape}');
      
      expect(searchInput).toHaveValue('');
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels', () => {
      render(<SearchInterface {...defaultProps} />);
      
      const searchInput = screen.getByRole('textbox');
      const searchButton = screen.getByRole('button', { name: /search/i });
      
      expect(searchInput).toHaveAttribute('aria-label');
      expect(searchButton).toHaveAttribute('aria-label');
    });

    it('announces search results to screen readers', () => {
      const results = MockDataGenerator.searchResults(5);
      
      render(<SearchInterface {...defaultProps} results={results} />);
      
      const resultsAnnouncement = screen.getByRole('status');
      expect(resultsAnnouncement).toHaveTextContent('5 results found');
    });

    it('announces loading state to screen readers', () => {
      render(<SearchInterface {...defaultProps} isLoading />);
      
      const loadingAnnouncement = screen.getByRole('status');
      expect(loadingAnnouncement).toHaveTextContent('Searching...');
    });

    it('supports keyboard shortcuts', async () => {
      const user = userEvent.setup();
      const mockOnSearch = jest.fn();
      
      render(<SearchInterface {...defaultProps} onSearch={mockOnSearch} />);
      
      // Ctrl+/ should focus search input
      await user.keyboard('{Control>}/{/Control}');
      
      const searchInput = screen.getByRole('textbox');
      expect(document.activeElement).toBe(searchInput);
    });
  });

  describe('Error Handling', () => {
    it('displays search error messages', () => {
      render(
        <SearchInterface 
          {...defaultProps} 
          error="Search service unavailable"
        />
      );
      
      expect(screen.getByText(/search service unavailable/i)).toBeInTheDocument();
    });

    it('allows retry after error', async () => {
      const user = userEvent.setup();
      const mockOnSearch = jest.fn();
      
      render(
        <SearchInterface 
          {...defaultProps}
          onSearch={mockOnSearch}
          error="Network error"
        />
      );
      
      const retryButton = screen.getByText(/try again/i);
      await user.click(retryButton);
      
      expect(mockOnSearch).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('handles large result sets efficiently', () => {
      const largeResultSet = MockDataGenerator.searchResults(100);
      
      const startTime = performance.now();
      render(<SearchInterface {...defaultProps} results={largeResultSet} />);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should render in less than 100ms
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });

    it('debounces rapid input changes', async () => {
      const user = userEvent.setup();
      const mockOnSearch = jest.fn();
      
      render(
        <SearchInterface 
          {...defaultProps} 
          onSearch={mockOnSearch}
          debounceMs={50}
        />
      );
      
      const searchInput = screen.getByRole('textbox');
      
      // Type rapidly
      await user.type(searchInput, 'abcdef');
      
      // Should only call once after debounce
      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles special characters in search query', async () => {
      const user = userEvent.setup();
      const mockOnSearch = jest.fn();
      
      render(<SearchInterface {...defaultProps} onSearch={mockOnSearch} />);
      
      const searchInput = screen.getByRole('textbox');
      const specialQuery = 'S0C7 & VSAM-35 "error" (critical)';
      
      await user.type(searchInput, specialQuery);
      await user.keyboard('{Enter}');
      
      expect(mockOnSearch).toHaveBeenCalledWith({
        query: specialQuery,
        filters: {}
      });
    });

    it('handles extremely long search queries', async () => {
      const user = userEvent.setup();
      const mockOnSearch = jest.fn();
      
      render(<SearchInterface {...defaultProps} onSearch={mockOnSearch} maxQueryLength={100} />);
      
      const searchInput = screen.getByRole('textbox');
      const longQuery = 'a'.repeat(150);
      
      await user.type(searchInput, longQuery);
      
      // Should truncate to max length
      expect(searchInput).toHaveValue('a'.repeat(100));
    });

    it('handles null or undefined results gracefully', () => {
      render(<SearchInterface {...defaultProps} results={null as any} />);
      
      expect(screen.getByTestId('search-interface')).toBeInTheDocument();
      expect(screen.queryByTestId('search-results')).not.toBeInTheDocument();
    });
  });
});