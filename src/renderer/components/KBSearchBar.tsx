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
import { SearchInput } from './common/SearchInput';

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
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        maxHeight: '300px',
        overflowY: 'auto',
        zIndex: 1000,
      }}
      role="listbox"
      aria-label="Search suggestions"
    >
      {suggestions.map((suggestion, index) => (
        <button
          key={suggestion}
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
        <span>Recent searches</span>
        <button
          onClick={onClear}
          style={{
            border: 'none',
            background: 'none',
            color: '#dc2626',
            cursor: 'pointer',
            fontSize: '0.75rem',
          }}
        >
          Clear
        </button>
      </div>
      {history.slice(0, 10).map((query, index) => (
        <button
          key={`${query}-${index}`}
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
        >
          <span style={{ marginRight: '0.5rem', fontSize: '0.75rem' }}>🕐</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {query}
          </span>
        </button>
      ))}
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
        flexWrap: 'wrap',
        gap: '0.5rem',
        marginTop: '0.5rem',
        padding: '0.5rem',
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
      }}
    >
      {/* AI Toggle */}
      <label 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.25rem 0.5rem',
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
        />
        🤖 AI Search
      </label>

      {/* Category Filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
        <button
          onClick={() => onCategorySelect(undefined)}
          style={{
            padding: '0.25rem 0.5rem',
            border: `1px solid ${!selectedCategory ? '#3b82f6' : '#d1d5db'}`,
            backgroundColor: !selectedCategory ? '#dbeafe' : 'white',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.75rem',
          }}
        >
          All Categories
        </button>
        {categories.map(category => (
          <button
            key={category}
            onClick={() => onCategorySelect(category)}
            style={{
              padding: '0.25rem 0.5rem',
              border: `1px solid ${selectedCategory === category ? '#3b82f6' : '#d1d5db'}`,
              backgroundColor: selectedCategory === category ? '#dbeafe' : 'white',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            {category}
          </button>
        ))}
      </div>
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
                padding: '0.5rem',
                border: `1px solid ${showFiltersPanel ? '#3b82f6' : '#d1d5db'}`,
                backgroundColor: showFiltersPanel ? '#dbeafe' : 'white',
                color: showFiltersPanel ? '#1d4ed8' : '#6b7280',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
              title="Search filters"
              aria-label="Toggle search filters"
              aria-expanded={showFiltersPanel}
            >
              🔍
            </button>
          )}
        </div>
      </div>

      {/* Search Results Info */}
      {state.results.length > 0 && (
        <div 
          style={{
            fontSize: '0.75rem',
            color: '#6b7280',
            marginTop: '0.25rem',
          }}
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
      <SearchFilters
        isVisible={showFiltersPanel}
        onToggleAI={handleToggleAI}
        onCategorySelect={handleCategorySelect}
        useAI={state.useAI}
        selectedCategory={filters.category}
      />
    </div>
  );
};

export default KBSearchBar;