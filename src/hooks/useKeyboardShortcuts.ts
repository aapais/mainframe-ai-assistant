/**
 * useKeyboardShortcuts Hook
 *
 * Comprehensive keyboard shortcut management with:
 * - Global and scoped shortcuts
 * - Platform-specific key combinations
 * - Accessibility considerations
 * - Context-aware activation/deactivation
 *
 * Performance optimizations:
 * - Minimal re-renders
 * - Efficient event delegation
 * - Smart cleanup
 *
 * @author Frontend Team
 * @version 1.0.0
 */

import { useEffect, useRef, useCallback, useState } from 'react';

export interface KeyboardShortcut {
  id: string;
  keys: string[];
  description: string;
  category?: string;
  handler: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  disabled?: boolean;
  global?: boolean;
  requireFocus?: boolean;
}

export interface KeyboardShortcutGroup {
  id: string;
  name: string;
  description?: string;
  shortcuts: KeyboardShortcut[];
  priority?: number;
  disabled?: boolean;
}

export interface ShortcutMatch {
  shortcut: KeyboardShortcut;
  matched: boolean;
  partialMatch?: boolean;
}

interface KeyState {
  key: string;
  timestamp: number;
}

const PLATFORM_MODIFIERS = {
  ctrl: navigator.platform.toLowerCase().includes('mac') ? 'cmd' : 'ctrl',
  cmd: navigator.platform.toLowerCase().includes('mac') ? 'cmd' : 'ctrl',
  alt: 'alt',
  shift: 'shift',
  meta: navigator.platform.toLowerCase().includes('mac') ? 'cmd' : 'meta'
};

/**
 * Normalize key combination for cross-platform compatibility
 */
function normalizeKeys(keys: string[]): string[] {
  return keys.map(key => {
    const normalized = key.toLowerCase().trim();
    return PLATFORM_MODIFIERS[normalized as keyof typeof PLATFORM_MODIFIERS] || normalized;
  });
}

/**
 * Check if key combination matches the current key state
 */
function matchesShortcut(
  event: KeyboardEvent,
  keys: string[]
): boolean {
  const normalizedKeys = normalizeKeys(keys);
  const eventKeys: string[] = [];

  // Add modifiers
  if (event.ctrlKey || event.metaKey) {
    eventKeys.push(navigator.platform.toLowerCase().includes('mac') ? 'cmd' : 'ctrl');
  }
  if (event.altKey) eventKeys.push('alt');
  if (event.shiftKey) eventKeys.push('shift');

  // Add main key
  const mainKey = event.key.toLowerCase();
  if (!['control', 'meta', 'alt', 'shift'].includes(mainKey)) {
    eventKeys.push(mainKey);
  }

  // Check if all keys match
  return normalizedKeys.length === eventKeys.length &&
         normalizedKeys.every(key => eventKeys.includes(key));
}

/**
 * Hook for managing keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[] | KeyboardShortcutGroup[],
  options: {
    enabled?: boolean;
    preventDefault?: boolean;
    stopPropagation?: boolean;
    scope?: HTMLElement | null;
    priority?: number;
  } = {}
) {
  const {
    enabled = true,
    preventDefault = true,
    stopPropagation = false,
    scope,
    priority = 0
  } = options;

  const shortcutsRef = useRef<KeyboardShortcut[]>([]);
  const keySequence = useRef<KeyState[]>([]);
  const [activeShortcuts, setActiveShortcuts] = useState<string[]>([]);

  // Flatten shortcuts from groups
  const flattenedShortcuts = Array.isArray(shortcuts)
    ? shortcuts.reduce<KeyboardShortcut[]>((acc, item) => {
        if ('shortcuts' in item) {
          return [...acc, ...item.shortcuts.filter(s => !s.disabled)];
        } else {
          return item.disabled ? acc : [...acc, item];
        }
      }, [])
    : [];

  // Update shortcuts reference
  useEffect(() => {
    shortcutsRef.current = flattenedShortcuts;
  }, [flattenedShortcuts]);

  // Clear key sequence after timeout
  const clearKeySequence = useCallback(() => {
    setTimeout(() => {
      keySequence.current = [];
    }, 1000); // Clear after 1 second of inactivity
  }, []);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const currentTime = Date.now();
    const shortcuts = shortcutsRef.current;

    // Update key sequence
    keySequence.current.push({
      key: event.key.toLowerCase(),
      timestamp: currentTime
    });

    // Find matching shortcuts
    const matches: ShortcutMatch[] = shortcuts.map(shortcut => {
      const matched = matchesShortcut(event, shortcut.keys);
      return { shortcut, matched };
    });

    // Find exact matches
    const exactMatches = matches.filter(m => m.matched);

    if (exactMatches.length > 0) {
      // Sort by priority (if any)
      const sortedMatches = exactMatches.sort((a, b) => {
        const aPriority = (a.shortcut as any).priority || 0;
        const bPriority = (b.shortcut as any).priority || 0;
        return bPriority - aPriority;
      });

      const bestMatch = sortedMatches[0];
      const { shortcut } = bestMatch;

      // Check if shortcut should be executed
      if (shortcut.requireFocus && scope && !scope.contains(document.activeElement)) {
        return;
      }

      // Prevent default if specified
      if (preventDefault || shortcut.preventDefault) {
        event.preventDefault();
      }

      // Stop propagation if specified
      if (stopPropagation || shortcut.stopPropagation) {
        event.stopPropagation();
      }

      // Execute handler
      try {
        shortcut.handler(event);
        setActiveShortcuts(prev => [...prev, shortcut.id]);

        // Remove from active after short delay
        setTimeout(() => {
          setActiveShortcuts(prev => prev.filter(id => id !== shortcut.id));
        }, 100);
      } catch (error) {
        console.error(`Error executing shortcut ${shortcut.id}:`, error);
      }
    }

    clearKeySequence();
  }, [enabled, preventDefault, stopPropagation, scope, clearKeySequence]);

  // Attach event listeners
  useEffect(() => {
    const target = scope || document;

    target.addEventListener('keydown', handleKeyDown, { passive: false });

    return () => {
      target.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, scope]);

  // Get shortcut display text
  const getShortcutText = useCallback((keys: string[]): string => {
    const normalizedKeys = normalizeKeys(keys);
    const displayKeys = normalizedKeys.map(key => {
      switch (key) {
        case 'cmd':
          return navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl';
        case 'ctrl':
          return navigator.platform.toLowerCase().includes('mac') ? 'Ctrl' : 'Ctrl';
        case 'alt':
          return navigator.platform.toLowerCase().includes('mac') ? '⌥' : 'Alt';
        case 'shift':
          return '⇧';
        case 'enter':
          return '↵';
        case 'escape':
          return 'Esc';
        case 'arrowup':
          return '↑';
        case 'arrowdown':
          return '↓';
        case 'arrowleft':
          return '←';
        case 'arrowright':
          return '→';
        default:
          return key.charAt(0).toUpperCase() + key.slice(1);
      }
    });

    return displayKeys.join('+');
  }, []);

  // Check if shortcut is currently active
  const isShortcutActive = useCallback((shortcutId: string): boolean => {
    return activeShortcuts.includes(shortcutId);
  }, [activeShortcuts]);

  // Get all shortcuts with display text
  const getShortcutsWithDisplay = useCallback(() => {
    return shortcutsRef.current.map(shortcut => ({
      ...shortcut,
      displayText: getShortcutText(shortcut.keys),
      isActive: activeShortcuts.includes(shortcut.id)
    }));
  }, [getShortcutText, activeShortcuts]);

  return {
    shortcuts: getShortcutsWithDisplay(),
    isShortcutActive,
    getShortcutText,
    activeShortcuts
  };
}

/**
 * Hook for common search shortcuts
 */
export function useSearchShortcuts(callbacks: {
  onFocusSearch?: () => void;
  onClearSearch?: () => void;
  onNextResult?: () => void;
  onPrevResult?: () => void;
  onSelectResult?: () => void;
  onToggleFilters?: () => void;
  onOpenHelp?: () => void;
}) {
  const shortcuts: KeyboardShortcut[] = [
    {
      id: 'focus-search',
      keys: ['ctrl', 'k'],
      description: 'Focus search input',
      category: 'Search',
      handler: () => callbacks.onFocusSearch?.(),
      global: true
    },
    {
      id: 'focus-search-alt',
      keys: ['/'],
      description: 'Focus search input (alternative)',
      category: 'Search',
      handler: () => callbacks.onFocusSearch?.(),
      global: true
    },
    {
      id: 'clear-search',
      keys: ['escape'],
      description: 'Clear search input',
      category: 'Search',
      handler: () => callbacks.onClearSearch?.(),
      requireFocus: true
    },
    {
      id: 'next-result',
      keys: ['arrowdown'],
      description: 'Navigate to next result',
      category: 'Search',
      handler: () => callbacks.onNextResult?.(),
      requireFocus: true
    },
    {
      id: 'prev-result',
      keys: ['arrowup'],
      description: 'Navigate to previous result',
      category: 'Search',
      handler: () => callbacks.onPrevResult?.(),
      requireFocus: true
    },
    {
      id: 'select-result',
      keys: ['enter'],
      description: 'Select current result',
      category: 'Search',
      handler: () => callbacks.onSelectResult?.(),
      requireFocus: true
    },
    {
      id: 'toggle-filters',
      keys: ['ctrl', 'f'],
      description: 'Toggle search filters',
      category: 'Search',
      handler: () => callbacks.onToggleFilters?.()
    },
    {
      id: 'open-help',
      keys: ['?'],
      description: 'Open keyboard shortcuts help',
      category: 'Help',
      handler: () => callbacks.onOpenHelp?.(),
      global: true
    }
  ];

  return useKeyboardShortcuts(shortcuts);
}