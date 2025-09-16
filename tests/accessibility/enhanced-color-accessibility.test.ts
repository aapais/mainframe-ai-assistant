/**
 * Enhanced Color Accessibility Tests
 * Comprehensive testing for WCAG compliance and color system enhancement
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { ColorAccessibilityTester, HighContrastTester } from '../../src/renderer/utils/colorAccessibility';

// Mock DOM environment
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        :root {
          --primary-500: #3b9df0;
          --primary-600: #2b7de4;
          --primary-700: #2565d1;
          --text-primary: #111827;
          --text-secondary: #6b7280;
          --surface-primary: #ffffff;
          --surface-secondary: #f9fafb;
          --border-primary: #e5e7eb;
          --border-focus: #3b9df0;
        }

        .btn-primary {
          background-color: var(--primary-500);
          color: white;
          border: 1px solid transparent;
          padding: 8px 16px;
          border-radius: 6px;
        }

        .btn-primary:focus {
          outline: 2px solid var(--border-focus);
          outline-offset: 2px;
        }

        .text-primary {
          color: var(--text-primary);
          background-color: var(--surface-primary);
        }

        .text-secondary {
          color: var(--text-secondary);
          background-color: var(--surface-secondary);
        }

        .high-contrast-test {
          color: #666666;
          background-color: #ffffff;
          border: 1px solid #cccccc;
        }

        .poor-contrast {
          color: #cccccc;
          background-color: #ffffff;
        }

        .no-focus {
          outline: none;
          background: transparent;
          border: none;
        }
      </style>
    </head>
    <body>
      <button class="btn-primary" id="primary-btn">Primary Button</button>
      <p class="text-primary" id="primary-text">Primary text content</p>
      <p class="text-secondary" id="secondary-text">Secondary text content</p>
      <div class="high-contrast-test" id="hc-test">High contrast test</div>
      <span class="poor-contrast" id="poor-contrast">Poor contrast text</span>
      <button class="no-focus" id="no-focus">No focus indicator</button>
    </body>
  </html>
`);

global.window = dom.window as any;
global.document = dom.window.document;
global.getComputedStyle = dom.window.getComputedStyle;

describe('Enhanced Color Accessibility System', () => {
  beforeEach(() => {
    // Reset DOM state
    document.querySelectorAll('*').forEach(el => {
      if (el !== document.documentElement && el !== document.body && el !== document.head) {
        el.removeAttribute('style');
      }
    });
  });

  describe('ColorAccessibilityTester', () => {
    describe('parseColor', () => {
      test('should parse hex colors correctly', () => {
        const color = ColorAccessibilityTester.parseColor('#3b9df0');
        expect(color).toBeTruthy();
        expect(color?.hex).toBe('#3b9df0');
        expect(color?.rgb.r).toBe(59);
        expect(color?.rgb.g).toBe(157);
        expect(color?.rgb.b).toBe(240);
      });

      test('should parse short hex colors', () => {
        const color = ColorAccessibilityTester.parseColor('#abc');
        expect(color).toBeTruthy();
        expect(color?.rgb.r).toBe(170);
        expect(color?.rgb.g).toBe(187);
        expect(color?.rgb.b).toBe(204);
      });

      test('should parse rgb colors', () => {
        const color = ColorAccessibilityTester.parseColor('rgb(59, 157, 240)');
        expect(color).toBeTruthy();
        expect(color?.rgb.r).toBe(59);
        expect(color?.rgb.g).toBe(157);
        expect(color?.rgb.b).toBe(240);
      });

      test('should parse rgba colors', () => {
        const color = ColorAccessibilityTester.parseColor('rgba(59, 157, 240, 0.8)');
        expect(color).toBeTruthy();
        expect(color?.rgb.r).toBe(59);
        expect(color?.rgb.g).toBe(157);
        expect(color?.rgb.b).toBe(240);
      });

      test('should parse named colors', () => {
        const color = ColorAccessibilityTester.parseColor('white');
        expect(color).toBeTruthy();
        expect(color?.rgb.r).toBe(255);
        expect(color?.rgb.g).toBe(255);
        expect(color?.rgb.b).toBe(255);
      });

      test('should return null for invalid colors', () => {
        expect(ColorAccessibilityTester.parseColor('invalid')).toBeNull();
        expect(ColorAccessibilityTester.parseColor('#xyz')).toBeNull();
        expect(ColorAccessibilityTester.parseColor('')).toBeNull();
      });
    });

    describe('getRelativeLuminance', () => {
      test('should calculate luminance for white correctly', () => {
        const luminance = ColorAccessibilityTester.getRelativeLuminance({ r: 255, g: 255, b: 255 });
        expect(luminance).toBeCloseTo(1, 2);
      });

      test('should calculate luminance for black correctly', () => {
        const luminance = ColorAccessibilityTester.getRelativeLuminance({ r: 0, g: 0, b: 0 });
        expect(luminance).toBeCloseTo(0, 2);
      });

      test('should calculate luminance for brand primary', () => {
        const luminance = ColorAccessibilityTester.getRelativeLuminance({ r: 59, g: 157, b: 240 });
        expect(luminance).toBeGreaterThan(0);
        expect(luminance).toBeLessThan(1);
      });
    });

    describe('getContrastRatio', () => {
      test('should calculate correct contrast ratio for white on black', () => {
        const result = ColorAccessibilityTester.getContrastRatio('#ffffff', '#000000');
        expect(result.ratio).toBeCloseTo(21, 0);
        expect(result.wcagAA).toBe(true);
        expect(result.wcagAAA).toBe(true);
      });

      test('should calculate contrast ratio for brand colors', () => {
        const result = ColorAccessibilityTester.getContrastRatio('#ffffff', '#3b9df0');
        expect(result.ratio).toBeGreaterThan(1);
        expect(result.wcagAA).toBeDefined();
        expect(result.wcagAAA).toBeDefined();
      });

      test('should identify poor contrast ratios', () => {
        const result = ColorAccessibilityTester.getContrastRatio('#cccccc', '#ffffff');
        expect(result.ratio).toBeLessThan(4.5);
        expect(result.wcagAA).toBe(false);
        expect(result.recommendation).toContain('Increase contrast');
      });

      test('should handle invalid colors gracefully', () => {
        const result = ColorAccessibilityTester.getContrastRatio('invalid', '#ffffff');
        expect(result.ratio).toBe(0);
        expect(result.wcagAA).toBe(false);
        expect(result.recommendation).toContain('Invalid colors');
      });
    });

    describe('generateAccessibleAlternatives', () => {
      test('should generate accessible alternatives for poor contrast', () => {
        const alternatives = ColorAccessibilityTester.generateAccessibleAlternatives(
          '#cccccc',
          '#ffffff',
          4.5
        );
        expect(alternatives).toHaveLength(expect.any(Number));

        // Test that alternatives meet contrast requirements
        alternatives.forEach(alt => {
          const contrast = ColorAccessibilityTester.getContrastRatio(alt, '#ffffff');
          expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);
        });
      });

      test('should limit alternatives to reasonable number', () => {
        const alternatives = ColorAccessibilityTester.generateAccessibleAlternatives(
          '#888888',
          '#ffffff',
          4.5
        );
        expect(alternatives.length).toBeLessThanOrEqual(5);
      });
    });

    describe('testColorBlindness', () => {
      test('should test color blindness accessibility', () => {
        const result = ColorAccessibilityTester.testColorBlindness('#ff0000', '#00ff00');

        expect(result.deuteranopia).toBeDefined();
        expect(result.protanopia).toBeDefined();
        expect(result.tritanopia).toBeDefined();
        expect(result.issues).toBeInstanceOf(Array);

        // Red-green combination should have issues for deuteranopia/protanopia
        expect(result.issues.length).toBeGreaterThan(0);
      });

      test('should pass for high contrast neutral colors', () => {
        const result = ColorAccessibilityTester.testColorBlindness('#000000', '#ffffff');
        expect(result.issues).toHaveLength(0);
      });
    });

    describe('auditAccessibility', () => {
      test('should audit button element accessibility', () => {
        const button = document.getElementById('primary-btn') as HTMLButtonElement;

        // Mock computed styles
        Object.defineProperty(window, 'getComputedStyle', {
          value: () => ({
            color: '#ffffff',
            backgroundColor: '#3b9df0',
            borderColor: 'transparent',
            outline: '2px solid #3b9df0',
            boxShadow: 'none',
            borderWidth: '1px'
          })
        });

        const report = ColorAccessibilityTester.auditAccessibility(button);

        expect(report.overallScore).toBeGreaterThan(0);
        expect(report.wcagLevel).toBeDefined();
        expect(report.compliant).toBeDefined();
        expect(report.issues).toBeInstanceOf(Array);
        expect(report.suggestions).toBeInstanceOf(Array);
      });

      test('should identify poor contrast issues', () => {
        const element = document.getElementById('poor-contrast') as HTMLElement;

        // Mock poor contrast styles
        Object.defineProperty(window, 'getComputedStyle', {
          value: () => ({
            color: '#cccccc',
            backgroundColor: '#ffffff',
            borderColor: 'transparent',
            outline: 'none',
            boxShadow: 'none',
            borderWidth: '0px'
          })
        });

        const report = ColorAccessibilityTester.auditAccessibility(element);

        expect(report.compliant).toBe(false);
        expect(report.issues.some(issue => issue.type === 'contrast')).toBe(true);
        expect(report.wcagLevel).toBe('Fail');
      });

      test('should identify missing focus indicators', () => {
        const button = document.getElementById('no-focus') as HTMLButtonElement;

        // Mock no focus styles
        Object.defineProperty(window, 'getComputedStyle', {
          value: () => ({
            color: '#000000',
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            outline: 'none',
            boxShadow: 'none',
            borderWidth: '0px'
          })
        });

        const report = ColorAccessibilityTester.auditAccessibility(button);

        expect(report.issues.some(issue => issue.type === 'focus')).toBe(true);
      });
    });

    describe('generateReport', () => {
      test('should generate comprehensive report for multiple elements', () => {
        const elements = [
          document.getElementById('primary-btn'),
          document.getElementById('secondary-text'),
          document.getElementById('poor-contrast')
        ].filter(Boolean) as HTMLElement[];

        // Mock different computed styles for each element
        const mockStyles = [
          { color: '#ffffff', backgroundColor: '#3b9df0', outline: '2px solid #3b9df0' },
          { color: '#6b7280', backgroundColor: '#f9fafb', outline: 'none' },
          { color: '#cccccc', backgroundColor: '#ffffff', outline: 'none' }
        ];

        let styleIndex = 0;
        Object.defineProperty(window, 'getComputedStyle', {
          value: () => {
            const style = mockStyles[styleIndex % mockStyles.length];
            styleIndex++;
            return {
              ...style,
              borderColor: 'transparent',
              boxShadow: 'none',
              borderWidth: '1px'
            };
          }
        });

        const report = ColorAccessibilityTester.generateReport(elements);

        expect(report.summary.totalElements).toBe(elements.length);
        expect(report.summary.compliancePercentage).toBeGreaterThanOrEqual(0);
        expect(report.summary.compliancePercentage).toBeLessThanOrEqual(100);
        expect(report.details).toHaveLength(elements.length);
        expect(report.recommendations).toBeInstanceOf(Array);
        expect(report.recommendations.length).toBeGreaterThan(0);
      });
    });
  });

  describe('HighContrastTester', () => {
    describe('testHighContrastVisibility', () => {
      test('should identify visible elements in high contrast mode', () => {
        const element = document.getElementById('hc-test') as HTMLElement;

        // Mock high contrast styles
        Object.defineProperty(window, 'getComputedStyle', {
          value: () => ({
            color: '#666666',
            backgroundColor: '#ffffff',
            borderColor: '#cccccc',
            borderWidth: '1px'
          })
        });

        const result = HighContrastTester.testHighContrastVisibility(element);
        expect(result.isVisible).toBe(true);
        expect(result.issues).toHaveLength(0);
      });

      test('should identify invisible elements in high contrast mode', () => {
        const element = document.getElementById('no-focus') as HTMLElement;

        // Mock invisible styles
        Object.defineProperty(window, 'getComputedStyle', {
          value: () => ({
            color: '#000000',
            backgroundColor: 'rgba(0, 0, 0, 0)',
            borderColor: 'rgba(0, 0, 0, 0)',
            borderWidth: '0px'
          })
        });

        const result = HighContrastTester.testHighContrastVisibility(element);
        expect(result.isVisible).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.suggestions.length).toBeGreaterThan(0);
      });
    });

    describe('generateHighContrastRecommendations', () => {
      test('should generate recommendations for high contrast mode', () => {
        const elements = [
          document.getElementById('primary-btn'),
          document.getElementById('no-focus')
        ].filter(Boolean) as HTMLElement[];

        const recommendations = HighContrastTester.generateHighContrastRecommendations(elements);

        expect(recommendations).toBeInstanceOf(Array);
        expect(recommendations.length).toBeGreaterThan(0);
        expect(recommendations.some(rec => rec.includes('high contrast'))).toBe(true);
      });
    });
  });
});

describe('Color System Integration Tests', () => {
  test('should validate enhanced color palette meets WCAG standards', () => {
    const colorPairs = [
      // Primary brand colors on white
      { fg: '#3b9df0', bg: '#ffffff', name: 'Primary-500 on white' },
      { fg: '#2b7de4', bg: '#ffffff', name: 'Primary-600 on white' },
      { fg: '#2565d1', bg: '#ffffff', name: 'Primary-700 on white' },

      // Text colors on surfaces
      { fg: '#111827', bg: '#ffffff', name: 'Text-primary on surface-primary' },
      { fg: '#6b7280', bg: '#f9fafb', name: 'Text-secondary on surface-secondary' },

      // Status colors
      { fg: '#ffffff', bg: '#16a34a', name: 'White on success-600' },
      { fg: '#ffffff', bg: '#dc2626', name: 'White on error-600' },
      { fg: '#ffffff', bg: '#ea580c', name: 'White on warning-600' }
    ];

    colorPairs.forEach(({ fg, bg, name }) => {
      const result = ColorAccessibilityTester.getContrastRatio(fg, bg);

      // All color pairs should meet at least WCAG AA
      expect(result.wcagAA).toBe(true);

      if (!result.wcagAA) {
        console.warn(`${name} fails WCAG AA: ${result.ratio.toFixed(2)}:1`);
      }
    });
  });

  test('should validate dark theme color contrasts', () => {
    const darkThemeColors = [
      { fg: '#f9fafb', bg: '#111827', name: 'Dark theme text-primary on surface-primary' },
      { fg: '#d1d5db', bg: '#1f2937', name: 'Dark theme text-secondary on surface-secondary' },
      { fg: '#ffffff', bg: '#3b9df0', name: 'White on primary-500 (dark theme)' }
    ];

    darkThemeColors.forEach(({ fg, bg, name }) => {
      const result = ColorAccessibilityTester.getContrastRatio(fg, bg);
      expect(result.wcagAA).toBe(true);
    });
  });

  test('should validate mainframe theme accessibility', () => {
    const mainframeColors = [
      { fg: '#00ff41', bg: '#000000', name: 'Mainframe green on black' },
      { fg: '#ffcc00', bg: '#000000', name: 'Mainframe amber on black' },
      { fg: '#00ccff', bg: '#000000', name: 'Mainframe blue on black' }
    ];

    mainframeColors.forEach(({ fg, bg, name }) => {
      const result = ColorAccessibilityTester.getContrastRatio(fg, bg);

      // Mainframe colors should have excellent contrast
      expect(result.ratio).toBeGreaterThan(7);
      expect(result.wcagAAA).toBe(true);
    });
  });

  test('should validate high contrast theme meets enhanced requirements', () => {
    const highContrastPairs = [
      { fg: '#000000', bg: '#ffffff', name: 'High contrast light' },
      { fg: '#ffffff', bg: '#000000', name: 'High contrast dark' },
      { fg: '#0066cc', bg: '#ffffff', name: 'High contrast primary' }
    ];

    highContrastPairs.forEach(({ fg, bg, name }) => {
      const result = ColorAccessibilityTester.getContrastRatio(fg, bg);

      // High contrast theme should meet AAA standards
      expect(result.wcagAAA).toBe(true);
      expect(result.ratio).toBeGreaterThan(7);
    });
  });
});

describe('Performance and Edge Cases', () => {
  test('should handle large numbers of elements efficiently', () => {
    const elements: HTMLElement[] = [];

    // Create 100 test elements
    for (let i = 0; i < 100; i++) {
      const div = document.createElement('div');
      div.textContent = `Test element ${i}`;
      document.body.appendChild(div);
      elements.push(div);
    }

    const startTime = Date.now();
    const report = ColorAccessibilityTester.generateReport(elements);
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    expect(report.summary.totalElements).toBe(100);

    // Cleanup
    elements.forEach(el => el.remove());
  });

  test('should handle malformed color values gracefully', () => {
    const malformedColors = [
      '',
      'undefined',
      'null',
      '#',
      'rgb(',
      'rgba()',
      '#gggggg',
      'rgb(300, 400, 500)'
    ];

    malformedColors.forEach(color => {
      expect(() => {
        ColorAccessibilityTester.parseColor(color);
      }).not.toThrow();
    });
  });

  test('should maintain consistent performance with complex calculations', () => {
    const iterations = 1000;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      ColorAccessibilityTester.getContrastRatio('#3b9df0', '#ffffff');
      ColorAccessibilityTester.testColorBlindness('#ff0000', '#00ff00');
    }

    const endTime = Date.now();
    expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
  });
});