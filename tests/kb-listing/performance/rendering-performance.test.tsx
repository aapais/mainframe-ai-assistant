/**
 * Frontend Rendering Performance Tests
 * Measures component rendering times and identifies performance bottlenecks
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act } from '@testing-library/react';
import { KBExplorer } from '../../../src/renderer/pages/KBExplorer';
import { FilterPanel } from '../../../src/renderer/components/FilterPanel';
import { SortableTable } from '../../../src/renderer/components/SortableTable';
import { useKBListing } from '../../../src/renderer/hooks/useKBListing';
import { generateMockKBEntries } from '../helpers/mock-data-generator';

// Mock performance observer for render timing
const mockPerformanceObserver = {
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn(() => [])
};

Object.defineProperty(window, 'PerformanceObserver', {
  value: jest.fn(() => mockPerformanceObserver)
});

// Performance measurement utilities
const measureRenderTime = (renderFn: () => any): { result: any, renderTime: number, commitTime: number } => {
  const startTime = performance.now();

  let commitTime = 0;
  const originalCommit = React.version; // Placeholder for commit timing

  const result = renderFn();

  const endTime = performance.now();
  commitTime = endTime; // Simplified commit time measurement

  return {
    result,
    renderTime: endTime - startTime,
    commitTime: commitTime - startTime
  };
};

// Mock IPC for realistic data flow
const mockIpcHandlers = new Map();
const mockIpcRenderer = {
  invoke: jest.fn((channel, ...args) => {
    const handler = mockIpcHandlers.get(channel);
    if (handler) {
      return Promise.resolve(handler(...args));
    }
    return Promise.reject(new Error(`No handler for ${channel}`));
  })
};

Object.defineProperty(window, 'api', {
  value: { invoke: mockIpcRenderer.invoke }
});

describe('Rendering Performance Tests', () => {
  let mockData: any[];
  let largeDataset: any[];

  // Performance thresholds (in milliseconds)
  const RENDER_THRESHOLDS = {
    initialRender: 100,
    listUpdate: 50,
    filterChange: 75,
    sortChange: 50,
    pagination: 30,
    largeDataset: 200,
    tableScroll: 16, // 60fps = 16ms per frame
    searchInput: 10,
    componentMount: 80
  };

  beforeAll(() => {
    // Generate test datasets
    mockData = generateMockKBEntries(50);
    largeDataset = generateMockKBEntries(500);

    // Setup performance monitoring
    setupPerformanceMonitoring();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setupMockIpcHandlers();
  });

  const setupPerformanceMonitoring = () => {
    // Mock RAF for consistent timing
    let rafId = 0;
    global.requestAnimationFrame = jest.fn((callback) => {
      const id = ++rafId;
      setTimeout(() => callback(performance.now()), 16);
      return id;
    });

    global.cancelAnimationFrame = jest.fn();
  };

  const setupMockIpcHandlers = () => {
    mockIpcHandlers.set('kb-listing:get-entries', async (options) => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 10));

      const dataset = options.large ? largeDataset : mockData;
      let filteredData = [...dataset];

      // Apply filters
      if (options.filters?.categories?.length) {
        filteredData = filteredData.filter(entry =>
          options.filters.categories.includes(entry.category)
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
          return options.sortOrder === 'desc' ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
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
          executionTime: Math.random() * 20 + 5,
          cacheHit: Math.random() > 0.7
        }
      };
    });
  };

  describe('Component Mount Performance', () => {
    test('KBExplorer should mount within performance threshold', async () => {
      const { renderTime } = measureRenderTime(() => render(<KBExplorer />));

      expect(renderTime).toBeLessThan(RENDER_THRESHOLDS.componentMount);

      // Wait for initial data load
      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      console.log(`KBExplorer mount time: ${renderTime.toFixed(2)}ms (threshold: ${RENDER_THRESHOLDS.componentMount}ms)`);
    });

    test('FilterPanel should mount quickly', async () => {
      const mockFilters = {
        categories: [],
        severities: [],
        tags: [],
        dateRange: null
      };

      const { renderTime } = measureRenderTime(() =>
        render(<FilterPanel filters={mockFilters} onFiltersChange={() => {}} />)
      );

      expect(renderTime).toBeLessThan(RENDER_THRESHOLDS.componentMount);

      console.log(`FilterPanel mount time: ${renderTime.toFixed(2)}ms`);
    });

    test('SortableTable should mount efficiently with data', async () => {
      const columns = [
        { key: 'title', label: 'Title', sortable: true },
        { key: 'category', label: 'Category', sortable: true },
        { key: 'created_at', label: 'Created', sortable: true }
      ];

      const { renderTime } = measureRenderTime(() =>
        render(
          <SortableTable
            data={mockData.slice(0, 20)}
            columns={columns}
            onSort={() => {}}
            sortBy="title"
            sortOrder="asc"
          />
        )
      );

      expect(renderTime).toBeLessThan(RENDER_THRESHOLDS.componentMount);

      console.log(`SortableTable mount time: ${renderTime.toFixed(2)}ms`);
    });
  });

  describe('Initial Render Performance', () => {
    test('should render initial page within threshold', async () => {
      const startTime = performance.now();

      render(<KBExplorer />);

      const initialRenderTime = performance.now() - startTime;

      // Wait for data to load
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:get-entries',
          expect.any(Object)
        );
      });

      const loadCompleteTime = performance.now() - startTime;

      expect(initialRenderTime).toBeLessThan(RENDER_THRESHOLDS.initialRender);

      console.log(`Initial render: ${initialRenderTime.toFixed(2)}ms, load complete: ${loadCompleteTime.toFixed(2)}ms`);
    });

    test('should handle empty state quickly', async () => {
      mockIpcHandlers.set('kb-listing:get-entries', async () => ({
        success: true,
        data: [],
        pagination: { totalItems: 0, totalPages: 0, currentPage: 1, pageSize: 20 }
      }));

      const { renderTime } = measureRenderTime(() => render(<KBExplorer />));

      expect(renderTime).toBeLessThan(RENDER_THRESHOLDS.initialRender);

      await waitFor(() => {
        expect(screen.getByText(/no entries found/i)).toBeInTheDocument();
      });

      console.log(`Empty state render time: ${renderTime.toFixed(2)}ms`);
    });
  });

  describe('List Update Performance', () => {
    test('should update list efficiently when data changes', async () => {
      const { rerender } = render(<KBExplorer />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Measure re-render time
      const startTime = performance.now();

      rerender(<KBExplorer key="updated" />);

      const rerenderTime = performance.now() - startTime;

      expect(rerenderTime).toBeLessThan(RENDER_THRESHOLDS.listUpdate);

      console.log(`List update render time: ${rerenderTime.toFixed(2)}ms`);
    });

    test('should handle new entries addition efficiently', async () => {
      const TestComponent = ({ entries }: { entries: any[] }) => {
        return (
          <SortableTable
            data={entries}
            columns={[
              { key: 'title', label: 'Title', sortable: true },
              { key: 'category', label: 'Category', sortable: true }
            ]}
            onSort={() => {}}
            sortBy="title"
            sortOrder="asc"
          />
        );
      };

      const initialEntries = mockData.slice(0, 10);
      const { rerender } = render(<TestComponent entries={initialEntries} />);

      // Add more entries
      const startTime = performance.now();

      const updatedEntries = mockData.slice(0, 20);
      rerender(<TestComponent entries={updatedEntries} />);

      const updateTime = performance.now() - startTime;

      expect(updateTime).toBeLessThan(RENDER_THRESHOLDS.listUpdate);

      console.log(`Add entries render time: ${updateTime.toFixed(2)}ms`);
    });
  });

  describe('Filter Change Performance', () => {
    test('should handle filter changes within threshold', async () => {
      const user = userEvent.setup();
      render(<KBExplorer />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Measure filter change performance
      const startTime = performance.now();

      const categoryFilter = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryFilter, 'VSAM');

      const filterTime = performance.now() - startTime;

      expect(filterTime).toBeLessThan(RENDER_THRESHOLDS.filterChange);

      console.log(`Filter change time: ${filterTime.toFixed(2)}ms`);
    });

    test('should handle multiple filter changes efficiently', async () => {
      const user = userEvent.setup();
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      const startTime = performance.now();

      // Apply multiple filters quickly
      const categoryFilter = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryFilter, 'VSAM');

      const severityFilter = screen.getByLabelText(/severity/i);
      await user.selectOptions(severityFilter, 'high');

      const multiFilterTime = performance.now() - startTime;

      expect(multiFilterTime).toBeLessThan(RENDER_THRESHOLDS.filterChange * 2);

      console.log(`Multiple filter changes time: ${multiFilterTime.toFixed(2)}ms`);
    });
  });

  describe('Sort Change Performance', () => {
    test('should handle sort changes quickly', async () => {
      const user = userEvent.setup();
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      const startTime = performance.now();

      // Click on sortable column header
      const titleHeader = screen.getByText(/title/i);
      await user.click(titleHeader);

      const sortTime = performance.now() - startTime;

      expect(sortTime).toBeLessThan(RENDER_THRESHOLDS.sortChange);

      console.log(`Sort change time: ${sortTime.toFixed(2)}ms`);
    });

    test('should handle sort direction toggle efficiently', async () => {
      const user = userEvent.setup();
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      const titleHeader = screen.getByText(/title/i);

      // First click
      const startTime = performance.now();
      await user.click(titleHeader);
      const firstClickTime = performance.now() - startTime;

      // Second click (toggle direction)
      const secondStartTime = performance.now();
      await user.click(titleHeader);
      const secondClickTime = performance.now() - secondStartTime;

      expect(firstClickTime).toBeLessThan(RENDER_THRESHOLDS.sortChange);
      expect(secondClickTime).toBeLessThan(RENDER_THRESHOLDS.sortChange);

      console.log(`Sort toggle times: ${firstClickTime.toFixed(2)}ms, ${secondClickTime.toFixed(2)}ms`);
    });
  });

  describe('Pagination Performance', () => {
    test('should handle page navigation efficiently', async () => {
      const user = userEvent.setup();
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      const startTime = performance.now();

      // Click next page
      const nextButton = screen.getByLabelText(/next page/i);
      await user.click(nextButton);

      const paginationTime = performance.now() - startTime;

      expect(paginationTime).toBeLessThan(RENDER_THRESHOLDS.pagination);

      console.log(`Pagination time: ${paginationTime.toFixed(2)}ms`);
    });

    test('should handle page size changes efficiently', async () => {
      const user = userEvent.setup();
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      const startTime = performance.now();

      // Change page size
      const pageSizeSelect = screen.getByLabelText(/items per page/i);
      await user.selectOptions(pageSizeSelect, '50');

      const pageSizeChangeTime = performance.now() - startTime;

      expect(pageSizeChangeTime).toBeLessThan(RENDER_THRESHOLDS.pagination);

      console.log(`Page size change time: ${pageSizeChangeTime.toFixed(2)}ms`);
    });
  });

  describe('Search Input Performance', () => {
    test('should handle search input without lag', async () => {
      const user = userEvent.setup();
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);

      // Measure typing performance
      const typingTimes = [];
      const searchTerm = 'VSAM error';

      for (let i = 0; i < searchTerm.length; i++) {
        const startTime = performance.now();
        await user.type(searchInput, searchTerm[i]);
        const typingTime = performance.now() - startTime;
        typingTimes.push(typingTime);
      }

      const maxTypingTime = Math.max(...typingTimes);
      const avgTypingTime = typingTimes.reduce((sum, time) => sum + time, 0) / typingTimes.length;

      expect(maxTypingTime).toBeLessThan(RENDER_THRESHOLDS.searchInput);
      expect(avgTypingTime).toBeLessThan(RENDER_THRESHOLDS.searchInput / 2);

      console.log(`Search typing - max: ${maxTypingTime.toFixed(2)}ms, avg: ${avgTypingTime.toFixed(2)}ms`);
    });

    test('should debounce search efficiently', async () => {
      const user = userEvent.setup({ delay: null });
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);

      // Rapid typing
      const startTime = performance.now();
      await user.type(searchInput, 'rapid typing test', { delay: 10 });
      const rapidTypingTime = performance.now() - startTime;

      expect(rapidTypingTime).toBeLessThan(500); // Should complete quickly

      // Wait for debounce
      await waitFor(() => {
        expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
          'kb-listing:get-entries',
          expect.objectContaining({
            search: 'rapid typing test'
          })
        );
      }, { timeout: 1000 });

      console.log(`Rapid typing time: ${rapidTypingTime.toFixed(2)}ms`);
    });
  });

  describe('Large Dataset Performance', () => {
    test('should render large datasets within threshold', async () => {
      // Use large dataset
      mockIpcHandlers.set('kb-listing:get-entries', async (options) => {
        const startIndex = (options.page - 1) * options.pageSize;
        const endIndex = startIndex + options.pageSize;
        const paginatedData = largeDataset.slice(startIndex, endIndex);

        return {
          success: true,
          data: paginatedData,
          pagination: {
            totalItems: largeDataset.length,
            totalPages: Math.ceil(largeDataset.length / options.pageSize),
            currentPage: options.page,
            pageSize: options.pageSize
          }
        };
      });

      const { renderTime } = measureRenderTime(() => render(<KBExplorer />));

      expect(renderTime).toBeLessThan(RENDER_THRESHOLDS.largeDataset);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      console.log(`Large dataset render time: ${renderTime.toFixed(2)}ms`);
    });

    test('should handle virtual scrolling performance', async () => {
      const VirtualizedTable = ({ data }: { data: any[] }) => {
        const [visibleStart, setVisibleStart] = React.useState(0);
        const [visibleEnd, setVisibleEnd] = React.useState(20);

        const handleScroll = (e: React.UIEvent) => {
          const startTime = performance.now();

          const scrollTop = e.currentTarget.scrollTop;
          const itemHeight = 40;
          const containerHeight = 600;

          const start = Math.floor(scrollTop / itemHeight);
          const end = start + Math.ceil(containerHeight / itemHeight);

          setVisibleStart(start);
          setVisibleEnd(end);

          const scrollTime = performance.now() - startTime;
          expect(scrollTime).toBeLessThan(RENDER_THRESHOLDS.tableScroll);
        };

        const visibleItems = data.slice(visibleStart, visibleEnd);

        return (
          <div
            onScroll={handleScroll}
            style={{ height: 600, overflow: 'auto' }}
            data-testid="virtual-table"
          >
            <div style={{ height: data.length * 40 }}>
              <div style={{ transform: `translateY(${visibleStart * 40}px)` }}>
                {visibleItems.map((item, index) => (
                  <div key={item.id} style={{ height: 40 }}>
                    {item.title}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      };

      render(<VirtualizedTable data={largeDataset} />);

      const virtualTable = screen.getByTestId('virtual-table');

      // Simulate scrolling
      const startTime = performance.now();

      fireEvent.scroll(virtualTable, { target: { scrollTop: 1000 } });
      fireEvent.scroll(virtualTable, { target: { scrollTop: 2000 } });
      fireEvent.scroll(virtualTable, { target: { scrollTop: 3000 } });

      const totalScrollTime = performance.now() - startTime;

      expect(totalScrollTime).toBeLessThan(RENDER_THRESHOLDS.tableScroll * 3);

      console.log(`Virtual scroll performance: ${totalScrollTime.toFixed(2)}ms`);
    });
  });

  describe('Hook Performance', () => {
    test('useKBListing hook should initialize quickly', async () => {
      const startTime = performance.now();

      const { result } = renderHook(() => useKBListing());

      const initTime = performance.now() - startTime;

      expect(initTime).toBeLessThan(50);
      expect(result.current.loading).toBe(true);

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      console.log(`useKBListing init time: ${initTime.toFixed(2)}ms`);
    });

    test('hook state updates should be efficient', async () => {
      const { result } = renderHook(() => useKBListing());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Measure state update performance
      const operations = [
        () => act(() => { result.current.setPage(2); }),
        () => act(() => { result.current.setFilters({ categories: ['VSAM'] }); }),
        () => act(() => { result.current.setSorting('title', 'asc'); }),
        () => act(() => { result.current.search('test query'); })
      ];

      const operationTimes = [];

      for (const operation of operations) {
        const startTime = performance.now();
        operation();
        const operationTime = performance.now() - startTime;
        operationTimes.push(operationTime);
      }

      const maxOperationTime = Math.max(...operationTimes);
      expect(maxOperationTime).toBeLessThan(20);

      console.log(`Hook operations max time: ${maxOperationTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Performance', () => {
    test('should not create memory leaks during re-renders', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      const TestComponent = ({ iteration }: { iteration: number }) => (
        <KBExplorer key={iteration} />
      );

      const { rerender } = render(<TestComponent iteration={0} />);

      // Re-render many times
      for (let i = 1; i <= 20; i++) {
        rerender(<TestComponent iteration={i} />);

        // Wait for render to complete
        await waitFor(() => {
          expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
        });
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be reasonable (less than 10MB for 20 re-renders)
      if (initialMemory > 0) {
        expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
        console.log(`Memory growth after 20 re-renders: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
      }
    });

    test('should clean up event listeners properly', async () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      const { unmount } = render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      const addedListeners = addEventListenerSpy.mock.calls.length;

      unmount();

      // Should remove at least as many listeners as were added
      const removedListeners = removeEventListenerSpy.mock.calls.length;
      expect(removedListeners).toBeGreaterThanOrEqual(addedListeners * 0.8); // Allow some margin

      console.log(`Event listeners - added: ${addedListeners}, removed: ${removedListeners}`);

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Performance Regression Tests', () => {
    test('should maintain consistent performance across renders', async () => {
      const renderTimes = [];
      const iterations = 5;

      for (let i = 0; i < iterations; i++) {
        const { renderTime } = measureRenderTime(() => {
          const { unmount } = render(<KBExplorer key={i} />);
          // Unmount immediately to measure just render time
          unmount();
          return null;
        });

        renderTimes.push(renderTime);
      }

      const avgRenderTime = renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length;
      const maxRenderTime = Math.max(...renderTimes);
      const variance = renderTimes.reduce((sum, time) => sum + Math.pow(time - avgRenderTime, 2), 0) / renderTimes.length;
      const stdDev = Math.sqrt(variance);

      expect(avgRenderTime).toBeLessThan(RENDER_THRESHOLDS.componentMount);
      expect(maxRenderTime).toBeLessThan(RENDER_THRESHOLDS.componentMount * 2);
      expect(stdDev).toBeLessThan(avgRenderTime * 0.3); // Low variance

      console.log(`Render consistency - avg: ${avgRenderTime.toFixed(2)}ms, max: ${maxRenderTime.toFixed(2)}ms, stdDev: ${stdDev.toFixed(2)}ms`);
    });

    test('should meet performance budgets', async () => {
      const performanceBudget = {
        totalTime: 500,
        renderTime: 100,
        interactionTime: 50,
        memoryUsage: 50 * 1024 * 1024 // 50MB
      };

      const startTime = performance.now();
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Full app interaction simulation
      const user = userEvent.setup();
      render(<KBExplorer />);

      await waitFor(() => {
        expect(screen.getByText(/Knowledge Base Explorer/i)).toBeInTheDocument();
      });

      // Perform typical interactions
      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, 'test search');

      const categoryFilter = screen.getByLabelText(/category/i);
      await user.selectOptions(categoryFilter, 'VSAM');

      if (screen.queryByLabelText(/next page/i)) {
        const nextButton = screen.getByLabelText(/next page/i);
        await user.click(nextButton);
      }

      const totalTime = performance.now() - startTime;
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryUsage = finalMemory - initialMemory;

      expect(totalTime).toBeLessThan(performanceBudget.totalTime);

      if (initialMemory > 0) {
        expect(memoryUsage).toBeLessThan(performanceBudget.memoryUsage);
      }

      console.log(`Performance budget - total: ${totalTime.toFixed(2)}ms, memory: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`);
    });
  });
});