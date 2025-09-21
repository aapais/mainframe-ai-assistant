# Knowledge Base Performance Tuning Guide

## Table of Contents

1. [Performance Overview](#performance-overview)
2. [Database Optimization](#database-optimization)
3. [Search Performance](#search-performance)
4. [Virtual Scrolling Optimization](#virtual-scrolling-optimization)
5. [Caching Strategies](#caching-strategies)
6. [Memory Management](#memory-management)
7. [Network Optimization](#network-optimization)
8. [Monitoring & Diagnostics](#monitoring--diagnostics)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## Performance Overview

The Knowledge Base system is designed to handle large datasets (10,000+ entries) with sub-second response times. This guide provides comprehensive strategies for optimizing performance across all system components.

### Performance Targets

| Component | Target | Acceptable | Critical |
|-----------|--------|------------|----------|
| **Search Response** | < 500ms | < 1s | > 2s |
| **Entry Loading** | < 200ms | < 500ms | > 1s |
| **Batch Operations** | < 2s per 100 items | < 5s | > 10s |
| **UI Responsiveness** | < 100ms | < 200ms | > 500ms |
| **Database Queries** | < 50ms | < 100ms | > 500ms |
| **Memory Usage** | < 200MB | < 500MB | > 1GB |

### System Architecture Impact

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Data Layer    │    │   Database      │
│                 │    │                 │    │                 │
│ • Virtual List  │◄──►│ • Query Cache   │◄──►│ • Indexes       │
│ • Component     │    │ • Result Cache  │    │ • FTS5 Search   │
│   Memoization   │    │ • Connection    │    │ • Query Opt.    │
│ • State Mgmt    │    │   Pooling       │    │ • Statistics    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## Database Optimization

### Index Strategy

#### Core Indexes

The database uses strategically placed indexes to optimize query performance:

```sql
-- Primary performance indexes
CREATE INDEX idx_kb_entries_usage_archived ON kb_entries(usage_count DESC, archived);
CREATE INDEX idx_kb_entries_category_archived ON kb_entries(category, archived);
CREATE INDEX idx_kb_entries_created_archived ON kb_entries(created_at DESC, archived);
CREATE INDEX idx_kb_entries_updated_archived ON kb_entries(updated_at DESC, archived);

-- Search-specific indexes
CREATE INDEX idx_kb_tags_tag_entry ON kb_tags(tag, entry_id);
CREATE INDEX idx_search_history_query_timestamp ON search_history(query, timestamp DESC);

-- Composite indexes for common queries
CREATE INDEX idx_entries_active_usage_category ON kb_entries(archived, usage_count DESC, category);
```

#### Index Maintenance

```sql
-- Weekly index maintenance script
PRAGMA optimize;                    -- Update query planner statistics
ANALYZE;                           -- Refresh index statistics

-- Monitor index usage
.eqp on
EXPLAIN QUERY PLAN SELECT * FROM kb_entries WHERE category = 'VSAM' AND archived = FALSE;

-- Rebuild FTS5 index if fragmented
INSERT INTO kb_fts(kb_fts) VALUES('optimize');
```

### Query Optimization

#### Optimized Search Query

```sql
-- High-performance search query with proper index usage
WITH ranked_results AS (
    SELECT
        e.*,
        bm25(f, 3.0, 2.0, 1.5, 1.0) as relevance_score,
        CASE WHEN (e.success_count + e.failure_count) > 0
             THEN CAST(e.success_count AS REAL) / (e.success_count + e.failure_count)
             ELSE 0 END as success_rate
    FROM kb_fts f
    JOIN kb_entries e ON f.id = e.id
    WHERE f MATCH ?
      AND e.archived = FALSE
      AND (? IS NULL OR e.category = ?)
)
SELECT
    r.*,
    GROUP_CONCAT(DISTINCT t.tag, ', ') as tags
FROM ranked_results r
LEFT JOIN kb_tags t ON r.id = t.entry_id
GROUP BY r.id
ORDER BY
    r.relevance_score DESC,
    r.usage_count DESC,
    r.success_rate DESC
LIMIT ?;
```

#### Performance Analysis Tools

```typescript
class QueryPerformanceAnalyzer {
  private queryTimes = new Map<string, number[]>();

  measureQuery<T>(queryName: string, queryFn: () => Promise<T>): Promise<T> {
    const start = performance.now();

    return queryFn().then(result => {
      const duration = performance.now() - start;
      this.recordQueryTime(queryName, duration);

      if (duration > 1000) {
        console.warn(`Slow query detected: ${queryName} took ${duration.toFixed(2)}ms`);
      }

      return result;
    });
  }

  private recordQueryTime(queryName: string, duration: number) {
    if (!this.queryTimes.has(queryName)) {
      this.queryTimes.set(queryName, []);
    }

    const times = this.queryTimes.get(queryName)!;
    times.push(duration);

    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }
  }

  getQueryStats(queryName: string) {
    const times = this.queryTimes.get(queryName) || [];
    if (times.length === 0) return null;

    const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
    const sorted = [...times].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return { avg, p95, p99, count: times.length };
  }
}
```

### Database Configuration

#### SQLite Optimization

```sql
-- Optimize SQLite for performance
PRAGMA journal_mode = WAL;          -- Enable Write-Ahead Logging
PRAGMA synchronous = NORMAL;        -- Balance safety and performance
PRAGMA cache_size = -64000;         -- 64MB cache
PRAGMA temp_store = MEMORY;         -- Use memory for temporary tables
PRAGMA mmap_size = 268435456;       -- 256MB memory mapping
PRAGMA optimize;                    -- Enable query optimizer
```

#### Connection Pool Configuration

```typescript
const connectionPoolConfig = {
  maxReaders: 5,           // Maximum concurrent read connections
  maxWriters: 1,           // Single writer to avoid conflicts
  acquireTimeout: 30000,   // 30s timeout for acquiring connections
  idleTimeout: 300000,     // 5min idle timeout
  enableWAL: true,         // Use Write-Ahead Logging
  busyTimeout: 30000       // 30s timeout for busy database
};
```

---

## Search Performance

### Search Strategy Optimization

#### Intelligent Search Routing

```typescript
class SearchOptimizer {
  selectOptimalStrategy(query: string, options: SearchOptions): SearchStrategy {
    // Strategy 1: Exact match for error codes (fastest)
    if (this.isErrorCode(query)) {
      return {
        type: 'exact',
        estimatedTime: 50,     // 50ms estimated
        cacheability: 'high'
      };
    }

    // Strategy 2: Category search with indexes
    if (options.category || query.startsWith('category:')) {
      return {
        type: 'category',
        estimatedTime: 100,    // 100ms estimated
        cacheability: 'high'
      };
    }

    // Strategy 3: FTS5 for general queries
    if (query.length > 2 && !this.isComplexQuery(query)) {
      return {
        type: 'fts',
        estimatedTime: 200,    // 200ms estimated
        cacheability: 'medium'
      };
    }

    // Strategy 4: Hybrid for complex queries
    return {
      type: 'hybrid',
      estimatedTime: 500,    // 500ms estimated
      cacheability: 'low'
    };
  }

  private isErrorCode(query: string): boolean {
    return /^[A-Z]\d{3,4}[A-Z]?$/.test(query) || /^S\d{3}[A-Z]?$/.test(query);
  }

  private isComplexQuery(query: string): boolean {
    return query.split(/\s+/).length > 5 || /[()&|"*]/.test(query);
  }
}
```

#### Search Result Caching

```typescript
interface SearchCache {
  key: string;
  results: SearchResult[];
  timestamp: number;
  ttl: number;
  hitCount: number;
}

class SearchResultCache {
  private cache = new Map<string, SearchCache>();
  private readonly maxSize = 1000;
  private readonly defaultTTL = 300000; // 5 minutes

  get(query: string, options: SearchOptions): SearchResult[] | null {
    const key = this.generateKey(query, options);
    const cached = this.cache.get(key);

    if (!cached || Date.now() - cached.timestamp > cached.ttl) {
      return null;
    }

    cached.hitCount++;
    return cached.results;
  }

  set(query: string, options: SearchOptions, results: SearchResult[]): void {
    const key = this.generateKey(query, options);

    // Evict least recently used if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // Determine TTL based on query characteristics
    const ttl = this.calculateTTL(query, options);

    this.cache.set(key, {
      key,
      results,
      timestamp: Date.now(),
      ttl,
      hitCount: 0
    });
  }

  private calculateTTL(query: string, options: SearchOptions): number {
    // Error codes and categories are more stable
    if (this.isErrorCode(query) || options.category) {
      return this.defaultTTL * 2; // 10 minutes
    }

    // Text searches change more frequently
    return this.defaultTTL;
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, cached] of this.cache.entries()) {
      if (cached.timestamp < oldestTime) {
        oldestTime = cached.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}
```

### Auto-complete Optimization

#### Pre-computed Suggestions

```sql
-- Pre-compute auto-complete suggestions
CREATE TABLE auto_complete_cache (
    prefix TEXT PRIMARY KEY,
    suggestions TEXT NOT NULL,  -- JSON array
    frequency INTEGER DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Populate cache with common prefixes
INSERT INTO auto_complete_cache (prefix, suggestions, frequency)
SELECT
    SUBSTR(query, 1, 3) as prefix,
    json_group_array(DISTINCT query) as suggestions,
    COUNT(*) as frequency
FROM search_history
WHERE LENGTH(query) >= 3
  AND timestamp > datetime('now', '-30 days')
GROUP BY SUBSTR(query, 1, 3)
HAVING COUNT(*) >= 5
ORDER BY frequency DESC;
```

#### Fast Auto-complete Implementation

```typescript
class AutoCompleteOptimizer {
  private prefixCache = new Map<string, string[]>();
  private readonly minPrefixLength = 2;
  private readonly maxSuggestions = 8;

  async getSuggestions(query: string): Promise<string[]> {
    if (query.length < this.minPrefixLength) return [];

    const prefix = query.toLowerCase().substring(0, 3);

    // Check in-memory cache first
    let suggestions = this.prefixCache.get(prefix);

    if (!suggestions) {
      suggestions = await this.loadPrefixSuggestions(prefix);
      this.prefixCache.set(prefix, suggestions);
    }

    // Filter suggestions by full query and rank
    return suggestions
      .filter(suggestion => suggestion.toLowerCase().includes(query.toLowerCase()))
      .slice(0, this.maxSuggestions);
  }

  private async loadPrefixSuggestions(prefix: string): Promise<string[]> {
    const cached = await this.db.prepare(`
      SELECT suggestions FROM auto_complete_cache
      WHERE prefix = ? AND last_updated > datetime('now', '-1 day')
    `).get(prefix);

    if (cached) {
      return JSON.parse(cached.suggestions);
    }

    // Generate suggestions if not cached
    return this.generateSuggestions(prefix);
  }

  private async generateSuggestions(prefix: string): Promise<string[]> {
    const results = await this.db.prepare(`
      SELECT DISTINCT query, COUNT(*) as frequency
      FROM search_history
      WHERE query LIKE ? || '%'
        AND LENGTH(query) >= 3
        AND timestamp > datetime('now', '-30 days')
      GROUP BY query
      ORDER BY frequency DESC, LENGTH(query) ASC
      LIMIT ?
    `).all(prefix, this.maxSuggestions * 2);

    const suggestions = results.map(r => r.query);

    // Cache the results
    await this.db.prepare(`
      INSERT OR REPLACE INTO auto_complete_cache (prefix, suggestions, frequency)
      VALUES (?, ?, ?)
    `).run(prefix, JSON.stringify(suggestions), results.length);

    return suggestions;
  }
}
```

---

## Virtual Scrolling Optimization

### Component Optimization

#### Memoized Virtual List

```typescript
const OptimizedVirtualList = memo<VirtualListProps>(({
  items,
  itemHeight,
  height,
  renderItem,
  getItemKey
}) => {
  const listRef = useRef<FixedSizeList>(null);

  // Optimize item data to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    items,
    renderItem
  }), [items, renderItem]);

  // Memoized item renderer
  const MemoizedItem = useMemo(() =>
    memo(({ index, style, data }) => {
      const item = data.items[index];
      return (
        <div style={style}>
          {data.renderItem(item, index)}
        </div>
      );
    }, (prevProps, nextProps) => {
      // Custom comparison to prevent unnecessary renders
      const prevItem = prevProps.data.items[prevProps.index];
      const nextItem = nextProps.data.items[nextProps.index];

      return (
        prevItem.id === nextItem.id &&
        prevItem.updated_at === nextItem.updated_at &&
        prevProps.index === nextProps.index
      );
    })
  , []);

  return (
    <FixedSizeList
      ref={listRef}
      height={height}
      itemCount={items.length}
      itemSize={itemHeight}
      itemData={itemData}
      overscanCount={5}  // Render 5 items outside visible area
      itemKey={(index) => getItemKey(items[index])}
    >
      {MemoizedItem}
    </FixedSizeList>
  );
}, (prevProps, nextProps) => {
  // List-level memoization
  return (
    prevProps.items.length === nextProps.items.length &&
    prevProps.itemHeight === nextProps.itemHeight &&
    prevProps.height === nextProps.height &&
    prevProps.items.every((item, index) =>
      item.id === nextProps.items[index]?.id &&
      item.updated_at === nextProps.items[index]?.updated_at
    )
  );
});
```

#### Optimized Item Component

```typescript
const KBEntryItem = memo<KBEntryItemProps>(({
  entry,
  isSelected,
  isEditing,
  onSelect,
  onToggleSelect
}) => {
  // Memoize expensive calculations
  const successRate = useMemo(() => {
    if (!entry.success_count || !entry.failure_count) return null;
    const total = entry.success_count + entry.failure_count;
    return total > 0 ? Math.round((entry.success_count / total) * 100) : 0;
  }, [entry.success_count, entry.failure_count]);

  // Memoize event handlers
  const handleClick = useCallback(() => {
    onSelect(entry);
  }, [entry, onSelect]);

  const handleSelectToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect(entry);
  }, [entry, onToggleSelect]);

  return (
    <div
      className={`kb-entry-item ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
      onClick={handleClick}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={handleSelectToggle}
        onClick={(e) => e.stopPropagation()}
      />

      <div className="entry-content">
        <h3 className="entry-title">{entry.title}</h3>
        <div className="entry-metadata">
          <span className="entry-category">{entry.category}</span>
          {successRate !== null && (
            <span className="entry-success">{successRate}%</span>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Precise comparison to prevent unnecessary re-renders
  return (
    prevProps.entry.id === nextProps.entry.id &&
    prevProps.entry.title === nextProps.entry.title &&
    prevProps.entry.updated_at === nextProps.entry.updated_at &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isEditing === nextProps.isEditing
  );
});
```

### Scrolling Performance

#### Smooth Scrolling Implementation

```typescript
class SmoothScrollManager {
  private animationId: number | null = null;
  private targetPosition = 0;
  private currentPosition = 0;
  private startTime = 0;
  private duration = 300; // Animation duration in ms

  scrollToPosition(
    listRef: React.RefObject<FixedSizeList>,
    targetIndex: number,
    smooth = true
  ) {
    if (!listRef.current) return;

    if (!smooth) {
      listRef.current.scrollToItem(targetIndex, 'start');
      return;
    }

    // Cancel previous animation
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    const list = listRef.current;
    this.currentPosition = list.state.scrollOffset || 0;
    this.targetPosition = targetIndex * (list.props.itemSize as number);
    this.startTime = performance.now();

    this.animateScroll(list);
  }

  private animateScroll(list: FixedSizeList) {
    const now = performance.now();
    const elapsed = now - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);

    // Easing function for smooth animation
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const easedProgress = easeOutCubic(progress);

    const currentPos = this.currentPosition +
      (this.targetPosition - this.currentPosition) * easedProgress;

    list.scrollTo(currentPos);

    if (progress < 1) {
      this.animationId = requestAnimationFrame(() => this.animateScroll(list));
    } else {
      this.animationId = null;
    }
  }
}
```

---

## Caching Strategies

### Multi-layer Caching Architecture

```typescript
interface CacheLayer {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

class MultiLayerCacheSystem {
  constructor(
    private memoryCache: MemoryCache,
    private persistentCache: PersistentCache,
    private databaseCache: DatabaseCache
  ) {}

  async get<T>(key: string): Promise<T | null> {
    // Layer 1: Memory cache (fastest)
    let result = await this.memoryCache.get<T>(key);
    if (result !== null) {
      return result;
    }

    // Layer 2: Persistent cache (fast)
    result = await this.persistentCache.get<T>(key);
    if (result !== null) {
      // Promote to memory cache
      await this.memoryCache.set(key, result, 300); // 5 min TTL
      return result;
    }

    // Layer 3: Database cache (slower)
    result = await this.databaseCache.get<T>(key);
    if (result !== null) {
      // Promote to higher layers
      await this.persistentCache.set(key, result, 1800); // 30 min TTL
      await this.memoryCache.set(key, result, 300);      // 5 min TTL
      return result;
    }

    return null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Set in all layers with appropriate TTLs
    await Promise.all([
      this.memoryCache.set(key, value, ttl || 300),
      this.persistentCache.set(key, value, ttl || 1800),
      this.databaseCache.set(key, value, ttl || 3600)
    ]);
  }
}
```

### Query Result Caching

```typescript
class QueryResultCache {
  private cache = new Map<string, CachedResult>();
  private readonly maxMemoryMB = 100;
  private currentMemoryMB = 0;

  async cacheQuery<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Check if already cached and not expired
    const cached = this.cache.get(queryKey);
    if (cached && Date.now() - cached.timestamp < (options.ttl || 300000)) {
      cached.hitCount++;
      return cached.data;
    }

    // Execute query and cache result
    const result = await queryFn();
    const size = this.estimateSize(result);

    // Evict if needed to stay under memory limit
    while (this.currentMemoryMB + size > this.maxMemoryMB) {
      this.evictLeastUsed();
    }

    this.cache.set(queryKey, {
      data: result,
      timestamp: Date.now(),
      size,
      hitCount: 0,
      ttl: options.ttl || 300000
    });

    this.currentMemoryMB += size;
    return result;
  }

  private evictLeastUsed(): void {
    let leastUsedKey = '';
    let leastUsedScore = Infinity;

    for (const [key, cached] of this.cache.entries()) {
      // Score based on hit count and age
      const age = Date.now() - cached.timestamp;
      const score = cached.hitCount / (age / 3600000); // hits per hour

      if (score < leastUsedScore) {
        leastUsedScore = score;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      const cached = this.cache.get(leastUsedKey);
      if (cached) {
        this.currentMemoryMB -= cached.size;
        this.cache.delete(leastUsedKey);
      }
    }
  }

  private estimateSize(data: any): number {
    // Rough estimation of object size in MB
    const jsonString = JSON.stringify(data);
    return jsonString.length / (1024 * 1024);
  }
}
```

---

## Memory Management

### Component Memory Optimization

```typescript
// Optimized hook for managing large datasets
const useOptimizedKBData = (pageSize = 100) => {
  const [visibleEntries, setVisibleEntries] = useState<KBEntry[]>([]);
  const [allEntries, setAllEntries] = useState<KBEntry[]>([]);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: pageSize });

  // Virtualize data to keep memory usage low
  const updateVisibleRange = useCallback((start: number, end: number) => {
    const bufferSize = 20; // Keep 20 items buffer on each side
    const bufferedStart = Math.max(0, start - bufferSize);
    const bufferedEnd = Math.min(allEntries.length, end + bufferSize);

    if (bufferedStart !== visibleRange.start || bufferedEnd !== visibleRange.end) {
      setVisibleRange({ start: bufferedStart, end: bufferedEnd });
      setVisibleEntries(allEntries.slice(bufferedStart, bufferedEnd));
    }
  }, [allEntries, visibleRange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setVisibleEntries([]);
      setAllEntries([]);
    };
  }, []);

  return {
    visibleEntries,
    updateVisibleRange,
    totalCount: allEntries.length
  };
};
```

### Garbage Collection Optimization

```typescript
class MemoryManager {
  private componentCache = new WeakMap();
  private intervalId: number | null = null;

  startMemoryMonitoring(): void {
    this.intervalId = window.setInterval(() => {
      this.performMemoryCleanup();
      this.logMemoryUsage();
    }, 60000); // Check every minute
  }

  stopMemoryMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private performMemoryCleanup(): void {
    // Force garbage collection if available (dev tools)
    if (window.gc) {
      window.gc();
    }

    // Clear stale event listeners
    this.clearStaleListeners();

    // Prune caches if memory usage is high
    if (this.getMemoryUsage() > 500) { // 500MB threshold
      this.pruneMemoryCaches();
    }
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / (1024 * 1024);
    }
    return 0;
  }

  private logMemoryUsage(): void {
    const usage = this.getMemoryUsage();
    if (usage > 0) {
      console.log(`Memory usage: ${usage.toFixed(2)}MB`);

      if (usage > 800) { // 800MB warning threshold
        console.warn('High memory usage detected. Consider reducing data load.');
      }
    }
  }

  private pruneMemoryCaches(): void {
    // Implementation to clear caches, reduce data loads, etc.
    // This would interact with your caching systems
  }
}
```

---

## Network Optimization

### Request Batching

```typescript
class RequestBatcher {
  private batches = new Map<string, RequestBatch>();
  private readonly batchWindow = 50; // 50ms batching window

  async batchRequest<T>(
    key: string,
    requestFn: (ids: string[]) => Promise<T[]>,
    id: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let batch = this.batches.get(key);

      if (!batch) {
        batch = {
          ids: [],
          promises: [],
          timeout: null
        };
        this.batches.set(key, batch);
      }

      batch.ids.push(id);
      batch.promises.push({ resolve, reject });

      // Clear existing timeout and set new one
      if (batch.timeout) {
        clearTimeout(batch.timeout);
      }

      batch.timeout = setTimeout(async () => {
        const currentBatch = this.batches.get(key);
        if (!currentBatch) return;

        this.batches.delete(key);

        try {
          const results = await requestFn(currentBatch.ids);

          currentBatch.promises.forEach((promise, index) => {
            promise.resolve(results[index]);
          });
        } catch (error) {
          currentBatch.promises.forEach(promise => {
            promise.reject(error);
          });
        }
      }, this.batchWindow);
    });
  }
}

// Usage example
const batcher = new RequestBatcher();

const getEntry = (id: string) =>
  batcher.batchRequest(
    'kb-entries',
    (ids) => db.getEntriesByIds(ids),
    id
  );
```

### Preloading Strategy

```typescript
class PreloadingManager {
  private preloadQueue = new Set<string>();
  private isPreloading = false;

  async preloadEntries(entryIds: string[]): Promise<void> {
    // Add to preload queue
    entryIds.forEach(id => this.preloadQueue.add(id));

    // Start preloading if not already running
    if (!this.isPreloading) {
      this.processPreloadQueue();
    }
  }

  private async processPreloadQueue(): Promise<void> {
    this.isPreloading = true;

    while (this.preloadQueue.size > 0) {
      // Process in small batches to avoid overwhelming the system
      const batch = Array.from(this.preloadQueue).slice(0, 10);
      batch.forEach(id => this.preloadQueue.delete(id));

      try {
        await Promise.all(
          batch.map(id => this.preloadEntry(id))
        );
      } catch (error) {
        console.warn('Preloading batch failed:', error);
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isPreloading = false;
  }

  private async preloadEntry(entryId: string): Promise<void> {
    try {
      const entry = await db.getEntry(entryId);
      if (entry) {
        // Cache the entry
        cache.set(`entry:${entryId}`, entry);
      }
    } catch (error) {
      // Silent fail for preloading
    }
  }
}
```

---

## Monitoring & Diagnostics

### Performance Monitoring

```typescript
class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric>();
  private observers: PerformanceObserver[] = [];

  startMonitoring(): void {
    this.setupNavigationObserver();
    this.setupResourceObserver();
    this.setupPaintObserver();
    this.setupLayoutShiftObserver();
    this.setupLongTaskObserver();
  }

  private setupNavigationObserver(): void {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming;
          this.recordMetric('page_load_time', navEntry.loadEventEnd - navEntry.loadEventStart);
          this.recordMetric('dom_content_loaded', navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart);
        }
      }
    });

    observer.observe({ entryTypes: ['navigation'] });
    this.observers.push(observer);
  }

  private setupLongTaskObserver(): void {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) { // Tasks longer than 50ms
          console.warn(`Long task detected: ${entry.duration.toFixed(2)}ms`);
          this.recordMetric('long_task', entry.duration);
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['longtask'] });
      this.observers.push(observer);
    } catch (error) {
      // Long task observer not supported
    }
  }

  recordCustomMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric(name, value, tags);
  }

  private recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        values: [],
        tags: tags || {},
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity
      });
    }

    const metric = this.metrics.get(name)!;
    metric.values.push({ value, timestamp: Date.now() });
    metric.count++;
    metric.sum += value;
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);

    // Keep only last 100 values
    if (metric.values.length > 100) {
      const removed = metric.values.shift()!;
      metric.sum -= removed.value;
      metric.count--;
    }

    // Alert on performance degradation
    if (this.isPerformanceRegression(name, value)) {
      this.alertPerformanceIssue(name, value);
    }
  }

  getMetricSummary(name: string): PerformanceSummary | null {
    const metric = this.metrics.get(name);
    if (!metric || metric.count === 0) return null;

    const values = metric.values.map(v => v.value).sort((a, b) => a - b);
    const avg = metric.sum / metric.count;
    const p50 = values[Math.floor(values.length * 0.5)];
    const p90 = values[Math.floor(values.length * 0.9)];
    const p99 = values[Math.floor(values.length * 0.99)];

    return {
      name,
      count: metric.count,
      avg,
      min: metric.min,
      max: metric.max,
      p50,
      p90,
      p99
    };
  }

  private isPerformanceRegression(metricName: string, currentValue: number): boolean {
    const thresholds = {
      'search_time': 2000,      // 2 seconds
      'page_load_time': 5000,   // 5 seconds
      'long_task': 100,         // 100ms
      'memory_usage': 500       // 500MB
    };

    const threshold = thresholds[metricName];
    return threshold && currentValue > threshold;
  }

  private alertPerformanceIssue(metricName: string, value: number): void {
    console.warn(`Performance alert: ${metricName} = ${value.toFixed(2)}ms`);

    // In production, this would send alerts to monitoring service
    // this.sendAlert({ metric: metricName, value, severity: 'warning' });
  }

  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics.clear();
  }
}
```

### Real-time Diagnostics

```typescript
class DiagnosticsPanel {
  private panel: HTMLElement | null = null;
  private updateInterval: number | null = null;

  showDiagnostics(): void {
    if (this.panel) return;

    this.createPanel();
    this.startUpdates();
  }

  hideDiagnostics(): void {
    if (this.panel) {
      document.body.removeChild(this.panel);
      this.panel = null;
    }

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private createPanel(): void {
    this.panel = document.createElement('div');
    this.panel.id = 'diagnostics-panel';
    this.panel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 300px;
      height: 400px;
      background: rgba(0, 0, 0, 0.9);
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      padding: 10px;
      border-radius: 5px;
      z-index: 10000;
      overflow-y: auto;
    `;

    document.body.appendChild(this.panel);
  }

  private startUpdates(): void {
    this.updateInterval = window.setInterval(() => {
      this.updatePanel();
    }, 1000);
  }

  private updatePanel(): void {
    if (!this.panel) return;

    const diagnostics = this.collectDiagnostics();
    this.panel.innerHTML = `
      <h3>🔧 System Diagnostics</h3>

      <div><strong>Memory Usage:</strong></div>
      <div>Used: ${diagnostics.memory.used}MB</div>
      <div>Total: ${diagnostics.memory.total}MB</div>
      <div>Usage: ${diagnostics.memory.percentage}%</div>
      <hr>

      <div><strong>Performance:</strong></div>
      <div>FPS: ${diagnostics.performance.fps}</div>
      <div>Long Tasks: ${diagnostics.performance.longTasks}</div>
      <hr>

      <div><strong>Cache Stats:</strong></div>
      <div>Memory Cache: ${diagnostics.cache.memory}% hit rate</div>
      <div>Query Cache: ${diagnostics.cache.query}% hit rate</div>
      <hr>

      <div><strong>Database:</strong></div>
      <div>Queries: ${diagnostics.database.queriesPerSecond}/s</div>
      <div>Avg Time: ${diagnostics.database.avgQueryTime}ms</div>
      <hr>

      <div><strong>Network:</strong></div>
      <div>Requests: ${diagnostics.network.activeRequests}</div>
      <div>Pending: ${diagnostics.network.pendingRequests}</div>
    `;
  }

  private collectDiagnostics() {
    const memory = this.getMemoryInfo();
    const performance = this.getPerformanceInfo();
    const cache = this.getCacheStats();
    const database = this.getDatabaseStats();
    const network = this.getNetworkStats();

    return { memory, performance, cache, database, network };
  }

  private getMemoryInfo() {
    if ('memory' in performance) {
      const mem = (performance as any).memory;
      const used = Math.round(mem.usedJSHeapSize / (1024 * 1024));
      const total = Math.round(mem.totalJSHeapSize / (1024 * 1024));
      const percentage = Math.round((used / total) * 100);

      return { used, total, percentage };
    }

    return { used: 0, total: 0, percentage: 0 };
  }

  private getPerformanceInfo() {
    // This would integrate with your performance monitoring
    return {
      fps: this.estimateFPS(),
      longTasks: this.getLongTaskCount()
    };
  }

  private estimateFPS(): number {
    // Simple FPS estimation
    let lastTime = performance.now();
    let frameCount = 0;
    let fps = 60;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();

      if (currentTime - lastTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(measureFPS);
    };

    measureFPS();
    return fps;
  }

  private getLongTaskCount(): number {
    // This would integrate with your long task observer
    return 0; // Placeholder
  }

  private getCacheStats() {
    // This would integrate with your cache systems
    return {
      memory: 85, // Example hit rate percentage
      query: 78
    };
  }

  private getDatabaseStats() {
    // This would integrate with your database monitoring
    return {
      queriesPerSecond: 12,
      avgQueryTime: 45
    };
  }

  private getNetworkStats() {
    // This would integrate with your network monitoring
    return {
      activeRequests: 2,
      pendingRequests: 0
    };
  }
}

// Keyboard shortcut to toggle diagnostics
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    const diagnostics = new DiagnosticsPanel();
    diagnostics.showDiagnostics();
  }
});
```

---

## Troubleshooting

### Common Performance Issues

#### Issue 1: Slow Search Results

**Symptoms:**
- Search takes > 2 seconds to return results
- UI becomes unresponsive during search
- High CPU usage during queries

**Diagnostic Steps:**
```typescript
// 1. Enable query performance logging
const db = new KnowledgeDB('./kb.db', {
  enableQueryLogging: true,
  slowQueryThreshold: 1000 // Log queries > 1s
});

// 2. Check FTS5 index status
await db.query('INSERT INTO kb_fts(kb_fts) VALUES("integrity-check")');

// 3. Analyze query plans
await db.query('EXPLAIN QUERY PLAN SELECT * FROM kb_fts WHERE kb_fts MATCH ?', [query]);
```

**Solutions:**
1. Rebuild FTS5 index: `INSERT INTO kb_fts(kb_fts) VALUES('rebuild')`
2. Update database statistics: `ANALYZE`
3. Optimize search query complexity
4. Implement query result caching

#### Issue 2: Memory Leaks in Virtual List

**Symptoms:**
- Memory usage increases over time
- Browser becomes sluggish after extended use
- "Out of memory" errors

**Diagnostic Steps:**
```typescript
// Memory leak detector
class MemoryLeakDetector {
  private baseline: number = 0;
  private measurements: number[] = [];

  startTracking(): void {
    this.baseline = this.getCurrentMemoryUsage();

    setInterval(() => {
      const current = this.getCurrentMemoryUsage();
      this.measurements.push(current);

      if (this.measurements.length > 10) {
        this.measurements.shift();
      }

      // Check for consistent growth
      if (this.isMemoryGrowingConsistently()) {
        console.warn('Potential memory leak detected');
        this.reportMemoryLeak();
      }
    }, 30000); // Check every 30 seconds
  }

  private isMemoryGrowingConsistently(): boolean {
    if (this.measurements.length < 5) return false;

    let growthCount = 0;
    for (let i = 1; i < this.measurements.length; i++) {
      if (this.measurements[i] > this.measurements[i - 1]) {
        growthCount++;
      }
    }

    return growthCount >= 4; // 4 out of 5 measurements show growth
  }
}
```

**Solutions:**
1. Implement proper component cleanup in `useEffect` return functions
2. Use `WeakMap` instead of `Map` for component references
3. Clear event listeners on component unmount
4. Implement virtual list item recycling

#### Issue 3: Slow Database Writes

**Symptoms:**
- Adding/updating entries takes > 5 seconds
- UI freezes during batch operations
- Database locks occur frequently

**Diagnostic Steps:**
```sql
-- Check database configuration
PRAGMA journal_mode;
PRAGMA synchronous;
PRAGMA cache_size;

-- Identify slow operations
SELECT * FROM query_performance
WHERE execution_time_ms > 1000
ORDER BY execution_time_ms DESC
LIMIT 10;
```

**Solutions:**
1. Enable WAL mode: `PRAGMA journal_mode=WAL`
2. Reduce synchronization: `PRAGMA synchronous=NORMAL`
3. Increase cache size: `PRAGMA cache_size=-64000`
4. Use transactions for batch operations

### Performance Testing Scripts

```typescript
class PerformanceTester {
  async runSearchPerformanceTest(): Promise<TestResults> {
    const testQueries = [
      'VSAM status 35',
      'S0C7 data exception',
      'JCL error',
      'category:DB2',
      'tag:urgent'
    ];

    const results: TestResult[] = [];

    for (const query of testQueries) {
      const start = performance.now();
      await db.search(query, { limit: 20 });
      const duration = performance.now() - start;

      results.push({
        query,
        duration,
        passed: duration < 1000 // Pass if < 1 second
      });
    }

    return {
      results,
      passRate: results.filter(r => r.passed).length / results.length,
      avgDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length
    };
  }

  async runVirtualScrollTest(): Promise<TestResults> {
    const itemCounts = [100, 1000, 5000, 10000];
    const results: TestResult[] = [];

    for (const count of itemCounts) {
      const start = performance.now();

      // Simulate rendering virtual list
      await this.renderVirtualList(count);

      const duration = performance.now() - start;

      results.push({
        query: `${count} items`,
        duration,
        passed: duration < 500 // Pass if < 500ms
      });
    }

    return {
      results,
      passRate: results.filter(r => r.passed).length / results.length,
      avgDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length
    };
  }

  async runMemoryStressTest(): Promise<TestResults> {
    const initialMemory = this.getCurrentMemoryUsage();

    // Simulate heavy usage
    for (let i = 0; i < 100; i++) {
      await db.search(`test query ${i}`);
      await this.simulateUserInteraction();
    }

    // Force garbage collection
    if (window.gc) {
      window.gc();
    }

    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 2000));

    const finalMemory = this.getCurrentMemoryUsage();
    const memoryIncrease = finalMemory - initialMemory;

    return {
      results: [{
        query: 'Memory stress test',
        duration: memoryIncrease,
        passed: memoryIncrease < 50 // Pass if < 50MB increase
      }],
      passRate: memoryIncrease < 50 ? 1 : 0,
      avgDuration: memoryIncrease
    };
  }
}
```

---

## Best Practices

### Performance Optimization Checklist

#### Database Level
- [ ] Proper indexes on frequently queried columns
- [ ] FTS5 configured with appropriate tokenizer
- [ ] WAL mode enabled for better concurrency
- [ ] Query plans reviewed and optimized
- [ ] Statistics updated regularly with `ANALYZE`
- [ ] Connection pooling implemented
- [ ] Query caching in place

#### Application Level
- [ ] Virtual scrolling for large lists
- [ ] Component memoization with `React.memo`
- [ ] Event handler memoization with `useCallback`
- [ ] Expensive calculations memoized with `useMemo`
- [ ] Debounced search input
- [ ] Lazy loading of non-critical data
- [ ] Request batching for multiple items

#### Caching Strategy
- [ ] Multi-layer caching (memory, persistent, database)
- [ ] Appropriate TTL values for different data types
- [ ] Cache eviction policies implemented
- [ ] Cache hit/miss monitoring
- [ ] Preloading of frequently accessed data

#### Monitoring & Alerting
- [ ] Performance metrics collection
- [ ] Slow query detection and alerting
- [ ] Memory usage monitoring
- [ ] Error rate tracking
- [ ] Real-time diagnostics available

### Code Quality Guidelines

#### Performance-Conscious React Code

```typescript
// ✅ Good - Memoized component with proper comparison
const KBEntryItem = memo<KBEntryItemProps>(({ entry, onSelect }) => {
  const handleSelect = useCallback(() => onSelect(entry), [entry, onSelect]);

  return (
    <div onClick={handleSelect}>
      {entry.title}
    </div>
  );
}, (prevProps, nextProps) =>
  prevProps.entry.id === nextProps.entry.id &&
  prevProps.entry.updated_at === nextProps.entry.updated_at
);

// ❌ Bad - No memoization, creates new functions on each render
const KBEntryItem = ({ entry, onSelect }) => {
  return (
    <div onClick={() => onSelect(entry)}>
      {entry.title}
    </div>
  );
};
```

#### Efficient Database Queries

```typescript
// ✅ Good - Single query with joins
const getEntriesWithTags = async (categoryFilter?: string) => {
  return db.prepare(`
    SELECT e.*, GROUP_CONCAT(t.tag, ', ') as tags
    FROM kb_entries e
    LEFT JOIN kb_tags t ON e.id = t.entry_id
    WHERE e.archived = FALSE
      AND (? IS NULL OR e.category = ?)
    GROUP BY e.id
    ORDER BY e.usage_count DESC
    LIMIT 50
  `).all(categoryFilter, categoryFilter);
};

// ❌ Bad - N+1 query problem
const getEntriesWithTags = async (categoryFilter?: string) => {
  const entries = await db.getEntries(categoryFilter);

  for (const entry of entries) {
    entry.tags = await db.getEntryTags(entry.id); // N additional queries!
  }

  return entries;
};
```

### Deployment Considerations

#### Production Optimizations

```typescript
// Environment-specific configurations
const isDevelopment = process.env.NODE_ENV === 'development';

const dbConfig = {
  // Development settings
  ...(isDevelopment && {
    enableQueryLogging: true,
    slowQueryThreshold: 100, // More sensitive in dev
    cacheSize: 32 * 1024 * 1024, // 32MB
  }),

  // Production settings
  ...(!isDevelopment && {
    enableQueryLogging: false,
    slowQueryThreshold: 1000, // 1 second threshold
    cacheSize: 128 * 1024 * 1024, // 128MB
    enableCompression: true,
    connectionPoolSize: 10
  })
};
```

#### Monitoring Setup

```typescript
// Production monitoring configuration
if (!isDevelopment) {
  const performanceMonitor = new PerformanceMonitor({
    enableRealTimeAlerts: true,
    slowQueryThreshold: 1000,
    memoryAlertThreshold: 500, // 500MB
    errorRateThreshold: 0.05, // 5% error rate

    onAlert: (alert) => {
      // Send to monitoring service
      sendToMonitoringService(alert);
    }
  });

  performanceMonitor.startMonitoring();
}
```

This comprehensive performance tuning guide provides the foundation for maintaining optimal performance as your Knowledge Base system scales to handle large datasets and high user loads.