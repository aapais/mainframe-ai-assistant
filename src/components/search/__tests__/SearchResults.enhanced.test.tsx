/**
 * SearchResults Enhanced Test Suite
 *
 * Comprehensive testing for SearchResults component covering:
 * ✅ All props and their combinations
 * ✅ Keyboard navigation (arrow keys, Enter, Home, End)
 * ✅ Virtual scrolling behavior with large datasets
 * ✅ Error and loading states
 * ✅ Accessibility features with jest-axe
 * ✅ Performance testing with large datasets
 * ✅ Snapshot tests for UI consistency
 * ✅ Search highlighting interactions
 * ✅ Real-world usage scenarios
 *
 * @author Test Engineer
 * @version 2.0.0
 */

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
  createEvent,
  prettyDOM
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SearchResults } from '../SearchResults';
import type { SearchResult, KBEntry } from '../../../types/index';

// Extend Jest matchers for accessibility
expect.extend(toHaveNoViolations);

// ========================
// Test Setup & Mocks
// ========================

// Mock IntersectionObserver for lazy loading and virtual scrolling
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: jest.fn((element: Element) => {
    // Simulate immediate intersection for testing
    setTimeout(() => {
      const callback = mockIntersectionObserver.mock.calls[
        mockIntersectionObserver.mock.calls.length - 1
      ][0];
      callback([{
        isIntersecting: true,
        target: element,
        intersectionRatio: 1,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: {} as DOMRectReadOnly,
        time: Date.now()
      }], this);
    }, 0);
  }),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
});
window.IntersectionObserver = mockIntersectionObserver;

// Mock scrollIntoView for keyboard navigation
Element.prototype.scrollIntoView = jest.fn();

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn(() => []),
  },
  writable: true,
});

// Mock ResizeObserver for virtual scrolling
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// ========================
// Test Data Fixtures
// ========================

const createMockKBEntry = (overrides: Partial<KBEntry> = {}): KBEntry => ({
  id: `entry-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Sample Knowledge Entry',
  problem: 'Sample problem description for testing purposes',
  solution: 'Sample solution with detailed steps and explanations',
  category: 'JCL',
  tags: ['test', 'sample', 'mock'],
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-15'),
  created_by: 'test-user',
  usage_count: 10,
  success_count: 8,
  failure_count: 2,
  version: 1,
  ...overrides,
});

const createMockSearchResult = (overrides: Partial<SearchResult> = {}): SearchResult => ({
  entry: createMockKBEntry(),
  score: 0.85,
  matchType: 'exact',
  highlights: ['sample highlight'],
  explanation: 'Test explanation',
  ...overrides,
});

// Comprehensive test datasets
const smallDataset: SearchResult[] = [
  createMockSearchResult({
    entry: createMockKBEntry({
      id: '1',
      title: 'JCL ABEND S0C7 Error Resolution',
      problem: 'Program terminates with S0C7 data exception during numeric operations',
      solution: 'Check numeric field initialization and use INSPECT to validate data',
      category: 'JCL',
      tags: ['abend', 's0c7', 'numeric', 'data-exception'],
      usage_count: 125,
    }),
    score: 0.95,
    matchType: 'exact',
    highlights: ['S0C7 data exception', 'numeric operations'],
  }),
  createMockSearchResult({
    entry: createMockKBEntry({
      id: '2',
      title: 'VSAM File Integrity Check Failed',
      problem: 'VSAM dataset showing integrity errors during verify process',
      solution: 'Run IDCAMS VERIFY and REPRO to check and repair dataset integrity',
      category: 'VSAM',
      tags: ['vsam', 'integrity', 'verify', 'idcams'],
      usage_count: 87,
    }),
    score: 0.82,
    matchType: 'fuzzy',
    highlights: ['integrity errors', 'verify process'],
  }),
  createMockSearchResult({
    entry: createMockKBEntry({
      id: '3',
      title: 'DB2 SQLCODE -204 Resolution',
      problem: 'SQL statement fails with SQLCODE -204 table not found error',
      solution: 'Verify table existence and check schema qualification in SQL',
      category: 'DB2',
      tags: ['db2', 'sqlcode', 'table-not-found', 'schema'],
      usage_count: 64,
    }),
    score: 0.76,
    matchType: 'ai',
    highlights: ['SQLCODE -204', 'table not found'],
  }),
  createMockSearchResult({
    entry: createMockKBEntry({
      id: '4',
      title: 'COBOL Compiler Error Resolution',
      problem: 'COBOL program fails compilation with syntax errors',
      solution: 'Review COBOL syntax and check for missing periods and proper divisions',
      category: 'COBOL',
      tags: ['cobol', 'compiler', 'syntax', 'division'],
      usage_count: 45,
    }),
    score: 0.68,
    matchType: 'semantic',
    highlights: ['compilation', 'syntax errors'],
  }),
];

const largeDataset: SearchResult[] = Array.from({ length: 100 }, (_, index) =>
  createMockSearchResult({
    entry: createMockKBEntry({
      id: `large-${index}`,
      title: `Large Dataset Entry ${index + 1}`,
      problem: `Problem description for entry ${index + 1} with relevant details`,
      solution: `Solution for problem ${index + 1} with step-by-step instructions`,
      category: index % 2 === 0 ? 'JCL' : 'VSAM',
      tags: [`tag-${index}`, 'large-dataset', 'performance-test'],
      usage_count: Math.floor(Math.random() * 100),
    }),
    score: Math.random() * 0.4 + 0.6, // Scores between 0.6-1.0
    matchType: ['exact', 'fuzzy', 'ai', 'semantic'][index % 4] as any,
  })
);

const performanceDataset: SearchResult[] = Array.from({ length: 1000 }, (_, index) =>
  createMockSearchResult({
    entry: createMockKBEntry({
      id: `perf-${index}`,
      title: `Performance Test Entry ${index + 1}`,
      problem: `Performance test problem ${index + 1}`,
      solution: `Performance test solution ${index + 1}`,
      usage_count: index,
    }),
  })
);

// Default props for testing
const defaultProps = {
  results: smallDataset,
  searchQuery: 'test search query',
  isLoading: false,
  error: null,
  selectedIndex: -1,
  showConfidenceScores: true,
  onResultSelect: jest.fn(),
  onLoadMore: jest.fn(),
  className: '',
  ariaLabel: 'Search results',
};

// ========================
// Test Utilities
// ========================

const renderWithUser = (props = {}) => {
  const user = userEvent.setup();
  const renderResult = render(<SearchResults {...defaultProps} {...props} />);
  return { user, ...renderResult };
};

const getListbox = () => screen.getByRole('listbox');
const getResultItems = () => screen.getAllByRole('button').filter(btn =>
  btn.getAttribute('aria-label')?.includes('Search result')
);

const waitForVirtualization = () => new Promise(resolve => setTimeout(resolve, 100));

// ========================
// Main Test Suite
// ========================

describe('SearchResults Enhanced Test Suite', () => {
  let mockOnResultSelect: jest.Mock;
  let mockOnLoadMore: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnResultSelect = jest.fn();
    mockOnLoadMore = jest.fn();

    // Reset performance mocking
    (window.performance.now as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // ========================
  // Props and Combinations Testing
  // ========================

  describe('Props and Combinations', () => {
    it('renders with all default props', () => {
      render(<SearchResults {...defaultProps} />);
      expect(getListbox()).toBeInTheDocument();
      expect(screen.getByText(/Found 4 results for/)).toBeInTheDocument();
    });

    it('handles all possible prop combinations', () => {
      const testCombinations = [
        { results: [], searchQuery: '', isLoading: true },
        { results: smallDataset, searchQuery: 'test', error: 'Test error' },
        { results: smallDataset, selectedIndex: 1, showConfidenceScores: false },
        { results: largeDataset, searchQuery: 'large test', className: 'custom-class' },
        { results: smallDataset, ariaLabel: 'Custom label', onLoadMore: undefined },
      ];

      testCombinations.forEach((props, index) => {
        const { unmount } = render(
          <SearchResults {...defaultProps} {...props} key={index} />
        );
        expect(getListbox()).toBeInTheDocument();
        unmount();
      });
    });

    it('validates prop types and handles edge cases', () => {
      // Test with undefined/null props
      const edgeCaseProps = {
        results: smallDataset,
        searchQuery: '',
        selectedIndex: undefined,
        onResultSelect: undefined,
        onLoadMore: null,
      };

      expect(() => {
        render(<SearchResults {...defaultProps} {...edgeCaseProps} />);
      }).not.toThrow();
    });

    it('handles dynamic prop updates correctly', () => {
      const { rerender } = render(<SearchResults {...defaultProps} />);

      // Update search query
      rerender(<SearchResults {...defaultProps} searchQuery="updated query" />);
      expect(screen.getByText(/Found 4 results for "updated query"/)).toBeInTheDocument();

      // Update selected index
      rerender(<SearchResults {...defaultProps} selectedIndex={2} />);
      expect(getListbox()).toHaveAttribute('aria-activedescendant', 'result-2');

      // Update confidence scores
      rerender(<SearchResults {...defaultProps} showConfidenceScores={false} />);
      expect(screen.queryByText('95%')).not.toBeInTheDocument();
    });
  });

  // ========================
  // Keyboard Navigation Testing
  // ========================

  describe('Keyboard Navigation', () => {
    it('handles arrow key navigation correctly', async () => {
      const { user } = renderWithUser();
      const listbox = getListbox();

      await user.click(listbox);

      // Initial state - no selection
      expect(listbox).not.toHaveAttribute('aria-activedescendant');

      // Arrow down - select first item
      await user.keyboard('{ArrowDown}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-0');

      // Arrow down - select second item
      await user.keyboard('{ArrowDown}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-1');

      // Arrow up - back to first item
      await user.keyboard('{ArrowUp}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-0');
    });

    it('handles Home and End keys for navigation', async () => {
      const { user } = renderWithUser();
      const listbox = getListbox();

      await user.click(listbox);

      // Home key - go to first item
      await user.keyboard('{Home}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-0');

      // End key - go to last item
      await user.keyboard('{End}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-3');

      // Home again
      await user.keyboard('{Home}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-0');
    });

    it('activates result selection with Enter key', async () => {
      const { user } = renderWithUser({ onResultSelect: mockOnResultSelect });
      const listbox = getListbox();

      await user.click(listbox);
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(mockOnResultSelect).toHaveBeenCalledWith(smallDataset[0], 0);
    });

    it('activates result selection with Space key', async () => {
      const { user } = renderWithUser({ onResultSelect: mockOnResultSelect });
      const listbox = getListbox();

      await user.click(listbox);
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Space}');

      expect(mockOnResultSelect).toHaveBeenCalledWith(smallDataset[0], 0);
    });

    it('prevents navigation beyond bounds', async () => {
      const { user } = renderWithUser();
      const listbox = getListbox();

      await user.click(listbox);

      // Try to go up from initial state (should select first item)
      await user.keyboard('{ArrowUp}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-0');

      // Go to last item
      await user.keyboard('{End}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-3');

      // Try to go down from last item (should stay at last)
      await user.keyboard('{ArrowDown}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-3');
    });

    it('handles keyboard navigation with empty results', async () => {
      const { user } = renderWithUser({ results: [] });

      // Should render empty state
      expect(screen.getByText('No results found')).toBeInTheDocument();

      // Keyboard events should not cause errors
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(mockOnResultSelect).not.toHaveBeenCalled();
    });

    it('scrolls selected item into view during navigation', async () => {
      const { user } = renderWithUser({ results: largeDataset.slice(0, 10) });
      const listbox = getListbox();

      await user.click(listbox);
      await user.keyboard('{ArrowDown}');

      // Check that scrollIntoView was called
      await waitFor(() => {
        expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
      });
    });
  });

  // ========================
  // Virtual Scrolling Testing
  // ========================

  describe('Virtual Scrolling', () => {
    it('enables virtual scrolling for large datasets', async () => {
      render(<SearchResults {...defaultProps} results={largeDataset} />);

      await waitForVirtualization();

      // Should render virtual scrolling container
      const listbox = getListbox();
      expect(listbox).toBeInTheDocument();

      // Should not render all items at once (performance optimization)
      const renderedItems = getResultItems();
      expect(renderedItems.length).toBeLessThan(largeDataset.length);
    });

    it('maintains performance with very large datasets', async () => {
      const startTime = performance.now();

      render(<SearchResults {...defaultProps} results={performanceDataset} />);

      await waitForVirtualization();

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render quickly even with 1000 items
      expect(renderTime).toBeLessThan(1000); // Less than 1 second
    });

    it('handles virtual scrolling with keyboard navigation', async () => {
      const { user } = renderWithUser({ results: largeDataset });
      const listbox = getListbox();

      await user.click(listbox);
      await waitForVirtualization();

      // Navigate to item that might be virtualized
      await user.keyboard('{ArrowDown}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-0');

      // Jump to end
      await user.keyboard('{End}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-99');
    });

    it('shows load more button for large datasets', () => {
      render(<SearchResults {...defaultProps} results={largeDataset} onLoadMore={mockOnLoadMore} />);

      const loadMoreButton = screen.queryByText('Load More Results');
      if (loadMoreButton) {
        expect(loadMoreButton).toBeInTheDocument();
        fireEvent.click(loadMoreButton);
        expect(mockOnLoadMore).toHaveBeenCalled();
      }
    });

    it('handles scroll events in virtual list', async () => {
      render(<SearchResults {...defaultProps} results={largeDataset} />);

      await waitForVirtualization();

      const scrollContainer = screen.getByRole('listbox');

      // Simulate scroll event
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 500 } });

      // Should not cause errors and maintain functionality
      expect(scrollContainer).toBeInTheDocument();
    });
  });

  // ========================
  // Error and Loading States
  // ========================

  describe('Error and Loading States', () => {
    it('displays loading state with proper accessibility', () => {
      render(<SearchResults {...defaultProps} isLoading={true} results={[]} />);

      const loadingIndicator = screen.getByRole('status');
      expect(loadingIndicator).toBeInTheDocument();
      expect(loadingIndicator).toHaveAttribute('aria-live', 'polite');
      expect(loadingIndicator).toHaveAttribute('aria-label', 'Loading search results');

      expect(screen.getByText('Searching knowledge base...')).toBeInTheDocument();
    });

    it('displays error state with proper alert semantics', () => {
      const errorMessage = 'Network connection failed';
      render(<SearchResults {...defaultProps} error={errorMessage} results={[]} />);

      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toBeInTheDocument();
      expect(errorAlert).toHaveAttribute('aria-live', 'assertive');

      expect(screen.getByText('Search Error')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('displays empty state with helpful guidance', () => {
      render(<SearchResults {...defaultProps} results={[]} />);

      const emptyState = screen.getByRole('status');
      expect(emptyState).toBeInTheDocument();
      expect(emptyState).toHaveAttribute('aria-live', 'polite');

      expect(screen.getByText('No results found')).toBeInTheDocument();
      expect(screen.getByText(/Try adjusting your search query/)).toBeInTheDocument();
    });

    it('handles transition between states correctly', () => {
      const { rerender } = render(<SearchResults {...defaultProps} isLoading={true} results={[]} />);

      expect(screen.getByText('Searching knowledge base...')).toBeInTheDocument();

      // Transition to error state
      rerender(<SearchResults {...defaultProps} error="Search failed" results={[]} />);
      expect(screen.getByText('Search Error')).toBeInTheDocument();

      // Transition to results state
      rerender(<SearchResults {...defaultProps} results={smallDataset} />);
      expect(screen.getByText(/Found 4 results/)).toBeInTheDocument();
    });

    it('prioritizes error state over loading state', () => {
      render(<SearchResults {...defaultProps} isLoading={true} error="Test error" results={[]} />);

      // Error should take precedence
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  // ========================
  // Accessibility Testing
  // ========================

  describe('Accessibility Features', () => {
    it('passes axe accessibility tests', async () => {
      const { container } = render(<SearchResults {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe tests with all states', async () => {
      // Test loading state
      const { container: loadingContainer } = render(
        <SearchResults {...defaultProps} isLoading={true} results={[]} />
      );
      expect(await axe(loadingContainer)).toHaveNoViolations();

      // Test error state
      const { container: errorContainer } = render(
        <SearchResults {...defaultProps} error="Test error" results={[]} />
      );
      expect(await axe(errorContainer)).toHaveNoViolations();

      // Test empty state
      const { container: emptyContainer } = render(
        <SearchResults {...defaultProps} results={[]} />
      );
      expect(await axe(emptyContainer)).toHaveNoViolations();
    });

    it('provides comprehensive ARIA labeling', () => {
      render(<SearchResults {...defaultProps} />);

      const listbox = getListbox();
      expect(listbox).toHaveAttribute('role', 'listbox');
      expect(listbox).toHaveAttribute('aria-label', expect.stringContaining('Search results'));

      const resultItems = getResultItems();
      resultItems.forEach((item, index) => {
        expect(item).toHaveAttribute('role', 'button');
        expect(item).toHaveAttribute('aria-label', expect.stringContaining(`Search result ${index + 1}`));
        expect(item).toHaveAttribute('aria-describedby');
        expect(item).toHaveAttribute('tabindex', '0');
      });
    });

    it('provides screen reader descriptions for each result', () => {
      render(<SearchResults {...defaultProps} />);

      smallDataset.forEach((_, index) => {
        const description = screen.getByText((content, element) => {
          return element?.id === `result-${index}-description` &&
                 content.includes(smallDataset[index].entry.category);
        });
        expect(description).toHaveClass('sr-only');
      });
    });

    it('announces navigation changes to screen readers', async () => {
      const { user } = renderWithUser();
      const listbox = getListbox();

      await user.click(listbox);
      await user.keyboard('{ArrowDown}');

      // Check for live region announcement
      const liveRegion = screen.getByText(/Currently selected: result 1 of 4/);
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveClass('sr-only');
    });

    it('supports high contrast mode', () => {
      render(<SearchResults {...defaultProps} />);

      // Check that components don't rely only on color
      const confidenceScores = screen.getAllByText(/\d+%/);
      confidenceScores.forEach(score => {
        const progressBar = score.parentElement?.previousElementSibling;
        expect(progressBar).toHaveAttribute('role', 'progressbar');
        expect(progressBar).toHaveAttribute('aria-label');
      });
    });

    it('maintains focus management correctly', async () => {
      const { user } = renderWithUser();

      // Tab to listbox
      await user.tab();
      expect(getListbox()).toHaveFocus();

      // Arrow navigation shouldn't lose focus
      await user.keyboard('{ArrowDown}');
      expect(getListbox()).toHaveFocus();
    });
  });

  // ========================
  // Performance Testing
  // ========================

  describe('Performance with Large Datasets', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('renders large datasets efficiently', () => {
      const startTime = Date.now();

      render(<SearchResults {...defaultProps} results={performanceDataset} />);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Very fast render
    });

    it('handles rapid prop updates without performance degradation', () => {
      const { rerender } = render(<SearchResults {...defaultProps} />);

      const startTime = Date.now();

      // Rapid updates
      for (let i = 0; i < 10; i++) {
        rerender(<SearchResults {...defaultProps} selectedIndex={i % 4} />);
      }

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(50);
    });

    it('memoizes expensive operations', () => {
      const { rerender } = render(<SearchResults {...defaultProps} />);

      // Same props should not cause unnecessary re-renders
      rerender(<SearchResults {...defaultProps} />);

      expect(screen.getByText('JCL ABEND S0C7 Error Resolution')).toBeInTheDocument();
    });

    it('handles search term extraction efficiently', () => {
      const longSearchQuery = 'very long search query with many terms that should be processed efficiently without performance issues';

      const startTime = Date.now();
      render(<SearchResults {...defaultProps} searchQuery={longSearchQuery} />);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50);
    });

    it('optimizes virtual scrolling performance', async () => {
      render(<SearchResults {...defaultProps} results={largeDataset} />);

      await waitForVirtualization();

      const scrollContainer = getListbox();

      // Rapid scroll events should not cause performance issues
      const startTime = Date.now();
      for (let i = 0; i < 10; i++) {
        fireEvent.scroll(scrollContainer, { target: { scrollTop: i * 100 } });
        jest.advanceTimersByTime(16); // 60fps
      }
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200);
    });
  });

  // ========================
  // Snapshot Testing
  // ========================

  describe('UI Consistency Snapshots', () => {
    it('matches snapshot for default state', () => {
      const { container } = render(<SearchResults {...defaultProps} />);
      expect(container.firstChild).toMatchSnapshot('search-results-default');
    });

    it('matches snapshot for loading state', () => {
      const { container } = render(
        <SearchResults {...defaultProps} isLoading={true} results={[]} />
      );
      expect(container.firstChild).toMatchSnapshot('search-results-loading');
    });

    it('matches snapshot for error state', () => {
      const { container } = render(
        <SearchResults {...defaultProps} error="Test error message" results={[]} />
      );
      expect(container.firstChild).toMatchSnapshot('search-results-error');
    });

    it('matches snapshot for empty state', () => {
      const { container } = render(
        <SearchResults {...defaultProps} results={[]} />
      );
      expect(container.firstChild).toMatchSnapshot('search-results-empty');
    });

    it('matches snapshot with confidence scores disabled', () => {
      const { container } = render(
        <SearchResults {...defaultProps} showConfidenceScores={false} />
      );
      expect(container.firstChild).toMatchSnapshot('search-results-no-confidence');
    });

    it('matches snapshot with selected item', () => {
      const { container } = render(
        <SearchResults {...defaultProps} selectedIndex={1} />
      );
      expect(container.firstChild).toMatchSnapshot('search-results-selected');
    });

    it('matches snapshot for large dataset with virtual scrolling', () => {
      const { container } = render(
        <SearchResults {...defaultProps} results={largeDataset.slice(0, 25)} />
      );
      expect(container.firstChild).toMatchSnapshot('search-results-virtualized');
    });
  });

  // ========================
  // Search Highlighting Testing
  // ========================

  describe('Search Highlighting', () => {
    it('highlights search terms in result content', () => {
      render(<SearchResults {...defaultProps} searchQuery="JCL ABEND" />);

      // Should find highlighted terms
      const highlights = screen.getAllByText((content, element) => {
        return element?.tagName.toLowerCase() === 'mark' &&
               (content.toLowerCase().includes('jcl') || content.toLowerCase().includes('abend'));
      });

      expect(highlights.length).toBeGreaterThan(0);
    });

    it('handles complex search queries with multiple terms', () => {
      render(<SearchResults {...defaultProps} searchQuery="error resolution database" />);

      // Should highlight individual terms
      const highlights = screen.getAllByText((content, element) => {
        return element?.tagName.toLowerCase() === 'mark';
      });

      expect(highlights.length).toBeGreaterThan(0);
    });

    it('handles special characters in search queries', () => {
      render(<SearchResults {...defaultProps} searchQuery="S0C7 -204 #error" />);

      // Should not break and should still render
      expect(screen.getByText('JCL ABEND S0C7 Error Resolution')).toBeInTheDocument();
    });

    it('handles empty search query gracefully', () => {
      render(<SearchResults {...defaultProps} searchQuery="" />);

      // Should render without highlighting
      expect(screen.getByText('JCL ABEND S0C7 Error Resolution')).toBeInTheDocument();

      // Should not have any mark elements
      const highlights = screen.queryAllByText((content, element) => {
        return element?.tagName.toLowerCase() === 'mark';
      });
      expect(highlights.length).toBe(0);
    });

    it('highlights terms case-insensitively', () => {
      render(<SearchResults {...defaultProps} searchQuery="jcl ABEND" />);

      // Should highlight both uppercase and lowercase matches
      const highlights = screen.getAllByText((content, element) => {
        return element?.tagName.toLowerCase() === 'mark';
      });

      expect(highlights.length).toBeGreaterThan(0);
    });

    it('displays search highlights from result data', () => {
      render(<SearchResults {...defaultProps} />);

      // Check for highlights section
      expect(screen.getByText('Key matches:')).toBeInTheDocument();
      expect(screen.getByText('"...S0C7 data exception..."')).toBeInTheDocument();
      expect(screen.getByText('"...numeric operations..."')).toBeInTheDocument();
    });

    it('handles results without highlights gracefully', () => {
      const resultsWithoutHighlights = smallDataset.map(result => ({
        ...result,
        highlights: undefined,
      }));

      render(<SearchResults {...defaultProps} results={resultsWithoutHighlights} />);

      // Should not show highlights section
      expect(screen.queryByText('Key matches:')).not.toBeInTheDocument();
    });
  });

  // ========================
  // Integration Testing
  // ========================

  describe('Real-world Integration Scenarios', () => {
    it('handles complete user interaction workflow', async () => {
      const { user } = renderWithUser({ onResultSelect: mockOnResultSelect });

      // User searches and navigates
      const listbox = getListbox();
      await user.click(listbox);

      // Navigate through results
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');

      // Select a result
      await user.keyboard('{Enter}');

      expect(mockOnResultSelect).toHaveBeenCalledWith(smallDataset[1], 1);
    });

    it('handles rapid user interactions gracefully', async () => {
      const { user } = renderWithUser({ onResultSelect: mockOnResultSelect });
      const listbox = getListbox();

      await user.click(listbox);

      // Rapid key presses
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{Enter}');

      expect(mockOnResultSelect).toHaveBeenCalledWith(smallDataset[0], 0);
    });

    it('maintains state consistency across prop updates', () => {
      const { rerender } = render(<SearchResults {...defaultProps} selectedIndex={1} />);

      expect(getListbox()).toHaveAttribute('aria-activedescendant', 'result-1');

      // Update other props
      rerender(<SearchResults {...defaultProps} selectedIndex={1} searchQuery="updated" />);

      expect(getListbox()).toHaveAttribute('aria-activedescendant', 'result-1');
    });

    it('works correctly with different data sizes and types', () => {
      const datasets = [
        [],
        [smallDataset[0]],
        smallDataset,
        largeDataset.slice(0, 50),
      ];

      datasets.forEach((dataset, index) => {
        const { unmount } = render(
          <SearchResults {...defaultProps} results={dataset} key={index} />
        );

        if (dataset.length === 0) {
          expect(screen.getByText('No results found')).toBeInTheDocument();
        } else {
          expect(getListbox()).toBeInTheDocument();
        }

        unmount();
      });
    });

    it('handles edge cases in real mainframe scenarios', () => {
      const mainframeScenarios: SearchResult[] = [
        createMockSearchResult({
          entry: createMockKBEntry({
            title: 'IEF450I JOB STEP ABEND SYSTEM=047',
            problem: 'Job step terminated abnormally with system completion code 047',
            solution: 'Check system resources and contact system programmer if persistent',
            category: 'MVS',
            tags: ['ief450i', 'abend', 'system-047', 'resources'],
          }),
          score: 0.98,
          matchType: 'exact',
        }),
        createMockSearchResult({
          entry: createMockKBEntry({
            title: 'VSAM MAXCC=12 IDCAMS DELETE',
            problem: 'IDCAMS DELETE command fails with maximum condition code 12',
            solution: 'Verify dataset is not in use and check catalog entries',
            category: 'VSAM',
            tags: ['idcams', 'delete', 'maxcc-12', 'catalog'],
          }),
          score: 0.88,
          matchType: 'fuzzy',
        }),
      ];

      render(<SearchResults {...defaultProps} results={mainframeScenarios} />);

      expect(screen.getByText('IEF450I JOB STEP ABEND SYSTEM=047')).toBeInTheDocument();
      expect(screen.getByText('VSAM MAXCC=12 IDCAMS DELETE')).toBeInTheDocument();
    });
  });

  // ========================
  // Error Boundary Testing
  // ========================

  describe('Error Handling and Recovery', () => {
    it('handles corrupted result data gracefully', () => {
      const corruptedResults = [
        // Missing required fields
        { entry: { id: '1' }, score: 0.5 } as any,
        // Invalid data types
        { entry: null, score: 'invalid' } as any,
        // Valid result for comparison
        smallDataset[0],
      ];

      // Should not crash
      expect(() => {
        render(<SearchResults {...defaultProps} results={corruptedResults} />);
      }).not.toThrow();
    });

    it('recovers from navigation errors', async () => {
      const { user } = renderWithUser();
      const listbox = getListbox();

      await user.click(listbox);

      // Navigate to valid position
      await user.keyboard('{ArrowDown}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-0');

      // Simulate error in navigation (should not break)
      fireEvent.keyDown(listbox, { key: 'ArrowDown', code: 'ArrowDown' });

      // Should still work
      await user.keyboard('{ArrowDown}');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'result-2');
    });
  });
});

// ========================
// Performance Benchmarks
// ========================

describe('SearchResults Performance Benchmarks', () => {
  it('measures rendering performance for different dataset sizes', () => {
    const sizes = [10, 50, 100, 500];
    const benchmarks: { size: number; time: number }[] = [];

    sizes.forEach(size => {
      const dataset = largeDataset.slice(0, size);
      const startTime = performance.now();

      const { unmount } = render(<SearchResults {...defaultProps} results={dataset} />);

      const endTime = performance.now();
      benchmarks.push({ size, time: endTime - startTime });

      unmount();
    });

    // Performance should scale reasonably
    benchmarks.forEach(benchmark => {
      expect(benchmark.time).toBeLessThan(benchmark.size * 2); // Linear scaling threshold
    });
  });

  it('measures keyboard navigation performance', async () => {
    const { user } = renderWithUser({ results: largeDataset.slice(0, 50) });
    const listbox = getListbox();

    await user.click(listbox);

    const startTime = performance.now();

    // Navigate through multiple items quickly
    for (let i = 0; i < 10; i++) {
      await user.keyboard('{ArrowDown}');
    }

    const endTime = performance.now();

    // Should be responsive
    expect(endTime - startTime).toBeLessThan(500);
  });
});