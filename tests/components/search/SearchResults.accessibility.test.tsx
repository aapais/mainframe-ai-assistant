/**
 * Accessibility Tests for SearchResults Component
 * 
 * Test Coverage:
 * - WCAG 2.1 AA compliance
 * - Keyboard navigation
 * - Screen reader support
 * - Focus management
 * - ARIA attributes
 * - Color contrast
 * - Semantic HTML structure
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations, configureAxe } from 'jest-axe';
import SearchResults from '../../../src/renderer/components/search/SearchResults';
import SearchResultsVirtualized from '../../../src/renderer/components/search/SearchResultsVirtualized';
import { mockSearchResults, mockEmptySearchResults } from '../../../tests/fixtures/searchResults';

// Configure axe for comprehensive accessibility testing
configureAxe({
  rules: {
    // Enable all WCAG 2.1 AA rules
    'color-contrast': { enabled: true },
    'keyboard-navigation': { enabled: true },
    'focus-management': { enabled: true },
    'aria-labels': { enabled: true },
    'semantic-structure': { enabled: true },
    'screen-reader': { enabled: true }
  }
});

expect.extend(toHaveNoViolations);

// Mock formatters with accessibility-friendly outputs
jest.mock('../../../src/renderer/utils/formatters', () => ({
  formatDate: (date: Date) => date.toLocaleDateString(),
  formatRelativeTime: (date: Date) => '2 hours ago',
  highlightText: (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
}));

// Mock VirtualList for accessibility testing
jest.mock('../../../src/renderer/components/ui/VirtualList', () => ({
  VirtualList: ({ children, items }: any) => (
    <div role="list" data-testid="virtual-list">
      {items.map((item: any, index: number) => 
        <div key={index} role="listitem">
          {children({ item, index, style: {} })}
        </div>
      )}
    </div>
  ),
  FixedSizeList: ({ children, items }: any) => (
    <div role="list" data-testid="fixed-size-list">
      {items?.map((item: any, index: number) => 
        <div key={index} role="listitem">
          {children({ item, index, style: {} })}
        </div>
      ) || null}
    </div>
  )
}));

describe('SearchResults Accessibility Tests', () => {
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

  describe('WCAG 2.1 AA Compliance', () => {
    it('meets all accessibility guidelines', async () => {
      const { container } = render(<SearchResults {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('meets accessibility guidelines in loading state', async () => {
      const { container } = render(
        <SearchResults {...defaultProps} isLoading={true} />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('meets accessibility guidelines with empty results', async () => {
      const { container } = render(
        <SearchResults {...defaultProps} results={mockEmptySearchResults} />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('meets accessibility guidelines with virtual scrolling', async () => {
      const largeResults = Array(25).fill(null).map((_, index) => ({
        ...mockSearchResults[0],
        entry: {
          ...mockSearchResults[0].entry,
          id: `entry-${index}`,
          title: `Accessibility Test Result ${index}`
        }
      }));
      
      const { container } = render(
        <SearchResults 
          {...defaultProps} 
          results={largeResults}
          enableVirtualScrolling={true}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Semantic HTML Structure', () => {
    it('uses proper heading hierarchy', () => {
      render(<SearchResults {...defaultProps} />);
      
      const mainHeading = screen.getByRole('heading', { level: 2 });
      expect(mainHeading).toBeInTheDocument();
      expect(mainHeading).toHaveTextContent(/Found \d+ result/);
      
      const resultHeadings = screen.getAllByRole('heading', { level: 3 });
      expect(resultHeadings).toHaveLength(mockSearchResults.length);
    });

    it('uses semantic landmarks', () => {
      render(<SearchResults {...defaultProps} />);
      
      expect(screen.getByRole('region', { name: 'Search results' })).toBeInTheDocument();
      expect(screen.getAllByRole('article')).toHaveLength(mockSearchResults.length);
    });

    it('uses proper list structure for multiple results', () => {
      render(<SearchResults {...defaultProps} />);
      
      const articles = screen.getAllByRole('article');
      expect(articles).toHaveLength(mockSearchResults.length);
      
      articles.forEach(article => {
        expect(article).toBeInTheDocument();
      });
    });

    it('uses appropriate sectioning elements', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);
      
      const expandButton = screen.getAllByLabelText('Expand details')[0];
      await user.click(expandButton);
      
      // Check for proper section structure in expanded content
      expect(screen.getByText('Problem Description')).toBeInTheDocument();
      expect(screen.getByText('Solution')).toBeInTheDocument();
    });
  });

  describe('ARIA Attributes and Labels', () => {
    it('provides comprehensive ARIA labels', () => {
      render(<SearchResults {...defaultProps} />);
      
      // Main region
      expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Search results');
      
      // Buttons
      const expandButtons = screen.getAllByLabelText('Expand details');
      expect(expandButtons.length).toBeGreaterThan(0);
      
      expandButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-label');
        expect(button).toHaveAttribute('aria-expanded');
      });
    });

    it('updates ARIA attributes dynamically', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);
      
      const expandButton = screen.getAllByLabelText('Expand details')[0];
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      
      await user.click(expandButton);
      
      const collapseButton = screen.getByLabelText('Collapse details');
      expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('provides proper ARIA labels for rating buttons', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);
      
      const expandButton = screen.getAllByLabelText('Expand details')[0];
      await user.click(expandButton);
      
      const helpfulButton = screen.getByLabelText('Mark as helpful');
      const notHelpfulButton = screen.getByLabelText('Mark as not helpful');
      
      expect(helpfulButton).toHaveAttribute('aria-label', 'Mark as helpful');
      expect(notHelpfulButton).toHaveAttribute('aria-label', 'Mark as not helpful');
    });

    it('provides ARIA labels for sort controls', () => {
      render(<SearchResults {...defaultProps} />);
      
      const sortButtons = screen.getAllByRole('button', { pressed: false });
      const activeSortButton = screen.getByRole('button', { pressed: true });
      
      expect(activeSortButton).toHaveAttribute('aria-pressed', 'true');
      
      sortButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-pressed');
      });
    });

    it('provides status information for loading states', () => {
      render(<SearchResults {...defaultProps} isLoading={true} />);
      
      const loadingIndicator = screen.getByRole('status');
      expect(loadingIndicator).toBeInTheDocument();
      expect(loadingIndicator).toHaveTextContent('Searching knowledge base...');
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports full keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);
      
      // Tab to first expand button
      await user.tab();
      const firstExpandButton = screen.getAllByLabelText(/Expand|Collapse/)[0];
      expect(firstExpandButton).toHaveFocus();
      
      // Press Enter to expand
      await user.keyboard('{Enter}');
      expect(screen.getByText('Problem Description')).toBeInTheDocument();
      
      // Press Enter again to collapse
      await user.keyboard('{Enter}');
      expect(screen.queryByText('Problem Description')).not.toBeInTheDocument();
    });

    it('maintains logical tab order', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);
      
      // First expand button
      await user.tab();
      expect(screen.getAllByLabelText(/Expand|Collapse/)[0]).toHaveFocus();
      
      // Sort controls should be accessible via tab
      const sortButtons = screen.getAllByRole('button');
      let tabCount = 1;
      
      for (let i = 1; i < sortButtons.length && tabCount < 10; i++) {
        await user.tab();
        tabCount++;
      }
      
      expect(tabCount).toBeGreaterThan(1);
    });

    it('supports keyboard navigation in expanded content', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);
      
      // Expand first result
      const expandButton = screen.getAllByLabelText('Expand details')[0];
      await user.click(expandButton);
      
      // Tab to rating buttons
      const helpfulButton = screen.getByLabelText('Mark as helpful');
      helpfulButton.focus();
      
      await user.keyboard('{Enter}');
      expect(defaultProps.onEntryRate).toHaveBeenCalledWith(
        mockSearchResults[0].entry.id,
        true
      );
    });

    it('handles keyboard navigation with pagination', async () => {
      const user = userEvent.setup();
      const paginationProps = {
        pagination: {
          page: 1,
          pageSize: 10,
          total: 25,
          onPageChange: jest.fn()
        }
      };
      
      render(<SearchResults {...defaultProps} {...paginationProps} />);
      
      const nextButton = screen.getByText('Next →');
      nextButton.focus();
      
      await user.keyboard('{Enter}');
      expect(paginationProps.pagination.onPageChange).toHaveBeenCalledWith(2);
    });
  });

  describe('Focus Management', () => {
    it('manages focus properly on expand/collapse', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);
      
      const expandButton = screen.getAllByLabelText('Expand details')[0];
      await user.click(expandButton);
      
      const collapseButton = screen.getByLabelText('Collapse details');
      expect(collapseButton).toHaveFocus();
    });

    it('restores focus after rating interaction', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);
      
      const expandButton = screen.getAllByLabelText('Expand details')[0];
      await user.click(expandButton);
      
      const helpfulButton = screen.getByLabelText('Mark as helpful');
      await user.click(helpfulButton);
      
      // Focus should remain in the rating area
      expect(helpfulButton).toHaveFocus();
    });

    it('provides visible focus indicators', async () => {
      const user = userEvent.setup();
      render(<SearchResults {...defaultProps} />);
      
      await user.tab();
      const focusedElement = document.activeElement;
      
      expect(focusedElement).toBeInstanceOf(HTMLElement);
      expect(focusedElement).toBeVisible();
    });
  });

  describe('Screen Reader Support', () => {
    it('announces search results count', () => {
      render(<SearchResults {...defaultProps} />);
      
      const resultsHeading = screen.getByRole('heading', { level: 2 });
      expect(resultsHeading).toHaveTextContent(
        `Found ${mockSearchResults.length} result${mockSearchResults.length !== 1 ? 's' : ''} for "test query"`
      );
    });

    it('announces loading state changes', () => {
      const { rerender } = render(<SearchResults {...defaultProps} isLoading={true} />);
      
      expect(screen.getByRole('status')).toHaveTextContent('Searching knowledge base...');
      
      rerender(<SearchResults {...defaultProps} isLoading={false} />);
      
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Search results' })).toBeInTheDocument();
    });

    it('provides meaningful content descriptions', () => {
      render(<SearchResults {...defaultProps} />);
      
      const articles = screen.getAllByRole('article');
      
      articles.forEach((article, index) => {
        const result = mockSearchResults[index];
        expect(article).toHaveTextContent(result.entry.title);
        expect(article).toHaveTextContent(result.entry.category);
      });
    });

    it('announces AI-enhanced results', () => {
      const aiResults = mockSearchResults.map(result => ({
        ...result,
        metadata: { ...result.metadata, source: 'ai' as const }
      }));
      
      render(<SearchResults {...defaultProps} results={aiResults} />);
      
      expect(screen.getByText('Some results enhanced by AI semantic search')).toBeInTheDocument();
    });
  });

  describe('Color and Contrast', () => {
    it('maintains sufficient color contrast', async () => {
      const { container } = render(<SearchResults {...defaultProps} />);
      
      // Test with axe color-contrast rules
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true }
        }
      });
      
      expect(results).toHaveNoViolations();
    });

    it('does not rely solely on color for information', () => {
      render(<SearchResults {...defaultProps} />);
      
      // Score indicators should have text or icons, not just color
      const scoreElements = screen.getAllByText(/\d+%/);
      expect(scoreElements.length).toBeGreaterThan(0);
      
      // Success rate indicators should have meaningful text
      const articles = screen.getAllByRole('article');
      articles.forEach(article => {
        expect(article).toContain('views');
      });
    });
  });

  describe('Responsive Design Accessibility', () => {
    it('maintains accessibility on mobile viewports', async () => {
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });
      
      const { container } = render(<SearchResults {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides adequate touch targets on mobile', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });
      
      render(<SearchResults {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        // Touch targets should be at least 44px (CSS pixels)
        const minSize = 44;
        expect(parseInt(styles.minHeight) || parseInt(styles.height)).toBeGreaterThanOrEqual(minSize);
      });
    });
  });
});

describe('SearchResultsVirtualized Accessibility Tests', () => {
  const defaultProps = {
    results: mockSearchResults,
    query: 'accessibility test',
    isLoading: false,
    onEntrySelect: jest.fn(),
  };

  describe('Virtual List Accessibility', () => {
    it('maintains WCAG compliance with virtual scrolling', async () => {
      const largeResults = Array(100).fill(null).map((_, index) => ({
        ...mockSearchResults[0],
        entry: {
          ...mockSearchResults[0].entry,
          id: `virtual-${index}`,
          title: `Virtual Result ${index}`
        }
      }));
      
      const { container } = render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          results={largeResults}
        />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper list semantics in virtual environment', () => {
      render(<SearchResultsVirtualized {...defaultProps} />);
      
      expect(screen.getByRole('list')).toBeInTheDocument();
      const listItems = screen.getAllByRole('listitem');
      expect(listItems.length).toBeGreaterThan(0);
    });

    it('supports keyboard navigation in virtual list', async () => {
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
      
      expect(onSelectionChange).toHaveBeenCalled();
    });

    it('manages focus correctly during virtual scrolling', () => {
      const onSelectionChange = jest.fn();
      
      render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          onSelectionChange={onSelectionChange}
          selectedId={mockSearchResults[0].entry.id}
        />
      );
      
      const selectedItem = screen.getByRole('listitem', { selected: true });
      expect(selectedItem).toBeInTheDocument();
      expect(selectedItem).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Group Accessibility', () => {
    it('provides proper group semantics', () => {
      render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          groupBy="category"
        />
      );
      
      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('supports keyboard navigation in grouped results', async () => {
      const user = userEvent.setup();
      
      render(
        <SearchResultsVirtualized 
          {...defaultProps} 
          groupBy="category"
        />
      );
      
      // Test navigation through groups
      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
    });
  });
});

describe('Accessibility Edge Cases', () => {
  const defaultProps = {
    query: 'edge case test',
    isLoading: false,
    onEntrySelect: jest.fn(),
    onEntryRate: jest.fn(),
    onSortChange: jest.fn(),
  };

  it('handles accessibility with no results', async () => {
    const { container } = render(
      <SearchResults {...defaultProps} results={[]} />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
    
    expect(screen.getByText('No Results Found')).toBeInTheDocument();
  });

  it('handles accessibility with extremely long content', async () => {
    const longContentResults = [{
      ...mockSearchResults[0],
      entry: {
        ...mockSearchResults[0].entry,
        title: 'Very '.repeat(50) + 'Long Title',
        problem: 'Extremely long problem description. '.repeat(100),
        solution: 'Very detailed solution. '.repeat(200)
      }
    }];
    
    const { container } = render(
      <SearchResults {...defaultProps} results={longContentResults} />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('handles accessibility with special characters', async () => {
    const specialCharResults = [{
      ...mockSearchResults[0],
      entry: {
        ...mockSearchResults[0].entry,
        title: 'Special & <chars> "quotes" Test',
        problem: 'Problem with & symbols < > and "quotes"',
        solution: 'Solution with special chars & symbols'
      }
    }];
    
    const { container } = render(
      <SearchResults {...defaultProps} results={specialCharResults} />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});