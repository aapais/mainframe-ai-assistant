/**
 * Incremental Search Results Component
 * 
 * Renders search results incrementally with:
 * - Progressive loading with smooth transitions
 * - Cache-aware result streaming
 * - Virtual scrolling for performance
 * - Real-time progress indicators
 * - Optimistic UI updates
 * 
 * @author Frontend Cache Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Loader, CheckCircle, Clock, Zap, TrendingUp, BarChart3 } from 'lucide-react';
import { IncrementalResult, CachePerformanceMetrics } from '../../services/cache/CacheTypes';
import { useCacheManager } from '../../hooks/useCacheManager';
import { useVirtualization } from '../search/SearchResults/hooks/useVirtualization';

// ========================
// Types & Interfaces
// ========================

export interface IncrementalSearchResultsProps {
  query: string;
  results: IncrementalResult[];
  isLoading: boolean;
  hasMore: boolean;
  loadingProgress?: number;
  cacheMetrics?: CachePerformanceMetrics;
  onLoadMore?: () => void;
  onResultClick?: (result: IncrementalResult) => void;
  onResultSelect?: (result: IncrementalResult) => void;
  className?: string;
  enableVirtualization?: boolean;
  enableProgressIndicators?: boolean;
  enableCacheIndicators?: boolean;
  itemHeight?: number;
  batchSize?: number;
}

export interface IncrementalResultItemProps {
  result: IncrementalResult;
  index: number;
  isSelected?: boolean;
  onClick?: (result: IncrementalResult) => void;
  onSelect?: (result: IncrementalResult) => void;
  enableCacheIndicators?: boolean;
}

export interface LoadingProgressProps {
  progress: number;
  resultsCount: number;
  estimatedTotal: number;
  cacheHitRatio?: number;
  responseTime?: number;
}

export interface CacheIndicatorProps {
  source: 'memory' | 'disk' | 'network' | 'predicted';
  responseTime?: number;
  size?: 'sm' | 'md' | 'lg';
}

// ========================
// Sub-components
// ========================

const CacheIndicator: React.FC<CacheIndicatorProps> = ({ source, responseTime, size = 'sm' }) => {
  const iconSize = size === 'lg' ? 18 : size === 'md' ? 16 : 14;
  
  const indicators = {
    memory: { icon: Zap, color: 'text-green-600 dark:text-green-400', label: 'Memory', bgColor: 'bg-green-50 dark:bg-green-900/20' },
    disk: { icon: CheckCircle, color: 'text-blue-600 dark:text-blue-400', label: 'Disk', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
    network: { icon: TrendingUp, color: 'text-orange-600 dark:text-orange-400', label: 'Network', bgColor: 'bg-orange-50 dark:bg-orange-900/20' },
    predicted: { icon: BarChart3, color: 'text-purple-600 dark:text-purple-400', label: 'Predicted', bgColor: 'bg-purple-50 dark:bg-purple-900/20' }
  };
  
  const indicator = indicators[source];
  const Icon = indicator.icon;
  
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${indicator.color} ${indicator.bgColor}`}>
      <Icon size={iconSize} />
      <span>{indicator.label}</span>
      {responseTime && (
        <span className="text-xs opacity-75">{responseTime}ms</span>
      )}
    </div>
  );
};

const LoadingProgress: React.FC<LoadingProgressProps> = ({
  progress,
  resultsCount,
  estimatedTotal,
  cacheHitRatio,
  responseTime
}) => {
  const progressPercentage = Math.min(100, Math.max(0, progress * 100));
  
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Loader size={16} className="animate-spin text-primary-600 dark:text-primary-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Loading results...
          </span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {resultsCount} of {estimatedTotal > 0 ? `~${estimatedTotal}` : '...'}
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
        <div 
          className="bg-primary-600 dark:bg-primary-400 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      
      {/* Performance Metrics */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-4">
          <span>{Math.round(progressPercentage)}% complete</span>
          {cacheHitRatio !== undefined && (
            <span className="flex items-center gap-1">
              <Zap size={12} className="text-green-600 dark:text-green-400" />
              {Math.round(cacheHitRatio * 100)}% cached
            </span>
          )}
        </div>
        {responseTime && (
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {responseTime}ms avg
          </span>
        )}
      </div>
    </div>
  );
};

const IncrementalResultItem: React.FC<IncrementalResultItemProps> = ({
  result,
  index,
  isSelected = false,
  onClick,
  onSelect,
  enableCacheIndicators = true
}) => {
  const handleClick = useCallback(() => {
    onClick?.(result);
  }, [onClick, result]);
  
  const handleSelect = useCallback(() => {
    onSelect?.(result);
  }, [onSelect, result]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);
  
  // Animation delay based on index for staggered entry
  const animationDelay = Math.min(index * 50, 500);
  
  return (
    <div
      className={`
        group relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 
        rounded-lg p-4 transition-all duration-200 cursor-pointer
        hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md
        animate-fade-in-up
        ${isSelected ? 'ring-2 ring-primary-500 border-primary-500' : ''}
        ${result.partial ? 'opacity-75' : ''}
      `}
      style={{ animationDelay: `${animationDelay}ms` }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-selected={isSelected}
    >
      {/* Result Content */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title/Primary Content */}
          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {result.data?.title || result.data?.name || `Result ${index + 1}`}
          </div>
          
          {/* Description/Secondary Content */}
          {result.data?.description && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {result.data.description}
            </div>
          )}
          
          {/* Metadata */}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>ID: {result.id}</span>
            {result.timestamp && (
              <span>{new Date(result.timestamp).toLocaleTimeString()}</span>
            )}
            {result.partial && (
              <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                <Loader size={10} className="animate-spin" />
                Loading...
              </span>
            )}
          </div>
        </div>
        
        {/* Cache and Progress Indicators */}
        <div className="flex flex-col items-end gap-2">
          {enableCacheIndicators && (
            <CacheIndicator source={result.cache_source} size="sm" />
          )}
          
          {result.partial && (
            <div className="flex items-center gap-1">
              <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                <div 
                  className="bg-primary-600 dark:bg-primary-400 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(result.progress * 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 min-w-0">
                {Math.round(result.progress * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-2 right-2">
            <CheckCircle size={16} className="text-primary-600 dark:text-primary-400" />
          </div>
        </div>
      )}
    </div>
  );
};

// ========================
// Main Component
// ========================

export const IncrementalSearchResults: React.FC<IncrementalSearchResultsProps> = ({
  query,
  results,
  isLoading,
  hasMore,
  loadingProgress = 0,
  cacheMetrics,
  onLoadMore,
  onResultClick,
  onResultSelect,
  className = '',
  enableVirtualization = true,
  enableProgressIndicators = true,
  enableCacheIndicators = true,
  itemHeight = 120,
  batchSize = 20
}) => {
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [visibleResults, setVisibleResults] = useState<IncrementalResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const cacheManager = useCacheManager();
  
  // Virtual scrolling for performance
  const {
    virtualItems,
    totalHeight,
    scrollElementRef,
    measureElement
  } = useVirtualization({
    count: results.length,
    estimateSize: () => itemHeight,
    enabled: enableVirtualization && results.length > 50
  });
  
  // Progressive result loading
  useEffect(() => {
    if (!enableVirtualization || results.length <= 50) {
      setVisibleResults(results);
      return;
    }
    
    // Show results progressively based on virtual scrolling
    const visible = virtualItems.map(item => results[item.index]).filter(Boolean);
    setVisibleResults(visible);
  }, [results, virtualItems, enableVirtualization]);
  
  // Cache results for quick access
  useEffect(() => {
    if (results.length > 0) {
      const cachePromises = results.map(result => 
        cacheManager.set(`search_result_${result.id}`, result, {
          ttl: 10 * 60 * 1000, // 10 minutes
          tags: ['search_results', query]
        })
      );
      
      Promise.all(cachePromises).catch(console.warn);
    }
  }, [results, cacheManager, query]);
  
  // Load more when scrolling near the bottom
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!hasMore || isLoading || !onLoadMore) return;
    
    const target = e.target as HTMLDivElement;
    const threshold = 200; // 200px from bottom
    
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + threshold) {
      onLoadMore();
    }
  }, [hasMore, isLoading, onLoadMore]);
  
  // Result selection handlers
  const handleResultClick = useCallback((result: IncrementalResult) => {
    onResultClick?.(result);
  }, [onResultClick]);
  
  const handleResultSelect = useCallback((result: IncrementalResult) => {
    setSelectedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(result.id)) {
        newSet.delete(result.id);
      } else {
        newSet.add(result.id);
      }
      return newSet;
    });
    onResultSelect?.(result);
  }, [onResultSelect]);
  
  // Performance metrics
  const performanceMetrics = useMemo(() => {
    if (!cacheMetrics) return null;
    
    const networkSavings = cacheMetrics.networkSavings || 0;
    const cacheHitRatio = cacheMetrics.cacheHitRatio || 0;
    const responseTime = cacheMetrics.responseTime || 0;
    
    return {
      networkSavings,
      cacheHitRatio,
      responseTime
    };
  }, [cacheMetrics]);
  
  // Results summary
  const resultsSummary = useMemo(() => {
    const total = results.length;
    const completed = results.filter(r => !r.partial).length;
    const cached = results.filter(r => r.cache_source === 'memory' || r.cache_source === 'disk').length;
    const predicted = results.filter(r => r.cache_source === 'predicted').length;
    
    return { total, completed, cached, predicted };
  }, [results]);
  
  if (results.length === 0 && !isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
        <Search size={48} className="text-gray-400 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          No results found
        </h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          {query ? `No results found for "${query}". Try adjusting your search terms.` : 'Start typing to search...'}
        </p>
      </div>
    );
  }
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Loading Progress */}
      {enableProgressIndicators && isLoading && (
        <LoadingProgress
          progress={loadingProgress}
          resultsCount={resultsSummary.completed}
          estimatedTotal={results[0]?.estimated_total || 0}
          cacheHitRatio={performanceMetrics?.cacheHitRatio}
          responseTime={performanceMetrics?.responseTime}
        />
      )}
      
      {/* Results Summary */}
      {results.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>{resultsSummary.completed} of {resultsSummary.total} results</span>
            {enableCacheIndicators && (
              <>
                <span className="flex items-center gap-1">
                  <Zap size={12} className="text-green-600 dark:text-green-400" />
                  {resultsSummary.cached} cached
                </span>
                {resultsSummary.predicted > 0 && (
                  <span className="flex items-center gap-1">
                    <BarChart3 size={12} className="text-purple-600 dark:text-purple-400" />
                    {resultsSummary.predicted} predicted
                  </span>
                )}
              </>
            )}
          </div>
          
          {performanceMetrics && (
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span>{Math.round(performanceMetrics.cacheHitRatio * 100)}% cache hit</span>
              <span>{performanceMetrics.responseTime}ms avg</span>
            </div>
          )}
        </div>
      )}
      
      {/* Results Container */}
      <div
        ref={containerRef}
        className="space-y-3"
        onScroll={handleScroll}
        style={enableVirtualization && results.length > 50 ? {
          height: '600px',
          overflowY: 'auto'
        } : undefined}
      >
        {enableVirtualization && results.length > 50 ? (
          /* Virtual Scrolling Mode */
          <div ref={scrollElementRef} style={{ height: totalHeight, position: 'relative' }}>
            {virtualItems.map((virtualItem) => {
              const result = results[virtualItem.index];
              if (!result) return null;
              
              return (
                <div
                  key={result.id}
                  ref={measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`
                  }}
                >
                  <IncrementalResultItem
                    result={result}
                    index={virtualItem.index}
                    isSelected={selectedResults.has(result.id)}
                    onClick={handleResultClick}
                    onSelect={handleResultSelect}
                    enableCacheIndicators={enableCacheIndicators}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          /* Standard Mode */
          visibleResults.map((result, index) => (
            <IncrementalResultItem
              key={result.id}
              result={result}
              index={index}
              isSelected={selectedResults.has(result.id)}
              onClick={handleResultClick}
              onSelect={handleResultSelect}
              enableCacheIndicators={enableCacheIndicators}
            />
          ))
        )}
      </div>
      
      {/* Load More */}
      {hasMore && !isLoading && (
        <div className="flex justify-center pt-4">
          <button
            onClick={onLoadMore}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            Load More Results
          </button>
        </div>
      )}
      
      {/* Loading Indicator */}
      {isLoading && results.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Loader size={16} className="animate-spin" />
            <span className="text-sm">Loading more results...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncrementalSearchResults;

// CSS animations (would be in a separate CSS file)
const styles = `
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.3s ease-out forwards;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
`;

// Export styles for use in CSS-in-JS or external stylesheet
export { styles as incrementalSearchResultsStyles };