# KB Entry Management - Implementation Specifications

## Priority Implementation Components

This document provides detailed implementation specifications for the core components of the KB Entry Management architecture, focusing on the most critical elements for MVP1 success.

## 1. VirtualizedKBEntryList Component

### 1.1 Component Specification

```typescript
// File: src/components/KB/VirtualizedKBEntryList.tsx

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { FixedSizeList as List, areEqual } from 'react-window';
import { KBEntry, SearchResult } from '../../types';
import { useKBManagerStore } from '../../stores/kbManagerStore';
import { OptimizedEntryCard } from './OptimizedEntryCard';

interface VirtualizedKBEntryListProps {
  entries: KBEntry[];
  height: number;
  itemHeight: number;
  searchQuery?: string;
  onEntrySelect: (entry: KBEntry) => void;
  onBatchSelect?: (entries: KBEntry[]) => void;
  enableBatchSelect?: boolean;
  viewMode: 'compact' | 'standard' | 'detailed';
  className?: string;
}

interface ItemData {
  entries: KBEntry[];
  searchQuery?: string;
  onEntrySelect: (entry: KBEntry) => void;
  selectedEntries: Set<string>;
  viewMode: 'compact' | 'standard' | 'detailed';
  onToggleSelect: (entryId: string) => void;
  enableBatchSelect: boolean;
}

// Memoized row renderer for optimal performance
const EntryRow: React.FC<{
  index: number;
  style: React.CSSProperties;
  data: ItemData;
}> = React.memo(({ index, style, data }) => {
  const entry = data.entries[index];
  const isSelected = data.selectedEntries.has(entry.id);

  return (
    <div style={style}>
      <OptimizedEntryCard
        entry={entry}
        searchQuery={data.searchQuery}
        isSelected={isSelected}
        viewMode={data.viewMode}
        onSelect={data.onEntrySelect}
        onToggleSelect={data.enableBatchSelect ? data.onToggleSelect : undefined}
      />
    </div>
  );
}, areEqual);

export const VirtualizedKBEntryList: React.FC<VirtualizedKBEntryListProps> = ({
  entries,
  height,
  itemHeight,
  searchQuery,
  onEntrySelect,
  onBatchSelect,
  enableBatchSelect = false,
  viewMode,
  className = ''
}) => {
  const listRef = useRef<List>(null);
  const { selectedEntries, toggleEntrySelection } = useKBManagerStore();

  // Memoized item data to prevent unnecessary re-renders
  const itemData = useMemo((): ItemData => ({
    entries,
    searchQuery,
    onEntrySelect,
    selectedEntries,
    viewMode,
    onToggleSelect: toggleEntrySelection,
    enableBatchSelect
  }), [entries, searchQuery, onEntrySelect, selectedEntries, viewMode, toggleEntrySelection, enableBatchSelect]);

  // Scroll to entry when selection changes externally
  const scrollToEntry = useCallback((entryId: string) => {
    const index = entries.findIndex(entry => entry.id === entryId);
    if (index !== -1 && listRef.current) {
      listRef.current.scrollToItem(index, 'smart');
    }
  }, [entries]);

  // Batch selection effect
  useEffect(() => {
    if (onBatchSelect && selectedEntries.size > 0) {
      const selected = entries.filter(entry => selectedEntries.has(entry.id));
      onBatchSelect(selected);
    }
  }, [selectedEntries, entries, onBatchSelect]);

  return (
    <div className={`virtualized-kb-list ${className}`}>
      <List
        ref={listRef}
        height={height}
        itemCount={entries.length}
        itemSize={itemHeight}
        itemData={itemData}
        overscanCount={5}
        className="virtualized-list-container"
      >
        {EntryRow}
      </List>
    </div>
  );
};
```

### 1.2 Performance Optimizations

```typescript
// File: src/hooks/useVirtualScrollOptimization.ts

interface ScrollMetrics {
  scrollTop: number;
  isScrolling: boolean;
  scrollDirection: 'up' | 'down' | 'none';
  visibleRange: [number, number];
}

export const useVirtualScrollOptimization = (
  itemCount: number,
  itemHeight: number,
  containerHeight: number
) => {
  const [metrics, setMetrics] = useState<ScrollMetrics>({
    scrollTop: 0,
    isScrolling: false,
    scrollDirection: 'none',
    visibleRange: [0, Math.ceil(containerHeight / itemHeight)]
  });

  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  const handleScroll = useCallback((scrollTop: number) => {
    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.min(
      itemCount,
      visibleStart + Math.ceil(containerHeight / itemHeight) + 1
    );

    setMetrics(prev => ({
      scrollTop,
      isScrolling: true,
      scrollDirection: scrollTop > prev.scrollTop ? 'down' : scrollTop < prev.scrollTop ? 'up' : 'none',
      visibleRange: [visibleStart, visibleEnd]
    }));

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set scroll end timeout
    scrollTimeoutRef.current = setTimeout(() => {
      setMetrics(prev => ({ ...prev, isScrolling: false }));
    }, 150);
  }, [itemHeight, containerHeight, itemCount]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return { metrics, handleScroll };
};
```

## 2. Enhanced Search with Intelligent Caching

### 2.1 Smart Search Service

```typescript
// File: src/services/SmartSearchService.ts

interface SearchCache {
  query: string;
  options: SearchOptions;
  results: SearchResult[];
  timestamp: number;
  hitCount: number;
}

interface SearchMetrics {
  totalSearches: number;
  cacheHitRate: number;
  averageResponseTime: number;
  topQueries: Array<{ query: string; count: number }>;
}

export class SmartSearchService {
  private cache: Map<string, SearchCache> = new Map();
  private recentQueries: string[] = [];
  private metrics: SearchMetrics = {
    totalSearches: 0,
    cacheHitRate: 0,
    averageResponseTime: 0,
    topQueries: []
  };

  constructor(
    private kbService: IKnowledgeBaseService,
    private aiService?: AIEnhancedSearchService,
    private cacheSize: number = 100,
    private cacheTTL: number = 5 * 60 * 1000 // 5 minutes
  ) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const startTime = performance.now();
    const cacheKey = this.createCacheKey(query, options);

    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      cached.hitCount++;
      this.updateMetrics(performance.now() - startTime, true);
      return cached.results;
    }

    try {
      // Perform search with AI enhancement if available
      const results = await this.performSearch(query, options);

      // Cache results
      this.setCache(cacheKey, query, options, results);

      // Update recent queries
      this.updateRecentQueries(query);

      // Update metrics
      this.updateMetrics(performance.now() - startTime, false);

      return results;
    } catch (error) {
      console.error('Search failed:', error);
      // Fallback to basic local search
      return await this.kbService.search(query, options);
    }
  }

  private async performSearch(query: string, options: SearchOptions): Promise<SearchResult[]> {
    if (this.aiService && options.useAI !== false) {
      // AI-enhanced search
      return await this.aiService.searchWithContext(query, { options, recentQueries: this.recentQueries });
    } else {
      // Standard local search
      return await this.kbService.search(query, options);
    }
  }

  private createCacheKey(query: string, options: SearchOptions): string {
    const optionsKey = JSON.stringify({
      category: options.category,
      tags: options.tags?.sort(),
      limit: options.limit,
      useAI: options.useAI
    });
    return `${query.toLowerCase()}:${optionsKey}`;
  }

  private getFromCache(key: string): SearchCache | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check TTL
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  private setCache(key: string, query: string, options: SearchOptions, results: SearchResult[]): void {
    // Implement LRU eviction
    if (this.cache.size >= this.cacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      query,
      options,
      results,
      timestamp: Date.now(),
      hitCount: 0
    });
  }

  private updateRecentQueries(query: string): void {
    this.recentQueries = [query, ...this.recentQueries.filter(q => q !== query)].slice(0, 10);
  }

  private updateMetrics(responseTime: number, fromCache: boolean): void {
    this.metrics.totalSearches++;

    if (fromCache) {
      this.metrics.cacheHitRate = (this.metrics.cacheHitRate * (this.metrics.totalSearches - 1) + 1) / this.metrics.totalSearches;
    } else {
      this.metrics.cacheHitRate = (this.metrics.cacheHitRate * (this.metrics.totalSearches - 1)) / this.metrics.totalSearches;
    }

    this.metrics.averageResponseTime = (
      (this.metrics.averageResponseTime * (this.metrics.totalSearches - 1) + responseTime)
      / this.metrics.totalSearches
    );
  }

  getMetrics(): SearchMetrics {
    return { ...this.metrics };
  }

  clearCache(): void {
    this.cache.clear();
  }

  // Preload popular searches for better UX
  async preloadPopularSearches(): Promise<void> {
    const popularQueries = this.metrics.topQueries.slice(0, 5);

    await Promise.allSettled(
      popularQueries.map(({ query }) =>
        this.search(query, { limit: 10 })
      )
    );
  }
}
```

### 2.2 Debounced Search Hook

```typescript
// File: src/hooks/useSmartSearch.ts

interface UseSmartSearchOptions {
  debounceMs?: number;
  minQueryLength?: number;
  enableAI?: boolean;
  cacheResults?: boolean;
}

interface SearchState {
  query: string;
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
}

export const useSmartSearch = (
  searchService: SmartSearchService,
  options: UseSmartSearchOptions = {}
) => {
  const {
    debounceMs = 300,
    minQueryLength = 2,
    enableAI = true,
    cacheResults = true
  } = options;

  const [state, setState] = useState<SearchState>({
    query: '',
    results: [],
    loading: false,
    error: null,
    hasMore: false
  });

  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  const performSearch = useCallback(async (query: string, append: boolean = false) => {
    if (query.length < minQueryLength) {
      setState(prev => ({ ...prev, results: [], loading: false, hasMore: false }));
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      query
    }));

    try {
      const searchOptions: SearchOptions = {
        limit: 50,
        offset: append ? state.results.length : 0,
        useAI: enableAI
      };

      const results = await searchService.search(query, searchOptions);

      if (!abortControllerRef.current.signal.aborted) {
        setState(prev => ({
          ...prev,
          results: append ? [...prev.results, ...results] : results,
          loading: false,
          hasMore: results.length === searchOptions.limit,
          error: null
        }));
      }
    } catch (error) {
      if (!abortControllerRef.current.signal.aborted) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Search failed'
        }));
      }
    }
  }, [searchService, minQueryLength, enableAI, state.results.length]);

  const debouncedSearch = useCallback((query: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, debounceMs);
  }, [performSearch, debounceMs]);

  const loadMore = useCallback(() => {
    if (state.hasMore && !state.loading) {
      performSearch(state.query, true);
    }
  }, [state.hasMore, state.loading, state.query, performSearch]);

  const clearSearch = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setState({
      query: '',
      results: [],
      loading: false,
      error: null,
      hasMore: false
    });
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    search: debouncedSearch,
    loadMore,
    clearSearch
  };
};
```

## 3. Optimized Entry Card Component

### 3.1 Memory-Efficient Entry Card

```typescript
// File: src/components/KB/OptimizedEntryCard.tsx

import React, { memo, useMemo, useCallback } from 'react';
import { KBEntry } from '../../types';
import { highlightText, truncateText, formatDate, formatMetrics } from '../../utils/textUtils';

interface OptimizedEntryCardProps {
  entry: KBEntry;
  searchQuery?: string;
  isSelected?: boolean;
  viewMode: 'compact' | 'standard' | 'detailed';
  onSelect: (entry: KBEntry) => void;
  onToggleSelect?: (entryId: string) => void;
  showMetrics?: boolean;
  showPreview?: boolean;
}

interface CardContent {
  title: React.ReactNode;
  preview: string;
  tags: string[];
  metrics: {
    usage: number;
    successRate: number;
    lastUsed: string;
  };
  category: string;
}

export const OptimizedEntryCard: React.FC<OptimizedEntryCardProps> = memo(({
  entry,
  searchQuery,
  isSelected = false,
  viewMode,
  onSelect,
  onToggleSelect,
  showMetrics = true,
  showPreview = true
}) => {
  // Memoize processed content to avoid recalculation
  const content = useMemo((): CardContent => {
    const searchTerms = searchQuery ? searchQuery.split(/\s+/).filter(term => term.length > 1) : [];

    return {
      title: highlightText(entry.title, searchTerms),
      preview: showPreview ? truncateText(entry.problem, getPreviewLength(viewMode)) : '',
      tags: entry.tags?.slice(0, getMaxTags(viewMode)) || [],
      metrics: {
        usage: entry.usage_count,
        successRate: entry.success_count + entry.failure_count > 0
          ? Math.round((entry.success_count / (entry.success_count + entry.failure_count)) * 100)
          : 0,
        lastUsed: formatDate(entry.updated_at)
      },
      category: entry.category
    };
  }, [entry, searchQuery, viewMode, showPreview]);

  // Memoized event handlers
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      onToggleSelect?.(entry.id);
    } else {
      onSelect(entry);
    }
  }, [entry.id, onSelect, onToggleSelect]);

  const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onToggleSelect?.(entry.id);
  }, [entry.id, onToggleSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(entry);
    }
  }, [entry, onSelect]);

  // Get dynamic classes
  const cardClasses = useMemo(() => [
    'entry-card',
    `entry-card--${viewMode}`,
    isSelected ? 'entry-card--selected' : '',
    `entry-card--${content.category.toLowerCase()}`
  ].filter(Boolean).join(' '), [viewMode, isSelected, content.category]);

  return (
    <div
      className={cardClasses}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      aria-label={`KB Entry: ${entry.title}`}
    >
      {/* Selection checkbox */}
      {onToggleSelect && (
        <div className="entry-card__checkbox">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            aria-label={`Select ${entry.title}`}
          />
        </div>
      )}

      {/* Main content */}
      <div className="entry-card__content">
        <div className="entry-card__header">
          <h3 className="entry-card__title">{content.title}</h3>
          <div className="entry-card__category">
            <span className={`category-badge category-badge--${content.category.toLowerCase()}`}>
              {content.category}
            </span>
          </div>
        </div>

        {/* Preview text */}
        {content.preview && (
          <div className="entry-card__preview">
            {highlightText(content.preview, searchQuery?.split(/\s+/) || [])}
          </div>
        )}

        {/* Tags */}
        {content.tags.length > 0 && (
          <div className="entry-card__tags">
            {content.tags.map(tag => (
              <span key={tag} className="tag-chip">
                {highlightText(tag, searchQuery?.split(/\s+/) || [])}
              </span>
            ))}
            {entry.tags && entry.tags.length > content.tags.length && (
              <span className="tag-chip tag-chip--more">
                +{entry.tags.length - content.tags.length} more
              </span>
            )}
          </div>
        )}

        {/* Metrics */}
        {showMetrics && (
          <div className="entry-card__metrics">
            <div className="metric">
              <span className="metric__label">Usage:</span>
              <span className="metric__value">{formatMetrics(content.metrics.usage)}</span>
            </div>
            <div className="metric">
              <span className="metric__label">Success:</span>
              <span className={`metric__value ${getSuccessRateClass(content.metrics.successRate)}`}>
                {content.metrics.successRate}%
              </span>
            </div>
            <div className="metric">
              <span className="metric__label">Updated:</span>
              <span className="metric__value">{content.metrics.lastUsed}</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="entry-card__actions">
        <button
          className="action-btn action-btn--edit"
          onClick={(e) => {
            e.stopPropagation();
            // Handle edit action
          }}
          aria-label={`Edit ${entry.title}`}
        >
          ✏️
        </button>
        <button
          className="action-btn action-btn--duplicate"
          onClick={(e) => {
            e.stopPropagation();
            // Handle duplicate action
          }}
          aria-label={`Duplicate ${entry.title}`}
        >
          📋
        </button>
      </div>
    </div>
  );
}, arePropsEqual);

// Custom equality check for memo optimization
function arePropsEqual(
  prevProps: OptimizedEntryCardProps,
  nextProps: OptimizedEntryCardProps
): boolean {
  return (
    prevProps.entry.id === nextProps.entry.id &&
    prevProps.entry.version === nextProps.entry.version &&
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.showMetrics === nextProps.showMetrics &&
    prevProps.showPreview === nextProps.showPreview
  );
}

// Helper functions
function getPreviewLength(viewMode: string): number {
  switch (viewMode) {
    case 'compact': return 60;
    case 'standard': return 120;
    case 'detailed': return 200;
    default: return 120;
  }
}

function getMaxTags(viewMode: string): number {
  switch (viewMode) {
    case 'compact': return 2;
    case 'standard': return 4;
    case 'detailed': return 6;
    default: return 4;
  }
}

function getSuccessRateClass(rate: number): string {
  if (rate >= 80) return 'success-rate--high';
  if (rate >= 60) return 'success-rate--medium';
  return 'success-rate--low';
}
```

## 4. Batch Operations Manager

### 4.1 Enhanced Batch Operations Service

```typescript
// File: src/services/EnhancedBatchOperationsService.ts

interface BatchOperationProgress {
  total: number;
  completed: number;
  failed: number;
  percentComplete: number;
  estimatedTimeRemaining: number;
  currentItem?: string;
  errors: Array<{ itemId: string; error: string }>;
}

interface BatchOperationResult<T = any> {
  success: boolean;
  results: Array<{ id: string; success: boolean; data?: T; error?: string }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    duration: number;
  };
}

export class EnhancedBatchOperationsService extends EventEmitter {
  private activeOperation: AbortController | null = null;
  private progress: BatchOperationProgress = {
    total: 0,
    completed: 0,
    failed: 0,
    percentComplete: 0,
    estimatedTimeRemaining: 0,
    errors: []
  };

  constructor(
    private kbService: IKnowledgeBaseService,
    private concurrentLimit: number = 5
  ) {
    super();
  }

  async batchUpdate(
    entryIds: string[],
    updates: Partial<KBEntry>,
    options: { validateFirst?: boolean; createBackup?: boolean } = {}
  ): Promise<BatchOperationResult> {
    return this.executeBatchOperation(
      'update',
      entryIds,
      async (id) => {
        if (options.validateFirst) {
          const entry = await this.kbService.getById(id);
          // Perform validation logic
        }

        if (options.createBackup) {
          // Create backup before update
          await this.createBackup(id);
        }

        await this.kbService.update(id, updates);
        return updates;
      }
    );
  }

  async batchDelete(
    entryIds: string[],
    options: { createBackup?: boolean; softDelete?: boolean } = {}
  ): Promise<BatchOperationResult> {
    return this.executeBatchOperation(
      'delete',
      entryIds,
      async (id) => {
        if (options.createBackup) {
          await this.createBackup(id);
        }

        if (options.softDelete) {
          await this.kbService.update(id, { deleted_at: new Date() } as any);
        } else {
          await this.kbService.delete(id);
        }

        return { deleted: true };
      }
    );
  }

  async batchExport(
    entryIds: string[],
    format: 'json' | 'csv' | 'xml'
  ): Promise<BatchOperationResult<string>> {
    return this.executeBatchOperation(
      'export',
      entryIds,
      async (id) => {
        const entry = await this.kbService.getById(id);
        return this.formatEntryForExport(entry, format);
      }
    );
  }

  private async executeBatchOperation<T>(
    operationType: string,
    itemIds: string[],
    operation: (id: string) => Promise<T>
  ): Promise<BatchOperationResult<T>> {
    const startTime = Date.now();
    this.activeOperation = new AbortController();

    // Initialize progress
    this.progress = {
      total: itemIds.length,
      completed: 0,
      failed: 0,
      percentComplete: 0,
      estimatedTimeRemaining: 0,
      errors: []
    };

    this.emit('operation:started', {
      type: operationType,
      total: itemIds.length
    });

    const results: Array<{ id: string; success: boolean; data?: T; error?: string }> = [];
    const semaphore = new Semaphore(this.concurrentLimit);

    try {
      // Process items in batches with concurrency control
      await Promise.allSettled(
        itemIds.map(async (id, index) => {
          await semaphore.acquire();

          try {
            if (this.activeOperation?.signal.aborted) {
              throw new Error('Operation cancelled');
            }

            this.progress.currentItem = id;
            this.emit('operation:progress', { ...this.progress });

            const data = await operation(id);

            results.push({ id, success: true, data });
            this.progress.completed++;

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            results.push({ id, success: false, error: errorMessage });
            this.progress.failed++;
            this.progress.errors.push({ itemId: id, error: errorMessage });
          } finally {
            semaphore.release();

            // Update progress
            this.progress.percentComplete = Math.round(
              ((this.progress.completed + this.progress.failed) / this.progress.total) * 100
            );

            // Estimate remaining time
            const elapsed = Date.now() - startTime;
            const itemsProcessed = this.progress.completed + this.progress.failed;
            if (itemsProcessed > 0) {
              const avgTimePerItem = elapsed / itemsProcessed;
              this.progress.estimatedTimeRemaining =
                (this.progress.total - itemsProcessed) * avgTimePerItem;
            }

            this.emit('operation:progress', { ...this.progress });
          }
        })
      );

      const summary = {
        total: itemIds.length,
        successful: this.progress.completed,
        failed: this.progress.failed,
        duration: Date.now() - startTime
      };

      this.emit('operation:completed', {
        type: operationType,
        summary
      });

      return {
        success: this.progress.failed === 0,
        results,
        summary
      };

    } catch (error) {
      this.emit('operation:error', {
        type: operationType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    } finally {
      this.activeOperation = null;
    }
  }

  cancelCurrentOperation(): void {
    if (this.activeOperation) {
      this.activeOperation.abort();
      this.emit('operation:cancelled', {
        progress: { ...this.progress }
      });
    }
  }

  getProgress(): BatchOperationProgress {
    return { ...this.progress };
  }

  private async createBackup(entryId: string): Promise<void> {
    const entry = await this.kbService.getById(entryId);
    // Store backup (implement based on requirements)
    // Could be local storage, file system, or database
  }

  private formatEntryForExport(entry: KBEntry, format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(entry, null, 2);
      case 'csv':
        return this.entryToCsv(entry);
      case 'xml':
        return this.entryToXml(entry);
      default:
        return JSON.stringify(entry);
    }
  }

  private entryToCsv(entry: KBEntry): string {
    const csvRow = [
      entry.id,
      `"${entry.title.replace(/"/g, '""')}"`,
      `"${entry.problem.replace(/"/g, '""')}"`,
      `"${entry.solution.replace(/"/g, '""')}"`,
      entry.category,
      entry.tags?.join(';') || '',
      entry.created_at.toISOString(),
      entry.usage_count,
      entry.success_count
    ];
    return csvRow.join(',');
  }

  private entryToXml(entry: KBEntry): string {
    return `
      <entry id="${entry.id}">
        <title><![CDATA[${entry.title}]]></title>
        <problem><![CDATA[${entry.problem}]]></problem>
        <solution><![CDATA[${entry.solution}]]></solution>
        <category>${entry.category}</category>
        <tags>${entry.tags?.join(',') || ''}</tags>
        <created>${entry.created_at.toISOString()}</created>
        <usage>${entry.usage_count}</usage>
        <success>${entry.success_count}</success>
      </entry>
    `.trim();
  }
}

// Helper class for concurrency control
class Semaphore {
  private permits: number;
  private waitingQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.waitingQueue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waitingQueue.length > 0) {
      const resolve = this.waitingQueue.shift();
      if (resolve) {
        this.permits--;
        resolve();
      }
    }
  }
}
```

This implementation specification provides:

1. **High-Performance Virtual Scrolling**: Handles 1000+ entries efficiently with React Window
2. **Intelligent Search Caching**: Reduces API calls and improves response times
3. **Memory-Optimized Components**: Minimizes re-renders and memory usage
4. **Robust Batch Operations**: Supports concurrent operations with progress tracking and error handling
5. **Comprehensive Error Handling**: Graceful fallbacks and user feedback
6. **Accessibility Support**: Full keyboard navigation and screen reader compatibility

These specifications align with the Knowledge-First MVP1 approach while providing the foundation for future enhancements.