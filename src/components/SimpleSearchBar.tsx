import React, { useState, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useKnowledgeBase } from '../hooks/useIPC';

interface SimpleSearchBarProps {
  onResults?: (results: any[]) => void;
  placeholder?: string;
  className?: string;
}

export function SimpleSearchBar({
  onResults,
  placeholder = "Search knowledge base...",
  className = ""
}: SimpleSearchBarProps) {
  const [query, setQuery] = useState('');
  const { search, loading, error } = useKnowledgeBase();

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      const results = await search(query.trim());
      onResults?.(results);
    }
  }, [query, search, onResults]);

  const handleClear = useCallback(async () => {
    setQuery('');
    onResults?.([]);
  }, [onResults]);

  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`}>
      <form
        onSubmit={handleSubmit}
        className="relative flex items-center w-full"
        role="search"
        aria-label="Knowledge base search"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       bg-white shadow-sm text-gray-900 placeholder-gray-500
                       transition-all duration-200"
            aria-label="Search query"
            aria-describedby="search-help"
            disabled={loading}
          />

          {loading ? (
            <Loader2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-500 w-5 h-5 animate-spin" />
          ) : (
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"
              aria-hidden="true"
            />
          )}

          {query && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2
                         text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <button
          type="submit"
          className="ml-3 px-6 py-3 bg-blue-600 text-white rounded-lg
                     hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                     transition-all duration-200 font-medium disabled:opacity-50
                     disabled:cursor-not-allowed"
          disabled={!query.trim() || loading}
          aria-label="Search"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>

        <div id="search-help" className="sr-only">
          Enter keywords to search the mainframe knowledge base
        </div>
      </form>

      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">
            Search error: {error}
          </p>
        </div>
      )}
    </div>
  );
}