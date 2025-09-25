/**
 * useAutocomplete Hook
 *
 * Advanced autocomplete functionality with:
 * - Multiple suggestion sources (history, AI, static)
 * - Smart ranking and filtering
 * - Keyboard navigation
 * - Performance optimizations
 *
 * Performance targets:
 * - Suggestions rendered in <50ms
 * - Keyboard navigation at 60fps
 * - Efficient memory usage
 *
 * @author Frontend Team
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDebounce } from './useDebounce';

export interface AutocompleteSuggestion {
  id: string;
  text: string;
  type: 'history' | 'ai' | 'static' | 'category' | 'tag' | 'template';
  category?: string;
  description?: string;
  icon?: string;
  score: number;
  metadata?: Record<string, any>;
  highlighted?: boolean;
}

export interface AutocompleteOptions {
  /** Minimum characters before showing suggestions (default: 2) */
  minLength?: number;
  /** Maximum number of suggestions (default: 10) */
  maxSuggestions?: number;
  /** Debounce delay in ms (default: 150) */
  debounceMs?: number;
  /** Enable fuzzy matching (default: true) */
  fuzzyMatch?: boolean;
  /** Enable case-sensitive matching (default: false) */
  caseSensitive?: boolean;
  /** Group suggestions by type (default: true) */
  groupByType?: boolean;
  /** Show suggestion descriptions (default: true) */
  showDescriptions?: boolean;
  /** Enable keyboard navigation (default: true) */
  keyboardNavigation?: boolean;
}

export interface SuggestionSource {
  id: string;
  name: string;
  getSuggestions: (
    query: string,
    options: AutocompleteOptions
  ) => Promise<AutocompleteSuggestion[]>;
  priority: number;
  enabled: boolean;
}

interface AutocompleteState {
  isOpen: boolean;
  suggestions: AutocompleteSuggestion[];
  selectedIndex: number;
  loading: boolean;
  error: Error | null;
}

const DEFAULT_OPTIONS: Required<AutocompleteOptions> = {
  minLength: 2,
  maxSuggestions: 10,
  debounceMs: 150,
  fuzzyMatch: true,
  caseSensitive: false,
  groupByType: true,
  showDescriptions: true,
  keyboardNavigation: true,
};

/**
 * Calculate fuzzy match score
 */
function calculateFuzzyScore(query: string, text: string, caseSensitive: boolean = false): number {
  const normalizedQuery = caseSensitive ? query : query.toLowerCase();
  const normalizedText = caseSensitive ? text : text.toLowerCase();

  // Exact match gets highest score
  if (normalizedText === normalizedQuery) return 1;

  // Prefix match gets high score
  if (normalizedText.startsWith(normalizedQuery)) return 0.9;

  // Word boundary matches
  const words = normalizedText.split(/\s+/);
  const wordMatch = words.find(word => word.startsWith(normalizedQuery));
  if (wordMatch) return 0.8;

  // Contains match
  if (normalizedText.includes(normalizedQuery)) return 0.6;

  // Fuzzy matching using longest common subsequence
  let score = 0;
  let queryIndex = 0;
  let textIndex = 0;
  let consecutiveMatches = 0;

  while (queryIndex < normalizedQuery.length && textIndex < normalizedText.length) {
    if (normalizedQuery[queryIndex] === normalizedText[textIndex]) {
      queryIndex++;
      consecutiveMatches++;
      score += consecutiveMatches * 0.1;
    } else {
      consecutiveMatches = 0;
    }
    textIndex++;
  }

  // Penalize if not all query characters were matched
  if (queryIndex < normalizedQuery.length) {
    score *= queryIndex / normalizedQuery.length;
  }

  return Math.min(score, 0.5); // Cap fuzzy score at 0.5
}

/**
 * Filter and rank suggestions
 */
function filterAndRankSuggestions(
  suggestions: AutocompleteSuggestion[],
  query: string,
  options: AutocompleteOptions
): AutocompleteSuggestion[] {
  if (!query.trim()) return [];

  const filtered = suggestions
    .map(suggestion => {
      let score = suggestion.score;

      // Apply fuzzy matching if enabled
      if (options.fuzzyMatch) {
        const fuzzyScore = calculateFuzzyScore(query, suggestion.text, options.caseSensitive);
        if (fuzzyScore === 0) return null; // No match
        score = Math.max(score, fuzzyScore);
      } else {
        // Exact matching
        const normalizedQuery = options.caseSensitive ? query : query.toLowerCase();
        const normalizedText = options.caseSensitive
          ? suggestion.text
          : suggestion.text.toLowerCase();

        if (!normalizedText.includes(normalizedQuery)) return null;
      }

      return {
        ...suggestion,
        score,
      };
    })
    .filter((suggestion): suggestion is AutocompleteSuggestion => suggestion !== null)
    .sort((a, b) => {
      // Sort by score (descending), then by type priority
      if (a.score !== b.score) return b.score - a.score;

      // Type priority: history > ai > category > tag > static > template
      const typePriority = {
        history: 6,
        ai: 5,
        category: 4,
        tag: 3,
        static: 2,
        template: 1,
      };

      const aPriority = typePriority[a.type] || 0;
      const bPriority = typePriority[b.type] || 0;

      return bPriority - aPriority;
    })
    .slice(0, options.maxSuggestions || DEFAULT_OPTIONS.maxSuggestions);

  return filtered;
}

/**
 * Group suggestions by type
 */
function groupSuggestionsByType(
  suggestions: AutocompleteSuggestion[]
): Record<string, AutocompleteSuggestion[]> {
  return suggestions.reduce(
    (groups, suggestion) => {
      const type = suggestion.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(suggestion);
      return groups;
    },
    {} as Record<string, AutocompleteSuggestion[]>
  );
}

/**
 * Hook for autocomplete functionality
 */
export function useAutocomplete(sources: SuggestionSource[], options: AutocompleteOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const [state, setState] = useState<AutocompleteState>({
    isOpen: false,
    suggestions: [],
    selectedIndex: -1,
    loading: false,
    error: null,
  });

  const abortController = useRef<AbortController>();

  // Debounced query for suggestion fetching
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query, { delay: config.debounceMs });

  // Fetch suggestions from all sources
  const fetchSuggestions = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < config.minLength) {
        setState(prev => ({
          ...prev,
          isOpen: false,
          suggestions: [],
          selectedIndex: -1,
          loading: false,
        }));
        return;
      }

      // Cancel previous request
      if (abortController.current) {
        abortController.current.abort();
      }

      // Create new abort controller
      abortController.current = new AbortController();

      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        // Fetch from all enabled sources in parallel
        const enabledSources = sources.filter(source => source.enabled);
        const suggestionPromises = enabledSources.map(async source => {
          try {
            return await source.getSuggestions(searchQuery, config);
          } catch (error) {
            console.warn(`Suggestion source ${source.id} failed:`, error);
            return [];
          }
        });

        const results = await Promise.all(suggestionPromises);
        const allSuggestions = results.flat();

        // Check if request was aborted
        if (abortController.current?.signal.aborted) return;

        // Filter and rank suggestions
        const filteredSuggestions = filterAndRankSuggestions(allSuggestions, searchQuery, config);

        setState(prev => ({
          ...prev,
          isOpen: filteredSuggestions.length > 0,
          suggestions: filteredSuggestions,
          selectedIndex: filteredSuggestions.length > 0 ? 0 : -1,
          loading: false,
        }));
      } catch (error) {
        if (!abortController.current?.signal.aborted) {
          const err = error instanceof Error ? error : new Error('Unknown error');
          setState(prev => ({
            ...prev,
            loading: false,
            error: err,
          }));
        }
      }
    },
    [sources, config]
  );

  // Fetch suggestions when debounced query changes
  useEffect(() => {
    fetchSuggestions(debouncedQuery);
  }, [debouncedQuery, fetchSuggestions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  // Update query
  const updateQuery = useCallback((newQuery: string) => {
    setQuery(newQuery);
  }, []);

  // Close suggestions
  const close = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
      selectedIndex: -1,
    }));
  }, []);

  // Open suggestions
  const open = useCallback(() => {
    if (state.suggestions.length > 0) {
      setState(prev => ({
        ...prev,
        isOpen: true,
        selectedIndex: prev.selectedIndex === -1 ? 0 : prev.selectedIndex,
      }));
    }
  }, [state.suggestions.length]);

  // Navigate to next suggestion
  const selectNext = useCallback(() => {
    setState(prev => {
      if (!prev.isOpen || prev.suggestions.length === 0) return prev;

      const nextIndex =
        prev.selectedIndex < prev.suggestions.length - 1 ? prev.selectedIndex + 1 : 0;

      return {
        ...prev,
        selectedIndex: nextIndex,
      };
    });
  }, []);

  // Navigate to previous suggestion
  const selectPrevious = useCallback(() => {
    setState(prev => {
      if (!prev.isOpen || prev.suggestions.length === 0) return prev;

      const prevIndex =
        prev.selectedIndex > 0 ? prev.selectedIndex - 1 : prev.suggestions.length - 1;

      return {
        ...prev,
        selectedIndex: prevIndex,
      };
    });
  }, []);

  // Select suggestion by index
  const selectByIndex = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      selectedIndex: index,
    }));
  }, []);

  // Get currently selected suggestion
  const getSelectedSuggestion = useCallback((): AutocompleteSuggestion | null => {
    if (state.selectedIndex === -1 || !state.suggestions[state.selectedIndex]) {
      return null;
    }
    return state.suggestions[state.selectedIndex];
  }, [state.selectedIndex, state.suggestions]);

  // Group suggestions by type if enabled
  const groupedSuggestions = useMemo(() => {
    if (!config.groupByType) {
      return { all: state.suggestions };
    }
    return groupSuggestionsByType(state.suggestions);
  }, [state.suggestions, config.groupByType]);

  // Get suggestion display text with highlighting
  const getHighlightedText = useCallback(
    (text: string, searchQuery: string) => {
      if (!searchQuery.trim()) return text;

      const normalizedQuery = config.caseSensitive ? searchQuery : searchQuery.toLowerCase();
      const normalizedText = config.caseSensitive ? text : text.toLowerCase();

      const index = normalizedText.indexOf(normalizedQuery);
      if (index === -1) return text;

      return {
        before: text.substring(0, index),
        match: text.substring(index, index + searchQuery.length),
        after: text.substring(index + searchQuery.length),
      };
    },
    [config.caseSensitive]
  );

  return {
    // State
    isOpen: state.isOpen,
    suggestions: state.suggestions,
    groupedSuggestions,
    selectedIndex: state.selectedIndex,
    loading: state.loading,
    error: state.error,

    // Actions
    updateQuery,
    close,
    open,
    selectNext,
    selectPrevious,
    selectByIndex,
    getSelectedSuggestion,
    getHighlightedText,

    // Config
    config,
  };
}
