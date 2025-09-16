import { test, expect, Page } from '@playwright/test';
import { ResponsiveTestHelper } from '../utils/responsive-helper';
import { VisualRegressionHelper } from '../utils/visual-regression-helper';

test.describe('Responsive Visual Regression Tests', () => {
  let page: Page;
  let responsiveHelper: ResponsiveTestHelper;
  let visualHelper: VisualRegressionHelper;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    responsiveHelper = new ResponsiveTestHelper(page);
    visualHelper = new VisualRegressionHelper(page);
    
    // Set up consistent test environment
    await page.addInitScript(() => {
      // Disable animations for consistent screenshots
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `;
      document.head.appendChild(style);
    });
  });

  const viewports = [
    { width: 320, height: 568, name: 'mobile-portrait' },
    { width: 568, height: 320, name: 'mobile-landscape' },
    { width: 768, height: 1024, name: 'tablet-portrait' },
    { width: 1024, height: 768, name: 'tablet-landscape' },
    { width: 1366, height: 768, name: 'desktop-small' },
    { width: 1920, height: 1080, name: 'desktop-large' },
    { width: 2560, height: 1440, name: 'desktop-ultrawide' },
  ];

  test.describe('Homepage Visual Tests', () => {
    viewports.forEach(({ width, height, name }) => {
      test(`Homepage layout - ${name} (${width}x${height})`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/');
        
        // Wait for all content to load
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="main-content"]');
        
        // Wait for any lazy-loaded images
        await page.waitForFunction(() => {
          const images = Array.from(document.querySelectorAll('img'));
          return images.every(img => img.complete);
        });
        
        // Take full page screenshot
        await expect(page).toHaveScreenshot(`homepage-${name}.png`, {
          fullPage: true,
          threshold: 0.2,
          animations: 'disabled'
        });
      });
    });
  });

  test.describe('Knowledge Base Visual Tests', () => {
    viewports.forEach(({ width, height, name }) => {
      test(`Knowledge Base layout - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/knowledge-base');
        
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="kb-main-content"]');
        
        // Wait for search results to load
        await page.waitForTimeout(1000);
        
        await expect(page).toHaveScreenshot(`knowledge-base-${name}.png`, {
          fullPage: true,
          threshold: 0.2,
          animations: 'disabled'
        });
      });

      test(`KB search results - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/knowledge-base');
        
        // Perform search
        await page.fill('[data-testid="kb-search-input"]', 'test query');
        await page.press('[data-testid="kb-search-input"]', 'Enter');
        
        // Wait for search results
        await page.waitForSelector('[data-testid="search-results"]');
        await page.waitForTimeout(500);
        
        await expect(page).toHaveScreenshot(`kb-search-results-${name}.png`, {
          fullPage: true,
          threshold: 0.2,
          animations: 'disabled'
        });
      });
    });
  });

  test.describe('Form Visual Tests', () => {
    viewports.forEach(({ width, height, name }) => {
      test(`Add entry form - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/forms/add-entry');
        
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="entry-form"]');
        
        // Fill in some sample data
        await page.fill('[data-testid="entry-title"]', 'Sample Entry Title');
        await page.fill('[data-testid="entry-category"]', 'Testing');
        
        await expect(page).toHaveScreenshot(`add-entry-form-${name}.png`, {
          fullPage: true,
          threshold: 0.2,
          animations: 'disabled'
        });
      });

      test(`Form with validation errors - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/forms/add-entry');
        
        await page.waitForSelector('[data-testid="entry-form"]');
        
        // Try to submit empty form to trigger validation
        await page.click('[data-testid="submit-button"]');
        
        // Wait for validation messages
        await page.waitForSelector('[data-testid="validation-error"]');
        
        await expect(page).toHaveScreenshot(`form-validation-errors-${name}.png`, {
          fullPage: true,
          threshold: 0.2,
          animations: 'disabled'
        });
      });
    });
  });

  test.describe('Data Table Visual Tests', () => {
    viewports.forEach(({ width, height, name }) => {
      test(`Data table layout - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/admin/entries');
        
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="entries-table"]');
        
        await expect(page).toHaveScreenshot(`data-table-${name}.png`, {
          fullPage: true,
          threshold: 0.2,
          animations: 'disabled'
        });
      });

      test(`Table with filters - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/admin/entries');
        
        await page.waitForSelector('[data-testid="entries-table"]');
        
        // Open filters if available
        const filterToggle = page.locator('[data-testid="filter-toggle"]');
        if (await filterToggle.isVisible()) {
          await filterToggle.click();
          await page.waitForSelector('[data-testid="table-filters"]');
        }
        
        await expect(page).toHaveScreenshot(`table-with-filters-${name}.png`, {
          fullPage: true,
          threshold: 0.2,
          animations: 'disabled'
        });
      });
    });
  });

  test.describe('Navigation Visual Tests', () => {
    viewports.forEach(({ width, height, name }) => {
      test(`Navigation states - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/');
        
        await page.waitForLoadState('networkidle');
        
        // Test mobile navigation if applicable
        if (width < 768) {
          const hamburger = page.locator('[data-testid="mobile-menu-toggle"]');
          if (await hamburger.isVisible()) {
            await hamburger.click();
            await page.waitForSelector('[data-testid="mobile-nav-drawer"]');
          }
        }
        
        await expect(page).toHaveScreenshot(`navigation-${name}.png`, {
          fullPage: true,
          threshold: 0.2,
          animations: 'disabled'
        });
      });
    });
  });

  test.describe('Modal Visual Tests', () => {
    viewports.forEach(({ width, height, name }) => {
      test(`Modal sizing - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/');
        
        // Trigger modal
        const modalTrigger = page.locator('[data-testid="open-modal-button"]');
        if (await modalTrigger.isVisible()) {
          await modalTrigger.click();
          await page.waitForSelector('[data-testid="modal"]');
          
          await expect(page).toHaveScreenshot(`modal-${name}.png`, {
            threshold: 0.2,
            animations: 'disabled'
          });
        }
      });
    });
  });

  test.describe('Component Visual Tests', () => {
    test('Button states across viewports', async () => {
      for (const { width, height, name } of viewports) {
        await page.setViewportSize({ width, height });
        await page.goto('/components/buttons');
        
        await page.waitForSelector('[data-testid="button-showcase"]');
        
        // Test different button states
        const buttonStates = ['default', 'hover', 'active', 'disabled'];
        
        for (const state of buttonStates) {
          const stateButton = page.locator(`[data-testid="button-${state}"]`);
          if (await stateButton.isVisible()) {
            if (state === 'hover') {
              await stateButton.hover();
            }
            
            await expect(stateButton).toHaveScreenshot(
              `button-${state}-${name}.png`,
              { threshold: 0.1 }
            );
          }
        }
      }
    });

    test('Form field states across viewports', async () => {
      for (const { width, height, name } of viewports) {
        await page.setViewportSize({ width, height });
        await page.goto('/components/form-fields');
        
        await page.waitForSelector('[data-testid="form-field-showcase"]');
        
        // Test field states
        const fieldStates = ['empty', 'filled', 'error', 'disabled'];
        
        for (const state of fieldStates) {
          const field = page.locator(`[data-testid="field-${state}"]`);
          if (await field.isVisible()) {
            await expect(field).toHaveScreenshot(
              `form-field-${state}-${name}.png`,
              { threshold: 0.1 }
            );
          }
        }
      }
    });
  });

  test.describe('Layout Transition Tests', () => {
    test('Responsive breakpoint transitions', async () => {
      // Test transitions between key breakpoints
      const transitions = [
        { from: { width: 767, height: 1024 }, to: { width: 768, height: 1024 }, name: 'mobile-to-tablet' },
        { from: { width: 1023, height: 768 }, to: { width: 1024, height: 768 }, name: 'tablet-to-desktop' },
        { from: { width: 1365, height: 768 }, to: { width: 1366, height: 768 }, name: 'small-to-large-desktop' },
      ];

      for (const { from, to, name } of transitions) {
        await page.setViewportSize(from);
        await page.goto('/knowledge-base');
        await page.waitForLoadState('networkidle');
        
        // Take before screenshot
        await expect(page).toHaveScreenshot(`transition-${name}-before.png`, {
          fullPage: true,
          threshold: 0.2,
          animations: 'disabled'
        });
        
        // Transition to new viewport
        await page.setViewportSize(to);
        await page.waitForTimeout(500); // Allow layout to settle
        
        // Take after screenshot
        await expect(page).toHaveScreenshot(`transition-${name}-after.png`, {
          fullPage: true,
          threshold: 0.2,
          animations: 'disabled'
        });
      }
    });
  });

  test.describe('Orientation Change Tests', () => {
    test('Mobile orientation changes', async () => {
      const orientations = [
        { width: 375, height: 667, name: 'portrait' },
        { width: 667, height: 375, name: 'landscape' },
      ];

      for (const { width, height, name } of orientations) {
        await page.setViewportSize({ width, height });
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        await expect(page).toHaveScreenshot(`mobile-${name}.png`, {
          fullPage: true,
          threshold: 0.2,
          animations: 'disabled'
        });
      }
    });

    test('Tablet orientation changes', async () => {
      const orientations = [
        { width: 768, height: 1024, name: 'portrait' },
        { width: 1024, height: 768, name: 'landscape' },
      ];

      for (const { width, height, name } of orientations) {
        await page.setViewportSize({ width, height });
        await page.goto('/knowledge-base');
        await page.waitForLoadState('networkidle');
        
        await expect(page).toHaveScreenshot(`tablet-${name}.png`, {
          fullPage: true,
          threshold: 0.2,
          animations: 'disabled'
        });
      }
    });
  });

  test.describe('Dark Mode Visual Tests', () => {
    test.beforeEach(async () => {
      // Enable dark mode
      await page.emulateMedia({ colorScheme: 'dark' });
    });

    viewports.forEach(({ width, height, name }) => {
      test(`Dark mode - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/');
        
        await page.waitForLoadState('networkidle');
        
        await expect(page).toHaveScreenshot(`dark-mode-${name}.png`, {
          fullPage: true,
          threshold: 0.2,
          animations: 'disabled'
        });
      });
    });
  });

  test.describe('High Contrast Visual Tests', () => {
    test.beforeEach(async () => {
      // Simulate high contrast mode
      await page.addInitScript(() => {
        document.documentElement.style.filter = 'contrast(150%)';
      });
    });

    ['mobile-portrait', 'tablet-landscape', 'desktop-large'].forEach((viewport) => {
      test(`High contrast mode - ${viewport}`, async () => {
        const config = viewports.find(v => v.name === viewport);
        if (config) {
          await page.setViewportSize({ width: config.width, height: config.height });
          await page.goto('/');
          
          await page.waitForLoadState('networkidle');
          
          await expect(page).toHaveScreenshot(`high-contrast-${viewport}.png`, {
            fullPage: true,
            threshold: 0.3, // Higher threshold for contrast differences
            animations: 'disabled'
          });
        }
      });
    });
  });
});
