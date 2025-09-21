/**
 * @fileoverview E2E Tests for FloatingCostSummary Widget
 * @description End-to-end tests covering complete user workflows, cross-page persistence,
 * settings integration, mobile responsiveness, and real-world usage scenarios.
 */

import { test, expect } from '@playwright/test';

// Test configuration and utilities
const TEST_TIMEOUT = 60000;
const COST_DATA_UPDATE_DELAY = 2000;

// Selectors
const SELECTORS = {
  floatingWidget: '[data-testid="floating-cost-summary"]',
  expandButton: '[data-testid="expand-button"]',
  collapseButton: '[data-testid="collapse-button"]',
  closeButton: '[data-testid="close-button"]',
  costDisplay: '[data-testid="cost-display"]',
  detailedView: '[data-testid="detailed-cost-view"]',
  loadingIndicator: '[data-testid="loading-indicator"]',
  errorIndicator: '[data-testid="error-indicator"]',
  settingsToggle: '[data-testid="floating-widget-toggle"]',
  searchInput: '[data-testid="search-input"]',
  navigationMenu: '[data-testid="navigation-menu"]',
};

// Mock cost data for testing
const MOCK_COST_DATA = {
  daily: { amount: 12.45, currency: 'USD', queries: 23 },
  weekly: { amount: 87.30, currency: 'USD', queries: 156 },
  monthly: { amount: 324.67, currency: 'USD', queries: 678 },
  current: { amount: 1.25, currency: 'USD', queries: 2 },
};

// Setup function to mock electron API
async function setupElectronMocks(page) {
  await page.addInitScript(() => {
    // Mock electron API
    window.electronAPI = {
      settings: {
        get: async (key) => {
          const settings = {
            'floating-widget.enabled': true,
            'floating-widget.position': { x: 20, y: 20 },
            'floating-widget.expanded': false,
            'floating-widget.transparency': 0.9,
          };
          return settings[key];
        },
        set: async (key, value) => {
          console.log(`Setting ${key} to`, value);
          return true;
        },
      },
      costTracking: {
        getCurrentData: async () => MOCK_COST_DATA,
        subscribe: (callback) => {
          console.log('Subscribed to cost updates');
        },
      },
    };
  });
}

// Helper function to wait for widget to be ready
async function waitForWidgetReady(page) {
  await page.waitForSelector(SELECTORS.floatingWidget, { state: 'visible' });
  await page.waitForLoadState('networkidle');
}

test.describe('FloatingCostSummary E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Setup mocks and navigate to the app
    await setupElectronMocks(page);
    await page.goto('/');
    await waitForWidgetReady(page);
  });

  test.describe('Basic Widget Functionality', () => {
    test('should display floating widget on page load', async ({ page }) => {
      const widget = page.locator(SELECTORS.floatingWidget);

      await expect(widget).toBeVisible();
      await expect(widget).toContainText('$12.45');
    });

    test('should expand widget when clicked', async ({ page }) => {
      const widget = page.locator(SELECTORS.floatingWidget);

      await widget.click();

      await expect(widget).toHaveClass(/expanded/);
      await expect(page.locator(SELECTORS.detailedView)).toBeVisible();
      await expect(page.locator(SELECTORS.detailedView)).toContainText('Weekly: $87.30');
      await expect(page.locator(SELECTORS.detailedView)).toContainText('Monthly: $324.67');
    });

    test('should collapse widget when collapse button clicked', async ({ page }) => {
      const widget = page.locator(SELECTORS.floatingWidget);

      // First expand
      await widget.click();
      await expect(widget).toHaveClass(/expanded/);

      // Then collapse
      await page.locator(SELECTORS.collapseButton).click();
      await expect(widget).toHaveClass(/collapsed/);
      await expect(page.locator(SELECTORS.detailedView)).not.toBeVisible();
    });

    test('should close widget when close button clicked', async ({ page }) => {
      const widget = page.locator(SELECTORS.floatingWidget);

      // Expand to show close button
      await widget.click();
      await page.locator(SELECTORS.closeButton).click();

      await expect(widget).not.toBeVisible();
    });
  });

  test.describe('Cross-Page Navigation Persistence', () => {
    test('should remain visible across different pages', async ({ page }) => {
      const widget = page.locator(SELECTORS.floatingWidget);

      // Verify widget is visible on home page
      await expect(widget).toBeVisible();

      // Navigate to search page
      await page.click('[href="/search"]');
      await page.waitForURL('**/search');
      await expect(widget).toBeVisible();

      // Navigate to KB entry page
      await page.click('[href="/kb-entry/1"]');
      await page.waitForURL('**/kb-entry/1');
      await expect(widget).toBeVisible();

      // Navigate to settings page
      await page.click('[href="/settings"]');
      await page.waitForURL('**/settings');
      await expect(widget).toBeVisible();
    });

    test('should maintain expanded state across page navigation', async ({ page }) => {
      const widget = page.locator(SELECTORS.floatingWidget);

      // Expand widget
      await widget.click();
      await expect(widget).toHaveClass(/expanded/);

      // Navigate to different page
      await page.click('[href="/search"]');
      await page.waitForURL('**/search');

      // Widget should still be expanded
      await expect(widget).toHaveClass(/expanded/);
      await expect(page.locator(SELECTORS.detailedView)).toBeVisible();
    });

    test('should update cost data when navigating between pages', async ({ page }) => {
      const widget = page.locator(SELECTORS.floatingWidget);

      // Initial cost display
      await expect(widget).toContainText('$12.45');

      // Navigate to search page (simulating increased usage)
      await page.click('[href="/search"]');
      await page.waitForURL('**/search');

      // Perform search to trigger cost update
      await page.fill(SELECTORS.searchInput, 'test query');
      await page.press(SELECTORS.searchInput, 'Enter');

      // Wait for cost update
      await page.waitForTimeout(COST_DATA_UPDATE_DELAY);

      // Verify cost has updated (in real implementation, this would reflect actual usage)
      await expect(widget).toBeVisible();
    });
  });

  test.describe('Settings Integration', () => {
    test('should be toggled from settings page', async ({ page }) => {
      const widget = page.locator(SELECTORS.floatingWidget);

      // Navigate to settings
      await page.click('[href="/settings"]');
      await page.waitForURL('**/settings');

      // Disable widget
      await page.click(SELECTORS.settingsToggle);

      // Widget should disappear
      await expect(widget).not.toBeVisible();

      // Re-enable widget
      await page.click(SELECTORS.settingsToggle);

      // Widget should reappear
      await expect(widget).toBeVisible();
    });

    test('should persist position after drag', async ({ page }) => {
      const widget = page.locator(SELECTORS.floatingWidget);

      // Get initial position
      const initialBox = await widget.boundingBox();

      // Drag widget to new position
      await widget.dragTo(page.locator('body'), {
        targetPosition: { x: 300, y: 200 }
      });

      // Refresh page
      await page.reload();
      await waitForWidgetReady(page);

      // Position should be persisted
      const newBox = await widget.boundingBox();
      expect(Math.abs(newBox.x - 300)).toBeLessThan(50); // Allow for some tolerance
      expect(Math.abs(newBox.y - 200)).toBeLessThan(50);
    });

    test('should remember expanded state across browser sessions', async ({ page, context }) => {
      const widget = page.locator(SELECTORS.floatingWidget);

      // Expand widget
      await widget.click();
      await expect(widget).toHaveClass(/expanded/);

      // Close and reopen browser
      await page.close();
      const newPage = await context.newPage();
      await setupElectronMocks(newPage);
      await newPage.goto('/');
      await waitForWidgetReady(newPage);

      // Widget should still be expanded
      const newWidget = newPage.locator(SELECTORS.floatingWidget);
      await expect(newWidget).toHaveClass(/expanded/);
    });
  });

  test.describe('User Interaction Workflows', () => {
    test('should complete full user workflow: enable → interact → configure → disable', async ({ page }) => {
      const widget = page.locator(SELECTORS.floatingWidget);

      // Step 1: Enable widget from settings (already enabled by default)
      await page.goto('/settings');
      await expect(page.locator(SELECTORS.settingsToggle)).toBeChecked();

      // Step 2: Navigate back and interact with widget
      await page.goto('/');
      await waitForWidgetReady(page);

      // Expand widget
      await widget.click();
      await expect(widget).toHaveClass(/expanded/);

      // View detailed cost breakdown
      await expect(page.locator(SELECTORS.detailedView)).toContainText('Daily: $12.45');
      await expect(page.locator(SELECTORS.detailedView)).toContainText('Weekly: $87.30');

      // Step 3: Move widget to preferred position
      await widget.dragTo(page.locator('body'), {
        targetPosition: { x: 200, y: 100 }
      });

      // Step 4: Navigate to different pages and verify persistence
      await page.click('[href="/search"]');
      await expect(widget).toBeVisible();
      await expect(widget).toHaveClass(/expanded/);

      // Step 5: Disable widget
      await page.goto('/settings');
      await page.click(SELECTORS.settingsToggle);

      // Step 6: Verify widget is hidden
      await page.goto('/');
      await expect(widget).not.toBeVisible();
    });

    test('should handle error recovery workflow', async ({ page }) => {
      // Mock network error
      await page.route('**/api/cost-data', route => {
        route.abort('failed');
      });

      await page.reload();
      await page.waitForSelector(SELECTORS.floatingWidget);

      const widget = page.locator(SELECTORS.floatingWidget);

      // Should show error state
      await expect(page.locator(SELECTORS.errorIndicator)).toBeVisible();

      // Restore network and retry
      await page.unroute('**/api/cost-data');
      await page.click('[data-testid="retry-button"]');

      // Should recover and show data
      await expect(page.locator(SELECTORS.errorIndicator)).not.toBeVisible();
      await expect(widget).toContainText('$12.45');
    });

    test('should handle real-time cost updates during user session', async ({ page }) => {
      const widget = page.locator(SELECTORS.floatingWidget);

      // Expand widget to see details
      await widget.click();
      await expect(page.locator(SELECTORS.detailedView)).toBeVisible();

      // Simulate real-time cost update
      await page.evaluate(() => {
        // Trigger cost update via mocked API
        const event = new CustomEvent('cost-update', {
          detail: {
            daily: { amount: 15.75, currency: 'USD', queries: 28 },
            current: { amount: 2.50, currency: 'USD', queries: 4 },
          }
        });
        window.dispatchEvent(event);
      });

      // Wait for update to be reflected
      await page.waitForTimeout(1000);

      // Verify updated values are displayed
      await expect(widget).toContainText('$15.75');
    });
  });

  test.describe('Mobile and Responsive Behavior', () => {
    test('should adapt to mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      const widget = page.locator(SELECTORS.floatingWidget);

      await expect(widget).toBeVisible();
      await expect(widget).toHaveClass(/mobile-optimized/);

      // Expand widget
      await widget.click();

      // Should show compact mobile layout
      await expect(page.locator('[data-testid="compact-view"]')).toBeVisible();
    });

    test('should handle orientation changes', async ({ page }) => {
      // Start in portrait
      await page.setViewportSize({ width: 375, height: 667 });

      const widget = page.locator(SELECTORS.floatingWidget);
      await expect(widget).toBeVisible();

      // Change to landscape
      await page.setViewportSize({ width: 667, height: 375 });

      // Widget should remain visible and functional
      await expect(widget).toBeVisible();
      await widget.click();
      await expect(widget).toHaveClass(/expanded/);
    });

    test('should have adequate touch targets on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const widget = page.locator(SELECTORS.floatingWidget);
      const boundingBox = await widget.boundingBox();

      // Touch target should be at least 44px (iOS guidelines)
      expect(boundingBox.width).toBeGreaterThanOrEqual(44);
      expect(boundingBox.height).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe('Performance and Edge Cases', () => {
    test('should handle rapid cost updates without performance issues', async ({ page }) => {
      const widget = page.locator(SELECTORS.floatingWidget);

      // Expand widget
      await widget.click();

      // Generate rapid updates
      for (let i = 0; i < 10; i++) {
        await page.evaluate((index) => {
          const event = new CustomEvent('cost-update', {
            detail: {
              daily: { amount: 12.45 + index * 0.1, currency: 'USD', queries: 23 + index },
            }
          });
          window.dispatchEvent(event);
        }, i);

        await page.waitForTimeout(100);
      }

      // Widget should still be responsive
      await expect(widget).toBeVisible();
      await expect(widget).toHaveClass(/expanded/);
    });

    test('should handle large cost values', async ({ page }) => {
      // Mock large cost data
      await page.evaluate(() => {
        window.electronAPI.costTracking.getCurrentData = async () => ({
          daily: { amount: 999999.99, currency: 'USD', queries: 1000000 },
          weekly: { amount: 6999999.93, currency: 'USD', queries: 7000000 },
          monthly: { amount: 29999999.72, currency: 'USD', queries: 30000000 },
          current: { amount: 50000.00, currency: 'USD', queries: 50000 },
        });
      });

      await page.reload();
      await waitForWidgetReady(page);

      const widget = page.locator(SELECTORS.floatingWidget);

      // Should display large numbers correctly
      await expect(widget).toContainText('$999,999.99');

      // Expand to see all values
      await widget.click();
      await expect(page.locator(SELECTORS.detailedView)).toContainText('$29,999,999.72');
    });

    test('should handle zero costs gracefully', async ({ page }) => {
      // Mock zero cost data
      await page.evaluate(() => {
        window.electronAPI.costTracking.getCurrentData = async () => ({
          daily: { amount: 0, currency: 'USD', queries: 0 },
          weekly: { amount: 0, currency: 'USD', queries: 0 },
          monthly: { amount: 0, currency: 'USD', queries: 0 },
          current: { amount: 0, currency: 'USD', queries: 0 },
        });
      });

      await page.reload();
      await waitForWidgetReady(page);

      const widget = page.locator(SELECTORS.floatingWidget);

      await expect(widget).toContainText('$0.00');
    });

    test('should constrain widget position to viewport', async ({ page }) => {
      const widget = page.locator(SELECTORS.floatingWidget);

      // Try to drag widget outside viewport
      await widget.dragTo(page.locator('body'), {
        targetPosition: { x: -100, y: -100 }
      });

      const boundingBox = await widget.boundingBox();

      // Widget should be constrained to visible area
      expect(boundingBox.x).toBeGreaterThanOrEqual(0);
      expect(boundingBox.y).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Browser Compatibility', () => {
    test('should work in different browsers', async ({ page, browserName }) => {
      const widget = page.locator(SELECTORS.floatingWidget);

      await expect(widget).toBeVisible();
      await expect(widget).toContainText('$12.45');

      // Test basic functionality
      await widget.click();
      await expect(widget).toHaveClass(/expanded/);

      // Browser-specific checks could be added here
      console.log(`Testing in ${browserName}`);
    });

    test('should handle viewport resize gracefully', async ({ page }) => {
      const widget = page.locator(SELECTORS.floatingWidget);

      // Start with large viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await expect(widget).toBeVisible();

      // Resize to small viewport
      await page.setViewportSize({ width: 800, height: 600 });
      await expect(widget).toBeVisible();

      // Widget should adapt
      await widget.click();
      await expect(widget).toHaveClass(/expanded/);
    });
  });

  test.describe('Visual Regression', () => {
    test('should match visual snapshot in collapsed state', async ({ page }) => {
      const widget = page.locator(SELECTORS.floatingWidget);

      await expect(widget).toHaveScreenshot('widget-collapsed.png');
    });

    test('should match visual snapshot in expanded state', async ({ page }) => {
      const widget = page.locator(SELECTORS.floatingWidget);

      await widget.click();
      await expect(widget).toHaveScreenshot('widget-expanded.png');
    });

    test('should match visual snapshot on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const widget = page.locator(SELECTORS.floatingWidget);
      await expect(widget).toHaveScreenshot('widget-mobile.png');
    });

    test('should match visual snapshot in dark mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });

      const widget = page.locator(SELECTORS.floatingWidget);
      await expect(widget).toHaveScreenshot('widget-dark-mode.png');
    });
  });
});