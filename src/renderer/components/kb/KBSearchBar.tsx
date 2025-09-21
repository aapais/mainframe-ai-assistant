/**
 * KB Search Bar - Enhanced Search Component with Context Integration
 * 
 * This component provides a comprehensive search interface with:
 * - Integration with SearchContext for state management
 * - Real-time suggestions and autocomplete
 * - Advanced search filters and options
 * - Loading states and error handling
 * - Keyboard navigation and accessibility
 * - Performance optimization with debouncing
 * - Search history and quick access
 * 
 * @author Frontend Integration Specialist
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearch, useSearchQuery, useSearchFilters, useSearchHistory } from '../contexts/SearchContext';
import { KBCategory } from '../../types/services';
import { SearchInput } from './ui/Input';

// =====================
// Types & Interfaces
// =====================

export interface KBSearchBarProps {
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  showFilters?: boolean;
  showHistory?: boolean;
  showSuggestions?: boolean;
  onSearchStart?: (query: string) => void;
  onSearchComplete?: (results: any[], query: string) => void;
  onError?: (error: string) => void;
}

// =====================
// Search Suggestions Component
// =====================

const SearchSuggestions: React.FC<{
  suggestions: string[];
  query: string;
  onSelect: (suggestion: string) => void;
  onClose: () => void;
  isVisible: boolean;
}> = ({ suggestions, query, onSelect, onClose, isVisible }) => {
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isVisible || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
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
    <div
      className="search-suggestions"
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: 'white',
        border: '1px solid #d1d5db',
        borderRadius: '0 0 8px 8px',
        borderTop: '1px solid #e5e7eb',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
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
            padding: '12px 16px',
            textAlign: 'left',
            border: 'none',
            backgroundColor: index === selectedIndex ? '#e0e7ff' : 'transparent',
            cursor: 'pointer',
            fontSize: '0.875rem',
            transition: 'all 150ms ease-in-out',
            borderLeft: index === selectedIndex ? '3px solid #7c3aed' : '3px solid transparent',
          }}
          onClick={() => onSelect(suggestion)}
          onMouseEnter={() => setSelectedIndex(index)}
          role="option"
          aria-selected={index === selectedIndex}
          aria-label={`Suggestion ${index + 1} of ${suggestions.length}: ${suggestion}`}
          tabIndex={-1}
        >
          <span style={{ fontWeight: 'medium' }}>
            {suggestion.substring(0, query.length)}
          </span>
          <span style={{ color: '#4b5563' }}>
            {suggestion.substring(query.length)}
          </span>
        </button>
      ))}
    </div>
  );
};

// =====================
// Search History Component
// =====================

const SearchHistory: React.FC<{
  history: string[];
  onSelect: (query: string) => void;
  onClear: () => void;
  isVisible: boolean;
}> = ({ history, onSelect, onClear, isVisible }) => {
  if (!isVisible || history.length === 0) return null;

  return (
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
          color: '#4b5563',
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
            minHeight: '32px',
            minWidth: '32px',
            padding: '4px 8px',
            borderRadius: '4px',
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
                padding: '12px 16px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '0.875rem',
                textAlign: 'left',
                minHeight: '44px',
              }}
              onClick={() => onSelect(query)}
              aria-label={`Select previous search: ${query}`}
            >
              <span
                style={{ marginRight: '8px', fontSize: '0.75rem' }}
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
  );
};

// =====================
// Search Filters Component
// =====================

const SearchFilters: React.FC<{
  isVisible: boolean;
  onToggleAI: (enabled: boolean) => void;
  onCategorySelect: (category?: KBCategory) => void;
  useAI: boolean;
  selectedCategory?: KBCategory;
}> = ({ isVisible, onToggleAI, onCategorySelect, useAI, selectedCategory }) => {
  if (!isVisible) return null;

  const categories: KBCategory[] = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'System', 'Other'];

  return (
    <div
      className="search-filters"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        marginTop: '0.5rem',
        padding: '16px',
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
            padding: '12px',
            backgroundColor: useAI ? '#dbeafe' : 'white',
            border: `1px solid ${useAI ? '#3b82f6' : '#d1d5db'}`,
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            minHeight: '44px',
          }}
        >
          <input
            type="checkbox"
            checked={useAI}
            onChange={(e) => onToggleAI(e.target.checked)}
            style={{ margin: 0, width: '16px', height: '16px' }}
            aria-describedby="ai-description"
          />
          <span>🤖 AI Enhanced Search</span>
        </label>
        <div id="ai-description" className="sr-only">
          When enabled, uses artificial intelligence to find semantically similar results
        </div>
      </fieldset>

      {/* Category Filter Section */}
      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend style={{
          fontSize: '0.875rem',
          fontWeight: 'medium',
          marginBottom: '8px',
          color: '#374151'
        }}>
          Filter by Category
        </legend>

        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
          role="radiogroup"
          aria-label="Knowledge base categories"
        >
          <label style={{ display: 'inline-flex', alignItems: 'center' }}>
            <input
              type="radio"
              name="category"
              checked={!selectedCategory}
              onChange={() => onCategorySelect(undefined)}
              style={{ marginRight: '4px' }}
            />
            <span
              style={{
                padding: '8px 12px',
                border: `1px solid ${!selectedCategory ? '#3b82f6' : '#d1d5db'}`,
                backgroundColor: !selectedCategory ? '#dbeafe' : 'white',
                borderRadius: '6px',
                fontSize: '0.875rem',
                cursor: 'pointer',
                minHeight: '36px',
                display: 'flex',
                alignItems: 'center',
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
                style={{ marginRight: '4px' }}
                aria-describedby={`category-${category}-desc`}
              />
              <span
                style={{
                  padding: '8px 12px',
                  border: `1px solid ${selectedCategory === category ? '#3b82f6' : '#d1d5db'}`,
                  backgroundColor: selectedCategory === category ? '#dbeafe' : 'white',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  minHeight: '36px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {category}
              </span>
              <div id={`category-${category}-desc`} className="sr-only">
                Filter results to {category} category only
              </div>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
};

// =====================
// Main Search Bar Component
// =====================

export const KBSearchBar: React.FC<KBSearchBarProps> = ({
  className = '',
  placeholder = "Search problems, solutions, error codes...",
  autoFocus = false,
  showFilters = true,
  showHistory = true,
  showSuggestions = true,
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

  // Local state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showHistory, setShowHistoryDropdown] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  // Refs
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // =====================
  // Search Handlers
  // =====================

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setShowSuggestions(false);
    setShowHistoryDropdown(false);
    
    try {
      onSearchStart?.(searchQuery);
      await performSearch(searchQuery);
      onSearchComplete?.(state.results, searchQuery);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Search failed';
      onError?.(errorMessage);
    }
  }, [performSearch, state.results, onSearchStart, onSearchComplete, onError]);

  const handleQueryChange = useCallback(async (newQuery: string) => {
    setQuery(newQuery);

    if (newQuery.trim().length >= 2 && showSuggestions) {
      try {
        const newSuggestions = await generateSuggestions(newQuery);
        setSuggestions(newSuggestions);
        setShowSuggestions(true);
        setShowHistoryDropdown(false);
      } catch (error) {
        console.warn('Failed to generate suggestions:', error);
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [setQuery, generateSuggestions]);

  const handleInputFocus = useCallback(() => {
    if (query.trim().length === 0 && searchHistory.length > 0 && showHistory) {
      setShowHistoryDropdown(true);
      setShowSuggestions(false);
    } else if (query.trim().length >= 2 && suggestions.length > 0) {
      setShowSuggestions(true);
      setShowHistoryDropdown(false);
    }
  }, [query, searchHistory, suggestions, showHistory]);

  const handleInputBlur = useCallback((e: React.FocusEvent) => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => {
      if (!searchContainerRef.current?.contains(e.relatedTarget as Node)) {
        setShowSuggestions(false);
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
    setShowSuggestions(false);
    setShowHistoryDropdown(false);
    inputRef.current?.focus();
  }, [setQuery]);

  // =====================
  // Filter Handlers
  // =====================

  const handleToggleAI = useCallback((enabled: boolean) => {
    setUseAI(enabled);
    
    // Re-run search if there's a current query
    if (query.trim()) {
      handleSearch(query);
    }
  }, [setUseAI, query, handleSearch]);

  const handleCategorySelect = useCallback((category?: KBCategory) => {
    updateFilters({ category });
    
    // Re-run search if there's a current query
    if (query.trim()) {
      handleSearch(query);
    }
  }, [updateFilters, query, handleSearch]);

  // =====================
  // Keyboard Navigation
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
        setShowSuggestions(false);
        setShowHistoryDropdown(false);
        inputRef.current?.blur();
        break;
      case 'ArrowDown':
        if (!showSuggestions && !showHistory && searchHistory.length > 0) {
          e.preventDefault();
          setShowHistoryDropdown(true);
        }
        break;
    }
  }, [query, handleSearch, showSuggestions, showHistory, searchHistory]);

  // =====================
  // Click Outside Handler
  // =====================

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
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
      className={`kb-search-bar ${className}`}
      style={{ position: 'relative', width: '100%' }}
      role="search"
      aria-label="Knowledge base search"
    >
      {/* Main Search Input */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <SearchInput
          ref={inputRef}
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
          aria-label="Search knowledge base"
          aria-describedby="search-description search-results-info"
          aria-expanded={showSuggestions || showHistoryDropdown}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          role="combobox"
        />

        {/* Screen reader instructions */}
        <div id="search-description" className="sr-only">
          Enter terms to search for problems, solutions, or error codes.
          {showSuggestions && " Type at least 2 characters to see suggestions."}
          {showHistory && " Press arrow down for search history."}
          Press Escape to close suggestions.
        </div>

        {/* Search Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {/* Clear Button */}
          {query && (
            <button
              onClick={handleClearQuery}
              className={`clear-button ${query ? 'visible' : ''}`}
              style={{
                padding: '8px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#4b5563',
                cursor: 'pointer',
                borderRadius: '6px',
                minWidth: '32px',
                minHeight: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 150ms ease-in-out',
              }}
              title="Clear search"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}

          {/* Filters Toggle */}
          {showFilters && (
            <button
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              style={{
                padding: '8px',
                border: `1px solid ${showFiltersPanel ? '#7c3aed' : '#d1d5db'}`,
                backgroundColor: showFiltersPanel ? '#f3e8ff' : 'white',
                color: showFiltersPanel ? '#7c3aed' : '#4b5563',
                cursor: 'pointer',
                borderRadius: '6px',
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 200ms ease-in-out',
                boxShadow: showFiltersPanel ? '0 2px 4px rgba(124, 58, 237, 0.1)' : 'none',
              }}
              title="Search filters"
              aria-label="Toggle search filters"
              aria-expanded={showFiltersPanel}
              aria-controls="search-filters-panel"
            >
              <span className="search-icon" aria-hidden="true">🔍</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Loading Indicator */}
      {state.isSearching && (
        <div className="search-loading" style={{ marginTop: '8px' }}>
          <div className="search-loading-spinner"></div>
          <span>Searching...</span>
        </div>
      )}

      {/* Live Region for Search Results Status */}
      <div id="search-results-info" className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {state.results.length > 0 && (
          <>
            {state.totalResults} result{state.totalResults !== 1 ? 's' : ''} found for "{query}"
            {state.searchMetrics && ` in ${state.searchMetrics.queryTime.toFixed(0)} milliseconds`}
            {state.searchMetrics?.aiUsed && ". AI enhanced search was used"}
            {state.searchMetrics?.cacheHit && ". Results were retrieved from cache"}
          </>
        )}
      </div>

      {/* Visual Search Results Info */}
      {state.results.length > 0 && !state.isSearching && (
        <div
          style={{
            fontSize: '0.875rem',
            color: '#4b5563',
            marginTop: '8px',
            padding: '6px 12px',
            backgroundColor: '#f8fafc',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          aria-hidden="true"
        >
          <span style={{ fontWeight: '500' }}>
            {state.totalResults} results found
          </span>
          {state.searchMetrics && (
            <span style={{ opacity: 0.8 }}>
              in {state.searchMetrics.queryTime.toFixed(0)}ms
            </span>
          )}
          {state.searchMetrics?.aiUsed && (
            <span style={{
              backgroundColor: '#e0e7ff',
              color: '#5b21b6',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '500'
            }}>AI enhanced</span>
          )}
          {state.searchMetrics?.cacheHit && (
            <span style={{
              backgroundColor: '#dcfce7',
              color: '#15803d',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '500'
            }}>Cached</span>
          )}
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
        >
          ⚠️ {state.searchError}
        </div>
      )}

      {/* Suggestions Dropdown */}
      <SearchSuggestions
        suggestions={suggestions}
        query={query}
        onSelect={handleSuggestionSelect}
        onClose={() => setShowSuggestions(false)}
        isVisible={showSuggestions}
      />

      {/* History Dropdown */}
      <SearchHistory
        history={searchHistory}
        onSelect={handleHistorySelect}
        onClear={clearHistory}
        isVisible={showHistoryDropdown}
      />

      {/* Filters Panel */}
      <div id="search-filters-panel">
        <SearchFilters
          isVisible={showFiltersPanel}
          onToggleAI={handleToggleAI}
          onCategorySelect={handleCategorySelect}
          useAI={state.useAI}
          selectedCategory={filters.category}
        />
      </div>
    </div>
  );
};

export default KBSearchBar;