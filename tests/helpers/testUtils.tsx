/**
 * Test Utilities and Helpers
 * Common utilities for routing system tests
 */

import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom';
import { KBRouterProvider } from '../../src/renderer/routing/KBRouter';
import { SearchProvider } from '../../src/renderer/contexts/SearchContext';
import { AppProvider } from '../../src/renderer/context/AppContext';

// Custom render function with all providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  routerProps?: MemoryRouterProps;
  initialEntries?: string[];
}

export const renderWithRouter = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { routerProps = {}, initialEntries = ['/'], ...renderOptions } = options;

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <MemoryRouter initialEntries={initialEntries} {...routerProps}>
      <AppProvider>
        <SearchProvider>
          <KBRouterProvider>
            {children}
          </KBRouterProvider>
        </SearchProvider>
      </AppProvider>
    </MemoryRouter>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    // Utility to change route during test
    navigateTo: (path: string) => {
      window.location.hash = `#${path}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    },
  };
};

// Mock localStorage for testing
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    length: Object.keys(store).length,
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
  };
};

// Mock window.location for testing
export const mockWindowLocation = (initialUrl = 'http://localhost:3000/') => {
  const url = new URL(initialUrl);
  
  return {
    href: url.href,
    origin: url.origin,
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    assign: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
    toString: () => url.href,
  };
};

// Mock performance API for performance tests
export const mockPerformanceAPI = () => {
  const marks: Record<string, number> = {};
  const measures: Record<string, number> = {};
  
  return {
    now: jest.fn(() => Date.now()),
    mark: jest.fn((name: string) => {
      marks[name] = Date.now();
    }),
    measure: jest.fn((name: string, startMark?: string, endMark?: string) => {
      const start = startMark ? marks[startMark] : 0;
      const end = endMark ? marks[endMark] : Date.now();
      measures[name] = end - start;
      return { duration: measures[name] };
    }),
    clearMarks: jest.fn(() => {
      Object.keys(marks).forEach(key => delete marks[key]);
    }),
    clearMeasures: jest.fn(() => {
      Object.keys(measures).forEach(key => delete measures[key]);
    }),
    getEntriesByName: jest.fn((name: string) => [
      { name, duration: measures[name] || 0, startTime: marks[name] || 0 }
    ]),
    getEntriesByType: jest.fn(() => []),
  };
};

// Wait for navigation to complete
export const waitForNavigation = async (timeout = 1000) => {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeout);
    
    const handler = () => {
      clearTimeout(timer);
      resolve(undefined);
    };
    
    window.addEventListener('hashchange', handler, { once: true });
  });
};

// Simulate browser navigation events
export const simulateBrowserNavigation = {
  back: () => {
    window.history.back();
    window.dispatchEvent(new PopStateEvent('popstate'));
  },
  
  forward: () => {
    window.history.forward();
    window.dispatchEvent(new PopStateEvent('popstate'));
  },
  
  pushState: (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  },
  
  replaceState: (path: string) => {
    window.history.replaceState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  },
};

// Mock console methods for testing
export const mockConsole = () => {
  const originalConsole = { ...console };
  
  const log = jest.fn();
  const warn = jest.fn();
  const error = jest.fn();
  const info = jest.fn();
  const debug = jest.fn();
  
  Object.assign(console, { log, warn, error, info, debug });
  
  return {
    log,
    warn,
    error,
    info,
    debug,
    restore: () => {
      Object.assign(console, originalConsole);
    },
  };
};

// Create mock search context
export const createMockSearchContext = (overrides = {}) => ({
  state: {
    query: '',
    results: [],
    isSearching: false,
    filters: { category: undefined },
    useAI: true,
    history: [],
    ...overrides,
  },
  performSearch: jest.fn(),
  setQuery: jest.fn(),
  updateFilters: jest.fn(),
  clearResults: jest.fn(),
  addToHistory: jest.fn(),
});

// Create mock app context
export const createMockAppContext = (overrides = {}) => ({
  state: {
    selectedEntry: null,
    recentEntries: [],
    isLoading: false,
    error: null,
    ...overrides,
  },
  selectEntry: jest.fn(),
  clearSelection: jest.fn(),
  setError: jest.fn(),
  setLoading: jest.fn(),
});

// Accessibility testing helper
export const checkAccessibility = async (container: HTMLElement) => {
  const { axe } = await import('jest-axe');
  const results = await axe(container);
  return results;
};

// Performance testing helper
export class PerformanceTester {
  private measurements: Map<string, number[]> = new Map();
  
  startMeasurement(name: string): () => number {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      
      if (!this.measurements.has(name)) {
        this.measurements.set(name, []);
      }
      
      this.measurements.get(name)!.push(duration);
      return duration;
    };
  }
  
  getAverageDuration(name: string): number {
    const measurements = this.measurements.get(name) || [];
    return measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
  }
  
  getMaxDuration(name: string): number {
    const measurements = this.measurements.get(name) || [];
    return Math.max(...measurements);
  }
  
  clear(): void {
    this.measurements.clear();
  }
  
  getAllMeasurements(): Record<string, number[]> {
    const result: Record<string, number[]> = {};
    this.measurements.forEach((value, key) => {
      result[key] = [...value];
    });
    return result;
  }
}

// Memory usage testing helper
export class MemoryTester {
  private snapshots: Array<{ name: string; usage: number; timestamp: number }> = [];
  
  takeSnapshot(name: string): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      this.snapshots.push({
        name,
        usage: usage.heapUsed,
        timestamp: Date.now(),
      });
    }
  }
  
  getMemoryDelta(startName: string, endName: string): number {
    const startSnapshot = this.snapshots.find(s => s.name === startName);
    const endSnapshot = this.snapshots.find(s => s.name === endName);
    
    if (!startSnapshot || !endSnapshot) {
      return 0;
    }
    
    return endSnapshot.usage - startSnapshot.usage;
  }
  
  clear(): void {
    this.snapshots = [];
  }
  
  getAllSnapshots(): Array<{ name: string; usage: number; timestamp: number }> {
    return [...this.snapshots];
  }
}

// URL testing utilities
export const URLTestUtils = {
  parseURL: (url: string) => {
    const parsed = new URL(url);
    return {
      path: parsed.pathname,
      search: parsed.search,
      params: new URLSearchParams(parsed.search),
      hash: parsed.hash,
    };
  },
  
  buildURL: (path: string, params?: Record<string, string>, hash?: string) => {
    const url = new URL(`http://localhost${path}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    
    if (hash) {
      url.hash = hash;
    }
    
    return url.toString();
  },
  
  compareURLs: (url1: string, url2: string) => {
    const parsed1 = URLTestUtils.parseURL(url1);
    const parsed2 = URLTestUtils.parseURL(url2);
    
    return {
      pathMatch: parsed1.path === parsed2.path,
      searchMatch: parsed1.search === parsed2.search,
      hashMatch: parsed1.hash === parsed2.hash,
      fullMatch: url1 === url2,
    };
  },
};

// Keyboard event simulation
export const simulateKeyboardEvents = {
  pressEnter: (element: Element) => {
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
    });
    element.dispatchEvent(event);
  },
  
  pressEscape: (element: Element) => {
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
    });
    element.dispatchEvent(event);
  },
  
  pressTab: (element: Element, shift = false) => {
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      code: 'Tab',
      shiftKey: shift,
      bubbles: true,
    });
    element.dispatchEvent(event);
  },
  
  pressArrow: (element: Element, direction: 'Up' | 'Down' | 'Left' | 'Right') => {
    const event = new KeyboardEvent('keydown', {
      key: `Arrow${direction}`,
      code: `Arrow${direction}`,
      bubbles: true,
    });
    element.dispatchEvent(event);
  },
};

// Test data generators
export const TestDataGenerators = {
  createMockEntry: (id: string, overrides = {}) => ({
    id,
    title: `Test Entry ${id}`,
    problem: `Test problem for entry ${id}`,
    solution: `Test solution for entry ${id}`,
    category: 'VSAM',
    tags: ['test', 'mock'],
    created_at: new Date(),
    updated_at: new Date(),
    usage_count: 0,
    success_count: 0,
    failure_count: 0,
    ...overrides,
  }),
  
  createMockSearchResult: (entry: any, score = 90, matchType = 'ai') => ({
    entry,
    score,
    matchType,
  }),
  
  createMockNavigationHistory: (count: number) => {
    const history = [];
    for (let i = 0; i < count; i++) {
      history.push({
        route: `/test-route-${i}`,
        timestamp: new Date(Date.now() - i * 1000),
        searchQuery: `query-${i}`,
        entryId: `entry-${i}`,
        metadata: { test: true },
      });
    }
    return history;
  },
};

export default {
  renderWithRouter,
  mockLocalStorage,
  mockWindowLocation,
  mockPerformanceAPI,
  waitForNavigation,
  simulateBrowserNavigation,
  mockConsole,
  createMockSearchContext,
  createMockAppContext,
  checkAccessibility,
  PerformanceTester,
  MemoryTester,
  URLTestUtils,
  simulateKeyboardEvents,
  TestDataGenerators,
};