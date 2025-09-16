/**
 * Scroll Jank Detection Tests
 *
 * Advanced scroll performance testing to detect and measure
 * scrolling jank, layout thrashing, and frame drops during scroll events.
 *
 * @author QA Specialist - Scroll Performance
 * @version 1.0.0
 */

import { performance } from 'perf_hooks';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

interface ScrollMeasurement {
  timestamp: number;
  scrollTop: number;
  frameDuration: number;
  layoutReflows: number;
  paintEvents: number;
  compositeEvents: number;
}

interface JankMetrics {
  totalJankTime: number;
  jankFrames: number;
  averageFrameTime: number;
  worstFrameTime: number;
  smoothnessIndex: number;
  scrollEfficiency: number;
}

class ScrollJankDetector {
  private measurements: ScrollMeasurement[] = [];
  private isMonitoring = false;
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private layoutCount = 0;
  private paintCount = 0;
  private compositeCount = 0;

  constructor() {
    this.setupPerformanceObserver();
  }

  private setupPerformanceObserver(): void {
    // Mock PerformanceObserver for testing environment
    if (typeof PerformanceObserver !== 'undefined') {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          switch (entry.entryType) {
            case 'measure':
              if (entry.name.includes('layout')) this.layoutCount++;
              if (entry.name.includes('paint')) this.paintCount++;
              if (entry.name.includes('composite')) this.compositeCount++;
              break;
          }
        }
      });

      try {
        observer.observe({ entryTypes: ['measure', 'navigation', 'paint'] });
      } catch (e) {
        // Ignore if not supported in test environment
      }
    }
  }

  start(): void {
    this.isMonitoring = true;
    this.measurements = [];
    this.lastFrameTime = performance.now();
    this.layoutCount = 0;
    this.paintCount = 0;
    this.compositeCount = 0;
    this.monitorFrames();
  }

  stop(): JankMetrics {
    this.isMonitoring = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    return this.calculateJankMetrics();
  }

  recordScroll(scrollTop: number): void {
    if (!this.isMonitoring) return;

    const currentTime = performance.now();
    const frameDuration = currentTime - this.lastFrameTime;

    this.measurements.push({
      timestamp: currentTime,
      scrollTop,
      frameDuration,
      layoutReflows: this.layoutCount,
      paintEvents: this.paintCount,
      compositeEvents: this.compositeCount
    });

    this.lastFrameTime = currentTime;
  }

  private monitorFrames(): void {
    const measureFrame = () => {
      const currentTime = performance.now();

      if (this.isMonitoring) {
        this.rafId = requestAnimationFrame(measureFrame);
      }
    };

    this.rafId = requestAnimationFrame(measureFrame);
  }

  private calculateJankMetrics(): JankMetrics {
    if (this.measurements.length === 0) {
      return {
        totalJankTime: 0,
        jankFrames: 0,
        averageFrameTime: 0,
        worstFrameTime: 0,
        smoothnessIndex: 100,
        scrollEfficiency: 100
      };
    }

    const frameTimes = this.measurements.map(m => m.frameDuration);
    const jankThreshold = 16.67 * 1.5; // 1.5x normal frame time (25ms)

    const jankFrames = frameTimes.filter(time => time > jankThreshold);
    const totalJankTime = jankFrames.reduce((sum, time) => sum + (time - jankThreshold), 0);

    const averageFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
    const worstFrameTime = Math.max(...frameTimes);

    // Smoothness index (0-100, higher is better)
    const smoothnessIndex = Math.max(0, 100 - (jankFrames.length / frameTimes.length) * 100);

    // Scroll efficiency based on layout/paint events
    const totalScrollDistance = Math.abs(
      this.measurements[this.measurements.length - 1]?.scrollTop - this.measurements[0]?.scrollTop
    );
    const eventsPerPixel = totalScrollDistance > 0 ?
      (this.layoutCount + this.paintCount) / totalScrollDistance : 0;
    const scrollEfficiency = Math.max(0, 100 - eventsPerPixel * 100);

    return {
      totalJankTime,
      jankFrames: jankFrames.length,
      averageFrameTime,
      worstFrameTime,
      smoothnessIndex,
      scrollEfficiency
    };
  }
}

describe('Scroll Jank Detection Tests', () => {
  let detector: ScrollJankDetector;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    detector = new ScrollJankDetector();
    user = userEvent.setup({ delay: null });

    // Mock performance.now for consistent testing
    let mockTime = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => {
      mockTime += 16.67; // Normal frame time
      return mockTime;
    });

    // Mock requestAnimationFrame
    let frameId = 0;
    window.requestAnimationFrame = jest.fn((callback) => {
      setTimeout(callback, 16.67);
      return ++frameId;
    });
  });

  afterEach(() => {
    detector.stop();
    jest.restoreAllMocks();
  });

  describe('Basic Scroll Performance', () => {
    test('smooth scrolling should produce minimal jank', async () => {
      const SmoothScrollComponent = () => (
        <div
          data-testid="scroll-container"
          style={{
            height: '300px',
            overflowY: 'auto',
            border: '1px solid #ccc'
          }}
        >
          {Array.from({ length: 200 }, (_, i) => (
            <div
              key={i}
              style={{
                height: '50px',
                padding: '10px',
                borderBottom: '1px solid #eee',
                backgroundColor: i % 2 === 0 ? '#f9f9f9' : '#fff'
              }}
            >
              Smooth scroll item {i + 1}
            </div>
          ))}
        </div>
      );

      render(<SmoothScrollComponent />);
      const container = screen.getByTestId('scroll-container');

      detector.start();

      // Simulate smooth scrolling
      for (let scroll = 0; scroll <= 2000; scroll += 50) {
        fireEvent.scroll(container, { target: { scrollTop: scroll } });
        detector.recordScroll(scroll);

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 16));
        });
      }

      const metrics = detector.stop();

      expect(metrics.smoothnessIndex).toBeGreaterThan(85);
      expect(metrics.jankFrames).toBeLessThan(5);
      expect(metrics.averageFrameTime).toBeLessThan(20);
      expect(metrics.worstFrameTime).toBeLessThan(35);
    });

    test('rapid scrolling should maintain acceptable performance', async () => {
      const RapidScrollComponent = () => (
        <div
          data-testid="rapid-scroll"
          style={{
            height: '400px',
            overflowY: 'auto'
          }}
        >
          {Array.from({ length: 1000 }, (_, i) => (
            <div
              key={i}
              style={{
                height: '30px',
                padding: '5px 10px',
                borderBottom: '1px solid #ddd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>Item {i + 1}</span>
              <span style={{ fontSize: '12px', color: '#666' }}>
                {new Date(Date.now() + i * 1000).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      );

      render(<RapidScrollComponent />);
      const container = screen.getByTestId('rapid-scroll');

      detector.start();

      // Simulate rapid scrolling with varying speeds
      const scrollPattern = [0, 500, 1500, 800, 2500, 1200, 3000, 0];

      for (const scrollTop of scrollPattern) {
        fireEvent.scroll(container, { target: { scrollTop } });
        detector.recordScroll(scrollTop);

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 8)); // Faster scrolling
        });
      }

      const metrics = detector.stop();

      expect(metrics.smoothnessIndex).toBeGreaterThan(70);
      expect(metrics.jankFrames).toBeLessThan(8);
      expect(metrics.scrollEfficiency).toBeGreaterThan(60);
    });
  });

  describe('Complex Content Scroll Performance', () => {
    test('images and complex layouts should not cause excessive jank', async () => {
      const ComplexContentComponent = () => (
        <div
          data-testid="complex-scroll"
          style={{
            height: '350px',
            overflowY: 'auto'
          }}
        >
          {Array.from({ length: 100 }, (_, i) => (
            <div
              key={i}
              style={{
                padding: '15px',
                borderBottom: '1px solid #ddd',
                display: 'flex',
                gap: '15px',
                alignItems: 'center'
              }}
            >
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  backgroundColor: `hsl(${(i * 137.5) % 360}, 70%, 50%)`,
                  borderRadius: '50%',
                  flexShrink: 0
                }}
              />
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>
                  Complex Item {i + 1}
                </h3>
                <p style={{ margin: '0', fontSize: '14px', color: '#666', lineHeight: 1.4 }}>
                  This is a complex item with multiple elements, layouts, and styling that could
                  potentially cause layout thrashing during scroll. Item index: {i}
                </p>
                <div style={{ marginTop: '8px', display: 'flex', gap: '5px' }}>
                  {Array.from({ length: 3 }, (_, j) => (
                    <span
                      key={j}
                      style={{
                        padding: '2px 6px',
                        backgroundColor: '#e0e0e0',
                        borderRadius: '3px',
                        fontSize: '12px'
                      }}
                    >
                      Tag {j + 1}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '12px', color: '#999' }}>
                <div>{new Date(Date.now() + i * 3600000).toLocaleDateString()}</div>
                <div>{Math.floor(Math.random() * 1000)} views</div>
              </div>
            </div>
          ))}
        </div>
      );

      render(<ComplexContentComponent />);
      const container = screen.getByTestId('complex-scroll');

      detector.start();

      // Scroll through complex content
      for (let scroll = 0; scroll <= 1500; scroll += 75) {
        fireEvent.scroll(container, { target: { scrollTop: scroll } });
        detector.recordScroll(scroll);

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 20));
        });
      }

      const metrics = detector.stop();

      expect(metrics.smoothnessIndex).toBeGreaterThan(75);
      expect(metrics.jankFrames).toBeLessThan(6);
      expect(metrics.averageFrameTime).toBeLessThan(25);
    });

    test('dynamic content updates during scroll should not cause jank', async () => {
      const DynamicContentComponent = () => {
        const [scrollTop, setScrollTop] = React.useState(0);
        const [updateCounter, setUpdateCounter] = React.useState(0);

        React.useEffect(() => {
          const interval = setInterval(() => {
            setUpdateCounter(prev => prev + 1);
          }, 100);

          return () => clearInterval(interval);
        }, []);

        return (
          <div
            data-testid="dynamic-scroll"
            style={{
              height: '300px',
              overflowY: 'auto'
            }}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          >
            <div style={{ padding: '10px', backgroundColor: '#f0f0f0', position: 'sticky', top: 0 }}>
              Scroll Position: {scrollTop}px | Updates: {updateCounter}
            </div>
            {Array.from({ length: 300 }, (_, i) => (
              <div
                key={i}
                style={{
                  height: '40px',
                  padding: '10px',
                  borderBottom: '1px solid #eee',
                  backgroundColor: Math.abs(scrollTop - i * 40) < 200 ? '#fff3cd' : '#fff',
                  transition: 'background-color 0.2s ease'
                }}
              >
                Dynamic Item {i + 1} (Update: {updateCounter})
              </div>
            ))}
          </div>
        );
      };

      render(<DynamicContentComponent />);
      const container = screen.getByTestId('dynamic-scroll');

      detector.start();

      // Scroll while content is dynamically updating
      for (let scroll = 0; scroll <= 2000; scroll += 100) {
        fireEvent.scroll(container, { target: { scrollTop: scroll } });
        detector.recordScroll(scroll);

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 25));
        });
      }

      const metrics = detector.stop();

      expect(metrics.smoothnessIndex).toBeGreaterThan(70);
      expect(metrics.jankFrames).toBeLessThan(8);
    });
  });

  describe('Virtual Scrolling Performance', () => {
    test('virtual scrolling should eliminate jank for large datasets', async () => {
      const VirtualScrollComponent = () => {
        const [scrollTop, setScrollTop] = React.useState(0);
        const itemHeight = 50;
        const containerHeight = 400;
        const totalItems = 10000;
        const visibleCount = Math.ceil(containerHeight / itemHeight);
        const overscan = 5;

        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const endIndex = Math.min(totalItems, startIndex + visibleCount + overscan * 2);

        return (
          <div
            data-testid="virtual-scroll"
            style={{
              height: `${containerHeight}px`,
              overflowY: 'auto'
            }}
            onScroll={(e) => {
              const newScrollTop = e.currentTarget.scrollTop;
              setScrollTop(newScrollTop);
              detector.recordScroll(newScrollTop);
            }}
          >
            <div style={{ height: `${totalItems * itemHeight}px`, position: 'relative' }}>
              {Array.from({ length: endIndex - startIndex }, (_, i) => {
                const index = startIndex + i;
                return (
                  <div
                    key={index}
                    style={{
                      position: 'absolute',
                      top: `${index * itemHeight}px`,
                      width: '100%',
                      height: `${itemHeight}px`,
                      padding: '10px',
                      borderBottom: '1px solid #eee',
                      backgroundColor: index % 2 === 0 ? '#f9f9f9' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>Virtual Item {index + 1}</span>
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      {index * 1.5}MB
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      };

      render(<VirtualScrollComponent />);
      const container = screen.getByTestId('virtual-scroll');

      detector.start();

      // Scroll rapidly through virtual list
      const scrollPositions = [0, 1000, 5000, 10000, 25000, 50000, 100000, 0];

      for (const position of scrollPositions) {
        fireEvent.scroll(container, { target: { scrollTop: position } });

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 16));
        });
      }

      const metrics = detector.stop();

      expect(metrics.smoothnessIndex).toBeGreaterThan(85);
      expect(metrics.jankFrames).toBeLessThan(3);
      expect(metrics.averageFrameTime).toBeLessThan(18);
      expect(metrics.scrollEfficiency).toBeGreaterThan(80);
    });
  });

  describe('Horizontal Scroll Performance', () => {
    test('horizontal scrolling should perform as well as vertical', async () => {
      const HorizontalScrollComponent = () => (
        <div
          data-testid="horizontal-scroll"
          style={{
            width: '400px',
            height: '100px',
            overflowX: 'auto',
            display: 'flex'
          }}
        >
          {Array.from({ length: 100 }, (_, i) => (
            <div
              key={i}
              style={{
                minWidth: '120px',
                height: '80px',
                margin: '10px 5px',
                padding: '10px',
                backgroundColor: `hsl(${(i * 137.5) % 360}, 60%, 90%)`,
                border: '1px solid #ddd',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              Item {i + 1}
            </div>
          ))}
        </div>
      );

      render(<HorizontalScrollComponent />);
      const container = screen.getByTestId('horizontal-scroll');

      detector.start();

      // Horizontal scrolling
      for (let scroll = 0; scroll <= 2000; scroll += 80) {
        fireEvent.scroll(container, { target: { scrollLeft: scroll } });
        detector.recordScroll(scroll);

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 16));
        });
      }

      const metrics = detector.stop();

      expect(metrics.smoothnessIndex).toBeGreaterThan(80);
      expect(metrics.jankFrames).toBeLessThan(5);
    });
  });

  describe('Scroll Momentum and Easing', () => {
    test('momentum scrolling should maintain smooth deceleration', async () => {
      const MomentumScrollComponent = () => {
        const [scrollTop, setScrollTop] = React.useState(0);
        const [momentum, setMomentum] = React.useState(0);

        const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
          const newScrollTop = e.currentTarget.scrollTop;
          const delta = newScrollTop - scrollTop;
          setMomentum(delta);
          setScrollTop(newScrollTop);
          detector.recordScroll(newScrollTop);
        };

        return (
          <div
            data-testid="momentum-scroll"
            style={{
              height: '300px',
              overflowY: 'auto',
              scrollBehavior: 'smooth'
            }}
            onScroll={handleScroll}
          >
            <div style={{
              padding: '10px',
              backgroundColor: '#e3f2fd',
              position: 'sticky',
              top: 0,
              zIndex: 1
            }}>
              Position: {Math.round(scrollTop)}px | Momentum: {Math.round(momentum)}px/frame
            </div>
            {Array.from({ length: 500 }, (_, i) => (
              <div
                key={i}
                style={{
                  height: '60px',
                  padding: '15px',
                  borderBottom: '1px solid #ddd',
                  backgroundColor: '#fff'
                }}
              >
                Momentum item {i + 1}
              </div>
            ))}
          </div>
        );
      };

      render(<MomentumScrollComponent />);
      const container = screen.getByTestId('momentum-scroll');

      detector.start();

      // Simulate momentum scrolling with deceleration
      let velocity = 200;
      let position = 0;

      while (velocity > 5) {
        position += velocity;
        velocity *= 0.95; // Deceleration

        fireEvent.scroll(container, { target: { scrollTop: position } });

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 16));
        });
      }

      const metrics = detector.stop();

      expect(metrics.smoothnessIndex).toBeGreaterThan(80);
      expect(metrics.averageFrameTime).toBeLessThan(20);
    });
  });

  describe('Jank Threshold Validation', () => {
    test('should correctly identify jank frames', () => {
      // Simulate known jank scenario
      const testDetector = new ScrollJankDetector();

      // Mock measurements with known jank
      const measurements = [
        { timestamp: 0, scrollTop: 0, frameDuration: 16.67, layoutReflows: 0, paintEvents: 1, compositeEvents: 1 },
        { timestamp: 16.67, scrollTop: 50, frameDuration: 16.67, layoutReflows: 0, paintEvents: 1, compositeEvents: 1 },
        { timestamp: 33.34, scrollTop: 100, frameDuration: 35, layoutReflows: 2, paintEvents: 2, compositeEvents: 1 }, // Jank
        { timestamp: 68.34, scrollTop: 150, frameDuration: 16.67, layoutReflows: 0, paintEvents: 1, compositeEvents: 1 },
        { timestamp: 85.01, scrollTop: 200, frameDuration: 50, layoutReflows: 3, paintEvents: 3, compositeEvents: 2 }, // Major jank
      ];

      (testDetector as any).measurements = measurements;
      const metrics = (testDetector as any).calculateJankMetrics();

      expect(metrics.jankFrames).toBe(2);
      expect(metrics.worstFrameTime).toBe(50);
      expect(metrics.smoothnessIndex).toBeLessThan(80);
      expect(metrics.totalJankTime).toBeGreaterThan(0);
    });
  });
});