/**
 * Focus Context for Global Focus State Management
 * Provides centralized focus management across the application
 */

import React, { createContext, useContext, useReducer, useRef, useEffect, ReactNode } from 'react';
import { focusManager } from '../utils/focusManager';

export interface FocusState {
  // Current focus information
  currentFocusedElement: HTMLElement | null;
  previousFocusedElement: HTMLElement | null;

  // Focus mode detection
  focusMode: 'mouse' | 'keyboard' | 'touch' | 'unknown';
  isFocusVisible: boolean;
  isKeyboardOnlyMode: boolean;

  // Focus scope management
  activeScope: string | null;
  focusScopes: Map<string, FocusScope>;

  // Focus lock regions
  focusLocked: boolean;
  lockRegion: HTMLElement | null;
  lockReason: string | null;

  // Focus history
  focusHistory: FocusHistoryEntry[];
  maxHistorySize: number;

  // Skip links
  skipLinksEnabled: boolean;
  skipLinks: SkipLink[];

  // Focus restoration
  restoreQueue: FocusRestorePoint[];
}

export interface FocusScope {
  id: string;
  element: HTMLElement;
  active: boolean;
  isolate: boolean;
  priority: number;
  onActivate?: () => void;
  onDeactivate?: () => void;
}

export interface FocusHistoryEntry {
  element: HTMLElement;
  timestamp: number;
  scope?: string;
  reason: 'user' | 'programmatic' | 'restoration' | 'trap';
}

export interface SkipLink {
  id: string;
  text: string;
  target: string;
  description?: string;
  visible?: boolean;
}

export interface FocusRestorePoint {
  id: string;
  element: HTMLElement;
  scope?: string;
  priority: number;
  timestamp: number;
}

export type FocusAction =
  | { type: 'SET_CURRENT_FOCUSED'; element: HTMLElement | null }
  | { type: 'SET_PREVIOUS_FOCUSED'; element: HTMLElement | null }
  | { type: 'SET_FOCUS_MODE'; mode: 'mouse' | 'keyboard' | 'touch' | 'unknown' }
  | { type: 'SET_FOCUS_VISIBLE'; visible: boolean }
  | { type: 'SET_KEYBOARD_ONLY_MODE'; isKeyboardOnly: boolean }
  | { type: 'SET_ACTIVE_SCOPE'; scopeId: string | null }
  | { type: 'ADD_FOCUS_SCOPE'; scope: FocusScope }
  | { type: 'REMOVE_FOCUS_SCOPE'; scopeId: string }
  | { type: 'UPDATE_FOCUS_SCOPE'; scopeId: string; updates: Partial<FocusScope> }
  | { type: 'LOCK_FOCUS'; element: HTMLElement; reason: string }
  | { type: 'UNLOCK_FOCUS' }
  | { type: 'ADD_TO_HISTORY'; entry: FocusHistoryEntry }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'SET_SKIP_LINKS'; links: SkipLink[] }
  | { type: 'ADD_SKIP_LINK'; link: SkipLink }
  | { type: 'REMOVE_SKIP_LINK'; id: string }
  | { type: 'ADD_RESTORE_POINT'; point: FocusRestorePoint }
  | { type: 'REMOVE_RESTORE_POINT'; id: string }
  | { type: 'CLEAR_RESTORE_QUEUE' };

export interface FocusContextValue {
  state: FocusState;
  dispatch: React.Dispatch<FocusAction>;

  // Focus control
  focusElement: (element: HTMLElement, reason?: string) => boolean;
  focusSelector: (selector: string, container?: HTMLElement) => boolean;
  focusFirst: (container?: HTMLElement) => HTMLElement | null;
  focusLast: (container?: HTMLElement) => HTMLElement | null;

  // Focus history
  addToHistory: (element: HTMLElement, reason?: string) => void;
  getHistory: (limit?: number) => FocusHistoryEntry[];
  restoreFromHistory: (steps?: number) => boolean;
  clearHistory: () => void;

  // Focus scopes
  createFocusScope: (id: string, element: HTMLElement, options?: Partial<FocusScope>) => void;
  activateScope: (scopeId: string) => boolean;
  deactivateScope: (scopeId: string) => boolean;
  removeScope: (scopeId: string) => void;

  // Focus lock
  lockFocus: (element: HTMLElement, reason: string) => void;
  unlockFocus: () => void;
  isFocusLocked: () => boolean;

  // Skip links
  addSkipLink: (link: SkipLink) => void;
  removeSkipLink: (id: string) => void;
  getSkipLinks: () => SkipLink[];

  // Focus restoration
  createRestorePoint: (id: string, element?: HTMLElement, priority?: number) => void;
  restoreToPoint: (id: string) => boolean;
  clearRestorePoints: () => void;

  // Utilities
  isFocusWithin: (container: HTMLElement) => boolean;
  getFocusableElements: (container?: HTMLElement) => HTMLElement[];
  isElementFocusable: (element: HTMLElement) => boolean;

  // Mode detection
  setFocusMode: (mode: 'mouse' | 'keyboard' | 'touch') => void;
  detectFocusMode: () => void;
}

const initialState: FocusState = {
  currentFocusedElement: null,
  previousFocusedElement: null,
  focusMode: 'unknown',
  isFocusVisible: true,
  isKeyboardOnlyMode: false,
  activeScope: null,
  focusScopes: new Map(),
  focusLocked: false,
  lockRegion: null,
  lockReason: null,
  focusHistory: [],
  maxHistorySize: 50,
  skipLinksEnabled: true,
  skipLinks: [],
  restoreQueue: []
};

function focusReducer(state: FocusState, action: FocusAction): FocusState {
  switch (action.type) {
    case 'SET_CURRENT_FOCUSED':
      return {
        ...state,
        previousFocusedElement: state.currentFocusedElement,
        currentFocusedElement: action.element
      };

    case 'SET_PREVIOUS_FOCUSED':
      return {
        ...state,
        previousFocusedElement: action.element
      };

    case 'SET_FOCUS_MODE':
      return {
        ...state,
        focusMode: action.mode,
        isFocusVisible: action.mode === 'keyboard',
        isKeyboardOnlyMode: action.mode === 'keyboard'
      };

    case 'SET_FOCUS_VISIBLE':
      return {
        ...state,
        isFocusVisible: action.visible
      };

    case 'SET_KEYBOARD_ONLY_MODE':
      return {
        ...state,
        isKeyboardOnlyMode: action.isKeyboardOnly,
        isFocusVisible: action.isKeyboardOnly
      };

    case 'SET_ACTIVE_SCOPE':
      return {
        ...state,
        activeScope: action.scopeId
      };

    case 'ADD_FOCUS_SCOPE': {
      const newScopes = new Map(state.focusScopes);
      newScopes.set(action.scope.id, action.scope);
      return {
        ...state,
        focusScopes: newScopes
      };
    }

    case 'REMOVE_FOCUS_SCOPE': {
      const newScopes = new Map(state.focusScopes);
      newScopes.delete(action.scopeId);
      return {
        ...state,
        focusScopes: newScopes,
        activeScope: state.activeScope === action.scopeId ? null : state.activeScope
      };
    }

    case 'UPDATE_FOCUS_SCOPE': {
      const newScopes = new Map(state.focusScopes);
      const existingScope = newScopes.get(action.scopeId);
      if (existingScope) {
        newScopes.set(action.scopeId, { ...existingScope, ...action.updates });
      }
      return {
        ...state,
        focusScopes: newScopes
      };
    }

    case 'LOCK_FOCUS':
      return {
        ...state,
        focusLocked: true,
        lockRegion: action.element,
        lockReason: action.reason
      };

    case 'UNLOCK_FOCUS':
      return {
        ...state,
        focusLocked: false,
        lockRegion: null,
        lockReason: null
      };

    case 'ADD_TO_HISTORY': {
      const newHistory = [action.entry, ...state.focusHistory];
      return {
        ...state,
        focusHistory: newHistory.slice(0, state.maxHistorySize)
      };
    }

    case 'CLEAR_HISTORY':
      return {
        ...state,
        focusHistory: []
      };

    case 'SET_SKIP_LINKS':
      return {
        ...state,
        skipLinks: action.links
      };

    case 'ADD_SKIP_LINK':
      return {
        ...state,
        skipLinks: [...state.skipLinks, action.link]
      };

    case 'REMOVE_SKIP_LINK':
      return {
        ...state,
        skipLinks: state.skipLinks.filter(link => link.id !== action.id)
      };

    case 'ADD_RESTORE_POINT':
      return {
        ...state,
        restoreQueue: [...state.restoreQueue, action.point].sort((a, b) => b.priority - a.priority)
      };

    case 'REMOVE_RESTORE_POINT':
      return {
        ...state,
        restoreQueue: state.restoreQueue.filter(point => point.id !== action.id)
      };

    case 'CLEAR_RESTORE_QUEUE':
      return {
        ...state,
        restoreQueue: []
      };

    default:
      return state;
  }
}

const FocusContext = createContext<FocusContextValue | null>(null);

export interface FocusProviderProps {
  children: ReactNode;
  maxHistorySize?: number;
  enableSkipLinks?: boolean;
  skipLinks?: SkipLink[];
}

export function FocusProvider({
  children,
  maxHistorySize = 50,
  enableSkipLinks = true,
  skipLinks = []
}: FocusProviderProps) {
  const [state, dispatch] = useReducer(focusReducer, {
    ...initialState,
    maxHistorySize,
    skipLinksEnabled: enableSkipLinks,
    skipLinks
  });

  const observerRef = useRef<MutationObserver | null>(null);
  const lastFocusTimeRef = useRef<number>(0);

  // Focus control functions
  const focusElement = (element: HTMLElement, reason = 'programmatic'): boolean => {
    if (!element || !document.contains(element)) return false;

    // Check if focus is locked
    if (state.focusLocked && state.lockRegion && !state.lockRegion.contains(element)) {
      console.warn(`Focus locked to ${state.lockReason}, cannot focus outside lock region`);
      return false;
    }

    try {
      element.focus();

      if (document.activeElement === element) {
        dispatch({ type: 'SET_CURRENT_FOCUSED', element });
        addToHistory(element, reason);
        return true;
      }
    } catch (error) {
      console.error('Failed to focus element:', error);
    }

    return false;
  };

  const focusSelector = (selector: string, container?: HTMLElement): boolean => {
    const searchContainer = container || document.body;
    const element = searchContainer.querySelector(selector) as HTMLElement;

    if (element) {
      return focusElement(element, 'programmatic');
    }

    return false;
  };

  const focusFirst = (container?: HTMLElement): HTMLElement | null => {
    const element = focusManager.focusFirst(container);
    if (element) {
      dispatch({ type: 'SET_CURRENT_FOCUSED', element });
      addToHistory(element, 'programmatic');
    }
    return element;
  };

  const focusLast = (container?: HTMLElement): HTMLElement | null => {
    const element = focusManager.focusLast(container);
    if (element) {
      dispatch({ type: 'SET_CURRENT_FOCUSED', element });
      addToHistory(element, 'programmatic');
    }
    return element;
  };

  // Focus history functions
  const addToHistory = (element: HTMLElement, reason = 'user'): void => {
    const entry: FocusHistoryEntry = {
      element,
      timestamp: Date.now(),
      scope: state.activeScope || undefined,
      reason: reason as any
    };

    dispatch({ type: 'ADD_TO_HISTORY', entry });
  };

  const getHistory = (limit?: number): FocusHistoryEntry[] => {
    return limit ? state.focusHistory.slice(0, limit) : state.focusHistory;
  };

  const restoreFromHistory = (steps = 1): boolean => {
    if (state.focusHistory.length < steps) return false;

    const targetEntry = state.focusHistory[steps - 1];
    if (targetEntry && document.contains(targetEntry.element)) {
      return focusElement(targetEntry.element, 'restoration');
    }

    return false;
  };

  const clearHistory = (): void => {
    dispatch({ type: 'CLEAR_HISTORY' });
  };

  // Focus scope functions
  const createFocusScope = (id: string, element: HTMLElement, options: Partial<FocusScope> = {}): void => {
    const scope: FocusScope = {
      id,
      element,
      active: false,
      isolate: false,
      priority: 0,
      ...options
    };

    dispatch({ type: 'ADD_FOCUS_SCOPE', scope });
  };

  const activateScope = (scopeId: string): boolean => {
    const scope = state.focusScopes.get(scopeId);
    if (!scope) return false;

    dispatch({ type: 'UPDATE_FOCUS_SCOPE', scopeId, updates: { active: true } });
    dispatch({ type: 'SET_ACTIVE_SCOPE', scopeId });

    scope.onActivate?.();
    return true;
  };

  const deactivateScope = (scopeId: string): boolean => {
    const scope = state.focusScopes.get(scopeId);
    if (!scope) return false;

    dispatch({ type: 'UPDATE_FOCUS_SCOPE', scopeId, updates: { active: false } });

    if (state.activeScope === scopeId) {
      dispatch({ type: 'SET_ACTIVE_SCOPE', scopeId: null });
    }

    scope.onDeactivate?.();
    return true;
  };

  const removeScope = (scopeId: string): void => {
    deactivateScope(scopeId);
    dispatch({ type: 'REMOVE_FOCUS_SCOPE', scopeId });
  };

  // Focus lock functions
  const lockFocus = (element: HTMLElement, reason: string): void => {
    dispatch({ type: 'LOCK_FOCUS', element, reason });
  };

  const unlockFocus = (): void => {
    dispatch({ type: 'UNLOCK_FOCUS' });
  };

  const isFocusLocked = (): boolean => state.focusLocked;

  // Skip link functions
  const addSkipLink = (link: SkipLink): void => {
    dispatch({ type: 'ADD_SKIP_LINK', link });
  };

  const removeSkipLink = (id: string): void => {
    dispatch({ type: 'REMOVE_SKIP_LINK', id });
  };

  const getSkipLinks = (): SkipLink[] => state.skipLinks;

  // Focus restoration functions
  const createRestorePoint = (id: string, element?: HTMLElement, priority = 0): void => {
    const targetElement = element || state.currentFocusedElement;
    if (!targetElement) return;

    const point: FocusRestorePoint = {
      id,
      element: targetElement,
      scope: state.activeScope || undefined,
      priority,
      timestamp: Date.now()
    };

    dispatch({ type: 'ADD_RESTORE_POINT', point });
  };

  const restoreToPoint = (id: string): boolean => {
    const point = state.restoreQueue.find(p => p.id === id);
    if (!point || !document.contains(point.element)) return false;

    const success = focusElement(point.element, 'restoration');
    if (success) {
      dispatch({ type: 'REMOVE_RESTORE_POINT', id });
    }

    return success;
  };

  const clearRestorePoints = (): void => {
    dispatch({ type: 'CLEAR_RESTORE_QUEUE' });
  };

  // Utility functions
  const isFocusWithin = (container: HTMLElement): boolean => {
    return container.contains(document.activeElement);
  };

  const getFocusableElements = (container?: HTMLElement): HTMLElement[] => {
    return focusManager.getFocusableElements(container);
  };

  const isElementFocusable = (element: HTMLElement): boolean => {
    const focusableElements = focusManager.getFocusableElements();
    return focusableElements.includes(element);
  };

  // Mode detection functions
  const setFocusMode = (mode: 'mouse' | 'keyboard' | 'touch'): void => {
    dispatch({ type: 'SET_FOCUS_MODE', mode });
  };

  const detectFocusMode = (): void => {
    const mode = focusManager.getLastInteractionType();
    dispatch({ type: 'SET_FOCUS_MODE', mode });
  };

  // Initialize focus monitoring
  useEffect(() => {
    const handleFocusChange = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      const now = Date.now();

      // Throttle focus change events
      if (now - lastFocusTimeRef.current < 10) return;
      lastFocusTimeRef.current = now;

      dispatch({ type: 'SET_CURRENT_FOCUSED', element: target });

      // Detect focus mode
      detectFocusMode();

      // Add to history if it's a user action
      if (event.isTrusted) {
        addToHistory(target, 'user');
      }
    };

    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('focusout', (event) => {
      // Only update if focus is actually leaving
      setTimeout(() => {
        if (!document.activeElement || document.activeElement === document.body) {
          dispatch({ type: 'SET_CURRENT_FOCUSED', element: null });
        }
      }, 0);
    });

    // Monitor DOM changes that might affect focusability
    observerRef.current = new MutationObserver(() => {
      // Clean up history entries for removed elements
      const validHistory = state.focusHistory.filter(entry =>
        document.contains(entry.element)
      );

      if (validHistory.length !== state.focusHistory.length) {
        dispatch({ type: 'SET_SKIP_LINKS', links: validHistory as any });
      }
    });

    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'aria-hidden', 'tabindex', 'inert']
    });

    return () => {
      document.removeEventListener('focusin', handleFocusChange);
      observerRef.current?.disconnect();
    };
  }, []);

  const contextValue: FocusContextValue = {
    state,
    dispatch,

    // Focus control
    focusElement,
    focusSelector,
    focusFirst,
    focusLast,

    // Focus history
    addToHistory,
    getHistory,
    restoreFromHistory,
    clearHistory,

    // Focus scopes
    createFocusScope,
    activateScope,
    deactivateScope,
    removeScope,

    // Focus lock
    lockFocus,
    unlockFocus,
    isFocusLocked,

    // Skip links
    addSkipLink,
    removeSkipLink,
    getSkipLinks,

    // Focus restoration
    createRestorePoint,
    restoreToPoint,
    clearRestorePoints,

    // Utilities
    isFocusWithin,
    getFocusableElements,
    isElementFocusable,

    // Mode detection
    setFocusMode,
    detectFocusMode
  };

  return (
    <FocusContext.Provider value={contextValue}>
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error('useFocus must be used within a FocusProvider');
  }
  return context;
}