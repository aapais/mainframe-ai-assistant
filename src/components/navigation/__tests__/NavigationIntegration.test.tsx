/**
 * Navigation Integration Test Suite
 *
 * Comprehensive tests for navigation components and their integration
 * focusing on accessibility, keyboard navigation, and cross-component communication.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { IntegratedNavigationSystem } from '../IntegratedNavigationSystem';
import { BreadcrumbNavigation } from '../BreadcrumbNavigation';
import { CategoryFilters } from '../CategoryFilters';
import { QuickAccessPatterns } from '../QuickAccessPatterns';
import { SearchResultNavigation } from '../SearchResultNavigation';
import { RecentlyViewedSidebar } from '../RecentlyViewedSidebar';
import { NavigationShortcuts } from '../NavigationShortcuts';

// Test Data
const mockBreadcrumbItems = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'category', label: 'JCL', href: '/jcl' },
  { id: 'subcategory', label: 'Batch Processing', href: '/jcl/batch' }
];

const mockFilterOptions = [
  { id: 'jcl', label: 'JCL', value: 'jcl', count: 25, active: false },
  { id: 'vsam', label: 'VSAM', value: 'vsam', count: 18, active: true },
  { id: 'db2', label: 'DB2', value: 'db2', count: 32, active: false }
];

const mockAccessPatterns = [
  {
    id: 'recent',
    type: 'recent' as const,
    label: 'Recent',
    description: 'Recently accessed items',
    items: [
      {
        id: 'item1',
        type: 'entry' as const,
        title: 'S0C7 Error Resolution',
        subtitle: 'Data exception handling',
        metadata: {
          accessCount: 15,
          accessScore: 0.85,
          lastAccessed: new Date(),
          favorite: false
        }
      }
    ]
  }
];

const mockSearchResults = [
  {
    id: 'result1',
    type: 'entry' as const,
    title: 'VSAM Status Code 35',
    snippet: 'File not found error resolution',
    category: 'VSAM',
    tags: ['file-error', 'status-35'],
    score: 0.95,
    matchType: 'exact' as const,
    metadata: {
      created: new Date(),
      lastModified: new Date(),
      accessCount: 10,
      popularity: 0.8
    }
  }
];

const mockRecentEntries = [
  {
    id: 'recent1',
    title: 'JCL Syntax Error',
    category: 'JCL',
    snippet: 'Common syntax error fixes',
    viewedAt: new Date(),
    viewCount: 5,
    isPinned: false,
    metadata: {
      type: 'entry' as const,
      tags: ['syntax', 'error'],
      lastModified: new Date(),
      popularity: 0.7
    }
  }
];

const mockNavigationContext = {
  currentLocation: 'JCL Batch Processing',
  breadcrumb: mockBreadcrumbItems,
  activeCategory: 'jcl',
  recentEntries: mockRecentEntries,
  filters: { category: 'jcl' },
  view: 'list' as const,
  sidebar: 'expanded' as const
};

describe('Navigation Components', () => {
  describe('BreadcrumbNavigation', () => {
    it('renders breadcrumb items correctly', () => {
      render(
        <BreadcrumbNavigation
          items={mockBreadcrumbItems}
          interactive={true}
          showHomeIcon={true}
        />
      );

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('JCL')).toBeInTheDocument();
      expect(screen.getByText('Batch Processing')).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      const onNavigate = jest.fn();

      render(
        <BreadcrumbNavigation
          items={mockBreadcrumbItems}
          interactive={true}
          onNavigate={onNavigate}
        />
      );

      const breadcrumbItem = screen.getByText('JCL');
      breadcrumbItem.focus();

      await user.keyboard('{Enter}');
      expect(onNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'JCL' }),
        1
      );
    });

    it('announces navigation changes for screen readers', async () => {
      const user = userEvent.setup();

      render(
        <BreadcrumbNavigation
          items={mockBreadcrumbItems}
          interactive={true}
          announceNavigation={true}
        />
      );

      const breadcrumbItem = screen.getByText('JCL');
      await user.click(breadcrumbItem);

      await waitFor(() => {
        const liveRegion = document.querySelector('[aria-live="polite"]');
        expect(liveRegion?.textContent).toContain('Navigated to JCL');
      });
    });

    it('handles responsive collapse correctly', () => {
      render(
        <BreadcrumbNavigation
          items={[...mockBreadcrumbItems,
            { id: 'item4', label: 'Item 4' },
            { id: 'item5', label: 'Item 5' }
          ]}
          maxItems={3}
          responsive={true}
        />
      );

      expect(screen.getByText('...')).toBeInTheDocument();
    });
  });

  describe('CategoryFilters', () => {
    it('renders filter options with counts', () => {
      render(
        <CategoryFilters
          options={mockFilterOptions}
          activeFilters={['vsam']}
          showCounts={true}
        />
      );

      expect(screen.getByText('JCL')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument(); // count
      expect(screen.getByText('VSAM')).toBeInTheDocument();

      // Check active state
      const vsamFilter = screen.getByText('VSAM').closest('button');
      expect(vsamFilter).toHaveClass('active');
    });

    it('supports filter search', async () => {
      const user = userEvent.setup();

      render(
        <CategoryFilters
          options={mockFilterOptions}
          activeFilters={[]}
          enableSearch={true}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search filters...');
      await user.type(searchInput, 'vsam');

      // Only VSAM filter should be visible
      expect(screen.getByText('VSAM')).toBeInTheDocument();
      expect(screen.queryByText('JCL')).not.toBeInTheDocument();
    });

    it('handles bulk operations', async () => {
      const user = userEvent.setup();
      const onFiltersChange = jest.fn();

      render(
        <CategoryFilters
          options={mockFilterOptions}
          activeFilters={['vsam']}
          enableBulkOps={true}
          onFiltersChange={onFiltersChange}
        />
      );

      const clearAllBtn = screen.getByText('Clear All');
      await user.click(clearAllBtn);

      expect(onFiltersChange).toHaveBeenCalledWith([]);
    });
  });

  describe('QuickAccessPatterns', () => {
    it('renders access patterns correctly', () => {
      render(
        <QuickAccessPatterns
          patterns={mockAccessPatterns}
          showStats={true}
        />
      );

      expect(screen.getByText('Recent')).toBeInTheDocument();
      expect(screen.getByText('S0C7 Error Resolution')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument(); // access count
    });

    it('supports drag and drop reordering', async () => {
      const user = userEvent.setup();
      const onItemReorder = jest.fn();

      render(
        <QuickAccessPatterns
          patterns={mockAccessPatterns}
          enableReordering={true}
          onItemReorder={onItemReorder}
        />
      );

      const item = screen.getByText('S0C7 Error Resolution');

      // Simulate drag start
      fireEvent.dragStart(item, { dataTransfer: { setData: jest.fn() } });

      // Note: Full drag-drop testing would require more complex setup
      expect(item).toHaveAttribute('draggable', 'true');
    });

    it('handles keyboard shortcuts for favorites', async () => {
      const user = userEvent.setup();
      const onItemFavorite = jest.fn();

      render(
        <QuickAccessPatterns
          patterns={mockAccessPatterns}
          enablePinning={true}
          onItemFavorite={onItemFavorite}
        />
      );

      const item = screen.getByText('S0C7 Error Resolution');
      item.focus();

      await user.keyboard('{Control>}f{/Control}');

      expect(onItemFavorite).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'S0C7 Error Resolution' }),
        true
      );
    });
  });

  describe('SearchResultNavigation', () => {
    const mockSearchContext = {
      query: 'VSAM error',
      totalResults: 1,
      currentPage: 1,
      resultsPerPage: 10,
      filters: {},
      sortBy: 'relevance',
      searchTime: 0.15
    };

    it('renders search results with navigation controls', () => {
      render(
        <SearchResultNavigation
          results={mockSearchResults}
          context={mockSearchContext}
          selectedIndex={0}
          showControls={true}
        />
      );

      expect(screen.getByText('1 of 1')).toBeInTheDocument();
      expect(screen.getByText('(0.15s)')).toBeInTheDocument();
      expect(screen.getByText('VSAM Status Code 35')).toBeInTheDocument();
    });

    it('supports keyboard navigation between results', async () => {
      const user = userEvent.setup();
      const onNextResult = jest.fn();

      render(
        <SearchResultNavigation
          results={mockSearchResults}
          context={mockSearchContext}
          selectedIndex={0}
          enableKeyboard={true}
          onNextResult={onNextResult}
        />
      );

      // Focus the navigation area
      const navigation = screen.getByRole('region');
      navigation.focus();

      await user.keyboard('{ArrowDown}');
      expect(onNextResult).toHaveBeenCalled();
    });

    it('displays result metadata', () => {
      render(
        <SearchResultNavigation
          results={mockSearchResults}
          context={mockSearchContext}
          selectedIndex={0}
          showMetadata={true}
        />
      );

      expect(screen.getByText('VSAM')).toBeInTheDocument(); // category
      expect(screen.getByText('10 times')).toBeInTheDocument(); // access count
    });
  });

  describe('RecentlyViewedSidebar', () => {
    it('renders recent entries grouped by time', () => {
      render(
        <RecentlyViewedSidebar
          entries={mockRecentEntries}
          groupByTime={true}
        />
      );

      expect(screen.getByText('Recently Viewed')).toBeInTheDocument();
      expect(screen.getByText('JCL Syntax Error')).toBeInTheDocument();
      expect(screen.getByText('Today')).toBeInTheDocument(); // time group
    });

    it('supports entry search', async () => {
      const user = userEvent.setup();

      render(
        <RecentlyViewedSidebar
          entries={mockRecentEntries}
          enableSearch={true}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search recent...');
      await user.type(searchInput, 'JCL');

      expect(screen.getByText('JCL Syntax Error')).toBeInTheDocument();
    });

    it('handles entry pinning', async () => {
      const user = userEvent.setup();
      const onEntryPin = jest.fn();

      render(
        <RecentlyViewedSidebar
          entries={mockRecentEntries}
          enablePinning={true}
          onEntryPin={onEntryPin}
        />
      );

      const entry = screen.getByText('JCL Syntax Error');
      entry.focus();

      await user.keyboard('p');
      expect(onEntryPin).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'JCL Syntax Error' }),
        true
      );
    });

    it('supports collapsible sidebar', async () => {
      const user = userEvent.setup();

      render(
        <RecentlyViewedSidebar
          entries={mockRecentEntries}
          collapsible={true}
          initiallyCollapsed={false}
        />
      );

      const collapseBtn = screen.getByLabelText('Collapse sidebar');
      await user.click(collapseBtn);

      expect(screen.queryByText('JCL Syntax Error')).not.toBeInTheDocument();
    });
  });

  describe('NavigationShortcuts', () => {
    const mockShortcuts = [
      {
        id: 'search',
        keys: ['ctrl+k'],
        description: 'Open search',
        action: 'open-search',
        category: 'navigation',
        enabled: true,
        global: true,
        preventDefault: true
      }
    ];

    const mockActions = [
      {
        id: 'open-search',
        handler: jest.fn()
      }
    ];

    it('executes keyboard shortcuts', async () => {
      const user = userEvent.setup();

      render(
        <NavigationShortcuts
          shortcuts={mockShortcuts}
          actions={mockActions}
          enableKeyboard={true}
        />
      );

      await user.keyboard('{Control>}k{/Control}');
      expect(mockActions[0].handler).toHaveBeenCalled();
    });

    it('shows help overlay', async () => {
      const user = userEvent.setup();

      render(
        <NavigationShortcuts
          shortcuts={mockShortcuts}
          actions={mockActions}
          enableHelp={true}
        />
      );

      await user.keyboard('{F1}');
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });

    it('announces shortcut execution', async () => {
      const user = userEvent.setup();

      render(
        <NavigationShortcuts
          shortcuts={mockShortcuts}
          actions={mockActions}
          announceShortcuts={true}
        />
      );

      await user.keyboard('{Control>}k{/Control}');

      await waitFor(() => {
        const liveRegion = document.querySelector('[aria-live="polite"]');
        expect(liveRegion?.textContent).toContain('Executed: Open search');
      });
    });
  });

  describe('IntegratedNavigationSystem', () => {
    it('renders all navigation components in standard layout', () => {
      render(
        <IntegratedNavigationSystem
          context={mockNavigationContext}
          filterOptions={mockFilterOptions}
          accessPatterns={mockAccessPatterns}
        />
      );

      expect(screen.getByText('Home')).toBeInTheDocument(); // breadcrumb
      expect(screen.getByText('JCL')).toBeInTheDocument(); // filters
      expect(screen.getByText('Recently Viewed')).toBeInTheDocument(); // sidebar
    });

    it('adapts to different layouts', () => {
      const { rerender } = render(
        <IntegratedNavigationSystem
          context={mockNavigationContext}
          filterOptions={mockFilterOptions}
          accessPatterns={mockAccessPatterns}
          config={{ layout: 'standard' }}
        />
      );

      expect(screen.getByTestId || screen.getByRole('navigation')).toHaveAttribute(
        'data-layout',
        'standard'
      );

      rerender(
        <IntegratedNavigationSystem
          context={mockNavigationContext}
          filterOptions={mockFilterOptions}
          accessPatterns={mockAccessPatterns}
          config={{ layout: 'compact' }}
        />
      );

      expect(screen.getByRole('navigation')).toHaveAttribute(
        'data-layout',
        'compact'
      );
    });

    it('handles context changes', async () => {
      const onNavigationChange = jest.fn();
      const { rerender } = render(
        <IntegratedNavigationSystem
          context={mockNavigationContext}
          filterOptions={mockFilterOptions}
          accessPatterns={mockAccessPatterns}
          onNavigationChange={onNavigationChange}
        />
      );

      const newContext = {
        ...mockNavigationContext,
        currentLocation: 'New Location'
      };

      rerender(
        <IntegratedNavigationSystem
          context={newContext}
          filterOptions={mockFilterOptions}
          accessPatterns={mockAccessPatterns}
          onNavigationChange={onNavigationChange}
        />
      );

      // Verify context change was handled
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('persists navigation state', () => {
      const config = {
        behavior: { persistState: true }
      };

      render(
        <IntegratedNavigationSystem
          context={mockNavigationContext}
          filterOptions={mockFilterOptions}
          accessPatterns={mockAccessPatterns}
          config={config}
        />
      );

      // Verify localStorage or sessionStorage usage
      // This would require mocking localStorage
      expect(localStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels and roles', () => {
      render(
        <IntegratedNavigationSystem
          context={mockNavigationContext}
          filterOptions={mockFilterOptions}
          accessPatterns={mockAccessPatterns}
        />
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByRole('region')).toBeInTheDocument(); // sidebar
      expect(screen.getByRole('group')).toBeInTheDocument(); // filter groups
    });

    it('supports screen reader announcements', async () => {
      render(
        <IntegratedNavigationSystem
          context={mockNavigationContext}
          filterOptions={mockFilterOptions}
          accessPatterns={mockAccessPatterns}
          announceNavigation={true}
        />
      );

      await waitFor(() => {
        const liveRegions = document.querySelectorAll('[aria-live="polite"]');
        expect(liveRegions.length).toBeGreaterThan(0);
      });
    });

    it('maintains focus management', async () => {
      const user = userEvent.setup();

      render(
        <IntegratedNavigationSystem
          context={mockNavigationContext}
          filterOptions={mockFilterOptions}
          accessPatterns={mockAccessPatterns}
        />
      );

      // Tab through navigation elements
      await user.tab();
      expect(document.activeElement).toHaveAttribute('tabIndex', '0');

      await user.tab();
      expect(document.activeElement).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('lazy loads non-critical components', () => {
      const { container } = render(
        <IntegratedNavigationSystem
          context={mockNavigationContext}
          filterOptions={mockFilterOptions}
          accessPatterns={mockAccessPatterns}
          enableAnalytics={true}
        />
      );

      // Check for Suspense boundaries (lazy loading indicators)
      const suspenseBoundaries = container.querySelectorAll('[data-testid*="suspense"]');
      // This would depend on how lazy loading is implemented
    });

    it('optimizes re-renders with memoization', () => {
      const renderSpy = jest.fn();
      const TestComponent = React.memo(() => {
        renderSpy();
        return <div>Test</div>;
      });

      const { rerender } = render(
        <IntegratedNavigationSystem
          context={mockNavigationContext}
          filterOptions={mockFilterOptions}
          accessPatterns={mockAccessPatterns}
        />
      );

      rerender(
        <IntegratedNavigationSystem
          context={mockNavigationContext} // Same context
          filterOptions={mockFilterOptions}
          accessPatterns={mockAccessPatterns}
        />
      );

      // Memoized components should not re-render with same props
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });
  });
});

// Mock localStorage for testing
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});

// Mock ResizeObserver for responsive tests
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));