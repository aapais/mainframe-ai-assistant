/**
 * Keyboard Navigation Context
 * Provides global keyboard state management and navigation utilities
 */

import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import { focusManager, FocusTrap, RovingTabindex, SkipLinks } from '../utils/focusManager';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  description: string;
  action: () => void;
  scope?: string;
  disabled?: boolean;
}

export interface KeyboardState {
  isKeyboardMode: boolean;
  showKeyboardHelp: boolean;
  registeredShortcuts: Map<string, KeyboardShortcut>;
  activeScope: string | null;
  visualFocusEnabled: boolean;
  skipLinksCreated: boolean;
  focusVisible: boolean;
}

export type KeyboardAction =
  | { type: 'SET_KEYBOARD_MODE'; payload: boolean }
  | { type: 'TOGGLE_KEYBOARD_HELP' }
  | { type: 'REGISTER_SHORTCUT'; payload: KeyboardShortcut }
  | { type: 'UNREGISTER_SHORTCUT'; payload: string }
  | { type: 'SET_ACTIVE_SCOPE'; payload: string | null }
  | { type: 'SET_VISUAL_FOCUS_ENABLED'; payload: boolean }
  | { type: 'SET_SKIP_LINKS_CREATED'; payload: boolean }
  | { type: 'SET_FOCUS_VISIBLE'; payload: boolean }
  | { type: 'CLEAR_SHORTCUTS'; payload: string };

export interface KeyboardContextValue {
  state: KeyboardState;
  dispatch: React.Dispatch<KeyboardAction>;
  registerShortcut: (shortcut: KeyboardShortcut) => void;
  unregisterShortcut: (id: string) => void;
  setKeyboardMode: (enabled: boolean) => void;
  toggleKeyboardHelp: () => void;
  setActiveScope: (scope: string | null) => void;
  createFocusTrap: (container: HTMLElement, config?: any) => FocusTrap;
  createRovingTabindex: (container: HTMLElement, config?: any) => RovingTabindex;
  createSkipLinks: (links: Array<{ href: string; text: string }>) => void;
  focusFirst: (container?: HTMLElement) => HTMLElement | null;
  focusLast: (container?: HTMLElement) => HTMLElement | null;
  isKeyboardOnlyMode: () => boolean;
}

const initialState: KeyboardState = {
  isKeyboardMode: false,
  showKeyboardHelp: false,
  registeredShortcuts: new Map(),
  activeScope: null,
  visualFocusEnabled: true,
  skipLinksCreated: false,
  focusVisible: false,
};

function keyboardReducer(state: KeyboardState, action: KeyboardAction): KeyboardState {
  switch (action.type) {
    case 'SET_KEYBOARD_MODE':
      return { ...state, isKeyboardMode: action.payload };

    case 'TOGGLE_KEYBOARD_HELP':
      return { ...state, showKeyboardHelp: !state.showKeyboardHelp };

    case 'REGISTER_SHORTCUT': {
      const shortcut = action.payload;
      const id = `${shortcut.scope || 'global'}-${shortcut.key}-${!!shortcut.ctrlKey}-${!!shortcut.altKey}-${!!shortcut.metaKey}-${!!shortcut.shiftKey}`;
      const newShortcuts = new Map(state.registeredShortcuts);
      newShortcuts.set(id, shortcut);
      return { ...state, registeredShortcuts: newShortcuts };
    }

    case 'UNREGISTER_SHORTCUT': {
      const newShortcuts = new Map(state.registeredShortcuts);
      newShortcuts.delete(action.payload);
      return { ...state, registeredShortcuts: newShortcuts };
    }

    case 'SET_ACTIVE_SCOPE':
      return { ...state, activeScope: action.payload };

    case 'SET_VISUAL_FOCUS_ENABLED':
      return { ...state, visualFocusEnabled: action.payload };

    case 'SET_SKIP_LINKS_CREATED':
      return { ...state, skipLinksCreated: action.payload };

    case 'SET_FOCUS_VISIBLE':
      return { ...state, focusVisible: action.payload };

    case 'CLEAR_SHORTCUTS': {
      const newShortcuts = new Map(state.registeredShortcuts);
      const scopeToRemove = action.payload;

      for (const [id, shortcut] of newShortcuts.entries()) {
        if (shortcut.scope === scopeToRemove) {
          newShortcuts.delete(id);
        }
      }

      return { ...state, registeredShortcuts: newShortcuts };
    }

    default:
      return state;
  }
}

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

export interface KeyboardProviderProps {
  children: ReactNode;
  enableSkipLinks?: boolean;
  skipLinks?: Array<{ href: string; text: string }>;
}

// Export useModalNavigation hook
export function useModalNavigation() {
  const { state, dispatch } = useKeyboard();

  return {
    isActive: state.showKeyboardHelp,
    open: () => dispatch({ type: 'TOGGLE_KEYBOARD_HELP' }),
    close: () => dispatch({ type: 'TOGGLE_KEYBOARD_HELP' })
  };
}

export function KeyboardProvider({
  children,
  enableSkipLinks = true,
  skipLinks = [
    { href: '#main-content', text: 'Skip to main content' },
    { href: '#search', text: 'Skip to search' },
    { href: '#navigation', text: 'Skip to navigation' }
  ]
}: KeyboardProviderProps) {
  const [state, dispatch] = useReducer(keyboardReducer, initialState);
  const keydownListenerRef = useRef<((event: KeyboardEvent) => void) | null>(null);

  // Initialize keyboard detection and global listeners
  useEffect(() => {
    // Create skip links
    if (enableSkipLinks && !state.skipLinksCreated) {
      SkipLinks.createSkipLinks(skipLinks);
      dispatch({ type: 'SET_SKIP_LINKS_CREATED', payload: true });
    }

    // Listen for focus visibility changes
    const handleFocusVisible = () => {
      dispatch({ type: 'SET_FOCUS_VISIBLE', payload: focusManager.isKeyboardOnlyMode() });
    };

    // Listen for keyboard mode changes
    const handleKeyboardMode = () => {
      dispatch({ type: 'SET_KEYBOARD_MODE', payload: focusManager.isKeyboardOnlyMode() });
    };

    // Listen for keyboard help toggle
    const handleKeyboardHelpToggle = () => {
      dispatch({ type: 'TOGGLE_KEYBOARD_HELP' });
    };

    // Listen for quick search focus
    const handleQuickSearchFocus = () => {
      const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    };

    // Set up global event listeners
    window.addEventListener('keyboard-help-toggle', handleKeyboardHelpToggle);
    window.addEventListener('quick-search-focus', handleQuickSearchFocus);

    // Set up periodic checks for keyboard mode
    const modeCheckInterval = setInterval(() => {
      handleKeyboardMode();
      handleFocusVisible();
    }, 1000);

    // Global keydown handler for shortcuts
    const handleGlobalKeydown = (event: KeyboardEvent) => {
      const { key, ctrlKey, altKey, metaKey, shiftKey } = event;
      const modKey = ctrlKey || metaKey;

      // Skip if typing in input (unless it's a modifier combination)
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (isInput && !modKey && key !== 'Escape') return;

      // Find matching shortcut
      for (const [id, shortcut] of state.registeredShortcuts.entries()) {
        if (shortcut.disabled) continue;

        // Check if shortcut matches current scope
        if (shortcut.scope && shortcut.scope !== state.activeScope && shortcut.scope !== 'global') {
          continue;
        }

        // Check key combination
        const keyMatches = shortcut.key.toLowerCase() === key.toLowerCase();
        const ctrlMatches = !!shortcut.ctrlKey === ctrlKey;
        const altMatches = !!shortcut.altKey === altKey;
        const metaMatches = !!shortcut.metaKey === metaKey;
        const shiftMatches = !!shortcut.shiftKey === shiftKey;

        if (keyMatches && ctrlMatches && altMatches && metaMatches && shiftMatches) {
          event.preventDefault();
          event.stopPropagation();
          shortcut.action();
          break;
        }
      }
    };

    keydownListenerRef.current = handleGlobalKeydown;
    document.addEventListener('keydown', handleGlobalKeydown, true);

    return () => {
      window.removeEventListener('keyboard-help-toggle', handleKeyboardHelpToggle);
      window.removeEventListener('quick-search-focus', handleQuickSearchFocus);
      clearInterval(modeCheckInterval);

      if (keydownListenerRef.current) {
        document.removeEventListener('keydown', keydownListenerRef.current, true);
      }
    };
  }, [state.registeredShortcuts, state.activeScope, enableSkipLinks, skipLinks, state.skipLinksCreated]);

  // Context value
  const contextValue: KeyboardContextValue = {
    state,
    dispatch,

    registerShortcut: (shortcut: KeyboardShortcut) => {
      dispatch({ type: 'REGISTER_SHORTCUT', payload: shortcut });
    },

    unregisterShortcut: (id: string) => {
      dispatch({ type: 'UNREGISTER_SHORTCUT', payload: id });
    },

    setKeyboardMode: (enabled: boolean) => {
      dispatch({ type: 'SET_KEYBOARD_MODE', payload: enabled });
    },

    toggleKeyboardHelp: () => {
      dispatch({ type: 'TOGGLE_KEYBOARD_HELP' });
    },

    setActiveScope: (scope: string | null) => {
      dispatch({ type: 'SET_ACTIVE_SCOPE', payload: scope });
    },

    createFocusTrap: (container: HTMLElement, config?: any) => {
      return focusManager.createFocusTrap(container, config);
    },

    createRovingTabindex: (container: HTMLElement, config?: any) => {
      return new RovingTabindex(container, config);
    },

    createSkipLinks: (links: Array<{ href: string; text: string }>) => {
      SkipLinks.createSkipLinks(links);
      dispatch({ type: 'SET_SKIP_LINKS_CREATED', payload: true });
    },

    focusFirst: (container?: HTMLElement) => {
      return focusManager.focusFirst(container);
    },

    focusLast: (container?: HTMLElement) => {
      return focusManager.focusLast(container);
    },

    isKeyboardOnlyMode: () => {
      return focusManager.isKeyboardOnlyMode();
    },
  };

  return (
    <KeyboardContext.Provider value={contextValue}>
      {children}
    </KeyboardContext.Provider>
  );
}

export function useKeyboard() {
  const context = useContext(KeyboardContext);
  if (!context) {
    throw new Error('useKeyboard must be used within a KeyboardProvider');
  }
  return context;
}

/**
 * Hook for managing component-specific keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  scope?: string,
  dependencies: any[] = []
) {
  const { state, registerShortcut, unregisterShortcut, setActiveScope, dispatch } = useKeyboard();

  useEffect(() => {
    const registeredIds: string[] = [];

    // Register shortcuts
    shortcuts.forEach(shortcut => {
      const scopedShortcut = { ...shortcut, scope: scope || shortcut.scope || 'global' };
      registerShortcut(scopedShortcut);

      const id = `${scopedShortcut.scope}-${scopedShortcut.key}-${!!scopedShortcut.ctrlKey}-${!!scopedShortcut.altKey}-${!!scopedShortcut.metaKey}-${!!scopedShortcut.shiftKey}`;
      registeredIds.push(id);
    });

    // Set active scope if provided
    if (scope) {
      setActiveScope(scope);
    }

    return () => {
      // Cleanup: unregister shortcuts when component unmounts
      // Don't call unregisterShortcut here as it triggers dispatch and causes loops
      // Simply clear the array, no need to access state here
      registeredIds.length = 0;
    };
  }, []); // Empty dependency array - shortcuts are registered once on mount
}

/**
 * Hook for focus trap management
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  active: boolean,
  config?: any
) {
  const { createFocusTrap } = useKeyboard();
  const trapRef = useRef<FocusTrap | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (active) {
      trapRef.current = createFocusTrap(containerRef.current, config);
    } else {
      if (trapRef.current) {
        trapRef.current.destroy();
        trapRef.current = null;
      }
    }

    return () => {
      if (trapRef.current) {
        trapRef.current.destroy();
        trapRef.current = null;
      }
    };
  }, [active, createFocusTrap, containerRef, config]);

  return trapRef.current;
}

/**
 * Hook for roving tabindex management
 */
export function useRovingTabindex(
  containerRef: React.RefObject<HTMLElement>,
  config?: any
) {
  const { createRovingTabindex } = useKeyboard();
  const rovingRef = useRef<RovingTabindex | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    rovingRef.current = createRovingTabindex(containerRef.current, config);

    return () => {
      if (rovingRef.current) {
        rovingRef.current.destroy();
        rovingRef.current = null;
      }
    };
  }, [createRovingTabindex, containerRef, config]);

  return {
    refresh: () => rovingRef.current?.refresh(),
    destroy: () => {
      if (rovingRef.current) {
        rovingRef.current.destroy();
        rovingRef.current = null;
      }
    }
  };
}