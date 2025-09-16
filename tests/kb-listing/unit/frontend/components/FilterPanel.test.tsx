/**
 * Unit tests for FilterPanel component
 * Tests the filtering interface and user interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterPanel } from '../../../../../src/renderer/components/FilterPanel';
import { FilterOption, QuickFilterInfo, ActiveFilter } from '../../../../../src/main/services/KBListingService';

describe('FilterPanel', () => {
  const mockFilterOptions: FilterOption[] = [
    {
      field: 'category',
      label: 'Category',
      type: 'multiselect',
      options: [
        { value: 'VSAM', label: 'VSAM', count: 15 },
        { value: 'JCL', label: 'JCL', count: 12 },
        { value: 'DB2', label: 'DB2', count: 8 },
        { value: 'Batch', label: 'Batch', count: 10 }
      ]
    },
    {
      field: 'severity',
      label: 'Severity',
      type: 'multiselect',
      options: [
        { value: 'critical', label: 'Critical', count: 5 },
        { value: 'high', label: 'High', count: 10 },
        { value: 'medium', label: 'Medium', count: 20 },
        { value: 'low', label: 'Low', count: 15 }
      ]
    },
    {
      field: 'created_at',
      label: 'Created Date',
      type: 'date'
    },
    {
      field: 'usage_count',
      label: 'Usage Count',
      type: 'range',
      min: 0,
      max: 100
    }
  ];

  const mockQuickFilters: QuickFilterInfo[] = [
    { type: 'recent', label: 'Recently Added', count: 8, active: false },
    { type: 'popular', label: 'Most Popular', count: 12, active: false },
    { type: 'highly_rated', label: 'Highly Rated', count: 6, active: false },
    { type: 'frequently_used', label: 'Frequently Used', count: 15, active: false },
    { type: 'needs_review', label: 'Needs Review', count: 3, active: false }
  ];

  const mockActiveFilters: ActiveFilter[] = [];

  const defaultProps = {
    filterOptions: mockFilterOptions,
    quickFilters: mockQuickFilters,
    activeFilters: mockActiveFilters,
    onAddFilter: jest.fn(),
    onRemoveFilter: jest.fn(),
    onUpdateFilter: jest.fn(),
    onClearFilters: jest.fn(),
    onToggleQuickFilter: jest.fn(),
    isExpanded: true,
    onToggleExpanded: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================
  // BASIC RENDERING TESTS
  // =========================

  describe('Basic Rendering', () => {
    it('should render the filter panel', () => {
      render(<FilterPanel {...defaultProps} />);

      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /filters/i })).toBeInTheDocument();
    });

    it('should render quick filters section', () => {
      render(<FilterPanel {...defaultProps} />);

      expect(screen.getByTestId('quick-filters')).toBeInTheDocument();
      expect(screen.getByText('Recently Added (8)')).toBeInTheDocument();
      expect(screen.getByText('Most Popular (12)')).toBeInTheDocument();
      expect(screen.getByText('Highly Rated (6)')).toBeInTheDocument();
    });

    it('should render advanced filters section', () => {
      render(<FilterPanel {...defaultProps} />);

      expect(screen.getByTestId('advanced-filters')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add filter/i })).toBeInTheDocument();
    });

    it('should render active filters section when filters are applied', () => {
      const activeFilters: ActiveFilter[] = [
        {
          id: 'filter1',
          field: 'category',
          operator: 'eq',
          value: 'VSAM',
          label: 'Category equals VSAM',
          removable: true
        },
        {
          id: 'filter2',
          field: 'usage_count',
          operator: 'gte',
          value: 10,
          label: 'Usage Count ≥ 10',
          removable: true
        }
      ];

      render(<FilterPanel {...defaultProps} activeFilters={activeFilters} />);

      expect(screen.getByTestId('active-filters')).toBeInTheDocument();
      expect(screen.getByText('Category equals VSAM')).toBeInTheDocument();
      expect(screen.getByText('Usage Count ≥ 10')).toBeInTheDocument();
    });

    it('should toggle panel expansion', async () => {
      const mockToggleExpanded = jest.fn();
      render(<FilterPanel {...defaultProps} onToggleExpanded={mockToggleExpanded} />);

      const toggleButton = screen.getByRole('button', { name: /toggle filters/i });
      await userEvent.click(toggleButton);

      expect(mockToggleExpanded).toHaveBeenCalledTimes(1);
    });

    it('should hide advanced sections when collapsed', () => {
      render(<FilterPanel {...defaultProps} isExpanded={false} />);

      expect(screen.queryByTestId('advanced-filters')).not.toBeInTheDocument();
      expect(screen.getByTestId('quick-filters')).toBeInTheDocument();
    });
  });

  // =========================
  // QUICK FILTERS TESTS
  // =========================

  describe('Quick Filters', () => {
    it('should apply quick filter on click', async () => {
      const mockToggleQuickFilter = jest.fn();
      render(<FilterPanel {...defaultProps} onToggleQuickFilter={mockToggleQuickFilter} />);

      const recentFilter = screen.getByRole('button', { name: /recently added/i });
      await userEvent.click(recentFilter);

      expect(mockToggleQuickFilter).toHaveBeenCalledWith('recent');
    });

    it('should show active state for applied quick filters', () => {
      const activeQuickFilters = mockQuickFilters.map(qf =>
        qf.type === 'recent' ? { ...qf, active: true } : qf
      );

      render(<FilterPanel {...defaultProps} quickFilters={activeQuickFilters} />);

      const recentFilter = screen.getByRole('button', { name: /recently added/i });
      expect(recentFilter).toHaveAttribute('aria-pressed', 'true');
      expect(recentFilter).toHaveClass('active');
    });

    it('should display filter counts correctly', () => {
      render(<FilterPanel {...defaultProps} />);

      expect(screen.getByText('Recently Added (8)')).toBeInTheDocument();
      expect(screen.getByText('Most Popular (12)')).toBeInTheDocument();
      expect(screen.getByText('Needs Review (3)')).toBeInTheDocument();
    });

    it('should disable quick filters when count is zero', () => {
      const emptyQuickFilters = mockQuickFilters.map(qf => ({ ...qf, count: 0 }));

      render(<FilterPanel {...defaultProps} quickFilters={emptyQuickFilters} />);

      mockQuickFilters.forEach(qf => {
        const button = screen.getByRole('button', { name: new RegExp(qf.label, 'i') });
        expect(button).toBeDisabled();
      });
    });

    it('should show tooltips for quick filter descriptions', async () => {
      render(<FilterPanel {...defaultProps} />);

      const recentFilter = screen.getByRole('button', { name: /recently added/i });
      await userEvent.hover(recentFilter);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByText(/entries added in the last 7 days/i)).toBeInTheDocument();
      });
    });
  });

  // =========================
  // ADVANCED FILTERS TESTS
  // =========================

  describe('Advanced Filters', () => {
    it('should open filter creation dialog', async () => {
      render(<FilterPanel {...defaultProps} />);

      const addFilterButton = screen.getByRole('button', { name: /add filter/i });
      await userEvent.click(addFilterButton);

      expect(screen.getByTestId('filter-creation-dialog')).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /field/i })).toBeInTheDocument();
    });

    it('should create category filter', async () => {
      const mockAddFilter = jest.fn();
      render(<FilterPanel {...defaultProps} onAddFilter={mockAddFilter} />);

      const addFilterButton = screen.getByRole('button', { name: /add filter/i });
      await userEvent.click(addFilterButton);

      // Select field
      const fieldSelect = screen.getByRole('combobox', { name: /field/i });
      await userEvent.selectOptions(fieldSelect, 'category');

      // Select operator
      const operatorSelect = screen.getByRole('combobox', { name: /operator/i });
      await userEvent.selectOptions(operatorSelect, 'eq');

      // Select value
      const valueSelect = screen.getByRole('combobox', { name: /value/i });
      await userEvent.selectOptions(valueSelect, 'VSAM');

      // Apply filter
      const applyButton = screen.getByRole('button', { name: /apply filter/i });
      await userEvent.click(applyButton);

      expect(mockAddFilter).toHaveBeenCalledWith({
        field: 'category',
        operator: 'eq',
        value: 'VSAM'
      });
    });

    it('should create multi-select filter', async () => {
      const mockAddFilter = jest.fn();
      render(<FilterPanel {...defaultProps} onAddFilter={mockAddFilter} />);

      const addFilterButton = screen.getByRole('button', { name: /add filter/i });
      await userEvent.click(addFilterButton);

      // Select field
      const fieldSelect = screen.getByRole('combobox', { name: /field/i });
      await userEvent.selectOptions(fieldSelect, 'category');

      // Select IN operator
      const operatorSelect = screen.getByRole('combobox', { name: /operator/i });
      await userEvent.selectOptions(operatorSelect, 'in');

      // Select multiple values
      const valueContainer = screen.getByTestId('multiselect-value-container');
      const vsamOption = within(valueContainer).getByRole('checkbox', { name: /vsam/i });
      const jclOption = within(valueContainer).getByRole('checkbox', { name: /jcl/i });

      await userEvent.click(vsamOption);
      await userEvent.click(jclOption);

      // Apply filter
      const applyButton = screen.getByRole('button', { name: /apply filter/i });
      await userEvent.click(applyButton);

      expect(mockAddFilter).toHaveBeenCalledWith({
        field: 'category',
        operator: 'in',
        value: ['VSAM', 'JCL']
      });
    });

    it('should create date range filter', async () => {
      const mockAddFilter = jest.fn();
      render(<FilterPanel {...defaultProps} onAddFilter={mockAddFilter} />);

      const addFilterButton = screen.getByRole('button', { name: /add filter/i });
      await userEvent.click(addFilterButton);

      // Select date field
      const fieldSelect = screen.getByRole('combobox', { name: /field/i });
      await userEvent.selectOptions(fieldSelect, 'created_at');

      // Select between operator
      const operatorSelect = screen.getByRole('combobox', { name: /operator/i });
      await userEvent.selectOptions(operatorSelect, 'between');

      // Set date range
      const startDateInput = screen.getByLabelText(/start date/i);
      const endDateInput = screen.getByLabelText(/end date/i);

      await userEvent.type(startDateInput, '2024-01-01');
      await userEvent.type(endDateInput, '2024-12-31');

      // Apply filter
      const applyButton = screen.getByRole('button', { name: /apply filter/i });
      await userEvent.click(applyButton);

      expect(mockAddFilter).toHaveBeenCalledWith({
        field: 'created_at',
        operator: 'between',
        value: ['2024-01-01', '2024-12-31']
      });
    });

    it('should create numeric range filter', async () => {
      const mockAddFilter = jest.fn();
      render(<FilterPanel {...defaultProps} onAddFilter={mockAddFilter} />);

      const addFilterButton = screen.getByRole('button', { name: /add filter/i });
      await userEvent.click(addFilterButton);

      // Select numeric field
      const fieldSelect = screen.getByRole('combobox', { name: /field/i });
      await userEvent.selectOptions(fieldSelect, 'usage_count');

      // Select range operator
      const operatorSelect = screen.getByRole('combobox', { name: /operator/i });
      await userEvent.selectOptions(operatorSelect, 'between');

      // Set numeric range using slider
      const rangeSlider = screen.getByTestId('range-slider');
      const leftHandle = within(rangeSlider).getByTestId('left-handle');
      const rightHandle = within(rangeSlider).getByTestId('right-handle');

      // Simulate slider interactions
      fireEvent.mouseDown(leftHandle);
      fireEvent.mouseMove(leftHandle, { clientX: 100 });
      fireEvent.mouseUp(leftHandle);

      fireEvent.mouseDown(rightHandle);
      fireEvent.mouseMove(rightHandle, { clientX: 200 });
      fireEvent.mouseUp(rightHandle);

      // Apply filter
      const applyButton = screen.getByRole('button', { name: /apply filter/i });
      await userEvent.click(applyButton);

      expect(mockAddFilter).toHaveBeenCalledWith({
        field: 'usage_count',
        operator: 'between',
        value: [10, 50] // Approximate values based on slider position
      });
    });

    it('should validate filter inputs before creation', async () => {
      render(<FilterPanel {...defaultProps} />);

      const addFilterButton = screen.getByRole('button', { name: /add filter/i });
      await userEvent.click(addFilterButton);

      // Try to apply without selecting field
      const applyButton = screen.getByRole('button', { name: /apply filter/i });
      await userEvent.click(applyButton);

      expect(screen.getByText(/please select a field/i)).toBeInTheDocument();
      expect(screen.getByTestId('filter-creation-dialog')).toBeInTheDocument(); // Dialog stays open
    });

    it('should cancel filter creation', async () => {
      render(<FilterPanel {...defaultProps} />);

      const addFilterButton = screen.getByRole('button', { name: /add filter/i });
      await userEvent.click(addFilterButton);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      expect(screen.queryByTestId('filter-creation-dialog')).not.toBeInTheDocument();
    });
  });

  // =========================
  // ACTIVE FILTERS MANAGEMENT
  // =========================

  describe('Active Filters Management', () => {
    const activeFilters: ActiveFilter[] = [
      {
        id: 'filter1',
        field: 'category',
        operator: 'eq',
        value: 'VSAM',
        label: 'Category equals VSAM',
        removable: true
      },
      {
        id: 'filter2',
        field: 'usage_count',
        operator: 'gte',
        value: 10,
        label: 'Usage Count ≥ 10',
        removable: true
      },
      {
        id: 'filter3',
        field: 'created_at',
        operator: 'between',
        value: ['2024-01-01', '2024-12-31'],
        label: 'Created in 2024',
        removable: false // System filter
      }
    ];

    it('should display all active filters', () => {
      render(<FilterPanel {...defaultProps} activeFilters={activeFilters} />);

      expect(screen.getByText('Category equals VSAM')).toBeInTheDocument();
      expect(screen.getByText('Usage Count ≥ 10')).toBeInTheDocument();
      expect(screen.getByText('Created in 2024')).toBeInTheDocument();
    });

    it('should remove individual filters', async () => {
      const mockRemoveFilter = jest.fn();
      render(<FilterPanel {...defaultProps} activeFilters={activeFilters} onRemoveFilter={mockRemoveFilter} />);

      const removeButton = screen.getByRole('button', { name: /remove category equals vsam filter/i });
      await userEvent.click(removeButton);

      expect(mockRemoveFilter).toHaveBeenCalledWith('filter1');
    });

    it('should not show remove button for non-removable filters', () => {
      render(<FilterPanel {...defaultProps} activeFilters={activeFilters} />);

      // Removable filters should have remove buttons
      expect(screen.getByRole('button', { name: /remove category equals vsam filter/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /remove usage count ≥ 10 filter/i })).toBeInTheDocument();

      // Non-removable filter should not have remove button
      expect(screen.queryByRole('button', { name: /remove created in 2024 filter/i })).not.toBeInTheDocument();
    });

    it('should clear all removable filters', async () => {
      const mockClearFilters = jest.fn();
      render(<FilterPanel {...defaultProps} activeFilters={activeFilters} onClearFilters={mockClearFilters} />);

      const clearAllButton = screen.getByRole('button', { name: /clear all filters/i });
      await userEvent.click(clearAllButton);

      expect(mockClearFilters).toHaveBeenCalledTimes(1);
    });

    it('should show filter count badge', () => {
      render(<FilterPanel {...defaultProps} activeFilters={activeFilters} />);

      expect(screen.getByText('3 filters applied')).toBeInTheDocument();
      expect(screen.getByTestId('filter-count-badge')).toBeInTheDocument();
    });

    it('should edit existing filters', async () => {
      const mockUpdateFilter = jest.fn();
      render(<FilterPanel {...defaultProps} activeFilters={activeFilters} onUpdateFilter={mockUpdateFilter} />);

      const editButton = screen.getByRole('button', { name: /edit category equals vsam filter/i });
      await userEvent.click(editButton);

      expect(screen.getByTestId('filter-edit-dialog')).toBeInTheDocument();

      // Change operator
      const operatorSelect = screen.getByRole('combobox', { name: /operator/i });
      await userEvent.selectOptions(operatorSelect, 'ne');

      // Update filter
      const updateButton = screen.getByRole('button', { name: /update filter/i });
      await userEvent.click(updateButton);

      expect(mockUpdateFilter).toHaveBeenCalledWith('filter1', {
        field: 'category',
        operator: 'ne',
        value: 'VSAM'
      });
    });
  });

  // =========================
  // SEARCH AND FILTERING
  // =========================

  describe('Filter Search and Organization', () => {
    it('should search available filters', async () => {
      render(<FilterPanel {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search filters/i);
      await userEvent.type(searchInput, 'category');

      // Should show only category-related options
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.queryByText('Usage Count')).not.toBeInTheDocument();
    });

    it('should group filters by category', () => {
      const groupedFilterOptions = [
        ...mockFilterOptions,
        {
          field: 'tags',
          label: 'Tags',
          type: 'multiselect' as const,
          options: [
            { value: 'error', label: 'Error', count: 20 },
            { value: 'fix', label: 'Fix', count: 15 }
          ]
        }
      ];

      render(<FilterPanel {...defaultProps} filterOptions={groupedFilterOptions} />);

      expect(screen.getByRole('group', { name: /content filters/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /metadata filters/i })).toBeInTheDocument();
    });

    it('should show recently used filters', () => {
      const recentFilters = [
        { field: 'category', operator: 'eq', value: 'VSAM', label: 'Category: VSAM', count: 5 },
        { field: 'severity', operator: 'eq', value: 'high', label: 'Severity: High', count: 3 }
      ];

      render(<FilterPanel {...defaultProps} recentFilters={recentFilters} />);

      expect(screen.getByRole('group', { name: /recently used/i })).toBeInTheDocument();
      expect(screen.getByText('Category: VSAM (used 5 times)')).toBeInTheDocument();
    });

    it('should suggest filters based on context', () => {
      render(<FilterPanel {...defaultProps} />);

      // Should show suggestions based on current data
      expect(screen.getByTestId('filter-suggestions')).toBeInTheDocument();
      expect(screen.getByText(/try filtering by category for better results/i)).toBeInTheDocument();
    });
  });

  // =========================
  // PERFORMANCE AND UX
  // =========================

  describe('Performance and User Experience', () => {
    it('should debounce filter search input', async () => {
      jest.useFakeTimers();
      const mockSearchFilters = jest.fn();

      render(<FilterPanel {...defaultProps} onSearchFilters={mockSearchFilters} />);

      const searchInput = screen.getByPlaceholderText(/search filters/i);
      await userEvent.type(searchInput, 'quick search');

      // Should not search immediately
      expect(mockSearchFilters).not.toHaveBeenCalled();

      // Advance timers
      jest.advanceTimersByTime(300);

      expect(mockSearchFilters).toHaveBeenCalledWith('quick search');

      jest.useRealTimers();
    });

    it('should lazy load filter options', async () => {
      const LazyFilterPanel = (props: any) => {
        const [loading, setLoading] = React.useState(true);

        React.useEffect(() => {
          const timer = setTimeout(() => setLoading(false), 100);
          return () => clearTimeout(timer);
        }, []);

        if (loading) {
          return <div data-testid="filter-options-loading">Loading filters...</div>;
        }

        return <FilterPanel {...props} />;
      };

      render(<LazyFilterPanel {...defaultProps} />);

      expect(screen.getByTestId('filter-options-loading')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByTestId('filter-options-loading')).not.toBeInTheDocument();
        expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
      });
    });

    it('should handle large numbers of filter options efficiently', () => {
      const largeFilterOptions = Array.from({ length: 100 }, (_, i) => ({
        field: `field_${i}`,
        label: `Field ${i}`,
        type: 'select' as const,
        options: Array.from({ length: 50 }, (_, j) => ({
          value: `value_${j}`,
          label: `Value ${j}`,
          count: Math.floor(Math.random() * 20)
        }))
      }));

      const startTime = performance.now();
      render(<FilterPanel {...defaultProps} filterOptions={largeFilterOptions} />);
      const renderTime = performance.now() - startTime;

      expect(renderTime).toBeLessThan(500); // Should render efficiently
      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
    });

    it('should virtualize large filter option lists', () => {
      const largeOptions = Array.from({ length: 1000 }, (_, i) => ({
        value: `option_${i}`,
        label: `Option ${i}`,
        count: i
      }));

      const largeFilterOption: FilterOption = {
        field: 'large_field',
        label: 'Large Field',
        type: 'multiselect',
        options: largeOptions
      };

      render(<FilterPanel {...defaultProps} filterOptions={[largeFilterOption]} />);

      const addFilterButton = screen.getByRole('button', { name: /add filter/i });
      fireEvent.click(addFilterButton);

      const fieldSelect = screen.getByRole('combobox', { name: /field/i });
      fireEvent.change(fieldSelect, { target: { value: 'large_field' } });

      // Should use virtualized list for large option sets
      expect(screen.getByTestId('virtualized-option-list')).toBeInTheDocument();
    });
  });

  // =========================
  // ACCESSIBILITY TESTS
  // =========================

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<FilterPanel {...defaultProps} />);

      expect(screen.getByRole('region', { name: /filters/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /quick filters/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /advanced filters/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(<FilterPanel {...defaultProps} />);

      const firstQuickFilter = screen.getByRole('button', { name: /recently added/i });
      const addFilterButton = screen.getByRole('button', { name: /add filter/i });

      // Tab navigation
      firstQuickFilter.focus();
      expect(firstQuickFilter).toHaveFocus();

      await userEvent.tab();
      expect(screen.getByRole('button', { name: /most popular/i })).toHaveFocus();

      // Skip to advanced filters with keyboard shortcut
      await userEvent.keyboard('{Alt>}f{/Alt}');
      expect(addFilterButton).toHaveFocus();
    });

    it('should announce filter changes to screen readers', async () => {
      render(<FilterPanel {...defaultProps} />);

      const liveRegion = screen.getByRole('status', { name: /filter changes/i });

      const recentFilter = screen.getByRole('button', { name: /recently added/i });
      await userEvent.click(recentFilter);

      await waitFor(() => {
        expect(liveRegion).toHaveTextContent(/recently added filter applied/i);
      });
    });

    it('should have proper focus management in dialogs', async () => {
      render(<FilterPanel {...defaultProps} />);

      const addFilterButton = screen.getByRole('button', { name: /add filter/i });
      await userEvent.click(addFilterButton);

      // Focus should be trapped in dialog
      const dialog = screen.getByTestId('filter-creation-dialog');
      const fieldSelect = within(dialog).getByRole('combobox', { name: /field/i });

      expect(fieldSelect).toHaveFocus();

      // Tab should cycle within dialog
      await userEvent.tab();
      expect(within(dialog).getByRole('combobox', { name: /operator/i })).toHaveFocus();

      // Escape should close dialog and return focus
      await userEvent.keyboard('{Escape}');
      expect(addFilterButton).toHaveFocus();
      expect(screen.queryByTestId('filter-creation-dialog')).not.toBeInTheDocument();
    });

    it('should provide clear labels for complex filters', () => {
      const complexActiveFilters: ActiveFilter[] = [
        {
          id: 'filter1',
          field: 'created_at',
          operator: 'between',
          value: ['2024-01-01', '2024-12-31'],
          label: 'Created Date between January 1, 2024 and December 31, 2024',
          removable: true
        }
      ];

      render(<FilterPanel {...defaultProps} activeFilters={complexActiveFilters} />);

      const filterTag = screen.getByRole('button', { name: /created date between january 1, 2024 and december 31, 2024/i });
      expect(filterTag).toHaveAttribute('aria-label', expect.stringContaining('Created Date between'));
    });
  });

  // =========================
  // ERROR HANDLING
  // =========================

  describe('Error Handling', () => {
    it('should handle missing filter options gracefully', () => {
      render(<FilterPanel {...defaultProps} filterOptions={[]} />);

      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
      expect(screen.getByText(/no filter options available/i)).toBeInTheDocument();
    });

    it('should handle invalid filter configurations', () => {
      const invalidFilterOptions = [
        {
          field: 'invalid_field',
          label: 'Invalid Field',
          type: 'unknown_type' as any,
          options: []
        }
      ];

      render(<FilterPanel {...defaultProps} filterOptions={invalidFilterOptions} />);

      // Should not crash and show appropriate message
      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
    });

    it('should recover from filter application errors', async () => {
      const mockAddFilter = jest.fn().mockRejectedValue(new Error('Filter validation failed'));
      render(<FilterPanel {...defaultProps} onAddFilter={mockAddFilter} />);

      const addFilterButton = screen.getByRole('button', { name: /add filter/i });
      await userEvent.click(addFilterButton);

      // Create a valid filter
      const fieldSelect = screen.getByRole('combobox', { name: /field/i });
      await userEvent.selectOptions(fieldSelect, 'category');

      const operatorSelect = screen.getByRole('combobox', { name: /operator/i });
      await userEvent.selectOptions(operatorSelect, 'eq');

      const valueSelect = screen.getByRole('combobox', { name: /value/i });
      await userEvent.selectOptions(valueSelect, 'VSAM');

      const applyButton = screen.getByRole('button', { name: /apply filter/i });
      await userEvent.click(applyButton);

      await waitFor(() => {
        expect(screen.getByText(/filter validation failed/i)).toBeInTheDocument();
      });

      // Dialog should remain open for correction
      expect(screen.getByTestId('filter-creation-dialog')).toBeInTheDocument();
    });
  });
});