/**
 * Accessibility Testing Framework
 *
 * This module provides comprehensive accessibility testing utilities
 * for React components and pages using axe-core and custom WCAG validators.
 */

import { configureAxe, toHaveNoViolations } from 'jest-axe';
import { render, RenderResult } from '@testing-library/react';
import { ReactElement } from 'react';
import WCAGValidator, { AccessibilityAuditResult } from '../utils/wcagValidator';
import ElectronAccessibilityTests from './ElectronAccessibilityTests';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveNoViolations(): R;
      toHaveAccessibleFormStructure(): R;
      toHaveAccessibleNameCustom(expectedName?: string | RegExp): R;
      toBeInLoadingState(): R;
      toHaveValidKeyboardNavigation(): R;
      toHaveNoColorContrastViolations(): R;
      // Note: toHaveAccessibleName is provided by @testing-library/jest-dom
    }
  }
}

export interface AccessibilityTestConfig {
  rules?: Record<string, { enabled: boolean }>;
  tags?: string[];
  timeout?: number;
  disableColorContrast?: boolean;
  skipFailures?: boolean;
}

export interface AccessibilityTestResult {
  axeResults: any;
  wcagResults: AccessibilityAuditResult;
  passed: boolean;
  violationCount: number;
  summary: string;
}

export interface ComponentTestOptions {
  props?: Record<string, any>;
  context?: any;
  config?: AccessibilityTestConfig;
}

export class AccessibilityTestFramework {
  private axe: any;
  private wcagValidator: WCAGValidator;

  constructor(config: AccessibilityTestConfig = {}) {
    // Configure axe-core with WCAG 2.1 AA standards
    this.axe = configureAxe({
      rules: {
        // Enable all WCAG 2.1 AA rules
        'color-contrast': { enabled: !config.disableColorContrast },
        'keyboard-navigation': { enabled: true },
        'focus-management': { enabled: true },
        'heading-structure': { enabled: true },
        'landmark-roles': { enabled: true },
        'form-labels': { enabled: true },
        'button-name': { enabled: true },
        'link-name': { enabled: true },
        'image-alt': { enabled: true },
        'bypass-blocks': { enabled: true },
        'html-has-lang': { enabled: true },
        'label-title-only': { enabled: false }, // We allow title as fallback
        'page-has-heading-one': { enabled: true },
        'region': { enabled: true },
        'aria-roles': { enabled: true },
        'aria-required-attr': { enabled: true },
        'aria-valid-attr': { enabled: true },
        'aria-valid-attr-value': { enabled: true },
        ...config.rules,
      },
      tags: config.tags || ['wcag2a', 'wcag2aa', 'wcag21aa'],
    });

    this.wcagValidator = WCAGValidator.getInstance();
  }

  /**
   * Test a React component for accessibility compliance
   */
  async testComponent(
    component: ReactElement,
    options: ComponentTestOptions = {}
  ): Promise<AccessibilityTestResult> {
    const renderResult = render(component);
    return this.testRenderedComponent(renderResult, options.config);
  }

  /**
   * Test a rendered React component for accessibility compliance
   */
  async testRenderedComponent(
    renderResult: RenderResult,
    config: AccessibilityTestConfig = {}
  ): Promise<AccessibilityTestResult> {
    const { container } = renderResult;

    // Wait for component to be fully rendered
    await new Promise(resolve => setTimeout(resolve, 100));

    // Run axe-core analysis
    const axeResults = await this.axe(container, {
      timeout: config.timeout || 5000,
    });

    // Set up DOM for WCAG validator
    const originalDocument = global.document;
    const originalWindow = global.window;

    try {
      // Create a temporary document context for WCAG validation
      Object.defineProperty(global, 'document', {
        value: container.ownerDocument,
        writable: true,
      });

      Object.defineProperty(global, 'window', {
        value: container.ownerDocument.defaultView,
        writable: true,
      });

      // Run custom WCAG validation
      const wcagResults = await this.wcagValidator.auditCurrentPage();

      const violationCount = axeResults.violations.length + wcagResults.violations.length;
      const passed = violationCount === 0;

      return {
        axeResults,
        wcagResults,
        passed,
        violationCount,
        summary: this.generateSummary(axeResults, wcagResults),
      };
    } finally {
      // Restore original document and window
      Object.defineProperty(global, 'document', {
        value: originalDocument,
        writable: true,
      });

      Object.defineProperty(global, 'window', {
        value: originalWindow,
        writable: true,
      });
    }
  }

  /**
   * Test a full page for accessibility compliance
   */
  async testPage(url?: string): Promise<AccessibilityTestResult> {
    // Run axe-core analysis on the current page
    const axeResults = await this.axe(document, {
      timeout: 10000,
    });

    // Run custom WCAG validation
    const wcagResults = await this.wcagValidator.auditCurrentPage();

    const violationCount = axeResults.violations.length + wcagResults.violations.length;
    const passed = violationCount === 0;

    return {
      axeResults,
      wcagResults,
      passed,
      violationCount,
      summary: this.generateSummary(axeResults, wcagResults),
    };
  }

  /**
   * Test keyboard navigation for a component
   */
  async testKeyboardNavigation(renderResult: RenderResult): Promise<{
    focusableElements: Element[];
    violations: any[];
    tabOrder: number[];
  }> {
    const { container } = renderResult;
    const focusableElements = this.getFocusableElements(container);
    const violations: any[] = [];
    const tabOrder: number[] = [];

    // Check each focusable element
    focusableElements.forEach((element, index) => {
      const tabIndex = element.getAttribute('tabindex');

      if (tabIndex !== null) {
        const parsedTabIndex = parseInt(tabIndex);
        if (parsedTabIndex > 0) {
          violations.push({
            type: 'positive-tabindex',
            element,
            message: 'Avoid positive tabindex values',
          });
        }
        tabOrder.push(parsedTabIndex);
      } else {
        tabOrder.push(0);
      }

      // Check if element is truly focusable
      const isFocusable = this.isElementFocusable(element as HTMLElement);
      if (!isFocusable && tabIndex !== '-1') {
        violations.push({
          type: 'unfocusable-element',
          element,
          message: 'Element appears focusable but is not',
        });
      }
    });

    return {
      focusableElements,
      violations,
      tabOrder,
    };
  }

  /**
   * Test color contrast for all text elements in a component
   */
  async testColorContrast(renderResult: RenderResult): Promise<{
    elements: Array<{
      element: Element;
      ratio: number;
      passes: boolean;
      foreground: string;
      background: string;
    }>;
    violations: number;
  }> {
    const { container } = renderResult;
    const textElements = container.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, a, button, input, label, li');
    const results: any[] = [];
    let violations = 0;

    textElements.forEach((element) => {
      const computedStyle = window.getComputedStyle(element as HTMLElement);
      const color = computedStyle.color;
      const backgroundColor = computedStyle.backgroundColor;

      if (this.hasVisibleText(element as HTMLElement)) {
        const contrastRatio = this.calculateContrastRatio(color, backgroundColor);
        const passes = contrastRatio >= 4.5; // WCAG AA standard

        if (!passes) violations++;

        results.push({
          element,
          ratio: contrastRatio,
          passes,
          foreground: color,
          background: backgroundColor,
        });
      }
    });

    return {
      elements: results,
      violations,
    };
  }

  /**
   * Test form accessibility
   */
  async testFormAccessibility(renderResult: RenderResult): Promise<{
    formControls: Element[];
    violations: Array<{
      type: string;
      element: Element;
      message: string;
    }>;
  }> {
    const { container } = renderResult;
    const formControls = container.querySelectorAll(
      'input, select, textarea, button[type="submit"], [role="textbox"], [role="combobox"]'
    );
    const violations: any[] = [];

    formControls.forEach((control) => {
      // Check for accessible name
      const accessibleName = this.getAccessibleName(control as HTMLElement);
      if (!accessibleName.trim()) {
        violations.push({
          type: 'missing-label',
          element: control,
          message: 'Form control missing accessible name',
        });
      }

      // Check required field indication
      const isRequired = control.hasAttribute('required') ||
                        control.getAttribute('aria-required') === 'true';
      if (isRequired && !this.hasRequiredIndicator(control as HTMLElement)) {
        violations.push({
          type: 'missing-required-indicator',
          element: control,
          message: 'Required field not clearly indicated',
        });
      }

      // Check error association
      const hasError = control.getAttribute('aria-invalid') === 'true';
      if (hasError && !control.getAttribute('aria-describedby')) {
        violations.push({
          type: 'missing-error-description',
          element: control,
          message: 'Error not properly associated with field',
        });
      }
    });

    return {
      formControls: Array.from(formControls),
      violations,
    };
  }

  /**
   * Create custom Jest matchers for accessibility testing
   */
  static createMatchers() {
    return {
      toBeAccessible: function(received: AccessibilityTestResult) {
        const pass = received.passed;

        if (pass) {
          return {
            message: () => `Expected component to have accessibility violations, but it passed all tests`,
            pass: true,
          };
        } else {
          return {
            message: () =>
              `Expected component to be accessible, but found ${received.violationCount} violations:\n` +
              received.summary,
            pass: false,
          };
        }
      },

      toHaveAccessibleFormStructure: function(received: HTMLElement) {
        const form = received.querySelector('form') || received.closest('form');
        const inputs = received.querySelectorAll('input, textarea, select, [role="textbox"], [role="combobox"]');
        const labels = received.querySelectorAll('label');
        const headings = received.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');

        // Check basic structure
        const hasForm = !!form;
        const hasInputs = inputs.length > 0;
        const hasHeadings = headings.length > 0;

        // Check that inputs have accessible names
        const inputsWithAccessibleNames = Array.from(inputs).filter(input => {
          const id = input.getAttribute('id');
          const ariaLabel = input.getAttribute('aria-label');
          const ariaLabelledBy = input.getAttribute('aria-labelledby');
          const placeholder = input.getAttribute('placeholder');

          // Check for explicit labeling
          if (ariaLabel || ariaLabelledBy) return true;

          // Check for associated label
          if (id) {
            const label = received.querySelector(`label[for="${id}"]`);
            if (label) return true;
          }

          // Check if wrapped in label
          const parentLabel = input.closest('label');
          if (parentLabel) return true;

          // Placeholder is acceptable but not ideal
          if (placeholder) return true;

          return false;
        });

        // Check for form validation structure
        const hasProperErrorHandling = Array.from(inputs).every(input => {
          const hasAriaInvalid = input.hasAttribute('aria-invalid');
          const hasAriaDescribedby = input.hasAttribute('aria-describedby');

          // If there are error messages, they should be properly associated
          const errorElements = received.querySelectorAll('.error-message, [role="alert"]');
          if (errorElements.length > 0) {
            return hasAriaDescribedby;
          }

          return true;
        });

        const pass = hasForm && hasInputs && inputsWithAccessibleNames.length === inputs.length && hasProperErrorHandling;

        return {
          message: () => {
            if (pass) {
              return `Expected form not to have accessible structure`;
            } else {
              const issues = [];
              if (!hasForm) issues.push('no form element found');
              if (!hasInputs) issues.push('no input elements found');
              if (!hasHeadings) issues.push('no heading structure');
              if (inputsWithAccessibleNames.length !== inputs.length) {
                issues.push(`${inputs.length - inputsWithAccessibleNames.length} inputs lack accessible names`);
              }
              if (!hasProperErrorHandling) issues.push('improper error handling structure');

              return `Expected form to have accessible structure. Issues: ${issues.join(', ')}`;
            }
          },
          pass,
        };
      },

      // Note: toHaveAccessibleName is already provided by @testing-library/jest-dom
      // Our custom implementation is only used when the built-in one is not sufficient
      toHaveAccessibleNameCustom: function(received: HTMLElement, expectedName?: string | RegExp) {
        // Use the framework's getAccessibleName method for edge cases
        const framework = new AccessibilityTestFramework();
        const accessibleName = (framework as any).getAccessibleName(received);

        let pass = false;
        let message = '';

        if (expectedName === undefined) {
          // Just check if it has any accessible name
          pass = accessibleName.trim().length > 0;
          message = pass
            ? `Expected element not to have accessible name, but found: "${accessibleName}"`
            : `Expected element to have accessible name, but found none`;
        } else if (typeof expectedName === 'string') {
          pass = accessibleName === expectedName;
          message = pass
            ? `Expected element not to have accessible name "${expectedName}"`
            : `Expected element to have accessible name "${expectedName}", but found: "${accessibleName}"`;
        } else if (expectedName instanceof RegExp) {
          pass = expectedName.test(accessibleName);
          message = pass
            ? `Expected element's accessible name not to match ${expectedName}`
            : `Expected element's accessible name to match ${expectedName}, but found: "${accessibleName}"`;
        }

        return {
          message: () => message,
          pass,
        };
      },

      toBeInLoadingState: function(received: HTMLElement) {
        // Check for various loading indicators
        const loadingSpinner = received.querySelector('[aria-label*="loading"], [aria-label*="Loading"], .loading-spinner, .spinner');
        const loadingButton = received.querySelector('[data-loading="true"], button:disabled[aria-label*="loading"]');
        const ariaLive = received.querySelector('[aria-live][aria-busy="true"]');
        const loadingText = received.textContent?.toLowerCase().includes('loading') || false;
        const disabledSubmit = received.querySelector('button[type="submit"]:disabled');

        // Check for loading states in button text
        const loadingButtonText = received.querySelector('button')?.textContent?.toLowerCase();
        const hasLoadingButtonText = loadingButtonText?.includes('loading') ||
                                   loadingButtonText?.includes('submitting') ||
                                   loadingButtonText?.includes('saving') ||
                                   loadingButtonText?.includes('creating');

        const pass = !!(loadingSpinner || loadingButton || ariaLive || loadingText || hasLoadingButtonText || disabledSubmit);

        return {
          message: () => {
            if (pass) {
              return `Expected element not to be in loading state`;
            } else {
              return `Expected element to be in loading state. Checked for: loading spinner, loading button, aria-live with aria-busy, loading text, disabled submit button`;
            }
          },
          pass,
        };
      },

      toHaveNoColorContrastViolations: function(received: any) {
        const violations = received.violations || 0;
        const pass = violations === 0;

        if (pass) {
          return {
            message: () => `Expected component to have color contrast violations`,
            pass: true,
          };
        } else {
          return {
            message: () => `Expected component to have no color contrast violations, but found ${violations}`,
            pass: false,
          };
        }
      },

      toHaveValidKeyboardNavigation: function(received: any) {
        const violations = received.violations || [];
        const pass = violations.length === 0;

        if (pass) {
          return {
            message: () => `Expected component to have keyboard navigation violations`,
            pass: true,
          };
        } else {
          return {
            message: () =>
              `Expected component to have valid keyboard navigation, but found ${violations.length} violations:\n` +
              violations.map((v: any) => `- ${v.message}`).join('\n'),
            pass: false,
          };
        }
      },
    };
  }

  // Helper methods

  private generateSummary(axeResults: any, wcagResults: AccessibilityAuditResult): string {
    const axeViolations = axeResults.violations.length;
    const wcagViolations = wcagResults.violations.length;
    const totalViolations = axeViolations + wcagViolations;

    if (totalViolations === 0) {
      return 'All accessibility tests passed!';
    }

    let summary = `Found ${totalViolations} accessibility violations:\n`;

    if (axeViolations > 0) {
      summary += `\nAxe-core violations (${axeViolations}):\n`;
      axeResults.violations.forEach((violation: any) => {
        summary += `- ${violation.id}: ${violation.description} (${violation.nodes.length} nodes)\n`;
      });
    }

    if (wcagViolations > 0) {
      summary += `\nWCAG violations (${wcagViolations}):\n`;
      wcagResults.violations.forEach((violation) => {
        summary += `- ${violation.id}: ${violation.description}\n`;
      });
    }

    return summary;
  }

  private getFocusableElements(container: Element): Element[] {
    return Array.from(container.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"]'
    )).filter((element) => this.isElementVisible(element as HTMLElement));
  }

  private isElementFocusable(element: HTMLElement): boolean {
    // Check if element can actually receive focus
    try {
      const activeElement = document.activeElement;
      element.focus();
      const isFocused = document.activeElement === element;
      if (activeElement && activeElement !== element) {
        (activeElement as HTMLElement).focus();
      }
      return isFocused;
    } catch {
      return false;
    }
  }

  private isElementVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           element.offsetWidth > 0 &&
           element.offsetHeight > 0;
  }

  private hasVisibleText(element: HTMLElement): boolean {
    return (element.textContent?.trim().length || 0) > 0;
  }

  private calculateContrastRatio(foreground: string, background: string): number {
    // This is a simplified implementation
    // In production, use a proper color contrast library like `color`

    // Convert colors to RGB
    const fgRgb = this.parseColor(foreground);
    const bgRgb = this.parseColor(background);

    if (!fgRgb || !bgRgb) return 1;

    // Calculate relative luminance
    const fgLuminance = this.getRelativeLuminance(fgRgb);
    const bgLuminance = this.getRelativeLuminance(bgRgb);

    // Calculate contrast ratio
    const lighter = Math.max(fgLuminance, bgLuminance);
    const darker = Math.min(fgLuminance, bgLuminance);

    return (lighter + 0.05) / (darker + 0.05);
  }

  private parseColor(color: string): { r: number; g: number; b: number } | null {
    // Very basic color parsing - in production, use a proper color library
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3]),
      };
    }

    // Default to black if unable to parse
    return { r: 0, g: 0, b: 0 };
  }

  private getRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
    // Calculate relative luminance according to WCAG formula
    const rsRGB = rgb.r / 255;
    const gsRGB = rgb.g / 255;
    const bsRGB = rgb.b / 255;

    const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  private getAccessibleName(element: HTMLElement): string {
    // Check aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // Check aria-labelledby
    const ariaLabelledby = element.getAttribute('aria-labelledby');
    if (ariaLabelledby) {
      const labelElement = document.getElementById(ariaLabelledby);
      if (labelElement) return labelElement.textContent?.trim() || '';
    }

    // Check for associated label
    const id = element.getAttribute('id');
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent?.trim() || '';
    }

    // Check if wrapped in label
    const parentLabel = element.closest('label');
    if (parentLabel) return parentLabel.textContent?.trim() || '';

    // Check other attributes
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) return placeholder;

    const alt = element.getAttribute('alt');
    if (alt !== null) return alt;

    const title = element.getAttribute('title');
    if (title) return title;

    return element.textContent?.trim() || '';
  }

  private hasRequiredIndicator(element: HTMLElement): boolean {
    const accessibleName = this.getAccessibleName(element);
    if (accessibleName.includes('*') || accessibleName.toLowerCase().includes('required')) {
      return true;
    }

    const ariaDescribedby = element.getAttribute('aria-describedby');
    if (ariaDescribedby) {
      const descElement = document.getElementById(ariaDescribedby);
      if (descElement?.textContent?.toLowerCase().includes('required')) {
        return true;
      }
    }

    return false;
  }
}

// Export helper functions for use in tests
export const accessibility = new AccessibilityTestFramework();

export const runAccessibilityTest = async (component: ReactElement, options?: ComponentTestOptions) => {
  return accessibility.testComponent(component, options);
};

export const runPageAccessibilityTest = async () => {
  return accessibility.testPage();
};

export const runKeyboardNavigationTest = async (renderResult: RenderResult) => {
  return accessibility.testKeyboardNavigation(renderResult);
};

export const runColorContrastTest = async (renderResult: RenderResult) => {
  return accessibility.testColorContrast(renderResult);
};

export const runFormAccessibilityTest = async (renderResult: RenderResult) => {
  return accessibility.testFormAccessibility(renderResult);
};

// Add custom matchers to Jest
const customMatchers = AccessibilityTestFramework.createMatchers();
expect.extend(customMatchers);

// Export Electron-specific utilities
export {
  ElectronAccessibilityTests,
  testKeyboardShortcuts,
  testNativeMenus,
  testWindowFocus,
  testDesktopInteractions
} from './ElectronAccessibilityTests';

export type {
  ElectronA11yTestResult,
  KeyboardShortcutTest,
  WindowFocusTest
} from './ElectronAccessibilityTests';

export default AccessibilityTestFramework;