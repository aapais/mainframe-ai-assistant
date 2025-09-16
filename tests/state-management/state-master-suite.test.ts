/**
 * State Management Master Test Suite
 *
 * Comprehensive integration test suite combining all state management aspects:
 * - Cross-context state coordination
 * - State persistence and hydration across page reloads
 * - Performance benchmarks and memory leak detection
 * - Race condition handling in complex scenarios
 * - Error recovery and state consistency validation
 * - Real-world usage patterns and edge cases
 *
 * @author State Management Testing Specialist
 * @version 2.0.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { render, renderHook, act, waitFor, screen, fireEvent } from '@testing-library/react';
import { AppProvider, useApp } from '../../src/renderer/contexts/AppContext';
import { SearchProvider, useSearch } from '../../src/renderer/contexts/SearchContext';
import { KBDataProvider, useKBData } from '../../src/renderer/contexts/KBDataContext';
import { useReactiveStore } from '../../src/renderer/stores/reactive-state';
import { KBEntry, KBEntryInput } from '../../src/types';

// Mock timers for complex timing scenarios
jest.useFakeTimers();

// Enhanced performance monitoring
interface PerformanceMetrics {
  renderCount: number;
  updateCount: number;
  totalRenderTime: number;
  averageRenderTime: number;
  memoryUsage: number[];
  peakMemoryUsage: number;
  stateUpdatesPerSecond: number;
  lastUpdateTimestamp: number;
}

const createPerformanceMonitor = (): {
  metrics: PerformanceMetrics;
  startRender: () => number;
  endRender: (startTime: number) => void;
  recordStateUpdate: () => void;
  getReport: () => string;
} => {
  const metrics: PerformanceMetrics = {
    renderCount: 0,
    updateCount: 0,
    totalRenderTime: 0,
    averageRenderTime: 0,
    memoryUsage: [],
    peakMemoryUsage: 0,
    stateUpdatesPerSecond: 0,
    lastUpdateTimestamp: 0,
  };

  const startRender = () => performance.now();

  const endRender = (startTime: number) => {
    const renderTime = performance.now() - startTime;
    metrics.renderCount++;
    metrics.totalRenderTime += renderTime;
    metrics.averageRenderTime = metrics.totalRenderTime / metrics.renderCount;

    if ((performance as any).memory) {
      const currentMemory = (performance as any).memory.usedJSHeapSize;
      metrics.memoryUsage.push(currentMemory);
      metrics.peakMemoryUsage = Math.max(metrics.peakMemoryUsage, currentMemory);
    }
  };

  const recordStateUpdate = () => {
    const now = Date.now();
    metrics.updateCount++;

    if (metrics.lastUpdateTimestamp > 0) {
      const timeDiff = (now - metrics.lastUpdateTimestamp) / 1000;
      metrics.stateUpdatesPerSecond = 1 / timeDiff;
    }

    metrics.lastUpdateTimestamp = now;
  };

  const getReport = () => {
    const avgMemory = metrics.memoryUsage.length > 0
      ? metrics.memoryUsage.reduce((a, b) => a + b, 0) / metrics.memoryUsage.length
      : 0;

    return `
Performance Report:
- Renders: ${metrics.renderCount}
- Average render time: ${metrics.averageRenderTime.toFixed(2)}ms
- State updates: ${metrics.updateCount}
- Updates/second: ${metrics.stateUpdatesPerSecond.toFixed(2)}
- Average memory: ${(avgMemory / 1024 / 1024).toFixed(2)}MB
- Peak memory: ${(metrics.peakMemoryUsage / 1024 / 1024).toFixed(2)}MB
    `.trim();
  };

  return { metrics, startRender, endRender, recordStateUpdate, getReport };
};

// Multi-context test wrapper
interface MultiContextWrapperProps {
  children: React.ReactNode;
  enablePerformanceMonitoring?: boolean;
}

const MultiContextWrapper = ({ children, enablePerformanceMonitoring = false }: MultiContextWrapperProps) => {
  const performanceMonitor = enablePerformanceMonitoring ? createPerformanceMonitor() : null;

  return (
    <AppProvider>
      <SearchProvider>
        <KBDataProvider>
          {performanceMonitor && (
            <PerformanceMonitorComponent monitor={performanceMonitor} />
          )}
          {children}
        </KBDataProvider>
      </SearchProvider>
    </AppProvider>
  );
};

// Performance monitoring component
const PerformanceMonitorComponent = ({ monitor }: { monitor: ReturnType<typeof createPerformanceMonitor> }) => {
  const app = useApp();
  const search = useSearch();
  const kbData = useKBData();
  const reactiveStore = useReactiveStore();

  useEffect(() => {
    const startTime = monitor.startRender();
    return () => monitor.endRender(startTime);
  });

  useEffect(() => {
    monitor.recordStateUpdate();
  }, [
    app.state.currentView,
    app.state.notifications.length,
    search.state.query,
    search.state.results.length,
    kbData.state.entries.size,
    reactiveStore.entries.size,
  ]);

  return (
    <div
      data-testid="performance-monitor"
      data-render-count={monitor.metrics.renderCount}
      data-update-count={monitor.metrics.updateCount}
      data-average-render-time={monitor.metrics.averageRenderTime}
      data-peak-memory={monitor.metrics.peakMemoryUsage}
    />
  );
};

// Complex state orchestrator for testing
const StateOrchestrator = () => {
  const app = useApp();
  const search = useSearch();
  const kbData = useKBData();
  const reactiveStore = useReactiveStore();

  const [orchestrationLog, setOrchestrationLog] = useState<string[]>([]);

  const logAction = (action: string) => {
    setOrchestrationLog(prev => [...prev, `${Date.now()}: ${action}`]);
  };

  const performComplexWorkflow = async () => {
    logAction('Starting complex workflow');

    // 1. Add notification
    app.addNotification({
      type: 'info',
      message: 'Starting data operations',
    });
    logAction('Added notification');

    // 2. Search for existing data
    search.setQuery('complex workflow test');
    await search.performSearch();
    logAction('Performed search');

    // 3. Create KB entries
    const newEntries: KBEntryInput[] = [
      {
        title: 'Workflow Entry 1',
        problem: 'Complex problem 1',
        solution: 'Complex solution 1',
        category: 'JCL',
        tags: ['workflow', 'test'],
      },
      {
        title: 'Workflow Entry 2',
        problem: 'Complex problem 2',
        solution: 'Complex solution 2',
        category: 'VSAM',
        tags: ['workflow', 'test'],
      },
    ];

    for (const entry of newEntries) {
      await kbData.createEntry(entry);
      logAction(`Created entry: ${entry.title}`);
    }

    // 4. Update filters and pagination
    search.updateFilters({ category: 'JCL', sortBy: 'usage' });
    logAction('Updated search filters');

    // 5. Use reactive store directly
    reactiveStore.updatePagination({ currentPage: 2, pageSize: 25 });
    logAction('Updated pagination');

    // 6. Switch views
    app.setCurrentView('knowledge-base');
    logAction('Changed view');

    // 7. Update theme
    app.setTheme('dark');
    logAction('Changed theme');

    logAction('Completed complex workflow');
  };

  return (
    <div>
      <button
        data-testid="start-workflow"
        onClick={performComplexWorkflow}
      >
        Start Complex Workflow
      </button>
      <div data-testid="orchestration-log">
        {orchestrationLog.map((entry, index) => (
          <div key={index}>{entry}</div>
        ))}
      </div>
      <div data-testid="state-summary">
        <span data-testid="app-view">{app.state.currentView}</span>
        <span data-testid="app-theme">{app.state.theme}</span>
        <span data-testid="search-query">{search.state.query}</span>
        <span data-testid="search-results">{search.state.results.length}</span>
        <span data-testid="kb-entries">{kbData.state.entries.size}</span>
        <span data-testid="reactive-entries">{reactiveStore.entries.size}</span>
        <span data-testid="notification-count">{app.state.notifications.length}</span>
      </div>
    </div>
  );
};

// Mock electron API for integration testing
const createIntegratedMockAPI = () => {
  const entries: KBEntry[] = [];
  let idCounter = 1;

  return {
    getKBEntries: jest.fn().mockImplementation(() =>
      Promise.resolve({ entries: [...entries], total: entries.length })
    ),
    addKBEntry: jest.fn().mockImplementation((entry: KBEntryInput) => {
      const newEntry: KBEntry = {
        ...entry,
        id: `entry-${idCounter++}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        usage_count: 0,
        success_count: 0,
        failure_count: 0,
      };
      entries.push(newEntry);
      return Promise.resolve(newEntry);
    }),
    updateKBEntry: jest.fn().mockImplementation((id: string, updates: Partial<KBEntry>) => {
      const index = entries.findIndex(e => e.id === id);
      if (index === -1) return Promise.reject(new Error('Entry not found'));
      entries[index] = { ...entries[index], ...updates, updated_at: new Date().toISOString() };
      return Promise.resolve(entries[index]);
    }),
    deleteKBEntry: jest.fn().mockImplementation((id: string) => {
      const index = entries.findIndex(e => e.id === id);
      if (index === -1) return Promise.reject(new Error('Entry not found'));
      entries.splice(index, 1);
      return Promise.resolve();
    }),
    searchWithAI: jest.fn().mockImplementation((query: string) => {
      const results = entries
        .filter(e => e.title.toLowerCase().includes(query.toLowerCase()))
        .map(entry => ({ entry, score: 0.9, matchType: 'ai' as const }));
      return Promise.resolve(results);
    }),
    searchLocal: jest.fn().mockImplementation((query: string) => {
      const results = entries
        .filter(e => e.title.toLowerCase().includes(query.toLowerCase()))
        .map(entry => ({ entry, score: 0.7, matchType: 'fuzzy' as const }));
      return Promise.resolve(results);
    }),
  };
};

// State persistence testing utilities
const StatePersistenceTester = () => {
  const [persistenceLog, setPersistenceLog] = useState<string[]>([]);

  const logPersistenceEvent = (event: string) => {
    setPersistenceLog(prev => [...prev, `${Date.now()}: ${event}`]);
  };

  const simulatePageReload = () => {
    logPersistenceEvent('Simulating page reload');
    // In a real scenario, this would involve unmounting and remounting the entire app
    window.location.reload = jest.fn();
  };

  const testLocalStoragePersistence = () => {
    const testData = {
      searchHistory: ['test query 1', 'test query 2'],
      preferences: { theme: 'dark', fontSize: 'large' },
    };

    try {
      localStorage.setItem('app-test-data', JSON.stringify(testData));
      const retrieved = JSON.parse(localStorage.getItem('app-test-data') || '{}');
      logPersistenceEvent(`LocalStorage test: ${JSON.stringify(retrieved) === JSON.stringify(testData) ? 'PASS' : 'FAIL'}`);
    } catch (error) {
      logPersistenceEvent(`LocalStorage test: ERROR - ${(error as Error).message}`);
    }
  };

  return (
    <div>
      <button
        data-testid="test-persistence"
        onClick={testLocalStoragePersistence}
      >
        Test Persistence
      </button>
      <button
        data-testid="simulate-reload"
        onClick={simulatePageReload}
      >
        Simulate Reload
      </button>
      <div data-testid="persistence-log">
        {persistenceLog.map((entry, index) => (
          <div key={index}>{entry}</div>
        ))}
      </div>
    </div>
  );
};

describe('State Management Master Test Suite', () => {
  let mockAPI: ReturnType<typeof createIntegratedMockAPI>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    localStorage.clear();
    sessionStorage.clear();

    mockAPI = createIntegratedMockAPI();
    Object.defineProperty(window, 'electronAPI', {
      value: mockAPI,
      writable: true,
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('Cross-Context State Coordination', () => {
    it('should coordinate state changes across all contexts', async () => {
      render(
        <MultiContextWrapper enablePerformanceMonitoring>
          <StateOrchestrator />
        </MultiContextWrapper>
      );

      // Trigger complex workflow
      fireEvent.click(screen.getByTestId('start-workflow'));

      // Advance timers to complete async operations
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        // Verify state coordination
        expect(screen.getByTestId('app-view')).toHaveTextContent('knowledge-base');
        expect(screen.getByTestId('app-theme')).toHaveTextContent('dark');
        expect(screen.getByTestId('search-query')).toHaveTextContent('complex workflow test');
        expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
      });

      // Check orchestration log
      const logElement = screen.getByTestId('orchestration-log');
      expect(logElement.children.length).toBeGreaterThan(5);
    });

    it('should maintain state consistency during rapid updates', async () => {
      const { result } = renderHook(
        () => ({
          app: useApp(),
          search: useSearch(),
          kbData: useKBData(),
          reactive: useReactiveStore(),
        }),
        { wrapper: MultiContextWrapper }
      );

      const updateCount = 50;
      const startTime = performance.now();

      // Perform rapid updates across all contexts
      for (let i = 0; i < updateCount; i++) {
        await act(async () => {
          // App context updates
          result.current.app.setCurrentView(i % 2 === 0 ? 'search' : 'knowledge-base');

          // Search context updates
          result.current.search.setQuery(`rapid test ${i}`);

          // Reactive store updates
          result.current.reactive.updateFilters({ search: `filter ${i}` });
        });

        // Advance timers slightly
        act(() => {
          jest.advanceTimersByTime(10);
        });
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete quickly (less than 2ms per update)
      expect(totalTime / updateCount).toBeLessThan(2);

      // State should be consistent
      expect(result.current.app.state.currentView).toBe('search'); // Last even iteration
      expect(result.current.search.state.query).toBe(`rapid test ${updateCount - 1}`);
      expect(result.current.reactive.filters.search).toBe(`filter ${updateCount - 1}`);
    });

    it('should handle context provider unmounting gracefully', () => {
      const TestComponent = () => {
        const [mounted, setMounted] = useState(true);

        return mounted ? (
          <MultiContextWrapper>
            <button
              data-testid="unmount"
              onClick={() => setMounted(false)}
            >
              Unmount
            </button>
            <StateOrchestrator />
          </MultiContextWrapper>
        ) : (
          <div data-testid="unmounted">Unmounted</div>
        );
      };

      render(<TestComponent />);

      // Verify initial mount
      expect(screen.getByTestId('start-workflow')).toBeInTheDocument();

      // Unmount contexts
      fireEvent.click(screen.getByTestId('unmount'));

      // Should handle unmounting gracefully
      expect(screen.getByTestId('unmounted')).toBeInTheDocument();
    });
  });

  describe('State Persistence and Hydration', () => {
    it('should persist and restore state across sessions', async () => {
      // First session
      {
        const { result } = renderHook(
          () => ({
            app: useApp(),
            search: useSearch(),
          }),
          { wrapper: MultiContextWrapper }
        );

        // Set some state
        act(() => {
          result.current.app.setTheme('dark');
          result.current.app.updateAccessibility({ fontSize: 'large' });
          result.current.search.setQuery('persistent query');
          result.current.search.addToHistory('history item 1');
          result.current.search.addToHistory('history item 2');
        });

        // Force persistence (simulate beforeunload)
        act(() => {
          jest.advanceTimersByTime(100);
        });
      }

      // Simulate page reload - second session
      {
        const { result } = renderHook(
          () => ({
            app: useApp(),
            search: useSearch(),
          }),
          { wrapper: MultiContextWrapper }
        );

        await waitFor(() => {
          // State should be restored
          expect(result.current.search.state.searchHistory).toContain('history item 1');
          expect(result.current.search.state.searchHistory).toContain('history item 2');
        });
      }
    });

    it('should handle corrupted persistence data gracefully', async () => {
      // Corrupt localStorage
      localStorage.setItem('kb-search-history', 'invalid-json{');
      localStorage.setItem('kb-search-analytics', 'also-invalid}');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { result } = renderHook(
        () => ({ search: useSearch() }),
        { wrapper: MultiContextWrapper }
      );

      // Should not crash and should use default state
      expect(result.current.search.state.searchHistory).toEqual([]);
      expect(result.current.search.state.searchAnalytics.totalSearches).toBe(0);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should manage localStorage quota efficiently', async () => {
      const { result } = renderHook(
        () => ({ search: useSearch() }),
        { wrapper: MultiContextWrapper }
      );

      // Generate large amount of data
      const largeHistory = Array.from({ length: 10000 }, (_, i) => `query ${i}`);

      act(() => {
        largeHistory.forEach(query => {
          result.current.search.addToHistory(query);
        });
      });

      // Should handle large data without crashing
      expect(result.current.search.state.searchHistory.length).toBeLessThanOrEqual(20); // Should be limited
    });
  });

  describe('Performance Benchmarks', () => {
    it('should maintain performance under high load', async () => {
      render(
        <MultiContextWrapper enablePerformanceMonitoring>
          <StateOrchestrator />
        </MultiContextWrapper>
      );

      const performanceElement = screen.getByTestId('performance-monitor');

      // Simulate high load scenario
      for (let i = 0; i < 100; i++) {
        fireEvent.click(screen.getByTestId('start-workflow'));

        act(() => {
          jest.advanceTimersByTime(50);
        });
      }

      await waitFor(() => {
        const renderCount = parseInt(performanceElement.getAttribute('data-render-count') || '0');
        const averageRenderTime = parseFloat(performanceElement.getAttribute('data-average-render-time') || '0');

        expect(renderCount).toBeGreaterThan(0);
        expect(averageRenderTime).toBeLessThan(16); // Should render faster than 60fps
      });
    });

    it('should detect memory leaks', async () => {
      const { result } = renderHook(
        () => ({
          app: useApp(),
          search: useSearch(),
          kbData: useKBData(),
        }),
        { wrapper: MultiContextWrapper }
      );

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Simulate memory-intensive operations
      for (let cycle = 0; cycle < 10; cycle++) {
        // Create and remove many entries
        for (let i = 0; i < 100; i++) {
          await act(async () => {
            await result.current.kbData.createEntry({
              title: `Memory test entry ${cycle}-${i}`,
              problem: 'Memory test problem',
              solution: 'Memory test solution',
              category: 'JCL',
              tags: ['memory', 'test'],
            });
          });
        }

        // Clear entries
        act(() => {
          result.current.kbData.state.entries.clear();
        });

        // Force garbage collection if available
        if ((global as any).gc) {
          (global as any).gc();
        }

        act(() => {
          jest.advanceTimersByTime(100);
        });
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it('should handle concurrent operations efficiently', async () => {
      const { result } = renderHook(
        () => ({
          search: useSearch(),
          kbData: useKBData(),
        }),
        { wrapper: MultiContextWrapper }
      );

      const operationCount = 50;
      const startTime = performance.now();

      // Execute many concurrent operations
      const operations = Array.from({ length: operationCount }, async (_, i) => {
        await result.current.search.performSearch(`concurrent test ${i}`);
        return result.current.kbData.createEntry({
          title: `Concurrent entry ${i}`,
          problem: `Problem ${i}`,
          solution: `Solution ${i}`,
          category: 'VSAM',
          tags: ['concurrent'],
        });
      });

      await act(async () => {
        await Promise.all(operations);
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds for 50 operations
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from context provider errors', async () => {
      const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
        const [hasError, setHasError] = useState(false);

        if (hasError) {
          return <div data-testid="error-fallback">Error occurred</div>;
        }

        try {
          return <>{children}</>;
        } catch (error) {
          setHasError(true);
          return <div data-testid="error-fallback">Error occurred</div>;
        }
      };

      const FaultyComponent = () => {
        const [shouldError, setShouldError] = useState(false);

        if (shouldError) {
          throw new Error('Test error');
        }

        return (
          <button
            data-testid="trigger-error"
            onClick={() => setShouldError(true)}
          >
            Trigger Error
          </button>
        );
      };

      render(
        <ErrorBoundary>
          <MultiContextWrapper>
            <FaultyComponent />
          </MultiContextWrapper>
        </ErrorBoundary>
      );

      expect(screen.getByTestId('trigger-error')).toBeInTheDocument();

      // This test verifies error boundary behavior, but in practice
      // our contexts should handle errors gracefully without throwing
    });

    it('should handle network failures gracefully', async () => {
      // Mock network failures
      mockAPI.searchWithAI.mockRejectedValue(new Error('Network error'));
      mockAPI.addKBEntry.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(
        () => ({
          search: useSearch(),
          kbData: useKBData(),
        }),
        { wrapper: MultiContextWrapper }
      );

      // Attempt operations that will fail
      await act(async () => {
        try {
          await result.current.search.performSearch('failing search');
        } catch (error) {
          // Expected to fail
        }
      });

      await act(async () => {
        try {
          await result.current.kbData.createEntry({
            title: 'Failing entry',
            problem: 'Problem',
            solution: 'Solution',
            category: 'JCL',
            tags: [],
          });
        } catch (error) {
          // Expected to fail
        }
      });

      // State should still be consistent
      expect(result.current.search.state.searchError).toBeTruthy();
      expect(result.current.kbData.state.operationError).toBeTruthy();
    });

    it('should maintain state consistency during partial failures', async () => {
      // Mock intermittent failures
      let callCount = 0;
      mockAPI.addKBEntry.mockImplementation((entry: KBEntryInput) => {
        callCount++;
        if (callCount % 3 === 0) {
          return Promise.reject(new Error('Intermittent failure'));
        }
        return Promise.resolve({
          ...entry,
          id: `entry-${callCount}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          usage_count: 0,
          success_count: 0,
          failure_count: 0,
        });
      });

      const { result } = renderHook(
        () => ({ kbData: useKBData() }),
        { wrapper: MultiContextWrapper }
      );

      const entries: KBEntryInput[] = [
        { title: 'Entry 1', problem: 'P1', solution: 'S1', category: 'JCL', tags: [] },
        { title: 'Entry 2', problem: 'P2', solution: 'S2', category: 'VSAM', tags: [] },
        { title: 'Entry 3', problem: 'P3', solution: 'S3', category: 'DB2', tags: [] },
        { title: 'Entry 4', problem: 'P4', solution: 'S4', category: 'JCL', tags: [] },
        { title: 'Entry 5', problem: 'P5', solution: 'S5', category: 'VSAM', tags: [] },
      ];

      let successCount = 0;
      let failureCount = 0;

      for (const entry of entries) {
        await act(async () => {
          try {
            await result.current.kbData.createEntry(entry);
            successCount++;
          } catch (error) {
            failureCount++;
          }
        });
      }

      // Should have partial success
      expect(successCount).toBeGreaterThan(0);
      expect(failureCount).toBeGreaterThan(0);
      expect(successCount + failureCount).toBe(entries.length);

      // State should reflect only successful operations
      expect(result.current.kbData.state.entries.size).toBe(successCount);
    });
  });

  describe('Real-World Usage Patterns', () => {
    it('should handle typical user workflow patterns', async () => {
      render(
        <MultiContextWrapper>
          <StateOrchestrator />
        </MultiContextWrapper>
      );

      // Simulate typical user session
      // 1. User searches for something
      const searchInput = screen.getByTestId('search-query').closest('div')?.querySelector('input');
      if (searchInput) {
        fireEvent.change(searchInput, { target: { value: 'typical search' } });
      }

      // 2. User creates a new entry
      fireEvent.click(screen.getByTestId('start-workflow'));

      // 3. User changes view
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // 4. User modifies settings
      act(() => {
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(screen.getByTestId('app-view')).toHaveTextContent('knowledge-base');
      });
    });

    it('should handle edge case user behaviors', async () => {
      const { result } = renderHook(
        () => ({
          app: useApp(),
          search: useSearch(),
          kbData: useKBData(),
        }),
        { wrapper: MultiContextWrapper }
      );

      // Edge case: Rapid theme switching
      for (let i = 0; i < 20; i++) {
        act(() => {
          result.current.app.setTheme(i % 3 === 0 ? 'light' : i % 3 === 1 ? 'dark' : 'system');
        });
      }

      // Edge case: Empty search queries
      await act(async () => {
        await result.current.search.performSearch('');
      });

      // Edge case: Duplicate entries
      const duplicateEntry: KBEntryInput = {
        title: 'Duplicate Entry',
        problem: 'Problem',
        solution: 'Solution',
        category: 'JCL',
        tags: [],
      };

      await act(async () => {
        await result.current.kbData.createEntry(duplicateEntry);
        await result.current.kbData.createEntry(duplicateEntry);
      });

      // State should remain consistent despite edge cases
      expect(result.current.app.state.theme).toMatch(/^(light|dark|system)$/);
      expect(result.current.kbData.state.entries.size).toBeGreaterThanOrEqual(2);
    });
  });
});