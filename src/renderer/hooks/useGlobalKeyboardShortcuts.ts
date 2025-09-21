/**
 * Global Keyboard Shortcuts Hook
 *
 * Implements comprehensive keyboard shortcuts for enhanced search experience:
 * - Global shortcuts work across the entire application
 * - Context-aware shortcuts that respect input focus
 * - Smart conflict resolution and priority handling
 * - Accessibility compliant keyboard navigation
 */

import { useEffect, useCallback, useRef } from 'react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

export interface GlobalShortcutHandlers {
  onGlobalSearch?: () => void;
  onCommandPalette?: () => void;
  onFocusSearch?: () => void;
  onEscape?: () => void;
  onHelp?: () => void;
  onQuickNav?: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

export interface GlobalKeyboardShortcutsOptions {
  enabled?: boolean;
  enableGlobalSearch?: boolean;
  enableCommandPalette?: boolean;
  enableQuickNav?: boolean;
  searchInputSelector?: string;
  debug?: boolean;
}

/**
 * Hook for managing global keyboard shortcuts
 */
export const useGlobalKeyboardShortcuts = (
  handlers: GlobalShortcutHandlers,
  options: GlobalKeyboardShortcutsOptions = {}
) => {
  const {
    enabled = true,
    enableGlobalSearch = true,
    enableCommandPalette = true,
    enableQuickNav = true,
    searchInputSelector = 'input[type="text"], input[type="search"], textarea',
    debug = false
  } = options;

  const lastActiveElement = useRef<Element | null>(null);
  const shortcutTriggered = useRef(false);

  // Logging for debugging
  const log = useCallback((message: string, ...args: any[]) => {
    if (debug) {
      console.log(`[GlobalKeyboardShortcuts] ${message}`, ...args);
    }
  }, [debug]);

  // Check if element is a search input
  const isSearchInput = useCallback((element: Element | null): boolean => {
    if (!element) return false;
    return element.matches(searchInputSelector);
  }, [searchInputSelector]);

  // Focus search input with smart selection
  const focusSearchInput = useCallback(() => {
    const searchInputs = document.querySelectorAll(searchInputSelector);

    // Try to find the most relevant search input
    let targetInput: HTMLElement | null = null;

    // Priority 1: Visible search input in main content
    for (const input of Array.from(searchInputs)) {
      const htmlInput = input as HTMLElement;
      const rect = htmlInput.getBoundingClientRect();

      if (rect.width > 0 && rect.height > 0 && !htmlInput.hidden) {
        // Check if it's in main content area (not sidebar or modal)
        const isMainContent = !htmlInput.closest('[role="dialog"], .sidebar, .nav');
        if (isMainContent) {
          targetInput = htmlInput;
          break;
        }
      }
    }

    // Priority 2: Any visible search input
    if (!targetInput) {
      for (const input of Array.from(searchInputs)) {
        const htmlInput = input as HTMLElement;
        const rect = htmlInput.getBoundingClientRect();

        if (rect.width > 0 && rect.height > 0 && !htmlInput.hidden) {
          targetInput = htmlInput;
          break;
        }
      }
    }

    if (targetInput) {
      log('Focusing search input:', targetInput);
      targetInput.focus();

      // Select all text if it's an input field
      if (targetInput instanceof HTMLInputElement || targetInput instanceof HTMLTextAreaElement) {
        targetInput.select();
      }

      return true;
    }

    log('No search input found to focus');
    return false;
  }, [searchInputSelector, log]);

  // Handle escape key with smart behavior
  const handleEscape = useCallback(() => {
    const activeElement = document.activeElement;

    // If we're in a search input, clear it first, then blur
    if (isSearchInput(activeElement)) {
      const input = activeElement as HTMLInputElement | HTMLTextAreaElement;
      if (input.value) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        log('Cleared search input');
      } else {
        input.blur();
        log('Blurred search input');
      }
    } else {
      // Otherwise, call the provided escape handler
      handlers.onEscape?.();
    }
  }, [isSearchInput, handlers.onEscape, log]);

  // Handle forward slash for search focus
  const handleSlashSearch = useCallback((event: KeyboardEvent) => {
    // Don't interfere if we're already typing in an input
    const activeElement = document.activeElement;
    if (isSearchInput(activeElement)) {
      log('Slash ignored - already in search input');
      return;
    }

    // Don't interfere with other input types
    if (activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.getAttribute('contenteditable') === 'true') {
      log('Slash ignored - in editable element');
      return;
    }

    event.preventDefault();
    shortcutTriggered.current = true;

    if (focusSearchInput()) {
      handlers.onGlobalSearch?.();
      log('Triggered global search with slash');
    }

    // Reset flag after a brief delay
    setTimeout(() => {
      shortcutTriggered.current = false;
    }, 100);
  }, [isSearchInput, focusSearchInput, handlers.onGlobalSearch, log]);

  // Handle command palette shortcut
  const handleCommandPalette = useCallback((event: KeyboardEvent) => {
    event.preventDefault();
    log('Command palette triggered');

    if (handlers.onCommandPalette) {
      handlers.onCommandPalette();
    } else {
      // Fallback to search focus
      focusSearchInput();
      handlers.onGlobalSearch?.();
    }
  }, [handlers.onCommandPalette, handlers.onGlobalSearch, focusSearchInput, log]);

  // Handle quick navigation
  const handleQuickNav = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    return (event: KeyboardEvent) => {
      // Only handle if not in an input field
      const activeElement = document.activeElement;
      if (activeElement?.tagName === 'INPUT' ||
          activeElement?.tagName === 'TEXTAREA' ||
          activeElement?.getAttribute('contenteditable') === 'true') {
        return;
      }

      event.preventDefault();
      log(`Quick navigation: ${direction}`);
      handlers.onQuickNav?.(direction);
    };
  }, [handlers.onQuickNav, log]);

  // Define global shortcuts
  const globalShortcuts = {
    '/': {
      key: '/',
      description: 'Focus search input',
      handler: handleSlashSearch,
      enabled: enableGlobalSearch,
      preventDefault: false // We handle this manually for better control
    },
    'ctrl+k': {
      key: 'ctrl+k',
      description: 'Open command palette / Focus search',
      handler: handleCommandPalette,
      enabled: enableCommandPalette
    },
    'cmd+k': {
      key: 'cmd+k',
      description: 'Open command palette / Focus search',
      handler: handleCommandPalette,
      enabled: enableCommandPalette
    },
    'escape': {
      key: 'escape',
      description: 'Clear search / Close modals / Blur inputs',
      handler: handleEscape,
      enabled: true,
      preventDefault: false // We handle this manually
    },
    'f3': {
      key: 'f3',
      description: 'Focus search input',
      handler: () => {
        focusSearchInput();
        handlers.onFocusSearch?.();
      },
      enabled: enableGlobalSearch
    },
    // Quick navigation (only when not in input fields)
    'j': {
      key: 'j',
      description: 'Navigate down',
      handler: handleQuickNav('down'),
      enabled: enableQuickNav,
      context: 'navigation'
    },
    'k': {
      key: 'k',
      description: 'Navigate up',
      handler: handleQuickNav('up'),
      enabled: enableQuickNav,
      context: 'navigation'
    },
    'h': {
      key: 'h',
      description: 'Navigate left',
      handler: handleQuickNav('left'),
      enabled: enableQuickNav,
      context: 'navigation'
    },
    'l': {
      key: 'l',
      description: 'Navigate right',
      handler: handleQuickNav('right'),
      enabled: enableQuickNav,
      context: 'navigation'
    },
    'f1': {
      key: 'f1',
      description: 'Show help / keyboard shortcuts',
      handler: () => handlers.onHelp?.(),
      enabled: !!handlers.onHelp
    }
  };

  // Use the existing keyboard shortcuts hook
  const keyboardHook = useKeyboardShortcuts(globalShortcuts, {
    enabled,
    context: 'global',
    priority: 10 // High priority for global shortcuts
  });

  // Track active element changes for better context awareness
  useEffect(() => {
    const handleFocusChange = () => {
      const newActiveElement = document.activeElement;
      if (newActiveElement !== lastActiveElement.current) {
        log('Focus changed:', {
          from: lastActiveElement.current?.tagName,
          to: newActiveElement?.tagName,
          isSearchInput: isSearchInput(newActiveElement)
        });
        lastActiveElement.current = newActiveElement;
      }
    };

    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('focusout', handleFocusChange);

    return () => {
      document.removeEventListener('focusin', handleFocusChange);
      document.removeEventListener('focusout', handleFocusChange);
    };
  }, [isSearchInput, log]);

  // Handle prevention of slash character insertion when triggered by shortcut
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === '/' && shortcutTriggered.current) {
        event.preventDefault();
        log('Prevented slash insertion after shortcut trigger');
      }
    };

    document.addEventListener('keypress', handleKeyPress, true);

    return () => {
      document.removeEventListener('keypress', handleKeyPress, true);
    };
  }, [log]);

  return {
    ...keyboardHook,
    focusSearchInput,
    isSearchInput,

    // Additional utilities
    getActiveSearchInput: () => {
      const activeElement = document.activeElement;
      return isSearchInput(activeElement) ? activeElement as HTMLElement : null;
    },

    getAllSearchInputs: () => {
      return Array.from(document.querySelectorAll(searchInputSelector)) as HTMLElement[];
    }
  };
};

export default useGlobalKeyboardShortcuts;