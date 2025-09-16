import { test, expect, Page } from '@playwright/test';
import { ResponsiveTestHelper } from '../utils/responsive-helper';
import { AccessibilityHelper } from '../utils/accessibility-helper';

test.describe('Responsive Desktop Tests', () => {
  let page: Page;
  let responsiveHelper: ResponsiveTestHelper;
  let a11yHelper: AccessibilityHelper;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    responsiveHelper = new ResponsiveTestHelper(page);
    a11yHelper = new AccessibilityHelper(page);
  });

  test.describe('Desktop Small - 1366px to 1599px', () => {
    const desktopViewports = [
      { width: 1366, height: 768, name: 'Laptop 1366x768' },
      { width: 1440, height: 900, name: 'MacBook Air' },
      { width: 1536, height: 864, name: 'Surface Book' },
    ];

    desktopViewports.forEach(({ width, height, name }) => {
      test(`Full navigation layout on ${name} (${width}x${height})`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/');

        // Test desktop navigation (should show full horizontal nav)
        const mainNav = page.locator('[data-testid="main-navigation"]');
        await expect(mainNav).toBeVisible();
        
        // Mobile elements should be hidden
        const hamburgerMenu = page.locator('[data-testid="mobile-menu-toggle"]');
        await expect(hamburgerMenu).not.toBeVisible();
        
        // Test all navigation items visible
        const navItems = page.locator('[data-testid="nav-item"]');
        await expect(navItems).toHaveCount(5);
        
        // Test navigation dropdowns
        const dropdownTriggers = page.locator('[data-testid="nav-dropdown-trigger"]');
        const triggerCount = await dropdownTriggers.count();
        
        for (let i = 0; i < triggerCount; i++) {
          const trigger = dropdownTriggers.nth(i);
          await trigger.hover();
          
          const dropdown = page.locator('[data-testid="nav-dropdown"]').nth(i);
          await expect(dropdown).toBeVisible();
          
          // Move mouse away to close dropdown
          await page.mouse.move(0, 0);
          await expect(dropdown).not.toBeVisible();
        }
        
        // Test search in navigation
        const navSearch = page.locator('[data-testid="nav-search"]');
        await expect(navSearch).toBeVisible();
        
        await navSearch.fill('test query');
        const searchSuggestions = page.locator('[data-testid="search-suggestions"]');
        await expect(searchSuggestions).toBeVisible();
      });

      test(`Knowledge Base full layout on ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/knowledge-base');

        // Test three-panel layout
        const sidebar = page.locator('[data-testid="kb-sidebar"]');
        const mainContent = page.locator('[data-testid="kb-main-content"]');
        const rightPanel = page.locator('[data-testid="kb-right-panel"]');
        
        await expect(sidebar).toBeVisible();
        await expect(mainContent).toBeVisible();
        await expect(rightPanel).toBeVisible();
        
        // Check layout proportions
        const sidebarBox = await sidebar.boundingBox();
        const mainBox = await mainContent.boundingBox();
        const rightBox = await rightPanel.boundingBox();
        
        if (sidebarBox && mainBox && rightBox) {
          // Sidebar should be ~20% of width
          expect(sidebarBox.width).toBeGreaterThan(width * 0.15);
          expect(sidebarBox.width).toBeLessThan(width * 0.25);
          
          // Main content should be ~50-60% of width
          expect(mainBox.width).toBeGreaterThan(width * 0.45);
          expect(mainBox.width).toBeLessThan(width * 0.65);
          
          // Right panel should be ~20-25% of width
          expect(rightBox.width).toBeGreaterThan(width * 0.15);
          expect(rightBox.width).toBeLessThan(width * 0.3);
        }
        
        // Test advanced search filters
        const advancedSearch = page.locator('[data-testid="advanced-search-toggle"]');
        await expect(advancedSearch).toBeVisible();
        
        await advancedSearch.click();
        const searchFilters = page.locator('[data-testid="search-filters"]');
        await expect(searchFilters).toBeVisible();
        
        // Test filter options
        const categoryFilter = page.locator('[data-testid="category-filter"]');
        const dateFilter = page.locator('[data-testid="date-filter"]');
        const authorFilter = page.locator('[data-testid="author-filter"]');
        
        await expect(categoryFilter).toBeVisible();
        await expect(dateFilter).toBeVisible();
        await expect(authorFilter).toBeVisible();
      });

      test(`Data tables full functionality on ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/admin/entries');

        // Test full data table with all columns
        const dataTable = page.locator('[data-testid="entries-table"]');
        await expect(dataTable).toBeVisible();
        
        // Check all columns are visible
        const tableHeaders = page.locator('[data-testid="table-header"]');
        const headerCount = await tableHeaders.count();
        
        // Desktop should show all columns
        expect(headerCount).toBeGreaterThanOrEqual(6);
        
        // Test column sorting
        const sortableHeaders = page.locator('[data-testid="sortable-header"]');
        const firstSortableHeader = sortableHeaders.first();
        
        await firstSortableHeader.click();
        
        // Check sort indicator
        const sortIndicator = page.locator('[data-testid="sort-indicator"]');
        await expect(sortIndicator).toBeVisible();
        
        // Test column resizing
        const resizeHandle = page.locator('[data-testid="resize-handle"]').first();
        if (await resizeHandle.isVisible()) {
          const initialBox = await firstSortableHeader.boundingBox();
          
          await resizeHandle.hover();
          await page.mouse.down();
          await page.mouse.move((initialBox?.x || 0) + 50, initialBox?.y || 0);
          await page.mouse.up();
          
          const finalBox = await firstSortableHeader.boundingBox();
          expect(finalBox?.width).toBeGreaterThan(initialBox?.width || 0);
        }
        
        // Test bulk actions
        const selectAllCheckbox = page.locator('[data-testid="select-all-checkbox"]');
        await selectAllCheckbox.check();
        
        const bulkActionButton = page.locator('[data-testid="bulk-action-button"]');
        await expect(bulkActionButton).toBeVisible();
        await expect(bulkActionButton).toBeEnabled();
      });

      test(`Form layouts with sidebars on ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/forms/add-entry');

        // Test desktop form layout with sidebar
        const formContainer = page.locator('[data-testid="entry-form"]');
        const formSidebar = page.locator('[data-testid="form-sidebar"]');
        
        await expect(formContainer).toBeVisible();
        await expect(formSidebar).toBeVisible();
        
        // Test multi-column form fields
        const formRow = page.locator('[data-testid="form-row"]').first();
        const fieldsInRow = page.locator('[data-testid="form-field"]');
        
        // Desktop should show multiple fields per row
        const fieldBoxes = [];
        const fieldCount = await fieldsInRow.count();
        
        for (let i = 0; i < Math.min(fieldCount, 3); i++) {
          const field = fieldsInRow.nth(i);
          const box = await field.boundingBox();
          if (box) fieldBoxes.push(box);
        }
        
        // Check if fields are arranged horizontally
        if (fieldBoxes.length >= 2) {
          const yDifference = Math.abs(fieldBoxes[0].y - fieldBoxes[1].y);
          expect(yDifference).toBeLessThan(20); // Should be on same row
        }
        
        // Test rich text editor toolbar
        const editorToolbar = page.locator('[data-testid="editor-toolbar"]');
        await expect(editorToolbar).toBeVisible();
        
        const toolbarButtons = page.locator('[data-testid="toolbar-button"]');
        const buttonCount = await toolbarButtons.count();
        
        // Desktop should show full toolbar
        expect(buttonCount).toBeGreaterThanOrEqual(8);
      });
    });
  });

  test.describe('Desktop Large - 1600px to 1919px', () => {
    test('Wide screen layouts', async () => {
      await page.setViewportSize({ width: 1600, height: 900 });
      await page.goto('/knowledge-base');

      // Test wider layout utilization
      const mainContent = page.locator('[data-testid="kb-main-content"]');
      const contentBox = await mainContent.boundingBox();
      
      if (contentBox) {
        // Should utilize more of the available width
        expect(contentBox.width).toBeGreaterThan(800);
        expect(contentBox.width).toBeLessThan(1200); // But not too wide for readability
      }
      
      // Test search results grid adaptation
      await page.fill('[data-testid="kb-search-input"]', 'test');
      await page.press('[data-testid="kb-search-input"]', 'Enter');
      
      await page.waitForSelector('[data-testid="search-result-card"]');
      
      const resultCards = page.locator('[data-testid="search-result-card"]');
      const cardCount = await resultCards.count();
      
      if (cardCount >= 3) {
        const firstCard = resultCards.first();
        const thirdCard = resultCards.nth(2);
        
        const firstBox = await firstCard.boundingBox();
        const thirdBox = await thirdCard.boundingBox();
        
        if (firstBox && thirdBox) {
          // Should show 3+ cards per row on wide screens
          const yDifference = Math.abs(firstBox.y - thirdBox.y);
          expect(yDifference).toBeLessThan(50);
        }
      }
    });
  });

  test.describe('Desktop Ultra-wide - 1920px+', () => {
    test('Ultra-wide screen optimization', async () => {
      await page.setViewportSize({ width: 2560, height: 1440 });
      await page.goto('/dashboard');

      // Test ultra-wide dashboard layout
      const dashboardGrid = page.locator('[data-testid="dashboard-grid"]');
      await expect(dashboardGrid).toBeVisible();
      
      // Should show more widgets per row
      const widgets = page.locator('[data-testid="dashboard-widget"]');
      const widgetCount = await widgets.count();
      
      if (widgetCount >= 4) {
        const widgetBoxes = [];
        for (let i = 0; i < 4; i++) {
          const widget = widgets.nth(i);
          const box = await widget.boundingBox();
          if (box) widgetBoxes.push(box);
        }
        
        // Check if 4 widgets are on the same row
        if (widgetBoxes.length === 4) {
          const firstRowY = widgetBoxes[0].y;
          const allOnSameRow = widgetBoxes.every(box => 
            Math.abs(box.y - firstRowY) < 20
          );
          expect(allOnSameRow).toBe(true);
        }
      }
    });

    test('4K resolution support', async () => {
      await page.setViewportSize({ width: 3840, height: 2160 });
      await page.goto('/');

      // Test 4K layout scaling
      const mainContent = page.locator('[data-testid="main-content"]');
      const contentBox = await mainContent.boundingBox();
      
      if (contentBox) {
        // Content should be centered and not too wide
        expect(contentBox.width).toBeLessThan(1600); // Max width for readability
        
        // Should be centered
        const centerX = contentBox.x + contentBox.width / 2;
        const screenCenterX = 3840 / 2;
        expect(Math.abs(centerX - screenCenterX)).toBeLessThan(100);
      }
      
      // Test font scaling
      const headings = page.locator('h1, h2, h3');
      const firstHeading = headings.first();
      
      if (await firstHeading.isVisible()) {
        const fontSize = await firstHeading.evaluate(el => {
          return window.getComputedStyle(el).fontSize;
        });
        
        const fontSizeValue = parseFloat(fontSize);
        // Font should be appropriately sized for 4K
        expect(fontSizeValue).toBeGreaterThan(16);
      }
    });
  });

  test.describe('Desktop Interactions', () => {
    test('Mouse interactions and hover states', async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/knowledge-base');

      // Test hover effects on cards
      const entryCard = page.locator('[data-testid="kb-entry-card"]').first();
      
      // Check initial state
      const initialTransform = await entryCard.evaluate(el => {
        return window.getComputedStyle(el).transform;
      });
      
      // Hover and check for changes
      await entryCard.hover();
      
      const hoverTransform = await entryCard.evaluate(el => {
        return window.getComputedStyle(el).transform;
      });
      
      // Should have hover effect
      expect(hoverTransform).not.toBe(initialTransform);
      
      // Test context menu on right-click
      await entryCard.click({ button: 'right' });
      
      const contextMenu = page.locator('[data-testid="context-menu"]');
      await expect(contextMenu).toBeVisible();
      
      // Click elsewhere to close
      await page.mouse.click(100, 100);
      await expect(contextMenu).not.toBeVisible();
    });

    test('Keyboard shortcuts', async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/knowledge-base');

      // Test search shortcut (Ctrl+K or Cmd+K)
      await page.keyboard.press('Control+KeyK');
      
      const searchModal = page.locator('[data-testid="search-modal"]');
      await expect(searchModal).toBeVisible();
      
      // Test escape to close
      await page.keyboard.press('Escape');
      await expect(searchModal).not.toBeVisible();
      
      // Test navigation shortcuts
      await page.keyboard.press('Alt+KeyN');
      
      const newEntryForm = page.locator('[data-testid="new-entry-form"]');
      if (await newEntryForm.isVisible()) {
        await expect(newEntryForm).toBeVisible();
      }
    });
  });

  test.describe('Desktop Performance', () => {
    test('High-resolution performance', async () => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      const startTime = Date.now();
      await page.goto('/');
      
      // Wait for main content
      await page.waitForSelector('[data-testid="main-content"]');
      const loadTime = Date.now() - startTime;
      
      // Desktop should load quickly
      expect(loadTime).toBeLessThan(2000);
      
      // Test smooth animations
      const animatedElement = page.locator('[data-testid="animated-element"]').first();
      
      if (await animatedElement.isVisible()) {
        // Trigger animation
        await animatedElement.hover();
        
        // Check for smooth frame rate
        const fps = await page.evaluate(() => {
          return new Promise((resolve) => {
            let frames = 0;
            const startTime = performance.now();
            
            function countFrames() {
              frames++;
              if (performance.now() - startTime < 1000) {
                requestAnimationFrame(countFrames);
              } else {
                resolve(frames);
              }
            }
            
            requestAnimationFrame(countFrames);
          });
        });
        
        // Should maintain good frame rate
        expect(fps).toBeGreaterThan(45);
      }
    });
  });
});
