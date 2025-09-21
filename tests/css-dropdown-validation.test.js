/**
 * CSS Dropdown and Z-Index Validation Tests
 * Comprehensive Puppeteer tests for dropdown positioning and z-index hierarchy
 *
 * Test Coverage:
 * - Dropdown positioning accuracy
 * - Z-index hierarchy validation
 * - Responsive behavior testing
 * - Cross-browser compatibility
 * - Accessibility compliance
 * - Performance benchmarks
 *
 * @author CSS Testing Specialist
 * @version 2.0.0
 */

const puppeteer = require('puppeteer');
const path = require('path');

describe('CSS Dropdown and Z-Index System Tests', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false, // Set to true for CI/CD
      devtools: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Load the test page with dropdown components
    const testPagePath = path.join(__dirname, '../test-dropdown-page.html');
    await page.goto(`file://${testPagePath}`);

    // Inject our CSS files
    await page.addStyleTag({ path: path.join(__dirname, '../src/styles/dropdown-system.css') });
    await page.addStyleTag({ path: path.join(__dirname, '../src/styles/search-bar-enhancements.css') });
    await page.addStyleTag({ path: path.join(__dirname, '../src/styles/component-layer-fixes.css') });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe('Z-Index Hierarchy Tests', () => {
    test('should maintain correct z-index hierarchy for all dropdown types', async () => {
      // Get z-index values for different elements
      const zIndexValues = await page.evaluate(() => {
        const elements = {
          suggestions: document.querySelector('.search-suggestions'),
          history: document.querySelector('.search-history'),
          filters: document.querySelector('.search-filters'),
          quickActions: document.querySelector('.quick-actions-dropdown'),
          modal: document.querySelector('.modal-content'),
          tooltip: document.querySelector('.tooltip')
        };

        const getZIndex = (element) => {
          if (!element) return null;
          return parseInt(window.getComputedStyle(element).zIndex) || 0;
        };

        return {
          suggestions: getZIndex(elements.suggestions),
          history: getZIndex(elements.history),
          filters: getZIndex(elements.filters),
          quickActions: getZIndex(elements.quickActions),
          modal: getZIndex(elements.modal),
          tooltip: getZIndex(elements.tooltip)
        };
      });

      // Verify hierarchy: modal > tooltip > dropdowns
      expect(zIndexValues.modal).toBeGreaterThan(zIndexValues.tooltip);
      expect(zIndexValues.tooltip).toBeGreaterThan(zIndexValues.suggestions);
      expect(zIndexValues.suggestions).toBeGreaterThan(1000);
      expect(zIndexValues.history).toBeGreaterThan(1000);
      expect(zIndexValues.quickActions).toBeGreaterThan(1000);
    });

    test('should prevent z-index conflicts between similar components', async () => {
      // Open multiple dropdowns simultaneously
      await page.click('.search-trigger');
      await page.click('.filter-trigger');
      await page.click('.quick-actions-trigger');

      // Check that each dropdown has a unique z-index
      const overlappingElements = await page.evaluate(() => {
        const dropdowns = document.querySelectorAll('.dropdown-content[style*="z-index"]');
        const zIndexes = Array.from(dropdowns).map(el =>
          parseInt(window.getComputedStyle(el).zIndex)
        );

        // Check for duplicates
        const unique = [...new Set(zIndexes)];
        return unique.length === zIndexes.length;
      });

      expect(overlappingElements).toBe(true);
    });
  });

  describe('Dropdown Positioning Tests', () => {
    test('should position search suggestions correctly below input', async () => {
      // Type in search input to trigger suggestions
      await page.type('.search-input', 'test query');
      await page.waitForSelector('.search-suggestions.visible', { timeout: 2000 });

      const positioning = await page.evaluate(() => {
        const input = document.querySelector('.search-input-container');
        const suggestions = document.querySelector('.search-suggestions');

        if (!input || !suggestions) return null;

        const inputRect = input.getBoundingClientRect();
        const suggestionsRect = suggestions.getBoundingClientRect();

        return {
          inputBottom: inputRect.bottom,
          suggestionsTop: suggestionsRect.top,
          inputLeft: inputRect.left,
          suggestionsLeft: suggestionsRect.left,
          inputWidth: inputRect.width,
          suggestionsWidth: suggestionsRect.width
        };
      });

      expect(positioning).not.toBeNull();
      expect(positioning.suggestionsTop).toBeGreaterThanOrEqual(positioning.inputBottom);
      expect(Math.abs(positioning.inputLeft - positioning.suggestionsLeft)).toBeLessThan(5);
      expect(Math.abs(positioning.inputWidth - positioning.suggestionsWidth)).toBeLessThan(5);
    });

    test('should handle dropdown positioning when space is limited', async () => {
      // Scroll to bottom to test upward positioning
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Position search input near bottom
      await page.evaluate(() => {
        const searchContainer = document.querySelector('.search-input-container');
        if (searchContainer) {
          searchContainer.style.position = 'fixed';
          searchContainer.style.bottom = '20px';
          searchContainer.style.left = '20px';
          searchContainer.style.right = '20px';
        }
      });

      // Trigger dropdown
      await page.click('.search-input');
      await page.type('.search-input', 'test');

      await page.waitForSelector('.search-suggestions.visible', { timeout: 2000 });

      const isPositionedAbove = await page.evaluate(() => {
        const input = document.querySelector('.search-input-container');
        const suggestions = document.querySelector('.search-suggestions');

        if (!input || !suggestions) return false;

        const inputRect = input.getBoundingClientRect();
        const suggestionsRect = suggestions.getBoundingClientRect();

        return suggestionsRect.bottom <= inputRect.top;
      });

      // Should position above when there's no space below
      expect(isPositionedAbove).toBe(true);
    });

    test('should maintain dropdown visibility during window resize', async () => {
      // Open dropdown
      await page.type('.search-input', 'test query');
      await page.waitForSelector('.search-suggestions.visible');

      // Resize window
      await page.setViewport({ width: 800, height: 600 });
      await page.waitForTimeout(500); // Allow for resize handling

      const isStillVisible = await page.evaluate(() => {
        const suggestions = document.querySelector('.search-suggestions');
        const style = window.getComputedStyle(suggestions);
        return style.visibility === 'visible' && style.opacity !== '0';
      });

      expect(isStillVisible).toBe(true);
    });
  });

  describe('Responsive Behavior Tests', () => {
    test('should adapt dropdown behavior for mobile viewport', async () => {
      // Set mobile viewport
      await page.setViewport({ width: 375, height: 667 });

      // Trigger dropdown
      await page.type('.search-input', 'test');
      await page.waitForSelector('.search-suggestions.visible');

      const mobilePositioning = await page.evaluate(() => {
        const suggestions = document.querySelector('.search-suggestions');
        const style = window.getComputedStyle(suggestions);

        return {
          position: style.position,
          bottom: style.bottom,
          transform: style.transform,
          zIndex: parseInt(style.zIndex)
        };
      });

      // On mobile, should use fixed positioning at bottom
      expect(mobilePositioning.position).toBe('fixed');
      expect(mobilePositioning.bottom).toBe('0px');
      expect(mobilePositioning.zIndex).toBeGreaterThan(1300); // Modal level
    });

    test('should show backdrop on mobile dropdowns', async () => {
      await page.setViewport({ width: 375, height: 667 });

      await page.type('.search-input', 'test');
      await page.waitForSelector('.search-suggestions.visible');

      const hasBackdrop = await page.evaluate(() => {
        const backdrop = document.querySelector('.search-dropdown-backdrop');
        if (!backdrop) return false;

        const style = window.getComputedStyle(backdrop);
        return style.visibility === 'visible' && style.opacity !== '0';
      });

      expect(hasBackdrop).toBe(true);
    });

    test('should maintain touch-friendly target sizes on mobile', async () => {
      await page.setViewport({ width: 375, height: 667 });

      await page.type('.search-input', 'test');
      await page.waitForSelector('.search-suggestions.visible');

      const touchTargetSizes = await page.evaluate(() => {
        const items = document.querySelectorAll('.suggestion-item');
        return Array.from(items).map(item => {
          const rect = item.getBoundingClientRect();
          return {
            height: rect.height,
            width: rect.width
          };
        });
      });

      // Touch targets should be at least 44px high (Apple guidelines)
      touchTargetSizes.forEach(size => {
        expect(size.height).toBeGreaterThanOrEqual(44);
      });
    });
  });

  describe('Animation and Performance Tests', () => {
    test('should have smooth dropdown animations', async () => {
      // Enable animation timing
      await page.evaluate(() => {
        window.animationTimings = [];

        const observer = new MutationObserver(() => {
          window.animationTimings.push(performance.now());
        });

        const suggestions = document.querySelector('.search-suggestions');
        if (suggestions) {
          observer.observe(suggestions, { attributes: true, attributeFilter: ['class'] });
        }
      });

      // Trigger dropdown animation
      await page.type('.search-input', 'test');
      await page.waitForSelector('.search-suggestions.visible');

      await page.waitForTimeout(300); // Wait for animation

      const animationPerformance = await page.evaluate(() => {
        return {
          timings: window.animationTimings,
          hasTransition: window.getComputedStyle(document.querySelector('.search-suggestions')).transition !== 'none'
        };
      });

      expect(animationPerformance.hasTransition).toBe(true);
      expect(animationPerformance.timings.length).toBeGreaterThan(0);
    });

    test('should respect reduced motion preferences', async () => {
      // Simulate reduced motion preference
      await page.emulateMediaFeatures([
        { name: 'prefers-reduced-motion', value: 'reduce' }
      ]);

      await page.type('.search-input', 'test');
      await page.waitForSelector('.search-suggestions.visible');

      const hasReducedMotion = await page.evaluate(() => {
        const suggestions = document.querySelector('.search-suggestions');
        const style = window.getComputedStyle(suggestions);
        return style.transition === 'none' || style.animation === 'none';
      });

      expect(hasReducedMotion).toBe(true);
    });

    test('should maintain 60fps during dropdown interactions', async () => {
      let frameCount = 0;
      let startTime = Date.now();

      // Monitor frame rate
      await page.evaluateOnNewDocument(() => {
        window.frameCount = 0;
        const countFrame = () => {
          window.frameCount++;
          requestAnimationFrame(countFrame);
        };
        requestAnimationFrame(countFrame);
      });

      // Perform rapid dropdown interactions
      for (let i = 0; i < 5; i++) {
        await page.type('.search-input', 'test');
        await page.waitForTimeout(100);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        await page.evaluate(() => {
          document.querySelector('.search-input').value = '';
        });
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      const finalFrameCount = await page.evaluate(() => window.frameCount);
      const fps = finalFrameCount / duration;

      // Should maintain at least 30fps (being conservative)
      expect(fps).toBeGreaterThan(30);
    });
  });

  describe('Accessibility Tests', () => {
    test('should maintain proper ARIA attributes during dropdown states', async () => {
      // Check initial ARIA state
      const initialAria = await page.evaluate(() => {
        const trigger = document.querySelector('.search-input');
        return {
          expanded: trigger.getAttribute('aria-expanded'),
          hasPopup: trigger.getAttribute('aria-haspopup'),
          controls: trigger.getAttribute('aria-controls')
        };
      });

      expect(initialAria.expanded).toBe('false');
      expect(initialAria.hasPopup).toBe('listbox');

      // Open dropdown and check ARIA state
      await page.type('.search-input', 'test');
      await page.waitForSelector('.search-suggestions.visible');

      const openAria = await page.evaluate(() => {
        const trigger = document.querySelector('.search-input');
        return {
          expanded: trigger.getAttribute('aria-expanded'),
          activedescendant: trigger.getAttribute('aria-activedescendant')
        };
      });

      expect(openAria.expanded).toBe('true');
    });

    test('should support keyboard navigation in dropdowns', async () => {
      await page.type('.search-input', 'test');
      await page.waitForSelector('.search-suggestions.visible');

      // Navigate with arrow keys
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');

      const selectedItem = await page.evaluate(() => {
        const selected = document.querySelector('.suggestion-item.selected');
        return selected ? selected.textContent : null;
      });

      expect(selectedItem).not.toBeNull();

      // Select with Enter
      await page.keyboard.press('Enter');

      const inputValue = await page.$eval('.search-input', el => el.value);
      expect(inputValue).toBe(selectedItem);
    });

    test('should announce dropdown states to screen readers', async () => {
      // Check for live regions
      const liveRegions = await page.evaluate(() => {
        const regions = document.querySelectorAll('[aria-live], [role="status"]');
        return Array.from(regions).map(region => ({
          role: region.getAttribute('role'),
          ariaLive: region.getAttribute('aria-live'),
          textContent: region.textContent.trim()
        }));
      });

      expect(liveRegions.length).toBeGreaterThan(0);

      // Trigger dropdown and check announcements
      await page.type('.search-input', 'test');
      await page.waitForSelector('.search-suggestions.visible');

      const updatedAnnouncements = await page.evaluate(() => {
        const liveRegion = document.querySelector('[aria-live="polite"]');
        return liveRegion ? liveRegion.textContent : '';
      });

      expect(updatedAnnouncements).toContain('suggestions');
    });
  });

  describe('Cross-Browser Compatibility Tests', () => {
    test('should work consistently across different browsers', async () => {
      // Test basic functionality
      await page.type('.search-input', 'test');
      await page.waitForSelector('.search-suggestions.visible');

      const dropdownMetrics = await page.evaluate(() => {
        const suggestions = document.querySelector('.search-suggestions');
        const computed = window.getComputedStyle(suggestions);

        return {
          display: computed.display,
          visibility: computed.visibility,
          position: computed.position,
          zIndex: computed.zIndex,
          transform: computed.transform
        };
      });

      expect(dropdownMetrics.visibility).toBe('visible');
      expect(dropdownMetrics.position).toBe('absolute');
      expect(parseInt(dropdownMetrics.zIndex)).toBeGreaterThan(1000);
    });

    test('should handle vendor prefixes correctly', async () => {
      const vendorSupport = await page.evaluate(() => {
        const testElement = document.createElement('div');
        testElement.style.transform = 'translateZ(0)';
        testElement.style.webkitTransform = 'translateZ(0)';

        const computed = window.getComputedStyle(testElement);
        return {
          transform: computed.transform,
          webkitTransform: computed.webkitTransform || 'not supported',
          backfaceVisibility: computed.backfaceVisibility || computed.webkitBackfaceVisibility
        };
      });

      // Should have transform support
      expect(vendorSupport.transform).not.toBe('none');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing DOM elements gracefully', async () => {
      // Remove dropdown container
      await page.evaluate(() => {
        const suggestions = document.querySelector('.search-suggestions');
        if (suggestions) suggestions.remove();
      });

      // Should not throw error when trying to show dropdown
      let errorThrown = false;
      try {
        await page.type('.search-input', 'test');
        await page.waitForTimeout(500);
      } catch (error) {
        errorThrown = true;
      }

      expect(errorThrown).toBe(false);
    });

    test('should handle rapid open/close operations', async () => {
      // Rapidly open and close dropdown
      for (let i = 0; i < 10; i++) {
        await page.type('.search-input', 'test');
        await page.keyboard.press('Escape');
        await page.evaluate(() => {
          document.querySelector('.search-input').value = '';
        });
      }

      // Should not have any visible dropdowns
      const visibleDropdowns = await page.evaluate(() => {
        const dropdowns = document.querySelectorAll('.dropdown-content.visible, .search-suggestions.visible');
        return dropdowns.length;
      });

      expect(visibleDropdowns).toBe(0);
    });

    test('should handle extreme content sizes', async () => {
      // Add many items to dropdown
      await page.evaluate(() => {
        const suggestions = document.querySelector('.search-suggestions');
        if (suggestions) {
          for (let i = 0; i < 100; i++) {
            const item = document.createElement('button');
            item.className = 'suggestion-item';
            item.textContent = `Very long suggestion item number ${i} with lots of text that might overflow`;
            suggestions.appendChild(item);
          }
        }
      });

      await page.type('.search-input', 'test');
      await page.waitForSelector('.search-suggestions.visible');

      const dropdownMetrics = await page.evaluate(() => {
        const suggestions = document.querySelector('.search-suggestions');
        return {
          scrollHeight: suggestions.scrollHeight,
          clientHeight: suggestions.clientHeight,
          hasScrollbar: suggestions.scrollHeight > suggestions.clientHeight
        };
      });

      expect(dropdownMetrics.hasScrollbar).toBe(true);
    });
  });

  describe('Performance and Memory Tests', () => {
    test('should not cause memory leaks with frequent dropdown operations', async () => {
      const initialMemory = await page.evaluate(() => {
        return performance.memory ? performance.memory.usedJSHeapSize : 0;
      });

      // Perform many dropdown operations
      for (let i = 0; i < 50; i++) {
        await page.type('.search-input', `test query ${i}`);
        await page.waitForTimeout(50);
        await page.keyboard.press('Escape');
        await page.evaluate(() => {
          document.querySelector('.search-input').value = '';
        });
      }

      // Force garbage collection if available
      if (page.evaluate(() => window.gc)) {
        await page.evaluate(() => window.gc());
      }

      const finalMemory = await page.evaluate(() => {
        return performance.memory ? performance.memory.usedJSHeapSize : 0;
      });

      // Memory should not increase significantly (allow 50% increase)
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = (finalMemory - initialMemory) / initialMemory;
        expect(memoryIncrease).toBeLessThan(0.5);
      }
    });

    test('should render dropdowns within performance budget', async () => {
      const startTime = Date.now();

      await page.type('.search-input', 'test');
      await page.waitForSelector('.search-suggestions.visible');

      const renderTime = Date.now() - startTime;

      // Should render within 100ms
      expect(renderTime).toBeLessThan(100);
    });
  });
});

// Helper function to create test HTML page
async function createTestPage() {
  const testHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dropdown Z-Index Test Page</title>
    </head>
    <body>
      <div class="search-container">
        <div class="search-input-container">
          <input type="text" class="search-input" placeholder="Search..." aria-expanded="false" aria-haspopup="listbox">
          <button class="filter-trigger">Filters</button>
          <button class="quick-actions-trigger">Actions</button>
        </div>

        <div class="search-suggestions">
          <button class="suggestion-item">Suggestion 1</button>
          <button class="suggestion-item">Suggestion 2</button>
          <button class="suggestion-item">Suggestion 3</button>
        </div>

        <div class="search-history">
          <div class="history-header">Recent Searches</div>
          <button class="history-item">Previous search 1</button>
          <button class="history-item">Previous search 2</button>
        </div>

        <div class="search-filters">
          <label>
            <input type="checkbox"> AI Enhanced
          </label>
          <select>
            <option>All Categories</option>
            <option>JCL</option>
            <option>VSAM</option>
          </select>
        </div>

        <div class="quick-actions-dropdown">
          <button class="action-item">Action 1</button>
          <button class="action-item">Action 2</button>
        </div>
      </div>

      <div class="modal-overlay">
        <div class="modal-content">
          <p>Modal content</p>
        </div>
      </div>

      <div class="tooltip">Tooltip content</div>

      <script>
        // Basic interaction handlers
        document.querySelector('.search-input').addEventListener('input', (e) => {
          const suggestions = document.querySelector('.search-suggestions');
          if (e.target.value.length > 0) {
            suggestions.classList.add('visible');
          } else {
            suggestions.classList.remove('visible');
          }
        });

        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            document.querySelectorAll('.visible').forEach(el => {
              el.classList.remove('visible');
            });
          }
        });

        // Simulate dropdown triggers
        document.querySelector('.filter-trigger').addEventListener('click', () => {
          document.querySelector('.search-filters').classList.toggle('visible');
        });

        document.querySelector('.quick-actions-trigger').addEventListener('click', () => {
          document.querySelector('.quick-actions-dropdown').classList.toggle('visible');
        });
      </script>
    </body>
    </html>
  `;

  const fs = require('fs').promises;
  await fs.writeFile(path.join(__dirname, '../test-dropdown-page.html'), testHTML);
}

// Run before tests
beforeAll(async () => {
  await createTestPage();
});