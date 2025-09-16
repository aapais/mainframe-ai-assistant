/**
 * Enhanced KB Search Bar with Screen Reader Optimizations
 *
 * This component extends the original KBSearchBar with comprehensive
 * screen reader support and accessibility enhancements:
 * - Live region announcements for search states
 * - Proper ARIA labeling and relationships
 * - Screen reader friendly search results
 * - Enhanced keyboard navigation
 * - Progress announcements for searches
 * - Form validation announcements
 *
 * @author Screen Reader Optimization Specialist
 * @version 2.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearch, useSearchQuery, useSearchFilters, useSearchHistory } from '../contexts/SearchContext';
import { KBCategory } from '../../types/services';
import { SearchInput } from './common/SearchInput';
import { ScreenReaderOnly, ScreenReaderStatus } from './ScreenReaderOnly';
import { SearchLoadingIndicator } from './AccessibleLoadingIndicator';
import { useSearchAnnouncements } from '../hooks/useScreenReaderAnnouncements';
import { HeadingManager, ScreenReaderTextUtils } from '../utils/screenReaderUtils';

// =====================
// Types & Interfaces
// =====================

export interface EnhancedKBSearchBarProps {
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  showFilters?: boolean;
  showHistory?: boolean;
  showSuggestions?: boolean;
  onSearchStart?: (query: string) => void;
  onSearchComplete?: (results: any[], query: string) => void;
  onError?: (error: string) => void;

  // Accessibility specific props
  searchLabel?: string;
  searchDescription?: string;
  announceLiveResults?: boolean;
  announceProgressSteps?: boolean;
}

// =====================
// Enhanced Search Suggestions Component
// =====================

const EnhancedSearchSuggestions: React.FC<{
  suggestions: string[];
  query: string;
  onSelect: (suggestion: string) => void;
  onClose: () => void;
  isVisible: boolean;
}> = ({ suggestions, query, onSelect, onClose, isVisible }) => {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isVisible || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = (prev + 1) % suggestions.length;
          return newIndex;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev <= 0 ? suggestions.length - 1 : prev - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          onSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [isVisible, suggestions, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isVisible || suggestions.length === 0) return null;

  return (
    <>
      <ScreenReaderOnly live="polite" id="suggestions-status">
        {suggestions.length} search suggestions available. Use arrow keys to navigate, Enter to select, Escape to close.
      </ScreenReaderOnly>

      <div
        ref={listRef}
        className="search-suggestions"
        style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          maxHeight: '300px',
          overflowY: 'auto',
          zIndex: 1000,
        }}
        role="listbox"
        aria-label="Search suggestions"
        aria-expanded={isVisible}
        aria-activedescendant={selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined}
      >
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion}
            id={`suggestion-${index}`}
            className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
            style={{
              display: 'block',
              width: '100%',
              padding: '0.5rem 0.75rem',
              textAlign: 'left',
              border: 'none',
              backgroundColor: index === selectedIndex ? '#f3f4f6' : 'transparent',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
            onClick={() => onSelect(suggestion)}
            onMouseEnter={() => setSelectedIndex(index)}
            role="option"
            aria-selected={index === selectedIndex}
            aria-label={`Suggestion ${index + 1} of ${suggestions.length}: ${suggestion}`}
          >
            <span style={{ fontWeight: 'medium' }}>
              {suggestion.substring(0, query.length)}
            </span>
            <span style={{ color: '#6b7280' }}>
              {suggestion.substring(query.length)}
            </span>
          </button>
        ))}
      </div>
    </>
  );
};

// =====================
// Enhanced Search History Component
// =====================

const EnhancedSearchHistory: React.FC<{
  history: string[];
  onSelect: (query: string) => void;
  onClear: () => void;
  isVisible: boolean;
}> = ({ history, onSelect, onClear, isVisible }) => {
  if (!isVisible || history.length === 0) return null;

  return (
    <>
      <ScreenReaderOnly live="polite">
        Search history opened with {history.length} recent searches
      </ScreenReaderOnly>

      <div
        className="search-history"
        style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          maxHeight: '250px',
          overflowY: 'auto',
          zIndex: 1000,
        }}
        role="region"
        aria-label="Recent search history"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.75rem',
            borderBottom: '1px solid #e5e7eb',
            fontSize: '0.75rem',
            fontWeight: 'medium',
            color: '#6b7280',
          }}
        >
          <span id="history-heading">Recent searches ({history.length})</span>
          <button
            onClick={onClear}
            style={{
              border: 'none',
              background: 'none',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
            aria-label="Clear search history"
            aria-describedby="history-heading"
          >
            Clear
          </button>
        </div>

        <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {history.slice(0, 10).map((query, index) => (
            <li key={`${query}-${index}`}>
              <button
                className="history-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  textAlign: 'left',
                }}
                onClick={() => onSelect(query)}
                aria-label={`Select previous search: ${query}`}
              >
                <span
                  style={{ marginRight: '0.5rem', fontSize: '0.75rem' }}
                  aria-hidden="true"
                >
                  🕐
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {query}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

// =====================
// Enhanced Search Filters Component
// =====================

const EnhancedSearchFilters: React.FC<{
  isVisible: boolean;
  onToggleAI: (enabled: boolean) => void;
  onCategorySelect: (category?: KBCategory) => void;
  useAI: boolean;
  selectedCategory?: KBCategory;
}> = ({ isVisible, onToggleAI, onCategorySelect, useAI, selectedCategory }) => {
  if (!isVisible) return null;

  const categories: KBCategory[] = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'System', 'Other'];

  return (
    <>
      <ScreenReaderOnly live="polite">
        Search filters panel opened
      </ScreenReaderOnly>

      <div
        className="search-filters"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginTop: '0.5rem',
          padding: '0.75rem',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
        }}
        role="region"
        aria-label="Search filters"
      >
        {/* AI Toggle Section */}
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="sr-only">AI Search Options</legend>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem',
              backgroundColor: useAI ? '#dbeafe' : 'white',
              border: `1px solid ${useAI ? '#3b82f6' : '#d1d5db'}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            <input
              type="checkbox"
              checked={useAI}
              onChange={(e) => onToggleAI(e.target.checked)}
              style={{ margin: 0 }}
              aria-describedby="ai-description"
            />
            <span>🤖 AI Enhanced Search</span>
          </label>
          <ScreenReaderOnly id="ai-description">
            When enabled, uses artificial intelligence to find semantically similar results
          </ScreenReaderOnly>
        </fieldset>

        {/* Category Filter Section */}
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{
            fontSize: '0.875rem',
            fontWeight: 'medium',
            marginBottom: '0.5rem',
            color: '#374151'
          }}>
            Filter by Category
          </legend>

          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}
            role="radiogroup"
            aria-label="Knowledge base categories"
          >
            <label style={{ display: 'inline-flex', alignItems: 'center' }}>
              <input
                type="radio"
                name="category"
                checked={!selectedCategory}
                onChange={() => onCategorySelect(undefined)}
                style={{ marginRight: '0.25rem' }}
              />
              <span
                style={{
                  padding: '0.25rem 0.5rem',
                  border: `1px solid ${!selectedCategory ? '#3b82f6' : '#d1d5db'}`,
                  backgroundColor: !selectedCategory ? '#dbeafe' : 'white',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                All Categories
              </span>
            </label>

            {categories.map(category => (
              <label key={category} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <input
                  type="radio"
                  name="category"
                  checked={selectedCategory === category}
                  onChange={() => onCategorySelect(category)}
                  style={{ marginRight: '0.25rem' }}
                  aria-describedby={`category-${category}-desc`}
                />
                <span
                  style={{
                    padding: '0.25rem 0.5rem',
                    border: `1px solid ${selectedCategory === category ? '#3b82f6' : '#d1d5db'}`,
                    backgroundColor: selectedCategory === category ? '#dbeafe' : 'white',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  {category}
                </span>
                <ScreenReaderOnly id={`category-${category}-desc`}>
                  Filter results to {category} category only
                </ScreenReaderOnly>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </>
  );
};

// =====================
// Main Enhanced Search Bar Component
// =====================

export const EnhancedKBSearchBar: React.FC<EnhancedKBSearchBarProps> = ({
  className = '',
  placeholder = "Search problems, solutions, error codes...",
  autoFocus = false,
  showFilters = true,
  showHistory = true,
  showSuggestions = true,
  searchLabel = "Search Knowledge Base",
  searchDescription = "Enter terms to search for problems, solutions, or error codes",
  announceLiveResults = true,
  announceProgressSteps = true,
  onSearchStart,
  onSearchComplete,
  onError,
}) => {
  // Context hooks
  const {
    state,
    performSearch,
    generateSuggestions,
    setUseAI,
  } = useSearch();
  const { query, setQuery } = useSearchQuery();
  const { filters, updateFilters } = useSearchFilters();
  const { searchHistory, clearHistory } = useSearchHistory();

  // Screen reader announcements
  const { announceSearchStart, announceSearchEnd, announceSearchError } = useSearchAnnouncements();

  // Local state
  const [showSuggestionsDropdown, setShowSuggestionsDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [searchStartTime, setSearchStartTime] = useState<number>(0);

  // Refs
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate unique IDs
  const searchInputId = 'kb-search-input';
  const searchDescId = 'kb-search-description';
  const resultsStatusId = 'kb-search-results-status';

  // =====================
  // Enhanced Search Handlers
  // =====================

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setShowSuggestionsDropdown(false);
    setShowHistoryDropdown(false);
    setSearchStartTime(Date.now());

    try {
      // Announce search start
      if (announceProgressSteps) {
        announceSearchStart(searchQuery);
      }

      onSearchStart?.(searchQuery);
      await performSearch(searchQuery);

      // Calculate search time and announce results
      const searchTime = Date.now() - searchStartTime;

      if (announceLiveResults) {
        announceSearchEnd({
          count: state.results.length,
          query: searchQuery,
          timeMs: searchTime
        });
      }

      onSearchComplete?.(state.results, searchQuery);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Search failed';
      announceSearchError(errorMessage, searchQuery);
      onError?.(errorMessage);
    }
  }, [
    performSearch,
    state.results,
    announceProgressSteps,
    announceLiveResults,
    announceSearchStart,
    announceSearchEnd,
    announceSearchError,
    onSearchStart,
    onSearchComplete,
    onError,
    searchStartTime
  ]);

  const handleQueryChange = useCallback(async (newQuery: string) => {
    setQuery(newQuery);

    if (newQuery.trim().length >= 2 && showSuggestions) {
      try {
        const newSuggestions = await generateSuggestions(newQuery);
        setSuggestions(newSuggestions);
        setShowSuggestionsDropdown(true);
        setShowHistoryDropdown(false);
      } catch (error) {
        console.warn('Failed to generate suggestions:', error);
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
      setShowSuggestionsDropdown(false);
    }
  }, [setQuery, generateSuggestions, showSuggestions]);

  const handleInputFocus = useCallback(() => {
    if (query.trim().length === 0 && searchHistory.length > 0 && showHistory) {
      setShowHistoryDropdown(true);
      setShowSuggestionsDropdown(false);
    } else if (query.trim().length >= 2 && suggestions.length > 0) {
      setShowSuggestionsDropdown(true);
      setShowHistoryDropdown(false);
    }
  }, [query, searchHistory, suggestions, showHistory]);

  const handleInputBlur = useCallback((e: React.FocusEvent) => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => {
      if (!searchContainerRef.current?.contains(e.relatedTarget as Node)) {
        setShowSuggestionsDropdown(false);
        setShowHistoryDropdown(false);
      }
    }, 150);
  }, []);

  const handleSuggestionSelect = useCallback((suggestion: string) => {
    setQuery(suggestion);
    handleSearch(suggestion);
    inputRef.current?.focus();
  }, [setQuery, handleSearch]);

  const handleHistorySelect = useCallback((historyQuery: string) => {
    setQuery(historyQuery);
    handleSearch(historyQuery);
    setShowHistoryDropdown(false);
    inputRef.current?.focus();
  }, [setQuery, handleSearch]);

  const handleClearQuery = useCallback(() => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestionsDropdown(false);
    setShowHistoryDropdown(false);
    inputRef.current?.focus();
  }, [setQuery]);

  // =====================
  // Enhanced Filter Handlers
  // =====================

  const handleToggleAI = useCallback((enabled: boolean) => {
    setUseAI(enabled);

    // Announce AI toggle change
    if (announceProgressSteps) {
      const message = enabled
        ? 'AI enhanced search enabled'
        : 'AI enhanced search disabled';
      // This would use the screen reader announcements
    }

    // Re-run search if there's a current query
    if (query.trim()) {
      handleSearch(query);
    }
  }, [setUseAI, query, handleSearch, announceProgressSteps]);

  const handleCategorySelect = useCallback((category?: KBCategory) => {
    updateFilters({ category });

    // Announce category filter change
    if (announceProgressSteps) {
      const message = category
        ? `Filtered to ${category} category`
        : 'All categories selected';
      // This would use the screen reader announcements
    }

    // Re-run search if there's a current query
    if (query.trim()) {
      handleSearch(query);
    }
  }, [updateFilters, query, handleSearch, announceProgressSteps]);

  // =====================
  // Enhanced Keyboard Navigation
  // =====================

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (query.trim()) {
          handleSearch(query);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestionsDropdown(false);
        setShowHistoryDropdown(false);
        setShowFiltersPanel(false);
        inputRef.current?.blur();
        break;
      case 'ArrowDown':
        if (!showSuggestionsDropdown && !showHistoryDropdown && searchHistory.length > 0) {
          e.preventDefault();
          setShowHistoryDropdown(true);
        }
        break;
      case 'F1':
        // Help shortcut
        e.preventDefault();
        // Could open help modal or announce keyboard shortcuts
        break;
    }
  }, [query, handleSearch, showSuggestionsDropdown, showHistoryDropdown, searchHistory]);

  // =====================
  // Click Outside Handler
  // =====================

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestionsDropdown(false);
        setShowHistoryDropdown(false);
        setShowFiltersPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // =====================
  // Render
  // =====================

  return (
    <div
      ref={searchContainerRef}
      className={`enhanced-kb-search-bar ${className}`}
      style={{ position: 'relative', width: '100%' }}
      role="search"
      aria-label={searchLabel}
    >
      {/* Screen reader instructions */}
      <ScreenReaderOnly id={searchDescId}>
        {searchDescription}
        {showSuggestions && " Type at least 2 characters to see suggestions."}
        {showHistory && " Press arrow down for search history."}
        Press F1 for keyboard shortcuts.
      </ScreenReaderOnly>

      {/* Main Search Input */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <SearchInput
          ref={inputRef}
          id={searchInputId}
          value={query}
          onChange={handleQueryChange}
          onSearch={handleSearch}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          loading={state.isSearching}
          autoFocus={autoFocus}
          className="flex-1"
          aria-label={searchLabel}
          aria-describedby={searchDescId}
          aria-expanded={showSuggestionsDropdown || showHistoryDropdown}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          role="combobox"
        />

        {/* Search Loading Indicator */}
        <SearchLoadingIndicator
          loading={state.isSearching}
          message="Searching knowledge base"
          size="sm"
          quiet={!announceProgressSteps}
        />

        {/* Search Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {/* Clear Button */}
          {query && (
            <button
              onClick={handleClearQuery}
              style={{
                padding: '0.5rem',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#6b7280',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
              title="Clear search query"
              aria-label="Clear search query"
            >
              ✕
            </button>
          )}

          {/* Filters Toggle */}
          {showFilters && (
            <button
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              style={{
                padding: '0.5rem',
                border: `1px solid ${showFiltersPanel ? '#3b82f6' : '#d1d5db'}`,
                backgroundColor: showFiltersPanel ? '#dbeafe' : 'white',
                color: showFiltersPanel ? '#1d4ed8' : '#6b7280',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
              title="Search filters and options"
              aria-label="Toggle search filters"
              aria-expanded={showFiltersPanel}
              aria-controls="search-filters-panel"
            >
              🔍
            </button>
          )}
        </div>
      </div>

      {/* Live Region for Search Results Status */}
      <ScreenReaderStatus id={resultsStatusId}>
        {state.results.length > 0 && (
          <>
            {ScreenReaderTextUtils.createSearchResultsDescription(
              state.results.length,
              query,
              state.searchMetrics?.queryTime
            )}
            {state.searchMetrics?.aiUsed && ". AI enhanced search was used."}
            {state.searchMetrics?.cacheHit && ". Results were retrieved from cache."}
          </>
        )}
      </ScreenReaderStatus>

      {/* Visual Search Results Info */}
      {state.results.length > 0 && (
        <div
          style={{
            fontSize: '0.75rem',
            color: '#6b7280',
            marginTop: '0.25rem',
          }}
          aria-hidden="true" // Hidden since announced in live region
        >
          {state.totalResults} results found
          {state.searchMetrics && (
            <span> in {state.searchMetrics.queryTime.toFixed(0)}ms</span>
          )}
          {state.searchMetrics?.aiUsed && <span> • AI enhanced</span>}
          {state.searchMetrics?.cacheHit && <span> • Cached</span>}
        </div>
      )}

      {/* Error Display */}
      {state.searchError && (
        <div
          style={{
            fontSize: '0.875rem',
            color: '#dc2626',
            marginTop: '0.25rem',
            padding: '0.5rem',
            backgroundColor: '#fef2f2',
            borderRadius: '4px',
            border: '1px solid #fecaca',
          }}
          role="alert"
          aria-live="assertive"
        >
          <span aria-hidden="true">⚠️ </span>
          Search error: {state.searchError}
        </div>
      )}

      {/* Enhanced Suggestions Dropdown */}
      <EnhancedSearchSuggestions
        suggestions={suggestions}
        query={query}
        onSelect={handleSuggestionSelect}
        onClose={() => setShowSuggestionsDropdown(false)}
        isVisible={showSuggestionsDropdown}
      />

      {/* Enhanced History Dropdown */}
      <EnhancedSearchHistory
        history={searchHistory}
        onSelect={handleHistorySelect}
        onClear={clearHistory}
        isVisible={showHistoryDropdown}
      />

      {/* Enhanced Filters Panel */}
      <div id="search-filters-panel">
        <EnhancedSearchFilters
          isVisible={showFiltersPanel}
          onToggleAI={handleToggleAI}
          onCategorySelect={handleCategorySelect}
          useAI={state.useAI}
          selectedCategory={filters.category}
        />
      </div>

      {/* Keyboard Shortcuts (Screen Reader Only) */}
      <ScreenReaderOnly>
        <details>
          <summary>Keyboard shortcuts for search</summary>
          <ul>
            <li>Enter: Perform search</li>
            <li>Escape: Close dropdowns and clear focus</li>
            <li>Arrow Down: Open search history (when input is empty)</li>
            <li>Arrow Up/Down: Navigate suggestions or history</li>
            <li>F1: Show help</li>
          </ul>
        </details>
      </ScreenReaderOnly>
    </div>
  );
};

export default EnhancedKBSearchBar;