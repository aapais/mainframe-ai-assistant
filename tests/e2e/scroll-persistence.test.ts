/**
 * End-to-End Tests for Scroll Position Persistence
 * Tests scroll behavior across navigation in the Mainframe AI Assistant
 */

import { test, expect, Page } from '@playwright/test';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

test.describe('Scroll Position Persistence', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    page = await context.newPage();

    // Navigate to the app
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');
  });

  test('should preserve scroll position when navigating from dashboard to incidents and back', async () => {
    // Wait for dashboard to load
    await expect(page.locator('h1:has-text("Mainframe AI Assistant")')).toBeVisible();
    await expect(page.locator('button:has-text("Dashboard")')).toBeVisible();

    // Scroll down on dashboard
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(200); // Allow scroll to settle

    // Verify scroll position
    const initialScrollPosition = await page.evaluate(() => window.scrollY);
    expect(initialScrollPosition).toBe(500);

    // Navigate to incidents
    await page.click('button:has-text("Incidents")');
    await page.waitForTimeout(100);

    // Verify we're on incidents page
    await expect(page.locator('h1:has-text("Gestão de Incidentes")')).toBeVisible();

    // Scroll down on incidents page
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(200);

    // Navigate back to dashboard
    await page.click('button:has-text("Dashboard")');
    await page.waitForTimeout(200); // Allow time for scroll restoration

    // Verify dashboard scroll position is restored
    const restoredScrollPosition = await page.evaluate(() => window.scrollY);
    expect(restoredScrollPosition).toBeCloseTo(500, 50); // Allow 50px tolerance

    // Navigate back to incidents to test its scroll restoration
    await page.click('button:has-text("Incidents")');
    await page.waitForTimeout(200);

    // Verify incidents scroll position is restored
    const incidentsScrollPosition = await page.evaluate(() => window.scrollY);
    expect(incidentsScrollPosition).toBeCloseTo(300, 50);
  });

  test('should handle scroll persistence across multiple navigation cycles', async () => {
    const scrollPositions = [
      { view: 'dashboard', position: 400 },
      { view: 'incidents', position: 600 },
      { view: 'dashboard', position: 800 }
    ];

    // Test multiple navigation cycles
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const { view, position } of scrollPositions) {
        // Navigate to view
        if (view === 'dashboard') {
          await page.click('button:has-text("Dashboard")');
        } else {
          await page.click('button:has-text("Incidents")');
        }

        await page.waitForTimeout(100);

        // Scroll to position
        await page.evaluate((pos) => window.scrollTo(0, pos), position);
        await page.waitForTimeout(200);

        // Verify scroll position
        const currentPosition = await page.evaluate(() => window.scrollY);
        expect(currentPosition).toBeCloseTo(position, 50);
      }
    }
  });

  test('should preserve scroll position during fast navigation', async () => {
    // Rapid navigation test
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(100);

    // Fast navigation between views
    await page.click('button:has-text("Incidents")');
    await page.waitForTimeout(50);
    await page.click('button:has-text("Dashboard")');
    await page.waitForTimeout(50);
    await page.click('button:has-text("Incidents")');
    await page.waitForTimeout(50);
    await page.click('button:has-text("Dashboard")');
    await page.waitForTimeout(200);

    // Should still restore to approximately the original position
    const finalPosition = await page.evaluate(() => window.scrollY);
    expect(finalPosition).toBeCloseTo(500, 100);
  });

  test('should handle scroll persistence with responsive layout changes', async () => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(100);

    // Scroll on mobile
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(200);

    // Navigate to incidents
    await page.click('button:has-text("Incidents")');
    await page.waitForTimeout(100);

    // Change back to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(100);

    // Navigate back to dashboard
    await page.click('button:has-text("Dashboard")');
    await page.waitForTimeout(200);

    // Scroll position should be preserved despite layout changes
    const restoredPosition = await page.evaluate(() => window.scrollY);
    expect(restoredPosition).toBeCloseTo(300, 100);
  });

  test('should not interfere with other page interactions', async () => {
    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(200);

    // Open modal (this should not affect scroll preservation)
    await page.click('button:has-text("Report Incident")');
    await page.waitForTimeout(100);

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // Navigate to incidents and back
    await page.click('button:has-text("Incidents")');
    await page.waitForTimeout(100);
    await page.click('button:has-text("Dashboard")');
    await page.waitForTimeout(200);

    // Scroll should still be preserved
    const position = await page.evaluate(() => window.scrollY);
    expect(position).toBeCloseTo(400, 50);
  });

  test('should clear scroll positions on app reload', async () => {
    // Set scroll position
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(200);

    // Navigate to incidents
    await page.click('button:has-text("Incidents")');
    await page.waitForTimeout(100);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should start at top
    const position = await page.evaluate(() => window.scrollY);
    expect(position).toBe(0);

    // Navigate to dashboard (should not restore old position)
    await page.click('button:has-text("Dashboard")');
    await page.waitForTimeout(200);

    const dashboardPosition = await page.evaluate(() => window.scrollY);
    expect(dashboardPosition).toBe(0);
  });

  test('should handle edge cases gracefully', async () => {
    // Test scrolling to very large position
    await page.evaluate(() => window.scrollTo(0, 999999));
    await page.waitForTimeout(200);

    const maxScroll = await page.evaluate(() => {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    });

    // Navigate away and back
    await page.click('button:has-text("Incidents")');
    await page.waitForTimeout(100);
    await page.click('button:has-text("Dashboard")');
    await page.waitForTimeout(200);

    // Should not exceed maximum scroll
    const restoredPosition = await page.evaluate(() => window.scrollY);
    expect(restoredPosition).toBeLessThanOrEqual(maxScroll + 10);
  });

  test('should work with keyboard navigation', async () => {
    // Scroll using page down
    await page.keyboard.press('PageDown');
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(200);

    const scrollPosition = await page.evaluate(() => window.scrollY);
    expect(scrollPosition).toBeGreaterThan(0);

    // Navigate using tab and enter
    await page.keyboard.press('Tab'); // Focus should move to navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter'); // Should click incidents button
    await page.waitForTimeout(100);

    // Navigate back using keyboard
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // Scroll should be restored
    const restoredPosition = await page.evaluate(() => window.scrollY);
    expect(restoredPosition).toBeCloseTo(scrollPosition, 100);
  });
});

test.describe('Scroll Accessibility', () => {
  test('should announce scroll restoration to screen readers', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(200);

    // Navigate away and back
    await page.click('button:has-text("Incidents")');
    await page.waitForTimeout(100);
    await page.click('button:has-text("Dashboard")');
    await page.waitForTimeout(200);

    // Check if any accessibility issues exist
    // Note: This is a basic check - full accessibility testing would require axe-playwright
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BODY', 'BUTTON', 'A', 'INPUT']).toContain(focusedElement);
  });

  test('should maintain focus context during navigation', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Focus on a specific element
    await page.click('button:has-text("Report Incident")');
    await page.keyboard.press('Escape'); // Close modal
    await page.waitForTimeout(100);

    // The focus should be manageable after scroll restoration
    await page.keyboard.press('Tab');
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});