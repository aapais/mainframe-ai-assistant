# High-Performance Search Backend Service

A production-ready search engine with **guaranteed <1s response time** for mainframe knowledge base applications.

## Features

### ⚡ Performance
- **Sub-second response times** (< 1000ms guaranteed)
- **High throughput** (100+ concurrent searches)
- **Memory efficient** (< 512MB footprint)
- **Horizontal scaling ready**

### 🔍 Search Capabilities
- **Advanced query parsing** (Boolean, phrase, field, fuzzy)
- **Multiple ranking algorithms** (TF-IDF, BM25, combined)
- **Fuzzy matching** with edit distance
- **Auto-complete** and spell correction
- **Faceted search** and filtering

### 🧠 Intelligence
- **Mainframe-aware** terminology processing
- **Multi-layer caching** (L1/L2/Disk)
- **Intelligent warming** strategies
- **Performance monitoring** and optimization

### 🔧 Production Ready
- **Comprehensive error handling**
- **Circuit breakers** and fallbacks
- **Performance benchmarking**
- **Health monitoring**
- **Detailed logging**

## Quick Start

```typescript
import { createSearchEngine, validatePerformance } from './search';
import { KBEntry } from '../types';

// Create search engine
const searchEngine = createSearchEngine({
  maxResults: 50,
  cacheEnabled: true,
  rankingAlgorithm: 'bm25',
  performance: {
    searchTimeout: 800,
    maxConcurrentSearches: 20
  }
});

// Initialize with knowledge base
const entries: KBEntry[] = [
  {
    id: '1',
    title: 'VSAM Status 37 Error',
    problem: 'Job fails with VSAM status code 37',
    solution: 'Check space allocation and extend dataset',
    category: 'VSAM',
    tags: ['vsam', 'status-37', 'space', 'allocation'],
    // ... other fields
  }
  // ... more entries
];

await searchEngine.initialize(entries);

// Perform searches
const results = await searchEngine.search('VSAM status 37', {
  limit: 20,
  sortBy: 'relevance',
  includeHighlights: true
});

console.log(`Found ${results.results.length} results in ${results.metrics.totalTime}ms`);

// Validate performance
const validation = await validatePerformance(searchEngine, true);
console.log('Performance validation:', validation.passed ? 'PASSED' : 'FAILED');
```

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────┐
│                AdvancedSearchEngine                 │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ QueryParser │  │TextProcessor│  │FuzzyMatcher │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │InvertedIndex│  │RankingEngine│  │ SearchCache │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Data Flow

1. **Query Processing**: Parse and normalize query
2. **Index Lookup**: Find matching documents via inverted index
3. **Ranking**: Score and rank results using BM25/TF-IDF
4. **Caching**: Store and retrieve from multi-layer cache
5. **Response**: Format and return results with metadata

## API Reference

### AdvancedSearchEngine

```typescript
class AdvancedSearchEngine {
  // Initialize with knowledge base entries
  async initialize(entries: KBEntry[]): Promise<void>
  
  // Main search interface
  async search(
    query: string, 
    options?: SearchOptions, 
    context?: SearchContext
  ): Promise<SearchResponse>
  
  // Auto-complete suggestions
  async suggest(prefix: string, limit?: number): Promise<string[]>
  
  // Spell correction
  async correct(query: string): Promise<string[]>
  
  // Document management
  async addDocument(entry: KBEntry): Promise<void>
  async removeDocument(docId: string): Promise<boolean>
  
  // Performance monitoring
  getStats(): EngineStats
  async optimize(): Promise<void>
  async shutdown(): Promise<void>
}
```

### Search Options

```typescript
interface SearchOptions {
  limit?: number;           // Max results (default: 50)
  offset?: number;          // Pagination offset
  category?: string;        // Filter by category
  tags?: string[];          // Filter by tags
  sortBy?: 'relevance' | 'usage' | 'recent';
  includeHighlights?: boolean;
  useAI?: boolean;          // Enable AI enhancement
  threshold?: number;       // Minimum relevance score
  timeout?: number;         // Query timeout (max 1000ms)
}
```

### Search Response

```typescript
interface SearchResponse {
  results: SearchResult[];
  suggestions?: string[];
  corrections?: string[];
  facets?: SearchFacet[];
  metadata: SearchMetadata;
  metrics: SearchMetrics;
  context: SearchContext;
}
```

## Query Syntax

### Basic Queries
```
error                    # Simple term
"exact phrase"          # Phrase query
VSAM status 37          # Multiple terms
```

### Boolean Queries
```
VSAM AND status         # All terms required
DB2 OR database         # Either term
error NOT timeout       # Exclude term
(JCL OR job) AND abend  # Grouping
```

### Field Queries
```
title:error             # Search in title field
category:VSAM           # Filter by category
tags:critical           # Search in tags
```

### Advanced Queries
```
databse~2               # Fuzzy matching (edit distance 2)
error^2.5               # Term boosting (2.5x weight)
VSAM*                   # Wildcard (prefix)
te?m                    # Single character wildcard
```

## Performance Tuning

### Configuration

```typescript
const config = {
  performance: {
    searchTimeout: 800,        // Leave 200ms buffer for 1s guarantee
    maxConcurrentSearches: 20, // Limit concurrent load
    optimizationLevel: 'balanced',
    memoryThreshold: 512 * 1024 * 1024 // 512MB limit
  },
  cacheEnabled: true,
  features: {
    semanticSearch: true,
    autoComplete: true,
    spellCorrection: true
  }
};
```

### Cache Strategy

```typescript
// Multi-layer caching
L1: Hot cache (1000 entries, LFU eviction, 1min TTL)
L2: Warm cache (5000 entries, LRU eviction, 5min TTL)
L3: Cold cache (persistent, optional)

// Cache warming
await searchCache.warmCache({
  popularQueries: ['error', 'VSAM', 'JCL'],
  recentSearches: [...],
  predictedTerms: [...]
});
```

### Optimization Tips

1. **Index Optimization**
   - Use appropriate field boosting
   - Limit document size and term count
   - Regular index cleanup

2. **Query Optimization**
   - Use specific terms over generic ones
   - Leverage field queries for precision
   - Avoid overly complex boolean queries

3. **Caching Optimization**
   - Enable cache warming
   - Monitor cache hit rates (target: >80%)
   - Adjust TTL based on usage patterns

4. **Memory Management**
   - Monitor memory usage
   - Use connection pooling
   - Implement graceful degradation

## Benchmarking

### Quick Validation
```typescript
import { SearchBenchmark } from './search';

const benchmark = new SearchBenchmark(searchEngine);

// 30-second quick test
const result = await benchmark.quickValidation();
console.log('Validation:', result.passed ? 'PASSED' : 'FAILED');
```

### Comprehensive Benchmark
```typescript
const fullBenchmark = await benchmark.runBenchmark({
  testDataSize: 1000,
  queryVariations: 100,
  concurrentUsers: 10,
  testDuration: 60,
  targetResponseTime: 1000
});

console.log('Average response time:', fullBenchmark.summary.averageResponseTime);
console.log('95th percentile:', fullBenchmark.summary.p95ResponseTime);
console.log('Error rate:', fullBenchmark.summary.errorRate);
```

### Stress Testing
```typescript
const stressTest = await benchmark.stressTest(50);
console.log('Max supported concurrency:', stressTest.maxSupportedConcurrency);
console.log('Degradation point:', stressTest.degradationPoint);
```

## Monitoring

### Health Metrics
```typescript
const stats = searchEngine.getStats();

console.log('Engine health:', {
  totalSearches: stats.engine.totalSearches,
  averageResponseTime: stats.engine.averageResponseTime,
  cacheHitRate: stats.cache.hitRate,
  errorRate: stats.engine.errorRate,
  memoryUsage: stats.health.memoryUsage,
  activeSearches: stats.health.activeSearches
});
```

### Performance Alerts
- Response time > 800ms (approaching limit)
- Cache hit rate < 70% (poor caching)
- Error rate > 1% (reliability issues)
- Memory usage > 80% of limit (resource pressure)

## Troubleshooting

### Common Issues

**Slow Response Times**
- Check index size and structure
- Verify cache hit rates
- Monitor concurrent search load
- Review query complexity

**High Memory Usage**
- Reduce cache sizes
- Optimize document storage
- Check for memory leaks
- Implement cleanup routines

**Low Cache Hit Rates**
- Adjust cache warming strategy
- Increase cache sizes
- Review TTL settings
- Analyze query patterns

**High Error Rates**
- Check resource limits
- Verify input validation
- Monitor timeout settings
- Review error logs

### Performance Debugging

```typescript
// Enable detailed metrics
const result = await searchEngine.search(query, {
  includeMetrics: true,
  debugMode: true
});

console.log('Detailed metrics:', {
  queryTime: result.metrics.queryTime,
  indexTime: result.metrics.indexTime,
  rankingTime: result.metrics.rankingTime,
  cacheHit: result.metrics.cacheHit,
  optimizations: result.metrics.optimizations
});
```

## Production Deployment

### Requirements
- Node.js 18+
- Memory: 512MB minimum, 1GB recommended
- CPU: 2 cores minimum, 4 cores recommended
- Storage: SSD recommended for index persistence

### Scaling Considerations
- Use load balancing for multiple instances
- Implement shared caching (Redis) for horizontal scaling
- Consider read replicas for query distribution
- Monitor and auto-scale based on load

### Security
- Input validation and sanitization
- Query timeout enforcement
- Resource limit enforcement
- Request rate limiting
- Audit logging

## License

MIT License - see LICENSE file for details.