# SQLite Performance Monitoring System

A comprehensive, production-ready performance monitoring solution for SQLite
databases with real-time analytics, health checks, query optimization, and
dashboard integration.

## Features

### 🎯 **Performance Monitor**

- Real-time query performance tracking
- Slow query detection and analysis
- Resource usage monitoring (memory, CPU, I/O)
- Connection pool metrics
- Cache hit/miss ratios
- Configurable sampling rates
- Automatic log rotation

### 📊 **Metrics Collector**

- Time-series data collection
- Statistical aggregations (p50, p95, p99)
- Configurable alert thresholds
- Multiple export formats (Prometheus, JSON, CSV)
- Historical trend analysis
- Data compression and retention management

### 🏥 **Health Check System**

- Database integrity verification
- Schema validation
- Performance degradation detection
- Data consistency checks
- Automated remediation triggers
- Comprehensive health scoring

### 🔍 **Query Analyzer**

- EXPLAIN QUERY PLAN integration
- Index usage analysis
- Query optimization suggestions
- Pattern detection for inefficient queries
- Automatic index recommendations
- Query complexity scoring

### 📈 **Dashboard Provider**

- Real-time metrics API
- Historical data queries
- Alert management
- Performance trends
- Capacity planning data
- Grafana/Prometheus integration

## Quick Start

```typescript
import { createMonitoringSystem } from './database/monitoring';
import Database from 'better-sqlite3';

// Initialize database and monitoring
const db = new Database('myapp.db');
const monitoring = createMonitoringSystem(db, {
  enableAllFeatures: true,
  enablePrometheusExport: true,
  performance: {
    slowQueryThreshold: 1000, // 1 second
    enableRealTimeAlerts: true,
  },
});

// Set up event handlers
monitoring.on('performance-alert', alert => {
  console.log(`Performance Alert: ${alert.message}`);
});

monitoring.on('index-recommendation', rec => {
  console.log(`Index Recommendation: ${rec.creationSQL}`);
});

// Initialize monitoring
await monitoring.initialize();

// Monitor database operations
const result = await monitoring.measureQuery(
  'user_search',
  'SELECT * FROM users WHERE email = ?',
  'conn_001',
  () => db.prepare('SELECT * FROM users WHERE email = ?').get(email),
  {
    userId: 'user123',
    captureQueryPlan: true,
    enableAnalysis: true,
  }
);

// Get system statistics
const stats = monitoring.getStats();
console.log(`Health Score: ${stats.healthScore}`);

// Export metrics for external monitoring
const prometheusMetrics = monitoring.exportPrometheusMetrics();
```

## Architecture

### Components Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MonitoringSystem                         │
│                   (Unified Interface)                       │
└─────────────────────────────────────────────────────────────┘
              │
              ├── PerformanceMonitor (Real-time tracking)
              ├── MetricsCollector (Time-series data)
              ├── HealthCheck (System health)
              ├── QueryAnalyzer (Query optimization)
              └── DashboardProvider (Data export)
```

### Data Flow

```
Query Execution
       │
       ▼
PerformanceMonitor ────► MetricsCollector ────► DashboardProvider
       │                       │                        │
       ▼                       ▼                        ▼
QueryAnalyzer              AlertSystem             External Systems
       │                       │                   (Grafana/Prometheus)
       ▼                       ▼
IndexRecommendations    HealthCheck
```

## Configuration

### Basic Configuration

```typescript
const monitoring = createMonitoringSystem(db, {
  // Enable/disable features
  enableAllFeatures: true,
  enablePrometheusExport: true,
  enableGrafanaIntegration: false,

  // Performance monitoring
  performance: {
    enableRealTimeAlerts: true,
    slowQueryThreshold: 1000, // ms
    criticalThreshold: 5000, // ms
    memoryAlertThreshold: 512, // MB
    sampleRate: 1.0, // 100% sampling
    retentionDays: 7,
  },

  // Metrics collection
  metrics: {
    collectionInterval: 30, // seconds
    aggregationInterval: 60, // seconds
    retentionDays: 14,
    maxDataPoints: 10000,
    enableCompression: true,
  },

  // Health checks
  health: {
    checkInterval: 300, // 5 minutes
    enableAutoRemediation: false, // Keep false for safety
    criticalThresholds: {
      performanceDegradation: 50, // 50% slower
      memoryUsageHigh: 1024, // 1GB
      diskSpaceLow: 1000, // 1GB
    },
  },

  // Query analysis
  analyzer: {
    analysisThreshold: 100, // Analyze queries > 100ms
    captureSlowQueries: true,
    generateRecommendations: true,
    trackQueryPatterns: true,
    autoIndexCreation: false, // Keep false for safety
  },
});
```

### Advanced Configuration

```typescript
const monitoring = createMonitoringSystem(db, {
  performance: {
    thresholds: {
      slowQueryMs: 500,
      criticalQueryMs: 2000,
      memoryLimitMB: 256,
      cpuLimitPercent: 80,
      cacheHitRateMin: 0.85,
      maxConcurrentQueries: 50,
    },
    alertRules: [
      {
        id: 'custom-slow-query',
        name: 'Custom Slow Query Alert',
        metric: 'query_duration',
        operator: 'gt',
        threshold: 2000,
        severity: 'critical',
        enabled: true,
        actions: ['log', 'alert', 'escalate'],
      },
    ],
  },
});
```

## Monitoring Operations

### Query Performance Monitoring

```typescript
// Basic query monitoring
await monitoring.measureQuery(
  'operation_name',
  'SELECT * FROM table WHERE condition = ?',
  'connection_id',
  () => db.prepare(query).all(params)
);

// Advanced monitoring with options
await monitoring.measureQuery('complex_search', query, connectionId, executor, {
  userId: 'user123',
  captureQueryPlan: true, // Capture EXPLAIN QUERY PLAN
  enableAnalysis: true, // Trigger query analysis
  recordsProcessed: 150, // Expected result count
  expectedCacheHit: false, // Whether result should be cached
});

// Record custom metrics
monitoring.recordMetric('custom_operation', duration, {
  recordsProcessed: 100,
  cacheHit: true,
  indexesUsed: ['idx_user_email'],
  connectionId: 'conn_001',
  userId: 'user123',
});
```

### Health Monitoring

```typescript
// Run comprehensive health check
const healthStatus = await monitoring.runHealthCheck();
console.log(`Overall Health: ${healthStatus.overall}`);
console.log(`Health Score: ${healthStatus.score}/100`);

// Get health history
const healthHistory = monitoring.health.getHealthHistory(
  'database_integrity',
  50
);

// Get integrity issues
const issues = monitoring.health.getIntegrityIssues(false); // unresolved issues
```

### Query Analysis & Optimization

```typescript
// Get slow queries
const slowQueries = monitoring.analyzer.getSlowQueries(10);
slowQueries.forEach(query => {
  console.log(`${query.avgDuration}ms: ${query.query}`);
});

// Get index recommendations
const recommendations = monitoring.analyzer.getIndexRecommendations('high');
recommendations.forEach(rec => {
  console.log(`${rec.priority}: ${rec.creationSQL}`);
  console.log(`Expected improvement: ${rec.estimatedImpact}%`);
});

// Implement recommended index (with caution!)
const result = await monitoring.implementIndexRecommendation(
  recommendationId,
  false // Set to true to actually execute
);

// Get query patterns
const patterns = monitoring.analyzer.getQueryPatterns(20);
patterns.forEach(pattern => {
  console.log(`${pattern.occurrences}x: ${pattern.pattern}`);
});
```

### Dashboard & Metrics Export

```typescript
// Get current dashboard data
const dashboardData = monitoring.getDashboardData();
console.log('Current Metrics:', dashboardData.metrics);
console.log('Active Alerts:', dashboardData.alerts);
console.log('Capacity Planning:', dashboardData.capacity);

// Get time series data for charting
const responseTimeData = monitoring.dashboard.getTimeSeriesData(
  'responseTime',
  24
);
const throughputData = monitoring.dashboard.getTimeSeriesData('throughput', 24);

// Export for Prometheus
const prometheusMetrics = monitoring.exportPrometheusMetrics();

// Export for Grafana
const grafanaConfig = monitoring.getGrafanaConfig();
const grafanaResponse = monitoring.handleGrafanaQuery(grafanaQuery);

// Get capacity planning recommendations
const capacityData = monitoring.dashboard.getCapacityPlanningData();
capacityData.recommendations.forEach(rec => {
  console.log(`${rec.urgency}: ${rec.description} (${rec.timeline})`);
});
```

## Event Handling

### Performance Events

```typescript
monitoring.on('performance-alert', alert => {
  console.log(`🚨 ${alert.level}: ${alert.message}`);

  if (alert.level === 'critical') {
    // Escalate to on-call engineer
    sendAlert(alert);
  }
});

monitoring.on('metric', metric => {
  // Log to external system
  if (metric.duration > 5000) {
    logToSplunk(metric);
  }
});
```

### Health Events

```typescript
monitoring.on('health-status-updated', status => {
  updateHealthDashboard(status);

  if (status.overall === 'critical') {
    triggerIncident(status);
  }
});

monitoring.on('remediation-completed', action => {
  console.log(`✅ Auto-remediation completed: ${action.action}`);
});

monitoring.on('remediation-failed', error => {
  console.log(`❌ Auto-remediation failed: ${error.error}`);
  escalateToHuman(error);
});
```

### Query Analysis Events

```typescript
monitoring.on('query-analyzed', analysis => {
  if (analysis.performance.complexity === 'very_high') {
    flagForReview(analysis);
  }
});

monitoring.on('index-recommendation', recommendation => {
  if (recommendation.priority === 'critical') {
    scheduleIndexCreation(recommendation);
  }
});
```

## Production Deployment

### Monitoring Setup

```typescript
// Production configuration
const monitoring = createMonitoringSystem(db, {
  performance: {
    sampleRate: 0.1, // 10% sampling in production
    retentionDays: 30, // 30-day retention
    enableRealTimeAlerts: true,
  },
  metrics: {
    collectionInterval: 60, // 1 minute collection
    aggregationInterval: 300, // 5 minute aggregation
    enableCompression: true,
  },
  health: {
    checkInterval: 900, // 15 minute health checks
    enableAutoRemediation: false, // Disable for safety
  },
});

// Set up production alerting
monitoring.on('performance-alert', async alert => {
  await sendToSlack(alert);
  await logToPagerDuty(alert);
  await updateStatusPage(alert);
});

monitoring.on('health-status-updated', async status => {
  await updateMonitoringDashboard(status);

  if (status.score < 50) {
    await triggerIncident(status);
  }
});
```

### Resource Management

```typescript
// Proper cleanup on application shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down monitoring system...');
  await monitoring.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await monitoring.shutdown();
  process.exit(0);
});

// Memory monitoring
monitoring.on('metrics-alert', alert => {
  if (alert.metricName === 'sqlite_memory_usage_bytes') {
    if (alert.severity === 'critical') {
      // Force garbage collection
      global.gc && global.gc();

      // Consider restarting application
      scheduleGracefulRestart();
    }
  }
});
```

## Integration Examples

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "SQLite Performance Monitor",
    "panels": [
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "target": "response_time",
            "refId": "A"
          }
        ]
      },
      {
        "title": "Throughput",
        "type": "graph",
        "targets": [
          {
            "target": "throughput",
            "refId": "B"
          }
        ]
      },
      {
        "title": "Health Score",
        "type": "singlestat",
        "targets": [
          {
            "target": "health_score",
            "refId": "C"
          }
        ]
      }
    ]
  }
}
```

### Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'sqlite-monitoring'
    static_configs:
      - targets: ['localhost:3000']
    scrape_interval: 30s
    metrics_path: '/metrics'
```

### Docker Integration

```dockerfile
FROM node:18-alpine

# Install monitoring dependencies
RUN npm install sqlite3 better-sqlite3

# Copy monitoring system
COPY src/database/monitoring ./monitoring

# Expose metrics endpoint
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "app.js"]
```

## Performance Considerations

### Resource Usage

- **Memory**: ~10-50MB overhead (configurable via sampling rate)
- **CPU**: <1% additional CPU usage for typical workloads
- **Storage**: ~1-10MB per day (depends on query volume and retention)
- **I/O**: Minimal impact with proper sampling configuration

### Optimization Tips

```typescript
// Production optimizations
const monitoring = createMonitoringSystem(db, {
  performance: {
    sampleRate: 0.05, // 5% sampling for high-volume systems
    batchSize: 1000, // Larger batches for efficiency
    retentionDays: 7, // Shorter retention for space savings
  },
  metrics: {
    aggregationInterval: 300, // 5-minute aggregation
    enableCompression: true, // Enable compression
    maxDataPoints: 50000, // Limit memory usage
  },
});

// Conditional monitoring for different query types
await monitoring.measureQuery(operation, query, connectionId, executor, {
  enableAnalysis: duration > 1000, // Only analyze slow queries
  captureQueryPlan: isComplexQuery, // Only for complex queries
});
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**

   ```typescript
   // Reduce sampling rate
   monitoring.updateConfig({
     performance: { sampleRate: 0.01 }, // 1% sampling
     metrics: { maxDataPoints: 10000 }, // Reduce buffer size
   });
   ```

2. **Too Many Alerts**

   ```typescript
   // Adjust thresholds
   monitoring.updateConfig({
     performance: { slowQueryThreshold: 2000 }, // Increase threshold
     dashboard: {
       alertThresholds: { responseTime: 1500 },
     },
   });
   ```

3. **Storage Growth**
   ```typescript
   // Reduce retention
   monitoring.updateConfig({
     performance: { retentionDays: 3 },
     metrics: { retentionDays: 7 },
   });
   ```

### Debugging

```typescript
// Enable debug logging
monitoring.on('metric', metric => {
  if (process.env.DEBUG_MONITORING) {
    console.log('Metric recorded:', metric);
  }
});

// Get diagnostic information
const stats = monitoring.getStats();
console.log('System Stats:', stats);

const collectorStats = monitoring.metrics.getCollectionStats();
console.log('Collector Stats:', collectorStats);

const analyzerStats = monitoring.analyzer.getAnalyzerStats();
console.log('Analyzer Stats:', analyzerStats);
```

## License

This monitoring system is part of the Mainframe AI Assistant project and follows
the same license terms.

## Contributing

Contributions are welcome! Please ensure all monitoring components maintain:

- Minimal performance overhead
- Production-ready reliability
- Comprehensive test coverage
- Clear documentation
- Backward compatibility
