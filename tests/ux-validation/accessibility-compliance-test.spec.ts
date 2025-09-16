/**
 * Accessibility Compliance Test Suite
 * Comprehensive WCAG 2.1 AA compliance validation
 */

import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

interface AccessibilityTestContext {
  page: Page;
  baseURL: string;
}

const WCAG_AA_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa'
];

const CRITICAL_RULES = [
  'color-contrast',
  'keyboard-navigation',
  'focus-management',
  'aria-labels',
  'heading-hierarchy',
  'landmark-roles',
  'form-labels',
  'image-alt',
  'link-purpose'
];

test.describe('WCAG 2.1 AA Compliance Tests', () => {
  let context: AccessibilityTestContext;

  test.beforeEach(async ({ page }) => {
    context = {
      page,
      baseURL: 'http://localhost:3000' // Adjust based on your app URL
    };

    // Navigate to the main search interface
    await page.goto(context.baseURL);
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('Core Accessibility Requirements', () => {
    test('should have no critical accessibility violations on search interface', async () => {
      const accessibilityScanResults = await new AxeBuilder({ page: context.page })
        .withTags(WCAG_AA_TAGS)
        .include('[data-testid="search-interface"]')
        .analyze();

      // Filter for critical violations
      const criticalViolations = accessibilityScanResults.violations.filter(violation =>
        CRITICAL_RULES.some(rule => violation.id.includes(rule)) ||
        violation.impact === 'critical'
      );

      expect(criticalViolations).toHaveLength(0);

      // Log any other violations for review
      if (accessibilityScanResults.violations.length > 0) {
        console.log('Non-critical accessibility issues found:',
          accessibilityScanResults.violations.map(v => ({
            id: v.id,
            impact: v.impact,
            description: v.description
          }))
        );
      }
    });

    test('should have proper heading hierarchy', async () => {
      const headings = await context.page.$$eval('h1, h2, h3, h4, h5, h6', elements =>
        elements.map(el => ({
          level: parseInt(el.tagName.substring(1)),
          text: el.textContent?.trim(),
          visible: el.offsetWidth > 0 && el.offsetHeight > 0
        }))
      );

      // Should have exactly one h1
      const h1Count = headings.filter(h => h.level === 1).length;
      expect(h1Count).toBe(1);

      // Check heading sequence (no level should be skipped)
      const visibleHeadings = headings.filter(h => h.visible);
      for (let i = 1; i < visibleHeadings.length; i++) {
        const currentLevel = visibleHeadings[i].level;
        const previousLevel = visibleHeadings[i - 1].level;

        // Heading level should not increase by more than 1
        if (currentLevel > previousLevel) {
          expect(currentLevel - previousLevel).toBeLessThanOrEqual(1);
        }
      }
    });

    test('should have proper ARIA landmarks', async () => {
      const requiredLandmarks = ['main', 'search', 'navigation'];

      for (const landmark of requiredLandmarks) {
        const landmarkElement = await context.page.locator(`[role="${landmark}"]`).first();
        await expect(landmarkElement).toBeVisible();
      }

      // Search should be properly labeled
      const searchLandmark = context.page.locator('[role="search"]');
      await expect(searchLandmark).toHaveAttribute('aria-label');
    });

    test('should have accessible form controls', async () => {
      // All input fields should have labels
      const inputs = await context.page.$$('input');

      for (const input of inputs) {
        const inputId = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledby = await input.getAttribute('aria-labelledby');

        if (inputId) {
          // Check for associated label
          const label = await context.page.$(`label[for="${inputId}"]`);
          const hasLabel = label !== null || ariaLabel !== null || ariaLabelledby !== null;
          expect(hasLabel).toBe(true);
        } else {
          // Should have aria-label if no ID/label association
          expect(ariaLabel).toBeTruthy();
        }
      }

      // Search input should be properly labeled
      const searchInput = context.page.locator('[data-testid="search-input"]');
      await expect(searchInput).toHaveAttribute('aria-label');
      await expect(searchInput).toHaveAttribute('role', 'searchbox');
    });

    test('should have sufficient color contrast', async () => {
      const accessibilityScanResults = await new AxeBuilder({ page: context.page })
        .withRules(['color-contrast'])
        .analyze();

      const contrastViolations = accessibilityScanResults.violations.filter(
        violation => violation.id === 'color-contrast'
      );

      expect(contrastViolations).toHaveLength(0);
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should support full keyboard navigation', async () => {
      // Start from search input
      await context.page.focus('[data-testid="search-input"]');

      // Tab through interactive elements
      const tabOrder = [
        '[data-testid="search-input"]',
        '[data-testid="search-button"]',
        '.search-filters button',
        '.search-results [tabindex="0"]'
      ];

      for (let i = 0; i < tabOrder.length; i++) {
        const focused = await context.page.evaluate(() => document.activeElement?.dataset?.testid);

        if (i > 0) {
          // Verify element received focus
          const expectedElement = await context.page.$(tabOrder[i]);
          if (expectedElement) {
            const isFocused = await expectedElement.evaluate(el => document.activeElement === el);
            expect(isFocused).toBe(true);
          }
        }

        // Move to next element
        if (i < tabOrder.length - 1) {
          await context.page.keyboard.press('Tab');
          await context.page.waitForTimeout(100); // Allow focus to settle
        }
      }
    });

    test('should handle escape key appropriately', async () => {
      // Open autocomplete
      await context.page.fill('[data-testid="search-input"]', 'S0C7');
      await context.page.waitForSelector('.search-suggestions', { timeout: 5000 });

      // Escape should close suggestions
      await context.page.keyboard.press('Escape');
      await expect(context.page.locator('.search-suggestions')).not.toBeVisible();

      // Focus should remain on search input
      const focused = await context.page.evaluate(() => document.activeElement?.dataset?.testid);
      expect(focused).toBe('search-input');
    });

    test('should support arrow key navigation in suggestions', async () => {
      // Type to trigger autocomplete
      await context.page.fill('[data-testid="search-input"]', 'S0');
      await context.page.waitForSelector('.search-suggestions');

      // Arrow down should navigate suggestions
      await context.page.keyboard.press('ArrowDown');

      // Check that first suggestion is highlighted
      const selectedSuggestion = await context.page.$('.suggestion-item--selected');
      expect(selectedSuggestion).toBeTruthy();

      // Arrow down again should move to next suggestion
      await context.page.keyboard.press('ArrowDown');

      // Verify selection moved
      const suggestions = await context.page.$$('.suggestion-item');
      if (suggestions.length > 1) {
        const secondSelected = await suggestions[1].evaluate(el =>
          el.classList.contains('suggestion-item--selected')
        );
        expect(secondSelected).toBe(true);
      }
    });

    test('should provide focus indicators', async () => {
      const interactiveElements = [
        '[data-testid="search-input"]',
        '[data-testid="search-button"]',
        '.btn',
        'a',
        '[tabindex="0"]'
      ];

      for (const selector of interactiveElements) {
        const elements = await context.page.$$(selector);

        for (const element of elements) {
          await element.focus();

          // Check that focus indicator is visible
          const styles = await element.evaluate(el => {
            const computed = window.getComputedStyle(el);
            return {
              outline: computed.outline,
              outlineWidth: computed.outlineWidth,
              outlineStyle: computed.outlineStyle,
              outlineColor: computed.outlineColor,
              boxShadow: computed.boxShadow
            };
          });

          // Should have visible focus indicator
          const hasFocusIndicator =
            styles.outline !== 'none' ||
            styles.outlineWidth !== '0px' ||
            styles.boxShadow !== 'none';

          expect(hasFocusIndicator).toBe(true);
        }
      }
    });
  });

  test.describe('Screen Reader Support', () => {
    test('should announce search results to screen readers', async () => {
      // Perform search
      await context.page.fill('[data-testid="search-input"]', 'S0C7 abend');
      await context.page.press('[data-testid="search-input"]', 'Enter');

      // Wait for results
      await context.page.waitForSelector('.search-results');

      // Check for aria-live region
      const liveRegion = await context.page.$('[aria-live]');
      expect(liveRegion).toBeTruthy();

      // Verify results are announced
      const liveRegionText = await liveRegion?.textContent();
      expect(liveRegionText).toContain('result');
    });

    test('should have proper ARIA labels for interactive elements', async () => {
      const interactiveElements = await context.page.$$('button, input, select, a[href]');

      for (const element of interactiveElements) {
        const tagName = await element.evaluate(el => el.tagName.toLowerCase());
        const ariaLabel = await element.getAttribute('aria-label');
        const ariaLabelledby = await element.getAttribute('aria-labelledby');
        const ariaDescribedby = await element.getAttribute('aria-describedby');
        const textContent = await element.textContent();

        // Element should have accessible name
        const hasAccessibleName =
          ariaLabel ||
          ariaLabelledby ||
          (textContent && textContent.trim().length > 0) ||
          (tagName === 'input' && await element.getAttribute('placeholder'));

        expect(hasAccessibleName).toBe(true);
      }
    });

    test('should properly structure search results for screen readers', async () => {
      // Perform search to get results
      await context.page.fill('[data-testid="search-input"]', 'error');
      await context.page.press('[data-testid="search-input"]', 'Enter');
      await context.page.waitForSelector('.search-results');

      // Check result structure
      const results = await context.page.$$('.search-result-item');

      for (const result of results) {
        // Each result should be properly structured
        const heading = await result.$('h3, h4, h5, h6');
        expect(heading).toBeTruthy();

        // Should have article or listitem role
        const role = await result.getAttribute('role');
        expect(['article', 'listitem'].includes(role || '')).toBe(true);
      }
    });

    test('should support screen reader navigation shortcuts', async () => {
      // Fill search and get results
      await context.page.fill('[data-testid="search-input"]', 'VSAM');
      await context.page.press('[data-testid="search-input"]', 'Enter');
      await context.page.waitForSelector('.search-results');

      // Check for heading navigation structure
      const headings = await context.page.$$('h1, h2, h3, h4, h5, h6');
      expect(headings.length).toBeGreaterThan(1);

      // Check for proper landmark structure
      const landmarks = await context.page.$$('[role="main"], [role="search"], [role="navigation"], [role="region"]');
      expect(landmarks.length).toBeGreaterThan(2);

      // Check for list structure in results
      const lists = await context.page.$$('ul, ol, [role="list"]');
      expect(lists.length).toBeGreaterThan(0);
    });
  });

  test.describe('Mobile Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      // Simulate mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
    });

    test('should have appropriate touch targets', async () => {
      const touchTargets = await context.page.$$('button, a, input, [role="button"]');

      for (const target of touchTargets) {
        const boundingBox = await target.boundingBox();

        if (boundingBox) {
          // WCAG AA requires minimum 44x44px touch targets
          expect(boundingBox.width).toBeGreaterThanOrEqual(44);
          expect(boundingBox.height).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('should be readable without zooming', async () => {
      // Check font sizes
      const textElements = await context.page.$$('p, span, div, h1, h2, h3, h4, h5, h6, label');

      for (const element of textElements) {
        const fontSize = await element.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return parseFloat(styles.fontSize);
        });

        // Text should be at least 16px on mobile
        if (fontSize > 0) {
          expect(fontSize).toBeGreaterThanOrEqual(16);
        }
      }
    });

    test('should not require horizontal scrolling', async () => {
      const body = await context.page.$('body');
      const scrollWidth = await body?.evaluate(el => el.scrollWidth);
      const clientWidth = await body?.evaluate(el => el.clientWidth);

      expect(scrollWidth).toBeLessThanOrEqual(clientWidth || 0);
    });
  });

  test.describe('High Contrast Mode', () => {
    test.beforeEach(async ({ page }) => {
      // Simulate high contrast mode
      await page.emulateMedia({ media: 'screen', colorScheme: 'dark', forcedColors: 'active' });
    });

    test('should maintain functionality in high contrast mode', async () => {
      // All interactive elements should remain visible
      const interactiveElements = await context.page.$$('button, input, a, [role="button"]');

      for (const element of interactiveElements) {
        await expect(element).toBeVisible();

        // Element should have some form of distinguishable border or background
        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            backgroundColor: computed.backgroundColor,
            borderWidth: computed.borderWidth,
            borderStyle: computed.borderStyle,
            outline: computed.outline
          };
        });

        const hasDistinguishableStyle =
          styles.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
          (styles.borderWidth !== '0px' && styles.borderStyle !== 'none') ||
          styles.outline !== 'none';

        expect(hasDistinguishableStyle).toBe(true);
      }
    });

    test('should maintain readable text contrast', async () => {
      const textElements = await context.page.$$('p, span, h1, h2, h3, h4, h5, h6, label');

      for (const element of textElements) {
        // Text should be visible
        await expect(element).toBeVisible();

        // Should have contrasting color
        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor
          };
        });

        // In forced colors mode, text should use system colors
        expect(styles.color).not.toBe('rgba(0, 0, 0, 0)');
      }
    });
  });

  test.describe('Motion and Animation', () => {
    test('should respect prefers-reduced-motion', async () => {
      // Simulate reduced motion preference
      await context.page.emulateMedia({ media: 'screen', reducedMotion: 'reduce' });

      // Check that animations are disabled or reduced
      const animatedElements = await context.page.$$('[class*="animate"], [class*="transition"]');

      for (const element of animatedElements) {
        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            animationDuration: computed.animationDuration,
            transitionDuration: computed.transitionDuration
          };
        });

        // Animations should be disabled or very short
        if (styles.animationDuration !== 'none') {
          const duration = parseFloat(styles.animationDuration);
          expect(duration).toBeLessThanOrEqual(0.01); // 10ms or less
        }

        if (styles.transitionDuration !== 'none') {
          const duration = parseFloat(styles.transitionDuration);
          expect(duration).toBeLessThanOrEqual(0.01); // 10ms or less
        }
      }
    });
  });

  test.describe('Form Accessibility', () => {
    test('should provide clear error messages', async () => {
      // Test search form validation
      const searchInput = context.page.locator('[data-testid="search-input"]');

      // Try to trigger validation (if any)
      await searchInput.fill('');
      await context.page.press('[data-testid="search-input"]', 'Enter');

      // Check for error messages
      const errorElements = await context.page.$$('[role="alert"], .error, [aria-invalid="true"]');

      for (const error of errorElements) {
        // Error should be visible and have meaningful text
        await expect(error).toBeVisible();
        const errorText = await error.textContent();
        expect(errorText?.trim().length).toBeGreaterThan(0);
      }
    });

    test('should associate error messages with form controls', async () => {
      const inputs = await context.page.$$('input');

      for (const input of inputs) {
        const ariaDescribedby = await input.getAttribute('aria-describedby');
        const ariaInvalid = await input.getAttribute('aria-invalid');

        if (ariaInvalid === 'true' && ariaDescribedby) {
          // Described-by element should exist and be visible
          const describingElement = await context.page.$(`#${ariaDescribedby}`);
          expect(describingElement).toBeTruthy();
          await expect(describingElement!).toBeVisible();
        }
      }
    });
  });

  test.afterEach(async () => {
    // Generate accessibility report if violations found
    const violations = await new AxeBuilder({ page: context.page }).analyze();

    if (violations.violations.length > 0) {
      console.log('\n--- Accessibility Report ---');
      console.log(`Found ${violations.violations.length} violations:`);

      violations.violations.forEach((violation, index) => {
        console.log(`\n${index + 1}. ${violation.id} (${violation.impact})`);
        console.log(`   Description: ${violation.description}`);
        console.log(`   Help: ${violation.help}`);
        console.log(`   Help URL: ${violation.helpUrl}`);
        console.log(`   Affected elements: ${violation.nodes.length}`);
      });
    }
  });
});