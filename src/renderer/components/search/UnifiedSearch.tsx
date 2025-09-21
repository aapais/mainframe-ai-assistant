/**
 * Unified Search Component - Refactored with Clean Architecture
 *
 * Features:
 * - Centralized state management with custom hooks
 * - Isolated dropdown components
 * - Event coordination through context
 * - Optimized re-renders with memoization
 * - Proper accessibility support
 */

import React, { memo, useRef, useCallback, useEffect } from 'react';
// import { Search, Sparkles, Filter, TrendingUp } from 'lucide-react'; // Disabled - not installed
const Search = () => <span>🔍</span>;
const Sparkles = () => <span>✨</span>;
const Filter = () => <span>🔽</span>;
const TrendingUp = () => <span>📈</span>;
import { SearchProvider, useSearchContext } from './SearchContext';
import SuggestionsDropdown from './SuggestionsDropdown';
import FiltersDropdown from './FiltersDropdown';
import { useNotificationSystem } from '../common/SimpleNotificationProvider';

interface UnifiedSearchProps {
  onSearch: (query: string, useAI: boolean) => void;
  loading?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Internal Search Component with Context Access
 */
const SearchComponent = memo<UnifiedSearchProps>(({
  onSearch,
  loading = false,
  placeholder = "Describe your issue or search for solutions...",
  autoFocus = false,
  className = ''
}) => {
  const { state, actions } = useSearchContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const { info } = useNotificationSystem();

  // Handle input changes with optimized state updates
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    actions.setQuery(value);

    if (!value.trim()) {
      onSearch('', false); // Reset search when cleared
    }

    // Show suggestions when typing
    if (value.length > 0) {
      actions.setShowSuggestions(true);
    }
  }, [actions, onSearch]);

  // Handle search execution
  const handleSearch = useCallback((searchQuery?: string) => {
    const finalQuery = searchQuery || state.query;

    if (!finalQuery.trim()) return;

    // Add to recent searches and perform search
    actions.addRecentSearch(finalQuery);
    onSearch(finalQuery, state.useAI);
    actions.setShowSuggestions(false);

    // Show feedback about search mode
    if (state.useAI) {
      info('AI-enhanced search initiated', { duration: 2000 });
    }
  }, [state.query, state.useAI, onSearch, actions, info]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: any) => {
    if (suggestion.type === 'quick-action' && suggestion.action) {
      suggestion.action();
      return;
    }

    actions.setQuery(suggestion.text);
    handleSearch(suggestion.text);
  }, [actions, handleSearch]);

  // Handle AI toggle
  const handleAIToggle = useCallback(() => {
    actions.setUseAI(!state.useAI);
    info(`Switched to ${!state.useAI ? 'AI-enhanced' : 'local'} search`, { duration: 2000 });
  }, [state.useAI, actions, info]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (state.selectedSuggestionIndex >= 0 && state.suggestions[state.selectedSuggestionIndex]) {
        handleSuggestionSelect(state.suggestions[state.selectedSuggestionIndex]);
      } else {
        handleSearch();
      }
    } else if (e.key === 'Escape') {
      if (state.query) {
        actions.setQuery('');
        actions.setShowSuggestions(false);
      } else {
        actions.setShowSuggestions(false);
        inputRef.current?.blur();
      }
    }
  }, [state.selectedSuggestionIndex, state.suggestions, state.query, handleSuggestionSelect, handleSearch, actions]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <div className={`unified-search ${className}`} id="main-unified-search">
      <div className="relative">
        {/* Main Search Container */}
        <div className="search-container bg-white rounded-2xl shadow-xl shadow-purple-500/10 border border-gray-200/80 focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-500/20 focus-within:shadow-2xl focus-within:shadow-purple-500/20 transition-all duration-300 backdrop-blur-sm">
          <div className="flex items-center p-5">
            {/* Search Icon */}
            <div className="relative mr-4">
              <Search className={`w-5 h-5 transition-all duration-300 ${
                state.showSuggestions ? 'text-purple-600 scale-110' : 'text-gray-400'
              }`} />
              {state.showSuggestions && (
                <div className="absolute inset-0 w-5 h-5 bg-purple-500/20 rounded-full animate-pulse"></div>
              )}
            </div>

            {/* Search Input */}
            <input
              ref={inputRef}
              type="search"
              value={state.query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => actions.setShowSuggestions(true)}
              placeholder={placeholder}
              aria-label="Search mainframe knowledge base"
              aria-autocomplete="list"
              aria-expanded={state.showSuggestions}
              autoFocus={autoFocus}
              disabled={loading}
              className="flex-1 text-gray-900 placeholder-gray-400 border-none outline-none text-lg font-medium tracking-wide selection:bg-purple-200 selection:text-purple-900"
            />

            {/* Clear Button */}
            {state.query && (
              <button
                onClick={() => {
                  actions.setQuery('');
                  onSearch('', false);
                  inputRef.current?.focus();
                }}
                className="mr-3 p-2 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all duration-300"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Loading Indicator */}
            {loading && (
              <div className="mr-4">
                <div className="w-6 h-6 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin"></div>
              </div>
            )}

            {/* AI Toggle */}
            <div className="flex items-center mr-5">
              <button
                onClick={handleAIToggle}
                disabled={loading}
                className={`relative inline-flex h-9 w-16 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-500/30 shadow-lg ${
                  state.useAI
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600'
                    : 'bg-gray-300'
                }`}
                aria-label={`${state.useAI ? 'Disable' : 'Enable'} AI-enhanced search`}
              >
                <span
                  className={`inline-block h-7 w-7 transform rounded-full bg-white transition-all duration-300 shadow-lg ${
                    state.useAI ? 'translate-x-8' : 'translate-x-1'
                  }`}
                >
                  {state.useAI ? (
                    <Sparkles className="w-4 h-4 text-purple-600 m-1.5" />
                  ) : (
                    <Search className="w-4 h-4 text-gray-500 m-1.5" />
                  )}
                </span>
              </button>
              <span className={`ml-3 text-sm font-semibold ${
                state.useAI ? 'text-purple-700' : 'text-gray-600'
              }`}>
                {state.useAI ? 'AI' : 'Local'}
              </span>
            </div>

            {/* Filters Button */}
            <button
              onClick={() => actions.setShowFilters(!state.showFilters)}
              className={`mr-3 p-3 rounded-xl transition-all duration-300 shadow-lg ${
                state.showFilters
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-purple-50 hover:text-purple-600'
              }`}
              aria-label="Search filters"
            >
              <Filter className="w-5 h-5" />
            </button>

            {/* Search Button */}
            <button
              onClick={() => handleSearch()}
              disabled={!state.query.trim() || loading}
              className={`px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300 shadow-lg ${
                !state.query.trim() || loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
              }`}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* HIVE: Popular Searches Section with proper z-index */}
        {state.showSuggestions && (
          <div
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
            style={{ zIndex: 1400 }}
          >
            {/* Popular Searches */}
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-purple-600" />
                Popular searches
              </h3>
              <div className="space-y-2">
                {['JCL errors', 'COBOL syntax', 'DB2 performance', 'Mainframe deployment'].map((search, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionSelect({ text: search, type: 'popular', relevance: 0.9 })}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-purple-50 hover:text-purple-700 transition-all duration-200 text-gray-600"
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions with higher z-index to prevent overlap */}
            <div
              className="p-4"
              style={{ zIndex: 1500 }}
            >
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Sparkles className="w-4 h-4 mr-2 text-blue-600" />
                Quick actions
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { text: 'Open Documentation', action: () => console.log('Open docs') },
                  { text: 'Contact Expert', action: () => console.log('Contact expert') },
                  { text: 'Report Issue', action: () => console.log('Report issue') },
                  { text: 'Training Resources', action: () => console.log('Training') }
                ].map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionSelect({ text: action.text, type: 'quick-action', action: action.action, relevance: 1.0 })}
                    className="px-3 py-2 text-sm rounded-lg bg-gray-50 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 text-gray-600"
                  >
                    {action.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Suggestions Dropdown with controlled z-index */}
        <div style={{ zIndex: 1300 }}>
          <SuggestionsDropdown
            suggestions={state.suggestions}
            isOpen={state.showSuggestions}
            selectedIndex={state.selectedSuggestionIndex}
            query={state.query}
            loading={loading}
            onClose={() => actions.setShowSuggestions(false)}
            onSelect={handleSuggestionSelect}
            onIndexChange={actions.setSelectedSuggestionIndex}
          />
        </div>

        {/* Filters Dropdown with controlled z-index */}
        <div style={{ zIndex: 1200 }}>
          <FiltersDropdown
            isOpen={state.showFilters}
            selectedCategory={state.selectedCategory}
            selectedTags={state.selectedTags}
            onClose={() => actions.setShowFilters(false)}
            onCategoryChange={actions.setSelectedCategory}
            onTagsChange={actions.setSelectedTags}
            onClearFilters={actions.clearFilters}
          />
        </div>
      </div>

      {/* Search Mode Indicator */}
      <div className="mt-4 flex items-center justify-between">
        <div className={`flex items-center px-4 py-2 rounded-xl transition-all duration-300 ${
          state.useAI
            ? 'bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200'
            : 'bg-gray-50 border border-gray-200'
        }`}>
          {state.useAI ? (
            <>
              <Sparkles className="w-4 h-4 mr-2 text-purple-600 animate-pulse" />
              <span className="text-sm font-semibold text-purple-700">AI-enhanced search enabled</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2 text-gray-500" />
              <span className="text-sm font-semibold text-gray-600">Local search only</span>
            </>
          )}
        </div>

        {/* Keyboard Shortcuts */}
        <div className="hidden md:flex items-center space-x-4 text-xs text-gray-600">
          <span className="flex items-center">
            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono shadow-sm mr-1">Ctrl+K</kbd>
            or
            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono shadow-sm mx-1">/</kbd>
            to focus
          </span>
        </div>
      </div>
    </div>
  );
});

SearchComponent.displayName = 'SearchComponent';

/**
 * Main UnifiedSearch Component with Provider
 */
export const UnifiedSearch: React.FC<UnifiedSearchProps> = (props) => {
  return (
    <SearchProvider onSearch={props.onSearch}>
      <SearchComponent {...props} />
    </SearchProvider>
  );
};

export default UnifiedSearch;