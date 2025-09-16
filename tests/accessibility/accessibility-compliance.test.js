const { test, expect } = require('@playwright/test');
const { injectAxe, checkA11y, getViolations } = require('axe-playwright');

/**
 * Accessibility Compliance Testing Suite
 * Comprehensive WCAG AA/AAA compliance verification
 */

test.describe('Accessibility Compliance - WCAG AA/AAA', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);
  });

  // Core accessibility testing
  test('Homepage accessibility compliance', async ({ page }) => {
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      rules: {
        // WCAG AA compliance
        'color-contrast': { enabled: true },
        'keyboard-navigation': { enabled: true },
        'focus-management': { enabled: true },
        'semantic-markup': { enabled: true },
        'aria-usage': { enabled: true }
      }
    });
  });

  // Component-specific accessibility testing
  const COMPONENTS_TO_TEST = [
    'buttons',
    'forms',
    'navigation',
    'modals',
    'tables',
    'cards',
    'alerts',
    'tooltips',
    'dropdowns',
    'tabs'
  ];

  COMPONENTS_TO_TEST.forEach(component => {
    test(`${component} accessibility compliance`, async ({ page }) => {
      await page.goto(`/components/${component}`);
      
      // Check overall accessibility
      await checkA11y(page, null, {
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
        rules: {
          // Ensure color contrast meets AA standards
          'color-contrast': { enabled: true },
          // Verify proper heading hierarchy
          'heading-order': { enabled: true },
          // Check ARIA implementation
          'aria-valid-attr': { enabled: true },
          'aria-valid-attr-value': { enabled: true },
          'aria-required-attr': { enabled: true },
          // Verify keyboard accessibility
          'focusable-content': { enabled: true },
          'tabindex': { enabled: true }
        }
      });
      
      // Test specific component interactions
      const componentSelector = `[data-testid="${component}-component"]`;
      if (await page.locator(componentSelector).count() > 0) {
        await checkA11y(page, componentSelector, {
          tags: ['wcag2a', 'wcag2aa']
        });
      }
    });
  });

  // Color contrast testing
  test('Color contrast WCAG AA/AAA compliance', async ({ page }) => {
    await page.goto('/components/color-system');
    
    // Test all color combinations
    const colorElements = await page.locator('[data-testid^="color-sample-"]').all();
    
    for (const element of colorElements) {
      const violations = await getViolations(page, element, {
        rules: {
          'color-contrast': { enabled: true },
          'color-contrast-enhanced': { enabled: true } // AAA level
        }
      });
      
      expect(violations.length).toBe(0);
    }
  });

  // Keyboard navigation testing
  test('Keyboard navigation accessibility', async ({ page }) => {
    await page.goto('/components/interactive');
    
    // Test tab order
    const focusableElements = await page.locator(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ).all();
    
    let previousTabIndex = -1;
    for (let i = 0; i < focusableElements.length; i++) {
      await page.keyboard.press('Tab');
      
      const focused = page.locator(':focus');
      const tabIndex = await focused.getAttribute('tabindex');
      const computedTabIndex = tabIndex ? parseInt(tabIndex) : 0;
      
      // Verify logical tab order
      if (computedTabIndex > 0) {
        expect(computedTabIndex).toBeGreaterThanOrEqual(previousTabIndex);
        previousTabIndex = computedTabIndex;
      }
      
      // Verify focus visibility
      const focusVisible = await focused.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return (
          styles.outline !== 'none' ||
          styles.boxShadow !== 'none' ||
          styles.border !== 'none'
        );
      });
      
      expect(focusVisible).toBe(true);
    }
  });

  // Screen reader compatibility
  test('Screen reader compatibility', async ({ page }) => {
    await page.goto('/components/screen-reader-test');
    
    // Check for proper heading structure
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    let previousLevel = 0;
    
    for (const heading of headings) {
      const tagName = await heading.evaluate(el => el.tagName);
      const currentLevel = parseInt(tagName.charAt(1));
      
      // Verify heading hierarchy doesn't skip levels
      expect(currentLevel - previousLevel).toBeLessThanOrEqual(1);
      previousLevel = currentLevel;
    }
    
    // Check for proper ARIA labels
    const interactiveElements = await page.locator(
      'button, [role="button"], input, [role="textbox"], [role="combobox"]'
    ).all();
    
    for (const element of interactiveElements) {
      const ariaLabel = await element.getAttribute('aria-label');
      const ariaLabelledBy = await element.getAttribute('aria-labelledby');
      const innerText = await element.innerText();
      const placeholder = await element.getAttribute('placeholder');
      
      // Ensure elements have accessible names
      const hasAccessibleName = ariaLabel || ariaLabelledBy || innerText || placeholder;
      expect(hasAccessibleName).toBeTruthy();
    }
  });

  // High contrast mode testing
  test('High contrast mode compatibility', async ({ page }) => {
    // Enable high contrast mode
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/');
    
    // Verify content is still visible and usable
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true },
        'focus-visible': { enabled: true }
      }
    });
    
    // Test critical components in high contrast
    const criticalComponents = ['navigation', 'forms', 'buttons'];
    for (const component of criticalComponents) {
      await page.goto(`/components/${component}`);
      await checkA11y(page);
    }
  });

  // Reduced motion testing
  test('Reduced motion accessibility', async ({ page }) => {
    // Enable reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/components/animations');
    
    // Verify animations are reduced or disabled
    const animatedElements = await page.locator('[data-animation="true"]').all();
    
    for (const element of animatedElements) {
      const animationDuration = await element.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.animationDuration;
      });
      
      // Animation duration should be 0s or very short
      expect(animationDuration === '0s' || parseFloat(animationDuration) <= 0.1).toBe(true);
    }
  });

  // Form accessibility testing
  test('Form accessibility compliance', async ({ page }) => {
    await page.goto('/components/forms');
    
    // Check form labels and associations
    const inputs = await page.locator('input, select, textarea').all();
    
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      
      if (id) {
        // Check for associated label
        const label = await page.locator(`label[for="${id}"]`).count();
        expect(label > 0 || ariaLabel || ariaLabelledBy).toBe(true);
      }
      
      // Check for required field indicators
      const required = await input.getAttribute('required');
      const ariaRequired = await input.getAttribute('aria-required');
      
      if (required !== null) {
        expect(ariaRequired).toBe('true');
      }
    }
    
    // Test form validation accessibility
    const submitButton = page.locator('[type="submit"]').first();
    await submitButton.click();
    
    // Check for accessible error messages
    const errorMessages = await page.locator('[role="alert"], .error-message').all();
    for (const error of errorMessages) {
      const isVisible = await error.isVisible();
      const hasText = await error.innerText();
      expect(isVisible && hasText.length > 0).toBe(true);
    }
  });

  // Touch target sizing
  test('Touch target accessibility (44px minimum)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // Mobile viewport
    await page.goto('/components/interactive');
    
    const touchTargets = await page.locator(
      'button, [role="button"], a, input[type="checkbox"], input[type="radio"]'
    ).all();
    
    for (const target of touchTargets) {
      const box = await target.boundingBox();
      if (box) {
        // WCAG requirement: minimum 44x44px touch targets
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  // Language and internationalization
  test('Language accessibility features', async ({ page }) => {
    await page.goto('/');
    
    // Check for lang attribute
    const htmlLang = await page.getAttribute('html', 'lang');
    expect(htmlLang).toBeTruthy();
    
    // Check for direction attribute if needed
    const direction = await page.getAttribute('html', 'dir');
    expect(['ltr', 'rtl', null]).toContain(direction);
    
    // Test with different languages if supported
    const langSwitcher = page.locator('[data-testid="language-switcher"]');
    if (await langSwitcher.count() > 0) {
      await langSwitcher.click();
      await page.locator('[data-lang="es"]').first().click();
      
      // Verify language change
      const newLang = await page.getAttribute('html', 'lang');
      expect(newLang).toBe('es');
      
      // Verify accessibility in different language
      await checkA11y(page);
    }
  });
});

// Accessibility utility functions
test.describe('Accessibility Utilities', () => {
  test('Accessibility testing utilities work correctly', async ({ page }) => {
    await page.goto('/test-utilities/accessibility');
    
    // Test custom accessibility functions
    const announceFunction = await page.evaluate(() => {
      return typeof window.announceToScreenReader === 'function';
    });
    expect(announceFunction).toBe(true);
    
    // Test focus management utilities
    const focusUtils = await page.evaluate(() => {
      return (
        typeof window.trapFocus === 'function' &&
        typeof window.restoreFocus === 'function' &&
        typeof window.focusFirstElement === 'function'
      );
    });
    expect(focusUtils).toBe(true);
  });
});
