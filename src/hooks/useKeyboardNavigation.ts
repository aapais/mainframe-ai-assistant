/**
 * Enhanced useKeyboardNavigation Hook
 *
 * Comprehensive keyboard navigation with accessibility support, advanced shortcuts,
 * focus management, and interaction analytics
 * @version 3.0.0
 */

import { useState, useCallback, useEffect, useRef, KeyboardEvent } from 'react';
import { trackInteraction } from '../utils/analytics';

export interface UseKeyboardNavigationOptions {
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
  /** Enable advanced keyboard shortcuts */
  enableAdvancedShortcuts?: boolean;
  /** Enable interaction analytics */
  enableAnalytics?: boolean;
  /** Announcement callback for screen readers */
  onAnnouncement?: (message: string, priority: 'polite' | 'assertive') => void;
  /** Search query for quick navigation */
  searchQuery?: string;
  /** Items data for type-ahead navigation */
  items?: Array<{ id: string; title: string; [key: string]: any }>;
  /** Enable type-ahead search */
  enableTypeAhead?: boolean;
  /** Enable vim-style navigation */
  enableVimNavigation?: boolean;
  /** Jump size for page up/down */
  jumpSize?: number;
}

export interface UseKeyboardNavigationReturn {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  navigateToIndex: (index: number, method?: string) => void;
  navigateToFirst: () => void;
  navigateToLast: () => void;
  navigateByPage: (direction: 'up' | 'down') => void;
  navigateUp: () => void;
  navigateDown: () => void;
  activateItem: () => void;
  typeAheadQuery: string;
  clearTypeAhead: () => void;
}

// Utility functions
const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

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
    disabled = false,
    enableAdvancedShortcuts = false,
    enableAnalytics = true,
    onAnnouncement,
    items,
    enableTypeAhead = false,
    enableVimNavigation = false,
    jumpSize = 10
  } = options;

  const [selectedIndex, setSelectedIndexState] = useState(initialSelectedIndex);
  const [typeAheadQuery, setTypeAheadQuery] = useState('');
  const previousSelectedIndexRef = useRef(selectedIndex);
  const typeAheadTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

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

  // Navigation functions with analytics
  const navigateToIndex = useCallback((index: number, method: string = 'direct') => {
    const oldIndex = selectedIndex;
    setSelectedIndex(index);

    if (enableAnalytics) {
      trackInteraction('keyboard_navigation', {
        action: 'navigate_to_index',
        method,
        from_index: oldIndex,
        to_index: index,
        total_items: itemCount
      });
    }

    if (onAnnouncement && index >= 0 && index < itemCount) {
      onAnnouncement(`Navigated to item ${index + 1} of ${itemCount}`, 'polite');
    }
  }, [setSelectedIndex, selectedIndex, enableAnalytics, onAnnouncement, itemCount]);

  const navigateUp = useCallback(() => {
    if (disabled || itemCount === 0) return;

    let newIndex;
    if (selectedIndex <= 0) {
      newIndex = wrap ? itemCount - 1 : 0;
    } else {
      newIndex = selectedIndex - 1;
    }

    navigateToIndex(newIndex, 'arrow_up');
  }, [disabled, itemCount, selectedIndex, wrap, navigateToIndex]);

  const navigateDown = useCallback(() => {
    if (disabled || itemCount === 0) return;

    let newIndex;
    if (selectedIndex >= itemCount - 1) {
      newIndex = wrap ? 0 : itemCount - 1;
    } else {
      newIndex = selectedIndex + 1;
    }

    navigateToIndex(newIndex, 'arrow_down');
  }, [disabled, itemCount, selectedIndex, wrap, navigateToIndex]);

  const navigateToFirst = useCallback(() => {
    if (disabled || itemCount === 0) return;
    navigateToIndex(0, 'home');
  }, [disabled, itemCount, navigateToIndex]);

  const navigateToLast = useCallback(() => {
    if (disabled || itemCount === 0) return;
    navigateToIndex(itemCount - 1, 'end');
  }, [disabled, itemCount, navigateToIndex]);

  const navigateByPage = useCallback((direction: 'up' | 'down') => {
    if (disabled || itemCount === 0) return;

    const jump = jumpSize;
    let newIndex;

    if (direction === 'up') {
      newIndex = Math.max(selectedIndex - jump, 0);
    } else {
      newIndex = Math.min(selectedIndex + jump, itemCount - 1);
    }

    navigateToIndex(newIndex, `page_${direction}`);
  }, [disabled, itemCount, selectedIndex, jumpSize, navigateToIndex]);

  const activateItem = useCallback(() => {
    if (disabled || selectedIndex < 0 || selectedIndex >= itemCount) return;

    if (enableAnalytics) {
      trackInteraction('keyboard_navigation', {
        action: 'activate_item',
        index: selectedIndex,
        total_items: itemCount
      });
    }

    onItemActivate?.(selectedIndex);

    if (onAnnouncement) {
      onAnnouncement(`Activated item ${selectedIndex + 1}`, 'assertive');
    }
  }, [disabled, selectedIndex, itemCount, onItemActivate, enableAnalytics, onAnnouncement]);

  // Type-ahead navigation
  const handleTypeAhead = useCallback((char: string) => {
    if (!enableTypeAhead || !items) return false;

    // Clear existing timeout
    if (typeAheadTimeoutRef.current) {
      clearTimeout(typeAheadTimeoutRef.current);
    }

    const newQuery = typeAheadQuery + char;
    setTypeAheadQuery(newQuery);

    // Find matching item
    const matchIndex = items.findIndex(item =>
      item.title.toLowerCase().startsWith(newQuery.toLowerCase())
    );

    if (matchIndex !== -1) {
      navigateToIndex(matchIndex, 'type_ahead');
    }

    // Clear type-ahead query after delay
    typeAheadTimeoutRef.current = setTimeout(() => {
      setTypeAheadQuery('');
    }, 1000);

    return matchIndex !== -1;
  }, [enableTypeAhead, items, typeAheadQuery, navigateToIndex]);

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
        navigateByPage('down');
        break;

      case 'PageUp':
        event.preventDefault();
        navigateByPage('up');
        break;

      // Advanced shortcuts
      case 'j':
        if (enableVimNavigation && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          navigateDown();
        }
        break;

      case 'k':
        if (enableVimNavigation && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          navigateUp();
        }
        break;

      case 'g':
        if (enableAdvancedShortcuts && event.ctrlKey) {
          event.preventDefault();
          navigateToFirst();
        }
        break;

      case 'G':
        if (enableAdvancedShortcuts && event.shiftKey) {
          event.preventDefault();
          navigateToLast();
        }
        break;

      case '/':
        if (enableAdvancedShortcuts) {
          event.preventDefault();
          // Focus search input (would need to be handled by parent)
          if (onAnnouncement) {
            onAnnouncement('Search mode activated', 'assertive');
          }
        }
        break;

      default:
        // Handle type-ahead for regular characters
        if (enableTypeAhead && event.key.length === 1 && /[a-zA-Z0-9]/.test(event.key)) {
          const handled = handleTypeAhead(event.key);
          if (handled) {
            event.preventDefault();
          }
        }
        break;
    }
  }, [
    disabled,
    navigateDown,
    navigateUp,
    navigateToFirst,
    navigateToLast,
    navigateByPage,
    activateItem,
    setSelectedIndex,
    selectedIndex,
    itemCount,
    enableAdvancedShortcuts,
    enableVimNavigation,
    enableTypeAhead,
    handleTypeAhead,
    onAnnouncement
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

  // Cleanup effect for type-ahead
  useEffect(() => {
    return () => {
      if (typeAheadTimeoutRef.current) {
        clearTimeout(typeAheadTimeoutRef.current);
      }
    };
  }, []);

  return {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
    navigateToIndex,
    navigateToFirst,
    navigateToLast,
    navigateByPage,
    navigateUp,
    navigateDown,
    activateItem,
    typeAheadQuery,
    clearTypeAhead: () => setTypeAheadQuery('')
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

export default useKeyboardNavigation;