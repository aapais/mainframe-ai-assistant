# Search Performance Guide

## Overview

This guide provides comprehensive information about the search performance system, including optimization techniques, monitoring, and troubleshooting for the Mainframe KB Assistant search implementation.

## Performance Targets

| Metric | Target | Critical Threshold |
|--------|--------|--------------------|
| Search Response Time (P95) | <1s | <2s |
| Autocomplete Response | <50ms | <100ms |
| UI Render Time | <200ms | <500ms |
| Cache Hit Rate | >90% | >70% |
| Memory Usage | <256MB | <512MB |
| Error Rate | <5% | <10% |
| Throughput | >10 req/sec | >5 req/sec |

## Architecture Overview

The search performance system consists of several integrated components:

### 1. Search Service (`SearchService.ts`)
- **Purpose**: Core search functionality with optimization features
- **Key Features**:
  - L0 instant cache (<10ms access time)
  - Parallel query execution
  - AI fallback mechanisms
  - FTS5 query optimization
  - Response time monitoring

### 2. Performance Dashboard (`SearchPerformanceDashboard.ts`)
- **Purpose**: Real-time performance monitoring and alerting
- **Key Features**:
  - Live metrics collection
  - Bottleneck identification
  - Alert generation
  - Trend analysis
  - Performance reporting

### 3. Pipeline Optimizer (`SearchPipelineOptimizer.ts`)
- **Purpose**: Automatic performance optimization
- **Key Features**:
  - Rule-based optimization
  - Performance-triggered optimizations
  - Optimization tracking
  - Risk assessment

### 4. Performance Tests
- **E2E Tests**: Complete user journey validation
- **Integration Tests**: Component interaction testing
- **Benchmark Tests**: Comprehensive performance validation
- **Load Tests**: Concurrent user simulation

## Performance Optimization Strategies

### 1. Caching Strategy

#### L0 Instant Cache
- **Location**: In-memory, SearchService
- **Purpose**: Sub-10ms response for repeated queries
- **TTL**: 5-15 minutes (auto-tuned)
- **Capacity**: 100 entries (LRU eviction)

```typescript
// Cache key generation
private generateInstantCacheKey(query: string, options: SearchOptions): string {
  const optionsHash = JSON.stringify({
    category: options.category,
    tags: options.tags,
    limit: options.limit,
    useAI: options.useAI
  });
  return `l0:${query}:${btoa(optionsHash).substring(0, 16)}`;
}
```

#### Cache Optimization Techniques
1. **Query Normalization**: Consistent cache keys
2. **Partial Results**: Cache intermediate results
3. **Preloading**: Warm cache with common queries
4. **Compression**: Reduce memory footprint

### 2. Database Optimization

#### FTS5 Query Optimization
```sql
-- Optimized FTS5 query with ranking
SELECT
  e.*,
  bm25(kb_fts) as relevance_score,
  highlight(kb_fts, 0, '<mark>', '</mark>') as title_highlight
FROM kb_fts f
INNER JOIN kb_entries e ON f.rowid = e.rowid
WHERE kb_fts MATCH ?
ORDER BY (
  bm25(kb_fts) * 0.6 +
  LOG(e.usage_count + 1) * 0.2 +
  (e.success_count / (e.success_count + e.failure_count)) * 0.15 +
  (CASE WHEN julianday('now') - julianday(e.created_at) < 30 THEN 0.05 ELSE 0 END)
) DESC
LIMIT ?
```

#### Index Optimization
- **Primary Index**: FTS5 on title, problem, solution, tags
- **Usage Index**: Compound index on usage_count DESC
- **Category Index**: Index on category for filtering
- **Date Index**: Index on created_at for recency boost

### 3. Search Algorithm Optimization

#### Query Processing Pipeline
1. **Query Normalization**: Trim, lowercase, tokenize
2. **Cache Check**: L0 instant cache lookup
3. **Parallel Execution**: Multiple search strategies
4. **Result Merging**: Intelligent deduplication
5. **Ranking**: Advanced scoring algorithm
6. **Response**: Structured results with metadata

#### Scoring Algorithm
```typescript
private calculateAdvancedScore(entry: KBEntry, query: string, context: SearchContext): number {
  let score = 0;

  // Text matching (40%)
  score += this.calculateTextScore(entry, query) * 0.4;

  // Usage popularity (25%)
  score += this.calculateUsageScore(entry) * 0.25;

  // Success rate (20%)
  score += this.calculateSuccessScore(entry) * 0.20;

  // Recency (10%)
  score += this.calculateRecencyScore(entry) * 0.10;

  // Context relevance (5%)
  score += this.calculateContextScore(entry, context) * 0.05;

  return Math.min(100, score);
}
```

### 4. UI Performance Optimization

#### Virtual Scrolling
```typescript
// Virtual scrolling implementation
const VirtualizedSearchResults = ({ results, itemHeight = 120 }) => {
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(10);

  const visibleItems = useMemo(() =>
    results.slice(startIndex, endIndex + 1),
    [results, startIndex, endIndex]
  );

  return (
    <VirtualList
      items={visibleItems}
      itemHeight={itemHeight}
      onScroll={handleScroll}
      totalItems={results.length}
    />
  );
};
```

#### React Optimization
- **Memoization**: React.memo for search results
- **Virtualization**: Large result sets
- **Debouncing**: Search input (300ms)
- **Lazy Loading**: Result details
- **Code Splitting**: Dynamic imports

## Monitoring and Alerting

### Real-time Metrics
The performance dashboard tracks:

- **Response Times**: P50, P95, P99 percentiles
- **Throughput**: Requests per second
- **Error Rates**: Failed searches percentage
- **Cache Performance**: Hit/miss rates
- **Memory Usage**: Heap size tracking
- **User Activity**: Concurrent users

### Alert Configuration
```typescript
private alertThresholds = {
  responseTime: { warning: 800, critical: 1200 },
  errorRate: { warning: 0.05, critical: 0.10 },
  cacheHitRate: { warning: 0.80, critical: 0.70 },
  memoryUsage: { warning: 200 * 1024 * 1024, critical: 256 * 1024 * 1024 }
};
```

### Performance Reports
Daily automated reports include:
- Performance trend analysis
- Bottleneck identification
- Optimization recommendations
- Capacity planning insights

## Troubleshooting Guide

### Common Performance Issues

#### 1. High Search Response Time (>1s)

**Symptoms**:
- P95 response time exceeds 1000ms
- User complaints about slow search
- High database query times

**Diagnosis**:
```bash
# Check performance metrics
dashboard.getCurrentSnapshot().components.search.p95ResponseTime

# Identify slow queries
dashboard.identifyBottlenecks()

# Review cache hit rate
dashboard.getCurrentSnapshot().components.cache.hitRate
```

**Solutions**:
1. **Increase Cache TTL**: Extend cache lifetime
2. **Optimize FTS Queries**: Review query complexity
3. **Add Database Indexes**: Missing or suboptimal indexes
4. **Enable Query Batching**: Batch similar queries
5. **Upgrade Hardware**: CPU/Memory limitations

#### 2. Low Cache Hit Rate (<80%)

**Symptoms**:
- Cache hit rate below 80%
- Repeated slow responses for same queries
- High database load

**Diagnosis**:
```typescript
// Check cache statistics
const metrics = searchService.getPerformanceMetrics();
console.log(`Cache Hit Rate: ${metrics.instantCacheHitRate * 100}%`);

// Review cache configuration
console.log(`Cache Size: ${metrics.queryOptimizationCacheSize}`);
```

**Solutions**:
1. **Increase Cache Size**: Expand cache capacity
2. **Optimize Cache Keys**: Improve key normalization
3. **Preload Common Queries**: Warm cache proactively
4. **Adjust TTL**: Balance freshness vs performance
5. **Implement L2 Cache**: Add persistent caching layer

#### 3. High Memory Usage (>256MB)

**Symptoms**:
- Memory usage exceeds 256MB
- Browser/app slowdown
- Potential memory leaks

**Diagnosis**:
```typescript
// Monitor memory usage
if (performance.memory) {
  const usage = performance.memory.usedJSHeapSize;
  console.log(`Memory Usage: ${usage / 1024 / 1024}MB`);
}

// Check for memory leaks
dashboard.recordMemoryUsage(usage);
```

**Solutions**:
1. **Implement Virtual Scrolling**: Reduce DOM elements
2. **Optimize React Renders**: Prevent unnecessary re-renders
3. **Clear Old Caches**: Implement cache cleanup
4. **Lazy Load Results**: Load details on demand
5. **Fix Memory Leaks**: Review event listeners and references

#### 4. High Error Rate (>5%)

**Symptoms**:
- Error rate exceeds 5%
- Failed searches
- AI API timeouts

**Diagnosis**:
```typescript
// Review error patterns
const snapshot = dashboard.getCurrentSnapshot();
console.log(`Error Rate: ${snapshot.components.search.errorRate * 100}%`);

// Check AI API performance
console.log(`AI API Latency: ${snapshot.components.network.aiApiLatency}ms`);
```

**Solutions**:
1. **Improve Error Handling**: Better try-catch blocks
2. **Optimize AI Fallback**: Faster local search fallback
3. **Adjust Timeouts**: Reasonable API timeouts
4. **Input Validation**: Prevent invalid queries
5. **Retry Logic**: Implement exponential backoff

## Performance Testing

### Running Performance Tests

#### E2E Performance Tests
```bash
# Run complete E2E performance test suite
npm run test:e2e:performance

# Run specific performance tests
npm run test:e2e -- --grep "performance"
```

#### Benchmark Tests
```bash
# Run comprehensive benchmark suite
npm run test:benchmark

# Run specific benchmark
npm run test -- SearchPipelineBenchmark.test.ts
```

#### Load Testing
```bash
# Test with concurrent users
npm run test:load -- --users=50 --duration=60s

# Stress test
npm run test:stress -- --rps=100
```

### Performance Test Configuration

#### Test Targets
```typescript
const PERFORMANCE_TARGETS = {
  SEARCH_RESPONSE_P95: 1000,    // <1s P95
  AUTOCOMPLETE_TIME: 50,        // <50ms
  UI_RENDER_TIME: 200,          // <200ms
  MEMORY_LIMIT: 256 * 1024 * 1024, // 256MB
  CACHE_HIT_RATE: 0.90,         // >90%
  ERROR_RATE: 0.05,             // <5%
  THROUGHPUT_MIN: 10            // >10 req/sec
};
```

### Continuous Performance Monitoring

#### CI/CD Integration
```yaml
# .github/workflows/performance.yml
name: Performance Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run performance tests
        run: npm run test:performance
      - name: Check performance regression
        run: npm run check:performance-regression
```

## Optimization Recommendations

### Immediate Optimizations (Low Effort, High Impact)

1. **Enable Caching**
   - Implement L0 instant cache
   - Set appropriate TTL values
   - Add cache warming

2. **Optimize FTS Queries**
   - Use proper FTS5 syntax
   - Add query optimization
   - Implement query batching

3. **Add Performance Monitoring**
   - Integrate performance dashboard
   - Set up alerting
   - Track key metrics

### Medium-term Optimizations (Medium Effort, Medium Impact)

1. **Implement Virtual Scrolling**
   - Reduce DOM overhead
   - Improve rendering performance
   - Handle large result sets

2. **Database Optimization**
   - Add missing indexes
   - Optimize table structure
   - Implement connection pooling

3. **UI Performance**
   - React memoization
   - Code splitting
   - Lazy loading

### Long-term Optimizations (High Effort, High Impact)

1. **Advanced Caching Strategy**
   - Multi-level caching
   - Distributed cache
   - Intelligent prefetching

2. **Search Algorithm Improvements**
   - Machine learning ranking
   - Personalized results
   - Semantic search

3. **Scalability Enhancements**
   - Horizontal scaling
   - Load balancing
   - Microservices architecture

## Best Practices

### Development Guidelines

1. **Always Measure**: Use performance monitoring
2. **Optimize Critical Path**: Focus on user-facing performance
3. **Test Early**: Include performance tests in development
4. **Monitor Production**: Continuous performance monitoring
5. **Document Changes**: Track performance impact

### Code Review Checklist

- [ ] Performance impact assessed
- [ ] Caching strategy considered
- [ ] Error handling implemented
- [ ] Memory usage optimized
- [ ] Tests include performance validation
- [ ] Monitoring metrics added

### Deployment Guidelines

1. **Performance Testing**: Run before deployment
2. **Gradual Rollout**: Monitor performance during deployment
3. **Rollback Plan**: Prepare for performance regressions
4. **Post-deployment Monitoring**: Verify performance targets

## Support and Resources

### Performance Dashboard
- Access: `/dashboard/performance`
- Metrics: Real-time performance data
- Alerts: Performance degradation notifications
- Reports: Historical performance analysis

### Documentation Links
- [API Documentation](./API.md)
- [Architecture Guide](./ARCHITECTURE.md)
- [Troubleshooting FAQ](./TROUBLESHOOTING.md)

### Contact Information
- Performance Team: performance@company.com
- On-call Support: +1-xxx-xxx-xxxx
- Slack Channel: #performance-monitoring

---

**Last Updated**: January 2025
**Version**: 1.0
**Maintainer**: Performance Engineering Team