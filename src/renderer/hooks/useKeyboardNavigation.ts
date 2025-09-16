/**
 * useKeyboardNavigation Hook
 * Comprehensive hook for keyboard navigation functionality in components
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useKeyboard, useKeyboardShortcuts, useFocusTrap, useRovingTabindex } from '../contexts/KeyboardContext';
import { focusManager } from '../utils/focusManager';

export interface NavigationConfig {
  // Focus management
  trapFocus?: boolean;
  autoFocus?: boolean;
  restoreFocus?: boolean;

  // Navigation behavior
  orientation?: 'horizontal' | 'vertical' | 'both';
  wrap?: boolean;
  skipDisabled?: boolean;

  // Keyboard shortcuts
  shortcuts?: Array<{
    key: string;
    action: () => void;
    description: string;
    ctrlKey?: boolean;
    altKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
  }>;

  // Scope
  scope?: string;

  // Callbacks
  onFocus?: (element: HTMLElement) => void;
  onBlur?: (element: HTMLElement) => void;
  onEscape?: () => void;
  onEnter?: (element: HTMLElement) => void;
  onSpace?: (element: HTMLElement) => void;
}

export interface KeyboardNavigationResult {
  // Refs
  containerRef: React.RefObject<HTMLElement>;

  // Focus management
  focusFirst: () => HTMLElement | null;
  focusLast: () => HTMLElement | null;
  focusNext: () => HTMLElement | null;
  focusPrevious: () => HTMLElement | null;
  focusIndex: (index: number) => HTMLElement | null;

  // State
  currentIndex: number;
  focusedElement: HTMLElement | null;
  isKeyboardMode: boolean;

  // Utilities
  refresh: () => void;
  destroy: () => void;
  getFocusableElements: () => HTMLElement[];

  // Focus trap (if enabled)
  trapActive: boolean;
  activateTrap: () => void;
  deactivateTrap: () => void;
}

/**
 * Main keyboard navigation hook
 */
export function useKeyboardNavigation(config: NavigationConfig = {}): KeyboardNavigationResult {
  const {
    trapFocus = false,
    autoFocus = false,
    restoreFocus = false,
    orientation = 'horizontal',
    wrap = true,
    skipDisabled = true,
    shortcuts = [],
    scope,
    onFocus,
    onBlur,
    onEscape,
    onEnter,
    onSpace
  } = config;

  const containerRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const [currentIndex, setCurrentIndex] = useState(-1);
  const [focusedElement, setFocusedElement] = useState<HTMLElement | null>(null);
  const [trapActive, setTrapActive] = useState(false);

  const { state, isKeyboardOnlyMode } = useKeyboard();

  // Set up focus trap
  const focusTrap = useFocusTrap(
    containerRef,
    trapFocus && trapActive,
    {
      onEscape: () => {
        setTrapActive(false);
        onEscape?.();
      },
      returnFocus: previouslyFocusedRef.current
    }
  );

  // Set up roving tabindex for complex navigation
  const rovingTabindex = useRovingTabindex(
    containerRef,
    orientation !== 'horizontal' && orientation !== 'vertical' ? undefined : {
      orientation,
      wrap,
      activateOnFocus: true
    }
  );

  // Register keyboard shortcuts
  useKeyboardShortcuts(shortcuts, scope, [shortcuts, scope]);

  // Get focusable elements within container
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];

    const elements = focusManager.getFocusableElements(containerRef.current);

    if (skipDisabled) {
      return elements.filter(el =>
        !el.hasAttribute('disabled') &&
        !el.hasAttribute('aria-disabled') &&
        el.getAttribute('aria-disabled') !== 'true'
      );
    }

    return elements;
  }, [skipDisabled]);

  // Focus management functions
  const focusFirst = useCallback((): HTMLElement | null => {
    const elements = getFocusableElements();
    if (elements.length === 0) return null;

    elements[0].focus();
    setCurrentIndex(0);
    setFocusedElement(elements[0]);
    onFocus?.(elements[0]);
    return elements[0];
  }, [getFocusableElements, onFocus]);

  const focusLast = useCallback((): HTMLElement | null => {
    const elements = getFocusableElements();
    if (elements.length === 0) return null;

    const lastElement = elements[elements.length - 1];
    lastElement.focus();
    setCurrentIndex(elements.length - 1);
    setFocusedElement(lastElement);
    onFocus?.(lastElement);
    return lastElement;
  }, [getFocusableElements, onFocus]);

  const focusIndex = useCallback((index: number): HTMLElement | null => {
    const elements = getFocusableElements();
    if (index < 0 || index >= elements.length) return null;

    elements[index].focus();
    setCurrentIndex(index);
    setFocusedElement(elements[index]);
    onFocus?.(elements[index]);
    return elements[index];
  }, [getFocusableElements, onFocus]);

  const focusNext = useCallback((): HTMLElement | null => {
    const elements = getFocusableElements();
    if (elements.length === 0) return null;

    let nextIndex = currentIndex + 1;
    if (nextIndex >= elements.length) {
      nextIndex = wrap ? 0 : elements.length - 1;
    }

    return focusIndex(nextIndex);
  }, [currentIndex, wrap, focusIndex, getFocusableElements]);

  const focusPrevious = useCallback((): HTMLElement | null => {
    const elements = getFocusableElements();
    if (elements.length === 0) return null;

    let previousIndex = currentIndex - 1;
    if (previousIndex < 0) {
      previousIndex = wrap ? elements.length - 1 : 0;
    }

    return focusIndex(previousIndex);
  }, [currentIndex, wrap, focusIndex, getFocusableElements]);

  // Refresh navigation state
  const refresh = useCallback(() => {
    rovingTabindex.refresh?.();

    const elements = getFocusableElements();
    const activeElement = document.activeElement as HTMLElement;
    const newIndex = elements.indexOf(activeElement);

    if (newIndex !== -1) {
      setCurrentIndex(newIndex);
      setFocusedElement(activeElement);
    } else if (elements.length > 0 && currentIndex >= elements.length) {
      setCurrentIndex(Math.max(0, elements.length - 1));
    }
  }, [getFocusableElements, currentIndex, rovingTabindex]);

  // Clean up function
  const destroy = useCallback(() => {
    rovingTabindex.destroy?.();
    setTrapActive(false);
  }, [rovingTabindex]);

  // Focus trap control
  const activateTrap = useCallback(() => {
    if (trapFocus && !trapActive) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
      setTrapActive(true);
    }
  }, [trapFocus, trapActive]);

  const deactivateTrap = useCallback(() => {
    if (trapActive) {
      setTrapActive(false);
    }
  }, [trapActive]);

  // Handle keyboard events within container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const { key, target } = event;
      const currentElement = target as HTMLElement;

      // Update current focused element
      const elements = getFocusableElements();
      const index = elements.indexOf(currentElement);
      if (index !== -1) {
        setCurrentIndex(index);
        setFocusedElement(currentElement);
      }

      switch (key) {
        case 'Enter':
          if (onEnter) {
            event.preventDefault();
            onEnter(currentElement);
          }
          break;

        case ' ':
          if (onSpace) {
            event.preventDefault();
            onSpace(currentElement);
          }
          break;

        case 'Escape':
          if (onEscape) {
            event.preventDefault();
            onEscape();
          }
          break;

        case 'ArrowUp':
          if (orientation === 'vertical' || orientation === 'both') {
            event.preventDefault();
            focusPrevious();
          }
          break;

        case 'ArrowDown':
          if (orientation === 'vertical' || orientation === 'both') {
            event.preventDefault();
            focusNext();
          }
          break;

        case 'ArrowLeft':
          if (orientation === 'horizontal' || orientation === 'both') {
            event.preventDefault();
            focusPrevious();
          }
          break;

        case 'ArrowRight':
          if (orientation === 'horizontal' || orientation === 'both') {
            event.preventDefault();
            focusNext();
          }
          break;

        case 'Home':
          if (orientation !== 'horizontal') {
            event.preventDefault();
            focusFirst();
          }
          break;

        case 'End':
          if (orientation !== 'horizontal') {
            event.preventDefault();
            focusLast();
          }
          break;
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      const elements = getFocusableElements();
      const index = elements.indexOf(target);

      if (index !== -1) {
        setCurrentIndex(index);
        setFocusedElement(target);
        onFocus?.(target);
      }
    };

    const handleFocusOut = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      onBlur?.(target);
    };

    container.addEventListener('keydown', handleKeyDown);
    container.addEventListener('focusin', handleFocusIn);
    container.addEventListener('focusout', handleFocusOut);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('focusin', handleFocusIn);
      container.removeEventListener('focusout', handleFocusOut);
    };
  }, [
    getFocusableElements,
    orientation,
    wrap,
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
    onFocus,
    onBlur,
    onEscape,
    onEnter,
    onSpace
  ]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && containerRef.current) {
      // Delay to ensure DOM is ready
      const timer = setTimeout(() => {
        focusFirst();
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [autoFocus, focusFirst]);

  // Restore focus on unmount
  useEffect(() => {
    return () => {
      if (restoreFocus && previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus();
      }
      destroy();
    };
  }, [restoreFocus, destroy]);

  return {
    // Refs
    containerRef,

    // Focus management
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
    focusIndex,

    // State
    currentIndex,
    focusedElement,
    isKeyboardMode: isKeyboardOnlyMode(),

    // Utilities
    refresh,
    destroy,
    getFocusableElements,

    // Focus trap
    trapActive,
    activateTrap,
    deactivateTrap
  };
}

/**
 * Simplified hook for basic list navigation
 */
export function useListNavigation(
  orientation: 'horizontal' | 'vertical' = 'vertical',
  wrap = true
) {
  return useKeyboardNavigation({
    orientation,
    wrap,
    skipDisabled: true,
    autoFocus: false,
    restoreFocus: false
  });
}

/**
 * Hook for modal/dialog keyboard navigation
 */
export function useModalNavigation(
  isOpen: boolean,
  onClose?: () => void
) {
  const navigation = useKeyboardNavigation({
    trapFocus: true,
    autoFocus: true,
    restoreFocus: true,
    orientation: 'both',
    wrap: true,
    onEscape: onClose
  });

  // Control trap based on modal state
  useEffect(() => {
    if (isOpen) {
      navigation.activateTrap();
    } else {
      navigation.deactivateTrap();
    }
  }, [isOpen, navigation]);

  return navigation;
}

/**
 * Hook for form keyboard navigation
 */
export function useFormNavigation() {
  return useKeyboardNavigation({
    orientation: 'vertical',
    wrap: false,
    skipDisabled: true,
    shortcuts: [
      {
        key: 'Enter',
        description: 'Submit form',
        action: () => {
          const form = document.querySelector('form');
          if (form) {
            const submitButton = form.querySelector('[type="submit"]') as HTMLButtonElement;
            if (submitButton) {
              submitButton.click();
            }
          }
        }
      }
    ]
  });
}

/**
 * Hook for grid/table keyboard navigation
 */
export function useGridNavigation(
  rowCount: number,
  columnCount: number
) {
  const [currentRow, setCurrentRow] = useState(0);
  const [currentColumn, setCurrentColumn] = useState(0);

  const navigation = useKeyboardNavigation({
    orientation: 'both',
    wrap: false,
    shortcuts: [
      {
        key: 'Home',
        description: 'Go to first cell',
        action: () => {
          setCurrentRow(0);
          setCurrentColumn(0);
          navigation.focusIndex(0);
        }
      },
      {
        key: 'End',
        description: 'Go to last cell',
        action: () => {
          const lastRow = rowCount - 1;
          const lastColumn = columnCount - 1;
          setCurrentRow(lastRow);
          setCurrentColumn(lastColumn);
          navigation.focusIndex((lastRow * columnCount) + lastColumn);
        }
      },
      {
        key: 'Home',
        ctrlKey: true,
        description: 'Go to first row',
        action: () => {
          setCurrentRow(0);
          navigation.focusIndex(currentColumn);
        }
      },
      {
        key: 'End',
        ctrlKey: true,
        description: 'Go to last row',
        action: () => {
          const lastRow = rowCount - 1;
          setCurrentRow(lastRow);
          navigation.focusIndex((lastRow * columnCount) + currentColumn);
        }
      }
    ]
  });

  // Custom navigation handlers for grid movement
  const moveUp = useCallback(() => {
    if (currentRow > 0) {
      const newRow = currentRow - 1;
      setCurrentRow(newRow);
      navigation.focusIndex((newRow * columnCount) + currentColumn);
    }
  }, [currentRow, currentColumn, columnCount, navigation]);

  const moveDown = useCallback(() => {
    if (currentRow < rowCount - 1) {
      const newRow = currentRow + 1;
      setCurrentRow(newRow);
      navigation.focusIndex((newRow * columnCount) + currentColumn);
    }
  }, [currentRow, currentColumn, columnCount, rowCount, navigation]);

  const moveLeft = useCallback(() => {
    if (currentColumn > 0) {
      const newColumn = currentColumn - 1;
      setCurrentColumn(newColumn);
      navigation.focusIndex((currentRow * columnCount) + newColumn);
    }
  }, [currentRow, currentColumn, columnCount, navigation]);

  const moveRight = useCallback(() => {
    if (currentColumn < columnCount - 1) {
      const newColumn = currentColumn + 1;
      setCurrentColumn(newColumn);
      navigation.focusIndex((currentRow * columnCount) + newColumn);
    }
  }, [currentRow, currentColumn, columnCount, navigation]);

  return {
    ...navigation,
    currentRow,
    currentColumn,
    moveUp,
    moveDown,
    moveLeft,
    moveRight
  };
}

/**
 * Hook for typeahead search functionality
 */
export function useTypeahead(
  itemsRef: React.RefObject<HTMLElement[]>,
  options: {
    searchProperty?: 'textContent' | 'ariaLabel' | 'title' | 'dataset';
    timeout?: number;
    caseSensitive?: boolean;
    onMatch?: (element: HTMLElement, query: string) => void;
  } = {}
) {
  const { searchProperty = 'textContent', timeout = 1000, caseSensitive = false, onMatch } = options;

  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<HTMLElement[]>([]);
  const [activeMatch, setActiveMatch] = useState<HTMLElement | null>(null);
  const timeoutRef = useRef<number>();

  const clearQuery = useCallback(() => {
    setQuery('');
    setMatches([]);
    setActiveMatch(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const handleTypeahead = useCallback((key: string) => {
    const newQuery = query + (caseSensitive ? key : key.toLowerCase());
    setQuery(newQuery);

    // Find matching elements
    const items = itemsRef.current || [];
    const matchingItems = items.filter(item => {
      let searchText = '';

      switch (searchProperty) {
        case 'textContent':
          searchText = item.textContent || '';
          break;
        case 'ariaLabel':
          searchText = item.getAttribute('aria-label') || '';
          break;
        case 'title':
          searchText = item.title || '';
          break;
        case 'dataset':
          searchText = item.dataset.search || '';
          break;
      }

      if (!caseSensitive) {
        searchText = searchText.toLowerCase();
      }

      return searchText.startsWith(newQuery);
    });

    setMatches(matchingItems);

    // Focus first match
    if (matchingItems.length > 0) {
      const firstMatch = matchingItems[0];
      setActiveMatch(firstMatch);
      firstMatch.focus();
      onMatch?.(firstMatch, newQuery);
    }

    // Clear after timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(clearQuery, timeout);
  }, [query, itemsRef, searchProperty, caseSensitive, onMatch, timeout, clearQuery]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    query,
    matches,
    activeMatch,
    handleTypeahead,
    clearQuery
  };
}

/**
 * Hook for arrow key navigation in lists
 */
export function useArrowKeyNavigation(
  itemsRef: React.RefObject<HTMLElement[]>,
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both';
    wrap?: boolean;
    itemsPerRow?: number; // For grid-like navigation
    onActivate?: (element: HTMLElement, index: number) => void;
  } = {}
) {
  const { orientation = 'vertical', wrap = true, itemsPerRow = 1, onActivate } = options;
  const [activeIndex, setActiveIndex] = useState(-1);

  const focusItem = useCallback((index: number) => {
    const items = itemsRef.current || [];
    if (index >= 0 && index < items.length) {
      items[index].focus();
      setActiveIndex(index);
      return items[index];
    }
    return null;
  }, [itemsRef]);

  const moveNext = useCallback(() => {
    const items = itemsRef.current || [];
    let newIndex = activeIndex + 1;

    if (newIndex >= items.length) {
      newIndex = wrap ? 0 : items.length - 1;
    }

    return focusItem(newIndex);
  }, [activeIndex, focusItem, wrap, itemsRef]);

  const movePrevious = useCallback(() => {
    const items = itemsRef.current || [];
    let newIndex = activeIndex - 1;

    if (newIndex < 0) {
      newIndex = wrap ? items.length - 1 : 0;
    }

    return focusItem(newIndex);
  }, [activeIndex, focusItem, wrap, itemsRef]);

  const moveUp = useCallback(() => {
    if (orientation === 'vertical' || orientation === 'both') {
      return movePrevious();
    } else if (itemsPerRow > 1) {
      const newIndex = activeIndex - itemsPerRow;
      return focusItem(newIndex >= 0 ? newIndex : activeIndex);
    }
    return null;
  }, [orientation, itemsPerRow, activeIndex, focusItem, movePrevious]);

  const moveDown = useCallback(() => {
    if (orientation === 'vertical' || orientation === 'both') {
      return moveNext();
    } else if (itemsPerRow > 1) {
      const items = itemsRef.current || [];
      const newIndex = activeIndex + itemsPerRow;
      return focusItem(newIndex < items.length ? newIndex : activeIndex);
    }
    return null;
  }, [orientation, itemsPerRow, activeIndex, focusItem, moveNext, itemsRef]);

  const moveLeft = useCallback(() => {
    if (orientation === 'horizontal' || orientation === 'both') {
      return movePrevious();
    }
    return null;
  }, [orientation, movePrevious]);

  const moveRight = useCallback(() => {
    if (orientation === 'horizontal' || orientation === 'both') {
      return moveNext();
    }
    return null;
  }, [orientation, moveNext]);

  const activate = useCallback(() => {
    const items = itemsRef.current || [];
    if (activeIndex >= 0 && activeIndex < items.length) {
      const item = items[activeIndex];
      onActivate?.(item, activeIndex);

      // Trigger click event
      item.click();
    }
  }, [activeIndex, itemsRef, onActivate]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const { key } = event;
    let handled = false;

    switch (key) {
      case 'ArrowUp':
        moveUp();
        handled = true;
        break;
      case 'ArrowDown':
        moveDown();
        handled = true;
        break;
      case 'ArrowLeft':
        moveLeft();
        handled = true;
        break;
      case 'ArrowRight':
        moveRight();
        handled = true;
        break;
      case 'Home':
        focusItem(0);
        handled = true;
        break;
      case 'End':
        const items = itemsRef.current || [];
        focusItem(items.length - 1);
        handled = true;
        break;
      case 'Enter':
      case ' ':
        activate();
        handled = true;
        break;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, [moveUp, moveDown, moveLeft, moveRight, focusItem, activate, itemsRef]);

  return {
    activeIndex,
    focusItem,
    moveNext,
    movePrevious,
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    activate,
    handleKeyDown
  };
}

/**
 * Hook for menu navigation with support for submenus
 */
export function useMenuNavigation(
  options: {
    orientation?: 'horizontal' | 'vertical';
    hasSubmenus?: boolean;
    onClose?: () => void;
    onSubmenuToggle?: (item: HTMLElement, open: boolean) => void;
  } = {}
) {
  const { orientation = 'vertical', hasSubmenus = false, onClose, onSubmenuToggle } = options;

  const navigation = useKeyboardNavigation({
    orientation,
    wrap: true,
    onEscape: onClose,
    shortcuts: [
      {
        key: 'Enter',
        description: 'Activate menu item',
        action: () => {
          const activeElement = document.activeElement as HTMLElement;
          if (activeElement) {
            activeElement.click();
          }
        }
      },
      {
        key: ' ',
        description: 'Activate menu item',
        action: () => {
          const activeElement = document.activeElement as HTMLElement;
          if (activeElement) {
            activeElement.click();
          }
        }
      }
    ]
  });

  const handleSubmenuKey = useCallback((event: KeyboardEvent) => {
    if (!hasSubmenus) return;

    const { key } = event;
    const activeElement = document.activeElement as HTMLElement;
    const hasSubmenu = activeElement?.getAttribute('aria-haspopup') === 'true';
    const submenuOpen = activeElement?.getAttribute('aria-expanded') === 'true';

    switch (key) {
      case 'ArrowRight':
        if (orientation === 'vertical' && hasSubmenu && !submenuOpen) {
          onSubmenuToggle?.(activeElement, true);
          event.preventDefault();
        }
        break;
      case 'ArrowLeft':
        if (orientation === 'vertical' && submenuOpen) {
          onSubmenuToggle?.(activeElement, false);
          event.preventDefault();
        }
        break;
    }
  }, [hasSubmenus, orientation, onSubmenuToggle]);

  useEffect(() => {
    if (navigation.containerRef.current) {
      navigation.containerRef.current.addEventListener('keydown', handleSubmenuKey);
      return () => {
        navigation.containerRef.current?.removeEventListener('keydown', handleSubmenuKey);
      };
    }
  }, [navigation.containerRef, handleSubmenuKey]);

  return navigation;
}

/**
 * Hook for tab navigation (tab list pattern)
 */
export function useTabNavigation(
  options: {
    activationMode?: 'automatic' | 'manual';
    onTabChange?: (tabId: string, tabElement: HTMLElement) => void;
  } = {}
) {
  const { activationMode = 'automatic', onTabChange } = options;
  const [activeTabId, setActiveTabId] = useState<string>('');

  const navigation = useKeyboardNavigation({
    orientation: 'horizontal',
    wrap: true,
    onEnter: (element) => {
      if (activationMode === 'manual') {
        activateTab(element);
      }
    },
    onSpace: (element) => {
      if (activationMode === 'manual') {
        activateTab(element);
      }
    }
  });

  const activateTab = useCallback((tabElement: HTMLElement) => {
    const tabId = tabElement.id || tabElement.getAttribute('data-tab-id') || '';

    // Update tab states
    const tabs = navigation.getFocusableElements();
    tabs.forEach(tab => {
      const isActive = tab === tabElement;
      tab.setAttribute('aria-selected', isActive.toString());
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    setActiveTabId(tabId);
    onTabChange?.(tabId, tabElement);
  }, [navigation, onTabChange]);

  // Handle automatic activation
  useEffect(() => {
    if (activationMode === 'automatic' && navigation.focusedElement) {
      activateTab(navigation.focusedElement);
    }
  }, [navigation.focusedElement, activationMode, activateTab]);

  return {
    ...navigation,
    activeTabId,
    activateTab
  };
}