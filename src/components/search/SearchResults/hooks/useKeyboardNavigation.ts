/**
 * useKeyboardNavigation Hook
 *
 * Custom hook for managing keyboard navigation in search results
 * @version 2.0.0
 */

import { useState, useCallback, useEffect, useRef, KeyboardEvent } from 'react';
import { UseKeyboardNavigationReturn } from '../types';
import { clamp, debounce } from '../utils';

interface UseKeyboardNavigationOptions {
  /** Total number of items */
  itemCount: number;
  /** Initial selected index */
  initialSelectedIndex?: number;
  /** Whether navigation wraps around */
  wrap?: boolean;
  /** Callback when selection changes */
  onSelectionChange?: (index: number) => void;
  /** Callback when item is activated (Enter/Space) */
  onItemActivate?: (index: number) => void;
  /** Whether to scroll selected item into view */
  autoScroll?: boolean;
  /** Scroll behavior for auto-scroll */
  scrollBehavior?: ScrollBehavior;
  /** Scroll block alignment */
  scrollBlock?: ScrollLogicalPosition;
  /** Debounce delay for scroll operations */
  scrollDebounceMs?: number;
  /** Container element ref for scrolling */
  containerRef?: React.RefObject<HTMLElement>;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Hook for managing keyboard navigation with accessibility support
 */
export const useKeyboardNavigation = (
  options: UseKeyboardNavigationOptions
): UseKeyboardNavigationReturn => {
  const {
    itemCount,
    initialSelectedIndex = -1,
    wrap = false,
    onSelectionChange,
    onItemActivate,
    autoScroll = true,
    scrollBehavior = 'smooth',
    scrollBlock = 'nearest',
    scrollDebounceMs = 50,
    containerRef,
    disabled = false
  } = options;

  const [selectedIndex, setSelectedIndexState] = useState(initialSelectedIndex);
  const previousSelectedIndexRef = useRef(selectedIndex);

  // Debounced scroll function
  const debouncedScrollToElement = useCallback(
    debounce((element: HTMLElement) => {
      element.scrollIntoView({
        behavior: scrollBehavior,
        block: scrollBlock
      });
    }, scrollDebounceMs),
    [scrollBehavior, scrollBlock, scrollDebounceMs]
  );

  // Scroll to selected item
  const scrollToIndex = useCallback((index: number) => {
    if (!autoScroll || disabled || !containerRef?.current) return;

    const container = containerRef.current;
    const element = container.querySelector(`[data-index="${index}"]`) as HTMLElement;

    if (element) {
      debouncedScrollToElement(element);
    }
  }, [autoScroll, disabled, containerRef, debouncedScrollToElement]);

  // Set selected index with validation and side effects
  const setSelectedIndex = useCallback((index: number) => {
    if (disabled || itemCount === 0) return;

    const clampedIndex = clamp(index, -1, itemCount - 1);

    if (clampedIndex !== selectedIndex) {
      setSelectedIndexState(clampedIndex);
      onSelectionChange?.(clampedIndex);

      if (clampedIndex >= 0) {
        scrollToIndex(clampedIndex);
      }
    }
  }, [disabled, itemCount, selectedIndex, onSelectionChange, scrollToIndex]);

  // Navigation functions
  const navigateToIndex = useCallback((index: number) => {
    setSelectedIndex(index);
  }, [setSelectedIndex]);

  const navigateUp = useCallback(() => {
    if (disabled || itemCount === 0) return;

    if (selectedIndex <= 0) {
      if (wrap) {
        setSelectedIndex(itemCount - 1);
      } else {
        setSelectedIndex(0);
      }
    } else {
      setSelectedIndex(selectedIndex - 1);
    }
  }, [disabled, itemCount, selectedIndex, wrap, setSelectedIndex]);

  const navigateDown = useCallback(() => {
    if (disabled || itemCount === 0) return;

    if (selectedIndex >= itemCount - 1) {
      if (wrap) {
        setSelectedIndex(0);
      } else {
        setSelectedIndex(itemCount - 1);
      }
    } else {
      setSelectedIndex(selectedIndex + 1);
    }
  }, [disabled, itemCount, selectedIndex, wrap, setSelectedIndex]);

  const navigateToFirst = useCallback(() => {
    if (disabled || itemCount === 0) return;
    setSelectedIndex(0);
  }, [disabled, itemCount, setSelectedIndex]);

  const navigateToLast = useCallback(() => {
    if (disabled || itemCount === 0) return;
    setSelectedIndex(itemCount - 1);
  }, [disabled, itemCount, setSelectedIndex]);

  const activateItem = useCallback(() => {
    if (disabled || selectedIndex < 0 || selectedIndex >= itemCount) return;
    onItemActivate?.(selectedIndex);
  }, [disabled, selectedIndex, itemCount, onItemActivate]);

  // Keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        navigateDown();
        break;

      case 'ArrowUp':
        event.preventDefault();
        navigateUp();
        break;

      case 'Home':
        event.preventDefault();
        navigateToFirst();
        break;

      case 'End':
        event.preventDefault();
        navigateToLast();
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        activateItem();
        break;

      case 'Escape':
        event.preventDefault();
        setSelectedIndex(-1);
        break;

      case 'PageDown':
        event.preventDefault();
        // Navigate down by approximately 10 items
        setSelectedIndex(Math.min(selectedIndex + 10, itemCount - 1));
        break;

      case 'PageUp':
        event.preventDefault();
        // Navigate up by approximately 10 items
        setSelectedIndex(Math.max(selectedIndex - 10, 0));
        break;

      default:
        break;
    }
  }, [
    disabled,
    navigateDown,
    navigateUp,
    navigateToFirst,
    navigateToLast,
    activateItem,
    setSelectedIndex,
    selectedIndex,
    itemCount
  ]);

  // Update selected index when itemCount changes
  useEffect(() => {
    if (selectedIndex >= itemCount && itemCount > 0) {
      setSelectedIndex(itemCount - 1);
    } else if (selectedIndex >= 0 && itemCount === 0) {
      setSelectedIndex(-1);
    }
  }, [itemCount, selectedIndex, setSelectedIndex]);

  // Update selected index when initialSelectedIndex changes
  useEffect(() => {
    if (initialSelectedIndex !== previousSelectedIndexRef.current) {
      setSelectedIndex(initialSelectedIndex);
      previousSelectedIndexRef.current = initialSelectedIndex;
    }
  }, [initialSelectedIndex, setSelectedIndex]);

  return {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
    navigateToIndex,
    navigateToFirst,
    navigateToLast
  };
};

// Additional navigation utilities
export const createKeyboardNavigationProps = (
  navigationReturn: UseKeyboardNavigationReturn,
  options: {
    role?: string;
    ariaLabel?: string;
    ariaActivedescendant?: string;
  } = {}
) => {
  const { selectedIndex, handleKeyDown } = navigationReturn;
  const { role = 'listbox', ariaLabel, ariaActivedescendant } = options;

  return {
    role,
    tabIndex: 0,
    onKeyDown: handleKeyDown,
    'aria-label': ariaLabel,
    'aria-activedescendant': selectedIndex >= 0 ?
      (ariaActivedescendant || `item-${selectedIndex}`) : undefined
  };
};

export { UseKeyboardNavigationReturn };