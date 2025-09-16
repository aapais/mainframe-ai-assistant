/**
 * Performance Test Setup
 * Global setup and configuration for performance testing environment
 */

import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { performance } from 'perf_hooks';

// Configure React Testing Library for performance tests
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 10000, // Longer timeout for performance tests
  computedStyleSupportsPseudoElements: true,
});

// Global performance monitoring setup
let performanceObserver: PerformanceObserver | null = null;

// Setup performance monitoring
if (typeof PerformanceObserver !== 'undefined') {
  performanceObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();

    entries.forEach((entry) => {
      if (entry.entryType === 'measure') {
        console.log(`Performance: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
      }
    });
  });

  try {
    performanceObserver.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
  } catch (error) {
    console.warn('Performance observer setup failed:', error);
  }
}

// Global performance utilities
global.markPerformance = (name: string) => {
  if (typeof performance !== 'undefined' && performance.mark) {
    performance.mark(name);
  }
};

global.measurePerformance = (name: string, startMark?: string, endMark?: string) => {
  if (typeof performance !== 'undefined' && performance.measure) {
    try {
      if (startMark && endMark) {
        performance.measure(name, startMark, endMark);
      } else if (startMark) {
        performance.measure(name, startMark);
      } else {
        performance.measure(name);
      }
    } catch (error) {
      console.warn(`Performance measurement failed for ${name}:`, error);
    }
  }
};

global.getPerformanceEntries = () => {
  if (typeof performance !== 'undefined' && performance.getEntries) {
    return performance.getEntries();
  }
  return [];
};

global.clearPerformanceEntries = () => {
  if (typeof performance !== 'undefined' && performance.clearMarks && performance.clearMeasures) {
    performance.clearMarks();
    performance.clearMeasures();
  }
};

// Memory monitoring utilities
global.getMemoryUsage = () => {
  if ((performance as any).memory) {
    return (performance as any).memory.usedJSHeapSize;
  }
  return process.memoryUsage().heapUsed;
};

global.getTotalMemory = () => {
  if ((performance as any).memory) {
    return (performance as any).memory.totalJSHeapSize;
  }
  return process.memoryUsage().heapTotal;
};

global.getMemoryLimit = () => {
  if ((performance as any).memory) {
    return (performance as any).memory.jsHeapSizeLimit;
  }
  return process.memoryUsage().external + process.memoryUsage().heapTotal;
};

// Garbage collection utilities
global.forceGC = () => {
  if (global.gc) {
    global.gc();
  } else {
    console.warn('Garbage collection not available. Run with --expose-gc flag.');
  }
};

// Mock Electron APIs for performance testing
global.mockElectronAPI = {
  searchKBEntries: jest.fn().mockResolvedValue([]),
  getSearchHistory: jest.fn().mockResolvedValue([
    'VSAM Status 35',
    'S0C7 abend',
    'JCL dataset not found',
    'DB2 SQLCODE -904'
  ]),
  saveSearchQuery: jest.fn().mockResolvedValue(undefined),
  validateKBEntry: jest.fn().mockResolvedValue({ valid: true }),
  addKBEntry: jest.fn().mockResolvedValue('mock-id'),
  getEntry: jest.fn().mockResolvedValue(null),
  recordUsage: jest.fn().mockResolvedValue(undefined),
  getMetrics: jest.fn().mockResolvedValue({
    totalEntries: 0,
    searchesToday: 0,
    topCategories: [],
    mostUsed: []
  }),
  initializeDatabase: jest.fn().mockResolvedValue(true),
};

// Set up window.electronAPI for components that use it
Object.defineProperty(window, 'electronAPI', {
  value: global.mockElectronAPI,
  writable: true,
  configurable: true,
});

// Console performance tracking
const originalConsoleTime = console.time;
const originalConsoleTimeEnd = console.timeEnd;

console.time = (label?: string) => {
  if (label) {
    global.markPerformance(`${label}-start`);
  }
  return originalConsoleTime.call(console, label);
};

console.timeEnd = (label?: string) => {
  if (label) {
    global.markPerformance(`${label}-end`);
    global.measurePerformance(label, `${label}-start`, `${label}-end`);
  }
  return originalConsoleTimeEnd.call(console, label);
};

// Performance test matchers
expect.extend({
  toHavePerformanceBetterThan(received: number, expected: number) {
    const pass = received < expected;
    const message = () =>
      pass
        ? `expected ${received}ms not to be less than ${expected}ms`
        : `expected ${received}ms to be less than ${expected}ms`;

    return {
      message,
      pass,
    };
  },

  toHaveMemoryUsageBelow(received: number, limit: number) {
    const receivedMB = received / (1024 * 1024);
    const limitMB = limit / (1024 * 1024);
    const pass = receivedMB < limitMB;
    const message = () =>
      pass
        ? `expected ${receivedMB.toFixed(2)}MB not to be below ${limitMB.toFixed(2)}MB`
        : `expected ${receivedMB.toFixed(2)}MB to be below ${limitMB.toFixed(2)}MB`;

    return {
      message,
      pass,
    };
  },

  toBeWithinPerformanceRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;
    const message = () =>
      pass
        ? `expected ${received}ms not to be between ${min}ms and ${max}ms`
        : `expected ${received}ms to be between ${min}ms and ${max}ms`;

    return {
      message,
      pass,
    };
  },

  toHaveRenderTimeBetterThan(received: any, threshold: number) {
    const renderTime = received?.duration || received;
    const pass = renderTime < threshold;
    const message = () =>
      pass
        ? `expected render time ${renderTime}ms not to be less than ${threshold}ms`
        : `expected render time ${renderTime}ms to be less than ${threshold}ms`;

    return {
      message,
      pass,
    };
  },
});

// Declare global types for TypeScript
declare global {
  function markPerformance(name: string): void;
  function measurePerformance(name: string, startMark?: string, endMark?: string): void;
  function getPerformanceEntries(): PerformanceEntry[];
  function clearPerformanceEntries(): void;
  function getMemoryUsage(): number;
  function getTotalMemory(): number;
  function getMemoryLimit(): number;
  function forceGC(): void;

  var mockElectronAPI: {
    searchKBEntries: jest.MockedFunction<any>;
    getSearchHistory: jest.MockedFunction<any>;
    saveSearchQuery: jest.MockedFunction<any>;
    validateKBEntry: jest.MockedFunction<any>;
    addKBEntry: jest.MockedFunction<any>;
    getEntry: jest.MockedFunction<any>;
    recordUsage: jest.MockedFunction<any>;
    getMetrics: jest.MockedFunction<any>;
    initializeDatabase: jest.MockedFunction<any>;
  };

  namespace jest {
    interface Matchers<R> {
      toHavePerformanceBetterThan(expected: number): R;
      toHaveMemoryUsageBelow(limit: number): R;
      toBeWithinPerformanceRange(min: number, max: number): R;
      toHaveRenderTimeBetterThan(threshold: number): R;
    }
  }
}

// Performance test lifecycle hooks
beforeEach(() => {
  // Clear performance entries before each test
  global.clearPerformanceEntries();

  // Force garbage collection if available
  global.forceGC();

  // Reset mock implementations
  Object.values(global.mockElectronAPI).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
});

afterEach(() => {
  // Clean up performance entries
  global.clearPerformanceEntries();
});

// Cleanup on exit
process.on('exit', () => {
  if (performanceObserver) {
    performanceObserver.disconnect();
  }
});

// Error handling for performance tests
window.addEventListener('error', (event) => {
  console.error('Performance test error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in performance test:', event.reason);
});

console.log('🚀 Performance test setup complete');
console.log(`💾 Memory monitoring: ${(performance as any).memory ? 'Available' : 'Limited (Node.js only)'}`);
console.log(`🗑️ Garbage collection: ${global.gc ? 'Available' : 'Not available (use --expose-gc)'}`);
console.log(`📊 Performance observers: ${typeof PerformanceObserver !== 'undefined' ? 'Available' : 'Not available'}`);