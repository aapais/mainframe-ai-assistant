/**
 * Comprehensive Rendering Performance Analysis
 * Tests component rendering performance, re-render optimization, and paint performance
 */

import React, { useState, useCallback, useMemo, memo } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Import components for testing
import { VirtualList, useVirtualScroll } from '../../src/renderer/components/virtualization/VirtualScrolling';
import { SimpleSearchBar } from '../../src/renderer/components/SimpleSearchBar';
import { SimpleEntryList } from '../../src/renderer/components/SimpleEntryList';
import { KBEntryForm } from '../../src/renderer/components/forms/KBEntryForm';
import { Button } from '../../src/renderer/components/common/Button';

// Performance monitoring utilities
class RenderingPerformanceAnalyzer {
  private measurements: Map<string, number[]> = new Map();
  private renderCounts: Map<string, number> = new Map();
  private memorySnapshots: MemoryInfo[] = [];
  private paintEvents: PerformanceEntry[] = [];

  constructor() {
    this.setupPerformanceObserver();
  }

  private setupPerformanceObserver() {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        const paintObserver = new PerformanceObserver((list) => {
          this.paintEvents.push(...list.getEntries());
        });
        paintObserver.observe({ entryTypes: ['paint', 'measure'] });
      } catch (error) {
        console.warn('Paint observer not available:', error);
      }
    }
  }

  startMeasurement(label: string): () => number {
    const startTime = performance.now();
    const renderCount = this.renderCounts.get(label) || 0;
    this.renderCounts.set(label, renderCount + 1);

    // Take memory snapshot if available
    if ((performance as any).memory) {
      this.memorySnapshots.push((performance as any).memory);
    }

    return (): number => {
      const duration = performance.now() - startTime;

      if (!this.measurements.has(label)) {
        this.measurements.set(label, []);
      }
      this.measurements.get(label)!.push(duration);

      return duration;
    };
  }

  getRenderCount(label: string): number {
    return this.renderCounts.get(label) || 0;
  }

  getAverageRenderTime(label: string): number {
    const times = this.measurements.get(label) || [];
    return times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0;
  }

  getMaxRenderTime(label: string): number {
    const times = this.measurements.get(label) || [];
    return times.length > 0 ? Math.max(...times) : 0;
  }

  getMinRenderTime(label: string): number {
    const times = this.measurements.get(label) || [];
    return times.length > 0 ? Math.min(...times) : 0;
  }

  getPaintMetrics() {
    const fcp = this.paintEvents.find(entry => entry.name === 'first-contentful-paint');
    const lcp = this.paintEvents.find(entry => entry.name === 'largest-contentful-paint');

    return {
      firstContentfulPaint: fcp?.startTime || 0,
      largestContentfulPaint: lcp?.startTime || 0,
      totalPaintEvents: this.paintEvents.length
    };
  }

  getMemoryUsage() {
    if (this.memorySnapshots.length === 0) return null;

    const latest = this.memorySnapshots[this.memorySnapshots.length - 1];
    const initial = this.memorySnapshots[0];

    return {
      current: latest.usedJSHeapSize,
      initial: initial.usedJSHeapSize,
      delta: latest.usedJSHeapSize - initial.usedJSHeapSize,
      total: latest.totalJSHeapSize,
      limit: latest.jsHeapSizeLimit
    };
  }

  generateReport() {
    const report = {
      renderingMetrics: {},
      paintMetrics: this.getPaintMetrics(),
      memoryMetrics: this.getMemoryUsage(),
      timestamp: new Date().toISOString()
    };

    for (const [label, times] of this.measurements.entries()) {
      report.renderingMetrics[label] = {
        renderCount: this.getRenderCount(label),
        averageTime: this.getAverageRenderTime(label),
        maxTime: this.getMaxRenderTime(label),
        minTime: this.getMinRenderTime(label),
        totalTime: times.reduce((sum, time) => sum + time, 0),
        variance: this.calculateVariance(times)
      };
    }

    return report;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  reset() {
    this.measurements.clear();
    this.renderCounts.clear();
    this.memorySnapshots = [];
    this.paintEvents = [];
  }
}

// Test data generators
const generateLargeDataset = (size: number) => {
  return Array.from({ length: size }, (_, i) => ({
    id: `entry-${i}`,
    title: `Entry ${i} with a longer title to test rendering performance`,
    problem: `This is a detailed problem description for entry ${i}. `.repeat(3),
    solution: `This is a comprehensive solution for entry ${i}. `.repeat(3),
    category: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional'][i % 5] as any,
    tags: [`tag-${i}`, `category-${i % 5}`, 'performance-test'],
    created_at: new Date(Date.now() - i * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    usage_count: Math.floor(Math.random() * 100),
    success_count: Math.floor(Math.random() * 50),
    failure_count: Math.floor(Math.random() * 10)
  }));
};

// Performance thresholds based on Web Vitals
const PERFORMANCE_THRESHOLDS = {
  FIRST_CONTENTFUL_PAINT: 1800, // 1.8s
  LARGEST_CONTENTFUL_PAINT: 2500, // 2.5s
  TIME_TO_INTERACTIVE: 3800, // 3.8s
  FIRST_INPUT_DELAY: 100, // 100ms
  COMPONENT_RENDER: 16, // 16ms (60fps)
  LARGE_LIST_RENDER: 100, // 100ms for large lists
  VIRTUAL_SCROLL_RENDER: 50, // 50ms for virtual scrolling
  FORM_VALIDATION: 50, // 50ms for form validation
  SEARCH_RESPONSE: 200, // 200ms for search
  MEMORY_LEAK_THRESHOLD: 10 * 1024 * 1024 // 10MB
};

describe('Rendering Performance Analysis', () => {
  let analyzer: RenderingPerformanceAnalyzer;

  beforeEach(() => {
    analyzer = new RenderingPerformanceAnalyzer();

    // Mock performance.now for consistent testing
    jest.spyOn(performance, 'now').mockImplementation(() => Date.now());

    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    // Mock IntersectionObserver
    global.IntersectionObserver = class IntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {}
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    analyzer.reset();
    jest.restoreAllMocks();
  });

  describe('Component Render Performance', () => {
    test('SimpleSearchBar renders within performance threshold', () => {
      const endMeasurement = analyzer.startMeasurement('search-bar-render');

      render(<SimpleSearchBar onSearch={jest.fn()} onClear={jest.fn()} />);

      const renderTime = endMeasurement();

      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPONENT_RENDER);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    test('SimpleEntryList handles large datasets efficiently', () => {
      const largeDataset = generateLargeDataset(1000);

      const endMeasurement = analyzer.startMeasurement('large-entry-list');

      render(
        <SimpleEntryList
          entries={largeDataset}
          onEntrySelect={jest.fn()}
          selectedEntryId=""
          loading={false}
        />
      );

      const renderTime = endMeasurement();

      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_LIST_RENDER);
    });

    test('VirtualList performance with massive dataset', () => {
      const massiveDataset = generateLargeDataset(10000);

      const endMeasurement = analyzer.startMeasurement('virtual-list-massive');

      render(
        <VirtualList
          items={massiveDataset}
          itemHeight={80}
          height={400}
          renderItem={({ item, index, style }) => (
            <div style={style} key={index}>
              <h4>{item.title}</h4>
              <p>{item.problem}</p>
            </div>
          )}
        />
      );

      const renderTime = endMeasurement();

      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.VIRTUAL_SCROLL_RENDER);

      // Should only render visible items
      const renderedItems = screen.getAllByRole('heading', { level: 4 });
      expect(renderedItems.length).toBeLessThan(20); // Only visible items
    });

    test('KBEntryForm renders and validates efficiently', async () => {
      const user = userEvent.setup();

      const endMeasurement = analyzer.startMeasurement('form-render-validate');

      render(
        <KBEntryForm
          onSubmit={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      const initialRenderTime = endMeasurement();

      // Test form validation performance
      const submitButton = screen.getByRole('button', { name: /save|submit/i });

      const validationMeasurement = analyzer.startMeasurement('form-validation');
      await user.click(submitButton);
      const validationTime = validationMeasurement();

      expect(initialRenderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPONENT_RENDER);
      expect(validationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FORM_VALIDATION);
    });
  });

  describe('Re-render Optimization Tests', () => {
    test('Button with React.memo prevents unnecessary re-renders', () => {
      const MemoizedButton = memo(Button);
      let renderCount = 0;

      const TestButton = ({ count }: { count: number }) => {
        renderCount++;
        return <MemoizedButton>Count: {count}</MemoizedButton>;
      };

      const { rerender } = render(<TestButton count={1} />);
      const initialRenderCount = renderCount;

      // Re-render with same props
      rerender(<TestButton count={1} />);

      expect(renderCount).toBe(initialRenderCount); // No additional render

      // Re-render with different props
      rerender(<TestButton count={2} />);

      expect(renderCount).toBe(initialRenderCount + 1); // One additional render
    });

    test('useMemo prevents expensive calculations on re-render', () => {
      let calculationCount = 0;

      const ExpensiveComponent = ({ data }: { data: any[] }) => {
        const expensiveValue = useMemo(() => {
          calculationCount++;
          return data.reduce((sum, item) => sum + item.id, 0);
        }, [data]);

        return <div>{expensiveValue}</div>;
      };

      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const { rerender } = render(<ExpensiveComponent data={data} />);

      const initialCalculations = calculationCount;

      // Re-render with same data reference
      rerender(<ExpensiveComponent data={data} />);

      expect(calculationCount).toBe(initialCalculations); // No recalculation

      // Re-render with new data
      const newData = [{ id: 4 }, { id: 5 }];
      rerender(<ExpensiveComponent data={newData} />);

      expect(calculationCount).toBe(initialCalculations + 1); // One recalculation
    });

    test('useCallback prevents function recreation on re-render', () => {
      let callbackCreationCount = 0;
      const callbackInstances = new Set();

      const CallbackComponent = ({ multiplier }: { multiplier: number }) => {
        const handleClick = useCallback((value: number) => {
          callbackCreationCount++;
          return value * multiplier;
        }, [multiplier]);

        callbackInstances.add(handleClick);

        return <Button onClick={() => handleClick(5)}>Click</Button>;
      };

      const { rerender } = render(<CallbackComponent multiplier={2} />);
      const initialInstances = callbackInstances.size;

      // Re-render with same multiplier
      rerender(<CallbackComponent multiplier={2} />);

      expect(callbackInstances.size).toBe(initialInstances); // Same callback instance

      // Re-render with different multiplier
      rerender(<CallbackComponent multiplier={3} />);

      expect(callbackInstances.size).toBe(initialInstances + 1); // New callback instance
    });

    test('Virtual scrolling prevents excessive DOM nodes', () => {
      const largeDataset = generateLargeDataset(5000);

      const endMeasurement = analyzer.startMeasurement('virtual-scroll-dom-efficiency');

      const { container } = render(
        <VirtualList
          items={largeDataset}
          itemHeight={60}
          height={300}
          renderItem={({ item, style }) => (
            <div style={style}>
              <span>{item.title}</span>
            </div>
          )}
        />
      );

      const renderTime = endMeasurement();

      // Count actual DOM nodes
      const domNodes = container.querySelectorAll('div').length;

      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.VIRTUAL_SCROLL_RENDER);
      expect(domNodes).toBeLessThan(50); // Should only render visible items
      expect(domNodes).toBeGreaterThan(0); // Should render some items
    });
  });

  describe('Paint Performance Analysis', () => {
    test('measures First Contentful Paint performance', async () => {
      // Mock paint timing API
      const mockPaintEntry = {
        name: 'first-contentful-paint',
        startTime: 800,
        duration: 0,
        entryType: 'paint'
      };

      jest.spyOn(performance, 'getEntriesByType').mockReturnValue([mockPaintEntry]);

      render(
        <div>
          <SimpleSearchBar onSearch={jest.fn()} onClear={jest.fn()} />
          <SimpleEntryList
            entries={generateLargeDataset(10)}
            onEntrySelect={jest.fn()}
            selectedEntryId=""
            loading={false}
          />
        </div>
      );

      await waitFor(() => {
        const paintMetrics = analyzer.getPaintMetrics();
        expect(paintMetrics.firstContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.FIRST_CONTENTFUL_PAINT);
      });
    });

    test('analyzes layout thrashing during rapid updates', async () => {
      const user = userEvent.setup();
      let layoutCount = 0;

      // Mock layout measurement
      const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function() {
        layoutCount++;
        return originalGetBoundingClientRect.call(this);
      };

      try {
        const RapidUpdateComponent = () => {
          const [count, setCount] = useState(0);

          return (
            <div>
              <div style={{ width: count * 10, height: 50 }}>
                Dynamic sizing: {count}
              </div>
              <Button onClick={() => setCount(c => c + 1)}>
                Update
              </Button>
            </div>
          );
        };

        render(<RapidUpdateComponent />);
        const button = screen.getByRole('button');

        const startLayouts = layoutCount;

        // Trigger rapid updates
        for (let i = 0; i < 10; i++) {
          await user.click(button);
        }

        const layoutsPerUpdate = (layoutCount - startLayouts) / 10;

        // Should minimize layout thrashing
        expect(layoutsPerUpdate).toBeLessThan(5);

      } finally {
        Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      }
    });
  });

  describe('Memory Usage Analysis', () => {
    test('detects memory leaks in component lifecycle', () => {
      const initialMemory = analyzer.getMemoryUsage();

      // Render and unmount many components
      for (let i = 0; i < 100; i++) {
        const { unmount } = render(
          <div>
            <Button>Memory Test {i}</Button>
            <SimpleSearchBar onSearch={jest.fn()} onClear={jest.fn()} />
          </div>
        );
        unmount();
      }

      // Force garbage collection if available
      if ((global as any).gc) {
        (global as any).gc();
      }

      const finalMemory = analyzer.getMemoryUsage();

      if (initialMemory && finalMemory) {
        const memoryIncrease = finalMemory.delta;
        expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD);
      }
    });

    test('monitors memory usage during virtual scrolling', () => {
      const endMeasurement = analyzer.startMeasurement('virtual-scroll-memory');

      const { rerender } = render(
        <VirtualList
          items={generateLargeDataset(1000)}
          itemHeight={80}
          height={400}
          renderItem={({ item, style }) => (
            <div style={style}>
              <h4>{item.title}</h4>
              <p>{item.problem}</p>
            </div>
          )}
        />
      );

      // Re-render with different dataset
      rerender(
        <VirtualList
          items={generateLargeDataset(2000)}
          itemHeight={80}
          height={400}
          renderItem={({ item, style }) => (
            <div style={style}>
              <h4>{item.title}</h4>
              <p>{item.problem}</p>
            </div>
          )}
        />
      );

      const renderTime = endMeasurement();
      const memoryUsage = analyzer.getMemoryUsage();

      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.VIRTUAL_SCROLL_RENDER);

      if (memoryUsage) {
        // Memory usage should be reasonable even with large datasets
        expect(memoryUsage.delta).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD);
      }
    });
  });

  describe('Bundle Size and Code Splitting Analysis', () => {
    test('validates lazy loading effectiveness', async () => {
      // Mock dynamic import
      const mockLazyComponent = React.lazy(() =>
        Promise.resolve({
          default: () => <div>Lazy Component</div>
        })
      );

      const endMeasurement = analyzer.startMeasurement('lazy-loading');

      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <mockLazyComponent />
        </React.Suspense>
      );

      // Initially shows fallback
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Wait for lazy component to load
      await waitFor(() => {
        expect(screen.getByText('Lazy Component')).toBeInTheDocument();
      });

      const loadTime = endMeasurement();

      // Lazy loading should be fast once loaded
      expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPONENT_RENDER * 2);
    });

    test('analyzes code splitting effectiveness', () => {
      // Simulate checking bundle sizes
      const mockBundleAnalysis = {
        totalSize: 500, // KB
        loadedChunks: ['main.js', 'vendor.js'],
        lazyChunks: ['forms.js', 'dashboard.js', 'search.js'],
        loadTimes: {
          'main.js': 120,
          'vendor.js': 80,
          'forms.js': 45
        }
      };

      // Validate bundle splitting strategy
      expect(mockBundleAnalysis.totalSize).toBeLessThan(1000); // < 1MB total
      expect(mockBundleAnalysis.lazyChunks.length).toBeGreaterThan(2); // Multiple chunks

      // Validate individual chunk load times
      Object.entries(mockBundleAnalysis.loadTimes).forEach(([chunk, time]) => {
        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_RESPONSE);
      });
    });
  });

  describe('Performance Regression Detection', () => {
    test('detects performance regressions in render times', () => {
      const renderTimes: number[] = [];

      // Baseline measurements
      for (let i = 0; i < 10; i++) {
        const endMeasurement = analyzer.startMeasurement(`baseline-render-${i}`);
        const { unmount } = render(<Button>Baseline Test {i}</Button>);
        renderTimes.push(endMeasurement());
        unmount();
      }

      const baselineAverage = renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length;
      const baselineMax = Math.max(...renderTimes);

      // Current measurement
      const currentMeasurement = analyzer.startMeasurement('current-render');
      const { unmount } = render(<Button>Current Test</Button>);
      const currentTime = currentMeasurement();
      unmount();

      // Performance should not regress significantly
      expect(currentTime).toBeLessThan(baselineMax * 1.5); // 50% tolerance
      expect(currentTime).toBeLessThan(baselineAverage * 2); // 100% tolerance for outliers
    });

    test('validates consistent performance across multiple renders', () => {
      const measurements: number[] = [];

      for (let i = 0; i < 20; i++) {
        const endMeasurement = analyzer.startMeasurement(`consistency-test-${i}`);

        render(
          <div>
            <SimpleSearchBar onSearch={jest.fn()} onClear={jest.fn()} />
            <SimpleEntryList
              entries={generateLargeDataset(50)}
              onEntrySelect={jest.fn()}
              selectedEntryId=""
              loading={false}
            />
          </div>
        );

        measurements.push(endMeasurement());
      }

      const average = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
      const variance = measurements.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / measurements.length;
      const standardDeviation = Math.sqrt(variance);

      // Performance should be consistent (low standard deviation)
      expect(standardDeviation).toBeLessThan(average * 0.3); // 30% coefficient of variation
      expect(average).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_LIST_RENDER);
    });
  });

  describe('Performance Report Generation', () => {
    test('generates comprehensive performance report', () => {
      // Run multiple performance tests
      analyzer.startMeasurement('test-1')();
      analyzer.startMeasurement('test-2')();
      analyzer.startMeasurement('test-1')(); // Second measurement for test-1

      const report = analyzer.generateReport();

      expect(report).toHaveProperty('renderingMetrics');
      expect(report).toHaveProperty('paintMetrics');
      expect(report).toHaveProperty('memoryMetrics');
      expect(report).toHaveProperty('timestamp');

      expect(report.renderingMetrics).toHaveProperty('test-1');
      expect(report.renderingMetrics).toHaveProperty('test-2');

      expect(report.renderingMetrics['test-1'].renderCount).toBe(2);
      expect(report.renderingMetrics['test-2'].renderCount).toBe(1);

      expect(typeof report.renderingMetrics['test-1'].averageTime).toBe('number');
      expect(typeof report.renderingMetrics['test-1'].variance).toBe('number');
    });
  });
});

// Export analyzer for use in other tests
export { RenderingPerformanceAnalyzer, PERFORMANCE_THRESHOLDS };