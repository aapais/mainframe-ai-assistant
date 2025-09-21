/**
 * Enhanced Search Suggestions Hook - Search Intelligence Agent Implementation
 *
 * Features:
 * - Smart suggestions based on user behavior and context
 * - Typo correction and auto-completion
 * - Contextual suggestions based on current page/section
 * - Fuzzy matching with configurable thresholds
 * - Performance-optimized with debouncing and memoization
 * - Privacy-aware analytics tracking
 *
 * @author Search Intelligence Agent
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchHistory } from './useSearchHistory';

export interface SmartSuggestion {
  query: string;
  type: 'recent' | 'popular' | 'context' | 'correction' | 'completion' | 'trending';
  score: number;
  frequency: number;
  lastUsed: Date;
  avgResultsCount: number;
  successRate: number;
  category?: string;
  reason: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface SuggestionOptions {
  maxSuggestions?: number;
  enableTypoCorrection?: boolean;
  enableAutoCompletion?: boolean;
  enableContextAware?: boolean;
  fuzzyThreshold?: number;
  debounceMs?: number;
  weightRecent?: number;
  weightPopular?: number;
  weightContext?: number;
  weightCorrection?: number;
  weightCompletion?: number;
}

const DEFAULT_OPTIONS: Required<SuggestionOptions> = {
  maxSuggestions: 8,
  enableTypoCorrection: true,
  enableAutoCompletion: true,
  enableContextAware: true,
  fuzzyThreshold: 0.7,
  debounceMs: 150,
  weightRecent: 0.3,
  weightPopular: 0.25,
  weightContext: 0.2,
  weightCorrection: 0.15,
  weightCompletion: 0.1
};

/**
 * Calculate Levenshtein distance for typo detection
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;

  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - (distance / maxLength);
}

/**
 * Normalize query for comparison
 */
function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Common mainframe search patterns and corrections
 */
const COMMON_CORRECTIONS: Record<string, string[]> = {
  'jcl': ['JCL', 'job control language'],
  'vsam': ['VSAM', 'virtual storage access method'],
  'db2': ['DB2', 'database 2'],
  'cics': ['CICS', 'customer information control system'],
  'ims': ['IMS', 'information management system'],
  'cobol': ['COBOL', 'common business oriented language'],
  'abend': ['ABEND', 'abnormal end'],
  'soc7': ['SOC7', 'S0C7', 'data exception'],
  'soc4': ['SOC4', 'S0C4', 'protection exception'],
  'ispf': ['ISPF', 'interactive system productivity facility']
};

/**
 * Context patterns for better suggestions
 */
const CONTEXT_PATTERNS: Record<string, string[]> = {
  'incidents': ['error', 'abend', 'failure', 'issue', 'problem'],
  'knowledge': ['how to', 'guide', 'tutorial', 'documentation'],
  'dashboard': ['status', 'metrics', 'performance', 'monitoring'],
  'settings': ['configuration', 'setup', 'preferences', 'options']
};

export function useSearchSuggestions(
  query: string = '',
  context?: string,
  options: SuggestionOptions = {}
) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const { history, popularSearches, getAnalytics } = useSearchHistory();

  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce query input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, config.debounceMs);

    return () => clearTimeout(timer);
  }, [query, config.debounceMs]);

  // Generate suggestions based on query and context
  const generateSuggestions = useCallback(async (): Promise<SmartSuggestion[]> => {
    const normalizedQuery = normalizeQuery(debouncedQuery);
    const suggestions: SmartSuggestion[] = [];
    const now = new Date();

    // 1. Recent searches (if no query or for auto-completion)
    if (!normalizedQuery || config.enableAutoCompletion) {
      const recentSearches = await history.slice(0, 10);

      recentSearches.forEach(entry => {
        const entryNormalized = normalizeQuery(entry.query);

        // Include if no query or if it matches/completes current query
        const isMatch = !normalizedQuery ||
          entryNormalized.includes(normalizedQuery) ||
          entryNormalized.startsWith(normalizedQuery);

        if (isMatch) {
          const daysSince = (now.getTime() - entry.timestamp.getTime()) / (1000 * 60 * 60 * 24);
          const recencyScore = Math.max(0.1, 1 - daysSince / 7); // Decay over 7 days

          suggestions.push({
            query: entry.query,
            type: 'recent',
            score: config.weightRecent * recencyScore,
            frequency: 1,
            lastUsed: entry.timestamp,
            avgResultsCount: entry.resultCount || 0,
            successRate: entry.successful !== false ? 1 : 0,
            reason: daysSince < 1 ? 'Searched today' : `Searched ${Math.ceil(daysSince)} days ago`,
            confidence: 0.8
          });
        }
      });
    }

    // 2. Popular searches based on frequency
    popularSearches.slice(0, 15).forEach(popular => {
      const popularNormalized = normalizeQuery(popular.query);

      // Include if no query or if it matches current query
      const isMatch = !normalizedQuery ||
        popularNormalized.includes(normalizedQuery) ||
        calculateSimilarity(normalizedQuery, popularNormalized) > config.fuzzyThreshold;

      if (isMatch && popular.count > 1) {
        const popularityScore = Math.min(1, popular.count / 10); // Normalize to max 10 uses

        suggestions.push({
          query: popular.query,
          type: 'popular',
          score: config.weightPopular * popularityScore * popular.successRate,
          frequency: popular.count,
          lastUsed: popular.lastUsed,
          avgResultsCount: popular.avgResultCount,
          successRate: popular.successRate,
          reason: `Used ${popular.count} times with ${Math.round(popular.successRate * 100)}% success`,
          confidence: 0.9
        });
      }
    });

    // 3. Context-aware suggestions
    if (config.enableContextAware && context) {
      const contextKeywords = CONTEXT_PATTERNS[context] || [];

      contextKeywords.forEach(keyword => {
        if (!normalizedQuery || keyword.includes(normalizedQuery)) {
          // Find related searches from history
          const relatedSearches = history.filter(entry =>
            normalizeQuery(entry.query).includes(keyword.toLowerCase())
          ).slice(0, 3);

          relatedSearches.forEach(entry => {
            const contextScore = 0.8; // High confidence for context matches

            suggestions.push({
              query: entry.query,
              type: 'context',
              score: config.weightContext * contextScore,
              frequency: 1,
              lastUsed: entry.timestamp,
              avgResultsCount: entry.resultCount || 0,
              successRate: entry.successful !== false ? 1 : 0,
              reason: `Related to ${context} context`,
              confidence: 0.7,
              metadata: { contextKeyword: keyword }
            });
          });
        }
      });
    }

    // 4. Typo corrections
    if (config.enableTypoCorrection && normalizedQuery.length >= 3) {
      // Check against history for potential corrections
      history.forEach(entry => {
        const entryNormalized = normalizeQuery(entry.query);
        const similarity = calculateSimilarity(normalizedQuery, entryNormalized);

        // If similar but not exact, might be a typo
        if (similarity > config.fuzzyThreshold && similarity < 0.95 && entry.successful !== false) {
          suggestions.push({
            query: entry.query,
            type: 'correction',
            score: config.weightCorrection * similarity,
            frequency: 1,
            lastUsed: entry.timestamp,
            avgResultsCount: entry.resultCount || 0,
            successRate: entry.successful !== false ? 1 : 0,
            reason: 'Possible typo correction',
            confidence: similarity
          });
        }
      });

      // Check against common corrections
      Object.entries(COMMON_CORRECTIONS).forEach(([key, corrections]) => {
        const keywordSimilarity = calculateSimilarity(normalizedQuery, key);

        if (keywordSimilarity > config.fuzzyThreshold) {
          corrections.forEach(correction => {
            suggestions.push({
              query: correction,
              type: 'correction',
              score: config.weightCorrection * keywordSimilarity * 0.8,
              frequency: 0,
              lastUsed: new Date(),
              avgResultsCount: 0,
              successRate: 0.8, // High confidence for common corrections
              reason: 'Common term correction',
              confidence: 0.6,
              metadata: { originalTerm: key }
            });
          });
        }
      });
    }

    // 5. Auto-completion suggestions
    if (config.enableAutoCompletion && normalizedQuery.length >= 2) {
      const completions = history
        .filter(entry => {
          const entryNormalized = normalizeQuery(entry.query);
          return entryNormalized.startsWith(normalizedQuery) &&
                 entryNormalized !== normalizedQuery;
        })
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 5);

      completions.forEach(entry => {
        const completionScore = entry.successful !== false ? 1 : 0.5;

        suggestions.push({
          query: entry.query,
          type: 'completion',
          score: config.weightCompletion * completionScore,
          frequency: 1,
          lastUsed: entry.timestamp,
          avgResultsCount: entry.resultCount || 0,
          successRate: entry.successful !== false ? 1 : 0,
          reason: 'Query completion',
          confidence: 0.6
        });
      });
    }

    return suggestions;
  }, [
    debouncedQuery,
    context,
    config,
    history,
    popularSearches
  ]);

  // Generate suggestions when query or context changes
  useEffect(() => {
    const loadSuggestions = async () => {
      setLoading(true);
      try {
        const generated = await generateSuggestions();

        // Deduplicate and sort by score
        const seen = new Set<string>();
        const deduped = generated.filter(suggestion => {
          const normalized = normalizeQuery(suggestion.query);
          if (seen.has(normalized)) return false;
          seen.add(normalized);
          return true;
        });

        const sorted = deduped
          .sort((a, b) => b.score - a.score)
          .slice(0, config.maxSuggestions);

        setSuggestions(sorted);
      } catch (error) {
        console.error('Failed to generate suggestions:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    loadSuggestions();
  }, [generateSuggestions, config.maxSuggestions]);

  // Memoized analytics for performance insights
  const suggestionAnalytics = useMemo(() => {
    const analytics = getAnalytics();

    return {
      totalSuggestions: suggestions.length,
      suggestionTypes: suggestions.reduce((acc, suggestion) => {
        acc[suggestion.type] = (acc[suggestion.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      avgConfidence: suggestions.length > 0
        ? suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length
        : 0,
      topCategories: Array.from(
        new Set(suggestions.filter(s => s.category).map(s => s.category))
      ),
      ...analytics
    };
  }, [suggestions, getAnalytics]);

  // Helper function to get suggestions by type
  const getSuggestionsByType = useCallback((type: SmartSuggestion['type']) => {
    return suggestions.filter(suggestion => suggestion.type === type);
  }, [suggestions]);

  // Helper function to get high-confidence suggestions
  const getHighConfidenceSuggestions = useCallback((minConfidence: number = 0.7) => {
    return suggestions.filter(suggestion => suggestion.confidence >= minConfidence);
  }, [suggestions]);

  return {
    suggestions,
    loading,
    analytics: suggestionAnalytics,
    getSuggestionsByType,
    getHighConfidenceSuggestions,

    // Configuration
    config,

    // State
    query: debouncedQuery,
    hasQuery: debouncedQuery.length > 0
  };
}