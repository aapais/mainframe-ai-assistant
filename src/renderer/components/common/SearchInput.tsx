import React, { useState, useCallback, useRef, useEffect } from 'react';
import { debounce } from 'lodash';
import { AriaUtils, announceToScreenReader, announceSearchResults, keyboardNavigation } from '../../utils/accessibility';
import { useAccessibleShortcuts } from '../../hooks/useUXEnhancements';
import { InlineLoadingSpinner } from './LoadingIndicator';
import './SearchInput.css';

interface SearchInputProps {
  /** Search callback function */
  onSearch: (query: string, useAI: boolean) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Auto focus input on mount */
  autoFocus?: boolean;
  /** Show AI toggle switch */
  showAIToggle?: boolean;
  /** Maximum input length */
  maxLength?: number;
  /** Debounce delay for search */
  searchDelay?: number;
  /** Loading state */
  loading?: boolean;
  /** Controlled value */
  value?: string;
  /** Value change handler */
  onChange?: (value: string) => void;
  /** Search results count for announcements */
  resultsCount?: number;
  /** Error state */
  error?: string | null;
  /** Disabled state */
  disabled?: boolean;
  /** ID for the input */
  id?: string;
  /** Additional className */
  className?: string;
}

/**
 * Accessible Search Input Component with AI Toggle
 * 
 * Features:
 * - WCAG 2.1 AA compliant
 * - Screen reader announcements
 * - Keyboard navigation for suggestions
 * - Auto-save support
 * - Error state handling
 * - Loading indicators
 * 
 * MVP1 Requirements:
 * - Fast local search (<1s)
 * - Optional Gemini AI semantic search
 * - Fallback to local if AI fails
 * - Search history suggestions
 */
export const SearchInput: React.FC<SearchInputProps> = ({
  onSearch,
  placeholder = 'Search knowledge base... (e.g., "VSAM Status 35")',
  autoFocus = false,
  showAIToggle = true,
  maxLength = 200,
  searchDelay = 300,
  loading = false,
  value,
  onChange,
  resultsCount,
  error,
  disabled = false,
  id,
  className = ''
}) => {
  const [internalQuery, setInternalQuery] = useState('');
  const [useAI, setUseAI] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [hasAnnounced, setHasAnnounced] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const searchContainerId = useRef(id || AriaUtils.generateId('search'));
  const errorId = useRef(AriaUtils.generateId('search-error'));
  const statusId = useRef(AriaUtils.generateId('search-status'));
  const suggestionsId = useRef(AriaUtils.generateId('suggestions'));

  // Use controlled or internal state
  const currentQuery = value !== undefined ? value : internalQuery;
  const setCurrentQuery = (newQuery: string) => {
    if (value !== undefined) {
      onChange?.(newQuery);
    } else {
      setInternalQuery(newQuery);
    }
  };

  // Keyboard shortcuts
  useAccessibleShortcuts([
    {
      key: 'F3',
      handler: () => inputRef.current?.focus(),
      description: 'Focus search input'
    },
    {
      key: '/',
      handler: () => inputRef.current?.focus(),
      description: 'Quick search'
    }
  ]);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((searchQuery: string, aiEnabled: boolean) => {
      if (searchQuery.trim()) {
        onSearch(searchQuery, aiEnabled);
        setHasAnnounced(false);
      }
    }, searchDelay),
    [onSearch, searchDelay]
  );

  // Announce search results
  useEffect(() => {
    if (resultsCount !== undefined && !hasAnnounced && !loading) {
      announceSearchResults(resultsCount, currentQuery);
      setHasAnnounced(true);
    }
  }, [resultsCount, hasAnnounced, loading, currentQuery]);

  // Load search history on mount
  useEffect(() => {
    loadSearchHistory();
  }, []);

  // Setup roving tabindex for suggestions
  useEffect(() => {
    if (showSuggestions && suggestions.length > 0 && suggestionsRef.current) {
      const suggestionElements = Array.from(
        suggestionsRef.current.querySelectorAll('.suggestion-item')
      ) as HTMLElement[];
      
      if (suggestionElements.length > 0) {
        keyboardNavigation.enableRovingTabindex('search-suggestions', suggestionElements);
      }

      return () => {
        keyboardNavigation.disableRovingTabindex('search-suggestions');
      };
    }
  }, [showSuggestions, suggestions]);

  // Handle error state
  useEffect(() => {
    if (error && inputRef.current) {
      AriaUtils.setFieldError(inputRef.current, errorId.current, error);
      announceToScreenReader(`Search error: ${error}`, 'assertive');
    } else if (inputRef.current) {
      AriaUtils.clearFieldError(inputRef.current);
    }
  }, [error]);

  const loadSearchHistory = async () => {
    try {
      const history = await window.electronAPI?.getSearchHistory?.();
      if (history) {
        setSuggestions(history.slice(0, 8)); // Show more suggestions for better UX
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setCurrentQuery(newQuery);
    setSelectedSuggestionIndex(-1);
    
    if (newQuery.trim().length >= 2) {
      debouncedSearch(newQuery, useAI);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // If a suggestion is selected, use it
    if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < suggestions.length) {
      const selectedSuggestion = suggestions[selectedSuggestionIndex];
      setCurrentQuery(selectedSuggestion);
      onSearch(selectedSuggestion, useAI);
    } else if (currentQuery.trim() && !loading && !disabled) {
      onSearch(currentQuery, useAI);
      // Save to search history
      window.electronAPI?.saveSearchQuery?.(currentQuery);
    }
    
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  const handleSuggestionClick = (suggestion: string, index: number) => {
    setCurrentQuery(suggestion);
    setSelectedSuggestionIndex(index);
    onSearch(suggestion, useAI);
    setShowSuggestions(false);
    
    // Return focus to input
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
        
      case 'ArrowDown':
        if (showSuggestions && suggestions.length > 0) {
          e.preventDefault();
          const newIndex = selectedSuggestionIndex < suggestions.length - 1 
            ? selectedSuggestionIndex + 1 
            : 0;
          setSelectedSuggestionIndex(newIndex);
          
          // Announce current selection
          announceToScreenReader(
            `${newIndex + 1} of ${suggestions.length}: ${suggestions[newIndex]}`,
            'polite'
          );
        }
        break;
        
      case 'ArrowUp':
        if (showSuggestions && suggestions.length > 0) {
          e.preventDefault();
          const newIndex = selectedSuggestionIndex > 0 
            ? selectedSuggestionIndex - 1 
            : suggestions.length - 1;
          setSelectedSuggestionIndex(newIndex);
          
          // Announce current selection
          announceToScreenReader(
            `${newIndex + 1} of ${suggestions.length}: ${suggestions[newIndex]}`,
            'polite'
          );
        }
        break;
    }
  };

  const handleFocus = () => {
    if (suggestions.length > 0 && currentQuery.trim()) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Delay hiding suggestions to allow clicking
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }
    }, 150);
  };

  const handleAIToggle = (checked: boolean) => {
    setUseAI(checked);
    announceToScreenReader(
      `Search mode changed to ${checked ? 'AI-enhanced' : 'local'} search`,
      'polite'
    );
    
    // Re-search if there's a query
    if (currentQuery.trim()) {
      onSearch(currentQuery, checked);
    }
  };

  const containerClasses = [
    'search-input-container',
    loading ? 'search-input-container--loading' : '',
    error ? 'search-input-container--error' : '',
    showSuggestions ? 'search-input-container--suggestions-open' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses} id={searchContainerId.current}>
      {/* Search Form */}
      <form 
        onSubmit={handleSubmit} 
        className="search-form"
        role="search"
        aria-label="Search knowledge base"
      >
        <div className="search-input-wrapper">
          <span className="search-icon" aria-hidden="true">🔍</span>
          
          <input
            ref={inputRef}
            type="search"
            value={currentQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            maxLength={maxLength}
            autoFocus={autoFocus}
            disabled={loading || disabled}
            className={`search-input ${error ? 'search-input--error' : ''}`}
            id={searchContainerId.current + '-input'}
            aria-label="Search knowledge base"
            aria-describedby={`${statusId.current} ${error ? errorId.current : ''} ${showSuggestions ? suggestionsId.current : ''}`}
            aria-expanded={showSuggestions}
            aria-autocomplete="list"
            aria-activedescendant={selectedSuggestionIndex >= 0 ? `suggestion-${selectedSuggestionIndex}` : undefined}
            autoComplete="off"
            spellCheck="false"
            data-testid="search-input"
          />

          {/* Loading Spinner */}
          {loading && (
            <div className="search-loading" aria-hidden="true">
              <InlineLoadingSpinner size="small" />
            </div>
          )}

          {/* Clear Button */}
          {currentQuery && !loading && (
            <button
              type="button"
              className="search-clear"
              onClick={() => {
                setCurrentQuery('');
                setShowSuggestions(false);
                inputRef.current?.focus();
                announceToScreenReader('Search cleared', 'polite');
              }}
              aria-label="Clear search"
              data-testid="search-clear"
            >
              <span aria-hidden="true">×</span>
            </button>
          )}

          {/* AI Toggle */}
          {showAIToggle && (
            <div className="ai-toggle">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={useAI}
                  onChange={(e) => handleAIToggle(e.target.checked)}
                  disabled={loading || disabled}
                  aria-describedby={statusId.current}
                />
                <span className="toggle-slider" aria-hidden="true" />
                <span className="toggle-text">
                  <span className="toggle-icon" aria-hidden="true">
                    {useAI ? '🤖' : '📝'}
                  </span>
                  {useAI ? 'AI' : 'Local'}
                </span>
              </label>
            </div>
          )}

          {/* Search Button */}
          <button
            type="submit"
            disabled={!currentQuery.trim() || loading || disabled}
            className="search-button"
            aria-label={currentQuery.trim() ? `Search for "${currentQuery}"` : 'Search'}
            data-testid="search-button"
          >
            <span className="search-button-text">Search</span>
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div 
          id={errorId.current}
          className="search-error"
          role="alert"
          aria-live="assertive"
        >
          <span className="error-icon" aria-hidden="true">⚠️</span>
          {error}
        </div>
      )}

      {/* Search Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="search-suggestions"
          role="listbox"
          id={suggestionsId.current}
          aria-label="Search suggestions"
        >
          <div className="suggestions-header" id="suggestions-label">
            Recent searches:
          </div>
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              id={`suggestion-${index}`}
              className={`suggestion-item ${
                selectedSuggestionIndex === index ? 'suggestion-item--selected' : ''
              }`}
              onClick={() => handleSuggestionClick(suggestion, index)}
              role="option"
              aria-selected={selectedSuggestionIndex === index}
              aria-labelledby="suggestions-label"
              data-testid={`suggestion-${index}`}
            >
              <span className="suggestion-icon" aria-hidden="true">🕐</span>
              <span className="suggestion-text">{suggestion}</span>
            </button>
          ))}
        </div>
      )}

      {/* Status and Hints */}
      <div className="search-status-container">
        <div 
          id={statusId.current}
          className="search-status"
          aria-live="polite"
          aria-atomic="true"
        >
          {loading ? (
            'Searching...'
          ) : resultsCount !== undefined ? (
            `${resultsCount} result${resultsCount !== 1 ? 's' : ''} found`
          ) : (
            showAIToggle ? (
              useAI ? 'AI-enhanced search enabled' : 'Local search only'
            ) : null
          )}
        </div>

        <div className="search-hints" aria-label="Search suggestions">
          <span className="hint">
            <span className="hint-icon" aria-hidden="true">💡</span>
            Try: "S0C7", "VSAM error", "JCL not found"
          </span>
          
          {/* Keyboard shortcuts hint */}
          <span className="hint hint--shortcuts">
            <span className="hint-icon" aria-hidden="true">⌨️</span>
            Press F3 or / to focus search
          </span>
        </div>
      </div>

      {/* Screen reader instructions */}
      <div className="sr-only" id="search-instructions">
        Search the knowledge base. Use arrow keys to navigate suggestions. Press Escape to close suggestions.
      </div>
    </div>
  );
};