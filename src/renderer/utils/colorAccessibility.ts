/**
 * Color Accessibility Testing Utilities
 * Comprehensive WCAG compliance testing and color analysis
 *
 * This utility provides:
 * - WCAG 2.1 AA/AAA contrast ratio testing
 * - Color blindness simulation
 * - High contrast mode testing
 * - Dynamic color adjustment recommendations
 * - Accessibility compliance reporting
 */

export interface ColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  luminance: number;
}

export interface ContrastResult {
  ratio: number;
  wcagAA: boolean;
  wcagAAA: boolean;
  wcagAALarge: boolean;
  wcagAAALarge: boolean;
  recommendation: string;
}

export interface AccessibilityReport {
  compliant: boolean;
  issues: AccessibilityIssue[];
  suggestions: string[];
  overallScore: number;
  wcagLevel: 'Fail' | 'AA' | 'AAA';
}

export interface AccessibilityIssue {
  severity: 'critical' | 'major' | 'minor';
  type: 'contrast' | 'colorBlindness' | 'highContrast' | 'focus';
  element: string;
  description: string;
  currentValue: number;
  requiredValue: number;
  suggestion: string;
}

export class ColorAccessibilityTester {
  /**
   * Parse color string to ColorInfo object
   */
  static parseColor(color: string): ColorInfo | null {
    if (!color) return null;

    // Remove whitespace and convert to lowercase
    color = color.trim().toLowerCase();

    let rgb: { r: number; g: number; b: number };

    // Handle hex colors
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        rgb = {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16)
        };
      } else if (hex.length === 6) {
        rgb = {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16)
        };
      } else {
        return null;
      }
    }
    // Handle rgb/rgba colors
    else if (color.startsWith('rgb')) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
      if (!match) return null;

      rgb = {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3])
      };
    }
    // Handle named colors (basic set)
    else {
      const namedColors: Record<string, { r: number; g: number; b: number }> = {
        white: { r: 255, g: 255, b: 255 },
        black: { r: 0, g: 0, b: 0 },
        red: { r: 255, g: 0, b: 0 },
        green: { r: 0, g: 128, b: 0 },
        blue: { r: 0, g: 0, b: 255 },
        gray: { r: 128, g: 128, b: 128 },
        grey: { r: 128, g: 128, b: 128 }
      };

      if (!namedColors[color]) return null;
      rgb = namedColors[color];
    }

    // Calculate luminance
    const luminance = this.getRelativeLuminance(rgb);

    // Convert to HSL
    const hsl = this.rgbToHsl(rgb);

    // Convert to hex
    const hex = `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;

    return { hex, rgb, hsl, luminance };
  }

  /**
   * Calculate relative luminance according to WCAG
   */
  static getRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
    const { r, g, b } = rgb;

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
   * Convert RGB to HSL
   */
  static rgbToHsl(rgb: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h: number, s: number;
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // Achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
        default: h = 0;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  /**
   * Calculate contrast ratio between two colors
   */
  static getContrastRatio(color1: string, color2: string): ContrastResult {
    const colorInfo1 = this.parseColor(color1);
    const colorInfo2 = this.parseColor(color2);

    if (!colorInfo1 || !colorInfo2) {
      return {
        ratio: 0,
        wcagAA: false,
        wcagAAA: false,
        wcagAALarge: false,
        wcagAAALarge: false,
        recommendation: 'Invalid colors provided'
      };
    }

    const lum1 = colorInfo1.luminance;
    const lum2 = colorInfo2.luminance;

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    const ratio = (lighter + 0.05) / (darker + 0.05);

    // WCAG requirements
    const wcagAA = ratio >= 4.5;
    const wcagAAA = ratio >= 7.0;
    const wcagAALarge = ratio >= 3.0;
    const wcagAAALarge = ratio >= 4.5;

    let recommendation = '';
    if (!wcagAA) {
      recommendation = `Increase contrast to at least 4.5:1 for WCAG AA compliance. Current: ${ratio.toFixed(2)}:1`;
    } else if (!wcagAAA) {
      recommendation = `Consider increasing contrast to 7:1 for WCAG AAA compliance. Current: ${ratio.toFixed(2)}:1`;
    } else {
      recommendation = `Excellent contrast ratio: ${ratio.toFixed(2)}:1`;
    }

    return {
      ratio,
      wcagAA,
      wcagAAA,
      wcagAALarge,
      wcagAAALarge,
      recommendation
    };
  }

  /**
   * Generate accessible color alternatives
   */
  static generateAccessibleAlternatives(
    foreground: string,
    background: string,
    targetRatio: number = 4.5
  ): string[] {
    const fgColor = this.parseColor(foreground);
    const bgColor = this.parseColor(background);

    if (!fgColor || !bgColor) return [];

    const alternatives: string[] = [];

    // Try adjusting lightness
    for (let adjustment = -50; adjustment <= 50; adjustment += 5) {
      if (adjustment === 0) continue;

      const adjustedL = Math.max(0, Math.min(100, fgColor.hsl.l + adjustment));
      const newColor = this.hslToHex({
        h: fgColor.hsl.h,
        s: fgColor.hsl.s,
        l: adjustedL
      });

      const contrast = this.getContrastRatio(newColor, background);
      if (contrast.ratio >= targetRatio) {
        alternatives.push(newColor);
      }
    }

    // Try adjusting saturation
    for (let saturation = 0; saturation <= 100; saturation += 10) {
      const newColor = this.hslToHex({
        h: fgColor.hsl.h,
        s: saturation,
        l: fgColor.hsl.l
      });

      const contrast = this.getContrastRatio(newColor, background);
      if (contrast.ratio >= targetRatio) {
        alternatives.push(newColor);
      }
    }

    // Remove duplicates and return up to 5 alternatives
    return [...new Set(alternatives)].slice(0, 5);
  }

  /**
   * Convert HSL to hex
   */
  static hslToHex(hsl: { h: number; s: number; l: number }): string {
    const h = hsl.h / 360;
    const s = hsl.s / 100;
    const l = hsl.l / 100;

    const hueToRgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    let r, g, b;

    if (s === 0) {
      r = g = b = l; // Achromatic
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hueToRgb(p, q, h + 1/3);
      g = hueToRgb(p, q, h);
      b = hueToRgb(p, q, h - 1/3);
    }

    const toHex = (c: number): string => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Test color blindness accessibility
   */
  static testColorBlindness(color1: string, color2: string): {
    deuteranopia: ContrastResult;
    protanopia: ContrastResult;
    tritanopia: ContrastResult;
    issues: string[];
  } {
    const issues: string[] = [];

    // Simulate color blindness (simplified simulation)
    const simulateColorBlindness = (color: string, type: 'deuteranopia' | 'protanopia' | 'tritanopia'): string => {
      const colorInfo = this.parseColor(color);
      if (!colorInfo) return color;

      const { r, g, b } = colorInfo.rgb;

      switch (type) {
        case 'deuteranopia': // Green blind
          return `rgb(${Math.round(r * 0.625 + g * 0.375)}, ${Math.round(g * 0.7)}, ${b})`;
        case 'protanopia': // Red blind
          return `rgb(${Math.round(r * 0.567)}, ${Math.round(r * 0.433 + g)}, ${b})`;
        case 'tritanopia': // Blue blind
          return `rgb(${r}, ${Math.round(g * 0.95 + b * 0.05)}, ${Math.round(g * 0.433 + b * 0.567)})`;
        default:
          return color;
      }
    };

    const deuteranopia = this.getContrastRatio(
      simulateColorBlindness(color1, 'deuteranopia'),
      simulateColorBlindness(color2, 'deuteranopia')
    );

    const protanopia = this.getContrastRatio(
      simulateColorBlindness(color1, 'protanopia'),
      simulateColorBlindness(color2, 'protanopia')
    );

    const tritanopia = this.getContrastRatio(
      simulateColorBlindness(color1, 'tritanopia'),
      simulateColorBlindness(color2, 'tritanopia')
    );

    if (!deuteranopia.wcagAA) {
      issues.push('Color combination may not be accessible for users with deuteranopia (green blindness)');
    }

    if (!protanopia.wcagAA) {
      issues.push('Color combination may not be accessible for users with protanopia (red blindness)');
    }

    if (!tritanopia.wcagAA) {
      issues.push('Color combination may not be accessible for users with tritanopia (blue blindness)');
    }

    return {
      deuteranopia,
      protanopia,
      tritanopia,
      issues
    };
  }

  /**
   * Comprehensive accessibility audit
   */
  static auditAccessibility(element: HTMLElement): AccessibilityReport {
    const issues: AccessibilityIssue[] = [];
    const suggestions: string[] = [];

    const computedStyle = window.getComputedStyle(element);
    const textColor = computedStyle.color;
    const backgroundColor = computedStyle.backgroundColor;
    const borderColor = computedStyle.borderColor;

    let totalScore = 0;
    let maxScore = 0;

    // Test text contrast
    if (textColor && backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)') {
      const contrast = this.getContrastRatio(textColor, backgroundColor);
      maxScore += 25;

      if (contrast.wcagAAA) {
        totalScore += 25;
      } else if (contrast.wcagAA) {
        totalScore += 20;
        suggestions.push('Consider increasing contrast for AAA compliance');
      } else {
        issues.push({
          severity: 'critical',
          type: 'contrast',
          element: element.tagName.toLowerCase(),
          description: 'Text contrast does not meet WCAG AA requirements',
          currentValue: contrast.ratio,
          requiredValue: 4.5,
          suggestion: contrast.recommendation
        });
      }
    }

    // Test focus indicators
    element.focus();
    const focusStyle = window.getComputedStyle(element);
    const hasVisibleFocus = focusStyle.outline !== 'none' ||
                           focusStyle.boxShadow !== 'none' ||
                           focusStyle.backgroundColor !== computedStyle.backgroundColor;

    maxScore += 15;
    if (hasVisibleFocus) {
      totalScore += 15;
    } else {
      issues.push({
        severity: 'major',
        type: 'focus',
        element: element.tagName.toLowerCase(),
        description: 'No visible focus indicator',
        currentValue: 0,
        requiredValue: 1,
        suggestion: 'Add visible focus indicators with adequate contrast'
      });
    }

    // Test color blindness if colors are used
    if (textColor && backgroundColor) {
      const colorBlindTest = this.testColorBlindness(textColor, backgroundColor);
      maxScore += 15;

      if (colorBlindTest.issues.length === 0) {
        totalScore += 15;
      } else if (colorBlindTest.issues.length <= 1) {
        totalScore += 10;
        suggestions.push('Consider testing with color blindness simulators');
      } else {
        issues.push({
          severity: 'major',
          type: 'colorBlindness',
          element: element.tagName.toLowerCase(),
          description: 'Color combination may not be accessible for color blind users',
          currentValue: colorBlindTest.issues.length,
          requiredValue: 0,
          suggestion: 'Use patterns or textures in addition to color'
        });
      }
    }

    // Calculate overall score
    const overallScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 100;

    // Determine WCAG level
    let wcagLevel: 'Fail' | 'AA' | 'AAA' = 'Fail';
    if (issues.filter(i => i.severity === 'critical').length === 0) {
      wcagLevel = issues.filter(i => i.severity === 'major').length === 0 ? 'AAA' : 'AA';
    }

    return {
      compliant: issues.filter(i => i.severity === 'critical').length === 0,
      issues,
      suggestions,
      overallScore,
      wcagLevel
    };
  }

  /**
   * Generate accessibility report for multiple elements
   */
  static generateReport(elements: HTMLElement[]): {
    summary: {
      totalElements: number;
      compliantElements: number;
      compliancePercentage: number;
      criticalIssues: number;
      majorIssues: number;
      minorIssues: number;
    };
    details: Array<{
      element: HTMLElement;
      report: AccessibilityReport;
    }>;
    recommendations: string[];
  } {
    const details = elements.map(element => ({
      element,
      report: this.auditAccessibility(element)
    }));

    const compliantElements = details.filter(d => d.report.compliant).length;
    const criticalIssues = details.reduce((sum, d) => sum + d.report.issues.filter(i => i.severity === 'critical').length, 0);
    const majorIssues = details.reduce((sum, d) => sum + d.report.issues.filter(i => i.severity === 'major').length, 0);
    const minorIssues = details.reduce((sum, d) => sum + d.report.issues.filter(i => i.severity === 'minor').length, 0);

    const recommendations: string[] = [
      'Ensure all interactive elements have visible focus indicators',
      'Maintain contrast ratios of at least 4.5:1 for normal text and 3:1 for large text',
      'Test color combinations with color blindness simulators',
      'Use semantic HTML elements for better accessibility',
      'Provide alternative text for images and icons'
    ];

    if (criticalIssues > 0) {
      recommendations.unshift('Address critical accessibility issues immediately');
    }

    return {
      summary: {
        totalElements: elements.length,
        compliantElements,
        compliancePercentage: Math.round((compliantElements / elements.length) * 100),
        criticalIssues,
        majorIssues,
        minorIssues
      },
      details,
      recommendations
    };
  }
}

/**
 * High contrast mode utilities
 */
export class HighContrastTester {
  /**
   * Test if element is visible in high contrast mode
   */
  static testHighContrastVisibility(element: HTMLElement): {
    isVisible: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    const computedStyle = window.getComputedStyle(element);
    const color = computedStyle.color;
    const backgroundColor = computedStyle.backgroundColor;
    const borderColor = computedStyle.borderColor;

    // Check if colors would be forced in high contrast mode
    const hasVisibleBorder = borderColor && borderColor !== 'rgba(0, 0, 0, 0)' && computedStyle.borderWidth !== '0px';
    const hasVisibleBackground = backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)';

    if (!hasVisibleBorder && !hasVisibleBackground) {
      issues.push('Element may not be visible in high contrast mode');
      suggestions.push('Add visible borders or background colors');
    }

    // Check text visibility
    if (color === backgroundColor) {
      issues.push('Text color matches background color');
      suggestions.push('Ensure text has sufficient contrast from background');
    }

    return {
      isVisible: issues.length === 0,
      issues,
      suggestions
    };
  }

  /**
   * Generate high contrast recommendations
   */
  static generateHighContrastRecommendations(elements: HTMLElement[]): string[] {
    const recommendations = new Set<string>();

    elements.forEach(element => {
      const test = this.testHighContrastVisibility(element);
      test.suggestions.forEach(suggestion => recommendations.add(suggestion));
    });

    // Add general recommendations
    recommendations.add('Use CSS media query (prefers-contrast: high) for high contrast styles');
    recommendations.add('Ensure focus indicators are visible in high contrast mode');
    recommendations.add('Test with Windows High Contrast mode or similar tools');

    return Array.from(recommendations);
  }
}

export default ColorAccessibilityTester;