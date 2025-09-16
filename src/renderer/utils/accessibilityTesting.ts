/**
 * Accessibility Testing and WCAG 2.1 AA Validation Utilities
 * Provides automated testing for accessibility compliance
 */

export interface AccessibilityTestResult {
  rule: string;
  level: 'A' | 'AA' | 'AAA';
  status: 'pass' | 'fail' | 'warning';
  element?: HTMLElement;
  message: string;
  impact: 'low' | 'moderate' | 'serious' | 'critical';
  howToFix?: string;
}

export interface AccessibilityTestSuite {
  name: string;
  description: string;
  tests: AccessibilityTest[];
}

export interface AccessibilityTest {
  name: string;
  description: string;
  level: 'A' | 'AA' | 'AAA';
  category: 'perceivable' | 'operable' | 'understandable' | 'robust';
  test: (container?: HTMLElement) => AccessibilityTestResult[];
}

/**
 * Color contrast testing utilities
 */
export class ContrastTester {
  /**
   * Calculate relative luminance of a color
   */
  private static getRelativeLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
      const sRGB = c / 255;
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Calculate contrast ratio between two colors
   */
  static getContrastRatio(color1: string, color2: string): number {
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);
    
    if (!rgb1 || !rgb2) return 0;

    const l1 = this.getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
    const l2 = this.getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);
    
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Convert hex color to RGB
   */
  private static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * Get computed color of an element
   */
  static getElementColor(element: HTMLElement): { color: string; backgroundColor: string } {
    const computed = window.getComputedStyle(element);
    return {
      color: computed.color,
      backgroundColor: computed.backgroundColor
    };
  }

  /**
   * Check if contrast ratio meets WCAG standards
   */
  static meetsContrastRequirement(
    ratio: number, 
    level: 'AA' | 'AAA' = 'AA', 
    size: 'normal' | 'large' = 'normal'
  ): boolean {
    const requirements = {
      AA: { normal: 4.5, large: 3 },
      AAA: { normal: 7, large: 4.5 }
    };
    return ratio >= requirements[level][size];
  }
}

/**
 * Keyboard navigation testing
 */
export class KeyboardTester {
  /**
   * Get all focusable elements in a container
   */
  static getFocusableElements(container: HTMLElement = document.body): HTMLElement[] {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([type="hidden"]):not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
  }

  /**
   * Test keyboard navigation order
   */
  static testTabOrder(container: HTMLElement = document.body): AccessibilityTestResult[] {
    const results: AccessibilityTestResult[] = [];
    const focusableElements = this.getFocusableElements(container);
    
    // Check if elements have logical tab order
    for (let i = 0; i < focusableElements.length - 1; i++) {
      const current = focusableElements[i];
      const next = focusableElements[i + 1];
      
      const currentRect = current.getBoundingClientRect();
      const nextRect = next.getBoundingClientRect();
      
      // Simple heuristic: next element should be to the right or below
      if (nextRect.top < currentRect.top - 10 && nextRect.left < currentRect.right) {
        results.push({
          rule: 'keyboard-navigation-order',
          level: 'A',
          status: 'warning',
          element: current,
          message: 'Tab order may not follow visual layout',
          impact: 'moderate',
          howToFix: 'Ensure tab order follows logical reading order'
        });
      }
    }

    return results;
  }

  /**
   * Test for keyboard traps
   */
  static testKeyboardTraps(container: HTMLElement = document.body): AccessibilityTestResult[] {
    const results: AccessibilityTestResult[] = [];
    const focusableElements = this.getFocusableElements(container);
    
    // Check for elements that might create keyboard traps
    focusableElements.forEach(element => {
      if (element.hasAttribute('onkeydown') || element.hasAttribute('onkeyup')) {
        const handlers = element.getAttribute('onkeydown') || element.getAttribute('onkeyup') || '';
        if (handlers.includes('preventDefault') && !handlers.includes('Escape')) {
          results.push({
            rule: 'keyboard-trap-avoidance',
            level: 'A',
            status: 'warning',
            element,
            message: 'Element may create a keyboard trap',
            impact: 'serious',
            howToFix: 'Ensure users can navigate away using keyboard only'
          });
        }
      }
    });

    return results;
  }
}

/**
 * ARIA testing utilities
 */
export class ARIATester {
  /**
   * Test for proper ARIA label usage
   */
  static testARIALabels(container: HTMLElement = document.body): AccessibilityTestResult[] {
    const results: AccessibilityTestResult[] = [];
    
    // Elements that should have accessible names
    const elementsNeedingLabels = container.querySelectorAll('button, input, textarea, select, [role="button"], [role="textbox"]');
    
    elementsNeedingLabels.forEach(element => {
      const el = element as HTMLElement;
      const hasLabel = this.hasAccessibleName(el);
      
      if (!hasLabel) {
        results.push({
          rule: 'aria-accessible-name',
          level: 'A',
          status: 'fail',
          element: el,
          message: 'Interactive element lacks accessible name',
          impact: 'serious',
          howToFix: 'Add aria-label, aria-labelledby, or proper label element'
        });
      }
    });

    return results;
  }

  /**
   * Check if element has accessible name
   */
  private static hasAccessibleName(element: HTMLElement): boolean {
    // Check aria-label
    if (element.getAttribute('aria-label')) return true;
    
    // Check aria-labelledby
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy && document.getElementById(labelledBy)) return true;
    
    // Check associated label
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label && label.textContent?.trim()) return true;
    }
    
    // Check if wrapped in label
    const parentLabel = element.closest('label');
    if (parentLabel && parentLabel.textContent?.trim()) return true;
    
    // Check text content for buttons
    if (element.tagName.toLowerCase() === 'button' && element.textContent?.trim()) {
      return true;
    }
    
    return false;
  }

  /**
   * Test for proper heading structure
   */
  static testHeadingStructure(container: HTMLElement = document.body): AccessibilityTestResult[] {
    const results: AccessibilityTestResult[] = [];
    const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[];
    
    if (headings.length === 0) {
      results.push({
        rule: 'heading-structure',
        level: 'AA',
        status: 'warning',
        message: 'No headings found - consider adding page structure',
        impact: 'moderate',
        howToFix: 'Add heading elements to structure your content'
      });
      return results;
    }

    // Check if page starts with h1
    const firstHeading = headings[0];
    if (firstHeading.tagName.toLowerCase() !== 'h1') {
      results.push({
        rule: 'heading-structure',
        level: 'AA',
        status: 'fail',
        element: firstHeading,
        message: 'Page should start with h1 heading',
        impact: 'moderate',
        howToFix: 'Use h1 for the main page heading'
      });
    }

    // Check for skipped heading levels
    for (let i = 1; i < headings.length; i++) {
      const current = parseInt(headings[i].tagName.slice(1));
      const previous = parseInt(headings[i - 1].tagName.slice(1));
      
      if (current > previous + 1) {
        results.push({
          rule: 'heading-structure',
          level: 'AA',
          status: 'fail',
          element: headings[i],
          message: `Heading level skipped from h${previous} to h${current}`,
          impact: 'moderate',
          howToFix: 'Don\'t skip heading levels - use sequential order'
        });
      }
    }

    return results;
  }

  /**
   * Test for proper form labels
   */
  static testFormLabels(container: HTMLElement = document.body): AccessibilityTestResult[] {
    const results: AccessibilityTestResult[] = [];
    const formControls = container.querySelectorAll('input:not([type="hidden"]), textarea, select');
    
    formControls.forEach(control => {
      const el = control as HTMLElement;
      const hasLabel = this.hasAccessibleName(el);
      
      if (!hasLabel) {
        results.push({
          rule: 'form-label',
          level: 'A',
          status: 'fail',
          element: el,
          message: 'Form control lacks proper label',
          impact: 'serious',
          howToFix: 'Associate label with form control using for/id or aria-label'
        });
      }
    });

    return results;
  }
}

/**
 * Main accessibility test suite
 */
export class AccessibilityValidator {
  private testSuites: AccessibilityTestSuite[] = [];

  constructor() {
    this.initializeTestSuites();
  }

  private initializeTestSuites(): void {
    this.testSuites = [
      {
        name: 'Color Contrast',
        description: 'Test color contrast ratios for WCAG compliance',
        tests: [
          {
            name: 'Text Contrast',
            description: 'Ensure text has sufficient contrast against background',
            level: 'AA',
            category: 'perceivable',
            test: (container = document.body) => this.testTextContrast(container)
          }
        ]
      },
      {
        name: 'Keyboard Navigation',
        description: 'Test keyboard accessibility and focus management',
        tests: [
          {
            name: 'Tab Order',
            description: 'Check logical keyboard navigation order',
            level: 'A',
            category: 'operable',
            test: (container = document.body) => KeyboardTester.testTabOrder(container)
          },
          {
            name: 'Keyboard Traps',
            description: 'Detect potential keyboard traps',
            level: 'A',
            category: 'operable',
            test: (container = document.body) => KeyboardTester.testKeyboardTraps(container)
          }
        ]
      },
      {
        name: 'ARIA and Semantics',
        description: 'Test ARIA implementation and semantic markup',
        tests: [
          {
            name: 'ARIA Labels',
            description: 'Check for proper ARIA labeling',
            level: 'A',
            category: 'perceivable',
            test: (container = document.body) => ARIATester.testARIALabels(container)
          },
          {
            name: 'Heading Structure',
            description: 'Validate heading hierarchy',
            level: 'AA',
            category: 'perceivable',
            test: (container = document.body) => ARIATester.testHeadingStructure(container)
          },
          {
            name: 'Form Labels',
            description: 'Check form control labeling',
            level: 'A',
            category: 'perceivable',
            test: (container = document.body) => ARIATester.testFormLabels(container)
          }
        ]
      }
    ];
  }

  /**
   * Test text contrast in container
   */
  private testTextContrast(container: HTMLElement): AccessibilityTestResult[] {
    const results: AccessibilityTestResult[] = [];
    const textElements = container.querySelectorAll('p, span, a, button, label, h1, h2, h3, h4, h5, h6, li, td, th');
    
    textElements.forEach(element => {
      const el = element as HTMLElement;
      const computed = window.getComputedStyle(el);
      const color = computed.color;
      const backgroundColor = computed.backgroundColor;
      
      // Skip if transparent or not visible
      if (color === 'rgba(0, 0, 0, 0)' || backgroundColor === 'rgba(0, 0, 0, 0)') {
        return;
      }
      
      try {
        const ratio = ContrastTester.getContrastRatio(color, backgroundColor);
        const fontSize = parseFloat(computed.fontSize);
        const fontWeight = computed.fontWeight;
        const isLarge = fontSize >= 18 || (fontSize >= 14 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700));
        
        const meetsAA = ContrastTester.meetsContrastRequirement(ratio, 'AA', isLarge ? 'large' : 'normal');
        
        if (!meetsAA) {
          results.push({
            rule: 'color-contrast',
            level: 'AA',
            status: 'fail',
            element: el,
            message: `Color contrast ratio ${ratio.toFixed(2)}:1 is insufficient`,
            impact: 'serious',
            howToFix: `Increase contrast to at least ${isLarge ? '3:1' : '4.5:1'}`
          });
        }
      } catch (error) {
        // Skip elements where contrast can't be calculated
      }
    });
    
    return results;
  }

  /**
   * Run all accessibility tests
   */
  runAllTests(container?: HTMLElement): AccessibilityTestResult[] {
    const allResults: AccessibilityTestResult[] = [];
    
    this.testSuites.forEach(suite => {
      suite.tests.forEach(test => {
        const results = test.test(container);
        allResults.push(...results);
      });
    });
    
    return allResults;
  }

  /**
   * Run tests by category
   */
  runTestsByCategory(category: 'perceivable' | 'operable' | 'understandable' | 'robust', container?: HTMLElement): AccessibilityTestResult[] {
    const results: AccessibilityTestResult[] = [];
    
    this.testSuites.forEach(suite => {
      suite.tests
        .filter(test => test.category === category)
        .forEach(test => {
          const testResults = test.test(container);
          results.push(...testResults);
        });
    });
    
    return results;
  }

  /**
   * Run tests by WCAG level
   */
  runTestsByLevel(level: 'A' | 'AA' | 'AAA', container?: HTMLElement): AccessibilityTestResult[] {
    const results: AccessibilityTestResult[] = [];
    
    this.testSuites.forEach(suite => {
      suite.tests
        .filter(test => test.level === level)
        .forEach(test => {
          const testResults = test.test(container);
          results.push(...testResults);
        });
    });
    
    return results;
  }

  /**
   * Generate accessibility report
   */
  generateReport(results: AccessibilityTestResult[]): {
    summary: {
      total: number;
      passed: number;
      failed: number;
      warnings: number;
      critical: number;
      serious: number;
      moderate: number;
      low: number;
    };
    results: AccessibilityTestResult[];
  } {
    return {
      summary: {
        total: results.length,
        passed: results.filter(r => r.status === 'pass').length,
        failed: results.filter(r => r.status === 'fail').length,
        warnings: results.filter(r => r.status === 'warning').length,
        critical: results.filter(r => r.impact === 'critical').length,
        serious: results.filter(r => r.impact === 'serious').length,
        moderate: results.filter(r => r.impact === 'moderate').length,
        low: results.filter(r => r.impact === 'low').length
      },
      results
    };
  }
}

// Export singleton instance
export const accessibilityValidator = new AccessibilityValidator();

// Development helper function
export const runA11yTest = (container?: HTMLElement): void => {
  if (process.env.NODE_ENV === 'development') {
    const results = accessibilityValidator.runAllTests(container);
    const report = accessibilityValidator.generateReport(results);
    
    console.group('🔍 Accessibility Test Results');
    console.log('Summary:', report.summary);
    
    if (report.results.length > 0) {
      console.group('Issues Found:');
      report.results.forEach(result => {
        const icon = result.status === 'fail' ? '❌' : '⚠️';
        console[result.status === 'fail' ? 'error' : 'warn'](
          `${icon} ${result.rule}: ${result.message}`,
          result.element || ''
        );
      });
      console.groupEnd();
    } else {
      console.log('✅ All tests passed!');
    }
    
    console.groupEnd();
  }
};