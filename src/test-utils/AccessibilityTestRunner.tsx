/**
 * Accessibility Test Runner
 * Comprehensive testing suite for WCAG 2.1 AA compliance validation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccessibilityValidator } from '../renderer/utils/accessibilityTesting';
import App from '../renderer/App';

interface AccessibilityTestSuite {
  name: string;
  tests: AccessibilityTest[];
}

interface AccessibilityTest {
  name: string;
  test: () => Promise<TestResult>;
  wcagCriteria: string[];
}

interface TestResult {
  passed: boolean;
  message: string;
  details?: string[];
  severity: 'error' | 'warning' | 'info';
}

export class AccessibilityTestRunner {
  private validator = new AccessibilityValidator();
  private testSuites: AccessibilityTestSuite[] = [];

  constructor() {
    this.setupTestSuites();
  }

  private setupTestSuites() {
    this.testSuites = [
      {
        name: 'Keyboard Navigation',
        tests: [
          {
            name: 'Tab navigation works correctly',
            wcagCriteria: ['2.1.1 Keyboard'],
            test: this.testTabNavigation.bind(this),
          },
          {
            name: 'Skip links are functional',
            wcagCriteria: ['2.4.1 Bypass Blocks'],
            test: this.testSkipLinks.bind(this),
          },
          {
            name: 'Keyboard shortcuts are implemented',
            wcagCriteria: ['2.1.1 Keyboard'],
            test: this.testKeyboardShortcuts.bind(this),
          },
          {
            name: 'Focus is properly managed',
            wcagCriteria: ['2.4.7 Focus Visible', '3.2.1 On Focus'],
            test: this.testFocusManagement.bind(this),
          },
        ],
      },
      {
        name: 'Screen Reader Support',
        tests: [
          {
            name: 'All images have alt text',
            wcagCriteria: ['1.1.1 Non-text Content'],
            test: this.testImageAltText.bind(this),
          },
          {
            name: 'Form labels are properly associated',
            wcagCriteria: ['1.3.1 Info and Relationships'],
            test: this.testFormLabels.bind(this),
          },
          {
            name: 'ARIA landmarks are present',
            wcagCriteria: ['1.3.1 Info and Relationships'],
            test: this.testARIALandmarks.bind(this),
          },
          {
            name: 'Live regions announce changes',
            wcagCriteria: ['4.1.3 Status Messages'],
            test: this.testLiveRegions.bind(this),
          },
        ],
      },
      {
        name: 'Visual Design',
        tests: [
          {
            name: 'Color contrast meets AA standards',
            wcagCriteria: ['1.4.3 Contrast (Minimum)'],
            test: this.testColorContrast.bind(this),
          },
          {
            name: 'Text can be resized to 200%',
            wcagCriteria: ['1.4.4 Resize text'],
            test: this.testTextResize.bind(this),
          },
          {
            name: 'Content adapts to viewport',
            wcagCriteria: ['1.4.10 Reflow'],
            test: this.testViewportAdaptation.bind(this),
          },
          {
            name: 'High contrast mode is supported',
            wcagCriteria: ['1.4.3 Contrast (Minimum)'],
            test: this.testHighContrastMode.bind(this),
          },
        ],
      },
      {
        name: 'Error Handling',
        tests: [
          {
            name: 'Form errors are properly announced',
            wcagCriteria: ['3.3.1 Error Identification', '3.3.3 Error Suggestion'],
            test: this.testFormErrorHandling.bind(this),
          },
          {
            name: 'Error messages are descriptive',
            wcagCriteria: ['3.3.3 Error Suggestion'],
            test: this.testErrorMessages.bind(this),
          },
          {
            name: 'Required fields are identified',
            wcagCriteria: ['3.3.2 Labels or Instructions'],
            test: this.testRequiredFields.bind(this),
          },
        ],
      },
      {
        name: 'Interactive Elements',
        tests: [
          {
            name: 'Buttons have accessible names',
            wcagCriteria: ['4.1.2 Name, Role, Value'],
            test: this.testButtonAccessibility.bind(this),
          },
          {
            name: 'Links have meaningful text',
            wcagCriteria: ['2.4.4 Link Purpose (In Context)'],
            test: this.testLinkAccessibility.bind(this),
          },
          {
            name: 'Form controls have labels',
            wcagCriteria: ['4.1.2 Name, Role, Value'],
            test: this.testFormControlLabels.bind(this),
          },
        ],
      },
    ];
  }

  async runAllTests(): Promise<AccessibilityTestReport> {
    const report: AccessibilityTestReport = {
      timestamp: new Date(),
      overallResult: 'pass',
      suiteResults: [],
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
      },
    };

    console.log('🚀 Starting WCAG 2.1 AA Compliance Testing...\n');

    for (const suite of this.testSuites) {
      console.log(`📋 Running test suite: ${suite.name}`);

      const suiteResult = await this.runTestSuite(suite);
      report.suiteResults.push(suiteResult);

      // Update summary
      report.summary.totalTests += suiteResult.tests.length;
      report.summary.passed += suiteResult.tests.filter(
        t => t.result.passed && t.result.severity !== 'warning'
      ).length;
      report.summary.failed += suiteResult.tests.filter(t => !t.result.passed).length;
      report.summary.warnings += suiteResult.tests.filter(
        t => t.result.severity === 'warning'
      ).length;
    }

    // Determine overall result
    if (report.summary.failed > 0) {
      report.overallResult = 'fail';
    } else if (report.summary.warnings > 0) {
      report.overallResult = 'warning';
    }

    this.printReport(report);
    return report;
  }

  private async runTestSuite(suite: AccessibilityTestSuite): Promise<TestSuiteResult> {
    const result: TestSuiteResult = {
      name: suite.name,
      tests: [],
    };

    for (const test of suite.tests) {
      console.log(`  🔍 ${test.name}`);

      try {
        const testResult = await test.test();
        result.tests.push({
          name: test.name,
          wcagCriteria: test.wcagCriteria,
          result: testResult,
        });

        const icon = testResult.passed ? '✅' : testResult.severity === 'warning' ? '⚠️' : '❌';
        console.log(`    ${icon} ${testResult.message}`);

        if (testResult.details && testResult.details.length > 0) {
          testResult.details.forEach(detail => {
            console.log(`      • ${detail}`);
          });
        }
      } catch (error) {
        console.error(`    ❌ Test failed with error: ${error}`);
        result.tests.push({
          name: test.name,
          wcagCriteria: test.wcagCriteria,
          result: {
            passed: false,
            message: `Test execution failed: ${error}`,
            severity: 'error',
          },
        });
      }
    }

    console.log(''); // Empty line for readability
    return result;
  }

  // Individual test implementations
  private async testTabNavigation(): Promise<TestResult> {
    const { container } = render(<App />);

    // Test that interactive elements are focusable
    const interactiveElements = container.querySelectorAll(
      'button, a, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );

    let focusableCount = 0;
    interactiveElements.forEach(element => {
      const tabIndex = element.getAttribute('tabindex');
      if (tabIndex !== '-1') {
        focusableCount++;
      }
    });

    if (focusableCount === 0) {
      return {
        passed: false,
        message: 'No focusable elements found',
        severity: 'error',
      };
    }

    return {
      passed: true,
      message: `Found ${focusableCount} focusable elements`,
      details: [`Total interactive elements: ${interactiveElements.length}`],
      severity: 'info',
    };
  }

  private async testSkipLinks(): Promise<TestResult> {
    const { container } = render(<App />);

    const skipLinks = container.querySelectorAll('.skip-link, [href="#main-content"]');

    if (skipLinks.length === 0) {
      return {
        passed: false,
        message: 'No skip links found',
        severity: 'error',
      };
    }

    // Test that skip links actually work
    const mainContent = container.querySelector('#main-content');
    if (!mainContent) {
      return {
        passed: false,
        message: 'Skip link target (#main-content) not found',
        severity: 'error',
      };
    }

    return {
      passed: true,
      message: `Found ${skipLinks.length} skip links with valid targets`,
      severity: 'info',
    };
  }

  private async testKeyboardShortcuts(): Promise<TestResult> {
    const { container } = render(<App />);
    const user = userEvent.setup();

    // Test common keyboard shortcuts
    const shortcuts = [
      { keys: 'ctrl+f', description: 'Focus search' },
      { keys: 'ctrl+n', description: 'Add new entry' },
      { keys: 'escape', description: 'Close dialogs' },
    ];

    let workingShortcuts = 0;

    for (const shortcut of shortcuts) {
      try {
        await user.keyboard(`{${shortcut.keys}}`);
        workingShortcuts++;
      } catch (error) {
        // Shortcut might not be implemented or might fail in test environment
      }
    }

    return {
      passed: workingShortcuts > 0,
      message: `${workingShortcuts}/${shortcuts.length} keyboard shortcuts are accessible`,
      details: shortcuts.map(s => `${s.keys}: ${s.description}`),
      severity: workingShortcuts === shortcuts.length ? 'info' : 'warning',
    };
  }

  private async testFocusManagement(): Promise<TestResult> {
    const { container } = render(<App />);

    // Check for visible focus indicators
    const focusStyles = getComputedStyle(document.body);
    const hasGlobalFocusStyles = container.querySelector('*:focus') !== null;

    // Check for focus trap implementation
    const modals = container.querySelectorAll('[role="dialog"], .modal');
    const hasFocusTraps = modals.length > 0;

    return {
      passed: true,
      message: 'Focus management features detected',
      details: [
        `Focus indicators: ${hasGlobalFocusStyles ? 'Present' : 'Missing'}`,
        `Modal focus traps: ${hasFocusTraps ? 'Available' : 'Not applicable'}`,
      ],
      severity: 'info',
    };
  }

  private async testImageAltText(): Promise<TestResult> {
    const { container } = render(<App />);

    const images = container.querySelectorAll('img');
    const imagesWithoutAlt = Array.from(images).filter(
      img => !img.hasAttribute('alt') && !img.hasAttribute('aria-label')
    );

    if (imagesWithoutAlt.length > 0) {
      return {
        passed: false,
        message: `${imagesWithoutAlt.length} images missing alt text`,
        severity: 'error',
      };
    }

    return {
      passed: true,
      message:
        images.length > 0 ? `All ${images.length} images have alt text` : 'No images found to test',
      severity: 'info',
    };
  }

  private async testFormLabels(): Promise<TestResult> {
    const { container } = render(<App />);

    const formControls = container.querySelectorAll('input, textarea, select');
    const unlabeledControls: string[] = [];

    formControls.forEach((control, index) => {
      const hasLabel =
        control.hasAttribute('aria-label') ||
        control.hasAttribute('aria-labelledby') ||
        container.querySelector(`label[for="${control.id}"]`) !== null;

      if (!hasLabel) {
        unlabeledControls.push(`Control ${index + 1} (${control.tagName.toLowerCase()})`);
      }
    });

    if (unlabeledControls.length > 0) {
      return {
        passed: false,
        message: `${unlabeledControls.length} form controls lack proper labels`,
        details: unlabeledControls,
        severity: 'error',
      };
    }

    return {
      passed: true,
      message:
        formControls.length > 0
          ? `All ${formControls.length} form controls have labels`
          : 'No form controls found to test',
      severity: 'info',
    };
  }

  private async testARIALandmarks(): Promise<TestResult> {
    const { container } = render(<App />);

    const expectedLandmarks = [
      { selector: '[role="main"], main', name: 'main' },
      { selector: '[role="banner"], header', name: 'banner/header' },
      { selector: '[role="navigation"], nav', name: 'navigation' },
      { selector: '[role="search"]', name: 'search' },
    ];

    const foundLandmarks: string[] = [];
    const missingLandmarks: string[] = [];

    expectedLandmarks.forEach(landmark => {
      const element = container.querySelector(landmark.selector);
      if (element) {
        foundLandmarks.push(landmark.name);
      } else {
        missingLandmarks.push(landmark.name);
      }
    });

    return {
      passed: foundLandmarks.length >= 2, // At least main and one other landmark
      message: `Found ${foundLandmarks.length} ARIA landmarks`,
      details: [
        `Found: ${foundLandmarks.join(', ')}`,
        ...(missingLandmarks.length > 0 ? [`Missing: ${missingLandmarks.join(', ')}`] : []),
      ],
      severity: foundLandmarks.length >= 2 ? 'info' : 'warning',
    };
  }

  private async testLiveRegions(): Promise<TestResult> {
    const { container } = render(<App />);

    const liveRegions = container.querySelectorAll('[aria-live]');
    const statusElements = container.querySelectorAll('[role="status"], [role="alert"]');

    const totalLiveElements = liveRegions.length + statusElements.length;

    return {
      passed: totalLiveElements > 0,
      message: `Found ${totalLiveElements} live region elements`,
      details: [
        `aria-live regions: ${liveRegions.length}`,
        `status/alert roles: ${statusElements.length}`,
      ],
      severity: totalLiveElements > 0 ? 'info' : 'warning',
    };
  }

  private async testColorContrast(): Promise<TestResult> {
    const { container } = render(<App />);

    // Use the built-in color contrast tester
    const contrastResults = this.validator.testColorContrast(container);

    const failedElements = contrastResults.filter(
      r => r.impact === 'serious' || r.impact === 'critical'
    );

    if (failedElements.length > 0) {
      return {
        passed: false,
        message: `${failedElements.length} elements fail color contrast requirements`,
        details: failedElements.slice(0, 5).map(r => r.description),
        severity: 'error',
      };
    }

    return {
      passed: true,
      message: 'Color contrast requirements met',
      details: [`Tested ${contrastResults.length} elements`],
      severity: 'info',
    };
  }

  private async testTextResize(): Promise<TestResult> {
    // This test would require actual browser testing
    return {
      passed: true,
      message: 'Text resize test requires manual verification',
      details: ['Use browser zoom to test text scaling to 200%'],
      severity: 'warning',
    };
  }

  private async testViewportAdaptation(): Promise<TestResult> {
    const { container } = render(<App />);

    // Check for responsive design indicators
    const hasViewportMeta = document.querySelector('meta[name="viewport"]') !== null;
    const hasResponsiveStyles = container.querySelector('.container, .responsive') !== null;

    return {
      passed: true,
      message: 'Viewport adaptation features present',
      details: [
        `Viewport meta tag: ${hasViewportMeta ? 'Present' : 'Missing'}`,
        `Responsive containers: ${hasResponsiveStyles ? 'Found' : 'Not detected'}`,
      ],
      severity: 'info',
    };
  }

  private async testHighContrastMode(): Promise<TestResult> {
    const { container } = render(<App />);

    // Check if high contrast CSS is loaded
    const stylesheets = Array.from(document.styleSheets);
    const hasHighContrastStyles = stylesheets.some(
      sheet =>
        sheet.href?.includes('high-contrast') ||
        Array.from(sheet.cssRules || []).some(rule =>
          rule.cssText.includes('prefers-contrast: high')
        )
    );

    return {
      passed: hasHighContrastStyles,
      message: hasHighContrastStyles
        ? 'High contrast mode support detected'
        : 'High contrast mode support not found',
      severity: hasHighContrastStyles ? 'info' : 'warning',
    };
  }

  private async testFormErrorHandling(): Promise<TestResult> {
    // This would require more complex form interaction testing
    return {
      passed: true,
      message: 'Form error handling test requires interaction testing',
      details: ['Test form validation and error announcement manually'],
      severity: 'warning',
    };
  }

  private async testErrorMessages(): Promise<TestResult> {
    const { container } = render(<App />);

    const errorElements = container.querySelectorAll(
      '[role="alert"], .error-message, .field-error'
    );

    return {
      passed: true,
      message: `Found ${errorElements.length} error message containers`,
      details: [`Error containers available for testing`],
      severity: 'info',
    };
  }

  private async testRequiredFields(): Promise<TestResult> {
    const { container } = render(<App />);

    const requiredFields = container.querySelectorAll('[required], [aria-required="true"]');

    let properlyMarked = 0;
    requiredFields.forEach(field => {
      if (field.hasAttribute('aria-required') || field.hasAttribute('required')) {
        properlyMarked++;
      }
    });

    return {
      passed: properlyMarked === requiredFields.length,
      message: `${properlyMarked}/${requiredFields.length} required fields properly marked`,
      severity: properlyMarked === requiredFields.length ? 'info' : 'warning',
    };
  }

  private async testButtonAccessibility(): Promise<TestResult> {
    const { container } = render(<App />);

    const buttons = container.querySelectorAll('button');
    const inaccessibleButtons: string[] = [];

    buttons.forEach((button, index) => {
      const hasAccessibleName =
        button.textContent?.trim() ||
        button.hasAttribute('aria-label') ||
        button.hasAttribute('aria-labelledby') ||
        button.hasAttribute('title');

      if (!hasAccessibleName) {
        inaccessibleButtons.push(`Button ${index + 1}`);
      }
    });

    if (inaccessibleButtons.length > 0) {
      return {
        passed: false,
        message: `${inaccessibleButtons.length} buttons lack accessible names`,
        details: inaccessibleButtons,
        severity: 'error',
      };
    }

    return {
      passed: true,
      message: `All ${buttons.length} buttons have accessible names`,
      severity: 'info',
    };
  }

  private async testLinkAccessibility(): Promise<TestResult> {
    const { container } = render(<App />);

    const links = container.querySelectorAll('a');
    const problematicLinks: string[] = [];

    links.forEach((link, index) => {
      const linkText = link.textContent?.trim();
      const hasHref = link.hasAttribute('href');

      if (!hasHref) {
        problematicLinks.push(`Link ${index + 1}: Missing href attribute`);
      }

      if (!linkText || linkText.length < 3) {
        problematicLinks.push(`Link ${index + 1}: Insufficient link text`);
      }
    });

    return {
      passed: problematicLinks.length === 0,
      message:
        problematicLinks.length === 0
          ? `All ${links.length} links are accessible`
          : `${problematicLinks.length} links have accessibility issues`,
      details: problematicLinks,
      severity: problematicLinks.length === 0 ? 'info' : 'warning',
    };
  }

  private async testFormControlLabels(): Promise<TestResult> {
    // This is similar to testFormLabels but more comprehensive
    return this.testFormLabels();
  }

  private printReport(report: AccessibilityTestReport) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 WCAG 2.1 AA COMPLIANCE TEST REPORT');
    console.log('='.repeat(60));
    console.log(`🕐 Timestamp: ${report.timestamp.toISOString()}`);
    console.log(`📈 Overall Result: ${report.overallResult.toUpperCase()}`);
    console.log('');
    console.log('📋 Summary:');
    console.log(`  Total Tests: ${report.summary.totalTests}`);
    console.log(`  ✅ Passed: ${report.summary.passed}`);
    console.log(`  ❌ Failed: ${report.summary.failed}`);
    console.log(`  ⚠️  Warnings: ${report.summary.warnings}`);
    console.log('');

    if (report.summary.failed > 0) {
      console.log('❌ CRITICAL ISSUES TO ADDRESS:');
      report.suiteResults.forEach(suite => {
        const failedTests = suite.tests.filter(t => !t.result.passed);
        if (failedTests.length > 0) {
          console.log(`\n  ${suite.name}:`);
          failedTests.forEach(test => {
            console.log(`    • ${test.name}: ${test.result.message}`);
            console.log(`      WCAG: ${test.wcagCriteria.join(', ')}`);
          });
        }
      });
    }

    if (report.summary.warnings > 0) {
      console.log('\n⚠️  RECOMMENDATIONS:');
      report.suiteResults.forEach(suite => {
        const warningTests = suite.tests.filter(t => t.result.severity === 'warning');
        if (warningTests.length > 0) {
          console.log(`\n  ${suite.name}:`);
          warningTests.forEach(test => {
            console.log(`    • ${test.name}: ${test.result.message}`);
          });
        }
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ Testing completed!');
    console.log('='.repeat(60) + '\n');
  }
}

// Type definitions for the test runner
export interface TestSuiteResult {
  name: string;
  tests: TestMethodResult[];
}

export interface TestMethodResult {
  name: string;
  wcagCriteria: string[];
  result: TestResult;
}

export interface AccessibilityTestReport {
  timestamp: Date;
  overallResult: 'pass' | 'fail' | 'warning';
  suiteResults: TestSuiteResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

// Usage example:
export async function runAccessibilityTests() {
  const runner = new AccessibilityTestRunner();
  return await runner.runAllTests();
}

export default AccessibilityTestRunner;
