/**
 * Frontend-Backend Integration Flow Tests
 * Tests complete user workflows from UI interactions to data persistence
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act } from '@testing-library/react';
import { KBExplorer } from '../../../src/renderer/pages/KBExplorer';
import { useKBListing } from '../../../src/renderer/hooks/useKBListing';
import { createTestDatabase, seedRealisticData } from '../helpers/test-database';
import { generateMockKBEntries } from '../helpers/mock-data-generator';
import Database from 'better-sqlite3';

// Mock IPC for Electron
const mockIpcHandlers = new Map();
const mockIpcRenderer = {
  invoke: jest.fn((channel, ...args) => {
    const handler = mockIpcHandlers.get(channel);
    if (handler) {
      return Promise.resolve(handler(...args));
    }
    return Promise.reject(new Error(`No handler for ${channel}`));
  }),
  on: jest.fn(),
  removeAllListeners: jest.fn()
};

// Mock window.api
Object.defineProperty(window, 'api', {
  value: {
    invoke: mockIpcRenderer.invoke,
    on: mockIpcRenderer.on
  }
});

describe('Frontend-Backend Integration Flows', () => {
  let db: Database.Database;
  let mockData: any[];
  let user: any;

  beforeAll(async () => {
    db = createTestDatabase({ memory: true });
    await seedRealisticData(db);

    // Generate additional mock data for testing
    mockData = generateMockKBEntries(100);
  });

  beforeEach(async () => {
    user = userEvent.setup();

    // Setup IPC handlers
    setupMockIpcHandlers();

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(() => {
    db?.close();
  });

  const setupMockIpcHandlers = () => {
    // Mock KB listing handler
    mockIpcHandlers.set('kb-listing:get-entries', async (options) => {
      // Simulate database query logic
      let filteredData = [...mockData];

      // Apply filters
      if (options.filters?.categories?.length) {
        filteredData = filteredData.filter(entry =>
          options.filters.categories.includes(entry.category)
        );
      }

      if (options.filters?.severities?.length) {
        filteredData = filteredData.filter(entry =>
          options.filters.severities.includes(entry.severity)
        );
      }

      if (options.search) {
        const searchTerm = options.search.toLowerCase();
        filteredData = filteredData.filter(entry =>
          entry.title.toLowerCase().includes(searchTerm) ||
          entry.problem.toLowerCase().includes(searchTerm)
        );
      }

      // Apply sorting
      if (options.sortBy) {
        filteredData.sort((a, b) => {
          const aVal = a[options.sortBy];
          const bVal = b[options.sortBy];

          if (options.sortOrder === 'desc') {
            return bVal > aVal ? 1 : -1;
          }
          return aVal > bVal ? 1 : -1;
        });
      }

      // Apply pagination
      const startIndex = (options.page - 1) * options.pageSize;
      const endIndex = startIndex + options.pageSize;
      const paginatedData = filteredData.slice(startIndex, endIndex);

      return {
        success: true,
        data: paginatedData,
        pagination: {
          currentPage: options.page,
          pageSize: options.pageSize,
          totalItems: filteredData.length,
          totalPages: Math.ceil(filteredData.length / options.pageSize),
          hasNext: endIndex < filteredData.length,
          hasPrev: options.page > 1
        },
        metadata: {
          executionTime: Math.random() * 50 + 10,
          cacheHit: false,
          searchMethod: options.search ? 'fts' : null
        }
      };
    });

    // Mock aggregations handler
    mockIpcHandlers.set('kb-listing:get-aggregations', async (options) => {
      const aggregations = {
        categories: {},
        severities: {},
        tags: {},
        usageStats: {
          totalEntries: mockData.length,
          avgUsageCount: 0,
          mostUsed: mockData[0]
        }
      };

      // Calculate category counts
      if (options.includeCategories) {
        mockData.forEach(entry => {
          aggregations.categories[entry.category] =
            (aggregations.categories[entry.category] || 0) + 1;
        });
      }

      // Calculate severity counts
      if (options.includeSeverities) {
        mockData.forEach(entry => {
          aggregations.severities[entry.severity] =
            (aggregations.severities[entry.severity] || 0) + 1;
        });
      }

      return {
        success: true,
        data: aggregations
      };
    });

    // Mock entry operations
    mockIpcHandlers.set('kb-listing:get-entry', async (id) => {
      const entry = mockData.find(e => e.id === id);
      return {
        success: !!entry,
        data: entry || null,
        error: entry ? null : 'Entry not found'
      };
    });

    mockIpcHandlers.set('kb-listing:create-entry', async (entry) => {
      const newEntry = {
        ...entry,
        id: `mock-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        usage_count: 0,
        success_count: 0,
        failure_count: 0
      };

      mockData.push(newEntry);

      return {
        success: true,
        data: newEntry
      };
    });

    mockIpcHandlers.set('kb-listing:update-entry', async (id, updates) => {
      const index = mockData.findIndex(e => e.id === id);
      if (index === -1) {
        return {
          success: false,
          error: 'Entry not found'
        };
      }

      mockData[index] = {
        ...mockData[index],
        ...updates,
        updated_at: new Date().toISOString()
      };

      return {
        success: true,
        data: mockData[index]
      };
    });

    mockIpcHandlers.set('kb-listing:delete-entry', async (id) => {
      const index = mockData.findIndex(e => e.id === id);
      if (index === -1) {
        return {
          success: false,
          error: 'Entry not found'
        };
      }

      const deleted = mockData.splice(index, 1)[0];

      return {
        success: true,
        data: deleted
      };
    });

    // Mock export handler
    mockIpcHandlers.set('kb-listing:export-entries', async (options) => {
      const exportData = mockData.filter(entry => {
        if (options.filters?.categories?.length) {
          return options.filters.categories.includes(entry.category);
        }
        return true;
      });

      return {
        success: true,
        data: {
          exportPath: '/mock/path/export.json',
          entryCount: exportData.length,
          format: options.format || 'json'
        }
      };
    });
  };

  describe('Complete User Workflows', () => {
    test('should handle complete search and filter workflow', async () => {
      render(<KBExplorer />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Verify initial data is loaded
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('kb-listing:get-entries', expect.any(Object));

      // Perform search
      const searchInput = screen.getByPlaceholderText(/search knowledge base/i);
      await user.type(searchInput, 'VSAM error');

      // Wait for search results
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:get-entries',
          expect.objectContaining({
            search: 'VSAM error'
          })
        );
      }, { timeout: 3000 });

      // Apply category filter
      const categoryFilter = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryFilter, 'VSAM');

      // Wait for filtered results
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:get-entries',
          expect.objectContaining({
            search: 'VSAM error',
            filters: expect.objectContaining({
              categories: ['VSAM']
            })
          })
        );
      });

      // Change sorting
      const sortSelect = screen.getByLabelText(/sort by/i);
      await user.selectOptions(sortSelect, 'usage_count');

      // Wait for sorted results
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:get-entries',
          expect.objectContaining({
            sortBy: 'usage_count'
          })
        );
      });
    });

    test('should handle pagination workflow', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Go to next page
      const nextButton = screen.getByLabelText(/next page/i);
      await user.click(nextButton);

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:get-entries',
          expect.objectContaining({
            page: 2
          })
        );
      });

      // Change page size
      const pageSizeSelect = screen.getByLabelText(/items per page/i);
      await user.selectOptions(pageSizeSelect, '50');

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:get-entries',
          expect.objectContaining({
            pageSize: 50,
            page: 1 // Should reset to first page
          })
        );
      });

      // Jump to specific page
      const pageInput = screen.getByLabelText(/go to page/i);
      await user.clear(pageInput);
      await user.type(pageInput, '3');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:get-entries',
          expect.objectContaining({
            page: 3,
            pageSize: 50
          })
        );
      });
    });

    test('should handle entry selection and detail view', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Click on first entry
      await waitFor(() => {
        const firstEntry = screen.getAllByRole('row')[1]; // Skip header row
        expect(firstEntry).toBeInTheDocument();
      });

      const firstEntry = screen.getAllByRole('row')[1];
      await user.click(firstEntry);

      // Should fetch entry details
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:get-entry',
          expect.any(String)
        );
      });

      // Detail panel should be visible
      expect(screen.getByText(/Entry Details/i)).toBeInTheDocument();
    });

    test('should handle entry creation workflow', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Click add new entry button
      const addButton = screen.getByRole('button', { name: /add entry/i });
      await user.click(addButton);

      // Fill form
      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'New Test Entry');

      const problemTextarea = screen.getByLabelText(/problem/i);
      await user.type(problemTextarea, 'Test problem description');

      const solutionTextarea = screen.getByLabelText(/solution/i);
      await user.type(solutionTextarea, 'Test solution steps');

      const categorySelect = screen.getByLabelText(/category/i);
      await user.selectOptions(categorySelect, 'Other');

      // Submit form
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should create entry
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:create-entry',
          expect.objectContaining({
            title: 'New Test Entry',
            problem: 'Test problem description',
            solution: 'Test solution steps',
            category: 'Other'
          })
        );
      });

      // Should refresh list
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:get-entries',
          expect.any(Object)
        );
      });
    });

    test('should handle entry editing workflow', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Select and edit an entry
      const firstEntry = screen.getAllByRole('row')[1];
      await user.click(firstEntry);

      // Click edit button
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Modify title
      const titleInput = screen.getByLabelText(/title/i);
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Entry Title');

      // Save changes
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should update entry
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:update-entry',
          expect.any(String),
          expect.objectContaining({
            title: 'Updated Entry Title'
          })
        );
      });
    });

    test('should handle entry deletion workflow', async () => {
      // Mock confirmation dialog
      window.confirm = jest.fn(() => true);

      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Select and delete an entry
      const firstEntry = screen.getAllByRole('row')[1];
      await user.click(firstEntry);

      // Click delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Should confirm deletion
      expect(window.confirm).toHaveBeenCalled();

      // Should delete entry
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:delete-entry',
          expect.any(String)
        );
      });

      // Should refresh list
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:get-entries',
          expect.any(Object)
        );
      });
    });

    test('should handle export workflow', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Apply some filters first
      const categoryFilter = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryFilter, 'VSAM');

      // Click export button
      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      // Select export format
      const formatSelect = screen.getByLabelText(/export format/i);
      await user.selectOptions(formatSelect, 'json');

      // Confirm export
      const confirmExportButton = screen.getByRole('button', { name: /confirm export/i });
      await user.click(confirmExportButton);

      // Should export with current filters
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:export-entries',
          expect.objectContaining({
            format: 'json',
            filters: expect.objectContaining({
              categories: ['VSAM']
            })
          })
        );
      });

      // Should show success message
      expect(screen.getByText(/export successful/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling Workflows', () => {
    test('should handle network/IPC errors gracefully', async () => {
      // Mock network failure
      mockIpcHandlers.set('kb-listing:get-entries', async () => {
        throw new Error('Network error');
      });

      render(<KBExplorer />);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/error loading entries/i)).toBeInTheDocument();
      });

      // Should provide retry option
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      // Fix the handler and retry
      mockIpcHandlers.set('kb-listing:get-entries', async (options) => {
        return {
          success: true,
          data: mockData.slice(0, 10),
          pagination: {
            currentPage: 1,
            totalItems: mockData.length,
            totalPages: Math.ceil(mockData.length / 10)
          }
        };
      });

      await user.click(retryButton);

      // Should recover and show data
      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });
    });

    test('should handle validation errors in forms', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Click add new entry
      const addButton = screen.getByRole('button', { name: /add entry/i });
      await user.click(addButton);

      // Try to save without required fields
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show validation errors
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      expect(screen.getByText(/problem is required/i)).toBeInTheDocument();
      expect(screen.getByText(/solution is required/i)).toBeInTheDocument();

      // Should not attempt to save
      expect(mockIpcRenderer.invoke).not.toHaveBeenCalledWith(
        'kb-listing:create-entry',
        expect.any(Object)
      );
    });

    test('should handle server errors during operations', async () => {
      // Mock server error for create operation
      mockIpcHandlers.set('kb-listing:create-entry', async () => {
        return {
          success: false,
          error: 'Database constraint violation'
        };
      });

      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Fill and submit form
      const addButton = screen.getByRole('button', { name: /add entry/i });
      await user.click(addButton);

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, 'Test Entry');

      const problemTextarea = screen.getByLabelText(/problem/i);
      await user.type(problemTextarea, 'Test problem');

      const solutionTextarea = screen.getByLabelText(/solution/i);
      await user.type(solutionTextarea, 'Test solution');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/database constraint violation/i)).toBeInTheDocument();
      });

      // Form should remain open for corrections
      expect(titleInput).toBeInTheDocument();
    });
  });

  describe('Hook Integration Tests', () => {
    test('should integrate useKBListing hook with UI properly', async () => {
      const TestComponent = () => {
        const {
          data,
          pagination,
          loading,
          error,
          search,
          setFilters,
          setSorting,
          setPage,
          refresh
        } = useKBListing();

        return (
          <div>
            <div data-testid="loading">{loading.toString()}</div>
            <div data-testid="error">{error || 'none'}</div>
            <div data-testid="count">{data?.length || 0}</div>
            <div data-testid="total">{pagination?.totalItems || 0}</div>

            <button onClick={() => search('test search')}>
              Search
            </button>
            <button onClick={() => setFilters({ categories: ['VSAM'] })}>
              Filter
            </button>
            <button onClick={() => setSorting('title', 'asc')}>
              Sort
            </button>
            <button onClick={() => setPage(2)}>
              Page 2
            </button>
            <button onClick={refresh}>
              Refresh
            </button>
          </div>
        );
      };

      render(<TestComponent />);

      // Initial load
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('count')).toHaveTextContent('10'); // Default page size
      expect(screen.getByTestId('total')).toHaveTextContent('100'); // Total mock data

      // Test search
      await user.click(screen.getByText('Search'));

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:get-entries',
          expect.objectContaining({
            search: 'test search'
          })
        );
      });

      // Test filtering
      await user.click(screen.getByText('Filter'));

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:get-entries',
          expect.objectContaining({
            filters: { categories: ['VSAM'] }
          })
        );
      });

      // Test sorting
      await user.click(screen.getByText('Sort'));

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:get-entries',
          expect.objectContaining({
            sortBy: 'title',
            sortOrder: 'asc'
          })
        );
      });

      // Test pagination
      await user.click(screen.getByText('Page 2'));

      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:get-entries',
          expect.objectContaining({
            page: 2
          })
        );
      });
    });

    test('should handle concurrent operations properly', async () => {
      const TestComponent = () => {
        const { search, setFilters, setSorting, loading } = useKBListing();

        const handleConcurrentOps = async () => {
          // Trigger multiple operations simultaneously
          search('concurrent search');
          setFilters({ categories: ['VSAM', 'JCL'] });
          setSorting('updated_at', 'desc');
        };

        return (
          <div>
            <div data-testid="loading">{loading.toString()}</div>
            <button onClick={handleConcurrentOps}>
              Concurrent Ops
            </button>
          </div>
        );
      };

      render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      // Trigger concurrent operations
      await user.click(screen.getByText('Concurrent Ops'));

      // Should handle all operations properly
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:get-entries',
          expect.objectContaining({
            search: 'concurrent search',
            filters: { categories: ['VSAM', 'JCL'] },
            sortBy: 'updated_at',
            sortOrder: 'desc'
          })
        );
      });

      // Loading should eventually complete
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });
  });

  describe('State Persistence Tests', () => {
    test('should persist filter state across component remounts', async () => {
      let rerender: any;

      const TestWrapper = ({ show }: { show: boolean }) => {
        if (!show) return null;
        return <KBExplorer />;
      };

      const { rerender: rerenderFn } = render(<TestWrapper show={true} />);
      rerender = rerenderFn;

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Apply filters
      const categoryFilter = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryFilter, 'VSAM');

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'test search');

      // Unmount and remount
      rerender(<TestWrapper show={false} />);
      rerender(<TestWrapper show={true} />);

      // Should restore previous state
      await waitFor(() => {
        expect(screen.getByDisplayValue('VSAM')).toBeInTheDocument();
        expect(screen.getByDisplayValue('test search')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Integration Tests', () => {
    test('should handle rapid user interactions without performance issues', async () => {
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);

      // Simulate rapid typing
      const startTime = performance.now();

      await user.type(searchInput, 'rapid typing test', { delay: 10 });

      const endTime = performance.now();
      const typingTime = endTime - startTime;

      // Should complete quickly despite rapid input
      expect(typingTime).toBeLessThan(1000);

      // Should debounce search requests properly
      await waitFor(() => {
        // Should not have made a request for every character
        const searchCalls = mockIpcRenderer.invoke.mock.calls.filter(
          call => call[0] === 'kb-listing:get-entries' && call[1].search
        );
        expect(searchCalls.length).toBeLessThan(10); // Much less than character count
      });
    });
  });
});