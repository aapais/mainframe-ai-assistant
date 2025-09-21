/**
 * Performance-Optimized Search Results Component
 *
 * High-performance search results with:
 * - Virtual scrolling for 1000+ items
 * - Comprehensive memoization
 * - Memory leak prevention
 * - Cache integration
 * - Performance monitoring
 *
 * @author Performance Optimizer
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { SearchResult, SearchOptions } from '../../../types/services';
import { useCleanup, useMemoryLeakDetector, useWeakMapCache } from '../../utils/memoryManagement';
import { usePerformanceMonitor, measureSearchTime } from '../../utils/performanceMonitor';
import { searchCache } from '../../utils/searchCache';
import './OptimizedSearchResults.css';

// ===========================================
// Types and Interfaces
// ===========================================

export interface OptimizedSearchResultsProps {
  results: SearchResult[];
  query: string;
  isLoading: boolean;
  onEntrySelect: (result: SearchResult) => void;
  onEntryRate: (entryId: string, successful: boolean) => void;
  onSortChange: (sortBy: SearchOptions['sortBy'], sortOrder: SearchOptions['sortOrder']) => void;
  sortBy?: SearchOptions['sortBy'];
  sortOrder?: SearchOptions['sortOrder'];
  highlightQuery?: boolean;
  showExplanations?: boolean;
  showMetadata?: boolean;
  virtualThreshold?: number;
  itemHeight?: number;
  maxHeight?: string;
  enableAnalytics?: boolean;
}

// ===========================================
// Performance Constants
// ===========================================

const PERFORMANCE_CONFIG = {
  VIRTUAL_THRESHOLD: 50,
  ITEM_HEIGHT: 120,
  MAX_HEIGHT: '600px',
  OVERSCAN_COUNT: 5,
  DEBOUNCE_DELAY: 100,
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
} as const;

// ===========================================
// Optimized Search Result Item
// ===========================================

interface SearchResultItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    results: SearchResult[];
    query: string;
    onSelect: (result: SearchResult) => void;
    onRate: (entryId: string, successful: boolean) => void;
    highlightQuery: boolean;
    showExplanation: boolean;
    showMetadata: boolean;
    cache: ReturnType<typeof useWeakMapCache>;
  };
}

const SearchResultItem = memo<SearchResultItemProps>(({ index, style, data }) => {
  const {
    results,
    query,
    onSelect,
    onRate,
    highlightQuery,
    showExplanation,
    showMetadata,
    cache,
  } = data;

  const result = results[index];
  const { entry, score, matchType, highlights, explanation, metadata } = result;

  // Performance: Cache expensive calculations
  const cachedData = useMemo(() => {
    const cacheKey = `${entry.id}-${query}`;
    let cached = cache.get(result as any);

    if (!cached) {
      // Calculate success rate
      const total = entry.success_count + entry.failure_count;
      const successRate = total > 0 ? (entry.success_count / total) * 100 : 0;

      // Process highlights for display
      const processedHighlights = highlightQuery && highlights
        ? highlights.reduce((acc, highlight) => {
            if (!acc[highlight.field]) acc[highlight.field] = [];
            acc[highlight.field].push(highlight);
            return acc;
          }, {} as Record<string, typeof highlights>)
        : {};

      // Truncate content for preview
      const truncatedProblem = entry.problem.length > 200
        ? entry.problem.substring(0, 200) + '...'
        : entry.problem;

      cached = {
        successRate,
        processedHighlights,
        truncatedProblem,
        visibleTags: entry.tags.slice(0, 5),
        remainingTagsCount: Math.max(0, entry.tags.length - 5),
      };

      cache.set(result as any, cached);
    }

    return cached;
  }, [result, query, cache, highlightQuery, highlights, entry]);

  // Performance: Stable event handlers
  const handleSelect = useCallback(() => {
    onSelect(result);
  }, [onSelect, result]);

  const handleRate = useCallback((successful: boolean) => {
    onRate(entry.id, successful);
  }, [onRate, entry.id]);

  // Performance: Memoized badge component
  const MatchBadge = useMemo(() => {
    const badges = {
      exact: { icon: '🎯', label: 'Exact', color: '#16a34a' },
      fuzzy: { icon: '🔍', label: 'Fuzzy', color: '#2563eb' },
      semantic: { icon: '🧠', label: 'AI', color: '#7c3aed' },
      ai: { icon: '🤖', label: 'AI', color: '#7c3aed' },
      category: { icon: '📁', label: 'Category', color: '#ea580c' },
      tag: { icon: '🏷️', label: 'Tag', color: '#059669' },
    };

    const badge = badges[matchType] || { icon: '❓', label: 'Unknown', color: '#6b7280' };

    return (
      <span
        className="match-badge"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: '500',
          backgroundColor: badge.color + '15',
          color: badge.color,
        }}
      >
        <span role="img" aria-label={badge.label}>{badge.icon}</span>
        {badge.label}
      </span>
    );
  }, [matchType]);

  return (
    <div style={style} className="optimized-search-result-item">
      <article
        className="search-result-card"
        onClick={handleSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSelect();
          }
        }}
        style={{
          padding: '16px',
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 150ms ease-in-out',
          marginBottom: '8px',
        }}
      >
        {/* Header */}
        <header className="result-header" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="result-rank" style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>
                #{index + 1}
              </span>
              {MatchBadge}
              <span className="category-badge" style={{
                padding: '2px 6px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: '500',
              }}>
                {entry.category}
              </span>
            </div>
            <div className="score-indicator" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <div
                className="score-bar"
                style={{
                  width: '60px',
                  height: '4px',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, score)}%`,
                    height: '100%',
                    backgroundColor: score > 80 ? '#16a34a' : score > 60 ? '#f59e0b' : '#ef4444',
                    transition: 'width 150ms ease-in-out',
                  }}
                />
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#374151' }}>
                {Math.round(score)}%
              </span>
            </div>
          </div>
        </header>

        {/* Title */}
        <h3 className="result-title" style={{
          fontSize: '1rem',
          fontWeight: '600',
          color: '#111827',
          marginBottom: '8px',
          lineHeight: '1.4',
        }}>
          {entry.title}
        </h3>

        {/* Problem Preview */}
        <p className="result-preview" style={{
          fontSize: '0.875rem',
          color: '#4b5563',
          lineHeight: '1.5',
          marginBottom: '12px',
        }}>
          {cachedData.truncatedProblem}
        </p>

        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className="result-tags" style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            marginBottom: '12px',
          }}>
            {cachedData.visibleTags.map((tag, tagIndex) => (
              <span
                key={tag}
                className="tag"
                style={{
                  padding: '2px 6px',
                  backgroundColor: '#e0e7ff',
                  color: '#3730a3',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                }}
              >
                {tag}
              </span>
            ))}
            {cachedData.remainingTagsCount > 0 && (
              <span
                className="tag-more"
                style={{
                  padding: '2px 6px',
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                }}
              >
                +{cachedData.remainingTagsCount}
              </span>
            )}
          </div>
        )}

        {/* Stats */}
        <footer className="result-stats" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: '#6b7280',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span title="Views">👀 {entry.usage_count}</span>
            {cachedData.successRate > 0 && (
              <span title="Success rate">✅ {Math.round(cachedData.successRate)}%</span>
            )}
            <span title="Created">{new Date(entry.created_at).toLocaleDateString()}</span>
          </div>
          <div className="quick-actions" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRate(true);
              }}
              className="quick-action-btn"
              style={{
                padding: '4px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
              title="Mark as helpful"
              aria-label="Mark as helpful"
            >
              👍
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRate(false);
              }}
              className="quick-action-btn"
              style={{
                padding: '4px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
              title="Mark as not helpful"
              aria-label="Mark as not helpful"
            >
              👎
            </button>
          </div>
        </footer>
      </article>
    </div>
  );
});

SearchResultItem.displayName = 'SearchResultItem';

// ===========================================
// Optimized Sort Controls
// ===========================================

interface SortControlsProps {
  sortBy: SearchOptions['sortBy'];
  sortOrder: SearchOptions['sortOrder'];
  onSortChange: (sortBy: SearchOptions['sortBy'], sortOrder: SearchOptions['sortOrder']) => void;
  resultCount: number;
}

const SortControls = memo<SortControlsProps>(({ sortBy, sortOrder, onSortChange, resultCount }) => {
  const sortOptions = useMemo(() => [
    { value: 'relevance', label: 'Relevance', icon: '🎯' },
    { value: 'usage', label: 'Most Used', icon: '👀' },
    { value: 'recent', label: 'Recent', icon: '📅' },
    { value: 'success_rate', label: 'Success Rate', icon: '✅' },
  ], []);

  const handleSortChange = useCallback((newSortBy: SearchOptions['sortBy']) => {
    const newSortOrder = sortBy === newSortBy && sortOrder === 'desc' ? 'asc' : 'desc';
    onSortChange(newSortBy, newSortOrder);
  }, [sortBy, sortOrder, onSortChange]);

  return (
    <div className="sort-controls" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 0',
      borderBottom: '1px solid #e5e7eb',
      marginBottom: '16px',
    }}>
      <span style={{ fontSize: '0.875rem', color: '#4b5563', fontWeight: '500' }}>
        {resultCount} results
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Sort by:</span>
        {sortOptions.map(option => (
          <button
            key={option.value}
            onClick={() => handleSortChange(option.value as SearchOptions['sortBy'])}
            className={`sort-btn ${sortBy === option.value ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              border: `1px solid ${sortBy === option.value ? '#7c3aed' : '#d1d5db'}`,
              backgroundColor: sortBy === option.value ? '#f3e8ff' : 'white',
              color: sortBy === option.value ? '#7c3aed' : '#374151',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 150ms ease-in-out',
            }}
          >
            <span>{option.icon}</span>
            <span>{option.label}</span>
            {sortBy === option.value && (
              <span style={{ fontSize: '0.75rem' }}>
                {sortOrder === 'desc' ? '↓' : '↑'}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
});

SortControls.displayName = 'SortControls';

// ===========================================
// Main Optimized Search Results Component
// ===========================================

export const OptimizedSearchResults = memo<OptimizedSearchResultsProps>(({
  results,
  query,
  isLoading,
  onEntrySelect,
  onEntryRate,
  onSortChange,
  sortBy = 'relevance',
  sortOrder = 'desc',
  highlightQuery = true,
  showExplanations = false,
  showMetadata = false,
  virtualThreshold = PERFORMANCE_CONFIG.VIRTUAL_THRESHOLD,
  itemHeight = PERFORMANCE_CONFIG.ITEM_HEIGHT,
  maxHeight = PERFORMANCE_CONFIG.MAX_HEIGHT,
  enableAnalytics = true,
}) => {
  // Performance utilities
  const cleanup = useCleanup();
  const cache = useWeakMapCache<SearchResult, any>();
  const { detectLeaks } = useMemoryLeakDetector();
  const performanceMonitor = usePerformanceMonitor();

  // Local state
  const [renderStartTime, setRenderStartTime] = useState<number>(0);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<List>(null);

  // Performance: Determine if virtual scrolling should be used
  const shouldVirtualize = useMemo(() => {
    return results.length >= virtualThreshold;
  }, [results.length, virtualThreshold]);

  // Performance: Memoized data for virtual list
  const virtualListData = useMemo(() => ({
    results,
    query,
    onSelect: onEntrySelect,
    onRate: onEntryRate,
    highlightQuery,
    showExplanation: showExplanations,
    showMetadata,
    cache,
  }), [results, query, onEntrySelect, onEntryRate, highlightQuery, showExplanations, showMetadata, cache]);

  // Performance: Measure render time
  useEffect(() => {
    if (renderStartTime > 0) {
      const renderTime = performance.now() - renderStartTime;
      performanceMonitor.recordRenderTime(renderTime);
      performanceMonitor.recordComponentRender('OptimizedSearchResults', renderTime);
    }
  });

  useEffect(() => {
    setRenderStartTime(performance.now());
  }, [results]);

  // Performance: Monitor memory leaks
  useEffect(() => {
    if (enableAnalytics) {
      const interval = cleanup.setInterval(() => {
        const leakDetection = detectLeaks();
        if (leakDetection.hasLeak) {
          console.warn('Memory leak detected in OptimizedSearchResults:', leakDetection);
        }
      }, 10000);

      return () => cleanup.clearInterval(interval);
    }
  }, [enableAnalytics, detectLeaks, cleanup]);

  // Performance: Scroll to top when results change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(0);
    }
  }, [results]);

  // Handle loading state
  if (isLoading) {
    return (
      <div className="optimized-search-results loading" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        textAlign: 'center',
      }}>
        <div>
          <div className="loading-spinner" style={{
            width: '32px',
            height: '32px',
            border: '3px solid #f3f4f6',
            borderTopColor: '#7c3aed',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            Searching knowledge base...
          </p>
        </div>
      </div>
    );
  }

  // Handle empty results
  if (results.length === 0) {
    return (
      <div className="optimized-search-results empty" style={{
        padding: '48px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
          No results found
        </h3>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '24px' }}>
          Try adjusting your search terms or filters
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="optimized-search-results"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Sort Controls */}
      <SortControls
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={onSortChange}
        resultCount={results.length}
      />

      {/* Results List */}
      <div className="results-container" style={{ height: maxHeight }}>
        {shouldVirtualize ? (
          <List
            ref={listRef}
            height={parseInt(maxHeight.replace('px', '')) || 600}
            itemCount={results.length}
            itemSize={itemHeight}
            itemData={virtualListData}
            overscanCount={PERFORMANCE_CONFIG.OVERSCAN_COUNT}
            style={{ scrollbarWidth: 'thin' }}
          >
            {SearchResultItem}
          </List>
        ) : (
          <div className="standard-results" style={{ height: '100%', overflowY: 'auto' }}>
            {results.map((result, index) => (
              <SearchResultItem
                key={result.entry.id}
                index={index}
                style={{ marginBottom: '8px' }}
                data={virtualListData}
              />
            ))}
          </div>
        )}
      </div>

      {/* Performance Info (Development only) */}
      {process.env.NODE_ENV === 'development' && enableAnalytics && (
        <div className="performance-debug" style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          padding: '8px 12px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          zIndex: 1000,
        }}>
          <div>Results: {results.length}</div>
          <div>Virtual: {shouldVirtualize ? 'Yes' : 'No'}</div>
          <div>Cache hit rate: {Math.round(cache.getStats().hitRate)}%</div>
        </div>
      )}
    </div>
  );
});

OptimizedSearchResults.displayName = 'OptimizedSearchResults';

export default OptimizedSearchResults;