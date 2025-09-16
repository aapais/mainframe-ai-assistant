/**
 * Test Setup for SearchResults Component Tests
 * 
 * Configures:
 * - Testing environment setup
 * - Mock implementations
 * - Custom matchers
 * - Global test utilities
 */

import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import { customMatchers, setupTestEnvironment } from './test-utils';

// Configure React Testing Library
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000,
  computedStyleSupportsPseudoElements: true
});

// Extend Jest matchers
expect.extend(toHaveNoViolations);
expect.extend(customMatchers);

// Global test setup
beforeAll(() => {
  setupTestEnvironment();
});

// Setup before each test
beforeEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset any DOM changes
  document.body.innerHTML = '';
  
  // Reset console methods
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

// Cleanup after each test
afterEach(() => {
  // Restore console methods
  jest.restoreAllMocks();
  
  // Clean up any timers
  jest.runOnlyPendingTimers();
});

// Mock browser APIs that aren't available in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }))
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation((callback, options) => ({
  root: options?.root || null,
  rootMargin: options?.rootMargin || '0px',
  thresholds: options?.threshold || [0],
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation((callback) => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock performance API enhancements
if (!(global as any).performance) {
  (global as any).performance = {};
}

if (!(global as any).performance.mark) {
  (global as any).performance.mark = jest.fn();
}

if (!(global as any).performance.measure) {
  (global as any).performance.measure = jest.fn();
}

if (!(global as any).performance.now) {
  (global as any).performance.now = jest.fn(() => Date.now());
}

// Mock memory API for performance tests
if (!(global as any).performance.memory) {
  (global as any).performance.memory = {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 10000000,
    jsHeapSizeLimit: 100000000
  };
}

// Mock requestIdleCallback
global.requestIdleCallback = jest.fn().mockImplementation((callback) => {
  return setTimeout(() => {
    callback({ didTimeout: false, timeRemaining: () => 50 });
  }, 0);
});

global.cancelIdleCallback = jest.fn().mockImplementation((id) => {
  clearTimeout(id);
});

// Mock CSS.supports for feature detection
if (!(global as any).CSS) {
  (global as any).CSS = {
    supports: jest.fn().mockReturnValue(true)
  };
}

// Mock getComputedStyle
const mockGetComputedStyle = jest.fn().mockImplementation(() => ({
  getPropertyValue: jest.fn().mockReturnValue(''),
  getPropertyPriority: jest.fn().mockReturnValue(''),
  setProperty: jest.fn(),
  removeProperty: jest.fn(),
  cssText: '',
  length: 0,
  parentRule: null,
  // Add common CSS properties with default values
  display: 'block',
  position: 'static',
  width: 'auto',
  height: 'auto',
  margin: '0px',
  padding: '0px',
  border: 'none',
  background: 'transparent',
  color: 'rgb(0, 0, 0)',
  fontSize: '16px',
  fontFamily: 'sans-serif',
  lineHeight: 'normal',
  textAlign: 'left'
}));

Object.defineProperty(window, 'getComputedStyle', {
  writable: true,
  value: mockGetComputedStyle
});

// Mock scroll behavior
Element.prototype.scrollTo = jest.fn();
Element.prototype.scrollIntoView = jest.fn();

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue('')
  },
  writable: true
});

// Mock focus and blur methods
HTMLElement.prototype.focus = jest.fn();
HTMLElement.prototype.blur = jest.fn();

// Global error handler for uncaught errors in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Export test constants
export const TEST_IDS = {
  SEARCH_RESULTS: 'search-results',
  SEARCH_RESULT_ITEM: 'search-result-item',
  VIRTUAL_LIST: 'virtual-list',
  LOADING_SPINNER: 'loading-spinner',
  EMPTY_STATE: 'empty-state',
  PAGINATION: 'pagination',
  SORT_CONTROLS: 'sort-controls'
} as const;

export const SELECTORS = {
  EXPAND_BUTTON: '[aria-label*="Expand"]',
  COLLAPSE_BUTTON: '[aria-label*="Collapse"]',
  HELPFUL_BUTTON: '[aria-label*="helpful"]',
  NOT_HELPFUL_BUTTON: '[aria-label*="not helpful"]',
  SORT_BUTTON: '[role="button"][aria-pressed]',
  RESULT_TITLE: 'h3',
  RESULT_SCORE: '.score-text',
  RESULT_CATEGORY: '.category-badge'
} as const;

export const PERFORMANCE_BUDGETS = {
  RENDER_TIME: 100, // milliseconds
  MEMORY_USAGE: 50 * 1024 * 1024, // 50MB
  LARGE_DATASET_RENDER: 300, // milliseconds for 1000+ items
  RE_RENDER_TIME: 50 // milliseconds
} as const;

export const ACCESSIBILITY_REQUIREMENTS = {
  MIN_CONTRAST_RATIO: 4.5,
  MIN_TOUCH_TARGET_SIZE: 44, // pixels
  MAX_HEADING_SKIP: 1 // heading levels
} as const;