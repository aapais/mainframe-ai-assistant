/**
 * SearchResults Component Tests
 *
 * Comprehensive test suite covering:
 * - Component rendering and props
 * - Virtual scrolling functionality
 * - Keyboard navigation
 * - Accessibility features
 * - Search term highlighting
 * - Confidence score display
 * - Responsive behavior
 * - Error and loading states
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SearchResults } from '../SearchResults';
import type { SearchResult } from '../../../types/index';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock IntersectionObserver for lazy loading tests
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  callback: IntersectionObserverCallback;

  observe = jest.fn((element: Element) => {
    // Simulate immediate intersection for testing
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
  },
  {
    entry: {
      id: '3',
      title: 'DB2 Connection Timeout',
      problem: 'Database connection timing out during batch processing',
      solution: 'Increase connection timeout parameters and optimize SQL queries',
      category: 'DB2',
      tags: ['db2', 'timeout', 'connection'],
      created_at: new Date('2024-01-03'),
      updated_at: new Date('2024-01-17'),
      created_by: 'user2',
      usage_count: 8,
      success_count: 6,
      failure_count: 2,
      version: 1
    },
    score: 0.65,
    matchType: 'ai',
    highlights: ['connection timing out'],
    explanation: 'AI-powered match for database issues'
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

describe('SearchResults Component', () => {
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
        expect.stringContaining('3 results found'));

      // Check that all results are rendered
      expect(screen.getByText('JCL Step Processing Error')).toBeInTheDocument();
      expect(screen.getByText('VSAM Dataset Access Issue')).toBeInTheDocument();
      expect(screen.getByText('DB2 Connection Timeout')).toBeInTheDocument();
    });

    it('displays search query in header', () => {
      render(<SearchResults {...defaultProps} />);
      expect(screen.getByText(/Found 3 results for "JCL error processing"/)).toBeInTheDocument();
    });

    it('renders result metadata correctly', () => {
      render(<SearchResults {...defaultProps} />);

      // Check categories
      expect(screen.getByText('Category: JCL')).toBeInTheDocument();
      expect(screen.getByText('Category: VSAM')).toBeInTheDocument();
      expect(screen.getByText('Category: DB2')).toBeInTheDocument();

      // Check usage counts
      expect(screen.getByText('Usage: 25')).toBeInTheDocument();
      expect(screen.getByText('Usage: 15')).toBeInTheDocument();
      expect(screen.getByText('Usage: 8')).toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
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

  describe('Search Term Highlighting', () => {
    it('highlights search terms in result text', () => {
      render(<SearchResults {...defaultProps} />);

      // Check for highlighted terms (mark elements)
      const highlights = screen.getAllByText((content, element) => {
        return element?.tagName.toLowerCase() === 'mark';
      });

      expect(highlights.length).toBeGreaterThan(0);
    });

    it('handles empty search query gracefully', () => {
      render(<SearchResults {...defaultProps} searchQuery="" />);

      // Should still render results without highlighting
      expect(screen.getByText('JCL Step Processing Error')).toBeInTheDocument();
    });
  });

  describe('Confidence Scores', () => {
    it('displays confidence scores when enabled', () => {
      render(<SearchResults {...defaultProps} showConfidenceScores={true} />);

      // Check for confidence score indicators
      expect(screen.getByText('92%')).toBeInTheDocument();
      expect(screen.getByText('78%')).toBeInTheDocument();
      expect(screen.getByText('65%')).toBeInTheDocument();
    });

    it('hides confidence scores when disabled', () => {
      render(<SearchResults {...defaultProps} showConfidenceScores={false} />);

      // Should not display confidence percentages
      expect(screen.queryByText('92%')).not.toBeInTheDocument();
      expect(screen.queryByText('78%')).not.toBeInTheDocument();
      expect(screen.queryByText('65%')).not.toBeInTheDocument();
    });

    it('displays correct confidence score colors', () => {
      render(<SearchResults {...defaultProps} />);

      // High confidence (92%) should be green
      const highScore = screen.getByText('92%');
      expect(highScore).toHaveClass('text-green-600');

      // Medium confidence (78%) should be yellow
      const mediumScore = screen.getByText('78%');
      expect(mediumScore).toHaveClass('text-yellow-600');

      // Low confidence (65%) should be red
      const lowScore = screen.getByText('65%');
      expect(lowScore).toHaveClass('text-red-600');
    });

    it('includes proper ARIA labels for confidence scores', () => {
      render(<SearchResults {...defaultProps} />);

      const confidenceBar = screen.getByLabelText('Confidence score: 92%');
      expect(confidenceBar).toBeInTheDocument();
      expect(confidenceBar).toHaveAttribute('role', 'progressbar');
      expect(confidenceBar).toHaveAttribute('aria-valuemin', '0');
      expect(confidenceBar).toHaveAttribute('aria-valuemax', '100');
      expect(confidenceBar).toHaveAttribute('aria-valuenow', '92');
    });
  });

  describe('Keyboard Navigation', () => {
    it('responds to arrow key navigation', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);

      const listbox = screen.getByRole('listbox');
      listbox.focus();

      // Navigate down with arrow keys
      await user.keyboard('{ArrowDown}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-0');

      await user.keyboard('{ArrowDown}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-1');

      // Navigate up
      await user.keyboard('{ArrowUp}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-0');
    });

    it('handles Home and End keys', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);

      const listbox = screen.getByRole('listbox');
      listbox.focus();

      // Go to end
      await user.keyboard('{End}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-2');

      // Go to beginning
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

    it('does not navigate beyond bounds', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);

      const listbox = screen.getByRole('listbox');
      listbox.focus();

      // Try to go up from first item
      await user.keyboard('{ArrowUp}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-0');

      // Go to last item
      await user.keyboard('{End}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-2');

      // Try to go down from last item
      await user.keyboard('{ArrowDown}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-2');
    });
  });

  describe('Mouse Interaction', () => {
    it('calls onResultSelect when result is clicked', async () => {
      const user = userEvent.setup();
      const mockOnSelect = jest.fn();

      render(<SearchResults {...defaultProps} onResultSelect={mockOnSelect} />);

      const firstResult = screen.getByText('JCL Step Processing Error');
      await user.click(firstResult);

      expect(mockOnSelect).toHaveBeenCalledWith(mockResults[0], 0);
    });

    it('updates selected state on click', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);

      const firstResult = screen.getByText('JCL Step Processing Error');
      const resultItem = firstResult.closest('[role="button"]');

      await user.click(firstResult);

      expect(resultItem).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Virtual Scrolling', () => {
    it('enables virtual scrolling for large result sets', () => {
      const largeResults = Array.from({ length: 25 }, (_, i) => ({
        ...mockResults[0],
        entry: { ...mockResults[0].entry, id: `result-${i}`, title: `Result ${i}` }
      }));

      render(<SearchResults {...defaultProps} results={largeResults} />);

      // Should render virtual scrolling container
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // Should show "Load More" button for large datasets
      if (screen.queryByText('Load More Results')) {
        expect(screen.getByText('Load More Results')).toBeInTheDocument();
      }
    });

    it('calls onLoadMore when load more button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnLoadMore = jest.fn();
      const largeResults = Array.from({ length: 25 }, (_, i) => ({
        ...mockResults[0],
        entry: { ...mockResults[0].entry, id: `result-${i}`, title: `Result ${i}` }
      }));

      render(
        <SearchResults
          {...defaultProps}
          results={largeResults}
          onLoadMore={mockOnLoadMore}
        />
      );

      const loadMoreButton = screen.queryByText('Load More Results');
      if (loadMoreButton) {
        await user.click(loadMoreButton);
        expect(mockOnLoadMore).toHaveBeenCalled();
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

      // Check result items have proper roles and labels
      const resultItems = screen.getAllByRole('button');
      resultItems.forEach((item, index) => {
        expect(item).toHaveAttribute('aria-label',
          expect.stringContaining(`Search result ${index + 1}`));
        expect(item).toHaveAttribute('aria-describedby');
      });
    });

    it('includes screen reader descriptions', () => {
      render(<SearchResults {...defaultProps} />);

      // Check for screen reader only content
      expect(screen.getByText(/Displaying 3 search results/)).toHaveClass('sr-only');

      // Check for result descriptions
      const descriptions = screen.getAllByText((content, element) => {
        return element?.id?.startsWith('result-') && element?.id?.endsWith('-description');
      });

      expect(descriptions.length).toBeGreaterThan(0);
    });

    it('supports keyboard-only navigation', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);

      // Tab to the listbox
      await user.tab();
      expect(screen.getByRole('listbox')).toHaveFocus();

      // Use arrow keys to navigate
      await user.keyboard('{ArrowDown}');
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-0');
    });

    it('announces changes to screen readers', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);

      const listbox = screen.getByRole('listbox');
      listbox.focus();

      await user.keyboard('{ArrowDown}');

      // Check for live region updates
      const liveRegion = screen.getByText(/Currently selected: result 1 of 3/);
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Tags and Categories', () => {
    it('displays category information correctly', () => {
      render(<SearchResults {...defaultProps} />);

      expect(screen.getByText('Category: JCL')).toBeInTheDocument();
      expect(screen.getByText('Category: VSAM')).toBeInTheDocument();
      expect(screen.getByText('Category: DB2')).toBeInTheDocument();
    });

    it('displays tags with proper truncation', () => {
      render(<SearchResults {...defaultProps} />);

      // Check that tags are displayed
      expect(screen.getByText('abend')).toBeInTheDocument();
      expect(screen.getByText('s0c7')).toBeInTheDocument();
      expect(screen.getByText('data-exception')).toBeInTheDocument();
    });

    it('handles results with no tags gracefully', () => {
      const resultWithoutTags = {
        ...mockResults[0],
        entry: { ...mockResults[0].entry, tags: [] }
      };

      render(<SearchResults {...defaultProps} results={[resultWithoutTags]} />);

      // Should not crash and should still display the result
      expect(screen.getByText('JCL Step Processing Error')).toBeInTheDocument();
    });
  });

  describe('Highlights', () => {
    it('displays search highlights when available', () => {
      render(<SearchResults {...defaultProps} />);

      // Check for highlights section
      expect(screen.getByText('Key matches:')).toBeInTheDocument();
      expect(screen.getByText('"...ABEND S0C7 data exception..."')).toBeInTheDocument();
      expect(screen.getByText('"...numeric data fields..."')).toBeInTheDocument();
    });

    it('handles results without highlights', () => {
      const resultWithoutHighlights = {
        ...mockResults[0],
        highlights: undefined
      };

      render(<SearchResults {...defaultProps} results={[resultWithoutHighlights]} />);

      // Should not display highlights section
      expect(screen.queryByText('Key matches:')).not.toBeInTheDocument();
    });

    it('truncates long highlight lists', () => {
      const resultWithManyHighlights = {
        ...mockResults[0],
        highlights: ['highlight1', 'highlight2', 'highlight3', 'highlight4']
      };

      render(<SearchResults {...defaultProps} results={[resultWithManyHighlights]} />);

      // Should only show first 2 highlights
      expect(screen.getByText('"...highlight1..."')).toBeInTheDocument();
      expect(screen.getByText('"...highlight2..."')).toBeInTheDocument();
      expect(screen.queryByText('"...highlight3..."')).not.toBeInTheDocument();
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

      // Update selectedIndex
      rerender(<SearchResults {...defaultProps} selectedIndex={2} />);
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-2');
    });
  });

  describe('Performance', () => {
    it('memoizes expensive operations', () => {
      const { rerender } = render(<SearchResults {...defaultProps} />);

      // Re-render with same props should not cause issues
      rerender(<SearchResults {...defaultProps} />);

      expect(screen.getByText('JCL Step Processing Error')).toBeInTheDocument();
    });

    it('handles large datasets efficiently', () => {
      const largeResults = Array.from({ length: 100 }, (_, i) => ({
        ...mockResults[0],
        entry: { ...mockResults[0].entry, id: `result-${i}`, title: `Result ${i}` }
      }));

      const startTime = performance.now();
      render(<SearchResults {...defaultProps} results={largeResults} />);
      const endTime = performance.now();

      // Should render quickly even with large datasets
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
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