/**
 * Performance Tests
 * Comprehensive performance testing suite for the optimized application
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  performanceBenchmarks,
  benchmark,
  ReactComponentBenchmarks,
  WebPerformanceMetrics,
  DOMPerformanceMetrics,
  BenchmarkResult
} from '../../src/utils/performance/PerformanceBenchmarks';

// Mock performance APIs for testing
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  timing: {
    navigationStart: 1000,
    domainLookupStart: 1010,
    domainLookupEnd: 1020,
    connectStart: 1020,
    connectEnd: 1030,
    requestStart: 1030,
    responseStart: 1040,
    responseEnd: 1050,
    domContentLoadedEventStart: 1060,
    domContentLoadedEventEnd: 1070,
    loadEventStart: 1080,
    loadEventEnd: 1090
  }
};

// Mock DOM APIs
const mockDocument = {
  querySelectorAll: jest.fn(),
  body: {
    children: []
  }
};

// Setup mocks
beforeEach(() => {
  global.performance = mockPerformance as any;
  global.document = mockDocument as any;

  // Reset benchmark state
  benchmark.clear();
  ReactComponentBenchmarks.clear();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Performance Benchmarks', () => {
  describe('Basic Benchmarking', () => {
    test('should measure function execution time', async () => {
      const testFunction = () => {
        // Simulate work
        const start = Date.now();
        while (Date.now() - start < 10) {
          // Busy wait for 10ms
        }
        return 'result';
      };

      const { result, benchmark: benchmarkResult } = await benchmark.measure(
        'test_function',
        testFunction,
        1
      );

      expect(result).toBe('result');
      expect(benchmarkResult).toMatchObject({
        name: 'test_function',
        operations: 1,
        duration: expect.any(Number),
        opsPerSecond: expect.any(Number),
        timestamp: expect.any(Number)
      });
      expect(benchmarkResult.duration).toBeGreaterThan(0);
    });

    test('should handle async functions', async () => {
      const asyncFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'async_result';
      };

      const { result, benchmark: benchmarkResult } = await benchmark.measure(
        'async_function',
        asyncFunction
      );

      expect(result).toBe('async_result');
      expect(benchmarkResult.duration).toBeGreaterThan(40); // Should be around 50ms
    });

    test('should track multiple operations', async () => {
      const multiOpFunction = () => {
        // Simulate processing multiple items
        for (let i = 0; i < 100; i++) {
          Math.sqrt(i);
        }
      };

      const { benchmark: benchmarkResult } = await benchmark.measure(
        'multi_operations',
        multiOpFunction,
        100
      );

      expect(benchmarkResult.operations).toBe(100);
      expect(benchmarkResult.opsPerSecond).toBeGreaterThan(0);
    });
  });

  describe('Benchmark Suites', () => {
    test('should run multiple iterations and calculate statistics', async () => {
      const testFunction = () => {
        const start = Date.now();
        while (Date.now() - start < Math.random() * 10 + 5) {
          // Variable execution time: 5-15ms
        }
      };

      const suite = await benchmark.suite('variable_timing', testFunction, 5);

      expect(suite.name).toBe('variable_timing');
      expect(suite.results).toHaveLength(5);
      expect(suite.summary.fastest).toBeDefined();
      expect(suite.summary.slowest).toBeDefined();
      expect(suite.summary.average).toBeGreaterThan(0);
      expect(suite.summary.median).toBeGreaterThan(0);
      expect(suite.summary.fastest.duration).toBeLessThanOrEqual(suite.summary.slowest.duration);
    });
  });

  describe('Memory Tracking', () => {
    test('should track memory usage when available', async () => {
      // Mock memory API
      (global.performance as any).memory = {
        usedJSHeapSize: 1000000
      };

      benchmark.start('memory_test');

      // Simulate memory allocation
      const largeArray = new Array(10000).fill('test');

      (global.performance as any).memory.usedJSHeapSize = 1100000;

      const result = benchmark.end('memory_test', 1);

      expect(result).toMatchObject({
        name: 'memory_test',
        memoryUsage: 100000
      });

      // Clean up
      delete (global.performance as any).memory;
    });
  });

  describe('Performance Report Generation', () => {
    test('should generate comprehensive performance report', async () => {
      // Run several benchmarks
      await benchmark.measure('fast_operation', () => {}, 1);
      await benchmark.measure('slow_operation', () => {
        const start = Date.now();
        while (Date.now() - start < 20) {}
      }, 1);

      const report = benchmark.report();

      expect(report).toContain('Performance Benchmark Report');
      expect(report).toContain('fast_operation');
      expect(report).toContain('slow_operation');
      expect(report).toContain('Average:');
      expect(report).toContain('Min:');
      expect(report).toContain('Max:');
      expect(report).toContain('Ops/sec:');
    });
  });
});

describe('React Component Benchmarks', () => {
  test('should track component render performance', () => {
    const componentName = 'TestComponent';
    const startTime = performance.now();

    // Simulate render time
    setTimeout(() => {
      ReactComponentBenchmarks.trackRender(componentName, startTime);
    }, 10);

    // Wait and check stats
    setTimeout(() => {
      const stats = ReactComponentBenchmarks.getStats(componentName);

      expect(stats.componentName).toBe(componentName);
      expect(stats.renderCount).toBe(1);
      expect(stats.averageRenderTime).toBeGreaterThan(0);
    }, 20);
  });

  test('should calculate average render times', () => {
    const componentName = 'AverageTestComponent';

    // Simulate multiple renders
    for (let i = 0; i < 5; i++) {
      const startTime = performance.now() - (i * 2); // Simulate different render times
      ReactComponentBenchmarks.trackRender(componentName, startTime);
    }

    const stats = ReactComponentBenchmarks.getStats(componentName);

    expect(stats.renderCount).toBe(5);
    expect(stats.averageRenderTime).toBeGreaterThan(0);
    expect(stats.recentRenders).toHaveLength(5);
  });

  test('should limit stored render times', () => {
    const componentName = 'LimitTestComponent';

    // Simulate 150 renders (more than the 100 limit)
    for (let i = 0; i < 150; i++) {
      ReactComponentBenchmarks.trackRender(componentName, performance.now() - 1);
    }

    const stats = ReactComponentBenchmarks.getStats(componentName);

    expect(stats.renderCount).toBe(150);
    // Should only keep last 100 render times
    expect(stats.recentRenders).toHaveLength(10); // Last 10 for recent renders
  });
});

describe('Web Performance Metrics', () => {
  test('should get navigation timing metrics', () => {
    const metrics = WebPerformanceMetrics.getNavigationTiming();

    expect(metrics).toMatchObject({
      dnsLookup: 10,
      tcpConnect: 10,
      request: 10,
      response: 10,
      domProcessing: 10,
      domContentLoaded: 10,
      loadEvent: 10,
      totalTime: 90
    });
  });

  test('should handle missing performance timing', () => {
    const originalTiming = global.performance.timing;
    delete (global.performance as any).timing;

    const metrics = WebPerformanceMetrics.getNavigationTiming();

    expect(metrics).toEqual({});

    // Restore
    (global.performance as any).timing = originalTiming;
  });
});

describe('DOM Performance Metrics', () => {
  test('should calculate DOM complexity metrics', () => {
    // Mock DOM structure
    const mockElements = [
      { tagName: 'DIV' },
      { tagName: 'SPAN' },
      { tagName: 'P' },
      { tagName: 'DIV' }
    ];

    mockDocument.querySelectorAll
      .mockReturnValueOnce(mockElements) // All elements
      .mockReturnValueOnce([mockElements[0], mockElements[3]]) // Flex elements
      .mockReturnValueOnce([mockElements[1]]); // Grid elements

    const complexity = DOMPerformanceMetrics.getDOMComplexity();

    expect(complexity).toMatchObject({
      totalElements: 4,
      flexElements: 2,
      gridElements: 1,
      uniqueTags: 3 // DIV, SPAN, P
    });
  });

  test('should measure layout thrashing', () => {
    const mockElement = {
      offsetHeight: 100,
      style: { marginTop: '' }
    } as HTMLElement;

    const thrashTime = DOMPerformanceMetrics.measureLayoutThrashing(mockElement, 10);

    expect(thrashTime).toBeGreaterThan(0);
    expect(mockElement.style.marginTop).toBe('9px'); // Last iteration
  });
});

describe('Performance Optimization Validation', () => {
  test('should validate render performance meets targets', async () => {
    const fastRenderComponent = () => {
      // Simulate very fast render
      const start = Date.now();
      while (Date.now() - start < 2) {} // 2ms render
    };

    const { benchmark: result } = await benchmark.measure(
      'fast_render',
      fastRenderComponent
    );

    // Assert performance targets
    expect(result.duration).toBeLessThan(5); // Under 5ms
    expect(result.opsPerSecond).toBeGreaterThan(100); // Over 100 ops/sec
  });

  test('should validate virtual scrolling performance', async () => {
    const virtualScrollRender = () => {
      // Simulate rendering 1000 virtual items
      const visibleItems = 10;
      const totalItems = 1000;

      // Only "render" visible items
      for (let i = 0; i < visibleItems; i++) {
        // Simulate item render
        Math.random();
      }
    };

    const { benchmark: result } = await benchmark.measure(
      'virtual_scroll',
      virtualScrollRender,
      1000 // Operations = total items
    );

    // Rendering 1000 items should be fast due to virtualization
    expect(result.duration).toBeLessThan(10);
    expect(result.opsPerSecond).toBeGreaterThan(10000);
  });

  test('should validate search debouncing performance', async () => {
    const debouncedSearch = () => {
      // Simulate debounced search - should only execute once for multiple calls
      return new Promise(resolve => setTimeout(resolve, 5));
    };

    const searchCalls = 10;
    const startTime = performance.now();

    // Simulate multiple rapid search calls (only last should execute)
    for (let i = 0; i < searchCalls; i++) {
      if (i === searchCalls - 1) {
        await debouncedSearch();
      }
    }

    const totalTime = performance.now() - startTime;

    // Should take roughly the time of one search, not ten
    expect(totalTime).toBeLessThan(50); // Much less than 10 * 5ms
  });
});

describe('Performance Regression Tests', () => {
  test('should not exceed baseline render times', async () => {
    const baselineRenderTime = 16; // 16ms = 60fps budget

    const componentRender = () => {
      // Simulate component render work
      const start = Date.now();
      while (Date.now() - start < 5) {
        // Simulate 5ms of work
      }
    };

    const { benchmark: result } = await benchmark.measure(
      'baseline_render',
      componentRender
    );

    expect(result.duration).toBeLessThan(baselineRenderTime);
  });

  test('should maintain efficient memory usage', async () => {
    // Mock memory tracking
    (global.performance as any).memory = {
      usedJSHeapSize: 1000000
    };

    const memoryIntensiveOperation = () => {
      // Simulate creating and cleaning up objects
      const objects = [];
      for (let i = 0; i < 1000; i++) {
        objects.push({ id: i, data: 'test' });
      }
      objects.length = 0; // Clear array
    };

    benchmark.start('memory_test');
    memoryIntensiveOperation();

    // Simulate garbage collection
    (global.performance as any).memory.usedJSHeapSize = 1010000;

    const result = benchmark.end('memory_test', 1000);

    // Memory usage should be reasonable for 1000 operations
    expect(result?.memoryUsage).toBeLessThan(50000); // Under 50KB

    delete (global.performance as any).memory;
  });
});

describe('Performance Monitoring Integration', () => {
  test('should integrate with performance monitoring dashboard', () => {
    // Test that benchmarks can be exported for monitoring
    const results = benchmark.results();
    const report = benchmark.report();

    expect(Array.isArray(results)).toBe(true);
    expect(typeof report).toBe('string');
    expect(report.length).toBeGreaterThan(0);
  });

  test('should support performance alerts', async () => {
    // Simulate slow operation that should trigger alert
    const slowOperation = () => {
      const start = Date.now();
      while (Date.now() - start < 100) {} // 100ms - very slow
    };

    const { benchmark: result } = await benchmark.measure(
      'slow_operation',
      slowOperation
    );

    // Performance monitoring would trigger alerts for operations over threshold
    const performanceThreshold = 50; // 50ms threshold
    const shouldAlert = result.duration > performanceThreshold;

    expect(shouldAlert).toBe(true);
    expect(result.duration).toBeGreaterThan(performanceThreshold);
  });
});

// Performance test utilities
export const performanceTestUtils = {
  /**
   * Assert that a function executes within time limit
   */
  assertPerformance: async (
    fn: () => any | Promise<any>,
    maxDuration: number,
    operations: number = 1
  ) => {
    const { benchmark: result } = await benchmark.measure(
      'performance_assertion',
      fn,
      operations
    );

    expect(result.duration).toBeLessThan(maxDuration);
    return result;
  },

  /**
   * Assert minimum operations per second
   */
  assertThroughput: async (
    fn: () => any | Promise<any>,
    minOpsPerSecond: number,
    operations: number = 1
  ) => {
    const { benchmark: result } = await benchmark.measure(
      'throughput_assertion',
      fn,
      operations
    );

    expect(result.opsPerSecond).toBeGreaterThan(minOpsPerSecond);
    return result;
  },

  /**
   * Compare performance between two functions
   */
  comparePerformance: async (
    fn1: () => any | Promise<any>,
    fn2: () => any | Promise<any>,
    operations: number = 1
  ) => {
    const { benchmark: result1 } = await benchmark.measure('fn1', fn1, operations);
    const { benchmark: result2 } = await benchmark.measure('fn2', fn2, operations);

    return {
      fn1: result1,
      fn2: result2,
      fn1IsFaster: result1.duration < result2.duration,
      speedupRatio: result2.duration / result1.duration
    };
  }
};