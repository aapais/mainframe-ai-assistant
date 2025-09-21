# Knowledge Base Listing & Filtering API Reference

## Table of Contents

1. [Overview](#overview)
2. [Core Interfaces](#core-interfaces)
3. [Hook API Reference](#hook-api-reference)
4. [Component API Reference](#component-api-reference)
5. [Database API Reference](#database-api-reference)
6. [Search API Reference](#search-api-reference)
7. [Performance Monitoring API](#performance-monitoring-api)
8. [Error Handling](#error-handling)
9. [Examples](#examples)

---

## Overview

The Knowledge Base Listing & Filtering API provides comprehensive functionality for managing and searching knowledge base entries with high performance and scalability. It supports virtual scrolling, real-time search, advanced filtering, and batch operations.

### API Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Components    │────│     Hooks       │────│   Database      │
│                 │    │                 │    │                 │
│ AdvancedKBList  │    │ useKBData       │    │ KnowledgeDB     │
│ SearchFilters   │    │ useBatchOps     │    │ QueryOptimizer  │
│ BatchOperations │    │ useVirtual      │    │ PerformanceDB   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Features

- **Type-Safe**: Full TypeScript support with comprehensive interfaces
- **Performance**: Virtual scrolling for 10,000+ entries
- **Real-time**: Live search and updates
- **Extensible**: Plugin architecture for custom functionality
- **Accessible**: WCAG 2.1 AA compliance

---

## Core Interfaces

### KBEntry Interface

The fundamental knowledge base entry structure.

```typescript
interface KBEntry {
  /** Unique identifier (UUID v4) */
  id?: string;

  /** Brief, descriptive title of the problem/solution */
  title: string;

  /** Detailed description of the problem or error condition */
  problem: string;

  /** Step-by-step solution or resolution steps */
  solution: string;

  /** Mainframe component category */
  category: string;

  /** Severity level indicating urgency/impact */
  severity?: 'critical' | 'high' | 'medium' | 'low';

  /** Array of searchable tags for categorization */
  tags?: string[];

  /** Timestamp when entry was created */
  created_at?: Date;

  /** Timestamp when entry was last modified */
  updated_at?: Date;

  /** User ID or system that created the entry */
  created_by?: string;

  /** Total number of times this entry has been accessed */
  usage_count?: number;

  /** Number of times users reported this solution as successful */
  success_count?: number;

  /** Number of times users reported this solution as failed */
  failure_count?: number;

  /** Timestamp when entry was last accessed */
  last_used?: Date;

  /** Whether entry is archived (hidden from normal searches) */
  archived?: boolean;
}
```

### SearchResult Interface

Container for search results with scoring and metadata.

```typescript
interface SearchResult {
  /** The matched knowledge base entry */
  entry: KBEntry;

  /** Relevance score (0-100) - higher is more relevant */
  score: number;

  /** Type of matching algorithm used */
  matchType: 'exact' | 'fuzzy' | 'ai' | 'category' | 'tag';

  /** Text snippets that matched the search query */
  highlights?: string[];
}
```

### KBEntryListItem Interface

Extended entry interface for list display with UI state.

```typescript
interface KBEntryListItem extends KBEntry {
  /** Whether entry is currently selected */
  isSelected?: boolean;

  /** Whether entry is in inline edit mode */
  isEditing?: boolean;

  /** Fields that match the search query for highlighting */
  matchHighlights?: string[];

  /** Calculated relevance score for search results */
  relevanceScore?: number;
}
```

### SearchOptions Interface

Configuration for search operations.

```typescript
interface SearchOptions {
  /** Search query string */
  query?: string;

  /** Category filter */
  category?: KBCategory;

  /** Tag filters */
  tags?: string[];

  /** Sort options */
  sortBy?: 'relevance' | 'usage' | 'created' | 'updated' | 'title';
  sortOrder?: 'asc' | 'desc';

  /** Pagination */
  limit?: number;
  offset?: number;

  /** Advanced options */
  includeArchived?: boolean;
  fuzzyThreshold?: number;
  useAI?: boolean;
}
```

---

## Hook API Reference

### useKBData Hook

Primary hook for knowledge base data management.

#### Signature

```typescript
const useKBData = (
  db: KnowledgeDB,
  options?: UseKBDataOptions
): UseKBDataReturn
```

#### Parameters

```typescript
interface UseKBDataOptions {
  /** Auto-refresh interval in milliseconds */
  autoRefresh?: number;

  /** Enable real-time updates */
  realTimeUpdates?: boolean;

  /** Cache duration in milliseconds (default: 5 minutes) */
  cacheDuration?: number;

  /** Enable optimistic updates */
  optimisticUpdates?: boolean;

  /** Auto-load entries on mount */
  autoLoadEntries?: boolean;

  /** Auto-load stats on mount */
  autoLoadStats?: boolean;
}
```

#### Return Value

```typescript
interface UseKBDataReturn {
  // State
  entries: KBEntry[];
  searchResults: SearchResult[];
  stats: DatabaseStats | null;
  loading: {
    entries: boolean;
    search: boolean;
    stats: boolean;
    operation: boolean;
  };
  error: {
    entries: Error | null;
    search: Error | null;
    stats: Error | null;
    operation: Error | null;
  };
  lastUpdated: Date | null;

  // Data operations
  loadEntries: (force?: boolean) => Promise<KBEntry[]>;
  searchEntries: (options: SearchOptions) => Promise<SearchResult[]>;
  loadStats: (force?: boolean) => Promise<DatabaseStats>;
  refresh: () => Promise<void>;

  // Entry operations
  getEntry: (id: string) => KBEntry | undefined;
  addEntry: (entry: Omit<KBEntry, 'id'>) => Promise<string>;
  updateEntry: (id: string, updates: Partial<KBEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  duplicateEntry: (id: string) => Promise<string>;

  // Bulk operations
  addMultipleEntries: (entries: Omit<KBEntry, 'id'>[]) => Promise<string[]>;
  updateMultipleEntries: (updates: Array<{ id: string; data: Partial<KBEntry> }>) => Promise<void>;
  deleteMultipleEntries: (ids: string[]) => Promise<void>;

  // Search helpers
  clearSearch: () => void;
  getRecentSearches: () => string[];
  getSuggestions: (query: string) => Promise<string[]>;

  // Cache management
  clearCache: () => void;
  getCacheInfo: () => CacheInfo;

  // Utility functions
  exportEntries: (format?: 'json' | 'csv') => Promise<string>;
  importEntries: (data: string, format?: 'json' | 'csv') => Promise<number>;
}
```

#### Usage Examples

```typescript
// Basic usage
const { entries, loading, error, searchEntries } = useKBData(db);

// With options
const { entries, searchResults } = useKBData(db, {
  autoRefresh: 30000, // 30 seconds
  realTimeUpdates: true,
  optimisticUpdates: true
});

// Search entries
const handleSearch = async (query: string) => {
  const results = await searchEntries({
    query,
    limit: 20,
    sortBy: 'relevance'
  });
};

// Add new entry
const handleAddEntry = async (entry: Omit<KBEntry, 'id'>) => {
  try {
    const newId = await addEntry(entry);
    console.log('Entry created:', newId);
  } catch (error) {
    console.error('Failed to create entry:', error);
  }
};
```

### useBatchOperations Hook

Hook for batch operations on multiple entries.

#### Signature

```typescript
const useBatchOperations = (
  entries: KBEntry[],
  selectedIds: Set<string>
): UseBatchOperationsReturn
```

#### Return Value

```typescript
interface UseBatchOperationsReturn {
  /** Currently selected entries */
  selectedEntries: KBEntry[];

  /** Selection controls */
  selectAll: () => void;
  selectNone: () => void;
  selectInvert: () => void;

  /** Operation permissions */
  canBatchEdit: boolean;
  canBatchDelete: boolean;

  /** Execute batch operations */
  performBatchOperation: (operation: string, entryIds: string[]) => Promise<void>;
}
```

#### Usage Example

```typescript
const {
  selectedEntries,
  selectAll,
  performBatchOperation
} = useBatchOperations(entries, selectedIds);

// Select all entries
const handleSelectAll = () => selectAll();

// Batch delete
const handleBatchDelete = async () => {
  await performBatchOperation('delete', selectedIds);
};
```

### useVirtualization Hook

Hook for virtual scrolling optimization.

#### Signature

```typescript
const useVirtualization = (
  itemCount: number,
  itemHeight: number,
  containerHeight: number
): UseVirtualizationReturn
```

#### Return Value

```typescript
interface UseVirtualizationReturn {
  /** Visible item range */
  startIndex: number;
  endIndex: number;

  /** Scroll position controls */
  scrollToIndex: (index: number) => void;
  scrollToTop: () => void;

  /** Performance metrics */
  visibleItems: number;
  totalHeight: number;
}
```

---

## Component API Reference

### AdvancedKBEntryList Component

Main component for displaying knowledge base entries with advanced features.

#### Props Interface

```typescript
interface AdvancedKBEntryListProps {
  /** Styling */
  className?: string;
  height?: number;
  itemHeight?: number;

  /** Search and filtering */
  searchQuery?: string;
  categoryFilter?: KBCategory;
  tagFilter?: string[];
  sortBy?: 'relevance' | 'usage' | 'created' | 'updated' | 'title';
  sortOrder?: 'asc' | 'desc';

  /** Display options */
  viewMode?: 'list' | 'grid' | 'compact';
  showPreview?: boolean;
  showMetrics?: boolean;
  groupBy?: 'category' | 'tags' | 'created' | 'none';

  /** Features */
  enableBatchSelect?: boolean;
  enableInlineEdit?: boolean;
  enableQuickActions?: boolean;

  /** Event handlers */
  onEntrySelect?: (entry: KBEntryListItem) => void;
  onEntryEdit?: (entry: KBEntryListItem) => void;
  onEntryDelete?: (entry: KBEntryListItem) => void;
  onEntryCopy?: (entry: KBEntryListItem) => void;
  onBatchOperation?: (operation: string, entries: KBEntryListItem[]) => void;

  /** Version control handlers */
  onShowVersionHistory?: (entry: KBEntryListItem) => void;
  onCompareVersions?: (entry: KBEntryListItem) => void;
  onRollback?: (entry: KBEntryListItem) => void;

  /** Accessibility */
  ariaLabel?: string;
  announceChanges?: boolean;
}
```

#### Usage Example

```typescript
<AdvancedKBEntryList
  height={600}
  itemHeight={120}
  searchQuery={searchTerm}
  categoryFilter="VSAM"
  viewMode="list"
  showPreview={true}
  showMetrics={true}
  enableBatchSelect={true}
  enableInlineEdit={true}
  onEntrySelect={(entry) => setSelectedEntry(entry)}
  onEntryEdit={(entry) => handleEdit(entry)}
  onBatchOperation={(op, entries) => handleBatchOp(op, entries)}
  ariaLabel="Knowledge base entries"
  announceChanges={true}
/>
```

#### Component Events

The component emits various events for different user interactions:

```typescript
// Entry selection
onEntrySelect: (entry: KBEntryListItem) => void

// CRUD operations
onEntryEdit: (entry: KBEntryListItem) => void
onEntryDelete: (entry: KBEntryListItem) => void
onEntryCopy: (entry: KBEntryListItem) => void

// Batch operations
onBatchOperation: (operation: 'edit' | 'delete' | 'duplicate' | 'export', entries: KBEntryListItem[]) => void

// Version control
onShowVersionHistory: (entry: KBEntryListItem) => void
onCompareVersions: (entry: KBEntryListItem) => void
onRollback: (entry: KBEntryListItem) => void
```

### SearchFilters Component

Advanced filtering interface component.

#### Props Interface

```typescript
interface SearchFiltersProps {
  /** Current filter state */
  filters: FilterState;

  /** Filter options */
  availableCategories: string[];
  availableTags: string[];
  availableSeverities: string[];

  /** Event handlers */
  onFiltersChange: (filters: FilterState) => void;
  onClearFilters: () => void;
  onSaveFilter: (name: string, filters: FilterState) => void;

  /** Display options */
  showAdvanced?: boolean;
  collapsible?: boolean;
}
```

#### Usage Example

```typescript
<SearchFilters
  filters={currentFilters}
  availableCategories={['JCL', 'VSAM', 'DB2', 'Batch']}
  availableTags={['urgent', 'common', 'error']}
  availableSeverities={['critical', 'high', 'medium', 'low']}
  onFiltersChange={setFilters}
  onClearFilters={() => setFilters({})}
  showAdvanced={true}
  collapsible={true}
/>
```

---

## Database API Reference

### KnowledgeDB Class

Core database class providing all KB functionality.

#### Constructor

```typescript
constructor(
  dbPath: string = './knowledge.db',
  options?: {
    backupDir?: string;
    maxBackups?: number;
    autoBackup?: boolean;
    backupInterval?: number;
  }
)
```

#### Core Methods

##### Search Methods

```typescript
// Advanced search with multiple strategies
async search(
  query: string,
  options?: Partial<SearchOptions>
): Promise<SearchResult[]>

// Auto-complete suggestions
async autoComplete(
  query: string,
  limit?: number
): Promise<Array<{ suggestion: string; category: string; score: number }>>

// Faceted search with counts
async searchWithFacets(
  query: string,
  options?: Partial<SearchOptions>
): Promise<{
  results: SearchResult[];
  facets: {
    categories: Array<{ name: string; count: number }>;
    tags: Array<{ name: string; count: number }>;
    severities: Array<{ name: string; count: number }>;
  };
  totalCount: number;
}>
```

##### CRUD Methods

```typescript
// Add new entry
async addEntry(entry: KBEntry, userId?: string): Promise<string>

// Update existing entry
async updateEntry(
  id: string,
  updates: Partial<KBEntry>,
  userId?: string
): Promise<void>

// Get entry by ID
async getEntry(id: string): Promise<KBEntry | null>

// Delete entry (soft delete)
async deleteEntry(id: string): Promise<void>

// Get popular entries
async getPopular(limit?: number): Promise<SearchResult[]>

// Get recent entries
async getRecent(limit?: number): Promise<SearchResult[]>
```

##### Analytics Methods

```typescript
// Record usage metrics
async recordUsage(
  entryId: string,
  successful: boolean,
  userId?: string
): Promise<void>

// Get comprehensive statistics
async getStats(): Promise<DatabaseStats>

// Get performance metrics
getPerformanceStatus(): PerformanceStatus

// Generate performance report
generatePerformanceReport(
  startTime?: number,
  endTime?: number
): PerformanceReport
```

#### Usage Examples

```typescript
// Initialize database
const db = new KnowledgeDB('./kb.db', {
  autoBackup: true,
  backupInterval: 24
});

// Search entries
const results = await db.search('VSAM status 35', {
  limit: 10,
  sortBy: 'relevance'
});

// Add new entry
const entryId = await db.addEntry({
  title: 'New Problem Solution',
  problem: 'Description of the problem...',
  solution: 'Step-by-step solution...',
  category: 'VSAM',
  tags: ['vsam', 'error', 'urgent']
});

// Update entry
await db.updateEntry(entryId, {
  solution: 'Updated solution steps...',
  tags: ['vsam', 'error', 'resolved']
});

// Record usage
await db.recordUsage(entryId, true, 'user123');

// Get statistics
const stats = await db.getStats();
console.log(`Total entries: ${stats.totalEntries}`);
```

---

## Search API Reference

### Search Strategies

The search system uses multiple strategies for optimal results:

#### Strategy Selection

```typescript
interface SearchStrategy {
  type: 'exact' | 'fts' | 'fuzzy' | 'category' | 'tag' | 'hybrid';
  priority: number;
  performance: 'fast' | 'medium' | 'slow';
  accuracy: 'high' | 'medium' | 'low';
}
```

#### Search Methods by Strategy

##### Exact Search
Perfect for error codes and specific terms.

```typescript
// Usage
const results = await db.search('S0C7', { strategy: 'exact' });

// Automatic detection
// Patterns: IEF212I, S0C7, WER027A, SQLCODE -904
```

##### Full-Text Search (FTS)
Best for natural language queries.

```typescript
// Usage with BM25 ranking
const results = await db.search('file not found error', {
  strategy: 'fts',
  sortBy: 'relevance'
});
```

##### Fuzzy Search
Handles typos and partial matches.

```typescript
// Usage for flexible matching
const results = await db.search('vasm statu 35', {
  strategy: 'fuzzy',
  fuzzyThreshold: 0.7
});
```

##### Hybrid Search
Combines multiple strategies for comprehensive coverage.

```typescript
// Automatic for complex queries
const results = await db.search('VSAM file access problem batch job', {
  strategy: 'hybrid',
  limit: 20
});
```

### Search Performance Optimization

#### Caching

```typescript
// Cache configuration
interface CacheConfig {
  maxSize: number;          // Max cache entries
  defaultTTL: number;       // Time to live (ms)
  maxMemoryMB: number;      // Memory limit
  persistToDisk: boolean;   // Disk persistence
  compressionEnabled: boolean;
}

// Cache methods
await db.preWarmCache();                    // Pre-warm with common queries
await db.invalidateCache('search:*');      // Invalidate search cache
const stats = db.getCacheStats();          // Get cache statistics
```

#### Query Optimization

```typescript
// Query complexity analysis
interface QueryComplexity {
  isComplex: boolean;       // Multi-term or operators
  hasFuzzyTerms: boolean;   // Wildcards or short terms
  termCount: number;        // Number of search terms
  hasOperators: boolean;    // Special operators (:, @)
}

// Performance monitoring
const perfStatus = db.getPerformanceStatus();
const slowQueries = db.getSlowQueries(10);
```

---

## Performance Monitoring API

### Performance Metrics

#### Real-time Status

```typescript
interface PerformanceStatus {
  isHealthy: boolean;
  metrics: {
    avgSearchTime: number;      // Average search time (ms)
    cacheHitRate: number;       // Cache hit percentage
    queriesPerSecond: number;   // Current QPS
    memoryUsage: number;        // Memory usage (MB)
    diskUsage: number;          // Disk usage (MB)
  };
  alerts: Alert[];
}
```

#### Performance Reports

```typescript
interface PerformanceReport {
  timeRange: { start: number; end: number };
  metrics: {
    totalQueries: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    cacheEfficiency: number;
  };
  trends: {
    searchTrends: Array<{ timestamp: number; value: number }>;
    performanceTrends: Array<{ timestamp: number; value: number }>;
  };
  recommendations: string[];
}
```

#### Usage Examples

```typescript
// Get real-time status
const status = db.getPerformanceStatus();
if (!status.isHealthy) {
  console.warn('Performance issues detected:', status.alerts);
}

// Generate performance report
const report = db.generatePerformanceReport();
console.log(`Average response time: ${report.metrics.avgResponseTime}ms`);

// Monitor trends
const trends = db.getPerformanceTrends(24); // Last 24 hours
trends.searchTrends.forEach(point => {
  console.log(`${new Date(point.timestamp)}: ${point.value}ms`);
});
```

### Health Monitoring

#### Health Check API

```typescript
async healthCheck(): Promise<{
  overall: boolean;
  database: boolean;
  cache: boolean;
  connections: boolean;
  performance: boolean;
  issues: string[];
}>
```

#### Usage Example

```typescript
const health = await db.healthCheck();
if (!health.overall) {
  console.error('System health issues:', health.issues);

  // Specific component checks
  if (!health.database) {
    console.error('Database connectivity problems');
  }
  if (!health.cache) {
    console.error('Cache system issues');
  }
  if (!health.performance) {
    console.error('Performance degradation detected');
  }
}
```

---

## Error Handling

### Error Types

#### Database Errors

```typescript
class DatabaseError extends Error {
  code: string;
  details?: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.details = details;
  }
}

// Common error codes
const ERROR_CODES = {
  CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  QUERY_TIMEOUT: 'DB_QUERY_TIMEOUT',
  CONSTRAINT_VIOLATION: 'DB_CONSTRAINT_VIOLATION',
  DISK_FULL: 'DB_DISK_FULL'
} as const;
```

#### Search Errors

```typescript
class SearchError extends Error {
  query: string;
  strategy: string;

  constructor(message: string, query: string, strategy: string) {
    super(message);
    this.name = 'SearchError';
    this.query = query;
    this.strategy = strategy;
  }
}
```

#### Validation Errors

```typescript
class ValidationError extends Error {
  field: string;
  value: any;
  constraints: string[];

  constructor(field: string, value: any, constraints: string[]) {
    super(`Validation failed for field: ${field}`);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.constraints = constraints;
  }
}
```

### Error Handling Patterns

#### Hook Error Handling

```typescript
const { entries, error, loading } = useKBData(db);

// Handle different error types
if (error.entries) {
  if (error.entries instanceof DatabaseError) {
    switch (error.entries.code) {
      case ERROR_CODES.CONNECTION_FAILED:
        // Show connection error UI
        break;
      case ERROR_CODES.QUERY_TIMEOUT:
        // Show timeout message, suggest retry
        break;
      default:
        // Generic database error
    }
  }
}
```

#### Component Error Boundaries

```typescript
class KBErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('KB Component Error:', error, errorInfo);

    // Log to monitoring service
    this.logError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <KBErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}
```

#### Async Operation Error Handling

```typescript
const handleSearch = async (query: string) => {
  try {
    setLoading(true);
    const results = await searchEntries({ query });
    setResults(results);
  } catch (error) {
    if (error instanceof SearchError) {
      setError(`Search failed: ${error.message}`);
      // Maybe retry with different strategy
    } else if (error instanceof DatabaseError) {
      setError('Database connection problem. Please try again.');
    } else {
      setError('An unexpected error occurred.');
    }
  } finally {
    setLoading(false);
  }
};
```

---

## Examples

### Complete Integration Example

```typescript
import React, { useState, useCallback } from 'react';
import {
  AdvancedKBEntryList,
  SearchFilters,
  useKBData,
  KnowledgeDB
} from '@/kb-system';

// Initialize database
const db = new KnowledgeDB('./knowledge.db', {
  autoBackup: true,
  backupInterval: 24
});

export const KBManager: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Use the KB data hook
  const {
    entries,
    searchResults,
    loading,
    error,
    searchEntries,
    addEntry,
    updateEntry,
    deleteEntry
  } = useKBData(db, {
    autoRefresh: 30000,
    realTimeUpdates: true,
    optimisticUpdates: true
  });

  // Search handler
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      await searchEntries({
        query,
        ...filters,
        limit: 50,
        sortBy: 'relevance'
      });
    }
  }, [filters, searchEntries]);

  // Entry selection handler
  const handleEntrySelect = useCallback((entry) => {
    setSelectedEntry(entry);
  }, []);

  // Entry edit handler
  const handleEntryEdit = useCallback(async (entry) => {
    try {
      await updateEntry(entry.id, entry);
    } catch (error) {
      console.error('Failed to update entry:', error);
    }
  }, [updateEntry]);

  // Batch operation handler
  const handleBatchOperation = useCallback(async (operation, entries) => {
    try {
      switch (operation) {
        case 'delete':
          await Promise.all(entries.map(entry => deleteEntry(entry.id)));
          break;
        case 'export':
          const data = await exportEntries('json');
          downloadFile(data, 'kb-export.json');
          break;
        // Handle other operations...
      }
    } catch (error) {
      console.error('Batch operation failed:', error);
    }
  }, [deleteEntry]);

  if (loading.entries) {
    return <LoadingSpinner message="Loading knowledge base..." />;
  }

  if (error.entries) {
    return <ErrorDisplay error={error.entries} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="kb-manager">
      {/* Header */}
      <div className="kb-header">
        <h1>Knowledge Base Manager</h1>
        <button onClick={() => setShowAddModal(true)}>
          Add New Entry
        </button>
      </div>

      {/* Search and Filters */}
      <div className="kb-search-section">
        <SearchBox
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Search knowledge base..."
          autoComplete={true}
        />

        <SearchFilters
          filters={filters}
          availableCategories={['JCL', 'VSAM', 'DB2', 'Batch', 'Functional']}
          availableTags={getAllTags(entries)}
          onFiltersChange={setFilters}
          showAdvanced={true}
        />
      </div>

      {/* Main Content */}
      <div className="kb-content">
        <AdvancedKBEntryList
          height={600}
          itemHeight={120}
          searchQuery={searchQuery}
          categoryFilter={filters.category}
          tagFilter={filters.tags}
          sortBy="relevance"
          viewMode="list"
          showPreview={true}
          showMetrics={true}
          enableBatchSelect={true}
          enableInlineEdit={true}
          onEntrySelect={handleEntrySelect}
          onEntryEdit={handleEntryEdit}
          onBatchOperation={handleBatchOperation}
          ariaLabel="Knowledge base entries"
          announceChanges={true}
        />

        {/* Preview Panel */}
        {selectedEntry && (
          <EntryPreviewPanel
            entry={selectedEntry}
            onEdit={handleEntryEdit}
            onClose={() => setSelectedEntry(null)}
          />
        )}
      </div>
    </div>
  );
};
```

### Custom Search Implementation

```typescript
// Custom search with advanced features
const useAdvancedSearch = (db: KnowledgeDB) => {
  const [searchState, setSearchState] = useState({
    query: '',
    results: [],
    loading: false,
    suggestions: [],
    recentSearches: []
  });

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce(async (query: string) => {
      if (!query.trim()) {
        setSearchState(prev => ({ ...prev, results: [], loading: false }));
        return;
      }

      setSearchState(prev => ({ ...prev, loading: true }));

      try {
        // Parallel search strategies
        const [textResults, categoryResults, tagResults] = await Promise.all([
          db.search(query, { strategy: 'fts', limit: 10 }),
          db.search(query, { strategy: 'category', limit: 5 }),
          db.search(query, { strategy: 'tag', limit: 5 })
        ]);

        // Merge and deduplicate results
        const allResults = new Map();
        [textResults, categoryResults, tagResults].forEach(results => {
          results.forEach(result => {
            const existing = allResults.get(result.entry.id);
            if (!existing || result.score > existing.score) {
              allResults.set(result.entry.id, result);
            }
          });
        });

        const mergedResults = Array.from(allResults.values())
          .sort((a, b) => b.score - a.score)
          .slice(0, 20);

        setSearchState(prev => ({
          ...prev,
          results: mergedResults,
          loading: false,
          recentSearches: [query, ...prev.recentSearches.slice(0, 9)]
        }));
      } catch (error) {
        console.error('Search failed:', error);
        setSearchState(prev => ({ ...prev, loading: false }));
      }
    }, 300),
    [db]
  );

  // Auto-complete
  const getSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) return [];

    const suggestions = await db.autoComplete(query, 8);
    setSearchState(prev => ({ ...prev, suggestions }));
    return suggestions;
  }, [db]);

  return {
    ...searchState,
    search: debouncedSearch,
    getSuggestions,
    clearResults: () => setSearchState(prev => ({ ...prev, results: [] }))
  };
};
```

### Performance Monitoring Integration

```typescript
// Performance monitoring component
const PerformanceMonitor: React.FC<{ db: KnowledgeDB }> = ({ db }) => {
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const status = db.getPerformanceStatus();
      setMetrics(status.metrics);
      setAlerts(status.alerts);

      // Log performance issues
      if (!status.isHealthy) {
        console.warn('Performance degradation:', status.alerts);
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [db]);

  if (!metrics) return null;

  return (
    <div className="performance-monitor">
      <h3>System Performance</h3>

      <div className="metrics-grid">
        <div className="metric">
          <label>Avg Search Time</label>
          <span className={metrics.avgSearchTime > 1000 ? 'warning' : 'good'}>
            {metrics.avgSearchTime}ms
          </span>
        </div>

        <div className="metric">
          <label>Cache Hit Rate</label>
          <span className={metrics.cacheHitRate < 70 ? 'warning' : 'good'}>
            {metrics.cacheHitRate}%
          </span>
        </div>

        <div className="metric">
          <label>Queries/sec</label>
          <span>{metrics.queriesPerSecond}</span>
        </div>

        <div className="metric">
          <label>Memory Usage</label>
          <span className={metrics.memoryUsage > 500 ? 'warning' : 'good'}>
            {metrics.memoryUsage}MB
          </span>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="alerts">
          <h4>Performance Alerts</h4>
          {alerts.map(alert => (
            <div key={alert.id} className={`alert alert-${alert.level}`}>
              {alert.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

This comprehensive API reference provides developers with all the information needed to integrate and extend the Knowledge Base Listing & Filtering system effectively.