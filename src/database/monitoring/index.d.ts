import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
export {
  PerformanceMonitor,
  PerformanceMetric,
  PerformanceThresholds,
  AlertRule,
  PerformanceAlert,
  MonitoringConfig,
} from './PerformanceMonitor';
export {
  MetricsCollector,
  TimeSeriesDataPoint,
  AggregationResult,
  MetricDefinition,
  AlertThreshold,
  CollectorConfig,
} from './MetricsCollector';
export {
  HealthCheck,
  HealthCheckResult,
  HealthStatus,
  HealthCheckConfig,
  IntegrityIssue,
} from './HealthCheck';
export {
  QueryAnalyzer,
  QueryAnalysis,
  OptimizationSuggestion,
  IndexRecommendation,
  SlowQuery,
  AnalyzerConfig,
} from './QueryAnalyzer';
export {
  DashboardProvider,
  DashboardMetrics,
  TimeSeriesData,
  AlertSummary,
  CapacityPlanningData,
  DashboardConfig,
} from './DashboardProvider';
import { PerformanceMonitor, MonitoringConfig } from './PerformanceMonitor';
import { MetricsCollector, CollectorConfig } from './MetricsCollector';
import { HealthCheck, HealthCheckConfig } from './HealthCheck';
import { QueryAnalyzer, AnalyzerConfig } from './QueryAnalyzer';
import { DashboardProvider, DashboardConfig } from './DashboardProvider';
export interface MonitoringSystemConfig {
  performance?: Partial<MonitoringConfig>;
  metrics?: Partial<CollectorConfig>;
  health?: Partial<HealthCheckConfig>;
  analyzer?: Partial<AnalyzerConfig>;
  dashboard?: Partial<DashboardConfig>;
  enableAllFeatures?: boolean;
  enablePrometheusExport?: boolean;
  enableGrafanaIntegration?: boolean;
}
export interface MonitoringSystemStats {
  uptime: number;
  totalQueries: number;
  slowQueries: number;
  totalAlerts: number;
  activeAlerts: number;
  healthScore: number;
  performanceScore: number;
  systemStatus: 'healthy' | 'warning' | 'critical' | 'unknown';
}
export declare class MonitoringSystem extends EventEmitter {
  private db;
  private config;
  private performanceMonitor;
  private metricsCollector;
  private healthCheck;
  private queryAnalyzer;
  private dashboardProvider;
  private isInitialized;
  private startTime;
  constructor(db: Database.Database, config?: MonitoringSystemConfig);
  private initializeComponents;
  private setupEventHandlers;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  measureQuery<T>(
    operation: string,
    query: string,
    connectionId: string,
    executor: () => Promise<T> | T,
    options?: {
      userId?: string;
      captureQueryPlan?: boolean;
      enableAnalysis?: boolean;
    }
  ): Promise<T>;
  recordMetric(
    operation: string,
    duration: number,
    options?: {
      recordsProcessed?: number;
      cacheHit?: boolean;
      indexesUsed?: string[];
      connectionId?: string;
      userId?: string;
    }
  ): void;
  getStats(): MonitoringSystemStats;
  private getOverallSystemStatus;
  getDashboardData(): {
    metrics: import('./DashboardProvider').DashboardMetrics | null;
    alerts: import('./DashboardProvider').AlertSummary;
    capacity: import('./DashboardProvider').CapacityPlanningData;
    health: import('./HealthCheck').HealthStatus | null;
    performance: any;
    queries: {
      slow: import('./QueryAnalyzer').SlowQuery[];
      patterns: {
        pattern: string;
        occurrences: number;
        avgDuration: number;
        tableNames: string[];
        lastSeen: number;
      }[];
      recommendations: import('./QueryAnalyzer').IndexRecommendation[];
    };
  };
  exportPrometheusMetrics(): string;
  getGrafanaConfig(): any;
  handleGrafanaQuery(query: any): any;
  runHealthCheck(): Promise<import('./HealthCheck').HealthStatus>;
  generatePerformanceReport(startTime?: number, endTime?: number): any;
  getOptimizationRecommendations(): {
    indexes: import('./QueryAnalyzer').IndexRecommendation[];
    slowQueries: import('./QueryAnalyzer').SlowQuery[];
    patterns: {
      pattern: string;
      occurrences: number;
      avgDuration: number;
      tableNames: string[];
      lastSeen: number;
    }[];
  };
  implementIndexRecommendation(
    recommendationId: string,
    execute?: boolean
  ): Promise<{
    success: boolean;
    error?: string;
    sql?: string;
  }>;
  get performance(): PerformanceMonitor;
  get metrics(): MetricsCollector;
  get health(): HealthCheck;
  get analyzer(): QueryAnalyzer;
  get dashboard(): DashboardProvider;
}
export declare function createMonitoringSystem(
  db: Database.Database,
  config?: MonitoringSystemConfig
): MonitoringSystem;
export default MonitoringSystem;
//# sourceMappingURL=index.d.ts.map
