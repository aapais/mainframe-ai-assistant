# Accessibility & Keyboard Navigation Implementation
## WCAG 2.1 AA Compliant Design for Mainframe KB Assistant

---

## Overview

This document provides comprehensive implementation guidance for accessibility and keyboard navigation, ensuring the Mainframe KB Assistant meets WCAG 2.1 AA standards while optimizing for support team workflows that rely heavily on keyboard shortcuts.

---

## 1. Accessibility Foundation

### 1.1 WCAG 2.1 AA Compliance Framework

```typescript
// types/AccessibilityTypes.ts
export interface A11yConfig {
  level: 'A' | 'AA' | 'AAA';
  colorContrast: {
    normal: number; // 4.5:1 for AA
    large: number;  // 3:1 for AA
  };
  keyboardNavigation: {
    enabled: boolean;
    trapFocus: boolean;
    skipLinks: boolean;
  };
  screenReader: {
    announcements: boolean;
    landmarks: boolean;
    descriptions: boolean;
  };
  reducedMotion: boolean;
  highContrast: boolean;
}

export interface A11yAnnouncement {
  id: string;
  message: string;
  priority: 'polite' | 'assertive';
  type: 'status' | 'alert' | 'log';
  timestamp: Date;
}
```

### 1.2 Accessibility Context Provider

```typescript
// context/AccessibilityContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface AccessibilityContextType {
  config: A11yConfig;
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  setFocusTrap: (element: HTMLElement | null) => void;
  prefersReducedMotion: boolean;
  highContrastMode: boolean;
  screenReaderActive: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextType | null>(null);

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
};

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [config] = useState<A11yConfig>({
    level: 'AA',
    colorContrast: {
      normal: 4.5,
      large: 3.0
    },
    keyboardNavigation: {
      enabled: true,
      trapFocus: true,
      skipLinks: true
    },
    screenReader: {
      announcements: true,
      landmarks: true,
      descriptions: true
    },
    reducedMotion: false,
    highContrast: false
  });

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [highContrastMode, setHighContrastMode] = useState(false);
  const [screenReaderActive, setScreenReaderActive] = useState(false);
  const [focusTrap, setFocusTrap] = useState<HTMLElement | null>(null);

  const liveRegionRef = useRef<HTMLDivElement>(null);
  const alertRegionRef = useRef<HTMLDivElement>(null);

  // Detect media preferences
  useEffect(() => {
    // Reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    // High contrast preference
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    setHighContrastMode(highContrastQuery.matches);

    const handleContrastChange = (e: MediaQueryListEvent) => {
      setHighContrastMode(e.matches);
    };

    highContrastQuery.addEventListener('change', handleContrastChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      highContrastQuery.removeEventListener('change', handleContrastChange);
    };
  }, []);

  // Detect screen reader usage
  useEffect(() => {
    // Screen reader detection heuristics
    let timeoutId: NodeJS.Timeout;

    const detectScreenReader = () => {
      const testElement = document.createElement('div');
      testElement.setAttribute('aria-label', 'Screen reader test');
      testElement.style.position = 'absolute';
      testElement.style.left = '-9999px';
      document.body.appendChild(testElement);

      timeoutId = setTimeout(() => {
        const hasAriaSupport = 'getComputedAccessibleNode' in testElement ||
                              'accessibleNode' in testElement ||
                              navigator.userAgent.includes('NVDA') ||
                              navigator.userAgent.includes('JAWS');

        setScreenReaderActive(hasAriaSupport);
        document.body.removeChild(testElement);
      }, 100);
    };

    detectScreenReader();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Live announcements function
  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!config.screenReader.announcements) return;

    const region = priority === 'assertive' ? alertRegionRef.current : liveRegionRef.current;

    if (region) {
      // Clear previous message to ensure re-announcement
      region.textContent = '';

      // Use setTimeout to ensure screen readers pick up the change
      setTimeout(() => {
        region.textContent = message;
      }, 10);

      // Clear after announcement
      setTimeout(() => {
        region.textContent = '';
      }, 3000);
    }
  };

  // Focus trap management
  useEffect(() => {
    if (!focusTrap || !config.keyboardNavigation.trapFocus) return;

    const focusableElements = focusTrap.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    focusTrap.addEventListener('keydown', handleKeyDown);

    // Focus first element when trap is set
    firstElement.focus();

    return () => {
      focusTrap.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusTrap, config.keyboardNavigation.trapFocus]);

  return (
    <AccessibilityContext.Provider
      value={{
        config,
        announce,
        setFocusTrap,
        prefersReducedMotion,
        highContrastMode,
        screenReaderActive
      }}
    >
      {children}

      {/* Live regions for screen reader announcements */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      <div
        ref={alertRegionRef}
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </AccessibilityContext.Provider>
  );
};
```

---

## 2. Keyboard Navigation System

### 2.1 Global Keyboard Handler

```typescript
// hooks/useKeyboardNavigation.ts
import { useEffect, useCallback, useRef } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: string;
  handler: () => void;
  description: string;
  context?: string; // Global, search, form, etc.
}

export const useKeyboardNavigation = (shortcuts: KeyboardShortcut[] = []) => {
  const { announce } = useAccessibility();
  const shortcutsRef = useRef<KeyboardShortcut[]>(shortcuts);
  const activeContextRef = useRef<string>('global');

  // Update shortcuts when they change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const { key, ctrlKey, shiftKey, altKey } = event;

    // Find matching shortcut
    const matchedShortcut = shortcutsRef.current.find(shortcut => {
      const keyMatch = shortcut.key.toLowerCase() === key.toLowerCase();
      const ctrlMatch = (shortcut.ctrlKey || false) === ctrlKey;
      const shiftMatch = (shortcut.shiftKey || false) === shiftKey;
      const altMatch = (shortcut.altKey || false) === altKey;

      // Check context
      const contextMatch = !shortcut.context ||
                          shortcut.context === 'global' ||
                          shortcut.context === activeContextRef.current;

      return keyMatch && ctrlMatch && shiftMatch && altMatch && contextMatch;
    });

    if (matchedShortcut) {
      event.preventDefault();
      event.stopPropagation();

      matchedShortcut.handler();

      // Announce action to screen readers
      announce(`${matchedShortcut.description}`, 'polite');
    }
  }, [announce]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const setActiveContext = useCallback((context: string) => {
    activeContextRef.current = context;
  }, []);

  const getShortcutHelp = useCallback((context?: string) => {
    return shortcutsRef.current
      .filter(s => !context || s.context === context || s.context === 'global')
      .map(s => ({
        key: formatKeyCombo(s),
        description: s.description,
        action: s.action
      }));
  }, []);

  return {
    setActiveContext,
    getShortcutHelp,
    activeContext: activeContextRef.current
  };
};

// Format key combination for display
const formatKeyCombo = (shortcut: KeyboardShortcut): string => {
  const parts: string[] = [];

  if (shortcut.ctrlKey) parts.push('Ctrl');
  if (shortcut.shiftKey) parts.push('Shift');
  if (shortcut.altKey) parts.push('Alt');
  parts.push(shortcut.key);

  return parts.join('+');
};
```

### 2.2 Roving Tab Index Implementation

```typescript
// hooks/useRovingTabIndex.ts
import { useState, useCallback, useRef, useEffect } from 'react';

interface RovingTabIndexOptions {
  orientation?: 'horizontal' | 'vertical' | 'both';
  loop?: boolean;
  autoFocus?: boolean;
}

export const useRovingTabIndex = <T extends HTMLElement>(
  items: T[],
  options: RovingTabIndexOptions = {}
) => {
  const { orientation = 'vertical', loop = true, autoFocus = false } = options;
  const [focusedIndex, setFocusedIndex] = useState(autoFocus ? 0 : -1);
  const itemRefs = useRef<(T | null)[]>([]);

  // Update refs array when items change
  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, items.length);
  }, [items.length]);

  // Focus management
  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const { key } = event;
    let newIndex = focusedIndex;

    switch (key) {
      case 'ArrowDown':
        if (orientation === 'vertical' || orientation === 'both') {
          event.preventDefault();
          newIndex = focusedIndex + 1;
          if (newIndex >= items.length) {
            newIndex = loop ? 0 : focusedIndex;
          }
        }
        break;

      case 'ArrowUp':
        if (orientation === 'vertical' || orientation === 'both') {
          event.preventDefault();
          newIndex = focusedIndex - 1;
          if (newIndex < 0) {
            newIndex = loop ? items.length - 1 : focusedIndex;
          }
        }
        break;

      case 'ArrowRight':
        if (orientation === 'horizontal' || orientation === 'both') {
          event.preventDefault();
          newIndex = focusedIndex + 1;
          if (newIndex >= items.length) {
            newIndex = loop ? 0 : focusedIndex;
          }
        }
        break;

      case 'ArrowLeft':
        if (orientation === 'horizontal' || orientation === 'both') {
          event.preventDefault();
          newIndex = focusedIndex - 1;
          if (newIndex < 0) {
            newIndex = loop ? items.length - 1 : focusedIndex;
          }
        }
        break;

      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;

      case 'End':
        event.preventDefault();
        newIndex = items.length - 1;
        break;

      case 'PageDown':
        if (orientation === 'vertical' || orientation === 'both') {
          event.preventDefault();
          newIndex = Math.min(focusedIndex + 10, items.length - 1);
        }
        break;

      case 'PageUp':
        if (orientation === 'vertical' || orientation === 'both') {
          event.preventDefault();
          newIndex = Math.max(focusedIndex - 10, 0);
        }
        break;

      default:
        return; // Don't prevent default for other keys
    }

    if (newIndex !== focusedIndex) {
      setFocusedIndex(newIndex);
    }
  }, [focusedIndex, items.length, orientation, loop]);

  const setItemRef = useCallback((index: number) => (element: T | null) => {
    itemRefs.current[index] = element;
  }, []);

  const focusItem = useCallback((index: number) => {
    if (index >= 0 && index < items.length) {
      setFocusedIndex(index);
    }
  }, [items.length]);

  const getItemProps = useCallback((index: number) => ({
    ref: setItemRef(index),
    tabIndex: focusedIndex === index ? 0 : -1,
    onKeyDown: handleKeyDown,
    'aria-posinset': index + 1,
    'aria-setsize': items.length
  }), [focusedIndex, handleKeyDown, items.length, setItemRef]);

  return {
    focusedIndex,
    setFocusedIndex: focusItem,
    getItemProps,
    handleKeyDown
  };
};
```

---

## 3. Screen Reader Optimized Components

### 3.1 Accessible Search Component

```typescript
// components/AccessibleSearch.tsx
import React, { useId, useRef, useEffect, useState } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import { useKBSearch } from '../hooks/useKBSearch';

interface AccessibleSearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

export const AccessibleSearch: React.FC<AccessibleSearchProps> = ({
  onSearch,
  placeholder = "Search knowledge base...",
  ariaLabel = "Search knowledge base entries"
}) => {
  const searchId = useId();
  const resultsId = useId();
  const statusId = useId();

  const { announce } = useAccessibility();
  const { searchResults, isSearching, suggestions } = useKBSearch();

  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);

  // Announce search results
  useEffect(() => {
    if (!isSearching && query) {
      const resultCount = searchResults.length;
      const message = resultCount === 0
        ? `No results found for "${query}"`
        : `${resultCount} result${resultCount === 1 ? '' : 's'} found for "${query}"`;

      announce(message, 'polite');
    }
  }, [searchResults.length, isSearching, query, announce]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedSuggestion(-1);

    if (value.length > 1) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }

    onSearch(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestion(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestion(prev => prev > 0 ? prev - 1 : -1);
        break;

      case 'Enter':
        if (selectedSuggestion >= 0) {
          e.preventDefault();
          const suggestion = suggestions[selectedSuggestion];
          setQuery(suggestion);
          setShowSuggestions(false);
          onSearch(suggestion);
          announce(`Selected suggestion: ${suggestion}`, 'polite');
        }
        break;

      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestion(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSuggestionClick = (suggestion: string, index: number) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    setSelectedSuggestion(-1);
    onSearch(suggestion);
    inputRef.current?.focus();
    announce(`Selected suggestion: ${suggestion}`, 'polite');
  };

  return (
    <div className="accessible-search" role="search">
      <label htmlFor={searchId} className="search-label">
        {ariaLabel}
      </label>

      <div className="search-input-wrapper">
        <input
          ref={inputRef}
          id={searchId}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-describedby={`${statusId} ${showSuggestions ? resultsId : ''}`}
          aria-expanded={showSuggestions}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          autoComplete="off"
          className="search-input"
        />

        {/* Search status for screen readers */}
        <div
          id={statusId}
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        >
          {isSearching && "Searching..."}
          {!isSearching && query && searchResults.length > 0 &&
            `${searchResults.length} results available`
          }
        </div>

        {/* Search suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <ul
            ref={suggestionsRef}
            id={resultsId}
            className="search-suggestions"
            role="listbox"
            aria-label="Search suggestions"
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={index}
                role="option"
                aria-selected={selectedSuggestion === index}
                className={`suggestion-item ${
                  selectedSuggestion === index ? 'selected' : ''
                }`}
                onClick={() => handleSuggestionClick(suggestion, index)}
                onMouseEnter={() => setSelectedSuggestion(index)}
              >
                {suggestion}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
```

### 3.2 Accessible Results List

```typescript
// components/AccessibleResultsList.tsx
import React, { useRef } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import { useRovingTabIndex } from '../hooks/useRovingTabIndex';
import { SearchResult } from '../types';

interface AccessibleResultsListProps {
  results: SearchResult[];
  selectedId?: string;
  onSelect: (result: SearchResult) => void;
  onPreview?: (result: SearchResult) => void;
}

export const AccessibleResultsList: React.FC<AccessibleResultsListProps> = ({
  results,
  selectedId,
  onSelect,
  onPreview
}) => {
  const { announce } = useAccessibility();
  const listRef = useRef<HTMLDivElement>(null);

  const {
    focusedIndex,
    getItemProps,
    handleKeyDown
  } = useRovingTabIndex(results, {
    orientation: 'vertical',
    loop: true,
    autoFocus: results.length > 0
  });

  const handleItemKeyDown = (
    event: React.KeyboardEvent,
    result: SearchResult,
    index: number
  ) => {
    // Handle roving tabindex navigation
    handleKeyDown(event.nativeEvent);

    // Handle specific actions
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelect(result);
        announce(`Selected: ${result.title}`, 'polite');
        break;

      case 'p':
      case 'P':
        if (onPreview) {
          event.preventDefault();
          onPreview(result);
          announce(`Previewing: ${result.title}`, 'polite');
        }
        break;
    }
  };

  const handleItemClick = (result: SearchResult) => {
    onSelect(result);
    announce(`Selected: ${result.title}`, 'polite');
  };

  if (results.length === 0) {
    return (
      <div className="no-results" role="status" aria-live="polite">
        <p>No results found. Try different search terms.</p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="results-list"
      role="listbox"
      aria-label={`Search results, ${results.length} items`}
      aria-activedescendant={
        focusedIndex >= 0 ? `result-${results[focusedIndex]?.id}` : undefined
      }
    >
      {results.map((result, index) => (
        <div
          key={result.id}
          id={`result-${result.id}`}
          className={`result-item ${
            selectedId === result.id ? 'selected' : ''
          } ${focusedIndex === index ? 'focused' : ''}`}
          onClick={() => handleItemClick(result)}
          onKeyDown={(e) => handleItemKeyDown(e, result, index)}
          aria-label={`${result.title}. Category: ${result.category}.
                      Confidence: ${Math.round(result.score)}%.
                      Usage: ${result.usageCount} times.
                      Success rate: ${Math.round(result.successRate * 100)}%.
                      ${focusedIndex === index ? 'Press Enter to select, P to preview.' : ''}`}
          {...getItemProps(index)}
        >
          <div className="result-content">
            <h3 className="result-title">
              <span dangerouslySetInnerHTML={{ __html: result.highlightedTitle || result.title }} />
            </h3>

            <div className="result-summary">
              <span dangerouslySetInnerHTML={{
                __html: result.highlightedSummary || result.summary
              }} />
            </div>

            <div className="result-metadata" aria-label="Metadata">
              <span className="category-badge" aria-label={`Category: ${result.category}`}>
                {result.category}
              </span>

              <span className="confidence-score" aria-label={`Confidence: ${Math.round(result.score)}%`}>
                {Math.round(result.score)}%
              </span>

              <span className="usage-count" aria-label={`Used ${result.usageCount} times`}>
                {result.usageCount} uses
              </span>

              <span
                className="success-rate"
                aria-label={`Success rate: ${Math.round(result.successRate * 100)}%`}
              >
                {Math.round(result.successRate * 100)}% success
              </span>
            </div>
          </div>

          {/* Visual focus indicator */}
          {focusedIndex === index && (
            <div className="focus-indicator" aria-hidden="true" />
          )}
        </div>
      ))}

      {/* Instructions for keyboard users */}
      <div className="sr-only" role="region" aria-label="Instructions">
        Use arrow keys to navigate results. Press Enter to select, P to preview,
        or Escape to return to search.
      </div>
    </div>
  );
};
```

---

## 4. Focus Management

### 4.1 Focus Trap Implementation

```typescript
// hooks/useFocusTrap.ts
import { useEffect, useRef, useCallback } from 'react';

interface FocusTrapOptions {
  autoFocus?: boolean;
  restoreFocus?: boolean;
  allowOutsideClick?: boolean;
}

export const useFocusTrap = (
  isActive: boolean,
  options: FocusTrapOptions = {}
) => {
  const {
    autoFocus = true,
    restoreFocus = true,
    allowOutsideClick = false
  } = options;

  const containerRef = useRef<HTMLElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback((container: HTMLElement) => {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"]):not([disabled])',
      '[contenteditable="true"]'
    ].join(', ');

    return Array.from(
      container.querySelectorAll<HTMLElement>(focusableSelectors)
    ).filter(element => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isActive || !containerRef.current) return;

    const focusableElements = getFocusableElements(containerRef.current);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (event.key === 'Tab') {
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      if (event.shiftKey) {
        if (document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable?.focus();
        }
      }
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      // Let parent handle escape
      containerRef.current?.dispatchEvent(new CustomEvent('escape'));
    }
  }, [isActive, getFocusableElements]);

  const handleClick = useCallback((event: MouseEvent) => {
    if (!isActive || allowOutsideClick || !containerRef.current) return;

    if (!containerRef.current.contains(event.target as Node)) {
      event.preventDefault();
      event.stopPropagation();

      // Focus first element in trap
      const focusableElements = getFocusableElements(containerRef.current);
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }
  }, [isActive, allowOutsideClick, getFocusableElements]);

  useEffect(() => {
    if (isActive) {
      // Store current focus
      if (restoreFocus && document.activeElement) {
        previousActiveElementRef.current = document.activeElement as HTMLElement;
      }

      // Focus first element if autoFocus
      if (autoFocus && containerRef.current) {
        const focusableElements = getFocusableElements(containerRef.current);
        if (focusableElements.length > 0) {
          // Small delay to ensure element is rendered
          setTimeout(() => {
            focusableElements[0]?.focus();
          }, 10);
        } else {
          // Focus container if no focusable children
          containerRef.current.focus();
        }
      }

      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('click', handleClick, true);
    } else {
      // Restore previous focus
      if (restoreFocus && previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
        previousActiveElementRef.current = null;
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClick, true);
    };
  }, [isActive, autoFocus, restoreFocus, handleKeyDown, handleClick, getFocusableElements]);

  return containerRef;
};
```

---

## 5. ARIA Live Regions

### 5.1 Status Announcements

```typescript
// hooks/useStatusAnnouncements.ts
import { useCallback } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';

export const useStatusAnnouncements = () => {
  const { announce } = useAccessibility();

  const announceSearch = useCallback((
    query: string,
    resultCount: number,
    searchTime?: number
  ) => {
    let message = '';

    if (resultCount === 0) {
      message = `No results found for "${query}". Try different search terms or check spelling.`;
    } else {
      message = `Found ${resultCount} result${resultCount === 1 ? '' : 's'} for "${query}"`;

      if (searchTime && searchTime > 2000) {
        message += ` in ${Math.round(searchTime / 1000)} seconds`;
      }
    }

    announce(message, 'polite');
  }, [announce]);

  const announceSelection = useCallback((title: string) => {
    announce(`Selected: ${title}`, 'polite');
  }, [announce]);

  const announceNavigation = useCallback((
    currentIndex: number,
    totalItems: number,
    itemTitle: string
  ) => {
    const position = `${currentIndex + 1} of ${totalItems}`;
    announce(`${position}: ${itemTitle}`, 'polite');
  }, [announce]);

  const announceAction = useCallback((
    action: string,
    result?: 'success' | 'error',
    details?: string
  ) => {
    let message = action;

    if (result === 'success') {
      message += ' completed successfully';
    } else if (result === 'error') {
      message += ' failed';
    }

    if (details) {
      message += `. ${details}`;
    }

    announce(message, result === 'error' ? 'assertive' : 'polite');
  }, [announce]);

  const announceFormValidation = useCallback((
    fieldName: string,
    errorMessage: string
  ) => {
    announce(`${fieldName}: ${errorMessage}`, 'assertive');
  }, [announce]);

  return {
    announceSearch,
    announceSelection,
    announceNavigation,
    announceAction,
    announceFormValidation
  };
};
```

---

## 6. High Contrast & Theme Support

### 6.1 Responsive Color System

```typescript
// styles/accessibility.css
:root {
  /* Standard colors */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f8f9fa;
  --color-text-primary: #212529;
  --color-text-secondary: #6c757d;
  --color-border: #dee2e6;
  --color-focus: #0066cc;
  --color-error: #dc3545;
  --color-success: #28a745;
  --color-warning: #ffc107;

  /* High contrast overrides */
  --color-focus-contrast: #0000ff;
  --color-text-contrast: #000000;
  --color-bg-contrast: #ffffff;
}

/* High contrast mode */
@media (prefers-contrast: high) {
  :root {
    --color-bg-primary: var(--color-bg-contrast);
    --color-text-primary: var(--color-text-contrast);
    --color-focus: var(--color-focus-contrast);
    --color-border: #000000;
  }
}

/* Dark mode with high contrast support */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg-primary: #1a1a1a;
    --color-bg-secondary: #2d2d2d;
    --color-text-primary: #ffffff;
    --color-text-secondary: #cccccc;
    --color-border: #404040;
  }
}

@media (prefers-color-scheme: dark) and (prefers-contrast: high) {
  :root {
    --color-bg-primary: #000000;
    --color-text-primary: #ffffff;
    --color-border: #ffffff;
    --color-focus: #ffffff;
  }
}

/* Focus indicators */
*:focus {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

/* Skip links */
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  padding: 8px;
  text-decoration: none;
  border: 2px solid var(--color-focus);
  border-radius: 4px;
  z-index: 1000;
}

.skip-link:focus {
  top: 6px;
}

/* Screen reader only content */
.sr-only {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

This comprehensive accessibility implementation ensures the Mainframe KB Assistant meets WCAG 2.1 AA standards while providing an optimized keyboard-first experience for support team workflows.