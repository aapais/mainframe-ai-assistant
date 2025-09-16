/**
 * Smart Search Interface Component
 * Context-aware search with suggestions, filters, and quick actions
 */

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';

interface SearchSuggestion {
  type: 'recent' | 'common' | 'category' | 'error';
  text: string;
  category?: string;
  frequency?: number;
}

interface SearchFilters {
  category?: string;
  successRate?: 'high' | 'medium' | 'any';
  dateRange?: 'week' | 'month' | 'quarter' | 'year' | 'all';
  sortBy?: 'relevance' | 'recent' | 'usage' | 'success';
}

interface SmartSearchInterfaceProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  onClear: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  showFilters?: boolean;
  showSuggestions?: boolean;
  recentSearches?: string[];
  popularCategories?: string[];
}

export const SmartSearchInterface = memo<SmartSearchInterfaceProps>(({
  onSearch,
  onClear,
  placeholder = "Describe your problem or search by error code...",
  autoFocus = false,
  showFilters = true,
  showSuggestions = true,
  recentSearches = [],
  popularCategories = ['VSAM', 'COBOL', 'JCL', 'DB2', 'CICS']
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestionPanel, setShowSuggestionPanel] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    sortBy: 'relevance',
    dateRange: 'all',
    successRate: 'any'
  });
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Common error patterns and suggestions
  const commonErrorPatterns = [
    'VSAM Status 35 - File not found',
    'S0C7 data exception',
    'SQLCODE -904 resource unavailable',
    'IEF212I dataset not found',
    'CICS ASRA abend',
    'JCL FLUSH error',
    'COBOL compilation error',
    'File status 90 - Record locked'
  ];

  // Generate smart suggestions based on query
  const generateSuggestions = useCallback((searchQuery: string): SearchSuggestion[] => {
    if (!searchQuery || searchQuery.length < 2) {
      return [
        ...recentSearches.slice(0, 3).map(search => ({
          type: 'recent' as const,
          text: search
        })),
        ...commonErrorPatterns.slice(0, 4).map(pattern => ({
          type: 'common' as const,
          text: pattern
        }))
      ];
    }

    const lowerQuery = searchQuery.toLowerCase();
    const suggestions: SearchSuggestion[] = [];

    // Recent searches that match
    recentSearches
      .filter(search => search.toLowerCase().includes(lowerQuery))
      .slice(0, 3)
      .forEach(search => {
        suggestions.push({ type: 'recent', text: search });
      });

    // Common error patterns that match
    commonErrorPatterns
      .filter(pattern => pattern.toLowerCase().includes(lowerQuery))
      .slice(0, 3)
      .forEach(pattern => {
        suggestions.push({ type: 'common', text: pattern });
      });

    // Category-specific suggestions
    popularCategories
      .filter(category =>
        category.toLowerCase().includes(lowerQuery) ||
        lowerQuery.includes(category.toLowerCase())
      )
      .slice(0, 2)
      .forEach(category => {
        suggestions.push({
          type: 'category',
          text: `${searchQuery} in ${category}`,
          category
        });
      });

    // Error code suggestions
    if (/\b[A-Z]\d+[A-Z]?\b/.test(searchQuery.toUpperCase())) {
      suggestions.push({
        type: 'error',
        text: `${searchQuery.toUpperCase()} error code`
      });
    }

    return suggestions.slice(0, 8);
  }, [recentSearches, popularCategories]);

  // Debounced search execution
  const performSearch = useCallback((searchQuery: string, searchFilters: SearchFilters) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setIsSearching(true);
      onSearch(searchQuery, searchFilters);
      setIsSearching(false);
      setShowSuggestionPanel(false);
    }, 300);
  }, [onSearch]);

  // Handle input changes
  useEffect(() => {
    if (query.trim().length >= 2) {
      const newSuggestions = generateSuggestions(query);
      setSuggestions(newSuggestions);
      setShowSuggestionPanel(true);
      performSearch(query.trim(), filters);
    } else if (query.trim().length === 0) {
      onClear();
      setShowSuggestionPanel(false);
      setSelectedSuggestionIndex(-1);
    } else {
      const newSuggestions = generateSuggestions('');
      setSuggestions(newSuggestions);
      setShowSuggestionPanel(true);
    }
  }, [query, filters, generateSuggestions, performSearch, onClear]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [autoFocus]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
        selectSuggestion(suggestions[selectedSuggestionIndex]);
      } else if (query.trim()) {
        performSearch(query.trim(), filters);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestionPanel(false);
      setSelectedSuggestionIndex(-1);
      if (!query) {
        searchInputRef.current?.blur();
      }
    } else if (e.key === 'Tab' && showSuggestionPanel) {
      setShowSuggestionPanel(false);
    }
  };

  const selectSuggestion = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    setShowSuggestionPanel(false);
    setSelectedSuggestionIndex(-1);
    performSearch(suggestion.text, filters);
  };

  const handleClear = () => {
    setQuery('');
    onClear();
    setShowSuggestionPanel(false);
    setSelectedSuggestionIndex(-1);
    searchInputRef.current?.focus();
  };

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    if (query.trim()) {
      performSearch(query.trim(), newFilters);
    }
  };

  // Styles
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: '800px',
    margin: '0 auto'
  };

  const searchBarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    padding: '4px',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  };

  const focusedSearchBarStyle: React.CSSProperties = {
    ...searchBarStyle,
    borderColor: '#3b82f6',
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1)'
  };

  const searchInputStyle: React.CSSProperties = {
    flex: 1,
    padding: '12px 16px',
    fontSize: '16px',
    border: 'none',
    outline: 'none',
    borderRadius: '8px',
    backgroundColor: 'transparent'
  };

  const actionButtonStyle: React.CSSProperties = {
    padding: '8px 12px',
    margin: '0 4px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };

  const filterButtonStyle: React.CSSProperties = {
    ...actionButtonStyle,
    backgroundColor: showFiltersPanel ? '#e0e7ff' : '#f3f4f6',
    color: showFiltersPanel ? '#3730a3' : '#374151',
    border: `1px solid ${showFiltersPanel ? '#c7d2fe' : '#d1d5db'}`
  };

  const clearButtonStyle: React.CSSProperties = {
    ...actionButtonStyle,
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca'
  };

  const suggestionsStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    marginTop: '4px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
    maxHeight: '400px',
    overflowY: 'auto'
  };

  const suggestionItemStyle: React.CSSProperties = {
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #f3f4f6',
    transition: 'background-color 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  };

  const selectedSuggestionStyle: React.CSSProperties = {
    ...suggestionItemStyle,
    backgroundColor: '#eff6ff'
  };

  const filtersStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    right: 0,
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '4px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
    minWidth: '300px'
  };

  const getSuggestionIcon = (type: string): string => {
    switch (type) {
      case 'recent': return '🕒';
      case 'common': return '⭐';
      case 'category': return '📁';
      case 'error': return '❌';
      default: return '🔍';
    }
  };

  const getSuggestionLabel = (type: string): string => {
    switch (type) {
      case 'recent': return 'Recent';
      case 'common': return 'Common';
      case 'category': return 'Category';
      case 'error': return 'Error Code';
      default: return 'Search';
    }
  };

  return (
    <div style={containerStyle}>
      {/* Main Search Bar */}
      <div style={showSuggestionPanel ? focusedSearchBarStyle : searchBarStyle}>
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestionPanel(suggestions.length > 0)}
          placeholder={placeholder}
          style={searchInputStyle}
          data-search-input
          autoComplete="off"
        />

        {isSearching && (
          <div style={{ padding: '8px 12px' }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid #f3f4f6',
              borderTop: '2px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
          </div>
        )}

        {showFilters && (
          <button
            style={filterButtonStyle}
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            onMouseEnter={(e) => {
              if (!showFiltersPanel) {
                e.currentTarget.style.backgroundColor = '#e5e7eb';
              }
            }}
            onMouseLeave={(e) => {
              if (!showFiltersPanel) {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }
            }}
          >
            🔧 Filters
          </button>
        )}

        {query && (
          <button
            style={clearButtonStyle}
            onClick={handleClear}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#fee2e2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#fef2f2';
            }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Search Suggestions */}
      {showSuggestions && showSuggestionPanel && suggestions.length > 0 && (
        <div ref={suggestionsRef} style={suggestionsStyle}>
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.type}-${index}`}
              style={index === selectedSuggestionIndex ? selectedSuggestionStyle : suggestionItemStyle}
              onClick={() => selectSuggestion(suggestion)}
              onMouseEnter={() => setSelectedSuggestionIndex(index)}
            >
              <span style={{ fontSize: '16px' }}>{getSuggestionIcon(suggestion.type)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '500', color: '#111827' }}>
                  {suggestion.text}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  {getSuggestionLabel(suggestion.type)}
                  {suggestion.category && ` • ${suggestion.category}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters Panel */}
      {showFiltersPanel && (
        <div style={filtersStyle}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: '600' }}>
            Search Filters
          </h4>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '6px' }}>
              Category
            </label>
            <select
              value={filters.category || ''}
              onChange={(e) => updateFilter('category', e.target.value || undefined)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem'
              }}
            >
              <option value="">All Categories</option>
              {popularCategories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '6px' }}>
              Success Rate
            </label>
            <select
              value={filters.successRate || 'any'}
              onChange={(e) => updateFilter('successRate', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem'
              }}
            >
              <option value="any">Any Success Rate</option>
              <option value="high">High (80%+)</option>
              <option value="medium">Medium (50%+)</option>
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '6px' }}>
              Sort By
            </label>
            <select
              value={filters.sortBy || 'relevance'}
              onChange={(e) => updateFilter('sortBy', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem'
              }}
            >
              <option value="relevance">Relevance</option>
              <option value="recent">Most Recent</option>
              <option value="usage">Most Used</option>
              <option value="success">Highest Success Rate</option>
            </select>
          </div>

          <button
            onClick={() => setShowFiltersPanel(false)}
            style={{
              width: '100%',
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            Apply Filters
          </button>
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
});

SmartSearchInterface.displayName = 'SmartSearchInterface';