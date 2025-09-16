/**
 * Performance Optimization Component Patterns Tests
 *
 * Tests for React performance patterns including memoization, virtualization,
 * lazy loading, code splitting, and optimization strategies.
 *
 * @author UI Testing Specialist
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';

import {
  ComponentInteractionTester,
  ComponentCommunicationTester
} from './ComponentInteractionTestSuite';

// Performance monitoring utilities
const performanceMarks = new Map<string, number>();

const startPerformanceMark = (name: string) => {
  performanceMarks.set(name, performance.now());
};

const endPerformanceMark = (name: string): number => {
  const start = performanceMarks.get(name);
  if (!start) return 0;

  const duration = performance.now() - start;
  performanceMarks.delete(name);
  return duration;
};

// Mock heavy computation
const heavyComputation = (iterations: number = 1000000): number => {
  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.random();
  }
  return result;
};

// Memoization patterns
interface ExpensiveComponentProps {
  data: any[];
  computationIntensity?: number;
  onRender?: () => void;
  cacheKey?: string;
}

const ExpensiveComponent: React.FC<ExpensiveComponentProps> = React.memo(({
  data,
  computationIntensity = 100000,
  onRender,
  cacheKey
}) => {
  onRender?.();

  const expensiveValue = React.useMemo(() => {
    startPerformanceMark('expensive-computation');
    const result = heavyComputation(computationIntensity);
    const duration = endPerformanceMark('expensive-computation');
    console.log(`Expensive computation took ${duration}ms`);
    return result;
  }, [computationIntensity, cacheKey]);

  const processedData = React.useMemo(() => {
    return data.map(item => ({
      ...item,
      processed: true,
      timestamp: Date.now()
    }));
  }, [data]);

  return (
    <div data-testid="expensive-component">
      <div data-testid="expensive-value">Value: {expensiveValue.toFixed(2)}</div>
      <div data-testid="processed-data-count">Processed: {processedData.length}</div>
      <ul>
        {processedData.slice(0, 5).map((item, index) => (
          <li key={item.id || index} data-testid={`processed-item-${index}`}>
            {JSON.stringify(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function
  return (
    prevProps.data.length === nextProps.data.length &&
    prevProps.computationIntensity === nextProps.computationIntensity &&
    prevProps.cacheKey === nextProps.cacheKey
  );
});

ExpensiveComponent.displayName = 'ExpensiveComponent';

// Virtual scrolling component
interface VirtualListProps {
  items: any[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: any, index: number) => React.ReactNode;
  overscan?: number;
  onScroll?: (scrollTop: number) => void;
}

const VirtualList: React.FC<VirtualListProps> = ({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  onScroll
}) => {
  const [scrollTop, setScrollTop] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    items.length
  );

  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(items.length, visibleEnd + overscan);

  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  const visibleItems = React.useMemo(() => {
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex]);

  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, [onScroll]);

  return (
    <div
      ref={containerRef}
      data-testid="virtual-list"
      style={{
        height: containerHeight,
        overflow: 'auto'
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={startIndex + index}
              style={{ height: itemHeight }}
              data-testid={`virtual-item-${startIndex + index}`}
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Lazy loading component
interface LazyComponentProps {
  delay?: number;
  fallback?: React.ReactNode;
  onLoad?: () => void;
}

const LazyContent: React.FC<LazyComponentProps> = ({ delay = 1000, onLoad }) => {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onLoad?.();
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, onLoad]);

  return (
    <div data-testid="lazy-content">
      <h3>Lazy Loaded Content</h3>
      <p>This content was loaded after {delay}ms</p>
    </div>
  );
};

const LazyComponent = React.lazy(() =>
  new Promise<{ default: React.ComponentType<LazyComponentProps> }>(resolve => {
    setTimeout(() => {
      resolve({ default: LazyContent });
    }, 100);
  })
);

// Debounced input component
interface DebouncedInputProps {
  onSearch: (value: string) => void;
  delay?: number;
  placeholder?: string;
}

const DebouncedInput: React.FC<DebouncedInputProps> = ({
  onSearch,
  delay = 300,
  placeholder = 'Search...'
}) => {
  const [value, setValue] = React.useState('');
  const [searchCount, setSearchCount] = React.useState(0);

  const debouncedSearch = React.useMemo(
    () => {
      let timeoutId: NodeJS.Timeout;

      return (searchValue: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          onSearch(searchValue);
          setSearchCount(prev => prev + 1);
        }, delay);
      };
    },
    [onSearch, delay]
  );

  React.useEffect(() => {
    if (value) {
      debouncedSearch(value);
    }
  }, [value, debouncedSearch]);

  return (
    <div data-testid="debounced-input-container">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        data-testid="debounced-input"
      />
      <div data-testid="search-count">Search calls: {searchCount}</div>
    </div>
  );
};

// Throttled scroll component
interface ThrottledScrollProps {
  onScroll: (scrollY: number) => void;
  throttleMs?: number;
  children: React.ReactNode;
}

const ThrottledScroll: React.FC<ThrottledScrollProps> = ({
  onScroll,
  throttleMs = 100,
  children
}) => {
  const [scrollCount, setScrollCount] = React.useState(0);
  const lastScrollTime = React.useRef(0);

  const throttledScrollHandler = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const now = Date.now();

    if (now - lastScrollTime.current >= throttleMs) {
      lastScrollTime.current = now;
      onScroll(e.currentTarget.scrollTop);
      setScrollCount(prev => prev + 1);
    }
  }, [onScroll, throttleMs]);

  return (
    <div
      data-testid="throttled-scroll-container"
      style={{ height: '200px', overflow: 'auto' }}
      onScroll={throttledScrollHandler}
    >
      <div data-testid="scroll-count">Scroll events: {scrollCount}</div>
      <div style={{ height: '1000px' }}>
        {children}
      </div>
    </div>
  );
};

// Optimized list component with windowing
interface OptimizedListProps {
  items: any[];
  onItemClick?: (item: any, index: number) => void;
  enableVirtualization?: boolean;
  itemHeight?: number;
}

const OptimizedList: React.FC<OptimizedListProps> = ({
  items,
  onItemClick,
  enableVirtualization = true,
  itemHeight = 50
}) => {
  const [renderCount, setRenderCount] = React.useState(0);

  React.useEffect(() => {
    setRenderCount(prev => prev + 1);
  });

  const renderItem = React.useCallback((item: any, index: number) => (
    <div
      key={item.id || index}
      style={{
        padding: '10px',
        borderBottom: '1px solid #eee',
        cursor: onItemClick ? 'pointer' : 'default'
      }}
      onClick={onItemClick ? () => onItemClick(item, index) : undefined}
      data-testid={`list-item-${index}`}
    >
      <div>Item {index}: {item.name || item.title || `Item ${index}`}</div>
      <div style={{ fontSize: '12px', color: '#666' }}>
        ID: {item.id || index}
      </div>
    </div>
  ), [onItemClick]);

  if (enableVirtualization && items.length > 100) {
    return (
      <div data-testid="optimized-list">
        <div data-testid="render-count">Renders: {renderCount}</div>
        <VirtualList
          items={items}
          itemHeight={itemHeight}
          containerHeight={300}
          renderItem={renderItem}
        />
      </div>
    );
  }

  return (
    <div data-testid="optimized-list">
      <div data-testid="render-count">Renders: {renderCount}</div>
      <div style={{ height: '300px', overflow: 'auto' }}>
        {items.map((item, index) => renderItem(item, index))}
      </div>
    </div>
  );
};

// Performance monitoring hook
const usePerformanceMonitor = (componentName: string) => {
  const renderCount = React.useRef(0);
  const renderTimes = React.useRef<number[]>([]);

  React.useEffect(() => {
    renderCount.current += 1;
    const renderTime = performance.now();
    renderTimes.current.push(renderTime);

    if (renderTimes.current.length > 10) {
      renderTimes.current = renderTimes.current.slice(-10);
    }
  });

  const getAverageRenderTime = React.useCallback(() => {
    if (renderTimes.current.length < 2) return 0;

    const intervals = [];
    for (let i = 1; i < renderTimes.current.length; i++) {
      intervals.push(renderTimes.current[i] - renderTimes.current[i - 1]);
    }

    return intervals.reduce((sum, time) => sum + time, 0) / intervals.length;
  }, []);

  return {
    renderCount: renderCount.current,
    averageRenderTime: getAverageRenderTime(),
    componentName
  };
};

const MonitoredComponent: React.FC<{ data: any[]; onUpdate?: () => void }> = ({
  data,
  onUpdate
}) => {
  const performance = usePerformanceMonitor('MonitoredComponent');

  React.useEffect(() => {
    onUpdate?.();
  }, [data, onUpdate]);

  return (
    <div data-testid="monitored-component">
      <div data-testid="component-name">Component: {performance.componentName}</div>
      <div data-testid="render-count">Renders: {performance.renderCount}</div>
      <div data-testid="average-render-time">
        Avg Render Interval: {performance.averageRenderTime.toFixed(2)}ms
      </div>
      <div data-testid="data-length">Data Length: {data.length}</div>
    </div>
  );
};

describe('Performance Optimization Component Patterns', () => {
  let tester: ComponentInteractionTester;
  let communicationTester: ComponentCommunicationTester;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    tester = new ComponentInteractionTester();
    communicationTester = new ComponentCommunicationTester();
    user = userEvent.setup();

    // Mock performance.now for consistent testing
    jest.spyOn(performance, 'now').mockImplementation(() => Date.now());
  });

  afterEach(() => {
    tester.resetMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Memoization Patterns', () => {
    it('should prevent unnecessary re-renders with React.memo', async () => {
      const onRender = tester.createMock('onRender');
      const testData = [{ id: 1, name: 'Item 1' }];

      const { rerender } = render(
        <ExpensiveComponent
          data={testData}
          onRender={onRender}
          computationIntensity={1000}
        />
      );

      expect(onRender).toHaveBeenCalledTimes(1);

      // Re-render with same props - should not trigger re-render
      rerender(
        <ExpensiveComponent
          data={testData}
          onRender={onRender}
          computationIntensity={1000}
        />
      );

      expect(onRender).toHaveBeenCalledTimes(1);

      // Re-render with different props - should trigger re-render
      rerender(
        <ExpensiveComponent
          data={testData}
          onRender={onRender}
          computationIntensity={2000}
        />
      );

      expect(onRender).toHaveBeenCalledTimes(2);
    });

    it('should memoize expensive computations with useMemo', async () => {
      const testData = [{ id: 1, name: 'Item 1' }];

      const { rerender } = render(
        <ExpensiveComponent
          data={testData}
          computationIntensity={50000}
          cacheKey="test-key-1"
        />
      );

      const initialValue = screen.getByTestId('expensive-value').textContent;

      // Re-render with same cache key - should use memoized value
      rerender(
        <ExpensiveComponent
          data={testData}
          computationIntensity={50000}
          cacheKey="test-key-1"
        />
      );

      expect(screen.getByTestId('expensive-value')).toHaveTextContent(initialValue!);

      // Re-render with different cache key - should recompute
      rerender(
        <ExpensiveComponent
          data={testData}
          computationIntensity={50000}
          cacheKey="test-key-2"
        />
      );

      // Value might be different due to randomness in computation
      const newValue = screen.getByTestId('expensive-value').textContent;
      expect(newValue).toBeDefined();
    });

    it('should memoize processed data transformations', async () => {
      const initialData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ];

      const { rerender } = render(
        <ExpensiveComponent data={initialData} />
      );

      expect(screen.getByTestId('processed-data-count')).toHaveTextContent('Processed: 2');

      // Re-render with same data - should not reprocess
      rerender(<ExpensiveComponent data={initialData} />);

      expect(screen.getByTestId('processed-data-count')).toHaveTextContent('Processed: 2');

      // Re-render with different data - should reprocess
      const newData = [...initialData, { id: 3, name: 'Item 3' }];
      rerender(<ExpensiveComponent data={newData} />);

      expect(screen.getByTestId('processed-data-count')).toHaveTextContent('Processed: 3');
    });
  });

  describe('Virtual Scrolling Performance', () => {
    it('should render only visible items in virtual list', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`
      }));

      const renderItem = jest.fn((item, index) => (
        <div key={index}>
          {item.name} - {index}
        </div>
      ));

      const onScroll = tester.createMock('onScroll');

      render(
        <VirtualList
          items={largeDataset}
          itemHeight={50}
          containerHeight={300}
          renderItem={renderItem}
          onScroll={onScroll}
          overscan={2}
        />
      );

      // Should only render visible + overscan items
      const expectedVisibleItems = Math.ceil(300 / 50) + 4; // 6 visible + 4 overscan
      expect(renderItem).toHaveBeenCalledTimes(expectedVisibleItems);

      // Verify only visible items are in DOM
      const virtualItems = screen.getAllByTestId(/virtual-item-/);
      expect(virtualItems.length).toBeLessThan(20); // Much less than 1000

      // Test scrolling
      const virtualList = screen.getByTestId('virtual-list');
      fireEvent.scroll(virtualList, { target: { scrollTop: 500 } });

      expect(onScroll).toHaveBeenCalledWith(500);
    });

    it('should handle large datasets efficiently', async () => {
      const veryLargeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `Description for item ${i}`
      }));

      const startTime = performance.now();

      render(
        <VirtualList
          items={veryLargeDataset}
          itemHeight={60}
          containerHeight={400}
          renderItem={(item, index) => (
            <div key={index} style={{ padding: '10px' }}>
              <strong>{item.name}</strong>
              <p>{item.description}</p>
            </div>
          )}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Rendering should be fast even with large dataset
      expect(renderTime).toBeLessThan(100); // Should render in under 100ms

      // Verify that not all items are rendered
      const renderedItems = screen.getAllByTestId(/virtual-item-/);
      expect(renderedItems.length).toBeLessThan(50); // Much less than 10000
    });
  });

  describe('Lazy Loading and Code Splitting', () => {
    it('should handle lazy component loading', async () => {
      const onLoad = tester.createMock('onLoad');

      render(
        <React.Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <LazyComponent delay={100} onLoad={onLoad} />
        </React.Suspense>
      );

      // Should show fallback initially
      expect(screen.getByTestId('loading')).toBeInTheDocument();

      // Wait for lazy component to load
      await waitFor(() => {
        expect(screen.getByTestId('lazy-content')).toBeInTheDocument();
      }, { timeout: 200 });

      // Should not show loading anymore
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();

      // Wait for onLoad callback
      await waitFor(() => {
        expect(onLoad).toHaveBeenCalled();
      }, { timeout: 200 });
    });
  });

  describe('Debouncing and Throttling', () => {
    it('should debounce search input effectively', async () => {
      jest.useFakeTimers();

      const onSearch = tester.createMock('onSearch');

      render(<DebouncedInput onSearch={onSearch} delay={300} />);

      const input = screen.getByTestId('debounced-input');

      // Type rapidly
      await user.type(input, 'test');

      // Should not have called onSearch yet
      expect(onSearch).not.toHaveBeenCalled();

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Should have called onSearch once with final value
      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(onSearch).toHaveBeenCalledWith('test');

      // Verify search count
      expect(screen.getByTestId('search-count')).toHaveTextContent('Search calls: 1');

      jest.useRealTimers();
    });

    it('should throttle scroll events', async () => {
      const onScroll = tester.createMock('onScroll');

      render(
        <ThrottledScroll onScroll={onScroll} throttleMs={100}>
          <div>Scrollable content</div>
        </ThrottledScroll>
      );

      const scrollContainer = screen.getByTestId('throttled-scroll-container');

      // Trigger multiple scroll events rapidly
      for (let i = 0; i < 10; i++) {
        fireEvent.scroll(scrollContainer, { target: { scrollTop: i * 10 } });
      }

      // Should have throttled the scroll events
      const scrollCount = parseInt(
        screen.getByTestId('scroll-count').textContent?.split(': ')[1] || '0'
      );

      expect(scrollCount).toBeLessThan(5); // Much less than 10 rapid scrolls
      expect(onScroll).toHaveBeenCalledTimes(scrollCount);
    });
  });

  describe('List Optimization Patterns', () => {
    it('should optimize large list rendering', async () => {
      const onItemClick = tester.createMock('onItemClick');

      const smallDataset = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        name: `Item ${i}`
      }));

      const largeDataset = Array.from({ length: 500 }, (_, i) => ({
        id: i,
        name: `Item ${i}`
      }));

      // Small dataset - regular rendering
      const { rerender } = render(
        <OptimizedList
          items={smallDataset}
          onItemClick={onItemClick}
          enableVirtualization={true}
        />
      );

      // Should render all items for small dataset
      expect(screen.getAllByTestId(/list-item-/)).toHaveLength(50);

      // Large dataset - virtual rendering
      rerender(
        <OptimizedList
          items={largeDataset}
          onItemClick={onItemClick}
          enableVirtualization={true}
        />
      );

      // Should render fewer items with virtualization
      const virtualizedItems = screen.getAllByTestId(/virtual-item-/);
      expect(virtualizedItems.length).toBeLessThan(50);
    });

    it('should handle item interactions efficiently', async () => {
      const onItemClick = tester.createMock('onItemClick');

      const items = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        name: `Item ${i}`
      }));

      render(
        <OptimizedList
          items={items}
          onItemClick={onItemClick}
          enableVirtualization={false}
        />
      );

      // Click on an item
      await user.click(screen.getByTestId('list-item-5'));

      expect(onItemClick).toHaveBeenCalledWith(items[5], 5);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track component performance metrics', async () => {
      const onUpdate = tester.createMock('onUpdate');

      const initialData = [{ id: 1 }, { id: 2 }];

      const { rerender } = render(
        <MonitoredComponent data={initialData} onUpdate={onUpdate} />
      );

      expect(screen.getByTestId('render-count')).toHaveTextContent('Renders: 1');
      expect(onUpdate).toHaveBeenCalledTimes(1);

      // Trigger re-render
      const newData = [...initialData, { id: 3 }];
      rerender(<MonitoredComponent data={newData} onUpdate={onUpdate} />);

      expect(screen.getByTestId('render-count')).toHaveTextContent('Renders: 2');
      expect(onUpdate).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('data-length')).toHaveTextContent('Data Length: 3');
    });

    it('should calculate average render times', async () => {
      const data = [{ id: 1 }];

      const { rerender } = render(<MonitoredComponent data={data} />);

      // Trigger multiple re-renders
      for (let i = 0; i < 5; i++) {
        rerender(<MonitoredComponent data={[...data, { id: i + 2 }]} />);
        // Small delay between renders
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        });
      }

      const averageTimeElement = screen.getByTestId('average-render-time');
      const averageTime = parseFloat(averageTimeElement.textContent?.split(': ')[1] || '0');

      expect(averageTime).toBeGreaterThan(0);
      expect(screen.getByTestId('render-count')).toHaveTextContent('Renders: 6');
    });
  });

  describe('Memory Optimization', () => {
    it('should handle component cleanup properly', async () => {
      const mockCleanup = jest.fn();

      const CleanupComponent = () => {
        React.useEffect(() => {
          const interval = setInterval(() => {
            // Some periodic operation
          }, 100);

          return () => {
            clearInterval(interval);
            mockCleanup();
          };
        }, []);

        return <div data-testid="cleanup-component">Component with cleanup</div>;
      };

      const { unmount } = render(<CleanupComponent />);

      expect(screen.getByTestId('cleanup-component')).toBeInTheDocument();

      // Unmount component
      unmount();

      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should prevent memory leaks in event handlers', async () => {
      const eventHandlers = new Set();

      const LeakProneComponent = ({ shouldLeak }: { shouldLeak: boolean }) => {
        React.useEffect(() => {
          const handler = () => {
            console.log('Event handled');
          };

          if (shouldLeak) {
            // Simulating memory leak by not removing listener
            document.addEventListener('click', handler);
            eventHandlers.add(handler);
          } else {
            // Proper cleanup
            document.addEventListener('click', handler);
            eventHandlers.add(handler);

            return () => {
              document.removeEventListener('click', handler);
              eventHandlers.delete(handler);
            };
          }
        }, [shouldLeak]);

        return <div data-testid="leak-prone">Leak prone component</div>;
      };

      // Test proper cleanup
      const { unmount: unmountProper } = render(
        <LeakProneComponent shouldLeak={false} />
      );

      expect(eventHandlers.size).toBe(1);

      unmountProper();

      expect(eventHandlers.size).toBe(0); // Should be cleaned up

      // Test memory leak scenario
      const { unmount: unmountLeaky } = render(
        <LeakProneComponent shouldLeak={true} />
      );

      expect(eventHandlers.size).toBe(1);

      unmountLeaky();

      expect(eventHandlers.size).toBe(1); // Leak - not cleaned up
    });
  });
});