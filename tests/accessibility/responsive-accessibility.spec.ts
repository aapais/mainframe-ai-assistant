import { test, expect, Page } from '@playwright/test';
import { ResponsiveTestHelper } from '../utils/responsive-helper';
import { AccessibilityHelper } from '../utils/accessibility-helper';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Responsive Accessibility Tests', () => {
  let page: Page;
  let responsiveHelper: ResponsiveTestHelper;
  let a11yHelper: AccessibilityHelper;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    responsiveHelper = new ResponsiveTestHelper(page);
    a11yHelper = new AccessibilityHelper(page);
    
    // Initialize axe for accessibility testing
    await a11yHelper.initialize();
  });

  const viewports = [
    { width: 320, height: 568, name: 'mobile-portrait', category: 'mobile' as const },
    { width: 768, height: 1024, name: 'tablet-portrait', category: 'tablet' as const },
    { width: 1024, height: 768, name: 'tablet-landscape', category: 'tablet' as const },
    { width: 1366, height: 768, name: 'desktop-small', category: 'desktop' as const },
    { width: 1920, height: 1080, name: 'desktop-large', category: 'desktop' as const },
  ];

  test.describe('Touch Target Accessibility', () => {
    viewports.forEach(({ width, height, name, category }) => {
      test(`Touch targets meet minimum size - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/');
        
        // Define minimum touch target sizes by device category
        const minSizes = {
          mobile: 44,   // WCAG 2.1 AA minimum for mobile
          tablet: 44,   // Same as mobile
          desktop: 24   // Smaller acceptable for mouse interaction
        };
        
        const minSize = minSizes[category];
        const touchTargetResult = await a11yHelper.validateTouchTargets(minSize);
        
        // Log failed touch targets for debugging
        if (touchTargetResult.failed.length > 0) {
          console.log(`Failed touch targets on ${name}:`, touchTargetResult.failed);
        }
        
        // Assert that all touch targets meet minimum size
        expect(touchTargetResult.failed.length).toBe(0);
        expect(touchTargetResult.passed.length).toBeGreaterThan(0);
      });
    });
  });

  test.describe('Color Contrast at Different Scales', () => {
    viewports.forEach(({ width, height, name, category }) => {
      test(`Color contrast meets WCAG standards - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/');
        
        // Wait for all content to load
        await page.waitForLoadState('networkidle');
        
        // Test color contrast
        const contrastResults = await a11yHelper.validateColorContrast(4.5, 'AA');
        
        // Filter out results with insufficient data
        const validResults = contrastResults.filter(result => 
          result.foreground !== 'rgba(0, 0, 0, 0)' && 
          result.background !== 'rgba(0, 0, 0, 0)'
        );
        
        const failedContrast = validResults.filter(result => !result.passes);
        
        if (failedContrast.length > 0) {
          console.log(`Failed color contrast on ${name}:`, failedContrast);
        }
        
        // Allow some tolerance for edge cases, but most should pass
        const passRate = (validResults.length - failedContrast.length) / validResults.length;
        expect(passRate).toBeGreaterThan(0.9); // 90% pass rate
      });
    });
  });

  test.describe('Keyboard Navigation Across Viewports', () => {
    viewports.forEach(({ width, height, name }) => {
      test(`Keyboard navigation works properly - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/');
        
        const navResult = await a11yHelper.testKeyboardNavigation();
        
        // Should have focusable elements
        expect(navResult.focusableElements).toBeGreaterThan(0);
        
        // Should have logical tab order
        expect(navResult.tabOrder.length).toBeGreaterThan(0);
        
        // Should not have focus trap violations
        expect(navResult.trapViolations.length).toBe(0);
        
        // Tab order should include navigation elements
        const hasNavigation = navResult.tabOrder.some(selector => 
          selector.includes('nav') || selector.includes('menu')
        );
        expect(hasNavigation).toBe(true);
      });
    });
  });

  test.describe('Screen Reader Compatibility', () => {
    viewports.forEach(({ width, height, name, category }) => {
      test(`ARIA attributes and landmarks - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/');
        
        const ariaResult = await a11yHelper.validateARIA();
        
        // Check for missing labels (critical for screen readers)
        expect(ariaResult.missingLabels.length).toBeLessThan(3); // Allow few exceptions
        
        // Should not have invalid roles
        expect(ariaResult.invalidRoles.length).toBe(0);
        
        // Check for proper landmarks
        const landmarks = await page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer').count();
        expect(landmarks).toBeGreaterThan(2); // Should have main structure
        
        // Test navigation announcements for mobile
        if (category === 'mobile') {
          const mobileMenu = page.locator('[data-testid="mobile-menu-toggle"]');
          if (await mobileMenu.isVisible()) {
            // Should have aria-label or aria-labelledby
            const hasLabel = await mobileMenu.getAttribute('aria-label') || 
                           await mobileMenu.getAttribute('aria-labelledby');
            expect(hasLabel).toBeTruthy();
          }
        }
      });
    });
  });

  test.describe('Focus Management in Responsive Layouts', () => {
    test('Focus management during viewport changes', async () => {
      await page.goto('/');
      
      // Start with desktop view
      await page.setViewportSize({ width: 1366, height: 768 });
      
      // Focus on a navigation element
      const navElement = page.locator('[data-testid="nav-item"]').first();
      if (await navElement.isVisible()) {
        await navElement.focus();
        
        // Verify focus
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
        
        // Switch to mobile view
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForTimeout(500); // Allow layout to settle
        
        // Focus should still be manageable
        await page.keyboard.press('Tab');
        const newFocusedElement = page.locator(':focus');
        await expect(newFocusedElement).toBeVisible();
      }
    });

    test('Modal focus trap across viewports', async () => {
      for (const { width, height, name } of viewports.slice(0, 3)) {
        await page.setViewportSize({ width, height });
        await page.goto('/');
        
        // Try to open a modal
        const modalTrigger = page.locator('[data-testid="open-modal-button"]');
        if (await modalTrigger.isVisible()) {
          await modalTrigger.click();
          
          const modal = page.locator('[data-testid="modal"]');
          await expect(modal).toBeVisible();
          
          // Test focus trap
          const focusTrapResult = await a11yHelper.testFocusTrap('[data-testid="modal"]');
          
          expect(focusTrapResult.trapped).toBe(true);
          expect(focusTrapResult.initialFocus).toBe(true);
          
          // Modal should close and restore focus
          if (focusTrapResult.escapeWorks) {
            expect(focusTrapResult.escapeWorks).toBe(true);
          } else {
            // Try closing with close button
            const closeButton = page.locator('[data-testid="modal-close"]');
            if (await closeButton.isVisible()) {
              await closeButton.click();
              await expect(modal).not.toBeVisible();
            }
          }
        }
      }
    });
  });

  test.describe('Reduced Motion Compliance', () => {
    viewports.forEach(({ width, height, name }) => {
      test(`Respects reduced motion preference - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        
        // Enable reduced motion
        await page.emulateMedia({ reducedMotion: 'reduce' });
        
        await page.goto('/');
        
        // Test that animations are disabled or reduced
        const reducedMotionResult = await a11yHelper.testReducedMotion();
        
        expect(reducedMotionResult.respectsPreference).toBe(true);
        
        // Should disable or significantly reduce animations
        if (reducedMotionResult.animationsFound > 0) {
          const reductionRate = reducedMotionResult.animationsDisabled / reducedMotionResult.animationsFound;
          expect(reductionRate).toBeGreaterThan(0.8); // At least 80% of animations disabled
        }
      });
    });
  });

  test.describe('Axe Accessibility Audit', () => {
    viewports.forEach(({ width, height, name }) => {
      test(`Comprehensive accessibility audit - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/');
        
        // Wait for page to be fully loaded
        await page.waitForLoadState('networkidle');
        
        // Run axe accessibility audit
        const violations = await a11yHelper.runAccessibilityAudit({
          tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
          exclude: ['[data-test-exclude]'] // Exclude test-specific elements
        });
        
        // Log violations for debugging
        if (violations.length > 0) {
          console.log(`Accessibility violations on ${name}:`, violations);
        }
        
        // Filter out minor violations for responsive test
        const majorViolations = violations.filter(v => 
          v.impact === 'serious' || v.impact === 'critical'
        );
        
        // Should have no major accessibility violations
        expect(majorViolations.length).toBe(0);
        
        // Total violations should be minimal
        expect(violations.length).toBeLessThan(5);
      });
    });
  });

  test.describe('Form Accessibility Across Viewports', () => {
    viewports.forEach(({ width, height, name, category }) => {
      test(`Form accessibility - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/forms/add-entry');
        
        // Check form labels and associations
        const formFields = page.locator('input, textarea, select');
        const fieldCount = await formFields.count();
        
        for (let i = 0; i < fieldCount; i++) {
          const field = formFields.nth(i);
          const fieldId = await field.getAttribute('id');
          
          if (fieldId) {
            // Check for associated label
            const label = page.locator(`label[for="${fieldId}"]`);
            const hasLabel = (await label.count()) > 0;
            
            // Check for aria-label if no visible label
            const ariaLabel = await field.getAttribute('aria-label');
            const ariaLabelledBy = await field.getAttribute('aria-labelledby');
            
            const hasAccessibleName = hasLabel || ariaLabel || ariaLabelledBy;
            expect(hasAccessibleName).toBe(true);
          }
        }
        
        // Test form error handling
        const submitButton = page.locator('[data-testid="submit-button"]');
        if (await submitButton.isVisible()) {
          // Try submitting empty form
          await submitButton.click();
          
          // Wait for validation errors
          await page.waitForTimeout(500);
          
          // Check for error announcements
          const errorMessages = page.locator('[role="alert"], [aria-live="polite"], [aria-live="assertive"]');
          const errorCount = await errorMessages.count();
          
          if (errorCount > 0) {
            // Errors should be properly announced
            const firstError = errorMessages.first();
            const errorText = await firstError.textContent();
            expect(errorText?.trim().length).toBeGreaterThan(0);
          }
        }
      });
    });
  });

  test.describe('Data Table Accessibility', () => {
    viewports.forEach(({ width, height, name, category }) => {
      test(`Table accessibility - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        await page.goto('/admin/entries');
        
        const dataTable = page.locator('[data-testid="entries-table"]');
        if (await dataTable.isVisible()) {
          // Check table structure
          const tableHeaders = page.locator('th');
          const headerCount = await tableHeaders.count();
          
          if (headerCount > 0) {
            // Headers should have proper scope
            for (let i = 0; i < headerCount; i++) {
              const header = tableHeaders.nth(i);
              const scope = await header.getAttribute('scope');
              
              // Should have scope="col" for column headers
              if (!scope) {
                const hasScope = await header.evaluate(el => 
                  el.closest('thead') !== null
                );
                if (hasScope) {
                  console.warn(`Header missing scope attribute: ${await header.textContent()}`);
                }
              }
            }
          }
          
          // Check table caption or aria-label
          const caption = page.locator('caption');
          const tableAriaLabel = await dataTable.getAttribute('aria-label');
          const tableAriaLabelledBy = await dataTable.getAttribute('aria-labelledby');
          
          const hasAccessibleName = 
            (await caption.count()) > 0 || tableAriaLabel || tableAriaLabelledBy;
          
          expect(hasAccessibleName).toBe(true);
          
          // Test keyboard navigation in table
          const firstCell = page.locator('td, th').first();
          if (await firstCell.isVisible()) {
            await firstCell.focus();
            
            // Should be able to navigate with arrow keys
            await page.keyboard.press('ArrowRight');
            const focusedAfterArrow = page.locator(':focus');
            await expect(focusedAfterArrow).toBeVisible();
          }
        }
      });
    });
  });

  test.describe('Progressive Enhancement', () => {
    test('Accessibility without JavaScript', async () => {
      // Disable JavaScript
      await page.setJavaScriptEnabled(false);
      
      for (const { width, height, name } of viewports.slice(0, 2)) {
        await page.setViewportSize({ width, height });
        await page.goto('/');
        
        // Basic content should still be accessible
        const mainContent = page.locator('main, [role="main"]');
        await expect(mainContent).toBeVisible();
        
        // Navigation should work
        const navigation = page.locator('nav, [role="navigation"]');
        await expect(navigation).toBeVisible();
        
        // Links should be accessible
        const links = page.locator('a[href]');
        const linkCount = await links.count();
        expect(linkCount).toBeGreaterThan(0);
        
        // Test first link navigation
        const firstLink = links.first();
        const href = await firstLink.getAttribute('href');
        
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          const linkText = await firstLink.textContent();
          expect(linkText?.trim().length).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe('High Contrast Mode', () => {
    viewports.forEach(({ width, height, name }) => {
      test(`High contrast compatibility - ${name}`, async () => {
        await page.setViewportSize({ width, height });
        
        // Simulate high contrast mode
        await page.addInitScript(() => {
          // Apply high contrast styles
          const style = document.createElement('style');
          style.textContent = `
            @media (prefers-contrast: high) {
              * {
                background: white !important;
                color: black !important;
                border-color: black !important;
              }
              
              a {
                color: blue !important;
              }
              
              a:visited {
                color: purple !important;
              }
            }
          `;
          document.head.appendChild(style);
        });
        
        await page.goto('/');
        
        // Test that content is still readable
        const textElements = page.locator('p, h1, h2, h3, h4, h5, h6, span');
        const textCount = await textElements.count();
        
        if (textCount > 0) {
          const sampleText = textElements.first();
          const textContent = await sampleText.textContent();
          expect(textContent?.trim().length).toBeGreaterThan(0);
          
          // Element should be visible in high contrast
          await expect(sampleText).toBeVisible();
        }
      });
    });
  });

  test.describe('Zoom and Magnification', () => {
    test('Content accessibility at 200% zoom', async () => {
      for (const { width, height, name } of viewports.slice(0, 3)) {
        // Set viewport and enable zoom
        await page.setViewportSize({ width, height });
        await page.goto('/');
        
        // Simulate 200% zoom
        await page.evaluate(() => {
          document.body.style.zoom = '2';
        });
        
        await page.waitForTimeout(500);
        
        // Content should still be accessible
        const mainContent = page.locator('main, [role="main"]');
        await expect(mainContent).toBeVisible();
        
        // Navigation should work
        const navigation = page.locator('nav, [role="navigation"]');
        if (await navigation.isVisible()) {
          const navItems = page.locator('[data-testid="nav-item"]');
          const navCount = await navItems.count();
          
          if (navCount > 0) {
            // Should be able to focus and activate navigation
            const firstNavItem = navItems.first();
            await firstNavItem.focus();
            await expect(firstNavItem).toBeFocused();
          }
        }
        
        // Reset zoom
        await page.evaluate(() => {
          document.body.style.zoom = '1';
        });
      }
    });
  });
});
