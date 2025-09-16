/**
 * Responsive Testing Utilities
 *
 * Comprehensive utilities for responsive UI testing including:
 * - Viewport simulation and management
 * - Touch gesture simulation
 * - Performance measurement
 * - Layout validation
 * - Accessibility verification
 *
 * @author UI Responsiveness Testing Specialist
 * @version 1.0.0
 */

import { act, waitFor } from '@testing-library/react';
import { DeviceViewport, TestScenario, PERFORMANCE_THRESHOLDS } from './ResponsiveTestConfig';

// ========================
// Types and Interfaces
// ========================

export interface LayoutMeasurement {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LayoutShiftMeasurement {
  deltaX: number;
  deltaY: number;
  deltaWidth: number;
  deltaHeight: number;
  shiftScore: number;
}

export interface TouchGesture {
  type: 'swipe' | 'tap' | 'pinch' | 'scroll';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration?: number;
  force?: number;
}

export interface PerformanceMetrics {
  renderTime: number;
  layoutTime: number;
  paintTime: number;
  responseTime: number;
  memoryUsage: number;
  domNodeCount: number;
}

export interface AccessibilityValidation {
  hasVisibleFocus: boolean;
  hasProperLabels: boolean;
  keyboardNavigable: boolean;
  touchTargetSizeOk: boolean;
  contrastRatioOk: boolean;
}

// ========================
// Viewport Management
// ========================

export class ViewportSimulator {
  private originalInnerWidth: number;
  private originalInnerHeight: number;
  private originalScreenWidth: number;
  private originalScreenHeight: number;
  private originalDevicePixelRatio: number;

  constructor() {
    this.originalInnerWidth = window.innerWidth;
    this.originalInnerHeight = window.innerHeight;
    this.originalScreenWidth = window.screen.width;
    this.originalScreenHeight = window.screen.height;
    this.originalDevicePixelRatio = window.devicePixelRatio;
  }

  /**
   * Set viewport dimensions and properties
   */
  setViewport(viewport: DeviceViewport): void {
    // Set window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: viewport.width,
    });

    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: viewport.height,
    });

    // Set screen dimensions
    Object.defineProperty(window.screen, 'width', {
      writable: true,
      configurable: true,
      value: viewport.width,
    });

    Object.defineProperty(window.screen, 'height', {
      writable: true,
      configurable: true,
      value: viewport.height,
    });

    // Set device pixel ratio
    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      configurable: true,
      value: viewport.devicePixelRatio || 1,
    });

    // Dispatch resize event
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
  }

  /**
   * Simulate orientation change
   */
  simulateOrientationChange(orientation: 'portrait' | 'landscape'): void {
    const currentViewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio
    };

    if (orientation === 'landscape' && currentViewport.height > currentViewport.width) {
      // Swap dimensions for landscape
      this.setViewport({
        width: currentViewport.height,
        height: currentViewport.width,
        devicePixelRatio: currentViewport.devicePixelRatio
      });
    } else if (orientation === 'portrait' && currentViewport.width > currentViewport.height) {
      // Swap dimensions for portrait
      this.setViewport({
        width: currentViewport.height,
        height: currentViewport.width,
        devicePixelRatio: currentViewport.devicePixelRatio
      });
    }

    // Dispatch orientation change event
    act(() => {
      window.dispatchEvent(new Event('orientationchange'));
    });
  }

  /**
   * Restore original viewport
   */
  restore(): void {
    this.setViewport({
      width: this.originalInnerWidth,
      height: this.originalInnerHeight,
      devicePixelRatio: this.originalDevicePixelRatio
    });

    Object.defineProperty(window.screen, 'width', {
      writable: true,
      configurable: true,
      value: this.originalScreenWidth,
    });

    Object.defineProperty(window.screen, 'height', {
      writable: true,
      configurable: true,
      value: this.originalScreenHeight,
    });
  }
}

// ========================
// Touch Device Simulation
// ========================

export class TouchDeviceSimulator {
  private originalMaxTouchPoints: number;
  private originalTouchEvent: any;
  private originalOntouchstart: any;

  constructor() {
    this.originalMaxTouchPoints = navigator.maxTouchPoints;
    this.originalTouchEvent = (window as any).TouchEvent;
    this.originalOntouchstart = (document as any).ontouchstart;
  }

  /**
   * Enable touch device simulation
   */
  enableTouch(): void {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      configurable: true,
      value: 5,
    });

    // Mock TouchEvent
    (window as any).TouchEvent = class TouchEvent extends UIEvent {
      constructor(type: string, eventInitDict?: TouchEventInit) {
        super(type, eventInitDict);
      }
    };

    // Enable touch events
    (document as any).ontouchstart = null;
  }

  /**
   * Disable touch device simulation
   */
  disableTouch(): void {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      configurable: true,
      value: 0,
    });

    delete (window as any).TouchEvent;
    delete (document as any).ontouchstart;
  }

  /**
   * Restore original touch configuration
   */
  restore(): void {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      configurable: true,
      value: this.originalMaxTouchPoints,
    });

    if (this.originalTouchEvent) {
      (window as any).TouchEvent = this.originalTouchEvent;
    } else {
      delete (window as any).TouchEvent;
    }

    if (this.originalOntouchstart !== undefined) {
      (document as any).ontouchstart = this.originalOntouchstart;
    } else {
      delete (document as any).ontouchstart;
    }
  }
}

// ========================
// Media Query Simulation
// ========================

export class MediaQuerySimulator {
  private mockQueries: Map<string, MediaQueryList> = new Map();

  /**
   * Mock a media query with specific matches value
   */
  mockQuery(query: string, matches: boolean): MediaQueryList {
    const mediaQuery = {
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };

    this.mockQueries.set(query, mediaQuery as MediaQueryList);

    const originalMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn().mockImplementation((q: string) => {
      return this.mockQueries.get(q) || originalMatchMedia(q);
    });

    return mediaQuery as MediaQueryList;
  }

  /**
   * Update a mocked media query
   */
  updateQuery(query: string, matches: boolean): void {
    const mediaQuery = this.mockQueries.get(query);
    if (mediaQuery) {
      (mediaQuery as any).matches = matches;
      if (mediaQuery.onchange) {
        mediaQuery.onchange({ matches } as MediaQueryListEvent);
      }
    }
  }

  /**
   * Clear all mocked queries
   */
  clear(): void {
    this.mockQueries.clear();
    jest.restoreAllMocks();
  }
}

// ========================
// Touch Gesture Simulation
// ========================

export class TouchGestureSimulator {
  /**
   * Simulate a swipe gesture
   */
  static simulateSwipe(
    element: Element,
    gesture: TouchGesture
  ): Promise<void> {
    return new Promise((resolve) => {
      const { startX, startY, endX, endY, duration = 300 } = gesture;

      // Start touch
      element.dispatchEvent(new TouchEvent('touchstart', {
        touches: [{ clientX: startX, clientY: startY } as Touch],
        changedTouches: [{ clientX: startX, clientY: startY } as Touch],
        bubbles: true
      }));

      // Simulate movement over time
      const steps = 10;
      const stepDuration = duration / steps;
      const deltaX = (endX - startX) / steps;
      const deltaY = (endY - startY) / steps;

      let currentStep = 0;

      const moveStep = () => {
        if (currentStep < steps) {
          const currentX = startX + (deltaX * currentStep);
          const currentY = startY + (deltaY * currentStep);

          element.dispatchEvent(new TouchEvent('touchmove', {
            touches: [{ clientX: currentX, clientY: currentY } as Touch],
            changedTouches: [{ clientX: currentX, clientY: currentY } as Touch],
            bubbles: true
          }));

          currentStep++;
          setTimeout(moveStep, stepDuration);
        } else {
          // End touch
          element.dispatchEvent(new TouchEvent('touchend', {
            touches: [],
            changedTouches: [{ clientX: endX, clientY: endY } as Touch],
            bubbles: true
          }));

          resolve();
        }
      };

      setTimeout(moveStep, stepDuration);
    });
  }

  /**
   * Simulate a tap gesture
   */
  static simulateTap(element: Element, x: number, y: number): void {
    const touch = { clientX: x, clientY: y } as Touch;

    element.dispatchEvent(new TouchEvent('touchstart', {
      touches: [touch],
      changedTouches: [touch],
      bubbles: true
    }));

    setTimeout(() => {
      element.dispatchEvent(new TouchEvent('touchend', {
        touches: [],
        changedTouches: [touch],
        bubbles: true
      }));
    }, 50);
  }

  /**
   * Simulate a pinch gesture
   */
  static simulatePinch(
    element: Element,
    startDistance: number,
    endDistance: number,
    centerX: number,
    centerY: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const duration = 300;
      const steps = 10;

      const touch1Start = {
        clientX: centerX - startDistance / 2,
        clientY: centerY
      } as Touch;

      const touch2Start = {
        clientX: centerX + startDistance / 2,
        clientY: centerY
      } as Touch;

      // Start pinch
      element.dispatchEvent(new TouchEvent('touchstart', {
        touches: [touch1Start, touch2Start],
        changedTouches: [touch1Start, touch2Start],
        bubbles: true
      }));

      let currentStep = 0;
      const distanceDelta = (endDistance - startDistance) / steps;

      const pinchStep = () => {
        if (currentStep < steps) {
          const currentDistance = startDistance + (distanceDelta * currentStep);

          const touch1 = {
            clientX: centerX - currentDistance / 2,
            clientY: centerY
          } as Touch;

          const touch2 = {
            clientX: centerX + currentDistance / 2,
            clientY: centerY
          } as Touch;

          element.dispatchEvent(new TouchEvent('touchmove', {
            touches: [touch1, touch2],
            changedTouches: [touch1, touch2],
            bubbles: true
          }));

          currentStep++;
          setTimeout(pinchStep, duration / steps);
        } else {
          const touch1End = {
            clientX: centerX - endDistance / 2,
            clientY: centerY
          } as Touch;

          const touch2End = {
            clientX: centerX + endDistance / 2,
            clientY: centerY
          } as Touch;

          element.dispatchEvent(new TouchEvent('touchend', {
            touches: [],
            changedTouches: [touch1End, touch2End],
            bubbles: true
          }));

          resolve();
        }
      };

      setTimeout(pinchStep, duration / steps);
    });
  }
}

// ========================
// Layout Measurement Utilities
// ========================

export class LayoutMeasurementUtils {
  /**
   * Get detailed layout measurements for an element
   */
  static measureElement(element: Element): LayoutMeasurement {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left
    };
  }

  /**
   * Measure layout shift between two states
   */
  static measureLayoutShift(
    element: Element,
    action: () => void
  ): LayoutShiftMeasurement {
    const beforeMeasurement = this.measureElement(element);

    action();

    const afterMeasurement = this.measureElement(element);

    const deltaX = Math.abs(afterMeasurement.x - beforeMeasurement.x);
    const deltaY = Math.abs(afterMeasurement.y - beforeMeasurement.y);
    const deltaWidth = Math.abs(afterMeasurement.width - beforeMeasurement.width);
    const deltaHeight = Math.abs(afterMeasurement.height - beforeMeasurement.height);

    // Calculate layout shift score (simplified CLS calculation)
    const impactFraction = (deltaWidth * deltaHeight) / (window.innerWidth * window.innerHeight);
    const distanceFraction = Math.max(deltaX, deltaY) / Math.max(window.innerWidth, window.innerHeight);
    const shiftScore = impactFraction * distanceFraction;

    return {
      deltaX,
      deltaY,
      deltaWidth,
      deltaHeight,
      shiftScore
    };
  }

  /**
   * Check if elements are arranged vertically (stacked)
   */
  static areElementsStacked(elements: Element[]): boolean {
    if (elements.length < 2) return true;

    for (let i = 0; i < elements.length - 1; i++) {
      const current = this.measureElement(elements[i]);
      const next = this.measureElement(elements[i + 1]);

      // Next element should start after current element ends (with some tolerance)
      if (next.top < current.bottom - 5) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if elements are arranged horizontally (side by side)
   */
  static areElementsHorizontal(elements: Element[]): boolean {
    if (elements.length < 2) return true;

    for (let i = 0; i < elements.length - 1; i++) {
      const current = this.measureElement(elements[i]);
      const next = this.measureElement(elements[i + 1]);

      // Next element should start after current element ends (with some tolerance)
      if (next.left < current.right - 5) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate touch target sizes
   */
  static validateTouchTargets(elements: Element[]): boolean {
    return elements.every(element => {
      const measurement = this.measureElement(element);
      const minDimension = Math.min(measurement.width, measurement.height);
      return minDimension >= PERFORMANCE_THRESHOLDS.TOUCH_TARGET_MIN_SIZE;
    });
  }

  /**
   * Check if content overflows viewport
   */
  static hasHorizontalOverflow(element: Element): boolean {
    const measurement = this.measureElement(element);
    return measurement.right > window.innerWidth || measurement.left < 0;
  }

  /**
   * Check if element is visible in viewport
   */
  static isElementVisible(element: Element): boolean {
    const measurement = this.measureElement(element);
    return (
      measurement.bottom > 0 &&
      measurement.right > 0 &&
      measurement.top < window.innerHeight &&
      measurement.left < window.innerWidth
    );
  }
}

// ========================
// Performance Measurement
// ========================

export class PerformanceMeasurementUtils {
  private static performanceEntries: PerformanceEntry[] = [];
  private static memoryBaseline: number = 0;

  /**
   * Start performance monitoring
   */
  static startMonitoring(): void {
    this.performanceEntries = [];
    this.memoryBaseline = this.getCurrentMemoryUsage();

    // Clear existing performance entries
    if (performance.clearMeasures) {
      performance.clearMeasures();
    }
    if (performance.clearMarks) {
      performance.clearMarks();
    }
  }

  /**
   * Mark a performance measurement point
   */
  static mark(name: string): void {
    if (performance.mark) {
      performance.mark(name);
    }
  }

  /**
   * Measure performance between two marks
   */
  static measure(name: string, startMark: string, endMark?: string): number {
    if (performance.measure) {
      performance.measure(name, startMark, endMark);
      const entries = performance.getEntriesByName(name, 'measure');
      if (entries.length > 0) {
        return entries[entries.length - 1].duration;
      }
    }
    return 0;
  }

  /**
   * Measure execution time of a function
   */
  static async measureExecution<T>(
    name: string,
    fn: () => T | Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    const result = await fn();
    const endTime = performance.now();
    const duration = endTime - startTime;

    this.performanceEntries.push({
      name,
      startTime,
      duration,
      entryType: 'measure'
    } as PerformanceEntry);

    return { result, duration };
  }

  /**
   * Get current memory usage (if available)
   */
  static getCurrentMemoryUsage(): number {
    if ((performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Get memory usage increase since monitoring started
   */
  static getMemoryIncrease(): number {
    const current = this.getCurrentMemoryUsage();
    return current - this.memoryBaseline;
  }

  /**
   * Count DOM nodes
   */
  static getDOMNodeCount(): number {
    return document.querySelectorAll('*').length;
  }

  /**
   * Get comprehensive performance metrics
   */
  static getMetrics(): PerformanceMetrics {
    const renderEntries = this.performanceEntries.filter(e => e.name.includes('render'));
    const layoutEntries = this.performanceEntries.filter(e => e.name.includes('layout'));
    const responseEntries = this.performanceEntries.filter(e => e.name.includes('response'));

    return {
      renderTime: this.getAverageTime(renderEntries),
      layoutTime: this.getAverageTime(layoutEntries),
      paintTime: this.getPaintTime(),
      responseTime: this.getAverageTime(responseEntries),
      memoryUsage: this.getMemoryIncrease(),
      domNodeCount: this.getDOMNodeCount()
    };
  }

  private static getAverageTime(entries: PerformanceEntry[]): number {
    if (entries.length === 0) return 0;
    const total = entries.reduce((sum, entry) => sum + entry.duration, 0);
    return total / entries.length;
  }

  private static getPaintTime(): number {
    const paintEntries = performance.getEntriesByType('paint');
    if (paintEntries.length > 0) {
      return paintEntries[paintEntries.length - 1].startTime;
    }
    return 0;
  }
}

// ========================
// Accessibility Validation
// ========================

export class AccessibilityValidationUtils {
  /**
   * Check if element has visible focus indicator
   */
  static hasVisibleFocus(element: Element): boolean {
    const computedStyle = window.getComputedStyle(element);
    return (
      computedStyle.outline !== 'none' ||
      computedStyle.boxShadow !== 'none' ||
      computedStyle.border !== 'none'
    );
  }

  /**
   * Check if element has proper ARIA labels
   */
  static hasProperLabels(element: Element): boolean {
    const hasAriaLabel = element.hasAttribute('aria-label');
    const hasAriaLabelledBy = element.hasAttribute('aria-labelledby');
    const hasTitle = element.hasAttribute('title');
    const hasText = element.textContent?.trim().length > 0;

    return hasAriaLabel || hasAriaLabelledBy || hasTitle || hasText;
  }

  /**
   * Validate keyboard navigation
   */
  static isKeyboardNavigable(element: Element): boolean {
    const tabIndex = element.getAttribute('tabindex');
    const isInteractive = ['button', 'input', 'select', 'textarea', 'a'].includes(
      element.tagName.toLowerCase()
    );

    return (
      isInteractive ||
      (tabIndex !== null && parseInt(tabIndex) >= 0) ||
      element.hasAttribute('role')
    );
  }

  /**
   * Check color contrast ratio
   */
  static checkColorContrast(element: Element): boolean {
    const computedStyle = window.getComputedStyle(element);
    const color = computedStyle.color;
    const backgroundColor = computedStyle.backgroundColor;

    // This is a simplified check - in real implementation,
    // you would calculate the actual contrast ratio
    return color !== backgroundColor && color !== 'transparent';
  }

  /**
   * Comprehensive accessibility validation
   */
  static validateAccessibility(element: Element): AccessibilityValidation {
    return {
      hasVisibleFocus: this.hasVisibleFocus(element),
      hasProperLabels: this.hasProperLabels(element),
      keyboardNavigable: this.isKeyboardNavigable(element),
      touchTargetSizeOk: LayoutMeasurementUtils.validateTouchTargets([element]),
      contrastRatioOk: this.checkColorContrast(element)
    };
  }
}

// ========================
// Scenario Test Runner
// ========================

export class ResponsiveTestRunner {
  private viewportSimulator: ViewportSimulator;
  private touchSimulator: TouchDeviceSimulator;
  private mediaQuerySimulator: MediaQuerySimulator;

  constructor() {
    this.viewportSimulator = new ViewportSimulator();
    this.touchSimulator = new TouchDeviceSimulator();
    this.mediaQuerySimulator = new MediaQuerySimulator();
  }

  /**
   * Run a test scenario
   */
  async runScenario(
    scenario: TestScenario,
    testFn: () => Promise<void> | void
  ): Promise<void> {
    try {
      // Set up viewport
      this.viewportSimulator.setViewport(scenario.viewport);

      // Set up touch capability
      if (scenario.touch) {
        this.touchSimulator.enableTouch();
      } else {
        this.touchSimulator.disableTouch();
      }

      // Set up media queries
      if (scenario.orientation) {
        this.mediaQuerySimulator.mockQuery(
          `(orientation: ${scenario.orientation})`,
          true
        );
      }

      if (scenario.prefersReducedMotion) {
        this.mediaQuerySimulator.mockQuery(
          '(prefers-reduced-motion: reduce)',
          true
        );
      }

      if (scenario.highContrast) {
        this.mediaQuerySimulator.mockQuery(
          '(prefers-contrast: high)',
          true
        );
      }

      // Run the test
      await testFn();

    } finally {
      // Clean up
      this.cleanup();
    }
  }

  /**
   * Clean up all simulators
   */
  cleanup(): void {
    this.viewportSimulator.restore();
    this.touchSimulator.restore();
    this.mediaQuerySimulator.clear();
  }
}

// ========================
// Export all utilities
// ========================

export {
  ViewportSimulator,
  TouchDeviceSimulator,
  MediaQuerySimulator,
  TouchGestureSimulator,
  LayoutMeasurementUtils,
  PerformanceMeasurementUtils,
  AccessibilityValidationUtils,
  ResponsiveTestRunner
};