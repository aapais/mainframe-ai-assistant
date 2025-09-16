import { test, expect, Page } from '@playwright/test';
import { ResponsiveTestHelper } from '../utils/responsive-helper';
import { AccessibilityHelper } from '../utils/accessibility-helper';

test.describe('Responsive Tablet Tests', () => {
  let page: Page;
  let responsiveHelper: ResponsiveTestHelper;
  let a11yHelper: AccessibilityHelper;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    responsiveHelper = new ResponsiveTestHelper(page);
    a11yHelper = new AccessibilityHelper(page);
  });

  test.describe('Tablet Portrait - 768px to 1023px', () => {
    const tabletViewports = [
      { width: 768, height: 1024, name: 'iPad Portrait' },
      { width: 820, height: 1180, name: 'iPad Air Portrait' },
      { width: 834, height: 1194, name: 'iPad Pro 11" Portrait' },
    ];

    tabletViewports.forEach(({ width, height, name }) => {
      test(`Navigation layout on ${name} (${width}x${height})`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/');

        // Test tablet navigation (should show full nav bar)
        const mainNav = page.locator('[data-testid="main-navigation"]');
        await expect(mainNav).toBeVisible();
        
        // Hamburger menu should be hidden on tablet
        const hamburgerMenu = page.locator('[data-testid="mobile-menu-toggle"]');
        await expect(hamburgerMenu).not.toBeVisible();
        
        // Test navigation items visibility
        const navItems = page.locator('[data-testid="nav-item"]');
        await expect(navItems).toHaveCount(5);
        
        // Test dropdown menus on tablet
        const dropdownTrigger = page.locator('[data-testid="nav-dropdown-trigger"]').first();
        await dropdownTrigger.hover();
        
        const dropdown = page.locator('[data-testid="nav-dropdown"]');
        await expect(dropdown).toBeVisible();
      });

      test(`Knowledge Base layout on ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/knowledge-base');

        // Test two-column layout on tablet
        const sidebar = page.locator('[data-testid="kb-sidebar"]');
        const mainContent = page.locator('[data-testid="kb-main-content"]');
        
        await expect(sidebar).toBeVisible();
        await expect(mainContent).toBeVisible();
        
        // Check layout proportions
        const sidebarBox = await sidebar.boundingBox();
        const mainBox = await mainContent.boundingBox();
        
        if (sidebarBox && mainBox) {
          // Sidebar should be about 25% of total width
          expect(sidebarBox.width).toBeGreaterThan(width * 0.2);
          expect(sidebarBox.width).toBeLessThan(width * 0.35);
          
          // Main content should be larger
          expect(mainBox.width).toBeGreaterThan(width * 0.6);
        }
        
        // Test search results grid
        const resultGrid = page.locator('[data-testid="search-results-grid"]');
        const resultCards = page.locator('[data-testid="search-result-card"]');
        
        await page.fill('[data-testid="kb-search-input"]', 'test');
        await page.press('[data-testid="kb-search-input"]', 'Enter');
        
        await page.waitForSelector('[data-testid="search-result-card"]');
        
        // Should show 2-3 cards per row on tablet
        const firstCard = resultCards.first();
        const cardBox = await firstCard.boundingBox();
        
        if (cardBox) {
          const cardsPerRow = Math.floor(width / cardBox.width);
          expect(cardsPerRow).toBeGreaterThanOrEqual(2);
          expect(cardsPerRow).toBeLessThanOrEqual(3);
        }
      });

      test(`Form layouts on ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/forms/add-entry');

        // Test tablet form layout (should use two columns for some fields)
        const formContainer = page.locator('[data-testid="entry-form"]');
        await expect(formContainer).toBeVisible();
        
        // Test form field arrangements
        const titleField = page.locator('[data-testid="entry-title"]');
        const categoryField = page.locator('[data-testid="entry-category"]');
        
        const titleBox = await titleField.boundingBox();
        const categoryBox = await categoryField.boundingBox();
        
        if (titleBox && categoryBox) {
          // Title should be full width
          expect(titleBox.width).toBeGreaterThan(width * 0.7);
          
          // Category field might be in a row with other fields
          expect(categoryBox.width).toBeLessThan(width * 0.6);
        }
        
        // Test rich text editor on tablet
        const editor = page.locator('[data-testid="rich-text-editor"]');
        await expect(editor).toBeVisible();
        
        const editorBox = await editor.boundingBox();
        if (editorBox) {
          expect(editorBox.width).toBeGreaterThan(width * 0.7);
          expect(editorBox.height).toBeGreaterThan(200);
        }
      });

      test(`Data tables on ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/admin/entries');

        // Test table layout on tablet
        const dataTable = page.locator('[data-testid="entries-table"]');
        await expect(dataTable).toBeVisible();
        
        // Check table columns visibility
        const tableHeaders = page.locator('[data-testid="table-header"]');
        const headerCount = await tableHeaders.count();
        
        // Tablet should show most columns
        expect(headerCount).toBeGreaterThanOrEqual(4);
        
        // Test horizontal scrolling if needed
        const tableContainer = page.locator('[data-testid="table-container"]');
        const containerBox = await tableContainer.boundingBox();
        
        if (containerBox) {
          expect(containerBox.width).toBeLessThanOrEqual(width);
        }
        
        // Test row actions on tablet
        const actionButtons = page.locator('[data-testid="row-action-button"]');
        const firstActionButton = actionButtons.first();
        
        await expect(firstActionButton).toBeVisible();
        
        // Test dropdown menu
        await firstActionButton.click();
        const actionMenu = page.locator('[data-testid="action-menu"]');
        await expect(actionMenu).toBeVisible();
      });
    });
  });

  test.describe('Tablet Landscape - 1024px to 1365px', () => {
    const landscapeViewports = [
      { width: 1024, height: 768, name: 'iPad Landscape' },
      { width: 1180, height: 820, name: 'iPad Air Landscape' },
      { width: 1194, height: 834, name: 'iPad Pro 11" Landscape' },
    ];

    landscapeViewports.forEach(({ width, height, name }) => {
      test(`Three-column layout on ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/knowledge-base');

        // Test three-column layout in landscape
        const sidebar = page.locator('[data-testid="kb-sidebar"]');
        const mainContent = page.locator('[data-testid="kb-main-content"]');
        const rightPanel = page.locator('[data-testid="kb-right-panel"]');
        
        await expect(sidebar).toBeVisible();
        await expect(mainContent).toBeVisible();
        await expect(rightPanel).toBeVisible();
        
        // Check three-column proportions
        const sidebarBox = await sidebar.boundingBox();
        const mainBox = await mainContent.boundingBox();
        const rightBox = await rightPanel.boundingBox();
        
        if (sidebarBox && mainBox && rightBox) {
          const totalWidth = sidebarBox.width + mainBox.width + rightBox.width;
          expect(totalWidth).toBeLessThanOrEqual(width + 50); // Allow for gaps
        }
      });

      test(`Dashboard widgets on ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/dashboard');

        // Test widget grid layout
        const widgetGrid = page.locator('[data-testid="dashboard-widgets"]');
        const widgets = page.locator('[data-testid="dashboard-widget"]');
        
        await expect(widgetGrid).toBeVisible();
        
        const widgetCount = await widgets.count();
        expect(widgetCount).toBeGreaterThan(0);
        
        // Check widget sizing and arrangement
        const firstWidget = widgets.first();
        const secondWidget = widgets.nth(1);
        
        const firstBox = await firstWidget.boundingBox();
        const secondBox = await secondWidget.boundingBox();
        
        if (firstBox && secondBox) {
          // Widgets should be in a grid (similar Y position for first row)
          const yDifference = Math.abs(firstBox.y - secondBox.y);
          expect(yDifference).toBeLessThan(50);
          
          // Each widget should be reasonable size
          expect(firstBox.width).toBeGreaterThan(200);
          expect(firstBox.width).toBeLessThan(width / 2);
        }
      });
    });
  });

  test.describe('Tablet-Specific Interactions', () => {
    test('Touch and mouse hybrid interactions', async () => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/knowledge-base');

      // Test hover states (important for tablets with mouse support)
      const entryCard = page.locator('[data-testid="kb-entry-card"]').first();
      
      await entryCard.hover();
      
      // Check hover effects
      const hoverStyle = await entryCard.evaluate(el => {
        return window.getComputedStyle(el).transform;
      });
      
      // Should have some hover effect (scale, shadow, etc.)
      expect(hoverStyle).not.toBe('none');
      
      // Test tap interaction
      await entryCard.tap();
      await expect(page.locator('[data-testid="kb-entry-detail"]')).toBeVisible();
    });

    test('Multi-touch gestures', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/knowledge-base/entry/1');

      // Test pinch-to-zoom on images
      const contentImage = page.locator('[data-testid="content-image"]').first();
      
      if (await contentImage.isVisible()) {
        // Simulate pinch gesture
        await contentImage.hover();
        
        // Test image zoom functionality
        await contentImage.dblclick();
        
        const zoomedImage = page.locator('[data-testid="zoomed-image"]');
        await expect(zoomedImage).toBeVisible();
      }
    });
  });

  test.describe('Tablet Accessibility', () => {
    test('Focus management on tablet', async () => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/');

      // Test keyboard navigation
      await page.keyboard.press('Tab');
      
      let focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
      
      // Continue tabbing through interactive elements
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
      }
    });

    test('Touch target sizes on tablet', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');

      // Test minimum touch target sizes (44px for tablets)
      await a11yHelper.validateTouchTargets(44);
      
      // Test spacing between interactive elements
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < buttonCount - 1; i++) {
        const currentButton = buttons.nth(i);
        const nextButton = buttons.nth(i + 1);
        
        const currentBox = await currentButton.boundingBox();
        const nextBox = await nextButton.boundingBox();
        
        if (currentBox && nextBox) {
          const distance = Math.sqrt(
            Math.pow(nextBox.x - (currentBox.x + currentBox.width), 2) +
            Math.pow(nextBox.y - currentBox.y, 2)
          );
          
          // Minimum 8px spacing between touch targets
          expect(distance).toBeGreaterThan(8);
        }
      }
    });
  });

  test.describe('Tablet Performance', () => {
    test('Rendering performance on tablet', async () => {
      await page.setViewportSize({ width: 1024, height: 768 });
      
      // Measure First Contentful Paint
      const performanceMetrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
            if (fcpEntry) {
              resolve(fcpEntry.startTime);
            }
          }).observe({ entryTypes: ['paint'] });
          
          setTimeout(() => resolve(null), 5000);
        });
      });
      
      await page.goto('/');
      
      // FCP should be under 2 seconds on tablet
      if (performanceMetrics) {
        expect(performanceMetrics).toBeLessThan(2000);
      }
      
      // Test smooth scrolling
      const scrollContainer = page.locator('[data-testid="main-content"]');
      
      const scrollStart = await scrollContainer.evaluate(el => el.scrollTop);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(100);
      const scrollEnd = await scrollContainer.evaluate(el => el.scrollTop);
      
      expect(scrollEnd).toBeGreaterThan(scrollStart);
    });
  });
});
