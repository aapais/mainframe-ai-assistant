/**
 * KB Entry Management Integration Tests
 * Comprehensive integration testing for all KB entry management components
 */

import React from 'react';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { AdvancedKBEntryList } from '../../../src/renderer/components/ui/AdvancedKBEntryList';
import { SmartSearchInterface } from '../../../src/renderer/components/ui/SmartSearchInterface';
import { BatchOperationsUI } from '../../../src/renderer/components/ui/BatchOperationsUI';
import { VersionControlUI } from '../../../src/renderer/components/ui/VersionControlUI';
import { EnhancedKnowledgeDBService } from '../../../src/services/EnhancedKnowledgeDBService';
import { BatchOperationsService } from '../../../src/services/BatchOperationsService';
import type { KBEntry } from '../../../src/types';

// Mock services
jest.mock('../../../src/services/EnhancedKnowledgeDBService');
jest.mock('../../../src/services/BatchOperationsService');
jest.mock('../../../src/services/SmartSearchService');
jest.mock('../../../src/services/VersionControlService');

const mockKBService = EnhancedKnowledgeDBService as jest.MockedClass<typeof EnhancedKnowledgeDBService>;
const mockBatchService = BatchOperationsService as jest.MockedClass<typeof BatchOperationsService>;

// Test data generators
const createMockKBEntry = (id: string = 'test-1', overrides = {}): KBEntry => ({
  id,
  title: `Test Entry ${id}`,
  problem: 'Test problem description that is detailed enough for testing purposes.',
  solution: 'Test solution with step-by-step instructions for testing.',
  category: 'VSAM',
  tags: ['test', 'mock'],
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  usage_count: 5,
  success_rate: 0.8,
  version: 1,
  status: 'active',
  created_by: 'test-user',
  ...overrides
});

const createMockEntries = (count: number): KBEntry[] =>
  Array.from({ length: count }, (_, i) => createMockKBEntry(`test-${i + 1}`, {
    title: `KB Entry ${i + 1}`,
    category: ['VSAM', 'JCL', 'DB2', 'Batch', 'Functional'][i % 5],
    usage_count: Math.floor(Math.random() * 100),
    success_rate: Math.random()
  }));

describe('KB Entry Management Integration Tests', () => {
  let mockService: jest.Mocked<EnhancedKnowledgeDBService>;
  let mockBatchServiceInstance: jest.Mocked<BatchOperationsService>;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    mockService = new mockKBService() as jest.Mocked<EnhancedKnowledgeDBService>;
    mockBatchServiceInstance = new mockBatchService() as jest.Mocked<BatchOperationsService>;

    // Default mock implementations
    mockService.getEntries.mockResolvedValue({
      data: createMockEntries(10),
      total: 10,
      hasMore: false
    });
    mockService.searchEntries.mockResolvedValue([]);
    mockService.getCategories.mockResolvedValue(['VSAM', 'JCL', 'DB2', 'Batch', 'Functional']);
    mockService.getTags.mockResolvedValue([]);
    mockService.getEntry.mockResolvedValue(createMockKBEntry());
    mockService.saveEntry.mockResolvedValue({ id: 'new-entry', success: true });
    mockService.deleteEntry.mockResolvedValue({ success: true });

    mockBatchServiceInstance.executeOperation.mockResolvedValue({
      success: true,
      results: [],
      summary: { total: 0, successful: 0, failed: 0 }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AdvancedKBEntryList Component', () => {
    const renderEntryList = (props = {}) => {
      const defaultProps = {
        entries: createMockEntries(20),
        onSelectEntry: jest.fn(),
        onEditEntry: jest.fn(),
        onDeleteEntry: jest.fn(),
        isLoading: false,
        selectedEntryId: null,
        ...props
      };
      return render(<AdvancedKBEntryList {...defaultProps} />);
    };

    it('renders list with virtual scrolling for large datasets', async () => {
      const entries = createMockEntries(1000);
      const { container } = renderEntryList({ entries });

      // Should render virtual container
      expect(screen.getByTestId('virtual-scroll-container')).toBeInTheDocument();

      // Should only render visible items initially
      const renderedItems = container.querySelectorAll('[data-testid^="kb-entry-item-"]');
      expect(renderedItems.length).toBeLessThan(1000); // Virtual scrolling active
      expect(renderedItems.length).toBeGreaterThan(0); // But some items rendered

      // Accessibility check
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('handles entry selection and keyboard navigation', async () => {
      const onSelectEntry = jest.fn();
      renderEntryList({ onSelectEntry });

      const firstEntry = screen.getByTestId('kb-entry-item-test-1');
      await user.click(firstEntry);

      expect(onSelectEntry).toHaveBeenCalledWith(expect.objectContaining({
        id: 'test-1'
      }));

      // Test keyboard navigation
      firstEntry.focus();
      await user.keyboard('{ArrowDown}');

      const secondEntry = screen.getByTestId('kb-entry-item-test-2');
      expect(secondEntry).toHaveFocus();
    });

    it('supports sorting and filtering operations', async () => {
      const { container } = renderEntryList();

      // Test sorting by usage count
      const sortButton = screen.getByRole('button', { name: /sort by usage/i });
      await user.click(sortButton);

      // Should trigger re-render with sorted data
      await waitFor(() => {
        const entries = container.querySelectorAll('[data-testid^="kb-entry-item-"]');
        expect(entries.length).toBeGreaterThan(0);
      });

      // Test category filter
      const filterButton = screen.getByRole('button', { name: /filter/i });
      await user.click(filterButton);

      const categoryFilter = screen.getByRole('combobox', { name: /category/i });
      await user.selectOptions(categoryFilter, 'VSAM');

      // Should update the displayed entries
      await waitFor(() => {
        expect(screen.getAllByText(/vsam/i).length).toBeGreaterThan(0);
      });
    });

    it('handles bulk selection for batch operations', async () => {
      const { container } = renderEntryList();

      // Enable bulk selection mode
      const bulkModeButton = screen.getByRole('button', { name: /bulk select/i });
      await user.click(bulkModeButton);

      // Select multiple entries
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      await user.click(checkboxes[1]); // First entry checkbox
      await user.click(checkboxes[2]); // Second entry checkbox

      // Should show batch operations bar
      expect(screen.getByTestId('batch-operations-bar')).toBeInTheDocument();
      expect(screen.getByText('2 items selected')).toBeInTheDocument();
    });

    it('maintains performance with large datasets', async () => {
      const startTime = performance.now();
      const entries = createMockEntries(2000);

      const { container } = renderEntryList({ entries });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render quickly even with large datasets
      expect(renderTime).toBeLessThan(500); // 500ms threshold

      // Virtual scrolling should limit DOM nodes
      const renderedItems = container.querySelectorAll('[data-testid^="kb-entry-item-"]');
      expect(renderedItems.length).toBeLessThan(100); // Should virtualize

      // Memory usage check
      const memoryUsage = process.memoryUsage();
      expect(memoryUsage.heapUsed).toBeLessThan(200 * 1024 * 1024); // 200MB limit
    });

    it('handles error states gracefully', async () => {
      const onError = jest.fn();
      renderEntryList({
        entries: [],
        error: 'Failed to load entries',
        onError
      });

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/failed to load entries/i)).toBeInTheDocument();

      // Should provide retry option
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('SmartSearchInterface Component', () => {
    const renderSearchInterface = (props = {}) => {
      const defaultProps = {
        onSearch: jest.fn(),
        onSuggestionSelect: jest.fn(),
        isLoading: false,
        aiEnabled: true,
        ...props
      };
      return render(<SmartSearchInterface {...defaultProps} />);
    };

    it('provides intelligent search suggestions', async () => {
      const onSearch = jest.fn();
      renderSearchInterface({ onSearch });

      const searchInput = screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, 'vsam status');

      // Should show AI-powered suggestions
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      const suggestion = screen.getByRole('option', { name: /vsam status 35/i });
      await user.click(suggestion);

      expect(onSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'vsam status 35',
          aiAssisted: true
        })
      );
    });

    it('handles AI service failures gracefully', async () => {
      const onSearch = jest.fn();
      renderSearchInterface({ onSearch, aiError: 'AI service unavailable' });

      const searchInput = screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, 'test query');
      await user.keyboard('{Enter}');

      // Should fallback to local search
      expect(onSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test query',
          aiAssisted: false
        })
      );

      // Should show AI unavailable indicator
      expect(screen.getByText(/ai search unavailable/i)).toBeInTheDocument();
    });

    it('supports advanced search filters', async () => {
      const onSearch = jest.fn();
      renderSearchInterface({ onSearch });

      // Open advanced filters
      const advancedButton = screen.getByRole('button', { name: /advanced/i });
      await user.click(advancedButton);

      // Set filters
      const categoryFilter = screen.getByRole('combobox', { name: /category/i });
      await user.selectOptions(categoryFilter, 'VSAM');

      const dateFromInput = screen.getByLabelText(/from date/i);
      await user.type(dateFromInput, '2024-01-01');

      const searchButton = screen.getByRole('button', { name: /search/i });
      await user.click(searchButton);

      expect(onSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: {
            category: 'VSAM',
            dateFrom: expect.any(Date)
          }
        })
      );
    });

    it('provides search history and recent queries', async () => {
      const onSearch = jest.fn();
      renderSearchInterface({
        onSearch,
        searchHistory: ['vsam status 35', 'jcl error', 'db2 deadlock']
      });

      const searchInput = screen.getByRole('textbox', { name: /search/i });
      await user.click(searchInput);

      // Should show search history
      expect(screen.getByText('Recent Searches')).toBeInTheDocument();
      expect(screen.getByText('vsam status 35')).toBeInTheDocument();
      expect(screen.getByText('jcl error')).toBeInTheDocument();

      // Should be able to select from history
      await user.click(screen.getByText('vsam status 35'));

      expect(onSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'vsam status 35'
        })
      );
    });

    it('maintains accessibility throughout search interactions', async () => {
      const { container } = renderSearchInterface();

      // Check initial accessibility
      let results = await axe(container);
      expect(results).toHaveNoViolations();

      // Check accessibility after opening suggestions
      const searchInput = screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, 'test');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      results = await axe(container);
      expect(results).toHaveNoViolations();

      // Check ARIA attributes
      expect(searchInput).toHaveAttribute('aria-expanded', 'true');
      expect(searchInput).toHaveAttribute('aria-haspopup', 'listbox');
    });
  });

  describe('BatchOperationsUI Component', () => {
    const renderBatchOperations = (props = {}) => {
      const defaultProps = {
        selectedItems: [],
        onOperationComplete: jest.fn(),
        onCancel: jest.fn(),
        batchService: mockBatchServiceInstance,
        ...props
      };
      return render(<BatchOperationsUI {...defaultProps} />);
    };

    it('executes bulk delete operations with confirmation', async () => {
      const selectedItems = createMockEntries(3);
      const onOperationComplete = jest.fn();

      renderBatchOperations({ selectedItems, onOperationComplete });

      const deleteButton = screen.getByRole('button', { name: /delete selected/i });
      await user.click(deleteButton);

      // Should show confirmation dialog
      const confirmDialog = screen.getByRole('dialog');
      expect(confirmDialog).toBeInTheDocument();
      expect(screen.getByText(/delete 3 entries/i)).toBeInTheDocument();

      const confirmButton = within(confirmDialog).getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Should execute batch operation
      await waitFor(() => {
        expect(mockBatchServiceInstance.executeOperation).toHaveBeenCalledWith(
          'delete',
          selectedItems.map(item => item.id)
        );
      });

      expect(onOperationComplete).toHaveBeenCalled();
    });

    it('handles bulk category updates', async () => {
      const selectedItems = createMockEntries(5);
      const onOperationComplete = jest.fn();

      renderBatchOperations({ selectedItems, onOperationComplete });

      const categoryButton = screen.getByRole('button', { name: /update category/i });
      await user.click(categoryButton);

      const categorySelect = screen.getByRole('combobox', { name: /new category/i });
      await user.selectOptions(categorySelect, 'DB2');

      const applyButton = screen.getByRole('button', { name: /apply/i });
      await user.click(applyButton);

      expect(mockBatchServiceInstance.executeOperation).toHaveBeenCalledWith(
        'updateCategory',
        selectedItems.map(item => item.id),
        { category: 'DB2' }
      );
    });

    it('provides progress tracking for long operations', async () => {
      const selectedItems = createMockEntries(50);

      // Mock progressive operation
      mockBatchServiceInstance.executeOperation.mockImplementation(async (operation, ids) => {
        // Simulate progress updates
        for (let i = 0; i < ids.length; i += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return {
          success: true,
          results: [],
          summary: { total: ids.length, successful: ids.length, failed: 0 }
        };
      });

      renderBatchOperations({ selectedItems });

      const deleteButton = screen.getByRole('button', { name: /delete selected/i });
      await user.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Should show progress bar
      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });

      // Should show completion
      await waitFor(() => {
        expect(screen.getByText(/operation completed/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('handles operation failures with detailed error reporting', async () => {
      const selectedItems = createMockEntries(3);

      mockBatchServiceInstance.executeOperation.mockResolvedValue({
        success: false,
        results: [
          { id: 'test-1', success: true },
          { id: 'test-2', success: false, error: 'Permission denied' },
          { id: 'test-3', success: false, error: 'Item not found' }
        ],
        summary: { total: 3, successful: 1, failed: 2 }
      });

      renderBatchOperations({ selectedItems });

      const deleteButton = screen.getByRole('button', { name: /delete selected/i });
      await user.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Should show error summary
      await waitFor(() => {
        expect(screen.getByText(/2 operations failed/i)).toBeInTheDocument();
        expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
        expect(screen.getByText(/item not found/i)).toBeInTheDocument();
      });

      // Should provide retry option for failed items
      const retryButton = screen.getByRole('button', { name: /retry failed/i });
      expect(retryButton).toBeInTheDocument();
    });
  });

  describe('VersionControlUI Component', () => {
    const renderVersionControl = (props = {}) => {
      const defaultProps = {
        entryId: 'test-1',
        currentVersion: 3,
        onVersionChange: jest.fn(),
        onRevert: jest.fn(),
        ...props
      };
      return render(<VersionControlUI {...defaultProps} />);
    };

    it('displays version history with diff visualization', async () => {
      const mockVersions = [
        { version: 3, created_at: new Date('2024-03-01'), created_by: 'user1', changes: ['Updated solution'] },
        { version: 2, created_at: new Date('2024-02-01'), created_by: 'user2', changes: ['Added tags'] },
        { version: 1, created_at: new Date('2024-01-01'), created_by: 'user1', changes: ['Initial creation'] }
      ];

      renderVersionControl({ versions: mockVersions });

      // Should show version history
      expect(screen.getByText('Version 3')).toBeInTheDocument();
      expect(screen.getByText('Version 2')).toBeInTheDocument();
      expect(screen.getByText('Version 1')).toBeInTheDocument();

      // Should show change summaries
      expect(screen.getByText('Updated solution')).toBeInTheDocument();
      expect(screen.getByText('Added tags')).toBeInTheDocument();

      // Click to view diff
      const viewDiffButton = screen.getByRole('button', { name: /view diff.*version 2/i });
      await user.click(viewDiffButton);

      // Should show diff visualization
      await waitFor(() => {
        expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
      });
    });

    it('supports version comparison and reversion', async () => {
      const onRevert = jest.fn();
      const mockVersions = [
        { version: 3, created_at: new Date('2024-03-01'), created_by: 'user1' },
        { version: 2, created_at: new Date('2024-02-01'), created_by: 'user2' },
        { version: 1, created_at: new Date('2024-01-01'), created_by: 'user1' }
      ];

      renderVersionControl({ versions: mockVersions, onRevert });

      // Select version to revert to
      const revertButton = screen.getByRole('button', { name: /revert to version 2/i });
      await user.click(revertButton);

      // Should show confirmation
      const confirmDialog = screen.getByRole('dialog');
      expect(confirmDialog).toBeInTheDocument();
      expect(screen.getByText(/revert to version 2/i)).toBeInTheDocument();

      const confirmButton = within(confirmDialog).getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      expect(onRevert).toHaveBeenCalledWith(2);
    });

    it('handles version loading states and errors', async () => {
      renderVersionControl({
        isLoading: true,
        error: null
      });

      // Should show loading state
      expect(screen.getByText(/loading versions/i)).toBeInTheDocument();

      // Test error state
      const { rerender } = render(
        <VersionControlUI
          entryId="test-1"
          currentVersion={3}
          onVersionChange={jest.fn()}
          onRevert={jest.fn()}
          isLoading={false}
          error="Failed to load version history"
        />
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/failed to load version history/i)).toBeInTheDocument();
    });
  });

  describe('Cross-Component Integration', () => {
    it('integrates search with entry list filtering', async () => {
      const mockSearchResults = createMockEntries(5);

      const IntegratedView = () => {
        const [entries, setEntries] = React.useState<KBEntry[]>(createMockEntries(20));
        const [filteredEntries, setFilteredEntries] = React.useState<KBEntry[]>(entries);

        const handleSearch = (searchParams: any) => {
          if (searchParams.query) {
            setFilteredEntries(mockSearchResults);
          } else {
            setFilteredEntries(entries);
          }
        };

        return (
          <>
            <SmartSearchInterface onSearch={handleSearch} />
            <AdvancedKBEntryList
              entries={filteredEntries}
              onSelectEntry={() => {}}
              onEditEntry={() => {}}
              onDeleteEntry={() => {}}
            />
          </>
        );
      };

      render(<IntegratedView />);

      // Initially should show all entries
      expect(screen.getAllByTestId(/kb-entry-item-/).length).toBe(20);

      // Search should filter entries
      const searchInput = screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, 'test query');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getAllByTestId(/kb-entry-item-/).length).toBe(5);
      });
    });

    it('coordinates batch operations with entry list updates', async () => {
      const InitialEntries = createMockEntries(10);

      const IntegratedBatchView = () => {
        const [entries, setEntries] = React.useState<KBEntry[]>(InitialEntries);
        const [selectedItems, setSelectedItems] = React.useState<KBEntry[]>([]);

        const handleBatchComplete = () => {
          // Remove deleted items from list
          const remainingEntries = entries.filter(
            entry => !selectedItems.some(selected => selected.id === entry.id)
          );
          setEntries(remainingEntries);
          setSelectedItems([]);
        };

        return (
          <>
            <AdvancedKBEntryList
              entries={entries}
              selectedEntryId={null}
              onSelectEntry={() => {}}
              onEditEntry={() => {}}
              onDeleteEntry={() => {}}
              onBulkSelect={setSelectedItems}
            />
            {selectedItems.length > 0 && (
              <BatchOperationsUI
                selectedItems={selectedItems}
                onOperationComplete={handleBatchComplete}
                onCancel={() => setSelectedItems([])}
                batchService={mockBatchServiceInstance}
              />
            )}
          </>
        );
      };

      render(<IntegratedBatchView />);

      // Select items for batch operation
      const bulkModeButton = screen.getByRole('button', { name: /bulk select/i });
      await user.click(bulkModeButton);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]); // First entry
      await user.click(checkboxes[2]); // Second entry

      // Execute batch delete
      const deleteButton = screen.getByRole('button', { name: /delete selected/i });
      await user.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Should update entry list after operation
      await waitFor(() => {
        expect(screen.getAllByTestId(/kb-entry-item-/).length).toBe(8); // 10 - 2 deleted
      });
    });

    it('maintains consistent state across all components', async () => {
      const FullIntegrationView = () => {
        const [entries, setEntries] = React.useState<KBEntry[]>(createMockEntries(5));
        const [selectedEntry, setSelectedEntry] = React.useState<KBEntry | null>(null);
        const [searchResults, setSearchResults] = React.useState<KBEntry[]>(entries);

        return (
          <>
            <SmartSearchInterface
              onSearch={(params) => setSearchResults(entries.filter(e =>
                e.title.toLowerCase().includes(params.query.toLowerCase())
              ))}
            />
            <AdvancedKBEntryList
              entries={searchResults}
              selectedEntryId={selectedEntry?.id || null}
              onSelectEntry={setSelectedEntry}
              onEditEntry={() => {}}
              onDeleteEntry={(id) => {
                const updatedEntries = entries.filter(e => e.id !== id);
                setEntries(updatedEntries);
                setSearchResults(updatedEntries);
                if (selectedEntry?.id === id) {
                  setSelectedEntry(null);
                }
              }}
            />
            {selectedEntry && (
              <VersionControlUI
                entryId={selectedEntry.id}
                currentVersion={selectedEntry.version || 1}
                onVersionChange={() => {}}
                onRevert={() => {}}
              />
            )}
          </>
        );
      };

      const { container } = render(<FullIntegrationView />);

      // Search functionality
      const searchInput = screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, 'Entry 1');

      await waitFor(() => {
        const entries = container.querySelectorAll('[data-testid^="kb-entry-item-"]');
        expect(entries.length).toBe(1);
      });

      // Select entry
      const entryItem = screen.getByTestId('kb-entry-item-test-1');
      await user.click(entryItem);

      // Should show version control
      await waitFor(() => {
        expect(screen.getByTestId('version-control-ui')).toBeInTheDocument();
      });

      // Delete entry
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Should update all related components
      await waitFor(() => {
        expect(screen.queryByTestId('kb-entry-item-test-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('version-control-ui')).not.toBeInTheDocument();
      });

      // Accessibility check for full integration
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Performance Integration Tests', () => {
    it('maintains performance with concurrent operations', async () => {
      const largeEntrySet = createMockEntries(500);

      const PerformanceTestView = () => {
        const [entries, setEntries] = React.useState<KBEntry[]>(largeEntrySet);
        const [searchQuery, setSearchQuery] = React.useState('');

        return (
          <>
            <SmartSearchInterface
              onSearch={(params) => setSearchQuery(params.query)}
            />
            <AdvancedKBEntryList
              entries={entries.filter(e =>
                searchQuery ? e.title.toLowerCase().includes(searchQuery.toLowerCase()) : true
              )}
              onSelectEntry={() => {}}
              onEditEntry={() => {}}
              onDeleteEntry={() => {}}
            />
          </>
        );
      };

      const startTime = performance.now();
      const { container } = render(<PerformanceTestView />);
      const initialRenderTime = performance.now() - startTime;

      expect(initialRenderTime).toBeLessThan(1000); // 1 second limit

      // Test search performance
      const searchStart = performance.now();
      const searchInput = screen.getByRole('textbox', { name: /search/i });
      await user.type(searchInput, 'test query');

      const searchEnd = performance.now();
      const searchTime = searchEnd - searchStart;

      expect(searchTime).toBeLessThan(100); // 100ms for search response

      // Memory usage should remain reasonable
      const memoryUsage = process.memoryUsage();
      expect(memoryUsage.heapUsed).toBeLessThan(500 * 1024 * 1024); // 500MB limit
    });
  });
});