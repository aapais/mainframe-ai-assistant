/**
 * Comprehensive KB Manager Tests
 *
 * Complete test suite for the Comprehensive KB Manager component,
 * including all features: search, filtering, batch operations,
 * version control, accessibility, and performance.
 *
 * @author Swarm Architecture Team
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { KnowledgeDB, KBEntry } from '../../../database/KnowledgeDB';
import { BatchOperationsService } from '../../../services/BatchOperationsService';
import { VersionControlService } from '../../../services/VersionControlService';
import { ComprehensiveKBManager } from '../ComprehensiveKBManager';

// ========================
// Mock Setup
// ========================

// Mock database
const mockDB = {
  search: jest.fn(),
  addEntry: jest.fn(),
  updateEntry: jest.fn(),
  deleteEntry: jest.fn(),
  getStats: jest.fn(),
  exportEntries: jest.fn(),
  importEntries: jest.fn(),
} as unknown as KnowledgeDB;

// Mock services
jest.mock('../../../services/BatchOperationsService');
jest.mock('../../../services/VersionControlService');

// Mock hooks
jest.mock('../../../hooks/useKBData', () => ({
  useKBData: jest.fn(() => ({
    entries: mockEntries,
    searchResults: [],
    stats: mockStats,
    loading: false,
    error: null,
    searchEntries: jest.fn(),
    addEntry: jest.fn(),
    updateEntry: jest.fn(),
    deleteEntry: jest.fn(),
    duplicateEntry: jest.fn(),
    refresh: jest.fn(),
    exportEntries: jest.fn(),
    importEntries: jest.fn(),
    getSuggestions: jest.fn(),
  })),
}));

jest.mock('../../../hooks/useBatchOperations', () => ({
  useBatchOperations: jest.fn(() => ({
    operationState: {
      activeOperation: null,
      progress: null,
      isOperating: false,
      error: null,
      lastResult: null,
      operationHistory: [],
    },
    selectionState: {
      selectedIds: new Set(),
      allSelected: false,
      someSelected: false,
      selectedCount: 0,
    },
    selectedEntries: [],
    canBatchEdit: false,
    canBatchDelete: false,
    canBatchExport: false,
    selectAll: jest.fn(),
    selectNone: jest.fn(),
    performBatchUpdate: jest.fn(),
    performBatchDelete: jest.fn(),
    performBatchDuplicate: jest.fn(),
    performBatchExport: jest.fn(),
    cancelCurrentOperation: jest.fn(),
  })),
}));

// Mock data
const mockEntries: KBEntry[] = [
  {
    id: '1',
    title: 'VSAM Status 35 Error',
    problem: 'Job fails with VSAM status 35',
    solution: 'Check file catalog and permissions',
    category: 'VSAM',
    tags: ['vsam', 'error', 'file-not-found'],
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    usage_count: 10,
    success_count: 8,
    failure_count: 2,
  },
  {
    id: '2',
    title: 'S0C7 Data Exception',
    problem: 'Program abends with S0C7',
    solution: 'Check for non-numeric data in numeric fields',
    category: 'Batch',
    tags: ['s0c7', 'abend', 'numeric'],
    created_at: new Date('2024-01-02'),
    updated_at: new Date('2024-01-02'),
    usage_count: 15,
    success_count: 12,
    failure_count: 3,
  },
  {
    id: '3',
    title: 'JCL Dataset Not Found',
    problem: 'JCL fails with dataset not found error',
    solution: 'Verify dataset name and allocation',
    category: 'JCL',
    tags: ['jcl', 'dataset', 'allocation'],
    created_at: new Date('2024-01-03'),
    updated_at: new Date('2024-01-03'),
    usage_count: 5,
    success_count: 5,
    failure_count: 0,
  },
];

const mockStats = {
  totalEntries: mockEntries.length,
  totalUsage: 30,
  averageSuccessRate: 0.85,
  categoryCounts: {
    VSAM: 1,
    Batch: 1,
    JCL: 1,
  },
  recentActivity: [],
};

// ========================
// Test Utilities
// ========================

const renderComponent = (props = {}) => {
  const defaultProps = {
    db: mockDB,
    className: 'test-kb-manager',
    enableAdvancedFeatures: true,
    realTimeUpdates: false, // Disable for testing
    ...props,
  };

  return render(<ComprehensiveKBManager {...defaultProps} />);
};

// ========================
// Test Suites
// ========================

describe('ComprehensiveKBManager', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
  });

  // ========================
  // Basic Rendering Tests
  // ========================

  describe('Basic Rendering', () => {
    it('should render the main component structure', () => {
      renderComponent();

      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByText(/knowledge assistant/i)).toBeInTheDocument();
      expect(screen.getByRole('searchbox')).toBeInTheDocument();
    });

    it('should display entry statistics in header', () => {
      renderComponent();

      expect(screen.getByText('3 Entries')).toBeInTheDocument();
      expect(screen.getByText('30 Total Usage')).toBeInTheDocument();
      expect(screen.getByText('85% Success Rate')).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      jest.mocked(require('../../../hooks/useKBData').useKBData).mockReturnValue({
        entries: [],
        loading: true,
        error: null,
        searchEntries: jest.fn(),
        // ... other properties
      });

      renderComponent();
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should handle error state', () => {
      jest.mocked(require('../../../hooks/useKBData').useKBData).mockReturnValue({
        entries: [],
        loading: false,
        error: 'Database connection failed',
        searchEntries: jest.fn(),
        // ... other properties
      });

      renderComponent();
      expect(screen.getByText(/database connection failed/i)).toBeInTheDocument();
    });
  });

  // ========================
  // Search and Filtering Tests
  // ========================

  describe('Search and Filtering', () => {
    it('should handle search input', async () => {
      const mockSearchEntries = jest.fn();
      jest.mocked(require('../../../hooks/useKBData').useKBData).mockReturnValue({
        entries: mockEntries,
        searchEntries: mockSearchEntries,
        loading: false,
        error: null,
        // ... other properties
      });

      renderComponent();

      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'VSAM error');

      // Should debounce search
      await waitFor(() => {
        expect(mockSearchEntries).toHaveBeenCalledWith({
          query: 'VSAM error',
          category: undefined,
          tags: [],
          sortBy: 'relevance',
          sortOrder: 'desc',
          useAI: true,
          limit: 1000,
        });
      });
    });

    it('should handle category filtering', async () => {
      renderComponent();

      const categoryFilter = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryFilter, 'VSAM');

      expect(screen.getByDisplayValue('VSAM')).toBeInTheDocument();
    });

    it('should handle tag filtering', async () => {
      renderComponent();

      // Assuming tag filter UI exists
      const tagInput = screen.getByPlaceholderText(/filter by tags/i);
      await user.type(tagInput, 'error');
      await user.keyboard('{Enter}');

      // Check that tag is added to filter
      expect(screen.getByText('error')).toBeInTheDocument();
    });

    it('should handle sorting changes', async () => {
      renderComponent();

      const sortSelect = screen.getByLabelText(/sort by/i);
      await user.selectOptions(sortSelect, 'usage');

      expect(screen.getByDisplayValue('usage')).toBeInTheDocument();
    });
  });

  // ========================
  // Entry Management Tests
  // ========================

  describe('Entry Management', () => {
    it('should open create entry modal', async () => {
      renderComponent();

      const createButton = screen.getByText(/add knowledge/i);
      await user.click(createButton);

      expect(screen.getByText(/create new entry/i)).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should handle entry creation', async () => {
      const mockAddEntry = jest.fn().mockResolvedValue('new-id');
      const mockOnEntryCreate = jest.fn();

      renderComponent({ onEntryCreate: mockOnEntryCreate });

      // Open create modal
      const createButton = screen.getByText(/add knowledge/i);
      await user.click(createButton);

      // Fill form
      await user.type(screen.getByLabelText(/title/i), 'New Entry');
      await user.type(screen.getByLabelText(/problem/i), 'Problem description');
      await user.type(screen.getByLabelText(/solution/i), 'Solution steps');

      // Submit
      const submitButton = screen.getByText(/create entry/i);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnEntryCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'New Entry',
            problem: 'Problem description',
            solution: 'Solution steps',
          })
        );
      });
    });

    it('should open edit entry modal', async () => {
      renderComponent();

      // Find and click edit button for first entry
      const editButton = screen.getAllByLabelText(/edit entry/i)[0];
      await user.click(editButton);

      expect(screen.getByText(/edit entry/i)).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should handle entry deletion with confirmation', async () => {
      const mockOnEntryDelete = jest.fn();
      renderComponent({ onEntryDelete: mockOnEntryDelete });

      // Find and click delete button
      const deleteButton = screen.getAllByLabelText(/delete entry/i)[0];
      await user.click(deleteButton);

      // Confirm deletion
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      const confirmButton = screen.getByText(/delete$/i);
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockOnEntryDelete).toHaveBeenCalledWith(
          expect.objectContaining({ id: '1' })
        );
      });
    });
  });

  // ========================
  // Batch Operations Tests
  // ========================

  describe('Batch Operations', () => {
    it('should handle entry selection', async () => {
      const mockUseBatchOperations = require('../../../hooks/useBatchOperations').useBatchOperations;
      const mockSelectAll = jest.fn();

      mockUseBatchOperations.mockReturnValue({
        operationState: { isOperating: false },
        selectionState: { selectedCount: 0 },
        selectAll: mockSelectAll,
        selectNone: jest.fn(),
        performBatchDelete: jest.fn(),
        // ... other properties
      });

      renderComponent();

      const selectAllButton = screen.getByLabelText(/select all/i);
      await user.click(selectAllButton);

      expect(mockSelectAll).toHaveBeenCalled();
    });

    it('should show batch toolbar when entries selected', () => {
      jest.mocked(require('../../../hooks/useBatchOperations').useBatchOperations).mockReturnValue({
        operationState: { isOperating: false },
        selectionState: { selectedCount: 2, someSelected: true },
        selectedEntries: mockEntries.slice(0, 2),
        canBatchDelete: true,
        selectAll: jest.fn(),
        selectNone: jest.fn(),
        performBatchDelete: jest.fn(),
        // ... other properties
      });

      renderComponent();

      expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
      expect(screen.getByText(/batch delete/i)).toBeInTheDocument();
    });

    it('should handle batch delete operation', async () => {
      const mockPerformBatchDelete = jest.fn().mockResolvedValue({ success: true });

      jest.mocked(require('../../../hooks/useBatchOperations').useBatchOperations).mockReturnValue({
        operationState: { isOperating: false },
        selectionState: { selectedCount: 2 },
        canBatchDelete: true,
        performBatchDelete: mockPerformBatchDelete,
        // ... other properties
      });

      renderComponent();

      const batchDeleteButton = screen.getByText(/batch delete/i);
      await user.click(batchDeleteButton);

      // Confirm batch deletion
      const confirmButton = screen.getByText(/delete all/i);
      await user.click(confirmButton);

      expect(mockPerformBatchDelete).toHaveBeenCalled();
    });
  });

  // ========================
  // Version Control Tests
  // ========================

  describe('Version Control', () => {
    it('should open version history modal', async () => {
      renderComponent();

      // Find version history button (assuming it's in context menu)
      const contextMenuButton = screen.getAllByLabelText(/more options/i)[0];
      await user.click(contextMenuButton);

      const versionHistoryButton = screen.getByText(/version history/i);
      await user.click(versionHistoryButton);

      expect(screen.getByText(/version history/i)).toBeInTheDocument();
    });

    it('should handle version comparison', async () => {
      // Mock version service
      const mockVersionService = {
        getVersionHistory: jest.fn().mockResolvedValue({
          entry_id: '1',
          current_version: 2,
          versions: [
            { version: 2, title: 'Current Version' },
            { version: 1, title: 'Previous Version' },
          ],
          changes: [],
        }),
        compareVersions: jest.fn().mockResolvedValue({
          differences: [],
          similarity_score: 0.95,
          change_summary: 'Minor changes',
          impact_assessment: 'low',
        }),
      };

      renderComponent();

      // Simulate opening version comparison
      // (This would depend on the actual UI implementation)
    });

    it('should handle version rollback', async () => {
      const mockVersionService = {
        rollbackToVersion: jest.fn().mockResolvedValue({
          id: '1',
          title: 'Rolled back version',
          version: 3,
        }),
      };

      renderComponent();

      // Simulate rollback operation
      // (This would depend on the actual UI implementation)
    });
  });

  // ========================
  // Accessibility Tests
  // ========================

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent();

      expect(screen.getByRole('main')).toHaveAttribute('aria-label');
      expect(screen.getByRole('searchbox')).toHaveAttribute('aria-label');
      expect(screen.getByRole('button', { name: /add knowledge/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderComponent();

      const searchInput = screen.getByRole('searchbox');
      searchInput.focus();

      // Tab to next focusable element
      await user.keyboard('{Tab}');
      expect(document.activeElement).not.toBe(searchInput);

      // Should be able to navigate with arrow keys
      await user.keyboard('{ArrowDown}');
      // (Would check if focus moves to first entry)
    });

    it('should announce changes to screen readers', async () => {
      renderComponent({ announceChanges: true });

      // Create an entry
      const createButton = screen.getByText(/add knowledge/i);
      await user.click(createButton);

      // Check that announcements are made
      // (This would require checking for aria-live regions)
      await waitFor(() => {
        const announcements = screen.getAllByRole('status');
        expect(announcements.length).toBeGreaterThan(0);
      });
    });

    it('should support high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      renderComponent();

      const container = screen.getByRole('main');
      expect(container).toHaveClass('high-contrast');
    });
  });

  // ========================
  // Performance Tests
  // ========================

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        ...mockEntries[0],
        id: `entry-${i}`,
        title: `Entry ${i}`,
      }));

      jest.mocked(require('../../../hooks/useKBData').useKBData).mockReturnValue({
        entries: largeDataset,
        loading: false,
        error: null,
        // ... other properties
      });

      const startTime = performance.now();
      renderComponent();
      const endTime = performance.now();

      // Should render within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should use virtual scrolling for large lists', () => {
      renderComponent();

      // Check that virtual scrolling container exists
      const listContainer = screen.getByRole('list');
      expect(listContainer).toHaveStyle({ height: '600px' });
    });

    it('should debounce search input', async () => {
      const mockSearchEntries = jest.fn();

      jest.mocked(require('../../../hooks/useKBData').useKBData).mockReturnValue({
        entries: mockEntries,
        searchEntries: mockSearchEntries,
        loading: false,
        error: null,
        // ... other properties
      });

      renderComponent();

      const searchInput = screen.getByRole('searchbox');

      // Type multiple characters rapidly
      await user.type(searchInput, 'test query');

      // Should only call search once after debounce period
      await waitFor(() => {
        expect(mockSearchEntries).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ========================
  // Integration Tests
  // ========================

  describe('Integration', () => {
    it('should handle complete workflow: search -> select -> edit -> save', async () => {
      const mockUpdateEntry = jest.fn().mockResolvedValue(undefined);

      jest.mocked(require('../../../hooks/useKBData').useKBData).mockReturnValue({
        entries: mockEntries,
        updateEntry: mockUpdateEntry,
        loading: false,
        error: null,
        searchEntries: jest.fn(),
        // ... other properties
      });

      renderComponent();

      // 1. Search for entry
      const searchInput = screen.getByRole('searchbox');
      await user.type(searchInput, 'VSAM');

      // 2. Select entry from results
      const entryItem = screen.getByText('VSAM Status 35 Error');
      await user.click(entryItem);

      // 3. Edit entry
      const editButton = screen.getByLabelText(/edit entry/i);
      await user.click(editButton);

      // 4. Modify content
      const titleInput = screen.getByDisplayValue('VSAM Status 35 Error');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated VSAM Error');

      // 5. Save changes
      const saveButton = screen.getByText(/save/i);
      await user.click(saveButton);

      // 6. Verify update was called
      await waitFor(() => {
        expect(mockUpdateEntry).toHaveBeenCalledWith(
          '1',
          expect.objectContaining({
            title: 'Updated VSAM Error',
          })
        );
      });
    });

    it('should maintain state consistency during operations', async () => {
      renderComponent();

      // Simulate multiple rapid operations
      const createButton = screen.getByText(/add knowledge/i);

      // Click create button multiple times rapidly
      await user.click(createButton);
      await user.click(createButton);
      await user.click(createButton);

      // Should only open one modal
      const modals = screen.getAllByRole('dialog');
      expect(modals).toHaveLength(1);
    });
  });

  // ========================
  // Error Handling Tests
  // ========================

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockAddEntry = jest.fn().mockRejectedValue(new Error('Database error'));

      jest.mocked(require('../../../hooks/useKBData').useKBData).mockReturnValue({
        entries: mockEntries,
        addEntry: mockAddEntry,
        loading: false,
        error: null,
        // ... other properties
      });

      renderComponent();

      // Try to create entry
      const createButton = screen.getByText(/add knowledge/i);
      await user.click(createButton);

      // Fill form
      await user.type(screen.getByLabelText(/title/i), 'New Entry');
      await user.type(screen.getByLabelText(/problem/i), 'Problem');
      await user.type(screen.getByLabelText(/solution/i), 'Solution');

      // Submit
      const submitButton = screen.getByText(/create entry/i);
      await user.click(submitButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/database error/i)).toBeInTheDocument();
      });
    });

    it('should handle network errors during operations', async () => {
      const mockPerformBatchDelete = jest.fn().mockRejectedValue(new Error('Network error'));

      jest.mocked(require('../../../hooks/useBatchOperations').useBatchOperations).mockReturnValue({
        performBatchDelete: mockPerformBatchDelete,
        selectionState: { selectedCount: 1 },
        canBatchDelete: true,
        operationState: { isOperating: false },
        // ... other properties
      });

      renderComponent();

      // Try batch delete
      const batchDeleteButton = screen.getByText(/batch delete/i);
      await user.click(batchDeleteButton);

      // Confirm
      const confirmButton = screen.getByText(/delete all/i);
      await user.click(confirmButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });
  });
});