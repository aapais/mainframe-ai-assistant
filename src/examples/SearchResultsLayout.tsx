/**
 * SearchResultsLayout Example
 *
 * Responsive search results with advanced grid layouts demonstrating:
 * - Card-based results display
 * - Auto-fit/auto-fill grid patterns
 * - Virtual scrolling for performance
 * - Masonry layout for varied content
 * - Advanced filtering and sorting
 * - Intersection Observer optimizations
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ResponsiveGrid, GridItem, AutoFitGrid, MasonryGrid } from '../components/Layout/ResponsiveGrid';
import { useResponsive } from '../hooks/useResponsive';
import { useResizeObserver } from '../hooks/useResizeObserver';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { Button } from '../components/foundation/Button';

// =========================
// TYPE DEFINITIONS
// =========================

interface SearchResult {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  score: number;
  date: string;
  author: string;
  views: number;
  helpful: number;
  imageUrl?: string;
  contentLength: 'short' | 'medium' | 'long';
  priority: 'low' | 'medium' | 'high';
}

interface SearchFilters {
  categories: string[];
  dateRange: 'all' | '24h' | '7d' | '30d' | '1y';
  sortBy: 'relevance' | 'date' | 'views' | 'helpful';
  contentLength: string[];
  priority: string[];
}

interface SearchResultsLayoutProps {
  results: SearchResult[];
  isLoading?: boolean;
  layoutMode?: 'grid' | 'list' | 'masonry' | 'compact';
  showFilters?: boolean;
  onResultClick: (result: SearchResult) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

// =========================
// MOCK DATA
// =========================

const MOCK_RESULTS: SearchResult[] = [
  {
    id: '1',
    title: 'VSAM Status Codes Complete Reference',
    description: 'Comprehensive guide to all VSAM status codes, their meanings, and resolution steps. Includes common scenarios and troubleshooting workflows.',
    category: 'VSAM',
    tags: ['vsam', 'status-codes', 'reference', 'troubleshooting'],
    score: 0.95,
    date: '2025-01-15T10:30:00Z',
    author: 'system_admin',
    views: 1245,
    helpful: 89,
    contentLength: 'long',
    priority: 'high'
  },
  {
    id: '2',
    title: 'S0C7 Quick Fix',
    description: 'Fast resolution for S0C7 data exceptions in COBOL programs.',
    category: 'Batch',
    tags: ['s0c7', 'cobol', 'quick-fix'],
    score: 0.92,
    date: '2025-01-14T14:15:00Z',
    author: 'dev_team',
    views: 567,
    helpful: 78,
    contentLength: 'short',
    priority: 'high'
  },
  {
    id: '3',
    title: 'JCL Dataset Allocation Best Practices',
    description: 'Learn the best practices for dataset allocation in JCL, including space management, catalog considerations, and performance optimization techniques.',
    category: 'JCL',
    tags: ['jcl', 'dataset', 'allocation', 'best-practices', 'performance'],
    score: 0.88,
    date: '2025-01-12T09:00:00Z',
    author: 'expert_user',
    views: 892,
    helpful: 95,
    contentLength: 'medium',
    priority: 'medium'
  },
  {
    id: '4',
    title: 'DB2 Lock Contention Analysis',
    description: 'Advanced techniques for identifying and resolving DB2 lock contention issues.',
    category: 'DB2',
    tags: ['db2', 'locks', 'contention', 'performance', 'analysis'],
    score: 0.85,
    date: '2025-01-10T16:45:00Z',
    author: 'dba_expert',
    views: 434,
    helpful: 72,
    contentLength: 'long',
    priority: 'medium'
  },
  {
    id: '5',
    title: 'CICS Transaction Debugging',
    description: 'Step-by-step guide for debugging CICS transactions using CEDF.',
    category: 'CICS',
    tags: ['cics', 'debugging', 'cedf', 'transactions'],
    score: 0.83,
    date: '2025-01-08T11:20:00Z',
    author: 'cics_admin',
    views: 298,
    helpful: 65,
    contentLength: 'medium',
    priority: 'low'
  },
  {
    id: '6',
    title: 'IMS Performance Tuning',
    description: 'Comprehensive guide to IMS performance tuning and optimization.',
    category: 'IMS',
    tags: ['ims', 'performance', 'tuning', 'optimization'],
    score: 0.80,
    date: '2025-01-05T13:30:00Z',
    author: 'ims_expert',
    views: 178,
    helpful: 54,
    contentLength: 'long',
    priority: 'low'
  }
];

// =========================
// SUB-COMPONENTS
// =========================

/**
 * Search Filters Component
 * Responsive filter panel with collapsible sections
 */
const SearchFilters: React.FC<{
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  availableCategories: string[];
}> = ({ filters, onFiltersChange, availableCategories }) => {
  const { device } = useResponsive();
  const [isExpanded, setIsExpanded] = useState(!device.isMobile);

  const handleFilterChange = useCallback((key: keyof SearchFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  }, [filters, onFiltersChange]);

  const clearFilters = useCallback(() => {
    onFiltersChange({
      categories: [],
      dateRange: 'all',
      sortBy: 'relevance',
      contentLength: [],
      priority: []
    });
  }, [onFiltersChange]);

  if (device.isMobile && !isExpanded) {
    return (
      <div className="mb-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="w-full flex items-center justify-between"
        >
          <span>Show Filters</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Filters</h3>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-gray-600"
          >
            Clear All
          </Button>
          {device.isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          )}
        </div>
      </div>

      <ResponsiveGrid
        cols={{ xs: 1, sm: 2, lg: 4 }}
        gap="md"
      >
        {/* Categories */}
        <GridItem>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Categories
          </label>
          <div className="space-y-2">
            {availableCategories.map((category) => (
              <label key={category} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.categories.includes(category)}
                  onChange={(e) => {
                    const newCategories = e.target.checked
                      ? [...filters.categories, category]
                      : filters.categories.filter(c => c !== category);
                    handleFilterChange('categories', newCategories);
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">{category}</span>
              </label>
            ))}
          </div>
        </GridItem>

        {/* Date Range */}
        <GridItem>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date Range
          </label>
          <select
            value={filters.dateRange}
            onChange={(e) => handleFilterChange('dateRange', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="all">All Time</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="1y">Last Year</option>
          </select>
        </GridItem>

        {/* Sort By */}
        <GridItem>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sort By
          </label>
          <select
            value={filters.sortBy}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="relevance">Relevance</option>
            <option value="date">Date</option>
            <option value="views">Views</option>
            <option value="helpful">Helpful</option>
          </select>
        </GridItem>

        {/* Content Length */}
        <GridItem>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content Length
          </label>
          <div className="space-y-2">
            {['short', 'medium', 'long'].map((length) => (
              <label key={length} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.contentLength.includes(length)}
                  onChange={(e) => {
                    const newLengths = e.target.checked
                      ? [...filters.contentLength, length]
                      : filters.contentLength.filter(l => l !== length);
                    handleFilterChange('contentLength', newLengths);
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 capitalize">{length}</span>
              </label>
            ))}
          </div>
        </GridItem>
      </ResponsiveGrid>
    </div>
  );
};

/**
 * Result Card Component
 * Individual result card with responsive design
 */
const ResultCard: React.FC<{
  result: SearchResult;
  onClick: (result: SearchResult) => void;
  layoutMode: string;
}> = ({ result, onClick, layoutMode }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  const getCategoryColor = useCallback((category: string) => {
    const colors = {
      'VSAM': 'bg-green-100 text-green-800',
      'JCL': 'bg-blue-100 text-blue-800',
      'DB2': 'bg-purple-100 text-purple-800',
      'Batch': 'bg-orange-100 text-orange-800',
      'CICS': 'bg-pink-100 text-pink-800',
      'IMS': 'bg-indigo-100 text-indigo-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  }, []);

  const getPriorityIcon = useCallback((priority: string) => {
    switch (priority) {
      case 'high':
        return <span className="text-red-500">🔥</span>;
      case 'medium':
        return <span className="text-yellow-500">⚠️</span>;
      default:
        return <span className="text-gray-500">📝</span>;
    }
  }, []);

  if (!isVisible) {
    return (
      <div
        ref={cardRef}
        className="bg-gray-200 rounded-lg animate-pulse"
        style={{ height: layoutMode === 'compact' ? '100px' : '200px' }}
      />
    );
  }

  return (
    <div
      ref={cardRef}
      className={`bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer transform hover:-translate-y-1 ${
        layoutMode === 'list' ? 'flex items-center p-4' : 'p-6'
      }`}
      onClick={() => onClick(result)}
      data-testid={`result-card-${result.id}`}
    >
      {layoutMode === 'list' ? (
        /* List Layout */
        <ResponsiveGrid cols={{ xs: 1, sm: 4 }} gap="md" className="flex-1">
          <GridItem colSpan={2}>
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-medium text-gray-900 line-clamp-1">
                {result.title}
              </h3>
              {getPriorityIcon(result.priority)}
            </div>
            <p className="text-sm text-gray-600 line-clamp-2 mb-2">
              {result.description}
            </p>
            <div className="flex flex-wrap gap-1">
              {result.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </GridItem>

          <GridItem>
            <div className="flex flex-col items-center text-center">
              <span className={`px-3 py-1 text-sm rounded-full mb-2 ${getCategoryColor(result.category)}`}>
                {result.category}
              </span>
              <div className="text-sm text-gray-600">
                Score: {Math.round(result.score * 100)}%
              </div>
            </div>
          </GridItem>

          <GridItem>
            <div className="flex flex-col items-end text-right text-sm text-gray-600">
              <div className="mb-1">{formatDate(result.date)}</div>
              <div className="mb-1">{result.views} views</div>
              <div>{result.helpful}% helpful</div>
            </div>
          </GridItem>
        </ResponsiveGrid>
      ) : (
        /* Card Layout */
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                {getPriorityIcon(result.priority)}
                <h3 className="text-lg font-medium text-gray-900 ml-2 line-clamp-2">
                  {result.title}
                </h3>
              </div>
              <div className="flex items-center space-x-2 mb-3">
                <span className={`px-3 py-1 text-sm rounded-full ${getCategoryColor(result.category)}`}>
                  {result.category}
                </span>
                <span className="text-sm text-gray-500">
                  {Math.round(result.score * 100)}% match
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <p className={`text-gray-600 ${layoutMode === 'compact' ? 'text-sm line-clamp-2' : 'line-clamp-3'}`}>
            {result.description}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {result.tags.slice(0, layoutMode === 'compact' ? 2 : 4).map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-md"
              >
                #{tag}
              </span>
            ))}
            {result.tags.length > (layoutMode === 'compact' ? 2 : 4) && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md">
                +{result.tags.length - (layoutMode === 'compact' ? 2 : 4)}
              </span>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-sm text-gray-500 pt-3 border-t border-gray-100">
            <div className="flex items-center space-x-4">
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {result.views}
              </span>
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {result.helpful}%
              </span>
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDate(result.date)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Layout Mode Selector Component
 */
const LayoutModeSelector: React.FC<{
  currentMode: string;
  onModeChange: (mode: string) => void;
}> = ({ currentMode, onModeChange }) => {
  const modes = [
    { id: 'grid', name: 'Grid', icon: '⊞' },
    { id: 'list', name: 'List', icon: '☰' },
    { id: 'masonry', name: 'Masonry', icon: '⟐' },
    { id: 'compact', name: 'Compact', icon: '▦' }
  ];

  return (
    <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onModeChange(mode.id)}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
            currentMode === mode.id
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          data-testid={`layout-mode-${mode.id}`}
        >
          <span className="mr-1">{mode.icon}</span>
          {mode.name}
        </button>
      ))}
    </div>
  );
};

// =========================
// MAIN COMPONENT
// =========================

/**
 * SearchResultsLayout Example
 *
 * Comprehensive search results layout with multiple display modes
 */
export const SearchResultsLayout: React.FC<SearchResultsLayoutProps> = ({
  results = MOCK_RESULTS,
  isLoading = false,
  layoutMode = 'grid',
  showFilters = true,
  onResultClick,
  onLoadMore,
  hasMore = false
}) => {
  const [currentLayoutMode, setCurrentLayoutMode] = useState(layoutMode);
  const [filters, setFilters] = useState<SearchFilters>({
    categories: [],
    dateRange: 'all',
    sortBy: 'relevance',
    contentLength: [],
    priority: []
  });

  const { device, breakpoint } = useResponsive();
  const isMobileView = useMediaQuery('(max-width: 768px)');
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions = useResizeObserver(containerRef);

  // Filter results based on current filters
  const filteredResults = useMemo(() => {
    let filtered = [...results];

    // Apply category filter
    if (filters.categories.length > 0) {
      filtered = filtered.filter(result =>
        filters.categories.includes(result.category)
      );
    }

    // Apply content length filter
    if (filters.contentLength.length > 0) {
      filtered = filtered.filter(result =>
        filters.contentLength.includes(result.contentLength)
      );
    }

    // Apply priority filter
    if (filters.priority.length > 0) {
      filtered = filtered.filter(result =>
        filters.priority.includes(result.priority)
      );
    }

    // Apply sorting
    switch (filters.sortBy) {
      case 'date':
        filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        break;
      case 'views':
        filtered.sort((a, b) => b.views - a.views);
        break;
      case 'helpful':
        filtered.sort((a, b) => b.helpful - a.helpful);
        break;
      default:
        filtered.sort((a, b) => b.score - a.score);
    }

    return filtered;
  }, [results, filters]);

  // Get available categories for filter
  const availableCategories = useMemo(() => {
    return [...new Set(results.map(r => r.category))];
  }, [results]);

  // Handle result click
  const handleResultClick = useCallback((result: SearchResult) => {
    console.log('Result clicked:', result.id);
    onResultClick?.(result);
  }, [onResultClick]);

  // Get grid configuration based on layout mode and screen size
  const getGridConfig = useCallback(() => {
    switch (currentLayoutMode) {
      case 'list':
        return { cols: { xs: 1, sm: 1, md: 1, lg: 1, xl: 1 }, gap: 'sm' as const };
      case 'compact':
        return { cols: { xs: 1, sm: 2, md: 3, lg: 4, xl: 5 }, gap: 'sm' as const };
      case 'masonry':
        return { autoFit: true, minItemWidth: '300px', gap: 'md' as const };
      default: // grid
        return { cols: { xs: 1, sm: 2, md: 2, lg: 3, xl: 3 }, gap: 'md' as const };
    }
  }, [currentLayoutMode]);

  const gridConfig = getGridConfig();

  return (
    <div ref={containerRef} className="space-y-6" data-testid="search-results-layout">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Search Results
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {filteredResults.length} of {results.length} results •
            {breakpoint.toUpperCase()} breakpoint •
            Container: {dimensions?.width || 0}×{dimensions?.height || 0}px
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <LayoutModeSelector
            currentMode={currentLayoutMode}
            onModeChange={setCurrentLayoutMode}
          />
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <SearchFilters
          filters={filters}
          onFiltersChange={setFilters}
          availableCategories={availableCategories}
        />
      )}

      {/* Results Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-lg animate-pulse h-64" />
          ))}
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="text-center py-16">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.034 0-3.9.785-5.291 2.083A8.002 8.002 0 0112 21a8.002 8.002 0 015.291-2.083A7.962 7.962 0 0112 15z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No results found</h3>
          <p className="mt-2 text-sm text-gray-500">
            Try adjusting your search terms or filters
          </p>
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => setFilters({
              categories: [],
              dateRange: 'all',
              sortBy: 'relevance',
              contentLength: [],
              priority: []
            })}
          >
            Clear All Filters
          </Button>
        </div>
      ) : currentLayoutMode === 'masonry' ? (
        <MasonryGrid
          minItemWidth={gridConfig.minItemWidth}
          gap={gridConfig.gap}
          className="min-h-0"
        >
          {filteredResults.map((result) => (
            <ResultCard
              key={result.id}
              result={result}
              onClick={handleResultClick}
              layoutMode={currentLayoutMode}
            />
          ))}
        </MasonryGrid>
      ) : currentLayoutMode === 'list' ? (
        <div className="space-y-4">
          {filteredResults.map((result) => (
            <ResultCard
              key={result.id}
              result={result}
              onClick={handleResultClick}
              layoutMode={currentLayoutMode}
            />
          ))}
        </div>
      ) : (
        <ResponsiveGrid {...gridConfig} className="min-h-0">
          {filteredResults.map((result) => (
            <GridItem key={result.id}>
              <ResultCard
                result={result}
                onClick={handleResultClick}
                layoutMode={currentLayoutMode}
              />
            </GridItem>
          ))}
        </ResponsiveGrid>
      )}

      {/* Load More */}
      {hasMore && !isLoading && (
        <div className="text-center py-8">
          <Button
            variant="secondary"
            size="lg"
            onClick={onLoadMore}
            className="px-8"
          >
            Load More Results
          </Button>
        </div>
      )}

      {/* Performance Info */}
      <div className="text-xs text-gray-500 p-4 bg-gray-50 rounded-lg">
        <ResponsiveGrid cols={{ xs: 2, sm: 4 }} gap="sm">
          <GridItem>
            <strong>Layout Mode:</strong> {currentLayoutMode}
          </GridItem>
          <GridItem>
            <strong>Device:</strong> {device.isMobile ? 'Mobile' : device.isTablet ? 'Tablet' : 'Desktop'}
          </GridItem>
          <GridItem>
            <strong>Breakpoint:</strong> {breakpoint}
          </GridItem>
          <GridItem>
            <strong>Results:</strong> {filteredResults.length}
          </GridItem>
        </ResponsiveGrid>
      </div>
    </div>
  );
};

export default SearchResultsLayout;