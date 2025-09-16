/**
 * IntelligentSearchInput - Coordinated search input with all enhancements
 *
 * Features:
 * - Real-time autocomplete with <100ms response time
 * - Advanced keyboard shortcuts (Ctrl+K, Up/Down, Escape)
 * - Search history management with persistence
 * - Performance monitoring and optimization
 * - Accessibility compliant (WCAG 2.1 AA)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import SearchAutocomplete from './SearchAutocomplete';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useSearchHistory } from '../../hooks/useSearchHistory';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { SearchHistoryPanel } from './SearchHistoryPanel';
import { SearchMetrics } from './SearchMetrics';
import './IntelligentSearchInput.css';

export interface IntelligentSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  onSuggestionSelect?: (suggestion: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  showHistory?: boolean;
  showMetrics?: boolean;
  enableKeyboardShortcuts?: boolean;
  maxSuggestions?: number;
  className?: string;
}

export interface SearchContext {
  userId?: string;
  sessionId?: string;
  currentCategory?: string;
  previousQueries?: string[];
}

interface PerformanceMetrics {
  autocompleteResponseTime: number[];
  searchExecutionTime: number[];
  cacheHitRate: number;
  totalSearches: number;
}

export const IntelligentSearchInput: React.FC<IntelligentSearchInputProps> = ({
  value,
  onChange,
  onSearch,
  onSuggestionSelect,
  placeholder = 'Search knowledge base...',
  autoFocus = false,
  showHistory = true,
  showMetrics = false,
  enableKeyboardShortcuts = true,
  maxSuggestions = 10,
  className = ''
}) => {
  // State management
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [isMetricsPanelOpen, setIsMetricsPanelOpen] = useState(false);
  const [currentContext, setCurrentContext] = useState<SearchContext>({});
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [popularSearches, setPopularSearches] = useState<Array<{ query: string; count: number }>>([]);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const performanceStartTime = useRef<number>(0);

  // Custom hooks
  const { addToHistory, getRecentSearches, getPopularSearches, clearHistory } = useSearchHistory();
  const { recordMetric, getMetrics } = usePerformanceMonitoring();

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [recent, popular] = await Promise.all([
          getRecentSearches(20),
          getPopularSearches(10)
        ]);

        setRecentSearches(recent);
        setPopularSearches(popular);

        // Set initial context
        setCurrentContext({
          userId: 'current-user', // TODO: Get from auth context
          sessionId: `session-${Date.now()}`,
          previousQueries: recent.slice(0, 5)
        });
      } catch (error) {
        console.warn('Failed to load search data:', error);
      }
    };

    loadInitialData();
  }, []);

  // Keyboard shortcuts setup
  const shortcuts = useMemo(() => ({
    'Ctrl+K': {
      description: 'Focus search input',
      handler: () => {
        searchInputRef.current?.focus();
        setIsHistoryPanelOpen(!isHistoryPanelOpen);
      }
    },
    'Ctrl+H': {
      description: 'Toggle search history',
      handler: () => setIsHistoryPanelOpen(!isHistoryPanelOpen)
    },
    'Ctrl+M': {
      description: 'Toggle metrics panel',
      handler: () => setIsMetricsPanelOpen(!isMetricsPanelOpen)
    },
    'Escape': {
      description: 'Clear search and close panels',
      handler: () => {
        onChange('');
        setIsHistoryPanelOpen(false);
        setIsMetricsPanelOpen(false);
        searchInputRef.current?.blur();
      }
    }
  }), [onChange, isHistoryPanelOpen, isMetricsPanelOpen]);

  useKeyboardShortcuts(enableKeyboardShortcuts ? shortcuts : {});

  // Enhanced search handler with performance monitoring
  const handleSearch = useCallback(async (query: string) => {
    const startTime = performance.now();

    try {
      // Add to search history
      await addToHistory(query);

      // Update recent searches state
      setRecentSearches(prev => {
        const updated = [query, ...prev.filter(q => q !== query)].slice(0, 20);
        return updated;
      });

      // Update context
      setCurrentContext(prev => ({
        ...prev,
        previousQueries: [query, ...(prev.previousQueries || [])].slice(0, 5)
      }));

      // Execute search
      onSearch(query);

      // Record performance
      const executionTime = performance.now() - startTime;
      recordMetric('search_execution_time', executionTime);

      if (executionTime > 1000) {
        console.warn(`Search took ${executionTime.toFixed(2)}ms (target: <100ms)`);
      }

    } catch (error) {
      console.error('Search execution failed:', error);
      recordMetric('search_errors', 1);
    }
  }, [onSearch, addToHistory, recordMetric]);

  // Enhanced suggestion select handler
  const handleSuggestionSelect = useCallback(async (suggestion: string) => {
    const startTime = performance.now();

    try {
      // Record autocomplete performance
      const responseTime = performance.now() - performanceStartTime.current;
      recordMetric('autocomplete_response_time', responseTime);

      // Update input value
      onChange(suggestion);

      // Call parent handler
      onSuggestionSelect?.(suggestion);

      // Auto-search on selection
      await handleSearch(suggestion);

      // Record successful selection
      recordMetric('autocomplete_selections', 1);

    } catch (error) {
      console.error('Suggestion selection failed:', error);
    }
  }, [onChange, onSuggestionSelect, handleSearch, recordMetric]);

  // Performance monitoring for autocomplete
  const handleAutocompleteStart = useCallback(() => {
    performanceStartTime.current = performance.now();
  }, []);

  // Search history handlers
  const handleHistoryItemSelect = useCallback(async (query: string) => {
    onChange(query);
    await handleSearch(query);
    setIsHistoryPanelOpen(false);
  }, [onChange, handleSearch]);

  const handleClearHistory = useCallback(async () => {
    try {
      await clearHistory();
      setRecentSearches([]);
      setIsHistoryPanelOpen(false);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  }, [clearHistory]);

  // Get current performance metrics
  const currentMetrics = useMemo(() => {
    const metrics = getMetrics();
    return {
      autocompleteResponseTime: metrics.autocomplete_response_time || [],
      searchExecutionTime: metrics.search_execution_time || [],
      cacheHitRate: metrics.cache_hit_rate || 0,
      totalSearches: (metrics.search_execution_time || []).length
    };
  }, [getMetrics]);

  return (
    <div className={`intelligent-search-input ${className}`}>
      {/* Main search input with enhanced autocomplete */}
      <div className="search-input-container">
        <SearchAutocomplete
          value={value}
          onChange={onChange}
          onSearch={handleSearch}
          onSuggestionSelect={handleSuggestionSelect}
          placeholder={placeholder}
          autoFocus={autoFocus}
          maxSuggestions={maxSuggestions}
          recentSearches={recentSearches}
          popularSearches={popularSearches}
          enableFuzzySearch={true}
          enableSyntaxHighlighting={true}
          debounceMs={100} // Optimized for <100ms response
          onFocus={handleAutocompleteStart}
          className="enhanced-autocomplete"
        />

        {/* Quick action buttons */}
        <div className="search-actions">
          {showHistory && (
            <button
              type="button"
              className={`action-button ${isHistoryPanelOpen ? 'active' : ''}`}
              onClick={() => setIsHistoryPanelOpen(!isHistoryPanelOpen)}
              title="Search History (Ctrl+H)"
              aria-label="Toggle search history panel"
            >
              📜
            </button>
          )}

          {showMetrics && (
            <button
              type="button"
              className={`action-button ${isMetricsPanelOpen ? 'active' : ''}`}
              onClick={() => setIsMetricsPanelOpen(!isMetricsPanelOpen)}
              title="Performance Metrics (Ctrl+M)"
              aria-label="Toggle metrics panel"
            >
              📊
            </button>
          )}
        </div>
      </div>

      {/* Search History Panel */}
      {isHistoryPanelOpen && (
        <SearchHistoryPanel
          recentSearches={recentSearches}
          popularSearches={popularSearches}
          onSelect={handleHistoryItemSelect}
          onClear={handleClearHistory}
          onClose={() => setIsHistoryPanelOpen(false)}
        />
      )}

      {/* Performance Metrics Panel */}
      {isMetricsPanelOpen && (
        <SearchMetrics
          metrics={currentMetrics}
          onClose={() => setIsMetricsPanelOpen(false)}
        />
      )}

      {/* Keyboard shortcuts help */}
      {enableKeyboardShortcuts && (
        <div className="keyboard-shortcuts-hint" aria-hidden="true">
          <span>Press Ctrl+K to focus, Ctrl+H for history</span>
        </div>
      )}
    </div>
  );
};

export default IntelligentSearchInput;