/**
 * Electron-Specific Accessibility Testing Utilities
 *
 * This module provides specialized testing utilities for desktop-specific
 * accessibility patterns in Electron applications, including keyboard shortcuts,
 * native menus, window focus management, and platform-specific behaviors.
 */

import { RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

export interface ElectronA11yTestResult {
  passed: boolean;
  violations: Array<{
    type: string;
    element?: Element;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
  summary: string;
}

export interface KeyboardShortcutTest {
  shortcut: string;
  description: string;
  expectedAction: string;
  conflictsWith?: string[];
}

export interface WindowFocusTest {
  windowId: string;
  initialElement: string;
  expectedFocusChain: string[];
  modalElements?: string[];
}

export class ElectronAccessibilityTests {
  private platform: 'win32' | 'darwin' | 'linux';
  private violations: Array<{
    type: string;
    element?: Element;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }> = [];

  constructor(platform: 'win32' | 'darwin' | 'linux' = 'win32') {
    this.platform = platform;
  }

  /**
   * Test keyboard shortcuts for conflicts and accessibility
   */
  async testKeyboardShortcuts(
    renderResult: RenderResult,
    shortcuts: KeyboardShortcutTest[]
  ): Promise<ElectronA11yTestResult> {
    this.violations = [];
    const { container } = renderResult;

    for (const shortcut of shortcuts) {
      await this.testSingleShortcut(container, shortcut);
    }

    // Test for common accessibility issues with shortcuts
    this.testShortcutAccessibility(shortcuts);

    return {
      passed: this.violations.length === 0,
      violations: this.violations,
      summary: this.generateShortcutSummary()
    };
  }

  private async testSingleShortcut(
    container: Element,
    shortcut: KeyboardShortcutTest
  ): Promise<void> {
    try {
      const user = userEvent.setup();

      // Parse shortcut and execute
      const keys = this.parseShortcut(shortcut.shortcut);

      // Focus container first
      const focusableElement = container.querySelector(
        'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;

      if (focusableElement) {
        focusableElement.focus();
        await user.keyboard(keys);

        // Check if shortcut is properly documented
        const shortcutElement = container.querySelector(
          `[title*="${shortcut.shortcut}"], [aria-label*="${shortcut.shortcut}"]`
        );

        if (!shortcutElement) {
          this.violations.push({
            type: 'undocumented-shortcut',
            message: `Keyboard shortcut ${shortcut.shortcut} is not documented in UI (missing title or aria-label)`,
            severity: 'warning'
          });
        }
      }
    } catch (error) {
      this.violations.push({
        type: 'shortcut-execution-error',
        message: `Failed to test shortcut ${shortcut.shortcut}: ${error}`,
        severity: 'error'
      });
    }
  }

  private parseShortcut(shortcut: string): string {
    // Convert platform-specific shortcuts to @testing-library/user-event format
    let keys = shortcut;

    // Handle platform-specific modifiers
    if (this.platform === 'darwin') {
      keys = keys.replace(/Ctrl/g, 'Meta');
      keys = keys.replace(/Alt/g, 'Option');
    }

    // Convert to user-event format
    keys = keys.replace(/\+/g, '>');
    keys = keys.replace(/Ctrl/g, '{Control');
    keys = keys.replace(/Shift/g, '{Shift');
    keys = keys.replace(/Alt/g, '{Alt');
    keys = keys.replace(/Meta/g, '{Meta');

    // Add closing braces and handle key names
    keys = keys.replace(/([A-Z][a-z]*)/g, (match) => {
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(match)) {
        return match + '>';
      }
      return `{${match}}`;
    });

    // Handle closing braces for modifiers
    keys = keys.replace(/>([^{])/g, '>}$1');
    keys = keys.replace(/>$/, '>}');

    return keys;
  }

  private testShortcutAccessibility(shortcuts: KeyboardShortcutTest[]): void {
    // Check for conflicts
    const shortcutMap = new Map<string, KeyboardShortcutTest>();
    shortcuts.forEach(shortcut => {
      const normalized = shortcut.shortcut.toLowerCase();
      if (shortcutMap.has(normalized)) {
        this.violations.push({
          type: 'shortcut-conflict',
          message: `Shortcut conflict: ${shortcut.shortcut} is used by both "${shortcut.description}" and "${shortcutMap.get(normalized)?.description}"`,
          severity: 'error'
        });
      }
      shortcutMap.set(normalized, shortcut);
    });

    // Check for platform-appropriate shortcuts
    shortcuts.forEach(shortcut => {
      if (this.platform === 'darwin' && shortcut.shortcut.includes('Ctrl')) {
        this.violations.push({
          type: 'platform-inappropriate-shortcut',
          message: `On macOS, use Cmd instead of Ctrl for ${shortcut.shortcut} (${shortcut.description})`,
          severity: 'warning'
        });
      }

      if (this.platform !== 'darwin' && shortcut.shortcut.includes('Cmd')) {
        this.violations.push({
          type: 'platform-inappropriate-shortcut',
          message: `On ${this.platform}, use Ctrl instead of Cmd for ${shortcut.shortcut} (${shortcut.description})`,
          severity: 'warning'
        });
      }
    });

    // Check for missing essential shortcuts
    const essentialShortcuts = ['Ctrl+S', 'Ctrl+N', 'Ctrl+O', 'Ctrl+Q', 'Ctrl+F'];
    const existingShortcuts = shortcuts.map(s => s.shortcut);

    essentialShortcuts.forEach(essential => {
      const platformAppropriate = this.platform === 'darwin'
        ? essential.replace('Ctrl', 'Cmd')
        : essential;

      if (!existingShortcuts.includes(platformAppropriate)) {
        this.violations.push({
          type: 'missing-essential-shortcut',
          message: `Consider implementing essential shortcut: ${platformAppropriate}`,
          severity: 'info'
        });
      }
    });
  }

  /**
   * Test native menu accessibility
   */
  async testNativeMenus(menuStructure: any): Promise<ElectronA11yTestResult> {
    this.violations = [];

    this.validateMenuStructure(menuStructure);
    this.validateMenuAccessibility(menuStructure);

    return {
      passed: this.violations.length === 0,
      violations: this.violations,
      summary: this.generateMenuSummary()
    };
  }

  private validateMenuStructure(menu: any, level: number = 0): void {
    if (!menu || typeof menu !== 'object') return;

    // Check for required menu properties
    if (menu.submenu && Array.isArray(menu.submenu)) {
      menu.submenu.forEach((item: any, index: number) => {
        // Check for separators and proper labeling
        if (item.type !== 'separator' && !item.label) {
          this.violations.push({
            type: 'unlabeled-menu-item',
            message: `Menu item at index ${index} in level ${level} lacks a label`,
            severity: 'error'
          });
        }

        // Check for accelerator (keyboard shortcut) documentation
        if (item.accelerator && !item.label?.includes(item.accelerator)) {
          // This is actually good - accelerator is separate from label
          // Check if accelerator follows platform conventions
          if (this.platform === 'darwin' && item.accelerator.includes('Ctrl')) {
            this.violations.push({
              type: 'platform-inappropriate-accelerator',
              message: `Menu item "${item.label}" uses Ctrl instead of Cmd on macOS`,
              severity: 'warning'
            });
          }
        }

        // Recurse into submenus
        if (item.submenu) {
          this.validateMenuStructure(item, level + 1);
        }
      });
    }
  }

  private validateMenuAccessibility(menu: any): void {
    // Check for standard menu structure
    const standardMenus = ['File', 'Edit', 'View', 'Help'];
    if (menu.submenu && Array.isArray(menu.submenu)) {
      const menuLabels = menu.submenu
        .filter((item: any) => item.type !== 'separator')
        .map((item: any) => item.label);

      // Check for Help menu
      if (!menuLabels.some((label: string) => label?.toLowerCase().includes('help'))) {
        this.violations.push({
          type: 'missing-help-menu',
          message: 'Consider adding a Help menu for user assistance',
          severity: 'info'
        });
      }

      // Check for File menu with standard options
      const fileMenu = menu.submenu.find((item: any) =>
        item.label?.toLowerCase().includes('file')
      );

      if (fileMenu && fileMenu.submenu) {
        const fileItems = fileMenu.submenu.map((item: any) => item.label?.toLowerCase());
        if (!fileItems.includes('exit') && !fileItems.includes('quit')) {
          this.violations.push({
            type: 'missing-exit-option',
            message: 'File menu should include an Exit/Quit option',
            severity: 'warning'
          });
        }
      }
    }
  }

  /**
   * Test window focus management
   */
  async testWindowFocus(
    renderResult: RenderResult,
    focusTests: WindowFocusTest[]
  ): Promise<ElectronA11yTestResult> {
    this.violations = [];
    const { container } = renderResult;

    for (const test of focusTests) {
      await this.testSingleWindowFocus(container, test);
    }

    return {
      passed: this.violations.length === 0,
      violations: this.violations,
      summary: this.generateFocusSummary()
    };
  }

  private async testSingleWindowFocus(
    container: Element,
    focusTest: WindowFocusTest
  ): Promise<void> {
    try {
      const user = userEvent.setup();

      // Test initial focus
      const initialElement = container.querySelector(focusTest.initialElement) as HTMLElement;
      if (!initialElement) {
        this.violations.push({
          type: 'missing-initial-focus',
          element: container as Element,
          message: `Initial focus element "${focusTest.initialElement}" not found`,
          severity: 'error'
        });
        return;
      }

      // Test focus chain
      let currentElement = initialElement;
      currentElement.focus();

      for (let i = 0; i < focusTest.expectedFocusChain.length; i++) {
        await user.tab();
        const expectedSelector = focusTest.expectedFocusChain[i];
        const expectedElement = container.querySelector(expectedSelector);

        if (!expectedElement) {
          this.violations.push({
            type: 'broken-focus-chain',
            message: `Expected focus element "${expectedSelector}" not found in focus chain`,
            severity: 'error'
          });
          continue;
        }

        if (document.activeElement !== expectedElement) {
          this.violations.push({
            type: 'incorrect-focus-order',
            element: expectedElement,
            message: `Focus order incorrect: expected "${expectedSelector}" but got "${document.activeElement?.tagName}"`,
            severity: 'error'
          });
        }
      }

      // Test modal focus trapping if modal elements specified
      if (focusTest.modalElements && focusTest.modalElements.length > 0) {
        await this.testModalFocusTrapping(container, focusTest.modalElements);
      }

    } catch (error) {
      this.violations.push({
        type: 'focus-test-error',
        message: `Error testing window focus for ${focusTest.windowId}: ${error}`,
        severity: 'error'
      });
    }
  }

  private async testModalFocusTrapping(
    container: Element,
    modalElements: string[]
  ): Promise<void> {
    const user = userEvent.setup();

    // Find first and last focusable elements in modal
    const firstElement = container.querySelector(modalElements[0]) as HTMLElement;
    const lastElement = container.querySelector(modalElements[modalElements.length - 1]) as HTMLElement;

    if (!firstElement || !lastElement) {
      this.violations.push({
        type: 'modal-focus-elements-missing',
        message: 'Modal focus trapping elements not found',
        severity: 'error'
      });
      return;
    }

    // Test forward focus trapping
    lastElement.focus();
    await user.tab();

    if (document.activeElement !== firstElement) {
      this.violations.push({
        type: 'modal-focus-not-trapped-forward',
        element: lastElement,
        message: 'Modal focus not trapped: Tab from last element should focus first element',
        severity: 'error'
      });
    }

    // Test backward focus trapping
    firstElement.focus();
    await user.tab({ shift: true });

    if (document.activeElement !== lastElement) {
      this.violations.push({
        type: 'modal-focus-not-trapped-backward',
        element: firstElement,
        message: 'Modal focus not trapped: Shift+Tab from first element should focus last element',
        severity: 'error'
      });
    }
  }

  /**
   * Test desktop-specific interaction patterns
   */
  async testDesktopInteractions(
    renderResult: RenderResult,
    interactions: {
      rightClickMenus?: boolean;
      dragAndDrop?: boolean;
      doubleClickActions?: boolean;
      hoverTooltips?: boolean;
    }
  ): Promise<ElectronA11yTestResult> {
    this.violations = [];
    const { container } = renderResult;

    if (interactions.rightClickMenus) {
      await this.testRightClickMenus(container);
    }

    if (interactions.dragAndDrop) {
      await this.testDragAndDropA11y(container);
    }

    if (interactions.doubleClickActions) {
      await this.testDoubleClickA11y(container);
    }

    if (interactions.hoverTooltips) {
      await this.testHoverTooltips(container);
    }

    return {
      passed: this.violations.length === 0,
      violations: this.violations,
      summary: this.generateInteractionSummary()
    };
  }

  private async testRightClickMenus(container: Element): Promise<void> {
    const contextMenuElements = container.querySelectorAll('[oncontextmenu], [data-contextmenu]');

    contextMenuElements.forEach((element, index) => {
      // Check if context menu has keyboard alternative
      const hasKeyboardAlternative =
        element.hasAttribute('data-keyboard-menu') ||
        element.querySelector('[role="button"][aria-haspopup="menu"]') ||
        container.querySelector(`[aria-controls][aria-expanded]`);

      if (!hasKeyboardAlternative) {
        this.violations.push({
          type: 'context-menu-no-keyboard-alternative',
          element,
          message: `Context menu on element ${index} lacks keyboard alternative (consider Menu key or F10 support)`,
          severity: 'error'
        });
      }
    });
  }

  private async testDragAndDropA11y(container: Element): Promise<void> {
    const draggableElements = container.querySelectorAll('[draggable="true"]');

    draggableElements.forEach((element, index) => {
      // Check for keyboard alternatives
      const hasKeyboardAlternative =
        element.hasAttribute('data-keyboard-moveable') ||
        element.querySelector('[role="button"][aria-label*="move"]') ||
        container.querySelector('[role="button"][aria-label*="cut"]');

      if (!hasKeyboardAlternative) {
        this.violations.push({
          type: 'draggable-no-keyboard-alternative',
          element,
          message: `Draggable element ${index} lacks keyboard alternative (consider cut/paste or move buttons)`,
          severity: 'error'
        });
      }

      // Check for proper ARIA attributes
      if (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-describedby')) {
        this.violations.push({
          type: 'draggable-missing-description',
          element,
          message: `Draggable element ${index} should have aria-label or aria-describedby to explain drag functionality`,
          severity: 'warning'
        });
      }
    });
  }

  private async testDoubleClickA11y(container: Element): Promise<void> {
    const doubleClickElements = container.querySelectorAll('[ondblclick]');

    doubleClickElements.forEach((element, index) => {
      // Check for single-click or keyboard alternative
      const hasSingleClickAlternative =
        element.hasAttribute('onclick') ||
        element.hasAttribute('onkeydown') ||
        element.querySelector('[role="button"]');

      if (!hasSingleClickAlternative) {
        this.violations.push({
          type: 'double-click-no-alternative',
          element,
          message: `Double-click action on element ${index} should have single-click or keyboard alternative`,
          severity: 'error'
        });
      }

      // Check for indication that double-click is required
      const hasDoubleClickIndication =
        element.getAttribute('title')?.includes('double') ||
        element.getAttribute('aria-label')?.includes('double') ||
        element.querySelector('[title*="double"], [aria-label*="double"]');

      if (!hasDoubleClickIndication) {
        this.violations.push({
          type: 'double-click-not-indicated',
          element,
          message: `Element ${index} with double-click should indicate this requirement to users`,
          severity: 'warning'
        });
      }
    });
  }

  private async testHoverTooltips(container: Element): Promise<void> {
    const tooltipElements = container.querySelectorAll('[title], [data-tooltip]');

    tooltipElements.forEach((element, index) => {
      // Check for keyboard accessibility
      if (!element.hasAttribute('tabindex') &&
          !['button', 'input', 'select', 'textarea', 'a'].includes(element.tagName.toLowerCase())) {
        this.violations.push({
          type: 'tooltip-not-focusable',
          element,
          message: `Tooltip on element ${index} is not accessible via keyboard (element not focusable)`,
          severity: 'error'
        });
      }

      // Check for proper ARIA implementation
      const title = element.getAttribute('title');
      const ariaDescribedBy = element.getAttribute('aria-describedby');

      if (title && !ariaDescribedBy) {
        this.violations.push({
          type: 'tooltip-improper-aria',
          element,
          message: `Element ${index} uses title attribute instead of proper ARIA tooltip implementation`,
          severity: 'warning'
        });
      }
    });
  }

  // Summary generators
  private generateShortcutSummary(): string {
    const errorCount = this.violations.filter(v => v.severity === 'error').length;
    const warningCount = this.violations.filter(v => v.severity === 'warning').length;
    const infoCount = this.violations.filter(v => v.severity === 'info').length;

    if (this.violations.length === 0) {
      return 'All keyboard shortcut accessibility tests passed!';
    }

    return `Keyboard shortcut accessibility issues found: ${errorCount} errors, ${warningCount} warnings, ${infoCount} info`;
  }

  private generateMenuSummary(): string {
    const errorCount = this.violations.filter(v => v.severity === 'error').length;
    const warningCount = this.violations.filter(v => v.severity === 'warning').length;

    if (this.violations.length === 0) {
      return 'All native menu accessibility tests passed!';
    }

    return `Native menu accessibility issues found: ${errorCount} errors, ${warningCount} warnings`;
  }

  private generateFocusSummary(): string {
    const errorCount = this.violations.filter(v => v.severity === 'error').length;

    if (this.violations.length === 0) {
      return 'All window focus management tests passed!';
    }

    return `Window focus management issues found: ${errorCount} errors`;
  }

  private generateInteractionSummary(): string {
    const errorCount = this.violations.filter(v => v.severity === 'error').length;
    const warningCount = this.violations.filter(v => v.severity === 'warning').length;

    if (this.violations.length === 0) {
      return 'All desktop interaction accessibility tests passed!';
    }

    return `Desktop interaction accessibility issues found: ${errorCount} errors, ${warningCount} warnings`;
  }

  /**
   * Reset violations for new test run
   */
  reset(): void {
    this.violations = [];
  }

  /**
   * Get platform-specific modifier key
   */
  static getModifierKey(platform: 'win32' | 'darwin' | 'linux' = 'win32'): string {
    return platform === 'darwin' ? 'Cmd' : 'Ctrl';
  }

  /**
   * Create platform-appropriate shortcut string
   */
  static createShortcut(
    key: string,
    modifiers: string[] = [],
    platform: 'win32' | 'darwin' | 'linux' = 'win32'
  ): string {
    const platformModifiers = modifiers.map(mod =>
      mod === 'Ctrl' && platform === 'darwin' ? 'Cmd' : mod
    );

    return [...platformModifiers, key].join('+');
  }
}

// Export helper functions
export const testKeyboardShortcuts = async (
  renderResult: RenderResult,
  shortcuts: KeyboardShortcutTest[],
  platform?: 'win32' | 'darwin' | 'linux'
) => {
  const tester = new ElectronAccessibilityTests(platform);
  return tester.testKeyboardShortcuts(renderResult, shortcuts);
};

export const testNativeMenus = async (
  menuStructure: any,
  platform?: 'win32' | 'darwin' | 'linux'
) => {
  const tester = new ElectronAccessibilityTests(platform);
  return tester.testNativeMenus(menuStructure);
};

export const testWindowFocus = async (
  renderResult: RenderResult,
  focusTests: WindowFocusTest[],
  platform?: 'win32' | 'darwin' | 'linux'
) => {
  const tester = new ElectronAccessibilityTests(platform);
  return tester.testWindowFocus(renderResult, focusTests);
};

export const testDesktopInteractions = async (
  renderResult: RenderResult,
  interactions: {
    rightClickMenus?: boolean;
    dragAndDrop?: boolean;
    doubleClickActions?: boolean;
    hoverTooltips?: boolean;
  },
  platform?: 'win32' | 'darwin' | 'linux'
) => {
  const tester = new ElectronAccessibilityTests(platform);
  return tester.testDesktopInteractions(renderResult, interactions);
};

export default ElectronAccessibilityTests;