import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Enhanced test utilities for better component testing

/**
 * Custom render function that includes common providers
 */
export function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  // Add any providers here in the future (Theme, Context, etc.)
  const Wrapper = ({ children }: { children: ReactNode }) => {
    return React.createElement(React.Fragment, null, children);
  };

  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...options })
  };
}

/**
 * Performance testing utilities
 */
export class PerformanceTester {
  private measurements: Record<string, number[]> = {};

  startMeasurement(name: string): () => number {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      if (!this.measurements[name]) {
        this.measurements[name] = [];
      }
      this.measurements[name].push(duration);
      return duration;
    };
  }

  getAverageTime(name: string): number {
    const times = this.measurements[name] || [];
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  getStats(name: string) {
    const times = this.measurements[name] || [];
    if (times.length === 0) return null;

    const sorted = [...times].sort((a, b) => a - b);
    return {
      count: times.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      average: this.getAverageTime(name),
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  reset() {
    this.measurements = {};
  }
}

/**
 * Accessibility testing helpers
 */
export const AccessibilityTester = {
  /**
   * Test keyboard navigation
   */
  async testKeyboardNavigation(container: HTMLElement) {
    const user = userEvent.setup();
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const results = {
      totalFocusable: focusableElements.length,
      canFocusAll: true,
      tabOrder: [] as string[],
      issues: [] as string[]
    };

    // Test each focusable element
    for (let i = 0; i < focusableElements.length; i++) {
      const element = focusableElements[i] as HTMLElement;
      try {
        element.focus();
        if (document.activeElement === element) {
          results.tabOrder.push(element.tagName.toLowerCase() + (element.id ? `#${element.id}` : ''));
        } else {
          results.canFocusAll = false;
          results.issues.push(`Element ${i} (${element.tagName}) cannot receive focus`);
        }
      } catch (error) {
        results.canFocusAll = false;
        results.issues.push(`Error focusing element ${i}: ${error}`);
      }
    }

    // Test tab navigation
    try {
      if (focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus();
        
        for (let i = 1; i < focusableElements.length; i++) {
          await user.keyboard('{Tab}');
          if (document.activeElement !== focusableElements[i]) {
            results.issues.push(`Tab order issue at element ${i}`);
          }
        }
      }
    } catch (error) {
      results.issues.push(`Tab navigation error: ${error}`);
    }

    return results;
  },

  /**
   * Check for proper ARIA attributes
   */
  checkAriaAttributes(container: HTMLElement) {
    const issues: string[] = [];
    
    // Check for buttons without accessible names
    const buttons = container.querySelectorAll('button');
    buttons.forEach((button, index) => {
      const hasText = button.textContent?.trim();
      const hasAriaLabel = button.getAttribute('aria-label');
      const hasAriaLabelledby = button.getAttribute('aria-labelledby');
      
      if (!hasText && !hasAriaLabel && !hasAriaLabelledby) {
        issues.push(`Button ${index} lacks accessible name`);
      }
    });

    // Check for form inputs without labels
    const inputs = container.querySelectorAll('input, textarea, select');
    inputs.forEach((input, index) => {
      const id = input.getAttribute('id');
      const hasLabel = id && container.querySelector(`label[for="${id}"]`);
      const hasAriaLabel = input.getAttribute('aria-label');
      const hasAriaLabelledby = input.getAttribute('aria-labelledby');
      
      if (!hasLabel && !hasAriaLabel && !hasAriaLabelledby) {
        issues.push(`Input ${index} (${input.tagName}) lacks proper labeling`);
      }
    });

    // Check for proper heading structure
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const headingLevels = Array.from(headings).map(h => parseInt(h.tagName[1]));
    
    for (let i = 1; i < headingLevels.length; i++) {
      if (headingLevels[i] - headingLevels[i - 1] > 1) {
        issues.push(`Heading level jumps from h${headingLevels[i - 1]} to h${headingLevels[i]}`);
      }
    }

    return {
      passed: issues.length === 0,
      issues,
      stats: {
        buttons: buttons.length,
        inputs: inputs.length,
        headings: headings.length
      }
    };
  },

  /**
   * Test color contrast (basic check)
   */
  checkColorContrast(element: HTMLElement) {
    const style = window.getComputedStyle(element);
    const color = style.color;
    const backgroundColor = style.backgroundColor;
    
    // This is a simplified contrast check
    // In a real implementation, you'd calculate the actual contrast ratio
    const hasTransparency = backgroundColor === 'rgba(0, 0, 0, 0)' || 
                           backgroundColor === 'transparent' || 
                           backgroundColor === '';
    
    return {
      foreground: color,
      background: backgroundColor,
      hasTransparency,
      needsManualCheck: hasTransparency || !color || !backgroundColor
    };
  }
};

/**
 * Visual testing utilities
 */
export const VisualTester = {
  /**
   * Capture element dimensions and styling
   */
  captureElementMetrics(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    
    return {
      dimensions: {
        width: rect.width,
        height: rect.height,
        x: rect.x,
        y: rect.y
      },
      styles: {
        display: styles.display,
        position: styles.position,
        visibility: styles.visibility,
        opacity: styles.opacity,
        zIndex: styles.zIndex
      },
      isVisible: rect.width > 0 && rect.height > 0 && styles.visibility !== 'hidden'
    };
  },

  /**
   * Test responsive behavior
   */
  async testResponsiveBreakpoints(container: HTMLElement, breakpoints: number[]) {
    const results: Array<{
      width: number;
      elements: Array<{
        selector: string;
        metrics: ReturnType<typeof VisualTester.captureElementMetrics>;
      }>;
    }> = [];

    for (const breakpoint of breakpoints) {
      // Simulate viewport resize
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: breakpoint
      });
      
      window.dispatchEvent(new Event('resize'));
      
      // Wait for any resize handlers
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const elements = container.querySelectorAll('*');
      const elementMetrics = Array.from(elements).map(el => ({
        selector: el.tagName.toLowerCase() + (el.className ? `.${el.className.split(' ')[0]}` : ''),
        metrics: this.captureElementMetrics(el as HTMLElement)
      }));
      
      results.push({
        width: breakpoint,
        elements: elementMetrics
      });
    }
    
    return results;
  }
};

/**
 * Form testing utilities
 */
export const FormTester = {
  /**
   * Fill form with test data
   */
  async fillForm(user: ReturnType<typeof userEvent.setup>, formData: Record<string, any>) {
    for (const [fieldName, value] of Object.entries(formData)) {
      const field = document.querySelector(`[name="${fieldName}"], #${fieldName}`) as HTMLElement;
      
      if (!field) continue;
      
      if (field.tagName === 'INPUT') {
        const input = field as HTMLInputElement;
        
        switch (input.type) {
          case 'checkbox':
          case 'radio':
            if (value) {
              await user.click(input);
            }
            break;
          case 'file':
            // File upload testing would need special handling
            break;
          default:
            await user.clear(input);
            await user.type(input, String(value));
        }
      } else if (field.tagName === 'TEXTAREA') {
        await user.clear(field);
        await user.type(field, String(value));
      } else if (field.tagName === 'SELECT') {
        await user.selectOptions(field, String(value));
      }
    }
  },

  /**
   * Test form validation
   */
  async testFormValidation(user: ReturnType<typeof userEvent.setup>, form: HTMLFormElement) {
    const results = {
      requiredFields: [] as string[],
      validationMessages: [] as string[],
      canSubmitEmpty: false,
      canSubmitInvalid: false
    };

    // Find required fields
    const requiredFields = form.querySelectorAll('[required]');
    results.requiredFields = Array.from(requiredFields).map(field => 
      field.getAttribute('name') || field.getAttribute('id') || field.tagName
    );

    // Try to submit empty form
    try {
      await user.click(form.querySelector('[type="submit"]') || form.querySelector('button[type="submit"]')!);
      results.canSubmitEmpty = true;
    } catch (error) {
      // Form validation prevented submission
    }

    // Check for validation messages
    const validationMessages = form.querySelectorAll('[role="alert"], .error, .invalid');
    results.validationMessages = Array.from(validationMessages).map(el => el.textContent || '');

    return results;
  }
};

/**
 * Mock data generators
 */
export const MockDataGenerator = {
  kbEntry: (overrides: Partial<any> = {}) => ({
    id: 'mock-entry-' + Math.random().toString(36).substr(2, 9),
    title: 'Mock KB Entry Title',
    problem: 'This is a mock problem description that meets the minimum length requirements for testing purposes.',
    solution: 'This is a mock solution description that provides step-by-step instructions for resolving the problem.',
    category: 'VSAM',
    tags: ['mock', 'test', 'automation'],
    created_at: new Date(),
    updated_at: new Date(),
    usage_count: 0,
    success_count: 0,
    failure_count: 0,
    ...overrides
  }),

  formData: (overrides: Partial<any> = {}) => ({
    title: 'Test Form Entry',
    problem: 'Test problem description that is long enough to meet validation requirements',
    solution: 'Test solution description that provides adequate detail for resolution',
    category: 'JCL',
    tags: ['test', 'form', 'validation'],
    ...overrides
  }),

  searchResults: (count: number = 3) => {
    return Array.from({ length: count }, (_, i) => ({
      entry: MockDataGenerator.kbEntry({
        title: `Search Result ${i + 1}`,
        problem: `Problem description for result ${i + 1}`,
        solution: `Solution description for result ${i + 1}`
      }),
      score: 100 - (i * 10),
      matchType: 'fuzzy' as const
    }));
  }
};

// Re-export everything for convenience
export * from '@testing-library/react';
export { userEvent };