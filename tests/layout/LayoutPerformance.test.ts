/**
 * Layout Performance Test Suite
 *
 * Comprehensive performance testing for optimized layout components:
 * - Rendering performance benchmarks
 * - Layout thrashing detection
 * - Memory usage validation
 * - Visual regression testing
 * - Responsive behavior validation
 * - Accessibility compliance checks
 *
 * @version 3.0.0
 * @performance Target: 60fps layout transitions
 */

import { test, expect, Page } from '@playwright/test';

// =========================
// TEST CONFIGURATION
// =========================

const PERFORMANCE_THRESHOLDS = {
  // Rendering Performance (ms)
  firstContentfulPaint: 1500,
  largestContentfulPaint: 2500,
  timeToInteractive: 3000,
  cumulativeLayoutShift: 0.1,
  firstInputDelay: 100,

  // Memory Usage (MB)
  maxHeapSize: 50,
  maxDomNodes: 1000,

  // Layout Performance
  maxLayoutDuration: 16, // 1 frame at 60fps
  maxStyleRecalculation: 8,
  maxPaintTime: 16,

  // Network
  maxBundleSize: 500 * 1024, // 500KB
} as const;

const VIEWPORT_SIZES = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'ultrawide', width: 3440, height: 1440 },
] as const;

// =========================
// TEST UTILITIES
// =========================

class PerformanceProfiler {
  private page: Page;
  private cdpSession: any;

  constructor(page: Page) {
    this.page = page;
  }

  async initialize() {
    this.cdpSession = await this.page.context().newCDPSession(this.page);
    await this.cdpSession.send('Performance.enable');
    await this.cdpSession.send('Runtime.enable');
  }

  async startProfiling() {
    await this.cdpSession.send('Performance.enable');
    await this.cdpSession.send('Profiler.enable');
    await this.cdpSession.send('Profiler.start');
  }

  async stopProfiling() {
    const profile = await this.cdpSession.send('Profiler.stop');
    await this.cdpSession.send('Profiler.disable');
    return profile;
  }

  async getMemoryUsage() {
    const heapUsage = await this.cdpSession.send('Runtime.getHeapUsage');
    return {
      used: heapUsage.usedSize / 1024 / 1024, // Convert to MB
      total: heapUsage.totalSize / 1024 / 1024,
      limit: heapUsage.heapSizeLimit / 1024 / 1024,
    };
  }

  async getLayoutMetrics() {
    const metrics = await this.cdpSession.send('Performance.getMetrics');
    const metricsMap = new Map(
      metrics.metrics.map((m: any) => [m.name, m.value])
    );

    return {
      layoutDuration: metricsMap.get('LayoutDuration') || 0,
      recalcStyleDuration: metricsMap.get('RecalcStyleDuration') || 0,
      scriptDuration: metricsMap.get('ScriptDuration') || 0,
      paintTime: metricsMap.get('PaintTime') || 0,
      layoutCount: metricsMap.get('LayoutCount') || 0,
      nodes: metricsMap.get('Nodes') || 0,
    };
  }

  async cleanup() {
    await this.cdpSession.detach();
  }
}

const measureLayoutShift = async (page: Page, action: () => Promise<void>) => {
  await page.evaluate(() => {
    (window as any).layoutShifts = [];
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        (window as any).layoutShifts.push(entry.value);
      }
    }).observe({ entryTypes: ['layout-shift'] });
  });

  await action();

  // Wait for layout shifts to be recorded
  await page.waitForTimeout(100);

  const layoutShifts = await page.evaluate(() => (window as any).layoutShifts);
  const cumulativeLayoutShift = layoutShifts.reduce((sum: number, shift: number) => sum + shift, 0);

  return { layoutShifts, cumulativeLayoutShift };
};

const generateLargeDataset = (size: number) => {
  return Array.from({ length: size }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    description: `Description for item ${i}`.repeat(Math.floor(Math.random() * 5) + 1),
    category: `Category ${i % 10}`,
    value: Math.floor(Math.random() * 1000),
    created: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 365).toISOString(),
  }));
};

// =========================
// RESPONSIVE GRID TESTS
// =========================

test.describe('OptimizedResponsiveGrid Performance', () => {
  let profiler: PerformanceProfiler;

  test.beforeEach(async ({ page }) => {
    profiler = new PerformanceProfiler(page);
    await profiler.initialize();
  });

  test.afterEach(async () => {
    await profiler.cleanup();
  });

  test('should render large grids efficiently', async ({ page }) => {
    const largeDataset = generateLargeDataset(1000);

    await page.goto('/test/responsive-grid');

    await profiler.startProfiling();

    // Render large grid
    await page.evaluate((data) => {
      const container = document.getElementById('test-container');
      const grid = document.createElement('div');
      grid.className = 'optimized-grid grid-auto-fit-md contain-layout';

      data.forEach((item: any) => {
        const card = document.createElement('div');
        card.className = 'grid-item contain-layout';
        card.innerHTML = `
          <h3>${item.name}</h3>
          <p>${item.description}</p>
          <span>${item.category}</span>
        `;
        grid.appendChild(card);
      });

      container?.appendChild(grid);
    }, largeDataset);

    const profile = await profiler.stopProfiling();
    const layoutMetrics = await profiler.getLayoutMetrics();
    const memoryUsage = await profiler.getMemoryUsage();

    // Performance assertions
    expect(layoutMetrics.layoutDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxLayoutDuration);
    expect(layoutMetrics.recalcStyleDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxStyleRecalculation);
    expect(memoryUsage.used).toBeLessThan(PERFORMANCE_THRESHOLDS.maxHeapSize);
    expect(layoutMetrics.nodes).toBeLessThan(PERFORMANCE_THRESHOLDS.maxDomNodes);
  });

  test('should maintain performance during responsive changes', async ({ page }) => {
    await page.goto('/test/responsive-grid');

    for (const viewport of VIEWPORT_SIZES) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      const { cumulativeLayoutShift } = await measureLayoutShift(page, async () => {
        await page.waitForTimeout(500); // Allow layout to settle
      });

      expect(cumulativeLayoutShift).toBeLessThan(PERFORMANCE_THRESHOLDS.cumulativeLayoutShift);

      const layoutMetrics = await profiler.getLayoutMetrics();
      expect(layoutMetrics.layoutDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxLayoutDuration);
    }
  });

  test('should use CSS containment effectively', async ({ page }) => {
    await page.goto('/test/responsive-grid');

    // Verify CSS containment is applied
    const containmentCheck = await page.evaluate(() => {
      const grid = document.querySelector('.optimized-grid');
      const computedStyle = window.getComputedStyle(grid!);
      return computedStyle.contain;
    });

    expect(containmentCheck).toContain('layout');
  });
});

// =========================
// FLUID CONTAINER TESTS
// =========================

test.describe('FluidContainer Performance', () => {
  let profiler: PerformanceProfiler;

  test.beforeEach(async ({ page }) => {
    profiler = new PerformanceProfiler(page);
    await profiler.initialize();
  });

  test.afterEach(async () => {
    await profiler.cleanup();
  });

  test('should handle container queries efficiently', async ({ page }) => {
    await page.goto('/test/fluid-container');

    const containers = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      content: `Container ${i} with variable content length`.repeat(Math.floor(Math.random() * 10) + 1),
    }));

    await profiler.startProfiling();

    await page.evaluate((containers) => {
      const testArea = document.getElementById('test-container');

      containers.forEach((container) => {
        const element = document.createElement('div');
        element.className = 'fluid-container container-card contain-layout';
        element.innerHTML = `
          <div class="card-responsive">
            <div class="card-content">${container.content}</div>
          </div>
        `;
        testArea?.appendChild(element);
      });
    }, containers);

    await page.waitForTimeout(100);
    const profile = await profiler.stopProfiling();
    const layoutMetrics = await profiler.getLayoutMetrics();

    expect(layoutMetrics.layoutDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxLayoutDuration);
    expect(layoutMetrics.recalcStyleDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxStyleRecalculation);
  });

  test('should maintain aspect ratios without layout shift', async ({ page }) => {
    await page.goto('/test/fluid-container');

    const { cumulativeLayoutShift } = await measureLayoutShift(page, async () => {
      await page.evaluate(() => {
        const container = document.getElementById('test-container');

        // Add elements with different aspect ratios
        const aspects = ['square', 'video', 'wide', 'portrait'];

        aspects.forEach((aspect) => {
          const element = document.createElement('div');
          element.className = `fluid-container aspect-${aspect}`;
          element.style.width = '300px';
          element.innerHTML = `<div>Aspect ratio: ${aspect}</div>`;
          container?.appendChild(element);
        });
      });

      await page.waitForTimeout(200);
    });

    expect(cumulativeLayoutShift).toBeLessThan(PERFORMANCE_THRESHOLDS.cumulativeLayoutShift);
  });
});

// =========================
// RESPONSIVE TABLE TESTS
// =========================

test.describe('ResponsiveTable Performance', () => {
  let profiler: PerformanceProfiler;

  test.beforeEach(async ({ page }) => {
    profiler = new PerformanceProfiler(page);
    await profiler.initialize();
  });

  test.afterEach(async () => {
    await profiler.cleanup();
  });

  test('should handle large datasets with virtual scrolling', async ({ page }) => {
    const largeDataset = generateLargeDataset(10000);

    await page.goto('/test/responsive-table');

    await profiler.startProfiling();

    await page.evaluate((data) => {
      // Simulate virtual scrolling table
      const container = document.getElementById('test-container');
      const table = document.createElement('div');
      table.className = 'responsive-table contain-strict';
      table.style.height = '400px';
      table.style.overflow = 'auto';

      // Only render visible items (virtual scrolling simulation)
      const visibleItems = data.slice(0, 20);

      visibleItems.forEach((item: any) => {
        const row = document.createElement('div');
        row.className = 'table-row contain-layout';
        row.innerHTML = `
          <span>${item.name}</span>
          <span>${item.category}</span>
          <span>${item.value}</span>
        `;
        table.appendChild(row);
      });

      container?.appendChild(table);
    }, largeDataset);

    await page.waitForTimeout(100);
    const profile = await profiler.stopProfiling();
    const layoutMetrics = await profiler.getLayoutMetrics();
    const memoryUsage = await profiler.getMemoryUsage();

    expect(layoutMetrics.layoutDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxLayoutDuration);
    expect(memoryUsage.used).toBeLessThan(PERFORMANCE_THRESHOLDS.maxHeapSize);
  });

  test('should transform to mobile layout efficiently', async ({ page }) => {
    await page.goto('/test/responsive-table');

    // Start with desktop layout
    await page.setViewportSize({ width: 1200, height: 800 });

    const { cumulativeLayoutShift } = await measureLayoutShift(page, async () => {
      // Switch to mobile layout
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);
    });

    expect(cumulativeLayoutShift).toBeLessThan(PERFORMANCE_THRESHOLDS.cumulativeLayoutShift);
  });
});

// =========================
// ADAPTIVE NAVIGATION TESTS
// =========================

test.describe('AdaptiveNavigation Performance', () => {
  let profiler: PerformanceProfiler;

  test.beforeEach(async ({ page }) => {
    profiler = new PerformanceProfiler(page);
    await profiler.initialize();
  });

  test.afterEach(async () => {
    await profiler.cleanup();
  });

  test('should adapt to container size changes efficiently', async ({ page }) => {
    await page.goto('/test/adaptive-navigation');

    const { cumulativeLayoutShift } = await measureLayoutShift(page, async () => {
      // Simulate container size changes
      await page.evaluate(() => {
        const nav = document.querySelector('.adaptive-navigation');
        if (nav) {
          (nav as HTMLElement).style.width = '300px';
          setTimeout(() => {
            (nav as HTMLElement).style.width = '800px';
          }, 100);
          setTimeout(() => {
            (nav as HTMLElement).style.width = '500px';
          }, 200);
        }
      });

      await page.waitForTimeout(400);
    });

    expect(cumulativeLayoutShift).toBeLessThan(PERFORMANCE_THRESHOLDS.cumulativeLayoutShift);
  });

  test('should handle many navigation items without performance degradation', async ({ page }) => {
    await page.goto('/test/adaptive-navigation');

    const manyItems = Array.from({ length: 100 }, (_, i) => ({
      id: `item-${i}`,
      label: `Navigation Item ${i}`,
      href: `/item/${i}`,
    }));

    await profiler.startProfiling();

    await page.evaluate((items) => {
      const nav = document.querySelector('.adaptive-navigation');
      const container = nav?.querySelector('.nav-items-container');

      items.forEach((item: any) => {
        const element = document.createElement('a');
        element.className = 'nav-item contain-layout';
        element.href = item.href;
        element.textContent = item.label;
        container?.appendChild(element);
      });
    }, manyItems);

    await page.waitForTimeout(100);
    const profile = await profiler.stopProfiling();
    const layoutMetrics = await profiler.getLayoutMetrics();

    expect(layoutMetrics.layoutDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxLayoutDuration);
    expect(layoutMetrics.recalcStyleDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxStyleRecalculation);
  });
});

// =========================
// RESPONSIVE CARD TESTS
// =========================

test.describe('ResponsiveCard Performance', () => {
  let profiler: PerformanceProfiler;

  test.beforeEach(async ({ page }) => {
    profiler = new PerformanceProfiler(page);
    await profiler.initialize();
  });

  test.afterEach(async () => {
    await profiler.cleanup();
  });

  test('should render many cards efficiently', async ({ page }) => {
    await page.goto('/test/responsive-card');

    const manyCards = Array.from({ length: 500 }, (_, i) => ({
      id: i,
      title: `Card ${i}`,
      content: `Content for card ${i}`.repeat(Math.floor(Math.random() * 5) + 1),
      image: `/images/placeholder-${i % 10}.jpg`,
    }));

    await profiler.startProfiling();

    await page.evaluate((cards) => {
      const container = document.getElementById('test-container');
      const grid = document.createElement('div');
      grid.className = 'optimized-grid grid-auto-fit-md contain-layout';

      cards.forEach((card: any) => {
        const element = document.createElement('div');
        element.className = 'responsive-card contain-layout gpu-layer';
        element.innerHTML = `
          <div class="card-media" style="aspect-ratio: 16/9;">
            <img src="${card.image}" alt="${card.title}" loading="lazy">
          </div>
          <div class="card-content">
            <h3>${card.title}</h3>
            <p>${card.content}</p>
          </div>
        `;
        grid.appendChild(element);
      });

      container?.appendChild(grid);
    }, manyCards);

    await page.waitForTimeout(200);
    const profile = await profiler.stopProfiling();
    const layoutMetrics = await profiler.getLayoutMetrics();
    const memoryUsage = await profiler.getMemoryUsage();

    expect(layoutMetrics.layoutDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxLayoutDuration);
    expect(memoryUsage.used).toBeLessThan(PERFORMANCE_THRESHOLDS.maxHeapSize);
  });

  test('should maintain performance during hover animations', async ({ page }) => {
    await page.goto('/test/responsive-card');

    await page.evaluate(() => {
      const container = document.getElementById('test-container');
      const card = document.createElement('div');
      card.className = 'responsive-card gpu-layer';
      card.style.transition = 'transform 0.2s ease';
      card.innerHTML = '<div>Hover test card</div>';
      container?.appendChild(card);
    });

    await profiler.startProfiling();

    // Simulate hover interactions
    const card = page.locator('.responsive-card').first();
    for (let i = 0; i < 10; i++) {
      await card.hover();
      await page.waitForTimeout(50);
      await page.mouse.move(0, 0);
      await page.waitForTimeout(50);
    }

    const profile = await profiler.stopProfiling();
    const layoutMetrics = await profiler.getLayoutMetrics();

    expect(layoutMetrics.paintTime).toBeLessThan(PERFORMANCE_THRESHOLDS.maxPaintTime);
  });
});

// =========================
// INTEGRATION TESTS
// =========================

test.describe('Layout System Integration', () => {
  test('should work well together in complex layouts', async ({ page }) => {
    await page.goto('/test/layout-integration');

    const profiler = new PerformanceProfiler(page);
    await profiler.initialize();

    const { cumulativeLayoutShift } = await measureLayoutShift(page, async () => {
      // Test complex layout with all components
      await page.evaluate(() => {
        const app = document.getElementById('app');
        app!.innerHTML = `
          <div class="layout-stack contain-layout">
            <nav class="adaptive-navigation contain-layout">
              <div class="nav-items-container">
                ${Array.from({ length: 8 }, (_, i) =>
                  `<a href="#" class="nav-item">Item ${i + 1}</a>`
                ).join('')}
              </div>
            </nav>

            <main class="fluid-container-lg contain-layout">
              <div class="optimized-grid grid-auto-fit-md">
                ${Array.from({ length: 20 }, (_, i) => `
                  <div class="responsive-card contain-layout">
                    <div class="card-content">
                      <h3>Card ${i + 1}</h3>
                      <p>Card content</p>
                    </div>
                  </div>
                `).join('')}
              </div>

              <div class="responsive-table contain-strict" style="height: 300px;">
                ${Array.from({ length: 50 }, (_, i) => `
                  <div class="table-row">Row ${i + 1}</div>
                `).join('')}
              </div>
            </main>
          </div>
        `;
      });

      await page.waitForTimeout(500);
    });

    const layoutMetrics = await profiler.getLayoutMetrics();
    const memoryUsage = await profiler.getMemoryUsage();

    expect(cumulativeLayoutShift).toBeLessThan(PERFORMANCE_THRESHOLDS.cumulativeLayoutShift);
    expect(layoutMetrics.layoutDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.maxLayoutDuration * 2); // Allow more time for complex layout
    expect(memoryUsage.used).toBeLessThan(PERFORMANCE_THRESHOLDS.maxHeapSize);

    await profiler.cleanup();
  });

  test('should handle rapid viewport changes gracefully', async ({ page }) => {
    await page.goto('/test/layout-integration');

    let totalLayoutShift = 0;

    for (const viewport of VIEWPORT_SIZES) {
      const { cumulativeLayoutShift } = await measureLayoutShift(page, async () => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.waitForTimeout(200);
      });

      totalLayoutShift += cumulativeLayoutShift;
    }

    expect(totalLayoutShift).toBeLessThan(PERFORMANCE_THRESHOLDS.cumulativeLayoutShift * VIEWPORT_SIZES.length);
  });
});

// =========================
// ACCESSIBILITY TESTS
// =========================

test.describe('Layout Accessibility Performance', () => {
  test('should maintain accessibility with large content', async ({ page }) => {
    await page.goto('/test/accessibility');

    // Add large amount of accessible content
    await page.evaluate(() => {
      const container = document.getElementById('test-container');
      const content = Array.from({ length: 100 }, (_, i) => `
        <div class="responsive-card" role="article" aria-labelledby="card-${i}">
          <h3 id="card-${i}">Accessible Card ${i}</h3>
          <p>This is accessible content with proper ARIA labels.</p>
          <button aria-describedby="card-${i}">Action</button>
        </div>
      `).join('');

      container!.innerHTML = `<div class="optimized-grid">${content}</div>`;
    });

    // Test keyboard navigation performance
    const startTime = Date.now();

    // Navigate through focusable elements
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(10);
    }

    const endTime = Date.now();
    const navigationTime = endTime - startTime;

    // Navigation should be fast even with many elements
    expect(navigationTime).toBeLessThan(1000); // 1 second for 20 tab presses

    // Verify accessibility tree is not bloated
    const axeResults = await page.evaluate(() => {
      // Simple accessibility check - ensure all interactive elements have labels
      const buttons = document.querySelectorAll('button');
      return Array.from(buttons).every(button =>
        button.getAttribute('aria-label') ||
        button.getAttribute('aria-labelledby') ||
        button.textContent?.trim()
      );
    });

    expect(axeResults).toBe(true);
  });
});

// =========================
// VISUAL REGRESSION TESTS
// =========================

test.describe('Visual Regression', () => {
  for (const viewport of VIEWPORT_SIZES) {
    test(`should maintain visual consistency on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/test/visual-regression');

      // Wait for all images and fonts to load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      // Take screenshot for visual comparison
      await expect(page).toHaveScreenshot(`layout-${viewport.name}.png`, {
        fullPage: true,
        threshold: 0.1,
      });
    });
  }
});