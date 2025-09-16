import React, { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { Button } from '../common/Button';
import { KBEntryForm } from '../forms/KBEntryForm';
import { SearchInterface } from '../search/SearchInterface';
import { PerformanceTester, MockDataGenerator } from './test-utils';

// Performance benchmarks and thresholds
const PERFORMANCE_THRESHOLDS = {
  RENDER_TIME: 100, // ms
  INTERACTION_TIME: 50, // ms
  LARGE_LIST_RENDER: 500, // ms for 100 items
  FORM_VALIDATION: 20, // ms
  SEARCH_RESPONSE: 200, // ms
  MEMORY_LEAK_TOLERANCE: 1000 // objects
};

describe('Component Performance Tests', () => {
  let performanceTester: PerformanceTester;

  beforeEach(() => {
    performanceTester = new PerformanceTester();
    
    // Clear any existing timers
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    performanceTester.reset();
  });

  describe('Button Performance', () => {
    it('renders within acceptable time limits', () => {
      const endMeasurement = performanceTester.startMeasurement('button-render');
      
      render(<Button>Performance Test Button</Button>);
      
      const renderTime = endMeasurement();
      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RENDER_TIME);
    });

    it('handles rapid click interactions efficiently', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      
      render(<Button onClick={handleClick}>Click Test</Button>);
      const button = screen.getByRole('button');
      
      const endMeasurement = performanceTester.startMeasurement('button-clicks');
      
      // Simulate rapid clicks
      for (let i = 0; i < 10; i++) {
        await user.click(button);
      }
      
      const totalTime = endMeasurement();
      const averageClickTime = totalTime / 10;
      
      expect(averageClickTime).toBeLessThan(PERFORMANCE_THRESHOLDS.INTERACTION_TIME);
      expect(handleClick).toHaveBeenCalledTimes(10);
    });

    it('handles loading state changes efficiently', async () => {
      const LoadingButton = () => {
        const [loading, setLoading] = useState(false);
        
        return (
          <div>
            <Button loading={loading}>Test Button</Button>
            <button onClick={() => setLoading(!loading)}>
              Toggle Loading
            </button>
          </div>
        );
      };

      const user = userEvent.setup();
      render(<LoadingButton />);
      
      const toggleButton = screen.getByText('Toggle Loading');
      
      const endMeasurement = performanceTester.startMeasurement('loading-toggle');
      
      // Toggle loading state multiple times
      for (let i = 0; i < 20; i++) {
        await user.click(toggleButton);
        jest.advanceTimersByTime(1);
      }
      
      const totalTime = endMeasurement();
      const averageToggleTime = totalTime / 20;
      
      expect(averageToggleTime).toBeLessThan(PERFORMANCE_THRESHOLDS.INTERACTION_TIME);
    });

    it('handles multiple variants without performance degradation', () => {
      const variants = ['primary', 'secondary', 'danger', 'success', 'ghost'] as const;
      
      const endMeasurement = performanceTester.startMeasurement('multiple-variants');
      
      const { rerender } = render(<Button variant="primary">Test</Button>);
      
      variants.forEach(variant => {
        rerender(<Button variant={variant}>Test</Button>);
      });
      
      const totalTime = endMeasurement();
      const averageRerenderTime = totalTime / variants.length;
      
      expect(averageRerenderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RENDER_TIME / 2);
    });
  });

  describe('Form Performance', () => {
    const defaultProps = {
      onSubmit: jest.fn(),
      onCancel: jest.fn()
    };

    it('renders form within acceptable time', () => {
      const endMeasurement = performanceTester.startMeasurement('form-render');
      
      render(<KBEntryForm {...defaultProps} />);
      
      const renderTime = endMeasurement();
      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RENDER_TIME);
    });

    it('handles rapid typing without lag', async () => {
      const user = userEvent.setup();
      
      render(<KBEntryForm {...defaultProps} />);
      
      const titleInput = screen.getByLabelText(/title/i);
      
      const longText = 'This is a very long title that simulates rapid typing by a user who types very fast and wants to test the performance of the input field under heavy load conditions';
      
      const endMeasurement = performanceTester.startMeasurement('typing-performance');
      
      await user.type(titleInput, longText);
      
      const totalTime = endMeasurement();
      const timePerCharacter = totalTime / longText.length;
      
      expect(timePerCharacter).toBeLessThan(5); // 5ms per character max
      expect(titleInput).toHaveValue(longText);
    });

    it('validates form fields efficiently', async () => {
      const user = userEvent.setup();
      
      render(<KBEntryForm {...defaultProps} />);
      
      const submitButton = screen.getByText(/save|submit/i);
      
      const endMeasurement = performanceTester.startMeasurement('form-validation');
      
      // Trigger validation by submitting empty form
      await user.click(submitButton);
      
      const validationTime = endMeasurement();
      
      expect(validationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FORM_VALIDATION);
    });

    it('handles large tag arrays efficiently', async () => {
      const user = userEvent.setup();
      const manyTags = Array.from({ length: 50 }, (_, i) => `tag-${i}`);
      
      const initialData = {
        title: 'Performance Test',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'VSAM' as const,
        tags: manyTags
      };
      
      const endMeasurement = performanceTester.startMeasurement('large-tags-render');
      
      render(<KBEntryForm {...defaultProps} initialData={initialData} />);
      
      const renderTime = endMeasurement();
      
      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_LIST_RENDER);
      
      // Verify all tags are rendered
      manyTags.slice(0, 10).forEach(tag => {
        expect(screen.getByText(tag)).toBeInTheDocument();
      });
    });
  });

  describe('Search Performance', () => {
    it('handles search input efficiently', async () => {
      const user = userEvent.setup();
      const mockOnSearch = jest.fn();
      
      render(<SearchInterface onSearch={mockOnSearch} />);
      
      const searchInput = screen.getByRole('textbox');
      const searchQuery = 'performance test query';
      
      const endMeasurement = performanceTester.startMeasurement('search-input');
      
      await user.type(searchInput, searchQuery);
      
      const inputTime = endMeasurement();
      const timePerCharacter = inputTime / searchQuery.length;
      
      expect(timePerCharacter).toBeLessThan(3); // 3ms per character max
    });

    it('debounces search requests properly', async () => {
      jest.useRealTimers(); // Need real timers for debouncing
      
      const user = userEvent.setup();
      const mockOnSearch = jest.fn();
      
      render(<SearchInterface onSearch={mockOnSearch} debounceMs={100} />);
      
      const searchInput = screen.getByRole('textbox');
      
      const endMeasurement = performanceTester.startMeasurement('debounced-search');
      
      // Type rapidly
      await user.type(searchInput, 'test');
      
      // Wait for debounce
      await waitFor(() => expect(mockOnSearch).toHaveBeenCalled(), { timeout: 200 });
      
      const totalTime = endMeasurement();
      
      expect(totalTime).toBeGreaterThan(100); // Should wait for debounce
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_RESPONSE);
      expect(mockOnSearch).toHaveBeenCalledTimes(1); // Should be debounced to single call
    });
  });

  describe('Memory Usage', () => {
    it('does not leak memory on component unmount', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Render and unmount multiple times
      for (let i = 0; i < 100; i++) {
        const { unmount } = render(<Button>Memory Test {i}</Button>);
        unmount();
      }
      
      // Force garbage collection if available
      if ((global as any).gc) {
        (global as any).gc();
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Allow some memory increase but not excessive
      if (initialMemory > 0) {
        expect(memoryIncrease).toBeLessThan(1024 * 1024); // 1MB max increase
      }
    });

    it('handles event listener cleanup', () => {
      let eventListenerCount = 0;
      const originalAddEventListener = Element.prototype.addEventListener;
      const originalRemoveEventListener = Element.prototype.removeEventListener;
      
      Element.prototype.addEventListener = function(...args) {
        eventListenerCount++;
        return originalAddEventListener.apply(this, args);
      };
      
      Element.prototype.removeEventListener = function(...args) {
        eventListenerCount--;
        return originalRemoveEventListener.apply(this, args);
      };
      
      try {
        const { unmount } = render(
          <div>
            <Button onClick={() => {}}>Test</Button>
            <KBEntryForm onSubmit={() => {}} onCancel={() => {}} />
          </div>
        );
        
        const listenersAfterMount = eventListenerCount;
        unmount();
        
        // Most event listeners should be cleaned up
        expect(eventListenerCount).toBeLessThanOrEqual(listenersAfterMount);
      } finally {
        // Restore original methods
        Element.prototype.addEventListener = originalAddEventListener;
        Element.prototype.removeEventListener = originalRemoveEventListener;
      }
    });
  });

  describe('Large Dataset Performance', () => {
    it('handles rendering many components efficiently', () => {
      const ManyButtons = () => (
        <div>
          {Array.from({ length: 100 }, (_, i) => (
            <Button key={i} variant={i % 2 === 0 ? 'primary' : 'secondary'}>
              Button {i}
            </Button>
          ))}
        </div>
      );
      
      const endMeasurement = performanceTester.startMeasurement('many-components');
      
      render(<ManyButtons />);
      
      const renderTime = endMeasurement();
      
      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_LIST_RENDER);
      expect(screen.getAllByRole('button')).toHaveLength(100);
    });

    it('handles frequent re-renders efficiently', () => {
      const FrequentRerender = () => {
        const [count, setCount] = useState(0);
        
        React.useEffect(() => {
          const interval = setInterval(() => {
            setCount(c => c + 1);
          }, 1);
          
          return () => clearInterval(interval);
        }, []);
        
        return <Button>Count: {count}</Button>;
      };
      
      const endMeasurement = performanceTester.startMeasurement('frequent-rerenders');
      
      const { unmount } = render(<FrequentRerender />);
      
      // Let it run for a bit
      jest.advanceTimersByTime(100);
      
      const renderTime = endMeasurement();
      unmount();
      
      // Should handle 100 re-renders in reasonable time
      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_LIST_RENDER);
    });
  });

  describe('Animation Performance', () => {
    it('handles loading animations efficiently', async () => {
      const endMeasurement = performanceTester.startMeasurement('loading-animation');
      
      render(<Button loading>Loading Button</Button>);
      
      // Simulate animation frames
      for (let i = 0; i < 60; i++) {
        jest.advanceTimersByTime(16); // ~60fps
      }
      
      const animationTime = endMeasurement();
      
      // Should handle 1 second of animation smoothly
      expect(animationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_LIST_RENDER);
    });
  });

  describe('Concurrent Updates', () => {
    it('handles simultaneous state updates efficiently', async () => {
      const ConcurrentUpdates = () => {
        const [state1, setState1] = useState(0);
        const [state2, setState2] = useState(0);
        const [state3, setState3] = useState(0);
        
        return (
          <div>
            <Button onClick={() => setState1(s => s + 1)}>State 1: {state1}</Button>
            <Button onClick={() => setState2(s => s + 1)}>State 2: {state2}</Button>
            <Button onClick={() => setState3(s => s + 1)}>State 3: {state3}</Button>
          </div>
        );
      };
      
      const user = userEvent.setup();
      render(<ConcurrentUpdates />);
      
      const buttons = screen.getAllByRole('button');
      
      const endMeasurement = performanceTester.startMeasurement('concurrent-updates');
      
      // Simulate rapid concurrent updates
      const promises = buttons.map(async (button, index) => {
        for (let i = 0; i < 10; i++) {
          await user.click(button);
          jest.advanceTimersByTime(1);
        }
      });
      
      await Promise.all(promises);
      
      const totalTime = endMeasurement();
      
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_LIST_RENDER);
      
      // Verify all updates were applied
      expect(screen.getByText('State 1: 10')).toBeInTheDocument();
      expect(screen.getByText('State 2: 10')).toBeInTheDocument();
      expect(screen.getByText('State 3: 10')).toBeInTheDocument();
    });
  });

  describe('Performance Regression Detection', () => {
    it('maintains consistent render times', () => {
      const renderTimes: number[] = [];
      
      // Measure multiple renders
      for (let i = 0; i < 10; i++) {
        const endMeasurement = performanceTester.startMeasurement(`render-${i}`);
        const { unmount } = render(<Button>Test {i}</Button>);
        renderTimes.push(endMeasurement());
        unmount();
      }
      
      const stats = performanceTester.getStats('render-0');
      
      // Check for performance consistency
      const maxRenderTime = Math.max(...renderTimes);
      const minRenderTime = Math.min(...renderTimes);
      const variance = maxRenderTime - minRenderTime;
      
      expect(variance).toBeLessThan(PERFORMANCE_THRESHOLDS.RENDER_TIME / 2);
      expect(maxRenderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RENDER_TIME);
    });
  });
});

// Performance testing utilities for other tests
export { PerformanceTester, PERFORMANCE_THRESHOLDS };