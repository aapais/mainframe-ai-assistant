/**
 * Responsive Design Validation Test Suite
 * Tests UI behavior across different screen sizes and devices
 */

import { test, expect, Page, Browser } from '@playwright/test';

interface ResponsiveTestContext {
  page: Page;
  baseURL: string;
}

const BREAKPOINTS = {
  mobile: { width: 375, height: 667, name: 'Mobile (iPhone SE)' },
  mobileLarge: { width: 414, height: 896, name: 'Mobile Large (iPhone 11)' },
  tablet: { width: 768, height: 1024, name: 'Tablet (iPad)' },
  tabletLarge: { width: 1024, height: 768, name: 'Tablet Large (iPad Pro)' },
  desktop: { width: 1280, height: 720, name: 'Desktop' },
  desktopLarge: { width: 1920, height: 1080, name: 'Desktop Large' },
  ultrawide: { width: 2560, height: 1440, name: 'Ultrawide' }
};

const DEVICE_CONFIGURATIONS = [
  { name: 'iPhone SE', width: 375, height: 667, deviceScaleFactor: 2, isMobile: true },
  { name: 'iPhone 12', width: 390, height: 844, deviceScaleFactor: 3, isMobile: true },
  { name: 'Samsung Galaxy S21', width: 384, height: 854, deviceScaleFactor: 2.75, isMobile: true },
  { name: 'iPad', width: 768, height: 1024, deviceScaleFactor: 2, isMobile: false },
  { name: 'iPad Pro', width: 1024, height: 1366, deviceScaleFactor: 2, isMobile: false }
];

test.describe('Responsive Design Validation', () => {
  let context: ResponsiveTestContext;

  test.beforeEach(async ({ page }) => {
    context = {
      page,
      baseURL: 'http://localhost:3000'
    };
  });

  test.describe('Layout Adaptation Across Breakpoints', () => {
    Object.entries(BREAKPOINTS).forEach(([breakpointName, dimensions]) => {
      test(`should adapt layout correctly at ${dimensions.name}`, async () => {
        await context.page.setViewportSize(dimensions);
        await context.page.goto(context.baseURL);
        await context.page.waitForLoadState('domcontentloaded');

        // Take screenshot for visual comparison
        await expect(context.page).toHaveScreenshot(`layout-${breakpointName}.png`);

        // Test layout-specific behaviors
        await testLayoutAtBreakpoint(context, breakpointName, dimensions);
      });
    });

    async function testLayoutAtBreakpoint(
      context: ResponsiveTestContext,
      breakpoint: string,
      dimensions: { width: number; height: number; name: string }
    ) {
      const { page } = context;

      // Test navigation/header adaptation
      if (dimensions.width < 768) {
        // Mobile: Check for hamburger menu or collapsed navigation
        const mobileNav = page.locator('.mobile-nav, .hamburger-menu, [aria-label*="menu"]');
        await expect(mobileNav).toBeVisible();
      } else {
        // Desktop: Check for full navigation
        const desktopNav = page.locator('.desktop-nav, .main-navigation');
        if (await desktopNav.count() > 0) {
          await expect(desktopNav).toBeVisible();
        }
      }

      // Test search interface adaptation
      const searchInterface = page.locator('[data-testid="search-interface"]');
      await expect(searchInterface).toBeVisible();

      if (dimensions.width < 768) {
        // Mobile: Search should be full-width or stacked
        const searchInput = page.locator('[data-testid="search-input"]');
        const inputBox = await searchInput.boundingBox();
        if (inputBox) {
          expect(inputBox.width).toBeGreaterThan(dimensions.width * 0.8); // At least 80% width
        }
      }

      // Test content area adaptation
      await testContentAreaResponsiveness(page, dimensions);

      // Test interactive elements sizing
      await testTouchTargetSizes(page, dimensions);

      // Test typography scaling
      await testTypographyScaling(page, dimensions);
    }
  });

  test.describe('Search Interface Responsiveness', () => {
    test('should maintain search functionality across all screen sizes', async () => {
      for (const [breakpoint, dimensions] of Object.entries(BREAKPOINTS)) {
        await context.page.setViewportSize(dimensions);
        await context.page.goto(context.baseURL);

        // Test search input
        const searchInput = context.page.locator('[data-testid="search-input"]');
        await expect(searchInput).toBeVisible();
        await expect(searchInput).toBeEditable();

        // Test search functionality
        await searchInput.fill('S0C7 abend');
        await context.page.press('[data-testid="search-input"]', 'Enter');

        // Wait for results
        await context.page.waitForSelector('.search-results', { timeout: 10000 });
        const results = context.page.locator('.search-result-item');
        await expect(results.first()).toBeVisible();

        // Clear for next iteration
        await searchInput.clear();
      }
    });

    test('should show/hide search filters appropriately', async () => {
      // Desktop: Filters should be visible or easily accessible
      await context.page.setViewportSize(BREAKPOINTS.desktop);
      await context.page.goto(context.baseURL);

      const filtersSection = context.page.locator('.search-filters');
      await expect(filtersSection).toBeVisible();

      // Mobile: Filters might be collapsed or in a drawer
      await context.page.setViewportSize(BREAKPOINTS.mobile);
      await context.page.reload();

      // Check if filters are collapsed and can be expanded
      const filtersToggle = context.page.locator('.search-filters__toggle, [aria-label*="filter"]');
      if (await filtersToggle.count() > 0) {
        await filtersToggle.click();
        await expect(filtersSection).toBeVisible();
      }
    });

    test('should handle autocomplete dropdown responsively', async () => {
      for (const [breakpoint, dimensions] of Object.entries(BREAKPOINTS)) {
        await context.page.setViewportSize(dimensions);
        await context.page.goto(context.baseURL);

        // Trigger autocomplete
        const searchInput = context.page.locator('[data-testid="search-input"]');
        await searchInput.fill('S0');
        await context.page.waitForSelector('.search-suggestions', { timeout: 5000 });

        const suggestions = context.page.locator('.search-suggestions');
        await expect(suggestions).toBeVisible();

        // Check that suggestions don't overflow viewport
        const suggestionBox = await suggestions.boundingBox();
        if (suggestionBox) {
          expect(suggestionBox.x + suggestionBox.width).toBeLessThanOrEqual(dimensions.width);
        }

        // Clear input
        await searchInput.clear();
        await context.page.waitForTimeout(500);
      }
    });
  });

  test.describe('Touch Device Optimization', () => {
    DEVICE_CONFIGURATIONS.forEach(device => {
      test(`should be optimized for ${device.name}`, async () => {
        await context.page.setViewportSize({
          width: device.width,
          height: device.height
        });

        // Set device scale factor for accurate touch target testing
        await context.page.evaluate((scale) => {
          Object.defineProperty(window, 'devicePixelRatio', {
            value: scale,
            writable: false
          });
        }, device.deviceScaleFactor);

        await context.page.goto(context.baseURL);

        if (device.isMobile) {
          await testMobileOptimizations(context, device);
        } else {
          await testTabletOptimizations(context, device);
        }
      });
    });

    async function testMobileOptimizations(
      context: ResponsiveTestContext,
      device: { name: string; width: number; height: number; isMobile: boolean }
    ) {
      const { page } = context;

      // Test touch targets
      const touchTargets = await page.$$('button, a, input, [role="button"], .clickable');
      for (const target of touchTargets) {
        const box = await target.boundingBox();
        if (box && box.width > 0 && box.height > 0) {
          // WCAG guidelines: minimum 44x44px touch targets
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }

      // Test font sizes (should be readable without zooming)
      const textElements = await page.$$('p, span, h1, h2, h3, h4, h5, h6, label, button');
      for (const element of textElements) {
        const fontSize = await element.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return parseFloat(styles.fontSize);
        });

        if (fontSize > 0) {
          expect(fontSize).toBeGreaterThanOrEqual(16); // Minimum readable size on mobile
        }
      }

      // Test spacing between interactive elements
      const buttons = await page.$$('button, a[href]');
      for (let i = 0; i < buttons.length - 1; i++) {
        const current = await buttons[i].boundingBox();
        const next = await buttons[i + 1].boundingBox();

        if (current && next) {
          const verticalGap = Math.abs(next.y - (current.y + current.height));
          const horizontalGap = Math.abs(next.x - (current.x + current.width));

          // Should have adequate spacing to prevent accidental taps
          if (verticalGap < 10) { // Same row
            expect(horizontalGap).toBeGreaterThanOrEqual(8);
          }
        }
      }
    }

    async function testTabletOptimizations(
      context: ResponsiveTestContext,
      device: { name: string; width: number; height: number; isMobile: boolean }
    ) {
      const { page } = context;

      // Test two-column or multi-column layouts work well
      const searchInterface = page.locator('[data-testid="search-interface"]');
      await expect(searchInterface).toBeVisible();

      // Check if sidebar is visible on tablet
      const sidebar = page.locator('.search-interface__sidebar, .sidebar');
      if (await sidebar.count() > 0) {
        await expect(sidebar).toBeVisible();
      }

      // Test touch targets (slightly smaller than mobile but still accessible)
      const touchTargets = await page.$$('button, a, input, [role="button"]');
      for (const target of touchTargets) {
        const box = await target.boundingBox();
        if (box && box.width > 0 && box.height > 0) {
          expect(box.width).toBeGreaterThanOrEqual(40);
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
    }
  });

  test.describe('Orientation Changes', () => {
    test('should handle orientation changes gracefully', async () => {
      // Start in portrait
      await context.page.setViewportSize({ width: 768, height: 1024 });
      await context.page.goto(context.baseURL);

      // Test initial layout
      const searchInterface = context.page.locator('[data-testid="search-interface"]');
      await expect(searchInterface).toBeVisible();

      // Take screenshot in portrait
      await expect(context.page).toHaveScreenshot('orientation-portrait.png');

      // Switch to landscape
      await context.page.setViewportSize({ width: 1024, height: 768 });
      await context.page.waitForTimeout(500); // Allow layout to settle

      // Test that layout adapts
      await expect(searchInterface).toBeVisible();

      // Take screenshot in landscape
      await expect(context.page).toHaveScreenshot('orientation-landscape.png');

      // Test that functionality still works
      const searchInput = context.page.locator('[data-testid="search-input"]');
      await searchInput.fill('test query');
      await expect(searchInput).toHaveValue('test query');
    });

    test('should maintain scroll position during orientation change', async () => {
      await context.page.setViewportSize({ width: 768, height: 1024 });
      await context.page.goto(context.baseURL);

      // Perform search to get results
      await context.page.fill('[data-testid="search-input"]', 'error');
      await context.page.press('[data-testid="search-input"]', 'Enter');
      await context.page.waitForSelector('.search-results');

      // Scroll down
      await context.page.evaluate(() => window.scrollTo(0, 300));
      const initialScrollY = await context.page.evaluate(() => window.scrollY);

      // Change orientation
      await context.page.setViewportSize({ width: 1024, height: 768 });
      await context.page.waitForTimeout(500);

      // Check that scroll position is reasonable (might not be exactly the same due to layout changes)
      const newScrollY = await context.page.evaluate(() => window.scrollY);
      expect(newScrollY).toBeGreaterThan(0); // Should maintain some scroll position
    });
  });

  test.describe('Content Overflow and Scrolling', () => {
    test('should prevent horizontal scrolling on mobile', async () => {
      await context.page.setViewportSize(BREAKPOINTS.mobile);
      await context.page.goto(context.baseURL);

      // Check body dimensions
      const bodyDimensions = await context.page.evaluate(() => ({
        scrollWidth: document.body.scrollWidth,
        clientWidth: document.body.clientWidth,
        offsetWidth: document.body.offsetWidth
      }));

      expect(bodyDimensions.scrollWidth).toBeLessThanOrEqual(bodyDimensions.clientWidth + 5); // Allow 5px tolerance
    });

    test('should handle long content gracefully', async () => {
      await context.page.goto(context.baseURL);

      // Create long search query
      const longQuery = 'This is a very long search query that might cause layout issues if not handled properly in responsive design implementations';

      await context.page.fill('[data-testid="search-input"]', longQuery);

      // Test at different screen sizes
      for (const [breakpoint, dimensions] of Object.entries(BREAKPOINTS)) {
        await context.page.setViewportSize(dimensions);
        await context.page.waitForTimeout(200);

        // Input should handle long content
        const searchInput = context.page.locator('[data-testid="search-input"]');
        await expect(searchInput).toBeVisible();

        // Check for overflow
        const inputBox = await searchInput.boundingBox();
        if (inputBox) {
          expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(dimensions.width);
        }
      }
    });

    test('should implement virtual scrolling for large result sets', async () => {
      await context.page.goto(context.baseURL);

      // Perform search that returns many results
      await context.page.fill('[data-testid="search-input"]', 'error'); // Broad search
      await context.page.press('[data-testid="search-input"]', 'Enter');
      await context.page.waitForSelector('.search-results');

      // Check if virtual scrolling is implemented
      const virtualContainer = context.page.locator('.virtualized-search-results, .virtual-list');

      if (await virtualContainer.count() > 0) {
        // Test virtual scrolling behavior
        await expect(virtualContainer).toBeVisible();

        // Scroll and check that new items are rendered
        const initialItems = await virtualContainer.locator('.search-result-item').count();

        await context.page.evaluate(() => {
          const container = document.querySelector('.virtualized-search-results, .virtual-list');
          if (container) {
            container.scrollTop = container.scrollHeight / 2;
          }
        });

        await context.page.waitForTimeout(500);

        // Should maintain reasonable DOM size
        const afterScrollItems = await virtualContainer.locator('.search-result-item').count();
        expect(afterScrollItems).toBeLessThanOrEqual(initialItems + 10); // Reasonable buffer
      }
    });
  });

  test.describe('Visual Regression Testing', () => {
    test('should maintain visual consistency across breakpoints', async () => {
      for (const [breakpoint, dimensions] of Object.entries(BREAKPOINTS)) {
        await context.page.setViewportSize(dimensions);
        await context.page.goto(context.baseURL);
        await context.page.waitForLoadState('networkidle');

        // Take full page screenshot
        await expect(context.page).toHaveScreenshot(`full-page-${breakpoint}.png`, {
          fullPage: true,
          animations: 'disabled'
        });

        // Test search with results
        await context.page.fill('[data-testid="search-input"]', 'S0C7 abend');
        await context.page.press('[data-testid="search-input"]', 'Enter');
        await context.page.waitForSelector('.search-results');

        await expect(context.page).toHaveScreenshot(`search-results-${breakpoint}.png`, {
          fullPage: true,
          animations: 'disabled'
        });
      }
    });

    test('should handle theme variations responsively', async () => {
      const themes = ['light', 'dark'];

      for (const theme of themes) {
        await context.page.emulateMedia({ colorScheme: theme as 'light' | 'dark' });

        for (const [breakpoint, dimensions] of Object.entries(BREAKPOINTS)) {
          await context.page.setViewportSize(dimensions);
          await context.page.goto(context.baseURL);
          await context.page.waitForLoadState('networkidle');

          await expect(context.page).toHaveScreenshot(`theme-${theme}-${breakpoint}.png`, {
            animations: 'disabled'
          });
        }
      }
    });
  });

  async function testContentAreaResponsiveness(
    page: Page,
    dimensions: { width: number; height: number }
  ) {
    const contentArea = page.locator('.search-interface__content, .main-content');

    if (await contentArea.count() > 0) {
      await expect(contentArea).toBeVisible();

      const contentBox = await contentArea.boundingBox();
      if (contentBox) {
        // Content should not overflow viewport
        expect(contentBox.x + contentBox.width).toBeLessThanOrEqual(dimensions.width);
      }
    }
  }

  async function testTouchTargetSizes(
    page: Page,
    dimensions: { width: number; height: number }
  ) {
    const isMobile = dimensions.width < 768;
    const minSize = isMobile ? 44 : 32; // WCAG requirements

    const interactiveElements = await page.$$('button, a[href], input, [role="button"], [tabindex="0"]');

    for (const element of interactiveElements) {
      const box = await element.boundingBox();
      if (box && box.width > 0 && box.height > 0) {
        expect(box.width).toBeGreaterThanOrEqual(minSize);
        expect(box.height).toBeGreaterThanOrEqual(minSize);
      }
    }
  }

  async function testTypographyScaling(
    page: Page,
    dimensions: { width: number; height: number }
  ) {
    const textElements = await page.$$('h1, h2, h3, h4, h5, h6, p, span, label');
    const isMobile = dimensions.width < 768;

    for (const element of textElements) {
      const styles = await element.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          fontSize: parseFloat(computed.fontSize),
          lineHeight: computed.lineHeight,
          tagName: el.tagName.toLowerCase()
        };
      });

      if (styles.fontSize > 0) {
        // Base text should be readable
        if (isMobile) {
          expect(styles.fontSize).toBeGreaterThanOrEqual(16);
        } else {
          expect(styles.fontSize).toBeGreaterThanOrEqual(14);
        }

        // Headings should be appropriately sized
        if (styles.tagName === 'h1') {
          expect(styles.fontSize).toBeGreaterThanOrEqual(isMobile ? 24 : 28);
        }
      }
    }
  }
});