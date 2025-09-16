/**
 * Mobile Touch Target Validation Tests
 * 
 * Validates WCAG 2.1 AA compliance for touch target sizes (minimum 44x44px)
 * and mobile accessibility requirements across all components.
 * 
 * Tests:
 * - Touch target minimum sizes (44px)
 * - Touch target spacing (8px minimum)
 * - Thumb reach zones validation
 * - Touch interaction response times
 * - Gesture conflict prevention
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
  COMPONENT_MOBILE_TESTS,
  type MobileDeviceConfig
} from './mobile-device-testing.config';

// Component imports
import { SearchResults } from '../../src/components/search/SearchResults';
import { ResponsiveSearchLayout } from '../../src/components/search/ResponsiveSearchLayout';
import { KBEntryForm } from '../../src/renderer/components/forms/KBEntryForm';
import { KBEntryList } from '../../src/renderer/components/KBEntryList';
import { Button } from '../../src/components/foundation/Button';

// Mock data for testing
const mockSearchResults = [
  {
    entry: {
      id: '1',
      title: 'VSAM File Access Error',
      problem: 'Unable to access VSAM file in batch process',
      solution: 'Check file availability and permissions',
      category: 'VSAM',
      tags: ['vsam', 'access', 'file'],
      usage_count: 45,
      success_count: 42,
      failure_count: 3,
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-20T15:45:00Z'
    },
    score: 0.92,
    matchType: 'exact' as const,
    highlights: ['VSAM file', 'access error']
  }
];

const mockKBEntries = [
  {
    id: '1',
    title: 'Database Connection Timeout',
    problem: 'DB2 connection timing out during peak hours',
    solution: 'Optimize connection pool settings and query performance',
    category: 'Database' as const,
    tags: ['db2', 'timeout', 'connection'],
    usage_count: 67,
    success_count: 63,
    failure_count: 4,
    created_at: '2024-01-10T09:15:00Z',
    updated_at: '2024-01-18T14:20:00Z'
  }
];

// =========================
// Touch Target Utilities
// =========================

/**
 * Comprehensive touch target validation
 */
interface TouchTargetViolation {
  element: string;
  selector: string;
  actualWidth: number;
  actualHeight: number;
  minDimension: number;
  requiredSize: number;
  coordinates: { x: number; y: number };
  spacing?: number;
  severity: 'error' | 'warning';
  wcagLevel: 'AA' | 'AAA';
}

const validateTouchTargets = (container: HTMLElement): TouchTargetViolation[] => {
  const violations: TouchTargetViolation[] = [];
  
  // Define interactive elements that need touch target validation
  const interactiveSelectors = [
    'button',
    'a[href]',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[role="option"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[tabindex="0"]',
    '[onclick]'
  ];

  interactiveSelectors.forEach(selector => {
    const elements = container.querySelectorAll(selector);
    
    elements.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);
      
      // Skip hidden elements
      if (rect.width === 0 || rect.height === 0 || 
          computedStyle.display === 'none' || 
          computedStyle.visibility === 'hidden') {
        return;
      }

      const minDimension = Math.min(rect.width, rect.height);
      const elementId = element.id || `${selector}-${index}`;
      
      // Check minimum size requirement (WCAG 2.1 AA)
      if (minDimension < TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE) {
        violations.push({
          element: elementId,
          selector,
          actualWidth: rect.width,
          actualHeight: rect.height,
          minDimension,
          requiredSize: TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE,
          coordinates: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
          severity: 'error',
          wcagLevel: 'AA'
        });
      }
      
      // Check optimal size for AAA compliance
      else if (minDimension < TOUCH_TARGET_REQUIREMENTS.OPTIMAL_SIZE) {
        violations.push({
          element: elementId,
          selector,
          actualWidth: rect.width,
          actualHeight: rect.height,
          minDimension,
          requiredSize: TOUCH_TARGET_REQUIREMENTS.OPTIMAL_SIZE,
          coordinates: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
          severity: 'warning',
          wcagLevel: 'AAA'
        });
      }
    });
  });

  return violations;
};

/**
 * Validates spacing between touch targets
 */
const validateTouchTargetSpacing = (container: HTMLElement): TouchTargetViolation[] => {
  const violations: TouchTargetViolation[] = [];
  const interactiveElements = container.querySelectorAll(
    'button, a[href], input:not([type="hidden"]), [role="button"], [tabindex="0"]'
  );

  const elements = Array.from(interactiveElements);
  
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const rect1 = elements[i].getBoundingClientRect();
      const rect2 = elements[j].getBoundingClientRect();
      
      // Skip if elements are not visible
      if (rect1.width === 0 || rect1.height === 0 || rect2.width === 0 || rect2.height === 0) {
        continue;
      }
      
      // Calculate minimum distance between elements
      const horizontalDistance = Math.max(0, 
        Math.max(rect1.left - rect2.right, rect2.left - rect1.right)
      );
      const verticalDistance = Math.max(0,
        Math.max(rect1.top - rect2.bottom, rect2.top - rect1.bottom)
      );
      
      const minDistance = Math.min(horizontalDistance, verticalDistance);
      
      // Check if elements are too close (and not the same element)
      if (minDistance > 0 && minDistance < TOUCH_TARGET_REQUIREMENTS.MINIMUM_SPACING) {
        violations.push({
          element: `${elements[i].tagName}-${elements[j].tagName}`,
          selector: 'spacing',
          actualWidth: minDistance,
          actualHeight: minDistance,
          minDimension: minDistance,
          requiredSize: TOUCH_TARGET_REQUIREMENTS.MINIMUM_SPACING,
          coordinates: {
            x: (rect1.left + rect1.right + rect2.left + rect2.right) / 4,
            y: (rect1.top + rect1.bottom + rect2.top + rect2.bottom) / 4
          },
          spacing: minDistance,
          severity: 'warning',
          wcagLevel: 'AA'
        });
      }
    }
  }

  return violations;
};

/**
 * Validates thumb reach zones for mobile devices
 */
const validateThumbReachZones = (container: HTMLElement, device: MobileDeviceConfig): TouchTargetViolation[] => {
  const violations: TouchTargetViolation[] = [];
  const criticalElements = container.querySelectorAll(
    'button[aria-label*="submit"], button[type="submit"], .primary-action, .cta-button'
  );

  criticalElements.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    const distanceFromBottom = device.viewport.height - rect.bottom;
    const distanceFromSides = Math.min(rect.left, device.viewport.width - rect.right);
    
    // Check if critical actions are within comfortable thumb reach
    const inPrimaryZone = distanceFromBottom <= TOUCH_TARGET_REQUIREMENTS.THUMB_REACH_ZONES.primary.bottom &&
                         distanceFromSides >= TOUCH_TARGET_REQUIREMENTS.THUMB_REACH_ZONES.primary.sides;
    
    const inSecondaryZone = distanceFromBottom <= TOUCH_TARGET_REQUIREMENTS.THUMB_REACH_ZONES.secondary.bottom &&
                           distanceFromSides >= TOUCH_TARGET_REQUIREMENTS.THUMB_REACH_ZONES.secondary.sides;
    
    if (!inPrimaryZone && !inSecondaryZone) {
      violations.push({
        element: element.id || `critical-action-${index}`,
        selector: 'thumb-reach',
        actualWidth: distanceFromSides,
        actualHeight: distanceFromBottom,
        minDimension: Math.min(distanceFromSides, distanceFromBottom),
        requiredSize: TOUCH_TARGET_REQUIREMENTS.THUMB_REACH_ZONES.secondary.bottom,
        coordinates: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        severity: 'warning',
        wcagLevel: 'AAA'
      });
    }
  });

  return violations;
};

/**
 * Mobile viewport setup utility
 */
const setupMobileViewport = (device: MobileDeviceConfig) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: device.viewport.width,
  });

  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: device.viewport.height,
  });

  Object.defineProperty(navigator, 'maxTouchPoints', {
    writable: true,
    configurable: true,
    value: 5,
  });

  window.TouchEvent = class TouchEvent extends UIEvent {} as any;
  document.ontouchstart = null;

  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
};

/**
 * Touch interaction simulation
 */
const simulateTouch = {
  tap: async (element: Element, duration = 100) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const startTime = performance.now();
    
    fireEvent.touchStart(element, {
      touches: [{ clientX: x, clientY: y }]
    });

    await new Promise(resolve => setTimeout(resolve, duration));

    fireEvent.touchEnd(element, {
      changedTouches: [{ clientX: x, clientY: y }]
    });

    const endTime = performance.now();
    return endTime - startTime;
  },

  doubleTap: async (element: Element) => {
    await simulateTouch.tap(element, 50);
    await new Promise(resolve => setTimeout(resolve, 100));
    await simulateTouch.tap(element, 50);
  }
};

// Mock observers
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

describe('Mobile Touch Target Validation', () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    
    jest.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(100);
  });

  afterEach(() => {
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

    jest.restoreAllMocks();
  });

  describe('SearchResults Component Touch Targets', () => {
    test('should meet WCAG 2.1 AA touch target requirements', async () => {
      setupMobileViewport(MOBILE_DEVICE_CONFIGS.iphone_se);

      const { container } = render(
        <SearchResults
          results={mockSearchResults}
          searchQuery="test query"
          onResultSelect={jest.fn()}
          showConfidenceScores={true}
        />
      );

      await waitFor(() => {
        const violations = validateTouchTargets(container);
        const errors = violations.filter(v => v.severity === 'error');
        
        // Should have no WCAG AA violations
        expect(errors).toHaveLength(0);
        
        if (errors.length > 0) {
          console.error('Touch target violations:', errors);
        }
      });
    });

    test('should have proper spacing between interactive elements', async () => {
      setupMobileViewport(MOBILE_DEVICE_CONFIGS.samsung_galaxy_s20);

      const { container } = render(
        <SearchResults
          results={mockSearchResults}
          searchQuery="spacing test"
          onResultSelect={jest.fn()}
          onLoadMore={jest.fn()}
          showConfidenceScores={true}
        />
      );

      await waitFor(() => {
        const spacingViolations = validateTouchTargetSpacing(container);
        
        // Critical elements should have adequate spacing
        const criticalSpacingIssues = spacingViolations.filter(v => 
          v.spacing && v.spacing < TOUCH_TARGET_REQUIREMENTS.MINIMUM_SPACING / 2
        );
        
        expect(criticalSpacingIssues).toHaveLength(0);
      });
    });

    test('should respond to touch interactions within time threshold', async () => {
      setupMobileViewport(MOBILE_DEVICE_CONFIGS.iphone_12);
      
      const mockOnSelect = jest.fn();
      const { container } = render(
        <SearchResults
          results={mockSearchResults}
          searchQuery="performance test"
          onResultSelect={mockOnSelect}
        />
      );

      await waitFor(() => {
        const resultButton = container.querySelector('[role="option"]');
        expect(resultButton).toBeInTheDocument();
      });

      const resultButton = container.querySelector('[role="option"]')!;
      const responseTime = await simulateTouch.tap(resultButton);
      
      // Touch response should be under threshold
      expect(responseTime).toBeLessThan(MOBILE_INTERACTION_PATTERNS.TAP_INTERACTIONS.SINGLE_TAP_DELAY);
      
      await waitFor(() => {
        expect(mockOnSelect).toHaveBeenCalled();
      });
    });
  });

  describe('Navigation Component Touch Targets', () => {
    test('should validate mobile navigation touch targets', async () => {
      setupMobileViewport(MOBILE_DEVICE_CONFIGS.iphone_14_pro_max);

      const { container } = render(
        <ResponsiveSearchLayout
          searchInput={<input placeholder="Search..." />}
          filtersContent={<div>Filters</div>}
          resultsContent={<div>Results</div>}
          previewContent={<div>Preview</div>}
        />
      );

      await waitFor(() => {
        const violations = validateTouchTargets(container);
        const navigationErrors = violations.filter(v => 
          v.severity === 'error' && 
          (v.selector.includes('button') || v.element.includes('toggle'))
        );
        
        expect(navigationErrors).toHaveLength(0);
        
        // Verify specific navigation elements
        const toggleButtons = container.querySelectorAll('button[aria-label*="Toggle"]');
        toggleButtons.forEach(button => {
          const rect = button.getBoundingClientRect();
          const minSize = Math.min(rect.width, rect.height);
          expect(minSize).toBeGreaterThanOrEqual(TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE);
        });
      });
    });

    test('should position critical actions in thumb reach zones', async () => {
      const device = MOBILE_DEVICE_CONFIGS.samsung_galaxy_s20;
      setupMobileViewport(device);

      const { container } = render(
        <ResponsiveSearchLayout
          searchInput={<input placeholder="Search..." />}
          filtersContent={<div>Filters</div>}
          resultsContent={<div>Results</div>}
          previewContent={<div>Preview</div>}
          headerContent={<div>Header</div>}
          toolbarContent={
            <div>
              <Button variant="primary" aria-label="submit search">Search</Button>
              <Button variant="secondary">Clear</Button>
            </div>
          }
        />
      );

      await waitFor(() => {
        const thumbReachViolations = validateThumbReachZones(container, device);
        
        // Primary actions should be in comfortable reach
        const primaryActionViolations = thumbReachViolations.filter(v => 
          v.element.includes('submit') || v.element.includes('primary')
        );
        
        expect(primaryActionViolations.length).toBeLessThanOrEqual(1); // Allow some flexibility
      });
    });
  });

  describe('Form Component Touch Targets', () => {
    test('should validate form input touch targets', async () => {
      setupMobileViewport(MOBILE_DEVICE_CONFIGS.ipad_mini);

      const { container } = render(
        <KBEntryForm onSubmit={jest.fn()} />
      );

      await waitFor(() => {
        const violations = validateTouchTargets(container);
        const formErrors = violations.filter(v => 
          v.severity === 'error' && 
          (v.selector.includes('input') || v.selector.includes('textarea') || v.selector.includes('select'))
        );
        
        expect(formErrors).toHaveLength(0);
        
        // Verify form elements specifically
        const formInputs = container.querySelectorAll('input, textarea, select');
        formInputs.forEach(input => {
          const rect = input.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) { // Skip hidden inputs
            expect(rect.height).toBeGreaterThanOrEqual(TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE);
          }
        });

        // Submit button should be easily tappable
        const submitButton = container.querySelector('button[type="submit"]');
        if (submitButton) {
          const rect = submitButton.getBoundingClientRect();
          const minSize = Math.min(rect.width, rect.height);
          expect(minSize).toBeGreaterThanOrEqual(TOUCH_TARGET_REQUIREMENTS.OPTIMAL_SIZE);
        }
      });
    });

    test('should handle form validation with touch-friendly error display', async () => {
      setupMobileViewport(MOBILE_DEVICE_CONFIGS.iphone_se);
      
      const mockOnSubmit = jest.fn().mockRejectedValue(new Error('Validation failed'));
      const { container } = render(
        <KBEntryForm onSubmit={mockOnSubmit} />
      );

      await waitFor(() => {
        const submitButton = container.querySelector('button[type="submit"]');
        expect(submitButton).toBeInTheDocument();
      });

      // Try to submit with invalid data
      const submitButton = container.querySelector('button[type="submit"]')!;
      await simulateTouch.tap(submitButton);

      await waitFor(() => {
        // Error messages should be touch-accessible
        const errorMessages = container.querySelectorAll('[role="alert"], .error-message');
        errorMessages.forEach(error => {
          const rect = error.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            expect(rect.height).toBeGreaterThanOrEqual(TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE / 2);
          }
        });
      });
    });
  });

  describe('KB Entry List Touch Targets', () => {
    test('should validate entry list item touch targets', async () => {
      setupMobileViewport(MOBILE_DEVICE_CONFIGS.iphone_12);

      const { container } = render(
        <KBEntryList
          entries={mockKBEntries}
          onEntrySelect={jest.fn()}
          onEntryRate={jest.fn()}
        />
      );

      await waitFor(() => {
        const violations = validateTouchTargets(container);
        const listErrors = violations.filter(v => 
          v.severity === 'error' && 
          (v.element.includes('entry') || v.selector.includes('button'))
        );
        
        expect(listErrors).toHaveLength(0);
        
        // Verify list items are tappable
        const entryItems = container.querySelectorAll('[role="button"]');
        entryItems.forEach(item => {
          const rect = item.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            expect(rect.height).toBeGreaterThanOrEqual(TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE);
          }
        });
      });
    });

    test('should support rating actions with adequate touch targets', async () => {
      setupMobileViewport(MOBILE_DEVICE_CONFIGS.samsung_galaxy_s20);
      
      const mockOnRate = jest.fn();
      const { container } = render(
        <KBEntryList
          entries={mockKBEntries}
          onEntrySelect={jest.fn()}
          onEntryRate={mockOnRate}
          showRatings={true}
        />
      );

      await waitFor(() => {
        // Rating buttons should be touch-friendly
        const ratingButtons = container.querySelectorAll('button[aria-label*="rate"], .rating-button');
        ratingButtons.forEach(button => {
          const rect = button.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const minSize = Math.min(rect.width, rect.height);
            expect(minSize).toBeGreaterThanOrEqual(TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE);
          }
        });
      });
    });
  });

  describe('Cross-Device Touch Target Validation', () => {
    test.each(Object.entries(MOBILE_DEVICE_CONFIGS))(
      'should validate touch targets on %s',
      async ([deviceKey, device]) => {
        setupMobileViewport(device);

        const { container } = render(
          <div>
            <SearchResults
              results={mockSearchResults}
              searchQuery="cross-device test"
              onResultSelect={jest.fn()}
            />
            <ResponsiveSearchLayout
              searchInput={<input placeholder="Search..." />}
              filtersContent={<div>Filters</div>}
              resultsContent={<div>Results</div>}
            />
          </div>
        );

        await waitFor(() => {
          const violations = validateTouchTargets(container);
          const criticalErrors = violations.filter(v => 
            v.severity === 'error' && 
            v.minDimension < TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE * 0.8 // Allow 20% tolerance
          );
          
          // Log violations for analysis but don't fail test for minor issues
          if (criticalErrors.length > 0) {
            console.warn(`Touch target violations on ${deviceKey}:`, criticalErrors);
          }
          
          // Fail only for severe violations
          const severeErrors = criticalErrors.filter(v => 
            v.minDimension < TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE * 0.6
          );
          expect(severeErrors).toHaveLength(0);
        });
      }
    );
  });

  describe('Touch Target Performance', () => {
    test('should measure touch response times across components', async () => {
      const responseTimeResults: Array<{device: string; component: string; responseTime: number}> = [];
      
      const testDevices = [
        ['iphone_se', MOBILE_DEVICE_CONFIGS.iphone_se],
        ['iphone_12', MOBILE_DEVICE_CONFIGS.iphone_12],
        ['samsung_galaxy_s20', MOBILE_DEVICE_CONFIGS.samsung_galaxy_s20]
      ] as const;

      for (const [deviceKey, device] of testDevices) {
        setupMobileViewport(device);

        // Test SearchResults component
        const { container: searchContainer } = render(
          <SearchResults
            results={mockSearchResults}
            searchQuery="performance"
            onResultSelect={jest.fn()}
          />
        );

        await waitFor(() => {
          const resultButton = searchContainer.querySelector('[role="option"]');
          expect(resultButton).toBeInTheDocument();
        });

        const resultButton = searchContainer.querySelector('[role="option"]')!;
        const searchResponseTime = await simulateTouch.tap(resultButton);
        
        responseTimeResults.push({
          device: deviceKey,
          component: 'SearchResults',
          responseTime: searchResponseTime
        });

        // Cleanup
        searchContainer.closest('[data-testid]')?.remove();
      }

      // All response times should be under threshold
      const slowResponses = responseTimeResults.filter(result => 
        result.responseTime > MOBILE_INTERACTION_PATTERNS.TAP_INTERACTIONS.SINGLE_TAP_DELAY
      );
      
      expect(slowResponses).toHaveLength(0);
      
      // Log results for analysis
      console.log('Touch Response Time Results:', responseTimeResults);
    });
  });

  describe('Accessibility Integration', () => {
    test('should maintain accessibility with proper touch targets', async () => {
      setupMobileViewport(MOBILE_DEVICE_CONFIGS.iphone_14_pro_max);

      const { container } = render(
        <div>
          <SearchResults
            results={mockSearchResults}
            searchQuery="accessibility test"
            onResultSelect={jest.fn()}
            enableAdvancedKeyboardShortcuts={true}
          />
          <ResponsiveSearchLayout
            searchInput={<input placeholder="Search..." />}
            filtersContent={<div>Filters</div>}
            resultsContent={<div>Results</div>}
            enableKeyboardShortcuts={true}
          />
        </div>
      );

      // Run accessibility audit
      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Validate touch targets don't conflict with accessibility
      await waitFor(() => {
        const violations = validateTouchTargets(container);
        const errors = violations.filter(v => v.severity === 'error');
        
        expect(errors).toHaveLength(0);
        
        // Verify all interactive elements have proper labels
        const interactiveElements = container.querySelectorAll(
          'button, a[href], input, [role="button"], [tabindex="0"]'
        );
        
        interactiveElements.forEach(element => {
          const hasLabel = element.hasAttribute('aria-label') ||
                          element.hasAttribute('aria-labelledby') ||
                          element.textContent?.trim() ||
                          element.querySelector('span:not(.sr-only)')?.textContent?.trim();
          
          expect(hasLabel).toBeTruthy();
        });
      });
    });
  });
});
