import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Comprehensive Accessibility Utilities and Components
 */

// ARIA types and interfaces
export interface AriaProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-hidden'?: boolean;
  'aria-pressed'?: boolean;
  'aria-selected'?: boolean;
  'aria-checked'?: boolean | 'mixed';
  'aria-disabled'?: boolean;
  'aria-required'?: boolean;
  'aria-invalid'?: boolean | 'grammar' | 'spelling';
  'aria-live'?: 'off' | 'polite' | 'assertive';
  'aria-atomic'?: boolean;
  'aria-busy'?: boolean;
  'aria-controls'?: string;
  'aria-owns'?: string;
  'aria-activedescendant'?: string;
  role?: string;
}

export interface FocusableElement extends HTMLElement {
  focus(): void;
}

/**
 * Focus management utilities
 */
export class FocusManager {
  private static instance: FocusManager;
  private focusStack: HTMLElement[] = [];
  private originalFocus: HTMLElement | null = null;

  static getInstance(): FocusManager {
    if (!FocusManager.instance) {
      FocusManager.instance = new FocusManager();
    }
    return FocusManager.instance;
  }

  // Save current focus and set new focus
  pushFocus(element: HTMLElement): void {
    if (document.activeElement instanceof HTMLElement) {
      this.focusStack.push(document.activeElement);
    }
    element.focus();
  }

  // Restore previous focus
  popFocus(): void {
    const previousElement = this.focusStack.pop();
    if (previousElement && document.body.contains(previousElement)) {
      previousElement.focus();
    }
  }

  // Trap focus within container
  trapFocus(container: HTMLElement): () => void {
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length === 0) return () => {};

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }

  // Get all focusable elements within container
  getFocusableElements(container: HTMLElement): HTMLElement[] {
    const focusableSelectors = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
  }

  // Check if element is visible and focusable
  isFocusable(element: HTMLElement): boolean {
    if (element.tabIndex < 0) return false;
    if (element.hasAttribute('disabled')) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }
}

/**
 * Announcement utilities for screen readers
 */
export class AnnouncementManager {
  private static instance: AnnouncementManager;
  private liveRegion: HTMLDivElement | null = null;

  static getInstance(): AnnouncementManager {
    if (!AnnouncementManager.instance) {
      AnnouncementManager.instance = new AnnouncementManager();
    }
    return AnnouncementManager.instance;
  }

  constructor() {
    this.createLiveRegion();
  }

  private createLiveRegion(): void {
    if (this.liveRegion || typeof document === 'undefined') return;

    this.liveRegion = document.createElement('div');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.style.position = 'absolute';
    this.liveRegion.style.left = '-10000px';
    this.liveRegion.style.width = '1px';
    this.liveRegion.style.height = '1px';
    this.liveRegion.style.overflow = 'hidden';
    
    document.body.appendChild(this.liveRegion);
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.liveRegion) return;

    this.liveRegion.setAttribute('aria-live', priority);
    this.liveRegion.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (this.liveRegion) {
        this.liveRegion.textContent = '';
      }
    }, 1000);
  }

  announceImmediate(message: string): void {
    this.announce(message, 'assertive');
  }
}

/**
 * Accessibility hooks
 */

// Hook for focus management
export function useFocusManagement() {
  const focusManager = FocusManager.getInstance();
  
  return {
    pushFocus: focusManager.pushFocus.bind(focusManager),
    popFocus: focusManager.popFocus.bind(focusManager),
    trapFocus: focusManager.trapFocus.bind(focusManager),
    getFocusableElements: focusManager.getFocusableElements.bind(focusManager),
    isFocusable: focusManager.isFocusable.bind(focusManager)
  };
}

// Hook for announcements
export function useAnnouncements() {
  const announcementManager = AnnouncementManager.getInstance();
  
  return {
    announce: announcementManager.announce.bind(announcementManager),
    announceImmediate: announcementManager.announceImmediate.bind(announcementManager)
  };
}

// Hook for keyboard navigation
export function useKeyboardNavigation(
  containerRef: React.RefObject<HTMLElement>,
  options: {
    trapFocus?: boolean;
    restoreFocus?: boolean;
    initialFocus?: React.RefObject<HTMLElement>;
    onEscape?: () => void;
  } = {}
) {
  const { trapFocus = false, restoreFocus = true, initialFocus, onEscape } = options;
  const { pushFocus, popFocus, trapFocus: trapFocusFn } = useFocusManagement();
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Store previous active element
    if (restoreFocus && document.activeElement instanceof HTMLElement) {
      previousActiveElement.current = document.activeElement;
    }

    // Set initial focus
    if (initialFocus?.current) {
      initialFocus.current.focus();
    }

    // Setup focus trap
    let cleanupTrap: (() => void) | undefined;
    if (trapFocus) {
      cleanupTrap = trapFocusFn(container);
    }

    // Handle escape key
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        onEscape();
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      cleanupTrap?.();
      
      // Restore focus
      if (restoreFocus && previousActiveElement.current && document.body.contains(previousActiveElement.current)) {
        previousActiveElement.current.focus();
      }
    };
  }, [containerRef, trapFocus, restoreFocus, initialFocus, onEscape, trapFocusFn]);
}

// Hook for screen reader detection
export function useScreenReader() {
  const [isScreenReader, setIsScreenReader] = useState(false);

  useEffect(() => {
    // Detect screen reader by checking for screen reader specific APIs
    const hasScreenReader = (
      'speechSynthesis' in window ||
      navigator.userAgent.includes('NVDA') ||
      navigator.userAgent.includes('JAWS') ||
      navigator.userAgent.includes('VoiceOver')
    );

    setIsScreenReader(hasScreenReader);
  }, []);

  return isScreenReader;
}

// Hook for reduced motion preference
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

// Hook for high contrast preference
export function useHighContrast() {
  const [prefersHighContrast, setPrefersHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setPrefersHighContrast(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersHighContrast(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersHighContrast;
}

/**
 * Accessible Components
 */

// Skip Link Component
export interface SkipLinkProps {
  targetId: string;
  children: React.ReactNode;
  className?: string;
}

export const SkipLink: React.FC<SkipLinkProps> = ({ targetId, children, className }) => {
  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={`skip-link ${className || ''}`}
      style={{
        position: 'absolute',
        left: '-10000px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        ':focus': {
          position: 'fixed',
          top: '10px',
          left: '10px',
          width: 'auto',
          height: 'auto',
          padding: '8px 16px',
          background: '#000',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: '4px',
          zIndex: 9999
        }
      }}
    >
      {children}
    </a>
  );
};

// Focus Trap Component
export interface FocusTrapProps {
  children: React.ReactNode;
  active?: boolean;
  restoreFocus?: boolean;
  initialFocus?: React.RefObject<HTMLElement>;
  onEscape?: () => void;
}

export const FocusTrap: React.FC<FocusTrapProps> = ({
  children,
  active = true,
  restoreFocus = true,
  initialFocus,
  onEscape
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useKeyboardNavigation(containerRef, {
    trapFocus: active,
    restoreFocus,
    initialFocus,
    onEscape
  });

  return (
    <div ref={containerRef} className="focus-trap">
      {children}
    </div>
  );
};

// Live Region Component
export interface LiveRegionProps {
  message: string;
  priority?: 'polite' | 'assertive';
  atomic?: boolean;
  clearAfter?: number;
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  priority = 'polite',
  atomic = true,
  clearAfter = 1000
}) => {
  const [currentMessage, setCurrentMessage] = useState(message);

  useEffect(() => {
    setCurrentMessage(message);
    
    if (clearAfter > 0) {
      const timer = setTimeout(() => {
        setCurrentMessage('');
      }, clearAfter);
      
      return () => clearTimeout(timer);
    }
  }, [message, clearAfter]);

  return (
    <div
      aria-live={priority}
      aria-atomic={atomic}
      className="sr-only"
      style={{
        position: 'absolute',
        left: '-10000px',
        width: '1px',
        height: '1px',
        overflow: 'hidden'
      }}
    >
      {currentMessage}
    </div>
  );
};

// Visually Hidden Component
export interface VisuallyHiddenProps {
  children: React.ReactNode;
  focusable?: boolean;
}

export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({
  children,
  focusable = false
}) => {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: '-10000px',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    ...(!focusable && {
      clip: 'rect(0 0 0 0)',
      clipPath: 'inset(50%)',
      whiteSpace: 'nowrap'
    })
  };

  return focusable ? (
    <span className="sr-only-focusable" style={style}>
      {children}
    </span>
  ) : (
    <span className="sr-only" style={style}>
      {children}
    </span>
  );
};

/**
 * Accessibility validation utilities
 */
export const AccessibilityValidator = {
  // Check if element has accessible name
  hasAccessibleName(element: HTMLElement): boolean {
    return !!(
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') ||
      element.textContent?.trim() ||
      element.getAttribute('title')
    );
  },

  // Check color contrast ratio
  checkColorContrast(foreground: string, background: string): number {
    // Simplified contrast calculation
    const getLuminance = (color: string) => {
      // This is a simplified version - in production, use a proper color library
      const rgb = color.match(/\d+/g);
      if (!rgb) return 0;
      
      const [r, g, b] = rgb.map(x => {
        const val = parseInt(x) / 255;
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
      });
      
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const l1 = getLuminance(foreground);
    const l2 = getLuminance(background);
    const lightest = Math.max(l1, l2);
    const darkest = Math.min(l1, l2);
    
    return (lightest + 0.05) / (darkest + 0.05);
  },

  // Validate ARIA attributes
  validateAria(element: HTMLElement): string[] {
    const errors: string[] = [];
    const ariaLabel = element.getAttribute('aria-label');
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    const role = element.getAttribute('role');

    // Check for empty aria-label
    if (ariaLabel !== null && !ariaLabel.trim()) {
      errors.push('aria-label should not be empty');
    }

    // Check if aria-labelledby references exist
    if (ariaLabelledBy) {
      const ids = ariaLabelledBy.split(/\s+/);
      ids.forEach(id => {
        if (!document.getElementById(id)) {
          errors.push(`aria-labelledby references non-existent element: ${id}`);
        }
      });
    }

    // Check for unknown roles
    const validRoles = [
      'alert', 'button', 'checkbox', 'dialog', 'gridcell', 'link', 'log',
      'marquee', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option',
      'progressbar', 'radio', 'scrollbar', 'searchbox', 'slider',
      'spinbutton', 'status', 'switch', 'tab', 'tabpanel', 'textbox',
      'timer', 'tooltip', 'treeitem'
    ];

    if (role && !validRoles.includes(role)) {
      errors.push(`Unknown role: ${role}`);
    }

    return errors;
  }
};

/**
 * Higher-order component for accessibility
 */
export function withAccessibility<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: {
    skipValidation?: boolean;
    announceChanges?: boolean;
    focusManagement?: boolean;
  } = {}
) {
  const AccessibleComponent = React.forwardRef<any, P & AriaProps>((props, ref) => {
    const { announce } = useAnnouncements();
    const elementRef = useRef<HTMLElement>(null);

    // Validate accessibility in development
    useEffect(() => {
      if (process.env.NODE_ENV === 'development' && !options.skipValidation) {
        const element = elementRef.current;
        if (element) {
          const errors = AccessibilityValidator.validateAria(element);
          if (errors.length > 0) {
            console.warn('Accessibility issues found:', errors);
          }
        }
      }
    }, []);

    // Announce changes if enabled
    useEffect(() => {
      if (options.announceChanges) {
        // This could be enhanced to announce specific prop changes
        announce('Component updated');
      }
    });

    const combinedRef = useCallback((node: HTMLElement) => {
      elementRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    }, [ref]);

    return <WrappedComponent {...props} ref={combinedRef} />;
  });

  AccessibleComponent.displayName = `withAccessibility(${WrappedComponent.displayName || WrappedComponent.name})`;
  return AccessibleComponent;
}
