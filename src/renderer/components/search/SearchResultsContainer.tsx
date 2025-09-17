/**
 * SearchResultsContainer Component
 * Wrapper that provides real-time updates and selection state management
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { SearchResult, SearchOptions, KBEntry } from '../../../types/services';
import SearchResults from './SearchResults';

interface SearchResultsContainerProps {
  initialResults: SearchResult[];
  query: string;
  isLoading: boolean;
  onEntrySelect: (result: SearchResult) => void;
  onEntryRate: (entryId: string, successful: boolean) => void;
  onSortChange: (sortBy: SearchOptions['sortBy'], sortOrder: SearchOptions['sortOrder']) => void;
  onRefreshResults?: (query: string) => Promise<SearchResult[]>;
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
  enableRealTimeUpdates?: boolean;
  updateInterval?: number; // milliseconds
  contextualData?: {
    category?: string;
    tags?: string[];
    severity?: string;
    suggestedTitle?: string;
    suggestedProblem?: string;
  };
  onAddEntry?: (contextualData?: any) => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

export const SearchResultsContainer: React.FC<SearchResultsContainerProps> = ({
  initialResults,
  query,
  isLoading,
  onEntrySelect,
  onEntryRate,
  onSortChange,
  onRefreshResults,
  enableRealTimeUpdates = true,
  updateInterval = 30000, // 30 seconds
  ...otherProps
}) => {
  const [results, setResults] = useState<SearchResult[]>(initialResults);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const updateTimeoutRef = useRef<NodeJS.Timeout>();
  const isComponentMountedRef = useRef(true);

  // Update results when initialResults change
  useEffect(() => {
    setResults(initialResults);
    setLastUpdateTime(new Date());
  }, [initialResults]);

  // Real-time update logic
  const performUpdate = useCallback(async () => {
    if (!onRefreshResults || !query.trim() || isLoading || !isComponentMountedRef.current) {
      return;
    }

    try {
      setIsRefreshing(true);
      const updatedResults = await onRefreshResults(query);

      if (isComponentMountedRef.current) {
        // Check if results actually changed before updating
        const hasChanges = !areResultsEqual(results, updatedResults);

        if (hasChanges) {
          setResults(updatedResults);
          setLastUpdateTime(new Date());
        }
      }
    } catch (error) {
      console.error('Failed to refresh search results:', error);
    } finally {
      if (isComponentMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [onRefreshResults, query, isLoading, results]);

  // Set up real-time updates
  useEffect(() => {
    if (!enableRealTimeUpdates || !onRefreshResults || !query.trim()) {
      return;
    }

    const scheduleUpdate = () => {
      updateTimeoutRef.current = setTimeout(async () => {
        await performUpdate();
        if (isComponentMountedRef.current) {
          scheduleUpdate();
        }
      }, updateInterval);
    };

    scheduleUpdate();

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [enableRealTimeUpdates, onRefreshResults, query, updateInterval, performUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isComponentMountedRef.current = false;
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Handle manual refresh
  const handleManualRefresh = useCallback(async () => {
    await performUpdate();
  }, [performUpdate]);

  // Handle results update from CRUD operations
  const handleResultsUpdate = useCallback((updatedResults: SearchResult[]) => {
    setResults(updatedResults);
    setLastUpdateTime(new Date());
  }, []);

  // Enhanced entry selection with real-time consideration
  const handleEntrySelect = useCallback((result: SearchResult) => {
    // Check if this entry is still in current results (not stale)
    const currentEntry = results.find(r => r.entry.id === result.entry.id);
    if (currentEntry) {
      onEntrySelect(currentEntry);
    } else {
      // Entry might have been updated/removed, refresh results
      handleManualRefresh();
      onEntrySelect(result);
    }
  }, [results, onEntrySelect, handleManualRefresh]);

  // Enhanced entry rating with optimistic updates
  const handleEntryRate = useCallback(async (entryId: string, successful: boolean) => {
    // Optimistically update the local results
    setResults(prevResults =>
      prevResults.map(result => {
        if (result.entry.id === entryId) {
          const updatedEntry = {
            ...result.entry,
            usage_count: result.entry.usage_count + 1,
            success_count: successful
              ? result.entry.success_count + 1
              : result.entry.success_count,
            failure_count: successful
              ? result.entry.failure_count
              : result.entry.failure_count + 1
          };
          return { ...result, entry: updatedEntry };
        }
        return result;
      })
    );

    // Call the original handler
    try {
      await onEntryRate(entryId, successful);
    } catch (error) {
      // Revert optimistic update on error
      console.error('Failed to rate entry:', error);
      await handleManualRefresh();
    }
  }, [onEntryRate, handleManualRefresh]);

  // Memoized status information
  const statusInfo = useMemo(() => {
    const totalResults = results.length;
    const hasAiResults = results.some(r => r.metadata?.source === 'ai');
    const avgScore = totalResults > 0
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / totalResults)
      : 0;

    return {
      totalResults,
      hasAiResults,
      avgScore,
      lastUpdateTime,
      isRefreshing
    };
  }, [results, lastUpdateTime, isRefreshing]);

  return (
    <div className="search-results-container">
      {/* Update Status Bar */}
      {enableRealTimeUpdates && (
        <div className="flex items-center justify-between p-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
          <div className="flex items-center space-x-4">
            <span>
              Last updated: {lastUpdateTime.toLocaleTimeString()}
            </span>
            {statusInfo.totalResults > 0 && (
              <span>
                Avg relevance: {statusInfo.avgScore}%
              </span>
            )}
            {statusInfo.hasAiResults && (
              <span className="text-blue-600">
                🤖 AI-enhanced results
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {isRefreshing && (
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span>Updating...</span>
              </div>
            )}

            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing || isLoading}
              className="px-2 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded text-xs font-medium disabled:opacity-50"
              title="Refresh results"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Main Search Results */}
      <SearchResults
        results={results}
        query={query}
        isLoading={isLoading}
        onEntrySelect={handleEntrySelect}
        onEntryRate={handleEntryRate}
        onSortChange={onSortChange}
        onResultsUpdate={handleResultsUpdate}
        {...otherProps}
      />
    </div>
  );
};

// Helper function to compare results arrays
function areResultsEqual(a: SearchResult[], b: SearchResult[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const entryA = a[i].entry;
    const entryB = b[i].entry;

    // Compare key fields that might change
    if (
      entryA.id !== entryB.id ||
      entryA.title !== entryB.title ||
      entryA.updated_at !== entryB.updated_at ||
      entryA.usage_count !== entryB.usage_count ||
      entryA.success_count !== entryB.success_count ||
      entryA.failure_count !== entryB.failure_count ||
      entryA.archived !== entryB.archived ||
      a[i].score !== b[i].score
    ) {
      return false;
    }
  }

  return true;
}

export default SearchResultsContainer;