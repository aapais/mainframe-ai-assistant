# Optimization Engine Usage Guide

The Optimization Engine provides intelligent performance analysis and actionable recommendations for system improvements. This guide demonstrates how to integrate and use the optimization services.

## Quick Start

### 1. Basic Setup

```typescript
import { OptimizationServiceFactory } from '../src/services/optimization';

// Create default optimization services
const services = await OptimizationServiceFactory.createDefaultServices();

// Access individual services
const engine = services.engine;
const dashboard = services.dashboard;
const metricsAggregator = services.metricsAggregator;
```

### 2. Environment-Specific Setup

```typescript
// Production environment
const prodServices = await OptimizationServiceFactory.createProductionServices();

// Development environment
const devServices = await OptimizationServiceFactory.createDevelopmentServices();

// Minimal setup (engine only)
const minimalServices = await OptimizationServiceFactory.createMinimalServices();
```

## Recording Performance Metrics

### Search Performance Metrics

```typescript
import { AlgorithmTuner } from '../src/services/optimization';

const algorithmTuner = new AlgorithmTuner();
await algorithmTuner.initialize();

// Record search metrics
algorithmTuner.recordSearchMetrics({
  timestamp: Date.now(),
  query: "user search term",
  responseTime: 150,
  resultsCount: 25,
  relevanceScore: 0.85,
  algorithm: "fuzzy_search",
  parameters: {
    threshold: 0.6,
    distance: 100
  },
  userInteraction: {
    clickThroughRate: 0.3,
    dwellTime: 15000,
    refinements: 1
  }
});
```

### Database Performance Metrics

```typescript
import { IndexOptimizationAdvisor } from '../src/services/optimization';

const indexAdvisor = new IndexOptimizationAdvisor();
await indexAdvisor.initialize();

// Record database query analysis
indexAdvisor.recordQuery({
  query: "SELECT * FROM users WHERE status = 'active'",
  executionTime: 2500,
  timestamp: Date.now(),
  tablesAccessed: ["users"],
  indexesUsed: ["idx_users_status"],
  rowsExamined: 10000,
  rowsReturned: 500,
  sortOperations: 1,
  joinOperations: 0,
  filterConditions: ["status = 'active'"],
  orderByColumns: ["created_at"],
  groupByColumns: []
});
```

### Cache Performance Metrics

```typescript
import { CacheStrategyOptimizer } from '../src/services/optimization';

const cacheOptimizer = new CacheStrategyOptimizer();
await cacheOptimizer.initialize();

// Record cache operations
cacheOptimizer.recordCacheMetrics({
  timestamp: Date.now(),
  cacheKey: "user:123:profile",
  operation: "hit", // or "miss", "set", "delete", "evict"
  responseTime: 5,
  dataSize: 2048,
  ttl: 3600,
  accessPattern: "read",
  frequency: 15
});
```

### System Performance Metrics

```typescript
import { BottleneckDetector } from '../src/services/optimization';

const bottleneckDetector = new BottleneckDetector();
await bottleneckDetector.initialize();

// Record system metrics
bottleneckDetector.recordMetric({
  timestamp: Date.now(),
  component: "cpu",
  metric: "usage_percent",
  value: 85.5,
  unit: "percent",
  context: { cores: 8, loadAverage: 3.2 },
  threshold: { warning: 70, critical: 90 }
});

bottleneckDetector.recordMetric({
  timestamp: Date.now(),
  component: "memory",
  metric: "usage_percent",
  value: 78.2,
  unit: "percent",
  context: { total: 16384, available: 3584 }
});
```

## Getting Optimization Recommendations

### Analyze Performance and Get Recommendations

```typescript
// Perform comprehensive analysis
const recommendations = await engine.performAnalysis();

console.log(`Generated ${recommendations.length} optimization recommendations`);

// Get filtered recommendations
const criticalRecommendations = engine.getRecommendations('pending')
  .filter(rec => rec.impact === 'critical');

const highROIRecommendations = engine.getRecommendations()
  .filter(rec => rec.roi > 70)
  .sort((a, b) => b.roi - a.roi);
```

### Apply Optimization Recommendations

```typescript
// Apply a specific recommendation
const recommendationId = recommendations[0].id;
const success = await engine.applyRecommendation(recommendationId);

if (success) {
  console.log('Optimization applied successfully');

  // Check results after some time
  setTimeout(async () => {
    const updatedRec = engine.getRecommendation(recommendationId);
    if (updatedRec?.results?.success) {
      console.log(`Achieved ${updatedRec.results.actualImprovement}% improvement`);
    }
  }, 30000);
} else {
  console.log('Optimization failed to apply');
}
```

## Dashboard Usage

### Get Dashboard Data

```typescript
// Get complete dashboard configuration
const dashboardConfig = dashboard.getDashboardConfig();

console.log('Dashboard widgets:', dashboardConfig.widgets.length);
console.log('Active alerts:', dashboardConfig.alerts.length);
console.log('Recent insights:', dashboardConfig.insights.length);

// Get dashboard summary
const summary = dashboard.getDashboardSummary();
console.log(`System health: ${summary.systemHealth}%`);
console.log(`Total recommendations: ${summary.totalRecommendations}`);
console.log(`Average ROI: ${summary.averageROI}%`);
```

### Create Custom Dashboard Widgets

```typescript
// Create a custom performance widget
const customWidget = dashboard.createWidget({
  title: 'API Response Times',
  type: 'chart',
  size: 'large',
  priority: 1,
  refreshInterval: 60,
  data: {
    metrics: [], // Your custom data
    chartType: 'line',
    timeRange: '24h'
  },
  configuration: {
    showTrend: true,
    alertThreshold: 1000
  }
});

// Update widget data
dashboard.updateWidget(customWidget.id, {
  metrics: [
    { timestamp: Date.now(), value: 250 },
    { timestamp: Date.now() - 60000, value: 280 },
    // ... more data points
  ]
});
```

### Generate Performance Reports

```typescript
// Generate comprehensive performance report
const report = await dashboard.generatePerformanceReport('7d');

console.log('Report summary:', report.summary);
console.log('Category breakdown:', report.categoryBreakdown);
console.log('Top recommendations:', report.topRecommendations);
console.log('Future projections:', report.futureProjections);

// Get historical reports
const recentReports = dashboard.getReports(5);
```

## Metrics Aggregation

### Configure Metrics Aggregation

```typescript
import { OptimizationMetricsAggregator } from '../src/services/optimization';

const aggregator = new OptimizationMetricsAggregator(engine, {
  aggregationInterval: 10, // 10 minutes
  retentionPeriod: 30, // 30 days
  anomalyThreshold: 2.5,
  enablePredictions: true,
  enableRealTimeAlerts: true
});

await aggregator.initialize();
```

### Get Aggregated Metrics

```typescript
// Get current period aggregated metrics
const currentMetrics = aggregator.getAggregatedMetrics();

if (currentMetrics) {
  console.log('System overview:', currentMetrics.systemOverview);
  console.log('Category breakdown:', currentMetrics.categories);
  console.log('Trends:', currentMetrics.trends);
  console.log('Anomalies detected:', currentMetrics.anomalies.length);
}

// Get trending metrics for specific category
const cacheTrends = aggregator.getTrendingMetrics('cache', 24 * 60 * 60 * 1000);
console.log('Cache performance trend:', cacheTrends.trend);
console.log('Change percentage:', cacheTrends.change);

// Get anomalies
const anomalies = aggregator.getAnomalies();
console.log(`Found ${anomalies.length} anomalies in last 24 hours`);

// Get performance predictions
const predictions = aggregator.getPerformancePredictions();
if (predictions) {
  console.log('Short-term prediction:', predictions.shortTerm);
  console.log('Long-term prediction:', predictions.longTerm);
}
```

### Generate Comprehensive Reports

```typescript
// Generate detailed metrics report
const metricsReport = aggregator.generateMetricsReport('7d');

console.log('Report period:', metricsReport.period);
console.log('Data points:', metricsReport.dataPoints);
console.log('Summary:', metricsReport.summary);
console.log('Categories:', metricsReport.categories);
console.log('Trends:', metricsReport.trends);
console.log('Insights:', metricsReport.insights);
```

## Event Handling

### Listen to Optimization Events

```typescript
// Listen for analysis completion
engine.on('analysis-completed', (data) => {
  console.log('Analysis completed:', data.recommendations.length, 'recommendations');
});

// Listen for critical issues
engine.on('critical-issues-detected', (issues) => {
  console.log('CRITICAL:', issues.length, 'critical issues detected!');
  issues.forEach(issue => {
    console.log(`- ${issue.title}: ${issue.description}`);
  });
});

// Listen for optimization results
engine.on('optimization-results-measured', (recommendation) => {
  if (recommendation.results?.success) {
    console.log(`SUCCESS: ${recommendation.title} achieved ${recommendation.results.actualImprovement}% improvement`);
  }
});

// Listen for bottleneck detection
bottleneckDetector.on('bottleneck-detected', (bottleneck) => {
  console.log(`Bottleneck detected in ${bottleneck.component}: ${bottleneck.description}`);
});

// Listen for dashboard alerts
dashboard.on('alert-created', (alert) => {
  console.log(`Alert [${alert.severity}]: ${alert.title} - ${alert.message}`);
});

// Listen for real-time anomalies
metricsAggregator.on('real-time-anomaly', (anomaly) => {
  console.log(`Anomaly detected: ${anomaly.metric.category}:${anomaly.metric.metric} (z-score: ${anomaly.zScore})`);
});
```

## Integration Examples

### Express.js Middleware

```typescript
import express from 'express';
import { OptimizationServiceFactory } from '../src/services/optimization';

const app = express();
let optimizationServices: any;

// Initialize optimization services
app.listen(3000, async () => {
  optimizationServices = await OptimizationServiceFactory.createProductionServices();
  console.log('Optimization services initialized');
});

// Middleware to record API performance
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;

    // Record API performance metric
    optimizationServices.metricsAggregator.recordMetric({
      timestamp: Date.now(),
      category: 'api',
      metric: 'response_time',
      value: responseTime,
      unit: 'ms',
      trend: 'stable',
      severity: responseTime > 1000 ? 'high' : responseTime > 500 ? 'medium' : 'low'
    });
  });

  next();
});
```

### Database Query Monitoring

```typescript
// Monitor database queries (example with a generic query function)
async function monitoredQuery(sql: string, params: any[] = []) {
  const startTime = Date.now();

  try {
    const result = await database.query(sql, params);
    const executionTime = Date.now() - startTime;

    // Record query performance
    optimizationServices.engine.indexAdvisor.recordQuery({
      query: sql,
      executionTime,
      timestamp: Date.now(),
      tablesAccessed: extractTablesFromSQL(sql),
      indexesUsed: [], // Would need to get from EXPLAIN
      rowsExamined: result.stats?.examined || 0,
      rowsReturned: result.rows?.length || 0,
      sortOperations: sql.includes('ORDER BY') ? 1 : 0,
      joinOperations: (sql.match(/JOIN/gi) || []).length,
      filterConditions: extractFiltersFromSQL(sql),
      orderByColumns: extractOrderByFromSQL(sql),
      groupByColumns: extractGroupByFromSQL(sql)
    });

    return result;
  } catch (error) {
    // Record failed query
    optimizationServices.metricsAggregator.recordMetric({
      timestamp: Date.now(),
      category: 'database',
      metric: 'query_error',
      value: 1,
      unit: 'count',
      trend: 'degrading',
      severity: 'critical'
    });

    throw error;
  }
}
```

### Search Performance Monitoring

```typescript
// Monitor search operations
async function monitoredSearch(query: string, options: any = {}) {
  const startTime = Date.now();

  try {
    const results = await searchEngine.search(query, options);
    const responseTime = Date.now() - startTime;

    // Calculate relevance score (simplified)
    const relevanceScore = results.hits.length > 0 ?
      results.hits.reduce((sum: number, hit: any) => sum + (hit._score || 0), 0) / results.hits.length / 10 : 0;

    // Record search metrics
    optimizationServices.engine.algorithmTuner.recordSearchMetrics({
      timestamp: Date.now(),
      query,
      responseTime,
      resultsCount: results.hits.length,
      relevanceScore: Math.min(1, relevanceScore),
      algorithm: options.algorithm || 'elasticsearch',
      parameters: options.parameters || {},
      userInteraction: {
        clickThroughRate: 0, // Would be updated later based on user actions
        dwellTime: 0,
        refinements: 0
      }
    });

    return results;
  } catch (error) {
    // Record search error
    optimizationServices.metricsAggregator.recordMetric({
      timestamp: Date.now(),
      category: 'search',
      metric: 'search_error',
      value: 1,
      unit: 'count',
      trend: 'degrading',
      severity: 'high'
    });

    throw error;
  }
}
```

## Best Practices

### 1. Metric Collection
- Record metrics consistently across all operations
- Include relevant context data in metrics
- Use appropriate severity levels
- Batch metric recording when possible

### 2. Recommendation Management
- Review recommendations regularly
- Test recommendations in staging before production
- Monitor results after applying optimizations
- Keep track of ROI and improvements

### 3. Dashboard Configuration
- Create widgets relevant to your use case
- Set appropriate refresh intervals
- Monitor critical alerts
- Use insights to guide optimization priorities

### 4. Performance Monitoring
- Set up real-time alerts for critical issues
- Monitor trends over time
- Use predictive insights for proactive optimization
- Regular review of aggregated metrics

### 5. Integration
- Initialize services early in application lifecycle
- Handle events appropriately
- Clean up resources on shutdown
- Use environment-specific configurations

## Cleanup

```typescript
// Clean up optimization services when shutting down
process.on('SIGTERM', async () => {
  console.log('Shutting down optimization services...');
  await optimizationServices.engine.destroy();
  await optimizationServices.dashboard.destroy();
  await optimizationServices.metricsAggregator.destroy();
  process.exit(0);
});

// Or use the factory cleanup
process.on('SIGTERM', async () => {
  await OptimizationServiceFactory.getInstance().destroyServices();
  process.exit(0);
});
```

This optimization engine provides comprehensive performance analysis and actionable recommendations with measurable ROI. The modular design allows you to use individual components or the complete system based on your needs.