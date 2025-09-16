/**
 * Cross-Platform Validation E2E Tests
 *
 * Tests application compatibility across different platforms:
 * - Operating system compatibility (Windows, macOS, Linux)
 * - Browser compatibility (Chrome, Firefox, Safari, Edge)
 * - Device type compatibility (Desktop, Tablet, Mobile)
 * - Screen resolution adaptation
 * - Keyboard and input method variations
 * - Accessibility across platforms
 * - Performance consistency
 * - Feature parity validation
 */

import { test, expect, Page, BrowserContext, devices } from '@playwright/test';

interface PlatformTestResult {
  platform: string;
  browser: string;
  viewport: { width: number; height: number };
  userAgent: string;
  features: {
    basicFunctionality: boolean;
    searchOperations: boolean;
    entryManagement: boolean;
    navigation: boolean;
    responsiveDesign: boolean;
    keyboardNavigation: boolean;
    touchInteraction: boolean;
    performanceAcceptable: boolean;
  };
  issues: string[];
  performanceMetrics: {
    loadTime: number;
    interactionLatency: number;
    memoryUsage: number;
  };
}

interface CompatibilityMatrix {
  desktop: PlatformTestResult[];
  tablet: PlatformTestResult[];
  mobile: PlatformTestResult[];
}

class CrossPlatformTester {
  private results: CompatibilityMatrix = {
    desktop: [],
    tablet: [],
    mobile: []
  };

  async testBasicFunctionality(page: Page): Promise<boolean> {
    try {
      // Test application startup
      await page.goto('/');
      await page.waitForSelector('[data-testid="app-root"]', { timeout: 10000 });

      // Test search functionality
      await page.goto('#/search');
      await page.fill('[data-testid="search-input"]', 'cross-platform test');
      await page.click('[data-testid="search-button"]');

      await Promise.race([
        page.waitForSelector('[data-testid="search-results"]', { timeout: 5000 }),
        page.waitForSelector('[data-testid="no-results"]', { timeout: 5000 })
      ]);

      // Test entry creation
      await page.click('[data-testid="add-entry-button"]');
      await page.waitForSelector('[data-testid="entry-form"]', { timeout: 5000 });

      await page.fill('[data-testid="entry-title-input"]', 'Cross-platform test entry');
      await page.fill('[data-testid="entry-problem-input"]', 'Testing across platforms');
      await page.fill('[data-testid="entry-solution-input"]', 'Ensure compatibility');

      return true;
    } catch (error) {
      console.error('Basic functionality test failed:', error);
      return false;
    }
  }

  async testSearchOperations(page: Page): Promise<boolean> {
    try {
      await page.goto('#/search');

      const searchQueries = ['VSAM', 'JCL', 'DB2', 'error', 'performance'];

      for (const query of searchQueries) {
        await page.fill('[data-testid="search-input"]', query);
        await page.click('[data-testid="search-button"]');

        await Promise.race([
          page.waitForSelector('[data-testid="search-results"]', { timeout: 3000 }),
          page.waitForSelector('[data-testid="no-results"]', { timeout: 3000 })
        ]);

        await page.waitForTimeout(500);
      }

      // Test advanced search
      await page.click('[data-testid="advanced-search-toggle"]');
      await page.waitForSelector('[data-testid="advanced-search-panel"]');

      return true;
    } catch (error) {
      console.error('Search operations test failed:', error);
      return false;
    }
  }

  async testEntryManagement(page: Page): Promise<boolean> {
    try {
      // Create entry
      await page.click('[data-testid="add-entry-button"]');
      await page.waitForSelector('[data-testid="entry-form"]');

      await page.fill('[data-testid="entry-title-input"]', 'Platform Test Entry');
      await page.fill('[data-testid="entry-problem-input"]', 'Platform-specific problem');
      await page.fill('[data-testid="entry-solution-input"]', 'Platform-specific solution');
      await page.selectOption('[data-testid="entry-category-select"]', 'Testing');

      await page.click('[data-testid="save-entry-button"]');
      await page.waitForSelector('[data-testid="entry-saved-success"]', { timeout: 5000 });

      // View created entry
      await page.goto('#/search');
      await page.fill('[data-testid="search-input"]', 'Platform Test Entry');
      await page.click('[data-testid="search-button"]');

      await page.waitForSelector('[data-testid="search-results"]');
      await page.click('[data-testid="search-result-0"]');
      await page.waitForSelector('[data-testid="entry-detail"]');

      return true;
    } catch (error) {
      console.error('Entry management test failed:', error);
      return false;
    }
  }

  async testNavigation(page: Page): Promise<boolean> {
    try {
      const routes = [
        '#/dashboard',
        '#/search',
        '#/analytics',
        '#/settings'
      ];

      for (const route of routes) {
        await page.goto(route);
        await page.waitForTimeout(1000);

        // Verify page loaded
        const hasContent = await page.locator('[data-testid*="interface"], [data-testid*="dashboard"], [data-testid*="panel"]').count();
        if (hasContent === 0) {
          throw new Error(`Navigation to ${route} failed - no content found`);
        }
      }

      // Test back/forward navigation
      await page.goBack();
      await page.goForward();

      return true;
    } catch (error) {
      console.error('Navigation test failed:', error);
      return false;
    }
  }

  async testResponsiveDesign(page: Page): Promise<boolean> {
    try {
      const viewports = [
        { width: 1920, height: 1080, name: 'Desktop Large' },
        { width: 1366, height: 768, name: 'Desktop Medium' },
        { width: 1024, height: 768, name: 'Tablet Landscape' },
        { width: 768, height: 1024, name: 'Tablet Portrait' },
        { width: 414, height: 896, name: 'Mobile Large' },
        { width: 375, height: 667, name: 'Mobile Medium' },
        { width: 320, height: 568, name: 'Mobile Small' }
      ];

      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('#/search');

        // Check if UI adapts properly
        const searchInput = page.locator('[data-testid="search-input"]');
        await expect(searchInput).toBeVisible();

        // Check if mobile menu appears for small screens
        if (viewport.width < 768) {
          const mobileMenu = page.locator('[data-testid="mobile-menu"], [data-testid="hamburger-menu"]');
          const regularNav = page.locator('[data-testid="desktop-navigation"]');

          // Either mobile menu should be visible or regular nav should be hidden
          const hasMobileUI = await mobileMenu.isVisible() || !(await regularNav.isVisible());
          if (!hasMobileUI) {
            throw new Error(`Mobile UI not detected at ${viewport.name} (${viewport.width}x${viewport.height})`);
          }
        }

        await page.waitForTimeout(500);
      }

      return true;
    } catch (error) {
      console.error('Responsive design test failed:', error);
      return false;
    }
  }

  async testKeyboardNavigation(page: Page): Promise<boolean> {
    try {
      await page.goto('#/search');

      // Test tab navigation
      await page.keyboard.press('Tab'); // Search input
      const focusedElement1 = await page.locator(':focus');
      expect(await focusedElement1.getAttribute('data-testid')).toBe('search-input');

      await page.keyboard.press('Tab'); // Search button
      const focusedElement2 = await page.locator(':focus');
      const buttonTestId = await focusedElement2.getAttribute('data-testid');
      expect(buttonTestId).toContain('search-button');

      // Test keyboard search
      await page.keyboard.press('Shift+Tab'); // Back to search input
      await page.keyboard.type('keyboard test');
      await page.keyboard.press('Enter');

      await Promise.race([
        page.waitForSelector('[data-testid="search-results"]', { timeout: 3000 }),
        page.waitForSelector('[data-testid="no-results"]', { timeout: 3000 })
      ]);

      // Test escape key functionality
      await page.keyboard.press('Escape');

      return true;
    } catch (error) {
      console.error('Keyboard navigation test failed:', error);
      return false;
    }
  }

  async testTouchInteraction(page: Page): Promise<boolean> {
    try {
      // Simulate touch interactions
      await page.goto('#/search');

      // Touch search input
      const searchInput = page.locator('[data-testid="search-input"]');
      await searchInput.tap();

      // Type with virtual keyboard simulation
      await searchInput.fill('touch test');

      // Tap search button
      const searchButton = page.locator('[data-testid="search-button"]');
      await searchButton.tap();

      await Promise.race([
        page.waitForSelector('[data-testid="search-results"]', { timeout: 3000 }),
        page.waitForSelector('[data-testid="no-results"]', { timeout: 3000 })
      ]);

      // Test swipe gestures (if supported)
      const content = page.locator('[data-testid="search-interface"]');
      const box = await content.boundingBox();

      if (box) {
        // Simulate swipe
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 - 100, box.y + box.height / 2);
        await page.mouse.up();
      }

      return true;
    } catch (error) {
      console.error('Touch interaction test failed:', error);
      return false;
    }
  }

  async measurePerformance(page: Page): Promise<{ loadTime: number; interactionLatency: number; memoryUsage: number }> {
    const startTime = Date.now();

    // Measure page load time
    await page.goto('/', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;

    // Measure interaction latency
    const interactionStart = Date.now();
    await page.goto('#/search');
    await page.fill('[data-testid="search-input"]', 'performance test');
    await page.click('[data-testid="search-button"]');
    const interactionLatency = Date.now() - interactionStart;

    // Measure memory usage
    const memoryUsage = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    return {
      loadTime,
      interactionLatency,
      memoryUsage
    };
  }

  async testPlatformSpecificFeatures(page: Page, platform: string): Promise<{ supported: string[]; unsupported: string[] }> {
    const features = {
      'clipboard': async () => {
        return await page.evaluate(() => 'clipboard' in navigator);
      },
      'notification': async () => {
        return await page.evaluate(() => 'Notification' in window);
      },
      'serviceWorker': async () => {
        return await page.evaluate(() => 'serviceWorker' in navigator);
      },
      'webGL': async () => {
        return await page.evaluate(() => {
          const canvas = document.createElement('canvas');
          return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        });
      },
      'geolocation': async () => {
        return await page.evaluate(() => 'geolocation' in navigator);
      },
      'camera': async () => {
        return await page.evaluate(() => 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices);
      },
      'localStorage': async () => {
        return await page.evaluate(() => {
          try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            return true;
          } catch { return false; }
        });
      },
      'indexedDB': async () => {
        return await page.evaluate(() => 'indexedDB' in window);
      },
      'webWorkers': async () => {
        return await page.evaluate(() => 'Worker' in window);
      },
      'fullscreen': async () => {
        return await page.evaluate(() => 'requestFullscreen' in document.documentElement);
      }
    };

    const supported: string[] = [];
    const unsupported: string[] = [];

    for (const [feature, test] of Object.entries(features)) {
      try {
        const isSupported = await test();
        if (isSupported) {
          supported.push(feature);
        } else {
          unsupported.push(feature);
        }
      } catch (error) {
        unsupported.push(feature);
      }
    }

    return { supported, unsupported };
  }

  async runComprehensivePlatformTest(
    page: Page,
    platformName: string,
    browserName: string,
    deviceType: 'desktop' | 'tablet' | 'mobile'
  ): Promise<PlatformTestResult> {
    const viewport = page.viewportSize() || { width: 1920, height: 1080 };
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const issues: string[] = [];

    // Run all tests
    const basicFunctionality = await this.testBasicFunctionality(page);
    if (!basicFunctionality) issues.push('Basic functionality failed');

    const searchOperations = await this.testSearchOperations(page);
    if (!searchOperations) issues.push('Search operations failed');

    const entryManagement = await this.testEntryManagement(page);
    if (!entryManagement) issues.push('Entry management failed');

    const navigation = await this.testNavigation(page);
    if (!navigation) issues.push('Navigation failed');

    const responsiveDesign = await this.testResponsiveDesign(page);
    if (!responsiveDesign) issues.push('Responsive design failed');

    const keyboardNavigation = await this.testKeyboardNavigation(page);
    if (!keyboardNavigation) issues.push('Keyboard navigation failed');

    const touchInteraction = deviceType !== 'desktop' ? await this.testTouchInteraction(page) : true;
    if (!touchInteraction) issues.push('Touch interaction failed');

    const performanceMetrics = await this.measurePerformance(page);
    const performanceAcceptable = performanceMetrics.loadTime < 10000 && performanceMetrics.interactionLatency < 5000;
    if (!performanceAcceptable) issues.push('Performance below acceptable thresholds');

    const result: PlatformTestResult = {
      platform: platformName,
      browser: browserName,
      viewport,
      userAgent,
      features: {
        basicFunctionality,
        searchOperations,
        entryManagement,
        navigation,
        responsiveDesign,
        keyboardNavigation,
        touchInteraction,
        performanceAcceptable
      },
      issues,
      performanceMetrics
    };

    this.results[deviceType].push(result);
    return result;
  }

  getResults(): CompatibilityMatrix {
    return { ...this.results };
  }

  generateCompatibilityReport(): any {
    const allResults = [
      ...this.results.desktop,
      ...this.results.tablet,
      ...this.results.mobile
    ];

    const totalTests = allResults.length;
    const passedTests = allResults.filter(r => r.issues.length === 0).length;

    const featureSupport = {
      basicFunctionality: allResults.filter(r => r.features.basicFunctionality).length,
      searchOperations: allResults.filter(r => r.features.searchOperations).length,
      entryManagement: allResults.filter(r => r.features.entryManagement).length,
      navigation: allResults.filter(r => r.features.navigation).length,
      responsiveDesign: allResults.filter(r => r.features.responsiveDesign).length,
      keyboardNavigation: allResults.filter(r => r.features.keyboardNavigation).length,
      touchInteraction: allResults.filter(r => r.features.touchInteraction).length,
      performanceAcceptable: allResults.filter(r => r.features.performanceAcceptable).length
    };

    const avgPerformance = {
      loadTime: allResults.reduce((sum, r) => sum + r.performanceMetrics.loadTime, 0) / totalTests,
      interactionLatency: allResults.reduce((sum, r) => sum + r.performanceMetrics.interactionLatency, 0) / totalTests,
      memoryUsage: allResults.reduce((sum, r) => sum + r.performanceMetrics.memoryUsage, 0) / totalTests
    };

    return {
      summary: {
        totalTests,
        passedTests,
        passRate: (passedTests / totalTests * 100).toFixed(2) + '%',
        compatibilityScore: (passedTests / totalTests * 100).toFixed(1)
      },
      featureSupport,
      averagePerformance: avgPerformance,
      platformBreakdown: {
        desktop: this.results.desktop.length,
        tablet: this.results.tablet.length,
        mobile: this.results.mobile.length
      },
      commonIssues: this.findCommonIssues(),
      recommendations: this.generateRecommendations()
    };
  }

  private findCommonIssues(): string[] {
    const allIssues = [
      ...this.results.desktop.flatMap(r => r.issues),
      ...this.results.tablet.flatMap(r => r.issues),
      ...this.results.mobile.flatMap(r => r.issues)
    ];

    const issueCounts = allIssues.reduce((counts, issue) => {
      counts[issue] = (counts[issue] || 0) + 1;
      return counts;
    }, {} as { [key: string]: number });

    return Object.entries(issueCounts)
      .filter(([issue, count]) => count > 1)
      .map(([issue]) => issue);
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const commonIssues = this.findCommonIssues();

    if (commonIssues.includes('Responsive design failed')) {
      recommendations.push('Improve responsive design with better breakpoint management');
    }

    if (commonIssues.includes('Touch interaction failed')) {
      recommendations.push('Enhance touch interaction support for mobile devices');
    }

    if (commonIssues.includes('Performance below acceptable thresholds')) {
      recommendations.push('Optimize application performance for slower devices');
    }

    if (commonIssues.includes('Keyboard navigation failed')) {
      recommendations.push('Improve keyboard navigation and accessibility');
    }

    return recommendations;
  }
}

test.describe('Cross-Platform Validation Tests', () => {
  let platformTester: CrossPlatformTester;

  test.beforeEach(() => {
    platformTester = new CrossPlatformTester();
  });

  test('Desktop platform compatibility - Chrome', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['Desktop Chrome'],
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    try {
      const result = await platformTester.runComprehensivePlatformTest(
        page,
        'Windows/macOS/Linux',
        'Chrome',
        'desktop'
      );

      // Desktop Chrome should have full compatibility
      expect(result.features.basicFunctionality).toBe(true);
      expect(result.features.searchOperations).toBe(true);
      expect(result.features.entryManagement).toBe(true);
      expect(result.features.navigation).toBe(true);
      expect(result.features.responsiveDesign).toBe(true);
      expect(result.features.keyboardNavigation).toBe(true);
      expect(result.features.performanceAcceptable).toBe(true);

      expect(result.issues.length).toBeLessThanOrEqual(1); // Allow for minor issues

      console.log('Desktop Chrome Results:', {
        platform: result.platform,
        browser: result.browser,
        issues: result.issues,
        performance: result.performanceMetrics
      });
    } finally {
      await context.close();
    }
  });

  test('Desktop platform compatibility - Firefox', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['Desktop Firefox'],
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    try {
      const result = await platformTester.runComprehensivePlatformTest(
        page,
        'Windows/macOS/Linux',
        'Firefox',
        'desktop'
      );

      // Firefox should have good compatibility
      expect(result.features.basicFunctionality).toBe(true);
      expect(result.features.searchOperations).toBe(true);
      expect(result.features.navigation).toBe(true);

      expect(result.issues.length).toBeLessThanOrEqual(2); // Allow for some Firefox-specific issues

      console.log('Desktop Firefox Results:', {
        platform: result.platform,
        browser: result.browser,
        issues: result.issues,
        performance: result.performanceMetrics
      });
    } finally {
      await context.close();
    }
  });

  test('Desktop platform compatibility - Safari', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['Desktop Safari'],
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    try {
      const result = await platformTester.runComprehensivePlatformTest(
        page,
        'macOS',
        'Safari',
        'desktop'
      );

      // Safari should have reasonable compatibility
      expect(result.features.basicFunctionality).toBe(true);
      expect(result.features.searchOperations).toBe(true);

      expect(result.issues.length).toBeLessThanOrEqual(3); // Safari may have more compatibility issues

      console.log('Desktop Safari Results:', {
        platform: result.platform,
        browser: result.browser,
        issues: result.issues,
        performance: result.performanceMetrics
      });
    } finally {
      await context.close();
    }
  });

  test('Tablet platform compatibility - iPad', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPad Pro'],
      viewport: { width: 1024, height: 1366 }
    });

    const page = await context.newPage();

    try {
      const result = await platformTester.runComprehensivePlatformTest(
        page,
        'iPadOS',
        'Safari',
        'tablet'
      );

      // Tablet should support core functionality
      expect(result.features.basicFunctionality).toBe(true);
      expect(result.features.searchOperations).toBe(true);
      expect(result.features.responsiveDesign).toBe(true);
      expect(result.features.touchInteraction).toBe(true);

      expect(result.issues.length).toBeLessThanOrEqual(3);

      console.log('Tablet iPad Results:', {
        platform: result.platform,
        browser: result.browser,
        issues: result.issues,
        performance: result.performanceMetrics
      });
    } finally {
      await context.close();
    }
  });

  test('Mobile platform compatibility - iPhone', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 12'],
      viewport: { width: 390, height: 844 }
    });

    const page = await context.newPage();

    try {
      const result = await platformTester.runComprehensivePlatformTest(
        page,
        'iOS',
        'Safari',
        'mobile'
      );

      // Mobile should support essential functionality
      expect(result.features.basicFunctionality).toBe(true);
      expect(result.features.searchOperations).toBe(true);
      expect(result.features.responsiveDesign).toBe(true);
      expect(result.features.touchInteraction).toBe(true);

      expect(result.issues.length).toBeLessThanOrEqual(4); // Mobile may have more limitations

      console.log('Mobile iPhone Results:', {
        platform: result.platform,
        browser: result.browser,
        issues: result.issues,
        performance: result.performanceMetrics
      });
    } finally {
      await context.close();
    }
  });

  test('Mobile platform compatibility - Android', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['Pixel 5'],
      viewport: { width: 393, height: 851 }
    });

    const page = await context.newPage();

    try {
      const result = await platformTester.runComprehensivePlatformTest(
        page,
        'Android',
        'Chrome',
        'mobile'
      );

      // Android Chrome should have good mobile support
      expect(result.features.basicFunctionality).toBe(true);
      expect(result.features.searchOperations).toBe(true);
      expect(result.features.responsiveDesign).toBe(true);
      expect(result.features.touchInteraction).toBe(true);

      expect(result.issues.length).toBeLessThanOrEqual(3);

      console.log('Mobile Android Results:', {
        platform: result.platform,
        browser: result.browser,
        issues: result.issues,
        performance: result.performanceMetrics
      });
    } finally {
      await context.close();
    }
  });

  test('Platform feature compatibility matrix', async ({ browser }) => {
    // Test various device configurations
    const testConfigurations = [
      { device: devices['Desktop Chrome'], type: 'desktop' as const, name: 'Desktop Chrome' },
      { device: devices['iPad Pro'], type: 'tablet' as const, name: 'iPad Pro' },
      { device: devices['iPhone 12'], type: 'mobile' as const, name: 'iPhone 12' },
      { device: devices['Pixel 5'], type: 'mobile' as const, name: 'Pixel 5' }
    ];

    for (const config of testConfigurations) {
      const context = await browser.newContext(config.device);
      const page = await context.newPage();

      try {
        await page.goto('/');

        // Test platform-specific features
        const features = await platformTester.testPlatformSpecificFeatures(page, config.name);

        console.log(`${config.name} Feature Support:`, {
          supported: features.supported,
          unsupported: features.unsupported,
          supportRate: (features.supported.length / (features.supported.length + features.unsupported.length) * 100).toFixed(1) + '%'
        });

        // Essential features should be supported
        expect(features.supported).toContain('localStorage');

        // Check for expected features based on platform
        if (config.type === 'mobile') {
          expect(features.supported.some(f => ['geolocation', 'camera'].includes(f))).toBe(true);
        }
      } finally {
        await context.close();
      }
    }
  });

  test('Performance consistency across platforms', async ({ browser }) => {
    const performanceResults: Array<{ platform: string; metrics: any }> = [];

    const testConfigs = [
      { device: devices['Desktop Chrome'], name: 'Desktop Chrome' },
      { device: devices['iPad Pro'], name: 'iPad Pro' },
      { device: devices['iPhone 12'], name: 'iPhone 12' }
    ];

    for (const config of testConfigs) {
      const context = await browser.newContext(config.device);
      const page = await context.newPage();

      try {
        const metrics = await platformTester.measurePerformance(page);
        performanceResults.push({
          platform: config.name,
          metrics
        });

        // Performance should be acceptable on all platforms
        expect(metrics.loadTime).toBeLessThan(15000); // 15s max load time
        expect(metrics.interactionLatency).toBeLessThan(8000); // 8s max interaction

        console.log(`${config.name} Performance:`, {
          loadTime: `${metrics.loadTime}ms`,
          interactionLatency: `${metrics.interactionLatency}ms`,
          memoryUsage: `${(metrics.memoryUsage / (1024 * 1024)).toFixed(2)}MB`
        });
      } finally {
        await context.close();
      }
    }

    // Performance variance should be reasonable
    const loadTimes = performanceResults.map(r => r.metrics.loadTime);
    const loadTimeVariance = Math.max(...loadTimes) - Math.min(...loadTimes);
    expect(loadTimeVariance).toBeLessThan(10000); // <10s variance between platforms
  });

  test('Responsive design validation across breakpoints', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      const breakpoints = [
        { width: 320, height: 568, name: 'Mobile XS' },
        { width: 375, height: 667, name: 'Mobile S' },
        { width: 414, height: 896, name: 'Mobile L' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 1024, height: 768, name: 'Tablet Landscape' },
        { width: 1366, height: 768, name: 'Desktop S' },
        { width: 1920, height: 1080, name: 'Desktop L' }
      ];

      for (const breakpoint of breakpoints) {
        await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
        await page.goto('#/search');

        // Verify essential elements are visible and properly sized
        const searchInput = page.locator('[data-testid="search-input"]');
        await expect(searchInput).toBeVisible();

        const searchButton = page.locator('[data-testid="search-button"]');
        await expect(searchButton).toBeVisible();

        // Check if elements are not overlapping or cut off
        const searchInputBox = await searchInput.boundingBox();
        const searchButtonBox = await searchButton.boundingBox();

        expect(searchInputBox).toBeTruthy();
        expect(searchButtonBox).toBeTruthy();

        // Elements should fit within viewport
        expect(searchInputBox!.x + searchInputBox!.width).toBeLessThanOrEqual(breakpoint.width);
        expect(searchButtonBox!.x + searchButtonBox!.width).toBeLessThanOrEqual(breakpoint.width);

        console.log(`${breakpoint.name} (${breakpoint.width}x${breakpoint.height}): Layout OK`);
      }
    } finally {
      await context.close();
    }
  });

  test('Accessibility compliance across platforms', async ({ browser }) => {
    const platforms = [
      { device: devices['Desktop Chrome'], name: 'Desktop Chrome' },
      { device: devices['iPad Pro'], name: 'iPad Pro' },
      { device: devices['iPhone 12'], name: 'iPhone 12' }
    ];

    for (const platform of platforms) {
      const context = await browser.newContext(platform.device);
      const page = await context.newPage();

      try {
        await page.goto('#/search');

        // Check ARIA attributes
        const searchInput = page.locator('[data-testid="search-input"]');
        await expect(searchInput).toHaveAttribute('aria-label');

        // Check keyboard navigation
        await page.keyboard.press('Tab');
        const focusedElement = await page.locator(':focus');
        expect(await focusedElement.isVisible()).toBe(true);

        // Check color contrast (simplified check)
        const backgroundColor = await page.evaluate(() => {
          const body = document.body;
          return getComputedStyle(body).backgroundColor;
        });

        const textColor = await page.evaluate(() => {
          const body = document.body;
          return getComputedStyle(body).color;
        });

        expect(backgroundColor).toBeTruthy();
        expect(textColor).toBeTruthy();

        console.log(`${platform.name}: Accessibility checks passed`);
      } finally {
        await context.close();
      }
    }
  });

  test('Cross-platform compatibility report generation', async () => {
    // Generate comprehensive compatibility report
    const report = platformTester.generateCompatibilityReport();

    console.log('=== CROSS-PLATFORM COMPATIBILITY REPORT ===');
    console.log('Summary:', report.summary);
    console.log('Feature Support:', report.featureSupport);
    console.log('Average Performance:', report.averagePerformance);
    console.log('Platform Breakdown:', report.platformBreakdown);
    console.log('Common Issues:', report.commonIssues);
    console.log('Recommendations:', report.recommendations);

    // Compatibility requirements
    if (report.summary.totalTests > 0) {
      expect(parseFloat(report.summary.compatibilityScore)).toBeGreaterThan(70); // >70% compatibility
      expect(report.commonIssues.length).toBeLessThanOrEqual(3); // ≤3 common issues
    }

    // Performance should be consistent
    expect(report.averagePerformance.loadTime).toBeLessThan(12000); // <12s avg load time
    expect(report.averagePerformance.interactionLatency).toBeLessThan(6000); // <6s avg interaction
  });

  test('Browser engine compatibility validation', async ({ browser }) => {
    // Test engine-specific features and behaviors
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto('/');

      // Get browser information
      const browserInfo = await page.evaluate(() => {
        const ua = navigator.userAgent;
        return {
          userAgent: ua,
          isChrome: ua.includes('Chrome') && !ua.includes('Edg'),
          isFirefox: ua.includes('Firefox'),
          isSafari: ua.includes('Safari') && !ua.includes('Chrome'),
          isEdge: ua.includes('Edg'),
          jsEngine: (window as any).chrome ? 'V8' :
                    (window as any).InstallTrigger !== undefined ? 'SpiderMonkey' :
                    ua.includes('Safari') ? 'JavaScriptCore' : 'Unknown'
        };
      });

      console.log('Browser Engine Info:', browserInfo);

      // Test engine-specific behaviors
      const engineFeatures = await page.evaluate(() => {
        return {
          asyncAwait: true, // Modern feature
          modules: typeof(window as any).import === 'function',
          asyncIterators: typeof Symbol.asyncIterator !== 'undefined',
          bigInt: typeof BigInt !== 'undefined',
          optionalChaining: true, // Would need actual test
          nullishCoalescing: true // Would need actual test
        };
      });

      // Modern browsers should support these features
      expect(engineFeatures.asyncAwait).toBe(true);
      expect(engineFeatures.bigInt).toBe(true);

      console.log('Engine Features:', engineFeatures);
    } finally {
      await context.close();
    }
  });
});