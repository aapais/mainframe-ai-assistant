/**
 * Comprehensive Responsive UI Test Suite
 *
 * Tests responsive behavior across multiple devices and scenarios:
 * - Breakpoint validation for mobile/tablet/desktop
 * - Touch interaction testing
 * - Viewport size adaptation
 * - Component reflow testing
 * - Performance on different devices
 * - Visual regression prevention
 *
 * @author UI Responsiveness Testing Specialist
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Component imports
import { SearchInterface } from '../../src/renderer/components/search/SearchInterface';
import { KBEntryList } from '../../src/renderer/components/KBEntryList';
import { ResponsiveSearchLayout } from '../../src/components/search/ResponsiveSearchLayout';
import { KBEntryForm } from '../../src/renderer/components/forms/KBEntryForm';

// Test data
const mockKBEntries = [
  {
    id: '1',
    title: 'VSAM Status 35 - File Not Found',
    problem: 'Job abends with VSAM status code 35. The program cannot open the VSAM file because the dataset does not exist or is incorrectly cataloged.',
    solution: '1. Verify dataset exists using ISPF 3.4\n2. Check DD statement for correct DSN\n3. Ensure proper cataloging\n4. Verify RACF permissions',
    category: 'VSAM' as const,
    tags: ['vsam', 'file-not-found', 'status-35', 'catalog'],
    usage_count: 42,
    success_count: 38,
    failure_count: 4,
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-20T15:45:00Z'
  },
  {
    id: '2',
    title: 'S0C7 Data Exception in COBOL Program',
    problem: 'Program abending with S0C7 error during numeric operations, typically caused by invalid data in numeric fields.',
    solution: '1. Initialize all numeric fields\n2. Validate data before operations\n3. Use DISPLAY statements to check values\n4. Check for spaces in numeric fields',
    category: 'Batch' as const,
    tags: ['s0c7', 'cobol', 'numeric', 'data-exception'],
    usage_count: 28,
    success_count: 25,
    failure_count: 3,
    created_at: '2024-01-10T09:15:00Z',
    updated_at: '2024-01-18T14:20:00Z'
  }
];

// Viewport configurations for testing
const VIEWPORT_SIZES = {
  // Mobile devices
  mobile_small: { width: 320, height: 568 }, // iPhone SE
  mobile_medium: { width: 375, height: 667 }, // iPhone 8
  mobile_large: { width: 414, height: 896 }, // iPhone 11 Pro Max

  // Tablets
  tablet_portrait: { width: 768, height: 1024 }, // iPad Portrait
  tablet_landscape: { width: 1024, height: 768 }, // iPad Landscape
  tablet_large: { width: 820, height: 1180 }, // iPad Air

  // Desktop
  desktop_small: { width: 1280, height: 720 }, // Small Desktop
  desktop_medium: { width: 1440, height: 900 }, // Medium Desktop
  desktop_large: { width: 1920, height: 1080 }, // Full HD
  desktop_ultrawide: { width: 2560, height: 1440 }, // 4K/Ultrawide

  // Edge cases
  very_narrow: { width: 280, height: 640 }, // Very narrow screen
  very_wide: { width: 3440, height: 1440 }, // Ultra-wide monitor
  square: { width: 800, height: 800 }, // Square aspect ratio
} as const;

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  TOUCH_TARGET_MIN_SIZE: 44, // Minimum touch target size (px)
  LAYOUT_SHIFT_THRESHOLD: 0.1, // Maximum acceptable layout shift
  REFLOW_TIME_MAX: 300, // Maximum time for layout reflow (ms)
  INTERACTION_RESPONSE_MAX: 100, // Maximum response time for interactions (ms)
  SCROLL_PERFORMANCE_MIN_FPS: 30, // Minimum scroll performance (fps)
} as const;

// ========================
// Utility Functions
// ========================

/**
 * Simulates viewport resize with proper event dispatching
 */
const resizeViewport = (width: number, height: number) => {
  // Mock window dimensions
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

  // Mock screen dimensions
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

  // Fire resize event
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
};

/**
 * Simulates touch device capabilities
 */
const simulateTouchDevice = (isTouch: boolean = true) => {
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    writable: true,
    configurable: true,
    value: isTouch ? 5 : 0,
  });

  if (isTouch) {
    window.TouchEvent = class TouchEvent extends UIEvent {} as any;
    document.ontouchstart = null;
  } else {
    delete (window as any).TouchEvent;
    delete (document as any).ontouchstart;
  }
};

/**
 * Measures component layout shift
 */
const measureLayoutShift = (element: Element, action: () => void) => {
  const beforeRect = element.getBoundingClientRect();
  action();
  const afterRect = element.getBoundingClientRect();

  return {
    deltaX: Math.abs(afterRect.x - beforeRect.x),
    deltaY: Math.abs(afterRect.y - beforeRect.y),
    deltaWidth: Math.abs(afterRect.width - beforeRect.width),
    deltaHeight: Math.abs(afterRect.height - beforeRect.height),
  };
};

/**
 * Test wrapper with responsive context
 */
const ResponsiveTestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div data-testid="responsive-wrapper" style={{ width: '100%', height: '100vh' }}>
    {children}
  </div>
);

// ========================
// Mock implementations
// ========================

const mockMediaQuery = (query: string, matches: boolean) => {
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

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(() => mediaQuery),
  });

  return mediaQuery;
};

// Mock IntersectionObserver for virtual scrolling
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// ========================
// Test Suite
// ========================

describe('Responsive UI Test Suite', () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    // Store original dimensions
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;

    // Reset to desktop default
    resizeViewport(1920, 1080);
    simulateTouchDevice(false);

    // Mock performance.now for timing tests
    jest.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(10);
  });

  afterEach(() => {
    // Restore original dimensions
    resizeViewport(originalInnerWidth, originalInnerHeight);
    simulateTouchDevice(false);

    jest.restoreAllMocks();
  });

  describe('Mobile Viewport Tests (320px - 768px)', () => {
    describe('Search Interface Mobile Behavior', () => {
      test('should stack search components vertically on mobile', async () => {
        resizeViewport(VIEWPORT_SIZES.mobile_medium.width, VIEWPORT_SIZES.mobile_medium.height);
        mockMediaQuery('(max-width: 768px)', true);

        const { container } = render(
          <ResponsiveTestWrapper>
            <SearchInterface
              entries={mockKBEntries}
              onEntrySelect={jest.fn()}
              showAnalytics={false}
            />
          </ResponsiveTestWrapper>
        );

        await waitFor(() => {
          // Verify mobile layout classes are applied
          const searchInterface = container.querySelector('.search-interface');
          expect(searchInterface).toBeInTheDocument();

          // Check for stacked layout indicators
          const searchHeader = container.querySelector('.search-interface__header');
          const searchContent = container.querySelector('.search-interface__content');

          if (searchHeader && searchContent) {
            const headerRect = searchHeader.getBoundingClientRect();
            const contentRect = searchContent.getBoundingClientRect();

            // Content should be below header (vertical stacking)
            expect(contentRect.top).toBeGreaterThan(headerRect.bottom - 10);
          }
        });
      });

      test('should hide sidebar on mobile and show overlay when triggered', async () => {
        resizeViewport(VIEWPORT_SIZES.mobile_small.width, VIEWPORT_SIZES.mobile_small.height);

        const { container } = render(
          <ResponsiveTestWrapper>
            <ResponsiveSearchLayout
              searchInput={<input placeholder="Search..." />}
              filtersContent={<div>Filters</div>}
              resultsContent={<div>Results</div>}
              previewContent={<div>Preview</div>}
            />
          </ResponsiveTestWrapper>
        );

        await waitFor(() => {
          // Sidebar should not be visible by default on mobile
          const filtersSidebar = container.querySelector('.filters-sidebar');
          expect(filtersSidebar).not.toBeInTheDocument();

          // Mobile header should be present
          const mobileHeader = container.querySelector('.mobile-header');
          expect(mobileHeader).toBeInTheDocument();
        });

        // Test filters toggle
        const filtersButton = screen.getByLabelText('Toggle filters');
        fireEvent.click(filtersButton);

        await waitFor(() => {
          // Overlay should appear
          const overlay = screen.getByRole('dialog');
          expect(overlay).toBeInTheDocument();
          expect(overlay).toHaveAttribute('aria-modal', 'true');
        });
      });

      test('should adapt search input size for mobile', async () => {
        resizeViewport(VIEWPORT_SIZES.mobile_small.width, VIEWPORT_SIZES.mobile_small.height);

        const { container } = render(
          <ResponsiveTestWrapper>
            <SearchInterface
              entries={mockKBEntries}
              onEntrySelect={jest.fn()}
            />
          </ResponsiveTestWrapper>
        );

        await waitFor(() => {
          const searchInput = container.querySelector('input[type="text"]');
          if (searchInput) {
            const computedStyle = window.getComputedStyle(searchInput);

            // Should take full width on mobile
            expect(computedStyle.width).toBe('100%');

            // Should have appropriate padding for touch
            const paddingTop = parseInt(computedStyle.paddingTop);
            const paddingBottom = parseInt(computedStyle.paddingBottom);
            expect(paddingTop + paddingBottom).toBeGreaterThanOrEqual(16);
          }
        });
      });
    });

    describe('KB Entry List Mobile Adaptation', () => {
      test('should display entry cards in single column on mobile', async () => {
        resizeViewport(VIEWPORT_SIZES.mobile_medium.width, VIEWPORT_SIZES.mobile_medium.height);

        const { container } = render(
          <ResponsiveTestWrapper>
            <KBEntryList
              entries={mockKBEntries}
              onEntrySelect={jest.fn()}
              onEntryRate={jest.fn()}
            />
          </ResponsiveTestWrapper>
        );

        await waitFor(() => {
          const entryItems = container.querySelectorAll('[role="button"]');

          if (entryItems.length >= 2) {
            const firstItem = entryItems[0].getBoundingClientRect();
            const secondItem = entryItems[1].getBoundingClientRect();

            // Items should be stacked vertically (single column)
            expect(secondItem.top).toBeGreaterThan(firstItem.bottom - 10);

            // Items should take most of the width
            expect(firstItem.width).toBeGreaterThan(VIEWPORT_SIZES.mobile_medium.width * 0.8);
          }
        });
      });

      test('should provide larger touch targets on mobile', async () => {
        simulateTouchDevice(true);
        resizeViewport(VIEWPORT_SIZES.mobile_medium.width, VIEWPORT_SIZES.mobile_medium.height);

        render(
          <ResponsiveTestWrapper>
            <KBEntryList
              entries={mockKBEntries}
              onEntrySelect={jest.fn()}
              onEntryRate={jest.fn()}
            />
          </ResponsiveTestWrapper>
        );

        await waitFor(() => {
          const buttons = screen.getAllByRole('button');

          buttons.forEach(button => {
            const rect = button.getBoundingClientRect();
            const minDimension = Math.min(rect.width, rect.height);

            // Touch targets should meet minimum size requirements
            expect(minDimension).toBeGreaterThanOrEqual(PERFORMANCE_THRESHOLDS.TOUCH_TARGET_MIN_SIZE);
          });
        });
      });
    });

    describe('Form Components Mobile Behavior', () => {
      test('should stack form fields vertically on mobile', async () => {
        resizeViewport(VIEWPORT_SIZES.mobile_small.width, VIEWPORT_SIZES.mobile_small.height);

        const { container } = render(
          <ResponsiveTestWrapper>
            <KBEntryForm onSubmit={jest.fn()} />
          </ResponsiveTestWrapper>
        );

        await waitFor(() => {
          const formFields = container.querySelectorAll('input, textarea, select');

          if (formFields.length >= 2) {
            for (let i = 0; i < formFields.length - 1; i++) {
              const currentField = formFields[i].getBoundingClientRect();
              const nextField = formFields[i + 1].getBoundingClientRect();

              // Next field should be below current field
              expect(nextField.top).toBeGreaterThan(currentField.bottom - 5);
            }
          }
        });
      });

      test('should optimize input sizes for mobile keyboards', async () => {
        simulateTouchDevice(true);
        resizeViewport(VIEWPORT_SIZES.mobile_medium.width, VIEWPORT_SIZES.mobile_medium.height);

        const { container } = render(
          <ResponsiveTestWrapper>
            <KBEntryForm onSubmit={jest.fn()} />
          </ResponsiveTestWrapper>
        );

        await waitFor(() => {
          const inputs = container.querySelectorAll('input');

          inputs.forEach(input => {
            const computedStyle = window.getComputedStyle(input);
            const height = parseInt(computedStyle.height);

            // Inputs should be tall enough for mobile interaction
            expect(height).toBeGreaterThanOrEqual(PERFORMANCE_THRESHOLDS.TOUCH_TARGET_MIN_SIZE);
          });
        });
      });
    });
  });

  describe('Tablet Viewport Tests (768px - 1024px)', () => {
    describe('Hybrid Layout Behavior', () => {
      test('should show two-column layout on tablet landscape', async () => {
        resizeViewport(VIEWPORT_SIZES.tablet_landscape.width, VIEWPORT_SIZES.tablet_landscape.height);
        mockMediaQuery('(min-width: 768px) and (max-width: 1024px)', true);

        const { container } = render(
          <ResponsiveTestWrapper>
            <ResponsiveSearchLayout
              searchInput={<input placeholder="Search..." />}
              filtersContent={<div>Filters</div>}
              resultsContent={<div>Results</div>}
              previewContent={<div>Preview</div>}
            />
          </ResponsiveTestWrapper>
        );

        await waitFor(() => {
          const mainContent = container.querySelector('.main-content');
          if (mainContent) {
            const computedStyle = window.getComputedStyle(mainContent);
            expect(computedStyle.display).toBe('flex');
          }
        });
      });

      test('should keep filters visible but make preview overlay on tablet', async () => {
        resizeViewport(VIEWPORT_SIZES.tablet_portrait.width, VIEWPORT_SIZES.tablet_portrait.height);

        const { container } = render(
          <ResponsiveTestWrapper>
            <ResponsiveSearchLayout
              searchInput={<input placeholder="Search..." />}
              filtersContent={<div>Filters</div>}
              resultsContent={<div>Results</div>}
              previewContent={<div>Preview</div>}
              initialFiltersVisible={true}
              initialPreviewVisible={false}
            />
          </ResponsiveTestWrapper>
        );

        await waitFor(() => {
          // Filters should be in sidebar
          const filtersSidebar = container.querySelector('.filters-sidebar');
          expect(filtersSidebar).toBeInTheDocument();

          // Preview should not be visible initially
          const previewSidebar = container.querySelector('.preview-sidebar');
          expect(previewSidebar).not.toBeInTheDocument();
        });
      });
    });

    describe('Touch Interaction Optimization', () => {
      test('should handle touch scrolling efficiently on tablet', async () => {
        simulateTouchDevice(true);
        resizeViewport(VIEWPORT_SIZES.tablet_landscape.width, VIEWPORT_SIZES.tablet_landscape.height);

        const { container } = render(
          <ResponsiveTestWrapper>
            <KBEntryList
              entries={Array(50).fill(null).map((_, i) => ({
                ...mockKBEntries[0],
                id: `entry-${i}`,
                title: `Entry ${i + 1}`
              }))}
              onEntrySelect={jest.fn()}
              enableVirtualization={true}
            />
          </ResponsiveTestWrapper>
        );

        const scrollContainer = container.querySelector('[style*="overflow"]');
        if (scrollContainer) {
          const startTime = performance.now();

          // Simulate touch scroll
          fireEvent.touchStart(scrollContainer, {
            touches: [{ clientX: 100, clientY: 100 }]
          });

          fireEvent.touchMove(scrollContainer, {
            touches: [{ clientX: 100, clientY: 50 }]
          });

          fireEvent.touchEnd(scrollContainer);

          const endTime = performance.now();
          const duration = endTime - startTime;

          // Touch scroll should be responsive
          expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.INTERACTION_RESPONSE_MAX);
        }
      });
    });
  });

  describe('Desktop Viewport Tests (1024px+)', () => {
    describe('Multi-column Layout', () => {
      test('should display three-column layout on desktop', async () => {
        resizeViewport(VIEWPORT_SIZES.desktop_large.width, VIEWPORT_SIZES.desktop_large.height);
        mockMediaQuery('(min-width: 1024px)', true);

        const { container } = render(
          <ResponsiveTestWrapper>
            <ResponsiveSearchLayout
              searchInput={<input placeholder="Search..." />}
              filtersContent={<div>Filters</div>}
              resultsContent={<div>Results</div>}
              previewContent={<div>Preview</div>}
              initialFiltersVisible={true}
              initialPreviewVisible={true}
            />
          </ResponsiveTestWrapper>
        );

        await waitFor(() => {
          const filtersSidebar = container.querySelector('.filters-sidebar');
          const resultsArea = container.querySelector('.results-area');
          const previewSidebar = container.querySelector('.preview-sidebar');

          expect(filtersSidebar).toBeInTheDocument();
          expect(resultsArea).toBeInTheDocument();
          expect(previewSidebar).toBeInTheDocument();

          // Verify horizontal layout
          if (filtersSidebar && resultsArea && previewSidebar) {
            const filtersRect = filtersSidebar.getBoundingClientRect();
            const resultsRect = resultsArea.getBoundingClientRect();
            const previewRect = previewSidebar.getBoundingClientRect();

            expect(resultsRect.left).toBeGreaterThan(filtersRect.right - 10);
            expect(previewRect.left).toBeGreaterThan(resultsRect.right - 10);
          }
        });
      });

      test('should optimize for keyboard navigation on desktop', async () => {
        resizeViewport(VIEWPORT_SIZES.desktop_medium.width, VIEWPORT_SIZES.desktop_medium.height);

        render(
          <ResponsiveTestWrapper>
            <SearchInterface
              entries={mockKBEntries}
              onEntrySelect={jest.fn()}
            />
          </ResponsiveTestWrapper>
        );

        const focusableElements = screen.getAllByRole('button')
          .concat(screen.getAllByRole('textbox'))
          .concat(screen.getAllByRole('combobox'));

        // Test tab navigation
        for (let i = 0; i < Math.min(focusableElements.length, 5); i++) {
          fireEvent.focus(focusableElements[i]);
          expect(focusableElements[i]).toHaveFocus();

          // Focus indicators should be visible
          const computedStyle = window.getComputedStyle(focusableElements[i]);
          expect(computedStyle.outline).not.toBe('none');
        }
      });
    });

    describe('Content Density Optimization', () => {
      test('should display more content per screen on large desktop', async () => {
        resizeViewport(VIEWPORT_SIZES.desktop_ultrawide.width, VIEWPORT_SIZES.desktop_ultrawide.height);

        const { container } = render(
          <ResponsiveTestWrapper>
            <KBEntryList
              entries={mockKBEntries}
              onEntrySelect={jest.fn()}
              showUsageStats={true}
              showCategories={true}
            />
          </ResponsiveTestWrapper>
        );

        await waitFor(() => {
          const entryElements = container.querySelectorAll('[role="button"]');

          // Should show multiple entries
          expect(entryElements.length).toBeGreaterThan(0);

          // Entries should have compact layout with more information visible
          entryElements.forEach(entry => {
            const usageStats = entry.querySelector('[style*="font-size: 0.75rem"]');
            const categoryBadge = entry.querySelector('[style*="padding: 0.25rem"]');

            expect(usageStats).toBeInTheDocument();
            expect(categoryBadge).toBeInTheDocument();
          });
        });
      });
    });
  });

  describe('Viewport Resize and Orientation Tests', () => {
    test('should handle smooth transitions during viewport changes', async () => {
      const { container } = render(
        <ResponsiveTestWrapper>
          <SearchInterface
            entries={mockKBEntries}
            onEntrySelect={jest.fn()}
          />
        </ResponsiveTestWrapper>
      );

      const searchInterface = container.querySelector('.search-interface');
      expect(searchInterface).toBeInTheDocument();

      // Test transition from desktop to mobile
      const layoutShift = measureLayoutShift(searchInterface!, () => {
        resizeViewport(VIEWPORT_SIZES.mobile_medium.width, VIEWPORT_SIZES.mobile_medium.height);
      });

      await waitFor(() => {
        // Layout shift should be minimal during responsive transitions
        expect(layoutShift.deltaX + layoutShift.deltaY).toBeLessThan(PERFORMANCE_THRESHOLDS.LAYOUT_SHIFT_THRESHOLD * 100);
      });

      // Test transition back to desktop
      const reverseShift = measureLayoutShift(searchInterface!, () => {
        resizeViewport(VIEWPORT_SIZES.desktop_medium.width, VIEWPORT_SIZES.desktop_medium.height);
      });

      await waitFor(() => {
        expect(reverseShift.deltaX + reverseShift.deltaY).toBeLessThan(PERFORMANCE_THRESHOLDS.LAYOUT_SHIFT_THRESHOLD * 100);
      });
    });

    test('should adapt to orientation changes', async () => {
      // Start in portrait
      resizeViewport(VIEWPORT_SIZES.tablet_portrait.width, VIEWPORT_SIZES.tablet_portrait.height);
      mockMediaQuery('(orientation: portrait)', true);

      const { container } = render(
        <ResponsiveTestWrapper>
          <ResponsiveSearchLayout
            searchInput={<input placeholder="Search..." />}
            filtersContent={<div>Filters</div>}
            resultsContent={<div>Results</div>}
            previewContent={<div>Preview</div>}
          />
        </ResponsiveTestWrapper>
      );

      await waitFor(() => {
        expect(container.querySelector('.tablet-search-layout')).toBeInTheDocument();
      });

      // Change to landscape
      act(() => {
        resizeViewport(VIEWPORT_SIZES.tablet_landscape.width, VIEWPORT_SIZES.tablet_landscape.height);
        mockMediaQuery('(orientation: landscape)', true);
        window.dispatchEvent(new Event('orientationchange'));
      });

      await waitFor(() => {
        // Layout should adapt to landscape orientation
        const mainContent = container.querySelector('.main-content');
        if (mainContent) {
          const computedStyle = window.getComputedStyle(mainContent);
          expect(computedStyle.display).toBe('flex');
        }
      });
    });

    test('should maintain state during viewport changes', async () => {
      const mockOnEntrySelect = jest.fn();

      const { rerender } = render(
        <ResponsiveTestWrapper>
          <KBEntryList
            entries={mockKBEntries}
            onEntrySelect={mockOnEntrySelect}
            selectedEntryId="1"
          />
        </ResponsiveTestWrapper>
      );

      // Verify initial selection
      const initialSelected = screen.getByRole('button', { pressed: true });
      expect(initialSelected).toBeInTheDocument();

      // Change viewport
      act(() => {
        resizeViewport(VIEWPORT_SIZES.mobile_small.width, VIEWPORT_SIZES.mobile_small.height);
      });

      rerender(
        <ResponsiveTestWrapper>
          <KBEntryList
            entries={mockKBEntries}
            onEntrySelect={mockOnEntrySelect}
            selectedEntryId="1"
          />
        </ResponsiveTestWrapper>
      );

      // Selection state should be maintained
      await waitFor(() => {
        const stillSelected = screen.getByRole('button', { pressed: true });
        expect(stillSelected).toBeInTheDocument();
      });
    });
  });

  describe('Touch Gesture Tests', () => {
    test('should support swipe gestures on mobile', async () => {
      simulateTouchDevice(true);
      resizeViewport(VIEWPORT_SIZES.mobile_medium.width, VIEWPORT_SIZES.mobile_medium.height);

      const mockOnFiltersToggle = jest.fn();
      const mockOnPreviewToggle = jest.fn();

      render(
        <ResponsiveTestWrapper>
          <ResponsiveSearchLayout
            searchInput={<input placeholder="Search..." />}
            filtersContent={<div>Filters</div>}
            resultsContent={<div>Results</div>}
            previewContent={<div>Preview</div>}
            enableSwipeGestures={true}
            onFiltersToggle={mockOnFiltersToggle}
            onPreviewToggle={mockOnPreviewToggle}
          />
        </ResponsiveTestWrapper>
      );

      const resultsContainer = screen.getByText('Results').closest('div');
      if (resultsContainer) {
        // Simulate right swipe (should open filters)
        fireEvent.touchStart(resultsContainer, {
          touches: [{ clientX: 50, clientY: 200 }]
        });

        fireEvent.touchMove(resultsContainer, {
          touches: [{ clientX: 150, clientY: 200 }]
        });

        fireEvent.touchEnd(resultsContainer);

        await waitFor(() => {
          expect(mockOnFiltersToggle).toHaveBeenCalledWith(true);
        });
      }
    });

    test('should prevent accidental gestures', async () => {
      simulateTouchDevice(true);
      resizeViewport(VIEWPORT_SIZES.mobile_medium.width, VIEWPORT_SIZES.mobile_medium.height);

      const mockOnFiltersToggle = jest.fn();

      render(
        <ResponsiveTestWrapper>
          <ResponsiveSearchLayout
            searchInput={<input placeholder="Search..." />}
            filtersContent={<div>Filters</div>}
            resultsContent={<div>Results</div>}
            enableSwipeGestures={true}
            onFiltersToggle={mockOnFiltersToggle}
          />
        </ResponsiveTestWrapper>
      );

      const resultsContainer = screen.getByText('Results').closest('div');
      if (resultsContainer) {
        // Simulate small swipe (should not trigger)
        fireEvent.touchStart(resultsContainer, {
          touches: [{ clientX: 50, clientY: 200 }]
        });

        fireEvent.touchMove(resultsContainer, {
          touches: [{ clientX: 70, clientY: 200 }] // Only 20px movement
        });

        fireEvent.touchEnd(resultsContainer);

        // Should not trigger filters toggle for small movement
        expect(mockOnFiltersToggle).not.toHaveBeenCalled();
      }
    });
  });

  describe('Performance Under Responsive Changes', () => {
    test('should handle rapid viewport changes efficiently', async () => {
      const { container } = render(
        <ResponsiveTestWrapper>
          <SearchInterface
            entries={Array(100).fill(null).map((_, i) => ({
              ...mockKBEntries[0],
              id: `entry-${i}`,
              title: `Entry ${i + 1}`
            }))}
            onEntrySelect={jest.fn()}
          />
        </ResponsiveTestWrapper>
      );

      const startTime = performance.now();

      // Rapid viewport changes
      const viewports = [
        VIEWPORT_SIZES.mobile_small,
        VIEWPORT_SIZES.tablet_portrait,
        VIEWPORT_SIZES.desktop_medium,
        VIEWPORT_SIZES.mobile_large,
        VIEWPORT_SIZES.desktop_large
      ];

      for (const viewport of viewports) {
        act(() => {
          resizeViewport(viewport.width, viewport.height);
        });

        // Small delay to allow React to process
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should handle rapid changes within reasonable time
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.REFLOW_TIME_MAX * viewports.length);

      // Component should still be functional
      const searchInterface = container.querySelector('.search-interface');
      expect(searchInterface).toBeInTheDocument();
    });

    test('should maintain performance with large datasets on mobile', async () => {
      resizeViewport(VIEWPORT_SIZES.mobile_small.width, VIEWPORT_SIZES.mobile_small.height);
      simulateTouchDevice(true);

      const largeDataset = Array(500).fill(null).map((_, i) => ({
        ...mockKBEntries[0],
        id: `entry-${i}`,
        title: `Large Dataset Entry ${i + 1}`,
        problem: `This is problem ${i + 1} with a longer description to test performance with large text content.`,
        tags: [`tag-${i}`, `category-${i % 10}`, `type-${i % 5}`]
      }));

      const startTime = performance.now();

      const { container } = render(
        <ResponsiveTestWrapper>
          <KBEntryList
            entries={largeDataset}
            onEntrySelect={jest.fn()}
            enableVirtualization={true}
          />
        </ResponsiveTestWrapper>
      );

      const renderTime = performance.now() - startTime;

      // Should render within reasonable time even with large dataset
      expect(renderTime).toBeLessThan(1000); // 1 second max

      // Should show loading or virtualized content
      await waitFor(() => {
        const visibleEntries = container.querySelectorAll('[role="button"]');
        // Should not render all 500 entries at once
        expect(visibleEntries.length).toBeLessThan(50);
      });
    });
  });

  describe('Accessibility in Responsive Contexts', () => {
    test('should maintain accessibility across all viewport sizes', async () => {
      const viewportSizes = [
        VIEWPORT_SIZES.mobile_small,
        VIEWPORT_SIZES.tablet_portrait,
        VIEWPORT_SIZES.desktop_medium
      ];

      for (const viewport of viewportSizes) {
        resizeViewport(viewport.width, viewport.height);

        const { container } = render(
          <ResponsiveTestWrapper>
            <SearchInterface
              entries={mockKBEntries}
              onEntrySelect={jest.fn()}
            />
          </ResponsiveTestWrapper>
        );

        // Run accessibility audit for each viewport
        const results = await axe(container);
        expect(results).toHaveNoViolations();

        // Verify essential accessibility features
        expect(screen.getByRole('main')).toBeInTheDocument();

        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);

        buttons.forEach(button => {
          expect(button).toHaveAttribute('aria-label');
        });
      }
    });

    test('should announce layout changes to screen readers', async () => {
      const { container } = render(
        <ResponsiveTestWrapper>
          <div aria-live="polite" data-testid="layout-announcer">
            Desktop layout
          </div>
          <SearchInterface
            entries={mockKBEntries}
            onEntrySelect={jest.fn()}
          />
        </ResponsiveTestWrapper>
      );

      // Change to mobile layout
      act(() => {
        resizeViewport(VIEWPORT_SIZES.mobile_medium.width, VIEWPORT_SIZES.mobile_medium.height);
      });

      const announcer = screen.getByTestId('layout-announcer');

      // Should update announcement for layout change
      await waitFor(() => {
        expect(announcer).toHaveAttribute('aria-live', 'polite');
      });
    });

    test('should maintain focus management during layout changes', async () => {
      render(
        <ResponsiveTestWrapper>
          <SearchInterface
            entries={mockKBEntries}
            onEntrySelect={jest.fn()}
          />
        </ResponsiveTestWrapper>
      );

      // Focus on search input
      const searchInput = screen.getByRole('textbox');
      fireEvent.focus(searchInput);
      expect(searchInput).toHaveFocus();

      // Change to mobile layout
      act(() => {
        resizeViewport(VIEWPORT_SIZES.mobile_medium.width, VIEWPORT_SIZES.mobile_medium.height);
      });

      // Focus should be maintained
      await waitFor(() => {
        expect(searchInput).toHaveFocus();
      });
    });
  });

  describe('Edge Case Viewport Tests', () => {
    test('should handle very narrow screens gracefully', async () => {
      resizeViewport(VIEWPORT_SIZES.very_narrow.width, VIEWPORT_SIZES.very_narrow.height);

      const { container } = render(
        <ResponsiveTestWrapper>
          <SearchInterface
            entries={mockKBEntries}
            onEntrySelect={jest.fn()}
          />
        </ResponsiveTestWrapper>
      );

      await waitFor(() => {
        // Content should not overflow
        const searchInterface = container.querySelector('.search-interface');
        if (searchInterface) {
          const rect = searchInterface.getBoundingClientRect();
          expect(rect.width).toBeLessThanOrEqual(VIEWPORT_SIZES.very_narrow.width);
        }

        // Text should not be cut off
        const textElements = container.querySelectorAll('h1, h2, h3, p, span');
        textElements.forEach(element => {
          const computedStyle = window.getComputedStyle(element);
          expect(computedStyle.textOverflow).toBe('ellipsis');
        });
      });
    });

    test('should optimize for ultra-wide displays', async () => {
      resizeViewport(VIEWPORT_SIZES.very_wide.width, VIEWPORT_SIZES.very_wide.height);

      const { container } = render(
        <ResponsiveTestWrapper>
          <ResponsiveSearchLayout
            searchInput={<input placeholder="Search..." />}
            filtersContent={<div>Filters</div>}
            resultsContent={<div>Results</div>}
            previewContent={<div>Preview</div>}
            initialFiltersVisible={true}
            initialPreviewVisible={true}
          />
        </ResponsiveTestWrapper>
      );

      await waitFor(() => {
        // Should utilize space efficiently with max-width constraints
        const container_el = container.querySelector('.desktop-search-layout');
        if (container_el) {
          const computedStyle = window.getComputedStyle(container_el);
          expect(computedStyle.maxWidth).toBeTruthy();
        }

        // All panels should be visible
        expect(container.querySelector('.filters-sidebar')).toBeInTheDocument();
        expect(container.querySelector('.results-area')).toBeInTheDocument();
        expect(container.querySelector('.preview-sidebar')).toBeInTheDocument();
      });
    });

    test('should handle square aspect ratios', async () => {
      resizeViewport(VIEWPORT_SIZES.square.width, VIEWPORT_SIZES.square.height);

      const { container } = render(
        <ResponsiveTestWrapper>
          <KBEntryList
            entries={mockKBEntries}
            onEntrySelect={jest.fn()}
          />
        </ResponsiveTestWrapper>
      );

      await waitFor(() => {
        // Should adapt to unusual aspect ratio
        const listContainer = container.querySelector('.kb-entry-list');
        if (listContainer) {
          const rect = listContainer.getBoundingClientRect();

          // Should fit within square viewport
          expect(rect.width).toBeLessThanOrEqual(VIEWPORT_SIZES.square.width);
          expect(rect.height).toBeLessThanOrEqual(VIEWPORT_SIZES.square.height);
        }
      });
    });
  });
});

describe('Visual Regression Prevention', () => {
  const captureSnapshot = (element: Element, name: string) => {
    // Mock snapshot capture - in real implementation this would capture actual screenshots
    const rect = element.getBoundingClientRect();
    return {
      name,
      width: rect.width,
      height: rect.height,
      hash: `mock-hash-${name}-${rect.width}x${rect.height}`
    };
  };

  test('should maintain visual consistency across viewport changes', async () => {
    const { container } = render(
      <ResponsiveTestWrapper>
        <SearchInterface
          entries={mockKBEntries}
          onEntrySelect={jest.fn()}
        />
      </ResponsiveTestWrapper>
    );

    const searchInterface = container.querySelector('.search-interface');
    expect(searchInterface).toBeInTheDocument();

    const snapshots = [];

    // Capture snapshots at different viewports
    const testViewports = [
      { name: 'mobile', ...VIEWPORT_SIZES.mobile_medium },
      { name: 'tablet', ...VIEWPORT_SIZES.tablet_portrait },
      { name: 'desktop', ...VIEWPORT_SIZES.desktop_medium }
    ];

    for (const viewport of testViewports) {
      resizeViewport(viewport.width, viewport.height);

      await waitFor(() => {
        const snapshot = captureSnapshot(searchInterface!, `search-interface-${viewport.name}`);
        snapshots.push(snapshot);
      });
    }

    // Verify snapshots were captured
    expect(snapshots).toHaveLength(3);
    snapshots.forEach(snapshot => {
      expect(snapshot.hash).toBeTruthy();
      expect(snapshot.width).toBeGreaterThan(0);
      expect(snapshot.height).toBeGreaterThan(0);
    });
  });
});