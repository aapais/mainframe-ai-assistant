import React, { useState, useCallback, useMemo, memo } from 'react';
import { SearchResult, SearchOptions, KBEntry } from '../../../types/services';
import { formatDate, formatRelativeTime, highlightText } from '../../utils/formatters';
import { VirtualList, FixedSizeList } from '../ui/VirtualList';
import SearchResultCard from './SearchResultCard';
import BulkOperations from './BulkOperations';
import ContextualAddButton from './ContextualAddButton';
import { useContextualCRUD } from '../../hooks/useContextualCRUD';
import './SearchResults.css';

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
  enableBulkOperations?: boolean;
  enableInlineEditing?: boolean;
  enableContextualAdd?: boolean;
  contextualData?: {
    category?: string;
    tags?: string[];
    severity?: string;
    suggestedTitle?: string;
    suggestedProblem?: string;
  };
  onResultsUpdate?: (results: SearchResult[]) => void;
  onAddEntry?: (contextualData?: any) => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

interface ResultItemProps {
  result: SearchResult;
  query: string;
  onSelect: (result: SearchResult) => void;
  onRate: (entryId: string, successful: boolean) => void;
  highlightQuery: boolean;
  showExplanation: boolean;
  showMetadata: boolean;
  index: number;
}

/**
 * Individual Search Result Item Component
 */
const SearchResultItem = memo<ResultItemProps>(({
  result,
  query,
  onSelect,
  onRate,
  highlightQuery,
  showExplanation,
  showMetadata,
  index
}) => {
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState<'success' | 'failure' | null>(null);

  const { entry, score, matchType, highlights, explanation, metadata } = result;

  // Calculate success rate
  const successRate = useMemo(() => {
    const total = entry.success_count + entry.failure_count;
    return total > 0 ? (entry.success_count / total) * 100 : 0;
  }, [entry.success_count, entry.failure_count]);

  // Handle rating
  const handleRate = useCallback((successful: boolean) => {
    setRating(successful ? 'success' : 'failure');
    onRate(entry.id, successful);
  }, [entry.id, onRate]);

  // Toggle expanded view
  const toggleExpanded = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded]);

  // Get match type badge
  const getMatchTypeBadge = (type: string) => {
    const badges = {
      exact: { icon: '🎯', label: 'Exact Match', className: 'exact' },
      fuzzy: { icon: '🔍', label: 'Fuzzy Match', className: 'fuzzy' },
      semantic: { icon: '🧠', label: 'AI Semantic', className: 'semantic' },
      ai: { icon: '🤖', label: 'AI Enhanced', className: 'ai' },
      category: { icon: '📁', label: 'Category', className: 'category' },
      tag: { icon: '🏷️', label: 'Tag Match', className: 'tag' }
    };
    return badges[type] || { icon: '❓', label: 'Unknown', className: 'unknown' };
  };

  const matchBadge = getMatchTypeBadge(matchType);

  // Format highlights
  const getHighlightedText = (text: string, field: string) => {
    if (!highlightQuery || !highlights) return text;
    
    const fieldHighlights = highlights.filter(h => h.field === field);
    if (fieldHighlights.length === 0) return text;

    let highlightedText = text;
    // Sort highlights by position (descending) to avoid index shifting
    fieldHighlights
      .sort((a, b) => b.start - a.start)
      .forEach(highlight => {
        const before = highlightedText.substring(0, highlight.start);
        const match = highlightedText.substring(highlight.start, highlight.end);
        const after = highlightedText.substring(highlight.end);
        highlightedText = `${before}<mark class="search-highlight">${match}</mark>${after}`;
      });

    return highlightedText;
  };

  return (
    <div className={`search-result-item ${expanded ? 'expanded' : ''}`} role="article">
      <div className="search-result-item__header" onClick={() => onSelect(result)}>
        <div className="search-result-item__rank">
          #{index + 1}
        </div>
        
        <div className="search-result-item__main">
          <div className="search-result-item__title-row">
            <h3 
              className="search-result-item__title"
              dangerouslySetInnerHTML={{ 
                __html: getHighlightedText(entry.title, 'title') 
              }}
            />
            
            <div className="search-result-item__badges">
              <span className={`match-badge match-badge--${matchBadge.className}`}>
                <span className="match-badge__icon">{matchBadge.icon}</span>
                <span className="match-badge__label">{matchBadge.label}</span>
              </span>
              
              <span className="category-badge">
                {entry.category}
              </span>
            </div>
          </div>

          <div className="search-result-item__meta">
            <div className="search-result-item__score">
              <div className="score-bar">
                <div 
                  className="score-bar__fill" 
                  style={{ width: `${Math.min(100, score)}%` }}
                />
              </div>
              <span className="score-text">{Math.round(score)}%</span>
            </div>

            <div className="search-result-item__stats">
              <span className="stat">
                <span className="stat__icon">👀</span>
                <span className="stat__value">{entry.usage_count}</span>
                <span className="stat__label">views</span>
              </span>
              
              {(entry.success_count + entry.failure_count) > 0 && (
                <span className="stat">
                  <span className="stat__icon">✅</span>
                  <span className="stat__value">{Math.round(successRate)}%</span>
                  <span className="stat__label">success</span>
                </span>
              )}
              
              <span className="stat">
                <span className="stat__icon">📅</span>
                <span className="stat__value">{formatRelativeTime(entry.created_at)}</span>
              </span>
            </div>
          </div>

          <div className="search-result-item__preview">
            <p 
              className="search-result-item__problem"
              dangerouslySetInnerHTML={{ 
                __html: getHighlightedText(
                  entry.problem.substring(0, 200) + (entry.problem.length > 200 ? '...' : ''),
                  'problem'
                )
              }}
            />
          </div>

          {entry.tags.length > 0 && (
            <div className="search-result-item__tags">
              {entry.tags.slice(0, 5).map(tag => (
                <span key={tag} className="tag">
                  {getHighlightedText(tag, 'tags')}
                </span>
              ))}
              {entry.tags.length > 5 && (
                <span className="tag tag--more">+{entry.tags.length - 5}</span>
              )}
            </div>
          )}
        </div>

        <div className="search-result-item__actions">
          <button
            className="btn btn--icon"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded();
            }}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
            aria-expanded={expanded}
          >
            <span className={`icon ${expanded ? 'icon--expanded' : ''}`}>▼</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="search-result-item__details">
          <div className="search-result-item__content">
            <div className="content-section">
              <h4 className="content-section__title">Problem Description</h4>
              <div 
                className="content-section__text"
                dangerouslySetInnerHTML={{ 
                  __html: getHighlightedText(entry.problem, 'problem') 
                }}
              />
            </div>

            <div className="content-section">
              <h4 className="content-section__title">Solution</h4>
              <div 
                className="content-section__text"
                dangerouslySetInnerHTML={{ 
                  __html: getHighlightedText(entry.solution, 'solution') 
                }}
              />
            </div>

            {showExplanation && explanation && (
              <div className="content-section">
                <h4 className="content-section__title">Why This Matches</h4>
                <p className="content-section__text content-section__text--explanation">
                  {explanation}
                </p>
              </div>
            )}

            {showMetadata && metadata && (
              <div className="content-section content-section--metadata">
                <h4 className="content-section__title">Search Metadata</h4>
                <div className="metadata-grid">
                  <div className="metadata-item">
                    <span className="metadata-item__label">Processing Time:</span>
                    <span className="metadata-item__value">{metadata.processingTime.toFixed(1)}ms</span>
                  </div>
                  <div className="metadata-item">
                    <span className="metadata-item__label">Source:</span>
                    <span className="metadata-item__value">
                      {metadata.source === 'cache' && '💾 Cache'}
                      {metadata.source === 'database' && '🗄️ Database'}
                      {metadata.source === 'ai' && '🤖 AI'}
                    </span>
                  </div>
                  <div className="metadata-item">
                    <span className="metadata-item__label">Confidence:</span>
                    <span className="metadata-item__value">{Math.round(metadata.confidence * 100)}%</span>
                  </div>
                  {metadata.fallback && (
                    <div className="metadata-item">
                      <span className="metadata-item__label">Note:</span>
                      <span className="metadata-item__value">🔄 Fallback used</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="search-result-item__rating">
            <div className="rating-section">
              <h4 className="rating-section__title">Was this helpful?</h4>
              <div className="rating-buttons">
                <button
                  className={`btn btn--rating ${rating === 'success' ? 'active' : ''}`}
                  onClick={() => handleRate(true)}
                  disabled={rating !== null}
                  aria-label="Mark as helpful"
                >
                  <span className="icon">👍</span>
                  <span className="text">Yes</span>
                </button>
                <button
                  className={`btn btn--rating ${rating === 'failure' ? 'active' : ''}`}
                  onClick={() => handleRate(false)}
                  disabled={rating !== null}
                  aria-label="Mark as not helpful"
                >
                  <span className="icon">👎</span>
                  <span className="text">No</span>
                </button>
              </div>
              {rating && (
                <p className="rating-feedback">
                  Thank you for your feedback! 
                  {rating === 'success' ? ' This helps improve our search.' : ' We\'ll work to improve this result.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

SearchResultItem.displayName = 'SearchResultItem';

/**
 * Main Search Results Component
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
  enableBulkOperations = true,
  enableInlineEditing = true,
  enableContextualAdd = true,
  contextualData,
  onResultsUpdate,
  onAddEntry,
  pagination
}) => {
  // Initialize contextual CRUD operations
  const crud = useContextualCRUD({
    searchResults: results,
    contextualData: {
      query,
      ...contextualData
    },
    callbacks: {
      onResultsUpdated: onResultsUpdate,
      onEntryAdded: (entry) => console.log('Entry added:', entry),
      onEntryUpdated: (entry) => console.log('Entry updated:', entry),
      onEntryDeleted: (entryId) => console.log('Entry deleted:', entryId),
      onEntriesArchived: (entryIds, archived) => console.log('Entries archived:', entryIds, archived)
    },
    enableBulkOperations,
    enableInlineEditing
  });

  // Sort options
  const sortOptions = [
    { value: 'relevance', label: 'Relevance', icon: '🎯' },
    { value: 'usage', label: 'Most Used', icon: '👀' },
    { value: 'recent', label: 'Most Recent', icon: '📅' },
    { value: 'success_rate', label: 'Success Rate', icon: '✅' },
    { value: 'score', label: 'Match Score', icon: '📊' }
  ];

  // Handle sort change
  const handleSortChange = useCallback((newSortBy: string) => {
    const newSortOrder = sortBy === newSortBy && sortOrder === 'desc' ? 'asc' : 'desc';
    onSortChange(newSortBy as SearchOptions['sortBy'], newSortOrder);
  }, [sortBy, sortOrder, onSortChange]);

  // Handle contextual add
  const handleContextualAdd = useCallback((contextData?: any) => {
    if (onAddEntry) {
      onAddEntry(contextData);
    } else {
      crud.createEntryWithContext(contextData);
    }
  }, [onAddEntry, crud]);

  // Loading state
  if (isLoading) {
    return (
      <div className="search-results search-results--loading">
        <div className="loading-spinner">
          <div className="spinner" />
          <p>Searching knowledge base...</p>
        </div>
      </div>
    );
  }

  // No query state
  if (!query.trim()) {
    return (
      <div className="search-results search-results--empty">
        <div className="empty-state">
          <div className="empty-state__icon">🔍</div>
          <h3 className="empty-state__title">Start Your Search</h3>
          <p className="empty-state__description">
            Enter keywords, error codes, or describe your problem to find relevant solutions.
          </p>
          <div className="empty-state__suggestions">
            <p>Try searching for:</p>
            <div className="suggestion-chips">
              <span className="chip">S0C7 abend</span>
              <span className="chip">VSAM Status 35</span>
              <span className="chip">JCL error</span>
              <span className="chip">DB2 sqlcode</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No results state
  if (results.length === 0) {
    return (
      <div className="search-results search-results--no-results">
        <div className="no-results">
          <div className="no-results__icon">😔</div>
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

  return (
    <div className="search-results" role="region" aria-label="Search results">
      {/* Bulk Operations Toolbar */}
      {enableBulkOperations && crud.someSelected && (
        <BulkOperations
          selectedEntries={crud.selectedEntries}
          totalCount={results.length}
          onClearSelection={crud.clearSelection}
          onSelectAll={crud.selectAll}
          onBulkDelete={crud.bulkDelete}
          onBulkArchive={crud.bulkArchive}
          onBulkTag={crud.bulkUpdateTags}
          onBulkDuplicate={crud.bulkDuplicate}
          onBulkExport={crud.bulkExport}
          onBulkUpdateSeverity={crud.bulkUpdateSeverity}
          onBulkUpdateCategory={crud.bulkUpdateCategory}
          onRefreshResults={crud.refreshResults}
        />
      )}

      <div className="search-results__header">
        <div className="search-results__info">
          <div className="flex items-center justify-between">
            <h2 className="search-results__title">
              Found {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
            </h2>

            {/* Contextual Add Button */}
            {enableContextualAdd && query.trim() && (
              <ContextualAddButton
                query={query}
                searchResults={results}
                onAddEntry={handleContextualAdd}
                position="inline"
                showSuggestions={true}
              />
            )}
          </div>

          {results.some(r => r.metadata?.source === 'ai') && (
            <div className="search-results__ai-notice">
              <span className="icon">🤖</span>
              Some results enhanced by AI semantic search
            </div>
          )}
        </div>

        <div className="search-results__controls">
          <div className="sort-controls">
            <label className="sort-label">Sort by:</label>
            <div className="sort-buttons">
              {sortOptions.map(option => (
                <button
                  key={option.value}
                  className={`btn btn--sort ${sortBy === option.value ? 'active' : ''}`}
                  onClick={() => handleSortChange(option.value)}
                  aria-pressed={sortBy === option.value}
                >
                  <span className="icon">{option.icon}</span>
                  <span className="text">{option.label}</span>
                  {sortBy === option.value && (
                    <span className="sort-direction">
                      {sortOrder === 'desc' ? '↓' : '↑'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="search-results__list">
        {enableVirtualScrolling && results.length > 20 ? (
          <VirtualList
            items={results}
            itemHeight={(index, result) => {
              // Calculate dynamic height based on content
              const baseHeight = 180; // Base height for new SearchResultCard
              const expandedHeight = result.entry.problem.length > 200 ? 400 : 300;
              const tagsHeight = result.entry.tags.length > 5 ? 60 : 40;
              const explanationHeight = showExplanations && result.explanation ? 80 : 0;
              const metadataHeight = showMetadata && result.metadata ? 100 : 0;

              return baseHeight + tagsHeight + explanationHeight + metadataHeight;
            }}
            height={virtualScrollHeight}
            className="virtualized-search-results"
          >
            {({ item: result, index, style }) => (
              <div style={style} className="mb-4">
                <SearchResultCard
                  key={result.entry.id}
                  result={result}
                  query={query}
                  isSelected={crud.selectedIds.has(result.entry.id)}
                  showCheckbox={enableBulkOperations}
                  highlightQuery={highlightQuery}
                  showQuickActions={true}
                  showInlineEdit={enableInlineEditing}
                  onSelect={onEntrySelect}
                  onToggleSelection={crud.toggleSelection}
                  onEdit={crud.createEntryWithContext}
                  onDelete={crud.deleteEntry}
                  onDuplicate={crud.duplicateEntry}
                  onViewHistory={crud.viewEntryHistory}
                  onRate={crud.handleEntryRate}
                  onQuickUpdate={crud.updateEntryInline}
                  index={index}
                />
              </div>
            )}
          </VirtualList>
        ) : (
          <div className="standard-search-results space-y-4">
            {results.map((result, index) => (
              <SearchResultCard
                key={result.entry.id}
                result={result}
                query={query}
                isSelected={crud.selectedIds.has(result.entry.id)}
                showCheckbox={enableBulkOperations}
                highlightQuery={highlightQuery}
                showQuickActions={true}
                showInlineEdit={enableInlineEditing}
                onSelect={onEntrySelect}
                onToggleSelection={crud.toggleSelection}
                onEdit={crud.createEntryWithContext}
                onDelete={crud.deleteEntry}
                onDuplicate={crud.duplicateEntry}
                onViewHistory={crud.viewEntryHistory}
                onRate={crud.handleEntryRate}
                onQuickUpdate={crud.updateEntryInline}
                index={index}
              />
            ))}
          </div>
        )}
      </div>

      {pagination && pagination.total > pagination.pageSize && (
        <div className="search-results__pagination">
          <div className="pagination">
            <button
              className="btn btn--pagination"
              disabled={pagination.page === 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              ← Previous
            </button>

            <span className="pagination__info">
              Page {pagination.page} of {Math.ceil(pagination.total / pagination.pageSize)}
            </span>

            <button
              className="btn btn--pagination"
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Contextual Add Button - Fixed Position */}
      {enableContextualAdd && query.trim() && (
        <ContextualAddButton
          query={query}
          searchResults={results}
          onAddEntry={handleContextualAdd}
          position="fixed"
          showSuggestions={true}
        />
      )}

      {/* Notifications */}
      {crud.notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
          {crud.notifications.map(notification => (
            <div
              key={notification.id}
              className={`
                p-4 rounded-lg border shadow-lg transition-all duration-300
                ${notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                  notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                  notification.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                  'bg-blue-50 border-blue-200 text-blue-800'
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-sm font-medium">{notification.title}</h4>
                  <p className="text-sm mt-1">{notification.message}</p>
                </div>
                <button
                  onClick={() => crud.removeNotification(notification.id)}
                  className="ml-3 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

SearchResults.displayName = 'SearchResults';

export default SearchResults;