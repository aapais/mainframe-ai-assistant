import { Page, Locator } from '@playwright/test';

interface ViewportConfig {
  width: number;
  height: number;
  name: string;
  category: 'mobile' | 'tablet' | 'desktop';
}

interface BreakpointConfig {
  name: string;
  min: number;
  max?: number;
}

export class ResponsiveTestHelper {
  private page: Page;
  
  constructor(page: Page) {
    this.page = page;
  }

  // Standard viewport configurations
  static readonly VIEWPORTS: ViewportConfig[] = [
    { width: 320, height: 568, name: 'mobile-portrait-small', category: 'mobile' },
    { width: 375, height: 667, name: 'mobile-portrait-medium', category: 'mobile' },
    { width: 414, height: 896, name: 'mobile-portrait-large', category: 'mobile' },
    { width: 568, height: 320, name: 'mobile-landscape-small', category: 'mobile' },
    { width: 667, height: 375, name: 'mobile-landscape-medium', category: 'mobile' },
    { width: 768, height: 1024, name: 'tablet-portrait', category: 'tablet' },
    { width: 1024, height: 768, name: 'tablet-landscape', category: 'tablet' },
    { width: 820, height: 1180, name: 'tablet-portrait-large', category: 'tablet' },
    { width: 1366, height: 768, name: 'desktop-small', category: 'desktop' },
    { width: 1440, height: 900, name: 'desktop-medium', category: 'desktop' },
    { width: 1920, height: 1080, name: 'desktop-large', category: 'desktop' },
    { width: 2560, height: 1440, name: 'desktop-ultrawide', category: 'desktop' },
  ];

  // CSS breakpoints
  static readonly BREAKPOINTS: BreakpointConfig[] = [
    { name: 'mobile', min: 0, max: 767 },
    { name: 'tablet', min: 768, max: 1023 },
    { name: 'desktop-small', min: 1024, max: 1365 },
    { name: 'desktop-large', min: 1366 },
  ];

  /**
   * Set viewport size and wait for layout to settle
   */
  async setViewport(width: number, height: number): Promise<void> {
    await this.page.setViewportSize({ width, height });
    
    // Wait for viewport change to take effect
    await this.page.waitForFunction(
      ({ w, h }) => window.innerWidth === w && window.innerHeight === h,
      { width, height }
    );
    
    // Allow some time for responsive styles to apply
    await this.page.waitForTimeout(200);
  }

  /**
   * Get current viewport dimensions
   */
  async getCurrentViewport(): Promise<{ width: number; height: number }> {
    return this.page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
  }

  /**
   * Check if current viewport matches a breakpoint
   */
  async isBreakpoint(breakpointName: string): Promise<boolean> {
    const viewport = await this.getCurrentViewport();
    const breakpoint = ResponsiveTestHelper.BREAKPOINTS.find(bp => bp.name === breakpointName);
    
    if (!breakpoint) {
      throw new Error(`Unknown breakpoint: ${breakpointName}`);
    }
    
    return viewport.width >= breakpoint.min && 
           (breakpoint.max === undefined || viewport.width <= breakpoint.max);
  }

  /**
   * Test element visibility across multiple viewports
   */
  async testElementVisibilityAcrossViewports(
    selector: string,
    viewports: ViewportConfig[] = ResponsiveTestHelper.VIEWPORTS
  ): Promise<{ [viewport: string]: boolean }> {
    const results: { [viewport: string]: boolean } = {};
    
    for (const viewport of viewports) {
      await this.setViewport(viewport.width, viewport.height);
      
      const element = this.page.locator(selector);
      results[viewport.name] = await element.isVisible();
    }
    
    return results;
  }

  /**
   * Test element positioning across viewports
   */
  async testElementPositionAcrossViewports(
    selector: string,
    viewports: ViewportConfig[] = ResponsiveTestHelper.VIEWPORTS
  ): Promise<{ [viewport: string]: { x: number; y: number; width: number; height: number } | null }> {
    const results: { [viewport: string]: any } = {};
    
    for (const viewport of viewports) {
      await this.setViewport(viewport.width, viewport.height);
      
      const element = this.page.locator(selector);
      
      if (await element.isVisible()) {
        results[viewport.name] = await element.boundingBox();
      } else {
        results[viewport.name] = null;
      }
    }
    
    return results;
  }

  /**
   * Check if navigation is mobile (hamburger menu) or desktop (full nav)
   */
  async getNavigationType(): Promise<'mobile' | 'desktop'> {
    const hamburgerMenu = this.page.locator('[data-testid="mobile-menu-toggle"]');
    const mainNav = this.page.locator('[data-testid="main-navigation"]');
    
    const isHamburgerVisible = await hamburgerMenu.isVisible();
    const isMainNavVisible = await mainNav.isVisible();
    
    if (isHamburgerVisible && !isMainNavVisible) {
      return 'mobile';
    } else if (!isHamburgerVisible && isMainNavVisible) {
      return 'desktop';
    } else {
      // Fallback to viewport size
      const viewport = await this.getCurrentViewport();
      return viewport.width < 768 ? 'mobile' : 'desktop';
    }
  }

  /**
   * Test responsive grid layouts
   */
  async testGridLayout(
    containerSelector: string,
    itemSelector: string,
    expectedColumns: { [breakpoint: string]: number }
  ): Promise<{ [viewport: string]: number }> {
    const results: { [viewport: string]: number } = {};
    
    for (const [breakpoint, expectedCols] of Object.entries(expectedColumns)) {
      const breakpointConfig = ResponsiveTestHelper.BREAKPOINTS.find(bp => bp.name === breakpoint);
      if (!breakpointConfig) continue;
      
      // Test at minimum width of breakpoint
      const testWidth = breakpointConfig.min;
      await this.setViewport(testWidth, 768);
      
      const actualColumns = await this.getGridColumns(containerSelector, itemSelector);
      results[breakpoint] = actualColumns;
    }
    
    return results;
  }

  /**
   * Calculate number of columns in a grid layout
   */
  private async getGridColumns(containerSelector: string, itemSelector: string): Promise<number> {
    return this.page.evaluate(
      ({ container, item }) => {
        const containerEl = document.querySelector(container);
        const items = containerEl?.querySelectorAll(item);
        
        if (!items || items.length === 0) return 0;
        
        // Get Y position of first item
        const firstItemY = (items[0] as HTMLElement).getBoundingClientRect().top;
        
        // Count items on the same row (within 10px tolerance)
        let columnsInFirstRow = 0;
        for (const itemEl of items) {
          const itemY = (itemEl as HTMLElement).getBoundingClientRect().top;
          if (Math.abs(itemY - firstItemY) < 10) {
            columnsInFirstRow++;
          } else {
            break;
          }
        }
        
        return columnsInFirstRow;
      },
      { container: containerSelector, item: itemSelector }
    );
  }

  /**
   * Test responsive text scaling
   */
  async testTextScaling(
    selector: string,
    viewports: ViewportConfig[] = ResponsiveTestHelper.VIEWPORTS
  ): Promise<{ [viewport: string]: number }> {
    const results: { [viewport: string]: number } = {};
    
    for (const viewport of viewports) {
      await this.setViewport(viewport.width, viewport.height);
      
      const fontSize = await this.page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (!element) return 0;
        
        const styles = window.getComputedStyle(element);
        return parseFloat(styles.fontSize);
      }, selector);
      
      results[viewport.name] = fontSize;
    }
    
    return results;
  }

  /**
   * Simulate device orientation change
   */
  async simulateOrientationChange(width: number, height: number): Promise<void> {
    // Swap dimensions to simulate rotation
    await this.setViewport(height, width);
    
    // Trigger orientation change event
    await this.page.evaluate(() => {
      window.dispatchEvent(new Event('orientationchange'));
      window.dispatchEvent(new Event('resize'));
    });
    
    // Wait for any orientation-specific JavaScript to execute
    await this.page.waitForTimeout(500);
  }

  /**
   * Test touch target sizes
   */
  async validateTouchTargetSizes(
    minSize: number = 44,
    selectors: string[] = ['button', 'a', '[role="button"]', 'input', 'select']
  ): Promise<{ valid: boolean; violations: Array<{ selector: string; size: { width: number; height: number } }> }> {
    const violations: Array<{ selector: string; size: { width: number; height: number } }> = [];
    
    for (const selector of selectors) {
      const elements = this.page.locator(selector);
      const count = await elements.count();
      
      for (let i = 0; i < count; i++) {
        const element = elements.nth(i);
        
        if (await element.isVisible()) {
          const box = await element.boundingBox();
          
          if (box && (box.width < minSize || box.height < minSize)) {
            violations.push({
              selector: `${selector}:nth-child(${i + 1})`,
              size: { width: box.width, height: box.height }
            });
          }
        }
      }
    }
    
    return {
      valid: violations.length === 0,
      violations
    };
  }

  /**
   * Test responsive images
   */
  async testResponsiveImages(
    viewports: ViewportConfig[] = ResponsiveTestHelper.VIEWPORTS
  ): Promise<{ [viewport: string]: Array<{ src: string; naturalWidth: number; displayWidth: number }> }> {
    const results: { [viewport: string]: any } = {};
    
    for (const viewport of viewports) {
      await this.setViewport(viewport.width, viewport.height);
      
      const imageData = await this.page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'));
        
        return images.map(img => ({
          src: img.src,
          naturalWidth: img.naturalWidth,
          displayWidth: img.getBoundingClientRect().width
        }));
      });
      
      results[viewport.name] = imageData;
    }
    
    return results;
  }

  /**
   * Test responsive tables
   */
  async testResponsiveTable(
    tableSelector: string,
    viewports: ViewportConfig[] = ResponsiveTestHelper.VIEWPORTS
  ): Promise<{ [viewport: string]: { hasHorizontalScroll: boolean; visibleColumns: number } }> {
    const results: { [viewport: string]: any } = {};
    
    for (const viewport of viewports) {
      await this.setViewport(viewport.width, viewport.height);
      
      const tableData = await this.page.evaluate((selector) => {
        const table = document.querySelector(selector) as HTMLTableElement;
        if (!table) return { hasHorizontalScroll: false, visibleColumns: 0 };
        
        const container = table.closest('[data-testid="table-container"]') || table.parentElement;
        const hasHorizontalScroll = container ? container.scrollWidth > container.clientWidth : false;
        
        const firstRow = table.querySelector('tr');
        const visibleColumns = firstRow ? 
          Array.from(firstRow.querySelectorAll('th, td')).filter(cell => {
            const rect = (cell as HTMLElement).getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }).length : 0;
        
        return { hasHorizontalScroll, visibleColumns };
      }, tableSelector);
      
      results[viewport.name] = tableData;
    }
    
    return results;
  }

  /**
   * Wait for responsive transition to complete
   */
  async waitForResponsiveTransition(): Promise<void> {
    // Wait for CSS transitions to complete
    await this.page.waitForFunction(() => {
      return !document.querySelector(':any-link, button, input, select, textarea')
        ?.matches(':any([style*="transition"], [class*="transition"])');
    }, { timeout: 2000 });
    
    // Additional wait for layout shifts
    await this.page.waitForTimeout(300);
  }

  /**
   * Get viewport category based on width
   */
  getViewportCategory(width: number): 'mobile' | 'tablet' | 'desktop' {
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }
}
