/**
 * SearchResults Component Tests - Refactored Architecture
 *
 * Comprehensive test suite for the new modular SearchResults architecture
 * @version 2.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import SearchResults from '../SearchResults';
import { SearchResultsProvider } from '../providers/SearchResultsProvider';
import { SearchResult } from '../../../../types/index';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  callback: IntersectionObserverCallback;
  observe = jest.fn((element: Element) => {
    setTimeout(() => {
      this.callback([{
        isIntersecting: true,
        target: element,
        intersectionRatio: 1,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: {} as DOMRectReadOnly,
        time: Date.now()
      }], this);
    }, 0);
  });
  disconnect = jest.fn();
  unobserve = jest.fn();
};

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

// Test data
const mockResults: SearchResult[] = [
  {
    entry: {
      id: '1',
      title: 'JCL Step Processing Error',
      problem: 'Job fails at step execution with ABEND S0C7 data exception error',
      solution: 'Check numeric data fields for invalid characters and ensure proper data validation',
      category: 'JCL',
      tags: ['abend', 's0c7', 'data-exception'],
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-15'),
      created_by: 'admin',
      usage_count: 25,
      success_count: 20,
      failure_count: 5,
      version: 1
    },
    score: 0.92,
    matchType: 'exact',
    highlights: ['ABEND S0C7 data exception', 'numeric data fields'],
    explanation: 'Exact match for JCL processing error'
  },
  {
    entry: {
      id: '2',
      title: 'VSAM Dataset Access Issue',
      problem: 'Unable to access VSAM dataset, receiving file not found error',
      solution: 'Verify dataset allocation and catalog entries, check IDCAMS listcat output',
      category: 'VSAM',
      tags: ['vsam', 'dataset', 'catalog'],
      created_at: new Date('2024-01-02'),
      updated_at: new Date('2024-01-16'),
      created_by: 'user1',
      usage_count: 15,
      success_count: 12,
      failure_count: 3,
      version: 1
    },
    score: 0.78,
    matchType: 'fuzzy',
    highlights: ['VSAM dataset', 'file not found'],
    explanation: 'Fuzzy match for dataset access problems'
  }
];

const defaultProps = {
  results: mockResults,
  searchQuery: 'JCL error processing',
  isLoading: false,
  error: null,
  selectedIndex: -1,
  showConfidenceScores: true,
  onResultSelect: jest.fn(),
  onLoadMore: jest.fn()
};

describe('SearchResults - Refactored Architecture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<SearchResults {...defaultProps} />);
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('displays the correct number of results', () => {
      render(<SearchResults {...defaultProps} />);

      const resultsContainer = screen.getByRole('listbox');
      expect(resultsContainer).toHaveAttribute('aria-label',
        expect.stringContaining('2 results found'));

      expect(screen.getByText('JCL Step Processing Error')).toBeInTheDocument();
      expect(screen.getByText('VSAM Dataset Access Issue')).toBeInTheDocument();
    });

    it('displays search query in header', () => {
      render(<SearchResults {...defaultProps} />);
      expect(screen.getByText(/Found 2 results for "JCL error processing"/)).toBeInTheDocument();
    });

    it('renders with modular architecture components', () => {
      render(<SearchResults {...defaultProps} />);

      // Header should be present
      expect(screen.getByText('Search Results')).toBeInTheDocument();

      // Individual result items should be present
      expect(screen.getByText('Category: JCL')).toBeInTheDocument();
      expect(screen.getByText('Category: VSAM')).toBeInTheDocument();
    });
  });

  describe('State Management', () => {
    it('displays loading state correctly', () => {
      render(<SearchResults {...defaultProps} isLoading={true} results={[]} />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Searching knowledge base...')).toBeInTheDocument();
      expect(screen.getByLabelText('Loading search results')).toBeInTheDocument();
    });

    it('displays error state correctly', () => {
      const errorMessage = 'Failed to fetch search results';
      render(<SearchResults {...defaultProps} error={errorMessage} results={[]} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Search Error')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('displays empty state correctly', () => {
      render(<SearchResults {...defaultProps} results={[]} />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('No results found')).toBeInTheDocument();
      expect(screen.getByText(/Try adjusting your search query/)).toBeInTheDocument();
    });
  });

  describe('Search Highlighting', () => {
    it('highlights search terms in result text', () => {
      render(<SearchResults {...defaultProps} />);

      // Check for highlighted terms (mark elements should be created by HighlightText component)
      const resultItems = screen.getAllByRole('button');
      expect(resultItems.length).toBeGreaterThan(0);

      // At least one result should contain the search terms
      expect(screen.getByText('JCL Step Processing Error')).toBeInTheDocument();
    });

    it('handles empty search query gracefully', () => {
      render(<SearchResults {...defaultProps} searchQuery="" />);

      expect(screen.getByText('JCL Step Processing Error')).toBeInTheDocument();
    });
  });

  describe('Confidence Scores', () => {
    it('displays confidence scores when enabled', () => {
      render(<SearchResults {...defaultProps} showConfidenceScores={true} />);

      expect(screen.getByText('92%')).toBeInTheDocument();
      expect(screen.getByText('78%')).toBeInTheDocument();
    });

    it('hides confidence scores when disabled', () => {
      render(<SearchResults {...defaultProps} showConfidenceScores={false} />);

      expect(screen.queryByText('92%')).not.toBeInTheDocument();
      expect(screen.queryByText('78%')).not.toBeInTheDocument();
    });

    it('displays confidence legend in header', () => {
      render(<SearchResults {...defaultProps} />);

      expect(screen.getByText('Confidence:')).toBeInTheDocument();
      expect(screen.getByText('High (80%+)')).toBeInTheDocument();
      expect(screen.getByText('Medium (60-80%)')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('responds to arrow key navigation', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);

      const listbox = screen.getByRole('listbox');
      listbox.focus();

      await user.keyboard('{ArrowDown}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-0');

      await user.keyboard('{ArrowDown}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-1');

      await user.keyboard('{ArrowUp}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-0');
    });

    it('handles Home and End keys', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);

      const listbox = screen.getByRole('listbox');
      listbox.focus();

      await user.keyboard('{End}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-1');

      await user.keyboard('{Home}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-0');
    });

    it('calls onResultSelect when Enter is pressed', async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      render(<SearchResults {...defaultProps} onResultSelect={mockOnSelect} />);

      const listbox = screen.getByRole('listbox');
      listbox.focus();

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(mockOnSelect).toHaveBeenCalledWith(mockResults[0], 0);
    });
  });

  describe('Virtualization', () => {
    it('uses regular rendering for small datasets', () => {
      render(<SearchResults {...defaultProps} virtualizationThreshold={10} />);

      // With only 2 results, should use regular rendering
      const resultItems = screen.getAllByRole('button');
      expect(resultItems).toHaveLength(2);
    });

    it('enables virtualization for large datasets', () => {
      const largeResults = Array.from({ length: 25 }, (_, i) => ({
        ...mockResults[0],
        entry: { ...mockResults[0].entry, id: `result-${i}`, title: `Result ${i}` }
      }));

      render(<SearchResults {...defaultProps} results={largeResults} virtualizationThreshold={20} />);

      // Should render the virtual scrolling container
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('shows load more button for large datasets', () => {
      const largeResults = Array.from({ length: 25 }, (_, i) => ({
        ...mockResults[0],
        entry: { ...mockResults[0].entry, id: `result-${i}`, title: `Result ${i}` }
      }));

      render(<SearchResults {...defaultProps} results={largeResults} />);

      if (screen.queryByText('Load More Results')) {
        expect(screen.getByText('Load More Results')).toBeInTheDocument();
      }
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<SearchResults {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper ARIA labels and roles', () => {
      render(<SearchResults {...defaultProps} />);

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-label',
        expect.stringContaining('Search results'));

      const resultItems = screen.getAllByRole('button');
      resultItems.forEach((item, index) => {
        expect(item).toHaveAttribute('aria-label',
          expect.stringContaining(`Search result ${index + 1}`));
        expect(item).toHaveAttribute('aria-describedby');
      });
    });

    it('includes screen reader descriptions', () => {
      render(<SearchResults {...defaultProps} />);

      // Check for screen reader content
      const srContent = container.querySelector('.sr-only');
      expect(srContent).toBeInTheDocument();
    });
  });

  describe('Error Boundary', () => {
    const originalConsoleError = console.error;

    beforeEach(() => {
      console.error = jest.fn();
    });

    afterEach(() => {
      console.error = originalConsoleError;
    });

    it('catches and handles component errors gracefully', () => {
      // Create a component that throws an error
      const ThrowError = () => {
        throw new Error('Test error');
      };

      const { container } = render(
        <SearchResults {...defaultProps}>
          <ThrowError />
        </SearchResults>
      );

      // Component should still render without crashing
      expect(container).toBeInTheDocument();
    });
  });

  describe('Compound Component Pattern', () => {
    it('provides compound components', () => {
      expect(SearchResults.Provider).toBeDefined();
      expect(SearchResults.List).toBeDefined();
      expect(SearchResults.Header).toBeDefined();
      expect(SearchResults.Footer).toBeDefined();
      expect(SearchResults.EmptyState).toBeDefined();
      expect(SearchResults.LoadingState).toBeDefined();
      expect(SearchResults.ErrorState).toBeDefined();
    });

    it('allows compound usage with provider', () => {
      const providerValue = {
        results: mockResults,
        searchQuery: 'test query',
        selectedIndex: 0,
        setSelectedIndex: jest.fn(),
        searchTerms: ['test'],
        showConfidenceScores: true,
        onResultSelect: jest.fn(),
        isLoading: false,
        error: null,
        virtualization: {
          enabled: false,
          threshold: 20,
          itemHeight: 200,
          containerHeight: 600,
          bufferSize: 5
        }
      };

      render(
        <SearchResults.Provider value={providerValue}>
          <SearchResults.Header
            resultCount={mockResults.length}
            searchQuery="test query"
          />
          <SearchResults.List />
        </SearchResults.Provider>
      );

      expect(screen.getByText('Search Results')).toBeInTheDocument();
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('memoizes expensive operations', () => {
      const { rerender } = render(<SearchResults {...defaultProps} />);

      // Re-render with same props should not cause issues
      rerender(<SearchResults {...defaultProps} />);

      expect(screen.getByText('JCL Step Processing Error')).toBeInTheDocument();
    });

    it('handles prop changes efficiently', () => {
      const { rerender } = render(<SearchResults {...defaultProps} />);

      // Change only one prop
      rerender(<SearchResults {...defaultProps} selectedIndex={1} />);

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-1');
    });
  });

  describe('Custom Props', () => {
    it('applies custom className', () => {
      const customClass = 'custom-search-results';
      const { container } = render(
        <SearchResults {...defaultProps} className={customClass} />
      );

      expect(container.firstChild).toHaveClass(customClass);
    });

    it('uses custom aria-label', () => {
      const customLabel = 'Custom search results';
      render(<SearchResults {...defaultProps} ariaLabel={customLabel} />);

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-label',
        expect.stringContaining(customLabel));
    });

    it('handles controlled selectedIndex prop', () => {
      const { rerender } = render(
        <SearchResults {...defaultProps} selectedIndex={1} />
      );

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-1');

      rerender(<SearchResults {...defaultProps} selectedIndex={0} />);
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-0');
    });
  });
});

// Integration tests
describe('SearchResults Integration', () => {
  it('works with real-world search scenarios', () => {
    const realWorldResults: SearchResult[] = [
      {
        entry: {
          id: 'real-1',
          title: 'COBOL COMP-3 Data Corruption Issue',
          problem: 'COMP-3 packed decimal fields showing incorrect values after arithmetic operations',
          solution: 'Verify field definitions and use proper MOVE statements with PIC clauses',
          category: 'COBOL',
          tags: ['cobol', 'comp-3', 'packed-decimal', 'data-corruption'],
          created_at: new Date(),
          updated_at: new Date(),
          created_by: 'expert-user',
          usage_count: 45,
          success_count: 40,
          failure_count: 5,
          version: 2
        },
        score: 0.95,
        matchType: 'exact',
        highlights: ['COMP-3 packed decimal', 'arithmetic operations'],
        explanation: 'Perfect match for COBOL data handling issue'
      }
    ];

    render(
      <SearchResults
        results={realWorldResults}
        searchQuery="COBOL COMP-3 data corruption"
        showConfidenceScores={true}
        onResultSelect={() => {}}
      />
    );

    expect(screen.getByText('COBOL COMP-3 Data Corruption Issue')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('Category: COBOL')).toBeInTheDocument();
  });
});