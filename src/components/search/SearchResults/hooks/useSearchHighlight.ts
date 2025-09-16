/**
 * useSearchHighlight Hook
 *
 * Custom hook for managing search term highlighting functionality
 * @version 2.0.0
 */

import { useMemo, createElement, ReactNode } from 'react';
import {
  UseSearchHighlightReturn,
  SearchTermConfig,
  DEFAULT_SEARCH_TERM_CONFIG
} from '../types';
import {
  extractSearchTerms,
  segmentTextForHighlighting,
  hasSearchMatches,
  memoize
} from '../utils';

interface UseSearchHighlightOptions {
  /** Configuration for search term processing */
  config?: Partial<SearchTermConfig>;
  /** Custom highlight component or tag name */
  highlightComponent?: string | React.ComponentType<{ children: ReactNode; className?: string }>;
  /** CSS class for highlighted segments */
  highlightClassName?: string;
  /** Whether to enable memoization for performance */
  enableMemoization?: boolean;
}

/**
 * Hook for managing search term highlighting with performance optimizations
 */
export const useSearchHighlight = (
  searchQuery: string,
  options: UseSearchHighlightOptions = {}
): UseSearchHighlightReturn => {
  const {
    config = {},
    highlightComponent = 'mark',
    highlightClassName = 'search-highlight',
    enableMemoization = true
  } = options;

  const finalConfig = useMemo(() => ({
    ...DEFAULT_SEARCH_TERM_CONFIG,
    ...config
  }), [config]);

  // Extract search terms with memoization
  const searchTerms = useMemo(() => {
    return extractSearchTerms(searchQuery, finalConfig);
  }, [searchQuery, finalConfig]);

  // Memoized highlight function for performance
  const highlightTextMemoized = useMemo(() => {
    const highlightFn = (text: string): ReactNode => {
      if (!text || !searchTerms.length) {
        return text;
      }

      const segments = segmentTextForHighlighting(text, searchTerms, finalConfig);

      return segments.map((segment, index) => {
        if (segment.isHighlight) {
          if (typeof highlightComponent === 'string') {
            return createElement(
              highlightComponent,
              {
                key: index,
                className: highlightClassName
              },
              segment.text
            );
          } else {
            return createElement(
              highlightComponent,
              {
                key: index,
                className: highlightClassName
              },
              segment.text
            );
          }
        }
        return segment.text;
      });
    };

    return enableMemoization
      ? memoize(highlightFn, (text: string) => `${text}|${searchTerms.join('|')}`)
      : highlightFn;
  }, [searchTerms, finalConfig, highlightComponent, highlightClassName, enableMemoization]);

  // Memoized function to check for highlights
  const hasHighlightsMemoized = useMemo(() => {
    const hasHighlightsFn = (text: string): boolean => {
      return hasSearchMatches(text, searchTerms, finalConfig);
    };

    return enableMemoization
      ? memoize(hasHighlightsFn, (text: string) => `${text}|${searchTerms.join('|')}`)
      : hasHighlightsFn;
  }, [searchTerms, finalConfig, enableMemoization]);

  return {
    searchTerms,
    highlightText: highlightTextMemoized,
    hasHighlights: hasHighlightsMemoized
  };
};

// Export additional utilities
export { extractSearchTerms, segmentTextForHighlighting, hasSearchMatches };