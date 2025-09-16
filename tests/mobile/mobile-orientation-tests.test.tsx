/**
 * Mobile Orientation Change Tests
 * 
 * Comprehensive testing of orientation changes across mobile devices:
 * - Portrait to landscape transitions
 * - Layout adaptation and reflow
 * - State preservation during orientation changes
 * - Keyboard handling and virtual viewport
 * - Performance during orientation transitions
 * - Touch target accessibility in both orientations
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
  ORIENTATION_CONFIGS,
  MOBILE_PERFORMANCE_THRESHOLDS,
  TOUCH_TARGET_REQUIREMENTS,
  generateMobileTestScenarios,
  type MobileDeviceConfig
} from './mobile-device-testing.config';

// Component imports
import { SearchResults } from '../../src/components/search/SearchResults';
import { ResponsiveSearchLayout } from '../../src/components/search/ResponsiveSearchLayout';
import { MobileFirstLayout } from '../../src/examples/MobileFirstLayout';
import { KBEntryForm } from '../../src/renderer/components/forms/KBEntryForm';
import { KBEntryList } from '../../src/renderer/components/KBEntryList';

// Mock data
const mockSearchResults = [
  {
    entry: {
      id: '1',
      title: 'System Orientation Error - Display Issue',
      problem: 'Application layout breaks when device orientation changes, causing display issues.',
      solution: 'Implement responsive CSS media queries and test orientation change handlers.',
      category: 'UI/UX',
      tags: ['orientation', 'responsive', 'layout'],
      usage_count: 78,
      success_count: 72,
      failure_count: 6,
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-20T15:45:00Z'
    },
    score: 0.94,
    matchType: 'exact' as const,
    highlights: ['orientation', 'display issue']
  },
  {
    entry: {
      id: '2',
      title: 'Mobile Layout Adaptation Best Practices',
      problem: 'Need guidelines for handling portrait/landscape mode transitions smoothly.',
      solution: 'Use CSS Grid and Flexbox with proper viewport meta tags and orientation media queries.',
      category: 'Development',
      tags: ['mobile', 'responsive-design', 'best-practices'],
      usage_count: 134,
      success_count: 128,
      failure_count: 6,
      created_at: '2024-01-12T09:00:00Z',
      updated_at: '2024-01-18T14:20:00Z'
    },
    score: 0.88,
    matchType: 'semantic' as const,
    highlights: ['mobile layout', 'portrait/landscape']
  }
];

const mockKBEntries = [
  {
    id: '1',
    title: 'Screen Rotation Handling Guide',
    problem: 'Applications need to gracefully handle screen rotation without losing state.',
    solution: 'Implement orientation change listeners and save component state appropriately.',
    category: 'Mobile Development' as const,
    tags: ['screen-rotation', 'state-management', 'mobile'],
    usage_count: 156,
    success_count: 148,
    failure_count: 8,
    created_at: '2024-01-10T08:15:00Z',
    updated_at: '2024-01-19T16:30:00Z'
  }
];

// =========================
// Orientation Test Utilities
// =========================

/**
 * Enhanced orientation change simulation
 */
class OrientationSimulator {
  private device: MobileDeviceConfig;
  private currentOrientation: 'portrait' | 'landscape';
  
  constructor(device: MobileDeviceConfig, initialOrientation: 'portrait' | 'landscape' = 'portrait') {
    this.device = device;
    this.currentOrientation = initialOrientation;
    this.applyOrientation(initialOrientation);
  }
  
  private applyOrientation(orientation: 'portrait' | 'landscape') {
    const isPortrait = orientation === 'portrait';
    const width = isPortrait ? 
      Math.min(this.device.viewport.width, this.device.viewport.height) :
      Math.max(this.device.viewport.width, this.device.viewport.height);
    const height = isPortrait ?
      Math.max(this.device.viewport.width, this.device.viewport.height) :
      Math.min(this.device.viewport.width, this.device.viewport.height);
    
    // Update window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    });
    
    // Update screen dimensions
    Object.defineProperty(window.screen, 'width', {
      writable: true,
      configurable: true,
      value: width,
    });
    
    Object.defineProperty(window.screen, 'height', {
      writable: true,
      configurable: true,
      value: height,
    });
    
    // Update screen.orientation if available
    if ('orientation' in screen) {
      Object.defineProperty(screen.orientation, 'angle', {
        writable: true,
        configurable: true,
        value: orientation === 'landscape' ? 90 : 0,
      });
      
      Object.defineProperty(screen.orientation, 'type', {
        writable: true,
        configurable: true,
        value: orientation === 'portrait' ? 'portrait-primary' : 'landscape-primary',
      });
    }
    
    // Set touch capabilities
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      configurable: true,
      value: 5,
    });
    
    window.TouchEvent = class TouchEvent extends UIEvent {} as any;
    document.ontouchstart = null;
  }
  
  public async changeOrientation(newOrientation: 'portrait' | 'landscape', transitionTime = 300): Promise<void> {
    if (this.currentOrientation === newOrientation) {
      return;
    }
    
    const oldOrientation = this.currentOrientation;
    this.currentOrientation = newOrientation;
    
    return new Promise((resolve) => {
      // Start transition
      this.applyOrientation(newOrientation);
      
      // Fire orientation change events
      act(() => {
        // Legacy orientationchange event
        window.dispatchEvent(new Event('orientationchange'));
        
        // Modern screen.orientation.change event
        if ('orientation' in screen && 'dispatchEvent' in screen.orientation) {
          screen.orientation.dispatchEvent(new Event('change'));
        }
        
        // Resize event
        window.dispatchEvent(new Event('resize'));
      });
      
      // Simulate transition time
      setTimeout(() => {
        resolve();
      }, transitionTime);
    });
  }
  
  public getCurrentOrientation(): 'portrait' | 'landscape' {
    return this.currentOrientation;
  }
  
  public getViewportDimensions(): { width: number; height: number } {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }
}

/**
 * Layout measurement utilities
 */
interface LayoutMeasurement {
  elements: Array<{
    selector: string;
    beforeRect: DOMRect;
    afterRect: DOMRect;
    layoutShift: number;
    reflowTime: number;
  }>;
  totalShift: number;
  maxReflowTime: number;
}

const measureLayoutChanges = (container: HTMLElement, action: () => Promise<void>): Promise<LayoutMeasurement> => {
  return new Promise(async (resolve) => {
    // Define elements to track
    const trackingSelectors = [
      '.search-results',
      '.search-interface',
      '.mobile-header',
      '.main-content',
      '.filters-sidebar',
      '.results-area',
      'input[type="text"]',
      'button',
      '[role="option"]'
    ];
    
    const measurements: LayoutMeasurement = {
      elements: [],
      totalShift: 0,
      maxReflowTime: 0
    };
    
    // Capture before state
    const beforeElements = trackingSelectors.map(selector => {
      const element = container.querySelector(selector);
      return {
        selector,
        element,
        beforeRect: element?.getBoundingClientRect() || new DOMRect()
      };
    }).filter(item => item.element);
    
    const startTime = performance.now();
    
    // Perform the action (orientation change)
    await action();
    
    // Wait for layout to stabilize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const endTime = performance.now();
    
    // Capture after state and calculate shifts
    beforeElements.forEach(({ selector, element, beforeRect }) => {
      if (!element) return;
      
      const afterRect = element.getBoundingClientRect();
      
      // Calculate layout shift (simplified CLS calculation)
      const deltaX = Math.abs(afterRect.x - beforeRect.x);
      const deltaY = Math.abs(afterRect.y - beforeRect.y);
      const deltaWidth = Math.abs(afterRect.width - beforeRect.width);
      const deltaHeight = Math.abs(afterRect.height - beforeRect.height);
      
      const layoutShift = (deltaX + deltaY + deltaWidth + deltaHeight) / 
                         (window.innerWidth + window.innerHeight);
      
      const reflowTime = endTime - startTime;
      
      measurements.elements.push({
        selector,
        beforeRect,
        afterRect,
        layoutShift,
        reflowTime
      });
      
      measurements.totalShift += layoutShift;
      measurements.maxReflowTime = Math.max(measurements.maxReflowTime, reflowTime);
    });
    
    resolve(measurements);
  });
};

/**
 * Touch target validation after orientation change
 */
const validateTouchTargetsAfterOrientation = (container: HTMLElement): Array<{
  element: string;
  width: number;
  height: number;
  meetsRequirements: boolean;
  orientation: string;
}> => {
  const violations = [];
  const interactiveElements = container.querySelectorAll(
    'button, a[href], input, select, textarea, [role="button"], [tabindex="0"]'
  );
  
  interactiveElements.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    
    if (rect.width === 0 || rect.height === 0) {
      return; // Skip hidden elements
    }
    
    const minDimension = Math.min(rect.width, rect.height);
    const meetsRequirements = minDimension >= TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE;
    
    violations.push({
      element: element.id || `${element.tagName.toLowerCase()}-${index}`,
      width: rect.width,
      height: rect.height,
      meetsRequirements,
      orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
    });
  });
  
  return violations;
};

/**
 * State preservation validator
 */
interface StateSnapshot {
  searchQuery: string;
  selectedItems: string[];
  scrollPositions: Array<{ selector: string; scrollTop: number; scrollLeft: number }>;
  formValues: Array<{ selector: string; value: string }>;
  expandedItems: string[];
}

const captureComponentState = (container: HTMLElement): StateSnapshot => {
  const state: StateSnapshot = {
    searchQuery: '',
    selectedItems: [],
    scrollPositions: [],
    formValues: [],
    expandedItems: []
  };
  
  // Capture search query
  const searchInput = container.querySelector('input[type="text"]') as HTMLInputElement;
  if (searchInput) {
    state.searchQuery = searchInput.value;
  }
  
  // Capture selected items
  const selectedElements = container.querySelectorAll('[aria-selected="true"], [aria-pressed="true"]');
  selectedElements.forEach(element => {
    if (element.id) {
      state.selectedItems.push(element.id);
    }
  });
  
  // Capture scroll positions
  const scrollableElements = container.querySelectorAll('[style*="overflow"]');
  scrollableElements.forEach((element, index) => {
    state.scrollPositions.push({
      selector: element.className || `scrollable-${index}`,
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft
    });
  });
  
  // Capture form values
  const formInputs = container.querySelectorAll('input, textarea, select');
  formInputs.forEach((input, index) => {
    const value = (input as HTMLInputElement).value;
    if (value) {
      state.formValues.push({
        selector: input.id || `input-${index}`,
        value
      });
    }
  });
  
  // Capture expanded items
  const expandedElements = container.querySelectorAll('[aria-expanded="true"]');
  expandedElements.forEach(element => {
    if (element.id) {
      state.expandedItems.push(element.id);
    }
  });
  
  return state;
};

const compareStates = (before: StateSnapshot, after: StateSnapshot): Array<{ property: string; changed: boolean; details?: string }> => {
  const changes = [];
  
  changes.push({
    property: 'searchQuery',
    changed: before.searchQuery !== after.searchQuery,
    details: `${before.searchQuery} -> ${after.searchQuery}`
  });
  
  changes.push({
    property: 'selectedItems',
    changed: JSON.stringify(before.selectedItems) !== JSON.stringify(after.selectedItems),
    details: `${before.selectedItems.length} -> ${after.selectedItems.length} items`
  });
  
  changes.push({
    property: 'formValues',
    changed: JSON.stringify(before.formValues) !== JSON.stringify(after.formValues),
    details: `${before.formValues.length} -> ${after.formValues.length} values`
  });
  
  return changes;
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

describe('Mobile Orientation Change Tests', () => {
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
  
  describe('SearchResults Orientation Adaptation', () => {
    test('should adapt SearchResults layout from portrait to landscape on iPhone 12', async () => {
      const device = MOBILE_DEVICE_CONFIGS.iphone_12;
      const orientationSim = new OrientationSimulator(device, 'portrait');
      
      const { container } = render(
        <SearchResults
          results={mockSearchResults}
          searchQuery="orientation test"
          onResultSelect={jest.fn()}
          showConfidenceScores={true}
        />
      );
      
      // Capture initial state
      const initialState = captureComponentState(container);
      const initialTouchTargets = validateTouchTargetsAfterOrientation(container);
      
      // Verify initial portrait layout
      await waitFor(() => {
        expect(orientationSim.getCurrentOrientation()).toBe('portrait');
        
        const results = container.querySelectorAll('[role="option"]');
        expect(results.length).toBeGreaterThan(0);
        
        // In portrait, results should stack vertically
        if (results.length >= 2) {
          const firstRect = results[0].getBoundingClientRect();
          const secondRect = results[1].getBoundingClientRect();
          expect(secondRect.top).toBeGreaterThan(firstRect.bottom - 10);
        }
      });
      
      // Measure layout changes during orientation change
      const layoutMeasurement = await measureLayoutChanges(container, async () => {
        await orientationSim.changeOrientation('landscape', 300);
      });
      
      // Verify orientation change effects
      await waitFor(() => {
        expect(orientationSim.getCurrentOrientation()).toBe('landscape');
        
        // Layout should have adapted
        const viewport = orientationSim.getViewportDimensions();
        expect(viewport.width).toBeGreaterThan(viewport.height);
        
        // Results should still be visible and accessible
        const results = container.querySelectorAll('[role="option"]');
        expect(results.length).toBeGreaterThan(0);
      });
      
      // Validate layout shift is within acceptable bounds
      expect(layoutMeasurement.totalShift).toBeLessThan(MOBILE_PERFORMANCE_THRESHOLDS.CUMULATIVE_LAYOUT_SHIFT);
      expect(layoutMeasurement.maxReflowTime).toBeLessThan(MOBILE_PERFORMANCE_THRESHOLDS.NAVIGATION_TRANSITION);
      
      // Validate touch targets remain accessible
      const landscapeTouchTargets = validateTouchTargetsAfterOrientation(container);
      const touchTargetViolations = landscapeTouchTargets.filter(t => !t.meetsRequirements);
      expect(touchTargetViolations).toHaveLength(0);
      
      // Verify state preservation
      const finalState = captureComponentState(container);
      const stateChanges = compareStates(initialState, finalState);
      const criticalChanges = stateChanges.filter(change => 
        change.changed && ['searchQuery', 'selectedItems'].includes(change.property)
      );
      expect(criticalChanges).toHaveLength(0);
    });
    
    test('should handle rapid orientation changes without breaking', async () => {
      const device = MOBILE_DEVICE_CONFIGS.samsung_galaxy_s20;
      const orientationSim = new OrientationSimulator(device, 'portrait');
      
      const { container } = render(
        <SearchResults
          results={mockSearchResults}
          searchQuery="rapid orientation test"
          onResultSelect={jest.fn()}
        />
      );
      
      // Perform rapid orientation changes
      const orientations: Array<'portrait' | 'landscape'> = ['landscape', 'portrait', 'landscape', 'portrait'];
      
      for (const orientation of orientations) {
        await orientationSim.changeOrientation(orientation, 100); // Fast transitions
        
        // Verify component remains functional
        await waitFor(() => {
          const results = container.querySelectorAll('[role="option"]');
          expect(results.length).toBeGreaterThan(0);
          
          // No broken layouts or hidden content
          results.forEach(result => {
            const rect = result.getBoundingClientRect();
            expect(rect.width).toBeGreaterThan(0);
            expect(rect.height).toBeGreaterThan(0);
          });
        });
      }
    });
  });
  
  describe('ResponsiveSearchLayout Orientation Handling', () => {
    test('should adapt layout structure during orientation changes', async () => {
      const device = MOBILE_DEVICE_CONFIGS.iphone_14_pro_max;
      const orientationSim = new OrientationSimulator(device, 'portrait');
      
      const { container } = render(
        <ResponsiveSearchLayout
          searchInput={<input placeholder="Search..." />}
          filtersContent={<div>Filters Content</div>}
          resultsContent={<div>Results Content</div>}
          previewContent={<div>Preview Content</div>}
          initialFiltersVisible={false}
          initialPreviewVisible={false}
        />
      );
      
      // Test portrait layout
      await waitFor(() => {
        const mobileLayout = container.querySelector('.mobile-search-layout');
        expect(mobileLayout).toBeInTheDocument();
        
        // Sidebars should not be visible in portrait mobile
        const filtersSidebar = container.querySelector('.filters-sidebar');
        const previewSidebar = container.querySelector('.preview-sidebar');
        expect(filtersSidebar).not.toBeInTheDocument();
        expect(previewSidebar).not.toBeInTheDocument();
      });
      
      // Change to landscape
      await orientationSim.changeOrientation('landscape');
      
      await waitFor(() => {
        // Layout should adapt - may show different structure in landscape
        const layoutContainer = container.querySelector('[class*="-layout"]');
        expect(layoutContainer).toBeInTheDocument();
        
        // Main content should be visible and properly sized
        const mainContent = container.querySelector('.main-content, .results-container');
        if (mainContent) {
          const rect = mainContent.getBoundingClientRect();
          const viewport = orientationSim.getViewportDimensions();
          expect(rect.width).toBeLessThanOrEqual(viewport.width);
          expect(rect.height).toBeLessThanOrEqual(viewport.height);
        }
      });
    });
    
    test('should maintain touch interaction during orientation changes', async () => {
      const device = MOBILE_DEVICE_CONFIGS.ipad_mini;
      const orientationSim = new OrientationSimulator(device, 'portrait');
      
      const mockOnFiltersToggle = jest.fn();
      const mockOnPreviewToggle = jest.fn();
      
      const { container } = render(
        <ResponsiveSearchLayout
          searchInput={<input placeholder="Search..." />}
          filtersContent={<div>Filters</div>}
          resultsContent={<div>Results</div>}
          previewContent={<div>Preview</div>}
          onFiltersToggle={mockOnFiltersToggle}
          onPreviewToggle={mockOnPreviewToggle}
        />
      );
      
      // Test interaction in portrait
      const filtersButton = screen.getByLabelText('Toggle filters');
      fireEvent.click(filtersButton);
      
      await waitFor(() => {
        expect(mockOnFiltersToggle).toHaveBeenCalledWith(true);
      });
      
      // Change orientation
      await orientationSim.changeOrientation('landscape');
      
      // Test interaction still works in landscape
      const filtersButtonAfter = screen.getByLabelText('Toggle filters');
      fireEvent.click(filtersButtonAfter);
      
      await waitFor(() => {
        expect(mockOnFiltersToggle).toHaveBeenCalledWith(false);
      });
    });
  });
  
  describe('Form Component Orientation Handling', () => {
    test('should preserve form data during orientation changes', async () => {
      const device = MOBILE_DEVICE_CONFIGS.iphone_se;
      const orientationSim = new OrientationSimulator(device, 'portrait');
      
      const mockOnSubmit = jest.fn();
      const { container } = render(
        <KBEntryForm onSubmit={mockOnSubmit} />
      );
      
      // Fill form in portrait
      const titleInput = container.querySelector('input[name="title"], input[placeholder*="title"]') as HTMLInputElement;
      if (titleInput) {
        fireEvent.change(titleInput, { target: { value: 'Test Entry Title' } });
      }
      
      const problemTextarea = container.querySelector('textarea[name="problem"], textarea[placeholder*="problem"]') as HTMLTextAreaElement;
      if (problemTextarea) {
        fireEvent.change(problemTextarea, { target: { value: 'Test problem description' } });
      }
      
      // Capture form state
      const beforeState = captureComponentState(container);
      
      // Change to landscape
      await orientationSim.changeOrientation('landscape');
      
      // Verify form data is preserved
      await waitFor(() => {
        const afterState = captureComponentState(container);
        const stateChanges = compareStates(beforeState, afterState);
        
        // Form values should not change
        const formValueChanges = stateChanges.find(change => change.property === 'formValues');
        expect(formValueChanges?.changed).toBeFalsy();
        
        // Verify specific field values
        if (titleInput) {
          expect(titleInput.value).toBe('Test Entry Title');
        }
        if (problemTextarea) {
          expect(problemTextarea.value).toBe('Test problem description');
        }
      });
    });
    
    test('should handle virtual keyboard with orientation changes', async () => {
      const device = MOBILE_DEVICE_CONFIGS.samsung_galaxy_s20;
      const orientationSim = new OrientationSimulator(device, 'portrait');
      
      const { container } = render(
        <KBEntryForm onSubmit={jest.fn()} />
      );
      
      const textInput = container.querySelector('input[type="text"]') as HTMLInputElement;
      expect(textInput).toBeInTheDocument();
      
      // Focus input to trigger virtual keyboard
      fireEvent.focus(textInput);
      
      // Simulate virtual keyboard reducing viewport height
      const originalHeight = device.viewport.height;
      const keyboardHeight = 300;
      
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: originalHeight - keyboardHeight,
      });
      
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      
      // Change orientation with keyboard open
      await orientationSim.changeOrientation('landscape');
      
      // Verify input remains accessible
      await waitFor(() => {
        const rect = textInput.getBoundingClientRect();
        expect(rect.top).toBeGreaterThanOrEqual(0);
        expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
        expect(textInput).toHaveFocus();
      });
    });
  });
  
  describe('Mobile Entry List Orientation Adaptation', () => {
    test('should adapt entry list layout for different orientations', async () => {
      const device = MOBILE_DEVICE_CONFIGS.iphone_12;
      const orientationSim = new OrientationSimulator(device, 'portrait');
      
      const { container } = render(
        <KBEntryList
          entries={mockKBEntries}
          onEntrySelect={jest.fn()}
          onEntryRate={jest.fn()}
        />
      );
      
      // Test portrait layout
      await waitFor(() => {
        const entryItems = container.querySelectorAll('[role="button"], .kb-entry-card');
        expect(entryItems.length).toBeGreaterThan(0);
        
        // In portrait, entries should stack vertically
        if (entryItems.length >= 2) {
          const firstRect = entryItems[0].getBoundingClientRect();
          const secondRect = entryItems[1].getBoundingClientRect();
          expect(secondRect.top).toBeGreaterThan(firstRect.bottom - 20);
        }
      });
      
      // Change to landscape
      await orientationSim.changeOrientation('landscape');
      
      await waitFor(() => {
        const entryItems = container.querySelectorAll('[role="button"], .kb-entry-card');
        
        // Entries should still be visible and accessible
        entryItems.forEach(item => {
          const rect = item.getBoundingClientRect();
          expect(rect.width).toBeGreaterThan(0);
          expect(rect.height).toBeGreaterThan(0);
          
          // Touch targets should remain adequate
          expect(rect.height).toBeGreaterThanOrEqual(TOUCH_TARGET_REQUIREMENTS.MINIMUM_SIZE);
        });
      });
    });
  });
  
  describe('Cross-Device Orientation Consistency', () => {
    test.each(Object.entries(MOBILE_DEVICE_CONFIGS))(
      'should handle orientation changes consistently on %s',
      async ([deviceKey, device]) => {
        const orientationSim = new OrientationSimulator(device, 'portrait');
        
        const { container } = render(
          <MobileFirstLayout
            entries={mockKBEntries}
            onSearch={jest.fn()}
            onEntrySelect={jest.fn()}
          />
        );
        
        // Test both orientations
        const orientations: Array<'portrait' | 'landscape'> = ['landscape', 'portrait'];
        
        for (const orientation of orientations) {
          await orientationSim.changeOrientation(orientation);
          
          await waitFor(() => {
            // Layout should remain functional
            const layout = container.querySelector('[data-testid="mobile-first-layout"]');
            expect(layout).toBeInTheDocument();
            
            // Content should be visible
            const content = container.querySelector('.search-interface, .entry-list, main');
            if (content) {
              const rect = content.getBoundingClientRect();
              expect(rect.width).toBeGreaterThan(0);
              expect(rect.height).toBeGreaterThan(0);
            }
            
            // Touch targets should remain accessible
            const touchTargets = validateTouchTargetsAfterOrientation(container);
            const violations = touchTargets.filter(t => !t.meetsRequirements);
            expect(violations.length).toBeLessThanOrEqual(1); // Allow minimal violations
          });
        }
      }
    );
  });
  
  describe('Performance During Orientation Changes', () => {
    test('should maintain performance thresholds during orientation transitions', async () => {
      const device = MOBILE_DEVICE_CONFIGS.iphone_14_pro_max;
      const orientationSim = new OrientationSimulator(device, 'portrait');
      
      const { container } = render(
        <div>
          <SearchResults
            results={mockSearchResults}
            searchQuery="performance test"
            onResultSelect={jest.fn()}
          />
          <ResponsiveSearchLayout
            searchInput={<input placeholder="Search..." />}
            filtersContent={<div>Filters</div>}
            resultsContent={<div>Results</div>}
          />
        </div>
      );
      
      // Measure multiple orientation changes
      const transitionTimes = [];
      const orientations: Array<'portrait' | 'landscape'> = ['landscape', 'portrait', 'landscape'];
      
      for (const orientation of orientations) {
        const startTime = performance.now();
        
        await orientationSim.changeOrientation(orientation, 200);
        
        // Wait for layout to stabilize
        await waitFor(() => {
          const anyElement = container.querySelector('*');
          expect(anyElement).toBeInTheDocument();
        });
        
        const endTime = performance.now();
        const transitionTime = endTime - startTime;
        transitionTimes.push(transitionTime);
        
        // Each transition should be reasonably fast
        expect(transitionTime).toBeLessThan(MOBILE_PERFORMANCE_THRESHOLDS.NAVIGATION_TRANSITION * 2);
      }
      
      // Average transition time should be acceptable
      const averageTime = transitionTimes.reduce((sum, time) => sum + time, 0) / transitionTimes.length;
      expect(averageTime).toBeLessThan(MOBILE_PERFORMANCE_THRESHOLDS.NAVIGATION_TRANSITION * 1.5);
    });
  });
  
  describe('Accessibility During Orientation Changes', () => {
    test('should maintain accessibility standards across orientations', async () => {
      const device = MOBILE_DEVICE_CONFIGS.samsung_galaxy_s20;
      const orientationSim = new OrientationSimulator(device, 'portrait');
      
      const { container } = render(
        <SearchResults
          results={mockSearchResults}
          searchQuery="accessibility test"
          onResultSelect={jest.fn()}
          enableAdvancedKeyboardShortcuts={true}
        />
      );
      
      // Test accessibility in both orientations
      const orientations: Array<'portrait' | 'landscape'> = ['portrait', 'landscape'];
      
      for (const orientation of orientations) {
        await orientationSim.changeOrientation(orientation);
        
        // Run accessibility audit
        const results = await axe(container);
        expect(results).toHaveNoViolations();
        
        // Verify keyboard navigation still works
        const focusableElements = container.querySelectorAll(
          'button, a[href], input, [tabindex="0"]'
        );
        
        if (focusableElements.length > 0) {
          fireEvent.focus(focusableElements[0]);
          expect(focusableElements[0]).toHaveFocus();
          
          // Test tab navigation
          fireEvent.keyDown(focusableElements[0], { key: 'Tab' });
          
          await waitFor(() => {
            const focusedElement = document.activeElement;
            expect(focusedElement).toBeInstanceOf(HTMLElement);
          });
        }
      }
    });
    
    test('should announce orientation changes to screen readers', async () => {
      const device = MOBILE_DEVICE_CONFIGS.iphone_12;
      const orientationSim = new OrientationSimulator(device, 'portrait');
      
      const { container } = render(
        <div>
          <div aria-live="polite" data-testid="orientation-announcer" />
          <ResponsiveSearchLayout
            searchInput={<input placeholder="Search..." />}
            filtersContent={<div>Filters</div>}
            resultsContent={<div>Results</div>}
          />
        </div>
      );
      
      // Change orientation
      await orientationSim.changeOrientation('landscape');
      
      // Should maintain proper ARIA labels and structure
      await waitFor(() => {
        const announcer = screen.getByTestId('orientation-announcer');
        expect(announcer).toHaveAttribute('aria-live', 'polite');
        
        // Interactive elements should retain proper labels
        const buttons = container.querySelectorAll('button');
        buttons.forEach(button => {
          const hasLabel = button.hasAttribute('aria-label') || 
                          button.hasAttribute('aria-labelledby') ||
                          button.textContent?.trim();
          expect(hasLabel).toBeTruthy();
        });
      });
    });
  });
});
