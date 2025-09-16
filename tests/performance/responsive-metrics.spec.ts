import { test, expect, Page } from '@playwright/test';
import { ResponsiveTestHelper } from '../utils/responsive-helper';
import { PerformanceMetricsHelper } from '../utils/performance-metrics-helper';

test.describe('Responsive Performance Metrics', () => {
  let page: Page;
  let responsiveHelper: ResponsiveTestHelper;
  let metricsHelper: PerformanceMetricsHelper;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    responsiveHelper = new ResponsiveTestHelper(page);
    metricsHelper = new PerformanceMetricsHelper(page);
  });

  const viewportConfigs = [
    { width: 320, height: 568, name: 'mobile-portrait', category: 'mobile' },
    { width: 568, height: 320, name: 'mobile-landscape', category: 'mobile' },
    { width: 768, height: 1024, name: 'tablet-portrait', category: 'tablet' },
    { width: 1024, height: 768, name: 'tablet-landscape', category: 'tablet' },
    { width: 1366, height: 768, name: 'desktop-small', category: 'desktop' },
    { width: 1920, height: 1080, name: 'desktop-large', category: 'desktop' },
  ];

  test.describe('Core Web Vitals by Viewport', () => {
    viewportConfigs.forEach(({ width, height, name, category }) => {
      test(`Core Web Vitals - ${name} (${width}x${height})`, async () => {
        await page.setViewportSize({ width, height });
        
        // Start performance monitoring
        await metricsHelper.startPerformanceMonitoring();
        
        const startTime = Date.now();
        await page.goto('/');
        
        // Wait for page to be fully loaded
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="main-content"]');
        
        // Collect Core Web Vitals
        const vitals = await metricsHelper.getCoreWebVitals();
        
        // Define thresholds based on device category
        const thresholds = {
          mobile: {
            fcp: 2500,    // First Contentful Paint (ms)
            lcp: 4000,    // Largest Contentful Paint (ms)
            fid: 300,     // First Input Delay (ms)
            cls: 0.25,    // Cumulative Layout Shift
            ttfb: 1800,   // Time to First Byte (ms)
          },
          tablet: {
            fcp: 2000,
            lcp: 3500,
            fid: 200,
            cls: 0.1,
            ttfb: 1500,
          },
          desktop: {
            fcp: 1500,
            lcp: 2500,
            fid: 100,
            cls: 0.1,
            ttfb: 1200,
          }
        };
        
        const threshold = thresholds[category as keyof typeof thresholds];
        
        // Assert Core Web Vitals meet thresholds
        if (vitals.fcp) {
          expect(vitals.fcp).toBeLessThan(threshold.fcp);
        }
        
        if (vitals.lcp) {
          expect(vitals.lcp).toBeLessThan(threshold.lcp);
        }
        
        if (vitals.fid) {
          expect(vitals.fid).toBeLessThan(threshold.fid);
        }
        
        if (vitals.cls !== undefined) {
          expect(vitals.cls).toBeLessThan(threshold.cls);
        }
        
        if (vitals.ttfb) {
          expect(vitals.ttfb).toBeLessThan(threshold.ttfb);
        }
        
        // Log metrics for reporting
        console.log(`Performance metrics for ${name}:`, vitals);
      });
    });
  });

  test.describe('Resource Loading Performance', () => {
    viewportConfigs.forEach(({ width, height, name, category }) => {
      test(`Resource loading - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        
        // Monitor network requests
        const resourceMetrics = await metricsHelper.monitorResourceLoading();
        
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        const metrics = await resourceMetrics.getMetrics();
        
        // Assert resource loading efficiency
        expect(metrics.totalRequests).toBeLessThan(50); // Reasonable request count
        expect(metrics.totalSize).toBeLessThan(category === 'mobile' ? 2000000 : 5000000); // Size limits
        expect(metrics.slowestRequest).toBeLessThan(5000); // No request should take >5s
        
        // Check for efficient image loading
        const imageMetrics = metrics.resourceTypes.images;
        if (imageMetrics) {
          expect(imageMetrics.averageSize).toBeLessThan(category === 'mobile' ? 100000 : 500000);
        }
        
        console.log(`Resource metrics for ${name}:`, metrics);
      });
    });
  });

  test.describe('Layout Shift Measurements', () => {
    viewportConfigs.forEach(({ width, height, name }) => {
      test(`Layout shift tracking - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        
        // Start layout shift monitoring
        const layoutShiftPromise = metricsHelper.measureLayoutShift();
        
        await page.goto('/');
        
        // Interact with page to trigger potential shifts
        await page.waitForSelector('[data-testid="main-content"]');
        
        // Navigate to different sections
        const navItems = page.locator('[data-testid="nav-item"]');
        const navCount = await navItems.count();
        
        if (navCount > 0) {
          await navItems.first().click();
          await page.waitForTimeout(1000);
        }
        
        // Check search functionality
        const searchInput = page.locator('[data-testid="search-input"]');
        if (await searchInput.isVisible()) {
          await searchInput.fill('test query');
          await page.waitForTimeout(500);
        }
        
        // Get final layout shift score
        const layoutShiftScore = await layoutShiftPromise;
        
        // Assert acceptable layout shift
        expect(layoutShiftScore).toBeLessThan(0.1); // Good CLS score
        
        console.log(`Layout shift score for ${name}: ${layoutShiftScore}`);
      });
    });
  });

  test.describe('Memory Usage by Viewport', () => {
    viewportConfigs.forEach(({ width, height, name, category }) => {
      test(`Memory usage - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        
        // Start memory monitoring
        await metricsHelper.startMemoryMonitoring();
        
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // Navigate through different sections to test memory
        const sections = ['/knowledge-base', '/forms/add-entry', '/admin/entries'];
        
        for (const section of sections) {
          await page.goto(section);
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1000);
        }
        
        // Collect memory metrics
        const memoryMetrics = await metricsHelper.getMemoryMetrics();
        
        // Define memory thresholds based on device category
        const memoryThresholds = {
          mobile: { heapUsed: 50000000, heapTotal: 100000000 },   // 50MB/100MB
          tablet: { heapUsed: 75000000, heapTotal: 150000000 },   // 75MB/150MB
          desktop: { heapUsed: 100000000, heapTotal: 200000000 }  // 100MB/200MB
        };
        
        const threshold = memoryThresholds[category as keyof typeof memoryThresholds];
        
        // Assert memory usage is within limits
        expect(memoryMetrics.heapUsed).toBeLessThan(threshold.heapUsed);
        expect(memoryMetrics.heapTotal).toBeLessThan(threshold.heapTotal);
        
        console.log(`Memory metrics for ${name}:`, memoryMetrics);
      });
    });
  });

  test.describe('Viewport Resize Performance', () => {
    test('Dynamic viewport resize handling', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const resizeSteps = [
        { width: 320, height: 568 },
        { width: 768, height: 1024 },
        { width: 1024, height: 768 },
        { width: 1366, height: 768 },
        { width: 1920, height: 1080 },
      ];
      
      for (let i = 0; i < resizeSteps.length - 1; i++) {
        const currentStep = resizeSteps[i];
        const nextStep = resizeSteps[i + 1];
        
        await page.setViewportSize(currentStep);
        await page.waitForTimeout(500); // Allow layout to settle
        
        // Measure resize performance
        const resizeStartTime = Date.now();
        await page.setViewportSize(nextStep);
        
        // Wait for layout to complete
        await page.waitForFunction(() => {
          return window.innerWidth === nextStep.width && window.innerHeight === nextStep.height;
        });
        
        const resizeEndTime = Date.now();
        const resizeDuration = resizeEndTime - resizeStartTime;
        
        // Resize should be fast
        expect(resizeDuration).toBeLessThan(1000);
        
        // Check for layout shifts during resize
        const layoutShift = await metricsHelper.measureLayoutShiftDuringResize(
          currentStep,
          nextStep
        );
        
        expect(layoutShift).toBeLessThan(0.25); // Allow some shift during resize
        
        console.log(`Resize from ${currentStep.width}x${currentStep.height} to ${nextStep.width}x${nextStep.height}: ${resizeDuration}ms`);
      }
    });
  });

  test.describe('JavaScript Performance by Viewport', () => {
    viewportConfigs.forEach(({ width, height, name, category }) => {
      test(`JavaScript execution performance - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        
        // Monitor JavaScript execution
        const jsMetrics = await metricsHelper.measureJavaScriptPerformance();
        
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // Trigger interactive features
        const searchInput = page.locator('[data-testid="search-input"]');
        if (await searchInput.isVisible()) {
          // Measure search performance
          const searchStartTime = Date.now();
          await searchInput.fill('performance test query');
          await searchInput.press('Enter');
          
          await page.waitForSelector('[data-testid="search-results"]', { timeout: 5000 });
          const searchEndTime = Date.now();
          
          const searchDuration = searchEndTime - searchStartTime;
          expect(searchDuration).toBeLessThan(category === 'mobile' ? 3000 : 2000);
        }
        
        // Test form interactions
        await page.goto('/forms/add-entry');
        await page.waitForLoadState('networkidle');
        
        const formFields = page.locator('input, textarea, select');
        const fieldCount = await formFields.count();
        
        if (fieldCount > 0) {
          const formInteractionStart = Date.now();
          
          // Fill multiple fields quickly
          for (let i = 0; i < Math.min(fieldCount, 5); i++) {
            const field = formFields.nth(i);
            const tagName = await field.evaluate(el => el.tagName.toLowerCase());
            
            if (tagName === 'input' || tagName === 'textarea') {
              await field.fill(`Test value ${i}`);
            }
          }
          
          const formInteractionEnd = Date.now();
          const formDuration = formInteractionEnd - formInteractionStart;
          
          // Form interactions should be responsive
          expect(formDuration).toBeLessThan(2000);
        }
        
        // Get final JavaScript metrics
        const finalMetrics = await jsMetrics.getMetrics();
        
        // Assert JavaScript performance
        expect(finalMetrics.scriptDuration).toBeLessThan(5000); // Total script execution
        expect(finalMetrics.longTasks).toBeLessThan(3); // Minimal long tasks
        
        console.log(`JavaScript metrics for ${name}:`, finalMetrics);
      });
    });
  });

  test.describe('Progressive Enhancement', () => {
    test('Functionality without JavaScript', async () => {
      // Test that critical functionality works without JavaScript
      await page.setJavaScriptEnabled(false);
      
      viewportConfigs.slice(0, 3).forEach(async ({ width, height, name }) => {
        await page.setViewportSize({ width, height });
        await page.goto('/');
        
        // Check that basic content is accessible
        await expect(page.locator('main')).toBeVisible();
        await expect(page.locator('nav')).toBeVisible();
        
        // Check that links work
        const links = page.locator('a[href]');
        const linkCount = await links.count();
        expect(linkCount).toBeGreaterThan(0);
        
        // Test navigation
        const firstLink = links.first();
        const href = await firstLink.getAttribute('href');
        
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          await firstLink.click();
          
          // Page should navigate even without JavaScript
          await page.waitForLoadState('networkidle');
          expect(page.url()).toContain(href);
        }
      });
    });
  });

  test.describe('Performance Comparison Report', () => {
    test('Generate performance comparison across viewports', async () => {
      const performanceReport: any = {
        timestamp: new Date().toISOString(),
        viewports: {},
      };
      
      for (const { width, height, name, category } of viewportConfigs) {
        await page.setViewportSize({ width, height });
        
        const startTime = Date.now();
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        const loadTime = Date.now() - startTime;
        
        const vitals = await metricsHelper.getCoreWebVitals();
        const memoryMetrics = await metricsHelper.getMemoryMetrics();
        
        performanceReport.viewports[name] = {
          dimensions: { width, height },
          category,
          loadTime,
          vitals,
          memory: memoryMetrics,
        };
      }
      
      // Log comprehensive report
      console.log('=== Responsive Performance Report ===');
      console.log(JSON.stringify(performanceReport, null, 2));
      
      // Verify all viewports meet minimum standards
      Object.entries(performanceReport.viewports).forEach(([viewport, data]: [string, any]) => {
        expect(data.loadTime).toBeLessThan(10000); // Max 10s load time
        
        if (data.vitals.cls !== undefined) {
          expect(data.vitals.cls).toBeLessThan(0.5); // Acceptable CLS
        }
      });
    });
  });
});
