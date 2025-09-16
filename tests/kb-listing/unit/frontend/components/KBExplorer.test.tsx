/**
 * Unit tests for KBExplorer component
 * Tests the main knowledge base exploration interface
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KBExplorer } from '../../../../../src/renderer/components/KBExplorer';
import { useKBListing } from '../../../../../src/renderer/hooks/useKBListing';
import { useFilters } from '../../../../../src/renderer/hooks/useFilters';
import { usePagination } from '../../../../../src/renderer/hooks/usePagination';
import { KBEntry } from '../../../../../src/types';
import { generateMockKBEntries } from '../../../helpers/mock-data-generator';

// Mock the custom hooks
jest.mock('../../../../../src/renderer/hooks/useKBListing');
jest.mock('../../../../../src/renderer/hooks/useFilters');
jest.mock('../../../../../src/renderer/hooks/usePagination');

const mockUseKBListing = useKBListing as jest.MockedFunction<typeof useKBListing>;
const mockUseFilters = useFilters as jest.MockedFunction<typeof useFilters>;
const mockUsePagination = usePagination as jest.MockedFunction<typeof usePagination>;

describe('KBExplorer', () => {
  const mockEntries: KBEntry[] = generateMockKBEntries(25);

  const defaultKBListingReturn = {
    data: {
      items: mockEntries.slice(0, 10),
      pagination: {
        currentPage: 1,
        pageSize: 10,
        totalItems: 25,
        totalPages: 3,
        hasNext: true,
        hasPrevious: false
      },
      sorting: {
        sortBy: 'updated_at' as const,
        sortDirection: 'desc' as const,
        availableSorts: [
          { field: 'title' as const, label: 'Title', defaultDirection: 'asc' as const },
          { field: 'category' as const, label: 'Category', defaultDirection: 'asc' as const },
          { field: 'updated_at' as const, label: 'Last Updated', defaultDirection: 'desc' as const }
        ]
      },
      filtering: {
        activeFilters: [],
        availableFilters: [],
        quickFilters: [
          { type: 'recent' as const, label: 'Recently Added', count: 5, active: false },
          { type: 'popular' as const, label: 'Most Popular', count: 8, active: false }
        ],
        filterCounts: {}
      },
      aggregations: {
        categoryStats: [
          { category: 'VSAM', count: 10, percentage: 40, avgRating: 4.2, avgUsage: 15 },
          { category: 'JCL', count: 8, percentage: 32, avgRating: 4.0, avgUsage: 12 },
          { category: 'DB2', count: 7, percentage: 28, avgRating: 4.5, avgUsage: 18 }
        ],
        tagCloud: [],
        severityDistribution: [],
        usageStats: {
          totalViews: 1250,
          uniqueUsers: 45,
          avgSessionTime: 320,
          bounceRate: 0.15,
          conversionRate: 0.85
        },
        timelineStats: []
      },
      metadata: {
        totalTime: 150,
        cacheHit: false,
        queryComplexity: 1
      }
    },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    invalidateCache: jest.fn()
  };

  const defaultFiltersReturn = {
    filters: [],
    activeQuickFilters: [],
    searchQuery: '',
    addFilter: jest.fn(),
    removeFilter: jest.fn(),
    updateFilter: jest.fn(),
    clearFilters: jest.fn(),
    toggleQuickFilter: jest.fn(),
    setSearchQuery: jest.fn(),
    getFilterSummary: jest.fn().mockReturnValue('No filters applied'),
    isFilterActive: jest.fn().mockReturnValue(false)
  };

  const defaultPaginationReturn = {
    currentPage: 1,
    pageSize: 10,
    totalPages: 3,
    totalItems: 25,
    hasNext: true,
    hasPrevious: false,
    goToPage: jest.fn(),
    goToNext: jest.fn(),
    goToPrevious: jest.fn(),
    changePageSize: jest.fn()
  };

  beforeEach(() => {
    mockUseKBListing.mockReturnValue(defaultKBListingReturn);
    mockUseFilters.mockReturnValue(defaultFiltersReturn);
    mockUsePagination.mockReturnValue(defaultPaginationReturn);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================
  // BASIC RENDERING TESTS
  // =========================

  describe('Basic Rendering', () => {
    it('should render the KB Explorer component', () => {
      render(<KBExplorer />);

      expect(screen.getByTestId('kb-explorer')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /knowledge base explorer/i })).toBeInTheDocument();
    });

    it('should display the search bar', () => {
      render(<KBExplorer />);

      expect(screen.getByPlaceholderText(/search knowledge base/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
    });

    it('should render the filter panel', () => {
      render(<KBExplorer />);

      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
    });

    it('should render the results table', () => {
      render(<KBExplorer />);

      expect(screen.getByTestId('kb-results-table')).toBeInTheDocument();
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should render pagination controls', () => {
      render(<KBExplorer />);

      expect(screen.getByTestId('pagination-controls')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
    });

    it('should display entry count and summary information', () => {
      render(<KBExplorer />);

      expect(screen.getByText(/showing 10 of 25 entries/i)).toBeInTheDocument();
      expect(screen.getByTestId('results-summary')).toBeInTheDocument();
    });
  });

  // =========================
  // LOADING AND ERROR STATES
  // =========================

  describe('Loading and Error States', () => {
    it('should show loading state', () => {
      mockUseKBListing.mockReturnValue({
        ...defaultKBListingReturn,
        isLoading: true,
        data: null
      });

      render(<KBExplorer />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText(/loading knowledge base entries/i)).toBeInTheDocument();
    });

    it('should show error state', () => {
      const errorMessage = 'Failed to load entries';
      mockUseKBListing.mockReturnValue({
        ...defaultKBListingReturn,
        isLoading: false,
        error: new Error(errorMessage),
        data: null
      });

      render(<KBExplorer />);

      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should show empty state when no entries found', () => {
      mockUseKBListing.mockReturnValue({
        ...defaultKBListingReturn,
        data: {
          ...defaultKBListingReturn.data!,
          items: [],
          pagination: {
            ...defaultKBListingReturn.data!.pagination,
            totalItems: 0,
            totalPages: 0
          }
        }
      });

      render(<KBExplorer />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText(/no knowledge base entries found/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
    });

    it('should handle retry action on error', async () => {
      const mockRefetch = jest.fn();
      mockUseKBListing.mockReturnValue({
        ...defaultKBListingReturn,
        isLoading: false,
        error: new Error('Network error'),
        data: null,
        refetch: mockRefetch
      });

      render(<KBExplorer />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  // =========================
  // SEARCH FUNCTIONALITY
  // =========================

  describe('Search Functionality', () => {
    it('should handle search input changes', async () => {
      const mockSetSearchQuery = jest.fn();
      mockUseFilters.mockReturnValue({
        ...defaultFiltersReturn,
        setSearchQuery: mockSetSearchQuery
      });

      render(<KBExplorer />);

      const searchInput = screen.getByPlaceholderText(/search knowledge base/i);
      await userEvent.type(searchInput, 'VSAM error');

      expect(mockSetSearchQuery).toHaveBeenCalledWith('VSAM error');
    });

    it('should perform search on Enter key press', async () => {
      const mockSetSearchQuery = jest.fn();
      mockUseFilters.mockReturnValue({
        ...defaultFiltersReturn,
        setSearchQuery: mockSetSearchQuery
      });

      render(<KBExplorer />);

      const searchInput = screen.getByPlaceholderText(/search knowledge base/i);
      await userEvent.type(searchInput, 'database{enter}');

      expect(mockSetSearchQuery).toHaveBeenCalledWith('database');
    });

    it('should perform search on search button click', async () => {
      const mockSetSearchQuery = jest.fn();
      mockUseFilters.mockReturnValue({
        ...defaultFiltersReturn,
        setSearchQuery: mockSetSearchQuery
      });

      render(<KBExplorer />);

      const searchInput = screen.getByPlaceholderText(/search knowledge base/i);
      const searchButton = screen.getByRole('button', { name: /search/i });

      await userEvent.type(searchInput, 'JCL syntax');
      await userEvent.click(searchButton);

      expect(mockSetSearchQuery).toHaveBeenCalledWith('JCL syntax');
    });

    it('should clear search when clear button is clicked', async () => {
      const mockSetSearchQuery = jest.fn();
      mockUseFilters.mockReturnValue({
        ...defaultFiltersReturn,
        searchQuery: 'existing search',
        setSearchQuery: mockSetSearchQuery
      });

      render(<KBExplorer />);

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      await userEvent.click(clearButton);

      expect(mockSetSearchQuery).toHaveBeenCalledWith('');
    });

    it('should show search suggestions dropdown', async () => {
      render(<KBExplorer />);

      const searchInput = screen.getByPlaceholderText(/search knowledge base/i);
      await userEvent.type(searchInput, 'VS');

      await waitFor(() => {
        expect(screen.getByTestId('search-suggestions')).toBeInTheDocument();
      });

      expect(screen.getByText(/VSAM/)).toBeInTheDocument();
    });
  });

  // =========================
  // FILTERING FUNCTIONALITY
  // =========================

  describe('Filtering Functionality', () => {
    it('should toggle filter panel visibility', async () => {
      render(<KBExplorer />);

      const filterButton = screen.getByRole('button', { name: /filters/i });

      // Initially, detailed filters might be collapsed
      await userEvent.click(filterButton);

      expect(screen.getByTestId('advanced-filters')).toBeInTheDocument();
    });

    it('should apply quick filters', async () => {
      const mockToggleQuickFilter = jest.fn();
      mockUseFilters.mockReturnValue({
        ...defaultFiltersReturn,
        toggleQuickFilter: mockToggleQuickFilter
      });

      render(<KBExplorer />);

      const recentFilter = screen.getByRole('button', { name: /recently added/i });
      await userEvent.click(recentFilter);

      expect(mockToggleQuickFilter).toHaveBeenCalledWith('recent');
    });

    it('should show active filter count', () => {
      mockUseFilters.mockReturnValue({
        ...defaultFiltersReturn,
        filters: [
          { id: 'filter1', field: 'category', operator: 'eq', value: 'VSAM', label: 'Category: VSAM', removable: true },
          { id: 'filter2', field: 'usage_count', operator: 'gte', value: 10, label: 'Usage ≥ 10', removable: true }
        ]
      });

      render(<KBExplorer />);

      expect(screen.getByText(/2 filters applied/i)).toBeInTheDocument();
      expect(screen.getByTestId('active-filters-count')).toBeInTheDocument();
    });

    it('should clear all filters', async () => {
      const mockClearFilters = jest.fn();
      mockUseFilters.mockReturnValue({
        ...defaultFiltersReturn,
        filters: [
          { id: 'filter1', field: 'category', operator: 'eq', value: 'VSAM', label: 'Category: VSAM', removable: true }
        ],
        clearFilters: mockClearFilters
      });

      render(<KBExplorer />);

      const clearButton = screen.getByRole('button', { name: /clear all filters/i });
      await userEvent.click(clearButton);

      expect(mockClearFilters).toHaveBeenCalledTimes(1);
    });

    it('should remove individual filters', async () => {
      const mockRemoveFilter = jest.fn();
      mockUseFilters.mockReturnValue({
        ...defaultFiltersReturn,
        filters: [
          { id: 'filter1', field: 'category', operator: 'eq', value: 'VSAM', label: 'Category: VSAM', removable: true }
        ],
        removeFilter: mockRemoveFilter
      });

      render(<KBExplorer />);

      const removeButton = screen.getByRole('button', { name: /remove filter category: vsam/i });
      await userEvent.click(removeButton);

      expect(mockRemoveFilter).toHaveBeenCalledWith('filter1');
    });
  });

  // =========================
  // SORTING FUNCTIONALITY
  // =========================

  describe('Sorting Functionality', () => {
    it('should change sort field and direction', async () => {
      const mockRefetch = jest.fn();
      mockUseKBListing.mockReturnValue({
        ...defaultKBListingReturn,
        refetch: mockRefetch
      });

      render(<KBExplorer />);

      const sortSelect = screen.getByRole('combobox', { name: /sort by/i });
      await userEvent.selectOptions(sortSelect, 'title');

      expect(mockRefetch).toHaveBeenCalledWith({
        sortBy: 'title',
        sortDirection: 'asc'
      });
    });

    it('should toggle sort direction for same field', async () => {
      const mockRefetch = jest.fn();
      mockUseKBListing.mockReturnValue({
        ...defaultKBListingReturn,
        refetch: mockRefetch
      });

      render(<KBExplorer />);

      const titleHeader = screen.getByRole('button', { name: /sort by title/i });
      await userEvent.click(titleHeader);

      expect(mockRefetch).toHaveBeenCalledWith({
        sortBy: 'title',
        sortDirection: 'asc'
      });

      // Click again to toggle direction
      await userEvent.click(titleHeader);

      expect(mockRefetch).toHaveBeenCalledWith({
        sortBy: 'title',
        sortDirection: 'desc'
      });
    });

    it('should show sort indicators in table headers', () => {
      mockUseKBListing.mockReturnValue({
        ...defaultKBListingReturn,
        data: {
          ...defaultKBListingReturn.data!,
          sorting: {
            ...defaultKBListingReturn.data!.sorting,
            sortBy: 'title',
            sortDirection: 'asc'
          }
        }
      });

      render(<KBExplorer />);

      const titleHeader = screen.getByRole('columnheader', { name: /title/i });
      expect(within(titleHeader).getByTestId('sort-indicator-asc')).toBeInTheDocument();
    });
  });

  // =========================
  // PAGINATION FUNCTIONALITY
  // =========================

  describe('Pagination Functionality', () => {
    it('should navigate to next page', async () => {
      const mockGoToNext = jest.fn();
      mockUsePagination.mockReturnValue({
        ...defaultPaginationReturn,
        goToNext: mockGoToNext
      });

      render(<KBExplorer />);

      const nextButton = screen.getByRole('button', { name: /next page/i });
      await userEvent.click(nextButton);

      expect(mockGoToNext).toHaveBeenCalledTimes(1);
    });

    it('should navigate to previous page', async () => {
      const mockGoToPrevious = jest.fn();
      mockUsePagination.mockReturnValue({
        ...defaultPaginationReturn,
        currentPage: 2,
        hasPrevious: true,
        goToPrevious: mockGoToPrevious
      });

      render(<KBExplorer />);

      const prevButton = screen.getByRole('button', { name: /previous page/i });
      await userEvent.click(prevButton);

      expect(mockGoToPrevious).toHaveBeenCalledTimes(1);
    });

    it('should navigate to specific page', async () => {
      const mockGoToPage = jest.fn();
      mockUsePagination.mockReturnValue({
        ...defaultPaginationReturn,
        goToPage: mockGoToPage
      });

      render(<KBExplorer />);

      const pageButton = screen.getByRole('button', { name: /go to page 3/i });
      await userEvent.click(pageButton);

      expect(mockGoToPage).toHaveBeenCalledWith(3);
    });

    it('should change page size', async () => {
      const mockChangePageSize = jest.fn();
      mockUsePagination.mockReturnValue({
        ...defaultPaginationReturn,
        changePageSize: mockChangePageSize
      });

      render(<KBExplorer />);

      const pageSizeSelect = screen.getByRole('combobox', { name: /entries per page/i });
      await userEvent.selectOptions(pageSizeSelect, '25');

      expect(mockChangePageSize).toHaveBeenCalledWith(25);
    });

    it('should disable pagination buttons when appropriate', () => {
      mockUsePagination.mockReturnValue({
        ...defaultPaginationReturn,
        currentPage: 1,
        hasNext: false,
        hasPrevious: false
      });

      render(<KBExplorer />);

      expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
    });
  });

  // =========================
  // TABLE FUNCTIONALITY
  // =========================

  describe('Table Functionality', () => {
    it('should display entry data in table rows', () => {
      render(<KBExplorer />);

      const firstEntry = mockEntries[0];
      expect(screen.getByText(firstEntry.title)).toBeInTheDocument();
      expect(screen.getByText(firstEntry.category!)).toBeInTheDocument();
    });

    it('should handle row selection', async () => {
      render(<KBExplorer />);

      const firstRow = screen.getByTestId(`entry-row-${mockEntries[0].id}`);
      const checkbox = within(firstRow).getByRole('checkbox');

      await userEvent.click(checkbox);

      expect(checkbox).toBeChecked();
    });

    it('should handle select all functionality', async () => {
      render(<KBExplorer />);

      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all entries/i });
      await userEvent.click(selectAllCheckbox);

      const entryCheckboxes = screen.getAllByTestId(/entry-checkbox-/);
      entryCheckboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });
    });

    it('should show entry details on row click', async () => {
      render(<KBExplorer />);

      const firstRow = screen.getByTestId(`entry-row-${mockEntries[0].id}`);
      await userEvent.click(firstRow);

      expect(screen.getByTestId('entry-details-modal')).toBeInTheDocument();
      expect(screen.getByText(mockEntries[0].title)).toBeInTheDocument();
    });

    it('should display column customization options', async () => {
      render(<KBExplorer />);

      const columnsButton = screen.getByRole('button', { name: /customize columns/i });
      await userEvent.click(columnsButton);

      expect(screen.getByTestId('column-customization')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /show category column/i })).toBeInTheDocument();
    });
  });

  // =========================
  // EXPORT FUNCTIONALITY
  // =========================

  describe('Export Functionality', () => {
    it('should open export dialog', async () => {
      render(<KBExplorer />);

      const exportButton = screen.getByRole('button', { name: /export/i });
      await userEvent.click(exportButton);

      expect(screen.getByTestId('export-dialog')).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /export format/i })).toBeInTheDocument();
    });

    it('should handle bulk actions on selected entries', async () => {
      render(<KBExplorer />);

      // Select some entries
      const firstCheckbox = screen.getByTestId(`entry-checkbox-${mockEntries[0].id}`);
      const secondCheckbox = screen.getByTestId(`entry-checkbox-${mockEntries[1].id}`);

      await userEvent.click(firstCheckbox);
      await userEvent.click(secondCheckbox);

      // Bulk actions should be available
      expect(screen.getByRole('button', { name: /bulk actions/i })).toBeEnabled();

      const bulkButton = screen.getByRole('button', { name: /bulk actions/i });
      await userEvent.click(bulkButton);

      expect(screen.getByRole('menuitem', { name: /export selected/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /delete selected/i })).toBeInTheDocument();
    });
  });

  // =========================
  // PERFORMANCE TESTS
  // =========================

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      const largeDataset = generateMockKBEntries(1000);
      mockUseKBListing.mockReturnValue({
        ...defaultKBListingReturn,
        data: {
          ...defaultKBListingReturn.data!,
          items: largeDataset.slice(0, 50),
          pagination: {
            ...defaultKBListingReturn.data!.pagination,
            totalItems: 1000,
            totalPages: 20,
            pageSize: 50
          }
        }
      });

      const startTime = performance.now();
      render(<KBExplorer />);
      const renderTime = performance.now() - startTime;

      expect(renderTime).toBeLessThan(100); // Should render in less than 100ms
      expect(screen.getByText(/showing 50 of 1000 entries/i)).toBeInTheDocument();
    });

    it('should debounce search input', async () => {
      jest.useFakeTimers();
      const mockSetSearchQuery = jest.fn();

      mockUseFilters.mockReturnValue({
        ...defaultFiltersReturn,
        setSearchQuery: mockSetSearchQuery
      });

      render(<KBExplorer />);

      const searchInput = screen.getByPlaceholderText(/search knowledge base/i);

      // Type quickly
      await userEvent.type(searchInput, 'quick search');

      // Should not call immediately
      expect(mockSetSearchQuery).not.toHaveBeenCalled();

      // Fast-forward timers
      jest.advanceTimersByTime(500);

      expect(mockSetSearchQuery).toHaveBeenCalledWith('quick search');

      jest.useRealTimers();
    });

    it('should virtualize large tables for performance', () => {
      const largeDataset = generateMockKBEntries(500);
      mockUseKBListing.mockReturnValue({
        ...defaultKBListingReturn,
        data: {
          ...defaultKBListingReturn.data!,
          items: largeDataset,
          pagination: {
            ...defaultKBListingReturn.data!.pagination,
            totalItems: 500,
            pageSize: 500
          }
        }
      });

      render(<KBExplorer />);

      // Should use virtual scrolling for large datasets
      expect(screen.getByTestId('virtualized-table')).toBeInTheDocument();

      // Should only render visible rows
      const renderedRows = screen.getAllByTestId(/entry-row-/);
      expect(renderedRows.length).toBeLessThan(100); // Fewer than total entries
    });
  });

  // =========================
  // ACCESSIBILITY TESTS
  // =========================

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<KBExplorer />);

      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Knowledge Base Explorer');
      expect(screen.getByRole('search')).toBeInTheDocument();
      expect(screen.getByRole('table')).toHaveAttribute('aria-label', 'Knowledge Base Entries');
      expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(<KBExplorer />);

      const searchInput = screen.getByPlaceholderText(/search knowledge base/i);

      // Tab navigation should work
      await userEvent.tab();
      expect(searchInput).toHaveFocus();

      await userEvent.tab();
      expect(screen.getByRole('button', { name: /search/i })).toHaveFocus();

      await userEvent.tab();
      expect(screen.getByRole('button', { name: /filters/i })).toHaveFocus();
    });

    it('should announce screen reader friendly messages', async () => {
      render(<KBExplorer />);

      // Should have live region for status updates
      expect(screen.getByRole('status')).toBeInTheDocument();

      const mockSetSearchQuery = jest.fn();
      mockUseFilters.mockReturnValue({
        ...defaultFiltersReturn,
        setSearchQuery: mockSetSearchQuery
      });

      const searchInput = screen.getByPlaceholderText(/search knowledge base/i);
      await userEvent.type(searchInput, 'test search{enter}');

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/search results updated/i);
      });
    });

    it('should provide skip links for keyboard users', () => {
      render(<KBExplorer />);

      const skipToContent = screen.getByRole('link', { name: /skip to main content/i });
      const skipToFilters = screen.getByRole('link', { name: /skip to filters/i });

      expect(skipToContent).toBeInTheDocument();
      expect(skipToFilters).toBeInTheDocument();
    });

    it('should have proper heading hierarchy', () => {
      render(<KBExplorer />);

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /filters/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /results/i })).toBeInTheDocument();
    });
  });

  // =========================
  // ERROR RECOVERY TESTS
  // =========================

  describe('Error Recovery', () => {
    it('should recover from network errors gracefully', async () => {
      const mockRefetch = jest.fn().mockResolvedValue({ success: true });

      // Start with error state
      mockUseKBListing.mockReturnValue({
        ...defaultKBListingReturn,
        isLoading: false,
        error: new Error('Network timeout'),
        data: null,
        refetch: mockRefetch
      });

      const { rerender } = render(<KBExplorer />);

      expect(screen.getByTestId('error-message')).toBeInTheDocument();

      // Simulate successful retry
      mockUseKBListing.mockReturnValue({
        ...defaultKBListingReturn,
        refetch: mockRefetch
      });

      rerender(<KBExplorer />);

      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
      expect(screen.getByTestId('kb-results-table')).toBeInTheDocument();
    });

    it('should maintain user state during errors', () => {
      mockUseFilters.mockReturnValue({
        ...defaultFiltersReturn,
        searchQuery: 'user search query',
        filters: [
          { id: 'filter1', field: 'category', operator: 'eq', value: 'VSAM', label: 'Category: VSAM', removable: true }
        ]
      });

      mockUseKBListing.mockReturnValue({
        ...defaultKBListingReturn,
        isLoading: false,
        error: new Error('Server error'),
        data: null
      });

      render(<KBExplorer />);

      // User's search query and filters should be preserved
      expect(screen.getByDisplayValue('user search query')).toBeInTheDocument();
      expect(screen.getByText(/1 filter applied/i)).toBeInTheDocument();
    });
  });
});