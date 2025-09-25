/**
 * WCAG 2.1 AA Compliance Validator
 *
 * This utility provides runtime validation for WCAG 2.1 AA compliance,
 * including automated checks and helpers for manual testing.
 */

export interface WCAGViolation {
  id: string;
  severity: 'error' | 'warning' | 'info';
  guideline: string;
  successCriterion: string;
  level: 'A' | 'AA' | 'AAA';
  element: Element | null;
  description: string;
  help: string;
  helpUrl: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
}

export interface ColorContrastResult {
  ratio: number;
  passes: boolean;
  level: 'AA' | 'AAA';
  foreground: string;
  background: string;
}

export interface FocusOrderResult {
  elements: Element[];
  violations: WCAGViolation[];
  tabOrder: number[];
}

export interface KeyboardNavigationResult {
  navigableElements: Element[];
  trapViolations: WCAGViolation[];
  missingTabIndex: Element[];
}

export interface AccessibilityAuditResult {
  violations: WCAGViolation[];
  passes: WCAGViolation[];
  incomplete: WCAGViolation[];
  inapplicable: WCAGViolation[];
  summary: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
  timestamp: Date;
  url: string;
}

export class WCAGValidator {
  private static instance: WCAGValidator | null = null;
  private observer: MutationObserver | null = null;
  private isRunning = false;

  static getInstance(): WCAGValidator {
    if (!WCAGValidator.instance) {
      WCAGValidator.instance = new WCAGValidator();
    }
    return WCAGValidator.instance;
  }

  /**
   * Start continuous validation during development
   */
  startRuntimeValidation(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.observer = new MutationObserver(mutations => {
      const hasSignificantChanges = mutations.some(
        mutation =>
          mutation.type === 'childList' ||
          (mutation.type === 'attributes' && this.isA11yRelevantAttribute(mutation.attributeName))
      );

      if (hasSignificantChanges) {
        this.validateCurrentPage();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'aria-label',
        'aria-labelledby',
        'aria-describedby',
        'role',
        'tabindex',
        'alt',
        'title',
        'for',
        'id',
        'disabled',
        'hidden',
        'aria-hidden',
        'aria-expanded',
        'aria-selected',
        'aria-checked',
      ],
    });

    console.log('🔍 WCAG Runtime Validation started');
  }

  /**
   * Stop runtime validation
   */
  stopRuntimeValidation(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.isRunning = false;
    console.log('⏹️ WCAG Runtime Validation stopped');
  }

  /**
   * Perform a comprehensive accessibility audit of the current page
   */
  async auditCurrentPage(): Promise<AccessibilityAuditResult> {
    const violations: WCAGViolation[] = [];
    const passes: WCAGViolation[] = [];
    const incomplete: WCAGViolation[] = [];

    // Run all WCAG checks
    const results = await Promise.all([
      this.checkImages(),
      this.checkHeadings(),
      this.checkForms(),
      this.checkButtons(),
      this.checkLinks(),
      this.checkColorContrast(),
      this.checkKeyboardNavigation(),
      this.checkFocusManagement(),
      this.checkLandmarks(),
      this.checkLiveRegions(),
      this.checkLanguage(),
      this.checkSkipLinks(),
    ]);

    // Aggregate results
    results.forEach(result => {
      violations.push(...result.violations);
      passes.push(...result.passes);
      incomplete.push(...result.incomplete);
    });

    const summary = this.calculateSummary(violations);

    return {
      violations,
      passes,
      incomplete,
      inapplicable: [],
      summary,
      timestamp: new Date(),
      url: window.location.href,
    };
  }

  /**
   * Check color contrast compliance (WCAG 2.1 1.4.3, 1.4.6)
   */
  checkColorContrast(): Promise<{ violations: WCAGViolation[]; passes: WCAGViolation[] }> {
    return new Promise(resolve => {
      const violations: WCAGViolation[] = [];
      const passes: WCAGViolation[] = [];

      const textElements = document.querySelectorAll(
        'p, span, div, h1, h2, h3, h4, h5, h6, a, button, input, label, li'
      );

      textElements.forEach(element => {
        if (this.isVisibleElement(element as HTMLElement)) {
          const contrastResult = this.calculateColorContrast(element as HTMLElement);

          if (contrastResult && !contrastResult.passes) {
            violations.push({
              id: 'color-contrast',
              severity: 'error',
              guideline: '1.4 Distinguishable',
              successCriterion: '1.4.3 Contrast (Minimum)',
              level: 'AA',
              element: element as Element,
              description: `Color contrast ratio ${contrastResult.ratio.toFixed(2)}:1 is insufficient`,
              help: 'Ensure text has sufficient color contrast against background',
              helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html',
              impact: 'serious',
            });
          } else if (contrastResult) {
            passes.push({
              id: 'color-contrast',
              severity: 'info',
              guideline: '1.4 Distinguishable',
              successCriterion: '1.4.3 Contrast (Minimum)',
              level: 'AA',
              element: element as Element,
              description: `Color contrast ratio ${contrastResult.ratio.toFixed(2)}:1 passes`,
              help: 'Text has sufficient color contrast',
              helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html',
              impact: 'minor',
            });
          }
        }
      });

      resolve({ violations, passes });
    });
  }

  /**
   * Check image accessibility (WCAG 2.1 1.1.1)
   */
  checkImages(): Promise<{
    violations: WCAGViolation[];
    passes: WCAGViolation[];
    incomplete: WCAGViolation[];
  }> {
    return new Promise(resolve => {
      const violations: WCAGViolation[] = [];
      const passes: WCAGViolation[] = [];
      const incomplete: WCAGViolation[] = [];

      const images = document.querySelectorAll('img, svg, [role="img"]');

      images.forEach(img => {
        const alt = img.getAttribute('alt');
        const role = img.getAttribute('role');
        const ariaLabel = img.getAttribute('aria-label');
        const ariaLabelledby = img.getAttribute('aria-labelledby');

        if (img.tagName.toLowerCase() === 'img') {
          if (!alt) {
            violations.push({
              id: 'image-alt',
              severity: 'error',
              guideline: '1.1 Text Alternatives',
              successCriterion: '1.1.1 Non-text Content',
              level: 'A',
              element: img,
              description: 'Image missing alt attribute',
              help: 'All img elements must have an alt attribute',
              helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html',
              impact: 'critical',
            });
          } else if (alt.trim() === '') {
            // Empty alt is valid for decorative images
            passes.push({
              id: 'image-alt',
              severity: 'info',
              guideline: '1.1 Text Alternatives',
              successCriterion: '1.1.1 Non-text Content',
              level: 'A',
              element: img,
              description: 'Decorative image with empty alt attribute',
              help: 'Decorative images should have empty alt attributes',
              helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html',
              impact: 'minor',
            });
          } else {
            passes.push({
              id: 'image-alt',
              severity: 'info',
              guideline: '1.1 Text Alternatives',
              successCriterion: '1.1.1 Non-text Content',
              level: 'A',
              element: img,
              description: 'Image has alt text',
              help: 'Image has appropriate alternative text',
              helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html',
              impact: 'minor',
            });
          }
        } else if (role === 'img') {
          if (!ariaLabel && !ariaLabelledby) {
            violations.push({
              id: 'image-alt',
              severity: 'error',
              guideline: '1.1 Text Alternatives',
              successCriterion: '1.1.1 Non-text Content',
              level: 'A',
              element: img,
              description: 'Element with role="img" missing accessible name',
              help: 'Elements with role="img" must have aria-label or aria-labelledby',
              helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html',
              impact: 'critical',
            });
          }
        }
      });

      resolve({ violations, passes, incomplete });
    });
  }

  /**
   * Check heading structure (WCAG 2.1 1.3.1, 2.4.6)
   */
  checkHeadings(): Promise<{
    violations: WCAGViolation[];
    passes: WCAGViolation[];
    incomplete: WCAGViolation[];
  }> {
    return new Promise(resolve => {
      const violations: WCAGViolation[] = [];
      const passes: WCAGViolation[] = [];
      const incomplete: WCAGViolation[] = [];

      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
      const headingLevels: number[] = [];

      headings.forEach((heading, index) => {
        const tagName = heading.tagName.toLowerCase();
        let level = 0;

        if (tagName.match(/^h[1-6]$/)) {
          level = parseInt(tagName.charAt(1));
        } else {
          const ariaLevel = heading.getAttribute('aria-level');
          level = ariaLevel ? parseInt(ariaLevel) : 1;
        }

        headingLevels.push(level);

        // Check for empty headings
        const text = this.getAccessibleText(heading as HTMLElement);
        if (!text.trim()) {
          violations.push({
            id: 'empty-heading',
            severity: 'error',
            guideline: '2.4 Navigable',
            successCriterion: '2.4.6 Headings and Labels',
            level: 'AA',
            element: heading,
            description: 'Heading element is empty',
            help: 'Headings must have accessible text content',
            helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html',
            impact: 'serious',
          });
        }

        // Check heading level sequence
        if (index > 0) {
          const previousLevel = headingLevels[index - 1];
          if (level > previousLevel + 1) {
            violations.push({
              id: 'heading-order',
              severity: 'warning',
              guideline: '1.3 Adaptable',
              successCriterion: '1.3.1 Info and Relationships',
              level: 'A',
              element: heading,
              description: `Heading level jumps from h${previousLevel} to h${level}`,
              help: 'Heading levels should not skip levels',
              helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html',
              impact: 'moderate',
            });
          }
        }
      });

      // Check for page title (h1)
      const h1Elements = document.querySelectorAll('h1, [role="heading"][aria-level="1"]');
      if (h1Elements.length === 0) {
        violations.push({
          id: 'page-has-heading-one',
          severity: 'warning',
          guideline: '2.4 Navigable',
          successCriterion: '2.4.6 Headings and Labels',
          level: 'AA',
          element: null,
          description: 'Page should have a heading level 1',
          help: 'Pages should have a main heading (h1) that describes the page content',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html',
          impact: 'moderate',
        });
      } else if (h1Elements.length > 1) {
        violations.push({
          id: 'page-has-heading-one',
          severity: 'warning',
          guideline: '2.4 Navigable',
          successCriterion: '2.4.6 Headings and Labels',
          level: 'AA',
          element: null,
          description: `Page has ${h1Elements.length} h1 elements, should have only one`,
          help: 'Pages should have exactly one main heading (h1)',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html',
          impact: 'moderate',
        });
      }

      resolve({ violations, passes, incomplete });
    });
  }

  /**
   * Check form accessibility (WCAG 2.1 1.3.1, 3.3.2, 4.1.2)
   */
  checkForms(): Promise<{
    violations: WCAGViolation[];
    passes: WCAGViolation[];
    incomplete: WCAGViolation[];
  }> {
    return new Promise(resolve => {
      const violations: WCAGViolation[] = [];
      const passes: WCAGViolation[] = [];
      const incomplete: WCAGViolation[] = [];

      const formControls = document.querySelectorAll(
        'input:not([type="hidden"]), select, textarea, [role="textbox"], [role="combobox"], [role="checkbox"], [role="radio"]'
      );

      formControls.forEach(control => {
        const accessibleName = this.getAccessibleName(control as HTMLElement);
        const hasLabel = this.hasLabel(control as HTMLElement);

        if (!accessibleName.trim()) {
          violations.push({
            id: 'label',
            severity: 'error',
            guideline: '4.1 Compatible',
            successCriterion: '4.1.2 Name, Role, Value',
            level: 'A',
            element: control,
            description: 'Form control missing accessible name',
            help: 'Form controls must have an accessible name',
            helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html',
            impact: 'critical',
          });
        }

        // Check for required fields
        const required =
          control.hasAttribute('required') || control.getAttribute('aria-required') === 'true';
        if (required) {
          const hasRequiredIndicator = this.hasRequiredIndicator(control as HTMLElement);
          if (!hasRequiredIndicator) {
            violations.push({
              id: 'required-field',
              severity: 'warning',
              guideline: '3.3 Input Assistance',
              successCriterion: '3.3.2 Labels or Instructions',
              level: 'A',
              element: control,
              description: 'Required field not clearly indicated',
              help: 'Required fields should be clearly marked',
              helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html',
              impact: 'moderate',
            });
          }
        }
      });

      resolve({ violations, passes, incomplete });
    });
  }

  /**
   * Check button accessibility (WCAG 2.1 4.1.2)
   */
  checkButtons(): Promise<{
    violations: WCAGViolation[];
    passes: WCAGViolation[];
    incomplete: WCAGViolation[];
  }> {
    return new Promise(resolve => {
      const violations: WCAGViolation[] = [];
      const passes: WCAGViolation[] = [];
      const incomplete: WCAGViolation[] = [];

      const buttons = document.querySelectorAll(
        'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]'
      );

      buttons.forEach(button => {
        const accessibleName = this.getAccessibleName(button as HTMLElement);

        if (!accessibleName.trim()) {
          violations.push({
            id: 'button-name',
            severity: 'error',
            guideline: '4.1 Compatible',
            successCriterion: '4.1.2 Name, Role, Value',
            level: 'A',
            element: button,
            description: 'Button missing accessible name',
            help: 'Buttons must have an accessible name',
            helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html',
            impact: 'critical',
          });
        }
      });

      resolve({ violations, passes, incomplete });
    });
  }

  /**
   * Check link accessibility (WCAG 2.1 2.4.4, 4.1.2)
   */
  checkLinks(): Promise<{
    violations: WCAGViolation[];
    passes: WCAGViolation[];
    incomplete: WCAGViolation[];
  }> {
    return new Promise(resolve => {
      const violations: WCAGViolation[] = [];
      const passes: WCAGViolation[] = [];
      const incomplete: WCAGViolation[] = [];

      const links = document.querySelectorAll('a[href], [role="link"]');

      links.forEach(link => {
        const accessibleName = this.getAccessibleName(link as HTMLElement);

        if (!accessibleName.trim()) {
          violations.push({
            id: 'link-name',
            severity: 'error',
            guideline: '2.4 Navigable',
            successCriterion: '2.4.4 Link Purpose (In Context)',
            level: 'A',
            element: link,
            description: 'Link missing accessible name',
            help: 'Links must have an accessible name that describes their purpose',
            helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html',
            impact: 'critical',
          });
        }
      });

      resolve({ violations, passes, incomplete });
    });
  }

  /**
   * Check keyboard navigation (WCAG 2.1 2.1.1, 2.1.2)
   */
  checkKeyboardNavigation(): Promise<{
    violations: WCAGViolation[];
    passes: WCAGViolation[];
    incomplete: WCAGViolation[];
  }> {
    return new Promise(resolve => {
      const violations: WCAGViolation[] = [];
      const passes: WCAGViolation[] = [];
      const incomplete: WCAGViolation[] = [];

      const interactiveElements = document.querySelectorAll(
        'a, button, input, select, textarea, [tabindex], [role="button"], [role="link"], [role="textbox"], [role="combobox"]'
      );

      interactiveElements.forEach(element => {
        const tabIndex = element.getAttribute('tabindex');

        // Check for positive tabindex values (anti-pattern)
        if (tabIndex && parseInt(tabIndex) > 0) {
          violations.push({
            id: 'tabindex',
            severity: 'warning',
            guideline: '2.4 Navigable',
            successCriterion: '2.4.3 Focus Order',
            level: 'A',
            element: element,
            description: 'Element uses positive tabindex value',
            help: 'Avoid positive tabindex values, use 0 or -1',
            helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-order.html',
            impact: 'moderate',
          });
        }

        // Check if interactive element is focusable
        if (tabIndex === '-1' && this.isNativelyFocusable(element as HTMLElement)) {
          violations.push({
            id: 'focusable-element',
            severity: 'warning',
            guideline: '2.1 Keyboard Accessible',
            successCriterion: '2.1.1 Keyboard',
            level: 'A',
            element: element,
            description: 'Interactive element removed from tab order',
            help: 'Interactive elements should be keyboard accessible',
            helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html',
            impact: 'serious',
          });
        }
      });

      resolve({ violations, passes, incomplete });
    });
  }

  /**
   * Check focus management (WCAG 2.1 2.4.3, 2.4.7)
   */
  checkFocusManagement(): Promise<{
    violations: WCAGViolation[];
    passes: WCAGViolation[];
    incomplete: WCAGViolation[];
  }> {
    return new Promise(resolve => {
      const violations: WCAGViolation[] = [];
      const passes: WCAGViolation[] = [];
      const incomplete: WCAGViolation[] = [];

      // Check for focus indicators
      const focusableElements = document.querySelectorAll(
        'a, button, input, select, textarea, [tabindex="0"], [role="button"], [role="link"]'
      );

      focusableElements.forEach(element => {
        // This is a simplified check - in a real implementation, you'd need to
        // simulate focus and check computed styles
        const styles = window.getComputedStyle(element as HTMLElement, ':focus');
        const outline = styles.outline;
        const boxShadow = styles.boxShadow;

        if (outline === 'none' && boxShadow === 'none') {
          incomplete.push({
            id: 'focus-indicator',
            severity: 'warning',
            guideline: '2.4 Navigable',
            successCriterion: '2.4.7 Focus Visible',
            level: 'AA',
            element: element,
            description: 'Element may not have visible focus indicator',
            help: 'Focusable elements should have a visible focus indicator',
            helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html',
            impact: 'moderate',
          });
        }
      });

      resolve({ violations, passes, incomplete });
    });
  }

  /**
   * Check landmarks (WCAG 2.1 1.3.1)
   */
  checkLandmarks(): Promise<{
    violations: WCAGViolation[];
    passes: WCAGViolation[];
    incomplete: WCAGViolation[];
  }> {
    return new Promise(resolve => {
      const violations: WCAGViolation[] = [];
      const passes: WCAGViolation[] = [];
      const incomplete: WCAGViolation[] = [];

      const landmarks = document.querySelectorAll(
        'main, nav, aside, header, footer, section, [role="main"], [role="navigation"], [role="complementary"], [role="banner"], [role="contentinfo"], [role="region"]'
      );

      // Check for main landmark
      const mainLandmarks = document.querySelectorAll('main, [role="main"]');
      if (mainLandmarks.length === 0) {
        violations.push({
          id: 'page-has-main',
          severity: 'warning',
          guideline: '1.3 Adaptable',
          successCriterion: '1.3.1 Info and Relationships',
          level: 'A',
          element: null,
          description: 'Page should have a main landmark',
          help: 'Pages should have a main element or role="main"',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html',
          impact: 'moderate',
        });
      } else if (mainLandmarks.length > 1) {
        violations.push({
          id: 'page-has-main',
          severity: 'warning',
          guideline: '1.3 Adaptable',
          successCriterion: '1.3.1 Info and Relationships',
          level: 'A',
          element: null,
          description: 'Page has multiple main landmarks',
          help: 'Pages should have only one main landmark',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html',
          impact: 'moderate',
        });
      }

      resolve({ violations, passes, incomplete });
    });
  }

  /**
   * Check live regions (WCAG 2.1 4.1.3)
   */
  checkLiveRegions(): Promise<{
    violations: WCAGViolation[];
    passes: WCAGViolation[];
    incomplete: WCAGViolation[];
  }> {
    return new Promise(resolve => {
      const violations: WCAGViolation[] = [];
      const passes: WCAGViolation[] = [];
      const incomplete: WCAGViolation[] = [];

      const liveRegions = document.querySelectorAll(
        '[aria-live], [role="alert"], [role="status"], [role="log"]'
      );

      liveRegions.forEach(region => {
        const ariaLive = region.getAttribute('aria-live');
        if (ariaLive && !['polite', 'assertive', 'off'].includes(ariaLive)) {
          violations.push({
            id: 'aria-live',
            severity: 'error',
            guideline: '4.1 Compatible',
            successCriterion: '4.1.3 Status Messages',
            level: 'AA',
            element: region,
            description: 'Invalid aria-live value',
            help: 'aria-live must be "polite", "assertive", or "off"',
            helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html',
            impact: 'serious',
          });
        }
      });

      resolve({ violations, passes, incomplete });
    });
  }

  /**
   * Check language attribute (WCAG 2.1 3.1.1, 3.1.2)
   */
  checkLanguage(): Promise<{
    violations: WCAGViolation[];
    passes: WCAGViolation[];
    incomplete: WCAGViolation[];
  }> {
    return new Promise(resolve => {
      const violations: WCAGViolation[] = [];
      const passes: WCAGViolation[] = [];
      const incomplete: WCAGViolation[] = [];

      const htmlElement = document.documentElement;
      const lang = htmlElement.getAttribute('lang');

      if (!lang) {
        violations.push({
          id: 'html-has-lang',
          severity: 'error',
          guideline: '3.1 Readable',
          successCriterion: '3.1.1 Language of Page',
          level: 'A',
          element: htmlElement,
          description: 'HTML element missing lang attribute',
          help: 'The html element must have a lang attribute',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html',
          impact: 'serious',
        });
      } else if (!this.isValidLanguageCode(lang)) {
        violations.push({
          id: 'html-lang-valid',
          severity: 'error',
          guideline: '3.1 Readable',
          successCriterion: '3.1.1 Language of Page',
          level: 'A',
          element: htmlElement,
          description: 'HTML lang attribute has invalid value',
          help: 'The lang attribute must have a valid language code',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html',
          impact: 'serious',
        });
      }

      resolve({ violations, passes, incomplete });
    });
  }

  /**
   * Check skip links (WCAG 2.1 2.4.1)
   */
  checkSkipLinks(): Promise<{
    violations: WCAGViolation[];
    passes: WCAGViolation[];
    incomplete: WCAGViolation[];
  }> {
    return new Promise(resolve => {
      const violations: WCAGViolation[] = [];
      const passes: WCAGViolation[] = [];
      const incomplete: WCAGViolation[] = [];

      const skipLinks = document.querySelectorAll('a[href^="#"]');
      let hasSkipToMain = false;

      skipLinks.forEach(link => {
        const href = link.getAttribute('href');
        const text = this.getAccessibleText(link as HTMLElement).toLowerCase();

        if (text.includes('skip') && (text.includes('main') || text.includes('content'))) {
          hasSkipToMain = true;

          // Check if target exists
          if (href && href !== '#') {
            const target = document.querySelector(href);
            if (!target) {
              violations.push({
                id: 'skip-link',
                severity: 'error',
                guideline: '2.4 Navigable',
                successCriterion: '2.4.1 Bypass Blocks',
                level: 'A',
                element: link,
                description: 'Skip link target does not exist',
                help: 'Skip links must point to existing elements',
                helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks.html',
                impact: 'moderate',
              });
            }
          }
        }
      });

      if (!hasSkipToMain) {
        incomplete.push({
          id: 'skip-link',
          severity: 'info',
          guideline: '2.4 Navigable',
          successCriterion: '2.4.1 Bypass Blocks',
          level: 'A',
          element: null,
          description: 'Page may benefit from skip links',
          help: 'Consider adding skip links for keyboard users',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks.html',
          impact: 'moderate',
        });
      }

      resolve({ violations, passes, incomplete });
    });
  }

  // Helper methods

  private validateCurrentPage(): void {
    if (process.env.NODE_ENV === 'development') {
      this.auditCurrentPage().then(result => {
        if (result.violations.length > 0) {
          console.group('🚨 WCAG Violations Detected');
          result.violations.forEach(violation => {
            console.warn(`${violation.id}: ${violation.description}`, violation.element);
          });
          console.groupEnd();
        }
      });
    }
  }

  private isA11yRelevantAttribute(attributeName: string | null): boolean {
    if (!attributeName) return false;
    const relevantAttributes = [
      'aria-label',
      'aria-labelledby',
      'aria-describedby',
      'role',
      'tabindex',
      'alt',
      'title',
      'for',
      'id',
      'disabled',
      'hidden',
      'aria-hidden',
    ];
    return relevantAttributes.includes(attributeName);
  }

  private calculateColorContrast(element: HTMLElement): ColorContrastResult | null {
    const styles = window.getComputedStyle(element);
    const color = styles.color;
    const backgroundColor = styles.backgroundColor;

    // This is a simplified implementation
    // In production, you'd want to use a proper color contrast calculation library
    const foregroundLuminance = this.getLuminance(color);
    const backgroundLuminance = this.getLuminance(backgroundColor || '#ffffff');

    const ratio =
      (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
      (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);

    return {
      ratio,
      passes: ratio >= 4.5, // AA standard
      level: 'AA',
      foreground: color,
      background: backgroundColor,
    };
  }

  private getLuminance(color: string): number {
    // Simplified luminance calculation
    // In production, use a proper color library
    return 0.5; // Placeholder
  }

  private isVisibleElement(element: HTMLElement): boolean {
    const styles = window.getComputedStyle(element);
    return styles.display !== 'none' && styles.visibility !== 'hidden' && styles.opacity !== '0';
  }

  private getAccessibleText(element: HTMLElement): string {
    return element.textContent?.trim() || '';
  }

  private getAccessibleName(element: HTMLElement): string {
    // Check aria-label first
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // Check aria-labelledby
    const ariaLabelledby = element.getAttribute('aria-labelledby');
    if (ariaLabelledby) {
      const labelElement = document.getElementById(ariaLabelledby);
      if (labelElement) return labelElement.textContent?.trim() || '';
    }

    // Check associated label
    const id = element.getAttribute('id');
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent?.trim() || '';
    }

    // Check if element is wrapped in a label
    const parentLabel = element.closest('label');
    if (parentLabel) return parentLabel.textContent?.trim() || '';

    // Check placeholder
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) return placeholder;

    // Check alt attribute for images
    const alt = element.getAttribute('alt');
    if (alt !== null) return alt;

    // Check title
    const title = element.getAttribute('title');
    if (title) return title;

    // Check text content
    return element.textContent?.trim() || '';
  }

  private hasLabel(element: HTMLElement): boolean {
    const id = element.getAttribute('id');
    if (id && document.querySelector(`label[for="${id}"]`)) return true;
    if (element.closest('label')) return true;
    if (element.getAttribute('aria-label')) return true;
    if (element.getAttribute('aria-labelledby')) return true;
    return false;
  }

  private hasRequiredIndicator(element: HTMLElement): boolean {
    const accessibleName = this.getAccessibleName(element);
    if (accessibleName.includes('*') || accessibleName.toLowerCase().includes('required'))
      return true;

    const ariaDescription = element.getAttribute('aria-describedby');
    if (ariaDescription) {
      const descElement = document.getElementById(ariaDescription);
      if (descElement?.textContent?.toLowerCase().includes('required')) return true;
    }

    return false;
  }

  private isNativelyFocusable(element: HTMLElement): boolean {
    const focusableTags = ['a', 'button', 'input', 'select', 'textarea'];
    return focusableTags.includes(element.tagName.toLowerCase());
  }

  private isValidLanguageCode(lang: string): boolean {
    // Basic validation for language codes
    return /^[a-z]{2,3}(-[A-Z]{2})?$/.test(lang);
  }

  private calculateSummary(violations: WCAGViolation[]) {
    const summary = {
      total: violations.length,
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
    };

    violations.forEach(violation => {
      summary[violation.impact]++;
    });

    return summary;
  }
}

export default WCAGValidator;
