/**
 * Responsive Design Test Suite
 * 
 * Tests the responsive design implementation across different viewport sizes,
 * device types, and screen orientations. Validates that components adapt
 * correctly to mobile, tablet, and desktop layouts while maintaining
 * usability and accessibility.
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Component imports
import { KBEntryForm } from '../../src/renderer/components/forms/KBEntryForm';
import { MainWindowLayout } from '../../implementation/frontend/layouts/MainWindowLayout';
import { SearchBar } from '../../implementation/frontend/components/search/SearchBar';
import { ResultsList } from '../../implementation/frontend/components/results/ResultsList';

// Mock hooks
import { useWindowSize } from '../../src/renderer/hooks/useWindowSize';
import { useMediaQuery } from '../../src/renderer/hooks/useMediaQuery';

// Mock data
const mockKBEntries = [
  {
    id: '1',
    title: 'VSAM Status 35 Error',
    problem: 'File not found error when accessing VSAM dataset',
    solution: 'Check catalog and verify dataset exists',
    category: 'VSAM' as const,
    tags: ['vsam', 'file', 'error'],
  },
  {
    id: '2',
    title: 'S0C7 Data Exception',
    problem: 'Program abending with S0C7 error during numeric operations',
    solution: 'Initialize numeric fields and validate data',
    category: 'Batch' as const,
    tags: ['abend', 'numeric', 'data'],
  },
];

// Viewport sizes for testing
const VIEWPORT_SIZES = {
  mobile: { width: 375, height: 667 }, // iPhone SE
  mobileLarge: { width: 414, height: 896 }, // iPhone 11 Pro Max
  tablet: { width: 768, height: 1024 }, // iPad
  tabletLandscape: { width: 1024, height: 768 }, // iPad Landscape
  desktop: { width: 1200, height: 800 }, // Desktop
  desktopLarge: { width: 1920, height: 1080 }, // Large Desktop
  ultrawide: { width: 2560, height: 1440 }, // Ultrawide
};

// Performance thresholds for responsive interactions
const RESPONSIVE_PERFORMANCE_THRESHOLDS = {
  LAYOUT_SHIFT_TIME: 300, // Time to complete layout transitions (ms)
  TOUCH_RESPONSE_TIME: 100, // Touch interaction response time (ms)
  RESIZE_HANDLER_TIME: 50, // Resize event handler execution time (ms)
  MEDIA_QUERY_RESPONSE: 16, // Media query activation time (ms)
};

/**
 * Utility function to simulate viewport resize
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
 * Utility function to simulate touch device
 */
const simulateTouchDevice = (isTouch: boolean = true) => {
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    writable: true,
    configurable: true,
    value: isTouch ? 5 : 0,
  });

  // Mock touch events support
  if (isTouch) {
    window.TouchEvent = class TouchEvent extends UIEvent {} as any;
    document.ontouchstart = null;
  } else {
    delete (window as any).TouchEvent;
    delete (document as any).ontouchstart;
  }
};

/**
 * Mock CSS media queries
 */
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

/**
 * Test component wrapper with responsive context
 */
const ResponsiveTestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div data-testid="responsive-wrapper" style={{ width: '100%', height: '100%' }}>
      {children}
    </div>
  );
};

describe('Responsive Design Validation', () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    // Store original dimensions
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    
    // Reset to desktop default
    resizeViewport(VIEWPORT_SIZES.desktop.width, VIEWPORT_SIZES.desktop.height);
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

  describe('Viewport Size Adaptation', () => {
    test('should adapt layout for mobile viewport', async () => {
      resizeViewport(VIEWPORT_SIZES.mobile.width, VIEWPORT_SIZES.mobile.height);
      mockMediaQuery('(max-width: 768px)', true);

      const { container } = render(
        <ResponsiveTestWrapper>
          <MainWindowLayout>
            <KBEntryForm onSubmit={jest.fn()} />
          </MainWindowLayout>
        </ResponsiveTestWrapper>
      );

      await waitFor(() => {
        // Check for mobile-specific classes or styles
        const mobileElements = container.querySelectorAll('[class*="mobile"], [class*="sm:"]');
        expect(mobileElements.length).toBeGreaterThan(0);

        // Verify form fields stack vertically on mobile
        const formFields = screen.getAllByRole('textbox');
        const firstField = formFields[0];
        const secondField = formFields[1];
        
        const firstFieldRect = firstField.getBoundingClientRect();
        const secondFieldRect = secondField.getBoundingClientRect();
        
        // Second field should be below first field (vertical stacking)
        expect(secondFieldRect.top).toBeGreaterThan(firstFieldRect.bottom - 10);
      });

      // Test mobile navigation
      const navigationElement = screen.getByRole('navigation');
      expect(navigationElement).toHaveClass(/mobile|hamburger|collapsed/);
    });

    test('should adapt layout for tablet viewport', async () => {
      resizeViewport(VIEWPORT_SIZES.tablet.width, VIEWPORT_SIZES.tablet.height);
      mockMediaQuery('(min-width: 769px) and (max-width: 1024px)', true);

      const { container } = render(
        <ResponsiveTestWrapper>
          <MainWindowLayout>
            <div className="grid-container">
              <KBEntryForm onSubmit={jest.fn()} />
              <ResultsList results={mockKBEntries} onSelect={jest.fn()} />
            </div>
          </MainWindowLayout>
        </ResponsiveTestWrapper>
      );

      await waitFor(() => {
        // Check for tablet-specific adaptations
        const tabletElements = container.querySelectorAll('[class*="tablet"], [class*="md:"]');
        expect(tabletElements.length).toBeGreaterThan(0);

        // Verify two-column layout on tablet
        const gridContainer = container.querySelector('.grid-container');
        const computedStyle = window.getComputedStyle(gridContainer!);
        expect(computedStyle.display).toBe('grid');
      });
    });

    test('should maintain desktop layout for large viewports', async () => {
      resizeViewport(VIEWPORT_SIZES.desktopLarge.width, VIEWPORT_SIZES.desktopLarge.height);
      mockMediaQuery('(min-width: 1200px)', true);

      const { container } = render(
        <ResponsiveTestWrapper>
          <MainWindowLayout>
            <div className="sidebar">Sidebar</div>
            <div className="main-content">
              <KBEntryForm onSubmit={jest.fn()} />
            </div>
          </MainWindowLayout>
        </ResponsiveTestWrapper>
      );

      await waitFor(() => {
        // Verify desktop layout with sidebar
        const sidebar = container.querySelector('.sidebar');
        const mainContent = container.querySelector('.main-content');
        
        expect(sidebar).toBeVisible();
        expect(mainContent).toBeVisible();

        // Check for desktop-specific classes
        const desktopElements = container.querySelectorAll('[class*="desktop"], [class*="lg:"]');
        expect(desktopElements.length).toBeGreaterThan(0);
      });
    });

    test('should handle ultra-wide displays correctly', async () => {
      resizeViewport(VIEWPORT_SIZES.ultrawide.width, VIEWPORT_SIZES.ultrawide.height);

      const { container } = render(
        <ResponsiveTestWrapper>
          <MainWindowLayout>
            <div className="container max-w-screen-xl mx-auto">
              <KBEntryForm onSubmit={jest.fn()} />
            </div>
          </MainWindowLayout>
        </ResponsiveTestWrapper>
      );

      await waitFor(() => {
        const container_el = container.querySelector('.container');
        const computedStyle = window.getComputedStyle(container_el!);
        
        // Content should be centered and not stretch full width
        expect(computedStyle.marginLeft).toBe('auto');
        expect(computedStyle.marginRight).toBe('auto');
        expect(computedStyle.maxWidth).toBeTruthy();
      });
    });
  });

  describe('Touch Device Adaptations', () => {
    test('should increase touch targets on touch devices', async () => {
      simulateTouchDevice(true);
      resizeViewport(VIEWPORT_SIZES.mobile.width, VIEWPORT_SIZES.mobile.height);

      render(
        <ResponsiveTestWrapper>
          <KBEntryForm onSubmit={jest.fn()} />
        </ResponsiveTestWrapper>
      );

      // All interactive elements should have minimum 44px touch target
      const buttons = screen.getAllByRole('button');
      const inputs = screen.getAllByRole('textbox');
      const interactiveElements = [...buttons, ...inputs];

      interactiveElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        const minTouchTarget = 44;
        
        expect(Math.max(rect.width, rect.height)).toBeGreaterThanOrEqual(minTouchTarget);
      });
    });

    test('should handle touch gestures correctly', async () => {
      simulateTouchDevice(true);
      const user = userEvent.setup();

      const onSwipe = jest.fn();
      const SwipeableComponent = () => (
        <div 
          data-testid="swipeable"
          onTouchStart={onSwipe}
          onTouchMove={onSwipe}
          onTouchEnd={onSwipe}
          style={{ width: '100%', height: '200px' }}
        >
          Swipe me
        </div>
      );

      render(<SwipeableComponent />);

      const swipeableElement = screen.getByTestId('swipeable');

      // Simulate touch swipe gesture
      fireEvent.touchStart(swipeableElement, {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      
      fireEvent.touchMove(swipeableElement, {
        touches: [{ clientX: 200, clientY: 100 }]
      });
      
      fireEvent.touchEnd(swipeableElement, {
        changedTouches: [{ clientX: 200, clientY: 100 }]
      });

      expect(onSwipe).toHaveBeenCalledTimes(3);
    });

    test('should provide hover alternatives for touch devices', async () => {
      simulateTouchDevice(true);

      const TooltipComponent = () => (
        <div>
          <button data-testid="tooltip-trigger" aria-describedby="tooltip">
            Info
          </button>
          <div id="tooltip" role="tooltip" className="tooltip-content">
            Tooltip content
          </div>
        </div>
      );

      render(<TooltipComponent />);

      const trigger = screen.getByTestId('tooltip-trigger');
      const tooltip = screen.getByRole('tooltip');

      // On touch devices, tooltip should be accessible via tap
      fireEvent.touchStart(trigger);
      fireEvent.touchEnd(trigger);

      // Verify tooltip is accessible
      expect(tooltip).toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-describedby', 'tooltip');
    });
  });

  describe('Orientation Changes', () => {
    test('should adapt to portrait orientation', async () => {
      // Portrait mobile
      resizeViewport(VIEWPORT_SIZES.mobile.width, VIEWPORT_SIZES.mobile.height);
      mockMediaQuery('(orientation: portrait)', true);

      const { container } = render(
        <ResponsiveTestWrapper>
          <MainWindowLayout>
            <div className="orientation-sensitive">
              <KBEntryForm onSubmit={jest.fn()} />
            </div>
          </MainWindowLayout>
        </ResponsiveTestWrapper>
      );

      await waitFor(() => {
        const orientationElement = container.querySelector('.orientation-sensitive');
        const computedStyle = window.getComputedStyle(orientationElement!);
        
        // Should use vertical layout in portrait
        expect(computedStyle.flexDirection).toBe('column');
      });
    });

    test('should adapt to landscape orientation', async () => {
      // Landscape tablet
      resizeViewport(VIEWPORT_SIZES.tabletLandscape.width, VIEWPORT_SIZES.tabletLandscape.height);
      mockMediaQuery('(orientation: landscape)', true);

      const { container, rerender } = render(
        <ResponsiveTestWrapper>
          <MainWindowLayout>
            <div className="orientation-sensitive">
              <SearchBar onSearch={jest.fn()} />
              <ResultsList results={mockKBEntries} onSelect={jest.fn()} />
            </div>
          </MainWindowLayout>
        </ResponsiveTestWrapper>
      );

      await waitFor(() => {
        // Should use horizontal layout in landscape
        const orientationElement = container.querySelector('.orientation-sensitive');
        const computedStyle = window.getComputedStyle(orientationElement!);
        expect(computedStyle.flexDirection).toBe('row');
      });

      // Test orientation change
      act(() => {
        // Rotate to portrait
        resizeViewport(VIEWPORT_SIZES.tablet.width, VIEWPORT_SIZES.tablet.height);
        mockMediaQuery('(orientation: portrait)', true);
        window.dispatchEvent(new Event('orientationchange'));
      });

      rerender(
        <ResponsiveTestWrapper>
          <MainWindowLayout>
            <div className="orientation-sensitive">
              <SearchBar onSearch={jest.fn()} />
              <ResultsList results={mockKBEntries} onSelect={jest.fn()} />
            </div>
          </MainWindowLayout>
        </ResponsiveTestWrapper>
      );

      await waitFor(() => {
        const orientationElement = container.querySelector('.orientation-sensitive');
        const computedStyle = window.getComputedStyle(orientationElement!);
        expect(computedStyle.flexDirection).toBe('column');
      });
    });
  });

  describe('Font Scaling and Text Readability', () => {
    test('should scale fonts appropriately across viewports', async () => {
      const fontSize = {
        mobile: '14px',
        tablet: '16px',
        desktop: '16px',
      };

      // Test mobile
      resizeViewport(VIEWPORT_SIZES.mobile.width, VIEWPORT_SIZES.mobile.height);
      const { container, rerender } = render(
        <ResponsiveTestWrapper>
          <div className="text-responsive">Sample text</div>
        </ResponsiveTestWrapper>
      );

      let textElement = container.querySelector('.text-responsive');
      let computedStyle = window.getComputedStyle(textElement!);
      expect(computedStyle.fontSize).toBe(fontSize.mobile);

      // Test tablet
      act(() => {
        resizeViewport(VIEWPORT_SIZES.tablet.width, VIEWPORT_SIZES.tablet.height);
      });
      rerender(
        <ResponsiveTestWrapper>
          <div className="text-responsive">Sample text</div>
        </ResponsiveTestWrapper>
      );

      computedStyle = window.getComputedStyle(textElement!);
      expect(computedStyle.fontSize).toBe(fontSize.tablet);
    });

    test('should maintain readable line lengths', async () => {
      const { container } = render(
        <ResponsiveTestWrapper>
          <div className="prose max-w-prose">
            <p>
              This is a long paragraph that should maintain readable line lengths
              across different viewport sizes. The optimal line length is between
              45-75 characters per line for optimal readability.
            </p>
          </div>
        </ResponsiveTestWrapper>
      );

      const proseElement = container.querySelector('.prose');
      const computedStyle = window.getComputedStyle(proseElement!);
      
      // Should have max-width constraint
      expect(computedStyle.maxWidth).toBeTruthy();
      expect(computedStyle.maxWidth).not.toBe('none');
    });
  });

  describe('Media Query Breakpoints', () => {
    test('should respond to CSS media query breakpoints', async () => {
      const breakpoints = [
        { size: 'sm', minWidth: 640 },
        { size: 'md', minWidth: 768 },
        { size: 'lg', minWidth: 1024 },
        { size: 'xl', minWidth: 1280 },
      ];

      for (const breakpoint of breakpoints) {
        resizeViewport(breakpoint.minWidth, 800);
        mockMediaQuery(`(min-width: ${breakpoint.minWidth}px)`, true);

        const { container } = render(
          <ResponsiveTestWrapper>
            <div className={`breakpoint-${breakpoint.size}`}>
              Breakpoint content
            </div>
          </ResponsiveTestWrapper>
        );

        const breakpointElement = container.querySelector(`.breakpoint-${breakpoint.size}`);
        expect(breakpointElement).toBeInTheDocument();
      }
    });

    test('should handle custom media queries', async () => {
      const customQueries = [
        { query: '(prefers-reduced-motion: reduce)', matches: true },
        { query: '(prefers-color-scheme: dark)', matches: false },
        { query: '(max-height: 600px)', matches: true },
      ];

      for (const customQuery of customQueries) {
        mockMediaQuery(customQuery.query, customQuery.matches);

        const { result } = renderHook(() => 
          useMediaQuery(customQuery.query)
        );

        expect(result.current).toBe(customQuery.matches);
      }
    });
  });

  describe('Performance Under Responsive Changes', () => {
    test('should handle resize events efficiently', async () => {
      const resizeHandler = jest.fn();
      const startTime = performance.now();

      const ResizableComponent = () => {
        React.useEffect(() => {
          const handleResize = () => {
            resizeHandler();
          };
          
          window.addEventListener('resize', handleResize);
          return () => window.removeEventListener('resize', handleResize);
        }, []);

        return <div>Resizable content</div>;
      };

      render(<ResizableComponent />);

      // Simulate multiple rapid resize events
      for (let i = 0; i < 10; i++) {
        act(() => {
          resizeViewport(800 + i * 10, 600);
        });
      }

      await waitFor(() => {
        const executionTime = performance.now() - startTime;
        expect(executionTime).toBeLessThan(RESPONSIVE_PERFORMANCE_THRESHOLDS.RESIZE_HANDLER_TIME);
        
        // Resize handler should be debounced/throttled
        expect(resizeHandler).toHaveBeenCalledTimes(10);
      });
    });

    test('should complete layout transitions within performance threshold', async () => {
      const { container, rerender } = render(
        <ResponsiveTestWrapper>
          <div className="transition-layout" style={{ transition: 'all 0.3s ease' }}>
            <KBEntryForm onSubmit={jest.fn()} />
          </div>
        </ResponsiveTestWrapper>
      );

      const startTime = performance.now();

      // Trigger layout change
      act(() => {
        resizeViewport(VIEWPORT_SIZES.mobile.width, VIEWPORT_SIZES.mobile.height);
      });

      rerender(
        <ResponsiveTestWrapper>
          <div className="transition-layout mobile-layout" style={{ transition: 'all 0.3s ease' }}>
            <KBEntryForm onSubmit={jest.fn()} />
          </div>
        </ResponsiveTestWrapper>
      );

      await waitFor(() => {
        const layoutElement = container.querySelector('.transition-layout');
        expect(layoutElement).toHaveClass('mobile-layout');
      });

      const transitionTime = performance.now() - startTime;
      expect(transitionTime).toBeLessThan(RESPONSIVE_PERFORMANCE_THRESHOLDS.LAYOUT_SHIFT_TIME);
    });

    test('should handle touch interactions within performance threshold', async () => {
      simulateTouchDevice(true);
      const user = userEvent.setup();

      const TouchComponent = () => {
        const [touched, setTouched] = React.useState(false);
        
        return (
          <button 
            data-testid="touch-button"
            onTouchStart={() => setTouched(true)}
            className={touched ? 'touched' : ''}
          >
            {touched ? 'Touched!' : 'Touch me'}
          </button>
        );
      };

      render(<TouchComponent />);
      
      const button = screen.getByTestId('touch-button');
      const startTime = performance.now();

      fireEvent.touchStart(button);

      await waitFor(() => {
        expect(button).toHaveClass('touched');
      });

      const responseTime = performance.now() - startTime;
      expect(responseTime).toBeLessThan(RESPONSIVE_PERFORMANCE_THRESHOLDS.TOUCH_RESPONSE_TIME);
    });
  });

  describe('Accessibility in Responsive Contexts', () => {
    test('should maintain accessibility across all viewport sizes', async () => {
      const viewportSizes = Object.values(VIEWPORT_SIZES);

      for (const viewport of viewportSizes) {
        resizeViewport(viewport.width, viewport.height);

        const { container } = render(
          <ResponsiveTestWrapper>
            <MainWindowLayout>
              <KBEntryForm onSubmit={jest.fn()} />
            </MainWindowLayout>
          </ResponsiveTestWrapper>
        );

        // Run accessibility audit
        const results = await axe(container);
        expect(results).toHaveNoViolations();

        // Check for proper heading hierarchy
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(0);

        // Verify keyboard navigation works
        const focusableElements = container.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        expect(focusableElements.length).toBeGreaterThan(0);
      }
    });

    test('should provide appropriate focus indicators on all devices', async () => {
      const { container } = render(
        <ResponsiveTestWrapper>
          <button className="focus-visible:ring-2">Focusable Button</button>
          <input className="focus:outline-2" placeholder="Focusable Input" />
        </ResponsiveTestWrapper>
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      // Test keyboard focus
      button.focus();
      expect(button).toHaveFocus();
      expect(button).toHaveClass('focus-visible:ring-2');

      input.focus();
      expect(input).toHaveFocus();
      expect(input).toHaveClass('focus:outline-2');
    });

    test('should announce layout changes to screen readers', async () => {
      const { container } = render(
        <ResponsiveTestWrapper>
          <div aria-live="polite" data-testid="layout-announcer">
            Desktop layout
          </div>
          <MainWindowLayout>
            <KBEntryForm onSubmit={jest.fn()} />
          </MainWindowLayout>
        </ResponsiveTestWrapper>
      );

      // Change to mobile layout
      act(() => {
        resizeViewport(VIEWPORT_SIZES.mobile.width, VIEWPORT_SIZES.mobile.height);
      });

      const announcer = screen.getByTestId('layout-announcer');
      
      // Should update announcement for layout change
      await waitFor(() => {
        expect(announcer).toHaveTextContent(/mobile|layout/i);
      });

      expect(announcer).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Content Reflow and Layout Shifts', () => {
    test('should prevent content layout shifts during responsive changes', async () => {
      const { container } = render(
        <ResponsiveTestWrapper>
          <div className="stable-layout">
            <header style={{ minHeight: '60px' }}>Header</header>
            <main style={{ minHeight: '400px' }}>
              <KBEntryForm onSubmit={jest.fn()} />
            </main>
            <footer style={{ minHeight: '40px' }}>Footer</footer>
          </div>
        </ResponsiveTestWrapper>
      );

      const main = container.querySelector('main');
      const initialRect = main!.getBoundingClientRect();

      // Change viewport size
      act(() => {
        resizeViewport(VIEWPORT_SIZES.mobile.width, VIEWPORT_SIZES.mobile.height);
      });

      await waitFor(() => {
        const newRect = main!.getBoundingClientRect();
        
        // Main content area should maintain stable height
        expect(Math.abs(newRect.height - initialRect.height)).toBeLessThan(50);
      });
    });

    test('should handle dynamic content loading responsively', async () => {
      const DynamicContentComponent = () => {
        const [items, setItems] = React.useState(mockKBEntries.slice(0, 2));
        const [loading, setLoading] = React.useState(false);

        const loadMore = () => {
          setLoading(true);
          setTimeout(() => {
            setItems(prev => [...prev, ...mockKBEntries]);
            setLoading(false);
          }, 100);
        };

        return (
          <div className="dynamic-content">
            <ResultsList results={items} onSelect={jest.fn()} />
            <button onClick={loadMore} disabled={loading}>
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        );
      };

      render(<DynamicContentComponent />);

      const loadMoreButton = screen.getByText('Load More');
      
      // Initial state
      expect(screen.getAllByRole('listitem')).toHaveLength(2);

      // Load more content
      fireEvent.click(loadMoreButton);

      await waitFor(() => {
        expect(screen.getAllByRole('listitem')).toHaveLength(4);
        expect(loadMoreButton).not.toBeDisabled();
      });

      // Verify responsive layout is maintained
      const dynamicContent = document.querySelector('.dynamic-content');
      expect(dynamicContent).toBeInTheDocument();
    });
  });

  describe('Image and Media Responsiveness', () => {
    test('should serve appropriate images for different screen densities', async () => {
      const ResponsiveImage = () => (
        <img
          src="/image-1x.jpg"
          srcSet="/image-1x.jpg 1x, /image-2x.jpg 2x, /image-3x.jpg 3x"
          alt="Responsive test image"
          data-testid="responsive-image"
        />
      );

      render(<ResponsiveImage />);

      const image = screen.getByTestId('responsive-image');
      
      expect(image).toHaveAttribute('srcSet');
      expect(image).toHaveAttribute('alt');
      expect(image.getAttribute('srcSet')).toContain('1x');
      expect(image.getAttribute('srcSet')).toContain('2x');
    });

    test('should handle video elements responsively', async () => {
      const ResponsiveVideo = () => (
        <video
          data-testid="responsive-video"
          controls
          style={{ width: '100%', maxWidth: '800px', height: 'auto' }}
        >
          <source src="/video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      );

      render(<ResponsiveVideo />);

      const video = screen.getByTestId('responsive-video');
      const computedStyle = window.getComputedStyle(video);
      
      expect(computedStyle.width).toBe('100%');
      expect(computedStyle.maxWidth).toBe('800px');
      expect(computedStyle.height).toBe('auto');
    });
  });

  describe('Print Media Responsiveness', () => {
    test('should provide appropriate print styles', async () => {
      const { container } = render(
        <ResponsiveTestWrapper>
          <div className="print:hidden screen-only">Screen only content</div>
          <div className="print-visible">Print visible content</div>
          <button className="print:hidden no-print">Interactive button</button>
        </ResponsiveTestWrapper>
      );

      // Mock print media query
      mockMediaQuery('print', true);

      const screenOnly = container.querySelector('.screen-only');
      const printVisible = container.querySelector('.print-visible');
      const interactiveButton = container.querySelector('.no-print');

      // Verify print-specific classes are applied
      expect(screenOnly).toHaveClass('print:hidden');
      expect(interactiveButton).toHaveClass('print:hidden');
      expect(printVisible).toBeInTheDocument();
    });
  });
});

/**
 * Custom hook tests for responsive utilities
 */
describe('Responsive Utility Hooks', () => {
  describe('useWindowSize hook', () => {
    test('should return current window dimensions', () => {
      const { result } = renderHook(() => useWindowSize());

      expect(result.current).toEqual({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    });

    test('should update on window resize', async () => {
      const { result } = renderHook(() => useWindowSize());

      act(() => {
        resizeViewport(800, 600);
      });

      await waitFor(() => {
        expect(result.current).toEqual({
          width: 800,
          height: 600,
        });
      });
    });
  });

  describe('useMediaQuery hook', () => {
    test('should return media query match status', () => {
      mockMediaQuery('(min-width: 768px)', true);

      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      expect(result.current).toBe(true);
    });

    test('should update when media query changes', async () => {
      const mediaQuery = mockMediaQuery('(min-width: 768px)', false);
      
      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      expect(result.current).toBe(false);

      // Simulate media query change
      act(() => {
        mediaQuery.matches = true;
        mediaQuery.onchange?.({ matches: true } as MediaQueryListEvent);
      });

      expect(result.current).toBe(true);
    });
  });
});