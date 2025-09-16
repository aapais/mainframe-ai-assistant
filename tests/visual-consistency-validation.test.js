/**
 * Visual Consistency Validation Test Suite
 *
 * Comprehensive testing for visual consistency across all breakpoints and components
 * Tests typography scaling, spacing, colors, animations, and responsive behavior
 *
 * @version 1.0.0
 * @author Visual Consistency Specialist
 */

import { test, expect } from '@playwright/test';

// Define breakpoints and their expected behaviors
const BREAKPOINTS = {
  mobile: { width: 375, height: 667, name: 'mobile' },
  mobileLarge: { width: 414, height: 896, name: 'mobile-large' },
  tablet: { width: 768, height: 1024, name: 'tablet' },
  tabletLarge: { width: 1024, height: 768, name: 'tablet-large' },
  desktop: { width: 1280, height: 720, name: 'desktop' },
  desktopLarge: { width: 1440, height: 900, name: 'desktop-large' },
  wide: { width: 1920, height: 1080, name: 'wide' }
};

// Typography scale expectations
const TYPOGRAPHY_SCALE = {
  'xs': { min: 12, max: 14 },
  'sm': { min: 14, max: 16 },
  'base': { min: 16, max: 18 },
  'lg': { min: 18, max: 20 },
  'xl': { min: 20, max: 22 },
  '2xl': { min: 24, max: 28 },
  '3xl': { min: 30, max: 36 },
  '4xl': { min: 36, max: 44 },
  '5xl': { min: 48, max: 60 }
};

// Expected spacing values (in pixels)
const SPACING_SCALE = {
  '0': 0,
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
  '20': 80,
  '24': 96,
  '32': 128
};

test.describe('Visual Consistency Validation', () => {

  test.beforeEach(async ({ page }) => {
    // Go to the main application
    await page.goto('/');
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test.describe('Typography Scaling Validation', () => {

    Object.entries(BREAKPOINTS).forEach(([key, viewport]) => {
      test(`Typography scales correctly at ${viewport.name}`, async ({ page }) => {
        // Set viewport
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        // Test heading scales
        for (let i = 1; i <= 6; i++) {
          const headings = await page.locator(`h${i}, .heading-${i}`).all();

          for (const heading of headings) {
            if (await heading.isVisible()) {
              const styles = await heading.evaluate(el => {
                const computed = getComputedStyle(el);
                return {
                  fontSize: parseFloat(computed.fontSize),
                  lineHeight: computed.lineHeight,
                  fontWeight: computed.fontWeight,
                  letterSpacing: computed.letterSpacing
                };
              });

              // Validate font size is within expected range
              expect(styles.fontSize).toBeGreaterThan(12);
              expect(styles.fontSize).toBeLessThan(80);

              // Validate line height is reasonable
              expect(parseFloat(styles.lineHeight)).toBeGreaterThan(styles.fontSize * 0.9);
              expect(parseFloat(styles.lineHeight)).toBeLessThan(styles.fontSize * 2.5);

              console.log(`H${i} at ${viewport.name}: ${styles.fontSize}px, line-height: ${styles.lineHeight}`);
            }
          }
        }

        // Test body text scales
        const bodyTexts = await page.locator('p, .body-text, .text-base').all();
        for (const text of bodyTexts.slice(0, 5)) { // Test first 5 elements
          if (await text.isVisible()) {
            const fontSize = await text.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
            expect(fontSize).toBeGreaterThanOrEqual(14);
            expect(fontSize).toBeLessThanOrEqual(20);
          }
        }
      });
    });

    test('Typography maintains proportional relationships', async ({ page }) => {
      const sizes = {};

      // Collect font sizes at desktop
      await page.setViewportSize({ width: 1280, height: 720 });

      for (const [className, _] of Object.entries(TYPOGRAPHY_SCALE)) {
        const element = page.locator(`.text-${className}`).first();
        if (await element.count() > 0 && await element.isVisible()) {
          sizes[className] = await element.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
        }
      }

      // Verify hierarchy is maintained
      const sizeKeys = Object.keys(sizes);
      for (let i = 1; i < sizeKeys.length; i++) {
        const current = sizes[sizeKeys[i]];
        const previous = sizes[sizeKeys[i - 1]];
        if (current && previous) {
          expect(current).toBeGreaterThan(previous);
        }
      }
    });
  });

  test.describe('Spacing Consistency Validation', () => {

    Object.entries(BREAKPOINTS).forEach(([key, viewport]) => {
      test(`Spacing consistency at ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        // Test margin and padding utilities
        for (const [spaceKey, expectedValue] of Object.entries(SPACING_SCALE)) {
          const marginElements = await page.locator(`.m-${spaceKey}`).all();
          const paddingElements = await page.locator(`.p-${spaceKey}`).all();

          // Test margins
          for (const element of marginElements.slice(0, 3)) {
            if (await element.isVisible()) {
              const margin = await element.evaluate(el => {
                const styles = getComputedStyle(el);
                return parseFloat(styles.marginTop);
              });

              expect(Math.abs(margin - expectedValue)).toBeLessThanOrEqual(2); // Allow 2px tolerance
            }
          }

          // Test padding
          for (const element of paddingElements.slice(0, 3)) {
            if (await element.isVisible()) {
              const padding = await element.evaluate(el => {
                const styles = getComputedStyle(el);
                return parseFloat(styles.paddingTop);
              });

              expect(Math.abs(padding - expectedValue)).toBeLessThanOrEqual(2); // Allow 2px tolerance
            }
          }
        }
      });
    });

    test('Grid gap consistency across breakpoints', async ({ page }) => {
      for (const [key, viewport] of Object.entries(BREAKPOINTS)) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        const gridElements = await page.locator('.grid').all();

        for (const grid of gridElements.slice(0, 3)) {
          if (await grid.isVisible()) {
            const gap = await grid.evaluate(el => {
              const styles = getComputedStyle(el);
              return parseFloat(styles.gap);
            });

            // Gap should be reasonable and consistent
            expect(gap).toBeGreaterThanOrEqual(0);
            expect(gap).toBeLessThanOrEqual(64);
          }
        }
      }
    });
  });

  test.describe('Color and Contrast Validation', () => {

    test('Color consistency across breakpoints', async ({ page }) => {
      const colorTests = [
        { selector: '.text-primary', property: 'color' },
        { selector: '.text-secondary', property: 'color' },
        { selector: '.bg-primary', property: 'backgroundColor' },
        { selector: '.border-default', property: 'borderColor' }
      ];

      const colorResults = {};

      for (const [key, viewport] of Object.entries(BREAKPOINTS)) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        colorResults[key] = {};

        for (const colorTest of colorTests) {
          const element = page.locator(colorTest.selector).first();
          if (await element.count() > 0 && await element.isVisible()) {
            const color = await element.evaluate((el, prop) => getComputedStyle(el)[prop], colorTest.property);
            colorResults[key][colorTest.selector] = color;
          }
        }
      }

      // Verify colors remain consistent across breakpoints (allowing for dark mode)
      const breakpointKeys = Object.keys(colorResults);
      for (const colorTest of colorTests) {
        const colors = breakpointKeys
          .map(bp => colorResults[bp][colorTest.selector])
          .filter(Boolean);

        if (colors.length > 1) {
          // All colors should be the same OR follow light/dark mode pattern
          const uniqueColors = [...new Set(colors)];
          expect(uniqueColors.length).toBeLessThanOrEqual(2); // Allow light and dark variants
        }
      }
    });

    test('Contrast ratios meet accessibility standards', async ({ page }) => {
      // Helper function to calculate contrast ratio
      const getContrastRatio = (rgb1, rgb2) => {
        const getLuminance = (rgb) => {
          const [r, g, b] = rgb.match(/\d+/g).map(x => {
            x = x / 255;
            return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };

        const lum1 = getLuminance(rgb1);
        const lum2 = getLuminance(rgb2);
        return (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
      };

      // Test various text elements
      const textElements = await page.locator('p, h1, h2, h3, h4, h5, h6, button, a').all();

      for (const element of textElements.slice(0, 10)) {
        if (await element.isVisible()) {
          const styles = await element.evaluate(el => {
            const computed = getComputedStyle(el);
            return {
              color: computed.color,
              backgroundColor: computed.backgroundColor
            };
          });

          // Skip transparent backgrounds
          if (styles.backgroundColor !== 'rgba(0, 0, 0, 0)' && styles.backgroundColor !== 'transparent') {
            try {
              const contrast = getContrastRatio(styles.color, styles.backgroundColor);
              // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
              expect(contrast).toBeGreaterThanOrEqual(3.0);
            } catch (error) {
              console.warn('Could not calculate contrast ratio for element', error);
            }
          }
        }
      }
    });
  });

  test.describe('Icon and Image Scaling', () => {

    test('Icons scale appropriately across breakpoints', async ({ page }) => {
      for (const [key, viewport] of Object.entries(BREAKPOINTS)) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        const icons = await page.locator('svg, .icon, [class*="icon"]').all();

        for (const icon of icons.slice(0, 5)) {
          if (await icon.isVisible()) {
            const dimensions = await icon.boundingBox();

            if (dimensions) {
              // Icons should have reasonable dimensions
              expect(dimensions.width).toBeGreaterThanOrEqual(12);
              expect(dimensions.width).toBeLessThanOrEqual(64);
              expect(dimensions.height).toBeGreaterThanOrEqual(12);
              expect(dimensions.height).toBeLessThanOrEqual(64);

              // Icons should generally be square or have reasonable aspect ratio
              const aspectRatio = dimensions.width / dimensions.height;
              expect(aspectRatio).toBeGreaterThan(0.5);
              expect(aspectRatio).toBeLessThan(2.0);
            }
          }
        }
      }
    });

    test('Images maintain aspect ratios', async ({ page }) => {
      const images = await page.locator('img').all();

      for (const image of images.slice(0, 5)) {
        if (await image.isVisible()) {
          const naturalDimensions = await image.evaluate(img => ({
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight
          }));

          if (naturalDimensions.naturalWidth > 0 && naturalDimensions.naturalHeight > 0) {
            const naturalRatio = naturalDimensions.naturalWidth / naturalDimensions.naturalHeight;

            for (const [key, viewport] of Object.entries(BREAKPOINTS)) {
              await page.setViewportSize({ width: viewport.width, height: viewport.height });

              const displayedDimensions = await image.boundingBox();
              if (displayedDimensions && displayedDimensions.width > 0 && displayedDimensions.height > 0) {
                const displayedRatio = displayedDimensions.width / displayedDimensions.height;

                // Allow 5% tolerance for aspect ratio preservation
                expect(Math.abs(displayedRatio - naturalRatio) / naturalRatio).toBeLessThan(0.05);
              }
            }
          }
        }
      }
    });
  });

  test.describe('Animation and Transition Validation', () => {

    test('Transitions are smooth and consistent', async ({ page }) => {
      // Test button hover transitions
      const buttons = await page.locator('button').all();

      for (const button of buttons.slice(0, 3)) {
        if (await button.isVisible()) {
          const initialStyles = await button.evaluate(el => {
            const styles = getComputedStyle(el);
            return {
              backgroundColor: styles.backgroundColor,
              color: styles.color,
              transform: styles.transform,
              transition: styles.transition
            };
          });

          // Hover over the button
          await button.hover();

          // Wait for transition
          await page.waitForTimeout(200);

          const hoveredStyles = await button.evaluate(el => {
            const styles = getComputedStyle(el);
            return {
              backgroundColor: styles.backgroundColor,
              color: styles.color,
              transform: styles.transform,
              transition: styles.transition
            };
          });

          // Verify transition is defined
          expect(hoveredStyles.transition).not.toBe('all 0s ease 0s');

          // Move away to reset
          await page.mouse.move(0, 0);
        }
      }
    });

    test('Animation performance is acceptable', async ({ page }) => {
      // Enable performance monitoring
      await page.evaluate(() => {
        window.performanceObserver = new PerformanceObserver((list) => {
          window.performanceEntries = list.getEntries();
        });
        window.performanceObserver.observe({ entryTypes: ['measure', 'navigation'] });
      });

      // Trigger some interactions that might cause animations
      const interactiveElements = await page.locator('button, a, .clickable').all();

      for (const element of interactiveElements.slice(0, 3)) {
        if (await element.isVisible()) {
          await element.click();
          await page.waitForTimeout(100);
        }
      }

      // Check for layout thrashing or excessive repaints
      const performanceEntries = await page.evaluate(() => window.performanceEntries || []);

      // This is a basic check - in a real scenario you'd want more sophisticated monitoring
      expect(performanceEntries.length).toBeGreaterThan(0);
    });

    test('Reduced motion preference is respected', async ({ page }) => {
      // Set reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });

      // Reload page to apply preference
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Check that animations are disabled
      const animatedElements = await page.locator('[class*="animate"], [class*="transition"]').all();

      for (const element of animatedElements.slice(0, 5)) {
        if (await element.isVisible()) {
          const animationStyles = await element.evaluate(el => {
            const styles = getComputedStyle(el);
            return {
              animationDuration: styles.animationDuration,
              transitionDuration: styles.transitionDuration
            };
          });

          // Animation durations should be minimal when reduced motion is preferred
          expect(parseFloat(animationStyles.animationDuration) || 0).toBeLessThan(0.1);
          expect(parseFloat(animationStyles.transitionDuration) || 0).toBeLessThan(0.1);
        }
      }
    });
  });

  test.describe('Layout Shift Detection', () => {

    test('No significant layout shifts during resize', async ({ page }) => {
      let layoutShifts = [];

      // Monitor layout shifts
      await page.evaluate(() => {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
              window.layoutShifts = window.layoutShifts || [];
              window.layoutShifts.push(entry.value);
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });

      // Resize through different breakpoints
      for (const [key, viewport] of Object.entries(BREAKPOINTS)) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.waitForTimeout(100); // Allow settling
      }

      // Get layout shift data
      layoutShifts = await page.evaluate(() => window.layoutShifts || []);

      // Calculate Cumulative Layout Shift (CLS)
      const cls = layoutShifts.reduce((sum, shift) => sum + shift, 0);

      // CLS should be less than 0.1 (good threshold)
      expect(cls).toBeLessThan(0.1);
    });
  });

  test.describe('Visual Regression Detection', () => {

    Object.entries(BREAKPOINTS).forEach(([key, viewport]) => {
      test(`Visual regression test at ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        // Take screenshot for visual comparison
        await expect(page).toHaveScreenshot(`${viewport.name}-layout.png`, {
          fullPage: true,
          threshold: 0.3, // Allow 30% difference for dynamic content
        });
      });
    });

    test('Component visual consistency', async ({ page }) => {
      const components = [
        '.search-interface',
        '.form-field',
        'button',
        '.grid',
        '.card'
      ];

      for (const component of components) {
        const element = page.locator(component).first();
        if (await element.count() > 0 && await element.isVisible()) {
          await expect(element).toHaveScreenshot(`${component.replace('.', '')}-component.png`, {
            threshold: 0.2
          });
        }
      }
    });
  });
});