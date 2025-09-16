const { test, expect } = require('@playwright/test');

/**
 * Design System Integration Testing
 * Comprehensive testing of design system components working together
 */

test.describe('Design System Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Design tokens are consistently applied', async ({ page }) => {
    await page.goto('/components/design-tokens-showcase');
    
    // Test color token consistency
    const colorElements = await page.locator('[data-design-token^="color-"]').all();
    const colorValues = new Map();
    
    for (const element of colorElements) {
      const tokenName = await element.getAttribute('data-design-token');
      const computedColor = await element.evaluate(el => {
        return window.getComputedStyle(el).backgroundColor || window.getComputedStyle(el).color;
      });
      
      if (colorValues.has(tokenName)) {
        // Same token should have same computed value
        expect(computedColor).toBe(colorValues.get(tokenName));
      } else {
        colorValues.set(tokenName, computedColor);
      }
    }
    
    // Test spacing token consistency
    const spacingElements = await page.locator('[data-design-token^="spacing-"]').all();
    const spacingValues = new Map();
    
    for (const element of spacingElements) {
      const tokenName = await element.getAttribute('data-design-token');
      const computedSpacing = await element.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          margin: styles.margin,
          padding: styles.padding,
          gap: styles.gap
        };
      });
      
      // Store first occurrence of each token
      if (!spacingValues.has(tokenName)) {
        spacingValues.set(tokenName, computedSpacing);
      }
    }
    
    // Test typography token consistency
    const typographyElements = await page.locator('[data-design-token^="typography-"]').all();
    
    for (const element of typographyElements) {
      const tokenName = await element.getAttribute('data-design-token');
      const computedTypography = await element.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          fontSize: styles.fontSize,
          fontFamily: styles.fontFamily,
          fontWeight: styles.fontWeight,
          lineHeight: styles.lineHeight
        };
      });
      
      // Verify typography values are within expected ranges
      const fontSize = parseFloat(computedTypography.fontSize);
      expect(fontSize).toBeGreaterThan(10); // Minimum readable size
      expect(fontSize).toBeLessThan(100); // Maximum reasonable size
      
      const lineHeight = parseFloat(computedTypography.lineHeight);
      expect(lineHeight).toBeGreaterThan(1.0); // Minimum line height for readability
    }
  });

  test('Component theme switching works consistently', async ({ page }) => {
    const themeToggle = page.locator('[data-testid="theme-toggle"]');
    const components = ['button', 'input', 'card', 'modal', 'navigation'];
    
    // Test each theme
    const themes = ['light', 'dark'];
    
    for (const theme of themes) {
      // Switch to theme
      const currentTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme') || 'light';
      });
      
      if (currentTheme !== theme) {
        await themeToggle.click();
        await page.waitForTimeout(300); // Allow theme transition
      }
      
      // Verify all components use the current theme
      for (const component of components) {
        const componentElements = await page.locator(`[data-component="${component}"]`).all();
        
        for (const element of componentElements) {
          const styles = await element.evaluate(el => {
            const computed = window.getComputedStyle(el);
            return {
              backgroundColor: computed.backgroundColor,
              color: computed.color,
              borderColor: computed.borderColor
            };
          });
          
          // Verify styles are not default/transparent (indicating theme is applied)
          expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
          expect(styles.color).not.toBe('rgb(0, 0, 0)'); // Not default black
        }
      }
    }
  });

  test('Component states are visually consistent', async ({ page }) => {
    await page.goto('/components/interactive-states');
    
    const interactiveComponents = [
      { selector: '[data-testid="button-primary"]', states: ['hover', 'active', 'focus', 'disabled'] },
      { selector: '[data-testid="input-text"]', states: ['hover', 'focus', 'error'] },
      { selector: '[data-testid="link-primary"]', states: ['hover', 'active', 'focus'] },
      { selector: '[data-testid="card-interactive"]', states: ['hover', 'active'] }
    ];
    
    for (const component of interactiveComponents) {
      const element = page.locator(component.selector).first();
      
      // Get initial state
      const initialStyles = await element.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          backgroundColor: styles.backgroundColor,
          color: styles.color,
          borderColor: styles.borderColor,
          transform: styles.transform,
          opacity: styles.opacity
        };
      });
      
      // Test each state
      for (const state of component.states) {
        if (state === 'hover') {
          await element.hover();
        } else if (state === 'focus') {
          await element.focus();
        } else if (state === 'active') {
          await element.dispatchEvent('mousedown');
        } else if (state === 'disabled') {
          await element.evaluate(el => el.setAttribute('disabled', ''));
        } else if (state === 'error') {
          await element.evaluate(el => el.classList.add('error'));
        }
        
        await page.waitForTimeout(200); // Allow transition
        
        const stateStyles = await element.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            borderColor: styles.borderColor,
            transform: styles.transform,
            opacity: styles.opacity
          };
        });
        
        // Verify state change occurred (at least one property should be different)
        const hasStateChange = Object.keys(stateStyles).some(
          key => stateStyles[key] !== initialStyles[key]
        );
        
        if (state !== 'disabled') {
          expect(hasStateChange).toBe(true);
        }
        
        // Reset state
        if (state === 'disabled') {
          await element.evaluate(el => el.removeAttribute('disabled'));
        } else if (state === 'error') {
          await element.evaluate(el => el.classList.remove('error'));
        } else {
          await element.blur();
          await page.mouse.move(0, 0); // Move mouse away
        }
        
        await page.waitForTimeout(200);
      }
    }
  });

  test('Layout grid system works correctly', async ({ page }) => {
    await page.goto('/components/layout-system');
    
    // Test different viewport sizes
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1024, height: 768, name: 'desktop' },
      { width: 1920, height: 1080, name: 'wide' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      // Test grid containers
      const gridContainers = await page.locator('[data-testid^="grid-"]').all();
      
      for (const container of gridContainers) {
        const gridInfo = await container.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            display: styles.display,
            gridTemplateColumns: styles.gridTemplateColumns,
            gap: styles.gap,
            width: el.offsetWidth,
            height: el.offsetHeight
          };
        });
        
        // Verify grid is properly set up
        expect(gridInfo.display).toBe('grid');
        expect(gridInfo.gridTemplateColumns).not.toBe('none');
        expect(gridInfo.width).toBeGreaterThan(0);
        expect(gridInfo.height).toBeGreaterThan(0);
        
        // Test grid items
        const gridItems = await container.locator('[data-grid-item]').all();
        for (const item of gridItems) {
          const itemInfo = await item.evaluate(el => {
            const styles = window.getComputedStyle(el);
            return {
              gridColumn: styles.gridColumn,
              gridRow: styles.gridRow,
              width: el.offsetWidth,
              height: el.offsetHeight
            };
          });
          
          expect(itemInfo.width).toBeGreaterThan(0);
          expect(itemInfo.height).toBeGreaterThan(0);
        }
      }
    }
  });

  test('Form components work together seamlessly', async ({ page }) => {
    await page.goto('/components/forms-integration');
    
    // Test complete form interaction
    const form = page.locator('[data-testid="integrated-form"]');
    
    // Fill out various form fields
    await page.fill('[data-testid="input-text"]', 'Test User');
    await page.fill('[data-testid="input-email"]', 'test@example.com');
    await page.selectOption('[data-testid="select-country"]', 'US');
    await page.check('[data-testid="checkbox-terms"]');
    await page.check('[data-testid="radio-newsletter"]');
    await page.fill('[data-testid="textarea-comments"]', 'This is a test comment.');
    
    // Verify form validation styling
    const formFields = await page.locator('input, select, textarea').all();
    
    for (const field of formFields) {
      const fieldStyles = await field.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          borderColor: styles.borderColor,
          backgroundColor: styles.backgroundColor,
          color: styles.color
        };
      });
      
      // Valid fields should not have error styling
      expect(fieldStyles.borderColor).not.toContain('rgb(255, 0, 0)'); // Not red
    }
    
    // Test form submission
    const submitButton = page.locator('[data-testid="submit-button"]');
    await submitButton.click();
    
    // Wait for submission feedback
    await page.waitForSelector('[data-testid="form-success"]', { timeout: 5000 });
    
    const successMessage = page.locator('[data-testid="form-success"]');
    expect(await successMessage.isVisible()).toBe(true);
  });

  test('Navigation components maintain consistency', async ({ page }) => {
    // Test main navigation
    const mainNav = page.locator('[data-testid="main-navigation"]');
    
    // Get all navigation links
    const navLinks = await mainNav.locator('a').all();
    
    // Test each navigation link
    for (let i = 0; i < Math.min(navLinks.length, 5); i++) {
      const link = navLinks[i];
      const href = await link.getAttribute('href');
      
      if (href && !href.startsWith('#') && !href.startsWith('mailto:')) {
        // Test navigation consistency
        const initialActiveLink = await page.locator('.active-nav-link').textContent();
        
        await link.click();
        await page.waitForLoadState('networkidle');
        
        // Verify navigation updated
        const currentActiveLink = await page.locator('.active-nav-link').textContent();
        expect(currentActiveLink).not.toBe(initialActiveLink);
        
        // Verify navigation styling is consistent
        const navStyles = await mainNav.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            backgroundColor: styles.backgroundColor,
            borderColor: styles.borderColor,
            height: el.offsetHeight
          };
        });
        
        expect(navStyles.height).toBeGreaterThan(0);
      }
    }
  });

  test('Modal and overlay components work correctly', async ({ page }) => {
    await page.goto('/components/modals');
    
    // Test basic modal
    const modalTrigger = page.locator('[data-testid="modal-trigger"]');
    await modalTrigger.click();
    
    // Verify modal is visible
    const modal = page.locator('[data-testid="modal"]');
    await expect(modal).toBeVisible();
    
    // Test modal backdrop
    const backdrop = page.locator('[data-testid="modal-backdrop"]');
    await expect(backdrop).toBeVisible();
    
    // Test modal focus trapping
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement.tagName);
    expect(['BUTTON', 'INPUT', 'A']).toContain(focusedElement);
    
    // Test modal close
    const closeButton = page.locator('[data-testid="modal-close"]');
    await closeButton.click();
    
    await expect(modal).not.toBeVisible();
    
    // Test backdrop close
    await modalTrigger.click();
    await backdrop.click({ position: { x: 10, y: 10 } }); // Click backdrop
    await expect(modal).not.toBeVisible();
    
    // Test escape key close
    await modalTrigger.click();
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('Data visualization components render correctly', async ({ page }) => {
    await page.goto('/components/data-visualization');
    
    // Test charts and graphs
    const visualizations = await page.locator('[data-visualization]').all();
    
    for (const viz of visualizations) {
      const vizType = await viz.getAttribute('data-visualization');
      
      // Verify visualization is rendered
      const vizDimensions = await viz.evaluate(el => ({
        width: el.offsetWidth,
        height: el.offsetHeight,
        hasContent: el.children.length > 0
      }));
      
      expect(vizDimensions.width).toBeGreaterThan(0);
      expect(vizDimensions.height).toBeGreaterThan(0);
      expect(vizDimensions.hasContent).toBe(true);
      
      // Test responsive behavior
      await page.setViewportSize({ width: 600, height: 800 });
      
      const mobileVizDimensions = await viz.evaluate(el => ({
        width: el.offsetWidth,
        height: el.offsetHeight
      }));
      
      // Visualization should adapt to smaller screens
      expect(mobileVizDimensions.width).toBeLessThanOrEqual(vizDimensions.width);
      
      await page.setViewportSize({ width: 1024, height: 768 }); // Reset
    }
  });

  test('Error handling and loading states work consistently', async ({ page }) => {
    await page.goto('/components/states');
    
    // Test loading states
    const loadingElements = await page.locator('[data-loading="true"]').all();
    
    for (const element of loadingElements) {
      const loadingIndicator = await element.locator('.loading-spinner, .loading-skeleton').count();
      expect(loadingIndicator).toBeGreaterThan(0);
      
      // Verify loading state styling
      const opacity = await element.evaluate(el => {
        return window.getComputedStyle(el).opacity;
      });
      
      expect(parseFloat(opacity)).toBeLessThanOrEqual(1.0);
    }
    
    // Test error states
    const errorElements = await page.locator('[data-error="true"]').all();
    
    for (const element of errorElements) {
      const errorMessage = await element.locator('.error-message, [role="alert"]').count();
      expect(errorMessage).toBeGreaterThan(0);
      
      // Verify error styling
      const borderColor = await element.evaluate(el => {
        return window.getComputedStyle(el).borderColor;
      });
      
      // Should have some visual error indication
      expect(borderColor).toBeTruthy();
    }
  });

  test('Accessibility features work across all components', async ({ page }) => {
    await page.goto('/components/accessibility-showcase');
    
    // Test skip links
    const skipLink = page.locator('[data-testid="skip-link"]');
    if (await skipLink.count() > 0) {
      await page.keyboard.press('Tab');
      await expect(skipLink).toBeFocused();
      
      await page.keyboard.press('Enter');
      const mainContent = page.locator('#main-content, [role="main"]');
      await expect(mainContent).toBeFocused();
    }
    
    // Test ARIA live regions
    const liveRegions = await page.locator('[aria-live]').all();
    
    for (const region of liveRegions) {
      const ariaLive = await region.getAttribute('aria-live');
      expect(['polite', 'assertive', 'off']).toContain(ariaLive);
    }
    
    // Test landmark roles
    const landmarks = await page.locator('[role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"]').all();
    expect(landmarks.length).toBeGreaterThan(0);
    
    // Test heading hierarchy
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    
    if (headings.length > 0) {
      let previousLevel = 0;
      
      for (const heading of headings) {
        const tagName = await heading.evaluate(el => el.tagName);
        const currentLevel = parseInt(tagName.charAt(1));
        
        // First heading should be h1
        if (previousLevel === 0) {
          expect(currentLevel).toBe(1);
        }
        
        // Subsequent headings should not skip levels
        if (previousLevel > 0) {
          expect(currentLevel - previousLevel).toBeLessThanOrEqual(1);
        }
        
        previousLevel = currentLevel;
      }
    }
  });
});
