/**
 * Search Result Navigation Component
 *
 * Advanced navigation system for search results with context-aware
 * features, result clustering, and intelligent navigation patterns.
 *
 * Features:
 * - Contextual result grouping and clustering
 * - Previous/Next navigation with keyboard shortcuts
 * - Result jump-to functionality with mini-map
 * - Search refinement suggestions
 * - Result type filtering and sorting
 * - Breadcrumb trail for search context
 * - Related searches and suggestions
 * - Bookmark/save result functionality
 *
 * @author Swarm Navigation Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useRef, memo } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  BookmarkIcon,
  ShareIcon,
  FunnelIcon,
  ArrowPathIcon
} from '../icons/NavigationIcons';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import './SearchResultNavigation.css';

// ========================
// TYPES & INTERFACES
// ========================

export interface SearchResult {
  id: string;
  type: 'entry' | 'category' | 'tag' | 'related';
  title: string;
  snippet: string;
  category: string;
  tags: string[];
  score: number;
  matchType: 'exact' | 'fuzzy' | 'semantic';
  metadata: {
    created: Date;
    lastModified: Date;
    accessCount: number;
    popularity: number;
    source?: string;
  };
  highlights?: {
    title?: string[];
    content?: string[];
    tags?: string[];
  };
}

export interface SearchContext {
  query: string;
  totalResults: number;
  currentPage: number;
  resultsPerPage: number;
  filters: Record<string, any>;
  sortBy: string;
  searchTime: number;
  suggestions?: string[];
  refinements?: string[];
}

export interface ResultCluster {
  id: string;
  label: string;
  count: number;
  results: SearchResult[];
  score: number;
  type: 'category' | 'topic' | 'time' | 'similarity';
}

export interface SearchResultNavigationProps {
  className?: string;
  /** Current search results */
  results: SearchResult[];
  /** Search context information */
  context: SearchContext;
  /** Currently selected result index */
  selectedIndex?: number;
  /** Result clusters for grouped navigation */
  clusters?: ResultCluster[];
  /** Enable result clustering */
  enableClustering?: boolean;
  /** Enable mini-map navigation */
  enableMiniMap?: boolean;
  /** Show navigation controls */
  showControls?: boolean;
  /** Show result metadata */
  showMetadata?: boolean;
  /** Enable keyboard shortcuts */
  enableKeyboard?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Event handlers */
  onResultSelect?: (result: SearchResult, index: number) => void;
  onNextResult?: () => void;
  onPreviousResult?: () => void;
  onJumpToResult?: (index: number) => void;
  onClusterSelect?: (cluster: ResultCluster) => void;
  onRefineSearch?: (refinement: string) => void;
  onBookmarkResult?: (result: SearchResult) => void;
  onShareResult?: (result: SearchResult) => void;
  onSortChange?: (sortBy: string) => void;
  onFilterChange?: (filters: Record<string, any>) => void;
  /** Accessibility */
  ariaLabel?: string;
  announceNavigation?: boolean;
}

// ========================
// RESULT MINI-MAP COMPONENT
// ========================

interface ResultMiniMapProps {
  results: SearchResult[];
  selectedIndex: number;
  clusters?: ResultCluster[];
  onJumpTo: (index: number) => void;
}

const ResultMiniMap = memo<ResultMiniMapProps>(({
  results,
  selectedIndex,
  clusters,
  onJumpTo
}) => {
  const mapRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback((event: React.MouseEvent) => {
    if (!mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const clickY = event.clientY - rect.top;
    const mapHeight = rect.height;
    const resultIndex = Math.floor((clickY / mapHeight) * results.length);

    onJumpTo(Math.min(Math.max(0, resultIndex), results.length - 1));
  }, [results.length, onJumpTo]);

  const getResultColor = (result: SearchResult, index: number) => {
    if (index === selectedIndex) return '#3B82F6'; // blue-500

    switch (result.matchType) {
      case 'exact':
        return '#10B981'; // emerald-500
      case 'semantic':
        return '#F59E0B'; // amber-500
      default:
        return '#6B7280'; // gray-500
    }
  };

  const getClusterPositions = () => {
    if (!clusters) return [];

    return clusters.map(cluster => {
      const firstResult = results.findIndex(r => cluster.results.includes(r));
      const lastResult = results.length - 1 - [...results].reverse().findIndex(r => cluster.results.includes(r));

      return {
        ...cluster,
        start: (firstResult / results.length) * 100,
        height: ((lastResult - firstResult + 1) / results.length) * 100
      };
    });
  };

  return (
    <div
      ref={mapRef}
      className="result-mini-map"
      onClick={handleClick}
      role="slider"
      aria-label="Result position"
      aria-valuemin={0}
      aria-valuemax={results.length - 1}
      aria-valuenow={selectedIndex}
    >
      {/* Cluster Indicators */}
      {clusters && getClusterPositions().map(cluster => (
        <div
          key={cluster.id}
          className="cluster-indicator"
          style={{
            top: `${cluster.start}%`,
            height: `${cluster.height}%`
          }}
          title={`${cluster.label} (${cluster.count} results)`}
        />
      ))}

      {/* Result Dots */}
      {results.map((result, index) => (
        <div
          key={result.id}
          className={`result-dot ${index === selectedIndex ? 'selected' : ''}`}
          style={{
            top: `${(index / results.length) * 100}%`,
            backgroundColor: getResultColor(result, index)
          }}
          title={`${index + 1}. ${result.title}`}
        />
      ))}

      {/* Current Position Indicator */}
      <div
        className="position-indicator"
        style={{ top: `${(selectedIndex / results.length) * 100}%` }}
      />
    </div>
  );
});

ResultMiniMap.displayName = 'ResultMiniMap';

// ========================
// SEARCH REFINEMENT COMPONENT
// ========================

interface SearchRefinementProps {
  context: SearchContext;
  onRefine: (refinement: string) => void;
  onFilter: (filters: Record<string, any>) => void;
  onSort: (sortBy: string) => void;
}

const SearchRefinement = memo<SearchRefinementProps>(({
  context,
  onRefine,
  onFilter,
  onSort
}) => {
  const [showFilters, setShowFilters] = useState(false);

  const sortOptions = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'date', label: 'Date Modified' },
    { value: 'popularity', label: 'Popularity' },
    { value: 'alphabetical', label: 'Alphabetical' }
  ];

  return (
    <div className="search-refinement">
      {/* Quick Refinements */}
      {context.refinements && context.refinements.length > 0 && (
        <div className="refinement-suggestions">
          <span className="refinement-label">Refine:</span>
          <div className="refinement-chips">
            {context.refinements.map(refinement => (
              <button
                key={refinement}
                type="button"
                className="refinement-chip"
                onClick={() => onRefine(refinement)}
              >
                {refinement}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sort and Filter Controls */}
      <div className="search-controls">
        <select
          value={context.sortBy}
          onChange={(e) => onSort(e.target.value)}
          className="sort-select"
          aria-label="Sort results"
        >
          {sortOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={`filter-toggle ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
        >
          <FunnelIcon className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="filter-panel">
          {/* Add filter controls here */}
          <p className="text-sm text-gray-500">Filter controls would go here</p>
        </div>
      )}
    </div>
  );
});

SearchRefinement.displayName = 'SearchRefinement';

// ========================
// RESULT CLUSTERS COMPONENT
// ========================

interface ResultClustersProps {
  clusters: ResultCluster[];
  selectedCluster?: string;
  onClusterSelect: (cluster: ResultCluster) => void;
}

const ResultClusters = memo<ResultClustersProps>(({
  clusters,
  selectedCluster,
  onClusterSelect
}) => {
  if (clusters.length === 0) return null;

  return (
    <div className="result-clusters">
      <h4 className="clusters-title">Result Groups</h4>
      <div className="cluster-list">
        {clusters.map(cluster => (
          <button
            key={cluster.id}
            type="button"
            className={`cluster-item ${selectedCluster === cluster.id ? 'selected' : ''}`}
            onClick={() => onClusterSelect(cluster)}
          >
            <div className="cluster-info">
              <span className="cluster-label">{cluster.label}</span>
              <span className="cluster-count">({cluster.count})</span>
            </div>
            <div className="cluster-type">{cluster.type}</div>
          </button>
        ))}
      </div>
    </div>
  );
});

ResultClusters.displayName = 'ResultClusters';

// ========================
// MAIN COMPONENT
// ========================

export const SearchResultNavigation: React.FC<SearchResultNavigationProps> = memo(({
  className = '',
  results = [],
  context,
  selectedIndex = 0,
  clusters = [],
  enableClustering = true,
  enableMiniMap = true,
  showControls = true,
  showMetadata = true,
  enableKeyboard = true,
  loading = false,
  onResultSelect,
  onNextResult,
  onPreviousResult,
  onJumpToResult,
  onClusterSelect,
  onRefineSearch,
  onBookmarkResult,
  onShareResult,
  onSortChange,
  onFilterChange,
  ariaLabel = 'Search result navigation',
  announceNavigation = true
}) => {
  const [selectedCluster, setSelectedCluster] = useState<string>();
  const navigationRef = useRef<HTMLDivElement>(null);

  // Ensure selectedIndex is within bounds
  const safeSelectedIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, results.length - 1));
  const currentResult = results[safeSelectedIndex];

  // Keyboard navigation
  const { handleKeyDown } = useKeyboardNavigation({
    itemCount: results.length,
    orientation: 'vertical',
    onMove: (direction) => {
      if (direction === 'up' && safeSelectedIndex > 0) {
        onPreviousResult?.();
      } else if (direction === 'down' && safeSelectedIndex < results.length - 1) {
        onNextResult?.();
      }
    }
  });

  // Navigation handlers
  const handlePrevious = useCallback(() => {
    if (safeSelectedIndex > 0) {
      const newIndex = safeSelectedIndex - 1;
      onJumpToResult?.(newIndex);
      onPreviousResult?.();

      if (announceNavigation) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = `Result ${newIndex + 1} of ${results.length}: ${results[newIndex].title}`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
      }
    }
  }, [safeSelectedIndex, results, onJumpToResult, onPreviousResult, announceNavigation]);

  const handleNext = useCallback(() => {
    if (safeSelectedIndex < results.length - 1) {
      const newIndex = safeSelectedIndex + 1;
      onJumpToResult?.(newIndex);
      onNextResult?.();

      if (announceNavigation) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = `Result ${newIndex + 1} of ${results.length}: ${results[newIndex].title}`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
      }
    }
  }, [safeSelectedIndex, results.length, results, onJumpToResult, onNextResult, announceNavigation]);

  const handleJumpTo = useCallback((index: number) => {
    const safeIndex = Math.min(Math.max(0, index), results.length - 1);
    onJumpToResult?.(safeIndex);

    if (results[safeIndex]) {
      onResultSelect?.(results[safeIndex], safeIndex);
    }
  }, [results, onJumpToResult, onResultSelect]);

  const handleClusterSelect = useCallback((cluster: ResultCluster) => {
    setSelectedCluster(cluster.id);
    onClusterSelect?.(cluster);

    // Jump to first result in cluster
    const firstResultIndex = results.findIndex(r => cluster.results.includes(r));
    if (firstResultIndex !== -1) {
      handleJumpTo(firstResultIndex);
    }
  }, [results, onClusterSelect, handleJumpTo]);

  // Result actions
  const handleBookmark = useCallback(() => {
    if (currentResult) {
      onBookmarkResult?.(currentResult);
    }
  }, [currentResult, onBookmarkResult]);

  const handleShare = useCallback(() => {
    if (currentResult) {
      onShareResult?.(currentResult);
    }
  }, [currentResult, onShareResult]);

  // Keyboard event handler
  React.useEffect(() => {
    if (!enableKeyboard) return;

    const keyboardHandler = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          handlePrevious();
          break;
        case 'ArrowDown':
          event.preventDefault();
          handleNext();
          break;
        case 'Home':
          event.preventDefault();
          handleJumpTo(0);
          break;
        case 'End':
          event.preventDefault();
          handleJumpTo(results.length - 1);
          break;
        case 'b':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleBookmark();
          }
          break;
        case 's':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleShare();
          }
          break;
      }
    };

    document.addEventListener('keydown', keyboardHandler);
    return () => document.removeEventListener('keydown', keyboardHandler);
  }, [enableKeyboard, handlePrevious, handleNext, handleJumpTo, results.length, handleBookmark, handleShare]);

  // Loading state
  if (loading) {
    return (
      <div className={`search-result-navigation loading ${className}`}>
        <div className="navigation-skeleton">
          <div className="skeleton-controls" />
          <div className="skeleton-minimap" />
          <div className="skeleton-clusters" />
        </div>
      </div>
    );
  }

  // Empty results
  if (results.length === 0) {
    return (
      <div className={`search-result-navigation empty ${className}`}>
        <div className="empty-state">
          <MagnifyingGlassIcon className="w-12 h-12 text-gray-300" />
          <p>No results to navigate</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={navigationRef}
      className={`search-result-navigation ${className}`}
      role="region"
      aria-label={ariaLabel}
      onKeyDown={enableKeyboard ? handleKeyDown : undefined}
      tabIndex={enableKeyboard ? 0 : undefined}
    >
      {/* Search Context */}
      <div className="search-context">
        <div className="context-info">
          <span className="result-position">
            {safeSelectedIndex + 1} of {results.length}
          </span>
          <span className="search-time">
            ({context.searchTime.toFixed(2)}s)
          </span>
        </div>

        {currentResult && (
          <div className="current-result-info">
            <span className="result-type">{currentResult.type}</span>
            <span className="match-type">{currentResult.matchType}</span>
            <span className="result-score">{(currentResult.score * 100).toFixed(0)}%</span>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      {showControls && (
        <div className="navigation-controls">
          <button
            type="button"
            className="nav-btn prev-btn"
            onClick={handlePrevious}
            disabled={safeSelectedIndex === 0}
            aria-label="Previous result"
            title="Previous result (↑)"
          >
            <ChevronUpIcon className="w-4 h-4" />
          </button>

          <div className="position-display">
            <input
              type="range"
              min={0}
              max={results.length - 1}
              value={safeSelectedIndex}
              onChange={(e) => handleJumpTo(parseInt(e.target.value))}
              className="position-slider"
              aria-label="Jump to result position"
            />
          </div>

          <button
            type="button"
            className="nav-btn next-btn"
            onClick={handleNext}
            disabled={safeSelectedIndex === results.length - 1}
            aria-label="Next result"
            title="Next result (↓)"
          >
            <ChevronDownIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mini Map */}
      {enableMiniMap && results.length > 10 && (
        <ResultMiniMap
          results={results}
          selectedIndex={safeSelectedIndex}
          clusters={enableClustering ? clusters : undefined}
          onJumpTo={handleJumpTo}
        />
      )}

      {/* Result Clusters */}
      {enableClustering && clusters.length > 0 && (
        <ResultClusters
          clusters={clusters}
          selectedCluster={selectedCluster}
          onClusterSelect={handleClusterSelect}
        />
      )}

      {/* Search Refinement */}
      <SearchRefinement
        context={context}
        onRefine={onRefineSearch || (() => {})}
        onFilter={onFilterChange || (() => {})}
        onSort={onSortChange || (() => {})}
      />

      {/* Result Actions */}
      {currentResult && (
        <div className="result-actions">
          <button
            type="button"
            className="action-btn bookmark-btn"
            onClick={handleBookmark}
            title="Bookmark result (Ctrl+B)"
          >
            <BookmarkIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            className="action-btn share-btn"
            onClick={handleShare}
            title="Share result (Ctrl+S)"
          >
            <ShareIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metadata */}
      {showMetadata && currentResult && (
        <div className="result-metadata">
          <div className="metadata-item">
            <span className="metadata-label">Category:</span>
            <span className="metadata-value">{currentResult.category}</span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Modified:</span>
            <span className="metadata-value">
              {currentResult.metadata.lastModified.toLocaleDateString()}
            </span>
          </div>
          <div className="metadata-item">
            <span className="metadata-label">Accessed:</span>
            <span className="metadata-value">{currentResult.metadata.accessCount} times</span>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      {enableKeyboard && (
        <div className="keyboard-shortcuts">
          <p className="shortcuts-hint">
            Use ↑/↓ to navigate, Ctrl+B to bookmark, Ctrl+S to share
          </p>
        </div>
      )}

      {/* Screen Reader Announcements */}
      <div className="sr-only" aria-live="polite">
        {currentResult && `Currently viewing result ${safeSelectedIndex + 1}: ${currentResult.title}`}
      </div>
    </div>
  );
});

SearchResultNavigation.displayName = 'SearchResultNavigation';

export default SearchResultNavigation;