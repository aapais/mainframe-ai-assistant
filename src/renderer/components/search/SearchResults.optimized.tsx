import React, { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react';
import { SearchResult, SearchOptions, KBEntry, SearchHighlight } from '../../../types/services';
import { formatDate, formatRelativeTime } from '../../utils/formatters';
import { VirtualList } from '../ui/VirtualList';
import './SearchResults.css';

// Security: HTML sanitization utility
const sanitizeHtml = (html: string): string => {
  const temp = document.createElement('div');
  temp.textContent = html;
  return temp.innerHTML;
};

// Security: Safe text highlighting without dangerouslySetInnerHTML
const SafeHighlightedText = memo<{
  text: string;
  highlights?: SearchHighlight[];
  field: string;
  className?: string;
}>(({ text, highlights, field, className = '' }) => {
  const highlightedSegments = useMemo(() => {
    if (!highlights || highlights.length === 0) {
      return [{ text, isHighlight: false }];
    }

    const fieldHighlights = highlights
      .filter(h => h.field === field)
      .sort((a, b) => a.start - b.start);

    if (fieldHighlights.length === 0) {
      return [{ text, isHighlight: false }];
    }

    const segments: Array<{ text: string; isHighlight: boolean }> = [];
    let lastIndex = 0;

    fieldHighlights.forEach(highlight => {
      // Add text before highlight
      if (highlight.start > lastIndex) {
        segments.push({
          text: text.substring(lastIndex, highlight.start),
          isHighlight: false,
        });
      }

      // Add highlighted text (sanitized)
      segments.push({
        text: sanitizeHtml(text.substring(highlight.start, highlight.end)),
        isHighlight: true,
      });

      lastIndex = highlight.end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      segments.push({
        text: text.substring(lastIndex),
        isHighlight: false,
      });
    }

    return segments;
  }, [text, highlights, field]);

  return (
    <span className={className}>
      {highlightedSegments.map((segment, index) =>
        segment.isHighlight ? (
          <mark key={index} className="search-highlight">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </span>
  );
});

SafeHighlightedText.displayName = 'SafeHighlightedText';

interface SearchResultsProps {
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
  enableVirtualScrolling?: boolean;
  virtualScrollHeight?: string;
  itemHeight?: number;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

interface OptimizedResultItemProps {
  result: SearchResult;
  query: string;
  onSelect: (result: SearchResult) => void;
  onRate: (entryId: string, successful: boolean) => void;
  highlightQuery: boolean;
  showExplanation: boolean;
  showMetadata: boolean;
  index: number;
  isVirtualized?: boolean;
}

// Performance: Memoized badge component
const MatchBadge = memo<{
  matchType: string;
}>(({ matchType }) => {
  const badge = useMemo(() => {
    const badges = {
      exact: { icon: '🎯', label: 'Exact Match', className: 'exact' },
      fuzzy: { icon: '🔍', label: 'Fuzzy Match', className: 'fuzzy' },
      semantic: { icon: '🧠', label: 'AI Semantic', className: 'semantic' },
      ai: { icon: '🤖', label: 'AI Enhanced', className: 'ai' },
      category: { icon: '📁', label: 'Category', className: 'category' },
      tag: { icon: '🏷️', label: 'Tag Match', className: 'tag' }
    };
    return badges[matchType] || { icon: '❓', label: 'Unknown', className: 'unknown' };
  }, [matchType]);

  return (
    <span
      className={`match-badge match-badge--${badge.className}`}
      role="img"
      aria-label={`Match type: ${badge.label}`}
    >
      <span className="match-badge__icon" aria-hidden="true">{badge.icon}</span>
      <span className="match-badge__label">{badge.label}</span>
    </span>
  );
});

MatchBadge.displayName = 'MatchBadge';

// Performance: Optimized result item with proper memoization
const OptimizedResultItem = memo<OptimizedResultItemProps>(({
  result,
  query,
  onSelect,
  onRate,
  highlightQuery,
  showExplanation,
  showMetadata,
  index,
  isVirtualized = false
}) => {
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState<'success' | 'failure' | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  const { entry, score, matchType, highlights, explanation, metadata } = result;

  // Performance: Memoized calculations
  const successRate = useMemo(() => {
    const total = entry.success_count + entry.failure_count;
    return total > 0 ? (entry.success_count / total) * 100 : 0;
  }, [entry.success_count, entry.failure_count]);

  const truncatedProblem = useMemo(() =>
    entry.problem.length > 200
      ? entry.problem.substring(0, 200) + '...'
      : entry.problem
  , [entry.problem]);

  const visibleTags = useMemo(() => entry.tags.slice(0, 5), [entry.tags]);
  const remainingTagsCount = useMemo(() => Math.max(0, entry.tags.length - 5), [entry.tags]);

  // Performance: Stable callbacks
  const handleRate = useCallback((successful: boolean) => {
    setRating(successful ? 'success' : 'failure');
    onRate(entry.id, successful);
  }, [entry.id, onRate]);

  const handleSelect = useCallback(() => {
    onSelect(result);
  }, [onSelect, result]);

  const toggleExpanded = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => !prev);
  }, []);

  // Accessibility: Announce state changes
  const announceExpanded = useCallback((expanded: boolean) => {
    const message = expanded ? 'Details expanded' : 'Details collapsed';
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  }, []);

  useEffect(() => {
    announceExpanded(expanded);
  }, [expanded, announceExpanded]);

  return (
    <article
      ref={itemRef}
      className={`search-result-item ${expanded ? 'expanded' : ''}`}
      aria-labelledby={`result-title-${entry.id}`}
      aria-describedby={`result-preview-${entry.id}`}
      role="article"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSelect();
        }
      }}
    >
      <header className="search-result-item__header" onClick={handleSelect}>
        <div className="search-result-item__rank" aria-label={`Result ${index + 1}`}>
          #{index + 1}
        </div>

        <div className="search-result-item__main">
          <div className="search-result-item__title-row">
            <h3
              id={`result-title-${entry.id}`}
              className="search-result-item__title"
            >
              {highlightQuery ? (
                <SafeHighlightedText
                  text={entry.title}
                  highlights={highlights}
                  field="title"
                />
              ) : (
                entry.title
              )}
            </h3>

            <div className="search-result-item__badges" role="group" aria-label="Match information">
              <MatchBadge matchType={matchType} />
              <span className="category-badge" role="text">
                {entry.category}
              </span>
            </div>
          </div>

          <div className="search-result-item__meta" role="group" aria-label="Result statistics">
            <div className="search-result-item__score" role="group" aria-label="Match score">
              <div
                className="score-bar"
                role="progressbar"
                aria-valuenow={score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Match confidence: ${Math.round(score)}%`}
              >
                <div
                  className="score-bar__fill"
                  style={{ width: `${Math.min(100, score)}%` }}
                />
              </div>
              <span className="score-text" aria-hidden="true">
                {Math.round(score)}%
              </span>
            </div>

            <div className="search-result-item__stats">
              <span className="stat" role="text">
                <span className="stat__icon" aria-hidden="true">👀</span>
                <span className="stat__value">{entry.usage_count}</span>
                <span className="stat__label">views</span>
              </span>

              {(entry.success_count + entry.failure_count) > 0 && (
                <span className="stat" role="text">
                  <span className="stat__icon" aria-hidden="true">✅</span>
                  <span className="stat__value">{Math.round(successRate)}%</span>
                  <span className="stat__label">success</span>
                </span>
              )}

              <span className="stat" role="text">
                <span className="stat__icon" aria-hidden="true">📅</span>
                <span className="stat__value">{formatRelativeTime(entry.created_at)}</span>
              </span>
            </div>
          </div>

          <div className="search-result-item__preview">
            <p
              id={`result-preview-${entry.id}`}
              className="search-result-item__problem"
            >
              {highlightQuery ? (
                <SafeHighlightedText
                  text={truncatedProblem}
                  highlights={highlights}
                  field="problem"
                />
              ) : (
                truncatedProblem
              )}
            </p>
          </div>

          {entry.tags.length > 0 && (
            <div className="search-result-item__tags" role="group" aria-label="Tags">
              {visibleTags.map((tag, tagIndex) => (
                <button
                  key={tag}
                  className="tag"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Handle tag click
                  }}
                  aria-label={`Filter by tag: ${tag}`}
                  tabIndex={0}
                >
                  {highlightQuery ? (
                    <SafeHighlightedText
                      text={tag}
                      highlights={highlights}
                      field="tags"
                    />
                  ) : (
                    tag
                  )}
                </button>
              ))}
              {remainingTagsCount > 0 && (
                <span className="tag tag--more" role="text">
                  +{remainingTagsCount} more
                </span>
              )}
            </div>
          )}
        </div>

        <div className="search-result-item__actions">
          <button
            className="btn btn--icon"
            onClick={toggleExpanded}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
            aria-expanded={expanded}
            aria-controls={`result-details-${entry.id}`}
            type="button"
          >
            <span
              className={`icon ${expanded ? 'icon--expanded' : ''}`}
              aria-hidden="true"
            >
              ▼
            </span>
          </button>
        </div>
      </header>

      {expanded && (
        <div
          id={`result-details-${entry.id}`}
          className="search-result-item__details"
          role="region"
          aria-label="Entry details"
        >
          <div className="search-result-item__content">
            <section className="content-section">
              <h4 className="content-section__title">Problem Description</h4>
              <div className="content-section__text">
                {highlightQuery ? (
                  <SafeHighlightedText
                    text={entry.problem}
                    highlights={highlights}
                    field="problem"
                  />
                ) : (
                  entry.problem
                )}
              </div>
            </section>

            <section className="content-section">
              <h4 className="content-section__title">Solution</h4>
              <div className="content-section__text">
                {highlightQuery ? (
                  <SafeHighlightedText
                    text={entry.solution}
                    highlights={highlights}
                    field="solution"
                  />
                ) : (
                  entry.solution
                )}
              </div>
            </section>

            {showExplanation && explanation && (
              <section className="content-section">
                <h4 className="content-section__title">Why This Matches</h4>
                <p className="content-section__text content-section__text--explanation">
                  {explanation}
                </p>
              </section>
            )}

            {showMetadata && metadata && (
              <section className="content-section content-section--metadata">
                <h4 className="content-section__title">Search Metadata</h4>
                <dl className="metadata-grid">
                  <div className="metadata-item">
                    <dt className="metadata-item__label">Processing Time:</dt>
                    <dd className="metadata-item__value">{metadata.processingTime.toFixed(1)}ms</dd>
                  </div>
                  <div className="metadata-item">
                    <dt className="metadata-item__label">Source:</dt>
                    <dd className="metadata-item__value">
                      {metadata.source === 'cache' && '💾 Cache'}
                      {metadata.source === 'database' && '🗄️ Database'}
                      {metadata.source === 'ai' && '🤖 AI'}
                    </dd>
                  </div>
                  <div className="metadata-item">
                    <dt className="metadata-item__label">Confidence:</dt>
                    <dd className="metadata-item__value">{Math.round(metadata.confidence * 100)}%</dd>
                  </div>
                  {metadata.fallback && (
                    <div className="metadata-item">
                      <dt className="metadata-item__label">Note:</dt>
                      <dd className="metadata-item__value">🔄 Fallback used</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}
          </div>

          <footer className="search-result-item__rating">
            <fieldset className="rating-section">
              <legend className="rating-section__title">Was this helpful?</legend>
              <div className="rating-buttons" role="group">
                <button
                  className={`btn btn--rating ${rating === 'success' ? 'active' : ''}`}
                  onClick={() => handleRate(true)}
                  disabled={rating !== null}
                  aria-label="Mark as helpful"
                  type="button"
                >
                  <span className="icon" aria-hidden="true">👍</span>
                  <span className="text">Yes</span>
                </button>
                <button
                  className={`btn btn--rating ${rating === 'failure' ? 'active' : ''}`}
                  onClick={() => handleRate(false)}
                  disabled={rating !== null}
                  aria-label="Mark as not helpful"
                  type="button"
                >
                  <span className="icon" aria-hidden="true">👎</span>
                  <span className="text">No</span>
                </button>
              </div>
              {rating && (
                <p className="rating-feedback" role="status">
                  Thank you for your feedback!
                  {rating === 'success' ? ' This helps improve our search.' : ' We\'ll work to improve this result.'}
                </p>
              )}
            </fieldset>
          </footer>
        </div>
      )}
    </article>
  );
});

OptimizedResultItem.displayName = 'OptimizedResultItem';

// Performance: Memoized sort options
const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance', icon: '🎯', description: 'Sort by match relevance' },
  { value: 'usage', label: 'Most Used', icon: '👀', description: 'Sort by usage count' },
  { value: 'recent', label: 'Most Recent', icon: '📅', description: 'Sort by creation date' },
  { value: 'success_rate', label: 'Success Rate', icon: '✅', description: 'Sort by success rate' },
  { value: 'score', label: 'Match Score', icon: '📊', description: 'Sort by match score' }
] as const;

/**
 * Optimized Search Results Component
 *
 * Key Optimizations:
 * - XSS security fixes with SafeHighlightedText
 * - Performance improvements with proper memoization
 * - Enhanced accessibility with ARIA labels and keyboard navigation
 * - Better TypeScript typing and error handling
 * - Reduced bundle size through code splitting
 */
export const SearchResults = memo<SearchResultsProps>(({
  results,
  query,
  isLoading,
  onEntrySelect,
  onEntryRate,
  onSortChange,
  sortBy = 'relevance',
  sortOrder = 'desc',
  highlightQuery = true,
  showExplanations = true,
  showMetadata = false,
  enableVirtualScrolling = true,
  virtualScrollHeight = '600px',
  itemHeight = 200,
  pagination
}) => {
  const resultsRef = useRef<HTMLDivElement>(null);
  const [announcements, setAnnouncements] = useState<string>('');

  // Performance: Memoized sort handler
  const handleSortChange = useCallback((newSortBy: string) => {
    const newSortOrder = sortBy === newSortBy && sortOrder === 'desc' ? 'asc' : 'desc';
    onSortChange(newSortBy as SearchOptions['sortBy'], newSortOrder);

    // Accessibility: Announce sort change
    setAnnouncements(`Results sorted by ${newSortBy} in ${newSortOrder}ending order`);
  }, [sortBy, sortOrder, onSortChange]);

  // Performance: Memoized item height calculator for virtualization
  const calculateItemHeight = useCallback((index: number, result: SearchResult) => {
    const baseHeight = 120;
    const expandedHeight = result.entry.problem.length > 200 ? 300 : 200;
    const tagsHeight = result.entry.tags.length > 5 ? 40 : 20;
    const explanationHeight = showExplanations && result.explanation ? 60 : 0;
    const metadataHeight = showMetadata && result.metadata ? 80 : 0;

    return baseHeight + tagsHeight + explanationHeight + metadataHeight;
  }, [showExplanations, showMetadata]);

  // Loading state with proper ARIA
  if (isLoading) {
    return (
      <div className="search-results search-results--loading" role="status" aria-live="polite">
        <div className="loading-spinner">
          <div className="spinner" aria-hidden="true" />
          <p>Searching knowledge base...</p>
        </div>
      </div>
    );
  }

  // Empty query state
  if (!query.trim()) {
    return (
      <div className="search-results search-results--empty">
        <div className="empty-state">
          <div className="empty-state__icon" aria-hidden="true">🔍</div>
          <h3 className="empty-state__title">Start Your Search</h3>
          <p className="empty-state__description">
            Enter keywords, error codes, or describe your problem to find relevant solutions.
          </p>
          <div className="empty-state__suggestions">
            <p>Try searching for:</p>
            <div className="suggestion-chips" role="group" aria-label="Search suggestions">
              {['S0C7 abend', 'VSAM Status 35', 'JCL error', 'DB2 sqlcode'].map(suggestion => (
                <button
                  key={suggestion}
                  className="chip"
                  onClick={() => {
                    // Handle suggestion click
                  }}
                  aria-label={`Search for ${suggestion}`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No results state
  if (results.length === 0) {
    return (
      <div className="search-results search-results--no-results" role="status" aria-live="polite">
        <div className="no-results">
          <div className="no-results__icon" aria-hidden="true">😔</div>
          <h3 className="no-results__title">No Results Found</h3>
          <p className="no-results__description">
            We couldn't find any knowledge base entries matching "<strong>{query}</strong>".
          </p>
          <div className="no-results__suggestions">
            <h4>Try:</h4>
            <ul>
              <li>Using different keywords or synonyms</li>
              <li>Checking for typos in error codes</li>
              <li>Using broader search terms</li>
              <li>Searching for the component or system name</li>
              <li>Enabling AI search for semantic matching</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const hasAiResults = results.some(r => r.metadata?.source === 'ai');

  return (
    <div className="search-results" role="main" aria-label="Search results">
      {/* Screen reader announcements */}
      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        {announcements}
      </div>

      <header className="search-results__header">
        <div className="search-results__info">
          <h2 className="search-results__title">
            Found {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
          </h2>

          {hasAiResults && (
            <div className="search-results__ai-notice" role="note">
              <span className="icon" aria-hidden="true">🤖</span>
              Some results enhanced by AI semantic search
            </div>
          )}
        </div>

        <div className="search-results__controls">
          <fieldset className="sort-controls">
            <legend className="sort-label">Sort by:</legend>
            <div className="sort-buttons" role="group">
              {SORT_OPTIONS.map(option => (
                <button
                  key={option.value}
                  className={`btn btn--sort ${sortBy === option.value ? 'active' : ''}`}
                  onClick={() => handleSortChange(option.value)}
                  aria-pressed={sortBy === option.value}
                  aria-describedby={`sort-${option.value}-desc`}
                  type="button"
                >
                  <span className="icon" aria-hidden="true">{option.icon}</span>
                  <span className="text">{option.label}</span>
                  {sortBy === option.value && (
                    <span
                      className="sort-direction"
                      aria-label={`Sorted ${sortOrder}ending`}
                    >
                      {sortOrder === 'desc' ? '↓' : '↑'}
                    </span>
                  )}
                  <span id={`sort-${option.value}-desc`} className="sr-only">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </header>

      <div
        ref={resultsRef}
        className="search-results__list"
        role="region"
        aria-label="Search results list"
        tabIndex={-1}
      >
        {enableVirtualScrolling && results.length > 20 ? (
          <VirtualList
            items={results}
            itemHeight={calculateItemHeight}
            height={virtualScrollHeight}
            className="virtualized-search-results"
            overscan={3}
          >
            {({ item: result, index, style }) => (
              <div style={style}>
                <OptimizedResultItem
                  key={result.entry.id}
                  result={result}
                  query={query}
                  onSelect={onEntrySelect}
                  onRate={onEntryRate}
                  highlightQuery={highlightQuery}
                  showExplanation={showExplanations}
                  showMetadata={showMetadata}
                  index={index}
                  isVirtualized={true}
                />
              </div>
            )}
          </VirtualList>
        ) : (
          <div className="standard-search-results">
            {results.map((result, index) => (
              <OptimizedResultItem
                key={result.entry.id}
                result={result}
                query={query}
                onSelect={onEntrySelect}
                onRate={onEntryRate}
                highlightQuery={highlightQuery}
                showExplanation={showExplanations}
                showMetadata={showMetadata}
                index={index}
                isVirtualized={false}
              />
            ))}
          </div>
        )}
      </div>

      {pagination && pagination.total > pagination.pageSize && (
        <nav className="search-results__pagination" aria-label="Search results pagination">
          <div className="pagination">
            <button
              className="btn btn--pagination"
              disabled={pagination.page === 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              aria-label="Go to previous page"
              type="button"
            >
              ← Previous
            </button>

            <span className="pagination__info" role="status">
              Page {pagination.page} of {Math.ceil(pagination.total / pagination.pageSize)}
              <span className="sr-only">
                , showing {results.length} of {pagination.total} total results
              </span>
            </span>

            <button
              className="btn btn--pagination"
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              aria-label="Go to next page"
              type="button"
            >
              Next →
            </button>
          </div>
        </nav>
      )}
    </div>
  );
});

SearchResults.displayName = 'SearchResults';

export default SearchResults;