import { test, expect, Page } from '@playwright/test';
import { ResponsiveTestHelper } from '../utils/responsive-helper';
import { AccessibilityHelper } from '../utils/accessibility-helper';

test.describe('Responsive Mobile Tests', () => {
  let page: Page;
  let responsiveHelper: ResponsiveTestHelper;
  let a11yHelper: AccessibilityHelper;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    responsiveHelper = new ResponsiveTestHelper(page);
    a11yHelper = new AccessibilityHelper(page);
  });

  test.describe('Mobile Portrait - 320px to 479px', () => {
    const mobileViewports = [
      { width: 320, height: 568, name: 'iPhone SE' },
      { width: 375, height: 667, name: 'iPhone 8' },
      { width: 414, height: 896, name: 'iPhone 11 Pro Max' },
    ];

    mobileViewports.forEach(({ width, height, name }) => {
      test(`Navigation behavior on ${name} (${width}x${height})`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/');

        // Test mobile navigation hamburger
        const hamburgerMenu = page.locator('[data-testid="mobile-menu-toggle"]');
        await expect(hamburgerMenu).toBeVisible();
        
        // Test navigation drawer
        await hamburgerMenu.click();
        const navDrawer = page.locator('[data-testid="mobile-nav-drawer"]');
        await expect(navDrawer).toBeVisible();
        
        // Test navigation items
        const navItems = page.locator('[data-testid="mobile-nav-item"]');
        await expect(navItems).toHaveCount(5);
        
        // Test close functionality
        const closeButton = page.locator('[data-testid="mobile-nav-close"]');
        await closeButton.click();
        await expect(navDrawer).not.toBeVisible();
      });

      test(`Knowledge Base search on ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/knowledge-base');

        // Test mobile search interface
        const searchInput = page.locator('[data-testid="kb-search-input"]');
        await expect(searchInput).toBeVisible();
        
        // Test search functionality
        await searchInput.fill('test query');
        await searchInput.press('Enter');
        
        // Wait for results
        await page.waitForSelector('[data-testid="search-results"]');
        
        // Test mobile search results layout
        const resultCards = page.locator('[data-testid="search-result-card"]');
        const firstCard = resultCards.first();
        
        // Check mobile card layout
        const cardBoundingBox = await firstCard.boundingBox();
        expect(cardBoundingBox?.width).toBeLessThanOrEqual(width - 32); // Account for padding
        
        // Test touch interactions
        await firstCard.tap();
        await expect(page.locator('[data-testid="kb-entry-detail"]')).toBeVisible();
      });

      test(`Form layouts on ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/forms/add-entry');

        // Test form field stacking
        const formFields = page.locator('.form-field');
        const fieldCount = await formFields.count();
        
        for (let i = 0; i < fieldCount; i++) {
          const field = formFields.nth(i);
          const fieldBox = await field.boundingBox();
          
          // Fields should be full width on mobile
          expect(fieldBox?.width).toBeGreaterThan(width * 0.8);
        }
        
        // Test mobile form submission
        await page.fill('[data-testid="entry-title"]', 'Mobile Test Entry');
        await page.fill('[data-testid="entry-content"]', 'Content for mobile testing');
        
        const submitButton = page.locator('[data-testid="submit-button"]');
        await expect(submitButton).toBeVisible();
        
        // Check button touch target size (minimum 44px)
        const buttonBox = await submitButton.boundingBox();
        expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
      });

      test(`Modal behavior on ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/');

        // Trigger modal
        await page.click('[data-testid="open-modal-button"]');
        
        const modal = page.locator('[data-testid="modal"]');
        await expect(modal).toBeVisible();
        
        // Check modal sizing on mobile
        const modalBox = await modal.boundingBox();
        expect(modalBox?.width).toBeLessThanOrEqual(width - 20); // Small margin
        expect(modalBox?.height).toBeLessThanOrEqual(height - 40); // Space for status bar
        
        // Test close on mobile
        await page.click('[data-testid="modal-close"]');
        await expect(modal).not.toBeVisible();
      });

      test(`Accessibility on ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/');

        // Test touch target sizes
        await a11yHelper.validateTouchTargets(44); // WCAG AA minimum
        
        // Test focus management
        await page.keyboard.press('Tab');
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
        
        // Test color contrast
        await a11yHelper.validateColorContrast(4.5); // WCAG AA
        
        // Test screen reader compatibility
        const landmarks = page.locator('[role="main"], [role="navigation"], [role="complementary"]');
        await expect(landmarks).toHaveCount(3);
      });
    });
  });

  test.describe('Mobile Landscape - 480px to 767px', () => {
    test('Layout adaptation in landscape mode', async () => {
      await page.setViewportSize({ width: 667, height: 375 });
      await page.goto('/');

      // Test landscape navigation
      const navItems = page.locator('[data-testid="nav-item"]');
      const navContainer = page.locator('[data-testid="navigation"]');
      
      // Check if navigation shows more items in landscape
      const navBox = await navContainer.boundingBox();
      expect(navBox?.width).toBeGreaterThan(500);
      
      // Test content adaptation
      const mainContent = page.locator('[data-testid="main-content"]');
      const contentBox = await mainContent.boundingBox();
      expect(contentBox?.width).toBeGreaterThan(600);
    });

    test('Knowledge Base grid in landscape', async () => {
      await page.setViewportSize({ width: 736, height: 414 });
      await page.goto('/knowledge-base');

      // Test grid layout changes
      const entryCards = page.locator('[data-testid="kb-entry-card"]');
      const firstCard = entryCards.first();
      const secondCard = entryCards.nth(1);
      
      const firstBox = await firstCard.boundingBox();
      const secondBox = await secondCard.boundingBox();
      
      // Cards should be side by side in landscape
      if (firstBox && secondBox) {
        expect(Math.abs(firstBox.y - secondBox.y)).toBeLessThan(20);
      }
    });
  });

  test.describe('Touch Interactions', () => {
    test('Swipe gestures on mobile', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/knowledge-base');

      // Test swipe to navigate
      const scrollContainer = page.locator('[data-testid="kb-scroll-container"]');
      
      // Simulate swipe down
      await scrollContainer.hover();
      await page.mouse.down();
      await page.mouse.move(375, 400);
      await page.mouse.up();
      
      // Check scroll position changed
      const scrollTop = await scrollContainer.evaluate(el => el.scrollTop);
      expect(scrollTop).toBeGreaterThan(0);
    });

    test('Long press interactions', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/knowledge-base');

      const entryCard = page.locator('[data-testid="kb-entry-card"]').first();
      
      // Simulate long press
      await entryCard.hover();
      await page.mouse.down();
      await page.waitForTimeout(500); // Long press duration
      await page.mouse.up();
      
      // Check context menu appeared
      const contextMenu = page.locator('[data-testid="context-menu"]');
      await expect(contextMenu).toBeVisible();
    });
  });

  test.describe('Performance on Mobile', () => {
    test('Mobile loading performance', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      const startTime = Date.now();
      await page.goto('/');
      
      // Wait for main content to be visible
      await page.waitForSelector('[data-testid="main-content"]');
      const loadTime = Date.now() - startTime;
      
      // Mobile should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
      
      // Check for layout shifts
      const layoutShifts = await page.evaluate(() => {
        return new Promise((resolve) => {
          let cumulativeScore = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === 'layout-shift') {
                cumulativeScore += (entry as any).value;
              }
            }
            resolve(cumulativeScore);
          }).observe({ entryTypes: ['layout-shift'] });
          
          setTimeout(() => resolve(cumulativeScore), 2000);
        });
      });
      
      // CLS should be less than 0.1
      expect(layoutShifts).toBeLessThan(0.1);
    });
  });
});
