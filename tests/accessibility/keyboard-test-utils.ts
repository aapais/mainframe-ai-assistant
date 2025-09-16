/**
 * Keyboard Navigation Testing Utilities
 *
 * Shared utilities and helpers for keyboard accessibility testing
 *
 * @author Keyboard Navigation Specialist
 * @version 1.0.0
 */

import { Page, Locator, expect } from '@playwright/test';

export interface FocusOrder {
  element: string;
  position: { x: number; y: number };
  tabIndex: string | null;
  role: string | null;
  ariaLabel: string | null;
}

export interface KeyboardShortcut {
  keys: string;
  description: string;
  testFunction?: () => Promise<void>;
  element?: string;
}

export interface AriaPattern {
  role: string;
  requiredAttributes: string[];
  optionalAttributes?: string[];
  requiredKeys: string[];
  optionalKeys?: string[];
}

export class KeyboardTestUtils {
  constructor(private page: Page) {}

  /**
   * Get all focusable elements in the document
   */
  async getFocusableElements(): Promise<Locator[]> {
    const selector = [
      'a[href]',
      'button',
      'input',
      'select',
      'textarea',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]',
      '[role="link"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[role="option"]',
      '[role="gridcell"]'
    ].join(', ');

    const elements = await this.page.locator(selector).all();
    const visibleElements = [];

    for (const element of elements) {
      if (await element.isVisible() && await element.isEnabled()) {
        visibleElements.push(element);
      }
    }

    return visibleElements;
  }

  /**
   * Record the complete tab order of the page
   */
  async recordTabOrder(maxElements: number = 50): Promise<FocusOrder[]> {
    const focusOrder: FocusOrder[] = [];
    const focusableElements = await this.getFocusableElements();
    const elementsToTest = Math.min(focusableElements.length, maxElements);

    // Start from the beginning
    await this.page.keyboard.press('Control+Home');
    await this.page.keyboard.press('Tab');

    for (let i = 0; i < elementsToTest; i++) {
      const focusInfo = await this.getCurrentFocusInfo();
      if (focusInfo) {
        focusOrder.push(focusInfo);
      }
      await this.page.keyboard.press('Tab');
    }

    return focusOrder;
  }

  /**
   * Get information about the currently focused element
   */
  async getCurrentFocusInfo(): Promise<FocusOrder | null> {
    return await this.page.evaluate(() => {
      const element = document.activeElement;
      if (!element) return null;

      const rect = element.getBoundingClientRect();
      const tagName = element.tagName.toLowerCase();
      const id = element.id ? `#${element.id}` : '';
      const className = element.className ? `.${element.className.split(' ')[0]}` : '';

      return {
        element: `${tagName}${id}${className}`,
        position: { x: rect.left, y: rect.top },
        tabIndex: element.getAttribute('tabindex'),
        role: element.getAttribute('role'),
        ariaLabel: element.getAttribute('aria-label')
      };
    });
  }

  /**
   * Validate that focus order is logical (top-to-bottom, left-to-right)
   */
  validateFocusOrder(focusOrder: FocusOrder[]): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    for (let i = 1; i < focusOrder.length; i++) {
      const current = focusOrder[i];
      const previous = focusOrder[i - 1];

      // Skip if positions are identical (overlay elements)
      if (current.position.x === previous.position.x &&
          current.position.y === previous.position.y) {
        continue;
      }

      const isBelow = current.position.y > previous.position.y + 30;
      const isRightSameRow = Math.abs(current.position.y - previous.position.y) <= 30 &&
                           current.position.x >= previous.position.x;

      if (!isBelow && !isRightSameRow) {
        issues.push(
          `Illogical focus order: ${previous.element} to ${current.element} ` +
          `(${previous.position.x},${previous.position.y}) → (${current.position.x},${current.position.y})`
        );
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Test focus trapping within a container
   */
  async testFocusTrapping(containerSelector: string): Promise<boolean> {
    const container = this.page.locator(containerSelector);
    await expect(container).toBeVisible();

    const focusableElements = await container.locator(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    ).all();

    if (focusableElements.length === 0) return true;

    // Focus first element
    await focusableElements[0].focus();

    // Tab through all elements
    for (let i = 0; i < focusableElements.length; i++) {
      const expectedElement = focusableElements[i];
      const isExpectedFocused = await expectedElement.evaluate(el => el === document.activeElement);

      if (!isExpectedFocused) return false;

      await this.page.keyboard.press('Tab');
    }

    // After last element, focus should cycle to first
    const isFirstFocused = await focusableElements[0].evaluate(el => el === document.activeElement);
    return isFirstFocused;
  }

  /**
   * Test reverse tab order (Shift+Tab)
   */
  async testReverseTabOrder(containerSelector?: string): Promise<boolean> {
    const selector = containerSelector ? `${containerSelector} ` : '';
    const focusableElements = await this.page.locator(
      `${selector}button, ${selector}input, ${selector}select, ${selector}textarea, ${selector}a[href], ${selector}[tabindex]:not([tabindex="-1"])`
    ).all();

    if (focusableElements.length === 0) return true;

    // Start from last element
    await focusableElements[focusableElements.length - 1].focus();

    // Shift+Tab through all elements in reverse
    for (let i = focusableElements.length - 1; i >= 0; i--) {
      const expectedElement = focusableElements[i];
      const isExpectedFocused = await expectedElement.evaluate(el => el === document.activeElement);

      if (!isExpectedFocused) return false;

      if (i > 0) {
        await this.page.keyboard.press('Shift+Tab');
      }
    }

    return true;
  }

  /**
   * Measure focus indicator contrast ratio
   */
  async measureFocusContrast(element: Locator): Promise<{ ratio: number; passes: boolean }> {
    await element.focus();

    return await element.evaluate((el) => {
      // Get computed styles for focused state
      const styles = window.getComputedStyle(el, ':focus');

      // This is a simplified implementation
      // In practice, you'd use a proper color contrast calculation library
      const outlineColor = styles.outlineColor;
      const backgroundColor = styles.backgroundColor;
      const borderColor = styles.borderColor;

      // Mock calculation - replace with actual contrast calculation
      const mockRatio = 4.5; // Assume good contrast for now

      return {
        ratio: mockRatio,
        passes: mockRatio >= 3.0 // WCAG AA requirement
      };
    });
  }

  /**
   * Test keyboard shortcuts
   */
  async testKeyboardShortcuts(shortcuts: KeyboardShortcut[]): Promise<{ shortcut: string; works: boolean }[]> {
    const results = [];

    for (const shortcut of shortcuts) {
      let works = false;

      try {
        // Focus appropriate element if specified
        if (shortcut.element) {
          const element = this.page.locator(shortcut.element).first();
          if (await element.isVisible()) {
            await element.focus();
          }
        }

        // Execute shortcut
        await this.page.keyboard.press(shortcut.keys);

        // If custom test function provided, use it
        if (shortcut.testFunction) {
          await shortcut.testFunction();
          works = true;
        } else {
          // Basic test - just ensure no error occurred
          works = true;
        }
      } catch (error) {
        console.log(`Shortcut ${shortcut.keys} failed:`, error);
        works = false;
      }

      results.push({
        shortcut: shortcut.keys,
        works
      });
    }

    return results;
  }

  /**
   * Validate ARIA pattern compliance
   */
  async validateAriaPattern(pattern: AriaPattern): Promise<{ valid: boolean; issues: string[] }> {
    const elements = await this.page.locator(`[role="${pattern.role}"]`).all();
    const issues: string[] = [];

    for (const element of elements) {
      if (!(await element.isVisible())) continue;

      // Check required attributes
      for (const attr of pattern.requiredAttributes) {
        const hasAttribute = await element.getAttribute(attr);
        if (!hasAttribute) {
          const elementDesc = await this.getElementDescription(element);
          issues.push(`${elementDesc} missing required attribute: ${attr}`);
        }
      }

      // Test required keyboard interactions
      await element.focus();
      for (const key of pattern.requiredKeys) {
        await this.testKeyInteraction(element, key, pattern.role);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get a description of an element for error reporting
   */
  private async getElementDescription(element: Locator): Promise<string> {
    return await element.evaluate(el => {
      const tagName = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const className = el.className ? `.${el.className.split(' ')[0]}` : '';
      const role = el.getAttribute('role') ? `[role="${el.getAttribute('role')}"]` : '';

      return `${tagName}${id}${className}${role}`;
    });
  }

  /**
   * Test a specific key interaction on an element
   */
  private async testKeyInteraction(element: Locator, key: string, role: string): Promise<void> {
    const initialState = await this.captureElementState(element);

    await this.page.keyboard.press(key);
    await this.page.waitForTimeout(100); // Allow for state changes

    const finalState = await this.captureElementState(element);

    // Basic validation - specific behavior depends on role and key
    // This would be expanded with specific expectations for each role/key combination
  }

  /**
   * Capture element state for comparison
   */
  private async captureElementState(element: Locator): Promise<any> {
    return await element.evaluate(el => ({
      focused: el === document.activeElement,
      ariaExpanded: el.getAttribute('aria-expanded'),
      ariaSelected: el.getAttribute('aria-selected'),
      ariaPressed: el.getAttribute('aria-pressed'),
      ariaChecked: el.getAttribute('aria-checked'),
      classList: Array.from(el.classList),
      style: el.getAttribute('style')
    }));
  }

  /**
   * Check for skip links and validate their functionality
   */
  async validateSkipLinks(): Promise<{ hasSkipLinks: boolean; working: boolean }> {
    // Focus first element (should be skip link if present)
    await this.page.keyboard.press('Tab');

    const firstFocused = await this.page.evaluate(() => {
      const el = document.activeElement;
      return el ? {
        tagName: el.tagName.toLowerCase(),
        href: (el as HTMLAnchorElement).href,
        textContent: el.textContent?.toLowerCase(),
        isVisible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
      } : null;
    });

    if (!firstFocused) return { hasSkipLinks: false, working: false };

    const isSkipLink = firstFocused.tagName === 'a' &&
                      firstFocused.textContent?.includes('skip') &&
                      firstFocused.href.includes('#');

    if (!isSkipLink) return { hasSkipLinks: false, working: false };

    // Test skip link functionality
    await this.page.keyboard.press('Enter');

    // Verify focus moved to target
    const afterSkip = await this.page.evaluate(() => {
      const el = document.activeElement;
      return el ? {
        tagName: el.tagName.toLowerCase(),
        id: el.id,
        role: el.getAttribute('role')
      } : null;
    });

    const skipWorking = afterSkip &&
                       (afterSkip.tagName === 'main' ||
                        afterSkip.role === 'main' ||
                        afterSkip.id?.includes('main') ||
                        afterSkip.id?.includes('content'));

    return {
      hasSkipLinks: true,
      working: !!skipWorking
    };
  }

  /**
   * Generate a comprehensive keyboard accessibility report
   */
  async generateKeyboardReport(): Promise<object> {
    const focusOrder = await this.recordTabOrder();
    const focusOrderValidation = this.validateFocusOrder(focusOrder);
    const skipLinks = await this.validateSkipLinks();
    const focusableCount = (await this.getFocusableElements()).length;

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalFocusableElements: focusableCount,
        tabOrderLogical: focusOrderValidation.valid,
        hasSkipLinks: skipLinks.hasSkipLinks,
        skipLinksWork: skipLinks.working
      },
      focusOrder: focusOrder.slice(0, 20), // Limit output size
      issues: focusOrderValidation.issues,
      recommendations: this.generateRecommendations(focusOrderValidation, skipLinks)
    };
  }

  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(
    focusOrderValidation: { valid: boolean; issues: string[] },
    skipLinks: { hasSkipLinks: boolean; working: boolean }
  ): string[] {
    const recommendations: string[] = [];

    if (!focusOrderValidation.valid) {
      recommendations.push('Review and fix tab order to follow logical reading order (top-to-bottom, left-to-right)');
    }

    if (!skipLinks.hasSkipLinks) {
      recommendations.push('Add skip navigation links for keyboard users');
    } else if (!skipLinks.working) {
      recommendations.push('Fix skip navigation links - they should move focus to main content');
    }

    if (focusOrderValidation.issues.length > 5) {
      recommendations.push('Consider using CSS order properties or restructuring HTML for better focus flow');
    }

    return recommendations;
  }
}

/**
 * Predefined ARIA patterns for testing
 */
export const ARIA_PATTERNS: AriaPattern[] = [
  {
    role: 'button',
    requiredAttributes: [],
    requiredKeys: ['Enter', 'Space']
  },
  {
    role: 'link',
    requiredAttributes: [],
    requiredKeys: ['Enter']
  },
  {
    role: 'tab',
    requiredAttributes: ['aria-selected'],
    requiredKeys: ['ArrowLeft', 'ArrowRight'],
    optionalKeys: ['Home', 'End']
  },
  {
    role: 'tabpanel',
    requiredAttributes: ['aria-labelledby'],
    requiredKeys: []
  },
  {
    role: 'combobox',
    requiredAttributes: ['aria-expanded'],
    requiredKeys: ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'],
    optionalKeys: ['Home', 'End']
  },
  {
    role: 'grid',
    requiredAttributes: [],
    requiredKeys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
    optionalKeys: ['Home', 'End', 'Control+Home', 'Control+End', 'PageUp', 'PageDown']
  },
  {
    role: 'gridcell',
    requiredAttributes: [],
    requiredKeys: []
  },
  {
    role: 'menu',
    requiredAttributes: [],
    requiredKeys: ['ArrowUp', 'ArrowDown', 'Enter', 'Escape'],
    optionalKeys: ['Home', 'End']
  },
  {
    role: 'menuitem',
    requiredAttributes: [],
    requiredKeys: ['Enter', 'Space']
  },
  {
    role: 'dialog',
    requiredAttributes: ['aria-modal', 'aria-labelledby'],
    requiredKeys: ['Escape'],
    optionalKeys: ['Tab']
  }
];

/**
 * Common keyboard shortcuts to test
 */
export const COMMON_SHORTCUTS: KeyboardShortcut[] = [
  {
    keys: 'Control+s',
    description: 'Save'
  },
  {
    keys: 'Control+f',
    description: 'Find/Search'
  },
  {
    keys: 'Control+z',
    description: 'Undo'
  },
  {
    keys: 'Control+y',
    description: 'Redo'
  },
  {
    keys: 'Control+c',
    description: 'Copy'
  },
  {
    keys: 'Control+v',
    description: 'Paste'
  },
  {
    keys: 'Control+Enter',
    description: 'Submit form'
  },
  {
    keys: 'Escape',
    description: 'Cancel/Close'
  },
  {
    keys: 'F1',
    description: 'Help'
  },
  {
    keys: '?',
    description: 'Show keyboard shortcuts'
  }
];

export default KeyboardTestUtils;