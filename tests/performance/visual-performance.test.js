const { test, expect } = require('@playwright/test');

/**
 * Visual Performance Testing Suite
 * Measures performance impact of design system enhancements
 */

test.describe('Visual Performance Testing', () => {
  // Performance thresholds
  const PERFORMANCE_THRESHOLDS = {
    firstContentfulPaint: 1500,
    largestContentfulPaint: 2500,
    cumulativeLayoutShift: 0.1,
    firstInputDelay: 100,
    timeToInteractive: 3000,
    totalBlockingTime: 300
  };

  test.beforeEach(async ({ page }) => {
    // Clear cache to ensure consistent testing
    await page.context().clearCookies();
    await page.evaluate(() => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => registration.unregister());
        });
      }
    });
  });

  test('Core Web Vitals performance', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Collect Core Web Vitals
    const vitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = {};
        
        // First Contentful Paint
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              vitals.firstContentfulPaint = entry.startTime;
            }
          });
        }).observe({ entryTypes: ['paint'] });
        
        // Largest Contentful Paint
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          vitals.largestContentfulPaint = lastEntry.startTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // Cumulative Layout Shift
        let clsValue = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
          vitals.cumulativeLayoutShift = clsValue;
        }).observe({ entryTypes: ['layout-shift'] });
        
        // First Input Delay
        new PerformanceObserver((list) => {
          const firstInput = list.getEntries()[0];
          vitals.firstInputDelay = firstInput.processingStart - firstInput.startTime;
        }).observe({ entryTypes: ['first-input'] });
        
        // Give time for metrics to be collected
        setTimeout(() => resolve(vitals), 3000);
      });
    });
    
    // Assert performance thresholds
    if (vitals.firstContentfulPaint) {
      expect(vitals.firstContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint);
    }
    if (vitals.largestContentfulPaint) {
      expect(vitals.largestContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.largestContentfulPaint);
    }
    if (vitals.cumulativeLayoutShift !== undefined) {
      expect(vitals.cumulativeLayoutShift).toBeLessThan(PERFORMANCE_THRESHOLDS.cumulativeLayoutShift);
    }
    if (vitals.firstInputDelay) {
      expect(vitals.firstInputDelay).toBeLessThan(PERFORMANCE_THRESHOLDS.firstInputDelay);
    }
  });

  test('CSS bundle size impact', async ({ page }) => {
    await page.goto('/');
    
    // Measure CSS resource sizes
    const resourceSizes = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      const cssResources = resources.filter(resource => 
        resource.name.endsWith('.css') || resource.name.includes('css')
      );
      
      return cssResources.map(resource => ({
        url: resource.name,
        size: resource.transferSize || resource.decodedBodySize,
        loadTime: resource.responseEnd - resource.startTime
      }));
    });
    
    const totalCssSize = resourceSizes.reduce((total, resource) => total + resource.size, 0);
    const totalCssLoadTime = Math.max(...resourceSizes.map(r => r.loadTime));
    
    // Assert reasonable CSS bundle size (under 100KB total)
    expect(totalCssSize).toBeLessThan(100 * 1024);
    
    // Assert reasonable CSS load time (under 1 second)
    expect(totalCssLoadTime).toBeLessThan(1000);
    
    console.log(`Total CSS size: ${(totalCssSize / 1024).toFixed(2)}KB`);
    console.log(`CSS load time: ${totalCssLoadTime.toFixed(2)}ms`);
  });

  test('Animation performance', async ({ page }) => {
    await page.goto('/components/animations');
    
    // Test button hover animation performance
    const animationButton = page.locator('[data-testid="animation-test-button"]');
    
    // Start performance monitoring
    await page.evaluate(() => {
      window.animationFrames = [];
      let lastTime = performance.now();
      
      function measureFrame() {
        const currentTime = performance.now();
        const deltaTime = currentTime - lastTime;
        window.animationFrames.push(deltaTime);
        lastTime = currentTime;
        
        if (window.animationFrames.length < 60) { // Monitor for 1 second at 60fps
          requestAnimationFrame(measureFrame);
        }
      }
      
      requestAnimationFrame(measureFrame);
    });
    
    // Trigger animation
    await animationButton.hover();
    await page.waitForTimeout(1000);
    
    // Analyze frame performance
    const frameData = await page.evaluate(() => {
      const frames = window.animationFrames || [];
      const avgFrameTime = frames.reduce((sum, time) => sum + time, 0) / frames.length;
      const maxFrameTime = Math.max(...frames);
      const droppedFrames = frames.filter(time => time > 16.67).length; // 60fps = 16.67ms per frame
      
      return {
        averageFrameTime: avgFrameTime,
        maxFrameTime: maxFrameTime,
        droppedFrames: droppedFrames,
        totalFrames: frames.length
      };
    });
    
    // Assert animation performance
    expect(frameData.averageFrameTime).toBeLessThan(16.67); // Maintain 60fps
    expect(frameData.maxFrameTime).toBeLessThan(33.33); // No frame should take longer than 30fps
    expect(frameData.droppedFrames / frameData.totalFrames).toBeLessThan(0.1); // Less than 10% dropped frames
  });

  test('Memory usage during interactions', async ({ page }) => {
    await page.goto('/');
    
    // Measure initial memory
    const initialMemory = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize
        };
      }
      return null;
    });
    
    if (!initialMemory) {
      console.log('Memory API not available, skipping memory test');
      return;
    }
    
    // Perform intensive interactions
    const components = ['buttons', 'forms', 'modals', 'navigation'];
    for (const component of components) {
      await page.goto(`/components/${component}`);
      
      // Simulate user interactions
      const interactiveElements = await page.locator('button, input, a[href]').all();
      for (let i = 0; i < Math.min(interactiveElements.length, 10); i++) {
        const element = interactiveElements[i];
        await element.hover();
        await page.waitForTimeout(100);
        if (await element.getAttribute('href') === null) {
          await element.click();
          await page.waitForTimeout(100);
        }
      }
    }
    
    // Force garbage collection if available
    await page.evaluate(() => {
      if (window.gc) {
        window.gc();
      }
    });
    
    // Measure final memory
    const finalMemory = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize
        };
      }
      return null;
    });
    
    if (finalMemory) {
      const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
      const percentIncrease = (memoryIncrease / initialMemory.usedJSHeapSize) * 100;
      
      // Memory should not increase by more than 50% during normal interactions
      expect(percentIncrease).toBeLessThan(50);
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB (${percentIncrease.toFixed(2)}%)`);
    }
  });

  test('Rendering performance with large datasets', async ({ page }) => {
    await page.goto('/components/data-table');
    
    // Test table with 1000 rows
    await page.evaluate(() => {
      window.generateLargeDataset = (size) => {
        const data = [];
        for (let i = 0; i < size; i++) {
          data.push({
            id: i,
            name: `User ${i}`,
            email: `user${i}@example.com`,
            role: i % 3 === 0 ? 'Admin' : i % 2 === 0 ? 'User' : 'Guest',
            createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
          });
        }
        return data;
      };
    });
    
    // Measure rendering time
    const renderingTime = await page.evaluate(() => {
      const start = performance.now();
      
      // Generate and render large dataset
      const data = window.generateLargeDataset(1000);
      
      // Simulate rendering (this would be framework-specific)
      const table = document.querySelector('[data-testid="large-data-table"]');
      if (table) {
        table.innerHTML = data.map(item => `
          <tr>
            <td>${item.id}</td>
            <td>${item.name}</td>
            <td>${item.email}</td>
            <td>${item.role}</td>
            <td>${item.createdAt}</td>
          </tr>
        `).join('');
      }
      
      return performance.now() - start;
    });
    
    // Rendering 1000 rows should take less than 100ms
    expect(renderingTime).toBeLessThan(100);
    
    // Test scrolling performance
    const scrollPerformance = await page.evaluate(() => {
      return new Promise((resolve) => {
        const scrollContainer = document.querySelector('[data-testid="scroll-container"]');
        if (!scrollContainer) {
          resolve({ averageTime: 0, maxTime: 0 });
          return;
        }
        
        const frameTimes = [];
        let scrollCount = 0;
        const maxScrolls = 20;
        
        function measureScroll() {
          const start = performance.now();
          
          scrollContainer.scrollTop += 100;
          scrollCount++;
          
          requestAnimationFrame(() => {
            const frameTime = performance.now() - start;
            frameTimes.push(frameTime);
            
            if (scrollCount < maxScrolls) {
              setTimeout(measureScroll, 50);
            } else {
              const avgTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
              const maxTime = Math.max(...frameTimes);
              resolve({ averageTime: avgTime, maxTime: maxTime });
            }
          });
        }
        
        measureScroll();
      });
    });
    
    expect(scrollPerformance.averageTime).toBeLessThan(16.67); // 60fps average
    expect(scrollPerformance.maxTime).toBeLessThan(33.33); // No frame worse than 30fps
  });

  test('Theme switching performance', async ({ page }) => {
    await page.goto('/');
    
    // Measure theme switching time
    const themeToggle = page.locator('[data-testid="theme-toggle"]');
    
    const switchingTimes = [];
    
    // Test theme switching multiple times
    for (let i = 0; i < 5; i++) {
      const start = await page.evaluate(() => performance.now());
      
      await themeToggle.click();
      
      // Wait for theme transition to complete
      await page.waitForFunction(() => {
        const html = document.documentElement;
        return html.getAttribute('data-theme') !== null;
      });
      
      const end = await page.evaluate(() => performance.now());
      switchingTimes.push(end - start);
      
      await page.waitForTimeout(500); // Allow for theme to fully apply
    }
    
    const averageSwitchingTime = switchingTimes.reduce((sum, time) => sum + time, 0) / switchingTimes.length;
    const maxSwitchingTime = Math.max(...switchingTimes);
    
    // Theme switching should be fast
    expect(averageSwitchingTime).toBeLessThan(200);
    expect(maxSwitchingTime).toBeLessThan(500);
    
    console.log(`Average theme switch time: ${averageSwitchingTime.toFixed(2)}ms`);
    console.log(`Max theme switch time: ${maxSwitchingTime.toFixed(2)}ms`);
  });

  test('Component loading performance', async ({ page }) => {
    // Test lazy loading of components
    const componentPages = [
      '/components/buttons',
      '/components/forms',
      '/components/navigation',
      '/components/modals',
      '/components/data-visualization'
    ];
    
    const loadingTimes = [];
    
    for (const componentPage of componentPages) {
      const start = performance.now();
      
      await page.goto(componentPage, { waitUntil: 'networkidle' });
      
      const end = performance.now();
      const loadTime = end - start;
      loadingTimes.push(loadTime);
      
      console.log(`${componentPage} loaded in ${loadTime.toFixed(2)}ms`);
    }
    
    const averageLoadTime = loadingTimes.reduce((sum, time) => sum + time, 0) / loadingTimes.length;
    const maxLoadTime = Math.max(...loadingTimes);
    
    // Component pages should load quickly
    expect(averageLoadTime).toBeLessThan(2000);
    expect(maxLoadTime).toBeLessThan(3000);
  });

  test('Responsive performance across devices', async ({ page }) => {
    const devices = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1024, height: 768, name: 'laptop' },
      { width: 1920, height: 1080, name: 'desktop' }
    ];
    
    for (const device of devices) {
      await page.setViewportSize({ width: device.width, height: device.height });
      
      const start = performance.now();
      await page.goto('/', { waitUntil: 'networkidle' });
      const loadTime = performance.now() - start;
      
      // Measure layout performance
      const layoutMetrics = await page.evaluate(() => {
        const start = performance.now();
        
        // Force layout recalculation
        document.body.style.display = 'none';
        document.body.offsetHeight; // Trigger reflow
        document.body.style.display = 'block';
        document.body.offsetHeight; // Trigger reflow
        
        return performance.now() - start;
      });
      
      expect(loadTime).toBeLessThan(3000);
      expect(layoutMetrics).toBeLessThan(50);
      
      console.log(`${device.name} (${device.width}x${device.height}): Load ${loadTime.toFixed(2)}ms, Layout ${layoutMetrics.toFixed(2)}ms`);
    }
  });
});

// Performance utilities
test.describe('Performance Utilities', () => {
  test('Performance monitoring utilities work correctly', async ({ page }) => {
    await page.goto('/test-utilities/performance');
    
    // Test performance measurement utilities
    const utilities = await page.evaluate(() => {
      return {
        hasPerfObserver: typeof PerformanceObserver !== 'undefined',
        hasMemoryAPI: typeof performance.memory !== 'undefined',
        hasUserTiming: typeof performance.mark !== 'undefined' && typeof performance.measure !== 'undefined',
        hasNavigationTiming: typeof performance.getEntriesByType === 'function'
      };
    });
    
    expect(utilities.hasPerfObserver).toBe(true);
    expect(utilities.hasNavigationTiming).toBe(true);
    
    // Test custom performance marks
    await page.evaluate(() => {
      performance.mark('test-start');
      // Simulate some work
      for (let i = 0; i < 1000; i++) {
        Math.random();
      }
      performance.mark('test-end');
      performance.measure('test-duration', 'test-start', 'test-end');
    });
    
    const measurementExists = await page.evaluate(() => {
      const measures = performance.getEntriesByType('measure');
      return measures.some(measure => measure.name === 'test-duration');
    });
    
    expect(measurementExists).toBe(true);
  });
});
