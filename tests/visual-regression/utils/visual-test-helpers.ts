/**
 * Visual Testing Helper Utilities
 * Comprehensive utilities for consistent visual regression testing
 */

import { Page, Locator, expect } from '@playwright/test';
import { visualThresholds, testViewports } from '../config/visual-test.config';

// =====================
// Types & Interfaces
// =====================

export interface VisualTestOptions {
  threshold?: number;
  mask?: Locator[];
  clip?: { x: number; y: number; width: number; height: number };
  fullPage?: boolean;
  animations?: 'disabled' | 'allow';
  waitForFonts?: boolean;
  waitForImages?: boolean;
  disableAnimations?: boolean;
}

export interface ComponentTestState {
  loading?: boolean;
  error?: string;
  disabled?: boolean;
  focus?: boolean;
  hover?: boolean;
  active?: boolean;
  data?: any;
}

export interface ResponsiveTestConfig {
  viewport: keyof typeof testViewports;
  orientation?: 'portrait' | 'landscape';
  devicePixelRatio?: number;
}

// =====================
// Visual Test Helpers
// =====================

export class VisualTestHelpers {
  constructor(private page: Page) {}

  /**
   * Prepare page for visual testing with consistent settings
   */
  async preparePage(options: VisualTestOptions = {}): Promise<void> {
    // Disable animations by default
    if (options.disableAnimations !== false) {
      await this.page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
          }

          /* Disable CSS animations */
          @keyframes * {
            0%, 100% { opacity: 1; }
          }
        `
      });
    }

    // Wait for fonts to load
    if (options.waitForFonts !== false) {
      await this.page.waitForFunction(() => document.fonts.ready);
    }

    // Wait for images to load
    if (options.waitForImages !== false) {
      await this.page.waitForLoadState('networkidle');
    }

    // Ensure page is fully rendered
    await this.page.waitForTimeout(500);
  }

  /**
   * Take a visual comparison screenshot with enhanced options
   */
  async compareVisual(
    name: string,
    locator?: Locator,
    options: VisualTestOptions = {}
  ): Promise<void> {
    const defaultOptions = {
      threshold: visualThresholds.component,
      animations: 'disabled' as const,
      ...options
    };

    if (locator) {
      // Wait for element to be visible and stable
      await locator.waitFor({ state: 'visible' });
      await this.waitForElementStability(locator);

      await expect(locator).toHaveScreenshot(`${name}.png`, defaultOptions);
    } else {
      await expect(this.page).toHaveScreenshot(`${name}.png`, defaultOptions);
    }
  }

  /**
   * Test component in multiple states (normal, hover, focus, etc.)
   */
  async testComponentStates(
    name: string,
    locator: Locator,
    states: ComponentTestState[] = [{}],
    options: VisualTestOptions = {}
  ): Promise<void> {
    for (let i = 0; i < states.length; i++) {
      const state = states[i];
      const stateName = this.getStateName(state, i);

      await this.applyComponentState(locator, state);
      await this.compareVisual(`${name}-${stateName}`, locator, options);
      await this.resetComponentState(locator, state);
    }
  }

  /**
   * Test component across different viewports
   */
  async testResponsive(
    name: string,
    locator: Locator,
    configs: ResponsiveTestConfig[],
    options: VisualTestOptions = {}
  ): Promise<void> {
    const originalViewport = this.page.viewportSize();

    for (const config of configs) {
      const viewport = testViewports[config.viewport];

      if (config.orientation === 'landscape' && viewport.width < viewport.height) {
        await this.page.setViewportSize({
          width: viewport.height,
          height: viewport.width
        });
      } else {
        await this.page.setViewportSize(viewport);
      }

      await this.page.waitForTimeout(300); // Allow layout to settle
      await this.compareVisual(
        `${name}-${config.viewport}`,
        locator,
        options
      );
    }

    // Restore original viewport
    if (originalViewport) {
      await this.page.setViewportSize(originalViewport);
    }
  }

  /**
   * Test component in different themes
   */
  async testThemes(
    name: string,
    locator: Locator,
    themes: string[] = ['light', 'dark'],
    options: VisualTestOptions = {}
  ): Promise<void> {
    for (const theme of themes) {
      await this.applyTheme(theme);
      await this.compareVisual(`${name}-${theme}`, locator, options);
    }
  }

  /**
   * Wait for element to be stable (no changes in position/size)
   */
  private async waitForElementStability(locator: Locator): Promise<void> {
    let previousBox: any = null;
    let stableCount = 0;
    const requiredStableChecks = 3;

    while (stableCount < requiredStableChecks) {
      await this.page.waitForTimeout(100);

      try {
        const currentBox = await locator.boundingBox();

        if (previousBox &&
            currentBox?.x === previousBox.x &&
            currentBox?.y === previousBox.y &&
            currentBox?.width === previousBox.width &&
            currentBox?.height === previousBox.height) {
          stableCount++;
        } else {
          stableCount = 0;
        }

        previousBox = currentBox;
      } catch (error) {
        // Element might not be ready yet
        stableCount = 0;
      }
    }
  }

  /**
   * Apply component state (hover, focus, etc.)
   */
  private async applyComponentState(
    locator: Locator,
    state: ComponentTestState
  ): Promise<void> {
    if (state.hover) {
      await locator.hover();
    }

    if (state.focus) {
      await locator.focus();
    }

    if (state.active) {
      await locator.click();
      await this.page.waitForTimeout(100);
    }

    if (state.disabled) {
      await locator.evaluate(el => {
        (el as HTMLElement).setAttribute('disabled', 'true');
        (el as HTMLElement).classList.add('disabled');
      });
    }

    if (state.data) {
      // Apply data changes via component props or direct manipulation
      await this.applyComponentData(locator, state.data);
    }

    // Allow state changes to settle
    await this.page.waitForTimeout(200);
  }

  /**
   * Reset component state to default
   */
  private async resetComponentState(
    locator: Locator,
    state: ComponentTestState
  ): Promise<void> {
    if (state.focus) {
      await this.page.keyboard.press('Tab'); // Move focus away
    }

    if (state.disabled) {
      await locator.evaluate(el => {
        (el as HTMLElement).removeAttribute('disabled');
        (el as HTMLElement).classList.remove('disabled');
      });
    }

    if (state.hover || state.active) {
      // Move mouse away from element
      await this.page.mouse.move(0, 0);
    }

    await this.page.waitForTimeout(100);
  }

  /**
   * Apply theme to the page
   */
  private async applyTheme(theme: string): Promise<void> {
    await this.page.evaluate((themeName) => {
      document.documentElement.setAttribute('data-theme', themeName);
      document.documentElement.className = `theme-${themeName}`;
    }, theme);

    // Wait for theme changes to apply
    await this.page.waitForTimeout(300);
  }

  /**
   * Apply data to component
   */
  private async applyComponentData(locator: Locator, data: any): Promise<void> {
    // This is highly component-specific and would need to be customized
    // For now, we'll handle common scenarios

    if (data.value !== undefined) {
      await locator.fill(data.value);
    }

    if (data.className) {
      await locator.evaluate((el, className) => {
        (el as HTMLElement).className = className;
      }, data.className);
    }

    if (data.style) {
      await locator.evaluate((el, style) => {
        Object.assign((el as HTMLElement).style, style);
      }, data.style);
    }
  }

  /**
   * Generate state name for screenshot
   */
  private getStateName(state: ComponentTestState, index: number): string {
    const conditions: string[] = [];

    if (state.loading) conditions.push('loading');
    if (state.error) conditions.push('error');
    if (state.disabled) conditions.push('disabled');
    if (state.focus) conditions.push('focus');
    if (state.hover) conditions.push('hover');
    if (state.active) conditions.push('active');

    return conditions.length > 0 ? conditions.join('-') : `state-${index}`;
  }
}

// =====================
// Visual Test Matchers
// =====================

export class VisualTestMatchers {
  /**
   * Compare component with different tolerance levels
   */
  static async compareWithTolerance(
    locator: Locator,
    name: string,
    contentType: keyof typeof visualThresholds = 'component'
  ): Promise<void> {
    await expect(locator).toHaveScreenshot(`${name}.png`, {
      threshold: visualThresholds[contentType]
    });
  }

  /**
   * Compare layout with masked dynamic content
   */
  static async compareLayout(
    page: Page,
    name: string,
    maskSelectors: string[] = []
  ): Promise<void> {
    const masks = maskSelectors.map(selector => page.locator(selector));

    await expect(page).toHaveScreenshot(`${name}-layout.png`, {
      threshold: visualThresholds.layout,
      mask: masks,
      fullPage: true
    });
  }

  /**
   * Compare text rendering with relaxed threshold
   */
  static async compareText(
    locator: Locator,
    name: string
  ): Promise<void> {
    await expect(locator).toHaveScreenshot(`${name}-text.png`, {
      threshold: visualThresholds.text
    });
  }
}

// =====================
// Component Test Factory
// =====================

export class ComponentTestFactory {
  private helpers: VisualTestHelpers;

  constructor(page: Page) {
    this.helpers = new VisualTestHelpers(page);
  }

  /**
   * Create standard component test suite
   */
  async createComponentSuite(
    name: string,
    locator: Locator,
    options: {
      states?: ComponentTestState[];
      responsive?: ResponsiveTestConfig[];
      themes?: string[];
      customTests?: Array<() => Promise<void>>;
    } = {}
  ): Promise<void> {
    await this.helpers.preparePage();

    // Default state test
    await this.helpers.compareVisual(`${name}-default`, locator);

    // State variations
    if (options.states) {
      await this.helpers.testComponentStates(name, locator, options.states);
    }

    // Responsive tests
    if (options.responsive) {
      await this.helpers.testResponsive(name, locator, options.responsive);
    }

    // Theme tests
    if (options.themes) {
      await this.helpers.testThemes(name, locator, options.themes);
    }

    // Custom tests
    if (options.customTests) {
      for (const customTest of options.customTests) {
        await customTest();
      }
    }
  }
}

export default VisualTestHelpers;