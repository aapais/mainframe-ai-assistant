# Performance Monitoring & Optimization Guide

A comprehensive performance engineering system for the Mainframe KB Assistant with real-time monitoring, automated optimization, and SLA compliance enforcement.

## 📊 Overview

The performance monitoring system provides:

- **Real-time Performance Dashboard**: Live metrics, trends, and alerts
- **Automated Optimization Engine**: AI-driven performance improvements
- **Comprehensive Testing Suite**: Load, stress, and regression testing
- **SLA Compliance Monitoring**: Automated enforcement of performance targets
- **Memory Profiling**: Leak detection and optimization
- **Bundle Analysis**: Code splitting and optimization recommendations

## 🎯 SLA Targets

| Metric | Target | Alert Threshold |
|--------|---------|-----------------|
| Autocomplete Response | < 100ms | 150ms |
| Search Response | < 1000ms | 1200ms |
| System Availability | > 99.9% | 99.5% |
| Memory Usage | < 500MB | 600MB |
| Error Rate | < 5% | 7% |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Performance System                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐      │
│  │ Dashboard   │  │ Monitoring   │  │ Optimization    │      │
│  │ Component   │◄─┤ Service      │◄─┤ Engine          │      │
│  └─────────────┘  └──────────────┘  └─────────────────┘      │
│         │                 │                  │               │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐      │
│  │ Alerts &    │  │ Search       │  │ Performance     │      │
│  │ Notifications│  │ Monitor      │  │ Tests           │      │
│  └─────────────┘  └──────────────┘  └─────────────────┘      │
│                           │                                  │
│  ┌─────────────────────────────────────────────────────┐      │
│  │            Service Worker Cache Layer               │      │
│  └─────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Basic Integration

```tsx
import React from 'react';
import { PerformanceService } from './src/services/PerformanceService';
import { PerformanceDashboard } from './src/monitoring/PerformanceDashboard';
import Database from 'better-sqlite3';

const App = () => {
  const database = new Database('./kb.db');
  const performanceService = new PerformanceService(database, {
    autoOptimization: true,
    alertThresholds: {
      responseTime: 1000,
      memoryUsage: 500,
      errorRate: 0.05,
      cacheHitRate: 0.7
    }
  });

  return (
    <PerformanceDashboard
      performanceService={performanceService}
      searchService={searchService}
      onOptimizationRequired={(metric) => {
        console.log(`Optimization requested for: ${metric}`);
      }}
    />
  );
};
```

### 2. Recording Search Performance

```typescript
// Record each search operation
searchService.recordSearch(
  query,           // Search query
  duration,        // Response time in ms
  resultCount,     // Number of results
  cacheHit,        // Whether result came from cache
  'fts5',          // Search strategy used
  ['idx_title']    // Indexes used
);
```

### 3. Automated Optimization

```typescript
// Enable auto-optimization
performanceService.setAutoOptimization(true);

// Manual optimization
const result = await performanceService.executeOptimization('optimize-indexes');
console.log(`Optimization result: ${result.improvement.toFixed(1)}% improvement`);
```

## 📈 Dashboard Features

### Real-time Metrics

- **Response Time Trends**: P50, P95, P99 percentiles over time
- **Throughput**: Queries per second with trend analysis
- **Cache Performance**: Hit rates and optimization opportunities
- **Error Tracking**: Error rates and patterns
- **Memory Usage**: Heap usage and leak detection

### SLA Compliance Cards

Each SLA metric displays:
- Current value vs target
- Compliance status (✅ Compliant / ⚠️ Violation)
- Visual progress bar
- Trend indicator (↗ Improving / → Stable / ↘ Degrading)

### Active Alerts

- **Critical**: Immediate action required (response time > 2s)
- **Warning**: Performance degradation (response time > SLA)
- **Info**: General notifications and optimizations

### Optimization Recommendations

- **High Priority**: Query optimization, index tuning
- **Medium Priority**: Cache improvements, memory optimization
- **Low Priority**: Bundle optimization, code splitting

## 🔧 Optimization Strategies

### Database Optimizations

```sql
-- Automatic index optimization
CREATE INDEX IF NOT EXISTS idx_search_performance
ON search_metrics(timestamp, duration_ms);

CREATE INDEX IF NOT EXISTS idx_kb_usage_success
ON kb_entries(usage_count DESC, success_count DESC);

-- Query optimization with EXPLAIN QUERY PLAN
EXPLAIN QUERY PLAN
SELECT * FROM kb_entries WHERE title MATCH 'search term';
```

### Cache Optimizations

```typescript
// Intelligent cache preloading
const popularQueries = await searchMonitor.getTopQueries(20);
await Promise.all(
  popularQueries.map(query =>
    cacheService.preload(query.normalizedQuery)
  )
);

// Cache TTL optimization
const cacheConfig = {
  searchResults: 300000,  // 5 minutes
  suggestions: 600000,    // 10 minutes
  staticAssets: 7 * 24 * 60 * 60 * 1000  // 7 days
};
```

### Memory Optimizations

```typescript
// Memory leak detection
const memoryProfile = await performanceService.profileMemory();

if (memoryProfile.leaks.length > 0) {
  console.log('Memory leaks detected:');
  memoryProfile.leaks.forEach(leak => {
    console.log(`- ${leak.type}: ${leak.count} objects, ${leak.size}MB`);
  });
}

// Memory pool optimization
const memoryPool = new MemoryPool({
  initialSize: 10 * 1024 * 1024,  // 10MB
  maxSize: 100 * 1024 * 1024,     // 100MB
  chunkSize: 1024 * 1024          // 1MB chunks
});
```

### Bundle Optimizations

```typescript
// Code splitting analysis
const bundleAnalysis = await performanceService.analyzeBundleSize();

console.log(`Total bundle size: ${(bundleAnalysis.totalSize / 1024 / 1024).toFixed(1)}MB`);
console.log('Optimization opportunities:');
bundleAnalysis.optimizations.forEach(opt => console.log(`- ${opt}`));

// Dynamic imports for heavy components
const HeavyComponent = React.lazy(() =>
  import('./components/HeavyComponent')
);
```

## 🧪 Performance Testing

### Load Testing

```typescript
const loadTestConfig = {
  duration: 300,        // 5 minutes
  concurrency: 20,      // 20 concurrent users
  rampUpTime: 30,       // 30 second ramp-up
  queries: testQueries, // Array of test queries
  targetThroughput: 15  // 15 QPS target
};

const results = await testSuite.runLoadTest(loadTestConfig);
console.log(`Load test: ${results.passed ? 'PASSED' : 'FAILED'}`);
console.log(`P95 response time: ${results.metrics.responseTime.p95}ms`);
console.log(`Throughput: ${results.metrics.throughput.toFixed(1)} QPS`);
```

### Stress Testing

```typescript
const stressConfig = {
  maxConcurrency: 100,    // Test up to 100 users
  stepSize: 10,           // Increase by 10 users each step
  stepDuration: 60,       // 60 seconds per step
  memoryThreshold: 500,   // 500MB memory limit
  responseTimeThreshold: 1000  // 1s response time limit
};

const stressResults = await testSuite.runStressTest(stressConfig);
console.log(`Breaking point: ${stressConfig.breakingPoint} concurrent users`);
```

### Regression Testing

```typescript
// Run full test suite
const currentResults = await testSuite.runFullTestSuite();

// Compare with baseline
const regressionReport = testSuite.generateRegressionReport(baselineResults);

if (regressionReport.regressions.length > 0) {
  console.log('⚠️ Performance regressions detected:');
  regressionReport.regressions.forEach(regression => {
    console.log(`- ${regression.testName}: ${regression.metric} ${regression.change.toFixed(1)}% worse`);
  });
}
```

## 🔄 Service Worker Caching

The system includes an intelligent Service Worker for aggressive caching:

### Cache Strategies

```javascript
// Search results: 5-minute TTL with stale-while-revalidate
const searchResponse = await cache.match(searchRequest);
if (searchResponse && !isCacheExpired(searchResponse, 300000)) {
  return searchResponse; // Cache hit
}

// Static assets: 7-day TTL with cache-first
const assetResponse = await cache.match(assetRequest);
if (assetResponse) {
  return assetResponse; // Long-term cache hit
}
```

### Performance Metrics Tracking

```javascript
// Service Worker tracks cache performance
const performanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  networkRequests: 0,
  averageResponseTime: 0
};

// Send metrics to main thread
self.clients.matchAll().then(clients => {
  clients.forEach(client => {
    client.postMessage({
      type: 'PERFORMANCE_METRICS_UPDATE',
      metrics: performanceMetrics
    });
  });
});
```

## 📊 Monitoring & Alerting

### Alert Configuration

```typescript
const alertThresholds = {
  responseTime: {
    warning: 800,    // 800ms
    critical: 2000   // 2 seconds
  },
  memoryUsage: {
    warning: 400,    // 400MB
    critical: 600    // 600MB
  },
  errorRate: {
    warning: 0.02,   // 2%
    critical: 0.05   // 5%
  },
  cacheHitRate: {
    warning: 0.7,    // 70%
    critical: 0.5    // 50%
  }
};
```

### Custom Alert Handlers

```typescript
performanceService.on('performance-alert', (alert) => {
  if (alert.level === 'critical') {
    // Send to incident management system
    await incidentService.createIncident({
      title: `Performance Alert: ${alert.message}`,
      description: `Metric: ${alert.metric}, Value: ${alert.currentValue}, Threshold: ${alert.threshold}`,
      priority: 'high',
      tags: ['performance', alert.metric]
    });
  }

  // Send to monitoring dashboard
  await monitoringService.sendAlert(alert);
});
```

## 🎛️ Configuration

### Environment-specific Settings

```typescript
// Development
const devConfig = {
  autoOptimization: false,
  monitoringInterval: 30000,    // 30 seconds
  alertThresholds: {
    responseTime: 2000,         // More lenient
    memoryUsage: 800
  }
};

// Production
const prodConfig = {
  autoOptimization: true,
  monitoringInterval: 15000,    // 15 seconds
  alertThresholds: {
    responseTime: 1000,         // Strict SLA
    memoryUsage: 500
  }
};
```

### Custom Optimization Strategies

```typescript
// Register custom optimization strategy
optimizationEngine.registerStrategy('custom-cache-optimization', {
  name: 'Custom Cache Optimization',
  category: 'cache',
  priority: 'high',
  impact: 0.4,
  risk: 0.1,
  effort: 0.3,
  execute: async () => {
    // Custom optimization logic
    await customCacheOptimization();

    return {
      success: true,
      improvement: 25, // 25% improvement
      recommendations: ['Monitor cache hit rates closely']
    };
  }
});
```

## 🔍 WebAssembly Integration

### High-Performance Search Algorithms

```typescript
// Load WASM module for intensive computations
const wasmModule = await WebAssembly.instantiateStreaming(
  fetch('/search-algorithms.wasm')
);

// Use WASM for fuzzy matching
const fuzzySearchResults = wasmModule.instance.exports.fuzzySearch(
  queryPointer,
  entriesPointer,
  threshold
);
```

### Memory Management

```typescript
// Efficient memory allocation for WASM
const memory = new WebAssembly.Memory({
  initial: 10,    // 640KB initial
  maximum: 100    // 6.4MB maximum
});

const wasmModule = await WebAssembly.instantiate(wasmBytes, {
  env: { memory }
});
```

## 📈 Best Practices

### 1. Monitoring

- Set up alerts for all critical metrics
- Monitor trends, not just current values
- Use percentiles (P95, P99) not just averages
- Implement distributed tracing for complex operations

### 2. Optimization

- Always measure before optimizing
- Implement gradual rollouts for optimizations
- Have rollback plans for every optimization
- Monitor performance after each change

### 3. Testing

- Run performance tests in CI/CD pipeline
- Test with realistic data volumes
- Include stress testing for peak loads
- Test degradation scenarios (network issues, high CPU)

### 4. Caching

- Use appropriate TTL values for different data types
- Implement cache warming for critical data
- Monitor cache hit rates continuously
- Use cache invalidation strategies

### 5. Memory Management

- Profile memory usage regularly
- Implement proper cleanup in React components
- Use WeakMap/WeakSet for temporary references
- Monitor for memory leaks in development

## 🛠️ Troubleshooting

### High Response Times

1. Check database query execution plans
2. Verify index usage
3. Monitor cache hit rates
4. Check for memory pressure
5. Review recent code changes

### Memory Issues

1. Run memory profiler
2. Check for event listener leaks
3. Verify cache cleanup
4. Monitor garbage collection
5. Check for retained objects

### High Error Rates

1. Check application logs
2. Monitor network connectivity
3. Verify database health
4. Check for resource exhaustion
5. Review error patterns

## 📚 API Reference

### PerformanceService

```typescript
interface PerformanceService {
  // Metrics
  getMetrics(timeRange?: '1h' | '24h' | '7d'): Promise<MetricsData>;
  recordSearch(query: string, duration: number, ...): void;

  // Optimization
  executeOptimization(strategy: string): Promise<OptimizationResult>;
  getOptimizationRecommendations(metric: string): Promise<Recommendations>;

  // Testing
  runPerformanceTests(): Promise<TestResults>;

  // Profiling
  profileMemory(): Promise<MemoryProfile>;
  analyzeBundleSize(): Promise<BundleAnalysis>;
}
```

### PerformanceOptimizer

```typescript
interface PerformanceOptimizer {
  analyzePerformance(): Promise<PerformanceAnalysis>;
  optimizeStrategy(name: string): Promise<OptimizationResult>;
  autoOptimize(level?: 'conservative' | 'moderate' | 'aggressive'): Promise<Results>;
}
```

### SearchPerformanceMonitor

```typescript
interface SearchPerformanceMonitor {
  recordSearch(query: string, duration: number, ...): void;
  getDashboardData(): DashboardData;
  getPerformanceTrends(hours: number): TrendsData;
  getSLAStatus(): SLAStatus;
}
```

## 📄 License

This performance monitoring system is part of the Mainframe KB Assistant project and follows the same licensing terms.

---

For more detailed information, see the individual component documentation in the `/src` directory.