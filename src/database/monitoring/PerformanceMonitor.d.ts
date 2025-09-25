import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
export interface PerformanceMetric {
  id?: string;
  timestamp: number;
  operation: string;
  query?: string;
  duration: number;
  recordsAffected: number;
  memoryUsage: number;
  cpuTime: number;
  ioWaitTime: number;
  cacheHit: boolean;
  indexesUsed: string[];
  queryPlan?: string;
  connectionId: string;
  userId?: string;
  errorCode?: string;
  warningCount: number;
}
export interface PerformanceThresholds {
  slowQueryMs: number;
  criticalQueryMs: number;
  memoryLimitMB: number;
  cpuLimitPercent: number;
  ioWaitLimitMs: number;
  cacheHitRateMin: number;
  connectionTimeoutMs: number;
  maxConcurrentQueries: number;
}
export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  actions: string[];
}
export interface PerformanceAlert {
  id: string;
  timestamp: number;
  ruleId: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  duration: number;
  resolved: boolean;
  resolvedAt?: number;
  metadata: Record<string, any>;
}
export interface MonitoringConfig {
  enabled: boolean;
  samplingRate: number;
  metricsRetentionDays: number;
  alertRetentionDays: number;
  slowQueryCapture: boolean;
  queryPlanCapture: boolean;
  realtimeAlerts: boolean;
  aggregationInterval: number;
  batchSize: number;
  thresholds: PerformanceThresholds;
  alertRules: AlertRule[];
}
export declare class PerformanceMonitor extends EventEmitter {
  private db;
  private config;
  private metricsBuffer;
  private alertsBuffer;
  private activeConnections;
  private runningQueries;
  private aggregationTimer?;
  private cleanupTimer?;
  private isMonitoring;
  private baseline;
  constructor(db: Database.Database, config?: Partial<MonitoringConfig>);
  private buildConfig;
  private initializeMonitoring;
  private createMonitoringTables;
  startMonitoring(): void;
  stopMonitoring(): void;
  recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): void;
  measureQuery<T>(
    operation: string,
    query: string,
    connectionId: string,
    executor: () => Promise<T>,
    options?: {
      userId?: string;
      captureQueryPlan?: boolean;
    }
  ): Promise<T>;
  getRealtimeMetrics(): {
    currentConnections: number;
    activeQueries: number;
    avgResponseTime: number;
    memoryUsage: number;
    cacheHitRate: number;
    queriesPerSecond: number;
    alertsCount: {
      info: number;
      warning: number;
      critical: number;
    };
  };
  getSlowQueries(
    limit?: number,
    hoursBack?: number
  ): Array<{
    query: string;
    operation: string;
    avgDuration: number;
    count: number;
    lastSeen: number;
    queryPlan?: string;
  }>;
  getPerformanceTrends(hoursBack?: number): {
    responseTime: Array<{
      timestamp: number;
      value: number;
    }>;
    throughput: Array<{
      timestamp: number;
      value: number;
    }>;
    memoryUsage: Array<{
      timestamp: number;
      value: number;
    }>;
    cacheHitRate: Array<{
      timestamp: number;
      value: number;
    }>;
    errorRate: Array<{
      timestamp: number;
      value: number;
    }>;
  };
  private processMetricsBuffer;
  private updateHourlySummaries;
  private checkAlertRules;
  private evaluateAlertRule;
  private checkThreshold;
  private createAlert;
  private persistAlert;
  private checkMetricAlerts;
  private loadBaseline;
  private updateBaseline;
  private cleanupOldData;
  private captureQueryPlan;
  private extractIndexesFromPlan;
  private hashQuery;
  private generateId;
  exportPrometheusMetrics(): string;
  destroy(): void;
}
//# sourceMappingURL=PerformanceMonitor.d.ts.map
