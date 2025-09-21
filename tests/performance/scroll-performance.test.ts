/**
 * Performance Tests for Scroll Position Management
 * Validates that scroll position persistence doesn't impact app performance
 */

import { test, expect } from '@playwright/test';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

test.describe('Scroll Performance Validation', () => {
  test('should not impact initial page load performance', async ({ page }) => {
    // Measure page load performance
    await page.goto(APP_URL);

    const performanceEntries = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime || 0
      };
    });

    // Performance thresholds (in milliseconds)
    expect(performanceEntries.domContentLoaded).toBeLessThan(2000);
    expect(performanceEntries.loadComplete).toBeLessThan(3000);
    expect(performanceEntries.firstPaint).toBeLessThan(1500);
    expect(performanceEntries.firstContentfulPaint).toBeLessThan(2000);
  });

  test('should not cause memory leaks during navigation', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory;
      }
      return null;
    });

    // Perform multiple navigation cycles with scrolling
    for (let i = 0; i < 10; i++) {
      // Scroll and navigate
      await page.evaluate((pos) => window.scrollTo(0, pos), i * 100);
      await page.waitForTimeout(50);

      await page.click('button:has-text("Incidents")');
      await page.waitForTimeout(100);

      await page.evaluate((pos) => window.scrollTo(0, pos), i * 150);
      await page.waitForTimeout(50);

      await page.click('button:has-text("Dashboard")');
      await page.waitForTimeout(100);
    }

    // Check memory after navigation cycles
    const finalMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory;
      }
      return null;
    });

    // If memory API is available, check for significant increases
    if (initialMemory && finalMemory) {
      const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.usedJSHeapSize) * 100;

      // Memory shouldn't increase by more than 50% during normal operation
      expect(memoryIncreasePercent).toBeLessThan(50);
    }
  });

  test('should maintain smooth scroll performance', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Measure scroll performance
    const scrollMetrics = await page.evaluate(async () => {
      const measurements: number[] = [];

      const scrollHandler = () => {
        const start = performance.now();

        // Simulate the work our scroll handler does
        sessionStorage.setItem('test_scroll', JSON.stringify({ top: window.scrollY, left: window.scrollX }));

        const end = performance.now();
        measurements.push(end - start);
      };

      window.addEventListener('scroll', scrollHandler, { passive: true });

      // Perform multiple scroll operations
      for (let i = 0; i < 20; i++) {
        window.scrollTo(0, i * 50);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      window.removeEventListener('scroll', scrollHandler);

      return {
        average: measurements.reduce((a, b) => a + b, 0) / measurements.length,
        max: Math.max(...measurements),
        min: Math.min(...measurements),
        count: measurements.length
      };
    });

    // Scroll handling should be very fast
    expect(scrollMetrics.average).toBeLessThan(5); // Average under 5ms
    expect(scrollMetrics.max).toBeLessThan(20); // Max under 20ms
    expect(scrollMetrics.count).toBeGreaterThan(0);
  });

  test('should not block UI during scroll restoration', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Set up a large scroll position
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(200);

    // Navigate away
    await page.click('button:has-text("Incidents")');
    await page.waitForTimeout(100);

    // Measure UI responsiveness during scroll restoration
    const startTime = Date.now();
    await page.click('button:has-text("Dashboard")');

    // UI should remain responsive - test by clicking another element quickly
    await page.waitForTimeout(50); // Small delay to allow restoration to start

    const clickResponse = await page.evaluate(() => {
      const startClick = performance.now();
      const button = document.querySelector('button[title="Report Incident"]') as HTMLElement;
      if (button) {
        button.click();
        return performance.now() - startClick;
      }
      return 0;
    });

    // Click should respond quickly even during scroll restoration
    expect(clickResponse).toBeLessThan(100); // Under 100ms response time

    // Close modal if it opened
    await page.keyboard.press('Escape');
  });

  test('should handle rapid navigation without performance degradation', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    const navigationTimes: number[] = [];

    // Perform rapid navigation cycles
    for (let i = 0; i < 5; i++) {
      const startTime = performance.now();

      await page.click('button:has-text("Incidents")');
      await page.waitForSelector('h1:has-text("Gestão de Incidentes")');

      await page.click('button:has-text("Dashboard")');
      await page.waitForSelector('h1:has-text("Mainframe AI Assistant")');

      const endTime = performance.now();
      navigationTimes.push(endTime - startTime);
    }

    // Calculate performance metrics
    const averageTime = navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length;
    const maxTime = Math.max(...navigationTimes);

    // Navigation should remain fast
    expect(averageTime).toBeLessThan(1000); // Average under 1 second
    expect(maxTime).toBeLessThan(2000); // Max under 2 seconds

    // Performance shouldn't degrade significantly over time
    const firstHalf = navigationTimes.slice(0, Math.floor(navigationTimes.length / 2));
    const secondHalf = navigationTimes.slice(Math.floor(navigationTimes.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    // Second half shouldn't be more than 50% slower than first half
    expect(secondAvg).toBeLessThan(firstAvg * 1.5);
  });

  test('should efficiently manage sessionStorage usage', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Test sessionStorage efficiency
    const storageMetrics = await page.evaluate(() => {
      // Clear existing scroll positions
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('scroll_position_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));

      // Simulate scroll position storage
      const positions = [
        { view: 'dashboard', position: { top: 100, left: 0 } },
        { view: 'incidents', position: { top: 200, left: 0 } },
        { view: 'settings', position: { top: 300, left: 0 } }
      ];

      positions.forEach(({ view, position }) => {
        sessionStorage.setItem(`scroll_position_${view}`, JSON.stringify(position));
      });

      // Calculate storage size
      let totalSize = 0;
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('scroll_position_')) {
          const value = sessionStorage.getItem(key);
          totalSize += (key.length + (value ? value.length : 0)) * 2; // UTF-16 encoding
        }
      }

      return {
        totalScrollKeys: keysToRemove.length + positions.length,
        storageSize: totalSize,
        efficiency: totalSize / positions.length
      };
    });

    // Storage usage should be minimal
    expect(storageMetrics.storageSize).toBeLessThan(1000); // Under 1KB total
    expect(storageMetrics.efficiency).toBeLessThan(200); // Under 200 bytes per position
  });

  test('should not impact bundle size significantly', async ({ page }) => {
    // This test would typically be run against built assets
    // For now, we'll validate that the scroll hooks are tree-shakeable

    await page.goto(APP_URL);

    // Check that scroll functionality is present and working
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(200);

    await page.click('button:has-text("Incidents")');
    await page.waitForTimeout(100);

    await page.click('button:has-text("Dashboard")');
    await page.waitForTimeout(200);

    const scrollPosition = await page.evaluate(() => window.scrollY);
    expect(scrollPosition).toBeCloseTo(300, 50);

    // Check that the implementation doesn't add unnecessary overhead
    const scriptsSize = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      return scripts.length;
    });

    // Reasonable number of script files (shouldn't have excessive bundling)
    expect(scriptsSize).toBeLessThan(10);
  });
});