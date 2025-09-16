/**
 * Comprehensive Keyboard Navigation Validator
 * WCAG 2.1 AA Keyboard Accessibility Testing
 *
 * This validator provides comprehensive keyboard navigation testing including:
 * - Tab order validation
 * - Focus management testing
 * - Keyboard shortcuts validation
 * - Focus indicators testing
 * - Skip links testing
 */

import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

export interface KeyboardTestResult {
  passed: boolean;
  tabOrder: FocusableElement[];
  focusIndicators: FocusIndicatorResult[];
  keyboardShortcuts: KeyboardShortcutResult[];
  skipLinks: SkipLinkResult[];
  focusTrapping: FocusTrapResult[];
  issues: KeyboardIssue[];
}

export interface FocusableElement {
  element: HTMLElement;
  description: string;
  tabIndex: number;
  role: string | null;
  ariaLabel: string | null;
  canReceiveFocus: boolean;
  hasVisibleFocusIndicator: boolean;
}

export interface FocusIndicatorResult {
  element: string;
  hasIndicator: boolean;
  indicatorType: 'outline' | 'boxShadow' | 'border' | 'custom' | 'none';
  isVisible: boolean;
  meetsContrast: boolean;
}

export interface KeyboardShortcutResult {
  shortcut: string;
  element: string;
  isImplemented: boolean;
  isAnnounced: boolean;
  conflictsWithBrowser: boolean;
}

export interface SkipLinkResult {
  link: HTMLElement;
  target: HTMLElement | null;
  isVisible: boolean;
  isFirstFocusable: boolean;
  targetIsFocusable: boolean;
}

export interface FocusTrapResult {
  container: HTMLElement;
  isTrapped: boolean;
  initialFocus: HTMLElement | null;
  canEscapeForward: boolean;
  canEscapeBackward: boolean;
}

export interface KeyboardIssue {
  severity: 'critical' | 'warning' | 'info';
  type: 'tabOrder' | 'focusIndicator' | 'shortcut' | 'skipLink' | 'focusTrap' | 'activation';
  element: string;
  description: string;
  wcagCriterion: string;
  suggestion: string;
}

/**
 * Keyboard Navigation Validator Class
 */
export class KeyboardNavigationValidator {
  private container: HTMLElement;
  private user: any;
  private issues: KeyboardIssue[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.user = userEvent.setup({ delay: 50 });
  }

  /**
   * Run comprehensive keyboard navigation tests
   */
  async validateKeyboardNavigation(): Promise<KeyboardTestResult> {
    console.log('🔍 Validating keyboard navigation...');

    const [
      tabOrder,
      focusIndicators,
      keyboardShortcuts,
      skipLinks,
      focusTrapping
    ] = await Promise.all([
      this.validateTabOrder(),
      this.validateFocusIndicators(),
      this.validateKeyboardShortcuts(),
      this.validateSkipLinks(),
      this.validateFocusTrapping()
    ]);

    return {
      passed: this.issues.filter(issue => issue.severity === 'critical').length === 0,
      tabOrder,
      focusIndicators,
      keyboardShortcuts,
      skipLinks,
      focusTrapping,
      issues: this.issues
    };
  }

  /**
   * Validate tab order and focus sequence
   */
  private async validateTabOrder(): Promise<FocusableElement[]> {
    const focusableElements = this.getFocusableElements();
    const tabOrder: FocusableElement[] = [];

    for (let i = 0; i < focusableElements.length; i++) {
      const element = focusableElements[i];
      const description = this.getElementDescription(element);

      try {
        // Test if element can receive focus
        element.focus();
        const canReceiveFocus = document.activeElement === element;

        if (!canReceiveFocus) {
          this.addIssue({
            severity: 'critical',
            type: 'tabOrder',
            element: description,
            description: 'Element cannot receive focus',
            wcagCriterion: '2.1.1 Keyboard',
            suggestion: 'Ensure element is properly focusable or remove from tab order'
          });
        }

        // Test focus indicator visibility
        const hasVisibleFocusIndicator = this.hasFocusIndicator(element);

        if (!hasVisibleFocusIndicator) {
          this.addIssue({
            severity: 'critical',
            type: 'focusIndicator',
            element: description,
            description: 'Element lacks visible focus indicator',
            wcagCriterion: '2.4.7 Focus Visible',
            suggestion: 'Add visible focus indicator using CSS :focus styles'
          });
        }

        tabOrder.push({
          element,
          description,
          tabIndex: this.getTabIndex(element),
          role: element.getAttribute('role'),
          ariaLabel: this.getAccessibleName(element),
          canReceiveFocus,
          hasVisibleFocusIndicator
        });

        // Test Tab navigation sequence
        if (i < focusableElements.length - 1) {
          await this.user.tab();
          const expectedNext = focusableElements[i + 1];

          if (document.activeElement !== expectedNext) {
            this.addIssue({
              severity: 'warning',
              type: 'tabOrder',
              element: description,
              description: 'Tab order does not follow DOM order',
              wcagCriterion: '2.4.3 Focus Order',
              suggestion: 'Ensure tab order follows logical sequence'
            });
          }
        }

        // Test Shift+Tab reverse navigation
        if (i > 0) {
          await this.user.tab({ shift: true });
          const expectedPrevious = focusableElements[i - 1];

          if (document.activeElement !== expectedPrevious) {
            this.addIssue({
              severity: 'warning',
              type: 'tabOrder',
              element: description,
              description: 'Reverse tab order is inconsistent',
              wcagCriterion: '2.4.3 Focus Order',
              suggestion: 'Ensure Shift+Tab follows reverse DOM order'
            });
          }

          // Return to current element
          await this.user.tab();
        }

      } catch (error) {
        this.addIssue({
          severity: 'critical',
          type: 'tabOrder',
          element: description,
          description: `Error during focus testing: ${error}`,
          wcagCriterion: '2.1.1 Keyboard',
          suggestion: 'Fix focus-related JavaScript errors'
        });
      }
    }

    return tabOrder;
  }

  /**
   * Validate focus indicators
   */
  private async validateFocusIndicators(): Promise<FocusIndicatorResult[]> {
    const focusableElements = this.getFocusableElements();
    const results: FocusIndicatorResult[] = [];

    for (const element of focusableElements) {
      element.focus();

      const styles = window.getComputedStyle(element);
      const outline = styles.outline;
      const boxShadow = styles.boxShadow;
      const border = styles.border;

      let indicatorType: FocusIndicatorResult['indicatorType'] = 'none';
      let hasIndicator = false;
      let isVisible = false;
      let meetsContrast = false;

      // Check for different types of focus indicators
      if (outline !== 'none' && outline !== '') {
        indicatorType = 'outline';
        hasIndicator = true;
        isVisible = true;
        meetsContrast = this.checkFocusIndicatorContrast(styles, 'outline');
      } else if (boxShadow !== 'none' && boxShadow !== '') {
        indicatorType = 'boxShadow';
        hasIndicator = true;
        isVisible = true;
        meetsContrast = this.checkFocusIndicatorContrast(styles, 'boxShadow');
      } else if (this.hasCustomFocusIndicator(element)) {
        indicatorType = 'custom';
        hasIndicator = true;
        isVisible = true;
        meetsContrast = this.checkFocusIndicatorContrast(styles, 'custom');
      } else if (border !== 'none' && this.isFocusBorder(element)) {
        indicatorType = 'border';
        hasIndicator = true;
        isVisible = true;
        meetsContrast = this.checkFocusIndicatorContrast(styles, 'border');
      }

      if (!hasIndicator) {
        this.addIssue({
          severity: 'critical',
          type: 'focusIndicator',
          element: this.getElementDescription(element),
          description: 'No focus indicator present',
          wcagCriterion: '2.4.7 Focus Visible',
          suggestion: 'Add :focus CSS styles with visible indicator'
        });
      } else if (!meetsContrast) {
        this.addIssue({
          severity: 'warning',
          type: 'focusIndicator',
          element: this.getElementDescription(element),
          description: 'Focus indicator may not meet contrast requirements',
          wcagCriterion: '1.4.11 Non-text Contrast',
          suggestion: 'Ensure focus indicator has 3:1 contrast ratio with background'
        });
      }

      results.push({
        element: this.getElementDescription(element),
        hasIndicator,
        indicatorType,
        isVisible,
        meetsContrast
      });
    }

    return results;
  }

  /**
   * Validate keyboard shortcuts
   */
  private async validateKeyboardShortcuts(): Promise<KeyboardShortcutResult[]> {
    const results: KeyboardShortcutResult[] = [];
    const elementsWithShortcuts = this.container.querySelectorAll('[accesskey], [data-shortcut]');

    // Common keyboard shortcuts to test
    const commonShortcuts = [
      { key: 'Enter', description: 'Activate button/link' },
      { key: ' ', description: 'Activate button' },
      { key: 'Escape', description: 'Close modal/cancel' },
      { key: 'ArrowDown', description: 'Navigate down' },
      { key: 'ArrowUp', description: 'Navigate up' },
      { key: 'Home', description: 'Go to first item' },
      { key: 'End', description: 'Go to last item' }
    ];

    // Test accesskey attributes
    elementsWithShortcuts.forEach(element => {
      const accesskey = element.getAttribute('accesskey');
      const dataShortcut = element.getAttribute('data-shortcut');
      const shortcut = accesskey || dataShortcut;

      if (shortcut) {
        const isAnnounced = this.isShortcutAnnounced(element as HTMLElement, shortcut);
        const conflictsWithBrowser = this.checkBrowserShortcutConflict(shortcut);

        if (conflictsWithBrowser) {
          this.addIssue({
            severity: 'warning',
            type: 'shortcut',
            element: this.getElementDescription(element as HTMLElement),
            description: `Shortcut "${shortcut}" conflicts with browser shortcuts`,
            wcagCriterion: '2.1.4 Character Key Shortcuts',
            suggestion: 'Use modifier keys or different key combinations'
          });
        }

        if (!isAnnounced) {
          this.addIssue({
            severity: 'warning',
            type: 'shortcut',
            element: this.getElementDescription(element as HTMLElement),
            description: 'Keyboard shortcut is not announced to users',
            wcagCriterion: '4.1.3 Status Messages',
            suggestion: 'Include shortcut in aria-label or provide help text'
          });
        }

        results.push({
          shortcut,
          element: this.getElementDescription(element as HTMLElement),
          isImplemented: true,
          isAnnounced,
          conflictsWithBrowser
        });
      }
    });

    // Test common keyboard interactions
    const buttons = this.container.querySelectorAll('button, [role="button"]');
    for (const button of buttons) {
      await this.testButtonKeyboardActivation(button as HTMLElement, results);
    }

    const links = this.container.querySelectorAll('a[href], [role="link"]');
    for (const link of links) {
      await this.testLinkKeyboardActivation(link as HTMLElement, results);
    }

    return results;
  }

  /**
   * Validate skip links
   */
  private async validateSkipLinks(): Promise<SkipLinkResult[]> {
    const skipLinks = this.container.querySelectorAll('a[href^="#"], [role="link"][href^="#"]');
    const results: SkipLinkResult[] = [];

    for (const link of skipLinks) {
      const href = link.getAttribute('href');
      if (!href) continue;

      const target = this.container.querySelector(href) || document.querySelector(href);
      const isVisible = this.isElementVisible(link as HTMLElement);
      const isFirstFocusable = this.isFirstFocusableElement(link as HTMLElement);
      const targetIsFocusable = target ? this.isElementFocusable(target as HTMLElement) : false;

      // Skip link validation
      if (!target) {
        this.addIssue({
          severity: 'critical',
          type: 'skipLink',
          element: this.getElementDescription(link as HTMLElement),
          description: `Skip link target "${href}" not found`,
          wcagCriterion: '2.4.1 Bypass Blocks',
          suggestion: 'Ensure skip link target exists and has matching ID'
        });
      }

      if (!isFirstFocusable && this.isSkipLink(link as HTMLElement)) {
        this.addIssue({
          severity: 'warning',
          type: 'skipLink',
          element: this.getElementDescription(link as HTMLElement),
          description: 'Skip link should be the first focusable element',
          wcagCriterion: '2.4.1 Bypass Blocks',
          suggestion: 'Move skip link to beginning of document'
        });
      }

      if (target && !targetIsFocusable) {
        this.addIssue({
          severity: 'warning',
          type: 'skipLink',
          element: this.getElementDescription(link as HTMLElement),
          description: 'Skip link target is not focusable',
          wcagCriterion: '2.4.1 Bypass Blocks',
          suggestion: 'Add tabindex="-1" to target or make it naturally focusable'
        });
      }

      results.push({
        link: link as HTMLElement,
        target: target as HTMLElement,
        isVisible,
        isFirstFocusable,
        targetIsFocusable
      });
    }

    return results;
  }

  /**
   * Validate focus trapping in modals and dialogs
   */
  private async validateFocusTrapping(): Promise<FocusTrapResult[]> {
    const modals = this.container.querySelectorAll('[role="dialog"], [aria-modal="true"], .modal');
    const results: FocusTrapResult[] = [];

    for (const modal of modals) {
      const focusableElements = this.getFocusableElementsInContainer(modal as HTMLElement);

      if (focusableElements.length === 0) {
        this.addIssue({
          severity: 'critical',
          type: 'focusTrap',
          element: this.getElementDescription(modal as HTMLElement),
          description: 'Modal has no focusable elements',
          wcagCriterion: '2.1.2 No Keyboard Trap',
          suggestion: 'Ensure modal has at least one focusable element'
        });
        continue;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      // Test focus trapping
      let isTrapped = true;
      let canEscapeForward = false;
      let canEscapeBackward = false;

      try {
        // Test forward trapping (Tab from last element should go to first)
        lastFocusable.focus();
        await this.user.tab();

        if (document.activeElement !== firstFocusable) {
          isTrapped = false;
          canEscapeForward = true;
          this.addIssue({
            severity: 'critical',
            type: 'focusTrap',
            element: this.getElementDescription(modal as HTMLElement),
            description: 'Focus escapes modal when tabbing forward',
            wcagCriterion: '2.1.2 No Keyboard Trap',
            suggestion: 'Implement proper focus trapping that cycles within modal'
          });
        }

        // Test backward trapping (Shift+Tab from first element should go to last)
        firstFocusable.focus();
        await this.user.tab({ shift: true });

        if (document.activeElement !== lastFocusable) {
          isTrapped = false;
          canEscapeBackward = true;
          this.addIssue({
            severity: 'critical',
            type: 'focusTrap',
            element: this.getElementDescription(modal as HTMLElement),
            description: 'Focus escapes modal when tabbing backward',
            wcagCriterion: '2.1.2 No Keyboard Trap',
            suggestion: 'Implement proper focus trapping for reverse tab navigation'
          });
        }

        // Test escape mechanism
        firstFocusable.focus();
        await this.user.keyboard('{Escape}');

        // Modal should either close or provide escape mechanism
        const modalStillVisible = this.isElementVisible(modal as HTMLElement);
        if (modalStillVisible && isTrapped) {
          this.addIssue({
            severity: 'warning',
            type: 'focusTrap',
            element: this.getElementDescription(modal as HTMLElement),
            description: 'No escape mechanism from focus trap',
            wcagCriterion: '2.1.2 No Keyboard Trap',
            suggestion: 'Provide escape mechanism (ESC key, close button, etc.)'
          });
        }

      } catch (error) {
        this.addIssue({
          severity: 'critical',
          type: 'focusTrap',
          element: this.getElementDescription(modal as HTMLElement),
          description: `Error testing focus trap: ${error}`,
          wcagCriterion: '2.1.2 No Keyboard Trap',
          suggestion: 'Fix focus trap implementation errors'
        });
      }

      results.push({
        container: modal as HTMLElement,
        isTrapped,
        initialFocus: firstFocusable,
        canEscapeForward,
        canEscapeBackward
      });
    }

    return results;
  }

  /**
   * Helper methods
   */
  private getFocusableElements(): HTMLElement[] {
    const selector = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([aria-disabled="true"])',
      '[role="link"]:not([aria-disabled="true"])',
      '[role="textbox"]:not([aria-disabled="true"])',
      '[role="combobox"]:not([aria-disabled="true"])'
    ].join(', ');

    return Array.from(this.container.querySelectorAll(selector)) as HTMLElement[];
  }

  private getFocusableElementsInContainer(container: HTMLElement): HTMLElement[] {
    const selector = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([aria-disabled="true"])',
      '[role="link"]:not([aria-disabled="true"])',
      '[role="textbox"]:not([aria-disabled="true"])',
      '[role="combobox"]:not([aria-disabled="true"])'
    ].join(', ');

    return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
  }

  private getElementDescription(element: HTMLElement): string {
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const className = element.className ? `.${element.className.split(' ')[0]}` : '';
    const role = element.getAttribute('role') ? `[role="${element.getAttribute('role')}"]` : '';
    const text = element.textContent?.slice(0, 30) || '';

    return `${tagName}${id}${className}${role} "${text}"`.trim();
  }

  private getTabIndex(element: HTMLElement): number {
    const tabindex = element.getAttribute('tabindex');
    return tabindex ? parseInt(tabindex, 10) : 0;
  }

  private getAccessibleName(element: HTMLElement): string | null {
    return element.getAttribute('aria-label') ||
           element.getAttribute('aria-labelledby') ||
           element.textContent?.trim() ||
           element.getAttribute('title') ||
           element.getAttribute('alt') ||
           null;
  }

  private hasFocusIndicator(element: HTMLElement): boolean {
    const styles = window.getComputedStyle(element);
    const outline = styles.outline;
    const boxShadow = styles.boxShadow;

    if (outline !== 'none' && outline !== '') return true;
    if (boxShadow !== 'none' && boxShadow !== '') return true;
    if (this.hasCustomFocusIndicator(element)) return true;

    return false;
  }

  private hasCustomFocusIndicator(element: HTMLElement): boolean {
    // Check for common custom focus indicator patterns
    const classList = element.classList;
    return classList.contains('focus-visible') ||
           classList.contains('focused') ||
           classList.contains('focus-ring') ||
           element.hasAttribute('data-focus-visible');
  }

  private checkFocusIndicatorContrast(styles: CSSStyleDeclaration, type: string): boolean {
    // Simplified contrast check - in production, use proper color contrast library
    switch (type) {
      case 'outline':
        const outlineColor = styles.outlineColor;
        const backgroundColor = styles.backgroundColor;
        return this.hasAdequateContrast(outlineColor, backgroundColor);

      case 'boxShadow':
        // Extract color from box-shadow
        const boxShadow = styles.boxShadow;
        return boxShadow.includes('rgb') || boxShadow.includes('#');

      case 'border':
        const borderColor = styles.borderColor;
        return this.hasAdequateContrast(borderColor, styles.backgroundColor);

      default:
        return true; // Assume custom indicators are properly designed
    }
  }

  private hasAdequateContrast(color1: string, color2: string): boolean {
    // Simplified implementation - use proper color contrast library in production
    return color1 !== color2 &&
           !color1.includes('transparent') &&
           !color2.includes('transparent');
  }

  private isFocusBorder(element: HTMLElement): boolean {
    // Check if border changes on focus (pseudo-class simulation)
    const originalBorder = element.style.border;
    element.focus();
    const focusedBorder = window.getComputedStyle(element).border;
    return originalBorder !== focusedBorder;
  }

  private isShortcutAnnounced(element: HTMLElement, shortcut: string): boolean {
    const ariaLabel = element.getAttribute('aria-label') || '';
    const title = element.getAttribute('title') || '';
    const textContent = element.textContent || '';

    return ariaLabel.includes(shortcut) ||
           title.includes(shortcut) ||
           textContent.includes(shortcut);
  }

  private checkBrowserShortcutConflict(shortcut: string): boolean {
    const browserShortcuts = ['F1', 'F5', 'F12', 'Ctrl+R', 'Ctrl+F', 'Ctrl+T', 'Ctrl+W'];
    return browserShortcuts.includes(shortcut.toUpperCase());
  }

  private async testButtonKeyboardActivation(button: HTMLElement, results: KeyboardShortcutResult[]): Promise<void> {
    button.focus();

    let enterWorks = false;
    let spaceWorks = false;

    // Test Enter key
    const enterHandler = () => { enterWorks = true; };
    button.addEventListener('click', enterHandler);
    await this.user.keyboard('{Enter}');
    button.removeEventListener('click', enterHandler);

    // Test Space key
    const spaceHandler = () => { spaceWorks = true; };
    button.addEventListener('click', spaceHandler);
    await this.user.keyboard(' ');
    button.removeEventListener('click', spaceHandler);

    if (!enterWorks) {
      this.addIssue({
        severity: 'critical',
        type: 'activation',
        element: this.getElementDescription(button),
        description: 'Button does not respond to Enter key',
        wcagCriterion: '2.1.1 Keyboard',
        suggestion: 'Ensure button handles Enter key activation'
      });
    }

    if (!spaceWorks) {
      this.addIssue({
        severity: 'critical',
        type: 'activation',
        element: this.getElementDescription(button),
        description: 'Button does not respond to Space key',
        wcagCriterion: '2.1.1 Keyboard',
        suggestion: 'Ensure button handles Space key activation'
      });
    }
  }

  private async testLinkKeyboardActivation(link: HTMLElement, results: KeyboardShortcutResult[]): Promise<void> {
    link.focus();

    let enterWorks = false;

    const enterHandler = () => { enterWorks = true; };
    link.addEventListener('click', enterHandler);
    await this.user.keyboard('{Enter}');
    link.removeEventListener('click', enterHandler);

    if (!enterWorks) {
      this.addIssue({
        severity: 'critical',
        type: 'activation',
        element: this.getElementDescription(link),
        description: 'Link does not respond to Enter key',
        wcagCriterion: '2.1.1 Keyboard',
        suggestion: 'Ensure link handles Enter key activation'
      });
    }
  }

  private isElementVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);

    return rect.width > 0 &&
           rect.height > 0 &&
           styles.visibility !== 'hidden' &&
           styles.display !== 'none';
  }

  private isFirstFocusableElement(element: HTMLElement): boolean {
    const allFocusable = this.getFocusableElements();
    return allFocusable.length > 0 && allFocusable[0] === element;
  }

  private isElementFocusable(element: HTMLElement): boolean {
    const tabindex = element.getAttribute('tabindex');
    const naturallyFocusable = ['button', 'input', 'select', 'textarea', 'a'].includes(element.tagName.toLowerCase());

    return naturallyFocusable ||
           element.hasAttribute('href') ||
           (tabindex !== null && tabindex !== '-1');
  }

  private isSkipLink(element: HTMLElement): boolean {
    const text = element.textContent?.toLowerCase() || '';
    const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';

    return text.includes('skip') ||
           text.includes('jump') ||
           ariaLabel.includes('skip') ||
           ariaLabel.includes('jump');
  }

  private addIssue(issue: KeyboardIssue): void {
    this.issues.push(issue);
  }
}

export default KeyboardNavigationValidator;