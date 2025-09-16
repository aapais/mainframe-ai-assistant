/**
 * Color Contrast Validator
 * WCAG 2.1 AA Color Contrast Testing
 *
 * This validator provides comprehensive color contrast testing including:
 * - Text color contrast validation
 * - Focus indicator contrast testing
 * - Interactive element contrast validation
 * - Background image contrast testing
 * - High contrast mode testing
 */

export interface ColorContrastTestResult {
  passed: boolean;
  overallRatio: number;
  textContrast: TextContrastResult[];
  focusIndicators: FocusIndicatorContrastResult[];
  interactiveElements: InteractiveElementContrastResult[];
  backgroundImages: BackgroundImageContrastResult[];
  highContrastMode: HighContrastModeResult;
  issues: ColorContrastIssue[];
}

export interface TextContrastResult {
  element: HTMLElement;
  description: string;
  foreground: string;
  background: string;
  ratio: number;
  size: number;
  weight: string;
  isLargeText: boolean;
  passesAA: boolean;
  passesAAA: boolean;
  requiredRatio: number;
}

export interface FocusIndicatorContrastResult {
  element: HTMLElement;
  description: string;
  indicatorColor: string;
  backgroundColor: string;
  ratio: number;
  passesRequirement: boolean;
  indicatorType: 'outline' | 'boxShadow' | 'border' | 'custom';
}

export interface InteractiveElementContrastResult {
  element: HTMLElement;
  description: string;
  states: StateContrastResult[];
  overallPassed: boolean;
}

export interface StateContrastResult {
  state: 'default' | 'hover' | 'focus' | 'active' | 'disabled';
  foreground: string;
  background: string;
  ratio: number;
  passes: boolean;
}

export interface BackgroundImageContrastResult {
  element: HTMLElement;
  description: string;
  hasBackgroundImage: boolean;
  textOverlay: boolean;
  contrastSufficient: boolean;
  suggestion: string;
}

export interface HighContrastModeResult {
  supported: boolean;
  textVisible: boolean;
  focusVisible: boolean;
  bordersVisible: boolean;
  iconsVisible: boolean;
  issues: string[];
}

export interface ColorContrastIssue {
  severity: 'critical' | 'warning' | 'info';
  type: 'text' | 'focus' | 'interactive' | 'background' | 'highContrast';
  element: string;
  description: string;
  currentRatio: number;
  requiredRatio: number;
  wcagCriterion: string;
  suggestion: string;
}

/**
 * Color utility functions
 */
class ColorUtils {
  /**
   * Parse CSS color to RGB values
   */
  static parseColor(color: string): { r: number; g: number; b: number; a: number } | null {
    if (!color || color === 'transparent') return null;

    // Handle rgb/rgba
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1], 10),
        g: parseInt(rgbMatch[2], 10),
        b: parseInt(rgbMatch[3], 10),
        a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
      };
    }

    // Handle hex colors
    const hexMatch = color.match(/^#([a-f\d]{3}|[a-f\d]{6})$/i);
    if (hexMatch) {
      const hex = hexMatch[1];
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
          a: 1
        };
      } else {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: 1
        };
      }
    }

    // Handle named colors (basic set)
    const namedColors: { [key: string]: { r: number; g: number; b: number; a: number } } = {
      'black': { r: 0, g: 0, b: 0, a: 1 },
      'white': { r: 255, g: 255, b: 255, a: 1 },
      'red': { r: 255, g: 0, b: 0, a: 1 },
      'green': { r: 0, g: 128, b: 0, a: 1 },
      'blue': { r: 0, g: 0, b: 255, a: 1 },
      'gray': { r: 128, g: 128, b: 128, a: 1 },
      'grey': { r: 128, g: 128, b: 128, a: 1 }
    };

    return namedColors[color.toLowerCase()] || null;
  }

  /**
   * Calculate relative luminance
   */
  static getRelativeLuminance(color: { r: number; g: number; b: number }): number {
    const { r, g, b } = color;

    // Convert to sRGB
    const rsRGB = r / 255;
    const gsRGB = g / 255;
    const bsRGB = b / 255;

    // Apply gamma correction
    const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

    // Calculate relative luminance
    return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
  }

  /**
   * Calculate contrast ratio between two colors
   */
  static getContrastRatio(color1: string, color2: string): number {
    const rgb1 = this.parseColor(color1);
    const rgb2 = this.parseColor(color2);

    if (!rgb1 || !rgb2) return 0;

    const lum1 = this.getRelativeLuminance(rgb1);
    const lum2 = this.getRelativeLuminance(rgb2);

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Get effective background color considering transparency
   */
  static getEffectiveBackgroundColor(element: HTMLElement): string {
    let currentElement: HTMLElement | null = element;
    const backgrounds: Array<{ color: string; alpha: number }> = [];

    while (currentElement && currentElement !== document.body) {
      const styles = window.getComputedStyle(currentElement);
      const backgroundColor = styles.backgroundColor;

      if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent') {
        const color = this.parseColor(backgroundColor);
        if (color) {
          backgrounds.push({ color: backgroundColor, alpha: color.a });
          if (color.a === 1) break; // Opaque background found
        }
      }

      currentElement = currentElement.parentElement;
    }

    if (backgrounds.length === 0) {
      return 'rgb(255, 255, 255)'; // Default to white
    }

    // For simplicity, return the first background color
    // In a full implementation, you'd blend all transparent backgrounds
    return backgrounds[0].color;
  }
}

/**
 * Color Contrast Validator Class
 */
export class ColorContrastValidator {
  private container: HTMLElement;
  private issues: ColorContrastIssue[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Run comprehensive color contrast tests
   */
  async validateColorContrast(): Promise<ColorContrastTestResult> {
    console.log('🎨 Validating color contrast...');

    const [
      textContrast,
      focusIndicators,
      interactiveElements,
      backgroundImages,
      highContrastMode
    ] = await Promise.all([
      this.validateTextContrast(),
      this.validateFocusIndicatorContrast(),
      this.validateInteractiveElementContrast(),
      this.validateBackgroundImageContrast(),
      this.validateHighContrastMode()
    ]);

    const overallRatio = this.calculateOverallRatio(textContrast, focusIndicators, interactiveElements);

    return {
      passed: this.issues.filter(issue => issue.severity === 'critical').length === 0,
      overallRatio,
      textContrast,
      focusIndicators,
      interactiveElements,
      backgroundImages,
      highContrastMode,
      issues: this.issues
    };
  }

  /**
   * Validate text contrast
   */
  private async validateTextContrast(): Promise<TextContrastResult[]> {
    const textElements = this.container.querySelectorAll(
      'p, span, div, h1, h2, h3, h4, h5, h6, label, button, a, input, textarea, select, li, td, th, caption, legend'
    );

    const results: TextContrastResult[] = [];

    textElements.forEach(element => {
      const htmlElement = element as HTMLElement;
      const styles = window.getComputedStyle(htmlElement);

      // Skip elements without visible text
      const text = htmlElement.textContent?.trim();
      if (!text || text.length === 0) return;

      // Skip hidden elements
      if (styles.display === 'none' || styles.visibility === 'hidden') return;

      const foreground = styles.color;
      const background = ColorUtils.getEffectiveBackgroundColor(htmlElement);
      const fontSize = parseFloat(styles.fontSize);
      const fontWeight = styles.fontWeight;

      const ratio = ColorUtils.getContrastRatio(foreground, background);
      const isLargeText = this.isLargeText(fontSize, fontWeight);
      const requiredRatio = isLargeText ? 3.0 : 4.5;
      const passesAA = ratio >= requiredRatio;
      const passesAAA = ratio >= (isLargeText ? 4.5 : 7.0);

      if (!passesAA) {
        this.addIssue({
          severity: 'critical',
          type: 'text',
          element: this.getElementDescription(htmlElement),
          description: `Text contrast ratio ${ratio.toFixed(2)}:1 is below WCAG AA requirement`,
          currentRatio: ratio,
          requiredRatio,
          wcagCriterion: '1.4.3 Contrast (Minimum)',
          suggestion: `Increase contrast to at least ${requiredRatio}:1 for WCAG AA compliance`
        });
      }

      results.push({
        element: htmlElement,
        description: this.getElementDescription(htmlElement),
        foreground,
        background,
        ratio,
        size: fontSize,
        weight: fontWeight,
        isLargeText,
        passesAA,
        passesAAA,
        requiredRatio
      });
    });

    return results;
  }

  /**
   * Validate focus indicator contrast
   */
  private async validateFocusIndicatorContrast(): Promise<FocusIndicatorContrastResult[]> {
    const focusableElements = this.getFocusableElements();
    const results: FocusIndicatorContrastResult[] = [];

    for (const element of focusableElements) {
      element.focus();
      await new Promise(resolve => setTimeout(resolve, 50)); // Allow focus styles to apply

      const styles = window.getComputedStyle(element);
      const focusIndicator = this.getFocusIndicatorInfo(element, styles);

      if (focusIndicator) {
        const background = ColorUtils.getEffectiveBackgroundColor(element);
        const ratio = ColorUtils.getContrastRatio(focusIndicator.color, background);
        const passesRequirement = ratio >= 3.0; // WCAG 2.1 AA requirement for non-text contrast

        if (!passesRequirement) {
          this.addIssue({
            severity: 'critical',
            type: 'focus',
            element: this.getElementDescription(element),
            description: `Focus indicator contrast ratio ${ratio.toFixed(2)}:1 is below WCAG requirement`,
            currentRatio: ratio,
            requiredRatio: 3.0,
            wcagCriterion: '1.4.11 Non-text Contrast',
            suggestion: 'Increase focus indicator contrast to at least 3:1'
          });
        }

        results.push({
          element,
          description: this.getElementDescription(element),
          indicatorColor: focusIndicator.color,
          backgroundColor: background,
          ratio,
          passesRequirement,
          indicatorType: focusIndicator.type
        });
      } else {
        this.addIssue({
          severity: 'critical',
          type: 'focus',
          element: this.getElementDescription(element),
          description: 'No visible focus indicator found',
          currentRatio: 0,
          requiredRatio: 3.0,
          wcagCriterion: '2.4.7 Focus Visible',
          suggestion: 'Add visible focus indicator with adequate contrast'
        });
      }
    }

    return results;
  }

  /**
   * Validate interactive element contrast
   */
  private async validateInteractiveElementContrast(): Promise<InteractiveElementContrastResult[]> {
    const interactiveElements = this.container.querySelectorAll(
      'button, input, select, textarea, a, [role="button"], [role="link"]'
    );

    const results: InteractiveElementContrastResult[] = [];

    for (const element of interactiveElements) {
      const htmlElement = element as HTMLElement;
      const states = await this.testElementStates(htmlElement);
      const overallPassed = states.every(state => state.passes);

      if (!overallPassed) {
        const failedStates = states.filter(state => !state.passes);
        failedStates.forEach(state => {
          this.addIssue({
            severity: 'warning',
            type: 'interactive',
            element: this.getElementDescription(htmlElement),
            description: `${state.state} state contrast ratio ${state.ratio.toFixed(2)}:1 is insufficient`,
            currentRatio: state.ratio,
            requiredRatio: 4.5,
            wcagCriterion: '1.4.3 Contrast (Minimum)',
            suggestion: `Improve ${state.state} state contrast for better usability`
          });
        });
      }

      results.push({
        element: htmlElement,
        description: this.getElementDescription(htmlElement),
        states,
        overallPassed
      });
    }

    return results;
  }

  /**
   * Validate background image contrast
   */
  private async validateBackgroundImageContrast(): Promise<BackgroundImageContrastResult[]> {
    const elementsWithBackground = this.container.querySelectorAll('*');
    const results: BackgroundImageContrastResult[] = [];

    elementsWithBackground.forEach(element => {
      const htmlElement = element as HTMLElement;
      const styles = window.getComputedStyle(htmlElement);
      const backgroundImage = styles.backgroundImage;

      if (backgroundImage && backgroundImage !== 'none') {
        const hasText = Boolean(htmlElement.textContent?.trim());
        const hasTextOverlay = hasText;

        let contrastSufficient = true;
        let suggestion = '';

        if (hasTextOverlay) {
          // For elements with background images and text, we need to ensure sufficient contrast
          const textColor = styles.color;

          // This is a simplified check - in practice, you'd analyze the actual image
          const hasTextShadow = styles.textShadow !== 'none';
          const hasOverlay = this.hasContrastOverlay(htmlElement);

          if (!hasTextShadow && !hasOverlay) {
            contrastSufficient = false;
            suggestion = 'Add text shadow, background overlay, or ensure background image provides sufficient contrast';

            this.addIssue({
              severity: 'warning',
              type: 'background',
              element: this.getElementDescription(htmlElement),
              description: 'Text over background image may not have sufficient contrast',
              currentRatio: 0, // Cannot determine without image analysis
              requiredRatio: 4.5,
              wcagCriterion: '1.4.3 Contrast (Minimum)',
              suggestion
            });
          }
        }

        results.push({
          element: htmlElement,
          description: this.getElementDescription(htmlElement),
          hasBackgroundImage: true,
          textOverlay: hasTextOverlay,
          contrastSufficient,
          suggestion
        });
      }
    });

    return results;
  }

  /**
   * Validate high contrast mode support
   */
  private async validateHighContrastMode(): Promise<HighContrastModeResult> {
    const issues: string[] = [];

    // Simulate high contrast mode by checking if elements respond to high contrast media queries
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    const forcedColorsQuery = window.matchMedia('(forced-colors: active)');

    const supported = this.testHighContrastSupport();
    const textVisible = this.testHighContrastTextVisibility();
    const focusVisible = this.testHighContrastFocusVisibility();
    const bordersVisible = this.testHighContrastBorderVisibility();
    const iconsVisible = this.testHighContrastIconVisibility();

    if (!supported) {
      issues.push('High contrast mode may not be properly supported');
    }

    if (!textVisible) {
      issues.push('Text may not be visible in high contrast mode');
    }

    if (!focusVisible) {
      issues.push('Focus indicators may not be visible in high contrast mode');
    }

    if (!bordersVisible) {
      issues.push('Element borders may not be visible in high contrast mode');
    }

    if (!iconsVisible) {
      issues.push('Icons and graphics may not be visible in high contrast mode');
    }

    return {
      supported,
      textVisible,
      focusVisible,
      bordersVisible,
      iconsVisible,
      issues
    };
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
      '[role="link"]:not([aria-disabled="true"])'
    ].join(', ');

    return Array.from(this.container.querySelectorAll(selector)) as HTMLElement[];
  }

  private getElementDescription(element: HTMLElement): string {
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const className = element.className ? `.${element.className.split(' ')[0]}` : '';
    const role = element.getAttribute('role') ? `[role="${element.getAttribute('role')}"]` : '';
    const text = element.textContent?.slice(0, 30) || '';

    return `${tagName}${id}${className}${role} "${text}"`.trim();
  }

  private isLargeText(fontSize: number, fontWeight: string): boolean {
    const weight = fontWeight === 'bold' || parseInt(fontWeight) >= 700;
    return fontSize >= 18 || (fontSize >= 14 && weight);
  }

  private getFocusIndicatorInfo(element: HTMLElement, styles: CSSStyleDeclaration): { color: string; type: 'outline' | 'boxShadow' | 'border' | 'custom' } | null {
    const outline = styles.outline;
    const boxShadow = styles.boxShadow;
    const borderColor = styles.borderColor;

    if (outline !== 'none' && outline !== '') {
      const outlineColor = styles.outlineColor;
      return { color: outlineColor, type: 'outline' };
    }

    if (boxShadow !== 'none' && boxShadow !== '') {
      // Extract color from box-shadow (simplified)
      const shadowMatch = boxShadow.match(/rgba?\([^)]+\)|#[a-f\d]{3,6}/i);
      if (shadowMatch) {
        return { color: shadowMatch[0], type: 'boxShadow' };
      }
    }

    // Check for border changes (simplified detection)
    if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)') {
      return { color: borderColor, type: 'border' };
    }

    // Check for custom focus indicators
    if (element.classList.contains('focus-visible') || element.classList.contains('focused')) {
      return { color: styles.backgroundColor || styles.color, type: 'custom' };
    }

    return null;
  }

  private async testElementStates(element: HTMLElement): Promise<StateContrastResult[]> {
    const states: StateContrastResult[] = [];

    // Test default state
    const defaultStyles = window.getComputedStyle(element);
    const defaultForeground = defaultStyles.color;
    const defaultBackground = ColorUtils.getEffectiveBackgroundColor(element);
    const defaultRatio = ColorUtils.getContrastRatio(defaultForeground, defaultBackground);

    states.push({
      state: 'default',
      foreground: defaultForeground,
      background: defaultBackground,
      ratio: defaultRatio,
      passes: defaultRatio >= 4.5
    });

    // Test hover state (simulated)
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 50));

    const hoverStyles = window.getComputedStyle(element);
    const hoverForeground = hoverStyles.color;
    const hoverBackground = ColorUtils.getEffectiveBackgroundColor(element);
    const hoverRatio = ColorUtils.getContrastRatio(hoverForeground, hoverBackground);

    states.push({
      state: 'hover',
      foreground: hoverForeground,
      background: hoverBackground,
      ratio: hoverRatio,
      passes: hoverRatio >= 4.5
    });

    element.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    // Test focus state
    element.focus();
    await new Promise(resolve => setTimeout(resolve, 50));

    const focusStyles = window.getComputedStyle(element);
    const focusForeground = focusStyles.color;
    const focusBackground = ColorUtils.getEffectiveBackgroundColor(element);
    const focusRatio = ColorUtils.getContrastRatio(focusForeground, focusBackground);

    states.push({
      state: 'focus',
      foreground: focusForeground,
      background: focusBackground,
      ratio: focusRatio,
      passes: focusRatio >= 4.5
    });

    element.blur();

    // Test disabled state if applicable
    if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') {
      const disabledStyles = window.getComputedStyle(element);
      const disabledForeground = disabledStyles.color;
      const disabledBackground = ColorUtils.getEffectiveBackgroundColor(element);
      const disabledRatio = ColorUtils.getContrastRatio(disabledForeground, disabledBackground);

      states.push({
        state: 'disabled',
        foreground: disabledForeground,
        background: disabledBackground,
        ratio: disabledRatio,
        passes: disabledRatio >= 3.0 // Disabled elements have lower requirement
      });
    }

    return states;
  }

  private hasContrastOverlay(element: HTMLElement): boolean {
    const styles = window.getComputedStyle(element);

    // Check for pseudo-elements with overlays
    const beforeContent = window.getComputedStyle(element, '::before').content;
    const afterContent = window.getComputedStyle(element, '::after').content;

    return beforeContent !== 'none' || afterContent !== 'none';
  }

  private testHighContrastSupport(): boolean {
    // Check if CSS contains high contrast media queries
    const stylesheets = Array.from(document.styleSheets);

    try {
      for (const stylesheet of stylesheets) {
        const rules = Array.from(stylesheet.cssRules || []);
        const hasHighContrastRules = rules.some(rule =>
          rule.cssText.includes('prefers-contrast: high') ||
          rule.cssText.includes('forced-colors: active')
        );

        if (hasHighContrastRules) return true;
      }
    } catch (e) {
      // Cross-origin stylesheets may throw errors
    }

    return false;
  }

  private testHighContrastTextVisibility(): boolean {
    // Test if text would be visible in high contrast mode
    const textElements = this.container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div');

    return Array.from(textElements).every(element => {
      const styles = window.getComputedStyle(element as HTMLElement);
      const color = styles.color;
      const background = styles.backgroundColor;

      // In high contrast mode, colors are typically forced to black/white
      return color !== background && color !== 'transparent';
    });
  }

  private testHighContrastFocusVisibility(): boolean {
    // Test if focus indicators would be visible in high contrast mode
    const focusableElements = this.getFocusableElements();

    return focusableElements.every(element => {
      element.focus();
      const styles = window.getComputedStyle(element);
      const hasVisibleIndicator =
        styles.outline !== 'none' ||
        styles.boxShadow !== 'none' ||
        styles.border !== 'none';

      element.blur();
      return hasVisibleIndicator;
    });
  }

  private testHighContrastBorderVisibility(): boolean {
    // Test if important borders would be visible
    const elements = this.container.querySelectorAll('button, input, select, textarea');

    return Array.from(elements).every(element => {
      const styles = window.getComputedStyle(element as HTMLElement);
      return styles.border !== 'none' && styles.borderWidth !== '0px';
    });
  }

  private testHighContrastIconVisibility(): boolean {
    // Test if icons would be visible (simplified check)
    const icons = this.container.querySelectorAll('[role="img"], .icon, svg');

    return Array.from(icons).every(icon => {
      const styles = window.getComputedStyle(icon as HTMLElement);
      return styles.display !== 'none' && styles.opacity !== '0';
    });
  }

  private calculateOverallRatio(
    textResults: TextContrastResult[],
    focusResults: FocusIndicatorContrastResult[],
    interactiveResults: InteractiveElementContrastResult[]
  ): number {
    const allRatios: number[] = [];

    textResults.forEach(result => allRatios.push(result.ratio));
    focusResults.forEach(result => allRatios.push(result.ratio));

    interactiveResults.forEach(result => {
      result.states.forEach(state => allRatios.push(state.ratio));
    });

    if (allRatios.length === 0) return 0;

    return allRatios.reduce((sum, ratio) => sum + ratio, 0) / allRatios.length;
  }

  private addIssue(issue: ColorContrastIssue): void {
    this.issues.push(issue);
  }
}

export default ColorContrastValidator;