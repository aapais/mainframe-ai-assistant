import { SearchResult } from './SearchResultCard';

export interface KeyboardHandlers {
  onArrowDown: () => void;
  onArrowUp: () => void;
  onEnter: () => void;
  onSpace: () => void;
  onEscape: () => void;
  onHome: () => void;
  onEnd: () => void;
  onPageUp: () => void;
  onPageDown: () => void;
}

export interface SearchInteractionHandlers {
  onResultOpen: (result: SearchResult) => void;
  onResultExpand: (id: string) => void;
  onResultCollapse: (id: string) => void;
  onResultSelect: (id: string) => void;
  onResultFocus: (id: string) => void;
  onResultHover: (id: string) => void;
  onResultLeave: (id: string) => void;
}

export interface FilterInteractionHandlers {
  onFilterApply: (groupId: string, optionId: string, isSelected: boolean) => void;
  onFilterClear: (groupId?: string) => void;
  onFilterGroupToggle: (groupId: string) => void;
  onFilterSearch: (term: string) => void;
}

/**
 * Creates keyboard event handlers for search result navigation
 */
export function createKeyboardHandlers(
  currentIndex: number,
  totalResults: number,
  onIndexChange: (index: number) => void,
  onActivate: () => void,
  onToggleExpand: () => void,
  onClearSelection: () => void
): KeyboardHandlers {
  return {
    onArrowDown: () => {
      const nextIndex = Math.min(currentIndex + 1, totalResults - 1);
      onIndexChange(nextIndex);
    },

    onArrowUp: () => {
      const prevIndex = Math.max(currentIndex - 1, 0);
      onIndexChange(prevIndex);
    },

    onEnter: () => {
      onActivate();
    },

    onSpace: () => {
      onToggleExpand();
    },

    onEscape: () => {
      onClearSelection();
    },

    onHome: () => {
      onIndexChange(0);
    },

    onEnd: () => {
      onIndexChange(totalResults - 1);
    },

    onPageUp: () => {
      const newIndex = Math.max(currentIndex - 10, 0);
      onIndexChange(newIndex);
    },

    onPageDown: () => {
      const newIndex = Math.min(currentIndex + 10, totalResults - 1);
      onIndexChange(newIndex);
    }
  };
}

/**
 * Handles keyboard events for search results
 */
export function handleSearchKeydown(
  event: KeyboardEvent,
  handlers: KeyboardHandlers
): boolean {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      handlers.onArrowDown();
      return true;

    case 'ArrowUp':
      event.preventDefault();
      handlers.onArrowUp();
      return true;

    case 'Enter':
      event.preventDefault();
      handlers.onEnter();
      return true;

    case ' ':
      event.preventDefault();
      handlers.onSpace();
      return true;

    case 'Escape':
      event.preventDefault();
      handlers.onEscape();
      return true;

    case 'Home':
      if (event.ctrlKey) {
        event.preventDefault();
        handlers.onHome();
        return true;
      }
      break;

    case 'End':
      if (event.ctrlKey) {
        event.preventDefault();
        handlers.onEnd();
        return true;
      }
      break;

    case 'PageUp':
      event.preventDefault();
      handlers.onPageUp();
      return true;

    case 'PageDown':
      event.preventDefault();
      handlers.onPageDown();
      return true;

    default:
      return false;
  }

  return false;
}

/**
 * Creates mouse/touch interaction handlers
 */
export function createInteractionHandlers(
  onResultOpen: (result: SearchResult) => void,
  onResultExpand: (id: string) => void,
  onResultCollapse: (id: string) => void
): SearchInteractionHandlers {
  return {
    onResultOpen,
    onResultExpand,
    onResultCollapse,

    onResultSelect: (id: string) => {
      // Selection logic would be implemented here
      console.log('Result selected:', id);
    },

    onResultFocus: (id: string) => {
      // Focus management logic
      const element = document.getElementById(`result-${id}`);
      element?.focus();
    },

    onResultHover: (id: string) => {
      // Hover effects, tooltips, etc.
      const element = document.getElementById(`result-${id}`);
      element?.classList.add('hovered');
    },

    onResultLeave: (id: string) => {
      // Clean up hover effects
      const element = document.getElementById(`result-${id}`);
      element?.classList.remove('hovered');
    }
  };
}

/**
 * Debounce utility for search input
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate?: boolean
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };

    const callNow = immediate && !timeout;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(later, wait);

    if (callNow) {
      func(...args);
    }
  };
}

/**
 * Throttle utility for scroll events
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Focus management utilities
 */
export class FocusManager {
  private focusableSelectors = [
    'button',
    '[href]',
    'input',
    'select',
    'textarea',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll(this.focusableSelectors))
      .filter(el => !el.hasAttribute('disabled') && this.isVisible(el)) as HTMLElement[];
  }

  private isVisible(element: Element): boolean {
    const style = getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0';
  }

  trapFocus(container: HTMLElement, event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const focusableElements = this.getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  }

  restoreFocus(previousElement: HTMLElement | null): void {
    if (previousElement && this.isVisible(previousElement)) {
      previousElement.focus();
    }
  }
}