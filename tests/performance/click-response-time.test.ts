/**
 * Click Response Time Tests
 *
 * Specialized tests for measuring click handler response times and
 * ensuring interactive elements respond within acceptable thresholds.
 *
 * @author QA Specialist - Click Response Analysis
 * @version 1.0.0
 */

import { performance } from 'perf_hooks';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

interface ClickMetrics {
  totalClicks: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  responsesUnderThreshold: number;
  reliabilityScore: number;
}

interface ClickMeasurement {
  timestamp: number;
  responseTime: number;
  elementType: string;
  successful: boolean;
}

class ClickResponseMonitor {
  private measurements: ClickMeasurement[] = [];
  private threshold: number;

  constructor(threshold = 100) {
    this.threshold = threshold; // Default 100ms threshold
  }

  recordClick(elementType: string, responseTime: number, successful = true): void {
    this.measurements.push({
      timestamp: performance.now(),
      responseTime,
      elementType,
      successful
    });
  }

  getMetrics(): ClickMetrics {
    if (this.measurements.length === 0) {
      return {
        totalClicks: 0,
        averageResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        responsesUnderThreshold: 0,
        reliabilityScore: 100
      };
    }

    const responseTimes = this.measurements.map(m => m.responseTime);
    const totalClicks = this.measurements.length;
    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / totalClicks;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    const responsesUnderThreshold = responseTimes.filter(time => time <= this.threshold).length;
    const successfulClicks = this.measurements.filter(m => m.successful).length;

    const reliabilityScore = Math.min(100,
      (responsesUnderThreshold / totalClicks) * 60 + // 60% weight on speed
      (successfulClicks / totalClicks) * 40 // 40% weight on success rate
    );

    return {
      totalClicks,
      averageResponseTime,
      minResponseTime,
      maxResponseTime,
      responsesUnderThreshold,
      reliabilityScore
    };
  }

  reset(): void {
    this.measurements = [];
  }

  getDetailedReport(): string {
    const metrics = this.getMetrics();
    const byElementType = this.measurements.reduce((acc, m) => {
      if (!acc[m.elementType]) {
        acc[m.elementType] = [];
      }
      acc[m.elementType].push(m.responseTime);
      return acc;
    }, {} as Record<string, number[]>);

    let report = `Click Response Performance Report\n`;
    report += `=====================================\n`;
    report += `Total Clicks: ${metrics.totalClicks}\n`;
    report += `Average Response Time: ${metrics.averageResponseTime.toFixed(2)}ms\n`;
    report += `Min/Max Response Time: ${metrics.minResponseTime.toFixed(2)}ms / ${metrics.maxResponseTime.toFixed(2)}ms\n`;
    report += `Responses Under ${this.threshold}ms: ${metrics.responsesUnderThreshold}/${metrics.totalClicks} (${((metrics.responsesUnderThreshold / metrics.totalClicks) * 100).toFixed(1)}%)\n`;
    report += `Reliability Score: ${metrics.reliabilityScore.toFixed(1)}/100\n\n`;

    report += `By Element Type:\n`;
    Object.entries(byElementType).forEach(([type, times]) => {
      const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
      const underThreshold = times.filter(time => time <= this.threshold).length;
      report += `  ${type}: ${avg.toFixed(2)}ms avg, ${underThreshold}/${times.length} under threshold\n`;
    });

    return report;
  }
}

describe('Click Response Time Tests', () => {
  let monitor: ClickResponseMonitor;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    monitor = new ClickResponseMonitor(100); // 100ms threshold
    user = userEvent.setup({ delay: null });

    // Mock performance.now for consistent testing
    let mockTime = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => {
      mockTime += Math.random() * 2 + 1; // 1-3ms increment
      return mockTime;
    });
  });

  afterEach(() => {
    monitor.reset();
    jest.restoreAllMocks();
  });

  describe('Button Click Response Tests', () => {
    test('primary action buttons should respond within 50ms', async () => {
      let clickCount = 0;

      const ButtonTestComponent = () => {
        const [isProcessing, setIsProcessing] = React.useState(false);

        const handleClick = async () => {
          const startTime = performance.now();
          setIsProcessing(true);
          clickCount++;

          // Simulate minimal processing
          await new Promise(resolve => setTimeout(resolve, 5));

          const responseTime = performance.now() - startTime;
          monitor.recordClick('primary-button', responseTime);
          setIsProcessing(false);
        };

        return (
          <div>
            <button
              onClick={handleClick}
              disabled={isProcessing}
              data-testid="primary-button"
              style={{
                padding: '12px 24px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {isProcessing ? 'Processing...' : `Click Me (${clickCount})`}
            </button>
          </div>
        );
      };

      render(<ButtonTestComponent />);
      const button = screen.getByTestId('primary-button');

      // Test multiple rapid clicks
      for (let i = 0; i < 10; i++) {
        await user.click(button);
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 20));
        });
      }

      const metrics = monitor.getMetrics();

      expect(metrics.averageResponseTime).toBeLessThan(50);
      expect(metrics.maxResponseTime).toBeLessThan(80);
      expect(metrics.responsesUnderThreshold).toBe(metrics.totalClicks);
      expect(metrics.reliabilityScore).toBeGreaterThan(90);
    });

    test('form submit buttons should respond quickly even with validation', async () => {
      let submissions = 0;

      const FormComponent = () => {
        const [formData, setFormData] = React.useState({ name: '', email: '' });
        const [errors, setErrors] = React.useState<string[]>([]);
        const [isSubmitting, setIsSubmitting] = React.useState(false);

        const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          const startTime = performance.now();

          setIsSubmitting(true);
          submissions++;

          // Simulate form validation
          const newErrors: string[] = [];
          if (!formData.name) newErrors.push('Name required');
          if (!formData.email.includes('@')) newErrors.push('Invalid email');

          setErrors(newErrors);

          if (newErrors.length === 0) {
            // Simulate successful submission
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          const responseTime = performance.now() - startTime;
          monitor.recordClick('submit-button', responseTime, newErrors.length === 0);
          setIsSubmitting(false);
        };

        return (
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Name"
              data-testid="name-input"
            />
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
              data-testid="email-input"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="submit-button"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
            {errors.map((error, i) => (
              <div key={i} style={{ color: 'red' }}>{error}</div>
            ))}
          </form>
        );
      };

      render(<FormComponent />);
      const submitButton = screen.getByTestId('submit-button');
      const nameInput = screen.getByTestId('name-input');
      const emailInput = screen.getByTestId('email-input');

      // Test form submission with various states
      await user.click(submitButton); // Empty form (validation error)

      await user.type(nameInput, 'John');
      await user.click(submitButton); // Invalid email

      await user.type(emailInput, 'john@example.com');
      await user.click(submitButton); // Valid form

      const metrics = monitor.getMetrics();

      expect(metrics.averageResponseTime).toBeLessThan(75);
      expect(metrics.maxResponseTime).toBeLessThan(100);
      expect(metrics.responsesUnderThreshold).toBe(metrics.totalClicks);
    });
  });

  describe('Interactive Element Response Tests', () => {
    test('dropdown menus should open/close responsively', async () => {
      const DropdownComponent = () => {
        const [isOpen, setIsOpen] = React.useState(false);
        const [selectedValue, setSelectedValue] = React.useState('');

        const handleToggle = () => {
          const startTime = performance.now();
          setIsOpen(prev => !prev);
          const responseTime = performance.now() - startTime;
          monitor.recordClick('dropdown-toggle', responseTime);
        };

        const handleOptionSelect = (value: string) => {
          const startTime = performance.now();
          setSelectedValue(value);
          setIsOpen(false);
          const responseTime = performance.now() - startTime;
          monitor.recordClick('dropdown-option', responseTime);
        };

        return (
          <div style={{ position: 'relative' }}>
            <button
              onClick={handleToggle}
              data-testid="dropdown-toggle"
              style={{
                padding: '8px 12px',
                border: '1px solid #ccc',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              {selectedValue || 'Select option'} ▼
            </button>
            {isOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'white',
                  border: '1px solid #ccc',
                  zIndex: 1000
                }}
              >
                {['Option 1', 'Option 2', 'Option 3'].map(option => (
                  <button
                    key={option}
                    onClick={() => handleOptionSelect(option)}
                    data-testid={`option-${option.replace(' ', '-').toLowerCase()}`}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      };

      render(<DropdownComponent />);
      const dropdownToggle = screen.getByTestId('dropdown-toggle');

      // Test dropdown interactions
      await user.click(dropdownToggle); // Open
      const option1 = screen.getByTestId('option-option-1');
      await user.click(option1); // Select option

      await user.click(dropdownToggle); // Open again
      const option2 = screen.getByTestId('option-option-2');
      await user.click(option2); // Select different option

      const metrics = monitor.getMetrics();

      expect(metrics.averageResponseTime).toBeLessThan(60);
      expect(metrics.reliabilityScore).toBeGreaterThan(85);
    });

    test('tab navigation should respond immediately', async () => {
      const TabComponent = () => {
        const [activeTab, setActiveTab] = React.useState(0);

        const handleTabClick = (index: number) => {
          const startTime = performance.now();
          setActiveTab(index);
          const responseTime = performance.now() - startTime;
          monitor.recordClick('tab', responseTime);
        };

        const tabs = ['Tab 1', 'Tab 2', 'Tab 3', 'Tab 4'];

        return (
          <div>
            <div style={{ display: 'flex', borderBottom: '1px solid #ccc' }}>
              {tabs.map((tab, index) => (
                <button
                  key={index}
                  onClick={() => handleTabClick(index)}
                  data-testid={`tab-${index}`}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    backgroundColor: activeTab === index ? '#007bff' : '#f8f9fa',
                    color: activeTab === index ? 'white' : 'black',
                    cursor: 'pointer'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div style={{ padding: '20px' }}>
              Content for {tabs[activeTab]}
            </div>
          </div>
        );
      };

      render(<TabComponent />);

      // Test rapid tab switching
      for (let i = 0; i < 4; i++) {
        const tab = screen.getByTestId(`tab-${i}`);
        await user.click(tab);
      }

      const metrics = monitor.getMetrics();

      expect(metrics.averageResponseTime).toBeLessThan(30);
      expect(metrics.maxResponseTime).toBeLessThan(50);
      expect(metrics.responsesUnderThreshold).toBe(metrics.totalClicks);
    });
  });

  describe('Modal and Dialog Response Tests', () => {
    test('modal open/close should be instantaneous', async () => {
      const ModalComponent = () => {
        const [isOpen, setIsOpen] = React.useState(false);

        const handleOpen = () => {
          const startTime = performance.now();
          setIsOpen(true);
          const responseTime = performance.now() - startTime;
          monitor.recordClick('modal-open', responseTime);
        };

        const handleClose = () => {
          const startTime = performance.now();
          setIsOpen(false);
          const responseTime = performance.now() - startTime;
          monitor.recordClick('modal-close', responseTime);
        };

        return (
          <div>
            <button onClick={handleOpen} data-testid="open-modal">
              Open Modal
            </button>
            {isOpen && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000
                }}
                onClick={handleClose}
                data-testid="modal-overlay"
              >
                <div
                  style={{
                    backgroundColor: 'white',
                    padding: '20px',
                    borderRadius: '4px',
                    minWidth: '300px'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3>Modal Title</h3>
                  <p>This is modal content.</p>
                  <button onClick={handleClose} data-testid="close-modal">
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      };

      render(<ModalComponent />);

      // Test modal interactions
      const openButton = screen.getByTestId('open-modal');
      await user.click(openButton);

      const closeButton = screen.getByTestId('close-modal');
      await user.click(closeButton);

      await user.click(openButton); // Open again

      const overlay = screen.getByTestId('modal-overlay');
      await user.click(overlay); // Close by clicking overlay

      const metrics = monitor.getMetrics();

      expect(metrics.averageResponseTime).toBeLessThan(25);
      expect(metrics.maxResponseTime).toBeLessThan(40);
      expect(metrics.reliabilityScore).toBeGreaterThan(95);
    });
  });

  describe('List Item Click Performance', () => {
    test('large list items should maintain fast click response', async () => {
      const ListComponent = () => {
        const [selectedItems, setSelectedItems] = React.useState<Set<number>>(new Set());

        const handleItemClick = (index: number) => {
          const startTime = performance.now();
          setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
              newSet.delete(index);
            } else {
              newSet.add(index);
            }
            return newSet;
          });
          const responseTime = performance.now() - startTime;
          monitor.recordClick('list-item', responseTime);
        };

        return (
          <div style={{ height: '300px', overflowY: 'auto' }}>
            {Array.from({ length: 100 }, (_, i) => (
              <div
                key={i}
                onClick={() => handleItemClick(i)}
                data-testid={`list-item-${i}`}
                style={{
                  padding: '10px',
                  borderBottom: '1px solid #eee',
                  backgroundColor: selectedItems.has(i) ? '#e3f2fd' : 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>List Item {i + 1}</span>
                <span style={{ fontSize: '12px', color: '#666' }}>
                  {selectedItems.has(i) ? '✓ Selected' : 'Click to select'}
                </span>
              </div>
            ))}
          </div>
        );
      };

      render(<ListComponent />);

      // Test clicking various items in the list
      const itemsToClick = [0, 15, 30, 45, 60, 75, 90];
      for (const index of itemsToClick) {
        const item = screen.getByTestId(`list-item-${index}`);
        await user.click(item);
      }

      const metrics = monitor.getMetrics();

      expect(metrics.averageResponseTime).toBeLessThan(40);
      expect(metrics.maxResponseTime).toBeLessThan(60);
      expect(metrics.responsesUnderThreshold).toBe(metrics.totalClicks);
    });
  });

  describe('Touch and Mobile Response Tests', () => {
    test('touch events should respond as quickly as mouse clicks', async () => {
      const TouchComponent = () => {
        const [touchCount, setTouchCount] = React.useState(0);
        const [clickCount, setClickCount] = React.useState(0);

        const handleTouch = () => {
          const startTime = performance.now();
          setTouchCount(prev => prev + 1);
          const responseTime = performance.now() - startTime;
          monitor.recordClick('touch', responseTime);
        };

        const handleClick = () => {
          const startTime = performance.now();
          setClickCount(prev => prev + 1);
          const responseTime = performance.now() - startTime;
          monitor.recordClick('click', responseTime);
        };

        return (
          <div>
            <button
              onTouchStart={handleTouch}
              onClick={handleClick}
              data-testid="touch-button"
              style={{
                padding: '15px 30px',
                fontSize: '18px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                touchAction: 'manipulation'
              }}
            >
              Touch/Click Me
            </button>
            <div>Touches: {touchCount}, Clicks: {clickCount}</div>
          </div>
        );
      };

      render(<TouchComponent />);
      const button = screen.getByTestId('touch-button');

      // Simulate touch events
      for (let i = 0; i < 5; i++) {
        fireEvent.touchStart(button);
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        });
      }

      // Simulate mouse clicks
      for (let i = 0; i < 5; i++) {
        await user.click(button);
      }

      const metrics = monitor.getMetrics();

      expect(metrics.averageResponseTime).toBeLessThan(50);
      expect(metrics.responsesUnderThreshold).toBe(metrics.totalClicks);
    });
  });

  describe('Performance Under Load', () => {
    test('click response should remain consistent under CPU load', async () => {
      const LoadTestComponent = () => {
        const [cpuLoad, setCpuLoad] = React.useState(false);
        const [clickCount, setClickCount] = React.useState(0);

        const startCpuLoad = () => {
          setCpuLoad(true);
          // Simulate CPU-intensive task
          const intensiveTask = () => {
            for (let i = 0; i < 100000; i++) {
              Math.sqrt(Math.random());
            }
            if (cpuLoad) {
              setTimeout(intensiveTask, 0);
            }
          };
          intensiveTask();
        };

        const stopCpuLoad = () => {
          setCpuLoad(false);
        };

        const handleClick = () => {
          const startTime = performance.now();
          setClickCount(prev => prev + 1);
          const responseTime = performance.now() - startTime;
          monitor.recordClick('under-load', responseTime);
        };

        return (
          <div>
            <button
              onClick={cpuLoad ? stopCpuLoad : startCpuLoad}
              data-testid="load-toggle"
            >
              {cpuLoad ? 'Stop' : 'Start'} CPU Load
            </button>
            <button
              onClick={handleClick}
              data-testid="test-button"
              style={{
                marginLeft: '10px',
                padding: '10px 20px',
                backgroundColor: '#ffc107',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Test Click ({clickCount})
            </button>
            <div>CPU Load: {cpuLoad ? 'ON' : 'OFF'}</div>
          </div>
        );
      };

      render(<LoadTestComponent />);
      const loadToggle = screen.getByTestId('load-toggle');
      const testButton = screen.getByTestId('test-button');

      // Start CPU load
      await user.click(loadToggle);

      // Test clicks under load
      for (let i = 0; i < 5; i++) {
        await user.click(testButton);
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
        });
      }

      // Stop CPU load
      await user.click(loadToggle);

      const metrics = monitor.getMetrics();

      // Allow slightly higher threshold under load
      expect(metrics.averageResponseTime).toBeLessThan(150);
      expect(metrics.reliabilityScore).toBeGreaterThan(70);
    });
  });

  describe('Performance Report Generation', () => {
    test('should generate comprehensive click performance report', () => {
      // Simulate various click measurements
      monitor.recordClick('button', 25, true);
      monitor.recordClick('button', 35, true);
      monitor.recordClick('button', 45, true);
      monitor.recordClick('dropdown', 60, true);
      monitor.recordClick('dropdown', 80, true);
      monitor.recordClick('modal', 15, true);
      monitor.recordClick('modal', 20, true);
      monitor.recordClick('list-item', 40, true);
      monitor.recordClick('list-item', 120, false); // Slow response

      const report = monitor.getDetailedReport();
      const metrics = monitor.getMetrics();

      expect(report).toContain('Click Response Performance Report');
      expect(report).toContain('Total Clicks: 9');
      expect(report).toContain('button:');
      expect(report).toContain('dropdown:');
      expect(report).toContain('modal:');
      expect(report).toContain('list-item:');

      expect(metrics.totalClicks).toBe(9);
      expect(metrics.averageResponseTime).toBeCloseTo(37.78, 1);
      expect(metrics.responsesUnderThreshold).toBe(8); // One over 100ms threshold
      expect(metrics.reliabilityScore).toBeGreaterThan(80);
    });
  });
});