import { useRef, useEffect, useCallback } from 'react';

interface FocusTrapOptions {
  /** Whether the focus trap is active */
  isActive: boolean;
  /** Callback when escape key is pressed */
  onEscape?: () => void;
  /** Focus the first element on activation */
  autoFocus?: boolean;
  /** Selector for focusable elements (optional override) */
  focusableSelector?: string;
  /** Whether to restore focus to the element that was focused before activation */
  restoreFocus?: boolean;
}

interface AccessibleFocusReturn {
  /** Ref to attach to the container element */
  containerRef: React.RefObject<HTMLElement>;
  /** Focus the first focusable element */
  focusFirst: () => void;
  /** Focus the last focusable element */
  focusLast: () => void;
  /** Get all focusable elements */
  getFocusableElements: () => HTMLElement[];
}

/**
 * useAccessibleFocus Hook
 *
 * Provides comprehensive focus management for accessible interfaces.
 * Includes focus trapping for modals, keyboard navigation, and focus restoration.
 *
 * WCAG 2.1 Compliance:
 * - 2.1.1 Keyboard (Level A)
 * - 2.1.2 No Keyboard Trap (Level A)
 * - 2.4.3 Focus Order (Level A)
 * - 2.4.7 Focus Visible (Level AA)
 *
 * Features:
 * - Focus trapping for modals and dialogs
 * - Keyboard navigation (Tab, Shift+Tab, Arrow keys)
 * - Focus restoration after modal close
 * - Escape key handling
 * - Configurable focusable element selection
 * - Auto-focus on activation
 */
export const useAccessibleFocus = (options: FocusTrapOptions): AccessibleFocusReturn => {
  const containerRef = useRef<HTMLElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Default selector for focusable elements
  const defaultFocusableSelector = `
    button:not([disabled]),
    [href]:not([disabled]),
    input:not([disabled]),
    select:not([disabled]),
    textarea:not([disabled]),
    [tabindex]:not([tabindex="-1"]):not([disabled]),
    details:not([disabled]),
    summary:not([disabled])
  `.replace(/\s+/g, ' ').trim();

  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];

    const selector = options.focusableSelector || defaultFocusableSelector;
    const elements = containerRef.current.querySelectorAll(selector);

    return Array.from(elements).filter((element) => {
      const htmlElement = element as HTMLElement;
      return (
        htmlElement.offsetParent !== null &&
        !htmlElement.hasAttribute('aria-hidden') &&
        htmlElement.tabIndex !== -1
      );
    }) as HTMLElement[];
  }, [options.focusableSelector]);

  const focusFirst = useCallback(() => {
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }, [getFocusableElements]);

  const focusLast = useCallback(() => {
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[focusableElements.length - 1].focus();
    }
  }, [getFocusableElements]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!options.isActive || !containerRef.current) return;

    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement as HTMLElement;

    // Handle Escape key
    if (event.key === 'Escape') {
      event.preventDefault();
      options.onEscape?.();
      return;
    }

    // Handle Tab key for focus trapping
    if (event.key === 'Tab') {
      // If shift+tab and on first element, go to last
      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
      // If tab and on last element, go to first
      else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    // Handle Arrow keys for navigation (for menus and lists)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const currentIndex = focusableElements.indexOf(activeElement);
      if (currentIndex === -1) return;

      event.preventDefault();

      if (event.key === 'ArrowDown') {
        const nextIndex = (currentIndex + 1) % focusableElements.length;
        focusableElements[nextIndex].focus();
      } else {
        const prevIndex = currentIndex === 0 ? focusableElements.length - 1 : currentIndex - 1;
        focusableElements[prevIndex].focus();
      }
    }

    // Handle Home and End keys
    if (event.key === 'Home') {
      event.preventDefault();
      firstElement.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      lastElement.focus();
    }
  }, [options.isActive, options.onEscape, getFocusableElements]);

  // Set up focus trap when active
  useEffect(() => {
    if (options.isActive) {
      // Store the previously focused element for restoration
      if (options.restoreFocus !== false) {
        previousActiveElement.current = document.activeElement as HTMLElement;
      }

      // Focus the first element if autoFocus is enabled
      if (options.autoFocus !== false) {
        // Use setTimeout to ensure DOM is ready
        const timer = setTimeout(() => {
          focusFirst();
        }, 0);
        return () => clearTimeout(timer);
      }
    } else {
      // Restore focus when deactivated
      if (options.restoreFocus !== false && previousActiveElement.current) {
        previousActiveElement.current.focus();
        previousActiveElement.current = null;
      }
    }
  }, [options.isActive, options.autoFocus, options.restoreFocus, focusFirst]);

  // Set up keyboard event listeners
  useEffect(() => {
    if (options.isActive) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [options.isActive, handleKeyDown]);

  return {
    containerRef,
    focusFirst,
    focusLast,
    getFocusableElements
  };
};

/**
 * useFocusVisible Hook
 *
 * Provides focus visibility management for better keyboard navigation UX.
 * Only shows focus indicators when navigating via keyboard.
 */
export const useFocusVisible = () => {
  const [focusVisible, setFocusVisible] = React.useState(false);

  useEffect(() => {
    let hadKeyboardEvent = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Enter' ||
          e.key === ' ') {
        hadKeyboardEvent = true;
      }
    };

    const handlePointerDown = () => {
      hadKeyboardEvent = false;
    };

    const handleFocus = () => {
      setFocusVisible(hadKeyboardEvent);
    };

    const handleBlur = () => {
      setFocusVisible(false);
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('touchstart', handlePointerDown, true);
    document.addEventListener('focus', handleFocus, true);
    document.addEventListener('blur', handleBlur, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('touchstart', handlePointerDown, true);
      document.removeEventListener('focus', handleFocus, true);
      document.removeEventListener('blur', handleBlur, true);
    };
  }, []);

  return focusVisible;
};

/**
 * useArrowKeyNavigation Hook
 *
 * Simplified hook for arrow key navigation in lists and menus.
 */
interface ArrowKeyNavigationOptions {
  /** Whether navigation is enabled */
  enabled?: boolean;
  /** Orientation of navigation */
  orientation?: 'vertical' | 'horizontal' | 'both';
  /** Wrap around when reaching the end */
  wrap?: boolean;
}

export const useArrowKeyNavigation = (
  options: ArrowKeyNavigationOptions = {}
): AccessibleFocusReturn => {
  const { enabled = true, orientation = 'vertical', wrap = true } = options;

  return useAccessibleFocus({
    isActive: enabled,
    autoFocus: false,
    restoreFocus: false
  });
};

export default useAccessibleFocus;