/**
 * Comprehensive Focus Management Hook
 * Provides advanced focus management capabilities with accessibility features
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { focusManager, FocusTrap, RovingTabindex } from '../utils/focusManager';
import { useKeyboard } from '../contexts/KeyboardContext';

export interface FocusManagementConfig {
  // Focus trap configuration
  trapFocus?: boolean;
  trapConfig?: {
    initialFocus?: string | HTMLElement;
    returnFocus?: HTMLElement;
    onEscape?: () => void;
    allowTabEscape?: boolean;
  };

  // Roving tabindex configuration
  rovingTabindex?: boolean;
  rovingConfig?: {
    orientation?: 'horizontal' | 'vertical' | 'both';
    wrap?: boolean;
    activateOnFocus?: boolean;
  };

  // Auto focus configuration
  autoFocus?: boolean | 'first' | 'last' | string;

  // Focus restoration
  restoreFocus?: boolean;
  restoreTarget?: HTMLElement;

  // Skip links
  skipLinks?: Array<{ href: string; text: string }>;

  // Focus visibility
  manageFocusVisible?: boolean;

  // Callbacks
  onFocusEnter?: (element: HTMLElement) => void;
  onFocusLeave?: (element: HTMLElement) => void;
  onFocusChange?: (element: HTMLElement | null, previousElement: HTMLElement | null) => void;

  // Focus scope
  scope?: string;
  isolate?: boolean;
}

export interface FocusManagementReturn {
  // Refs
  containerRef: React.RefObject<HTMLElement>;

  // Focus control
  focusFirst: () => HTMLElement | null;
  focusLast: () => HTMLElement | null;
  focusNext: () => HTMLElement | null;
  focusPrevious: () => HTMLElement | null;
  focusElement: (selector: string | HTMLElement) => boolean;
  focusIndex: (index: number) => HTMLElement | null;

  // State
  currentFocusedElement: HTMLElement | null;
  focusHistory: HTMLElement[];
  isFocusVisible: boolean;
  isKeyboardMode: boolean;

  // Focus trap control
  trapActive: boolean;
  activateTrap: () => void;
  deactivateTrap: () => void;

  // Utilities
  getFocusableElements: () => HTMLElement[];
  getFocusOrder: () => HTMLElement[];
  saveFocusState: () => void;
  restoreFocusState: () => void;
  clearFocusHistory: () => void;
  refresh: () => void;

  // Focus ring management
  setFocusVisible: (visible: boolean) => void;
  enableFocusRing: () => void;
  disableFocusRing: () => void;

  // Advanced features
  createFocusGroup: (elements: HTMLElement[]) => void;
  setFocusOrder: (elements: HTMLElement[]) => void;
  createTypeahead: (config?: TypeaheadConfig) => TypeaheadReturn;
}

export interface TypeaheadConfig {
  searchProperty?: 'textContent' | 'ariaLabel' | 'title';
  timeout?: number;
  caseSensitive?: boolean;
  onMatch?: (element: HTMLElement, query: string) => void;
}

export interface TypeaheadReturn {
  query: string;
  matches: HTMLElement[];
  activeMatch: HTMLElement | null;
  clearQuery: () => void;
  destroy: () => void;
}

/**
 * Comprehensive focus management hook
 */
export function useFocusManagement(config: FocusManagementConfig = {}): FocusManagementReturn {
  const {
    trapFocus = false,
    trapConfig = {},
    rovingTabindex = false,
    rovingConfig = {},
    autoFocus = false,
    restoreFocus = false,
    restoreTarget,
    skipLinks = [],
    manageFocusVisible = true,
    onFocusEnter,
    onFocusLeave,
    onFocusChange,
    scope,
    isolate = false
  } = config;

  const containerRef = useRef<HTMLElement>(null);
  const focusTrapRef = useRef<FocusTrap | null>(null);
  const rovingTabindexRef = useRef<RovingTabindex | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const focusHistoryRef = useRef<HTMLElement[]>([]);
  const typeaheadRef = useRef<any>(null);

  const [currentFocusedElement, setCurrentFocusedElement] = useState<HTMLElement | null>(null);
  const [trapActive, setTrapActive] = useState(false);
  const [isFocusVisible, setIsFocusVisible] = useState(true);

  const { state, isKeyboardOnlyMode, createSkipLinks } = useKeyboard();

  // Focus utilities
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    return focusManager.getFocusableElements(containerRef.current);
  }, []);

  const getFocusOrder = useCallback((): HTMLElement[] => {
    const elements = getFocusableElements();
    // Sort by tabindex and document order
    return elements.sort((a, b) => {
      const aTabIndex = a.tabIndex || 0;
      const bTabIndex = b.tabIndex || 0;

      if (aTabIndex !== bTabIndex) {
        // Elements with positive tabindex come first
        if (aTabIndex > 0 && bTabIndex <= 0) return -1;
        if (bTabIndex > 0 && aTabIndex <= 0) return 1;
        if (aTabIndex > 0 && bTabIndex > 0) return aTabIndex - bTabIndex;
      }

      // Use document order for elements with same tabindex
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }, [getFocusableElements]);

  // Focus control functions
  const focusFirst = useCallback((): HTMLElement | null => {
    const elements = getFocusOrder();
    if (elements.length > 0) {
      elements[0].focus();
      return elements[0];
    }
    return null;
  }, [getFocusOrder]);

  const focusLast = useCallback((): HTMLElement | null => {
    const elements = getFocusOrder();
    if (elements.length > 0) {
      const last = elements[elements.length - 1];
      last.focus();
      return last;
    }
    return null;
  }, [getFocusOrder]);

  const focusIndex = useCallback((index: number): HTMLElement | null => {
    const elements = getFocusOrder();
    if (index >= 0 && index < elements.length) {
      elements[index].focus();
      return elements[index];
    }
    return null;
  }, [getFocusOrder]);

  const focusNext = useCallback((): HTMLElement | null => {
    const elements = getFocusOrder();
    const activeElement = document.activeElement as HTMLElement;
    const currentIndex = elements.indexOf(activeElement);

    if (currentIndex !== -1 && currentIndex < elements.length - 1) {
      const nextElement = elements[currentIndex + 1];
      nextElement.focus();
      return nextElement;
    }
    return null;
  }, [getFocusOrder]);

  const focusPrevious = useCallback((): HTMLElement | null => {
    const elements = getFocusOrder();
    const activeElement = document.activeElement as HTMLElement;
    const currentIndex = elements.indexOf(activeElement);

    if (currentIndex > 0) {
      const prevElement = elements[currentIndex - 1];
      prevElement.focus();
      return prevElement;
    }
    return null;
  }, [getFocusOrder]);

  const focusElement = useCallback((selector: string | HTMLElement): boolean => {
    if (!containerRef.current) return false;

    let element: HTMLElement | null = null;

    if (typeof selector === 'string') {
      element = containerRef.current.querySelector(selector);
    } else {
      element = selector;
    }

    if (element && containerRef.current.contains(element)) {
      element.focus();
      return true;
    }
    return false;
  }, []);

  // Focus state management
  const saveFocusState = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && containerRef.current?.contains(activeElement)) {
      focusHistoryRef.current.push(activeElement);
      // Keep only last 10 elements
      if (focusHistoryRef.current.length > 10) {
        focusHistoryRef.current.shift();
      }
    }
  }, []);

  const restoreFocusState = useCallback(() => {
    const lastFocused = focusHistoryRef.current.pop();
    if (lastFocused && document.contains(lastFocused)) {
      lastFocused.focus();
      return true;
    }
    return false;
  }, []);

  const clearFocusHistory = useCallback(() => {
    focusHistoryRef.current = [];
  }, []);

  // Focus trap control
  const activateTrap = useCallback(() => {
    if (trapFocus && !trapActive && containerRef.current) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;

      focusTrapRef.current = focusManager.createFocusTrap(containerRef.current, {
        ...trapConfig,
        returnFocus: restoreTarget || previouslyFocusedRef.current
      });

      setTrapActive(true);
    }
  }, [trapFocus, trapActive, trapConfig, restoreTarget]);

  const deactivateTrap = useCallback(() => {
    if (focusTrapRef.current) {
      focusTrapRef.current.destroy();
      focusTrapRef.current = null;
      setTrapActive(false);
    }
  }, []);

  // Focus ring management
  const setFocusVisible = useCallback((visible: boolean) => {
    setIsFocusVisible(visible);
    if (containerRef.current) {
      if (visible) {
        containerRef.current.classList.add('focus-visible');
      } else {
        containerRef.current.classList.remove('focus-visible');
      }
    }
  }, []);

  const enableFocusRing = useCallback(() => setFocusVisible(true), [setFocusVisible]);
  const disableFocusRing = useCallback(() => setFocusVisible(false), [setFocusVisible]);

  // Advanced features
  const createFocusGroup = useCallback((elements: HTMLElement[]) => {
    if (!containerRef.current) return;

    elements.forEach((element, index) => {
      element.setAttribute('data-focus-group-index', index.toString());
      if (index === 0) {
        element.tabIndex = 0;
      } else {
        element.tabIndex = -1;
      }
    });
  }, []);

  const setFocusOrder = useCallback((elements: HTMLElement[]) => {
    elements.forEach((element, index) => {
      element.tabIndex = index + 1;
    });
  }, []);

  // Typeahead functionality
  const createTypeahead = useCallback((typeaheadConfig: TypeaheadConfig = {}): TypeaheadReturn => {
    const {
      searchProperty = 'textContent',
      timeout = 1000,
      caseSensitive = false,
      onMatch
    } = typeaheadConfig;

    let query = '';
    let timeoutId: number;
    let matches: HTMLElement[] = [];
    let activeMatch: HTMLElement | null = null;

    const clearQuery = () => {
      query = '';
      matches = [];
      activeMatch = null;
      clearTimeout(timeoutId);
    };

    const handleKeydown = (event: KeyboardEvent) => {
      const { key } = event;

      // Only handle printable characters
      if (key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();

        query += caseSensitive ? key : key.toLowerCase();

        // Find matching elements
        const elements = getFocusableElements();
        matches = elements.filter(element => {
          let text = '';
          switch (searchProperty) {
            case 'textContent':
              text = element.textContent || '';
              break;
            case 'ariaLabel':
              text = element.getAttribute('aria-label') || '';
              break;
            case 'title':
              text = element.title || '';
              break;
          }

          if (!caseSensitive) {
            text = text.toLowerCase();
          }

          return text.startsWith(query);
        });

        // Focus first match
        if (matches.length > 0) {
          activeMatch = matches[0];
          activeMatch.focus();
          onMatch?.(activeMatch, query);
        }

        // Reset after timeout
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(clearQuery, timeout);
      }
    };

    // Add listener
    containerRef.current?.addEventListener('keydown', handleKeydown);

    const destroy = () => {
      containerRef.current?.removeEventListener('keydown', handleKeydown);
      clearTimeout(timeoutId);
    };

    typeaheadRef.current = { destroy, clearQuery };

    return {
      query,
      matches,
      activeMatch,
      clearQuery,
      destroy
    };
  }, [getFocusableElements]);

  // Refresh functionality
  const refresh = useCallback(() => {
    if (rovingTabindexRef.current) {
      rovingTabindexRef.current.refresh();
    }
  }, []);

  // Initialize skip links
  useEffect(() => {
    if (skipLinks.length > 0) {
      createSkipLinks(skipLinks);
    }
  }, [skipLinks, createSkipLinks]);

  // Initialize roving tabindex
  useEffect(() => {
    if (rovingTabindex && containerRef.current) {
      rovingTabindexRef.current = new RovingTabindex(containerRef.current, rovingConfig);
    }

    return () => {
      if (rovingTabindexRef.current) {
        rovingTabindexRef.current.destroy();
        rovingTabindexRef.current = null;
      }
    };
  }, [rovingTabindex, rovingConfig]);

  // Auto focus on mount
  useEffect(() => {
    if (autoFocus && containerRef.current) {
      const timer = setTimeout(() => {
        if (typeof autoFocus === 'string') {
          if (autoFocus === 'first') {
            focusFirst();
          } else if (autoFocus === 'last') {
            focusLast();
          } else {
            focusElement(autoFocus);
          }
        } else if (autoFocus === true) {
          focusFirst();
        }
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [autoFocus, focusFirst, focusLast, focusElement]);

  // Focus change tracking
  useEffect(() => {
    if (!containerRef.current) return;

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      const prevElement = currentFocusedElement;

      setCurrentFocusedElement(target);
      onFocusEnter?.(target);
      onFocusChange?.(target, prevElement);

      if (manageFocusVisible) {
        setIsFocusVisible(isKeyboardOnlyMode());
      }
    };

    const handleFocusOut = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      onFocusLeave?.(target);
    };

    const container = containerRef.current;
    container.addEventListener('focusin', handleFocusIn);
    container.addEventListener('focusout', handleFocusOut);

    return () => {
      container.removeEventListener('focusin', handleFocusIn);
      container.removeEventListener('focusout', handleFocusOut);
    };
  }, [currentFocusedElement, onFocusEnter, onFocusLeave, onFocusChange, manageFocusVisible, isKeyboardOnlyMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      deactivateTrap();

      if (restoreFocus && previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus();
      }

      if (typeaheadRef.current) {
        typeaheadRef.current.destroy();
      }
    };
  }, [deactivateTrap, restoreFocus]);

  return {
    // Refs
    containerRef,

    // Focus control
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
    focusElement,
    focusIndex,

    // State
    currentFocusedElement,
    focusHistory: focusHistoryRef.current,
    isFocusVisible,
    isKeyboardMode: isKeyboardOnlyMode(),

    // Focus trap control
    trapActive,
    activateTrap,
    deactivateTrap,

    // Utilities
    getFocusableElements,
    getFocusOrder,
    saveFocusState,
    restoreFocusState,
    clearFocusHistory,
    refresh,

    // Focus ring management
    setFocusVisible,
    enableFocusRing,
    disableFocusRing,

    // Advanced features
    createFocusGroup,
    setFocusOrder,
    createTypeahead
  };
}

/**
 * Simple focus trap hook
 */
export function useFocusTrapSimple(
  containerRef: React.RefObject<HTMLElement>,
  active: boolean,
  options?: {
    initialFocus?: string | HTMLElement;
    onEscape?: () => void;
    restoreFocus?: boolean;
  }
) {
  const { activateTrap, deactivateTrap, trapActive } = useFocusManagement({
    trapFocus: active,
    autoFocus: options?.initialFocus ? 'first' : false,
    restoreFocus: options?.restoreFocus ?? true,
    trapConfig: {
      initialFocus: options?.initialFocus,
      onEscape: options?.onEscape
    }
  });

  useEffect(() => {
    if (active) {
      activateTrap();
    } else {
      deactivateTrap();
    }
  }, [active, activateTrap, deactivateTrap]);

  return { trapActive, activateTrap, deactivateTrap };
}

/**
 * Focus restoration hook
 */
export function useFocusRestore(restoreOnUnmount = true) {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const saveFocus = useCallback(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = useCallback(() => {
    if (previouslyFocusedRef.current && document.contains(previouslyFocusedRef.current)) {
      previouslyFocusedRef.current.focus();
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    saveFocus();

    if (restoreOnUnmount) {
      return () => {
        restoreFocus();
      };
    }
  }, [saveFocus, restoreFocus, restoreOnUnmount]);

  return { saveFocus, restoreFocus, previouslyFocused: previouslyFocusedRef.current };
}