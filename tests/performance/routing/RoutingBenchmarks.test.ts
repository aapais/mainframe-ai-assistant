/**
 * Performance Benchmarks for KB Routing System
 * Tests routing performance, memory usage, and scalability
 */

import { performance, PerformanceObserver } from 'perf_hooks';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { 
  KBRouterProvider, 
  useKBRouter,
  NavigationState 
} from '../../../src/renderer/routing/KBRouter';
import { SearchProvider } from '../../../src/renderer/contexts/SearchContext';
import { AppProvider } from '../../../src/renderer/context/AppContext';
import { generateLargeSearchResults } from '../../fixtures/performanceData';

// Performance test utilities
class PerformanceTracker {
  private measurements: { [key: string]: number[] } = {};
  private memoryUsage: { [key: string]: number[] } = {};
  
  startMeasurement(name: string): () => number {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      if (!this.measurements[name]) {
        this.measurements[name] = [];
      }
      this.measurements[name].push(duration);
      return duration;
    };
  }

  measureMemory(name: string) {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      if (!this.memoryUsage[name]) {
        this.memoryUsage[name] = [];
      }
      this.memoryUsage[name].push(usage.heapUsed);
    }
  }

  getAverageTime(name: string): number {
    const measurements = this.measurements[name] || [];
    return measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
  }

  getMedianTime(name: string): number {
    const measurements = this.measurements[name] || [];
    const sorted = [...measurements].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  getP95Time(name: string): number {
    const measurements = this.measurements[name] || [];
    const sorted = [...measurements].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index] || 0;
  }

  getMaxTime(name: string): number {
    const measurements = this.measurements[name] || [];
    return Math.max(...measurements);
  }

  getMemoryIncrease(name: string): number {
    const usage = this.memoryUsage[name] || [];
    return usage.length > 1 ? usage[usage.length - 1] - usage[0] : 0;
  }

  reset() {
    this.measurements = {};
    this.memoryUsage = {};
  }

  getSummary() {
    const summary: any = {};
    
    Object.keys(this.measurements).forEach(key => {
      summary[key] = {
        average: this.getAverageTime(key),
        median: this.getMedianTime(key),
        p95: this.getP95Time(key),
        max: this.getMaxTime(key),
        samples: this.measurements[key].length,
        memoryIncrease: this.getMemoryIncrease(key)
      };
    });
    
    return summary;
  }
}

// Mock contexts for performance testing
jest.mock('../../../src/renderer/contexts/SearchContext', () => ({
  SearchProvider: ({ children }: any) => children,
  useSearch: () => ({
    state: {
      query: '',
      results: [],
      isSearching: false,
      filters: { category: undefined },
      useAI: true,
      history: [],
    },
    performSearch: jest.fn(),
    setQuery: jest.fn(),
    updateFilters: jest.fn(),
  }),
}));

jest.mock('../../../src/renderer/context/AppContext', () => ({
  AppProvider: ({ children }: any) => children,
  useApp: () => ({
    state: {
      selectedEntry: null,
      recentEntries: [],
      isLoading: false,
      error: null,
    },
    selectEntry: jest.fn(),
  }),
}));

// Mock react-router-dom to control navigation timing
const mockNavigate = jest.fn();
const mockUseLocation = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation.mockReturnValue({
    pathname: '/search',
    search: '',
    hash: '',
  }),
}));

describe('KB Router Performance Benchmarks', () => {
  let tracker: PerformanceTracker;

  const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <MemoryRouter>
      <AppProvider>
        <SearchProvider>
          <KBRouterProvider>
            {children}
          </KBRouterProvider>
        </SearchProvider>
      </AppProvider>
    </MemoryRouter>
  );

  beforeEach(() => {
    tracker = new PerformanceTracker();
    jest.clearAllMocks();
  });

  afterEach(() => {
    const summary = tracker.getSummary();
    if (Object.keys(summary).length > 0) {
      console.log('Performance Summary:', JSON.stringify(summary, null, 2));
    }
  });

  describe('Router Initialization Performance', () => {
    it('should initialize router within acceptable time', async () => {
      const endMeasurement = tracker.startMeasurement('router-init');
      tracker.measureMemory('router-init-start');

      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      tracker.measureMemory('router-init-end');
      const duration = endMeasurement();

      expect(result.current).toBeDefined();
      expect(duration).toBeLessThan(50); // Should initialize within 50ms
      
      const memoryIncrease = tracker.getMemoryIncrease('router-init-start');
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
    });

    it('should handle concurrent router initializations efficiently', async () => {
      const initPromises: Promise<any>[] = [];
      
      const endMeasurement = tracker.startMeasurement('concurrent-init');
      
      // Initialize 10 router instances concurrently
      for (let i = 0; i < 10; i++) {
        initPromises.push(
          new Promise(resolve => {
            const { result } = renderHook(() => useKBRouter(), {
              wrapper: TestWrapper,
            });
            resolve(result);
          })
        );
      }

      await Promise.all(initPromises);
      const duration = endMeasurement();

      expect(duration).toBeLessThan(200); // Should complete within 200ms
    });
  });

  describe('Navigation Performance', () => {
    it('should perform navigation operations quickly', async () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      // Test various navigation operations
      const operations = [
        () => result.current.navigateToSearch('test query'),
        () => result.current.navigateToEntry('entry-123'),
        () => result.current.navigateToAddEntry(),
        () => result.current.navigateToMetrics(),
        () => result.current.navigateToHistory(),
        () => result.current.navigateBack(),
      ];

      for (const [index, operation] of operations.entries()) {
        const endMeasurement = tracker.startMeasurement(`nav-op-${index}`);
        
        await operation();
        
        const duration = endMeasurement();
        expect(duration).toBeLessThan(10); // Each operation should be < 10ms
      }
    });

    it('should handle rapid navigation sequences efficiently', async () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      const endMeasurement = tracker.startMeasurement('rapid-navigation');
      tracker.measureMemory('rapid-nav-start');

      // Simulate rapid navigation (100 operations)
      for (let i = 0; i < 100; i++) {
        const operation = i % 4;
        switch (operation) {
          case 0:
            result.current.navigateToSearch(`query-${i}`);
            break;
          case 1:
            result.current.navigateToEntry(`entry-${i}`);
            break;
          case 2:
            result.current.navigateToAddEntry();
            break;
          case 3:
            result.current.navigateBack();
            break;
        }
      }

      tracker.measureMemory('rapid-nav-end');
      const duration = endMeasurement();

      expect(duration).toBeLessThan(100); // 100 operations in < 100ms
      
      const memoryIncrease = tracker.getMemoryIncrease('rapid-nav-start');
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // Less than 5MB increase
    });
  });

  describe('State Management Performance', () => {
    it('should preserve and restore search context efficiently', async () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      const largeSearchContext = {
        query: 'large search query with many terms',
        category: 'VSAM' as const,
        results: generateLargeSearchResults(1000), // 1000 results
        useAI: true,
      };

      // Test context preservation
      const endPreserve = tracker.startMeasurement('preserve-context');
      result.current.preserveSearchContext(largeSearchContext);
      const preserveDuration = endPreserve();

      expect(preserveDuration).toBeLessThan(20); // Should preserve within 20ms

      // Test context restoration
      const endRestore = tracker.startMeasurement('restore-context');
      const restored = result.current.restoreSearchContext();
      const restoreDuration = endRestore();

      expect(restoreDuration).toBeLessThan(10); // Should restore within 10ms
      expect(restored).toEqual(largeSearchContext);
    });

    it('should handle large navigation history efficiently', async () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      const endMeasurement = tracker.startMeasurement('large-history');
      tracker.measureMemory('history-start');

      // Add 1000 items to navigation history
      for (let i = 0; i < 1000; i++) {
        // Simulate navigation history addition
        mockUseLocation.mockReturnValue({
          pathname: `/route-${i}`,
          search: `?param=${i}`,
          hash: '',
        });
      }

      tracker.measureMemory('history-end');
      const duration = endMeasurement();

      expect(duration).toBeLessThan(100); // Should handle large history efficiently
      
      // Verify history is properly limited
      expect(result.current.state.navigationHistory.length).toBeLessThanOrEqual(20);
      
      const memoryIncrease = tracker.getMemoryIncrease('history-start');
      expect(memoryIncrease).toBeLessThan(2 * 1024 * 1024); // Less than 2MB for history
    });
  });

  describe('URL Utilities Performance', () => {
    it('should generate shareable URLs quickly', async () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      const endMeasurement = tracker.startMeasurement('url-generation');

      // Generate 1000 shareable URLs
      for (let i = 0; i < 1000; i++) {
        const url = result.current.generateShareableURL(`query-${i}`, 'VSAM');
        expect(url).toContain(`query-${i}`);
      }

      const duration = endMeasurement();
      expect(duration).toBeLessThan(50); // Should generate 1000 URLs in < 50ms
    });

    it('should parse URL parameters efficiently', async () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      // Set up complex URL parameters
      mockUseLocation.mockReturnValue({
        pathname: '/search/complex%20query',
        search: '?category=VSAM&ai=false&filter=active&sort=date&page=5',
        hash: '',
      });

      const endMeasurement = tracker.startMeasurement('url-parsing');

      // Parse parameters 1000 times
      for (let i = 0; i < 1000; i++) {
        const params = result.current.parseURLParams();
        expect(params.get('category')).toBe('VSAM');
      }

      const duration = endMeasurement();
      expect(duration).toBeLessThan(30); // Should parse 1000 times in < 30ms
    });

    it('should update URL state efficiently', async () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      const endMeasurement = tracker.startMeasurement('url-updates');

      // Update URL state 100 times with different parameters
      for (let i = 0; i < 100; i++) {
        result.current.updateURLWithState({
          query: `query-${i}`,
          category: i % 2 === 0 ? 'VSAM' : 'JCL',
          useAI: i % 3 === 0,
        });
      }

      const duration = endMeasurement();
      expect(duration).toBeLessThan(100); // Should update 100 times in < 100ms
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory during extended navigation', async () => {
      const { result, unmount } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      tracker.measureMemory('memory-test-start');

      // Simulate extended navigation session
      for (let i = 0; i < 500; i++) {
        result.current.navigateToSearch(`query-${i}`);
        result.current.navigateToEntry(`entry-${i}`);
        result.current.preserveSearchContext({
          query: `query-${i}`,
          category: 'VSAM',
          results: generateLargeSearchResults(10),
          useAI: true,
        });
      }

      tracker.measureMemory('memory-test-peak');

      // Clear history and contexts
      result.current.clearNavigationHistory();

      tracker.measureMemory('memory-test-cleaned');

      unmount();

      tracker.measureMemory('memory-test-end');

      const peakIncrease = tracker.getMemoryIncrease('memory-test-start');
      expect(peakIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });

    it('should garbage collect unused navigation data', async () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      tracker.measureMemory('gc-test-start');

      // Fill history to capacity
      for (let i = 0; i < 50; i++) {
        mockUseLocation.mockReturnValue({
          pathname: `/route-${i}`,
          search: `?large-param=${'x'.repeat(1000)}`,
          hash: '',
        });
      }

      tracker.measureMemory('gc-test-filled');

      // Force garbage collection by adding more items (should remove old ones)
      for (let i = 50; i < 100; i++) {
        mockUseLocation.mockReturnValue({
          pathname: `/route-${i}`,
          search: `?param=${i}`,
          hash: '',
        });
      }

      tracker.measureMemory('gc-test-end');

      // Memory should not continue growing indefinitely
      const totalIncrease = tracker.getMemoryIncrease('gc-test-start');
      expect(totalIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB total

      // History should be limited
      expect(result.current.state.navigationHistory.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent navigation requests efficiently', async () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      const endMeasurement = tracker.startMeasurement('concurrent-nav');

      // Simulate concurrent navigation requests
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          Promise.resolve().then(() => {
            result.current.navigateToSearch(`concurrent-query-${i}`);
            return result.current.generateShareableURL(`query-${i}`, 'VSAM');
          })
        );
      }

      const results = await Promise.all(promises);
      const duration = endMeasurement();

      expect(results).toHaveLength(50);
      expect(duration).toBeLessThan(100); // Should handle 50 concurrent ops in < 100ms
    });

    it('should maintain state consistency under concurrent modifications', async () => {
      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      const operations = [];

      // Create concurrent operations that modify different parts of state
      for (let i = 0; i < 20; i++) {
        operations.push(
          Promise.resolve().then(() => {
            result.current.preserveSearchContext({
              query: `query-${i}`,
              category: 'VSAM',
              results: [],
              useAI: true,
            });
          })
        );

        operations.push(
          Promise.resolve().then(() => {
            result.current.navigateToEntry(`entry-${i}`);
          })
        );
      }

      const endMeasurement = tracker.startMeasurement('concurrent-state');

      await Promise.all(operations);

      const duration = endMeasurement();

      expect(duration).toBeLessThan(50); // Should maintain consistency efficiently
      expect(result.current.state).toBeDefined();
    });
  });
});

describe('Scalability Benchmarks', () => {
  let tracker: PerformanceTracker;

  beforeEach(() => {
    tracker = new PerformanceTracker();
  });

  it('should scale navigation performance linearly', async () => {
    const scales = [10, 50, 100, 500, 1000];
    const results: { scale: number; avgTime: number }[] = [];

    for (const scale of scales) {
      const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <MemoryRouter>
          <AppProvider>
            <SearchProvider>
              <KBRouterProvider>
                {children}
              </KBRouterProvider>
            </SearchProvider>
          </AppProvider>
        </MemoryRouter>
      );

      const { result } = renderHook(() => useKBRouter(), {
        wrapper: TestWrapper,
      });

      const endMeasurement = tracker.startMeasurement(`scale-${scale}`);

      // Perform navigation operations at scale
      for (let i = 0; i < scale; i++) {
        result.current.navigateToSearch(`query-${i}`);
      }

      const duration = endMeasurement();
      results.push({ scale, avgTime: duration / scale });
    }

    // Check that average time per operation remains relatively constant
    const firstAvg = results[0].avgTime;
    const lastAvg = results[results.length - 1].avgTime;

    // Performance degradation should be less than 3x for 100x scale increase
    expect(lastAvg).toBeLessThan(firstAvg * 3);

    console.log('Scalability Results:', results);
  });

  it('should handle large state objects efficiently', async () => {
    const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <MemoryRouter>
        <AppProvider>
          <SearchProvider>
            <KBRouterProvider>
              {children}
            </KBRouterProvider>
          </SearchProvider>
        </AppProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useKBRouter(), {
      wrapper: TestWrapper,
    });

    const sizes = [100, 500, 1000, 2000];
    
    for (const size of sizes) {
      const endMeasurement = tracker.startMeasurement(`large-state-${size}`);
      
      const largeResults = generateLargeSearchResults(size);
      result.current.preserveSearchContext({
        query: 'large query',
        category: 'VSAM',
        results: largeResults,
        useAI: true,
      });

      const duration = endMeasurement();
      
      // Time should scale reasonably with data size
      expect(duration).toBeLessThan(size * 0.1); // Less than 0.1ms per item
    }
  });
});

// Performance regression tests
describe('Performance Regression Tests', () => {
  const performanceBaselines = {
    'router-init': 50, // ms
    'navigation': 10, // ms per operation
    'state-preserve': 20, // ms
    'state-restore': 10, // ms
    'url-generation': 0.05, // ms per URL
    'memory-usage': 10 * 1024 * 1024, // 10MB
  };

  let tracker: PerformanceTracker;

  beforeEach(() => {
    tracker = new PerformanceTracker();
  });

  it('should not regress router initialization performance', async () => {
    const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <MemoryRouter>
        <AppProvider>
          <SearchProvider>
            <KBRouterProvider>
              {children}
            </KBRouterProvider>
          </SearchProvider>
        </AppProvider>
      </MemoryRouter>
    );

    // Run multiple samples
    for (let i = 0; i < 10; i++) {
      const endMeasurement = tracker.startMeasurement('router-init');
      
      renderHook(() => useKBRouter(), { wrapper: TestWrapper });
      
      endMeasurement();
    }

    const avgTime = tracker.getAverageTime('router-init');
    expect(avgTime).toBeLessThan(performanceBaselines['router-init']);
  });

  it('should not regress navigation performance', async () => {
    const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <MemoryRouter>
        <AppProvider>
          <SearchProvider>
            <KBRouterProvider>
              {children}
            </KBRouterProvider>
          </SearchProvider>
        </AppProvider>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useKBRouter(), {
      wrapper: TestWrapper,
    });

    // Test multiple navigation operations
    for (let i = 0; i < 100; i++) {
      const endMeasurement = tracker.startMeasurement('navigation');
      result.current.navigateToSearch(`test-${i}`);
      endMeasurement();
    }

    const avgTime = tracker.getAverageTime('navigation');
    expect(avgTime).toBeLessThan(performanceBaselines['navigation']);
  });
});

// Export performance utilities for use in other tests
export { PerformanceTracker, generateLargeSearchResults };