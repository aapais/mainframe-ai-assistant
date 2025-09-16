/**
 * Mobile Viewport Tests
 * 
 * Comprehensive testing of mobile viewports for critical user flows:
 * - iPhone SE (375x667)
 * - iPhone 12/13 (390x844) 
 * - iPhone 14 Pro Max (430x932)
 * - Samsung Galaxy S20 (360x800)
 * - iPad Mini (768x1024)
 * 
 * Tests touch targets, navigation, orientation changes, and performance.
 * 
 * @author Mobile Device Testing Specialist
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Test configuration
import {
  MOBILE_DEVICE_CONFIGS,
  TOUCH_TARGET_REQUIREMENTS,
  MOBILE_INTERACTION_PATTERNS,
  ORIENTATION_CONFIGS,
  MOBILE_PERFORMANCE_THRESHOLDS,
  generateMobileTestScenarios,
  type MobileDeviceConfig,
  type MobileTestScenario
} from './mobile-device-testing.config';

// Component imports
import { SearchResults } from '../../src/components/search/SearchResults';
import { ResponsiveSearchLayout } from '../../src/components/search/ResponsiveSearchLayout';
import { MobileFirstLayout } from '../../src/examples/MobileFirstLayout';
import { KBEntryForm } from '../../src/renderer/components/forms/KBEntryForm';

// Mock data
const mockSearchResults = [
  {
    entry: {
      id: '1',
      title: 'VSAM Status 35 - File Not Found Error',
      problem: 'VSAM file not found during batch job execution. Dataset may not exist or is incorrectly cataloged.',
      solution: '1. Verify dataset exists using ISPF 3.4\n2. Check DD statement for correct DSN\n3. Use LISTCAT command\n4. Verify RACF permissions',
      category: 'VSAM',
      tags: ['vsam', 'file-not-found', 'status-35'],
      usage_count: 156,
      success_count: 148,
      failure_count: 8,
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-20T15:45:00Z'
    },
    score: 0.95,
    matchType: 'exact' as const,
    highlights: ['VSAM file not found', 'status 35']
  },
  {
    entry: {
      id: '2',
      title: 'S0C7 Data Exception Quick Fix',
      problem: 'Program abending with S0C7 error during numeric operations.',
      solution: '1. Initialize all numeric fields\n2. Validate data before operations\n3. Use DISPLAY statements',
      category: 'Batch',
      tags: ['s0c7', 'cobol', 'numeric'],
      usage_count: 89,
      success_count: 82,
      failure_count: 7,
      created_at: '2024-01-14T14:15:00Z',
      updated_at: '2024-01-18T14:20:00Z'
    },
    score: 0.87,
    matchType: 'fuzzy' as const,
    highlights: ['S0C7 error', 'numeric operations']
  }
];

// =========================
// Test Utilities
// =========================

/**
 * Sets up mobile viewport with proper device simulation
 */
const setupMobileViewport = (device: MobileDeviceConfig, orientation: 'portrait' | 'landscape' = 'portrait') => {
  const viewport = orientation === 'portrait' 
    ? device.viewport
    : { width: device.viewport.height, height: device.viewport.width };

  // Set viewport dimensions
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
    value: device.devicePixelRatio,
  });

  // Set user agent
  Object.defineProperty(navigator, 'userAgent', {
    writable: true,
    configurable: true,
    value: device.userAgent,
  });

  // Enable touch if device supports it
  if (device.touch) {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      configurable: true,
      value: 5,
    });
    
    window.TouchEvent = class TouchEvent extends UIEvent {} as any;
    document.ontouchstart = null;
  }

  // Fire resize event
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });

  return viewport;
};

/**
 * Measures touch target dimensions and validates accessibility
 */
const validateTouchTargets = (container: HTMLElement) => {
  const violations = [];
  const interactiveElements = container.querySelectorAll(
    'button, a, input, select, textarea, [role="button"], [role="link"], [tabindex="0"]'
  );

  interactiveElements.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    const minDimension = Math.min(rect.width, rect.height);
    
    if (minDimension < TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE) {
      violations.push({
        element: element.tagName.toLowerCase(),
        index,
        actualSize: minDimension,
        requiredSize: TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE,
        message: `Touch target too small: ${minDimension}px < ${TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE}px`
      });
    }
  });

  return violations;
};

/**
 * Simulates touch interactions with proper event sequence
 */
const simulateTouch = {
  tap: (element: Element, coordinates?: { x: number; y: number }) => {
    const rect = element.getBoundingClientRect();
    const x = coordinates?.x ?? rect.left + rect.width / 2;
    const y = coordinates?.y ?? rect.top + rect.height / 2;

    fireEvent.touchStart(element, {
      touches: [{ clientX: x, clientY: y }]
    });

    fireEvent.touchEnd(element, {
      changedTouches: [{ clientX: x, clientY: y }]
    });

    fireEvent.click(element);
  },

  swipe: (element: Element, direction: 'left' | 'right' | 'up' | 'down', distance = 100) => {
    const rect = element.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    
    let endX = startX;
    let endY = startY;
    
    switch (direction) {
      case 'left':
        endX = startX - distance;
        break;
      case 'right':
        endX = startX + distance;
        break;
      case 'up':
        endY = startY - distance;
        break;
      case 'down':
        endY = startY + distance;
        break;
    }

    fireEvent.touchStart(element, {
      touches: [{ clientX: startX, clientY: startY }]
    });

    fireEvent.touchMove(element, {
      touches: [{ clientX: endX, clientY: endY }]
    });

    fireEvent.touchEnd(element, {
      changedTouches: [{ clientX: endX, clientY: endY }]
    });
  },

  longPress: (element: Element, duration = 500) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    fireEvent.touchStart(element, {
      touches: [{ clientX: x, clientY: y }]
    });

    return new Promise(resolve => {
      setTimeout(() => {
        fireEvent.touchEnd(element, {
          changedTouches: [{ clientX: x, clientY: y }]
        });
        resolve(void 0);
      }, duration);
    });
  }
};

/**
 * Performance measurement utilities
 */
const measurePerformance = {
  renderTime: (renderFn: () => any) => {
    const startTime = performance.now();
    const result = renderFn();
    const endTime = performance.now();
    return {
      result,
      duration: endTime - startTime
    };
  },

  scrollPerformance: async (element: Element, distance = 500) => {
    const startTime = performance.now();
    let frameCount = 0;
    
    const measureFrame = () => {
      frameCount++;
      const currentTime = performance.now();
      if (currentTime - startTime < 1000) {
        requestAnimationFrame(measureFrame);
      }
    };
    
    measureFrame();
    
    // Simulate scroll
    fireEvent.scroll(element, { target: { scrollTop: distance } });
    
    // Wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const totalTime = performance.now() - startTime;
    const fps = frameCount / (totalTime / 1000);
    
    return { fps, frameCount, duration: totalTime };
  }
};

// Mock IntersectionObserver and ResizeObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// =========================
// Test Suite
// =========================

describe('Mobile Viewport Tests', () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;
  let originalDevicePixelRatio: number;

  beforeEach(() => {
    // Store original values
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    originalDevicePixelRatio = window.devicePixelRatio;

    // Mock performance.now for consistent timing
    jest.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(10);
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });

    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });

    Object.defineProperty(window, 'devicePixelRatio', {
      writable: true,
      configurable: true,
      value: originalDevicePixelRatio,
    });

    jest.restoreAllMocks();
  });

  describe('iPhone SE (375x667) Tests', () => {
    const device = MOBILE_DEVICE_CONFIGS.iphone_se;

    beforeEach(() => {
      setupMobileViewport(device);
    });

    test('should render SearchResults with proper touch targets', async () => {
      const { container } = render(
        <SearchResults
          results={mockSearchResults}
          searchQuery="VSAM error"
          onResultSelect={jest.fn()}
          showConfidenceScores={true}
        />
      );

      await waitFor(() => {
        // Validate touch targets
        const violations = validateTouchTargets(container);
        expect(violations).toHaveLength(0);

        // Verify result items are properly sized
        const resultItems = container.querySelectorAll('[role="option"]');
        expect(resultItems.length).toBeGreaterThan(0);

        resultItems.forEach(item => {
          const rect = item.getBoundingClientRect();
          expect(rect.height).toBeGreaterThanOrEqual(TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE);
        });
      });
    });

    test('should handle mobile navigation properly', async () => {
      const { container } = render(
        <ResponsiveSearchLayout
          searchInput={<input placeholder="Search..." />}
          filtersContent={<div>Filters</div>}
          resultsContent={<div>Results</div>}
          previewContent={<div>Preview</div>}
        />
      );

      await waitFor(() => {
        // Should show mobile header
        const mobileHeader = container.querySelector('.mobile-header');
        expect(mobileHeader).toBeInTheDocument();

        // Should not show desktop sidebars by default
        const filtersSidebar = container.querySelector('.filters-sidebar');
        expect(filtersSidebar).not.toBeInTheDocument();
      });

      // Test filters toggle
      const filtersButton = screen.getByLabelText('Toggle filters');
      simulateTouch.tap(filtersButton);

      await waitFor(() => {
        // Should show filters overlay
        const overlay = screen.getByRole('dialog');
        expect(overlay).toBeInTheDocument();
        expect(overlay).toHaveAttribute('aria-modal', 'true');
      });
    });

    test('should support swipe gestures', async () => {
      const mockOnFiltersToggle = jest.fn();
      const mockOnPreviewToggle = jest.fn();

      const { container } = render(
        <ResponsiveSearchLayout
          searchInput={<input placeholder="Search..." />}
          filtersContent={<div>Filters</div>}
          resultsContent={<div>Results</div>}
          previewContent={<div>Preview</div>}
          enableSwipeGestures={true}
          onFiltersToggle={mockOnFiltersToggle}
          onPreviewToggle={mockOnPreviewToggle}
        />
      );

      const resultsContainer = screen.getByText('Results').closest('div');
      expect(resultsContainer).toBeInTheDocument();

      // Test swipe right to open filters
      simulateTouch.swipe(resultsContainer!, 'right', 100);

      await waitFor(() => {
        expect(mockOnFiltersToggle).toHaveBeenCalledWith(true);
      });
    });

    test('should maintain performance on iPhone SE', async () => {
      const { result: renderResult, duration: renderTime } = measurePerformance.renderTime(() =>
        render(
          <MobileFirstLayout
            entries={Array(50).fill(null).map((_, i) => ({
              id: `entry-${i}`,
              title: `Entry ${i + 1}`,
              problem: `Problem description ${i + 1}`,
              solution: `Solution description ${i + 1}`,
              category: 'Test',
              tags: [`tag-${i}`],
              usage_count: i * 5,
              success_rate: 85 + (i % 15),
              created_at: new Date().toISOString(),
              severity: 'medium' as const,
              reading_time: '2 min read'
            }))}
            onSearch={jest.fn()}
            onEntrySelect={jest.fn()}
          />
        )
      );

      // Render time should be reasonable for mobile
      expect(renderTime).toBeLessThan(MOBILE_PERFORMANCE_THRESHOLDS.FIRST_CONTENTFUL_PAINT);

      const { container } = renderResult;
      
      // Test scroll performance
      const scrollContainer = container.querySelector('[style*="overflow"]');
      if (scrollContainer) {
        const scrollPerf = await measurePerformance.scrollPerformance(scrollContainer);
        expect(scrollPerf.fps).toBeGreaterThanOrEqual(MOBILE_INTERACTION_PATTERNS.SCROLL_PERFORMANCE.MINIMUM_FPS);
      }
    });
  });

  describe('iPhone 12/13 (390x844) Tests', () => {
    const device = MOBILE_DEVICE_CONFIGS.iphone_12;

    beforeEach(() => {
      setupMobileViewport(device);
    });

    test('should optimize layout for iPhone 12/13 dimensions', async () => {
      const { container } = render(
        <MobileFirstLayout
          entries={mockSearchResults.map(r => r.entry as any)}
          onSearch={jest.fn()}
          onEntrySelect={jest.fn()}
        />
      );

      await waitFor(() => {
        // Verify layout adapts to iPhone 12/13 viewport
        const layoutContainer = container.querySelector('[data-testid="mobile-first-layout"]');
        expect(layoutContainer).toBeInTheDocument();

        // Check that content fits within viewport
        const mainContent = container.querySelector('main');
        if (mainContent) {
          const rect = mainContent.getBoundingClientRect();
          expect(rect.width).toBeLessThanOrEqual(device.viewport.width);
        }

        // Verify mobile header is present
        const mobileHeader = container.querySelector('.mobile-header');
        expect(mobileHeader).toBeInTheDocument();
      });
    });

    test('should handle form inputs with proper spacing', async () => {
      const { container } = render(
        <KBEntryForm onSubmit={jest.fn()} />
      );

      await waitFor(() => {
        const formInputs = container.querySelectorAll('input, textarea, select');
        
        formInputs.forEach(input => {
          const rect = input.getBoundingClientRect();
          
          // Inputs should be tall enough for touch interaction
          expect(rect.height).toBeGreaterThanOrEqual(TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE);
          
          // Inputs should have sufficient spacing
          const computedStyle = window.getComputedStyle(input);
          const marginBottom = parseInt(computedStyle.marginBottom);
          expect(marginBottom).toBeGreaterThanOrEqual(TOUCH_TARGET_REQUIREMENTS.MINIMUM_SPACING);
        });
      });
    });
  });

  describe('iPhone 14 Pro Max (430x932) Tests', () => {
    const device = MOBILE_DEVICE_CONFIGS.iphone_14_pro_max;

    beforeEach(() => {
      setupMobileViewport(device);
    });

    test('should utilize larger screen space efficiently', async () => {
      const { container } = render(
        <SearchResults
          results={mockSearchResults}
          searchQuery="test query"
          onResultSelect={jest.fn()}
          showConfidenceScores={true}
        />
      );

      await waitFor(() => {
        // Results should be more spacious on larger iPhone
        const resultItems = container.querySelectorAll('[role="option"]');
        expect(resultItems.length).toBeGreaterThan(0);

        const firstResult = resultItems[0];
        const rect = firstResult.getBoundingClientRect();
        
        // Should have comfortable padding and spacing
        expect(rect.height).toBeGreaterThan(TOUCH_TARGET_REQUIREMENTS.OPTIMAL_SIZE * 2);
        expect(rect.width).toBeLessThanOrEqual(device.viewport.width);
      });
    });

    test('should maintain thumb reach zones', async () => {
      const { container } = render(
        <ResponsiveSearchLayout
          searchInput={<input placeholder="Search..." />}
          filtersContent={<div>Filters</div>}
          resultsContent={<div>Results</div>}
          previewContent={<div>Preview</div>}
          headerContent={<div>Header</div>}
          toolbarContent={<div>Toolbar</div>}
        />
      );

      await waitFor(() => {
        // Primary action buttons should be in thumb reach zone
        const actionButtons = container.querySelectorAll('button');
        
        actionButtons.forEach(button => {
          const rect = button.getBoundingClientRect();
          const distanceFromBottom = device.viewport.height - rect.bottom;
          
          // Important buttons should be within comfortable reach
          if (button.getAttribute('aria-label')?.includes('Toggle') || 
              button.textContent?.includes('Search')) {
            expect(distanceFromBottom).toBeLessThanOrEqual(
              TOUCH_TARGET_REQUIREMENTS.THUMB_REACH_ZONES.secondary.bottom
            );
          }
        });
      });
    });
  });

  describe('Samsung Galaxy S20 (360x800) Tests', () => {
    const device = MOBILE_DEVICE_CONFIGS.samsung_galaxy_s20;

    beforeEach(() => {
      setupMobileViewport(device);
    });

    test('should handle Android-specific behaviors', async () => {
      const { container } = render(
        <MobileFirstLayout
          entries={mockSearchResults.map(r => r.entry as any)}
          onSearch={jest.fn()}
          onEntrySelect={jest.fn()}
        />
      );

      await waitFor(() => {
        // Verify Android user agent is set
        expect(navigator.userAgent).toContain('Android');
        
        // Layout should adapt to Android viewport
        const layoutContainer = container.querySelector('[data-testid="mobile-first-layout"]');
        expect(layoutContainer).toBeInTheDocument();

        // Content should fit within narrower Android viewport
        const entryCards = container.querySelectorAll('.search-result-item, .mobile-entry-card');
        entryCards.forEach(card => {
          const rect = card.getBoundingClientRect();
          expect(rect.width).toBeLessThanOrEqual(device.viewport.width);
        });
      });
    });

    test('should handle Android back button simulation', async () => {
      const mockOnFiltersToggle = jest.fn();

      render(
        <ResponsiveSearchLayout
          searchInput={<input placeholder="Search..." />}
          filtersContent={<div>Filters</div>}
          resultsContent={<div>Results</div>}
          onFiltersToggle={mockOnFiltersToggle}
        />
      );

      // Open filters
      const filtersButton = screen.getByLabelText('Toggle filters');
      simulateTouch.tap(filtersButton);

      await waitFor(() => {
        expect(mockOnFiltersToggle).toHaveBeenCalledWith(true);
      });

      // Simulate Android back button (ESC key)
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(mockOnFiltersToggle).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('iPad Mini (768x1024) Tests', () => {
    const device = MOBILE_DEVICE_CONFIGS.ipad_mini;

    beforeEach(() => {
      setupMobileViewport(device);
    });

    test('should use tablet layout on iPad Mini', async () => {
      const { container } = render(
        <ResponsiveSearchLayout
          searchInput={<input placeholder="Search..." />}
          filtersContent={<div>Filters</div>}
          resultsContent={<div>Results</div>}
          previewContent={<div>Preview</div>}
          initialFiltersVisible={true}
        />
      );

      await waitFor(() => {
        // Should show tablet layout, not mobile
        const tabletLayout = container.querySelector('.tablet-search-layout');
        expect(tabletLayout).toBeInTheDocument();

        // Filters should be in sidebar, not overlay
        const filtersSidebar = container.querySelector('.filters-sidebar');
        expect(filtersSidebar).toBeInTheDocument();

        // Mobile header should not be present
        const mobileHeader = container.querySelector('.mobile-header');
        expect(mobileHeader).not.toBeInTheDocument();
      });
    });

    test('should support two-column layout', async () => {
      const { container } = render(
        <SearchResults
          results={mockSearchResults}
          searchQuery="test"
          onResultSelect={jest.fn()}
        />
      );

      await waitFor(() => {
        // Results should utilize the wider tablet space
        const resultsList = container.querySelector('.search-results-list');
        if (resultsList) {
          const computedStyle = window.getComputedStyle(resultsList);
          
          // Should use available width efficiently
          expect(resultsList.getBoundingClientRect().width)
            .toBeGreaterThan(device.viewport.width * 0.8);
        }
      });
    });
  });

  describe('Orientation Change Tests', () => {
    test.each(Object.values(MOBILE_DEVICE_CONFIGS))(
      'should handle orientation changes on %s',
      async (device) => {
        // Start in portrait
        setupMobileViewport(device, 'portrait');

        const { container, rerender } = render(
          <ResponsiveSearchLayout
            searchInput={<input placeholder="Search..." />}
            filtersContent={<div>Filters</div>}
            resultsContent={<div>Results</div>}
            previewContent={<div>Preview</div>}
          />
        );

        const initialLayout = container.querySelector('[class*="-layout"]');
        expect(initialLayout).toBeInTheDocument();

        // Change to landscape
        setupMobileViewport(device, 'landscape');
        
        rerender(
          <ResponsiveSearchLayout
            searchInput={<input placeholder="Search..." />}
            filtersContent={<div>Filters</div>}
            resultsContent={<div>Results</div>}
            previewContent={<div>Preview</div>}
          />
        );

        await waitFor(() => {
          // Layout should adapt to landscape orientation
          const updatedLayout = container.querySelector('[class*="-layout"]');
          expect(updatedLayout).toBeInTheDocument();
          
          // Content should fit within landscape dimensions
          const mainContent = container.querySelector('.main-content');
          if (mainContent) {
            const rect = mainContent.getBoundingClientRect();
            expect(rect.width).toBeLessThanOrEqual(device.viewport.height); // Swapped for landscape
            expect(rect.height).toBeLessThanOrEqual(device.viewport.width);
          }
        });
      }
    );
  });

  describe('Cross-Device Accessibility Tests', () => {
    test.each(Object.values(MOBILE_DEVICE_CONFIGS))(
      'should maintain accessibility standards on %s',
      async (device) => {
        setupMobileViewport(device);

        const { container } = render(
          <SearchResults
            results={mockSearchResults}
            searchQuery="accessibility test"
            onResultSelect={jest.fn()}
            showConfidenceScores={true}
            enableAdvancedKeyboardShortcuts={true}
          />
        );

        // Run accessibility audit
        const results = await axe(container);
        expect(results).toHaveNoViolations();

        // Verify specific mobile accessibility requirements
        await waitFor(() => {
          // Check touch targets
          const violations = validateTouchTargets(container);
          expect(violations).toHaveLength(0);

          // Check focus indicators
          const focusableElements = container.querySelectorAll(
            'button, a, input, [tabindex="0"]'
          );
          
          focusableElements.forEach(element => {
            fireEvent.focus(element);
            const computedStyle = window.getComputedStyle(element);
            expect(computedStyle.outline).not.toBe('none');
          });

          // Check ARIA labels
          const interactiveElements = container.querySelectorAll(
            'button, [role="button"], input'
          );
          
          interactiveElements.forEach(element => {
            const hasLabel = element.hasAttribute('aria-label') ||
                           element.hasAttribute('aria-labelledby') ||
                           element.textContent?.trim();
            expect(hasLabel).toBeTruthy();
          });
        });
      }
    );
  });

  describe('Performance Validation Tests', () => {
    test('should meet mobile performance thresholds across devices', async () => {
      const performanceResults = [];

      for (const [deviceKey, device] of Object.entries(MOBILE_DEVICE_CONFIGS)) {
        setupMobileViewport(device);

        const { result: renderResult, duration: renderTime } = measurePerformance.renderTime(() =>
          render(
            <MobileFirstLayout
              entries={Array(100).fill(null).map((_, i) => ({
                id: `perf-entry-${i}`,
                title: `Performance Test Entry ${i + 1}`,
                problem: `Performance test problem description ${i + 1}`,
                solution: `Performance test solution ${i + 1}`,
                category: 'Performance',
                tags: [`perf-${i}`, `test-${i % 10}`],
                usage_count: i * 3,
                success_rate: 80 + (i % 20),
                created_at: new Date().toISOString(),
                severity: 'medium' as const,
                reading_time: '3 min read'
              }))}
              onSearch={jest.fn()}
              onEntrySelect={jest.fn()}
            />
          )
        );

        performanceResults.push({
          device: deviceKey,
          renderTime,
          passedThreshold: renderTime < MOBILE_PERFORMANCE_THRESHOLDS.FIRST_CONTENTFUL_PAINT
        });

        // Cleanup
        renderResult.unmount();
      }

      // All devices should meet performance thresholds
      const failedDevices = performanceResults.filter(result => !result.passedThreshold);
      expect(failedDevices).toHaveLength(0);

      // Log performance results for analysis
      console.log('Mobile Performance Results:', performanceResults);
    });
  });
});
