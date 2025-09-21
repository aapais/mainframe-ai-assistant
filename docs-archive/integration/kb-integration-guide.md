# Knowledge Base Integration Guide

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Component Integration](#component-integration)
4. [Hook Integration](#hook-integration)
5. [Database Integration](#database-integration)
6. [Custom Search Implementation](#custom-search-implementation)
7. [Virtual Scrolling Integration](#virtual-scrolling-integration)
8. [Performance Integration](#performance-integration)
9. [Testing Integration](#testing-integration)
10. [Migration from Legacy Systems](#migration-from-legacy-systems)

---

## Overview

This guide provides developers with comprehensive instructions for integrating the Knowledge Base listing and filtering interface into existing applications or building new applications that leverage the KB system.

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                          │
├─────────────────────────────────────────────────────────────┤
│ Your Components                                             │
│ ├── YourMainComponent                                       │
│ └── YourCustomComponent                                     │
│                                                             │
│ KB Integration Layer                                        │
│ ├── KBProvider (Context)                                   │
│ ├── useKBData Hook                                         │
│ └── KB Components                                           │
│                                                             │
│ KB Core Services                                            │
│ ├── KnowledgeDB                                            │
│ ├── SearchService                                          │
│ └── PerformanceMonitor                                     │
└─────────────────────────────────────────────────────────────┘
```

### Key Integration Points

1. **Component Level**: Drop-in React components
2. **Hook Level**: Custom hooks for data management
3. **Database Level**: Direct database integration
4. **Service Level**: Business logic integration

---

## Quick Start

### Basic Setup

```bash
# Install required dependencies
npm install react react-dom
npm install better-sqlite3
npm install react-window react-window-infinite-loader
npm install lodash uuid

# Install development dependencies
npm install --save-dev @types/react @types/node
npm install --save-dev jest @testing-library/react
```

### Minimal Integration

```tsx
// App.tsx
import React from 'react';
import { KBProvider } from './components/KB/KBProvider';
import { AdvancedKBEntryList } from './components/KB/AdvancedKBEntryList';

function App() {
  return (
    <KBProvider dbPath="./data/knowledge.db">
      <div className="app">
        <h1>Knowledge Base</h1>
        <AdvancedKBEntryList />
      </div>
    </KBProvider>
  );
}

export default App;
```

### Provider Setup

```tsx
// components/KB/KBProvider.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { KnowledgeDB } from '../../database/KnowledgeDB';

interface KBContextValue {
  db: KnowledgeDB | null;
  isReady: boolean;
  error: Error | null;
}

const KBContext = createContext<KBContextValue>({
  db: null,
  isReady: false,
  error: null
});

export const useKBContext = () => {
  const context = useContext(KBContext);
  if (!context) {
    throw new Error('useKBContext must be used within KBProvider');
  }
  return context;
};

interface KBProviderProps {
  children: React.ReactNode;
  dbPath: string;
  config?: KBConfig;
}

export const KBProvider: React.FC<KBProviderProps> = ({
  children,
  dbPath,
  config = {}
}) => {
  const [db, setDb] = useState<KnowledgeDB | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeDB = async () => {
      try {
        const database = new KnowledgeDB(dbPath, config);
        await database.initialize();
        setDb(database);
        setIsReady(true);
        setError(null);
      } catch (err) {
        setError(err as Error);
        setIsReady(false);
      }
    };

    initializeDB();

    return () => {
      if (db) {
        db.close();
      }
    };
  }, [dbPath]);

  const value: KBContextValue = {
    db,
    isReady,
    error
  };

  return (
    <KBContext.Provider value={value}>
      {children}
    </KBContext.Provider>
  );
};
```

---

## Component Integration

### Using Pre-built Components

```tsx
// YourComponent.tsx
import React from 'react';
import { AdvancedKBEntryList } from '../components/KB/AdvancedKBEntryList';
import { KBSearchBar } from '../components/KB/KBSearchBar';
import { KBFilters } from '../components/KB/KBFilters';

export const YourKBPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);

  return (
    <div className="kb-page">
      <div className="kb-search-section">
        <KBSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search knowledge base..."
        />
        <KBFilters
          filters={filters}
          onChange={setFilters}
        />
      </div>

      <div className="kb-content">
        <AdvancedKBEntryList
          searchQuery={searchQuery}
          filters={filters}
          selectedEntries={selectedEntries}
          onSelectionChange={setSelectedEntries}
          onEntryClick={(entry) => {
            // Handle entry click
            console.log('Entry clicked:', entry);
          }}
          virtualScrolling={{
            enabled: true,
            itemHeight: 120,
            overscan: 5
          }}
          batchOperations={{
            enabled: true,
            actions: ['delete', 'export', 'duplicate']
          }}
        />
      </div>
    </div>
  );
};
```

### Custom Component Wrapper

```tsx
// CustomKBComponent.tsx
import React from 'react';
import { useKBData } from '../hooks/useKBData';
import { KBEntry } from '../types/kb';

interface CustomKBComponentProps {
  onEntrySelect?: (entry: KBEntry) => void;
  customFilter?: (entry: KBEntry) => boolean;
  renderItem?: (entry: KBEntry, index: number) => React.ReactNode;
}

export const CustomKBComponent: React.FC<CustomKBComponentProps> = ({
  onEntrySelect,
  customFilter,
  renderItem
}) => {
  const {
    entries,
    loading,
    error,
    search,
    addEntry,
    updateEntry,
    deleteEntry
  } = useKBData({
    limit: 50,
    sortBy: 'usage_count',
    sortDirection: 'desc'
  });

  // Apply custom filter if provided
  const filteredEntries = customFilter
    ? entries.filter(customFilter)
    : entries;

  const handleEntryClick = (entry: KBEntry) => {
    if (onEntrySelect) {
      onEntrySelect(entry);
    }
  };

  if (loading) {
    return <div className="kb-loading">Loading knowledge base...</div>;
  }

  if (error) {
    return <div className="kb-error">Error: {error.message}</div>;
  }

  return (
    <div className="custom-kb-component">
      {filteredEntries.map((entry, index) => (
        <div key={entry.id} onClick={() => handleEntryClick(entry)}>
          {renderItem ? renderItem(entry, index) : (
            <div className="kb-entry-item">
              <h3>{entry.title}</h3>
              <p>{entry.problem.substring(0, 200)}...</p>
              <div className="entry-meta">
                <span className="category">{entry.category}</span>
                <span className="usage">Used {entry.usage_count} times</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
```

---

## Hook Integration

### Using useKBData Hook

```tsx
// YourCustomHook.ts
import { useKBData } from '../hooks/useKBData';
import { useMemo, useState } from 'react';

export const useCustomKBLogic = () => {
  const [activeCategory, setActiveCategory] = useState<string>('');

  const {
    entries,
    loading,
    error,
    search,
    addEntry,
    updateEntry,
    deleteEntry,
    stats
  } = useKBData({
    limit: 100,
    sortBy: 'created_at',
    sortDirection: 'desc',
    filters: activeCategory ? { category: activeCategory } : undefined
  });

  const categorizedEntries = useMemo(() => {
    const categories = new Map<string, KBEntry[]>();

    entries.forEach(entry => {
      if (!categories.has(entry.category)) {
        categories.set(entry.category, []);
      }
      categories.get(entry.category)!.push(entry);
    });

    return categories;
  }, [entries]);

  const searchWithCategory = async (query: string, category?: string) => {
    const filters = category ? { category } : undefined;
    return await search(query, { filters, limit: 50 });
  };

  return {
    entries,
    categorizedEntries,
    loading,
    error,
    search: searchWithCategory,
    addEntry,
    updateEntry,
    deleteEntry,
    stats,
    activeCategory,
    setActiveCategory
  };
};
```

### Custom Search Hook

```tsx
// hooks/useKBSearch.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDebounce } from './useDebounce';
import { useKBContext } from '../components/KB/KBProvider';

export const useKBSearch = (
  initialQuery: string = '',
  options: SearchOptions = {}
) => {
  const { db } = useKBContext();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const debouncedQuery = useDebounce(query, 300);

  const searchOptions = useMemo(() => ({
    limit: 20,
    strategy: 'hybrid',
    ...options
  }), [options]);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!db || !searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchResults = await db.search(searchQuery, searchOptions);
      setResults(searchResults);
    } catch (err) {
      setError(err as Error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [db, searchOptions]);

  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
  }, []);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    clearSearch,
    performSearch
  };
};
```

---

## Database Integration

### Direct Database Usage

```typescript
// services/CustomKBService.ts
import { KnowledgeDB } from '../database/KnowledgeDB';

export class CustomKBService {
  private db: KnowledgeDB;

  constructor(dbPath: string) {
    this.db = new KnowledgeDB(dbPath);
  }

  async getEntriesByCategory(category: string): Promise<KBEntry[]> {
    const query = `
      SELECT * FROM kb_entries
      WHERE category = ?
      ORDER BY usage_count DESC
    `;

    const entries = this.db.prepare(query).all(category);
    return entries;
  }

  async getPopularEntries(limit: number = 10): Promise<KBEntry[]> {
    const query = `
      SELECT *,
        (usage_count * 0.7 + success_count * 0.3) as popularity_score
      FROM kb_entries
      WHERE usage_count > 0
      ORDER BY popularity_score DESC
      LIMIT ?
    `;

    return this.db.prepare(query).all(limit);
  }

  async getRecentSearches(userId?: string): Promise<SearchHistory[]> {
    const query = userId
      ? 'SELECT * FROM search_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT 20'
      : 'SELECT * FROM search_history ORDER BY timestamp DESC LIMIT 20';

    const params = userId ? [userId] : [];
    return this.db.prepare(query).all(...params);
  }

  async bulkUpdateEntries(updates: Array<{id: string, data: Partial<KBEntry>}>): Promise<void> {
    const updateStmt = this.db.prepare(`
      UPDATE kb_entries
      SET title = COALESCE(?, title),
          problem = COALESCE(?, problem),
          solution = COALESCE(?, solution),
          category = COALESCE(?, category),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const transaction = this.db.transaction(() => {
      updates.forEach(update => {
        updateStmt.run(
          update.data.title,
          update.data.problem,
          update.data.solution,
          update.data.category,
          update.id
        );
      });
    });

    transaction();
  }

  async getStatsByCategory(): Promise<CategoryStats[]> {
    const query = `
      SELECT
        category,
        COUNT(*) as total_entries,
        AVG(usage_count) as avg_usage,
        AVG(CASE WHEN usage_count > 0
            THEN CAST(success_count AS FLOAT) / usage_count
            ELSE 0 END) as avg_success_rate,
        MAX(created_at) as last_updated
      FROM kb_entries
      GROUP BY category
      ORDER BY total_entries DESC
    `;

    return this.db.prepare(query).all();
  }

  close(): void {
    this.db.close();
  }
}
```

### Database Event Listeners

```typescript
// services/KBEventService.ts
import { EventEmitter } from 'events';
import { KnowledgeDB } from '../database/KnowledgeDB';

export class KBEventService extends EventEmitter {
  private db: KnowledgeDB;
  private watchInterval: NodeJS.Timeout | null = null;

  constructor(db: KnowledgeDB) {
    super();
    this.db = db;
  }

  startWatching(intervalMs: number = 1000): void {
    this.watchInterval = setInterval(() => {
      this.checkForChanges();
    }, intervalMs);
  }

  stopWatching(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }

  private async checkForChanges(): Promise<void> {
    try {
      // Check for new entries
      const recentEntries = await this.db.getRecentEntries(1);
      if (recentEntries.length > 0) {
        this.emit('entry:created', recentEntries[0]);
      }

      // Check for updated entries
      const recentlyUpdated = await this.db.getRecentlyUpdated(1);
      if (recentlyUpdated.length > 0) {
        this.emit('entry:updated', recentlyUpdated[0]);
      }

      // Check for search activity
      const recentSearches = await this.db.getRecentSearches(5);
      if (recentSearches.length > 0) {
        this.emit('search:activity', recentSearches);
      }

    } catch (error) {
      this.emit('error', error);
    }
  }

  // Custom event emitters
  onEntryCreated(callback: (entry: KBEntry) => void): void {
    this.on('entry:created', callback);
  }

  onEntryUpdated(callback: (entry: KBEntry) => void): void {
    this.on('entry:updated', callback);
  }

  onSearchActivity(callback: (searches: SearchHistory[]) => void): void {
    this.on('search:activity', callback);
  }
}

// Usage example
const eventService = new KBEventService(db);

eventService.onEntryCreated((entry) => {
  console.log('New entry created:', entry.title);
  // Update UI, send notifications, etc.
});

eventService.startWatching();
```

---

## Custom Search Implementation

### Advanced Search Service

```typescript
// services/AdvancedSearchService.ts
export class AdvancedSearchService {
  private db: KnowledgeDB;
  private searchCache: Map<string, CachedSearch> = new Map();
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor(db: KnowledgeDB) {
    this.db = db;
  }

  async search(
    query: string,
    options: AdvancedSearchOptions = {}
  ): Promise<SearchResult[]> {
    const cacheKey = this.generateCacheKey(query, options);
    const cached = this.getCachedSearch(cacheKey);

    if (cached) {
      return cached.results;
    }

    const results = await this.performAdvancedSearch(query, options);

    this.cacheSearch(cacheKey, results);

    return results;
  }

  private async performAdvancedSearch(
    query: string,
    options: AdvancedSearchOptions
  ): Promise<SearchResult[]> {
    const {
      categories = [],
      tags = [],
      dateRange,
      usageRange,
      successRateRange,
      sortBy = 'relevance',
      limit = 50,
      includeContent = false
    } = options;

    // Build dynamic query
    let sql = `
      SELECT DISTINCT e.*,
        bm25(kb_entries_fts) as relevance_score,
        GROUP_CONCAT(t.tag) as all_tags
      FROM kb_entries_fts fts
      JOIN kb_entries e ON fts.entry_id = e.id
      LEFT JOIN kb_tags t ON e.id = t.entry_id
      WHERE 1=1
    `;

    const params: any[] = [];

    // Add search term
    if (query.trim()) {
      sql += ` AND kb_entries_fts MATCH ?`;
      params.push(query);
    }

    // Add category filter
    if (categories.length > 0) {
      sql += ` AND e.category IN (${categories.map(() => '?').join(',')})`;
      params.push(...categories);
    }

    // Add date range filter
    if (dateRange) {
      sql += ` AND e.created_at BETWEEN ? AND ?`;
      params.push(dateRange.start, dateRange.end);
    }

    // Add usage range filter
    if (usageRange) {
      sql += ` AND e.usage_count BETWEEN ? AND ?`;
      params.push(usageRange.min, usageRange.max);
    }

    // Add success rate filter
    if (successRateRange) {
      sql += ` AND (CASE WHEN e.usage_count > 0
                    THEN CAST(e.success_count AS FLOAT) / e.usage_count
                    ELSE 0 END) BETWEEN ? AND ?`;
      params.push(successRateRange.min, successRateRange.max);
    }

    sql += ` GROUP BY e.id`;

    // Add sorting
    switch (sortBy) {
      case 'relevance':
        sql += ` ORDER BY relevance_score DESC`;
        break;
      case 'usage':
        sql += ` ORDER BY e.usage_count DESC`;
        break;
      case 'success_rate':
        sql += ` ORDER BY (CAST(e.success_count AS FLOAT) / NULLIF(e.usage_count, 0)) DESC`;
        break;
      case 'date':
        sql += ` ORDER BY e.created_at DESC`;
        break;
    }

    sql += ` LIMIT ?`;
    params.push(limit);

    const rawResults = this.db.prepare(sql).all(...params);

    // Process results
    const results: SearchResult[] = rawResults.map(row => {
      const entry: KBEntry = {
        id: row.id,
        title: row.title,
        problem: includeContent ? row.problem : row.problem.substring(0, 200) + '...',
        solution: includeContent ? row.solution : '',
        category: row.category,
        tags: row.all_tags ? row.all_tags.split(',') : [],
        created_at: row.created_at,
        updated_at: row.updated_at,
        usage_count: row.usage_count,
        success_count: row.success_count
      };

      return {
        entry,
        score: row.relevance_score || 0,
        highlights: this.generateHighlights(query, entry)
      };
    });

    // Apply tag filtering (post-processing for complex tag logic)
    if (tags.length > 0) {
      return results.filter(result =>
        tags.some(tag => result.entry.tags?.includes(tag))
      );
    }

    return results;
  }

  private generateHighlights(query: string, entry: KBEntry): SearchHighlight[] {
    const highlights: SearchHighlight[] = [];
    const queryTerms = query.toLowerCase().split(/\s+/);

    // Search in title
    queryTerms.forEach(term => {
      const titleIndex = entry.title.toLowerCase().indexOf(term);
      if (titleIndex !== -1) {
        highlights.push({
          field: 'title',
          start: titleIndex,
          end: titleIndex + term.length,
          text: term
        });
      }

      const problemIndex = entry.problem.toLowerCase().indexOf(term);
      if (problemIndex !== -1) {
        highlights.push({
          field: 'problem',
          start: problemIndex,
          end: problemIndex + term.length,
          text: term
        });
      }
    });

    return highlights;
  }

  private generateCacheKey(query: string, options: AdvancedSearchOptions): string {
    return `search:${JSON.stringify({ query, ...options })}`;
  }

  private getCachedSearch(key: string): CachedSearch | null {
    const cached = this.searchCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached;
    }
    return null;
  }

  private cacheSearch(key: string, results: SearchResult[]): void {
    this.searchCache.set(key, {
      results,
      timestamp: Date.now()
    });

    // Clean old cache entries
    if (this.searchCache.size > 100) {
      const oldestKey = this.searchCache.keys().next().value;
      this.searchCache.delete(oldestKey);
    }
  }
}
```

### Search Analytics Integration

```typescript
// services/SearchAnalyticsService.ts
export class SearchAnalyticsService {
  private db: KnowledgeDB;

  constructor(db: KnowledgeDB) {
    this.db = db;
  }

  async trackSearch(
    query: string,
    results: SearchResult[],
    userId?: string,
    metadata?: any
  ): Promise<void> {
    const searchLog = {
      query,
      results_count: results.length,
      user_id: userId,
      timestamp: new Date(),
      metadata: JSON.stringify(metadata || {})
    };

    await this.db.logSearch(searchLog);
  }

  async getSearchAnalytics(timeRange: TimeRange): Promise<SearchAnalytics> {
    const analytics = {
      totalSearches: await this.getTotalSearches(timeRange),
      topQueries: await this.getTopQueries(timeRange, 10),
      searchTrends: await this.getSearchTrends(timeRange),
      noResultQueries: await this.getNoResultQueries(timeRange, 10),
      averageResults: await this.getAverageResults(timeRange),
      userActivity: await this.getUserActivity(timeRange)
    };

    return analytics;
  }

  private async getTotalSearches(timeRange: TimeRange): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM search_history
      WHERE timestamp BETWEEN ? AND ?
    `;

    const result = this.db.prepare(query).get(timeRange.start, timeRange.end);
    return result.count;
  }

  private async getTopQueries(timeRange: TimeRange, limit: number): Promise<QueryFrequency[]> {
    const query = `
      SELECT query, COUNT(*) as frequency
      FROM search_history
      WHERE timestamp BETWEEN ? AND ?
        AND query != ''
      GROUP BY LOWER(query)
      ORDER BY frequency DESC
      LIMIT ?
    `;

    return this.db.prepare(query).all(timeRange.start, timeRange.end, limit);
  }

  private async getSearchTrends(timeRange: TimeRange): Promise<SearchTrend[]> {
    const query = `
      SELECT
        DATE(timestamp) as date,
        COUNT(*) as searches,
        AVG(results_count) as avg_results
      FROM search_history
      WHERE timestamp BETWEEN ? AND ?
      GROUP BY DATE(timestamp)
      ORDER BY date
    `;

    return this.db.prepare(query).all(timeRange.start, timeRange.end);
  }
}
```

---

## Virtual Scrolling Integration

### Custom Virtual Scrolling Component

```tsx
// components/CustomVirtualScrolling.tsx
import React, { useMemo, useCallback } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

interface CustomVirtualScrollingProps<T> {
  items: T[];
  itemHeight: number;
  height: number;
  width: number;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  onItemClick?: (item: T, index: number) => void;
}

export function CustomVirtualScrolling<T extends { id: string }>({
  items,
  itemHeight,
  height,
  width,
  hasMore,
  loadMore,
  renderItem,
  onItemClick
}: CustomVirtualScrollingProps<T>) {
  const itemCount = hasMore ? items.length + 1 : items.length;

  const isItemLoaded = useCallback((index: number) => {
    return index < items.length;
  }, [items.length]);

  const Item = useCallback(({ index, style }: ListChildComponentProps) => {
    if (index >= items.length) {
      return (
        <div style={style} className="loading-item">
          Loading...
        </div>
      );
    }

    const item = items[index];

    return (
      <div
        style={style}
        className="virtual-scroll-item"
        onClick={() => onItemClick?.(item, index)}
      >
        {renderItem(item, index, style)}
      </div>
    );
  }, [items, renderItem, onItemClick]);

  const memoizedItem = React.memo(Item);

  return (
    <InfiniteLoader
      isItemLoaded={isItemLoaded}
      itemCount={itemCount}
      loadMoreItems={loadMore}
    >
      {({ onItemsRendered, ref }) => (
        <FixedSizeList
          ref={ref}
          height={height}
          width={width}
          itemCount={itemCount}
          itemSize={itemHeight}
          onItemsRendered={onItemsRendered}
          overscanCount={5}
        >
          {memoizedItem}
        </FixedSizeList>
      )}
    </InfiniteLoader>
  );
}
```

### Virtual Scrolling with KB Integration

```tsx
// components/VirtualKBList.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { CustomVirtualScrolling } from './CustomVirtualScrolling';
import { useKBData } from '../hooks/useKBData';
import { KBEntry } from '../types/kb';

interface VirtualKBListProps {
  searchQuery?: string;
  filters?: SearchFilters;
  onEntryClick?: (entry: KBEntry) => void;
  itemHeight?: number;
}

export const VirtualKBList: React.FC<VirtualKBListProps> = ({
  searchQuery,
  filters,
  onEntryClick,
  itemHeight = 120
}) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

  const {
    entries,
    loading,
    hasMore,
    loadMore,
    totalCount
  } = useKBData({
    limit: visibleRange.end - visibleRange.start,
    offset: visibleRange.start,
    searchQuery,
    filters
  });

  const handleLoadMore = useCallback(async () => {
    if (!loading && hasMore) {
      await loadMore();
    }
  }, [loading, hasMore, loadMore]);

  const renderKBItem = useCallback((
    entry: KBEntry,
    index: number,
    style: React.CSSProperties
  ) => {
    return (
      <div className="kb-virtual-item">
        <div className="kb-item-header">
          <h3 className="kb-item-title">{entry.title}</h3>
          <span className="kb-item-category">{entry.category}</span>
        </div>

        <p className="kb-item-problem">
          {entry.problem.substring(0, 150)}...
        </p>

        <div className="kb-item-meta">
          <span>Used {entry.usage_count} times</span>
          <span>
            Success: {entry.usage_count > 0
              ? Math.round((entry.success_count / entry.usage_count) * 100)
              : 0}%
          </span>
        </div>

        {entry.tags && entry.tags.length > 0 && (
          <div className="kb-item-tags">
            {entry.tags.map(tag => (
              <span key={tag} className="kb-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
    );
  }, []);

  return (
    <div className="virtual-kb-list">
      <CustomVirtualScrolling
        items={entries}
        itemHeight={itemHeight}
        height={600} // Configure based on container
        width="100%"
        hasMore={hasMore}
        loadMore={handleLoadMore}
        renderItem={renderKBItem}
        onItemClick={onEntryClick}
      />

      {loading && (
        <div className="kb-loading-indicator">
          Loading more entries...
        </div>
      )}
    </div>
  );
};
```

---

## Performance Integration

### Performance Monitoring Integration

```tsx
// hooks/usePerformanceMonitoring.ts
import { useEffect, useRef, useCallback } from 'react';
import { PerformanceMonitor } from '../services/PerformanceMonitor';

export const usePerformanceMonitoring = (enabled: boolean = true) => {
  const monitor = useRef<PerformanceMonitor | null>(null);

  useEffect(() => {
    if (enabled && !monitor.current) {
      monitor.current = new PerformanceMonitor({
        enableMetrics: true,
        sampleRate: 0.1 // Sample 10% of operations
      });
    }

    return () => {
      if (monitor.current) {
        monitor.current.stop();
        monitor.current = null;
      }
    };
  }, [enabled]);

  const measureOperation = useCallback(<T,>(
    operationName: string,
    operation: () => T | Promise<T>,
    metadata?: any
  ): Promise<T> => {
    if (!monitor.current || !enabled) {
      return Promise.resolve(operation());
    }

    const timer = monitor.current.startTimer(operationName);

    try {
      const result = operation();

      if (result instanceof Promise) {
        return result.finally(() => timer.end(metadata));
      } else {
        timer.end(metadata);
        return Promise.resolve(result);
      }
    } catch (error) {
      timer.end({ ...metadata, error: error.message });
      throw error;
    }
  }, [enabled]);

  const getMetrics = useCallback(() => {
    return monitor.current?.getMetrics() || new Map();
  }, []);

  const getReport = useCallback(() => {
    return monitor.current?.getReport() || null;
  }, []);

  return {
    measureOperation,
    getMetrics,
    getReport
  };
};
```

### Optimized Component with Performance Monitoring

```tsx
// components/OptimizedKBComponent.tsx
import React, { memo, useCallback, useMemo } from 'react';
import { usePerformanceMonitoring } from '../hooks/usePerformanceMonitoring';
import { useKBData } from '../hooks/useKBData';

interface OptimizedKBComponentProps {
  searchQuery: string;
  filters: SearchFilters;
}

const OptimizedKBComponent: React.FC<OptimizedKBComponentProps> = memo(({
  searchQuery,
  filters
}) => {
  const { measureOperation } = usePerformanceMonitoring(process.env.NODE_ENV === 'development');

  const {
    entries,
    loading,
    search
  } = useKBData();

  const performSearch = useCallback(async (query: string) => {
    await measureOperation('kb-search', async () => {
      return await search(query, { filters });
    }, { query, filterCount: Object.keys(filters).length });
  }, [search, filters, measureOperation]);

  const memoizedEntries = useMemo(() => {
    return measureOperation('entries-processing', () => {
      return entries.map(entry => ({
        ...entry,
        truncatedProblem: entry.problem.substring(0, 150) + '...',
        successRate: entry.usage_count > 0
          ? (entry.success_count / entry.usage_count) * 100
          : 0
      }));
    });
  }, [entries, measureOperation]);

  const renderEntry = useCallback((entry: ProcessedKBEntry) => (
    <div key={entry.id} className="optimized-kb-entry">
      <h3>{entry.title}</h3>
      <p>{entry.truncatedProblem}</p>
      <div className="entry-stats">
        <span>Usage: {entry.usage_count}</span>
        <span>Success: {entry.successRate.toFixed(1)}%</span>
      </div>
    </div>
  ), []);

  return (
    <div className="optimized-kb-component">
      {memoizedEntries.map(renderEntry)}
    </div>
  );
});

OptimizedKBComponent.displayName = 'OptimizedKBComponent';

export default OptimizedKBComponent;
```

---

## Testing Integration

### Testing Utilities

```typescript
// test/utils/kb-test-utils.ts
import { render, RenderOptions } from '@testing-library/react';
import React, { ReactElement } from 'react';
import { KBProvider } from '../../src/components/KB/KBProvider';
import { KnowledgeDB } from '../../src/database/KnowledgeDB';

// Create test database
export const createTestDB = async (): Promise<KnowledgeDB> => {
  const db = new KnowledgeDB(':memory:');
  await db.initialize();

  // Add test data
  const testEntries = [
    {
      title: 'Test Entry 1',
      problem: 'Test problem description',
      solution: 'Test solution steps',
      category: 'Test',
      tags: ['test', 'example']
    },
    {
      title: 'Another Test Entry',
      problem: 'Another test problem',
      solution: 'Another test solution',
      category: 'Test',
      tags: ['test', 'sample']
    }
  ];

  for (const entry of testEntries) {
    await db.addEntry(entry);
  }

  return db;
};

// Custom render with KB provider
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  db?: KnowledgeDB;
}

export const renderWithKBProvider = async (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { db = await createTestDB(), ...renderOptions } = options;

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <KBProvider dbPath=":memory:" initialDB={db}>
      {children}
    </KBProvider>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Mock data generators
export const createMockKBEntry = (overrides: Partial<KBEntry> = {}): KBEntry => ({
  id: 'test-id-' + Math.random(),
  title: 'Mock Entry',
  problem: 'Mock problem description',
  solution: 'Mock solution steps',
  category: 'Test',
  tags: ['mock', 'test'],
  created_at: new Date(),
  updated_at: new Date(),
  usage_count: 5,
  success_count: 4,
  ...overrides
});

export const createMockSearchResults = (count: number = 5): SearchResult[] => {
  return Array.from({ length: count }, (_, index) => ({
    entry: createMockKBEntry({
      id: `mock-${index}`,
      title: `Mock Entry ${index + 1}`
    }),
    score: 95 - (index * 10),
    highlights: []
  }));
};
```

### Component Testing Examples

```typescript
// test/components/KBComponent.test.tsx
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithKBProvider } from '../utils/kb-test-utils';
import { AdvancedKBEntryList } from '../../src/components/KB/AdvancedKBEntryList';

describe('AdvancedKBEntryList', () => {
  test('renders KB entries correctly', async () => {
    await renderWithKBProvider(<AdvancedKBEntryList />);

    expect(screen.getByText('Test Entry 1')).toBeInTheDocument();
    expect(screen.getByText('Another Test Entry')).toBeInTheDocument();
  });

  test('filters entries by search query', async () => {
    const { user } = await renderWithKBProvider(<AdvancedKBEntryList />);

    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'Test Entry 1');

    await waitFor(() => {
      expect(screen.getByText('Test Entry 1')).toBeInTheDocument();
      expect(screen.queryByText('Another Test Entry')).not.toBeInTheDocument();
    });
  });

  test('handles entry selection', async () => {
    const onSelectionChange = jest.fn();

    await renderWithKBProvider(
      <AdvancedKBEntryList
        selectedEntries={[]}
        onSelectionChange={onSelectionChange}
      />
    );

    const checkbox = screen.getAllByRole('checkbox')[0];
    await fireEvent.click(checkbox);

    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.any(String)])
    );
  });

  test('handles virtual scrolling', async () => {
    const virtualScrollingProps = {
      enabled: true,
      itemHeight: 100,
      overscan: 3
    };

    await renderWithKBProvider(
      <AdvancedKBEntryList virtualScrolling={virtualScrollingProps} />
    );

    // Test that virtual scrolling container is rendered
    expect(screen.getByTestId('virtual-scroll-container')).toBeInTheDocument();
  });
});
```

### Hook Testing Examples

```typescript
// test/hooks/useKBData.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useKBData } from '../../src/hooks/useKBData';
import { createTestDB, createMockKBEntry } from '../utils/kb-test-utils';

describe('useKBData hook', () => {
  test('loads initial entries', async () => {
    const db = await createTestDB();

    const { result } = renderHook(() => useKBData(), {
      wrapper: ({ children }) => (
        <KBProvider dbPath=":memory:" initialDB={db}>
          {children}
        </KBProvider>
      )
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0].title).toBe('Test Entry 1');
  });

  test('performs search operation', async () => {
    const db = await createTestDB();

    const { result } = renderHook(() => useKBData(), {
      wrapper: ({ children }) => (
        <KBProvider dbPath=":memory:" initialDB={db}>
          {children}
        </KBProvider>
      )
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const searchResults = await result.current.search('Test Entry 1');

    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].entry.title).toBe('Test Entry 1');
  });

  test('adds new entry', async () => {
    const db = await createTestDB();

    const { result } = renderHook(() => useKBData(), {
      wrapper: ({ children }) => (
        <KBProvider dbPath=":memory:" initialDB={db}>
          {children}
        </KBProvider>
      )
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const newEntry = createMockKBEntry({
      title: 'New Test Entry',
      problem: 'New problem',
      solution: 'New solution'
    });

    await result.current.addEntry(newEntry);

    expect(result.current.entries).toHaveLength(3);
    expect(result.current.entries.find(e => e.title === 'New Test Entry')).toBeDefined();
  });
});
```

---

## Migration from Legacy Systems

### Migration Strategy

```typescript
// services/KBMigrationService.ts
export class KBMigrationService {
  private sourceDB: any; // Legacy database connection
  private targetDB: KnowledgeDB;

  constructor(sourceDB: any, targetDB: KnowledgeDB) {
    this.sourceDB = sourceDB;
    this.targetDB = targetDB;
  }

  async migrate(options: MigrationOptions = {}): Promise<MigrationResult> {
    const {
      batchSize = 100,
      validateData = true,
      preserveIds = false,
      categoryMapping = {},
      tagNormalization = true
    } = options;

    const migrationResult: MigrationResult = {
      totalRecords: 0,
      migratedRecords: 0,
      failedRecords: 0,
      errors: [],
      warnings: []
    };

    try {
      // Get total count
      migrationResult.totalRecords = await this.getTotalRecordsCount();

      // Process in batches
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const batch = await this.getLegacyBatch(offset, batchSize);
        hasMore = batch.length === batchSize;

        for (const legacyRecord of batch) {
          try {
            const kbEntry = await this.transformLegacyRecord(
              legacyRecord,
              categoryMapping,
              tagNormalization
            );

            if (validateData && !this.validateKBEntry(kbEntry)) {
              migrationResult.warnings.push(`Validation failed for record: ${legacyRecord.id}`);
              continue;
            }

            const entryId = preserveIds ? legacyRecord.id : undefined;
            await this.targetDB.addEntry({ ...kbEntry, id: entryId });

            migrationResult.migratedRecords++;

          } catch (error) {
            migrationResult.failedRecords++;
            migrationResult.errors.push({
              recordId: legacyRecord.id,
              error: error.message
            });
          }
        }

        offset += batchSize;

        // Progress callback
        if (options.onProgress) {
          options.onProgress({
            processed: offset,
            total: migrationResult.totalRecords,
            migrated: migrationResult.migratedRecords,
            failed: migrationResult.failedRecords
          });
        }
      }

      // Post-migration tasks
      await this.runPostMigrationTasks();

    } catch (error) {
      throw new Error(`Migration failed: ${error.message}`);
    }

    return migrationResult;
  }

  private async transformLegacyRecord(
    legacyRecord: any,
    categoryMapping: Record<string, string>,
    normalizeTagsVal: boolean
  ): Promise<KBEntry> {
    // Transform legacy record to KB entry format
    const kbEntry: KBEntry = {
      title: this.cleanText(legacyRecord.title || legacyRecord.summary),
      problem: this.cleanText(legacyRecord.description || legacyRecord.issue),
      solution: this.cleanText(legacyRecord.resolution || legacyRecord.fix),
      category: this.mapCategory(legacyRecord.category, categoryMapping),
      tags: this.normalizeTags(legacyRecord.tags || legacyRecord.keywords, normalizeTagsVal),
      created_at: new Date(legacyRecord.created_date || legacyRecord.timestamp),
      usage_count: legacyRecord.view_count || 0,
      success_count: legacyRecord.helpful_count || 0
    };

    return kbEntry;
  }

  private mapCategory(legacyCategory: string, mapping: Record<string, string>): string {
    if (!legacyCategory) return 'Other';

    const mapped = mapping[legacyCategory.toLowerCase()];
    if (mapped) return mapped;

    // Try to infer category from common patterns
    const category = legacyCategory.toLowerCase();
    if (category.includes('jcl')) return 'JCL';
    if (category.includes('vsam')) return 'VSAM';
    if (category.includes('db2')) return 'DB2';
    if (category.includes('batch')) return 'Batch';
    if (category.includes('cobol')) return 'Batch';

    return 'Other';
  }

  private normalizeTags(legacyTags: string | string[], normalize: boolean): string[] {
    if (!legacyTags) return [];

    let tags: string[];
    if (typeof legacyTags === 'string') {
      tags = legacyTags.split(/[,;|]/);
    } else {
      tags = legacyTags;
    }

    if (normalize) {
      tags = tags.map(tag =>
        tag.trim()
           .toLowerCase()
           .replace(/[^a-z0-9-]/g, '-')
           .replace(/-+/g, '-')
           .replace(/^-|-$/g, '')
      );
    }

    return tags.filter(tag => tag.length > 0);
  }

  private cleanText(text: string): string {
    if (!text) return '';

    return text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\x20-\x7E]/g, '') // Remove non-printable characters
      .substring(0, 5000); // Limit length
  }

  private validateKBEntry(entry: KBEntry): boolean {
    if (!entry.title || entry.title.length < 3) return false;
    if (!entry.problem || entry.problem.length < 10) return false;
    if (!entry.solution || entry.solution.length < 10) return false;
    if (!entry.category) return false;

    return true;
  }

  private async runPostMigrationTasks(): Promise<void> {
    // Rebuild FTS index
    await this.targetDB.rebuildSearchIndex();

    // Update statistics
    await this.targetDB.updateStatistics();

    // Validate data integrity
    await this.validateMigrationIntegrity();
  }
}
```

### Migration CLI Tool

```javascript
// scripts/migrate-legacy-kb.js
const { KBMigrationService } = require('../src/services/KBMigrationService');
const { KnowledgeDB } = require('../src/database/KnowledgeDB');
const Database = require('better-sqlite3');

async function runMigration() {
  const config = {
    legacyDbPath: process.argv[2] || './legacy/knowledge.db',
    targetDbPath: process.argv[3] || './data/knowledge.db',
    batchSize: parseInt(process.argv[4]) || 100
  };

  console.log('🚀 Starting Knowledge Base Migration');
  console.log('=====================================');
  console.log(`Legacy DB: ${config.legacyDbPath}`);
  console.log(`Target DB: ${config.targetDbPath}`);
  console.log(`Batch Size: ${config.batchSize}`);

  try {
    // Initialize databases
    const legacyDB = new Database(config.legacyDbPath);
    const targetDB = new KnowledgeDB(config.targetDbPath);

    const migrationService = new KBMigrationService(legacyDB, targetDB);

    // Category mapping for legacy systems
    const categoryMapping = {
      'mainframe': 'Batch',
      'jcl_jobs': 'JCL',
      'vsam_files': 'VSAM',
      'database': 'DB2',
      'application': 'Functional'
    };

    // Run migration
    const result = await migrationService.migrate({
      batchSize: config.batchSize,
      validateData: true,
      categoryMapping,
      tagNormalization: true,
      onProgress: (progress) => {
        const percent = Math.round((progress.processed / progress.total) * 100);
        console.log(`Progress: ${percent}% (${progress.migrated} migrated, ${progress.failed} failed)`);
      }
    });

    // Print results
    console.log('\n✅ Migration completed!');
    console.log('======================');
    console.log(`Total records: ${result.totalRecords}`);
    console.log(`Migrated: ${result.migratedRecords}`);
    console.log(`Failed: ${result.failedRecords}`);
    console.log(`Warnings: ${result.warnings.length}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      result.errors.forEach(error => {
        console.log(`  - Record ${error.recordId}: ${error.error}`);
      });
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach(warning => {
        console.log(`  - ${warning}`);
      });
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration();
}
```

---

This integration guide provides comprehensive instructions for integrating the Knowledge Base system into existing applications at various levels - from simple component usage to advanced custom implementations. The examples demonstrate best practices for performance, testing, and migration from legacy systems.