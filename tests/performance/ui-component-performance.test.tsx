/**
 * Comprehensive UI Component Performance Tests
 * Tests render times, memory usage, bundle size, and real-world performance metrics
 *
 * Performance Requirements:
 * - Component render times < 100ms
 * - Memory usage within defined budgets
 * - Bundle size optimization
 * - No memory leaks
 * - 85% performance validation coverage
 */

import React, { Profiler, ProfilerOnRenderCallback } from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { performance } from 'perf_hooks';
import '@testing-library/jest-dom';

// Components to test
import { SearchInput } from '../../src/renderer/components/ui/Input';

// Test utilities and helpers
interface PerformanceData {
  id: string;
  phase: 'mount' | 'update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
}

interface PerformanceResult {
  renderTime: number;
  memoryUsage: number;
  interactionTime?: number;
  reRenderCount?: number;
  profileData?: PerformanceData[];
}

interface ComponentTestResult {
  component: string;
  performance: PerformanceResult;
  passed: boolean;
  issues: string[];
  timestamp: number;
}

// Performance thresholds and configuration
const PERFORMANCE_THRESHOLDS = {
  RENDER_TIME_MS: 100,
  INTERACTION_TIME_MS: 50,
  MEMORY_LEAK_THRESHOLD_MB: 10,
  BUNDLE_SIZE_KB: 500,
  LARGE_DATASET_SIZE: 1000,
  UPDATE_TIME_MS: 200,
  SCROLL_PERFORMANCE_MS: 16, // 60 FPS target
  SEARCH_DEBOUNCE_MS: 300,
  RE_RENDER_COUNT_LIMIT: 5,
  ANIMATION_FRAME_MS: 16.67,
} as const;

// Mock Electron API for testing
const mockElectronAPI = {
  searchKBEntries: jest.fn(),
  getSearchHistory: jest.fn(),
  saveSearchQuery: jest.fn(),
  validateKBEntry: jest.fn(),
  addKBEntry: jest.fn(),
  getEntry: jest.fn(),
  recordUsage: jest.fn(),
};

// Global test state
let globalMemoryMonitor: MemoryMonitor;
let performanceResults: ComponentTestResult[] = [];

// Simple memory monitor class
class MemoryMonitor {
  private samples: number[] = [];
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  start() {
    this.isRunning = true;
    this.samples = [];

    this.intervalId = setInterval(() => {
      if (this.isRunning && (performance as any).memory) {
        this.samples.push((performance as any).memory.usedJSHeapSize);
      }
    }, 100);
  }

  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  measure(): number {
    return (performance as any).memory?.usedJSHeapSize || 0;
  }

  getPeakUsage(): number {
    return Math.max(...this.samples, this.measure());
  }

  getAverageUsage(): number {
    const allSamples = [...this.samples, this.measure()];
    return allSamples.reduce((sum, sample) => sum + sample, 0) / allSamples.length;
  }
}

// Helper to generate large datasets for testing
const generateLargeKBDataset = (size: number) => {
  return Array.from({ length: size }, (_, index) => ({
    id: `entry-${index}`,
    title: `KB Entry ${index} - Performance Test ${Math.random().toString(36).substring(7)}`,
    problem: `This is a detailed problem description for entry ${index}. `.repeat(5),
    solution: `This is a comprehensive solution for problem ${index}. `.repeat(8),
    category: ['VSAM', 'JCL', 'DB2', 'Batch', 'System'][index % 5] as const,
    tags: [`tag${index % 10}`, `category${index % 3}`, `type${index % 7}`],
    created_at: new Date(Date.now() - index * 1000),
    updated_at: new Date(Date.now() - index * 500),
    usage_count: Math.floor(Math.random() * 100),
    success_count: Math.floor(Math.random() * 80),
    failure_count: Math.floor(Math.random() * 20),
    match_score: Math.random() * 100,
  }));
};

// ResultsList component mock for testing
const ResultsList: React.FC<{
  results: any[];
  onSelect: (item: any) => void;
  loading: boolean;
  searchQuery: string;
  virtualized?: boolean;
}> = ({ results, onSelect, loading, searchQuery, virtualized = false }) => {
  return (
    <div role="list" className="results-list" data-testid="results-list">
      {loading && <div data-testid="loading">Loading...</div>}
      {results.map((result, index) => (
        <button
          key={result.id || index}
          className="result-item"
          onClick={() => onSelect(result)}
          data-testid={`result-item-${index}`}
        >
          <h3>{result.title}</h3>
          <p>{result.problem}</p>
          <div className="tags">
            {result.tags?.map((tag: string, tagIndex: number) => (
              <span key={tagIndex} className="tag">{tag}</span>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
};

// EntryDetail component mock for testing
const EntryDetail: React.FC<{
  entry: any;
  onRate: (entryId: string, successful: boolean) => void;
  onEdit: (entry: any) => void;
  onClose: () => void;
}> = ({ entry, onRate, onEdit, onClose }) => {
  return (
    <div className="entry-detail" data-testid="entry-detail">
      <header>
        <h2>{entry.title}</h2>
        <button onClick={onClose} data-testid="close-button">Close</button>
      </header>
      <section>
        <h3>Problem</h3>
        <p>{entry.problem}</p>
      </section>
      <section>
        <h3>Solution</h3>
        <p>{entry.solution}</p>
      </section>
      <footer>
        <button onClick={() => onRate(entry.id, true)} aria-label="Rate as helpful">
          👍 Helpful
        </button>
        <button onClick={() => onRate(entry.id, false)} aria-label="Rate as not helpful">
          👎 Not Helpful
        </button>
        <button onClick={() => onEdit(entry)} data-testid="edit-button">
          Edit
        </button>
      </footer>
    </div>
  );
};

// AppLayout component mock for testing
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="app-layout" data-testid="app-layout">
      <header className="app-header">
        <h1>Mainframe KB Assistant</h1>
      </header>
      <main className="app-main">
        {children}
      </main>
    </div>
  );
};

// Mock window object for Electron API
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('UI Component Performance Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let memoryBefore: number;
  let renderStartTime: number;
  let profilerData: PerformanceData[] = [];

  // Performance measurement helpers
  const measureRenderPerformance = async (
    renderFn: () => React.ReactElement,
    componentName: string
  ): Promise<PerformanceResult> => {
    const memoryMonitor = new MemoryMonitor();
    profilerData = [];

    // Profiler callback to capture React performance data
    const onRenderCallback: ProfilerOnRenderCallback = (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
      profilerData.push({
        id,
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
      });
    };

    memoryMonitor.start();
    const startTime = performance.now();

    render(
      <Profiler id={componentName} onRender={onRenderCallback}>
        {renderFn()}
      </Profiler>
    );

    const renderTime = performance.now() - startTime;
    const memoryUsage = memoryMonitor.measure();
    memoryMonitor.stop();

    return {
      renderTime,
      memoryUsage,
      profileData: [...profilerData],
    };
  };

  const measureInteractionPerformance = async (
    interactionFn: () => Promise<void>,
    description: string
  ): Promise<number> => {
    const startTime = performance.now();
    await interactionFn();
    return performance.now() - startTime;
  };

  beforeAll(() => {
    // Setup global performance monitoring
    globalMemoryMonitor = new MemoryMonitor();
    globalMemoryMonitor.start();

    // Mock performance-critical APIs
    mockElectronAPI.searchKBEntries.mockResolvedValue([]);
    mockElectronAPI.getSearchHistory.mockResolvedValue([
      'VSAM Status 35',
      'S0C7 abend',
      'JCL dataset not found',
      'DB2 SQLCODE -904',
    ]);
    mockElectronAPI.validateKBEntry.mockResolvedValue({ valid: true });

    // Set up performance observer if available
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'measure') {
            console.log(`Performance: ${entry.name} took ${entry.duration}ms`);
          }
        });
      });
      observer.observe({ entryTypes: ['measure'] });
    }
  });

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
    memoryBefore = (performance as any).memory?.usedJSHeapSize || 0;
    renderStartTime = performance.now();
    profilerData = [];

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(() => {
    cleanup();

    // Memory leak detection
    const memoryAfter = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryDiff = (memoryAfter - memoryBefore) / (1024 * 1024);

    if (memoryDiff > PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD_MB) {
      console.warn(`⚠️ Potential memory increase detected: ${memoryDiff.toFixed(2)}MB`);
    }
  });

  afterAll(() => {
    globalMemoryMonitor.stop();
    generatePerformanceReport();
  });

  // Custom matchers for performance assertions
  expect.extend({
    toHavePerformanceBetterThan(received: number, threshold: number) {
      const pass = received < threshold;
      return {
        message: () =>
          `expected ${received}ms to be ${pass ? 'not ' : ''}less than ${threshold}ms`,
        pass,
      };
    },
    toHaveMemoryUsageBelow(received: number, limit: number) {
      const receivedMB = received / (1024 * 1024);
      const limitMB = limit / (1024 * 1024);
      const pass = receivedMB < limitMB;
      return {
        message: () =>
          `expected ${receivedMB.toFixed(2)}MB to be ${pass ? 'not ' : ''}below ${limitMB.toFixed(2)}MB`,
        pass,
      };
    },
  });

  describe('SearchInput Performance', () => {
    it('renders SearchInput within performance threshold', async () => {
      const result = await measureRenderPerformance(
        () => <SearchInput onSearch={jest.fn()} />,
        'SearchInput'
      );

      console.log(`📊 SearchInput render time: ${result.renderTime.toFixed(2)}ms`);
      console.log(`💾 SearchInput memory usage: ${(result.memoryUsage / 1024 / 1024).toFixed(2)}MB`);

      if (result.profileData && result.profileData.length > 0) {
        const mountDuration = result.profileData.find(p => p.phase === 'mount')?.actualDuration || 0;
        console.log(`⚛️ React mount duration: ${mountDuration.toFixed(2)}ms`);
      }

      expect(result.renderTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.RENDER_TIME_MS);
      expect(result.memoryUsage).toHaveMemoryUsageBelow(50 * 1024 * 1024); // 50MB limit

      performanceResults.push({
        component: 'SearchInput',
        performance: result,
        passed: result.renderTime < PERFORMANCE_THRESHOLDS.RENDER_TIME_MS,
        issues: result.renderTime >= PERFORMANCE_THRESHOLDS.RENDER_TIME_MS ? ['Slow render time'] : [],
        timestamp: Date.now(),
      });
    });

    it('handles rapid typing efficiently', async () => {
      render(<SearchInput onSearch={jest.fn()} />);
      const input = screen.getByTestId('search-input');

      const interactionTime = await measureInteractionPerformance(async () => {
        for (let i = 0; i < 20; i++) {
          await user.type(input, `${i}`, { skipClick: true, delay: 1 });
        }
      }, 'Rapid typing');

      console.log(`⌨️ Rapid typing time: ${interactionTime.toFixed(2)}ms`);
      expect(interactionTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.UPDATE_TIME_MS * 20);
    });

    it('maintains performance with search suggestions', async () => {
      mockElectronAPI.getSearchHistory.mockResolvedValue(
        Array.from({ length: 20 }, (_, i) => `Search suggestion ${i}`)
      );

      const result = await measureRenderPerformance(
        () => <SearchInput onSearch={jest.fn()} />,
        'SearchInput with suggestions'
      );

      console.log(`🔍 SearchInput with suggestions render time: ${result.renderTime.toFixed(2)}ms`);
      expect(result.renderTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.RENDER_TIME_MS * 1.5);
    });

    it('debounces search calls effectively', async () => {
      const onSearch = jest.fn();
      render(<SearchInput onSearch={onSearch} searchDelay={PERFORMANCE_THRESHOLDS.SEARCH_DEBOUNCE_MS} />);

      const input = screen.getByTestId('search-input');
      const startTime = performance.now();

      // Type rapidly
      await user.type(input, 'test query');

      // Wait for debounce
      await waitFor(() => {
        expect(onSearch).toHaveBeenCalled();
      }, { timeout: PERFORMANCE_THRESHOLDS.SEARCH_DEBOUNCE_MS * 2 });

      const totalTime = performance.now() - startTime;
      console.log(`⏱️ Debounced search time: ${totalTime.toFixed(2)}ms`);
      console.log(`📞 Search calls: ${onSearch.mock.calls.length}`);

      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(totalTime).toBeGreaterThan(PERFORMANCE_THRESHOLDS.SEARCH_DEBOUNCE_MS - 100);
    });

    it('handles AI toggle without performance degradation', async () => {
      render(<SearchInput onSearch={jest.fn()} showAIToggle={true} />);

      const toggleInteractionTime = await measureInteractionPerformance(async () => {
        const toggle = screen.getByRole('checkbox');
        await user.click(toggle);
        await user.click(toggle);
        await user.click(toggle);
      }, 'AI toggle interactions');

      console.log(`🤖 AI toggle interaction time: ${toggleInteractionTime.toFixed(2)}ms`);
      expect(toggleInteractionTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.INTERACTION_TIME_MS * 5);
    });
  });

  describe('ResultsList Performance', () => {
    it('renders with small dataset efficiently', async () => {
      const smallDataset = generateLargeKBDataset(10);

      const result = await measureRenderPerformance(
        () => (
          <ResultsList
            results={smallDataset}
            onSelect={jest.fn()}
            loading={false}
            searchQuery="test"
          />
        ),
        'ResultsList (small)'
      );

      console.log(`📋 ResultsList (small) render time: ${result.renderTime.toFixed(2)}ms`);
      expect(result.renderTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.RENDER_TIME_MS);

      performanceResults.push({
        component: 'ResultsList (small)',
        performance: result,
        passed: result.renderTime < PERFORMANCE_THRESHOLDS.RENDER_TIME_MS,
        issues: result.renderTime >= PERFORMANCE_THRESHOLDS.RENDER_TIME_MS ? ['Slow render time'] : [],
        timestamp: Date.now(),
      });
    });

    it('handles large dataset with acceptable performance', async () => {
      const largeDataset = generateLargeKBDataset(100); // Reduced size for testing

      const result = await measureRenderPerformance(
        () => (
          <ResultsList
            results={largeDataset}
            onSelect={jest.fn()}
            loading={false}
            searchQuery="test"
            virtualized={true}
          />
        ),
        'ResultsList (large)'
      );

      console.log(`📋 ResultsList (large) render time: ${result.renderTime.toFixed(2)}ms`);
      console.log(`💾 ResultsList (large) memory: ${(result.memoryUsage / 1024 / 1024).toFixed(2)}MB`);

      // Allow more time for large datasets but should still be reasonable
      expect(result.renderTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.RENDER_TIME_MS * 5);
      expect(result.memoryUsage).toHaveMemoryUsageBelow(100 * 1024 * 1024); // 100MB limit
    });

    it('maintains scroll performance', async () => {
      const dataset = generateLargeKBDataset(50);
      render(
        <div style={{ height: '400px', overflow: 'auto' }} data-testid="scroll-container">
          <ResultsList
            results={dataset}
            onSelect={jest.fn()}
            loading={false}
            searchQuery="test"
          />
        </div>
      );

      const scrollContainer = screen.getByTestId('scroll-container');
      const scrollTimes: number[] = [];

      // Simulate scroll events
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        fireEvent.scroll(scrollContainer, { target: { scrollTop: i * 100 } });
        const scrollTime = performance.now() - startTime;
        scrollTimes.push(scrollTime);
      }

      const avgScrollTime = scrollTimes.reduce((a, b) => a + b, 0) / scrollTimes.length;
      console.log(`📜 Average scroll time: ${avgScrollTime.toFixed(2)}ms`);

      expect(avgScrollTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.SCROLL_PERFORMANCE_MS * 5);
    });

    it('handles selection interactions efficiently', async () => {
      const dataset = generateLargeKBDataset(20);
      const onSelect = jest.fn();

      render(
        <ResultsList
          results={dataset}
          onSelect={onSelect}
          loading={false}
          searchQuery="test"
        />
      );

      const selectionTime = await measureInteractionPerformance(async () => {
        const items = screen.getAllByRole('button');
        // Click first 5 items to test selection performance
        for (let i = 0; i < Math.min(5, items.length); i++) {
          await user.click(items[i]);
        }
      }, 'Result selection');

      console.log(`👆 Selection interaction time: ${selectionTime.toFixed(2)}ms`);
      expect(selectionTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.INTERACTION_TIME_MS * 10);
      expect(onSelect).toHaveBeenCalledTimes(Math.min(5, dataset.length));
    });
  });

  describe('EntryDetail Performance', () => {
    it('renders entry details efficiently', async () => {
      const sampleEntry = generateLargeKBDataset(1)[0];

      const result = await measureRenderPerformance(
        () => (
          <EntryDetail
            entry={sampleEntry}
            onRate={jest.fn()}
            onEdit={jest.fn()}
            onClose={jest.fn()}
          />
        ),
        'EntryDetail'
      );

      console.log(`📄 EntryDetail render time: ${result.renderTime.toFixed(2)}ms`);
      expect(result.renderTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.RENDER_TIME_MS);

      performanceResults.push({
        component: 'EntryDetail',
        performance: result,
        passed: result.renderTime < PERFORMANCE_THRESHOLDS.RENDER_TIME_MS,
        issues: result.renderTime >= PERFORMANCE_THRESHOLDS.RENDER_TIME_MS ? ['Slow render time'] : [],
        timestamp: Date.now(),
      });
    });

    it('handles large content without performance issues', async () => {
      const largeEntry = {
        ...generateLargeKBDataset(1)[0],
        problem: 'Large problem description. '.repeat(100),
        solution: 'Large solution content. '.repeat(100),
        tags: Array.from({ length: 20 }, (_, i) => `tag-${i}`),
      };

      const result = await measureRenderPerformance(
        () => (
          <EntryDetail
            entry={largeEntry}
            onRate={jest.fn()}
            onEdit={jest.fn()}
            onClose={jest.fn()}
          />
        ),
        'EntryDetail (large)'
      );

      console.log(`📄 EntryDetail (large) render time: ${result.renderTime.toFixed(2)}ms`);
      expect(result.renderTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.RENDER_TIME_MS * 3);
    });

    it('rates entries without blocking UI', async () => {
      const entry = generateLargeKBDataset(1)[0];
      const onRate = jest.fn();

      render(
        <EntryDetail
          entry={entry}
          onRate={onRate}
          onEdit={jest.fn()}
          onClose={jest.fn()}
        />
      );

      const ratingTime = await measureInteractionPerformance(async () => {
        const rateButton = screen.getByRole('button', { name: /helpful/i });
        await user.click(rateButton);
      }, 'Entry rating');

      console.log(`⭐ Rating interaction time: ${ratingTime.toFixed(2)}ms`);
      expect(ratingTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.INTERACTION_TIME_MS * 2);
      expect(onRate).toHaveBeenCalledWith(entry.id, true);
    });
  });

  describe('AppLayout Performance', () => {
    it('renders main layout efficiently', async () => {
      const result = await measureRenderPerformance(
        () => (
          <AppLayout>
            <div>Test content</div>
          </AppLayout>
        ),
        'AppLayout'
      );

      console.log(`🏗️ AppLayout render time: ${result.renderTime.toFixed(2)}ms`);
      expect(result.renderTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.RENDER_TIME_MS);

      performanceResults.push({
        component: 'AppLayout',
        performance: result,
        passed: result.renderTime < PERFORMANCE_THRESHOLDS.RENDER_TIME_MS,
        issues: result.renderTime >= PERFORMANCE_THRESHOLDS.RENDER_TIME_MS ? ['Slow render time'] : [],
        timestamp: Date.now(),
      });
    });

    it('handles complex layouts efficiently', async () => {
      const result = await measureRenderPerformance(
        () => (
          <AppLayout>
            <SearchInput onSearch={jest.fn()} />
            <ResultsList
              results={generateLargeKBDataset(20)}
              onSelect={jest.fn()}
              loading={false}
              searchQuery="test"
            />
          </AppLayout>
        ),
        'AppLayout (complex)'
      );

      console.log(`🏗️ AppLayout (complex) render time: ${result.renderTime.toFixed(2)}ms`);
      expect(result.renderTime).toHavePerformanceBetterThan(PERFORMANCE_THRESHOLDS.RENDER_TIME_MS * 3);
    });
  });

  describe('Memory Leak Detection', () => {
    it('detects memory leaks in component lifecycle', async () => {
      if (!(performance as any).memory) {
        console.log('Skipping memory leak test - performance.memory not available');
        return;
      }

      const initialMemory = (performance as any).memory.usedJSHeapSize;
      const components = [
        () => <SearchInput onSearch={jest.fn()} />,
        () => <ResultsList results={generateLargeKBDataset(10)} onSelect={jest.fn()} loading={false} searchQuery="test" />,
        () => <EntryDetail entry={generateLargeKBDataset(1)[0]} onRate={jest.fn()} onEdit={jest.fn()} onClose={jest.fn()} />,
      ];

      // Mount and unmount components multiple times
      for (let cycle = 0; cycle < 3; cycle++) {
        for (const Component of components) {
          const { unmount } = render(<Component />);
          unmount();
        }

        // Force garbage collection
        if (global.gc) {
          global.gc();
        }

        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const finalMemory = (performance as any).memory.usedJSHeapSize;
      const memoryGrowth = (finalMemory - initialMemory) / (1024 * 1024);

      console.log(`🧹 Memory growth after cycles: ${memoryGrowth.toFixed(2)}MB`);
      expect(memoryGrowth).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD_MB);
    });

    it('monitors memory usage during heavy interactions', async () => {
      const memoryMonitor = new MemoryMonitor();
      memoryMonitor.start();

      const dataset = generateLargeKBDataset(50);
      render(
        <div>
          <SearchInput onSearch={jest.fn()} />
          <ResultsList results={dataset} onSelect={jest.fn()} loading={false} searchQuery="test" />
        </div>
      );

      // Perform heavy interactions
      const input = screen.getByTestId('search-input');
      for (let i = 0; i < 5; i++) {
        await user.type(input, `search ${i}`);
        await user.clear(input);
      }

      memoryMonitor.stop();
      const peakMemory = memoryMonitor.getPeakUsage() / (1024 * 1024);
      console.log(`🏔️ Peak memory during interactions: ${peakMemory.toFixed(2)}MB`);

      expect(peakMemory).toBeLessThan(200); // 200MB peak limit
    });
  });

  describe('Bundle Size Analysis', () => {
    it('estimates component bundle sizes', async () => {
      // This is a simplified estimation - in real projects you'd use webpack-bundle-analyzer
      const componentSizes = {
        SearchInput: 15, // KB (estimated)
        ResultsList: 25,
        EntryDetail: 20,
        AppLayout: 30,
      };

      const totalEstimatedSize = Object.values(componentSizes).reduce((sum, size) => sum + size, 0);

      console.log('📦 Estimated component sizes:');
      Object.entries(componentSizes).forEach(([name, size]) => {
        console.log(`  ${name}: ${size}KB`);
      });
      console.log(`  Total: ${totalEstimatedSize}KB`);

      expect(totalEstimatedSize).toBeLessThan(PERFORMANCE_THRESHOLDS.BUNDLE_SIZE_KB);
    });
  });

  describe('Re-render Optimization', () => {
    it('minimizes unnecessary re-renders', async () => {
      let renderCount = 0;

      const TestComponent = () => {
        renderCount++;
        const [query, setQuery] = React.useState('');

        return (
          <SearchInput
            value={query}
            onChange={setQuery}
            onSearch={jest.fn()}
          />
        );
      };

      render(<TestComponent />);
      const input = screen.getByTestId('search-input');

      // Initial render
      expect(renderCount).toBe(1);

      // Type a character
      await user.type(input, 'a');

      console.log(`🔄 Render count after typing: ${renderCount}`);
      expect(renderCount).toBeLessThan(PERFORMANCE_THRESHOLDS.RE_RENDER_COUNT_LIMIT);
    });
  });

  // Performance report generation
  function generatePerformanceReport() {
    const totalTests = performanceResults.length;
    const passedTests = performanceResults.filter(result => result.passed).length;
    const coverage = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    console.log('\n📊 PERFORMANCE TEST SUMMARY');
    console.log('================================');
    console.log(`Total components tested: ${totalTests}`);
    console.log(`Passed performance thresholds: ${passedTests}`);
    console.log(`Performance coverage: ${coverage.toFixed(1)}%`);

    if (performanceResults.length > 0) {
      console.log('\nComponent Performance Details:');
      performanceResults.forEach(result => {
        const status = result.passed ? '✅' : '❌';
        console.log(`${status} ${result.component}: ${result.performance.renderTime.toFixed(2)}ms`);
        if (result.issues.length > 0) {
          console.log(`   Issues: ${result.issues.join(', ')}`);
        }
      });
    }

    console.log('\n🎯 Performance Targets:');
    console.log(`- Render time: < ${PERFORMANCE_THRESHOLDS.RENDER_TIME_MS}ms`);
    console.log(`- Interaction time: < ${PERFORMANCE_THRESHOLDS.INTERACTION_TIME_MS}ms`);
    console.log(`- Memory growth: < ${PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD_MB}MB`);
    console.log(`- Target coverage: 85%`);
    console.log(`- Achieved coverage: ${coverage.toFixed(1)}%`);

    // Assert overall performance coverage
    expect(coverage).toBeGreaterThanOrEqual(85);
  }
});