/**
 * Search Interface Responsive Performance Tests
 *
 * Specialized performance tests for the KB search interface across different devices:
 * - Touch interaction response time validation
 * - Search performance under various viewport constraints
 * - Virtual scrolling performance on mobile
 * - Memory usage optimization across devices
 * - Layout shift prevention during responsive changes
 *
 * @author UI Responsiveness Testing Specialist
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Component imports
import { SearchInterface } from '../../src/renderer/components/search/SearchInterface';
import { ResponsiveSearchLayout } from '../../src/components/search/ResponsiveSearchLayout';

// Test utilities
import {
  ResponsiveTestRunner,
  PerformanceMeasurementUtils,
  LayoutMeasurementUtils,
  TouchGestureSimulator
} from './ResponsiveTestUtils';

import {
  DEVICE_VIEWPORTS,
  TEST_SCENARIOS,
  PERFORMANCE_THRESHOLDS,
  COMPONENT_CONFIGS
} from './ResponsiveTestConfig';

// Mock large dataset for performance testing
const generateLargeKBDataset = (size: number) => {
  return Array.from({ length: size }, (_, i) => ({
    id: `kb-entry-${i}`,
    title: `Knowledge Base Entry ${i + 1}: ${['VSAM', 'JCL', 'COBOL', 'DB2', 'CICS'][i % 5]} Issue`,
    problem: `Detailed problem description for entry ${i + 1}. This entry describes a common issue encountered in mainframe development that requires specific knowledge and troubleshooting steps. The problem often manifests as error codes or unexpected behavior in production systems.`,
    solution: `Comprehensive solution for problem ${i + 1}:\n1. Identify the root cause\n2. Apply the appropriate fix\n3. Test the solution\n4. Document the resolution\n5. Monitor for recurrence`,
    category: ['VSAM', 'JCL', 'Batch', 'DB2', 'Functional'][i % 5] as const,
    tags: [
      `tag-${i % 10}`,
      `category-${i % 5}`,
      `priority-${i % 3}`,
      `system-${i % 4}`,
      `environment-${i % 2 ? 'prod' : 'test'}`
    ],
    usage_count: Math.floor(Math.random() * 100),
    success_count: Math.floor(Math.random() * 80),
    failure_count: Math.floor(Math.random() * 20),
    created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString()
  }));
};

// Performance tracking utilities
class SearchPerformanceTracker {
  private metrics: Map<string, number[]> = new Map();
  private memorySnapshots: number[] = [];

  startTracking(metricName: string): void {
    PerformanceMeasurementUtils.mark(`${metricName}-start`);
    this.takeMemorySnapshot();
  }

  endTracking(metricName: string): number {
    PerformanceMeasurementUtils.mark(`${metricName}-end`);
    const duration = PerformanceMeasurementUtils.measure(
      metricName,
      `${metricName}-start`,
      `${metricName}-end`
    );

    if (!this.metrics.has(metricName)) {
      this.metrics.set(metricName, []);
    }
    this.metrics.get(metricName)!.push(duration);

    return duration;
  }

  takeMemorySnapshot(): void {
    const memoryUsage = PerformanceMeasurementUtils.getCurrentMemoryUsage();
    this.memorySnapshots.push(memoryUsage);
  }

  getAverageTime(metricName: string): number {
    const times = this.metrics.get(metricName) || [];
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  getP95Time(metricName: string): number {
    const times = this.metrics.get(metricName) || [];
    if (times.length === 0) return 0;

    const sorted = [...times].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[index] || 0;
  }

  getMemoryGrowth(): number {
    if (this.memorySnapshots.length < 2) return 0;
    const first = this.memorySnapshots[0];
    const last = this.memorySnapshots[this.memorySnapshots.length - 1];
    return (last - first) / (1024 * 1024); // Convert to MB
  }

  reset(): void {
    this.metrics.clear();
    this.memorySnapshots = [];
    PerformanceMeasurementUtils.startMonitoring();
  }
}

// Test wrapper with performance monitoring
const PerformanceTestWrapper: React.FC<{
  children: React.ReactNode;
  onRender?: () => void;
}> = ({ children, onRender }) => {
  React.useEffect(() => {
    onRender?.();
  }, [onRender]);

  return (
    <div data-testid="performance-wrapper" style={{ width: '100%', height: '100vh' }}>
      {children}
    </div>
  );
};

describe('Search Interface Responsive Performance Tests', () => {
  let testRunner: ResponsiveTestRunner;
  let performanceTracker: SearchPerformanceTracker;

  beforeEach(() => {
    testRunner = new ResponsiveTestRunner();
    performanceTracker = new SearchPerformanceTracker();
    performanceTracker.reset();

    // Mock console.warn to avoid test noise
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    testRunner.cleanup();
    jest.restoreAllMocks();
  });

  describe('Touch Interaction Performance', () => {
    test('should respond to touch interactions within performance threshold on mobile', async () => {
      await testRunner.runScenario(TEST_SCENARIOS.mobile_portrait, async () => {
        const mockOnEntrySelect = jest.fn();
        const dataset = generateLargeKBDataset(100);

        render(
          <PerformanceTestWrapper>
            <SearchInterface
              entries={dataset}
              onEntrySelect={mockOnEntrySelect}
              maxResults={20}
            />
          </PerformanceTestWrapper>
        );

        await waitFor(() => {
          expect(screen.getByRole('textbox')).toBeInTheDocument();
        });

        // Test search input touch response
        const searchInput = screen.getByRole('textbox');
        const touchResponseTimes: number[] = [];

        for (let i = 0; i < 5; i++) {
          performanceTracker.startTracking(`touch-response-${i}`);

          fireEvent.touchStart(searchInput, {
            touches: [{ clientX: 100, clientY: 100 }]
          });

          fireEvent.focus(searchInput);

          const responseTime = performanceTracker.endTracking(`touch-response-${i}`);
          touchResponseTimes.push(responseTime);

          await waitFor(() => {
            expect(searchInput).toHaveFocus();
          });

          fireEvent.blur(searchInput);
        }

        // Verify all touch responses are within threshold
        touchResponseTimes.forEach(time => {
          expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.TOUCH_RESPONSE_TIME_MAX);
        });

        const averageResponseTime = touchResponseTimes.reduce((a, b) => a + b, 0) / touchResponseTimes.length;
        console.log(`Average touch response time: ${averageResponseTime.toFixed(2)}ms`);
      });
    });

    test('should handle rapid touch interactions without performance degradation', async () => {
      await testRunner.runScenario(TEST_SCENARIOS.mobile_portrait, async () => {
        const dataset = generateLargeKBDataset(50);

        render(
          <PerformanceTestWrapper>
            <SearchInterface
              entries={dataset}
              onEntrySelect={jest.fn()}
            />
          </PerformanceTestWrapper>
        );

        const searchInput = screen.getByRole('textbox');

        // Perform rapid touch interactions
        performanceTracker.startTracking('rapid-touch-sequence');

        for (let i = 0; i < 20; i++) {
          fireEvent.touchStart(searchInput);
          fireEvent.touchEnd(searchInput);

          // Small delay to prevent browser throttling
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        const totalTime = performanceTracker.endTracking('rapid-touch-sequence');
        const averagePerInteraction = totalTime / 20;

        // Each interaction should still be fast
        expect(averagePerInteraction).toBeLessThan(PERFORMANCE_THRESHOLDS.TOUCH_RESPONSE_TIME_MAX);

        // Memory shouldn't grow significantly
        const memoryGrowth = performanceTracker.getMemoryGrowth();
        expect(memoryGrowth).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD);
      });
    });

    test('should maintain touch target sizes across all mobile viewports', async () => {
      const mobileViewports = [
        DEVICE_VIEWPORTS.iphone_se,
        DEVICE_VIEWPORTS.iphone_12,
        DEVICE_VIEWPORTS.pixel_5,
        DEVICE_VIEWPORTS.galaxy_s21
      ];

      for (const viewport of mobileViewports) {
        await testRunner.runScenario(
          { ...TEST_SCENARIOS.mobile_portrait, viewport },
          async () => {
            render(
              <PerformanceTestWrapper>
                <SearchInterface
                  entries={generateLargeKBDataset(10)}
                  onEntrySelect={jest.fn()}
                />
              </PerformanceTestWrapper>
            );

            await waitFor(() => {
              const buttons = screen.getAllByRole('button');
              const inputs = screen.getAllByRole('textbox');
              const interactiveElements = [...buttons, ...inputs];

              expect(LayoutMeasurementUtils.validateTouchTargets(interactiveElements)).toBe(true);

              // Log touch target sizes for this viewport
              interactiveElements.forEach((element, index) => {
                const measurement = LayoutMeasurementUtils.measureElement(element);
                const minSize = Math.min(measurement.width, measurement.height);
                console.log(`Viewport ${viewport.width}x${viewport.height} - Element ${index}: ${minSize}px`);
              });
            });
          }
        );
      }
    });
  });

  describe('Search Performance Across Viewports', () => {
    test('should maintain search performance consistency across all viewports', async () => {
      const dataset = generateLargeKBDataset(500);
      const testViewports = [
        { name: 'mobile', scenario: TEST_SCENARIOS.mobile_portrait },
        { name: 'tablet', scenario: TEST_SCENARIOS.tablet_portrait },
        { name: 'desktop', scenario: TEST_SCENARIOS.desktop_standard }
      ];

      const searchTimes: Record<string, number[]> = {};

      for (const { name, scenario } of testViewports) {
        await testRunner.runScenario(scenario, async () => {
          const mockSearch = jest.fn().mockImplementation((query: string) => {
            return new Promise(resolve => {
              setTimeout(() => {
                const results = dataset.filter(entry =>
                  entry.title.toLowerCase().includes(query.toLowerCase()) ||
                  entry.problem.toLowerCase().includes(query.toLowerCase())
                );
                resolve(results.slice(0, 50));
              }, Math.random() * 100); // Simulate variable search time
            });
          });

          render(
            <PerformanceTestWrapper>
              <SearchInterface
                entries={dataset}
                onEntrySelect={jest.fn()}
              />
            </PerformanceTestWrapper>
          );

          const searchInput = screen.getByRole('textbox');
          searchTimes[name] = [];

          // Perform multiple searches
          const searchQueries = ['VSAM', 'error', 'JCL', 'batch', 'status'];

          for (const query of searchQueries) {
            performanceTracker.startTracking(`search-${name}-${query}`);

            fireEvent.change(searchInput, { target: { value: query } });

            // Wait for search to complete
            await waitFor(() => {
              const results = screen.queryAllByRole('button');
              expect(results.length).toBeGreaterThan(0);
            }, { timeout: 2000 });

            const searchTime = performanceTracker.endTracking(`search-${name}-${query}`);
            searchTimes[name].push(searchTime);

            // Clear search
            fireEvent.change(searchInput, { target: { value: '' } });
            await waitFor(() => {
              expect(searchInput).toHaveValue('');
            });
          }
        });
      }

      // Analyze search performance across viewports
      Object.entries(searchTimes).forEach(([viewport, times]) => {
        const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
        const p95Time = [...times].sort((a, b) => a - b)[Math.ceil(times.length * 0.95) - 1];

        console.log(`${viewport} - Average: ${averageTime.toFixed(2)}ms, P95: ${p95Time.toFixed(2)}ms`);

        expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_RESPONSE_TIME_MAX);
        expect(p95Time).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_RESPONSE_TIME_MAX * 1.5);
      });

      // Verify consistency across viewports (variance should be minimal)
      const allAverages = Object.values(searchTimes).map(times =>
        times.reduce((a, b) => a + b, 0) / times.length
      );
      const variance = allAverages.reduce((acc, val) => {
        const mean = allAverages.reduce((a, b) => a + b, 0) / allAverages.length;
        return acc + Math.pow(val - mean, 2);
      }, 0) / allAverages.length;

      // Variance should be low (consistent performance)
      expect(variance).toBeLessThan(10000); // 100ms standard deviation
    });

    test('should optimize search results rendering for large datasets on mobile', async () => {
      await testRunner.runScenario(TEST_SCENARIOS.mobile_portrait, async () => {
        const largeDataset = generateLargeKBDataset(2000);

        render(
          <PerformanceTestWrapper
            onRender={() => performanceTracker.startTracking('large-dataset-render')}
          >
            <SearchInterface
              entries={largeDataset}
              onEntrySelect={jest.fn()}
              maxResults={100}
            />
          </PerformanceTestWrapper>
        );

        const renderTime = performanceTracker.endTracking('large-dataset-render');

        // Large dataset should still render quickly
        expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPONENT_LOAD_TIME_MAX);

        const searchInput = screen.getByRole('textbox');

        // Perform search on large dataset
        performanceTracker.startTracking('large-dataset-search');

        fireEvent.change(searchInput, { target: { value: 'VSAM' } });

        await waitFor(() => {
          const results = screen.getAllByRole('button');
          expect(results.length).toBeGreaterThan(0);
        });

        const searchTime = performanceTracker.endTracking('large-dataset-search');

        // Search should still be performant with large dataset
        expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_RESPONSE_TIME_MAX);

        // Check DOM node count (should use virtualization)
        const domNodeCount = PerformanceMeasurementUtils.getDOMNodeCount();
        expect(domNodeCount).toBeLessThan(PERFORMANCE_THRESHOLDS.DOM_NODE_COUNT_MAX);

        console.log(`Large dataset (${largeDataset.length} entries) - Render: ${renderTime.toFixed(2)}ms, Search: ${searchTime.toFixed(2)}ms, DOM nodes: ${domNodeCount}`);
      });
    });
  });

  describe('Layout Performance During Responsive Changes', () => {
    test('should handle viewport transitions without performance penalties', async () => {
      const dataset = generateLargeKBDataset(100);

      const { container, rerender } = render(
        <PerformanceTestWrapper>
          <SearchInterface
            entries={dataset}
            onEntrySelect={jest.fn()}
          />
        </PerformanceTestWrapper>
      );

      const searchInterface = container.querySelector('.search-interface');
      expect(searchInterface).toBeInTheDocument();

      // Test multiple viewport transitions
      const viewportTransitions = [
        { from: DEVICE_VIEWPORTS.desktop_hd, to: DEVICE_VIEWPORTS.tablet_portrait },
        { from: DEVICE_VIEWPORTS.tablet_portrait, to: DEVICE_VIEWPORTS.iphone_12 },
        { from: DEVICE_VIEWPORTS.iphone_12, to: DEVICE_VIEWPORTS.desktop_hd }
      ];

      for (const { from, to } of viewportTransitions) {
        // Set initial viewport
        act(() => {
          Object.defineProperty(window, 'innerWidth', { value: from.width, configurable: true });
          Object.defineProperty(window, 'innerHeight', { value: from.height, configurable: true });
          window.dispatchEvent(new Event('resize'));
        });

        await waitFor(() => {
          expect(window.innerWidth).toBe(from.width);
        });

        // Measure layout shift during transition
        const layoutShift = LayoutMeasurementUtils.measureLayoutShift(
          searchInterface!,
          () => {
            performanceTracker.startTracking(`transition-${from.width}-to-${to.width}`);

            act(() => {
              Object.defineProperty(window, 'innerWidth', { value: to.width, configurable: true });
              Object.defineProperty(window, 'innerHeight', { value: to.height, configurable: true });
              window.dispatchEvent(new Event('resize'));
            });
          }
        );

        const transitionTime = performanceTracker.endTracking(`transition-${from.width}-to-${to.width}`);

        // Rerender component to trigger responsive updates
        rerender(
          <PerformanceTestWrapper>
            <SearchInterface
              entries={dataset}
              onEntrySelect={jest.fn()}
            />
          </PerformanceTestWrapper>
        );

        await waitFor(() => {
          expect(window.innerWidth).toBe(to.width);
        });

        // Validate performance metrics
        expect(transitionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.REFLOW_TIME_MAX);
        expect(layoutShift.shiftScore).toBeLessThan(PERFORMANCE_THRESHOLDS.LAYOUT_SHIFT_THRESHOLD);

        console.log(`Transition ${from.width}→${to.width}: ${transitionTime.toFixed(2)}ms, Shift: ${layoutShift.shiftScore.toFixed(4)}`);
      }
    });

    test('should maintain performance during orientation changes', async () => {
      await testRunner.runScenario(TEST_SCENARIOS.tablet_portrait, async () => {
        const dataset = generateLargeKBDataset(200);

        const { container } = render(
          <PerformanceTestWrapper>
            <ResponsiveSearchLayout
              searchInput={
                <SearchInterface
                  entries={dataset}
                  onEntrySelect={jest.fn()}
                />
              }
              filtersContent={<div>Filters</div>}
              resultsContent={<div>Results</div>}
              previewContent={<div>Preview</div>}
            />
          </PerformanceTestWrapper>
        );

        const layoutContainer = container.querySelector('[data-layout]');
        expect(layoutContainer).toBeInTheDocument();

        // Simulate orientation change from portrait to landscape
        performanceTracker.startTracking('orientation-change');

        const orientationShift = LayoutMeasurementUtils.measureLayoutShift(
          layoutContainer!,
          () => {
            act(() => {
              // Swap dimensions for landscape
              Object.defineProperty(window, 'innerWidth', {
                value: DEVICE_VIEWPORTS.tablet_portrait.height,
                configurable: true
              });
              Object.defineProperty(window, 'innerHeight', {
                value: DEVICE_VIEWPORTS.tablet_portrait.width,
                configurable: true
              });

              window.dispatchEvent(new Event('orientationchange'));
              window.dispatchEvent(new Event('resize'));
            });
          }
        );

        const orientationTime = performanceTracker.endTracking('orientation-change');

        await waitFor(() => {
          // Layout should adapt to landscape
          expect(window.innerWidth).toBe(DEVICE_VIEWPORTS.tablet_portrait.height);
        });

        // Validate orientation change performance
        expect(orientationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.REFLOW_TIME_MAX);
        expect(orientationShift.shiftScore).toBeLessThan(PERFORMANCE_THRESHOLDS.LAYOUT_SHIFT_THRESHOLD);

        console.log(`Orientation change: ${orientationTime.toFixed(2)}ms, Shift: ${orientationShift.shiftScore.toFixed(4)}`);
      });
    });
  });

  describe('Memory Usage Optimization', () => {
    test('should maintain stable memory usage during extended mobile usage', async () => {
      await testRunner.runScenario(TEST_SCENARIOS.mobile_portrait, async () => {
        const dataset = generateLargeKBDataset(300);

        render(
          <PerformanceTestWrapper>
            <SearchInterface
              entries={dataset}
              onEntrySelect={jest.fn()}
            />
          </PerformanceTestWrapper>
        );

        const searchInput = screen.getByRole('textbox');
        performanceTracker.takeMemorySnapshot();

        // Simulate extended usage with multiple searches
        const searchQueries = [
          'VSAM status', 'JCL error', 'COBOL abend', 'DB2 deadlock', 'CICS timeout',
          'batch job', 'system error', 'file not found', 'access denied', 'timeout',
          'connection', 'invalid data', 'overflow', 'underflow', 'exception'
        ];

        for (let cycle = 0; cycle < 3; cycle++) {
          for (const query of searchQueries) {
            fireEvent.change(searchInput, { target: { value: query } });

            await waitFor(() => {
              const results = screen.queryAllByRole('button');
              expect(results.length).toBeGreaterThan(0);
            });

            // Simulate user interaction
            const results = screen.getAllByRole('button');
            if (results.length > 0) {
              fireEvent.click(results[0]);
            }

            // Clear search
            fireEvent.change(searchInput, { target: { value: '' } });

            // Take memory snapshot every few operations
            if ((cycle * searchQueries.length + searchQueries.indexOf(query)) % 5 === 0) {
              performanceTracker.takeMemorySnapshot();
            }
          }
        }

        const memoryGrowth = performanceTracker.getMemoryGrowth();
        console.log(`Memory growth after extended usage: ${memoryGrowth.toFixed(2)}MB`);

        // Memory should not grow excessively during extended usage
        expect(memoryGrowth).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD * 2);
      });
    });

    test('should efficiently handle component mounting/unmounting cycles', async () => {
      await testRunner.runScenario(TEST_SCENARIOS.mobile_portrait, async () => {
        const dataset = generateLargeKBDataset(100);
        let renderCount = 0;

        const TestComponent = () => {
          renderCount++;
          return (
            <SearchInterface
              entries={dataset}
              onEntrySelect={jest.fn()}
            />
          );
        };

        performanceTracker.takeMemorySnapshot();

        // Mount and unmount component multiple times
        for (let i = 0; i < 10; i++) {
          performanceTracker.startTracking(`mount-cycle-${i}`);

          const { unmount } = render(
            <PerformanceTestWrapper>
              <TestComponent />
            </PerformanceTestWrapper>
          );

          await waitFor(() => {
            expect(screen.getByRole('textbox')).toBeInTheDocument();
          });

          const mountTime = performanceTracker.endTracking(`mount-cycle-${i}`);

          // Perform a quick interaction
          const searchInput = screen.getByRole('textbox');
          fireEvent.change(searchInput, { target: { value: 'test' } });

          await waitFor(() => {
            expect(searchInput).toHaveValue('test');
          });

          // Unmount
          unmount();

          // Mount time should remain consistent
          expect(mountTime).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPONENT_LOAD_TIME_MAX);

          if (i % 3 === 0) {
            performanceTracker.takeMemorySnapshot();
          }
        }

        const memoryGrowth = performanceTracker.getMemoryGrowth();
        console.log(`Memory growth after ${renderCount} renders: ${memoryGrowth.toFixed(2)}MB`);

        // Memory should not accumulate from mount/unmount cycles
        expect(memoryGrowth).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD);
      });
    });
  });

  describe('Swipe Gesture Performance', () => {
    test('should respond to swipe gestures smoothly on mobile', async () => {
      await testRunner.runScenario(TEST_SCENARIOS.mobile_portrait, async () => {
        const mockOnFiltersToggle = jest.fn();
        const mockOnPreviewToggle = jest.fn();

        render(
          <PerformanceTestWrapper>
            <ResponsiveSearchLayout
              searchInput={<input placeholder="Search..." />}
              filtersContent={<div>Filters</div>}
              resultsContent={<div>Results</div>}
              previewContent={<div>Preview</div>}
              enableSwipeGestures={true}
              onFiltersToggle={mockOnFiltersToggle}
              onPreviewToggle={mockOnPreviewToggle}
            />
          </PerformanceTestWrapper>
        );

        const resultsContainer = screen.getByText('Results').closest('div');
        expect(resultsContainer).toBeInTheDocument();

        // Test multiple swipe gestures
        const swipeGestures = [
          { startX: 50, startY: 200, endX: 150, endY: 200 }, // Right swipe
          { startX: 200, startY: 200, endX: 100, endY: 200 }, // Left swipe
          { startX: 100, startY: 300, endX: 200, endY: 300 }, // Another right swipe
        ];

        for (let i = 0; i < swipeGestures.length; i++) {
          const gesture = swipeGestures[i];

          performanceTracker.startTracking(`swipe-gesture-${i}`);

          await TouchGestureSimulator.simulateSwipe(resultsContainer!, {
            type: 'swipe',
            ...gesture,
            duration: 200
          });

          const gestureTime = performanceTracker.endTracking(`swipe-gesture-${i}`);

          // Swipe should be recognized and responded to quickly
          expect(gestureTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TOUCH_RESPONSE_TIME_MAX * 3);

          await waitFor(() => {
            // At least one toggle should have been called
            expect(mockOnFiltersToggle.mock.calls.length + mockOnPreviewToggle.mock.calls.length)
              .toBeGreaterThan(i);
          });

          console.log(`Swipe gesture ${i + 1}: ${gestureTime.toFixed(2)}ms`);
        }
      });
    });

    test('should prevent gesture conflicts with scroll performance', async () => {
      await testRunner.runScenario(TEST_SCENARIOS.mobile_portrait, async () => {
        const dataset = generateLargeKBDataset(100);

        render(
          <PerformanceTestWrapper>
            <ResponsiveSearchLayout
              searchInput={<input placeholder="Search..." />}
              resultsContent={
                <SearchInterface
                  entries={dataset}
                  onEntrySelect={jest.fn()}
                />
              }
              enableSwipeGestures={true}
            />
          </PerformanceTestWrapper>
        );

        const searchInput = screen.getByRole('textbox');
        fireEvent.change(searchInput, { target: { value: 'test' } });

        await waitFor(() => {
          const results = screen.getAllByRole('button');
          expect(results.length).toBeGreaterThan(5);
        });

        const scrollContainer = screen.getByRole('textbox').closest('[style*="overflow"]') ||
                              document.querySelector('[style*="scroll"]') ||
                              screen.getByText('Results').closest('div');

        if (scrollContainer) {
          // Test vertical scroll performance (should not conflict with horizontal swipes)
          performanceTracker.startTracking('scroll-performance');

          for (let i = 0; i < 10; i++) {
            fireEvent.scroll(scrollContainer, { target: { scrollTop: i * 100 } });
            await new Promise(resolve => setTimeout(resolve, 16)); // 60fps
          }

          const scrollTime = performanceTracker.endTracking('scroll-performance');

          // Scroll should remain smooth
          const avgScrollTime = scrollTime / 10;
          expect(avgScrollTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SCROLL_JANK_THRESHOLD);

          console.log(`Scroll performance: ${avgScrollTime.toFixed(2)}ms per frame`);
        }
      });
    });
  });

  describe('Component Load Performance Across Devices', () => {
    test('should load efficiently on low-end mobile devices', async () => {
      // Simulate low-end device constraints
      await testRunner.runScenario(
        {
          ...TEST_SCENARIOS.mobile_portrait,
          viewport: { width: 320, height: 568, devicePixelRatio: 1 } // Older iPhone SE
        },
        async () => {
          const dataset = generateLargeKBDataset(50); // Smaller dataset for low-end device

          performanceTracker.startTracking('low-end-device-load');

          render(
            <PerformanceTestWrapper
              onRender={() => {
                // Component mounted
              }}
            >
              <SearchInterface
                entries={dataset}
                onEntrySelect={jest.fn()}
                maxResults={10} // Limit results for performance
              />
            </PerformanceTestWrapper>
          );

          await waitFor(() => {
            expect(screen.getByRole('textbox')).toBeInTheDocument();
          });

          const loadTime = performanceTracker.endTracking('low-end-device-load');

          // Should load quickly even on low-end devices
          expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPONENT_LOAD_TIME_MAX);

          // Test basic functionality
          const searchInput = screen.getByRole('textbox');
          fireEvent.change(searchInput, { target: { value: 'VSAM' } });

          await waitFor(() => {
            const results = screen.getAllByRole('button');
            expect(results.length).toBeGreaterThan(0);
          });

          console.log(`Low-end device load time: ${loadTime.toFixed(2)}ms`);
        }
      );
    });

    test('should utilize high-end device capabilities efficiently', async () => {
      await testRunner.runScenario(
        {
          ...TEST_SCENARIOS.desktop_standard,
          viewport: { width: 2560, height: 1440, devicePixelRatio: 2 } // High-end desktop
        },
        async () => {
          const dataset = generateLargeKBDataset(1000); // Large dataset for high-end device

          performanceTracker.startTracking('high-end-device-load');

          render(
            <PerformanceTestWrapper>
              <SearchInterface
                entries={dataset}
                onEntrySelect={jest.fn()}
                maxResults={100} // More results for larger screens
                showAnalytics={true}
              />
            </PerformanceTestWrapper>
          );

          await waitFor(() => {
            expect(screen.getByRole('textbox')).toBeInTheDocument();
          });

          const loadTime = performanceTracker.endTracking('high-end-device-load');

          // Should leverage high-end capabilities
          expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPONENT_LOAD_TIME_MAX * 0.7);

          // Test advanced features
          const searchInput = screen.getByRole('textbox');

          performanceTracker.startTracking('advanced-search');
          fireEvent.change(searchInput, { target: { value: 'complex search query with multiple terms' } });

          await waitFor(() => {
            const results = screen.getAllByRole('button');
            expect(results.length).toBeGreaterThan(10);
          });

          const searchTime = performanceTracker.endTracking('advanced-search');

          // Advanced search should be fast on high-end devices
          expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_RESPONSE_TIME_MAX * 0.5);

          console.log(`High-end device - Load: ${loadTime.toFixed(2)}ms, Search: ${searchTime.toFixed(2)}ms`);
        }
      );
    });
  });
});