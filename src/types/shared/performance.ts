/**
 * Consolidated Performance Types
 *
 * This file consolidates all performance-related interfaces and types
 * from across the codebase to eliminate duplicates and conflicts.
 */

// Base Performance Metric Interface
export interface BasePerformanceMetric {
  id?: string;
  timestamp: number;
  value: number;
  source: string;
  environment?: 'development' | 'staging' | 'production';
  tags?: Record<string, string>;
}

// Extended Performance Metrics for different contexts
export interface PerformanceMetrics extends BasePerformanceMetric {
  startTime?: number;
  endTime?: number;
  duration?: number;
  memory?: {
    used: number;
    total: number;
  };
}

// HTTP Performance Metrics
export interface HTTPPerformanceMetrics extends BasePerformanceMetric {
  requestId: string;
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  cacheHit: boolean;
  cacheLatency?: number;
  memoryUsage: number;
  cpuUsage: number;
  userAgent?: string;
  userId?: string;
  sessionId?: string;
  contentLength?: number;
  errorMessage?: string;
}

// Search Performance Metrics
export interface SearchPerformanceMetrics extends BasePerformanceMetric {
  queryType: string;
  resultCount: number;
  indexSize: number;
  cacheHitRate: number;
  avgResponseTime: number;
  throughput: number;
}

// Component Performance Metrics
export interface ComponentPerformanceData extends BasePerformanceMetric {
  componentName: string;
  renderTime: number;
  mountTime?: number;
  updateTime?: number;
  memoryUsage?: number;
  rerenderCount: number;
}

// Performance Alert Interface
export interface PerformanceAlert {
  id: string;
  type:
    | 'high_latency'
    | 'high_error_rate'
    | 'cache_miss_spike'
    | 'memory_pressure'
    | 'cpu_spike'
    | 'budget_exceeded';
  metricId?: string;
  threshold: number;
  currentValue: number;
  condition?: 'above' | 'below' | 'equals';
  severity: 'info' | 'low' | 'warning' | 'medium' | 'error' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'muted';
  message: string;
  description?: string;
  createdAt: number;
  resolvedAt?: number;
  assignee?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

// Performance Configuration
export interface PerformanceConfig {
  enableDetailedLogging: boolean;
  enableRealTimeAlerts: boolean;
  enableMonitoring?: boolean;
  alertThresholds: {
    highLatency: number;
    highErrorRate: number;
    cacheMissRate: number;
    memoryUsage: number;
    cpuUsage: number;
    responseTime?: number;
    errorRate?: number;
  };
  samplingRate: number;
  retentionPeriodMs: number;
  batchSize: number;
  collectionInterval?: number;
  aggregationLevels?: ('minute' | 'hour' | 'day')[];
}

// Performance Budget
export interface PerformanceBudget {
  id: string;
  name: string;
  metrics: {
    metricName: string;
    threshold: number;
    unit: string;
  }[];
  environment: string;
  team: string;
  status: 'passing' | 'failing' | 'warning';
  lastCheck: number;
}

// Performance Statistics
export interface PerformanceStats {
  totalRequests: number;
  avgResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
  throughput: number;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections?: number;
  timeRange: string;
  lastUpdated: number;
}

// Performance Summary
export interface PerformanceSummary {
  overall: {
    status: 'healthy' | 'degraded' | 'critical';
    score: number; // 0-100
    uptime: number;
  };
  performance: {
    hitRate: number;
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
  };
  trends: {
    hitRateTrend: 'improving' | 'stable' | 'declining';
    responseTrend: 'improving' | 'stable' | 'declining';
    throughputTrend: 'increasing' | 'stable' | 'decreasing';
  };
  topIssues: string[];
  recommendations: string[];
}

// Performance Data Collection
export interface PerformanceData {
  metrics: PerformanceMetrics[];
  alerts: PerformanceAlert[];
  budgets: PerformanceBudget[];
  notifications?: TeamNotification[];
}

// Supporting Types
export interface TrendData {
  timestamp: number;
  value: number;
  baseline?: number;
  percentile95?: number;
  percentile99?: number;
}

export interface RegressionData {
  id: string;
  timestamp: number;
  metric: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  significance: 'low' | 'medium' | 'high';
  confidence: number;
  cause?: string;
  status: 'investigating' | 'resolved' | 'false-positive';
}

export interface TeamNotification {
  id: string;
  type: 'alert' | 'regression' | 'budget' | 'deployment';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  timestamp: number;
  read: boolean;
  actionRequired: boolean;
  recipients: string[];
  metadata?: Record<string, any>;
}

// Dashboard and Chart Configuration
export interface DashboardConfig {
  refreshInterval: number;
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d';
  metrics: string[];
  layout: 'grid' | 'list' | 'compact';
  theme: 'light' | 'dark' | 'auto';
  enableRealtime: boolean;
  alertsEnabled: boolean;
}

export interface ChartConfig {
  type: 'line' | 'area' | 'bar' | 'scatter' | 'heatmap';
  timeRange: string;
  aggregation: 'avg' | 'sum' | 'min' | 'max' | 'p95' | 'p99';
  showBaseline: boolean;
  showPercentiles: boolean;
  smoothing: boolean;
}

// Validation Results
export interface PerformanceValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    memoryUsage: number;
    cpuUsage: number;
    responseTime: number;
  };
  recommendations: string[];
}

// Window Performance
export interface WindowPerformanceSummary {
  windowId: string;
  operations: {
    create: number;
    move: number;
    resize: number;
    close: number;
  };
  avgResponseTime: number;
  memoryUsage: number;
  errorCount: number;
  lastUpdated: number;
}

// Performance Report
export interface PerformanceReport {
  id: string;
  timestamp: number;
  timeRange: {
    start: number;
    end: number;
  };
  summary: PerformanceSummary;
  details: {
    metrics: PerformanceMetrics[];
    alerts: PerformanceAlert[];
    regressions: RegressionData[];
  };
  recommendations: string[];
  exportFormat?: 'json' | 'csv' | 'pdf';
}

// Type Guards
export function isHTTPPerformanceMetrics(metric: any): metric is HTTPPerformanceMetrics {
  return metric && typeof metric.requestId === 'string' && typeof metric.method === 'string';
}

export function isSearchPerformanceMetrics(metric: any): metric is SearchPerformanceMetrics {
  return metric && typeof metric.queryType === 'string' && typeof metric.resultCount === 'number';
}

export function isComponentPerformanceData(metric: any): metric is ComponentPerformanceData {
  return (
    metric && typeof metric.componentName === 'string' && typeof metric.renderTime === 'number'
  );
}
