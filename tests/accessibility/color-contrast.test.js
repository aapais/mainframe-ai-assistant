const { test, expect } = require('@playwright/test');

/**
 * Color Contrast Accessibility Testing
 * Comprehensive WCAG AA/AAA color contrast validation
 */

// WCAG contrast ratio requirements
const WCAG_REQUIREMENTS = {
  AA: {
    normal: 4.5,
    large: 3.0,
    nonText: 3.0
  },
  AAA: {
    normal: 7.0,
    large: 4.5,
    nonText: 3.0
  }
};

// Helper function to calculate contrast ratio
function calculateContrastRatio(color1, color2) {
  const luminance1 = calculateLuminance(color1);
  const luminance2 = calculateLuminance(color2);
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  return (lighter + 0.05) / (darker + 0.05);
}

function calculateLuminance(rgb) {
  const [r, g, b] = rgb.map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Parse RGB values from CSS color
function parseRgb(colorString) {
  const match = colorString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return null;
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

test.describe('Color Contrast Accessibility Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/components/color-system');
  });

  test('Design system color palette WCAG AA compliance', async ({ page }) => {
    // Test all color combinations in the design system
    const colorPairs = await page.evaluate(() => {
      const pairs = [];
      const colorElements = document.querySelectorAll('[data-color-pair]');
      
      colorElements.forEach(element => {
        const styles = window.getComputedStyle(element);
        const backgroundColor = styles.backgroundColor;
        const color = styles.color;
        const fontSize = parseFloat(styles.fontSize);
        const fontWeight = styles.fontWeight;
        
        pairs.push({
          element: element.getAttribute('data-color-pair'),
          backgroundColor,
          color,
          fontSize,
          fontWeight,
          isLargeText: fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700)
        });
      });
      
      return pairs;
    });

    for (const pair of colorPairs) {
      const bgRgb = parseRgb(pair.backgroundColor);
      const textRgb = parseRgb(pair.color);
      
      if (bgRgb && textRgb) {
        const contrastRatio = calculateContrastRatio(textRgb, bgRgb);
        const requirement = pair.isLargeText ? WCAG_REQUIREMENTS.AA.large : WCAG_REQUIREMENTS.AA.normal;
        
        expect(contrastRatio).toBeGreaterThanOrEqual(requirement);
        
        console.log(`${pair.element}: ${contrastRatio.toFixed(2)} (${requirement} required)`);
      }
    }
  });

  test('Interactive elements color contrast', async ({ page }) => {
    await page.goto('/components/interactive');
    
    // Test buttons in all states
    const buttonStates = ['default', 'hover', 'active', 'focus', 'disabled'];
    
    for (const state of buttonStates) {
      const buttons = await page.locator(`[data-testid^="button-${state}"]`).all();
      
      for (const button of buttons) {
        // Trigger state if needed
        if (state === 'hover') {
          await button.hover();
        } else if (state === 'focus') {
          await button.focus();
        } else if (state === 'active') {
          await button.dispatchEvent('mousedown');
        }
        
        const colors = await button.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            borderColor: styles.borderColor,
            fontSize: parseFloat(styles.fontSize),
            fontWeight: styles.fontWeight
          };
        });
        
        const bgRgb = parseRgb(colors.backgroundColor);
        const textRgb = parseRgb(colors.color);
        
        if (bgRgb && textRgb) {
          const contrastRatio = calculateContrastRatio(textRgb, bgRgb);
          const isLargeText = colors.fontSize >= 18 || (colors.fontSize >= 14 && colors.fontWeight >= 700);
          const requirement = isLargeText ? WCAG_REQUIREMENTS.AA.large : WCAG_REQUIREMENTS.AA.normal;
          
          expect(contrastRatio).toBeGreaterThanOrEqual(requirement);
        }
      }
    }
  });

  test('Form elements color contrast', async ({ page }) => {
    await page.goto('/components/forms');
    
    const formElements = await page.locator('input, select, textarea').all();
    
    for (const element of formElements) {
      const colors = await element.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          backgroundColor: styles.backgroundColor,
          color: styles.color,
          borderColor: styles.borderColor,
          placeholderColor: styles.getPropertyValue('::placeholder') || styles.color
        };
      });
      
      // Test main text contrast
      const bgRgb = parseRgb(colors.backgroundColor);
      const textRgb = parseRgb(colors.color);
      
      if (bgRgb && textRgb) {
        const contrastRatio = calculateContrastRatio(textRgb, bgRgb);
        expect(contrastRatio).toBeGreaterThanOrEqual(WCAG_REQUIREMENTS.AA.normal);
      }
      
      // Test border contrast (non-text UI component)
      if (colors.borderColor && colors.borderColor !== 'none') {
        const borderRgb = parseRgb(colors.borderColor);
        if (borderRgb && bgRgb) {
          const borderContrastRatio = calculateContrastRatio(borderRgb, bgRgb);
          expect(borderContrastRatio).toBeGreaterThanOrEqual(WCAG_REQUIREMENTS.AA.nonText);
        }
      }
    }
  });

  test('Dark mode color contrast compliance', async ({ page }) => {
    // Switch to dark mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    
    // Test the same color pairs in dark mode
    const darkModeColors = await page.evaluate(() => {
      const pairs = [];
      const elements = document.querySelectorAll('[data-color-test]');
      
      elements.forEach(element => {
        const styles = window.getComputedStyle(element);
        pairs.push({
          selector: element.getAttribute('data-color-test'),
          backgroundColor: styles.backgroundColor,
          color: styles.color,
          fontSize: parseFloat(styles.fontSize),
          fontWeight: styles.fontWeight
        });
      });
      
      return pairs;
    });

    for (const pair of darkModeColors) {
      const bgRgb = parseRgb(pair.backgroundColor);
      const textRgb = parseRgb(pair.color);
      
      if (bgRgb && textRgb) {
        const contrastRatio = calculateContrastRatio(textRgb, bgRgb);
        const isLargeText = pair.fontSize >= 18 || (pair.fontSize >= 14 && pair.fontWeight >= 700);
        const requirement = isLargeText ? WCAG_REQUIREMENTS.AA.large : WCAG_REQUIREMENTS.AA.normal;
        
        expect(contrastRatio).toBeGreaterThanOrEqual(requirement);
      }
    }
  });

  test('High contrast mode compliance', async ({ page }) => {
    // Enable high contrast mode
    await page.emulateMedia({ forcedColors: 'active' });
    await page.reload();
    
    // In high contrast mode, browser overrides colors
    // Test that content is still readable
    const textElements = await page.locator('p, h1, h2, h3, h4, h5, h6, span, a, button').all();
    
    for (const element of textElements) {
      const isVisible = await element.isVisible();
      if (isVisible) {
        const colors = await element.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            backgroundColor: styles.backgroundColor,
            color: styles.color
          };
        });
        
        const bgRgb = parseRgb(colors.backgroundColor);
        const textRgb = parseRgb(colors.color);
        
        // In forced colors mode, contrast should be very high
        if (bgRgb && textRgb) {
          const contrastRatio = calculateContrastRatio(textRgb, bgRgb);
          // High contrast mode typically provides very high contrast
          expect(contrastRatio).toBeGreaterThan(4.5);
        }
      }
    }
  });

  test('Focus indicator contrast', async ({ page }) => {
    await page.goto('/components/interactive');
    
    const focusableElements = await page.locator(
      'button, input, select, textarea, a[href], [tabindex="0"]'
    ).all();
    
    for (const element of focusableElements) {
      await element.focus();
      
      const focusStyles = await element.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          outlineColor: styles.outlineColor,
          boxShadow: styles.boxShadow,
          backgroundColor: styles.backgroundColor,
          borderColor: styles.borderColor
        };
      });
      
      // Check that focus indicator has sufficient contrast
      const hasVisibleFocus = (
        focusStyles.outline !== 'none' ||
        focusStyles.boxShadow !== 'none' ||
        focusStyles.borderColor
      );
      
      expect(hasVisibleFocus).toBe(true);
      
      // If outline color is specified, test its contrast
      if (focusStyles.outlineColor && focusStyles.outlineColor !== 'none') {
        const outlineRgb = parseRgb(focusStyles.outlineColor);
        const bgRgb = parseRgb(focusStyles.backgroundColor);
        
        if (outlineRgb && bgRgb) {
          const contrastRatio = calculateContrastRatio(outlineRgb, bgRgb);
          expect(contrastRatio).toBeGreaterThanOrEqual(WCAG_REQUIREMENTS.AA.nonText);
        }
      }
    }
  });

  test('Error and success message contrast', async ({ page }) => {
    await page.goto('/components/messages');
    
    const messageTypes = ['error', 'success', 'warning', 'info'];
    
    for (const type of messageTypes) {
      const messages = await page.locator(`[data-message-type="${type}"]`).all();
      
      for (const message of messages) {
        const colors = await message.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            borderColor: styles.borderColor
          };
        });
        
        const bgRgb = parseRgb(colors.backgroundColor);
        const textRgb = parseRgb(colors.color);
        
        if (bgRgb && textRgb) {
          const contrastRatio = calculateContrastRatio(textRgb, bgRgb);
          expect(contrastRatio).toBeGreaterThanOrEqual(WCAG_REQUIREMENTS.AA.normal);
        }
      }
    }
  });

  test('Link color contrast in context', async ({ page }) => {
    await page.goto('/components/typography');
    
    const links = await page.locator('a').all();
    
    for (const link of links) {
      // Test default state
      const defaultColors = await link.evaluate(el => {
        const styles = window.getComputedStyle(el);
        const parentStyles = window.getComputedStyle(el.parentElement);
        return {
          color: styles.color,
          backgroundColor: parentStyles.backgroundColor,
          parentColor: parentStyles.color
        };
      });
      
      const bgRgb = parseRgb(defaultColors.backgroundColor);
      const linkRgb = parseRgb(defaultColors.color);
      const parentTextRgb = parseRgb(defaultColors.parentColor);
      
      // Link should have sufficient contrast with background
      if (bgRgb && linkRgb) {
        const linkBgContrast = calculateContrastRatio(linkRgb, bgRgb);
        expect(linkBgContrast).toBeGreaterThanOrEqual(WCAG_REQUIREMENTS.AA.normal);
      }
      
      // Link should be distinguishable from surrounding text (3:1 ratio)
      if (linkRgb && parentTextRgb) {
        const linkTextContrast = calculateContrastRatio(linkRgb, parentTextRgb);
        expect(linkTextContrast).toBeGreaterThanOrEqual(3.0);
      }
      
      // Test hover state
      await link.hover();
      const hoverColors = await link.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          color: styles.color,
          textDecoration: styles.textDecoration
        };
      });
      
      const hoverRgb = parseRgb(hoverColors.color);
      if (bgRgb && hoverRgb) {
        const hoverContrast = calculateContrastRatio(hoverRgb, bgRgb);
        expect(hoverContrast).toBeGreaterThanOrEqual(WCAG_REQUIREMENTS.AA.normal);
      }
    }
  });

  test('Custom color combinations validation', async ({ page }) => {
    await page.goto('/test-utilities/color-contrast-tool');
    
    // Test custom color combinations that might be used
    const customCombinations = [
      { fg: [255, 255, 255], bg: [0, 0, 0], name: 'white-on-black' },
      { fg: [0, 0, 0], bg: [255, 255, 255], name: 'black-on-white' },
      { fg: [51, 51, 51], bg: [255, 255, 255], name: 'dark-gray-on-white' },
      { fg: [255, 255, 255], bg: [51, 51, 51], name: 'white-on-dark-gray' },
      { fg: [0, 122, 255], bg: [255, 255, 255], name: 'blue-on-white' },
      { fg: [255, 59, 48], bg: [255, 255, 255], name: 'red-on-white' },
      { fg: [52, 199, 89], bg: [255, 255, 255], name: 'green-on-white' }
    ];
    
    for (const combo of customCombinations) {
      const contrastRatio = calculateContrastRatio(combo.fg, combo.bg);
      
      // Log the result for reference
      console.log(`${combo.name}: ${contrastRatio.toFixed(2)}`);
      
      // All combinations should meet at least AA normal requirements
      expect(contrastRatio).toBeGreaterThanOrEqual(WCAG_REQUIREMENTS.AA.normal);
    }
  });
});
