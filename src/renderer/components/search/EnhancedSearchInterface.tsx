/**
 * Enhanced Search Interface with Advanced Interaction Patterns
 *
 * Features:
 * - Smart debouncing with different timings for autocomplete vs search
 * - Comprehensive keyboard shortcuts and navigation
 * - Visual feedback for all interactions
 * - Intelligent suggestion highlighting
 * - Context-aware search routing
 * - Accessibility compliant design
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Search, X, Filter, History, Command, Sparkles, Clock, TrendingUp } from 'lucide-react';
import { useSearchDebounce } from '../../hooks/useSmartDebounce';
import { useGlobalKeyboardShortcuts } from '../../hooks/useGlobalKeyboardShortcuts';
import { useSearch } from '../../contexts/SearchContext';

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'popular' | 'suggested' | 'ai';
  category?: string;
  count?: number;
  score?: number;
}

interface EnhancedSearchInterfaceProps {
  placeholder?: string;
  autoFocus?: boolean;
  showFilters?: boolean;
  showSuggestions?: boolean;
  showHistory?: boolean;
  enableAI?: boolean;
  onSearch?: (query: string, useAI: boolean) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
}

export const EnhancedSearchInterface: React.FC<EnhancedSearchInterfaceProps> = ({
  placeholder = "Search for solutions, problems, or error codes...",
  autoFocus = false,
  showFilters = true,
  showSuggestions = true,
  showHistory = true,
  enableAI = true,
  onSearch,
  onFocus,
  onBlur,
  className = ''
}) => {
  // State
  const [query, setQuery] = useState('');
  const [useAI, setUseAI] = useState(enableAI);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestionsDropdown, setShowSuggestionsDropdown] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [searchMode, setSearchMode] = useState<'local' | 'ai' | 'intelligent'>('intelligent');

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Smart debouncing for different operations
  const {
    debouncedValue: searchValue,
    autocompleteValue,
    isAutocompletePending,
    isSearchPending,
    flush: flushSearch,
    flushAutocomplete,
    updateImmediate
  } = useSearchDebounce(query, {
    autocompleteDelay: 150,
    searchDelay: 300,
    minQueryLength: 2,
    minSearchLength: 1,
    debug: process.env.NODE_ENV === 'development'
  });

  // Search context
  const { state: searchState, performSearch } = useSearch();

  // Mock suggestions data
  const POPULAR_SEARCHES = useMemo(() => [
    { id: '1', text: 'S0C4 ABEND', type: 'popular', category: 'COBOL', count: 45 },
    { id: '2', text: 'DB2 SQLCODE -818', type: 'popular', category: 'DB2', count: 32 },
    { id: '3', text: 'VSAM File Status 93', type: 'popular', category: 'VSAM', count: 28 },
    { id: '4', text: 'JCL NOT FOUND', type: 'popular', category: 'JCL', count: 24 },
    { id: '5', text: 'CICS ABEND', type: 'popular', category: 'CICS', count: 19 }
  ] as const, []);

  const SMART_SUGGESTIONS = useMemo(() => [
    'S0C7 data exception',
    'Memory protection violation',
    'File not found error',
    'Compilation error',
    'Job execution failed',
    'Connection timeout',
    'Invalid cursor state',
    'Deadlock detected'
  ], []);

  // Load search history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('searchHistory');
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch (error) {
        console.warn('Failed to load search history:', error);
      }
    }
  }, []);

  // Save search history to localStorage
  const saveToHistory = useCallback((searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    setSearchHistory(prev => {
      const updated = [trimmed, ...prev.filter(q => q !== trimmed)].slice(0, 10);
      localStorage.setItem('searchHistory', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Generate suggestions based on query
  const generateSuggestions = useCallback((searchQuery: string): SearchSuggestion[] => {
    if (!searchQuery.trim()) {
      return POPULAR_SEARCHES.slice(0, 5);
    }

    const query = searchQuery.toLowerCase().trim();
    const suggestions: SearchSuggestion[] = [];

    // Add matching smart suggestions
    SMART_SUGGESTIONS
      .filter(suggestion => suggestion.toLowerCase().includes(query))
      .slice(0, 3)
      .forEach((text, index) => {
        suggestions.push({
          id: `suggested-${index}`,
          text,
          type: 'suggested',
          score: text.toLowerCase().indexOf(query) === 0 ? 1 : 0.8
        });
      });

    // Add matching history
    searchHistory
      .filter(item => item.toLowerCase().includes(query))
      .slice(0, 2)
      .forEach((text, index) => {
        suggestions.push({
          id: `recent-${index}`,
          text,
          type: 'recent'
        });
      });

    // Add popular searches if query matches
    POPULAR_SEARCHES
      .filter(item => item.text.toLowerCase().includes(query))
      .slice(0, 3)
      .forEach(item => {
        suggestions.push({
          ...item,
          type: 'popular'
        });
      });

    // Sort by relevance
    return suggestions.sort((a, b) => {
      const aScore = a.score || 0.5;
      const bScore = b.score || 0.5;
      return bScore - aScore;
    }).slice(0, 8);
  }, [POPULAR_SEARCHES, SMART_SUGGESTIONS, searchHistory]);

  // Update suggestions when autocomplete value changes
  useEffect(() => {
    if (autocompleteValue && showSuggestions) {
      const newSuggestions = generateSuggestions(autocompleteValue);
      setSuggestions(newSuggestions);
      setShowSuggestionsDropdown(newSuggestions.length > 0 && isFocused);
    } else {
      setSuggestions([]);
      setShowSuggestionsDropdown(false);
    }
    setSelectedSuggestionIndex(-1);
  }, [autocompleteValue, generateSuggestions, showSuggestions, isFocused]);

  // Perform search when debounced value changes
  useEffect(() => {
    if (searchValue && searchValue.trim()) {
      handleSearch(searchValue);
    }
  }, [searchValue]);

  // Handle search execution
  const handleSearch = useCallback(async (searchQuery: string, immediate = false) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    console.log('Executing search:', { query: trimmed, useAI, immediate });

    try {
      // Save to history
      saveToHistory(trimmed);

      // Hide suggestions
      setShowSuggestionsDropdown(false);
      setSelectedSuggestionIndex(-1);

      // Call external search handler
      if (onSearch) {
        onSearch(trimmed, useAI);
      } else {
        // Use context search
        await performSearch(trimmed);
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, [useAI, saveToHistory, onSearch, performSearch]);

  // Handle input changes
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);

    // Reset suggestion selection
    setSelectedSuggestionIndex(-1);
  }, []);

  // Handle input focus
  const handleInputFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();

    // Show appropriate dropdown
    if (!query.trim() && searchHistory.length > 0 && showHistory) {
      const recentSuggestions = searchHistory.slice(0, 5).map((text, index) => ({
        id: `recent-${index}`,
        text,
        type: 'recent' as const
      }));
      setSuggestions([...recentSuggestions, ...POPULAR_SEARCHES.slice(0, 3)]);
      setShowSuggestionsDropdown(true);
    } else if (suggestions.length > 0) {
      setShowSuggestionsDropdown(true);
    }
  }, [query, searchHistory, showHistory, suggestions, POPULAR_SEARCHES, onFocus]);

  // Handle input blur
  const handleInputBlur = useCallback((e: React.FocusEvent) => {
    // Delay hiding to allow clicking on suggestions
    setTimeout(() => {
      if (!containerRef.current?.contains(e.relatedTarget as Node)) {
        setIsFocused(false);
        setShowSuggestionsDropdown(false);
        setShowFiltersPanel(false);
        setSelectedSuggestionIndex(-1);
        onBlur?.();
      }
    }, 150);
  }, [onBlur]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    updateImmediate(suggestion.text);
    handleSearch(suggestion.text, true);
    inputRef.current?.focus();
  }, [updateImmediate, handleSearch]);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setQuery('');
    updateImmediate('');
    setShowSuggestionsDropdown(false);
    setSelectedSuggestionIndex(-1);
    inputRef.current?.focus();
  }, [updateImmediate]);

  // Keyboard navigation for suggestions
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestionsDropdown && suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedSuggestionIndex(prev =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedSuggestionIndex(prev =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedSuggestionIndex >= 0) {
            handleSuggestionSelect(suggestions[selectedSuggestionIndex]);
          } else if (query.trim()) {
            flushSearch();
            handleSearch(query, true);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowSuggestionsDropdown(false);
          setSelectedSuggestionIndex(-1);
          break;
        case 'Tab':
          // Allow normal tab behavior but close suggestions
          setShowSuggestionsDropdown(false);
          setSelectedSuggestionIndex(-1);
          break;
      }
    } else {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          if (query.trim()) {
            flushSearch();
            handleSearch(query, true);
          }
          break;
        case 'Escape':
          e.preventDefault();
          if (query) {
            handleClearSearch();
          } else {
            inputRef.current?.blur();
          }
          break;
        case 'ArrowDown':
          if (suggestions.length > 0) {
            e.preventDefault();
            setShowSuggestionsDropdown(true);
            setSelectedSuggestionIndex(0);
          }
          break;
      }
    }
  }, [
    showSuggestionsDropdown,
    suggestions,
    selectedSuggestionIndex,
    query,
    handleSuggestionSelect,
    flushSearch,
    handleSearch,
    handleClearSearch
  ]);

  // Global keyboard shortcuts
  useGlobalKeyboardShortcuts({
    onGlobalSearch: () => {
      inputRef.current?.focus();
    },
    onCommandPalette: () => {
      inputRef.current?.focus();
      setShowFiltersPanel(true);
    },
    onFocusSearch: () => {
      inputRef.current?.focus();
    }
  }, {
    enabled: true,
    enableGlobalSearch: true,
    enableCommandPalette: true,
    searchInputSelector: 'input[data-search-input="true"]'
  });

  // Get suggestion icon
  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'recent':
        return <Clock className="w-4 h-4 text-gray-400" />;
      case 'popular':
        return <TrendingUp className="w-4 h-4 text-blue-500" />;
      case 'ai':
        return <Sparkles className="w-4 h-4 text-purple-500" />;
      default:
        return <Search className="w-4 h-4 text-gray-400" />;
    }
  };

  // Highlight matching text in suggestions
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;

    return (
      <>
        {text.substring(0, index)}
        <mark className="bg-yellow-200 text-gray-900 font-medium">
          {text.substring(index, index + query.length)}
        </mark>
        {text.substring(index + query.length)}
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`enhanced-search-interface relative w-full ${className}`}
      role="search"
      aria-label="Enhanced search interface"
    >
      {/* Main Search Input */}
      <div className={`
        flex items-center bg-white border-2 rounded-lg shadow-sm transition-all duration-200
        ${isFocused ? 'border-blue-500 shadow-lg' : 'border-gray-300'}
        ${isSearchPending ? 'border-blue-400 shadow-md' : ''}
      `}>
        {/* Search Icon */}
        <div className="pl-3 pr-2">
          <Search className={`w-5 h-5 transition-colors ${
            isFocused ? 'text-blue-500' : 'text-gray-400'
          }`} />
        </div>

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          data-search-input="true"
          className="flex-1 py-3 px-2 text-gray-900 placeholder-gray-500 border-none outline-none bg-transparent"
          aria-label="Search input"
          aria-expanded={showSuggestionsDropdown}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-describedby="search-instructions"
          role="combobox"
        />

        {/* Loading indicator */}
        {(isAutocompletePending || isSearchPending) && (
          <div className="px-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* AI Toggle */}
        {enableAI && (
          <div className="px-2">
            <button
              onClick={() => setUseAI(!useAI)}
              className={`
                flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors
                ${useAI
                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
              `}
              title={`${useAI ? 'Disable' : 'Enable'} AI-enhanced search`}
              aria-label={`${useAI ? 'Disable' : 'Enable'} AI-enhanced search`}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              AI
            </button>
          </div>
        )}

        {/* Clear Button */}
        {query && (
          <button
            onClick={handleClearSearch}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Clear search"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Filters Button */}
        {showFilters && (
          <button
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            className={`
              p-2 mr-2 rounded-md transition-colors
              ${showFiltersPanel
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }
            `}
            title="Search filters"
            aria-label="Toggle search filters"
            aria-expanded={showFiltersPanel}
          >
            <Filter className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Instructions */}
      <div id="search-instructions" className="sr-only">
        Type to search. Use arrow keys to navigate suggestions. Press Enter to search or select a suggestion. Press Escape to clear or close suggestions.
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestionsDropdown && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
          role="listbox"
          aria-label="Search suggestions"
        >
          {!query.trim() && (
            <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100">
              Recent & Popular Searches
            </div>
          )}

          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              onClick={() => handleSuggestionSelect(suggestion)}
              onMouseEnter={() => setSelectedSuggestionIndex(index)}
              className={`
                w-full flex items-center px-3 py-2 text-left hover:bg-gray-50 transition-colors
                ${index === selectedSuggestionIndex ? 'bg-blue-50 border-r-2 border-blue-500' : ''}
              `}
              role="option"
              aria-selected={index === selectedSuggestionIndex}
              aria-label={`Search suggestion: ${suggestion.text}`}
            >
              <div className="mr-3">
                {getSuggestionIcon(suggestion.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">
                  {highlightMatch(suggestion.text, query)}
                </div>
                {suggestion.category && (
                  <div className="text-xs text-gray-500">
                    {suggestion.category}
                  </div>
                )}
              </div>

              {suggestion.count && (
                <div className="ml-2 px-2 py-0.5 bg-gray-100 text-xs text-gray-600 rounded-full">
                  {suggestion.count}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Search Status */}
      {searchState.results && searchState.results.length > 0 && (
        <div className="mt-2 text-xs text-gray-600">
          Found {searchState.results.length} results
          {searchState.searchMetrics && (
            <span> in {searchState.searchMetrics.queryTime.toFixed(0)}ms</span>
          )}
          {useAI && <span className="ml-2 text-purple-600">• AI Enhanced</span>}
        </div>
      )}

      {/* Keyboard Shortcuts Hint */}
      <div className="mt-2 text-xs text-gray-500 flex items-center space-x-4">
        <span className="flex items-center">
          <Command className="w-3 h-3 mr-1" />
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Ctrl</kbd>
          <span className="mx-1">+</span>
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">K</kbd>
          <span className="ml-1">to focus</span>
        </span>
        <span className="flex items-center">
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">/</kbd>
          <span className="ml-1">quick search</span>
        </span>
        <span className="flex items-center">
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">↑↓</kbd>
          <span className="ml-1">navigate</span>
        </span>
      </div>
    </div>
  );
};

export default EnhancedSearchInterface;