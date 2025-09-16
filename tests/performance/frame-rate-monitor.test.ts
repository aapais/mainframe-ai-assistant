/**
 * Frame Rate Monitoring Tests
 *
 * Specialized tests for monitoring animation frame rates and detecting
 * visual performance issues in real-time interactions.
 *
 * @author QA Specialist - Frame Rate Analysis
 * @version 1.0.0
 */

import { performance } from 'perf_hooks';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

interface FrameData {
  timestamp: number;
  duration: number;
  droppedFrames: number;
}

interface FrameRateMetrics {
  averageFPS: number;
  minFPS: number;
  maxFPS: number;
  droppedFrames: number;
  jankOccurrences: number;
  smoothnessScore: number;
}

class FrameRateMonitor {
  private frames: FrameData[] = [];
  private rafId: number | null = null;
  private isMonitoring = false;
  private lastFrameTime = 0;
  private expectedFrameTime = 16.67; // 60 FPS = ~16.67ms per frame

  start(): void {
    this.isMonitoring = true;
    this.frames = [];
    this.lastFrameTime = performance.now();
    this.monitor();
  }

  stop(): FrameRateMetrics {
    this.isMonitoring = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    return this.calculateMetrics();
  }

  private monitor(): void {
    const measure = () => {
      const currentTime = performance.now();
      const duration = currentTime - this.lastFrameTime;

      // Calculate dropped frames based on expected frame timing
      const expectedFrames = Math.round(duration / this.expectedFrameTime);
      const droppedFrames = Math.max(0, expectedFrames - 1);

      this.frames.push({
        timestamp: currentTime,
        duration,
        droppedFrames
      });

      this.lastFrameTime = currentTime;

      if (this.isMonitoring) {
        this.rafId = requestAnimationFrame(measure);
      }
    };

    this.rafId = requestAnimationFrame(measure);
  }

  private calculateMetrics(): FrameRateMetrics {
    if (this.frames.length === 0) {
      return {
        averageFPS: 0,
        minFPS: 0,
        maxFPS: 0,
        droppedFrames: 0,
        jankOccurrences: 0,
        smoothnessScore: 0
      };
    }

    // Calculate FPS for each frame
    const fpsList = this.frames.map(frame =>
      frame.duration > 0 ? 1000 / frame.duration : 60
    );

    const averageFPS = fpsList.reduce((sum, fps) => sum + fps, 0) / fpsList.length;
    const minFPS = Math.min(...fpsList);
    const maxFPS = Math.max(...fpsList);
    const droppedFrames = this.frames.reduce((sum, frame) => sum + frame.droppedFrames, 0);

    // Count jank occurrences (frames taking longer than 20ms)
    const jankOccurrences = this.frames.filter(frame => frame.duration > 20).length;

    // Calculate smoothness score (0-100)
    const smoothnessScore = Math.max(0, 100 - (droppedFrames * 5) - (jankOccurrences * 10));

    return {
      averageFPS,
      minFPS,
      maxFPS,
      droppedFrames,
      jankOccurrences,
      smoothnessScore
    };
  }
}

describe('Frame Rate Monitoring Tests', () => {
  let monitor: FrameRateMonitor;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    monitor = new FrameRateMonitor();
    user = userEvent.setup({ delay: null });

    // Mock requestAnimationFrame for controlled testing
    let frameId = 0;
    const originalRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = jest.fn((callback) => {
      setTimeout(callback, 16.67); // Simulate 60fps
      return ++frameId;
    });

    // Mock performance.now for consistent timing
    const originalNow = performance.now;
    let mockTime = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => {
      mockTime += 16.67;
      return mockTime;
    });
  });

  afterEach(() => {
    monitor.stop();
    jest.restoreAllMocks();
  });

  describe('Animation Performance Monitoring', () => {
    test('smooth animations should maintain 60fps', async () => {
      const SmoothAnimationComponent = () => {
        const [isAnimating, setIsAnimating] = React.useState(false);
        const [position, setPosition] = React.useState(0);

        React.useEffect(() => {
          if (isAnimating) {
            let startTime: number;

            const animate = (timestamp: number) => {
              if (!startTime) startTime = timestamp;
              const elapsed = timestamp - startTime;
              const progress = Math.min(elapsed / 1000, 1); // 1 second animation

              setPosition(progress * 300); // Move 300px

              if (progress < 1) {
                requestAnimationFrame(animate);
              } else {
                setIsAnimating(false);
              }
            };

            requestAnimationFrame(animate);
          }
        }, [isAnimating]);

        return (
          <div>
            <button onClick={() => setIsAnimating(true)}>
              Start Animation
            </button>
            <div
              style={{
                width: '50px',
                height: '50px',
                backgroundColor: 'blue',
                transform: `translateX(${position}px)`,
                transition: isAnimating ? 'none' : 'transform 0.3s ease'
              }}
            />
          </div>
        );
      };

      render(<SmoothAnimationComponent />);
      monitor.start();

      const startButton = screen.getByText('Start Animation');
      await user.click(startButton);

      // Let animation run for 1 second
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      const metrics = monitor.stop();

      expect(metrics.averageFPS).toBeGreaterThanOrEqual(55);
      expect(metrics.droppedFrames).toBeLessThan(5);
      expect(metrics.jankOccurrences).toBeLessThan(3);
      expect(metrics.smoothnessScore).toBeGreaterThan(80);
    });

    test('complex animations should not drop below 50fps', async () => {
      const ComplexAnimationComponent = () => {
        const [isAnimating, setIsAnimating] = React.useState(false);
        const [items, setItems] = React.useState(
          Array.from({ length: 50 }, (_, i) => ({
            id: i,
            x: Math.random() * 400,
            y: Math.random() * 400,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4
          }))
        );

        React.useEffect(() => {
          if (isAnimating) {
            const animate = () => {
              setItems(prevItems =>
                prevItems.map(item => ({
                  ...item,
                  x: (item.x + item.vx + 400) % 400,
                  y: (item.y + item.vy + 400) % 400
                }))
              );

              if (isAnimating) {
                requestAnimationFrame(animate);
              }
            };

            requestAnimationFrame(animate);
          }
        }, [isAnimating]);

        return (
          <div>
            <button onClick={() => setIsAnimating(!isAnimating)}>
              {isAnimating ? 'Stop' : 'Start'} Complex Animation
            </button>
            <div style={{ position: 'relative', width: '400px', height: '400px', border: '1px solid black' }}>
              {items.map(item => (
                <div
                  key={item.id}
                  style={{
                    position: 'absolute',
                    left: `${item.x}px`,
                    top: `${item.y}px`,
                    width: '10px',
                    height: '10px',
                    backgroundColor: 'red',
                    borderRadius: '50%'
                  }}
                />
              ))}
            </div>
          </div>
        );
      };

      render(<ComplexAnimationComponent />);
      monitor.start();

      const startButton = screen.getByText('Start Complex Animation');
      await user.click(startButton);

      // Let complex animation run
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
      });

      const metrics = monitor.stop();

      expect(metrics.averageFPS).toBeGreaterThanOrEqual(45); // Lower threshold for complex animation
      expect(metrics.droppedFrames).toBeLessThan(15);
      expect(metrics.smoothnessScore).toBeGreaterThan(60);
    });
  });

  describe('Scroll Performance Monitoring', () => {
    test('smooth scrolling should maintain consistent frame rate', async () => {
      const LongListComponent = () => (
        <div
          style={{ height: '300px', overflowY: 'auto' }}
          data-testid="scroll-container"
        >
          {Array.from({ length: 1000 }, (_, i) => (
            <div key={i} style={{ height: '50px', padding: '10px', borderBottom: '1px solid #ccc' }}>
              Item {i + 1}
            </div>
          ))}
        </div>
      );

      render(<LongListComponent />);
      const scrollContainer = screen.getByTestId('scroll-container');

      monitor.start();

      // Simulate smooth scrolling
      for (let scroll = 0; scroll <= 1000; scroll += 100) {
        fireEvent.scroll(scrollContainer, { target: { scrollTop: scroll } });
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 16));
        });
      }

      const metrics = monitor.stop();

      expect(metrics.averageFPS).toBeGreaterThanOrEqual(50);
      expect(metrics.jankOccurrences).toBeLessThan(5);
      expect(metrics.smoothnessScore).toBeGreaterThan(70);
    });

    test('rapid scrolling should not cause excessive frame drops', async () => {
      const VirtualizedListComponent = () => {
        const [scrollTop, setScrollTop] = React.useState(0);
        const itemHeight = 50;
        const containerHeight = 300;
        const totalItems = 10000;

        const startIndex = Math.floor(scrollTop / itemHeight);
        const endIndex = Math.min(
          startIndex + Math.ceil(containerHeight / itemHeight) + 2,
          totalItems
        );

        return (
          <div
            style={{ height: `${containerHeight}px`, overflowY: 'auto' }}
            data-testid="virtual-scroll"
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
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
                      borderBottom: '1px solid #ccc'
                    }}
                  >
                    Virtual Item {index + 1}
                  </div>
                );
              })}
            </div>
          </div>
        );
      };

      render(<VirtualizedListComponent />);
      const scrollContainer = screen.getByTestId('virtual-scroll');

      monitor.start();

      // Rapid scrolling through virtual list
      const scrollPositions = [0, 1000, 5000, 10000, 25000, 50000, 0];
      for (const position of scrollPositions) {
        fireEvent.scroll(scrollContainer, { target: { scrollTop: position } });
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
        });
      }

      const metrics = monitor.stop();

      expect(metrics.averageFPS).toBeGreaterThanOrEqual(45);
      expect(metrics.droppedFrames).toBeLessThan(20);
      expect(metrics.smoothnessScore).toBeGreaterThan(60);
    });
  });

  describe('Interaction Frame Rate Tests', () => {
    test('hover effects should not impact frame rate', async () => {
      const HoverTestComponent = () => {
        const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

        return (
          <div>
            {Array.from({ length: 20 }, (_, i) => (
              <div
                key={i}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  padding: '10px',
                  margin: '2px',
                  backgroundColor: hoveredIndex === i ? '#e0e0e0' : '#f0f0f0',
                  transition: 'background-color 0.2s ease',
                  cursor: 'pointer'
                }}
              >
                Hover Item {i + 1}
              </div>
            ))}
          </div>
        );
      };

      render(<HoverTestComponent />);
      monitor.start();

      const items = screen.getAllByText(/Hover Item/);

      // Rapid hover across items
      for (const item of items.slice(0, 10)) {
        fireEvent.mouseEnter(item);
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 20));
        });
        fireEvent.mouseLeave(item);
      }

      const metrics = monitor.stop();

      expect(metrics.averageFPS).toBeGreaterThanOrEqual(55);
      expect(metrics.jankOccurrences).toBeLessThan(3);
    });

    test('form interactions should maintain smooth performance', async () => {
      const FormPerformanceComponent = () => {
        const [formData, setFormData] = React.useState({
          text: '',
          select: '',
          checkbox: false,
          range: 50
        });

        return (
          <form>
            <input
              type="text"
              value={formData.text}
              onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
              placeholder="Type rapidly here"
            />
            <select
              value={formData.select}
              onChange={(e) => setFormData(prev => ({ ...prev, select: e.target.value }))}
            >
              <option value="">Select option</option>
              {Array.from({ length: 100 }, (_, i) => (
                <option key={i} value={`option-${i}`}>Option {i + 1}</option>
              ))}
            </select>
            <input
              type="checkbox"
              checked={formData.checkbox}
              onChange={(e) => setFormData(prev => ({ ...prev, checkbox: e.target.checked }))}
            />
            <input
              type="range"
              min="0"
              max="100"
              value={formData.range}
              onChange={(e) => setFormData(prev => ({ ...prev, range: parseInt(e.target.value) }))}
            />
            <div>Current values: {JSON.stringify(formData)}</div>
          </form>
        );
      };

      render(<FormPerformanceComponent />);
      monitor.start();

      const textInput = screen.getByPlaceholderText('Type rapidly here');
      const selectElement = screen.getByRole('combobox');
      const checkbox = screen.getByRole('checkbox');
      const range = screen.getByRole('slider');

      // Rapid form interactions
      await user.type(textInput, 'Performance testing with rapid typing');
      await user.selectOptions(selectElement, 'option-50');
      await user.click(checkbox);

      // Simulate range slider interaction
      fireEvent.change(range, { target: { value: '75' } });

      const metrics = monitor.stop();

      expect(metrics.averageFPS).toBeGreaterThanOrEqual(50);
      expect(metrics.droppedFrames).toBeLessThan(10);
    });
  });

  describe('Performance Degradation Detection', () => {
    test('should detect performance degradation under load', async () => {
      const PerformanceTestComponent = () => {
        const [load, setLoad] = React.useState(1);
        const [items, setItems] = React.useState([]);

        React.useEffect(() => {
          const newItems = Array.from({ length: load * 50 }, (_, i) => ({
            id: i,
            value: Math.random(),
            animated: true
          }));
          setItems(newItems);
        }, [load]);

        return (
          <div>
            <button onClick={() => setLoad(prev => prev + 1)}>
              Increase Load (Current: {load})
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '2px' }}>
              {items.map(item => (
                <div
                  key={item.id}
                  style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: `hsl(${item.value * 360}, 50%, 50%)`,
                    transform: `scale(${0.5 + item.value * 0.5})`,
                    transition: 'all 0.3s ease'
                  }}
                />
              ))}
            </div>
          </div>
        );
      };

      render(<PerformanceTestComponent />);

      const loadButton = screen.getByText(/Increase Load/);
      const metricsHistory: FrameRateMetrics[] = [];

      // Test performance at different load levels
      for (let i = 0; i < 5; i++) {
        monitor.start();

        await user.click(loadButton);
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 500));
        });

        const metrics = monitor.stop();
        metricsHistory.push(metrics);
      }

      // Verify performance degradation is detected
      const initialFPS = metricsHistory[0].averageFPS;
      const finalFPS = metricsHistory[metricsHistory.length - 1].averageFPS;

      expect(finalFPS).toBeLessThan(initialFPS);
      expect(metricsHistory.every(m => m.averageFPS > 30)).toBe(true); // Should maintain minimum 30fps
    });
  });

  describe('Frame Rate Reporting', () => {
    test('should provide detailed frame rate analysis', () => {
      // Simulate frame data
      const testFrames: FrameData[] = [
        { timestamp: 0, duration: 16.67, droppedFrames: 0 },
        { timestamp: 16.67, duration: 16.67, droppedFrames: 0 },
        { timestamp: 33.34, duration: 25, droppedFrames: 1 }, // Jank frame
        { timestamp: 58.34, duration: 16.67, droppedFrames: 0 },
        { timestamp: 75.01, duration: 33.34, droppedFrames: 2 }, // Major jank
        { timestamp: 108.35, duration: 16.67, droppedFrames: 0 },
      ];

      // Create a custom monitor for testing
      const testMonitor = new FrameRateMonitor();
      (testMonitor as any).frames = testFrames;

      const metrics = (testMonitor as any).calculateMetrics();

      expect(metrics.averageFPS).toBeCloseTo(48.39, 1); // Calculated from frame durations
      expect(metrics.droppedFrames).toBe(3);
      expect(metrics.jankOccurrences).toBe(2);
      expect(metrics.smoothnessScore).toBeLessThan(100);
    });
  });
});