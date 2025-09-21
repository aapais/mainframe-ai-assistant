# API Reference

## Overview

The Database Utilities System provides a comprehensive TypeScript API for managing knowledge base operations, search functionality, performance monitoring, and data management. The API is designed with type safety, performance, and ease of use in mind.

## Table of Contents

1. [KnowledgeDB Class](#knowledgedb-class)
2. [Interfaces and Types](#interfaces-and-types)
3. [Error Handling](#error-handling)
4. [Performance APIs](#performance-apis)
5. [Utility Functions](#utility-functions)

## KnowledgeDB Class

The main class for all database operations.

### Constructor

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

**Parameters:**
- `dbPath`: Path to SQLite database file (default: './knowledge.db')
- `options`: Configuration options
  - `backupDir`: Directory for backup files
  - `maxBackups`: Maximum backup files to retain (default: 10)
  - `autoBackup`: Enable automatic backups (default: true)
  - `backupInterval`: Hours between backups (default: 24)

**Example:**
```typescript
const db = new KnowledgeDB('/data/knowledge.db', {
  backupDir: '/backups',
  autoBackup: true,
  backupInterval: 6
});
```

### Core Methods

#### addEntry()

Add a new knowledge base entry.

```typescript
async addEntry(entry: KBEntry, userId?: string): Promise<string>
```

**Parameters:**
- `entry`: Knowledge base entry object
- `userId`: Optional user ID creating the entry

**Returns:** Promise resolving to the entry ID (UUID)

**Throws:** Error if validation fails or database operation fails

**Example:**
```typescript
const entryId = await db.addEntry({
  title: 'VSAM Status 35 Error',
  problem: 'Job abends with VSAM status code 35',
  solution: '1. Check file existence\n2. Verify catalog entry',
  category: 'VSAM',
  severity: 'medium',
  tags: ['vsam', 'status-35', 'file-error']
}, 'user123');
```

#### updateEntry()

Update an existing knowledge base entry.

```typescript
async updateEntry(id: string, updates: Partial<KBEntry>, userId?: string): Promise<void>
```

**Parameters:**
- `id`: Entry ID to update
- `updates`: Partial entry object with fields to update
- `userId`: Optional user ID making the update

**Example:**
```typescript
await db.updateEntry('entry-uuid', {
  solution: 'Updated solution steps...',
  tags: ['vsam', 'updated', 'resolved']
});
```

#### search()

Perform intelligent search on the knowledge base.

```typescript
async search(
  query: string,
  options?: Partial<SearchOptions & {
    streaming?: boolean;
    fuzzyThreshold?: number;
    enableAutoComplete?: boolean;
  }>
): Promise<SearchResult[]>
```

**Parameters:**
- `query`: Search query string
- `options`: Search configuration options
  - `limit`: Maximum results (default: 10, max: 100)
  - `offset`: Results to skip for pagination (default: 0)
  - `sortBy`: Sort order - 'relevance', 'usage', 'success_rate', 'created_at'
  - `includeArchived`: Include archived entries (default: false)
  - `category`: Filter by category
  - `tags`: Filter by tags
  - `fuzzyThreshold`: Fuzzy matching threshold 0-1 (default: 0.7)

**Returns:** Array of search results with relevance scoring

**Search Operators:**
- `category:VSAM` - Filter by category
- `tag:error` - Filter by tag
- `"exact phrase"` - Exact phrase matching

**Example:**
```typescript
// Simple search
const results = await db.search('VSAM status 35');

// Advanced search with filters
const results = await db.search('file error', {
  category: 'VSAM',
  limit: 5,
  sortBy: 'usage',
  fuzzyThreshold: 0.8
});

// Process results
results.forEach(result => {
  console.log(`${result.entry.title} (${result.score.toFixed(1)}%)`);
  if (result.highlights) {
    console.log(`Highlights: ${result.highlights.join(', ')}`);
  }
});
```

#### autoComplete()

Get search suggestions with sub-50ms response time.

```typescript
async autoComplete(query: string, limit: number = 5): Promise<Array<{
  suggestion: string;
  category: string;
  score: number;
}>>
```

**Parameters:**
- `query`: Partial search query (minimum 2 characters)
- `limit`: Maximum suggestions to return (default: 5)

**Returns:** Array of suggestions with categories and scores

**Example:**
```typescript
const suggestions = await db.autoComplete('vsam', 5);
suggestions.forEach(s => {
  console.log(`${s.suggestion} (${s.category})`);
});
```

#### searchWithFacets()

Search with faceted filtering and real-time counts.

```typescript
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

**Example:**
```typescript
const result = await db.searchWithFacets('error code');
console.log(`Found ${result.totalCount} total results`);
console.log('Available categories:', result.facets.categories);
console.log('Available tags:', result.facets.tags);
```

#### getEntry()

Get a specific entry by ID.

```typescript
async getEntry(id: string): Promise<KBEntry | null>
```

**Parameters:**
- `id`: Entry ID to retrieve

**Returns:** Entry object or null if not found

#### recordUsage()

Track entry usage and effectiveness.

```typescript
async recordUsage(entryId: string, successful: boolean, userId?: string): Promise<void>
```

**Parameters:**
- `entryId`: ID of the entry that was used
- `successful`: Whether the solution was successful
- `userId`: Optional user ID

**Example:**
```typescript
// Record successful usage
await db.recordUsage('entry-uuid', true, 'user123');

// Record failed usage
await db.recordUsage('entry-uuid', false, 'user456');
```

#### getPopular()

Get most frequently used entries.

```typescript
async getPopular(limit: number = 10): Promise<SearchResult[]>
```

#### getRecent()

Get recently created entries.

```typescript
async getRecent(limit: number = 10): Promise<SearchResult[]>
```

#### getStats()

Get comprehensive database statistics.

```typescript
async getStats(): Promise<DatabaseStats>
```

**Returns:** Database statistics including entry counts, performance metrics, and usage data

**Example:**
```typescript
const stats = await db.getStats();
console.log(`Total entries: ${stats.totalEntries}`);
console.log(`Searches today: ${stats.searchesToday}`);
console.log(`Average success rate: ${stats.averageSuccessRate}%`);
console.log(`Cache hit rate: ${stats.performance.cacheHitRate}%`);
```

### Backup and Recovery Methods

#### createBackup()

Create a manual backup.

```typescript
async createBackup(): Promise<void>
```

#### restoreFromBackup()

Restore database from backup.

```typescript
async restoreFromBackup(backupPath?: string): Promise<void>
```

#### exportToJSON()

Export database to JSON format.

```typescript
async exportToJSON(outputPath: string): Promise<void>
```

#### importFromJSON()

Import data from JSON file.

```typescript
async importFromJSON(jsonPath: string, mergeMode: boolean = false): Promise<void>
```

**Parameters:**
- `jsonPath`: Path to JSON file
- `mergeMode`: If true, merge with existing data; if false, replace

### Performance and Monitoring Methods

#### optimize()

Manually optimize database performance.

```typescript
async optimize(): Promise<void>
```

#### getRecommendations()

Get performance optimization recommendations.

```typescript
getRecommendations(): string[]
```

#### getPerformanceStatus()

Get real-time performance status.

```typescript
getPerformanceStatus(): {
  isHealthy: boolean;
  metrics: PerformanceMetrics;
  issues: string[];
}
```

#### generatePerformanceReport()

Generate comprehensive performance report.

```typescript
generatePerformanceReport(startTime?: number, endTime?: number): {
  summary: PerformanceSummary;
  trends: PerformanceTrends;
  recommendations: string[];
}
```

#### getSlowQueries()

Get analysis of slow queries.

```typescript
getSlowQueries(limit: number = 10): Array<{
  query: string;
  avgTime: number;
  count: number;
  lastSeen: Date;
}>
```

#### getCacheStats()

Get cache performance statistics.

```typescript
getCacheStats(): {
  hitRate: number;
  memoryUsage: number;
  entryCount: number;
  evictionCount: number;
}
```

#### healthCheck()

Perform comprehensive health check.

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

**Example:**
```typescript
const health = await db.healthCheck();
if (!health.overall) {
  console.error('Health issues detected:', health.issues);
  
  // Check specific components
  if (!health.database) console.error('Database connectivity issues');
  if (!health.cache) console.error('Cache performance issues');
  if (!health.performance) console.error('Performance degradation');
}
```

### Cache Management Methods

#### preWarmCache()

Pre-warm cache with common queries.

```typescript
async preWarmCache(): Promise<void>
```

#### invalidateCache()

Invalidate cache entries matching pattern or tags.

```typescript
async invalidateCache(pattern?: string, tags?: string[]): Promise<number>
```

**Parameters:**
- `pattern`: Glob pattern for cache keys (e.g., 'search:*')
- `tags`: Array of cache tags to invalidate

**Returns:** Number of cache entries invalidated

**Example:**
```typescript
// Invalidate all search caches
const count = await db.invalidateCache('search:*');

// Invalidate by tags
const count = await db.invalidateCache(undefined, ['category', 'facets']);
```

#### close()

Close database connections and cleanup resources.

```typescript
async close(): Promise<void>
```

## Interfaces and Types

### Core Interfaces

#### KBEntry

```typescript
interface KBEntry {
  id?: string;                    // UUID - auto-generated if not provided
  title: string;                  // Brief, descriptive title
  problem: string;                // Detailed problem description
  solution: string;               // Step-by-step solution
  category: string;               // Component category
  severity?: 'critical' | 'high' | 'medium' | 'low';
  tags?: string[];               // Searchable tags
  created_at?: Date;             // Creation timestamp
  updated_at?: Date;             // Last modification timestamp
  created_by?: string;           // User ID
  usage_count?: number;          // Access count
  success_count?: number;        // Success feedback count
  failure_count?: number;        // Failure feedback count
  last_used?: Date;              // Last access timestamp
  archived?: boolean;            // Archive status
}
```

#### SearchResult

```typescript
interface SearchResult {
  entry: KBEntry;                 // The matched entry
  score: number;                  // Relevance score (0-100)
  matchType: 'exact' | 'fuzzy' | 'ai' | 'category' | 'tag';
  highlights?: string[];          // Matching text snippets
}
```

#### SearchOptions

```typescript
interface SearchOptions {
  limit?: number;                 // Max results (1-100)
  offset?: number;                // Pagination offset
  sortBy?: 'relevance' | 'usage' | 'success_rate' | 'created_at';
  includeArchived?: boolean;      // Include archived entries
  category?: string;              // Category filter
  tags?: string[];               // Tag filters
}
```

#### DatabaseStats

```typescript
interface DatabaseStats {
  totalEntries: number;           // Active entry count
  categoryCounts: Record<string, number>; // Entries by category
  recentActivity: number;         // Entries used in last 7 days
  searchesToday: number;          // Today's search count
  averageSuccessRate: number;     // Overall success rate %
  topEntries: Array<{            // Most used entries
    title: string;
    usage_count: number;
  }>;
  diskUsage: number;             // Database file size in bytes
  performance: {
    avgSearchTime: number;        // Average search time (ms)
    cacheHitRate: number;         // Cache hit rate %
  };
}
```

### Configuration Types

#### KnowledgeDB Options

```typescript
interface KnowledgeDBOptions {
  backupDir?: string;             // Backup directory path
  maxBackups?: number;            // Max backup files (default: 10)
  autoBackup?: boolean;           // Enable auto-backup (default: true)
  backupInterval?: number;        // Hours between backups (default: 24)
}
```

#### Cache Options

```typescript
interface CacheOptions {
  ttl?: number;                   // Time to live (milliseconds)
  tags?: string[];               // Cache tags for invalidation
  priority?: 'low' | 'normal' | 'high';
}
```

## Error Handling

### Error Types

The system throws typed errors for different failure scenarios:

```typescript
// Database connection errors
class DatabaseError extends Error {
  code: string;
  cause?: Error;
}

// Validation errors
class ValidationError extends Error {
  field: string;
  value: any;
}

// Performance errors
class PerformanceError extends Error {
  metric: string;
  threshold: number;
  actual: number;
}
```

### Error Handling Patterns

```typescript
try {
  const results = await db.search('complex query');
} catch (error) {
  if (error instanceof DatabaseError) {
    console.error('Database error:', error.code, error.message);
    // Handle database connectivity issues
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.field, error.value);
    // Handle input validation errors
  } else {
    console.error('Unexpected error:', error);
    // Handle unknown errors
  }
}
```

## Performance APIs

### Monitoring

```typescript
// Real-time performance monitoring
const perfStatus = db.getPerformanceStatus();
console.log('System healthy:', perfStatus.isHealthy);
console.log('Current metrics:', perfStatus.metrics);

// Historical performance trends
const trends = db.getPerformanceTrends(24); // Last 24 hours
console.log('Search time trend:', trends.searchTime);
console.log('Cache hit trend:', trends.cacheHitRate);
```

### Optimization

```typescript
// Get optimization recommendations
const recommendations = db.getRecommendations();
recommendations.forEach(rec => console.log('💡', rec));

// Manual optimization
await db.optimize();
console.log('Database optimized');

// Index analysis and optimization
const indexAnalysis = db.getIndexAnalysis();
console.log('Index effectiveness:', indexAnalysis);

await db.optimizeIndexes();
console.log('Indexes optimized');
```

## Utility Functions

### Factory Function

```typescript
async function createKnowledgeDB(
  dbPath?: string,
  options?: KnowledgeDBOptions
): Promise<KnowledgeDB>
```

Convenience factory function that creates and initializes a KnowledgeDB instance.

**Example:**
```typescript
// Create and wait for initialization
const db = await createKnowledgeDB('./my-knowledge.db', {
  autoBackup: true,
  backupInterval: 12
});

// Database is ready to use
const results = await db.search('error codes');
```

### Configuration Helpers

```typescript
// Get configuration value
const value = db.getConfig('search.timeout');

// Set configuration value
await db.setConfig('search.timeout', '5000', 'number', 'Search timeout in ms');
```

## Usage Patterns

### Basic CRUD Operations

```typescript
// Create
const id = await db.addEntry({
  title: 'New Problem',
  problem: 'Description...',
  solution: 'Steps...',
  category: 'JCL'
});

// Read
const entry = await db.getEntry(id);

// Update
await db.updateEntry(id, { 
  solution: 'Updated solution...' 
});

// Delete (archive)
await db.updateEntry(id, { 
  archived: true 
});
```

### Advanced Search Patterns

```typescript
// Multi-strategy search
const results = await db.search('complex error', {
  limit: 20,
  sortBy: 'relevance'
});

// Faceted search
const facetedResults = await db.searchWithFacets('system error');
const categories = facetedResults.facets.categories;

// Auto-complete search
const suggestions = await db.autoComplete('vs');
```

### Performance Monitoring Pattern

```typescript
// Set up monitoring
setInterval(async () => {
  const health = await db.healthCheck();
  if (!health.overall) {
    console.warn('Health issues:', health.issues);
  }
  
  const stats = await db.getStats();
  console.log(`Performance: ${stats.performance.avgSearchTime}ms avg search`);
}, 60000); // Check every minute
```

### Backup Management Pattern

```typescript
// Scheduled backup
setInterval(async () => {
  await db.createBackup();
  console.log('Backup completed');
}, 6 * 60 * 60 * 1000); // Every 6 hours

// Export for external processing
await db.exportToJSON('./data-export.json');

// Import from external source
await db.importFromJSON('./external-data.json', true); // Merge mode
```

This API reference provides comprehensive documentation for all public methods and interfaces in the Database Utilities System. For implementation details and advanced usage patterns, refer to the [Usage Examples](../examples/) and [Architecture Documentation](../architecture.md).