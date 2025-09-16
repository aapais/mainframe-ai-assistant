import { Page, Locator } from '@playwright/test';
import { injectAxe, checkA11y, getViolations } from 'axe-playwright';

interface AccessibilityViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    html: string;
    target: string[];
  }>;
}

interface ColorContrastResult {
  element: string;
  foreground: string;
  background: string;
  ratio: number;
  passes: boolean;
  level: 'AA' | 'AAA';
}

interface TouchTargetResult {
  element: string;
  width: number;
  height: number;
  passes: boolean;
  minSize: number;
}

export class AccessibilityHelper {
  private page: Page;
  
  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Initialize axe-core for accessibility testing
   */
  async initialize(): Promise<void> {
    await injectAxe(this.page);
  }

  /**
   * Run comprehensive accessibility audit
   */
  async runAccessibilityAudit(
    options: {
      include?: string[];
      exclude?: string[];
      rules?: string[];
      tags?: string[];
    } = {}
  ): Promise<AccessibilityViolation[]> {
    try {
      await checkA11y(this.page, undefined, {
        axeOptions: {
          rules: options.rules ? options.rules.reduce((acc, rule) => ({ ...acc, [rule]: { enabled: true } }), {}) : undefined,
          tags: options.tags
        },
        include: options.include,
        exclude: options.exclude
      });
      return [];
    } catch (error) {
      // Get detailed violations
      const violations = await getViolations(this.page);
      return violations as AccessibilityViolation[];
    }
  }

  /**
   * Validate touch target sizes for mobile accessibility
   */
  async validateTouchTargets(
    minSize: number = 44,
    selectors: string[] = ['button', 'a', '[role="button"]', 'input', 'select', '[tabindex]']
  ): Promise<{ passed: TouchTargetResult[]; failed: TouchTargetResult[] }> {
    const results: TouchTargetResult[] = [];
    
    for (const selector of selectors) {
      const elements = this.page.locator(selector);
      const count = await elements.count();
      
      for (let i = 0; i < count; i++) {
        const element = elements.nth(i);
        
        if (await element.isVisible()) {
          const box = await element.boundingBox();
          
          if (box) {
            const passes = box.width >= minSize && box.height >= minSize;
            
            results.push({
              element: `${selector}:nth-child(${i + 1})`,
              width: box.width,
              height: box.height,
              passes,
              minSize
            });
          }
        }
      }
    }
    
    return {
      passed: results.filter(r => r.passes),
      failed: results.filter(r => !r.passes)
    };
  }

  /**
   * Check color contrast ratios
   */
  async validateColorContrast(
    minRatio: number = 4.5,
    level: 'AA' | 'AAA' = 'AA'
  ): Promise<ColorContrastResult[]> {
    const results = await this.page.evaluate(
      ({ minRatio, level }) => {
        const getComputedColor = (element: Element, property: 'color' | 'background-color'): string => {
          const style = window.getComputedStyle(element);
          return style.getPropertyValue(property);
        };
        
        const rgbToHex = (rgb: string): string => {
          const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (!match) return rgb;
          
          const [, r, g, b] = match;
          return `#${((1 << 24) + (parseInt(r) << 16) + (parseInt(g) << 8) + parseInt(b)).toString(16).slice(1)}`;
        };
        
        const calculateLuminance = (hex: string): number => {
          const rgb = parseInt(hex.slice(1), 16);
          const r = (rgb >> 16) & 0xff;
          const g = (rgb >> 8) & 0xff;
          const b = (rgb >> 0) & 0xff;
          
          const sRGB = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          });
          
          return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
        };
        
        const calculateContrastRatio = (color1: string, color2: string): number => {
          const lum1 = calculateLuminance(color1);
          const lum2 = calculateLuminance(color2);
          const brighter = Math.max(lum1, lum2);
          const darker = Math.min(lum1, lum2);
          return (brighter + 0.05) / (darker + 0.05);
        };
        
        const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div, a, button, label, input, textarea');
        const results: ColorContrastResult[] = [];
        
        textElements.forEach((element, index) => {
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;
          
          const foreground = rgbToHex(getComputedColor(element, 'color'));
          const background = rgbToHex(getComputedColor(element, 'background-color'));
          
          // Skip if transparent background
          if (background === 'rgba(0, 0, 0, 0)' || background === 'transparent') return;
          
          try {
            const ratio = calculateContrastRatio(foreground, background);
            const passes = ratio >= minRatio;
            
            results.push({
              element: `${element.tagName.toLowerCase()}:nth-child(${index + 1})`,
              foreground,
              background,
              ratio,
              passes,
              level
            });
          } catch (error) {
            // Skip elements with invalid color values
          }
        });
        
        return results;
      },
      { minRatio, level }
    );
    
    return results;
  }

  /**
   * Test keyboard navigation flow
   */
  async testKeyboardNavigation(): Promise<{
    focusableElements: number;
    tabOrder: string[];
    trapViolations: string[];
  }> {
    // Reset focus to start
    await this.page.evaluate(() => {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement) {
        activeElement.blur();
      }
    });
    
    const tabOrder: string[] = [];
    const trapViolations: string[] = [];
    
    // Get all focusable elements
    const focusableCount = await this.page.evaluate(() => {
      const focusable = document.querySelectorAll(
        'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      return focusable.length;
    });
    
    // Tab through all elements
    for (let i = 0; i < focusableCount + 2; i++) {
      await this.page.keyboard.press('Tab');
      
      const focusedElement = await this.page.evaluate(() => {
        const active = document.activeElement;
        if (!active || active === document.body) return null;
        
        const selector = active.tagName.toLowerCase() + 
          (active.id ? `#${active.id}` : '') +
          (active.className ? `.${active.className.replace(/\s+/g, '.')}` : '');
        
        return {
          selector,
          tag: active.tagName,
          text: active.textContent?.trim().slice(0, 30) || '',
          visible: active.getBoundingClientRect().width > 0
        };
      });
      
      if (focusedElement) {
        tabOrder.push(focusedElement.selector);
        
        // Check if element is visible
        if (!focusedElement.visible) {
          trapViolations.push(`Hidden element in tab order: ${focusedElement.selector}`);
        }
      }
    }
    
    return {
      focusableElements: focusableCount,
      tabOrder,
      trapViolations
    };
  }

  /**
   * Test focus management in modals and overlays
   */
  async testFocusTrap(containerSelector: string): Promise<{
    trapped: boolean;
    escapeWorks: boolean;
    initialFocus: boolean;
  }> {
    const container = this.page.locator(containerSelector);
    
    // Check if container exists
    if (!await container.isVisible()) {
      throw new Error(`Focus trap container not found: ${containerSelector}`);
    }
    
    // Check initial focus
    await this.page.waitForTimeout(100);
    const initialFocus = await this.page.evaluate((selector) => {
      const container = document.querySelector(selector);
      const activeElement = document.activeElement;
      return container?.contains(activeElement) || false;
    }, containerSelector);
    
    // Test Tab navigation within container
    const focusedElements: string[] = [];
    
    for (let i = 0; i < 10; i++) {
      await this.page.keyboard.press('Tab');
      
      const currentFocus = await this.page.evaluate((selector) => {
        const container = document.querySelector(selector);
        const activeElement = document.activeElement;
        
        return {
          withinContainer: container?.contains(activeElement) || false,
          elementTag: activeElement?.tagName || 'none'
        };
      }, containerSelector);
      
      focusedElements.push(currentFocus.elementTag);
      
      // If focus escapes container, trap failed
      if (!currentFocus.withinContainer) {
        break;
      }
    }
    
    const trapped = focusedElements.every((_, index) => {
      if (index === 0) return true;
      return focusedElements[index] !== 'BODY';
    });
    
    // Test Escape key
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(200);
    
    const escapeWorks = !await container.isVisible();
    
    return {
      trapped,
      escapeWorks,
      initialFocus
    };
  }

  /**
   * Validate ARIA labels and roles
   */
  async validateARIA(): Promise<{
    missingLabels: string[];
    invalidRoles: string[];
    missingDescriptions: string[];
  }> {
    return this.page.evaluate(() => {
      const missingLabels: string[] = [];
      const invalidRoles: string[] = [];
      const missingDescriptions: string[] = [];
      
      // Valid ARIA roles
      const validRoles = [
        'alert', 'alertdialog', 'application', 'article', 'banner', 'button',
        'cell', 'checkbox', 'columnheader', 'combobox', 'complementary',
        'contentinfo', 'definition', 'dialog', 'directory', 'document',
        'feed', 'figure', 'form', 'grid', 'gridcell', 'group', 'heading',
        'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main',
        'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox',
        'menuitemradio', 'navigation', 'none', 'note', 'option', 'presentation',
        'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup',
        'rowheader', 'scrollbar', 'search', 'searchbox', 'separator',
        'slider', 'spinbutton', 'status', 'switch', 'tab', 'table',
        'tablist', 'tabpanel', 'term', 'textbox', 'timer', 'toolbar',
        'tooltip', 'tree', 'treegrid', 'treeitem'
      ];
      
      // Check for elements that need labels
      const elementsNeedingLabels = document.querySelectorAll(
        'input:not([type="hidden"]), button:not([aria-label]):not([aria-labelledby]), select, textarea'
      );
      
      elementsNeedingLabels.forEach((element, index) => {
        const hasLabel = element.getAttribute('aria-label') ||
                        element.getAttribute('aria-labelledby') ||
                        document.querySelector(`label[for="${element.id}"]`) ||
                        element.closest('label');
        
        if (!hasLabel) {
          missingLabels.push(`${element.tagName.toLowerCase()}:nth-child(${index + 1})`);
        }
      });
      
      // Check for invalid roles
      const elementsWithRoles = document.querySelectorAll('[role]');
      elementsWithRoles.forEach((element, index) => {
        const role = element.getAttribute('role');
        if (role && !validRoles.includes(role)) {
          invalidRoles.push(`${element.tagName.toLowerCase()}[role="${role}"]:nth-child(${index + 1})`);
        }
      });
      
      // Check for complex elements that should have descriptions
      const complexElements = document.querySelectorAll(
        '[role="img"], [role="figure"], canvas, svg, [data-complex]'
      );
      
      complexElements.forEach((element, index) => {
        const hasDescription = element.getAttribute('aria-describedby') ||
                              element.getAttribute('aria-description') ||
                              element.querySelector('title');
        
        if (!hasDescription) {
          missingDescriptions.push(`${element.tagName.toLowerCase()}:nth-child(${index + 1})`);
        }
      });
      
      return {
        missingLabels,
        invalidRoles,
        missingDescriptions
      };
    });
  }

  /**
   * Test screen reader announcements
   */
  async testScreenReaderAnnouncements(
    actions: Array<{ action: string; expectedAnnouncement?: string }>
  ): Promise<{ announcements: string[]; matches: boolean[] }> {
    const announcements: string[] = [];
    const matches: boolean[] = [];
    
    // Listen for aria-live announcements
    await this.page.evaluate(() => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            const target = mutation.target as Element;
            const ariaLive = target.getAttribute?.('aria-live') || 
                           target.closest?.('[aria-live]')?.getAttribute('aria-live');
            
            if (ariaLive) {
              const announcement = target.textContent?.trim();
              if (announcement) {
                (window as any).lastAnnouncement = announcement;
              }
            }
          }
        });
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
      
      (window as any).ariaObserver = observer;
    });
    
    for (const { action, expectedAnnouncement } of actions) {
      // Perform action (this would be defined by the test)
      await this.page.evaluate((actionName) => {
        // Trigger the action based on action name
        const button = document.querySelector(`[data-action="${actionName}"]`);
        if (button) {
          (button as HTMLElement).click();
        }
      }, action);
      
      // Wait for announcement
      await this.page.waitForTimeout(500);
      
      const announcement = await this.page.evaluate(() => {
        return (window as any).lastAnnouncement || '';
      });
      
      announcements.push(announcement);
      
      if (expectedAnnouncement) {
        matches.push(announcement.includes(expectedAnnouncement));
      }
    }
    
    // Cleanup
    await this.page.evaluate(() => {
      if ((window as any).ariaObserver) {
        (window as any).ariaObserver.disconnect();
      }
    });
    
    return { announcements, matches };
  }

  /**
   * Test reduced motion preferences
   */
  async testReducedMotion(): Promise<{
    respectsPreference: boolean;
    animationsFound: number;
    animationsDisabled: number;
  }> {
    // Enable reduced motion preference
    await this.page.emulateMedia({ reducedMotion: 'reduce' });
    
    const result = await this.page.evaluate(() => {
      const animatedElements = document.querySelectorAll(
        '[style*="animation"], [style*="transition"], .animate, .transition'
      );
      
      let animationsDisabled = 0;
      
      animatedElements.forEach(element => {
        const styles = window.getComputedStyle(element);
        const animationDuration = styles.getPropertyValue('animation-duration');
        const transitionDuration = styles.getPropertyValue('transition-duration');
        
        if (animationDuration === '0s' || transitionDuration === '0s') {
          animationsDisabled++;
        }
      });
      
      return {
        animationsFound: animatedElements.length,
        animationsDisabled,
        respectsPreference: animationsDisabled === animatedElements.length
      };
    });
    
    return result;
  }

  /**
   * Generate accessibility report
   */
  async generateAccessibilityReport(): Promise<{
    score: number;
    violations: AccessibilityViolation[];
    touchTargets: { passed: TouchTargetResult[]; failed: TouchTargetResult[] };
    colorContrast: ColorContrastResult[];
    keyboardNavigation: any;
    ariaValidation: any;
  }> {
    await this.initialize();
    
    const violations = await this.runAccessibilityAudit();
    const touchTargets = await this.validateTouchTargets();
    const colorContrast = await this.validateColorContrast();
    const keyboardNavigation = await this.testKeyboardNavigation();
    const ariaValidation = await this.validateARIA();
    
    // Calculate overall score
    const totalIssues = violations.length + 
                       touchTargets.failed.length + 
                       colorContrast.filter(c => !c.passes).length +
                       keyboardNavigation.trapViolations.length +
                       ariaValidation.missingLabels.length +
                       ariaValidation.invalidRoles.length;
    
    const score = Math.max(0, 100 - (totalIssues * 5));
    
    return {
      score,
      violations,
      touchTargets,
      colorContrast,
      keyboardNavigation,
      ariaValidation
    };
  }
}
