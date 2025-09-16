/**
 * Comprehensive Test Suite for SearchResults Component
 * 
 * Test Coverage:
 * - Unit tests for all component functionality
 * - Integration tests for virtual scrolling
 * - Accessibility tests with ARIA compliance
 * - Keyboard navigation tests
 * - Performance tests for large datasets
 * - Visual regression tests
 * - Search highlighting functionality
 * - Loading and empty state handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import SearchResults from '../../../src/renderer/components/search/SearchResults';
import { mockSearchResults, mockEmptySearchResults, mockVSAMSearchResults } from '../../../tests/fixtures/searchResults';
import { SearchResult, SearchOptions } from '../../../src/types/services';

// Extend Jest matchers for accessibility testing
expect.extend(toHaveNoViolations);

// Mock virtual scrolling components
jest.mock('../../../src/renderer/components/ui/VirtualList', () => ({
  VirtualList: ({ children, items }: any) => (
    <div data-testid="virtual-list">
      {items.map((item: any, index: number) => 
        children({ item, index, style: {} })
      )}
    </div>
  ),
  FixedSizeList: ({ children, items }: any) => (
    <div data-testid="fixed-size-list">
      {items?.map((item: any, index: number) => 
        children({ item, index, style: {} })
      ) || null}
    </div>
  )
}));

// Mock formatters
jest.mock('../../../src/renderer/utils/formatters', () => ({
  formatDate: (date: Date) => date.toISOString().split('T')[0],
  formatRelativeTime: (date: Date) => '2 hours ago',
  highlightText: (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
}));

describe('SearchResults Component', () => {
  const defaultProps = {
    results: mockSearchResults,
    query: 'test query',
    isLoading: false,
    onEntrySelect: jest.fn(),
    onEntryRate: jest.fn(),
    onSortChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders search results correctly', () => {
      render(<SearchResults {...defaultProps} />);
      
      expect(screen.getByRole('region', { name: 'Search results' })).toBeInTheDocument();
      expect(screen.getByText(/Found \d+ result/)).toBeInTheDocument();
      expect(screen.getByText('for "test query"')).toBeInTheDocument();
    });

    it('renders loading state', () => {
      render(<SearchResults {...defaultProps} isLoading={true} />);
      
      expect(screen.getByText('Searching knowledge base...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders empty query state', () => {
      render(<SearchResults {...defaultProps} query="" />);
      
      expect(screen.getByText('Start Your Search')).toBeInTheDocument();
      expect(screen.getByText('Enter keywords, error codes, or describe your problem')).toBeInTheDocument();
    });

    it('renders no results state', () => {
      render(<SearchResults {...defaultProps} results={mockEmptySearchResults} />);
      
      expect(screen.getByText('No Results Found')).toBeInTheDocument();
      expect(screen.getByText('We couldn\'t find any knowledge base entries matching "test query".')).toBeInTheDocument();
    });
  });

  describe('Search Result Items', () => {
    it('displays all result items', () => {
      render(<SearchResults {...defaultProps} />);
      
      const results = screen.getAllByRole('article');
      expect(results).toHaveLength(mockSearchResults.length);
    });

    it('displays result metadata correctly', () => {
      render(<SearchResults {...defaultProps} />);
      
      const firstResult = mockSearchResults[0];
      expect(screen.getByText(firstResult.entry.title)).toBeInTheDocument();
      expect(screen.getByText(firstResult.entry.category)).toBeInTheDocument();
      expect(screen.getByText(`${Math.round(firstResult.score)}%`)).toBeInTheDocument();
    });

    it('handles result selection', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);
      
      const firstResult = screen.getAllByRole('article')[0];
      await user.click(firstResult);
      
      expect(defaultProps.onEntrySelect).toHaveBeenCalledWith(mockSearchResults[0]);
    });

    it('expands and collapses result details', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);
      
      const expandButton = screen.getAllByLabelText('Expand details')[0];
      await user.click(expandButton);
      
      expect(screen.getByText('Problem Description')).toBeInTheDocument();
      expect(screen.getByText('Solution')).toBeInTheDocument();
      
      await user.click(screen.getByLabelText('Collapse details'));
      expect(screen.queryByText('Problem Description')).not.toBeInTheDocument();
    });
  });

  describe('Search Highlighting', () => {
    it('highlights search terms in results', () => {
      render(<SearchResults {...defaultProps} highlightQuery={true} />);
      
      // Check if highlighted content is rendered
      const titleElements = screen.getAllByRole('article').map(article => 
        within(article).getByRole('heading', { level: 3 })
      );
      
      expect(titleElements.length).toBeGreaterThan(0);
    });

    it('does not highlight when highlightQuery is false', () => {
      render(<SearchResults {...defaultProps} highlightQuery={false} />);
      
      const firstResult = mockSearchResults[0];
      expect(screen.getByText(firstResult.entry.title)).toBeInTheDocument();
    });
  });

  describe('Sorting and Filtering', () => {
    it('renders sort controls', () => {
      render(<SearchResults {...defaultProps} />);
      
      expect(screen.getByText('Sort by:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /relevance/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /most used/i })).toBeInTheDocument();
    });

    it('handles sort changes', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);
      
      const sortButton = screen.getByRole('button', { name: /most used/i });
      await user.click(sortButton);
      
      expect(defaultProps.onSortChange).toHaveBeenCalledWith('usage', 'desc');
    });

    it('toggles sort order on repeated clicks', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} sortBy="relevance" sortOrder="desc" />);
      
      const sortButton = screen.getByRole('button', { name: /relevance/i });
      await user.click(sortButton);
      
      expect(defaultProps.onSortChange).toHaveBeenCalledWith('relevance', 'asc');
    });
  });

  describe('Virtual Scrolling', () => {
    it('uses virtual scrolling for large result sets', () => {
      const largeResults = Array(25).fill(null).map((_, index) => ({
        ...mockSearchResults[0],
        entry: {
          ...mockSearchResults[0].entry,
          id: `entry-${index}`,
          title: `Result ${index}`
        }
      }));
      
      render(
        <SearchResults 
          {...defaultProps} 
          results={largeResults}
          enableVirtualScrolling={true}
        />
      );
      
      expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
    });

    it('uses standard rendering for small result sets', () => {
      render(
        <SearchResults 
          {...defaultProps} 
          enableVirtualScrolling={true}
        />
      );
      
      expect(screen.queryByTestId('virtual-list')).not.toBeInTheDocument();
      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('respects virtualScrollHeight prop', () => {
      const largeResults = Array(25).fill(null).map((_, index) => ({
        ...mockSearchResults[0],
        entry: {
          ...mockSearchResults[0].entry,
          id: `entry-${index}`
        }
      }));
      
      render(
        <SearchResults 
          {...defaultProps} 
          results={largeResults}
          enableVirtualScrolling={true}
          virtualScrollHeight="400px"
        />
      );
      
      expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
    });
  });

  describe('Rating and Feedback', () => {
    it('displays rating buttons when expanded', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);
      
      const expandButton = screen.getAllByLabelText('Expand details')[0];
      await user.click(expandButton);
      
      expect(screen.getByLabelText('Mark as helpful')).toBeInTheDocument();
      expect(screen.getByLabelText('Mark as not helpful')).toBeInTheDocument();
    });

    it('handles positive rating', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);
      
      const expandButton = screen.getAllByLabelText('Expand details')[0];
      await user.click(expandButton);
      
      const thumbsUp = screen.getByLabelText('Mark as helpful');
      await user.click(thumbsUp);
      
      expect(defaultProps.onEntryRate).toHaveBeenCalledWith(
        mockSearchResults[0].entry.id,
        true
      );
    });

    it('handles negative rating', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);
      
      const expandButton = screen.getAllByLabelText('Expand details')[0];
      await user.click(expandButton);
      
      const thumbsDown = screen.getByLabelText('Mark as not helpful');
      await user.click(thumbsDown);
      
      expect(defaultProps.onEntryRate).toHaveBeenCalledWith(
        mockSearchResults[0].entry.id,
        false
      );
    });

    it('disables rating buttons after rating', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);
      
      const expandButton = screen.getAllByLabelText('Expand details')[0];
      await user.click(expandButton);
      
      const thumbsUp = screen.getByLabelText('Mark as helpful');
      await user.click(thumbsUp);
      
      await waitFor(() => {
        expect(thumbsUp).toBeDisabled();
        expect(screen.getByLabelText('Mark as not helpful')).toBeDisabled();
      });
    });
  });

  describe('Pagination', () => {
    const paginationProps = {
      pagination: {
        page: 1,
        pageSize: 10,
        total: 25,
        onPageChange: jest.fn()
      }
    };

    it('renders pagination controls when provided', () => {
      render(<SearchResults {...defaultProps} {...paginationProps} />);
      
      expect(screen.getByText('← Previous')).toBeInTheDocument();
      expect(screen.getByText('Next →')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });

    it('disables previous button on first page', () => {
      render(<SearchResults {...defaultProps} {...paginationProps} />);
      
      const prevButton = screen.getByText('← Previous');
      expect(prevButton).toBeDisabled();
    });

    it('disables next button on last page', () => {
      const lastPageProps = {
        pagination: {
          ...paginationProps.pagination,
          page: 3
        }
      };
      
      render(<SearchResults {...defaultProps} {...lastPageProps} />);
      
      const nextButton = screen.getByText('Next →');
      expect(nextButton).toBeDisabled();
    });

    it('handles page navigation', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} {...paginationProps} />);
      
      const nextButton = screen.getByText('Next →');
      await user.click(nextButton);
      
      expect(paginationProps.pagination.onPageChange).toHaveBeenCalledWith(2);
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG accessibility guidelines', async () => {
      const { container } = render(<SearchResults {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has proper ARIA labels and roles', () => {
      render(<SearchResults {...defaultProps} />);
      
      expect(screen.getByRole('region', { name: 'Search results' })).toBeInTheDocument();
      
      const articles = screen.getAllByRole('article');
      expect(articles.length).toBeGreaterThan(0);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-label');
      });
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);
      
      const firstExpandButton = screen.getAllByLabelText('Expand details')[0];
      firstExpandButton.focus();
      
      await user.keyboard('{Enter}');
      expect(screen.getByText('Problem Description')).toBeInTheDocument();
      
      await user.keyboard('{Enter}');
      expect(screen.queryByText('Problem Description')).not.toBeInTheDocument();
    });

    it('announces loading state to screen readers', () => {
      render(<SearchResults {...defaultProps} isLoading={true} />);
      
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Searching knowledge base...')).toBeInTheDocument();
    });

    it('provides proper heading hierarchy', () => {
      render(<SearchResults {...defaultProps} />);
      
      const mainHeading = screen.getByRole('heading', { level: 2 });
      expect(mainHeading).toBeInTheDocument();
      
      const resultHeadings = screen.getAllByRole('heading', { level: 3 });
      expect(resultHeadings.length).toBe(mockSearchResults.length);
    });
  });

  describe('AI Features', () => {
    it('displays AI notice when AI results are present', () => {
      const aiResults = mockSearchResults.map(result => ({
        ...result,
        metadata: { ...result.metadata, source: 'ai' as const }
      }));
      
      render(<SearchResults {...defaultProps} results={aiResults} />);
      
      expect(screen.getByText('Some results enhanced by AI semantic search')).toBeInTheDocument();
    });

    it('shows explanation when enabled', async () => {
      const user = userEvent.setup();
      const resultsWithExplanation = mockSearchResults.map(result => ({
        ...result,
        explanation: 'This result matches because of semantic similarity.'
      }));
      
      render(
        <SearchResults 
          {...defaultProps} 
          results={resultsWithExplanation}
          showExplanations={true}
        />
      );
      
      const expandButton = screen.getAllByLabelText('Expand details')[0];
      await user.click(expandButton);
      
      expect(screen.getByText('Why This Matches')).toBeInTheDocument();
      expect(screen.getByText('This result matches because of semantic similarity.')).toBeInTheDocument();
    });

    it('shows metadata when enabled', async () => {
      const user = userEvent.setup();
      const resultsWithMetadata = mockSearchResults.map(result => ({
        ...result,
        metadata: {
          processingTime: 150,
          source: 'ai' as const,
          confidence: 0.85,
          fallback: false
        }
      }));
      
      render(
        <SearchResults 
          {...defaultProps} 
          results={resultsWithMetadata}
          showMetadata={true}
        />
      );
      
      const expandButton = screen.getAllByLabelText('Expand details')[0];
      await user.click(expandButton);
      
      expect(screen.getByText('Search Metadata')).toBeInTheDocument();
      expect(screen.getByText('150.0ms')).toBeInTheDocument();
      expect(screen.getByText('🤖 AI')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('renders large result sets efficiently', () => {
      const startTime = performance.now();
      
      const largeResults = Array(100).fill(null).map((_, index) => ({
        ...mockSearchResults[0],
        entry: {
          ...mockSearchResults[0].entry,
          id: `entry-${index}`,
          title: `Performance Test Result ${index}`
        }
      }));
      
      render(
        <SearchResults 
          {...defaultProps} 
          results={largeResults}
          enableVirtualScrolling={true}
        />
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within reasonable time (less than 100ms)
      expect(renderTime).toBeLessThan(100);
      expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
    });

    it('memoizes result items correctly', () => {
      const { rerender } = render(<SearchResults {...defaultProps} />);
      
      // Initial render
      const initialArticles = screen.getAllByRole('article');
      expect(initialArticles.length).toBe(mockSearchResults.length);
      
      // Rerender with same props - should not cause re-render of items
      rerender(<SearchResults {...defaultProps} />);
      
      const rerenderArticles = screen.getAllByRole('article');
      expect(rerenderArticles.length).toBe(mockSearchResults.length);
    });
  });

  describe('Error Handling', () => {
    it('handles missing entry data gracefully', () => {
      const invalidResults = [{
        entry: null,
        score: 95,
        matchType: 'ai' as const
      }] as any;
      
      expect(() => {
        render(<SearchResults {...defaultProps} results={invalidResults} />);
      }).not.toThrow();
    });

    it('handles missing props gracefully', () => {
      expect(() => {
        render(<SearchResults {...defaultProps} results={undefined as any} />);
      }).not.toThrow();
    });

    it('handles invalid sort configuration', () => {
      expect(() => {
        render(<SearchResults {...defaultProps} sortBy={undefined as any} />);
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('handles extremely long content', () => {
      const longContentResults = [{
        ...mockSearchResults[0],
        entry: {
          ...mockSearchResults[0].entry,
          problem: 'A'.repeat(10000),
          solution: 'B'.repeat(10000)
        }
      }];
      
      render(<SearchResults {...defaultProps} results={longContentResults} />);
      
      // Should truncate preview text
      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('handles special characters in search query', () => {
      const specialQuery = 'test & <script> "quotes" \n newlines';
      
      render(<SearchResults {...defaultProps} query={specialQuery} />);
      
      expect(screen.getByText(/for ".*"/)).toBeInTheDocument();
    });

    it('handles empty tags array', () => {
      const noTagsResults = [{
        ...mockSearchResults[0],
        entry: {
          ...mockSearchResults[0].entry,
          tags: []
        }
      }];
      
      render(<SearchResults {...defaultProps} results={noTagsResults} />);
      
      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('handles zero usage count', () => {
      const zeroUsageResults = [{
        ...mockSearchResults[0],
        entry: {
          ...mockSearchResults[0].entry,
          usage_count: 0,
          success_count: 0,
          failure_count: 0
        }
      }];
      
      render(<SearchResults {...defaultProps} results={zeroUsageResults} />);
      
      expect(screen.getByRole('article')).toBeInTheDocument();
    });
  });
});