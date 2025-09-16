/**
 * useKeyboardShortcuts - Enhanced keyboard shortcuts hook
 *
 * Features:
 * - Cross-platform keyboard shortcuts (Ctrl/Cmd)
 * - Context-aware shortcut activation
 * - Shortcut conflict detection and resolution
 * - Accessibility compliance
 * - Visual shortcut hints
 */

import { useEffect, useCallback, useRef, useMemo } from 'react';

export interface KeyboardShortcut {
  key: string;
  description: string;
  handler: (event: KeyboardEvent) => void;
  context?: string;
  preventDefault?: boolean;
  enabled?: boolean;
}

export interface KeyboardShortcutOptions {
  enabled?: boolean;
  preventDefault?: boolean;
  context?: string;
  priority?: number;
}

type ShortcutMap = Record<string, KeyboardShortcut>;

// Platform-specific modifier keys
const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
const primaryModifier = isMac ? 'cmd' : 'ctrl';

export const useKeyboardShortcuts = (
  shortcuts: ShortcutMap,
  options: KeyboardShortcutOptions = {}
) => {
  const {
    enabled = true,
    preventDefault = true,
    context,
    priority = 0
  } = options;

  const shortcutsRef = useRef<ShortcutMap>(shortcuts);
  const optionsRef = useRef(options);

  // Update refs when props change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
    optionsRef.current = options;
  }, [shortcuts, options]);

  // Normalize keyboard event to shortcut string
  const normalizeShortcut = useCallback((event: KeyboardEvent): string => {
    const parts: string[] = [];

    // Add modifiers in consistent order
    if (event.ctrlKey && !isMac) parts.push('ctrl');
    if (event.metaKey && isMac) parts.push('cmd');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');

    // Add the main key
    const key = event.key.toLowerCase();

    // Handle special keys
    const specialKeys: Record<string, string> = {
      'arrowup': 'up',
      'arrowdown': 'down',
      'arrowleft': 'left',
      'arrowright': 'right',
      'escape': 'esc',
      ' ': 'space'
    };

    parts.push(specialKeys[key] || key);

    return parts.join('+');
  }, []);

  // Parse shortcut string to check for matches
  const parseShortcut = useCallback((shortcutString: string): string => {
    // Normalize common variations
    return shortcutString
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/command/g, 'cmd')
      .replace(/control/g, 'ctrl')
      .replace(/option/g, 'alt')
      .replace(/\+/g, '+')
      .replace(/ctrl\+k/g, primaryModifier + '+k') // Platform-specific normalization
      .replace(/ctrl\+/g, primaryModifier === 'cmd' ? 'cmd+' : 'ctrl+');
  }, []);

  // Check if shortcut should be active in current context
  const isShortcutActive = useCallback((shortcut: KeyboardShortcut): boolean => {
    // Check if globally enabled
    if (!enabled) return false;

    // Check if specific shortcut is enabled
    if (shortcut.enabled === false) return false;

    // Check context matching
    if (shortcut.context && context && shortcut.context !== context) {
      return false;
    }

    // Check if we're in an input field (usually want to ignore shortcuts)
    const activeElement = document.activeElement;
    if (activeElement &&
        (activeElement.tagName === 'INPUT' ||
         activeElement.tagName === 'TEXTAREA' ||
         activeElement.getAttribute('contenteditable') === 'true')) {
      // Allow specific shortcuts even in input fields
      const allowedInInputs = ['escape', 'ctrl+enter', 'cmd+enter'];
      const normalizedKey = parseShortcut(Object.keys(shortcutsRef.current).find(k =>
        shortcutsRef.current[k] === shortcut
      ) || '');

      if (!allowedInInputs.some(allowed => normalizedKey.includes(allowed))) {
        return false;
      }
    }

    return true;
  }, [enabled, context, parseShortcut]);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const shortcutKey = normalizeShortcut(event);

    // Find matching shortcut
    const matchingShortcuts = Object.entries(shortcutsRef.current)
      .filter(([key, shortcut]) => {
        const normalizedKey = parseShortcut(key);
        const eventKey = parseShortcut(shortcutKey);
        return normalizedKey === eventKey && isShortcutActive(shortcut);
      })
      .sort(([, a], [, b]) => (b as any).priority - (a as any).priority); // Sort by priority

    if (matchingShortcuts.length > 0) {
      const [, shortcut] = matchingShortcuts[0]; // Take highest priority

      // Prevent default if requested
      if (shortcut.preventDefault !== false && preventDefault) {
        event.preventDefault();
        event.stopPropagation();
      }

      // Execute handler
      try {
        shortcut.handler(event);
      } catch (error) {
        console.error('Keyboard shortcut handler error:', error);
      }
    }
  }, [normalizeShortcut, parseShortcut, isShortcutActive, preventDefault]);

  // Set up event listeners
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, handleKeyDown]);

  // Generate shortcut help text
  const getShortcutHelp = useCallback(() => {
    return Object.entries(shortcuts)
      .filter(([, shortcut]) => isShortcutActive(shortcut))
      .map(([key, shortcut]) => ({
        key: key.replace('ctrl', primaryModifier.toUpperCase()),
        description: shortcut.description,
        context: shortcut.context
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [shortcuts, isShortcutActive]);

  // Check for shortcut conflicts
  const getConflicts = useCallback(() => {
    const conflicts: Array<{ shortcuts: string[]; description: string }> = [];
    const normalized = Object.entries(shortcuts).map(([key, shortcut]) => ({
      original: key,
      normalized: parseShortcut(key),
      shortcut
    }));

    for (let i = 0; i < normalized.length; i++) {
      for (let j = i + 1; j < normalized.length; j++) {
        if (normalized[i].normalized === normalized[j].normalized &&
            isShortcutActive(normalized[i].shortcut) &&
            isShortcutActive(normalized[j].shortcut)) {
          conflicts.push({
            shortcuts: [normalized[i].original, normalized[j].original],
            description: `Conflicting shortcuts: ${normalized[i].shortcut.description} vs ${normalized[j].shortcut.description}`
          });
        }
      }
    }

    return conflicts;
  }, [shortcuts, parseShortcut, isShortcutActive]);

  // Register a new shortcut dynamically
  const registerShortcut = useCallback((
    key: string,
    handler: (event: KeyboardEvent) => void,
    description: string,
    options?: Partial<KeyboardShortcut>
  ) => {
    shortcutsRef.current = {
      ...shortcutsRef.current,
      [key]: {
        key,
        description,
        handler,
        ...options
      }
    };
  }, []);

  // Unregister a shortcut
  const unregisterShortcut = useCallback((key: string) => {
    const newShortcuts = { ...shortcutsRef.current };
    delete newShortcuts[key];
    shortcutsRef.current = newShortcuts;
  }, []);

  // Format shortcut for display
  const formatShortcutDisplay = useCallback((shortcutKey: string): string => {
    return shortcutKey
      .replace(/ctrl/gi, isMac ? '⌘' : 'Ctrl')
      .replace(/cmd/gi, '⌘')
      .replace(/shift/gi, isMac ? '⇧' : 'Shift')
      .replace(/alt/gi, isMac ? '⌥' : 'Alt')
      .replace(/enter/gi, isMac ? '⏎' : 'Enter')
      .replace(/escape/gi, isMac ? '⎋' : 'Esc')
      .replace(/\+/g, isMac ? '' : ' + ')
      .toUpperCase();
  }, []);

  return {
    // State
    enabled,
    context,
    shortcuts: shortcutsRef.current,

    // Utilities
    getShortcutHelp,
    getConflicts,
    formatShortcutDisplay,

    // Dynamic management
    registerShortcut,
    unregisterShortcut,

    // Internal utilities (exposed for testing)
    normalizeShortcut,
    parseShortcut,
    isShortcutActive
  };
};

// Hook for specific keyboard navigation patterns
export const useKeyboardNavigation = (handlers: {
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onEnter?: () => void;
  onEscape?: () => void;
  onSpace?: () => void;
  onTab?: () => void;
  enabled?: boolean;
}) => {
  const {
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onEnter,
    onEscape,
    onSpace,
    onTab,
    enabled = true
  } = handlers;

  const navigationShortcuts = useMemo(() => {
    const shortcuts: ShortcutMap = {};

    if (onArrowUp) shortcuts['up'] = { key: 'up', description: 'Navigate up', handler: onArrowUp };
    if (onArrowDown) shortcuts['down'] = { key: 'down', description: 'Navigate down', handler: onArrowDown };
    if (onArrowLeft) shortcuts['left'] = { key: 'left', description: 'Navigate left', handler: onArrowLeft };
    if (onArrowRight) shortcuts['right'] = { key: 'right', description: 'Navigate right', handler: onArrowRight };
    if (onEnter) shortcuts['enter'] = { key: 'enter', description: 'Select/Enter', handler: onEnter };
    if (onEscape) shortcuts['escape'] = { key: 'escape', description: 'Cancel/Close', handler: onEscape };
    if (onSpace) shortcuts['space'] = { key: 'space', description: 'Activate', handler: onSpace };
    if (onTab) shortcuts['tab'] = { key: 'tab', description: 'Next item', handler: onTab, preventDefault: false };

    return shortcuts;
  }, [onArrowUp, onArrowDown, onArrowLeft, onArrowRight, onEnter, onEscape, onSpace, onTab]);

  return useKeyboardShortcuts(navigationShortcuts, {
    enabled,
    context: 'navigation',
    priority: 1
  });
};