/**
 * Inclusive Design Testing Tools
 *
 * Provides specialized tools for validating inclusive design principles
 * across different accessibility dimensions.
 */

/**
 * Validates touch target sizes and spacing for motor accessibility
 */
export class TouchTargetValidator {
  private readonly MIN_TARGET_SIZE = 44; // WCAG 2.1 AA minimum
  private readonly MIN_SPACING = 8; // Minimum spacing between targets

  validateAllTargets(container: Element): {
    targets: Array<{
      element: Element;
      width: number;
      height: number;
      passes: boolean;
    }>;
    violations: Array<{
      element: Element;
      issue: string;
      recommendation: string;
    }>;
  } {
    const targets: Array<{
      element: Element;
      width: number;
      height: number;
      passes: boolean;
    }> = [];

    const violations: Array<{
      element: Element;
      issue: string;
      recommendation: string;
    }> = [];

    // Find all interactive elements
    const interactiveSelectors = [
      'button',
      'a[href]',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[role="menuitem"]',
      '[role="tab"]',
      '[tabindex]:not([tabindex="-1"])'
    ];

    const interactiveElements = container.querySelectorAll(interactiveSelectors.join(', '));

    interactiveElements.forEach(element => {
      const rect = element.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const passes = width >= this.MIN_TARGET_SIZE && height >= this.MIN_TARGET_SIZE;

      targets.push({
        element,
        width,
        height,
        passes
      });

      if (!passes) {
        violations.push({
          element,
          issue: `Touch target too small: ${width}x${height}px (minimum: ${this.MIN_TARGET_SIZE}x${this.MIN_TARGET_SIZE}px)`,
          recommendation: `Increase padding or minimum dimensions to meet ${this.MIN_TARGET_SIZE}px minimum`
        });
      }
    });

    return { targets, violations };
  }

  getSpacingBetween(element1: Element, element2: Element): number {
    const rect1 = element1.getBoundingClientRect();
    const rect2 = element2.getBoundingClientRect();

    // Calculate minimum distance between rectangles
    const horizontalGap = Math.max(0, Math.max(rect1.left - rect2.right, rect2.left - rect1.right));
    const verticalGap = Math.max(0, Math.max(rect1.top - rect2.bottom, rect2.top - rect1.bottom));

    return Math.min(horizontalGap, verticalGap);
  }

  validateSpacing(container: Element): Array<{
    element1: Element;
    element2: Element;
    spacing: number;
    passes: boolean;
  }> {
    const results: Array<{
      element1: Element;
      element2: Element;
      spacing: number;
      passes: boolean;
    }> = [];

    const targets = this.validateAllTargets(container).targets;

    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        const spacing = this.getSpacingBetween(targets[i].element, targets[j].element);
        const passes = spacing >= this.MIN_SPACING;

        results.push({
          element1: targets[i].element,
          element2: targets[j].element,
          spacing,
          passes
        });
      }
    }

    return results;
  }
}

/**
 * Analyzes cognitive load and interface complexity
 */
export class CognitiveLoadAnalyzer {
  analyzeInterface(container: Element): {
    informationDensity: number;
    navigationDepth: number;
    interactionComplexity: 'low' | 'medium' | 'high';
    hasSimpleMode: boolean;
    cognitiveLoadScore: number;
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    // Analyze information density (Miller's Rule: 7±2 items)
    const informationDensity = this.calculateInformationDensity(container);
    if (informationDensity > 9) {
      recommendations.push('Reduce information density - consider grouping or progressive disclosure');
    }

    // Analyze navigation depth
    const navigationDepth = this.calculateNavigationDepth(container);
    if (navigationDepth > 3) {
      recommendations.push('Reduce navigation depth to maximum 3 levels');
    }

    // Analyze interaction complexity
    const interactionComplexity = this.assessInteractionComplexity(container);
    if (interactionComplexity === 'high') {
      recommendations.push('Simplify interaction patterns - consider single-step alternatives');
    }

    // Check for simple mode
    const hasSimpleMode = this.hasSimplificationOptions(container);
    if (!hasSimpleMode && (informationDensity > 7 || interactionComplexity === 'high')) {
      recommendations.push('Consider providing a simplified interface mode');
    }

    // Calculate overall cognitive load score (0-100, lower is better)
    const cognitiveLoadScore = this.calculateCognitiveLoadScore({
      informationDensity,
      navigationDepth,
      interactionComplexity,
      hasSimpleMode
    });

    return {
      informationDensity,
      navigationDepth,
      interactionComplexity,
      hasSimpleMode,
      cognitiveLoadScore,
      recommendations
    };
  }

  private calculateInformationDensity(container: Element): number {
    // Count distinct pieces of information visible at once
    const textElements = container.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, li');
    const interactiveElements = container.querySelectorAll('button, a, input, select');
    const mediaElements = container.querySelectorAll('img, video, canvas');

    // Filter for visible elements only
    const visibleElements = Array.from([...textElements, ...interactiveElements, ...mediaElements])
      .filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });

    // Group by visual containers to count distinct information chunks
    const informationChunks = new Set();
    visibleElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const chunk = `${Math.floor(rect.top / 50)}-${Math.floor(rect.left / 100)}`;
      informationChunks.add(chunk);
    });

    return informationChunks.size;
  }

  private calculateNavigationDepth(container: Element): number {
    // Find the deepest navigation path
    const navElements = container.querySelectorAll('nav, [role="navigation"], .menu, .nav');
    let maxDepth = 0;

    navElements.forEach(nav => {
      const depth = this.getMaxNestedDepth(nav, 'ul, ol, [role="menu"], .submenu');
      maxDepth = Math.max(maxDepth, depth);
    });

    return maxDepth;
  }

  private getMaxNestedDepth(element: Element, selector: string): number {
    const children = element.querySelectorAll(selector);
    if (children.length === 0) return 1;

    let maxDepth = 1;
    children.forEach(child => {
      const depth = 1 + this.getMaxNestedDepth(child, selector);
      maxDepth = Math.max(maxDepth, depth);
    });

    return maxDepth;
  }

  private assessInteractionComplexity(container: Element): 'low' | 'medium' | 'high' {
    // Analyze types and complexity of interactions required
    const multiStepForms = container.querySelectorAll('form').length;
    const dragDropElements = container.querySelectorAll('[draggable="true"]').length;
    const complexWidgets = container.querySelectorAll('[role="tree"], [role="grid"], [role="application"]').length;
    const multiSelectElements = container.querySelectorAll('select[multiple], [role="listbox"][aria-multiselectable]').length;

    const complexityScore = multiStepForms + dragDropElements * 2 + complexWidgets * 3 + multiSelectElements;

    if (complexityScore === 0) return 'low';
    if (complexityScore <= 3) return 'medium';
    return 'high';
  }

  private hasSimplificationOptions(container: Element): boolean {
    // Look for simplified mode toggle, beginner mode, or reduced complexity options
    const simplificationIndicators = [
      '[aria-label*="simple"]',
      '[aria-label*="basic"]',
      '[aria-label*="beginner"]',
      '.simple-mode',
      '.basic-mode',
      '.reduced-ui'
    ];

    return simplificationIndicators.some(selector =>
      container.querySelector(selector) !== null
    );
  }

  private calculateCognitiveLoadScore(metrics: {
    informationDensity: number;
    navigationDepth: number;
    interactionComplexity: 'low' | 'medium' | 'high';
    hasSimpleMode: boolean;
  }): number {
    let score = 0;

    // Information density penalty (0-40 points)
    score += Math.min(40, (metrics.informationDensity - 5) * 5);

    // Navigation depth penalty (0-30 points)
    score += Math.min(30, (metrics.navigationDepth - 1) * 10);

    // Interaction complexity penalty (0-20 points)
    const complexityPenalty = {
      'low': 0,
      'medium': 10,
      'high': 20
    };
    score += complexityPenalty[metrics.interactionComplexity];

    // Simple mode bonus (-10 points)
    if (metrics.hasSimpleMode) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }
}

/**
 * Validates complete keyboard-only navigation
 */
export class KeyboardOnlyValidator {
  async testFullKeyboardAccess(container: Element): Promise<{
    reachableElements: Element[];
    unreachableElements: Element[];
    trapViolations: Array<{ element: Element; issue: string }>;
    missingShortcuts: string[];
    keyboardScore: number;
  }> {
    const focusableElements = this.getAllFocusableElements(container);
    const reachableElements: Element[] = [];
    const unreachableElements: Element[] = [];
    const trapViolations: Array<{ element: Element; issue: string }> = [];

    // Test each element for keyboard reachability
    for (const element of focusableElements) {
      if (await this.isKeyboardReachable(element)) {
        reachableElements.push(element);
      } else {
        unreachableElements.push(element);
      }
    }

    // Test for focus traps
    const focusTraps = await this.findFocusTrapViolations(container);
    trapViolations.push(...focusTraps);

    // Check for missing keyboard shortcuts
    const missingShortcuts = this.checkForMissingShortcuts(container);

    // Calculate keyboard accessibility score
    const keyboardScore = this.calculateKeyboardScore({
      totalElements: focusableElements.length,
      reachableElements: reachableElements.length,
      trapViolations: trapViolations.length,
      missingShortcuts: missingShortcuts.length
    });

    return {
      reachableElements,
      unreachableElements,
      trapViolations,
      missingShortcuts,
      keyboardScore
    };
  }

  private getAllFocusableElements(container: Element): Element[] {
    const focusableSelectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
      '[role="button"]:not([aria-disabled="true"])',
      '[role="link"]',
      '[role="menuitem"]',
      '[role="tab"]'
    ];

    return Array.from(container.querySelectorAll(focusableSelectors.join(', ')))
      .filter(el => this.isVisible(el));
  }

  private isVisible(element: Element): boolean {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           rect.width > 0 &&
           rect.height > 0;
  }

  private async isKeyboardReachable(element: Element): Promise<boolean> {
    try {
      (element as HTMLElement).focus();
      return document.activeElement === element;
    } catch {
      return false;
    }
  }

  private async findFocusTrapViolations(container: Element): Promise<Array<{ element: Element; issue: string }>> {
    const violations: Array<{ element: Element; issue: string }> = [];

    // Find modal dialogs and other focus trap containers
    const trapContainers = container.querySelectorAll('[role="dialog"], .modal, .popup, [aria-modal="true"]');

    for (const trapContainer of trapContainers) {
      const focusableInTrap = this.getAllFocusableElements(trapContainer);

      if (focusableInTrap.length === 0) {
        violations.push({
          element: trapContainer,
          issue: 'Focus trap container has no focusable elements'
        });
        continue;
      }

      // Test focus trap behavior
      const firstElement = focusableInTrap[0] as HTMLElement;
      const lastElement = focusableInTrap[focusableInTrap.length - 1] as HTMLElement;

      firstElement.focus();

      // Simulate Tab from last element
      lastElement.focus();
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      lastElement.dispatchEvent(tabEvent);

      if (document.activeElement !== firstElement) {
        violations.push({
          element: trapContainer,
          issue: 'Focus trap does not cycle focus properly'
        });
      }

      // Simulate Shift+Tab from first element
      firstElement.focus();
      const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
      firstElement.dispatchEvent(shiftTabEvent);

      if (document.activeElement !== lastElement) {
        violations.push({
          element: trapContainer,
          issue: 'Focus trap does not handle reverse cycling'
        });
      }
    }

    return violations;
  }

  private checkForMissingShortcuts(container: Element): string[] {
    const missingShortcuts: string[] = [];

    // Essential shortcuts that should be available
    const essentialShortcuts = [
      { key: 'Escape', purpose: 'Close modal/cancel action', selector: '[role="dialog"], .modal' },
      { key: 'Enter', purpose: 'Activate primary action', selector: 'form, [role="dialog"]' },
      { key: 'Ctrl+F', purpose: 'Search functionality', selector: '[role="searchbox"], input[type="search"]' },
      { key: 'Ctrl+S', purpose: 'Save action', selector: 'form, [data-saveable]' }
    ];

    essentialShortcuts.forEach(shortcut => {
      const relevantElements = container.querySelectorAll(shortcut.selector);

      if (relevantElements.length > 0) {
        // Check if shortcut is documented or implemented
        const hasDocumentation = container.querySelector(`[data-shortcut*="${shortcut.key}"], [aria-keyshortcuts*="${shortcut.key}"]`);

        if (!hasDocumentation) {
          missingShortcuts.push(`${shortcut.key}: ${shortcut.purpose}`);
        }
      }
    });

    return missingShortcuts;
  }

  private calculateKeyboardScore(metrics: {
    totalElements: number;
    reachableElements: number;
    trapViolations: number;
    missingShortcuts: number;
  }): number {
    if (metrics.totalElements === 0) return 100;

    // Base score from reachability
    const reachabilityScore = (metrics.reachableElements / metrics.totalElements) * 80;

    // Penalties
    const trapPenalty = metrics.trapViolations * 10;
    const shortcutPenalty = metrics.missingShortcuts * 5;

    return Math.max(0, Math.min(100, reachabilityScore - trapPenalty - shortcutPenalty));
  }
}

/**
 * Validates color accessibility and contrast
 */
export class ColorAccessibilityValidator {
  validateColorContrast(container: Element): {
    elements: Array<{
      element: Element;
      foreground: string;
      background: string;
      ratio: number;
      passes: boolean;
      level: 'AA' | 'AAA';
    }>;
    violations: Array<{
      element: Element;
      issue: string;
      recommendation: string;
    }>;
  } {
    const elements: Array<{
      element: Element;
      foreground: string;
      background: string;
      ratio: number;
      passes: boolean;
      level: 'AA' | 'AAA';
    }> = [];

    const violations: Array<{
      element: Element;
      issue: string;
      recommendation: string;
    }> = [];

    // Find all text elements
    const textElements = container.querySelectorAll('*');

    textElements.forEach(element => {
      const style = window.getComputedStyle(element);
      const hasText = element.textContent && element.textContent.trim().length > 0;

      if (hasText) {
        const foreground = style.color;
        const background = this.getEffectiveBackgroundColor(element);
        const ratio = this.calculateContrastRatio(foreground, background);
        const fontSize = parseFloat(style.fontSize);
        const isLargeText = fontSize >= 18 || (fontSize >= 14 && style.fontWeight === 'bold');

        const requiredRatio = isLargeText ? 3 : 4.5; // WCAG AA requirements
        const passes = ratio >= requiredRatio;

        elements.push({
          element,
          foreground,
          background,
          ratio,
          passes,
          level: ratio >= (isLargeText ? 4.5 : 7) ? 'AAA' : 'AA'
        });

        if (!passes) {
          violations.push({
            element,
            issue: `Insufficient contrast ratio: ${ratio.toFixed(2)}:1 (required: ${requiredRatio}:1)`,
            recommendation: `Adjust colors to achieve at least ${requiredRatio}:1 contrast ratio`
          });
        }
      }
    });

    return { elements, violations };
  }

  private getEffectiveBackgroundColor(element: Element): string {
    let currentElement = element as HTMLElement;

    while (currentElement && currentElement !== document.body) {
      const style = window.getComputedStyle(currentElement);
      const backgroundColor = style.backgroundColor;

      if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent') {
        return backgroundColor;
      }

      currentElement = currentElement.parentElement as HTMLElement;
    }

    return 'rgb(255, 255, 255)'; // Default to white
  }

  private calculateContrastRatio(foreground: string, background: string): number {
    const fgLuminance = this.getLuminance(foreground);
    const bgLuminance = this.getLuminance(background);

    const lighter = Math.max(fgLuminance, bgLuminance);
    const darker = Math.min(fgLuminance, bgLuminance);

    return (lighter + 0.05) / (darker + 0.05);
  }

  private getLuminance(color: string): number {
    const rgb = this.parseColor(color);
    const [r, g, b] = rgb.map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  private parseColor(color: string): [number, number, number] {
    // Simple RGB parser - would need more robust implementation for production
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    }
    return [0, 0, 0];
  }
}

/**
 * Overall inclusive design scorer
 */
export class InclusiveDesignScorer {
  calculateOverallScore(metrics: {
    touchTargets: { violations: any[] };
    cognitiveLoad: { cognitiveLoadScore: number };
    keyboardAccess: { keyboardScore: number };
    colorContrast: { violations: any[] };
  }): {
    overallScore: number;
    breakdown: {
      motor: number;
      cognitive: number;
      keyboard: number;
      visual: number;
    };
    recommendations: string[];
  } {
    const motor = metrics.touchTargets.violations.length === 0 ? 100 : Math.max(0, 100 - metrics.touchTargets.violations.length * 20);
    const cognitive = 100 - metrics.cognitiveLoad.cognitiveLoadScore;
    const keyboard = metrics.keyboardAccess.keyboardScore;
    const visual = metrics.colorContrast.violations.length === 0 ? 100 : Math.max(0, 100 - metrics.colorContrast.violations.length * 15);

    const overallScore = (motor + cognitive + keyboard + visual) / 4;

    const recommendations: string[] = [];

    if (motor < 80) recommendations.push('Improve touch target sizes and spacing');
    if (cognitive < 80) recommendations.push('Reduce cognitive load and interface complexity');
    if (keyboard < 80) recommendations.push('Enhance keyboard navigation and shortcuts');
    if (visual < 80) recommendations.push('Improve color contrast and visual accessibility');

    return {
      overallScore,
      breakdown: { motor, cognitive, keyboard, visual },
      recommendations
    };
  }
}