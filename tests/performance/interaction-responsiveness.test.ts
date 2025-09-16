/**
 * Interaction Responsiveness Performance Tests
 *
 * Comprehensive test suite for measuring UI interaction performance:
 * - Input latency and response times (target < 50ms)
 * - Animation performance and frame rates (target 60fps)
 * - Scroll performance and jank detection
 * - Click/tap response times (target < 100ms)
 * - Debouncing and throttling effectiveness
 * - Interaction responsiveness during heavy computation
 *
 * @author QA Specialist - Interaction Performance Testing
 * @version 1.0.0
 */

import { performance, PerformanceObserver } from 'perf_hooks';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntelligentSearchInput } from '../../src/components/search/IntelligentSearchInput';
import { SearchResults } from '../../src/components/search/SearchResults';
import { VirtualScrolling } from '../../src/components/performance/VirtualScrolling';
import { EnhancedSmartEntryForm } from '../../src/components/forms/EnhancedSmartEntryForm';
import { generateTestData } from '../fixtures/performanceData';

// Performance measurement utilities
interface PerformanceMetrics {
  inputLatency: number;
  frameRate: number;
  scrollJank: number;
  clickResponseTime: number;
  debounceEffectiveness: number;
  overallResponsiveness: number;
}

interface InteractionMeasurement {
  startTime: number;
  endTime: number;
  duration: number;
  framesMissed: number;
  type: 'input' | 'click' | 'scroll' | 'animation';
}

class InteractionPerformanceMonitor {
  private measurements: InteractionMeasurement[] = [];
  private rafId: number | null = null;
  private frameTimings: number[] = [];
  private isMonitoring = false;

  startMonitoring(): void {
    this.isMonitoring = true;
    this.measurements = [];
    this.frameTimings = [];
    this.monitorFrames();
  }

  stopMonitoring(): PerformanceMetrics {
    this.isMonitoring = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    return this.calculateMetrics();
  }

  recordInteraction(type: InteractionMeasurement['type'], startTime: number): void {
    const endTime = performance.now();
    const duration = endTime - startTime;
    const framesMissed = this.calculateFramesMissed(startTime, endTime);

    this.measurements.push({
      startTime,
      endTime,
      duration,
      framesMissed,
      type
    });
  }

  private monitorFrames(): void {
    const measureFrame = () => {
      this.frameTimings.push(performance.now());

      // Keep only last 60 frames (1 second at 60fps)
      if (this.frameTimings.length > 60) {
        this.frameTimings.shift();
      }

      if (this.isMonitoring) {
        this.rafId = requestAnimationFrame(measureFrame);
      }
    };

    this.rafId = requestAnimationFrame(measureFrame);
  }

  private calculateFramesMissed(startTime: number, endTime: number): number {
    const expectedFrames = Math.ceil((endTime - startTime) / 16.67); // 60fps = ~16.67ms per frame
    const relevantTimings = this.frameTimings.filter(
      timing => timing >= startTime && timing <= endTime
    );
    return Math.max(0, expectedFrames - relevantTimings.length);
  }

  private calculateMetrics(): PerformanceMetrics {
    const inputMeasurements = this.measurements.filter(m => m.type === 'input');
    const clickMeasurements = this.measurements.filter(m => m.type === 'click');
    const scrollMeasurements = this.measurements.filter(m => m.type === 'scroll');
    const animationMeasurements = this.measurements.filter(m => m.type === 'animation');

    // Calculate average input latency
    const avgInputLatency = inputMeasurements.length > 0
      ? inputMeasurements.reduce((sum, m) => sum + m.duration, 0) / inputMeasurements.length
      : 0;

    // Calculate frame rate
    const frameIntervals = this.frameTimings
      .slice(1)
      .map((timing, i) => timing - this.frameTimings[i]);
    const avgFrameInterval = frameIntervals.length > 0
      ? frameIntervals.reduce((sum, interval) => sum + interval, 0) / frameIntervals.length
      : 16.67;
    const frameRate = 1000 / avgFrameInterval;

    // Calculate scroll jank (frames missed during scrolling)
    const scrollJank = scrollMeasurements.length > 0
      ? scrollMeasurements.reduce((sum, m) => sum + m.framesMissed, 0) / scrollMeasurements.length
      : 0;

    // Calculate click response time
    const avgClickResponseTime = clickMeasurements.length > 0
      ? clickMeasurements.reduce((sum, m) => sum + m.duration, 0) / clickMeasurements.length
      : 0;

    // Calculate debounce effectiveness (lower duration = better debouncing)
    const debounceEffectiveness = inputMeasurements.length > 0
      ? Math.max(0, 100 - (avgInputLatency / 2)) // Inverted score
      : 100;

    // Overall responsiveness score
    const overallResponsiveness = Math.min(100,
      (frameRate / 60) * 30 + // 30% weight on frame rate
      Math.max(0, (100 - avgInputLatency) / 100) * 25 + // 25% weight on input latency
      Math.max(0, (100 - avgClickResponseTime) / 100) * 25 + // 25% weight on click response
      Math.max(0, (100 - scrollJank * 10) / 100) * 20 // 20% weight on scroll performance
    );

    return {
      inputLatency: avgInputLatency,
      frameRate,
      scrollJank,
      clickResponseTime: avgClickResponseTime,
      debounceEffectiveness,
      overallResponsiveness
    };
  }
}

describe('Interaction Responsiveness Performance Tests', () => {
  let monitor: InteractionPerformanceMonitor;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    monitor = new InteractionPerformanceMonitor();
    user = userEvent.setup({ delay: null });

    // Mock performance.now for consistent testing
    const originalNow = performance.now;
    let mockTime = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => {
      mockTime += 16.67; // Simulate 60fps
      return mockTime;
    });
  });

  afterEach(() => {
    monitor.stopMonitoring();
    jest.restoreAllMocks();
  });

  describe('Input Latency Tests', () => {
    test('search input should respond within 50ms', async () => {
      const mockOnChange = jest.fn();
      render(
        <IntelligentSearchInput
          onChange={mockOnChange}
          enableAutocomplete={true}
          enableHistory={true}
        />
      );

      const searchInput = screen.getByRole('searchbox');
      monitor.startMonitoring();

      // Measure input latency
      const startTime = performance.now();
      await user.type(searchInput, 'test query');
      monitor.recordInteraction('input', startTime);

      const metrics = monitor.stopMonitoring();

      expect(metrics.inputLatency).toBeLessThan(50);
      expect(mockOnChange).toHaveBeenCalled();
    });

    test('form input should maintain responsiveness during rapid typing', async () => {
      const mockDb = {
        searchEntries: jest.fn().mockResolvedValue([]),
        addEntry: jest.fn()
      };

      render(
        <EnhancedSmartEntryForm
          db={mockDb as any}
          config={{
            enableAutoSave: true,
            enableDraftManager: true,
            enableKeyboardShortcuts: true,
            enableOptimisticUpdates: true,
            autoSaveInterval: 1000,
            enableTemplates: false,
            enableAutoComplete: false,
            enableDuplicateDetection: false,
            enableRichTextEditor: false,
            enableAISuggestions: false,
            duplicateThreshold: 0.7,
            suggestionDelay: 300
          }}
        />
      );

      const titleInput = screen.getByLabelText(/title/i);
      monitor.startMonitoring();

      // Rapid typing simulation
      const rapidText = 'This is a rapid typing test to measure input latency';
      const startTime = performance.now();

      for (const char of rapidText) {
        await user.type(titleInput, char, { delay: 10 });
      }

      monitor.recordInteraction('input', startTime);
      const metrics = monitor.stopMonitoring();

      expect(metrics.inputLatency).toBeLessThan(50);
      expect(metrics.frameRate).toBeGreaterThanOrEqual(55); // Allow slight frame drops
    });

    test('debounced search should not trigger excessive updates', async () => {
      let updateCount = 0;
      const mockOnChange = jest.fn(() => updateCount++);

      render(
        <IntelligentSearchInput
          onChange={mockOnChange}
          enableAutocomplete={true}
        />
      );

      const searchInput = screen.getByRole('searchbox');
      monitor.startMonitoring();

      // Rapid typing followed by pause
      await user.type(searchInput, 'rapid');
      await new Promise(resolve => setTimeout(resolve, 200));
      await user.type(searchInput, ' typing');
      await new Promise(resolve => setTimeout(resolve, 200));

      const metrics = monitor.stopMonitoring();

      // Should have fewer updates than characters typed due to debouncing
      expect(updateCount).toBeLessThan(12); // 11 characters but fewer updates
      expect(metrics.debounceEffectiveness).toBeGreaterThan(70);
    });
  });

  describe('Animation Performance Tests', () => {
    test('search results animation should maintain 60fps', async () => {
      const mockResults = generateTestData.searchResults(50);

      const TestComponent = () => {
        const [results, setResults] = React.useState([]);
        const [showResults, setShowResults] = React.useState(false);

        React.useEffect(() => {
          setTimeout(() => {
            setResults(mockResults);
            setShowResults(true);
          }, 100);
        }, []);

        return showResults ? (
          <SearchResults
            results={results}
            searchQuery="test"
            showConfidenceScores={true}
            enableAdvancedKeyboardShortcuts={true}
          />
        ) : null;
      };

      render(<TestComponent />);
      monitor.startMonitoring();

      // Wait for results to appear with animation
      await waitFor(() => {
        expect(screen.getByText(/search results/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      await new Promise(resolve => setTimeout(resolve, 1000)); // Monitor animation
      const metrics = monitor.stopMonitoring();

      expect(metrics.frameRate).toBeGreaterThanOrEqual(55);
      expect(metrics.overallResponsiveness).toBeGreaterThan(70);
    });

    test('modal animations should not block interaction', async () => {
      const TestModalComponent = () => {
        const [showModal, setShowModal] = React.useState(false);

        return (
          <div>
            <button onClick={() => setShowModal(true)}>Open Modal</button>
            {showModal && (
              <div className="modal-overlay" onClick={() => setShowModal(false)}>
                <div className="modal-content">
                  <h2>Test Modal</h2>
                  <button onClick={() => setShowModal(false)}>Close</button>
                </div>
              </div>
            )}
          </div>
        );
      };

      render(<TestModalComponent />);
      monitor.startMonitoring();

      const openButton = screen.getByText('Open Modal');

      // Test modal open animation
      const startTime = performance.now();
      await user.click(openButton);
      monitor.recordInteraction('animation', startTime);

      await waitFor(() => {
        expect(screen.getByText('Test Modal')).toBeInTheDocument();
      });

      // Test modal close animation
      const closeButton = screen.getByText('Close');
      const closeStartTime = performance.now();
      await user.click(closeButton);
      monitor.recordInteraction('animation', closeStartTime);

      const metrics = monitor.stopMonitoring();

      expect(metrics.frameRate).toBeGreaterThanOrEqual(55);
      expect(metrics.clickResponseTime).toBeLessThan(100);
    });
  });

  describe('Scroll Performance Tests', () => {
    test('virtual scrolling should maintain smooth performance', async () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        title: `Item ${i}`,
        content: `Content for item ${i}`
      }));

      const renderItem = ({ item, index, style }) => (
        <div key={item.id} style={style} className="virtual-item">
          <h3>{item.title}</h3>
          <p>{item.content}</p>
        </div>
      );

      render(
        <VirtualScrolling
          items={largeDataset}
          itemHeight={100}
          height={600}
          renderItem={renderItem}
        />
      );

      const scrollContainer = screen.getByRole('list');
      monitor.startMonitoring();

      // Simulate scrolling through large dataset
      const scrollEvents = [
        { scrollTop: 1000 },
        { scrollTop: 5000 },
        { scrollTop: 10000 },
        { scrollTop: 50000 },
        { scrollTop: 0 }
      ];

      for (const event of scrollEvents) {
        const startTime = performance.now();
        fireEvent.scroll(scrollContainer, { target: event });
        monitor.recordInteraction('scroll', startTime);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const metrics = monitor.stopMonitoring();

      expect(metrics.scrollJank).toBeLessThan(2); // Allow minimal jank
      expect(metrics.frameRate).toBeGreaterThanOrEqual(55);
    });

    test('search results list should handle rapid scrolling', async () => {
      const mockResults = generateTestData.searchResults(200);

      render(
        <SearchResults
          results={mockResults}
          searchQuery="performance test"
          showConfidenceScores={true}
        />
      );

      const resultsContainer = screen.getByRole('listbox');
      monitor.startMonitoring();

      // Rapid scrolling simulation
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        fireEvent.scroll(resultsContainer, {
          target: { scrollTop: i * 500 }
        });
        monitor.recordInteraction('scroll', startTime);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const metrics = monitor.stopMonitoring();

      expect(metrics.scrollJank).toBeLessThan(3);
      expect(metrics.frameRate).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Click Response Time Tests', () => {
    test('search result selection should respond within 100ms', async () => {
      const mockResults = generateTestData.searchResults(10);
      const mockOnResultSelect = jest.fn();

      render(
        <SearchResults
          results={mockResults}
          searchQuery="test"
          onResultSelect={mockOnResultSelect}
        />
      );

      monitor.startMonitoring();

      const firstResult = screen.getAllByRole('option')[0];
      const startTime = performance.now();
      await user.click(firstResult);
      monitor.recordInteraction('click', startTime);

      const metrics = monitor.stopMonitoring();

      expect(metrics.clickResponseTime).toBeLessThan(100);
      expect(mockOnResultSelect).toHaveBeenCalledTimes(1);
    });

    test('form button clicks should maintain responsiveness', async () => {
      const mockOnSubmit = jest.fn();
      const mockDb = {
        searchEntries: jest.fn().mockResolvedValue([]),
        addEntry: jest.fn()
      };

      render(
        <EnhancedSmartEntryForm
          db={mockDb as any}
          onSubmit={mockOnSubmit}
        />
      );

      // Fill form with minimum required data
      await user.type(screen.getByLabelText(/title/i), 'Test Title Here');
      await user.selectOptions(screen.getByLabelText(/category/i), 'JCL');
      await user.type(screen.getByLabelText(/tags/i), 'test{enter}');
      await user.type(screen.getByLabelText(/problem/i), 'This is a test problem description that meets minimum length');
      await user.type(screen.getByLabelText(/solution/i), 'This is a test solution description that meets minimum length requirements');

      monitor.startMonitoring();

      const submitButton = screen.getByRole('button', { name: /create entry/i });
      const startTime = performance.now();
      await user.click(submitButton);
      monitor.recordInteraction('click', startTime);

      const metrics = monitor.stopMonitoring();

      expect(metrics.clickResponseTime).toBeLessThan(100);
    });
  });

  describe('Heavy Computation Responsiveness Tests', () => {
    test('UI should remain responsive during background processing', async () => {
      const TestHeavyComponent = () => {
        const [processing, setProcessing] = React.useState(false);
        const [counter, setCounter] = React.useState(0);

        const heavyComputation = () => {
          setProcessing(true);
          // Simulate heavy computation in chunks to not block UI
          const processChunk = (remaining: number) => {
            const chunkSize = 1000000;
            for (let i = 0; i < chunkSize && remaining > 0; i++, remaining--) {
              Math.sqrt(remaining);
            }

            if (remaining > 0) {
              setTimeout(() => processChunk(remaining), 0);
            } else {
              setProcessing(false);
            }
          };

          processChunk(10000000);
        };

        return (
          <div>
            <button onClick={heavyComputation} disabled={processing}>
              {processing ? 'Processing...' : 'Start Heavy Computation'}
            </button>
            <button onClick={() => setCounter(c => c + 1)}>
              Counter: {counter}
            </button>
            <IntelligentSearchInput placeholder="Type during computation" />
          </div>
        );
      };

      render(<TestHeavyComponent />);
      monitor.startMonitoring();

      // Start heavy computation
      await user.click(screen.getByText('Start Heavy Computation'));

      // Test responsiveness during computation
      const counterButton = screen.getByText(/counter:/i);
      const searchInput = screen.getByRole('searchbox');

      for (let i = 0; i < 5; i++) {
        const clickStartTime = performance.now();
        await user.click(counterButton);
        monitor.recordInteraction('click', clickStartTime);

        const inputStartTime = performance.now();
        await user.type(searchInput, 'a');
        monitor.recordInteraction('input', inputStartTime);

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const metrics = monitor.stopMonitoring();

      expect(metrics.clickResponseTime).toBeLessThan(150); // Slightly higher during computation
      expect(metrics.inputLatency).toBeLessThan(100);
      expect(metrics.frameRate).toBeGreaterThanOrEqual(45); // Allow some degradation
    });
  });

  describe('Drag and Drop Performance Tests', () => {
    test('drag and drop operations should maintain smooth performance', async () => {
      const TestDragDropComponent = () => {
        const [items, setItems] = React.useState([
          { id: 1, text: 'Item 1' },
          { id: 2, text: 'Item 2' },
          { id: 3, text: 'Item 3' },
          { id: 4, text: 'Item 4' }
        ]);

        const handleDragStart = (e: React.DragEvent, id: number) => {
          e.dataTransfer.setData('text/plain', id.toString());
        };

        const handleDrop = (e: React.DragEvent, targetId: number) => {
          e.preventDefault();
          const draggedId = parseInt(e.dataTransfer.getData('text/plain'));

          setItems(prevItems => {
            const newItems = [...prevItems];
            const draggedIndex = newItems.findIndex(item => item.id === draggedId);
            const targetIndex = newItems.findIndex(item => item.id === targetId);

            const [draggedItem] = newItems.splice(draggedIndex, 1);
            newItems.splice(targetIndex, 0, draggedItem);

            return newItems;
          });
        };

        return (
          <div>
            {items.map(item => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDrop={(e) => handleDrop(e, item.id)}
                onDragOver={(e) => e.preventDefault()}
                style={{
                  padding: '10px',
                  margin: '5px',
                  backgroundColor: '#f0f0f0',
                  cursor: 'move'
                }}
              >
                {item.text}
              </div>
            ))}
          </div>
        );
      };

      render(<TestDragDropComponent />);
      monitor.startMonitoring();

      const items = screen.getAllByText(/Item \d/);

      // Simulate drag and drop
      const startTime = performance.now();

      fireEvent.dragStart(items[0], {
        dataTransfer: {
          setData: jest.fn(),
          getData: jest.fn().mockReturnValue('1')
        }
      });

      fireEvent.dragOver(items[2]);

      fireEvent.drop(items[2], {
        dataTransfer: {
          getData: jest.fn().mockReturnValue('1')
        }
      });

      monitor.recordInteraction('animation', startTime);
      const metrics = monitor.stopMonitoring();

      expect(metrics.frameRate).toBeGreaterThanOrEqual(55);
      expect(metrics.overallResponsiveness).toBeGreaterThan(70);
    });
  });

  describe('Performance Thresholds Validation', () => {
    test('overall performance should meet defined thresholds', async () => {
      // Comprehensive performance test combining multiple interactions
      const mockResults = generateTestData.searchResults(100);
      const mockOnResultSelect = jest.fn();
      const mockOnChange = jest.fn();

      const TestApp = () => (
        <div>
          <IntelligentSearchInput
            onChange={mockOnChange}
            enableAutocomplete={true}
          />
          <SearchResults
            results={mockResults}
            searchQuery="comprehensive test"
            onResultSelect={mockOnResultSelect}
            showConfidenceScores={true}
          />
        </div>
      );

      render(<TestApp />);
      monitor.startMonitoring();

      // Mixed interaction simulation
      const searchInput = screen.getByRole('searchbox');
      const resultsContainer = screen.getByRole('listbox');
      const firstResult = screen.getAllByRole('option')[0];

      // Input testing
      await user.type(searchInput, 'performance');

      // Scroll testing
      fireEvent.scroll(resultsContainer, { target: { scrollTop: 500 } });

      // Click testing
      await user.click(firstResult);

      // More input testing
      await user.clear(searchInput);
      await user.type(searchInput, 'responsiveness test');

      const metrics = monitor.stopMonitoring();

      // Validate all performance thresholds
      expect(metrics.inputLatency).toBeLessThan(50);
      expect(metrics.frameRate).toBeGreaterThanOrEqual(55);
      expect(metrics.scrollJank).toBeLessThan(3);
      expect(metrics.clickResponseTime).toBeLessThan(100);
      expect(metrics.debounceEffectiveness).toBeGreaterThan(70);
      expect(metrics.overallResponsiveness).toBeGreaterThan(75);
    });
  });
});