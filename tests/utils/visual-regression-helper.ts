import { Page, expect } from '@playwright/test';
import { createHash } from 'crypto';

interface ScreenshotOptions {
  fullPage?: boolean;
  threshold?: number;
  animations?: 'disabled' | 'allow';
  mask?: string[];
  clip?: { x: number; y: number; width: number; height: number };
}

interface VisualComparisonResult {
  passed: boolean;
  difference: number;
  screenshotPath: string;
  baselinePath?: string;
  diffPath?: string;
}

export class VisualRegressionHelper {
  private page: Page;
  private baselineDir: string;
  private actualDir: string;
  private diffDir: string;
  
  constructor(page: Page, baseDir: string = 'tests/visual-baselines') {
    this.page = page;
    this.baselineDir = `${baseDir}/baseline`;
    this.actualDir = `${baseDir}/actual`;
    this.diffDir = `${baseDir}/diff`;
  }

  /**
   * Take a screenshot and compare with baseline
   */
  async compareScreenshot(
    name: string,
    options: ScreenshotOptions = {}
  ): Promise<VisualComparisonResult> {
    const defaultOptions: ScreenshotOptions = {
      fullPage: true,
      threshold: 0.2,
      animations: 'disabled',
      ...options
    };
    
    // Disable animations if requested
    if (defaultOptions.animations === 'disabled') {
      await this.disableAnimations();
    }
    
    // Wait for page to be stable
    await this.waitForStability();
    
    const screenshotName = `${name}.png`;
    
    try {
      // Use Playwright's built-in screenshot comparison
      await expect(this.page).toHaveScreenshot(screenshotName, {
        fullPage: defaultOptions.fullPage,
        threshold: defaultOptions.threshold,
        animations: defaultOptions.animations,
        mask: defaultOptions.mask?.map(selector => this.page.locator(selector)),
        clip: defaultOptions.clip
      });
      
      return {
        passed: true,
        difference: 0,
        screenshotPath: screenshotName
      };
    } catch (error) {
      return {
        passed: false,
        difference: this.extractDifferenceFromError(error),
        screenshotPath: screenshotName,
        baselinePath: `${this.baselineDir}/${screenshotName}`,
        diffPath: `${this.diffDir}/${screenshotName}`
      };
    }
  }

  /**
   * Compare element screenshot
   */
  async compareElementScreenshot(
    selector: string,
    name: string,
    options: ScreenshotOptions = {}
  ): Promise<VisualComparisonResult> {
    const element = this.page.locator(selector);
    
    // Wait for element to be visible
    await element.waitFor({ state: 'visible' });
    
    const defaultOptions: ScreenshotOptions = {
      threshold: 0.1,
      animations: 'disabled',
      ...options
    };
    
    if (defaultOptions.animations === 'disabled') {
      await this.disableAnimations();
    }
    
    await this.waitForStability();
    
    const screenshotName = `${name}-element.png`;
    
    try {
      await expect(element).toHaveScreenshot(screenshotName, {
        threshold: defaultOptions.threshold,
        animations: defaultOptions.animations
      });
      
      return {
        passed: true,
        difference: 0,
        screenshotPath: screenshotName
      };
    } catch (error) {
      return {
        passed: false,
        difference: this.extractDifferenceFromError(error),
        screenshotPath: screenshotName
      };
    }
  }

  /**
   * Compare multiple viewport screenshots
   */
  async compareAcrossViewports(
    name: string,
    viewports: Array<{ width: number; height: number; name: string }>,
    options: ScreenshotOptions = {}
  ): Promise<{ [viewportName: string]: VisualComparisonResult }> {
    const results: { [viewportName: string]: VisualComparisonResult } = {};
    
    for (const viewport of viewports) {
      await this.page.setViewportSize({ width: viewport.width, height: viewport.height });
      await this.waitForStability();
      
      const screenshotName = `${name}-${viewport.name}`;
      results[viewport.name] = await this.compareScreenshot(screenshotName, options);
    }
    
    return results;
  }

  /**
   * Take baseline screenshots
   */
  async createBaseline(
    name: string,
    options: ScreenshotOptions = {}
  ): Promise<string> {
    const defaultOptions: ScreenshotOptions = {
      fullPage: true,
      animations: 'disabled',
      ...options
    };
    
    if (defaultOptions.animations === 'disabled') {
      await this.disableAnimations();
    }
    
    await this.waitForStability();
    
    const screenshotPath = `${this.baselineDir}/${name}.png`;
    
    await this.page.screenshot({
      path: screenshotPath,
      fullPage: defaultOptions.fullPage,
      clip: defaultOptions.clip
    });
    
    return screenshotPath;
  }

  /**
   * Disable CSS animations and transitions
   */
  private async disableAnimations(): Promise<void> {
    await this.page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
          scroll-behavior: auto !important;
        }
        
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `
    });
  }

  /**
   * Wait for page to be visually stable
   */
  private async waitForStability(): Promise<void> {
    // Wait for network to be idle
    await this.page.waitForLoadState('networkidle');
    
    // Wait for fonts to load
    await this.page.waitForFunction(() => {
      return document.fonts.ready.then(() => true);
    });
    
    // Wait for any lazy-loaded images
    await this.page.waitForFunction(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.every(img => img.complete && img.naturalHeight !== 0);
    }, { timeout: 5000 }).catch(() => {
      // Continue if images don't load within timeout
    });
    
    // Additional wait for layout to settle
    await this.page.waitForTimeout(500);
  }

  /**
   * Mask dynamic content for consistent screenshots
   */
  async maskDynamicContent(selectors: string[]): Promise<void> {
    for (const selector of selectors) {
      await this.page.addStyleTag({
        content: `
          ${selector} {
            background: #f0f0f0 !important;
            color: transparent !important;
          }
          
          ${selector} * {
            visibility: hidden !important;
          }
        `
      });
    }
  }

  /**
   * Compare screenshots with custom tolerance
   */
  async compareWithTolerance(
    name: string,
    tolerance: number,
    options: ScreenshotOptions = {}
  ): Promise<VisualComparisonResult> {
    return this.compareScreenshot(name, {
      ...options,
      threshold: tolerance
    });
  }

  /**
   * Create responsive screenshot grid
   */
  async createResponsiveGrid(
    name: string,
    viewports: Array<{ width: number; height: number; name: string }>
  ): Promise<string[]> {
    const screenshots: string[] = [];
    
    for (const viewport of viewports) {
      await this.page.setViewportSize({ width: viewport.width, height: viewport.height });
      await this.waitForStability();
      
      const screenshotName = `${name}-grid-${viewport.name}.png`;
      const path = await this.createBaseline(screenshotName);
      screenshots.push(path);
    }
    
    return screenshots;
  }

  /**
   * Test hover states
   */
  async compareHoverStates(
    selector: string,
    name: string
  ): Promise<{ normal: VisualComparisonResult; hover: VisualComparisonResult }> {
    const element = this.page.locator(selector);
    
    // Normal state
    const normalResult = await this.compareElementScreenshot(
      selector,
      `${name}-normal`
    );
    
    // Hover state
    await element.hover();
    await this.page.waitForTimeout(200); // Wait for hover effects
    
    const hoverResult = await this.compareElementScreenshot(
      selector,
      `${name}-hover`
    );
    
    return {
      normal: normalResult,
      hover: hoverResult
    };
  }

  /**
   * Test focus states
   */
  async compareFocusStates(
    selector: string,
    name: string
  ): Promise<{ normal: VisualComparisonResult; focused: VisualComparisonResult }> {
    const element = this.page.locator(selector);
    
    // Normal state
    const normalResult = await this.compareElementScreenshot(
      selector,
      `${name}-normal`
    );
    
    // Focus state
    await element.focus();
    await this.page.waitForTimeout(100);
    
    const focusedResult = await this.compareElementScreenshot(
      selector,
      `${name}-focused`
    );
    
    return {
      normal: normalResult,
      focused: focusedResult
    };
  }

  /**
   * Compare theme variations
   */
  async compareThemes(
    name: string,
    themes: Array<{ name: string; selector?: string; mediaQuery?: string }>
  ): Promise<{ [themeName: string]: VisualComparisonResult }> {
    const results: { [themeName: string]: VisualComparisonResult } = {};
    
    for (const theme of themes) {
      if (theme.selector) {
        // Apply theme by adding class
        await this.page.evaluate((selector) => {
          document.documentElement.className = selector;
        }, theme.selector);
      } else if (theme.mediaQuery) {
        // Apply theme by emulating media
        await this.page.emulateMedia({ colorScheme: theme.mediaQuery as any });
      }
      
      await this.waitForStability();
      
      const screenshotName = `${name}-theme-${theme.name}`;
      results[theme.name] = await this.compareScreenshot(screenshotName);
    }
    
    return results;
  }

  /**
   * Extract difference percentage from Playwright error
   */
  private extractDifferenceFromError(error: any): number {
    const errorMessage = error.message || '';
    const match = errorMessage.match(/(\d+(?:\.\d+)?)% difference/);
    return match ? parseFloat(match[1]) : 100;
  }

  /**
   * Generate hash for content-based screenshot naming
   */
  async generateContentHash(): Promise<string> {
    const content = await this.page.content();
    return createHash('md5').update(content).digest('hex').substring(0, 8);
  }

  /**
   * Compare with multiple threshold levels
   */
  async compareWithMultipleThresholds(
    name: string,
    thresholds: number[]
  ): Promise<{ [threshold: string]: VisualComparisonResult }> {
    const results: { [threshold: string]: VisualComparisonResult } = {};
    
    for (const threshold of thresholds) {
      results[`threshold-${threshold}`] = await this.compareScreenshot(
        `${name}-t${threshold}`,
        { threshold }
      );
    }
    
    return results;
  }

  /**
   * Test print styles
   */
  async comparePrintStyles(name: string): Promise<VisualComparisonResult> {
    await this.page.emulateMedia({ media: 'print' });
    await this.waitForStability();
    
    return this.compareScreenshot(`${name}-print`);
  }

  /**
   * Compare loading states
   */
  async compareLoadingStates(
    name: string,
    loadingSelector: string
  ): Promise<{ loading: VisualComparisonResult; loaded: VisualComparisonResult }> {
    // Capture loading state
    const loadingResult = await this.compareScreenshot(`${name}-loading`);
    
    // Wait for loading to complete
    await this.page.waitForSelector(loadingSelector, { state: 'hidden' });
    await this.waitForStability();
    
    // Capture loaded state
    const loadedResult = await this.compareScreenshot(`${name}-loaded`);
    
    return {
      loading: loadingResult,
      loaded: loadedResult
    };
  }
}
