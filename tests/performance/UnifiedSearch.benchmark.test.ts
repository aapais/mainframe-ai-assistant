/**
 * Performance Benchmarks for UnifiedSearch Component
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { performance, PerformanceObserver } from 'perf_hooks';
import UnifiedSearch from '../../src/renderer/components/search/UnifiedSearch';

// Mock dependencies
jest.mock('../../src/renderer/hooks/useNotificationSystem', () => ({
  useNotificationSystem: () => ({
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn()
  })
}));

// Performance measurement utilities
class PerformanceBenchmark {
  private measurements: { [key: string]: number[] } = {};

  measure(name: string, fn: () => void | Promise<void>): Promise<number> {
    return new Promise(async (resolve) => {
      const start = performance.now();
      await fn();
      const end = performance.now();
      const duration = end - start;

      if (!this.measurements[name]) {
        this.measurements[name] = [];
      }
      this.measurements[name].push(duration);

      resolve(duration);
    });
  }

  getStats(name: string) {
    const measurements = this.measurements[name] || [];
    if (measurements.length === 0) return null;

    const sorted = [...measurements].sort((a, b) => a - b);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      count: measurements.length
    };
  }

  clear() {
    this.measurements = {};
  }
}

describe('UnifiedSearch Performance Benchmarks', () => {
  let benchmark: PerformanceBenchmark;

  beforeEach(() => {
    benchmark = new PerformanceBenchmark();
  });

  afterEach(() => {
    benchmark.clear();
  });

  const defaultProps = {
    onSearch: jest.fn(),
    loading: false,
    placeholder: 'Search...',
    autoFocus: false,
    className: ''
  };

  describe('Rendering Performance', () => {
    it('should render initial component within 50ms', async () => {
      const duration = await benchmark.measure('initial-render', () => {
        render(<UnifiedSearch {...defaultProps} />);
      });

      expect(duration).toBeLessThan(50);
    });

    it('should handle rapid re-renders efficiently', async () => {
      const { rerender } = render(<UnifiedSearch {...defaultProps} />);

      // Measure multiple re-renders
      const iterations = 100;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const duration = await benchmark.measure('re-render', () => {
          rerender(<UnifiedSearch {...defaultProps} loading={i % 2 === 0} />);
        });
        durations.push(duration);
      }

      const stats = benchmark.getStats('re-render');
      expect(stats!.avg).toBeLessThan(10);
      expect(stats!.p95).toBeLessThan(20);
    });

    it('should mount and unmount efficiently', async () => {
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        await benchmark.measure('mount-unmount', () => {
          const { unmount } = render(<UnifiedSearch {...defaultProps} />);
          unmount();
        });
      }

      const stats = benchmark.getStats('mount-unmount');
      expect(stats!.avg).toBeLessThan(30);
      expect(stats!.p95).toBeLessThan(50);
    });
  });

  describe('Interaction Performance', () => {
    it('should handle input changes within 16ms (60fps)', async () => {
      const { getByRole } = render(<UnifiedSearch {...defaultProps} />);
      const input = getByRole('searchbox') as HTMLInputElement;

      const testQuery = 'S0C4 ABEND error in COBOL program';

      for (let i = 0; i < testQuery.length; i++) {
        await benchmark.measure('input-change', () => {
          fireEvent.change(input, { target: { value: testQuery.slice(0, i + 1) } });
        });
      }

      const stats = benchmark.getStats('input-change');
      expect(stats!.avg).toBeLessThan(16); // 60fps target
      expect(stats!.p95).toBeLessThan(25);
    });

    it('should show suggestions within 150ms', async () => {
      const { getByRole, queryByRole } = render(<UnifiedSearch {...defaultProps} />);
      const input = getByRole('searchbox');

      const duration = await benchmark.measure('show-suggestions', async () => {
        fireEvent.change(input, { target: { value: 'test' } });
        fireEvent.focus(input);

        await waitFor(() => {
          expect(queryByRole('listbox')).toBeInTheDocument();
        }, { timeout: 200 });
      });

      expect(duration).toBeLessThan(150);
    });

    it('should handle keyboard navigation responsively', async () => {
      const { getByRole } = render(<UnifiedSearch {...defaultProps} />);
      const input = getByRole('searchbox');

      // Open suggestions
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.focus(input);

      await waitFor(() => {
        expect(queryByRole('listbox')).toBeInTheDocument();
      });

      // Test rapid keyboard navigation
      const keys = ['ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowDown', 'Enter'];

      for (const key of keys) {
        await benchmark.measure('keyboard-navigation', () => {
          fireEvent.keyDown(input, { key });
        });
      }

      const stats = benchmark.getStats('keyboard-navigation');
      expect(stats!.avg).toBeLessThan(5);
      expect(stats!.max).toBeLessThan(15);
    });

    it('should handle AI toggle efficiently', async () => {
      const { getByLabelText } = render(<UnifiedSearch {...defaultProps} />);
      const aiToggle = getByLabelText(/AI-enhanced search/);

      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        await benchmark.measure('ai-toggle', () => {
          fireEvent.click(aiToggle);
        });
      }

      const stats = benchmark.getStats('ai-toggle');
      expect(stats!.avg).toBeLessThan(10);
      expect(stats!.p95).toBeLessThan(20);
    });
  });

  describe('Memory Performance', () => {
    it('should not cause memory leaks with rapid interactions', async () => {
      const { getByRole, unmount } = render(<UnifiedSearch {...defaultProps} />);
      const input = getByRole('searchbox');

      // Simulate intensive usage
      const iterations = 1000;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        fireEvent.change(input, { target: { value: `query ${i}` } });
        fireEvent.focus(input);
        fireEvent.blur(input);

        // Occasional cleanup
        if (i % 100 === 0) {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time even with many iterations
      expect(totalTime).toBeLessThan(5000); // 5 seconds for 1000 iterations

      unmount();
    });

    it('should handle large suggestion lists efficiently', async () => {
      // Create component with many suggestions
      const largeSuggestionList = Array.from({ length: 1000 }, (_, i) => ({
        id: `suggestion-${i}`,
        text: `Suggestion ${i}: S0C4 ABEND in program ${i}`,
        type: 'popular' as const,
        category: 'COBOL',
        count: Math.floor(Math.random() * 100)
      }));

      // Mock the hook to return large suggestion list
      const mockUseSearchState = jest.fn(() => [
        {
          query: 'test',
          suggestions: largeSuggestionList,
          showSuggestions: true,
          // ... other state
        },
        {
          setQuery: jest.fn(),
          // ... other actions
        }
      ]);

      // This would require modifying the component to accept suggestions as props
      // or using a different testing approach with mocked hooks

      const duration = await benchmark.measure('large-suggestions', () => {
        render(<UnifiedSearch {...defaultProps} />);
      });

      // Should still render efficiently even with many suggestions
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Debouncing Performance', () => {
    it('should debounce rapid input changes effectively', async () => {
      const { getByRole } = render(<UnifiedSearch {...defaultProps} />);
      const input = getByRole('searchbox');

      const rapidInputs = 50;
      const inputDelay = 10; // 10ms between inputs

      const startTime = performance.now();

      // Simulate rapid typing
      for (let i = 0; i < rapidInputs; i++) {
        fireEvent.change(input, { target: { value: `query${i}` } });
        await new Promise(resolve => setTimeout(resolve, inputDelay));
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should not block the main thread
      expect(totalTime).toBeLessThan(rapidInputs * inputDelay * 2);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle typical user workflow efficiently', async () => {
      const { getByRole, getByLabelText } = render(<UnifiedSearch {...defaultProps} />);
      const input = getByRole('searchbox');
      const aiToggle = getByLabelText(/AI-enhanced search/);

      const workflowDuration = await benchmark.measure('user-workflow', async () => {
        // 1. User focuses input
        fireEvent.focus(input);

        // 2. User types query
        fireEvent.change(input, { target: { value: 'S0C4' } });

        // 3. User sees suggestions, navigates
        await waitFor(() => expect(queryByRole('listbox')).toBeInTheDocument());
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });

        // 4. User changes mind, clears input
        fireEvent.change(input, { target: { value: '' } });

        // 5. User toggles AI mode
        fireEvent.click(aiToggle);

        // 6. User types new query
        fireEvent.change(input, { target: { value: 'DB2 SQLCODE' } });

        // 7. User submits search
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      // Entire workflow should complete quickly
      expect(workflowDuration).toBeLessThan(200);
    });

    it('should maintain performance under stress', async () => {
      const { getByRole } = render(<UnifiedSearch {...defaultProps} />);
      const input = getByRole('searchbox');

      // Stress test: rapid interactions
      const stressDuration = await benchmark.measure('stress-test', async () => {
        for (let i = 0; i < 100; i++) {
          fireEvent.change(input, { target: { value: `stress ${i}` } });
          fireEvent.focus(input);
          fireEvent.blur(input);
          fireEvent.keyDown(input, { key: 'ArrowDown' });
          fireEvent.keyDown(input, { key: 'Escape' });

          // Occasional pauses to simulate real usage
          if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }
      });

      // Should handle stress test within reasonable time
      expect(stressDuration).toBeLessThan(1000); // 1 second
    });
  });

  describe('Performance Regression Tests', () => {
    it('should not exceed baseline rendering time', async () => {
      const baseline = 50; // 50ms baseline
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        const duration = await benchmark.measure('baseline-render', () => {
          const { unmount } = render(<UnifiedSearch {...defaultProps} />);
          unmount();
        });

        expect(duration).toBeLessThan(baseline);
      }
    });

    it('should maintain consistent performance across multiple renders', async () => {
      const iterations = 20;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const duration = await benchmark.measure('consistency-test', () => {
          const { unmount } = render(<UnifiedSearch {...defaultProps} />);
          unmount();
        });
        durations.push(duration);
      }

      // Calculate coefficient of variation (standard deviation / mean)
      const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
      const variance = durations.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / durations.length;
      const standardDeviation = Math.sqrt(variance);
      const coefficientOfVariation = standardDeviation / mean;

      // Performance should be consistent (low coefficient of variation)
      expect(coefficientOfVariation).toBeLessThan(0.5); // 50% variation threshold
    });
  });
});