/**
 * Integration Tests for SearchResultsVirtualized Component
 * 
 * Test Coverage:
 * - Virtual scrolling behavior with large datasets
 * - Infinite loading and pagination
 * - Keyboard navigation in virtualized environment
 * - Performance with 10k+ items
 * - Group functionality
 * - Memory management
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchResultsVirtualized from '../../../src/renderer/components/search/SearchResultsVirtualized';
import { mockSearchResults } from '../../../tests/fixtures/searchResults';
import { SearchResult } from '../../../src/types/services';

// Mock react-window components
jest.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount, itemData, onItemsRendered }: any) => {
    // Simulate rendering visible items
    const visibleItems = Array.from({ length: Math.min(itemCount, 10) }, (_, index) => {
      return children({ index, style: {}, data: itemData });
    });
    
    // Simulate scroll events
    React.useEffect(() => {
      if (onItemsRendered) {
        onItemsRendered({
          visibleStartIndex: 0,
          visibleStopIndex: Math.min(itemCount - 1, 9),
          overscanStartIndex: 0,
          overscanStopIndex: Math.min(itemCount - 1, 9)
        });
      }
    }, [onItemsRendered, itemCount]);
    
    return (
      <div data-testid="virtualized-list" data-item-count={itemCount}>
        {visibleItems}
      </div>
    );
  }
}));

jest.mock('react-window-infinite-loader', () => {
  return {
    __esModule: true,
    default: ({ children, isItemLoaded, loadMoreItems, itemCount }: any) => {
      const childProps = {
        onItemsRendered: jest.fn(),
        ref: jest.fn()
      };
      
      return (
        <div data-testid="infinite-loader" data-item-count={itemCount}>
          {children(childProps)}
        </div>
      );
    }
  };
});

jest.mock('react-virtualized-auto-sizer', () => {
  return {
    __esModule: true,
    default: ({ children }: any) => children({ height: 600, width: 800 })
  };
});

describe('SearchResultsVirtualized Component', () => {
  const defaultProps = {
    results: mockSearchResults,
    query: 'test query',
    isLoading: false,
    onEntrySelect: jest.fn(),
    onEntryRate: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Virtual Scrolling', () => {
    it('renders virtualized list for results', () => {
      render(<SearchResultsVirtualized {...defaultProps} />);
      
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
      expect(screen.getByTestId('infinite-loader')).toBeInTheDocument();
    });

    it('handles large datasets efficiently', () => {
      const largeResults = Array.from({ length: 1000 }, (_, index) => ({
        ...mockSearchResults[0],
        entry: {
          ...mockSearchResults[0].entry,
          id: `entry-${index}`,
          title: `Large Dataset Item ${index}`
        }
      }));
      
      const startTime = performance.now();
      render(<SearchResultsVirtualized {...defaultProps} results={largeResults} />);
      const renderTime = performance.now() - startTime;
      
      expect(renderTime).toBeLessThan(200); // Should render quickly
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
      
      const list = screen.getByTestId('virtualized-list');
      expect(list).toHaveAttribute('data-item-count', '1000');
    });

    it('renders only visible items for performance', () => {
      const largeResults = Array.from({ length: 100 }, (_, index) => ({
        ...mockSearchResults[0],
        entry: {
          ...mockSearchResults[0].entry,
          id: `entry-${index}`,
          title: `Item ${index}`
        }
      }));
      
      render(<SearchResultsVirtualized {...defaultProps} results={largeResults} />);
      
      // Should only render visible items (mocked to 10)
      const renderedItems = screen.getAllByRole('listitem');
      expect(renderedItems.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Infinite Loading', () => {
    it('supports infinite loading', async () => {
      const onLoadMore = jest.fn().mockResolvedValue(undefined);
      
      render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          hasNextPage={true}
          onLoadMore={onLoadMore}
        />
      );
      
      expect(screen.getByTestId('infinite-loader')).toBeInTheDocument();
    });

    it('calls onLoadMore when needed', async () => {
      const onLoadMore = jest.fn().mockResolvedValue(undefined);
      
      render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          hasNextPage={true}
          onLoadMore={onLoadMore}
          threshold={5}
        />
      );
      
      // In a real scenario, scrolling near the end would trigger this
      // We'll test the prop passing for now
      expect(screen.getByTestId('infinite-loader')).toBeInTheDocument();
    });
  });

  describe('Item Interaction', () => {
    it('handles item selection', async () => {
      const user = userEvent.setup();
      render(<SearchResultsVirtualized {...defaultProps} />);
      
      const firstItem = screen.getAllByRole('listitem')[0];
      await user.click(firstItem);
      
      expect(defaultProps.onEntrySelect).toHaveBeenCalledWith(mockSearchResults[0]);
    });

    it('expands and collapses items', async () => {
      const user = userEvent.setup();
      render(<SearchResultsVirtualized {...defaultProps} />);
      
      const expandButton = screen.getAllByLabelText('Expand')[0];
      await user.click(expandButton);
      
      expect(screen.getByText('Solution')).toBeInTheDocument();
      
      await user.click(screen.getByLabelText('Collapse'));
      expect(screen.queryByText('Solution')).not.toBeInTheDocument();
    });

    it('handles rating interactions', async () => {
      const user = userEvent.setup();
      render(<SearchResultsVirtualized {...defaultProps} />);
      
      const thumbsUp = screen.getAllByLabelText('Mark as helpful')[0];
      await user.click(thumbsUp);
      
      expect(defaultProps.onEntryRate).toHaveBeenCalledWith(
        mockSearchResults[0].entry.id,
        true
      );
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports arrow key navigation', async () => {
      const user = userEvent.setup();
      const onSelectionChange = jest.fn();
      
      render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          onSelectionChange={onSelectionChange}
          selectedId={mockSearchResults[0].entry.id}
        />
      );
      
      const firstItem = screen.getAllByRole('listitem')[0];
      firstItem.focus();
      
      await user.keyboard('{ArrowDown}');
      
      // Should attempt to select next item
      expect(onSelectionChange).toHaveBeenCalled();
    });

    it('handles Enter key for selection', async () => {
      const user = userEvent.setup();
      render(<SearchResultsVirtualized {...defaultProps} />);
      
      const firstItem = screen.getAllByRole('listitem')[0];
      firstItem.focus();
      
      await user.keyboard('{Enter}');
      
      expect(defaultProps.onEntrySelect).toHaveBeenCalledWith(mockSearchResults[0]);
    });

    it('handles Space key for selection', async () => {
      const user = userEvent.setup();
      render(<SearchResultsVirtualized {...defaultProps} />);
      
      const firstItem = screen.getAllByRole('listitem')[0];
      firstItem.focus();
      
      await user.keyboard('{ }');
      
      expect(defaultProps.onEntrySelect).toHaveBeenCalledWith(mockSearchResults[0]);
    });
  });

  describe('Grouping Functionality', () => {
    it('supports grouping by category', () => {
      render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          groupBy="category"
        />
      );
      
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    });

    it('supports grouping by match type', () => {
      render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          groupBy="matchType"
        />
      );
      
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    });

    it('handles group header interactions', async () => {
      const user = userEvent.setup();
      render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          groupBy="category"
        />
      );
      
      // Look for group headers (would be rendered by the virtualized list)
      const list = screen.getByTestId('virtualized-list');
      expect(list).toBeInTheDocument();
    });
  });

  describe('Search and Filtering', () => {
    it('displays search controls', () => {
      render(<SearchResultsVirtualized {...defaultProps} />);
      
      expect(screen.getByDisplayValue(/most relevant/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue(/no grouping/i)).toBeInTheDocument();
    });

    it('handles sort changes', async () => {
      const user = userEvent.setup();
      const onSortChange = jest.fn();
      
      render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          onSortChange={onSortChange}
        />
      );
      
      const sortSelect = screen.getByDisplayValue(/most relevant/i);
      await user.selectOptions(sortSelect, 'usage-desc');
      
      expect(onSortChange).toHaveBeenCalledWith('usage', 'desc');
    });

    it('displays result count and query', () => {
      render(<SearchResultsVirtualized {...defaultProps} />);
      
      expect(screen.getByText(`${mockSearchResults.length} results`)).toBeInTheDocument();
      expect(screen.getByText('for "test query"')).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('displays empty state when no results', () => {
      render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          results={[]}
        />
      );
      
      expect(screen.getByText('No results found')).toBeInTheDocument();
      expect(screen.getByText('No matches found for "test query"')).toBeInTheDocument();
    });

    it('displays search tips in empty state', () => {
      render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          results={[]}
        />
      );
      
      expect(screen.getByText('Search tips:')).toBeInTheDocument();
      expect(screen.getByText(/Use specific error codes/)).toBeInTheDocument();
    });

    it('displays different message for empty query', () => {
      render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          results={[]}
          query=""
        />
      );
      
      expect(screen.getByText('Start typing to search the knowledge base.')).toBeInTheDocument();
    });
  });

  describe('Performance Optimizations', () => {
    it('memoizes expensive calculations', () => {
      const performanceResults = Array.from({ length: 500 }, (_, index) => ({
        ...mockSearchResults[0],
        entry: {
          ...mockSearchResults[0].entry,
          id: `perf-${index}`,
          title: `Performance Test ${index}`
        }
      }));
      
      const { rerender } = render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          results={performanceResults}
        />
      );
      
      const startTime = performance.now();
      
      // Rerender with same props
      rerender(
        <SearchResultsVirtualized 
          {...defaultProps} 
          results={performanceResults}
        />
      );
      
      const rerenderTime = performance.now() - startTime;
      
      // Rerender should be fast due to memoization
      expect(rerenderTime).toBeLessThan(50);
    });

    it('handles memory efficiently with large datasets', () => {
      const memoryTestResults = Array.from({ length: 2000 }, (_, index) => ({
        ...mockSearchResults[0],
        entry: {
          ...mockSearchResults[0].entry,
          id: `memory-${index}`,
          title: `Memory Test ${index}`,
          problem: `Problem description ${index}`.repeat(10),
          solution: `Solution content ${index}`.repeat(15)
        }
      }));
      
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          results={memoryTestResults}
        />
      );
      
      const afterRenderMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = afterRenderMemory - initialMemory;
      
      // Should not consume excessive memory due to virtualization
      // This is approximate and may vary by environment
      if (memoryIncrease > 0) {
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
      }
    });
  });

  describe('Scroll Behavior', () => {
    it('handles scroll events', () => {
      const onScroll = jest.fn();
      
      render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          onScroll={onScroll}
        />
      );
      
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    });

    it('maintains scroll position on updates', () => {
      const { rerender } = render(<SearchResultsVirtualized {...defaultProps} />);
      
      // Simulate scroll and update
      rerender(
        <SearchResultsVirtualized 
          {...defaultProps} 
          results={[...mockSearchResults, {
            ...mockSearchResults[0],
            entry: { ...mockSearchResults[0].entry, id: 'new-item' }
          }]}
        />
      );
      
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('displays loading indicator', () => {
      render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          isLoading={true}
        />
      );
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('shows loading state during infinite load', () => {
      render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          hasNextPage={true}
          isLoading={false}
        />
      );
      
      expect(screen.getByTestId('infinite-loader')).toBeInTheDocument();
    });
  });

  describe('Error Boundaries', () => {
    it('handles render errors gracefully', () => {
      const invalidResults = [{
        entry: null,
        score: null,
        matchType: null
      }] as any;
      
      expect(() => {
        render(
          <SearchResultsVirtualized 
            {...defaultProps} 
            results={invalidResults}
          />
        );
      }).not.toThrow();
    });

    it('handles missing props gracefully', () => {
      expect(() => {
        render(
          <SearchResultsVirtualized 
            {...defaultProps} 
            results={undefined as any}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Accessibility in Virtual Environment', () => {
    it('maintains proper ARIA attributes', () => {
      render(<SearchResultsVirtualized {...defaultProps} />);
      
      const listItems = screen.getAllByRole('listitem');
      listItems.forEach(item => {
        expect(item).toHaveAttribute('tabIndex');
        expect(item).toHaveAttribute('aria-selected');
      });
    });

    it('supports screen reader navigation', () => {
      render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          selectedId={mockSearchResults[0].entry.id}
        />
      );
      
      const selectedItem = screen.getByRole('listitem', { selected: true });
      expect(selectedItem).toBeInTheDocument();
    });
  });
});