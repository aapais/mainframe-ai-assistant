# Database Performance Optimization System

## Overview

This document describes the comprehensive performance optimization system designed for the Mainframe AI Assistant Knowledge Base. The system is specifically optimized to handle **1000+ KB entries with sub-1 second search performance**.

## Architecture Components

### Core Performance Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Performance Manager                             │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐ │
│  │   Monitoring    │ │   Alerting      │ │    Auto-Optimization    │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│                    Search Optimization Engine                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐ │
│  │ Query Analysis  │ │ Strategy Engine │ │   Adaptive Learning     │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│                       Query Cache System                             │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐ │
│  │  LRU Cache      │ │  Pre-warming    │ │  Compression & TTL      │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│                    Connection Pool Manager                           │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐ │
│  │ Reader Conns    │ │ Writer Conns    │ │  Pre-compiled Stmts     │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│                  Advanced Index Strategy                             │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐ │
│  │ Covering Index  │ │ Composite Index │ │   Expression Index      │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│                          SQLite Database                             │
│              WAL Mode | PRAGMA Optimizations | FTS5                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Performance Features

### 1. Advanced Indexing Strategy (`AdvancedIndexStrategy.ts`)

#### Covering Indexes
Eliminate table lookups by including all required columns in the index:

```sql
-- Hybrid search covering index
CREATE INDEX idx_search_covering_hybrid ON kb_entries 
  (category, severity, usage_count, success_count)
  INCLUDE (id, title, problem, solution, created_at, last_used)
  WHERE archived = FALSE;
```

#### Composite Indexes
Optimize multi-criteria searches:

```sql
-- Multi-criteria search optimization
CREATE INDEX idx_multi_criteria_search ON kb_entries 
  (category, severity, success_rate, usage_count DESC, created_at DESC);
```

#### Expression Indexes
Accelerate computed queries:

```sql
-- Success rate calculation index
CREATE INDEX idx_success_rate_computed ON kb_entries 
  ((CAST(success_count AS REAL) / NULLIF(success_count + failure_count, 0)));
```

### 2. Connection Pool Manager (`ConnectionPool.ts`)

#### Reader/Writer Separation
- **Reader Connections**: 80% of pool, optimized for SELECT queries
- **Writer Connections**: 20% of pool, dedicated to INSERT/UPDATE operations

#### Performance Optimizations
```typescript
// Reader connection configuration
db.pragma('cache_size = -64000');     // 64MB cache
db.pragma('mmap_size = 268435456');   // 256MB memory mapping
db.pragma('threads = 4');             // Multi-threading support
db.pragma('temp_store = MEMORY');     // In-memory temp tables
```

#### Pre-compiled Statements
Frequently used queries are pre-compiled for maximum performance:

```typescript
private precompiledStmts = {
  searchByCategory: 'SELECT * FROM kb_entries WHERE category = ? ORDER BY usage_count DESC LIMIT ?',
  searchFTS: 'SELECT * FROM kb_fts WHERE kb_fts MATCH ? ORDER BY rank LIMIT ?',
  updateUsage: 'UPDATE kb_entries SET usage_count = usage_count + 1 WHERE id = ?'
};
```

### 3. Multi-Level Query Cache (`QueryCache.ts`)

#### Intelligent Pre-warming
Cache is pre-populated with high-frequency queries:

```typescript
// Category-based pre-warming
const categoryQueries = ['category:VSAM', 'category:JCL', 'category:DB2'];

// Error pattern pre-warming  
const errorPatterns = ['S0C7', 'S0C4', 'VSAM status', 'dataset not found'];
```

#### Dynamic TTL Calculation
Cache TTL is adjusted based on query frequency:

```typescript
private calculateTTLBasedOnUsage(frequency: number): number {
  if (frequency > 100) return 1800000; // 30 minutes
  if (frequency > 50) return 900000;   // 15 minutes
  if (frequency > 20) return 600000;   // 10 minutes
  return 180000; // 3 minutes for low-frequency
}
```

#### Compression for Large Results
Results over 1KB are automatically compressed:

```typescript
if (serialized.length > this.compressionThreshold) {
  compressed = await this.compressData(serialized);
  compressionRatio = compressed.length / serialized.length;
}
```

### 4. Search Optimization Engine (`SearchOptimizationEngine.ts`)

#### Adaptive Query Optimization
Automatically detects and optimizes slow query patterns:

```typescript
async applyOptimization(strategy: OptimizationStrategy): Promise<OptimizationResult> {
  const beforeMetrics = await this.measurePerformance();
  
  // Apply optimization
  await this.implementStrategy(strategy);
  
  const afterMetrics = await this.measurePerformance();
  const improvement = this.calculateImprovement(beforeMetrics, afterMetrics);
  
  if (improvement < strategy.minimumImprovement) {
    await this.rollbackOptimization(strategy);
    return { success: false, improvement: 0 };
  }
  
  return { success: true, improvement };
}
```

### 5. Performance Manager (`PerformanceManager.ts`)

#### Real-time Monitoring
Continuously monitors key performance metrics:

```typescript
interface PerformanceMetrics {
  avgQueryTime: number;           // Target: < 1000ms
  cacheHitRate: number;          // Target: > 80%
  indexUtilization: number;      // Target: > 85%
  connectionPoolUtilization: number;
  totalQueries: number;
  slowQueries: number;           // Target: < 5% of total
}
```

#### Automatic Optimization Triggers
Performance Manager automatically applies optimizations when thresholds are exceeded:

```typescript
if (this.metrics.avgQueryTime > this.thresholds.maxQueryTime) {
  await this.applyAutomaticOptimizations();
}
```

### 6. Comprehensive Benchmarking (`SearchPerformanceBenchmark.ts`)

#### 12 Performance Test Scenarios
1. **Simple Search**: Basic text search
2. **Category Filter**: Single category filtering  
3. **Multi-term Search**: Complex query parsing
4. **Fuzzy Search**: Approximate matching
5. **Tag-based Search**: Tag filtering and combinations
6. **Complex Multi-filter**: Multiple simultaneous filters
7. **Semantic Search**: AI-powered matching (when available)
8. **Auto-complete**: Real-time suggestions
9. **Large Result Sets**: Handling 100+ results
10. **Concurrent Search**: Multiple simultaneous queries
11. **Cache Performance**: Hit/miss ratio testing
12. **Stress Test**: Maximum load testing (1000+ entries)

## Quick Start Guide

### Basic Setup

```typescript
import { setupPerformanceOptimizedDB } from './database/performanceSetup';

// Initialize with default optimizations
const { db, manager } = await setupPerformanceOptimizedDB();

// Perform optimized search
const results = await db.search('VSAM status 35', {
  limit: 10,
  useCache: true,
  enableSemantic: true
});
```

### Development Setup

```typescript
import { setupDevelopmentDB } from './database/performanceSetup';

// Optimized for development with in-memory DB
const { db, manager } = await setupDevelopmentDB();
```

### Production Setup

```typescript
import { setupProductionDB } from './database/performanceSetup';

// Enterprise-grade setup with full optimizations
const { db, manager } = await setupProductionDB('/path/to/production.db');
```

## Performance Targets

| Metric | Target | Optimized For |
|--------|--------|---------------|
| **Search Latency (P50)** | < 500ms | 1000+ entries |
| **Search Latency (P95)** | < 1000ms | Complex queries |
| **Cache Hit Rate** | > 80% | Repeated searches |
| **Concurrent Users** | 20+ | Multiple searchers |
| **Memory Usage** | < 500MB | Reasonable resource usage |
| **Slow Query Rate** | < 5% | Overall reliability |

## Configuration Options

### Connection Pool Configuration

```typescript
const connectionPool = new ConnectionPool({
  database: './knowledge.db',
  maxReaders: 8,        // 80% of connections
  maxWriters: 2,        // 20% of connections  
  busyTimeout: 30000,   // 30 second timeout
  enableWAL: true,      // Write-Ahead Logging
  enableOptimizations: true
});
```

### Cache Configuration

```typescript
const cache = new QueryCache({
  maxSize: 1000,              // Maximum cached queries
  ttl: 600000,               // 10 minute default TTL
  enablePreWarming: true,     // Pre-populate with common queries
  compressionThreshold: 1000, // Compress results > 1KB
  compressionRatio: 0.7       // Target 70% compression
});
```

### Performance Thresholds

```typescript
const thresholds = {
  maxQueryTime: 1000,         // 1 second maximum
  minCacheHitRate: 0.8,       // 80% minimum hit rate
  maxSlowQueryPercent: 0.05,  // 5% maximum slow queries
  benchmarkIntervalHours: 24  // Daily benchmarking
};
```

## Monitoring and Alerts

### Performance Alerts

The system automatically monitors performance and generates alerts:

```typescript
manager.on('alert', (alert) => {
  switch(alert.type) {
    case 'slow_query':
      console.log(`🚨 Query taking ${alert.queryTime}ms (threshold: ${alert.threshold}ms)`);
      break;
    case 'low_cache_hit':
      console.log(`⚠️ Cache hit rate: ${alert.cacheHitRate}% (target: 80%)`);
      break;
    case 'high_load':
      console.log(`📈 High system load detected`);
      break;
  }
});
```

### Automatic Optimization

When performance degrades, the system automatically applies optimizations:

```typescript
manager.on('optimization_applied', (result) => {
  console.log(`✅ Applied ${result.strategy.name}: ${result.improvement}% improvement`);
});
```

## Benchmarking

### Run Performance Validation

```typescript
import { validatePerformanceOptimizations } from './database/performanceSetup';

const validation = await validatePerformanceOptimizations(db, manager);

if (validation.passed) {
  console.log('✅ All performance targets met');
} else {
  console.log('❌ Performance issues detected');
  validation.recommendations.forEach(rec => console.log(`💡 ${rec}`));
}
```

### Custom Benchmark

```typescript
import { SearchPerformanceBenchmark } from './database/SearchPerformanceBenchmark';

const benchmark = new SearchPerformanceBenchmark();
const results = await benchmark.runSearchBenchmark({
  datasetSize: 1000,
  iterations: 100,
  includeStressTest: true
});

console.log(`P50 Latency: ${results.summary.p50}ms`);
console.log(`P95 Latency: ${results.summary.p95}ms`);
```

## Troubleshooting

### Common Performance Issues

#### 1. Slow Search Performance
```typescript
// Check index utilization
const indexUsage = await db.analyzeIndexUsage();
if (indexUsage.unusedIndexes.length > 0) {
  // Consider removing unused indexes
}
```

#### 2. Low Cache Hit Rate
```typescript
// Analyze cache effectiveness
const cacheStats = cache.getStatistics();
if (cacheStats.hitRate < 0.8) {
  // Increase cache size or adjust TTL
  cache.updateConfiguration({ maxSize: 2000, ttl: 1200000 });
}
```

#### 3. High Memory Usage
```typescript
// Monitor memory usage
const memUsage = process.memoryUsage();
if (memUsage.heapUsed > 500 * 1024 * 1024) {
  // Reduce cache size or enable compression
  cache.updateConfiguration({ compressionThreshold: 500 });
}
```

### Performance Debugging

#### Enable Detailed Logging
```typescript
process.env.DEBUG = 'kb:performance,kb:cache,kb:index';
```

#### Query Analysis
```typescript
// Analyze slow queries
const slowQueries = await manager.getSlowQueries(24); // Last 24 hours
slowQueries.forEach(query => {
  console.log(`🐌 ${query.text} (${query.duration}ms)`);
});
```

## Best Practices

### 1. Query Optimization
- Use specific categories when possible: `category:VSAM` vs generic search
- Combine filters effectively: `category:JCL severity:high`
- Utilize full-text search operators: `"exact phrase"` or `term*`

### 2. Cache Optimization
- Pre-warm cache with frequent queries during startup
- Monitor cache hit rates and adjust TTL accordingly
- Use compression for large result sets

### 3. Index Maintenance
- Regularly analyze index usage and remove unused indexes
- Create covering indexes for frequent multi-column queries
- Monitor index bloat and rebuild when necessary

### 4. Connection Management
- Separate read and write operations where possible
- Use connection pooling for concurrent access
- Monitor connection utilization and adjust pool size

## Migration Guide

### From Basic Setup to Optimized Setup

```typescript
// Old basic setup
const db = new KnowledgeDB('./knowledge.db');

// New optimized setup
const { db, manager } = await setupPerformanceOptimizedDB({
  dbPath: './knowledge.db',
  maxConnections: 10,
  cacheSize: 1000
});
```

### Preserving Existing Data

The optimization system is designed to work with existing databases. All optimizations are additive and do not require data migration.

## Performance Validation Checklist

- [ ] Search latency < 1 second for 1000+ entries
- [ ] Cache hit rate > 80%
- [ ] Connection pool utilization < 90%
- [ ] Memory usage < 500MB
- [ ] Slow query rate < 5%
- [ ] Benchmark score > 80/100
- [ ] All indexes being utilized
- [ ] No query timeout errors
- [ ] Performance alerts configured
- [ ] Monitoring dashboard active

## Support

For performance-related issues or optimization questions, please refer to:

1. Check the Performance Manager alerts and recommendations
2. Run the comprehensive benchmark suite
3. Analyze slow query logs
4. Review cache hit rates and index utilization
5. Consult the troubleshooting section above

The performance optimization system is designed to automatically handle most performance issues, but manual intervention may be required for specialized use cases or extreme load conditions.