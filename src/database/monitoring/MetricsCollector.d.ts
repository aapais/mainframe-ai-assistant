import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
export interface TimeSeriesDataPoint {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}
export interface AggregationResult {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  stddev: number;
}
export interface MetricDefinition {
  name: string;
  description: string;
  unit: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels: string[];
  retention: number;
  aggregationInterval: number;
}
export interface AlertThreshold {
  metricName: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  duration: number;
  severity: 'info' | 'warning' | 'critical';
  description: string;
}
export interface CollectorConfig {
  enabled: boolean;
  collectionInterval: number;
  aggregationInterval: number;
  retentionDays: number;
  maxDataPoints: number;
  enableCompression: boolean;
  exportFormats: ('prometheus' | 'json' | 'csv')[];
  alertThresholds: AlertThreshold[];
}
export declare class MetricsCollector extends EventEmitter {
  private db;
  private config;
  private metrics;
  private dataBuffer;
  private aggregationTimer?;
  private collectionTimer?;
  private isCollecting;
  private readonly BUILTIN_METRICS;
  constructor(db: Database.Database, config?: Partial<CollectorConfig>);
  private buildConfig;
  private initializeCollector;
  private createMetricsTables;
  private registerBuiltinMetrics;
  startCollection(): void;
  stopCollection(): void;
  recordMetric(
    metricName: string,
    value: number,
    labels?: Record<string, string>,
    timestamp?: number
  ): void;
  registerMetric(metric: MetricDefinition): void;
  getMetricData(
    metricName: string,
    startTime: number,
    endTime: number,
    labels?: Record<string, string>
  ): TimeSeriesDataPoint[];
  getAggregatedData(
    metricName: string,
    startTime: number,
    endTime: number,
    labels?: Record<string, string>
  ): Array<
    AggregationResult & {
      timestamp: number;
    }
  >;
  calculatePercentiles(values: number[]): {
    p50: number;
    p95: number;
    p99: number;
  };
  exportPrometheusFormat(): string;
  exportJSONFormat(): any;
  exportCSVFormat(metricName: string, startTime: number, endTime: number): string;
  private collectSystemMetrics;
  private processDataBuffer;
  private aggregateMetrics;
  private aggregateMetricForPeriod;
  private calculateAggregation;
  private checkAlertThresholds;
  private evaluateThreshold;
  private evaluateCondition;
  private recordAlert;
  private cleanupOldData;
  getCollectionStats(): {
    totalMetrics: number;
    activeMetrics: number;
    dataPointsToday: number;
    lastCollection: number;
    bufferSize: number;
    alertsToday: number;
  };
  destroy(): void;
}
//# sourceMappingURL=MetricsCollector.d.ts.map
