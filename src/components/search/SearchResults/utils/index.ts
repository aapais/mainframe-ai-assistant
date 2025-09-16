/**
 * SearchResults Utility Functions
 *
 * Centralized utility functions for SearchResults component architecture
 * @version 2.0.0
 */

import { ReactNode } from 'react';
import { SearchResult } from '../../../../types/index';
import { SearchTermConfig, HighlightMatch, DEFAULT_SEARCH_TERM_CONFIG } from '../types';

// ========================
// Search Term Utilities
// ========================

/**
 * Extracts search terms from query string with configurable options
 */
export const extractSearchTerms = (
  query: string,
  config: Partial<SearchTermConfig> = {}
): string[] => {
  const finalConfig = { ...DEFAULT_SEARCH_TERM_CONFIG, ...config };

  if (!query || typeof query !== 'string') {
    return [];
  }

  const processedQuery = finalConfig.caseSensitive ? query : query.toLowerCase();

  return processedQuery
    .split(/\s+/)
    .filter((term: string) => term.length >= finalConfig.minLength)
    .map((term: string) => term.replace(new RegExp(`[^a-zA-Z0-9${finalConfig.wordBoundaries}]`, 'g'), ''))
    .filter((term: string) => term.length > 0);
};

/**
 * Creates a regex pattern for highlighting search terms
 */
export const createHighlightRegex = (
  searchTerms: readonly string[],
  config: Partial<SearchTermConfig> = {}
): RegExp | null => {
  const finalConfig = { ...DEFAULT_SEARCH_TERM_CONFIG, ...config };

  if (!searchTerms.length) {
    return null;
  }

  const escapedTerms = searchTerms
    .filter(term => term.length >= finalConfig.minLength)
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (!escapedTerms.length) {
    return null;
  }

  const pattern = `(${escapedTerms.join('|')})`;
  const flags = finalConfig.caseSensitive ? 'g' : 'gi';

  return new RegExp(pattern, flags);
};

/**
 * Splits text into highlighted and non-highlighted segments
 */
export const segmentTextForHighlighting = (
  text: string,
  searchTerms: readonly string[],
  config: Partial<SearchTermConfig> = {}
): HighlightMatch[] => {
  if (!text || !searchTerms.length) {
    return [{ text, start: 0, end: text.length, isHighlight: false }];
  }

  const regex = createHighlightRegex(searchTerms, config);
  if (!regex) {
    return [{ text, start: 0, end: text.length, isHighlight: false }];
  }

  const segments: HighlightMatch[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add non-highlighted text before match
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        start: lastIndex,
        end: match.index,
        isHighlight: false
      });
    }

    // Add highlighted match
    segments.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      isHighlight: true
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining non-highlighted text
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      start: lastIndex,
      end: text.length,
      isHighlight: false
    });
  }

  return segments;
};

/**
 * Checks if text contains any search terms
 */
export const hasSearchMatches = (
  text: string,
  searchTerms: readonly string[],
  config: Partial<SearchTermConfig> = {}
): boolean => {
  if (!text || !searchTerms.length) {
    return false;
  }

  const regex = createHighlightRegex(searchTerms, config);
  return regex ? regex.test(text) : false;
};

// ========================
// Confidence Score Utilities
// ========================

/**
 * Gets confidence score color class based on value
 */
export const getConfidenceScoreColor = (score: number): string => {
  if (score >= 0.8) return 'text-green-600';
  if (score >= 0.6) return 'text-yellow-600';
  return 'text-red-600';
};

/**
 * Gets confidence score background color for progress bar
 */
export const getConfidenceScoreBackground = (score: number): string => {
  if (score >= 0.8) return 'bg-green-500';
  if (score >= 0.6) return 'bg-yellow-500';
  return 'bg-red-500';
};

/**
 * Formats confidence score as percentage
 */
export const formatConfidenceScore = (score: number): string => {
  return `${Math.round(score * 100)}%`;
};

/**
 * Gets accessibility description for confidence score
 */
export const getConfidenceScoreDescription = (score: number, matchType: SearchResult['matchType']): string => {
  const percentage = formatConfidenceScore(score);
  const quality = score >= 0.8 ? 'high' : score >= 0.6 ? 'medium' : 'low';

  return `${matchType} match with ${quality} confidence (${percentage})`;
};

// ========================
// Match Type Utilities
// ========================

/**
 * Gets match type icon
 */
export const getMatchTypeIcon = (matchType: SearchResult['matchType']): string => {
  const icons = {
    exact: '🎯',
    fuzzy: '🔍',
    ai: '🤖',
    semantic: '🧠'
  } as const;

  return icons[matchType] || '🔍';
};

/**
 * Gets match type description
 */
export const getMatchTypeDescription = (matchType: SearchResult['matchType']): string => {
  const descriptions = {
    exact: 'Exact keyword match',
    fuzzy: 'Approximate match with typo tolerance',
    ai: 'AI-powered contextual match',
    semantic: 'Semantic meaning match'
  } as const;

  return descriptions[matchType] || 'Unknown match type';
};

/**
 * Gets match type priority for sorting
 */
export const getMatchTypePriority = (matchType: SearchResult['matchType']): number => {
  const priorities = {
    exact: 4,
    semantic: 3,
    ai: 2,
    fuzzy: 1
  } as const;

  return priorities[matchType] || 0;
};

// ========================
// Virtual Scrolling Utilities
// ========================

/**
 * Calculates visible range for virtual scrolling
 */
export const calculateVisibleRange = (
  scrollTop: number,
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  bufferSize: number = 5
): { start: number; end: number } => {
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.floor(scrollTop / itemHeight);

  const bufferedStart = Math.max(0, startIndex - bufferSize);
  const bufferedEnd = Math.min(totalItems, startIndex + visibleCount + bufferSize);

  return {
    start: bufferedStart,
    end: bufferedEnd
  };
};

/**
 * Calculates total height for virtual scrolling
 */
export const calculateTotalHeight = (itemCount: number, itemHeight: number): number => {
  return itemCount * itemHeight;
};

/**
 * Calculates item offset for virtual scrolling
 */
export const calculateItemOffset = (index: number, itemHeight: number): number => {
  return index * itemHeight;
};

/**
 * Throttles a function call
 */
export const throttle = <T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Debounces a function call
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
};

// ========================
// Accessibility Utilities
// ========================

/**
 * Generates ARIA label for search results list
 */
export const generateSearchResultsAriaLabel = (
  resultCount: number,
  searchQuery: string,
  selectedIndex: number = -1
): string => {
  const baseLabel = `Search results. ${resultCount} result${resultCount !== 1 ? 's' : ''} found for "${searchQuery}".`;
  const navigationLabel = 'Use arrow keys to navigate, Enter to select.';
  const selectionLabel = selectedIndex >= 0 ? ` Currently selected: result ${selectedIndex + 1} of ${resultCount}.` : '';

  return `${baseLabel} ${navigationLabel}${selectionLabel}`;
};

/**
 * Generates ARIA label for individual search result
 */
export const generateSearchResultItemAriaLabel = (
  result: SearchResult,
  index: number,
  showConfidenceScore: boolean = false
): string => {
  const { entry, score, matchType } = result;
  const baseLabel = `Search result ${index + 1}: ${entry.title}`;
  const categoryLabel = ` Category: ${entry.category}.`;
  const confidenceLabel = showConfidenceScore
    ? ` ${getConfidenceScoreDescription(score, matchType)}.`
    : '';

  return `${baseLabel}.${categoryLabel}${confidenceLabel}`;
};

/**
 * Generates screen reader description for search result
 */
export const generateSearchResultDescription = (
  result: SearchResult,
  showConfidenceScore: boolean = false
): string => {
  const { entry, score, matchType } = result;
  const problemText = `Problem: ${entry.problem}.`;
  const solutionText = ` Solution: ${entry.solution}.`;
  const confidenceText = showConfidenceScore
    ? ` ${getConfidenceScoreDescription(score, matchType)}.`
    : '';

  return `${problemText}${solutionText}${confidenceText}`;
};

// ========================
// Validation Utilities
// ========================

/**
 * Validates search results data
 */
export const validateSearchResults = (results: unknown): results is SearchResult[] => {
  if (!Array.isArray(results)) {
    return false;
  }

  return results.every((result): result is SearchResult => {
    return (
      typeof result === 'object' &&
      result !== null &&
      'entry' in result &&
      'score' in result &&
      'matchType' in result &&
      typeof result.score === 'number' &&
      result.score >= 0 &&
      result.score <= 1 &&
      ['exact', 'fuzzy', 'ai', 'semantic'].includes(result.matchType as string)
    );
  });
};

/**
 * Validates search query
 */
export const validateSearchQuery = (query: unknown): query is string => {
  return typeof query === 'string' && query.trim().length > 0;
};

/**
 * Sanitizes HTML content for safe rendering
 */
export const sanitizeHTML = (content: string): string => {
  const div = document.createElement('div');
  div.textContent = content;
  return div.innerHTML;
};

// ========================
// Performance Utilities
// ========================

/**
 * Memoization helper for expensive computations
 */
export const memoize = <TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  keySelector?: (...args: TArgs) => string
): ((...args: TArgs) => TReturn) => {
  const cache = new Map<string, TReturn>();

  return (...args: TArgs): TReturn => {
    const key = keySelector ? keySelector(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

/**
 * Clamps a number between min and max values
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Checks if browser supports Intersection Observer
 */
export const supportsIntersectionObserver = (): boolean => {
  return typeof window !== 'undefined' && 'IntersectionObserver' in window;
};

/**
 * Checks if user prefers reduced motion
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Export all utilities
export * from '../types';