// Accessibility Utilities for the Component Library
// Provides comprehensive accessibility features and testing support

let idCounter = 0;

/**
 * Announce loading state to screen readers
 */
export function announceLoading(message: string = 'Loading content...') {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Accessibility utility class with comprehensive helpers
 */
export class AriaUtils {
  /**
   * Generate unique IDs for accessibility attributes
   */
  static generateId(prefix: string = 'element'): string {
    idCounter += 1;
    return `${prefix}-${idCounter}`;
  }

  /**
   * Create describedby element for screen readers
   */
  static createDescription(element: HTMLElement, description: string): string {
    const descriptionId = this.generateId('desc');
    const descriptionElement = document.createElement('div');

    descriptionElement.id = descriptionId;
    descriptionElement.className = 'sr-only';
    descriptionElement.textContent = description;

    element.appendChild(descriptionElement);

    const existingDescribedBy = element.getAttribute('aria-describedby');
    const newDescribedBy = existingDescribedBy
      ? `${existingDescribedBy} ${descriptionId}`
      : descriptionId;

    element.setAttribute('aria-describedby', newDescribedBy);

    return descriptionId;
  }

  /**
   * Manage focus trap for modals and dialogs
   */
  static createFocusTrap(container: HTMLElement): {
    activate: () => void;
    deactivate: () => void;
  } {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input[type="text"]:not([disabled])',
      'input[type="radio"]:not([disabled])',
      'input[type="checkbox"]:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    let previouslyFocused: HTMLElement | null = null;

    const activate = () => {
      previouslyFocused = document.activeElement as HTMLElement;

      const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelectors);
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      if (firstFocusable) {
        firstFocusable.focus();
      }

      const handleTabKey = (event: KeyboardEvent) => {
        if (event.key !== 'Tab') return;

        if (event.shiftKey) {
          if (document.activeElement === firstFocusable) {
            event.preventDefault();
            lastFocusable?.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            event.preventDefault();
            firstFocusable?.focus();
          }
        }
      };

      container.addEventListener('keydown', handleTabKey);

      return () => {
        container.removeEventListener('keydown', handleTabKey);
      };
    };

    const deactivate = () => {
      if (previouslyFocused) {
        previouslyFocused.focus();
      }
    };

    return { activate, deactivate };
  }

  /**
   * Check if element is visible to screen readers
   */
  static isAccessible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);

    return !(
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      element.hasAttribute('hidden') ||
      element.getAttribute('aria-hidden') === 'true'
    );
  }

  /**
   * Get accessible name for an element
   */
  static getAccessibleName(element: HTMLElement): string {
    // Check aria-label first
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // Check aria-labelledby
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) return labelElement.textContent || '';
    }

    // Check associated label
    if (element instanceof HTMLInputElement) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label.textContent || '';
    }

    // Check text content
    return element.textContent || '';
  }

  /**
   * Validate ARIA attributes
   */
  static validateAria(element: HTMLElement): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for invalid ARIA attributes
    const ariaAttributes = Array.from(element.attributes).filter(attr =>
      attr.name.startsWith('aria-')
    );

    ariaAttributes.forEach(attr => {
      // Check if it's a valid ARIA attribute
      const validAriaAttributes = [
        'aria-label',
        'aria-labelledby',
        'aria-describedby',
        'aria-hidden',
        'aria-expanded',
        'aria-selected',
        'aria-checked',
        'aria-disabled',
        'aria-required',
        'aria-invalid',
        'aria-busy',
        'aria-live',
        'aria-atomic',
        'aria-relevant',
        'aria-current',
        'aria-level',
        'aria-setsize',
        'aria-posinset',
        'aria-owns',
        'aria-controls',
        'aria-haspopup',
        'aria-orientation',
        'aria-valuemin',
        'aria-valuemax',
        'aria-valuenow',
        'aria-valuetext',
        'aria-multiline',
        'aria-readonly',
        'aria-sort',
        'aria-rowcount',
        'aria-rowindex',
        'aria-colcount',
        'aria-colindex',
      ];

      if (!validAriaAttributes.includes(attr.name)) {
        errors.push(`Invalid ARIA attribute: ${attr.name}`);
      }
    });

    // Check for required ARIA attributes based on role
    const role = element.getAttribute('role');
    if (role) {
      switch (role) {
        case 'button':
          if (!this.getAccessibleName(element)) {
            errors.push('Button elements must have an accessible name');
          }
          break;
        case 'textbox':
        case 'input':
          if (!element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) {
            warnings.push('Input elements should have labels');
          }
          break;
        case 'dialog':
          if (!element.getAttribute('aria-labelledby') && !element.getAttribute('aria-label')) {
            errors.push('Dialog must have an accessible name');
          }
          break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

/**
 * Announce messages to screen readers
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove the announcement after it's been read
  setTimeout(() => {
    if (announcement.parentNode) {
      document.body.removeChild(announcement);
    }
  }, 1000);
}

/**
 * Check for keyboard navigation support
 */
export function isKeyboardNavigable(element: HTMLElement): boolean {
  const tabIndex = element.tabIndex;
  const tagName = element.tagName.toLowerCase();

  // Elements that are naturally focusable
  const naturallyFocusable = ['a', 'button', 'input', 'select', 'textarea'];

  return (
    tabIndex >= 0 || naturallyFocusable.includes(tagName) || element.hasAttribute('contenteditable')
  );
}

/**
 * Add keyboard navigation support to elements
 */
export function makeKeyboardNavigable(
  element: HTMLElement,
  options: {
    onClick?: () => void;
    onEnter?: () => void;
    onSpace?: () => void;
    role?: string;
  } = {}
): void {
  // Make element focusable
  if (element.tabIndex < 0) {
    element.tabIndex = 0;
  }

  // Add appropriate role
  if (options.role && !element.getAttribute('role')) {
    element.setAttribute('role', options.role);
  }

  // Add keyboard event handlers
  element.addEventListener('keydown', event => {
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        if (options.onEnter) {
          options.onEnter();
        } else if (options.onClick) {
          options.onClick();
        }
        break;
      case ' ':
        event.preventDefault();
        if (options.onSpace) {
          options.onSpace();
        } else if (options.onClick) {
          options.onClick();
        }
        break;
    }
  });

  // Add click handler if provided
  if (options.onClick) {
    element.addEventListener('click', options.onClick);
  }
}

/**
 * Color contrast checker
 */
export function checkColorContrast(
  foregroundColor: string,
  backgroundColor: string,
  level: 'AA' | 'AAA' = 'AA'
): {
  ratio: number;
  passes: boolean;
  level: 'AA' | 'AAA';
} {
  // Convert colors to RGB values
  const getRgbValues = (color: string): [number, number, number] => {
    // This is a simplified implementation
    // In a real implementation, you'd want to handle various color formats
    const rgb = color.match(/\d+/g);
    if (!rgb || rgb.length < 3) return [0, 0, 0];
    return [parseInt(rgb[0]), parseInt(rgb[1]), parseInt(rgb[2])];
  };

  const getLuminance = (r: number, g: number, b: number): number => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const fg = getRgbValues(foregroundColor);
  const bg = getRgbValues(backgroundColor);

  const fgLuminance = getLuminance(fg[0], fg[1], fg[2]);
  const bgLuminance = getLuminance(bg[0], bg[1], bg[2]);

  const ratio =
    (Math.max(fgLuminance, bgLuminance) + 0.05) / (Math.min(fgLuminance, bgLuminance) + 0.05);

  const minRatio = level === 'AAA' ? 7 : 4.5;

  return {
    ratio,
    passes: ratio >= minRatio,
    level,
  };
}

/**
 * Accessibility testing utilities
 */
export class AccessibilityTester {
  /**
   * Run comprehensive accessibility audit on an element
   */
  static audit(element: HTMLElement): {
    errors: Array<{ type: string; message: string; element: HTMLElement }>;
    warnings: Array<{ type: string; message: string; element: HTMLElement }>;
    score: number;
  } {
    const errors: Array<{ type: string; message: string; element: HTMLElement }> = [];
    const warnings: Array<{ type: string; message: string; element: HTMLElement }> = [];

    // Check all elements within the container
    const allElements = [element, ...element.querySelectorAll('*')] as HTMLElement[];

    allElements.forEach(el => {
      // Check for missing alt text on images
      if (el.tagName.toLowerCase() === 'img' && !el.getAttribute('alt')) {
        errors.push({
          type: 'missing-alt',
          message: 'Image missing alt text',
          element: el,
        });
      }

      // Check for missing labels on inputs
      if (['input', 'select', 'textarea'].includes(el.tagName.toLowerCase())) {
        const input = el as HTMLInputElement;
        if (input.type !== 'hidden' && !AriaUtils.getAccessibleName(el)) {
          errors.push({
            type: 'missing-label',
            message: 'Form control missing accessible name',
            element: el,
          });
        }
      }

      // Check for buttons without accessible names
      if (el.tagName.toLowerCase() === 'button' && !AriaUtils.getAccessibleName(el)) {
        errors.push({
          type: 'missing-button-name',
          message: 'Button missing accessible name',
          element: el,
        });
      }

      // Check ARIA usage
      const ariaValidation = AriaUtils.validateAria(el);
      ariaValidation.errors.forEach(error => {
        errors.push({
          type: 'aria-error',
          message: error,
          element: el,
        });
      });
      ariaValidation.warnings.forEach(warning => {
        warnings.push({
          type: 'aria-warning',
          message: warning,
          element: el,
        });
      });

      // Check keyboard navigation
      if (el.onclick && !isKeyboardNavigable(el)) {
        warnings.push({
          type: 'keyboard-navigation',
          message: 'Interactive element not keyboard navigable',
          element: el,
        });
      }
    });

    // Calculate accessibility score
    const totalChecks = allElements.length * 4; // 4 checks per element
    const issueWeight = errors.length * 2 + warnings.length;
    const score = Math.max(0, 100 - (issueWeight / totalChecks) * 100);

    return { errors, warnings, score };
  }

  /**
   * Generate accessibility report
   */
  static generateReport(element: HTMLElement): string {
    const audit = this.audit(element);

    let report = '# Accessibility Report\n\n';
    report += `## Overall Score: ${audit.score.toFixed(1)}/100\n\n`;

    if (audit.errors.length > 0) {
      report += '## Errors\n\n';
      audit.errors.forEach((error, index) => {
        report += `${index + 1}. **${error.type}**: ${error.message}\n`;
        report += `   Element: ${error.element.tagName.toLowerCase()}`;
        if (error.element.id) report += `#${error.element.id}`;
        if (error.element.className) report += `.${error.element.className}`;
        report += '\n\n';
      });
    }

    if (audit.warnings.length > 0) {
      report += '## Warnings\n\n';
      audit.warnings.forEach((warning, index) => {
        report += `${index + 1}. **${warning.type}**: ${warning.message}\n`;
        report += `   Element: ${warning.element.tagName.toLowerCase()}`;
        if (warning.element.id) report += `#${warning.element.id}`;
        if (warning.element.className) report += `.${warning.element.className}`;
        report += '\n\n';
      });
    }

    return report;
  }
}

/**
 * Live region manager for dynamic content
 */
export class LiveRegionManager {
  private static instance: LiveRegionManager;
  private politeRegion: HTMLElement;
  private assertiveRegion: HTMLElement;

  private constructor() {
    // Create polite live region
    this.politeRegion = document.createElement('div');
    this.politeRegion.setAttribute('aria-live', 'polite');
    this.politeRegion.setAttribute('aria-atomic', 'true');
    this.politeRegion.className = 'sr-only';
    this.politeRegion.id = 'live-region-polite';

    // Create assertive live region
    this.assertiveRegion = document.createElement('div');
    this.assertiveRegion.setAttribute('aria-live', 'assertive');
    this.assertiveRegion.setAttribute('aria-atomic', 'true');
    this.assertiveRegion.className = 'sr-only';
    this.assertiveRegion.id = 'live-region-assertive';

    document.body.appendChild(this.politeRegion);
    document.body.appendChild(this.assertiveRegion);
  }

  static getInstance(): LiveRegionManager {
    if (!this.instance) {
      this.instance = new LiveRegionManager();
    }
    return this.instance;
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const region = priority === 'polite' ? this.politeRegion : this.assertiveRegion;

    region.textContent = message;

    // Clear the message after announcement
    setTimeout(() => {
      region.textContent = '';
    }, 1000);
  }
}

/**
 * Focus management utilities
 */
export class FocusManager {
  private static focusStack: HTMLElement[] = [];

  /**
   * Save current focus and set new focus
   */
  static save(newFocus?: HTMLElement): void {
    const currentFocus = document.activeElement as HTMLElement;
    if (currentFocus) {
      this.focusStack.push(currentFocus);
    }

    if (newFocus) {
      newFocus.focus();
    }
  }

  /**
   * Restore previous focus
   */
  static restore(): void {
    const previousFocus = this.focusStack.pop();
    if (previousFocus) {
      previousFocus.focus();
    }
  }

  /**
   * Clear focus stack
   */
  static clear(): void {
    this.focusStack = [];
  }
}

// Initialize live region manager on module load
if (typeof window !== 'undefined') {
  LiveRegionManager.getInstance();
}
