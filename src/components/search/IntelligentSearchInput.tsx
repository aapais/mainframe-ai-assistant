/**
 * IntelligentSearchInput Component
 *
 * Advanced search input with comprehensive features:
 * - Real-time autocomplete dropdown
 * - Visual keyboard shortcut hints
 * - Search history sidebar
 * - Performance indicators
 * - Responsive design with dark/light theme support
 * - WCAG 2.1 AA accessibility compliance
 *
 * Performance targets:
 * - First paint < 50ms
 * - Interactive < 100ms
 * - 60fps animations
 *
 * @author Frontend Team
 * @version 1.0.0
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
  memo
} from 'react';
import { Search, Clock, TrendingUp, Tag, Filter, Keyboard, X, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { useKeyboardShortcuts, useSearchShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useSearchHistory, SearchHistoryItem } from '../../hooks/useSearchHistory';
import { useAutocomplete, AutocompleteSuggestion, SuggestionSource } from '../../hooks/useAutocomplete';

// ========================
// Types & Interfaces
// ========================

export interface SearchFilter {
  id: string;
  type: 'category' | 'tag' | 'date' | 'usage' | 'status';
  label: string;
  value: any;
  active: boolean;
  count?: number;
}

export interface SearchPerformanceMetrics {
  responseTime: number;
  resultsCount: number;
  cacheHit: boolean;
  aiUsed: boolean;
}

export interface IntelligentSearchInputProps {
  className?: string;
  /** Input placeholder text */
  placeholder?: string;
  /** Initial search value */
  defaultValue?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Enable autocomplete dropdown */
  enableAutocomplete?: boolean;
  /** Enable search history */
  enableHistory?: boolean;
  /** Enable performance indicators */
  enablePerformanceIndicators?: boolean;
  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts?: boolean;
  /** Show shortcut hints */
  showShortcutHints?: boolean;
  /** Theme variant */
  variant?: 'default' | 'minimal' | 'prominent';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Active filters */
  filters?: SearchFilter[];
  /** Suggestion sources */
  suggestionSources?: SuggestionSource[];
  /** Performance metrics */
  performanceMetrics?: SearchPerformanceMetrics;
  /** Loading state */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Error state */
  error?: string;

  // Event handlers
  onSearch?: (query: string, filters: SearchFilter[]) => void;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onClear?: () => void;
  onFilterChange?: (filters: SearchFilter[]) => void;
  onSuggestionSelect?: (suggestion: AutocompleteSuggestion) => void;
  onHistorySelect?: (item: SearchHistoryItem) => void;
  onKeyboardShortcut?: (shortcutId: string) => void;

  // Accessibility
  'aria-label'?: string;
  'aria-describedby'?: string;
  role?: string;
}

export interface IntelligentSearchInputRef {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  setValue: (value: string) => void;
  getValue: () => string;
}

// ========================
// Constants
// ========================

const SEARCH_SHORTCUTS = {
  focus: ['ctrl', 'k'],
  clear: ['escape'],
  submit: ['enter'],
  nextSuggestion: ['arrowdown'],
  prevSuggestion: ['arrowup'],
  toggleHistory: ['ctrl', 'h'],
  toggleFilters: ['ctrl', 'f']
};

const VARIANT_STYLES = {
  default: 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600',
  minimal: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
  prominent: 'bg-gradient-to-r from-primary-50 to-blue-50 dark:from-gray-800 dark:to-gray-900 border-primary-300 dark:border-primary-600'
};

const SIZE_STYLES = {
  sm: 'h-9 text-sm px-3',
  md: 'h-11 text-base px-4',
  lg: 'h-13 text-lg px-5'
};

// ========================
// Default Suggestion Sources
// ========================

const createDefaultSuggestionSources = (
  getHistorySuggestions: (query: string) => any[],
  getStaticSuggestions: (query: string) => any[]
): SuggestionSource[] => [
  {
    id: 'history',
    name: 'Search History',
    getSuggestions: async (query) => {
      const suggestions = getHistorySuggestions(query);
      return suggestions.map((s, index) => ({
        id: `history-${index}`,
        text: s.query,
        type: 'history' as const,
        description: `${s.frequency} searches, ${Math.round(s.successRate * 100)}% success`,
        icon: 'clock',
        score: s.frequency * s.successRate,
        metadata: { frequency: s.frequency, successRate: s.successRate }
      }));
    },
    priority: 10,
    enabled: true
  },
  {
    id: 'static',
    name: 'Static Suggestions',
    getSuggestions: async (query) => {
      const suggestions = getStaticSuggestions(query);
      return suggestions.map((s, index) => ({
        id: `static-${index}`,
        text: s.text,
        type: s.type || 'static',
        description: s.description,
        icon: s.icon,
        score: s.score || 0.5,
        metadata: s.metadata || {}
      }));
    },
    priority: 5,
    enabled: true
  }
];

// ========================
// Main Component
// ========================

export const IntelligentSearchInput = memo(forwardRef<
  IntelligentSearchInputRef,
  IntelligentSearchInputProps
>(({
  className = '',
  placeholder = 'Search knowledge base...',
  defaultValue = '',
  autoFocus = false,
  enableAutocomplete = true,
  enableHistory = true,
  enablePerformanceIndicators = false,
  enableKeyboardShortcuts = true,
  showShortcutHints = true,
  variant = 'default',
  size = 'md',
  filters = [],
  suggestionSources,
  performanceMetrics,
  loading = false,
  disabled = false,
  error,
  onSearch,
  onChange,
  onFocus,
  onBlur,
  onClear,
  onFilterChange,
  onSuggestionSelect,
  onHistorySelect,
  onKeyboardShortcut,
  'aria-label': ariaLabel = 'Search input',
  'aria-describedby': ariaDescribedBy,
  role = 'searchbox'
}, ref) => {
  // ========================
  // State & Refs
  // ========================

  const [value, setValue] = useState(defaultValue);
  const [isFocused, setIsFocused] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ========================
  // Hooks
  // ========================

  // Debounced value for performance
  const [debouncedValue, isDebouncing] = useDebounce(value, { delay: 150 });

  // Search history
  const {
    addSearch,
    getRecentSearches,
    getPopularSearches,
    getSuggestions: getHistorySuggestions,
    statistics: historyStats
  } = useSearchHistory({
    enabled: enableHistory
  });

  // Default suggestion sources
  const defaultSources = useMemo(() => {
    const getStaticSuggestions = (query: string) => {
      const staticSuggestions = [
        { text: 'VSAM Status codes', type: 'category', description: 'VSAM file operation errors', icon: 'tag', score: 0.8 },
        { text: 'JCL errors', type: 'category', description: 'Job Control Language issues', icon: 'tag', score: 0.8 },
        { text: 'COBOL abends', type: 'category', description: 'COBOL program abnormal ends', icon: 'tag', score: 0.8 },
        { text: 'DB2 SQL errors', type: 'category', description: 'Database query issues', icon: 'tag', score: 0.8 },
        { text: 'S0C7', type: 'template', description: 'Data exception error', icon: 'search', score: 0.9 },
        { text: 'IEF212I', type: 'template', description: 'Dataset not found', icon: 'search', score: 0.9 }
      ];

      const query_lower = query.toLowerCase();
      return staticSuggestions.filter(s =>
        s.text.toLowerCase().includes(query_lower) ||
        s.description.toLowerCase().includes(query_lower)
      );
    };

    return createDefaultSuggestionSources(getHistorySuggestions, getStaticSuggestions);
  }, [getHistorySuggestions]);

  // Autocomplete
  const autocomplete = useAutocomplete(
    suggestionSources || defaultSources,
    {
      minLength: 2,
      maxSuggestions: 8,
      debounceMs: 100,
      fuzzyMatch: true,
      groupByType: true,
      keyboardNavigation: enableKeyboardShortcuts
    }
  );

  // Keyboard shortcuts
  const shortcutCallbacks = useMemo(() => ({
    onFocusSearch: () => {
      inputRef.current?.focus();
      onKeyboardShortcut?.('focus-search');
    },
    onClearSearch: () => {
      if (isFocused) {
        handleClear();
        onKeyboardShortcut?.('clear-search');
      }
    },
    onNextResult: () => {
      if (autocomplete.isOpen) {
        autocomplete.selectNext();
        onKeyboardShortcut?.('next-result');
      }
    },
    onPrevResult: () => {
      if (autocomplete.isOpen) {
        autocomplete.selectPrevious();
        onKeyboardShortcut?.('prev-result');
      }
    },
    onSelectResult: () => {
      if (autocomplete.isOpen) {
        const selected = autocomplete.getSelectedSuggestion();
        if (selected) {
          handleSuggestionSelect(selected);
          onKeyboardShortcut?.('select-result');
        }
      }
    },
    onToggleFilters: () => {
      // Toggle filters panel (implementation depends on parent component)
      onKeyboardShortcut?.('toggle-filters');
    },
    onOpenHelp: () => {
      setShowShortcuts(!showShortcuts);
      onKeyboardShortcut?.('open-help');
    }
  }), [
    isFocused,
    autocomplete,
    showShortcuts,
    onKeyboardShortcut
  ]);

  const { shortcuts } = useSearchShortcuts(shortcutCallbacks);

  // ========================
  // Event Handlers
  // ========================

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onChange?.(newValue);
    autocomplete.updateQuery(newValue);
  }, [onChange, autocomplete]);

  const handleInputFocus = useCallback(() => {
    setIsFocused(true);
    if (value.length >= 2) {
      autocomplete.open();
    }
    onFocus?.();
  }, [value, autocomplete, onFocus]);

  const handleInputBlur = useCallback((e: React.FocusEvent) => {
    // Only blur if not focusing on dropdown
    if (!containerRef.current?.contains(e.relatedTarget)) {
      setIsFocused(false);
      autocomplete.close();
      setShowHistory(false);
      onBlur?.();
    }
  }, [autocomplete, onBlur]);

  const handleClear = useCallback(() => {
    setValue('');
    autocomplete.updateQuery('');
    autocomplete.close();
    onChange?.('');
    onClear?.();
    inputRef.current?.focus();
  }, [autocomplete, onChange, onClear]);

  const handleSearch = useCallback((searchValue?: string) => {
    const queryToSearch = searchValue || value;
    if (!queryToSearch.trim()) return;

    // Add to history
    if (enableHistory) {
      addSearch(queryToSearch, 0, 0, { success: true });
    }

    // Close autocomplete
    autocomplete.close();
    setShowHistory(false);

    // Execute search
    onSearch?.(queryToSearch, filters);
  }, [value, filters, enableHistory, addSearch, autocomplete, onSearch]);

  const handleSuggestionSelect = useCallback((suggestion: AutocompleteSuggestion) => {
    setValue(suggestion.text);
    autocomplete.close();
    onChange?.(suggestion.text);
    onSuggestionSelect?.(suggestion);

    // Auto-search if it's a template or category
    if (suggestion.type === 'template' || suggestion.type === 'category') {
      setTimeout(() => handleSearch(suggestion.text), 0);
    }
  }, [autocomplete, onChange, onSuggestionSelect, handleSearch]);

  const handleHistorySelect = useCallback((item: SearchHistoryItem) => {
    setValue(item.query);
    autocomplete.close();
    setShowHistory(false);
    onChange?.(item.query);
    onHistorySelect?.(item);
    setTimeout(() => handleSearch(item.query), 0);
  }, [autocomplete, onChange, onHistorySelect, handleSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (autocomplete.isOpen) {
          const selected = autocomplete.getSelectedSuggestion();
          if (selected) {
            handleSuggestionSelect(selected);
          } else {
            handleSearch();
          }
        } else {
          handleSearch();
        }
        break;

      case 'Escape':
        e.preventDefault();
        if (autocomplete.isOpen) {
          autocomplete.close();
        } else if (showHistory) {
          setShowHistory(false);
        } else {
          handleClear();
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (autocomplete.isOpen) {
          autocomplete.selectNext();
        } else if (value.length >= 2) {
          autocomplete.open();
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (autocomplete.isOpen) {
          autocomplete.selectPrevious();
        }
        break;

      case 'Tab':
        if (autocomplete.isOpen) {
          e.preventDefault();
          const selected = autocomplete.getSelectedSuggestion();
          if (selected) {
            setValue(selected.text);
            autocomplete.close();
          }
        }
        break;
    }
  }, [
    autocomplete,
    showHistory,
    value,
    handleSuggestionSelect,
    handleSearch,
    handleClear
  ]);

  // ========================
  // Imperative Handle
  // ========================

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
    clear: handleClear,
    setValue: (newValue: string) => {
      setValue(newValue);
      autocomplete.updateQuery(newValue);
    },
    getValue: () => value
  }), [handleClear, value, autocomplete]);

  // ========================
  // Effects
  // ========================

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  // Update autocomplete when debounced value changes
  useEffect(() => {
    if (enableAutocomplete && debouncedValue !== value) {
      autocomplete.updateQuery(debouncedValue);
    }
  }, [debouncedValue, value, autocomplete, enableAutocomplete]);

  // ========================
  // Computed Values
  // ========================

  const hasValue = value.length > 0;
  const hasFilters = filters.length > 0;
  const showDropdown = enableAutocomplete && autocomplete.isOpen && isFocused;
  const recentSearches = enableHistory ? getRecentSearches(5) : [];

  const inputClasses = [
    // Base styles
    'w-full rounded-lg border transition-all duration-200 ease-in-out',
    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
    'placeholder-gray-400 dark:placeholder-gray-500',

    // Size variant
    SIZE_STYLES[size],

    // Color variant
    VARIANT_STYLES[variant],

    // State styles
    disabled && 'opacity-50 cursor-not-allowed',
    error && 'border-danger-500 focus:ring-danger-500',
    loading && 'pr-12',

    // Focus styles
    isFocused && !error && 'ring-2 ring-primary-500 border-transparent',

    // Custom class
    className
  ].filter(Boolean).join(' ');

  return (
    <div ref={containerRef} className="relative">
      {/* Main Input Container */}
      <div className="relative">
        {/* Search Icon */}
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
          <Search
            size={size === 'lg' ? 20 : size === 'sm' ? 16 : 18}
            className={`transition-colors duration-200 ${
              isFocused
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          />
        </div>

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          className={`${inputClasses} pl-10`}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          role={role}
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            autocomplete.selectedIndex >= 0
              ? `suggestion-${autocomplete.selectedIndex}`
              : undefined
          }
        />

        {/* Right Side Controls */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
          {/* Loading Indicator */}
          {(loading || isDebouncing) && (
            <RotateCcw
              size={16}
              className="animate-spin text-gray-400 dark:text-gray-500"
            />
          )}

          {/* Performance Indicator */}
          {enablePerformanceIndicators && performanceMetrics && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span>{performanceMetrics.responseTime}ms</span>
              {performanceMetrics.cacheHit && (
                <span className="text-green-600">⚡</span>
              )}
            </div>
          )}

          {/* Filter Indicator */}
          {hasFilters && (
            <div className="flex items-center">
              <Filter size={14} className="text-primary-600 dark:text-primary-400" />
              <span className="ml-1 text-xs text-primary-600 dark:text-primary-400">
                {filters.length}
              </span>
            </div>
          )}

          {/* Clear Button */}
          {hasValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Clear search"
            >
              <X size={14} className="text-gray-400 dark:text-gray-500" />
            </button>
          )}

          {/* Keyboard Shortcut Hint */}
          {showShortcutHints && !isFocused && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Keyboard size={12} />
              <span>Ctrl+K</span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="absolute top-full left-0 mt-1 text-sm text-danger-600 dark:text-danger-400">
            {error}
          </div>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-80 overflow-hidden"
          role="listbox"
        >
          {autocomplete.loading ? (
            <div className="p-4 text-center text-gray-500">
              <RotateCcw size={16} className="animate-spin mx-auto mb-2" />
              Loading suggestions...
            </div>
          ) : autocomplete.error ? (
            <div className="p-4 text-center text-danger-600">
              Error loading suggestions
            </div>
          ) : autocomplete.suggestions.length > 0 ? (
            <div className="py-2 max-h-80 overflow-y-auto">
              {Object.entries(autocomplete.groupedSuggestions).map(([type, suggestions]) => (
                <div key={type}>
                  {/* Type Header */}
                  <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-gray-800">
                    {type === 'history' && <Clock size={12} className="inline mr-2" />}
                    {type === 'category' && <Tag size={12} className="inline mr-2" />}
                    {type}
                  </div>

                  {/* Suggestions */}
                  {suggestions.map((suggestion, index) => {
                    const globalIndex = autocomplete.suggestions.indexOf(suggestion);
                    const isSelected = globalIndex === autocomplete.selectedIndex;

                    return (
                      <button
                        key={suggestion.id}
                        id={`suggestion-${globalIndex}`}
                        type="button"
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                          isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                        }`}
                        onClick={() => handleSuggestionSelect(suggestion)}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                              {suggestion.text}
                            </div>
                            {suggestion.description && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                {suggestion.description}
                              </div>
                            )}
                          </div>
                          {suggestion.type === 'history' && (
                            <TrendingUp size={14} className="text-gray-400 dark:text-gray-500 flex-shrink-0 ml-2" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              No suggestions found
            </div>
          )}
        </div>
      )}

      {/* Search History Sidebar */}
      {enableHistory && showHistory && recentSearches.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-40">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Recent Searches
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="py-2">
            {recentSearches.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleHistorySelect(item)}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-900 dark:text-gray-100 truncate">
                    {item.query}
                  </span>
                  <span className="text-xs text-gray-500 flex items-center ml-2">
                    <Clock size={12} className="mr-1" />
                    {item.resultsCount} results
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      {showShortcuts && enableKeyboardShortcuts && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Keyboard Shortcuts
            </h3>
            <button
              onClick={() => setShowShortcuts(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {shortcuts.slice(0, 6).map((shortcut) => (
              <div key={shortcut.id} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {shortcut.description}
                </span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                  {shortcut.displayText}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}));

IntelligentSearchInput.displayName = 'IntelligentSearchInput';