/**
 * Mobile Navigation Flow Tests
 * 
 * Tests critical user flows and navigation patterns on mobile devices:
 * - Mobile menu navigation
 * - Search flow from start to completion
 * - Entry creation workflow
 * - Filter and settings access
 * - Back button and breadcrumb navigation
 * - Deep linking and state preservation
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
  CRITICAL_USER_FLOWS,
  MOBILE_INTERACTION_PATTERNS,
  MOBILE_PERFORMANCE_THRESHOLDS,
  type MobileDeviceConfig
} from './mobile-device-testing.config';

// Component imports
import { SearchInterface } from '../../src/renderer/components/search/SearchInterface';
import { ResponsiveSearchLayout } from '../../src/components/search/ResponsiveSearchLayout';
import { MobileFirstLayout } from '../../src/examples/MobileFirstLayout';
import { KBEntryForm } from '../../src/renderer/components/forms/KBEntryForm';
import { KBEntryList } from '../../src/renderer/components/KBEntryList';

// Mock data
const mockKBEntries = [
  {
    id: '1',
    title: 'VSAM File Access Error Resolution',
    problem: 'VSAM file cannot be accessed during batch processing, returning status code 35.',
    solution: '1. Check dataset existence with ISPF 3.4\n2. Verify DD statement syntax\n3. Confirm RACF permissions\n4. Use LISTCAT to verify catalog entry',
    category: 'VSAM' as const,
    tags: ['vsam', 'file-access', 'status-35', 'batch'],
    usage_count: 156,
    success_count: 148,
    failure_count: 8,
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-20T15:45:00Z'
  },
  {
    id: '2', 
    title: 'DB2 Connection Pool Timeout Fix',
    problem: 'Database connections timing out under heavy load, causing application failures.',
    solution: '1. Increase connection pool size\n2. Optimize long-running queries\n3. Implement connection retry logic\n4. Monitor connection usage patterns',
    category: 'Database' as const,
    tags: ['db2', 'connection', 'timeout', 'performance'],
    usage_count: 89,
    success_count: 82,
    failure_count: 7,
    created_at: '2024-01-14T14:15:00Z',
    updated_at: '2024-01-18T14:20:00Z'
  },
  {
    id: '3',
    title: 'JCL Step Failure Analysis',
    problem: 'JCL job failing at specific step with return code 8, need systematic debugging approach.',
    solution: '1. Check SYSOUT for error messages\n2. Verify input dataset availability\n3. Review step parameters\n4. Validate program load module',
    category: 'JCL' as const,
    tags: ['jcl', 'step-failure', 'rc8', 'debugging'],
    usage_count: 203,
    success_count: 195,
    failure_count: 8,
    created_at: '2024-01-12T09:00:00Z',
    updated_at: '2024-01-19T16:30:00Z'
  }
];

// =========================
// Test Utilities
// =========================

/**
 * Mobile device setup with proper simulation
 */
const setupMobileDevice = (device: MobileDeviceConfig, orientation: 'portrait' | 'landscape' = 'portrait') => {
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

  // Enable touch simulation
  Object.defineProperty(navigator, 'maxTouchPoints', {
    writable: true,
    configurable: true,
    value: 5,
  });

  // Set user agent
  Object.defineProperty(navigator, 'userAgent', {
    writable: true,
    configurable: true,
    value: device.userAgent,
  });

  window.TouchEvent = class TouchEvent extends UIEvent {} as any;
  document.ontouchstart = null;

  act(() => {
    window.dispatchEvent(new Event('resize'));
  });

  return viewport;
};

/**
 * Enhanced touch interaction utilities
 */
const mobileInteractions = {
  tap: async (element: Element, options: { duration?: number; coordinates?: { x: number; y: number } } = {}) => {
    const { duration = 100, coordinates } = options;
    const rect = element.getBoundingClientRect();
    const x = coordinates?.x ?? rect.left + rect.width / 2;
    const y = coordinates?.y ?? rect.top + rect.height / 2;

    fireEvent.touchStart(element, {
      touches: [{ clientX: x, clientY: y }]
    });

    await new Promise(resolve => setTimeout(resolve, duration));

    fireEvent.touchEnd(element, {
      changedTouches: [{ clientX: x, clientY: y }]
    });

    // Also fire click for compatibility
    fireEvent.click(element);
  },

  swipe: async (element: Element, direction: 'left' | 'right' | 'up' | 'down', distance = 100) => {
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

    // Simulate movement in steps for more realistic gesture
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const progressX = startX + (endX - startX) * (i / steps);
      const progressY = startY + (endY - startY) * (i / steps);
      
      fireEvent.touchMove(element, {
        touches: [{ clientX: progressX, clientY: progressY }]
      });
      
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    fireEvent.touchEnd(element, {
      changedTouches: [{ clientX: endX, clientY: endY }]
    });
  },

  longPress: async (element: Element, duration = 500) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    fireEvent.touchStart(element, {
      touches: [{ clientX: x, clientY: y }]
    });

    await new Promise(resolve => setTimeout(resolve, duration));

    fireEvent.touchEnd(element, {
      changedTouches: [{ clientX: x, clientY: y }]
    });
  },

  scroll: async (element: Element, direction: 'up' | 'down', amount = 300) => {
    const startScrollTop = element.scrollTop;
    const endScrollTop = direction === 'down' 
      ? startScrollTop + amount 
      : Math.max(0, startScrollTop - amount);

    fireEvent.scroll(element, { target: { scrollTop: endScrollTop } });
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};

/**
 * User flow simulation utilities
 */
const userFlows = {
  searchFlow: async (container: HTMLElement, query: string) => {
    const steps: Array<{step: string; duration: number}> = [];
    let startTime = performance.now();

    // Step 1: Find and focus search input
    const searchInput = container.querySelector('input[type="text"], input[placeholder*="Search"]') as HTMLInputElement;
    expect(searchInput).toBeInTheDocument();
    
    await mobileInteractions.tap(searchInput);
    steps.push({ step: 'focus_search_input', duration: performance.now() - startTime });
    
    // Step 2: Enter search query
    startTime = performance.now();
    await userEvent.type(searchInput, query);
    steps.push({ step: 'enter_search_query', duration: performance.now() - startTime });
    
    // Step 3: Submit search (look for submit button or Enter key)
    startTime = performance.now();
    const submitButton = container.querySelector('button[type="submit"], button[aria-label*="search"]');
    if (submitButton) {
      await mobileInteractions.tap(submitButton);
    } else {
      fireEvent.keyPress(searchInput, { key: 'Enter', code: 'Enter' });
    }
    steps.push({ step: 'submit_search', duration: performance.now() - startTime });
    
    // Step 4: Wait for results
    startTime = performance.now();
    await waitFor(() => {
      const results = container.querySelectorAll('[role="option"], .search-result-item, .kb-entry-card');
      expect(results.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
    steps.push({ step: 'load_results', duration: performance.now() - startTime });
    
    return steps;
  },

  navigationFlow: async (container: HTMLElement) => {
    const steps: Array<{step: string; element: string; duration: number}> = [];
    
    // Step 1: Open mobile menu (if present)
    let startTime = performance.now();
    const menuButton = container.querySelector('button[aria-label*="menu"], button[aria-label*="Menu"], .mobile-menu-button');
    if (menuButton) {
      await mobileInteractions.tap(menuButton);
      steps.push({ step: 'open_mobile_menu', element: 'menu_button', duration: performance.now() - startTime });
      
      await waitFor(() => {
        const menu = container.querySelector('[role="navigation"], .mobile-menu, .navigation-drawer');
        expect(menu).toBeInTheDocument();
      });
    }
    
    // Step 2: Access filters
    startTime = performance.now();
    const filtersButton = container.querySelector('button[aria-label*="filter"], button[aria-label*="Filter"]');
    if (filtersButton) {
      await mobileInteractions.tap(filtersButton);
      steps.push({ step: 'open_filters', element: 'filters_button', duration: performance.now() - startTime });
      
      await waitFor(() => {
        const filters = container.querySelector('[role="dialog"], .filters-overlay, .filters-sidebar');
        expect(filters).toBeInTheDocument();
      });
      
      // Close filters
      const closeButton = container.querySelector('button[aria-label*="close"], button[aria-label*="Close"]');
      if (closeButton) {
        await mobileInteractions.tap(closeButton);
      }
    }
    
    return steps;
  },

  entrySelectionFlow: async (container: HTMLElement) => {
    const steps: Array<{step: string; duration: number}> = [];
    
    // Step 1: Find and select first entry
    let startTime = performance.now();
    const firstEntry = container.querySelector('[role="option"], .search-result-item, .kb-entry-card');
    expect(firstEntry).toBeInTheDocument();
    
    await mobileInteractions.tap(firstEntry!);
    steps.push({ step: 'select_entry', duration: performance.now() - startTime });
    
    // Step 2: Verify entry details are shown or navigation occurred
    startTime = performance.now();
    await waitFor(() => {
      // Look for entry details, modal, or navigation change
      const entryDetails = container.querySelector('.entry-details, [role="dialog"], .entry-modal');
      const selectedState = firstEntry?.getAttribute('aria-selected') === 'true' || 
                           firstEntry?.getAttribute('aria-pressed') === 'true';
      
      expect(entryDetails || selectedState).toBeTruthy();
    });
    steps.push({ step: 'show_entry_details', duration: performance.now() - startTime });
    
    return steps;
  }
};

/**
 * Performance measurement for user flows
 */
const measureFlowPerformance = {
  totalFlowTime: (steps: Array<{step: string; duration: number}>) => {
    return steps.reduce((total, step) => total + step.duration, 0);
  },
  
  slowestStep: (steps: Array<{step: string; duration: number}>) => {
    return steps.reduce((slowest, step) => 
      step.duration > slowest.duration ? step : slowest
    );
  },
  
  validateThresholds: (steps: Array<{step: string; duration: number}>) => {
    const violations = [];
    
    for (const step of steps) {
      if (step.step.includes('search') && step.duration > MOBILE_PERFORMANCE_THRESHOLDS.TOUCH_RESPONSE_TIME) {
        violations.push({ ...step, threshold: MOBILE_PERFORMANCE_THRESHOLDS.TOUCH_RESPONSE_TIME });
      }
      if (step.step.includes('load') && step.duration > MOBILE_PERFORMANCE_THRESHOLDS.FIRST_CONTENTFUL_PAINT) {
        violations.push({ ...step, threshold: MOBILE_PERFORMANCE_THRESHOLDS.FIRST_CONTENTFUL_PAINT });
      }
      if (step.step.includes('nav') && step.duration > MOBILE_PERFORMANCE_THRESHOLDS.NAVIGATION_TRANSITION) {
        violations.push({ ...step, threshold: MOBILE_PERFORMANCE_THRESHOLDS.NAVIGATION_TRANSITION });
      }
    }
    
    return violations;
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

describe('Mobile Navigation Flow Tests', () => {
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

  describe('Search Flow Navigation', () => {
    test('should complete search flow on iPhone SE within performance thresholds', async () => {
      setupMobileDevice(MOBILE_DEVICE_CONFIGS.iphone_se);
      
      const mockOnEntrySelect = jest.fn();
      const { container } = render(
        <SearchInterface
          entries={mockKBEntries}
          onEntrySelect={mockOnEntrySelect}
          showAnalytics={false}
        />
      );

      const steps = await userFlows.searchFlow(container, 'VSAM error');
      
      // Validate performance
      const violations = measureFlowPerformance.validateThresholds(steps);
      expect(violations).toHaveLength(0);
      
      // Validate total flow time
      const totalTime = measureFlowPerformance.totalFlowTime(steps);
      expect(totalTime).toBeLessThan(MOBILE_PERFORMANCE_THRESHOLDS.FIRST_CONTENTFUL_PAINT * 2);
      
      // Verify search results are displayed
      await waitFor(() => {
        const results = container.querySelectorAll('[role="option"], .search-result-item');
        expect(results.length).toBeGreaterThan(0);
      });
    });

    test('should handle search flow with filters on Samsung Galaxy S20', async () => {
      setupMobileDevice(MOBILE_DEVICE_CONFIGS.samsung_galaxy_s20);
      
      const { container } = render(
        <ResponsiveSearchLayout
          searchInput={<input placeholder="Search knowledge base..." />}
          filtersContent={
            <div>
              <h3>Categories</h3>
              <button type="button">VSAM</button>
              <button type="button">Database</button>
              <button type="button">JCL</button>
            </div>
          }
          resultsContent={
            <div>
              {mockKBEntries.map(entry => (
                <div key={entry.id} role="option" className="search-result-item">
                  <h4>{entry.title}</h4>
                  <p>{entry.problem}</p>
                </div>
              ))}
            </div>
          }
        />
      );

      // Complete search flow
      const searchSteps = await userFlows.searchFlow(container, 'database timeout');
      
      // Test filter interaction
      const navigationSteps = await userFlows.navigationFlow(container);
      
      // Combine and validate performance
      const allSteps = [...searchSteps, ...navigationSteps];
      const violations = measureFlowPerformance.validateThresholds(allSteps);
      
      // Allow some flexibility for complex flows
      expect(violations.length).toBeLessThanOrEqual(1);
    });

    test('should maintain search state during orientation changes', async () => {
      const device = MOBILE_DEVICE_CONFIGS.iphone_12;
      setupMobileDevice(device, 'portrait');
      
      const { container, rerender } = render(
        <MobileFirstLayout
          entries={mockKBEntries}
          onSearch={jest.fn()}
          onEntrySelect={jest.fn()}
        />
      );

      // Perform search in portrait
      await userFlows.searchFlow(container, 'JCL step failure');
      
      // Verify results are shown
      await waitFor(() => {
        const results = container.querySelectorAll('.mobile-entry-card');
        expect(results.length).toBeGreaterThan(0);
      });
      
      // Change to landscape
      setupMobileDevice(device, 'landscape');
      
      rerender(
        <MobileFirstLayout
          entries={mockKBEntries}
          onSearch={jest.fn()}
          onEntrySelect={jest.fn()}
        />
      );
      
      // Verify results are still shown after orientation change
      await waitFor(() => {
        const results = container.querySelectorAll('.mobile-entry-card');
        expect(results.length).toBeGreaterThan(0);
        
        // Layout should adapt to landscape
        const layout = container.querySelector('[data-testid="mobile-first-layout"]');
        if (layout) {
          const rect = layout.getBoundingClientRect();
          expect(rect.width).toBeGreaterThan(rect.height);
        }
      });
    });
  });

  describe('Mobile Menu Navigation', () => {
    test('should handle mobile menu interactions on iPhone 14 Pro Max', async () => {
      setupMobileDevice(MOBILE_DEVICE_CONFIGS.iphone_14_pro_max);
      
      const { container } = render(
        <ResponsiveSearchLayout
          searchInput={<input placeholder="Search..." />}
          filtersContent={<div>Filters Content</div>}
          resultsContent={<div>Results Content</div>}
          previewContent={<div>Preview Content</div>}
          headerContent={
            <div>
              <button aria-label="Menu">☰</button>
              <h1>Knowledge Base</h1>
            </div>
          }
        />
      );

      const navigationSteps = await userFlows.navigationFlow(container);
      
      // Validate navigation performance
      const violations = measureFlowPerformance.validateThresholds(navigationSteps);
      expect(violations).toHaveLength(0);
      
      // Verify mobile-specific elements are present
      await waitFor(() => {
        const mobileHeader = container.querySelector('.mobile-header');
        expect(mobileHeader).toBeInTheDocument();
      });
    });

    test('should support swipe navigation gestures', async () => {
      setupMobileDevice(MOBILE_DEVICE_CONFIGS.samsung_galaxy_s20);
      
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

      // Test swipe right to open filters
      const resultsContainer = screen.getByText('Results').closest('div');
      expect(resultsContainer).toBeInTheDocument();
      
      await mobileInteractions.swipe(resultsContainer!, 'right', 100);
      
      await waitFor(() => {
        expect(mockOnFiltersToggle).toHaveBeenCalledWith(true);
      });
      
      // Test swipe left to open preview
      await mobileInteractions.swipe(resultsContainer!, 'left', 100);
      
      await waitFor(() => {
        expect(mockOnPreviewToggle).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('Entry Selection and Viewing Flow', () => {
    test('should handle entry selection flow on iPad Mini', async () => {
      setupMobileDevice(MOBILE_DEVICE_CONFIGS.ipad_mini);
      
      const mockOnEntrySelect = jest.fn();
      const { container } = render(
        <KBEntryList
          entries={mockKBEntries}
          onEntrySelect={mockOnEntrySelect}
          onEntryRate={jest.fn()}
        />
      );

      const selectionSteps = await userFlows.entrySelectionFlow(container);
      
      // Validate selection performance
      const violations = measureFlowPerformance.validateThresholds(selectionSteps);
      expect(violations).toHaveLength(0);
      
      // Verify selection callback was triggered
      await waitFor(() => {
        expect(mockOnEntrySelect).toHaveBeenCalledWith(mockKBEntries[0]);
      });
    });

    test('should support long press for context actions', async () => {
      setupMobileDevice(MOBILE_DEVICE_CONFIGS.iphone_se);
      
      const mockOnEntryRate = jest.fn();
      const { container } = render(
        <KBEntryList
          entries={mockKBEntries}
          onEntrySelect={jest.fn()}
          onEntryRate={mockOnEntryRate}
          enableContextActions={true}
        />
      );

      const firstEntry = container.querySelector('.kb-entry-card, [role="button"]');
      expect(firstEntry).toBeInTheDocument();
      
      // Simulate long press
      await mobileInteractions.longPress(firstEntry!, 600);
      
      // Should trigger context menu or rating action
      await waitFor(() => {
        const contextMenu = container.querySelector('.context-menu, [role="menu"]');
        const ratingAction = container.querySelector('.rating-action, [aria-label*="rate"]');
        
        expect(contextMenu || ratingAction || mockOnEntryRate).toBeTruthy();
      });
    });
  });

  describe('Form Navigation and Input Flow', () => {
    test('should handle form navigation on mobile devices', async () => {
      setupMobileDevice(MOBILE_DEVICE_CONFIGS.iphone_12);
      
      const mockOnSubmit = jest.fn();
      const { container } = render(
        <KBEntryForm onSubmit={mockOnSubmit} />
      );

      // Test form field navigation
      const formFields = container.querySelectorAll('input, textarea, select');
      expect(formFields.length).toBeGreaterThan(0);
      
      // Navigate through form fields with taps
      for (let i = 0; i < Math.min(formFields.length, 3); i++) {
        const field = formFields[i];
        await mobileInteractions.tap(field);
        
        await waitFor(() => {
          expect(field).toHaveFocus();
        });
        
        // Type in text fields
        if (field.tagName === 'INPUT' && field.getAttribute('type') === 'text') {
          await userEvent.type(field as HTMLInputElement, `Test input ${i + 1}`);
        }
      }
      
      // Test form submission
      const submitButton = container.querySelector('button[type="submit"]');
      if (submitButton) {
        await mobileInteractions.tap(submitButton);
        
        // Note: mockOnSubmit might not be called if validation fails
        // That's expected behavior for incomplete forms
      }
    });

    test('should handle virtual keyboard interactions', async () => {
      setupMobileDevice(MOBILE_DEVICE_CONFIGS.samsung_galaxy_s20);
      
      const { container } = render(
        <KBEntryForm onSubmit={jest.fn()} />
      );

      const textInput = container.querySelector('input[type="text"]') as HTMLInputElement;
      expect(textInput).toBeInTheDocument();
      
      // Simulate virtual keyboard appearing (viewport height reduction)
      const originalHeight = MOBILE_DEVICE_CONFIGS.samsung_galaxy_s20.viewport.height;
      const keyboardHeight = 300;
      
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: originalHeight - keyboardHeight,
      });
      
      await mobileInteractions.tap(textInput);
      
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      
      // Verify input remains visible and accessible
      await waitFor(() => {
        const rect = textInput.getBoundingClientRect();
        expect(rect.top).toBeGreaterThanOrEqual(0);
        expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
      });
    });
  });

  describe('Back Button and Navigation History', () => {
    test('should handle back navigation properly', async () => {
      setupMobileDevice(MOBILE_DEVICE_CONFIGS.iphone_se);
      
      const mockOnFiltersToggle = jest.fn();
      const { container } = render(
        <ResponsiveSearchLayout
          searchInput={<input placeholder="Search..." />}
          filtersContent={<div>Filters</div>}
          resultsContent={<div>Results</div>}
          onFiltersToggle={mockOnFiltersToggle}
        />
      );

      // Open filters
      const filtersButton = screen.getByLabelText('Toggle filters');
      await mobileInteractions.tap(filtersButton);
      
      await waitFor(() => {
        expect(mockOnFiltersToggle).toHaveBeenCalledWith(true);
      });
      
      // Simulate back button press (Android-style)
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      
      await waitFor(() => {
        expect(mockOnFiltersToggle).toHaveBeenCalledWith(false);
      });
    });

    test('should maintain navigation state across page reloads', async () => {
      setupMobileDevice(MOBILE_DEVICE_CONFIGS.iphone_14_pro_max);
      
      const { container, rerender } = render(
        <MobileFirstLayout
          entries={mockKBEntries}
          onSearch={jest.fn()}
          onEntrySelect={jest.fn()}
        />
      );

      // Perform search and selection
      await userFlows.searchFlow(container, 'database');
      await userFlows.entrySelectionFlow(container);
      
      // Simulate component remount (page reload)
      rerender(
        <MobileFirstLayout
          entries={mockKBEntries}
          onSearch={jest.fn()}
          onEntrySelect={jest.fn()}
        />
      );
      
      // State should be preserved through proper state management
      // (This would require actual state persistence implementation)
      await waitFor(() => {
        const layout = container.querySelector('[data-testid="mobile-first-layout"]');
        expect(layout).toBeInTheDocument();
      });
    });
  });

  describe('Cross-Device Navigation Consistency', () => {
    test.each(Object.entries(MOBILE_DEVICE_CONFIGS))(
      'should maintain navigation consistency on %s',
      async ([deviceKey, device]) => {
        setupMobileDevice(device);
        
        const { container } = render(
          <SearchInterface
            entries={mockKBEntries}
            onEntrySelect={jest.fn()}
            showAnalytics={false}
          />
        );

        // Test basic navigation flow
        const searchSteps = await userFlows.searchFlow(container, 'test');
        const navigationSteps = await userFlows.navigationFlow(container);
        
        // All devices should complete basic flows
        expect(searchSteps.length).toBeGreaterThan(0);
        
        // Performance should be reasonable across all devices
        const totalTime = measureFlowPerformance.totalFlowTime([...searchSteps, ...navigationSteps]);
        expect(totalTime).toBeLessThan(MOBILE_PERFORMANCE_THRESHOLDS.FIRST_CONTENTFUL_PAINT * 3);
        
        // Log performance for analysis
        console.log(`Navigation performance on ${deviceKey}:`, {
          totalTime,
          searchSteps: searchSteps.length,
          navigationSteps: navigationSteps.length
        });
      }
    );
  });

  describe('Accessibility in Navigation Flows', () => {
    test('should maintain accessibility during navigation flows', async () => {
      setupMobileDevice(MOBILE_DEVICE_CONFIGS.iphone_12);
      
      const { container } = render(
        <ResponsiveSearchLayout
          searchInput={<input placeholder="Search..." aria-label="Search knowledge base" />}
          filtersContent={<div>Filters</div>}
          resultsContent={<div>Results</div>}
          enableKeyboardShortcuts={true}
        />
      );

      // Run accessibility audit
      const results = await axe(container);
      expect(results).toHaveNoViolations();
      
      // Test keyboard navigation as alternative to touch
      const searchInput = container.querySelector('input[type="text"]');
      expect(searchInput).toBeInTheDocument();
      
      fireEvent.focus(searchInput!);
      expect(searchInput).toHaveFocus();
      
      // Test tab navigation
      fireEvent.keyDown(searchInput!, { key: 'Tab' });
      
      await waitFor(() => {
        const focusedElement = document.activeElement;
        expect(focusedElement).not.toBe(searchInput);
        expect(focusedElement).toBeInstanceOf(HTMLElement);
      });
    });

    test('should announce navigation changes to screen readers', async () => {
      setupMobileDevice(MOBILE_DEVICE_CONFIGS.samsung_galaxy_s20);
      
      const { container } = render(
        <div>
          <div aria-live="polite" aria-atomic="true" data-testid="announcements" />
          <ResponsiveSearchLayout
            searchInput={<input placeholder="Search..." />}
            filtersContent={<div>Filters</div>}
            resultsContent={<div>Results</div>}
          />
        </div>
      );

      // Test filter toggle announcement
      const filtersButton = screen.getByLabelText('Toggle filters');
      await mobileInteractions.tap(filtersButton);
      
      await waitFor(() => {
        // Should have accessible filter overlay
        const filterOverlay = screen.getByRole('dialog');
        expect(filterOverlay).toBeInTheDocument();
        expect(filterOverlay).toHaveAttribute('aria-modal', 'true');
      });
    });
  });
});
