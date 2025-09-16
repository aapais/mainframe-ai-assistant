/**
 * Jest Setup for Interaction Performance Tests
 *
 * Setup file that configures the testing environment for interaction
 * performance tests with necessary mocks and utilities.
 */

import '@testing-library/jest-dom';
import 'jest-extended';
import { performance } from 'perf_hooks';

// Global test configuration
declare global {
  var PERFORMANCE_TEST_CONFIG: {
    INPUT_LATENCY_THRESHOLD: number;
    FRAME_RATE_THRESHOLD: number;
    CLICK_RESPONSE_THRESHOLD: number;
    SCROLL_JANK_THRESHOLD: number;
    DEBOUNCE_EFFECTIVENESS_THRESHOLD: number;
  };

  var React: typeof import('react');
  var requestAnimationFrame: (callback: FrameRequestCallback) => number;
  var cancelAnimationFrame: (id: number) => void;
  var IntersectionObserver: any;
  var ResizeObserver: any;
  var performance: Performance;
}

// Make React globally available for test components
global.React = require('react');

// Performance testing configuration
global.PERFORMANCE_TEST_CONFIG = {
  INPUT_LATENCY_THRESHOLD: 50,
  FRAME_RATE_THRESHOLD: 55,
  CLICK_RESPONSE_THRESHOLD: 100,
  SCROLL_JANK_THRESHOLD: 3,
  DEBOUNCE_EFFECTIVENESS_THRESHOLD: 75
};

// Mock requestAnimationFrame and cancelAnimationFrame
let rafId = 0;
const rafCallbacks = new Map<number, FrameRequestCallback>();

global.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
  const id = ++rafId;
  rafCallbacks.set(id, callback);

  // Execute callback with slight delay to simulate real behavior
  setTimeout(() => {
    if (rafCallbacks.has(id)) {
      rafCallbacks.delete(id);
      callback(performance.now());
    }
  }, 16.67); // ~60fps

  return id;
});

global.cancelAnimationFrame = jest.fn((id: number) => {
  rafCallbacks.delete(id);
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  private callback: IntersectionObserverCallback;
  private elements: Element[] = [];

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(element: Element) {
    this.elements.push(element);
    // Simulate immediate intersection for testing
    setTimeout(() => {
      this.callback([
        {
          target: element,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: element.getBoundingClientRect(),
          intersectionRect: element.getBoundingClientRect(),
          rootBounds: null,
          time: performance.now()
        }
      ] as IntersectionObserverEntry[], this);
    }, 10);
  }

  unobserve(element: Element) {
    const index = this.elements.indexOf(element);
    if (index > -1) {
      this.elements.splice(index, 1);
    }
  }

  disconnect() {
    this.elements = [];
  }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  private callback: ResizeObserverCallback;
  private elements: Element[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(element: Element) {
    this.elements.push(element);
    // Simulate resize event for testing
    setTimeout(() => {
      this.callback([
        {
          target: element,
          contentRect: {
            x: 0,
            y: 0,
            width: 800,
            height: 600,
            top: 0,
            left: 0,
            bottom: 600,
            right: 800
          },
          borderBoxSize: [{ inlineSize: 800, blockSize: 600 }],
          contentBoxSize: [{ inlineSize: 800, blockSize: 600 }],
          devicePixelContentBoxSize: [{ inlineSize: 800, blockSize: 600 }]
        }
      ] as ResizeObserverEntry[], this);
    }, 10);
  }

  unobserve(element: Element) {
    const index = this.elements.indexOf(element);
    if (index > -1) {
      this.elements.splice(index, 1);
    }
  }

  disconnect() {
    this.elements = [];
  }
};

// Mock Performance Observer for measuring performance
if (typeof PerformanceObserver === 'undefined') {
  global.PerformanceObserver = class PerformanceObserver {
    private callback: PerformanceObserverCallback;

    constructor(callback: PerformanceObserverCallback) {
      this.callback = callback;
    }

    observe(options: PerformanceObserverInit) {
      // Mock implementation - in real tests, this would capture performance entries
    }

    disconnect() {
      // Mock implementation
    }

    takeRecords(): PerformanceEntry[] {
      return [];
    }
  };
}

// Mock Web Speech API for voice navigation tests
if (typeof window !== 'undefined') {
  (window as any).SpeechRecognition = class SpeechRecognition {
    continuous = false;
    interimResults = false;
    lang = 'en-US';
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null = null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null = null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null = null;

    start() {
      setTimeout(() => {
        this.onstart?.(new Event('start'));
      }, 10);
    }

    stop() {
      setTimeout(() => {
        this.onend?.(new Event('end'));
      }, 10);
    }
  };

  (window as any).webkitSpeechRecognition = (window as any).SpeechRecognition;
}

// Custom matchers for performance testing
expect.extend({
  toHaveInputLatencyLessThan(received: number, expected: number) {
    const pass = received < expected;
    return {
      message: () =>
        `expected input latency ${received}ms to be ${pass ? 'not ' : ''}less than ${expected}ms`,
      pass
    };
  },

  toHaveFrameRateGreaterThan(received: number, expected: number) {
    const pass = received > expected;
    return {
      message: () =>
        `expected frame rate ${received}fps to be ${pass ? 'not ' : ''}greater than ${expected}fps`,
      pass
    };
  },

  toHaveScrollJankLessThan(received: number, expected: number) {
    const pass = received < expected;
    return {
      message: () =>
        `expected scroll jank ${received} frames to be ${pass ? 'not ' : ''}less than ${expected} frames`,
      pass
    };
  },

  toHaveClickResponseTimeLessThan(received: number, expected: number) {
    const pass = received < expected;
    return {
      message: () =>
        `expected click response time ${received}ms to be ${pass ? 'not ' : ''}less than ${expected}ms`,
      pass
    };
  },

  toHaveDebounceEffectivenessGreaterThan(received: number, expected: number) {
    const pass = received > expected;
    return {
      message: () =>
        `expected debounce effectiveness ${received}% to be ${pass ? 'not ' : ''}greater than ${expected}%`,
      pass
    };
  }
});

// Extend Jest matchers interface
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveInputLatencyLessThan(expected: number): R;
      toHaveFrameRateGreaterThan(expected: number): R;
      toHaveScrollJankLessThan(expected: number): R;
      toHaveClickResponseTimeLessThan(expected: number): R;
      toHaveDebounceEffectivenessGreaterThan(expected: number): R;
    }
  }
}

// Console setup for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress React warnings in performance tests unless they're critical
  console.error = (...args: any[]) => {
    if (args[0]?.includes?.('Warning: ReactDOM.render is no longer supported')) {
      return;
    }
    originalConsoleError(...args);
  };

  console.warn = (...args: any[]) => {
    if (args[0]?.includes?.('Warning: componentWillMount has been renamed')) {
      return;
    }
    originalConsoleWarn(...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
global.flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

global.waitForNextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));

global.createMockPerformanceEntry = (name: string, duration: number = 16.67): PerformanceEntry => ({
  name,
  entryType: 'measure',
  startTime: performance.now(),
  duration,
  toJSON: () => ({})
});

// Performance monitoring utilities
global.createPerformanceMonitor = () => {
  const measurements: Array<{ name: string; value: number; timestamp: number }> = [];

  return {
    record: (name: string, value: number) => {
      measurements.push({ name, value, timestamp: performance.now() });
    },

    getAverage: (name: string) => {
      const values = measurements.filter(m => m.name === name).map(m => m.value);
      return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
    },

    getMax: (name: string) => {
      const values = measurements.filter(m => m.name === name).map(m => m.value);
      return values.length > 0 ? Math.max(...values) : 0;
    },

    getMin: (name: string) => {
      const values = measurements.filter(m => m.name === name).map(m => m.value);
      return values.length > 0 ? Math.min(...values) : 0;
    },

    getCount: (name: string) => {
      return measurements.filter(m => m.name === name).length;
    },

    reset: () => {
      measurements.length = 0;
    },

    getAllMeasurements: () => [...measurements]
  };
};

// Export for TypeScript declarations
export {};

// Log setup completion
console.log('🧪 Interaction Performance Test Setup Complete');
console.log(`   • Performance thresholds configured`);
console.log(`   • Browser APIs mocked`);
console.log(`   • Custom matchers registered`);
console.log(`   • Test utilities available`);