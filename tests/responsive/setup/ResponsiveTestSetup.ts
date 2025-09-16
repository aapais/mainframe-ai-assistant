/**
 * Responsive Test Setup
 *
 * Global setup for responsive UI testing including:
 * - DOM polyfills for testing environment
 * - Performance monitoring initialization
 * - Mock implementations for browser APIs
 * - Global test utilities and matchers
 *
 * @author UI Responsiveness Testing Specialist
 * @version 1.0.0
 */

import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// ========================
// Testing Library Configuration
// ========================

configure({
  // Increase timeout for responsive tests
  asyncUtilTimeout: 10000,
  // Custom test ID attribute
  testIdAttribute: 'data-testid',
  // Default hidden elements to include
  defaultHidden: false,
  // Show suggestions for better queries
  showOriginalStackTrace: true,
  // Throw on multiple elements found
  throwSuggestions: true
});

// ========================
// Browser API Polyfills
// ========================

// ResizeObserver polyfill
global.ResizeObserver = class ResizeObserver {
  private callback: ResizeObserverCallback;
  private elements: Set<Element> = new Set();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(element: Element): void {
    this.elements.add(element);
    // Simulate initial observation
    setTimeout(() => {
      this.callback([{
        target: element,
        contentRect: element.getBoundingClientRect(),
        borderBoxSize: [{
          blockSize: element.clientHeight,
          inlineSize: element.clientWidth
        }],
        contentBoxSize: [{
          blockSize: element.clientHeight,
          inlineSize: element.clientWidth
        }],
        devicePixelContentBoxSize: [{
          blockSize: element.clientHeight,
          inlineSize: element.clientWidth
        }]
      } as ResizeObserverEntry], this);
    }, 0);
  }

  unobserve(element: Element): void {
    this.elements.delete(element);
  }

  disconnect(): void {
    this.elements.clear();
  }
};

// IntersectionObserver polyfill
global.IntersectionObserver = class IntersectionObserver {
  private callback: IntersectionObserverCallback;
  private elements: Set<Element> = new Set();

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
  }

  observe(element: Element): void {
    this.elements.add(element);
    // Simulate intersection
    setTimeout(() => {
      this.callback([{
        target: element,
        intersectionRatio: 1,
        isIntersecting: true,
        time: Date.now(),
        rootBounds: null,
        boundingClientRect: element.getBoundingClientRect(),
        intersectionRect: element.getBoundingClientRect()
      } as IntersectionObserverEntry], this);
    }, 0);
  }

  unobserve(element: Element): void {
    this.elements.delete(element);
  }

  disconnect(): void {
    this.elements.clear();
  }
};

// MutationObserver polyfill
global.MutationObserver = class MutationObserver {
  private callback: MutationCallback;

  constructor(callback: MutationCallback) {
    this.callback = callback;
  }

  observe(target: Node, options?: MutationObserverInit): void {
    // Mock implementation - in real tests, mutations would be tracked
  }

  disconnect(): void {
    // Mock implementation
  }

  takeRecords(): MutationRecord[] {
    return [];
  }
};

// ========================
// Performance API Enhancement
// ========================

// Enhanced Performance API for testing
const originalPerformance = global.performance;

global.performance = {
  ...originalPerformance,
  memory: {
    usedJSHeapSize: 10 * 1024 * 1024, // 10MB
    totalJSHeapSize: 50 * 1024 * 1024, // 50MB
    jsHeapSizeLimit: 2 * 1024 * 1024 * 1024 // 2GB
  },
  // Enhanced timing
  now: () => Date.now(),
  mark: (name: string) => {
    if (originalPerformance.mark) {
      originalPerformance.mark(name);
    }
  },
  measure: (name: string, start?: string, end?: string) => {
    if (originalPerformance.measure) {
      originalPerformance.measure(name, start, end);
    }
  },
  clearMarks: (name?: string) => {
    if (originalPerformance.clearMarks) {
      originalPerformance.clearMarks(name);
    }
  },
  clearMeasures: (name?: string) => {
    if (originalPerformance.clearMeasures) {
      originalPerformance.clearMeasures(name);
    }
  },
  getEntriesByName: (name: string, type?: string) => {
    if (originalPerformance.getEntriesByName) {
      return originalPerformance.getEntriesByName(name, type);
    }
    return [];
  },
  getEntriesByType: (type: string) => {
    if (originalPerformance.getEntriesByType) {
      return originalPerformance.getEntriesByType(type);
    }
    return [];
  }
};

// ========================
// Touch Events Support
// ========================

// Touch event constructors
global.Touch = class Touch {
  identifier: number;
  target: EventTarget;
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
  screenX: number;
  screenY: number;
  radiusX: number;
  radiusY: number;
  rotationAngle: number;
  force: number;

  constructor(touchInit: TouchInit) {
    this.identifier = touchInit.identifier;
    this.target = touchInit.target;
    this.clientX = touchInit.clientX;
    this.clientY = touchInit.clientY;
    this.pageX = touchInit.pageX || touchInit.clientX;
    this.pageY = touchInit.pageY || touchInit.clientY;
    this.screenX = touchInit.screenX || touchInit.clientX;
    this.screenY = touchInit.screenY || touchInit.clientY;
    this.radiusX = touchInit.radiusX || 1;
    this.radiusY = touchInit.radiusY || 1;
    this.rotationAngle = touchInit.rotationAngle || 0;
    this.force = touchInit.force || 1;
  }
};

global.TouchEvent = class TouchEvent extends UIEvent {
  touches: TouchList;
  targetTouches: TouchList;
  changedTouches: TouchList;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;

  constructor(type: string, touchEventInit?: TouchEventInit) {
    super(type, touchEventInit);
    this.touches = (touchEventInit?.touches as TouchList) || ([] as any);
    this.targetTouches = (touchEventInit?.targetTouches as TouchList) || ([] as any);
    this.changedTouches = (touchEventInit?.changedTouches as TouchList) || ([] as any);
    this.altKey = touchEventInit?.altKey || false;
    this.metaKey = touchEventInit?.metaKey || false;
    this.ctrlKey = touchEventInit?.ctrlKey || false;
    this.shiftKey = touchEventInit?.shiftKey || false;
  }
};

// ========================
// Viewport and Media Query Support
// ========================

// Mock matchMedia with responsive capabilities
const mockMatchMedia = (query: string): MediaQueryList => {
  const mediaQuery = {
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  };

  // Parse common media queries and set initial matches
  if (query.includes('max-width: 767px')) {
    mediaQuery.matches = window.innerWidth <= 767;
  } else if (query.includes('min-width: 768px') && query.includes('max-width: 1023px')) {
    mediaQuery.matches = window.innerWidth >= 768 && window.innerWidth <= 1023;
  } else if (query.includes('min-width: 1024px')) {
    mediaQuery.matches = window.innerWidth >= 1024;
  } else if (query.includes('orientation: portrait')) {
    mediaQuery.matches = window.innerHeight > window.innerWidth;
  } else if (query.includes('orientation: landscape')) {
    mediaQuery.matches = window.innerWidth > window.innerHeight;
  } else if (query.includes('prefers-reduced-motion')) {
    mediaQuery.matches = false; // Default to false unless explicitly set
  } else if (query.includes('prefers-color-scheme: dark')) {
    mediaQuery.matches = false; // Default to light mode
  } else if (query.includes('hover: hover')) {
    mediaQuery.matches = !navigator.maxTouchPoints || navigator.maxTouchPoints === 0;
  } else if (query.includes('pointer: coarse')) {
    mediaQuery.matches = navigator.maxTouchPoints > 0;
  }

  return mediaQuery as MediaQueryList;
};

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(mockMatchMedia)
});

// ========================
// Enhanced Console for Testing
// ========================

// Capture console methods for testing
const originalConsole = { ...console };

// Add performance logging
console.timePerformance = (label: string) => {
  performance.mark(`${label}-start`);
};

console.timeEndPerformance = (label: string) => {
  performance.mark(`${label}-end`);
  performance.measure(label, `${label}-start`, `${label}-end`);
  const entries = performance.getEntriesByName(label, 'measure');
  if (entries.length > 0) {
    const duration = entries[entries.length - 1].duration;
    console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
    return duration;
  }
  return 0;
};

// ========================
// Global Test Utilities
// ========================

// Utility to wait for next tick
global.waitForNextTick = (): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, 0));
};

// Utility to wait for animation frame
global.waitForAnimationFrame = (): Promise<void> => {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
};

// Utility to simulate frame delay
global.waitForFrames = (frames: number): Promise<void> => {
  return new Promise(resolve => {
    let frameCount = 0;
    const tick = () => {
      frameCount++;
      if (frameCount >= frames) {
        resolve();
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
};

// ========================
// Custom Jest Matchers
// ========================

expect.extend({
  // Check if element is within viewport
  toBeInViewport(received: Element) {
    const rect = received.getBoundingClientRect();
    const isInViewport = (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );

    return {
      message: () => isInViewport
        ? `Expected element not to be in viewport`
        : `Expected element to be in viewport. Element bounds: ${JSON.stringify(rect)}, Viewport: ${window.innerWidth}x${window.innerHeight}`,
      pass: isInViewport
    };
  },

  // Check if element has proper touch target size
  toHaveValidTouchTarget(received: Element, minSize = 44) {
    const rect = received.getBoundingClientRect();
    const minDimension = Math.min(rect.width, rect.height);
    const isValid = minDimension >= minSize;

    return {
      message: () => isValid
        ? `Expected element not to have valid touch target (min ${minSize}px)`
        : `Expected element to have valid touch target size. Current: ${minDimension}px, Required: ${minSize}px`,
      pass: isValid
    };
  },

  // Check if elements are stacked vertically
  toBeStackedVertically(received: Element[]) {
    if (received.length < 2) {
      return {
        message: () => 'Cannot check stacking with less than 2 elements',
        pass: true
      };
    }

    let isStacked = true;
    for (let i = 0; i < received.length - 1; i++) {
      const current = received[i].getBoundingClientRect();
      const next = received[i + 1].getBoundingClientRect();

      if (next.top < current.bottom - 5) { // 5px tolerance
        isStacked = false;
        break;
      }
    }

    return {
      message: () => isStacked
        ? 'Expected elements not to be stacked vertically'
        : 'Expected elements to be stacked vertically',
      pass: isStacked
    };
  },

  // Check performance threshold
  toBeWithinPerformanceThreshold(received: number, threshold: number) {
    const isWithin = received <= threshold;

    return {
      message: () => isWithin
        ? `Expected ${received}ms to exceed performance threshold of ${threshold}ms`
        : `Expected ${received}ms to be within performance threshold of ${threshold}ms`,
      pass: isWithin
    };
  }
});

// ========================
// Global Error Handling
// ========================

// Catch unhandled errors in responsive tests
global.addEventListener('error', (event) => {
  console.error('Unhandled error in responsive test:', event.error);
});

global.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in responsive test:', event.reason);
});

// ========================
// Memory Leak Detection
// ========================

let initialMemory: number;

beforeEach(() => {
  // Record initial memory usage
  if (global.performance?.memory) {
    initialMemory = global.performance.memory.usedJSHeapSize;
  }
});

afterEach(() => {
  // Check for memory leaks
  if (global.performance?.memory && initialMemory) {
    const currentMemory = global.performance.memory.usedJSHeapSize;
    const memoryIncrease = (currentMemory - initialMemory) / (1024 * 1024); // MB

    if (memoryIncrease > 50) { // 50MB threshold
      console.warn(`⚠️ Potential memory leak detected: ${memoryIncrease.toFixed(2)}MB increase`);
    }
  }
});

// ========================
// Export Types for TypeScript
// ========================

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInViewport(): R;
      toHaveValidTouchTarget(minSize?: number): R;
      toBeStackedVertically(): R;
      toBeWithinPerformanceThreshold(threshold: number): R;
    }
  }

  interface Console {
    timePerformance(label: string): void;
    timeEndPerformance(label: string): number;
  }

  function waitForNextTick(): Promise<void>;
  function waitForAnimationFrame(): Promise<void>;
  function waitForFrames(frames: number): Promise<void>;
}

export {};