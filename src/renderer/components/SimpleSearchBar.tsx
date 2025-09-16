/**
 * Simplified Search Bar Component
 * No external dependencies, pure React with inline styles
 */

import React, { useState, useEffect, useRef, memo } from 'react';

interface SearchResult {
  id: string;
  title: string;
  category: string;
  score: number;
}

interface Props {
  onSearch: (query: string, results: SearchResult[]) => void;
  onClear: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export const SimpleSearchBar = memo<Props>(({
  onSearch,
  onClear,
  placeholder = "Search knowledge base...",
  autoFocus = false
}) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('kb-recent-searches');
      if (stored) {
        setRecentSearches(JSON.parse(stored).slice(0, 5));
      }
    } catch (error) {
      console.warn('Failed to load recent searches:', error);
    }
  }, []);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [autoFocus]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(query.trim());
      }, 300);
    } else if (query.trim().length === 0) {
      onClear();
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setIsSearching(true);
    try {
      const response = await window.electronAPI.kb.search(searchQuery);

      if (response.success !== false) {
        // Save to recent searches
        const newRecentSearches = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5);
        setRecentSearches(newRecentSearches);
        localStorage.setItem('kb-recent-searches', JSON.stringify(newRecentSearches));

        onSearch(searchQuery, response.results || response);
      } else {
        console.error('Search failed:', response.error);
        onSearch(searchQuery, []);
      }
    } catch (error) {
      console.error('Search error:', error);
      onSearch(searchQuery, []);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (query.trim()) {
        performSearch(query.trim());
      }
    } else if (e.key === 'Escape') {
      setQuery('');
      onClear();
    }
  };

  const handleClear = () => {
    setQuery('');
    onClear();
    searchInputRef.current?.focus();
  };

  const handleRecentSearchClick = (recentQuery: string) => {
    setQuery(recentQuery);
    performSearch(recentQuery);
  };

  const searchContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: '600px',
    margin: '0 auto',
  };

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    paddingRight: query ? '80px' : '50px',
    fontSize: '16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    outline: 'none',
    backgroundColor: '#ffffff',
    transition: 'border-color 0.2s ease',
    boxSizing: 'border-box',
  };

  const focusedInputStyle: React.CSSProperties = {
    ...searchInputStyle,
    borderColor: '#3b82f6',
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
  };

  const buttonStyle: React.CSSProperties = {
    position: 'absolute',
    right: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    padding: '8px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6b7280',
    fontSize: '16px',
  };

  const spinnerStyle: React.CSSProperties = {
    width: '16px',
    height: '16px',
    border: '2px solid #f3f4f6',
    borderTop: '2px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  };

  const recentSearchesStyle: React.CSSProperties = {
    marginTop: '8px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  };

  const recentSearchChipStyle: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: '12px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  return (
    <div style={searchContainerStyle}>
      <style>
        {`
          @keyframes spin {
            0% { transform: translateY(-50%) rotate(0deg); }
            100% { transform: translateY(-50%) rotate(360deg); }
          }
        `}
      </style>

      <div style={{ position: 'relative' }}>
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={searchInputRef.current === document.activeElement ? focusedInputStyle : searchInputStyle}
          autoComplete="off"
        />

        {isSearching ? (
          <div style={buttonStyle}>
            <div style={spinnerStyle} />
          </div>
        ) : query ? (
          <button
            onClick={handleClear}
            style={buttonStyle}
            title="Clear search"
            type="button"
          >
            ✕
          </button>
        ) : (
          <div style={buttonStyle}>
            🔍
          </div>
        )}
      </div>

      {recentSearches.length > 0 && !query && (
        <div style={recentSearchesStyle}>
          <span style={{ fontSize: '12px', color: '#6b7280', alignSelf: 'center' }}>Recent:</span>
          {recentSearches.map((recentQuery, index) => (
            <button
              key={index}
              onClick={() => handleRecentSearchClick(recentQuery)}
              style={{
                ...recentSearchChipStyle,
                ':hover': { backgroundColor: '#e5e7eb' }
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
            >
              {recentQuery}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

SimpleSearchBar.displayName = 'SimpleSearchBar';