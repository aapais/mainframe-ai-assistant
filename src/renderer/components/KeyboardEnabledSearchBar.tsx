/**
 * Keyboard-Enhanced Search Bar Component
 * Extends the simple search bar with full keyboard navigation support
 */

import React, { useState, useRef, useEffect } from 'react';
import { useKeyboard, useKeyboardShortcuts } from '../contexts/KeyboardContext';

interface SearchSuggestion {
  text: string;
  type: 'recent' | 'category' | 'tag';
}

interface KeyboardEnabledSearchBarProps {
  onSearch: (query: string, results: any[]) => void;
  onClear?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
  suggestions?: SearchSuggestion[];
  disabled?: boolean;
}

export function KeyboardEnabledSearchBar({
  onSearch,
  onClear,
  autoFocus = false,
  placeholder = 'Search knowledge base... (Press / to focus)',
  suggestions = [],
  disabled = false
}: KeyboardEnabledSearchBarProps) {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [filteredSuggestions, setFilteredSuggestions] = useState<SearchSuggestion[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const { state: keyboardState } = useKeyboard();

  // Register global search shortcut
  useKeyboardShortcuts([
    {
      key: '/',
      description: 'Focus search input',
      action: () => {
        if (searchInputRef.current && !disabled) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }
    },
    {
      key: 'k',
      ctrlKey: true,
      description: 'Focus search input',
      action: () => {
        if (searchInputRef.current && !disabled) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }
    }
  ], 'search');

  // Auto focus on mount
  useEffect(() => {
    if (autoFocus && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  // Filter suggestions based on query
  useEffect(() => {
    if (query.trim() && suggestions.length > 0) {
      const filtered = suggestions.filter(suggestion =>
        suggestion.text.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5);
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setSelectedSuggestionIndex(-1);
    } else {
      setShowSuggestions(false);
      setFilteredSuggestions([]);
      setSelectedSuggestionIndex(-1);
    }
  }, [query, suggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Trigger search as user types (debounced)
    if (value.trim()) {
      // This would normally be debounced
      performSearch(value);
    }
  };

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    try {
      // In a real implementation, this would call the search API
      const response = await window.electronAPI?.kb?.search(searchQuery);
      if (response && response.results) {
        onSearch(searchQuery, response.results);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && filteredSuggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedSuggestionIndex(prev =>
            prev < filteredSuggestions.length - 1 ? prev + 1 : 0
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedSuggestionIndex(prev =>
            prev > 0 ? prev - 1 : filteredSuggestions.length - 1
          );
          break;

        case 'Enter':
          e.preventDefault();
          if (selectedSuggestionIndex >= 0) {
            const selectedSuggestion = filteredSuggestions[selectedSuggestionIndex];
            setQuery(selectedSuggestion.text);
            performSearch(selectedSuggestion.text);
            setShowSuggestions(false);
          } else {
            performSearch(query);
            setShowSuggestions(false);
          }
          break;

        case 'Escape':
          e.preventDefault();
          setShowSuggestions(false);
          setSelectedSuggestionIndex(-1);
          if (query) {
            setQuery('');
            onClear?.();
          } else {
            searchInputRef.current?.blur();
          }
          break;

        case 'Tab':
          if (selectedSuggestionIndex >= 0) {
            e.preventDefault();
            setQuery(filteredSuggestions[selectedSuggestionIndex].text);
            setShowSuggestions(false);
          }
          break;
      }
    } else {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          performSearch(query);
          break;

        case 'Escape':
          e.preventDefault();
          if (query) {
            setQuery('');
            onClear?.();
          } else {
            searchInputRef.current?.blur();
          }
          break;
      }
    }
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    performSearch(suggestion.text);
    setShowSuggestions(false);
    searchInputRef.current?.focus();
  };

  const handleClear = () => {
    setQuery('');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    onClear?.();
    searchInputRef.current?.focus();
  };

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
  };

  const inputContainerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 3rem 0.75rem 1rem',
    fontSize: '1rem',
    border: `2px solid ${keyboardState.focusVisible ? '#3b82f6' : '#e5e7eb'}`,
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    color: '#111827',
    outline: 'none',
    transition: 'all 0.2s ease',
  };

  const clearButtonStyle: React.CSSProperties = {
    position: 'absolute',
    right: '0.5rem',
    top: '50%',
    transform: 'translateY(-50%)',
    padding: '0.25rem',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#6b7280',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '1.25rem',
    display: query ? 'flex' : 'none',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const suggestionsStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    zIndex: 10,
    maxHeight: '200px',
    overflowY: 'auto',
    marginTop: '2px',
  };

  const suggestionStyle: React.CSSProperties = {
    padding: '0.75rem 1rem',
    cursor: 'pointer',
    borderBottom: '1px solid #f3f4f6',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    transition: 'background-color 0.2s ease',
  };

  const suggestionTypeStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    padding: '0.125rem 0.375rem',
    borderRadius: '4px',
    fontWeight: '500',
  };

  return (
    <div style={containerStyle}>
      <div style={inputContainerStyle}>
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(filteredSuggestions.length > 0)}
          onBlur={() => {
            // Delay hiding suggestions to allow clicks
            setTimeout(() => setShowSuggestions(false), 150);
          }}
          placeholder={placeholder}
          disabled={disabled}
          style={inputStyle}
          data-search-input="true"
          aria-label="Search knowledge base"
          aria-expanded={showSuggestions}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            selectedSuggestionIndex >= 0
              ? `suggestion-${selectedSuggestionIndex}`
              : undefined
          }
          role="combobox"
        />

        {query && (
          <button
            style={clearButtonStyle}
            onClick={handleClear}
            aria-label="Clear search"
            title="Clear search (Escape)"
            type="button"
            tabIndex={-1}
          >
            ✕
          </button>
        )}
      </div>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          style={suggestionsStyle}
          role="listbox"
          aria-label="Search suggestions"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.type}-${suggestion.text}`}
              id={`suggestion-${index}`}
              style={{
                ...suggestionStyle,
                backgroundColor: selectedSuggestionIndex === index ? '#dbeafe' : 'transparent',
              }}
              onClick={() => handleSuggestionClick(suggestion)}
              role="option"
              aria-selected={selectedSuggestionIndex === index}
              onMouseEnter={() => setSelectedSuggestionIndex(index)}
            >
              <span style={suggestionTypeStyle}>
                {suggestion.type}
              </span>
              <span>{suggestion.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Screen reader instructions */}
      <div id="search-instructions" className="visually-hidden">
        Use arrow keys to navigate suggestions, Enter to select, Escape to close.
        Press / or Ctrl+K to focus search from anywhere.
      </div>
    </div>
  );
}

export default KeyboardEnabledSearchBar;