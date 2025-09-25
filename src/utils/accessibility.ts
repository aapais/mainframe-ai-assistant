/**
 * Accessibility Utilities
 *
 * WCAG 2.1 AA compliant utilities for:
 * - Screen reader announcements
 * - Focus management
 * - Keyboard navigation
 * - Color contrast validation
 * - Accessible component helpers
 *
 * @author Frontend Team
 * @version 1.0.0
 */

import { useEffect, useRef, useCallback } from 'react';

// ========================
// ARIA Live Region Manager
// ========================

export interface LiveRegionOptions {
  priority?: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
  relevant?: 'additions' | 'removals' | 'text' | 'all';
  busy?: boolean;
}

class LiveRegionManager {
  private regions = new Map<string, HTMLElement>();

  createRegion(id: string, options: LiveRegionOptions = {}): HTMLElement {
    if (this.regions.has(id)) {
      return this.regions.get(id)!;
    }

    const {
      priority = 'polite',
      atomic = false,
      relevant = 'additions text',
      busy = false,
    } = options;

    const region = document.createElement('div');
    region.id = id;
    region.setAttribute('aria-live', priority);
    region.setAttribute('aria-atomic', atomic.toString());
    region.setAttribute('aria-relevant', relevant);
    region.setAttribute('aria-busy', busy.toString());
    region.className = 'sr-only'; // Screen reader only
    region.style.cssText = `
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    `;

    document.body.appendChild(region);
    this.regions.set(id, region);

    return region;
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const regionId = `live-region-${priority}`;
    let region = this.regions.get(regionId);

    if (!region) {
      region = this.createRegion(regionId, { priority });
    }

    // Clear previous content
    region.textContent = '';

    // Add new message after a brief delay to ensure screen readers pick it up
    setTimeout(() => {
      region!.textContent = message;
    }, 100);

    // Clear after announcement to prevent re-reading
    setTimeout(() => {
      region!.textContent = '';
    }, 1000);
  }

  updateBusyState(regionId: string, busy: boolean): void {
    const region = this.regions.get(regionId);
    if (region) {
      region.setAttribute('aria-busy', busy.toString());
    }
  }

  removeRegion(id: string): void {
    const region = this.regions.get(id);
    if (region && region.parentNode) {
      region.parentNode.removeChild(region);
      this.regions.delete(id);
    }
  }

  cleanup(): void {
    this.regions.forEach(region => {
      if (region.parentNode) {
        region.parentNode.removeChild(region);
      }
    });
    this.regions.clear();
  }
}

export const liveRegionManager = new LiveRegionManager();

// ========================
// Focus Management
// ========================

export interface FocusOptions {
  preventScroll?: boolean;
  select?: boolean;
}

/**
 * Focus trap for modals and dropdowns
 */
export class FocusTrap {
  private container: HTMLElement;
  private previousActiveElement: HTMLElement | null = null;
  private focusableElements: HTMLElement[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.updateFocusableElements();
  }

  activate(): void {
    this.previousActiveElement = document.activeElement as HTMLElement;
    this.updateFocusableElements();

    // Focus first element
    if (this.focusableElements.length > 0) {
      this.focusableElements[0].focus();
    }

    // Add event listeners
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('focusin', this.handleFocusIn);
  }

  deactivate(): void {
    // Remove event listeners
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('focusin', this.handleFocusIn);

    // Restore focus
    if (this.previousActiveElement) {
      this.previousActiveElement.focus();
    }
  }

  private updateFocusableElements(): void {
    const selector = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"]):not([disabled])',
      '[contenteditable]:not([contenteditable="false"])',
    ].join(', ');

    this.focusableElements = Array.from(this.container.querySelectorAll(selector)).filter(el =>
      this.isVisible(el)
    ) as HTMLElement[];
  }

  private isVisible(element: HTMLElement): boolean {
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return;

    this.updateFocusableElements();

    if (this.focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const firstElement = this.focusableElements[0];
    const lastElement = this.focusableElements[this.focusableElements.length - 1];

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  };

  private handleFocusIn = (event: FocusEvent): void => {
    if (!this.container.contains(event.target as Node)) {
      event.preventDefault();
      if (this.focusableElements.length > 0) {
        this.focusableElements[0].focus();
      }
    }
  };
}

/**
 * Focus management utilities
 */
export function focusElement(element: HTMLElement | null, options: FocusOptions = {}): boolean {
  if (!element) return false;

  try {
    element.focus({
      preventScroll: options.preventScroll,
    });

    // Select text if it's an input and select option is true
    if (options.select && element instanceof HTMLInputElement) {
      element.select();
    }

    return document.activeElement === element;
  } catch (error) {
    console.warn('Failed to focus element:', error);
    return false;
  }
}

export function getFocusableElements(container: HTMLElement = document.body): HTMLElement[] {
  const selector = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"]):not([disabled])',
    '[contenteditable]:not([contenteditable="false"])',
  ].join(', ');

  return Array.from(container.querySelectorAll(selector)).filter((el): el is HTMLElement => {
    const element = el as HTMLElement;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  });
}

// ========================
// Color Contrast Utilities
// ========================

export interface ColorContrastRatio {
  ratio: number;
  level: 'AAA' | 'AA' | 'A' | 'FAIL';
  isLarge: boolean;
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate relative luminance
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) {
    throw new Error('Invalid hex color format');
  }

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Check if color combination meets WCAG requirements
 */
export function checkColorContrast(
  foreground: string,
  background: string,
  isLarge: boolean = false
): ColorContrastRatio {
  const ratio = getContrastRatio(foreground, background);

  let level: ColorContrastRatio['level'];

  if (isLarge) {
    if (ratio >= 4.5) level = 'AAA';
    else if (ratio >= 3) level = 'AA';
    else if (ratio >= 2.5) level = 'A';
    else level = 'FAIL';
  } else {
    if (ratio >= 7) level = 'AAA';
    else if (ratio >= 4.5) level = 'AA';
    else if (ratio >= 3) level = 'A';
    else level = 'FAIL';
  }

  return { ratio, level, isLarge };
}

// ========================
// Keyboard Navigation
// ========================

export interface KeyboardNavigationOptions {
  selector?: string;
  wrap?: boolean;
  includeDisabled?: boolean;
  onNavigate?: (element: HTMLElement, index: number) => void;
}

export class KeyboardNavigator {
  private container: HTMLElement;
  private elements: HTMLElement[] = [];
  private currentIndex = -1;
  private options: Required<KeyboardNavigationOptions>;

  constructor(container: HTMLElement, options: KeyboardNavigationOptions = {}) {
    this.container = container;
    this.options = {
      selector:
        '[data-keyboard-nav], button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      wrap: true,
      includeDisabled: false,
      onNavigate: () => {},
      ...options,
    };

    this.updateElements();
  }

  updateElements(): void {
    this.elements = Array.from(this.container.querySelectorAll(this.options.selector)).filter(
      (el): el is HTMLElement => {
        const element = el as HTMLElement;

        // Check if disabled
        if (!this.options.includeDisabled && element.hasAttribute('disabled')) {
          return false;
        }

        // Check visibility
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }
    );

    // Reset current index if out of bounds
    if (this.currentIndex >= this.elements.length) {
      this.currentIndex = -1;
    }
  }

  navigate(
    direction: 'next' | 'prev' | 'first' | 'last',
    focus: boolean = true
  ): HTMLElement | null {
    this.updateElements();

    if (this.elements.length === 0) return null;

    let newIndex: number;

    switch (direction) {
      case 'next':
        newIndex = this.currentIndex + 1;
        if (newIndex >= this.elements.length) {
          newIndex = this.options.wrap ? 0 : this.elements.length - 1;
        }
        break;

      case 'prev':
        newIndex = this.currentIndex - 1;
        if (newIndex < 0) {
          newIndex = this.options.wrap ? this.elements.length - 1 : 0;
        }
        break;

      case 'first':
        newIndex = 0;
        break;

      case 'last':
        newIndex = this.elements.length - 1;
        break;

      default:
        return null;
    }

    this.currentIndex = newIndex;
    const element = this.elements[newIndex];

    if (focus) {
      focusElement(element);
    }

    this.options.onNavigate(element, newIndex);
    return element;
  }

  getCurrentElement(): HTMLElement | null {
    return this.currentIndex >= 0 ? this.elements[this.currentIndex] : null;
  }

  setCurrentIndex(index: number): void {
    if (index >= 0 && index < this.elements.length) {
      this.currentIndex = index;
    }
  }

  findCurrentIndex(): void {
    const activeElement = document.activeElement as HTMLElement;
    this.currentIndex = this.elements.indexOf(activeElement);
  }
}

// ========================
// React Accessibility Hooks
// ========================

/**
 * Hook for managing live regions
 */
export function useLiveRegion(id?: string) {
  const regionId = id || `live-region-${Math.random().toString(36).substr(2, 9)}`;

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    liveRegionManager.announce(message, priority);
  }, []);

  useEffect(() => {
    return () => {
      if (id) {
        liveRegionManager.removeRegion(regionId);
      }
    };
  }, [regionId, id]);

  return { announce };
}

/**
 * Hook for focus management
 */
export function useFocus() {
  const elementRef = useRef<HTMLElement>(null);

  const focus = useCallback((options?: FocusOptions) => {
    return focusElement(elementRef.current, options);
  }, []);

  return { elementRef, focus };
}

/**
 * Hook for focus trap
 */
export function useFocusTrap(active: boolean = false) {
  const containerRef = useRef<HTMLElement>(null);
  const focusTrapRef = useRef<FocusTrap | null>(null);

  useEffect(() => {
    if (active && containerRef.current) {
      focusTrapRef.current = new FocusTrap(containerRef.current);
      focusTrapRef.current.activate();

      return () => {
        if (focusTrapRef.current) {
          focusTrapRef.current.deactivate();
          focusTrapRef.current = null;
        }
      };
    }
  }, [active]);

  return { containerRef };
}

/**
 * Hook for keyboard navigation
 */
export function useKeyboardNavigation(options?: KeyboardNavigationOptions) {
  const containerRef = useRef<HTMLElement>(null);
  const navigatorRef = useRef<KeyboardNavigator | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      navigatorRef.current = new KeyboardNavigator(containerRef.current, options);
    }

    return () => {
      navigatorRef.current = null;
    };
  }, [options]);

  const navigate = useCallback((direction: 'next' | 'prev' | 'first' | 'last', focus?: boolean) => {
    return navigatorRef.current?.navigate(direction, focus) || null;
  }, []);

  const updateElements = useCallback(() => {
    navigatorRef.current?.updateElements();
  }, []);

  const getCurrentElement = useCallback(() => {
    return navigatorRef.current?.getCurrentElement() || null;
  }, []);

  return {
    containerRef,
    navigate,
    updateElements,
    getCurrentElement,
  };
}

// ========================
// ARIA Helpers
// ========================

export function generateAriaId(prefix: string = 'aria'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createAriaAttributes(options: {
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  expanded?: boolean;
  hasPopup?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  selected?: boolean;
  checked?: boolean;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  busy?: boolean;
  hidden?: boolean;
  level?: number;
  posinset?: number;
  setsize?: number;
  controls?: string;
  owns?: string;
  activedescendant?: string;
  role?: string;
}) {
  const attributes: Record<string, string | undefined> = {};

  if (options.label) attributes['aria-label'] = options.label;
  if (options.labelledBy) attributes['aria-labelledby'] = options.labelledBy;
  if (options.describedBy) attributes['aria-describedby'] = options.describedBy;
  if (options.expanded !== undefined) attributes['aria-expanded'] = options.expanded.toString();
  if (options.hasPopup !== undefined) attributes['aria-haspopup'] = options.hasPopup.toString();
  if (options.selected !== undefined) attributes['aria-selected'] = options.selected.toString();
  if (options.checked !== undefined) attributes['aria-checked'] = options.checked.toString();
  if (options.disabled !== undefined) attributes['aria-disabled'] = options.disabled.toString();
  if (options.required !== undefined) attributes['aria-required'] = options.required.toString();
  if (options.invalid !== undefined) attributes['aria-invalid'] = options.invalid.toString();
  if (options.busy !== undefined) attributes['aria-busy'] = options.busy.toString();
  if (options.hidden !== undefined) attributes['aria-hidden'] = options.hidden.toString();
  if (options.level !== undefined) attributes['aria-level'] = options.level.toString();
  if (options.posinset !== undefined) attributes['aria-posinset'] = options.posinset.toString();
  if (options.setsize !== undefined) attributes['aria-setsize'] = options.setsize.toString();
  if (options.controls) attributes['aria-controls'] = options.controls;
  if (options.owns) attributes['aria-owns'] = options.owns;
  if (options.activedescendant) attributes['aria-activedescendant'] = options.activedescendant;
  if (options.role) attributes['role'] = options.role;

  return attributes;
}
