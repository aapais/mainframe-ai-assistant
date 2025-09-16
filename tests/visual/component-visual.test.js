const { test, expect } = require('@playwright/test');

/**
 * Visual Regression Tests for Design System Components
 * Tests visual consistency across all components and states
 */

// Component test data
const COMPONENTS = {
  buttons: {
    variants: ['primary', 'secondary', 'outline', 'ghost', 'link'],
    sizes: ['sm', 'md', 'lg'],
    states: ['default', 'hover', 'active', 'disabled', 'loading']
  },
  inputs: {
    variants: ['text', 'email', 'password', 'search', 'textarea'],
    states: ['default', 'focus', 'error', 'disabled', 'filled']
  },
  cards: {
    variants: ['default', 'outlined', 'elevated', 'ghost'],
    states: ['default', 'hover', 'active', 'loading']
  },
  navigation: {
    variants: ['horizontal', 'vertical', 'breadcrumb', 'pagination'],
    states: ['default', 'active', 'disabled']
  },
  modals: {
    variants: ['dialog', 'drawer', 'popup', 'toast'],
    states: ['open', 'closed', 'loading']
  }
};

// Viewport sizes for responsive testing
const VIEWPORTS = [
  { width: 375, height: 667, name: 'mobile' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 1024, height: 768, name: 'desktop-small' },
  { width: 1440, height: 900, name: 'desktop-large' },
  { width: 1920, height: 1080, name: 'desktop-xl' }
];

// Color schemes for testing
const COLOR_SCHEMES = ['light', 'dark', 'high-contrast'];

test.describe('Visual Regression - Design System Components', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to component showcase
    await page.goto('/components/showcase');
    
    // Wait for fonts and styles to load
    await page.waitForLoadState('networkidle');
    
    // Ensure consistent timing
    await page.waitForTimeout(1000);
  });

  // Test each component variant
  Object.entries(COMPONENTS).forEach(([componentType, config]) => {
    test.describe(`${componentType} Components`, () => {
      config.variants.forEach(variant => {
        config.states.forEach(state => {
          test(`${variant} ${state} state`, async ({ page }) => {
            // Navigate to specific component
            const selector = `[data-testid="${componentType}-${variant}-${state}"]`;
            
            // Wait for component to be visible
            await page.waitForSelector(selector, { state: 'visible' });
            
            // Handle interactive states
            if (state === 'hover') {
              await page.hover(selector);
              await page.waitForTimeout(200);
            } else if (state === 'focus') {
              await page.focus(selector);
              await page.waitForTimeout(200);
            } else if (state === 'active') {
              await page.dispatchEvent(selector, 'mousedown');
              await page.waitForTimeout(200);
            }
            
            // Take screenshot
            await expect(page.locator(selector)).toHaveScreenshot(
              `${componentType}-${variant}-${state}.png`
            );
          });
        });
      });
    });
  });

  // Responsive design testing
  VIEWPORTS.forEach(viewport => {
    test(`Responsive layout - ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      // Test key components at this viewport
      await expect(page).toHaveScreenshot(`layout-${viewport.name}.png`, {
        fullPage: true,
        clip: { x: 0, y: 0, width: viewport.width, height: Math.min(viewport.height, 2000) }
      });
    });
  });

  // Color scheme testing
  COLOR_SCHEMES.forEach(scheme => {
    test(`Color scheme - ${scheme}`, async ({ page }) => {
      // Apply color scheme
      if (scheme === 'dark') {
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.addStyleTag({ content: 'html { color-scheme: dark; }' });
      } else if (scheme === 'high-contrast') {
        await page.emulateMedia({ forcedColors: 'active' });
      }
      
      await page.waitForTimeout(500);
      
      // Take screenshot of main components
      await expect(page).toHaveScreenshot(`color-scheme-${scheme}.png`, {
        fullPage: true
      });
    });
  });

  // Design token consistency testing
  test('Design token visual consistency', async ({ page }) => {
    await page.goto('/components/design-tokens');
    
    // Test color palette
    const colorPalette = page.locator('[data-testid="color-palette"]');
    await expect(colorPalette).toHaveScreenshot('color-palette.png');
    
    // Test typography scale
    const typography = page.locator('[data-testid="typography-scale"]');
    await expect(typography).toHaveScreenshot('typography-scale.png');
    
    // Test spacing scale
    const spacing = page.locator('[data-testid="spacing-scale"]');
    await expect(spacing).toHaveScreenshot('spacing-scale.png');
    
    // Test elevation system
    const elevation = page.locator('[data-testid="elevation-system"]');
    await expect(elevation).toHaveScreenshot('elevation-system.png');
  });

  // Animation and transition testing
  test('Animation consistency', async ({ page }) => {
    await page.goto('/components/animations');
    
    // Test button hover animations
    const button = page.locator('[data-testid="animated-button"]');
    await expect(button).toHaveScreenshot('button-initial.png');
    
    await button.hover();
    await page.waitForTimeout(300); // Wait for transition
    await expect(button).toHaveScreenshot('button-hover.png');
    
    // Test modal animations
    const modalTrigger = page.locator('[data-testid="modal-trigger"]');
    await modalTrigger.click();
    await page.waitForTimeout(500); // Wait for modal animation
    
    const modal = page.locator('[data-testid="modal"]');
    await expect(modal).toHaveScreenshot('modal-open.png');
  });

  // Layout stability testing
  test('Layout stability during loading', async ({ page }) => {
    // Test loading states don't cause layout shifts
    await page.goto('/components/loading-states');
    
    // Initial state
    await expect(page).toHaveScreenshot('loading-initial.png');
    
    // Trigger loading state
    await page.click('[data-testid="trigger-loading"]');
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('loading-active.png');
    
    // Wait for completion
    await page.waitForSelector('[data-testid="content-loaded"]');
    await expect(page).toHaveScreenshot('loading-complete.png');
  });
});

// Component isolation testing
test.describe('Component Isolation', () => {
  test('Components render independently', async ({ page }) => {
    // Test that components don't interfere with each other
    await page.goto('/components/isolation-test');
    
    // Multiple instances of same component
    const instances = page.locator('[data-testid^="isolated-component-"]');
    const count = await instances.count();
    
    for (let i = 0; i < count; i++) {
      const instance = instances.nth(i);
      await expect(instance).toHaveScreenshot(`isolated-component-${i}.png`);
    }
  });
});
