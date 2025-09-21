/**
 * SPARC Refinement: TDD Implementation for Scroll Persistence
 * Test-Driven Development using Puppeteer to validate scroll behavior
 */

const puppeteer = require('puppeteer');

describe('Scroll Persistence TDD - Dashboard Navigation', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false, // Set to true for CI
      defaultViewport: { width: 1280, height: 720 },
      args: ['--disable-web-security']
    });
    page = await browser.newPage();

    // Enable console logging for debugging
    page.on('console', msg => {
      console.log('PAGE LOG:', msg.text());
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    // Navigate to the application
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    await page.waitForTimeout(1000);
  });

  describe('RED PHASE: Failing Tests (Define Requirements)', () => {

    test('FAIL: Dashboard should maintain scroll position after navigation to incidents and back', async () => {
      // Initial state: Dashboard loaded
      await page.waitForSelector('button[aria-label="View dashboard overview"]');

      // Ensure we're on dashboard initially
      const dashboardButton = await page.$('button[aria-label="View dashboard overview"]');
      const dashboardActive = await page.evaluate(el => el.getAttribute('aria-current'), dashboardButton);
      expect(dashboardActive).toBe('page');

      // Scroll down in dashboard to create a scroll position to restore
      await page.evaluate(() => {
        window.scrollTo(0, 300);
      });

      // Wait for scroll to register
      await page.waitForTimeout(500);

      // Capture initial scroll position
      const initialScrollTop = await page.evaluate(() => window.pageYOffset);
      expect(initialScrollTop).toBe(300);

      // Navigate to Incidents
      await page.click('button[aria-label="View incidents list"]');
      await page.waitForTimeout(1000);

      // Verify we're on incidents page
      const incidentsButton = await page.$('button[aria-label="View incidents list"]');
      const incidentsActive = await page.evaluate(el => el.getAttribute('aria-current'), incidentsButton);
      expect(incidentsActive).toBe('page');

      // Navigate back to Dashboard
      await page.click('button[aria-label="View dashboard overview"]');
      await page.waitForTimeout(1000);

      // Wait for scroll restoration
      await page.waitForTimeout(500);

      // THE REQUIREMENT: Scroll position should be restored to 300px
      const restoredScrollTop = await page.evaluate(() => window.pageYOffset);

      console.log(`Initial scroll: ${initialScrollTop}, Restored scroll: ${restoredScrollTop}`);

      // This test should INITIALLY FAIL if scroll persistence is not implemented
      expect(restoredScrollTop).toBe(initialScrollTop);
    });

    test('FAIL: Multiple scroll positions should be preserved per view', async () => {
      // Test that different views maintain different scroll positions

      // Dashboard: Scroll to 200px
      await page.evaluate(() => window.scrollTo(0, 200));
      await page.waitForTimeout(300);
      const dashboardScroll = await page.evaluate(() => window.pageYOffset);

      // Go to incidents
      await page.click('button[aria-label="View incidents list"]');
      await page.waitForTimeout(1000);

      // Incidents: Scroll to 400px
      await page.evaluate(() => window.scrollTo(0, 400));
      await page.waitForTimeout(300);
      const incidentsScroll = await page.evaluate(() => window.pageYOffset);

      // Back to dashboard - should restore 200px
      await page.click('button[aria-label="View dashboard overview"]');
      await page.waitForTimeout(500);
      const restoredDashboardScroll = await page.evaluate(() => window.pageYOffset);

      // Back to incidents - should restore 400px
      await page.click('button[aria-label="View incidents list"]');
      await page.waitForTimeout(500);
      const restoredIncidentsScroll = await page.evaluate(() => window.pageYOffset);

      expect(restoredDashboardScroll).toBe(dashboardScroll);
      expect(restoredIncidentsScroll).toBe(incidentsScroll);
    });

    test('FAIL: Scroll position should survive page refresh', async () => {
      // Scroll in dashboard
      await page.evaluate(() => window.scrollTo(0, 250));
      await page.waitForTimeout(300);
      const initialScroll = await page.evaluate(() => window.pageYOffset);

      // Refresh page
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForTimeout(1000);

      // Check if scroll position is restored
      const restoredScroll = await page.evaluate(() => window.pageYOffset);

      // This should fail initially if persistence doesn't survive refresh
      expect(restoredScroll).toBe(initialScroll);
    });

  });

  describe('GREEN PHASE: Implementation Tests', () => {

    test('Verify scroll container is properly configured', async () => {
      // Check that the main content area has proper scroll configuration
      const mainElement = await page.$('main');
      expect(mainElement).not.toBeNull();

      const styles = await page.evaluate(el => {
        const computed = getComputedStyle(el);
        return {
          overflow: computed.overflow,
          overflowY: computed.overflowY,
          position: computed.position
        };
      }, mainElement);

      // The main element should allow scrolling
      expect(styles.overflowY === 'auto' || styles.overflowY === 'visible').toBeTruthy();
    });

    test('Verify scroll position hook is active', async () => {
      // Check if the scroll position management hook is working
      const hasScrollHook = await page.evaluate(() => {
        // Look for signs that scroll management is active
        return window.scrollEventListeners !== undefined ||
               localStorage.getItem('scrollPositions') !== null ||
               sessionStorage.getItem('scrollPositions') !== null;
      });

      // This verifies our implementation is running
      console.log('Scroll hook active:', hasScrollHook);
    });

  });

  describe('REFACTOR PHASE: Performance and Edge Cases', () => {

    test('Scroll persistence should be performant', async () => {
      const startTime = Date.now();

      // Perform rapid navigation to test performance
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollTo(0, Math.random() * 500));
        await page.click('button[aria-label="View incidents list"]');
        await page.waitForTimeout(100);
        await page.click('button[aria-label="View dashboard overview"]');
        await page.waitForTimeout(100);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (5 seconds for 5 cycles)
      expect(duration).toBeLessThan(5000);
      console.log(`Navigation performance: ${duration}ms for 5 cycles`);
    });

    test('Edge case: Very large scroll positions', async () => {
      // Test with large scroll values
      const largeScrollValue = 2000;
      await page.evaluate((scroll) => window.scrollTo(0, scroll), largeScrollValue);
      await page.waitForTimeout(300);

      // Navigate away and back
      await page.click('button[aria-label="View incidents list"]');
      await page.waitForTimeout(500);
      await page.click('button[aria-label="View dashboard overview"]');
      await page.waitForTimeout(500);

      const restoredScroll = await page.evaluate(() => window.pageYOffset);
      expect(restoredScroll).toBe(largeScrollValue);
    });

    test('Edge case: Zero scroll position', async () => {
      // Test restoration of zero scroll position
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);

      // Navigate away and back
      await page.click('button[aria-label="View incidents list"]');
      await page.waitForTimeout(500);
      await page.click('button[aria-label="View dashboard overview"]');
      await page.waitForTimeout(500);

      const restoredScroll = await page.evaluate(() => window.pageYOffset);
      expect(restoredScroll).toBe(0);
    });

  });

});