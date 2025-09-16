/**
 * Global Test Setup Configuration
 * Sets up testing environment with mocks, utilities, and global configurations
 */

import '@testing-library/jest-dom';
import 'jest-performance-testing';
import { configure } from '@testing-library/react';
import { jest } from '@jest/globals';

// Configure Testing Library
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000,
  computedStyleSupportsPseudoElements: true,
});

// Global test utilities
declare global {
  interface Window {
    electronAPI: any;
    api: any;
  }

  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toHavePerformanceWithin(threshold: number): R;
      toBeAccessible(): Promise<R>;
      toMatchSearchResult(expected: any): R;
    }
  }
}

// Custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toHavePerformanceWithin(received: { time: number }, threshold: number) {
    const pass = received.time <= threshold;
    return {
      message: () =>
        `expected operation to complete within ${threshold}ms but took ${received.time}ms`,
      pass,
    };
  },

  async toBeAccessible(received: HTMLElement) {
    const { axe } = await import('jest-axe');
    const results = await axe(received);
    return {
      message: () => results.violations.map(v => v.description).join('\n'),
      pass: results.violations.length === 0,
    };
  },

  toMatchSearchResult(received: any, expected: any) {
    const pass =
      received.entry?.id === expected.entry?.id &&
      typeof received.score === 'number' &&
      received.score >= 0 &&
      received.score <= 100 &&
      ['exact', 'fuzzy', 'ai', 'semantic'].includes(received.matchType);

    return {
      message: () => `expected search result to match expected format`,
      pass,
    };
  }
});

// Mock Electron APIs
const mockElectronAPI = {
  // IPC methods
  searchKB: jest.fn(),
  addKBEntry: jest.fn(),
  updateKBEntry: jest.fn(),
  deleteKBEntry: jest.fn(),
  getKBStats: jest.fn(),
  exportKB: jest.fn(),
  importKB: jest.fn(),

  // Search-specific APIs
  searchWithAI: jest.fn(),
  searchLocal: jest.fn(),
  getSearchSuggestions: jest.fn(),
  clearSearchCache: jest.fn(),

  // Performance monitoring
  getPerformanceMetrics: jest.fn(),
  startPerformanceMonitoring: jest.fn(),
  stopPerformanceMonitoring: jest.fn(),

  // Database operations
  getDatabaseStats: jest.fn(),
  optimizeDatabase: jest.fn(),
  backupDatabase: jest.fn(),

  // Event listeners
  onSearchProgress: jest.fn(),
  onPerformanceAlert: jest.fn(),
  onDatabaseUpdate: jest.fn(),

  // Utility methods
  showErrorDialog: jest.fn(),
  showInfoDialog: jest.fn(),
  openExternal: jest.fn(),
};

// Set up global mocks
global.window = Object.create(window);
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});
Object.defineProperty(window, 'api', {
  value: mockElectronAPI,
  writable: true,
});

// Mock console methods for cleaner test output
const originalConsole = { ...console };
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Restore console for debugging when needed
export const restoreConsole = () => {
  global.console = originalConsole;
};

// Mock timers
jest.useFakeTimers('legacy');

// Performance monitoring utilities
export const createPerformanceWrapper = <T extends (...args: any[]) => any>(
  fn: T,
  name: string = 'anonymous'
): T & { getLastExecutionTime: () => number } => {
  let lastExecutionTime = 0;

  const wrapper = ((...args: any[]) => {
    const start = performance.now();
    const result = fn(...args);

    if (result instanceof Promise) {
      return result.then((res) => {
        lastExecutionTime = performance.now() - start;
        return res;
      });
    } else {
      lastExecutionTime = performance.now() - start;
      return result;
    }
  }) as T & { getLastExecutionTime: () => number };

  wrapper.getLastExecutionTime = () => lastExecutionTime;

  return wrapper;
};

// Memory usage monitoring
export const measureMemoryUsage = () => {
  if (typeof performance !== 'undefined' && performance.memory) {
    return {
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit,
    };
  }
  return null;
};

// Test data factories
export class TestDataFactory {
  static createKBEntry(overrides: Partial<any> = {}) {
    return {
      id: `kb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: 'Test Entry Title',
      problem: 'Test problem description',
      solution: 'Test solution steps',
      category: 'VSAM',
      tags: ['test', 'vsam', 'error'],
      created_at: new Date(),
      updated_at: new Date(),
      usage_count: 0,
      success_count: 0,
      failure_count: 0,
      ...overrides,
    };
  }

  static createSearchResult(overrides: Partial<any> = {}) {
    return {
      entry: TestDataFactory.createKBEntry(),
      score: 85.5,
      matchType: 'fuzzy',
      explanation: 'Matched on title and problem description',
      metadata: {
        processingTime: 125,
        source: 'database',
        confidence: 0.855,
        fallback: false,
      },
      ...overrides,
    };
  }

  static createSearchOptions(overrides: Partial<any> = {}) {
    return {
      limit: 10,
      offset: 0,
      sortBy: 'relevance',
      timeout: 1000,
      useCache: true,
      fuzzyEnabled: true,
      ...overrides,
    };
  }

  static createPerformanceMetrics(overrides: Partial<any> = {}) {
    return {
      queryTime: 50,
      indexTime: 25,
      rankingTime: 30,
      totalTime: 105,
      resultCount: 5,
      cacheHit: false,
      algorithm: 'bm25',
      optimizations: ['indexOptimized', 'cacheWarmed'],
      ...overrides,
    };
  }
}

// Async test utilities
export const waitForAsync = (ms: number = 0) =>
  new Promise(resolve => setTimeout(resolve, ms));

export const waitForCondition = async (
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await waitForAsync(interval);
  }

  throw new Error(`Condition not met within ${timeout}ms`);
};

// Error simulation utilities
export const createErrorScenario = (type: 'network' | 'timeout' | 'parsing' | 'memory') => {
  switch (type) {
    case 'network':
      return new Error('Network request failed');
    case 'timeout':
      return new Error('Operation timed out');
    case 'parsing':
      return new Error('Failed to parse response');
    case 'memory':
      return new Error('Out of memory');
    default:
      return new Error('Unknown error');
  }
};

// Cleanup utilities
export const cleanup = () => {
  jest.clearAllMocks();
  jest.clearAllTimers();
  jest.restoreAllMocks();
};

// Setup test environment
beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();

  // Reset fake timers
  jest.clearAllTimers();

  // Clear any cached data
  if (typeof window !== 'undefined' && window.electronAPI) {
    window.electronAPI.clearSearchCache.mockResolvedValue(true);
  }
});

afterEach(() => {
  // Cleanup after each test
  cleanup();

  // Advance any pending timers
  jest.runOnlyPendingTimers();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default {};