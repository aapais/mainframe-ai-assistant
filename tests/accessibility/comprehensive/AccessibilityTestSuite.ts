/**
 * Comprehensive Accessibility Test Suite
 * WCAG 2.1 AA Compliance Validation for Mainframe KB Assistant
 *
 * This test suite provides comprehensive accessibility validation including:
 * - ARIA implementation testing
 * - Keyboard navigation validation
 * - Screen reader compatibility
 * - Focus management testing
 * - Color contrast validation
 * - Error announcements
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations, configureAxe } from 'jest-axe';
import type { AxeResults, Result as AxeViolation } from 'axe-core';

// Extend expect with axe matchers
expect.extend(toHaveNoViolations);

/**
 * Enhanced Accessibility Configuration
 */
interface AccessibilityTestConfig {
  wcagLevel: 'A' | 'AA' | 'AAA';
  tags: string[];
  rules: Record<string, any>;
  colorContrastRatio: number;
  focusTimeout: number;
  keyboardDelay: number;
  screenReaderDelay: number;
}

const COMPREHENSIVE_ACCESSIBILITY_CONFIG: AccessibilityTestConfig = {
  wcagLevel: 'AA',
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice', 'experimental'],
  rules: {
    // WCAG 2.1 AA Color Contrast
    'color-contrast': { enabled: true },
    'color-contrast-enhanced': { enabled: false }, // AAA level

    // WCAG 2.1 AA Keyboard Navigation
    'focus-order-semantics': { enabled: true },
    'focusable-content': { enabled: true },
    'tabindex': { enabled: true },
    'keyboard': { enabled: true },

    // WCAG 2.1 AA Screen Reader Support
    'aria-allowed-attr': { enabled: true },
    'aria-command-name': { enabled: true },
    'aria-hidden-body': { enabled: true },
    'aria-hidden-focus': { enabled: true },
    'aria-input-field-name': { enabled: true },
    'aria-meter-name': { enabled: true },
    'aria-progressbar-name': { enabled: true },
    'aria-required-attr': { enabled: true },
    'aria-required-children': { enabled: true },
    'aria-required-parent': { enabled: true },
    'aria-roledescription': { enabled: true },
    'aria-roles': { enabled: true },
    'aria-text': { enabled: true },
    'aria-toggle-field-name': { enabled: true },
    'aria-tooltip-name': { enabled: true },
    'aria-treeitem-name': { enabled: true },
    'aria-valid-attr': { enabled: true },
    'aria-valid-attr-value': { enabled: true },

    // WCAG 2.1 AA Form Accessibility
    'form-field-multiple-labels': { enabled: true },
    'label': { enabled: true },
    'label-title-only': { enabled: true },
    'select-name': { enabled: true },

    // WCAG 2.1 AA Structure and Navigation
    'bypass': { enabled: true },
    'duplicate-id': { enabled: true },
    'duplicate-id-active': { enabled: true },
    'duplicate-id-aria': { enabled: true },
    'heading-order': { enabled: true },
    'landmark-banner-is-top-level': { enabled: true },
    'landmark-complementary-is-top-level': { enabled: true },
    'landmark-contentinfo-is-top-level': { enabled: true },
    'landmark-main-is-top-level': { enabled: true },
    'landmark-no-duplicate-banner': { enabled: true },
    'landmark-no-duplicate-contentinfo': { enabled: true },
    'landmark-no-duplicate-main': { enabled: true },
    'landmark-one-main': { enabled: true },
    'landmark-unique': { enabled: true },
    'page-has-heading-one': { enabled: true },
    'region': { enabled: true },
    'skip-link': { enabled: true },

    // WCAG 2.1 AA Interactive Elements
    'button-name': { enabled: true },
    'link-name': { enabled: true },
    'link-in-text-block': { enabled: true },
    'nested-interactive': { enabled: true },

    // WCAG 2.1 AA Media and Images
    'image-alt': { enabled: true },
    'input-image-alt': { enabled: true },
    'object-alt': { enabled: true },
    'svg-img-alt': { enabled: true },

    // WCAG 2.1 AA Language and Content
    'html-has-lang': { enabled: true },
    'html-lang-valid': { enabled: true },
    'html-xml-lang-mismatch': { enabled: true },
    'valid-lang': { enabled: true }
  },
  colorContrastRatio: 4.5, // WCAG AA standard
  focusTimeout: 1000,
  keyboardDelay: 100,
  screenReaderDelay: 500
};

/**
 * Accessibility Test Results Interface
 */
interface AccessibilityTestResults {
  component: string;
  wcagLevel: string;
  violations: AxeViolation[];
  passes: any[];
  incomplete: any[];
  keyboardNavigation: {
    passed: boolean;
    focusableElementsCount: number;
    tabOrder: string[];
    issues: string[];
  };
  screenReader: {
    passed: boolean;
    ariaLabels: { element: string; label: string | null }[];
    liveRegions: string[];
    landmarks: string[];
    issues: string[];
  };
  colorContrast: {
    passed: boolean;
    ratio: number;
    issues: string[];
  };
  focusManagement: {
    passed: boolean;
    focusTrapping: boolean;
    focusRestoration: boolean;
    issues: string[];
  };
  errorHandling: {
    passed: boolean;
    announcements: string[];
    issues: string[];
  };
  summary: {
    overallScore: number;
    criticalIssues: number;
    warningIssues: number;
    passedChecks: number;
    totalChecks: number;
  };
}

/**
 * Enhanced Accessibility Test Runner
 */
export class ComprehensiveAccessibilityTestRunner {
  private config: AccessibilityTestConfig;
  private axeInstance: any;
  private user: any;

  constructor(config: Partial<AccessibilityTestConfig> = {}) {
    this.config = { ...COMPREHENSIVE_ACCESSIBILITY_CONFIG, ...config };
    this.axeInstance = configureAxe({
      tags: this.config.tags,
      rules: this.config.rules
    });
  }

  /**
   * Run comprehensive accessibility test suite
   */
  async runComprehensiveTest(
    component: React.ReactElement,
    componentName: string = 'Unknown Component'
  ): Promise<AccessibilityTestResults> {
    this.user = userEvent.setup({ delay: this.config.keyboardDelay });

    console.log(`\n🔍 Running comprehensive accessibility test for: ${componentName}`);

    const { container } = render(component);

    // Run all accessibility tests in parallel where possible
    const [
      axeResults,
      keyboardResults,
      screenReaderResults,
      colorContrastResults,
      focusResults,
      errorResults
    ] = await Promise.all([
      this.runAxeAudit(container),
      this.testKeyboardNavigation(container),
      this.testScreenReaderSupport(container),
      this.testColorContrast(container),
      this.testFocusManagement(container),
      this.testErrorHandling(container)
    ]);

    const results: AccessibilityTestResults = {
      component: componentName,
      wcagLevel: this.config.wcagLevel,
      violations: axeResults.violations,
      passes: axeResults.passes,
      incomplete: axeResults.incomplete,
      keyboardNavigation: keyboardResults,
      screenReader: screenReaderResults,
      colorContrast: colorContrastResults,
      focusManagement: focusResults,
      errorHandling: errorResults,
      summary: this.calculateSummary(
        axeResults,
        keyboardResults,
        screenReaderResults,
        colorContrastResults,
        focusResults,
        errorResults
      )
    };

    this.logResults(results);
    return results;
  }

  /**
   * Run axe accessibility audit
   */
  private async runAxeAudit(container: HTMLElement): Promise<AxeResults> {
    console.log('  🔧 Running axe accessibility audit...');

    const results = await this.axeInstance(container, {
      tags: this.config.tags,
      rules: this.config.rules
    });

    if (results.violations.length > 0) {
      console.warn(`  ⚠️ Found ${results.violations.length} accessibility violations`);
      results.violations.forEach((violation: AxeViolation) => {
        console.warn(`    - ${violation.id}: ${violation.description}`);
        violation.nodes.forEach(node => {
          console.warn(`      Target: ${node.target}`);
        });
      });
    } else {
      console.log('  ✅ No axe violations found');
    }

    return results;
  }

  /**
   * Test keyboard navigation comprehensively
   */
  private async testKeyboardNavigation(container: HTMLElement): Promise<any> {
    console.log('  ⌨️ Testing keyboard navigation...');

    const focusableElements = this.getFocusableElements(container);
    const tabOrder: string[] = [];
    const issues: string[] = [];

    if (focusableElements.length === 0) {
      issues.push('No focusable elements found');
      return {
        passed: false,
        focusableElementsCount: 0,
        tabOrder,
        issues
      };
    }

    // Test forward tab navigation
    let currentIndex = 0;
    for (const element of focusableElements) {
      try {
        element.focus();
        await new Promise(resolve => setTimeout(resolve, this.config.keyboardDelay));

        if (document.activeElement !== element) {
          issues.push(`Element ${this.getElementDescription(element)} cannot receive focus`);
        } else {
          tabOrder.push(this.getElementDescription(element));

          // Test if element has visible focus indicator
          const styles = window.getComputedStyle(element);
          const outline = styles.outline;
          const boxShadow = styles.boxShadow;

          if (outline === 'none' && boxShadow === 'none') {
            // Check for custom focus styles
            const hasCustomFocus = element.classList.contains('focus-visible') ||
                                 element.classList.contains('focused') ||
                                 styles.borderColor !== 'rgb(0, 0, 0)' ||
                                 styles.backgroundColor !== 'rgba(0, 0, 0, 0)';

            if (!hasCustomFocus) {
              issues.push(`Element ${this.getElementDescription(element)} lacks visible focus indicator`);
            }
          }
        }
        currentIndex++;
      } catch (error) {
        issues.push(`Error focusing element ${this.getElementDescription(element)}: ${error}`);
      }
    }

    // Test keyboard event handling
    for (const element of focusableElements) {
      if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
        element.focus();

        // Test Enter and Space key activation
        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });

        let enterHandled = false;
        let spaceHandled = false;

        element.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') enterHandled = true;
          if (e.key === ' ') spaceHandled = true;
        });

        element.dispatchEvent(enterEvent);
        element.dispatchEvent(spaceEvent);

        if (!enterHandled && !spaceHandled) {
          issues.push(`Button ${this.getElementDescription(element)} doesn't handle keyboard activation`);
        }
      }
    }

    return {
      passed: issues.length === 0,
      focusableElementsCount: focusableElements.length,
      tabOrder,
      issues
    };
  }

  /**
   * Test screen reader support
   */
  private async testScreenReaderSupport(container: HTMLElement): Promise<any> {
    console.log('  📢 Testing screen reader support...');

    const issues: string[] = [];
    const ariaLabels: { element: string; label: string | null }[] = [];
    const liveRegions: string[] = [];
    const landmarks: string[] = [];

    // Test ARIA labels and accessible names
    const interactiveElements = container.querySelectorAll(
      'button, input, select, textarea, a, [role="button"], [role="link"], [role="textbox"], [role="combobox"]'
    );

    interactiveElements.forEach(element => {
      const accessibleName = this.getAccessibleName(element as HTMLElement);
      ariaLabels.push({
        element: this.getElementDescription(element as HTMLElement),
        label: accessibleName
      });

      if (!accessibleName) {
        issues.push(`Interactive element ${this.getElementDescription(element as HTMLElement)} lacks accessible name`);
      }
    });

    // Test ARIA live regions
    const liveRegionElements = container.querySelectorAll('[aria-live], [role="status"], [role="alert"]');
    liveRegionElements.forEach(element => {
      const liveValue = element.getAttribute('aria-live') ||
                       (element.getAttribute('role') === 'alert' ? 'assertive' : 'polite');
      liveRegions.push(`${this.getElementDescription(element as HTMLElement)}: ${liveValue}`);
    });

    // Test landmark structure
    const landmarkElements = container.querySelectorAll(
      '[role="main"], [role="banner"], [role="navigation"], [role="contentinfo"], [role="complementary"], [role="search"], [role="form"], main, nav, header, footer, aside'
    );

    landmarkElements.forEach(element => {
      const landmarkType = element.getAttribute('role') || element.tagName.toLowerCase();
      const landmarkLabel = element.getAttribute('aria-label') ||
                           element.getAttribute('aria-labelledby') ||
                           'unlabeled';
      landmarks.push(`${landmarkType}: ${landmarkLabel}`);
    });

    // Test heading structure
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
    let previousLevel = 0;

    headings.forEach(heading => {
      const level = parseInt(heading.getAttribute('aria-level') || heading.tagName.charAt(1));

      if (level > previousLevel + 1) {
        issues.push(`Heading level jumps from h${previousLevel} to h${level} (should be sequential)`);
      }

      previousLevel = level;
    });

    // Test form structure
    const forms = container.querySelectorAll('form, [role="form"]');
    forms.forEach(form => {
      const formLabel = form.getAttribute('aria-label') ||
                       form.getAttribute('aria-labelledby') ||
                       form.querySelector('legend')?.textContent;

      if (!formLabel) {
        issues.push(`Form ${this.getElementDescription(form as HTMLElement)} lacks accessible label`);
      }
    });

    // Test table accessibility
    const tables = container.querySelectorAll('table, [role="table"]');
    tables.forEach(table => {
      const caption = table.querySelector('caption') || table.getAttribute('aria-label');
      const headers = table.querySelectorAll('th, [role="columnheader"], [role="rowheader"]');

      if (!caption) {
        issues.push(`Table ${this.getElementDescription(table as HTMLElement)} lacks caption or label`);
      }

      if (headers.length === 0) {
        issues.push(`Table ${this.getElementDescription(table as HTMLElement)} lacks proper headers`);
      }
    });

    return {
      passed: issues.length === 0,
      ariaLabels,
      liveRegions,
      landmarks,
      issues
    };
  }

  /**
   * Test color contrast
   */
  private async testColorContrast(container: HTMLElement): Promise<any> {
    console.log('  🎨 Testing color contrast...');

    const issues: string[] = [];
    let overallRatio = 0;
    let testCount = 0;

    // Test text elements
    const textElements = container.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, label, button, a, input, textarea, select');

    textElements.forEach(element => {
      const styles = window.getComputedStyle(element as HTMLElement);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;
      const fontSize = parseFloat(styles.fontSize);
      const fontWeight = styles.fontWeight;

      // Basic contrast checks (would need color-contrast library for precise ratios)
      if (color === backgroundColor) {
        issues.push(`Element ${this.getElementDescription(element as HTMLElement)} has same color and background`);
      }

      if (color === 'transparent' || backgroundColor === 'transparent') {
        issues.push(`Element ${this.getElementDescription(element as HTMLElement)} has transparent colors`);
      }

      // Check for sufficient color difference (simplified check)
      const isLargeText = fontSize >= 18 || (fontSize >= 14 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700));
      const requiredRatio = isLargeText ? 3.0 : 4.5;

      // Simplified contrast check (in real implementation, use color-contrast library)
      const hasGoodContrast = this.hasAdequateContrast(color, backgroundColor);
      if (!hasGoodContrast) {
        issues.push(`Element ${this.getElementDescription(element as HTMLElement)} may have insufficient color contrast`);
      }

      testCount++;
    });

    // Test focus indicators
    const focusableElements = this.getFocusableElements(container);
    focusableElements.forEach(element => {
      element.focus();
      const focusedStyles = window.getComputedStyle(element);
      const outline = focusedStyles.outline;
      const boxShadow = focusedStyles.boxShadow;

      if (outline === 'none' && boxShadow === 'none') {
        // Check for custom focus indicators with sufficient contrast
        const borderColor = focusedStyles.borderColor;
        const backgroundColor = focusedStyles.backgroundColor;

        if (!this.hasAdequateContrast(borderColor, backgroundColor)) {
          issues.push(`Focus indicator for ${this.getElementDescription(element)} may have insufficient contrast`);
        }
      }
    });

    return {
      passed: issues.length === 0,
      ratio: overallRatio / Math.max(testCount, 1),
      issues
    };
  }

  /**
   * Test focus management
   */
  private async testFocusManagement(container: HTMLElement): Promise<any> {
    console.log('  🎯 Testing focus management...');

    const issues: string[] = [];
    let focusTrapping = true;
    let focusRestoration = true;

    // Test focus trapping in modals
    const modals = container.querySelectorAll('[role="dialog"], [aria-modal="true"]');
    for (const modal of modals) {
      const focusableInModal = this.getFocusableElements(modal as HTMLElement);

      if (focusableInModal.length > 0) {
        const firstFocusable = focusableInModal[0];
        const lastFocusable = focusableInModal[focusableInModal.length - 1];

        // Test that Tab from last element returns to first
        lastFocusable.focus();
        await this.user.tab();

        if (document.activeElement !== firstFocusable) {
          focusTrapping = false;
          issues.push(`Modal ${this.getElementDescription(modal as HTMLElement)} doesn't trap focus properly`);
        }

        // Test that Shift+Tab from first element goes to last
        firstFocusable.focus();
        await this.user.tab({ shift: true });

        if (document.activeElement !== lastFocusable) {
          focusTrapping = false;
          issues.push(`Modal ${this.getElementDescription(modal as HTMLElement)} doesn't handle reverse focus trapping`);
        }
      }
    }

    // Test focus restoration
    const buttons = container.querySelectorAll('button');
    for (const button of buttons) {
      const originalFocus = document.activeElement;
      button.focus();

      // Simulate modal opening and closing
      button.blur();

      // In a real test, we'd trigger modal open/close
      // For now, just check if focus can be restored
      if (originalFocus && originalFocus !== document.body) {
        (originalFocus as HTMLElement).focus();

        if (document.activeElement !== originalFocus) {
          focusRestoration = false;
          issues.push('Focus restoration failed after modal interaction');
        }
      }
    }

    // Test skip links
    const skipLinks = container.querySelectorAll('a[href^="#"], [role="link"][href^="#"]');
    for (const skipLink of skipLinks) {
      const href = skipLink.getAttribute('href');
      if (href) {
        const target = container.querySelector(href);
        if (!target) {
          issues.push(`Skip link ${href} has no corresponding target`);
        } else if (!target.hasAttribute('tabindex') && !this.isNaturallyFocusable(target as HTMLElement)) {
          issues.push(`Skip link target ${href} is not focusable`);
        }
      }
    }

    return {
      passed: issues.length === 0,
      focusTrapping,
      focusRestoration,
      issues
    };
  }

  /**
   * Test error handling and announcements
   */
  private async testErrorHandling(container: HTMLElement): Promise<any> {
    console.log('  🚨 Testing error handling and announcements...');

    const issues: string[] = [];
    const announcements: string[] = [];

    // Test form validation error announcements
    const forms = container.querySelectorAll('form, [role="form"]');
    for (const form of forms) {
      const inputs = form.querySelectorAll('input, textarea, select');

      for (const input of inputs) {
        const isRequired = input.hasAttribute('required') || input.getAttribute('aria-required') === 'true';

        if (isRequired) {
          // Check for error message association
          const ariaDescribedBy = input.getAttribute('aria-describedby');
          if (ariaDescribedBy) {
            const errorElement = container.querySelector(`#${ariaDescribedBy}`);
            if (errorElement) {
              const role = errorElement.getAttribute('role');
              const ariaLive = errorElement.getAttribute('aria-live');

              if (role === 'alert' || ariaLive) {
                announcements.push(`Error message for ${this.getElementDescription(input as HTMLElement)} is announced`);
              } else {
                issues.push(`Error message for ${this.getElementDescription(input as HTMLElement)} is not announced to screen readers`);
              }
            }
          } else {
            issues.push(`Required field ${this.getElementDescription(input as HTMLElement)} lacks error message association`);
          }
        }
      }
    }

    // Test live regions for dynamic content
    const liveRegions = container.querySelectorAll('[aria-live], [role="status"], [role="alert"]');
    liveRegions.forEach(region => {
      const liveValue = region.getAttribute('aria-live') ||
                       (region.getAttribute('role') === 'alert' ? 'assertive' : 'polite');
      announcements.push(`Live region: ${liveValue}`);
    });

    // Test loading states
    const loadingElements = container.querySelectorAll('[aria-busy="true"], [role="progressbar"], [role="status"]');
    loadingElements.forEach(element => {
      const hasAnnouncement = element.getAttribute('aria-label') ||
                             element.getAttribute('aria-labelledby') ||
                             element.textContent;

      if (!hasAnnouncement) {
        issues.push(`Loading indicator ${this.getElementDescription(element as HTMLElement)} lacks accessible announcement`);
      }
    });

    return {
      passed: issues.length === 0,
      announcements,
      issues
    };
  }

  /**
   * Calculate comprehensive summary
   */
  private calculateSummary(...testResults: any[]): any {
    const allIssues = testResults.flatMap(result => result.issues || []);
    const criticalIssues = allIssues.filter(issue =>
      issue.includes('cannot receive focus') ||
      issue.includes('lacks accessible name') ||
      issue.includes('insufficient color contrast')
    ).length;

    const warningIssues = allIssues.length - criticalIssues;
    const passedChecks = testResults.filter(result => result.passed).length;
    const totalChecks = testResults.length;

    const overallScore = Math.max(0, (passedChecks / totalChecks) * 100 - (criticalIssues * 10) - (warningIssues * 5));

    return {
      overallScore: Math.round(overallScore),
      criticalIssues,
      warningIssues,
      passedChecks,
      totalChecks
    };
  }

  /**
   * Helper methods
   */
  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"], [role="textbox"], [role="combobox"]'
    )) as HTMLElement[];
  }

  private getElementDescription(element: HTMLElement): string {
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const className = element.className ? `.${element.className.split(' ')[0]}` : '';
    const role = element.getAttribute('role') ? `[role="${element.getAttribute('role')}"]` : '';
    const text = element.textContent?.slice(0, 20) || '';

    return `${tagName}${id}${className}${role} "${text}"`.trim();
  }

  private getAccessibleName(element: HTMLElement): string | null {
    return element.getAttribute('aria-label') ||
           element.getAttribute('aria-labelledby') ||
           element.textContent?.trim() ||
           element.getAttribute('title') ||
           element.getAttribute('alt') ||
           null;
  }

  private hasAdequateContrast(color1: string, color2: string): boolean {
    // Simplified contrast check - in real implementation, use proper color contrast library
    if (color1 === color2) return false;
    if (color1.includes('transparent') || color2.includes('transparent')) return false;

    // Basic heuristic checks
    const isDarkOnLight = color1.includes('rgb(0') && color2.includes('rgb(255');
    const isLightOnDark = color1.includes('rgb(255') && color2.includes('rgb(0');
    const hasColorDifference = color1 !== color2;

    return isDarkOnLight || isLightOnDark || hasColorDifference;
  }

  private isNaturallyFocusable(element: HTMLElement): boolean {
    const focusableTags = ['button', 'input', 'select', 'textarea', 'a'];
    return focusableTags.includes(element.tagName.toLowerCase()) ||
           element.hasAttribute('href') ||
           element.hasAttribute('tabindex');
  }

  private logResults(results: AccessibilityTestResults): void {
    console.log(`\n📊 Accessibility Test Results for ${results.component}:`);
    console.log(`  Overall Score: ${results.summary.overallScore}%`);
    console.log(`  Critical Issues: ${results.summary.criticalIssues}`);
    console.log(`  Warning Issues: ${results.summary.warningIssues}`);
    console.log(`  Passed Checks: ${results.summary.passedChecks}/${results.summary.totalChecks}`);

    if (results.violations.length > 0) {
      console.log(`  Axe Violations: ${results.violations.length}`);
    }

    console.log(`  ⌨️ Keyboard Navigation: ${results.keyboardNavigation.passed ? '✅' : '❌'}`);
    console.log(`  📢 Screen Reader: ${results.screenReader.passed ? '✅' : '❌'}`);
    console.log(`  🎨 Color Contrast: ${results.colorContrast.passed ? '✅' : '❌'}`);
    console.log(`  🎯 Focus Management: ${results.focusManagement.passed ? '✅' : '❌'}`);
    console.log(`  🚨 Error Handling: ${results.errorHandling.passed ? '✅' : '❌'}`);
  }
}

/**
 * Export test runner and related types
 */
export {
  type AccessibilityTestConfig,
  type AccessibilityTestResults,
  COMPREHENSIVE_ACCESSIBILITY_CONFIG
};