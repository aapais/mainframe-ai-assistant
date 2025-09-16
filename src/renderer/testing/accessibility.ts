/**
 * Comprehensive Accessibility Testing Framework
 * Provides utilities for WCAG 2.1 AA compliance testing
 */

import { axe, toHaveNoViolations, configureAxe } from 'jest-axe';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Configure axe for WCAG 2.1 AA compliance
configureAxe({
  rules: {
    // Ensure color contrast meets AA standards
    'color-contrast': { enabled: true },
    // Require keyboard accessibility
    'keyboard': { enabled: true },
    // Ensure proper focus management
    'focus-order-semantics': { enabled: true },
    // Validate ARIA usage
    'aria-valid-attr-value': { enabled: true },
    'aria-required-attr': { enabled: true },
    // Check semantic markup
    'landmark-one-main': { enabled: true },
    'page-has-heading-one': { enabled: true },
  },
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
});

// Extend Jest matchers
expect.extend(toHaveNoViolations);

/**
 * Custom accessibility matchers for comprehensive testing
 */
export const accessibilityMatchers = {
  /**
   * Test if element is accessible according to WCAG 2.1 AA
   */
  async toBeAccessible(received: HTMLElement) {
    const results = await axe(received);

    return {
      pass: results.violations.length === 0,
      message: () => {
        if (results.violations.length === 0) {
          return `Expected element to have accessibility violations, but none were found`;
        }

        const violationMessages = results.violations.map(violation =>
          `${violation.id}: ${violation.description}\n` +
          `  - ${violation.nodes.map(node => node.target.join(' ')).join('\n  - ')}`
        ).join('\n\n');

        return `Expected element to be accessible, but found violations:\n\n${violationMessages}`;
      }
    };
  },

  /**
   * Test if element supports proper keyboard navigation
   */
  toSupportKeyboardNavigation(received: HTMLElement) {
    const focusableElements = received.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    let pass = true;
    const issues: string[] = [];

    focusableElements.forEach((element, index) => {
      const htmlElement = element as HTMLElement;

      // Check if element is keyboard accessible
      if (htmlElement.tabIndex < 0 && !htmlElement.hasAttribute('aria-hidden')) {
        pass = false;
        issues.push(`Element ${index + 1} is not keyboard accessible`);
      }

      // Check for visible focus indicator
      const computedStyle = window.getComputedStyle(htmlElement, ':focus');
      if (!computedStyle.outline && !computedStyle.boxShadow) {
        pass = false;
        issues.push(`Element ${index + 1} lacks visible focus indicator`);
      }
    });

    return {
      pass,
      message: () => pass
        ? `Expected element to have keyboard navigation issues`
        : `Keyboard navigation issues found:\n${issues.join('\n')}`
    };
  },

  /**
   * Validate ARIA attributes are properly set
   */
  toHaveValidAriaAttributes(received: HTMLElement) {
    const ariaAttributes = Array.from(received.attributes).filter(
      attr => attr.name.startsWith('aria-')
    );

    let pass = true;
    const issues: string[] = [];

    ariaAttributes.forEach(attr => {
      const value = attr.value;

      // Check for empty ARIA attributes
      if (!value.trim()) {
        pass = false;
        issues.push(`Empty ARIA attribute: ${attr.name}`);
      }

      // Validate specific ARIA attributes
      switch (attr.name) {
        case 'aria-labelledby':
        case 'aria-describedby':
          if (!document.getElementById(value)) {
            pass = false;
            issues.push(`${attr.name} references non-existent element: ${value}`);
          }
          break;
        case 'aria-expanded':
        case 'aria-checked':
        case 'aria-selected':
          if (!['true', 'false'].includes(value)) {
            pass = false;
            issues.push(`${attr.name} must be 'true' or 'false', got: ${value}`);
          }
          break;
      }
    });

    return {
      pass,
      message: () => pass
        ? `Expected element to have invalid ARIA attributes`
        : `ARIA validation issues found:\n${issues.join('\n')}`
    };
  }
};

/**
 * Test keyboard navigation through a component
 */
export async function testKeyboardNavigation(
  container: HTMLElement,
  expectedFocusOrder: string[] = []
): Promise<void> {
  const user = userEvent.setup();
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  // Test Tab navigation
  for (let i = 0; i < focusableElements.length; i++) {
    await user.tab();
    const activeElement = document.activeElement;

    if (expectedFocusOrder.length > 0) {
      const expectedSelector = expectedFocusOrder[i];
      const expectedElement = container.querySelector(expectedSelector);
      expect(activeElement).toBe(expectedElement);
    }

    // Ensure element is visible and has focus indicator
    expect(activeElement).toBeVisible();
    expect(activeElement).toHaveFocus();
  }

  // Test Shift+Tab navigation (reverse)
  for (let i = focusableElements.length - 1; i >= 0; i--) {
    await user.tab({ shift: true });
    const activeElement = document.activeElement;

    if (expectedFocusOrder.length > 0) {
      const expectedSelector = expectedFocusOrder[i];
      const expectedElement = container.querySelector(expectedSelector);
      expect(activeElement).toBe(expectedElement);
    }
  }
}

/**
 * Test screen reader announcements
 */
export async function testScreenReaderAnnouncements(
  action: () => Promise<void> | void,
  expectedAnnouncement: string,
  timeout: number = 1000
): Promise<void> {
  const liveRegion = document.querySelector('[aria-live]') as HTMLElement;

  if (!liveRegion) {
    throw new Error('No ARIA live region found. Ensure AriaLiveRegions component is rendered.');
  }

  const initialContent = liveRegion.textContent;

  await action();

  await waitFor(() => {
    expect(liveRegion.textContent).not.toBe(initialContent);
    expect(liveRegion.textContent).toContain(expectedAnnouncement);
  }, { timeout });
}

/**
 * Validate color contrast ratios
 */
export function validateColorContrast(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): { ratio: number; passes: boolean; level: string } {
  const getLuminance = (color: string): number => {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    // Apply gamma correction
    const gammaCorrect = (c: number) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

    const rg = gammaCorrect(r);
    const gg = gammaCorrect(g);
    const bg = gammaCorrect(b);

    return 0.2126 * rg + 0.7152 * gg + 0.0722 * bg;
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

  const aaThreshold = isLargeText ? 3 : 4.5;
  const aaaThreshold = isLargeText ? 4.5 : 7;

  let level = 'Fail';
  if (ratio >= aaaThreshold) level = 'AAA';
  else if (ratio >= aaThreshold) level = 'AA';

  return {
    ratio: Math.round(ratio * 100) / 100,
    passes: ratio >= aaThreshold,
    level
  };
}

/**
 * Test focus management for modals and dynamic content
 */
export async function testFocusManagement(
  triggerAction: () => Promise<void> | void,
  options: {
    expectedInitialFocus?: string;
    trapFocus?: boolean;
    returnFocus?: boolean;
    originalActiveElement?: HTMLElement;
  } = {}
): Promise<void> {
  const originalActiveElement = options.originalActiveElement || document.activeElement;

  await triggerAction();

  // Test initial focus
  if (options.expectedInitialFocus) {
    await waitFor(() => {
      const expectedElement = document.querySelector(options.expectedInitialFocus!);
      expect(document.activeElement).toBe(expectedElement);
    });
  }

  // Test focus trap
  if (options.trapFocus) {
    const user = userEvent.setup();
    const modal = document.querySelector('[role="dialog"]') as HTMLElement;
    const focusableElements = modal?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements && focusableElements.length > 0) {
      // Tab to last element
      for (let i = 0; i < focusableElements.length; i++) {
        await user.tab();
      }

      // One more tab should cycle back to first element
      await user.tab();
      expect(document.activeElement).toBe(focusableElements[0]);

      // Shift+Tab should go to last element
      await user.tab({ shift: true });
      expect(document.activeElement).toBe(focusableElements[focusableElements.length - 1]);
    }
  }

  // Test focus return
  if (options.returnFocus) {
    // Simulate closing modal (would need to be customized per component)
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(document.activeElement).toBe(originalActiveElement);
    });
  }
}

/**
 * Comprehensive accessibility test suite for components
 */
export async function runAccessibilityTests(
  component: React.ReactElement,
  options: {
    skipAxe?: boolean;
    skipKeyboard?: boolean;
    skipScreenReader?: boolean;
    customTests?: Array<(container: HTMLElement) => Promise<void> | void>;
  } = {}
): Promise<void> {
  const { container } = render(component);

  // Axe automated testing
  if (!options.skipAxe) {
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  }

  // Keyboard navigation testing
  if (!options.skipKeyboard) {
    await testKeyboardNavigation(container);
  }

  // Screen reader announcement testing
  if (!options.skipScreenReader) {
    const liveRegions = container.querySelectorAll('[aria-live]');
    expect(liveRegions.length).toBeGreaterThan(0);
  }

  // Custom test functions
  if (options.customTests) {
    for (const test of options.customTests) {
      await test(container);
    }
  }
}

/**
 * Pa11y integration for command-line testing
 */
export const pa11yConfig = {
  standard: 'WCAG2AA',
  level: 'error',
  reporter: 'json',
  includeNotices: false,
  includeWarnings: false,
  chromeLaunchConfig: {
    executablePath: process.env.CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
  actions: [
    'wait for element #app to be visible',
    'screen capture example.png'
  ]
};

/**
 * Lighthouse accessibility configuration
 */
export const lighthouseConfig = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['accessibility'],
    skipAudits: ['uses-http2']
  }
};

/**
 * Common accessibility test scenarios
 */
export const accessibilityScenarios = {
  /**
   * Test form accessibility
   */
  async testFormAccessibility(formElement: HTMLElement): Promise<void> {
    const inputs = formElement.querySelectorAll('input, select, textarea');

    inputs.forEach((input, index) => {
      const htmlInput = input as HTMLInputElement;

      // Every input should have a label
      const id = htmlInput.id;
      const label = formElement.querySelector(`label[for="${id}"]`);
      const ariaLabel = htmlInput.getAttribute('aria-label');
      const ariaLabelledBy = htmlInput.getAttribute('aria-labelledby');

      expect(
        label || ariaLabel || ariaLabelledBy
      ).toBeTruthy();

      // Required fields should be properly marked
      if (htmlInput.required) {
        const ariaRequired = htmlInput.getAttribute('aria-required');
        expect(ariaRequired).toBe('true');
      }

      // Error states should be accessible
      if (htmlInput.getAttribute('aria-invalid') === 'true') {
        const errorId = htmlInput.getAttribute('aria-describedby');
        expect(errorId).toBeTruthy();

        if (errorId) {
          const errorElement = document.getElementById(errorId);
          expect(errorElement).toBeTruthy();
          expect(errorElement?.textContent).toBeTruthy();
        }
      }
    });
  },

  /**
   * Test button accessibility
   */
  testButtonAccessibility(buttonElement: HTMLElement): void {
    // Button should have accessible name
    const accessibleName =
      buttonElement.getAttribute('aria-label') ||
      buttonElement.getAttribute('aria-labelledby') ||
      buttonElement.textContent?.trim();

    expect(accessibleName).toBeTruthy();

    // Icon-only buttons should have aria-label
    if (!buttonElement.textContent?.trim()) {
      expect(buttonElement.getAttribute('aria-label')).toBeTruthy();
    }

    // Toggle buttons should have aria-pressed
    if (buttonElement.getAttribute('role') === 'button' &&
        buttonElement.classList.contains('toggle')) {
      const ariaPressed = buttonElement.getAttribute('aria-pressed');
      expect(['true', 'false'].includes(ariaPressed || '')).toBe(true);
    }
  },

  /**
   * Test modal accessibility
   */
  async testModalAccessibility(modalElement: HTMLElement): Promise<void> {
    // Modal should have proper role and properties
    expect(modalElement.getAttribute('role')).toBe('dialog');
    expect(modalElement.getAttribute('aria-modal')).toBe('true');

    // Modal should have accessible name
    const ariaLabel = modalElement.getAttribute('aria-label');
    const ariaLabelledBy = modalElement.getAttribute('aria-labelledby');
    expect(ariaLabel || ariaLabelledBy).toBeTruthy();

    // Test focus trap
    await testFocusManagement(() => {}, {
      trapFocus: true,
      returnFocus: true
    });
  }
};

// Export everything for use in tests
export * from '@testing-library/react';
export { axe, configureAxe };