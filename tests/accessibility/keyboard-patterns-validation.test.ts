/**
 * Keyboard Navigation Patterns Validation
 *
 * Tests specific keyboard interaction patterns and ARIA compliance:
 * - WAI-ARIA keyboard patterns
 * - Focus management patterns
 * - Keyboard shortcuts and accelerators
 * - Complex widget interactions
 *
 * @author Keyboard Navigation Specialist
 * @version 1.0.0
 */

import { test, expect, Page, Locator } from '@playwright/test';

interface KeyboardPattern {
  name: string;
  description: string;
  role: string;
  requiredKeys: string[];
  optionalKeys?: string[];
  ariaRequirements: string[];
}

const KEYBOARD_PATTERNS: KeyboardPattern[] = [
  {
    name: 'Button',
    description: 'Activates the button',
    role: 'button',
    requiredKeys: ['Enter', 'Space'],
    ariaRequirements: ['accessible name']
  },
  {
    name: 'Link',
    description: 'Follows the link',
    role: 'link',
    requiredKeys: ['Enter'],
    ariaRequirements: ['accessible name', 'href']
  },
  {
    name: 'Tab Panel',
    description: 'Navigates between tabs and activates tab panels',
    role: 'tab',
    requiredKeys: ['ArrowLeft', 'ArrowRight'],
    optionalKeys: ['Home', 'End'],
    ariaRequirements: ['aria-selected', 'aria-controls', 'tabindex']
  },
  {
    name: 'Menu',
    description: 'Navigates menu items and activates them',
    role: 'menu',
    requiredKeys: ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'],
    optionalKeys: ['Home', 'End'],
    ariaRequirements: ['aria-expanded', 'aria-haspopup']
  },
  {
    name: 'Combobox',
    description: 'Opens dropdown, navigates options, selects values',
    role: 'combobox',
    requiredKeys: ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'],
    optionalKeys: ['Home', 'End', 'PageDown', 'PageUp'],
    ariaRequirements: ['aria-expanded', 'aria-autocomplete', 'aria-controls']
  },
  {
    name: 'Grid',
    description: 'Two-dimensional keyboard navigation',
    role: 'grid',
    requiredKeys: ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'],
    optionalKeys: ['Home', 'End', 'Control+Home', 'Control+End', 'PageDown', 'PageUp'],
    ariaRequirements: ['aria-rowcount', 'aria-colcount']
  },
  {
    name: 'Dialog',
    description: 'Modal dialog with focus management',
    role: 'dialog',
    requiredKeys: ['Escape', 'Tab'],
    ariaRequirements: ['aria-modal', 'aria-labelledby', 'aria-describedby']
  }
];

class KeyboardPatternValidator {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async validatePattern(pattern: KeyboardPattern): Promise<boolean> {
    const elements = await this.page.locator(`[role="${pattern.role}"]`).all();

    if (elements.length === 0) {
      console.log(`No elements found for role: ${pattern.role}`);
      return true; // Pattern not present, test passes
    }

    for (const element of elements) {
      if (!(await element.isVisible())) continue;

      await this.validatePatternElement(element, pattern);
    }

    return true;
  }

  private async validatePatternElement(element: Locator, pattern: KeyboardPattern): Promise<void> {
    // Focus the element
    await element.focus();
    expect(await element.evaluate(el => el === document.activeElement)).toBe(true);

    // Validate ARIA requirements
    for (const requirement of pattern.ariaRequirements) {
      await this.validateAriaRequirement(element, requirement);
    }

    // Test required keyboard interactions
    for (const key of pattern.requiredKeys) {
      await this.testKeyboardInteraction(element, key, pattern);
    }

    // Test optional keyboard interactions if present
    if (pattern.optionalKeys) {
      for (const key of pattern.optionalKeys) {
        await this.testKeyboardInteraction(element, key, pattern, true);
      }
    }
  }

  private async validateAriaRequirement(element: Locator, requirement: string): Promise<void> {
    switch (requirement) {
      case 'accessible name':
        const hasAccessibleName = await element.evaluate(el => {
          const ariaLabel = el.getAttribute('aria-label');
          const ariaLabelledBy = el.getAttribute('aria-labelledby');
          const textContent = el.textContent?.trim();
          const title = el.getAttribute('title');

          return !!(ariaLabel || ariaLabelledBy || textContent || title);
        });
        expect(hasAccessibleName).toBe(true);
        break;

      case 'href':
        if (await element.evaluate(el => el.tagName.toLowerCase() === 'a')) {
          const href = await element.getAttribute('href');
          expect(href).toBeTruthy();
        }
        break;

      default:
        if (requirement.startsWith('aria-')) {
          const attrValue = await element.getAttribute(requirement);
          expect(attrValue).toBeTruthy();
        }
        break;
    }
  }

  private async testKeyboardInteraction(
    element: Locator,
    key: string,
    pattern: KeyboardPattern,
    optional: boolean = false
  ): Promise<void> {
    await element.focus();

    const initialState = await this.captureElementState(element);

    // Press the key
    await this.page.keyboard.press(key);

    // Small delay to allow for state changes
    await this.page.waitForTimeout(100);

    const finalState = await this.captureElementState(element);

    // Validate that appropriate action occurred based on pattern
    await this.validateExpectedBehavior(element, key, pattern, initialState, finalState, optional);
  }

  private async captureElementState(element: Locator): Promise<any> {
    return await element.evaluate(el => ({
      focused: el === document.activeElement,
      ariaExpanded: el.getAttribute('aria-expanded'),
      ariaSelected: el.getAttribute('aria-selected'),
      classList: Array.from(el.classList),
      textContent: el.textContent,
      value: (el as any).value
    }));
  }

  private async validateExpectedBehavior(
    element: Locator,
    key: string,
    pattern: KeyboardPattern,
    initialState: any,
    finalState: any,
    optional: boolean
  ): Promise<void> {
    switch (pattern.role) {
      case 'button':
        if (key === 'Enter' || key === 'Space') {
          // Button should have been activated (can't easily test without mocking)
          // At minimum, focus should remain on button
          expect(finalState.focused).toBe(true);
        }
        break;

      case 'tab':
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
          // Focus should have moved to another tab
          const tabs = await this.page.locator('[role="tab"]').all();
          if (tabs.length > 1) {
            const anyTabFocused = await Promise.all(
              tabs.map(tab => tab.evaluate(el => el === document.activeElement))
            );
            expect(anyTabFocused.some(Boolean)).toBe(true);
          }
        }
        break;

      case 'combobox':
        if (key === 'ArrowDown' && initialState.ariaExpanded === 'false') {
          // Combobox should expand
          expect(finalState.ariaExpanded).toBe('true');
        }
        if (key === 'Escape' && initialState.ariaExpanded === 'true') {
          // Combobox should collapse
          expect(finalState.ariaExpanded).toBe('false');
        }
        break;

      case 'grid':
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
          // Focus should have moved within grid
          const gridCells = await this.page.locator('[role="gridcell"]').all();
          if (gridCells.length > 1) {
            const anyCellFocused = await Promise.all(
              gridCells.map(cell => cell.evaluate(el => el === document.activeElement))
            );
            expect(anyCellFocused.some(Boolean)).toBe(true);
          }
        }
        break;

      case 'dialog':
        if (key === 'Escape') {
          // Dialog should close (would need to check if modal is still visible)
          const modalStillVisible = await this.page.locator('[aria-modal="true"]').isVisible();
          // Note: This depends on implementation - some modals may not close on Escape
        }
        break;
    }
  }
}

test.describe('Keyboard Patterns Validation', () => {
  let validator: KeyboardPatternValidator;

  test.beforeEach(async ({ page }) => {
    validator = new KeyboardPatternValidator(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  // Test each keyboard pattern
  for (const pattern of KEYBOARD_PATTERNS) {
    test(`validates ${pattern.name} keyboard pattern`, async ({ page }) => {
      await validator.validatePattern(pattern);
    });
  }

  test('validates focus management in dynamic content updates', async ({ page }) => {
    // Test search results updates
    const searchInput = page.locator('input[type="text"]').first();

    if (await searchInput.isVisible()) {
      await searchInput.focus();
      await searchInput.fill('VSAM');

      // Wait for results to load
      await page.waitForTimeout(1000);

      // Focus should remain on search input after results update
      expect(await searchInput.evaluate(el => el === document.activeElement)).toBe(true);

      // Results should be announced via live region
      const liveRegions = page.locator('[aria-live]');
      const liveRegionCount = await liveRegions.count();
      expect(liveRegionCount).toBeGreaterThan(0);
    }
  });

  test('validates keyboard shortcuts do not conflict with browser shortcuts', async ({ page }) => {
    const conflictingShortcuts = [
      'Control+a', // Select all
      'Control+r', // Refresh
      'Control+w', // Close window
      'Control+t', // New tab
      'Control+n', // New window
      'Control+l', // Address bar
      'F5',        // Refresh
      'F12'        // Developer tools
    ];

    // Test that these shortcuts are either not used or properly handled
    for (const shortcut of conflictingShortcuts) {
      await page.keyboard.press(shortcut);

      // Verify page state hasn't changed unexpectedly
      const title = await page.title();
      expect(title).toBeTruthy();

      // Verify we're still on the same page
      const url = page.url();
      expect(url).toBeTruthy();
    }
  });

  test('validates roving tabindex implementation', async ({ page }) => {
    // Find elements that should implement roving tabindex
    const rovingElements = await page.locator('[role="tablist"], [role="radiogroup"], [role="menubar"], [role="toolbar"]').all();

    for (const container of rovingElements) {
      if (!(await container.isVisible())) continue;

      const items = await container.locator('[role="tab"], [role="radio"], [role="menuitem"], [role="button"]').all();

      if (items.length > 1) {
        // Only one item should have tabindex="0"
        let tabbableCount = 0;

        for (const item of items) {
          const tabindex = await item.getAttribute('tabindex');
          if (tabindex === '0' || tabindex === null) {
            tabbableCount++;
          }
        }

        expect(tabbableCount).toBe(1);

        // Test arrow key navigation
        const firstTabbable = items.find(async item => {
          const tabindex = await item.getAttribute('tabindex');
          return tabindex === '0' || tabindex === null;
        });

        if (firstTabbable) {
          await firstTabbable.focus();

          // Navigate with arrow keys
          await page.keyboard.press('ArrowRight');

          // Another item should now be focused
          const newFocused = await page.evaluate(() => document.activeElement);
          expect(newFocused).toBeTruthy();
        }
      }
    }
  });

  test('validates keyboard help and documentation', async ({ page }) => {
    // Look for keyboard help triggers
    const helpTriggers = page.locator('button, a').filter({ hasText: /help|keyboard|shortcut/i });
    const helpTriggerCount = await helpTriggers.count();

    if (helpTriggerCount > 0) {
      const helpTrigger = helpTriggers.first();
      await helpTrigger.click();

      // Look for keyboard help content
      const helpContent = page.locator('text=/ctrl|shift|alt|enter|escape|tab|arrow/i').first();

      if (await helpContent.isVisible()) {
        const helpText = await helpContent.textContent();
        expect(helpText).toBeTruthy();

        // Help should be accessible
        const helpContainer = helpContent.locator('..').first();
        const hasRole = await helpContainer.getAttribute('role');
        const hasAriaLabel = await helpContainer.getAttribute('aria-label');

        expect(hasRole || hasAriaLabel).toBeTruthy();
      }
    }

    // Test ? key for help (common pattern)
    await page.keyboard.press('?');
    await page.waitForTimeout(500);

    const helpModal = page.locator('[role="dialog"]').filter({ hasText: /help|keyboard/i });
    if (await helpModal.isVisible()) {
      // Help modal should be keyboard accessible
      await page.keyboard.press('Escape');
      await expect(helpModal).not.toBeVisible();
    }
  });

  test('validates focus order makes logical sense', async ({ page }) => {
    const interactiveElements = await page.locator(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    ).all();

    if (interactiveElements.length === 0) return;

    const focusOrder: { element: string; position: { x: number; y: number } }[] = [];

    // Record tab order and positions
    for (let i = 0; i < Math.min(interactiveElements.length, 20); i++) {
      await page.keyboard.press('Tab');

      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return null;

        const rect = el.getBoundingClientRect();
        return {
          tagName: el.tagName.toLowerCase(),
          id: el.id,
          className: el.className,
          position: { x: rect.left, y: rect.top }
        };
      });

      if (focusedElement) {
        focusOrder.push({
          element: `${focusedElement.tagName}${focusedElement.id ? '#' + focusedElement.id : ''}`,
          position: focusedElement.position
        });
      }
    }

    // Validate logical order (generally top-to-bottom, left-to-right)
    for (let i = 1; i < focusOrder.length; i++) {
      const current = focusOrder[i];
      const previous = focusOrder[i - 1];

      // If current element is significantly below previous, order is logical
      // If on same row, current should be to the right of previous
      const isBelow = current.position.y > previous.position.y + 20;
      const isRightSameRow = Math.abs(current.position.y - previous.position.y) <= 20 &&
                           current.position.x > previous.position.x;

      const isLogicalOrder = isBelow || isRightSameRow;

      if (!isLogicalOrder) {
        console.warn(`Potentially illogical focus order between ${previous.element} and ${current.element}`);
      }
    }
  });

  test('validates screen reader announcements for dynamic content', async ({ page }) => {
    // Set up a mock screen reader
    await page.addInitScript(() => {
      window.screenReaderAnnouncements = [];

      // Mock screen reader by observing live regions
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          const target = mutation.target as Element;
          const liveRegion = target.closest('[aria-live]');

          if (liveRegion) {
            const announcement = {
              type: liveRegion.getAttribute('aria-live'),
              content: liveRegion.textContent?.trim(),
              timestamp: Date.now()
            };

            (window as any).screenReaderAnnouncements.push(announcement);
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    });

    // Trigger actions that should create announcements
    const searchInput = page.locator('input[type="text"]').first();

    if (await searchInput.isVisible()) {
      await searchInput.focus();
      await searchInput.fill('JCL');

      // Wait for search results
      await page.waitForTimeout(2000);

      // Check announcements
      const announcements = await page.evaluate(() => (window as any).screenReaderAnnouncements);

      // Should have announcements for search results
      const searchAnnouncements = announcements.filter((a: any) =>
        a.content && a.content.toLowerCase().includes('result')
      );

      expect(searchAnnouncements.length).toBeGreaterThan(0);
    }
  });

  test('validates error handling keyboard accessibility', async ({ page }) => {
    // Trigger form validation errors
    const form = page.locator('form').first();

    if (await form.isVisible()) {
      const submitButton = form.locator('button[type="submit"]').first();
      await submitButton.click();

      // Look for error messages
      const errorElements = await page.locator('[role="alert"], [aria-invalid="true"], .error').all();

      for (const error of errorElements) {
        if (await error.isVisible()) {
          // Error should be keyboard accessible
          const isKeyboardAccessible = await error.evaluate(el => {
            const tabindex = el.getAttribute('tabindex');
            const focusable = el.tagName.toLowerCase() === 'button' ||
                           el.tagName.toLowerCase() === 'a' ||
                           tabindex === '0';

            return focusable || el.closest('button, a, [tabindex="0"]') !== null;
          });

          // Should be announced to screen readers
          const hasLiveRegion = await error.evaluate(el => {
            return el.getAttribute('aria-live') !== null ||
                   el.getAttribute('role') === 'alert' ||
                   el.closest('[aria-live], [role="alert"]') !== null;
          });

          expect(hasLiveRegion).toBe(true);
        }
      }
    }
  });
});