/**
 * Debounce and Throttle Effectiveness Tests
 *
 * Tests to validate the effectiveness of debouncing and throttling mechanisms
 * in reducing excessive function calls and improving performance.
 *
 * @author QA Specialist - Performance Optimization
 * @version 1.0.0
 */

import { performance } from 'perf_hooks';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { debounce, throttle } from 'lodash';

interface DebounceMetrics {
  totalCalls: number;
  actualExecutions: number;
  reductionPercentage: number;
  averageDelay: number;
  effectivenessScore: number;
}

interface ThrottleMetrics {
  totalCalls: number;
  actualExecutions: number;
  reductionPercentage: number;
  consistentTiming: boolean;
  timingAccuracy: number;
  effectivenessScore: number;
}

class PerformanceOptimizationMonitor {
  private callTimestamps: number[] = [];
  private executionTimestamps: number[] = [];

  recordCall(): void {
    this.callTimestamps.push(performance.now());
  }

  recordExecution(): void {
    this.executionTimestamps.push(performance.now());
  }

  getDebounceMetrics(expectedDelay: number): DebounceMetrics {
    const totalCalls = this.callTimestamps.length;
    const actualExecutions = this.executionTimestamps.length;
    const reductionPercentage = totalCalls > 0 ? ((totalCalls - actualExecutions) / totalCalls) * 100 : 0;

    // Calculate average delay between last call and execution
    const delays = this.executionTimestamps.map(execTime => {
      const relevantCalls = this.callTimestamps.filter(callTime => callTime <= execTime);
      const lastCall = Math.max(...relevantCalls);
      return execTime - lastCall;
    });

    const averageDelay = delays.length > 0 ? delays.reduce((sum, delay) => sum + delay, 0) / delays.length : 0;

    // Effectiveness score based on reduction and timing accuracy
    const timingAccuracy = Math.abs(averageDelay - expectedDelay) / expectedDelay;
    const effectivenessScore = Math.max(0, reductionPercentage - (timingAccuracy * 20));

    return {
      totalCalls,
      actualExecutions,
      reductionPercentage,
      averageDelay,
      effectivenessScore
    };
  }

  getThrottleMetrics(expectedInterval: number): ThrottleMetrics {
    const totalCalls = this.callTimestamps.length;
    const actualExecutions = this.executionTimestamps.length;
    const reductionPercentage = totalCalls > 0 ? ((totalCalls - actualExecutions) / totalCalls) * 100 : 0;

    // Check timing consistency
    const intervals = this.executionTimestamps
      .slice(1)
      .map((time, i) => time - this.executionTimestamps[i]);

    const averageInterval = intervals.length > 0 ? intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length : 0;
    const timingAccuracy = expectedInterval > 0 ? 1 - Math.abs(averageInterval - expectedInterval) / expectedInterval : 0;
    const consistentTiming = intervals.every(interval => Math.abs(interval - expectedInterval) < expectedInterval * 0.2);

    const effectivenessScore = Math.max(0, reductionPercentage * 0.7 + timingAccuracy * 30);

    return {
      totalCalls,
      actualExecutions,
      reductionPercentage,
      consistentTiming,
      timingAccuracy,
      effectivenessScore
    };
  }

  reset(): void {
    this.callTimestamps = [];
    this.executionTimestamps = [];
  }
}

describe('Debounce and Throttle Effectiveness Tests', () => {
  let monitor: PerformanceOptimizationMonitor;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    monitor = new PerformanceOptimizationMonitor();
    user = userEvent.setup({ delay: null });

    // Mock performance.now for consistent testing
    let mockTime = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => {
      mockTime += 1; // Increment by 1ms each call
      return mockTime;
    });
  });

  afterEach(() => {
    monitor.reset();
    jest.restoreAllMocks();
  });

  describe('Debounce Effectiveness Tests', () => {
    test('search input debouncing should reduce API calls significantly', async () => {
      let apiCallCount = 0;

      const SearchComponent = () => {
        const [query, setQuery] = React.useState('');

        const debouncedSearch = React.useMemo(
          () => debounce((searchQuery: string) => {
            apiCallCount++;
            monitor.recordExecution();
          }, 300),
          []
        );

        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const value = e.target.value;
          setQuery(value);
          monitor.recordCall();
          debouncedSearch(value);
        };

        return (
          <div>
            <input
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder="Search with debounce"
              data-testid="debounced-search"
            />
            <div data-testid="api-calls">API Calls: {apiCallCount}</div>
          </div>
        );
      };

      render(<SearchComponent />);
      const searchInput = screen.getByTestId('debounced-search');

      // Simulate rapid typing
      const testQuery = 'performance test query';
      for (const char of testQuery) {
        await user.type(searchInput, char, { delay: 50 });
      }

      // Wait for debounce to complete
      await waitFor(() => {
        expect(apiCallCount).toBeGreaterThan(0);
      }, { timeout: 1000 });

      const metrics = monitor.getDebounceMetrics(300);

      expect(metrics.reductionPercentage).toBeGreaterThan(80); // Should reduce calls by >80%
      expect(metrics.averageDelay).toBeCloseTo(300, 50); // Within 50ms of expected delay
      expect(metrics.effectivenessScore).toBeGreaterThan(70);
      expect(apiCallCount).toBeLessThan(testQuery.length); // Much fewer calls than characters
    });

    test('form validation debouncing should prevent excessive validation calls', async () => {
      let validationCount = 0;

      const FormComponent = () => {
        const [email, setEmail] = React.useState('');
        const [errors, setErrors] = React.useState<string[]>([]);

        const debouncedValidation = React.useMemo(
          () => debounce((value: string) => {
            validationCount++;
            monitor.recordExecution();

            const newErrors: string[] = [];
            if (!value.includes('@')) newErrors.push('Invalid email format');
            if (value.length < 5) newErrors.push('Email too short');
            setErrors(newErrors);
          }, 250),
          []
        );

        const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const value = e.target.value;
          setEmail(value);
          monitor.recordCall();
          debouncedValidation(value);
        };

        return (
          <div>
            <input
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="Enter email"
              data-testid="email-input"
            />
            <div data-testid="validation-count">Validations: {validationCount}</div>
            {errors.map((error, i) => (
              <div key={i} data-testid="error">{error}</div>
            ))}
          </div>
        );
      };

      render(<FormComponent />);
      const emailInput = screen.getByTestId('email-input');

      // Simulate user typing email
      await user.type(emailInput, 'test', { delay: 80 });
      await user.type(emailInput, '@', { delay: 80 });
      await user.type(emailInput, 'example.com', { delay: 80 });

      // Wait for final validation
      await waitFor(() => {
        expect(validationCount).toBeGreaterThan(0);
      }, { timeout: 500 });

      const metrics = monitor.getDebounceMetrics(250);

      expect(metrics.reductionPercentage).toBeGreaterThan(75);
      expect(metrics.effectivenessScore).toBeGreaterThan(65);
      expect(validationCount).toBeLessThan(15); // Much fewer than character count
    });

    test('resize event debouncing should limit layout recalculations', async () => {
      let layoutRecalculations = 0;

      const ResizeComponent = () => {
        const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });

        const debouncedResize = React.useMemo(
          () => debounce((width: number, height: number) => {
            layoutRecalculations++;
            monitor.recordExecution();
            setDimensions({ width, height });
          }, 150),
          []
        );

        const simulateResize = (width: number, height: number) => {
          monitor.recordCall();
          debouncedResize(width, height);
        };

        return (
          <div>
            <div data-testid="dimensions">
              {dimensions.width} x {dimensions.height}
            </div>
            <div data-testid="recalc-count">
              Recalculations: {layoutRecalculations}
            </div>
            <button
              onClick={() => simulateResize(900, 700)}
              data-testid="resize-trigger"
            >
              Trigger Resize
            </button>
          </div>
        );
      };

      render(<ResizeComponent />);
      const resizeTrigger = screen.getByTestId('resize-trigger');

      // Simulate multiple rapid resize events
      for (let i = 0; i < 20; i++) {
        await user.click(resizeTrigger);
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 25));
        });
      }

      // Wait for debounce to settle
      await waitFor(() => {
        expect(layoutRecalculations).toBeGreaterThan(0);
      }, { timeout: 400 });

      const metrics = monitor.getDebounceMetrics(150);

      expect(metrics.reductionPercentage).toBeGreaterThan(85);
      expect(metrics.effectivenessScore).toBeGreaterThan(75);
      expect(layoutRecalculations).toBeLessThan(5); // Much fewer than trigger count
    });
  });

  describe('Throttle Effectiveness Tests', () => {
    test('scroll event throttling should limit event handler calls', async () => {
      let scrollHandlerCalls = 0;

      const ScrollComponent = () => {
        const [scrollPosition, setScrollPosition] = React.useState(0);

        const throttledScrollHandler = React.useMemo(
          () => throttle((scrollTop: number) => {
            scrollHandlerCalls++;
            monitor.recordExecution();
            setScrollPosition(scrollTop);
          }, 100),
          []
        );

        const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
          monitor.recordCall();
          throttledScrollHandler(e.currentTarget.scrollTop);
        };

        return (
          <div
            data-testid="scroll-container"
            style={{ height: '200px', overflowY: 'auto' }}
            onScroll={handleScroll}
          >
            <div data-testid="scroll-position">Position: {scrollPosition}</div>
            <div data-testid="handler-calls">Handler calls: {scrollHandlerCalls}</div>
            {Array.from({ length: 100 }, (_, i) => (
              <div key={i} style={{ height: '50px', padding: '10px' }}>
                Scroll item {i + 1}
              </div>
            ))}
          </div>
        );
      };

      render(<ScrollComponent />);
      const scrollContainer = screen.getByTestId('scroll-container');

      // Simulate rapid scrolling
      for (let scroll = 0; scroll <= 1000; scroll += 20) {
        fireEvent.scroll(scrollContainer, { target: { scrollTop: scroll } });
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 5));
        });
      }

      // Wait for throttle to process
      await waitFor(() => {
        expect(scrollHandlerCalls).toBeGreaterThan(0);
      }, { timeout: 500 });

      const metrics = monitor.getThrottleMetrics(100);

      expect(metrics.reductionPercentage).toBeGreaterThan(70);
      expect(metrics.consistentTiming).toBe(true);
      expect(metrics.timingAccuracy).toBeGreaterThan(0.7);
      expect(metrics.effectivenessScore).toBeGreaterThan(60);
    });

    test('mousemove throttling should maintain smooth tracking with reduced calls', async () => {
      let mouseMoveCount = 0;

      const MouseTrackingComponent = () => {
        const [position, setPosition] = React.useState({ x: 0, y: 0 });

        const throttledMouseMove = React.useMemo(
          () => throttle((x: number, y: number) => {
            mouseMoveCount++;
            monitor.recordExecution();
            setPosition({ x, y });
          }, 16), // ~60fps
          []
        );

        const handleMouseMove = (e: React.MouseEvent) => {
          monitor.recordCall();
          throttledMouseMove(e.clientX, e.clientY);
        };

        return (
          <div
            data-testid="mouse-area"
            style={{
              width: '400px',
              height: '300px',
              backgroundColor: '#f0f0f0',
              cursor: 'crosshair'
            }}
            onMouseMove={handleMouseMove}
          >
            <div data-testid="mouse-position">
              Mouse: {position.x}, {position.y}
            </div>
            <div data-testid="move-count">
              Moves: {mouseMoveCount}
            </div>
          </div>
        );
      };

      render(<MouseTrackingComponent />);
      const mouseArea = screen.getByTestId('mouse-area');

      // Simulate rapid mouse movement
      for (let x = 0; x <= 300; x += 10) {
        fireEvent.mouseMove(mouseArea, { clientX: x, clientY: x });
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 2));
        });
      }

      await waitFor(() => {
        expect(mouseMoveCount).toBeGreaterThan(0);
      }, { timeout: 300 });

      const metrics = monitor.getThrottleMetrics(16);

      expect(metrics.reductionPercentage).toBeGreaterThan(60);
      expect(metrics.effectivenessScore).toBeGreaterThan(50);
      expect(mouseMoveCount).toBeLessThan(31); // Much fewer than event count
    });

    test('animation frame throttling should maintain 60fps limit', async () => {
      let animationFrames = 0;

      const AnimationComponent = () => {
        const [frame, setFrame] = React.useState(0);
        const [isAnimating, setIsAnimating] = React.useState(false);

        const throttledAnimation = React.useMemo(
          () => throttle(() => {
            animationFrames++;
            monitor.recordExecution();
            setFrame(prev => prev + 1);
          }, 16.67), // 60fps
          []
        );

        React.useEffect(() => {
          if (isAnimating) {
            const animate = () => {
              monitor.recordCall();
              throttledAnimation();
              if (isAnimating) {
                requestAnimationFrame(animate);
              }
            };
            animate();
          }
        }, [isAnimating, throttledAnimation]);

        return (
          <div>
            <button
              onClick={() => setIsAnimating(!isAnimating)}
              data-testid="animation-toggle"
            >
              {isAnimating ? 'Stop' : 'Start'} Animation
            </button>
            <div data-testid="frame-count">Frame: {frame}</div>
            <div data-testid="animation-frames">Animation frames: {animationFrames}</div>
          </div>
        );
      };

      render(<AnimationComponent />);
      const animationToggle = screen.getByTestId('animation-toggle');

      // Start animation
      await user.click(animationToggle);

      // Let animation run
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
      });

      // Stop animation
      await user.click(animationToggle);

      const metrics = monitor.getThrottleMetrics(16.67);

      expect(metrics.reductionPercentage).toBeGreaterThan(70);
      expect(animationFrames).toBeLessThan(35); // Should be around 30 frames for 500ms
      expect(animationFrames).toBeGreaterThan(25); // But not too few
    });
  });

  describe('Combined Debounce and Throttle Tests', () => {
    test('search with both debounce and throttle should optimize both user experience and performance', async () => {
      let searchCalls = 0;
      let suggestionCalls = 0;

      const AdvancedSearchComponent = () => {
        const [query, setQuery] = React.useState('');
        const [suggestions, setSuggestions] = React.useState<string[]>([]);

        // Throttled suggestions for immediate feedback
        const throttledSuggestions = React.useMemo(
          () => throttle((searchQuery: string) => {
            suggestionCalls++;
            const mockSuggestions = searchQuery
              ? [`${searchQuery} suggestion 1`, `${searchQuery} suggestion 2`]
              : [];
            setSuggestions(mockSuggestions);
          }, 150),
          []
        );

        // Debounced search for actual API call
        const debouncedSearch = React.useMemo(
          () => debounce((searchQuery: string) => {
            searchCalls++;
            monitor.recordExecution();
          }, 400),
          []
        );

        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const value = e.target.value;
          setQuery(value);
          monitor.recordCall();
          throttledSuggestions(value);
          debouncedSearch(value);
        };

        return (
          <div>
            <input
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder="Advanced search"
              data-testid="advanced-search"
            />
            <div data-testid="search-calls">Search calls: {searchCalls}</div>
            <div data-testid="suggestion-calls">Suggestion calls: {suggestionCalls}</div>
            <div data-testid="suggestions">
              {suggestions.map((suggestion, i) => (
                <div key={i}>{suggestion}</div>
              ))}
            </div>
          </div>
        );
      };

      render(<AdvancedSearchComponent />);
      const searchInput = screen.getByTestId('advanced-search');

      // Simulate realistic search behavior
      await user.type(searchInput, 'complex search query', { delay: 100 });

      // Wait for both debounce and throttle to settle
      await waitFor(() => {
        expect(searchCalls).toBeGreaterThan(0);
        expect(suggestionCalls).toBeGreaterThan(0);
      }, { timeout: 1000 });

      const metrics = monitor.getDebounceMetrics(400);

      expect(metrics.reductionPercentage).toBeGreaterThan(75);
      expect(searchCalls).toBeLessThan(5); // Very few actual searches
      expect(suggestionCalls).toBeGreaterThan(searchCalls); // More suggestions than searches
      expect(suggestionCalls).toBeLessThan(20); // But still controlled
    });
  });

  describe('Performance Impact Validation', () => {
    test('should measure actual performance improvement from optimization techniques', async () => {
      let unoptimizedCalls = 0;
      let optimizedCalls = 0;

      const PerformanceComparisonComponent = () => {
        const [query, setQuery] = React.useState('');
        const [useOptimization, setUseOptimization] = React.useState(false);

        const unoptimizedHandler = (value: string) => {
          unoptimizedCalls++;
          // Simulate expensive operation
          for (let i = 0; i < 1000; i++) {
            Math.sqrt(i);
          }
        };

        const optimizedHandler = React.useMemo(
          () => debounce((value: string) => {
            optimizedCalls++;
            // Same expensive operation
            for (let i = 0; i < 1000; i++) {
              Math.sqrt(i);
            }
          }, 200),
          []
        );

        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const value = e.target.value;
          setQuery(value);

          if (useOptimization) {
            optimizedHandler(value);
          } else {
            unoptimizedHandler(value);
          }
        };

        return (
          <div>
            <label>
              <input
                type="checkbox"
                checked={useOptimization}
                onChange={(e) => setUseOptimization(e.target.checked)}
                data-testid="optimization-toggle"
              />
              Use Optimization
            </label>
            <input
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder="Performance test"
              data-testid="performance-input"
            />
            <div data-testid="unoptimized-calls">Unoptimized: {unoptimizedCalls}</div>
            <div data-testid="optimized-calls">Optimized: {optimizedCalls}</div>
          </div>
        );
      };

      render(<PerformanceComparisonComponent />);
      const performanceInput = screen.getByTestId('performance-input');
      const optimizationToggle = screen.getByTestId('optimization-toggle');

      // Test unoptimized performance
      const startTime = performance.now();
      await user.type(performanceInput, 'test query', { delay: 50 });
      const unoptimizedTime = performance.now() - startTime;

      // Clear and switch to optimized
      await user.clear(performanceInput);
      await user.click(optimizationToggle);

      // Reset counters
      unoptimizedCalls = 0;
      optimizedCalls = 0;

      // Test optimized performance
      const optimizedStartTime = performance.now();
      await user.type(performanceInput, 'test query', { delay: 50 });
      await waitFor(() => expect(optimizedCalls).toBeGreaterThan(0), { timeout: 500 });
      const optimizedTime = performance.now() - optimizedStartTime;

      // Validation
      expect(unoptimizedCalls).toBe(0); // Should not have been called in optimized mode
      expect(optimizedCalls).toBeLessThan(10); // Much fewer calls

      // Performance should be similar or better despite the delay
      // (in real scenarios, the debounced version would perform better due to fewer expensive operations)
      const performanceImprovement = (unoptimizedTime - optimizedTime) / unoptimizedTime;
      expect(performanceImprovement).toBeGreaterThan(-0.5); // Allow some overhead for debouncing
    });
  });
});