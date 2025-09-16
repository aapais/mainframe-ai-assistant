/**
 * SQLite Performance Monitoring System
 * 
 * Comprehensive database monitoring solution with real-time performance tracking,
 * health checks, query analysis, and dashboard integration.
 * 
 * Usage:
 * ```typescript
 * import { MonitoringSystem } from './database/monitoring';
 * 
 * const monitoring = new MonitoringSystem(database, {
 *   enableRealTimeAlerts: true,
 *   performanceThresholds: {
 *     slowQueryMs: 1000,
 *     criticalQueryMs: 5000
 *   }
 * });
 * 
 * await monitoring.initialize();
 * 
 * // Monitor a query
 * const result = await monitoring.measureQuery(
 *   'search_kb',
 *   'SELECT * FROM kb_entries WHERE title LIKE ?',
 *   'conn_123',
 *   () => db.prepare(query).all('%search%')
 * );
 * ```
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';

// Export all monitoring components
export { PerformanceMonitor, PerformanceMetric, PerformanceThresholds, AlertRule, PerformanceAlert, MonitoringConfig } from './PerformanceMonitor';
export { MetricsCollector, TimeSeriesDataPoint, AggregationResult, MetricDefinition, AlertThreshold, CollectorConfig } from './MetricsCollector';
export { HealthCheck, HealthCheckResult, HealthStatus, HealthCheckConfig, IntegrityIssue } from './HealthCheck';
export { QueryAnalyzer, QueryAnalysis, OptimizationSuggestion, IndexRecommendation, SlowQuery, AnalyzerConfig } from './QueryAnalyzer';
export { DashboardProvider, DashboardMetrics, TimeSeriesData, AlertSummary, CapacityPlanningData, DashboardConfig } from './DashboardProvider';

// Import components
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

/**
 * Unified Monitoring System
 * 
 * Provides a single interface to all monitoring components with
 * automatic integration and cross-component communication.
 */
export class MonitoringSystem extends EventEmitter {
  private db: Database.Database;
  private config: MonitoringSystemConfig;
  
  private performanceMonitor: PerformanceMonitor;
  private metricsCollector: MetricsCollector;
  private healthCheck: HealthCheck;
  private queryAnalyzer: QueryAnalyzer;
  private dashboardProvider: DashboardProvider;
  
  private isInitialized = false;
  private startTime = Date.now();

  constructor(db: Database.Database, config?: MonitoringSystemConfig) {
    super();
    this.db = db;
    this.config = {
      enableAllFeatures: true,
      enablePrometheusExport: true,
      enableGrafanaIntegration: false,
      ...config
    };

    this.initializeComponents();
    this.setupEventHandlers();
  }

  private initializeComponents(): void {
    // Initialize Performance Monitor
    this.performanceMonitor = new PerformanceMonitor(this.db, this.config.performance);

    // Initialize Metrics Collector
    this.metricsCollector = new MetricsCollector(this.db, this.config.metrics);

    // Initialize Health Check
    this.healthCheck = new HealthCheck(this.db, this.config.health);

    // Initialize Query Analyzer
    this.queryAnalyzer = new QueryAnalyzer(this.db, this.config.analyzer);

    // Initialize Dashboard Provider
    this.dashboardProvider = new DashboardProvider(
      this.db,
      this.performanceMonitor,
      this.metricsCollector,
      this.healthCheck,
      this.queryAnalyzer,
      this.config.dashboard
    );
  }

  private setupEventHandlers(): void {
    // Cross-component event handling
    
    // Forward performance metrics to metrics collector
    this.performanceMonitor.on('metric', (metric) => {
      this.metricsCollector.recordMetric(
        'sqlite_query_duration_ms',
        metric.duration,
        {
          operation: metric.operation,
          connection: metric.connectionId
        }
      );
      
      this.metricsCollector.recordMetric(
        'sqlite_memory_usage_bytes',
        metric.memoryUsage,
        { connection: metric.connectionId }
      );

      if (metric.cacheHit) {
        this.metricsCollector.recordMetric('sqlite_cache_hit_ratio', 1);
      } else {
        this.metricsCollector.recordMetric('sqlite_cache_hit_ratio', 0);
      }
    });

    // Forward performance alerts to dashboard
    this.performanceMonitor.on('alert', (alert) => {
      this.emit('performance-alert', alert);
    });

    // Forward health check results
    this.healthCheck.on('health-check-completed', (status) => {
      this.emit('health-status-updated', status);
    });

    // Forward query analysis results
    this.queryAnalyzer.on('query-analyzed', (analysis) => {
      this.emit('query-analyzed', analysis);
    });

    this.queryAnalyzer.on('index-recommendation', (recommendation) => {
      this.emit('index-recommendation', recommendation);
    });

    // Forward dashboard events
    this.dashboardProvider.on('alert-triggered', (alert) => {
      this.emit('dashboard-alert', alert);
    });

    // Forward metrics collector alerts
    this.metricsCollector.on('alert-triggered', (alert) => {
      this.emit('metrics-alert', alert);
    });
  }

  /**
   * Initialize the monitoring system
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Monitoring system already initialized');
    }

    try {
      // Start all monitoring components
      this.performanceMonitor.startMonitoring();
      this.metricsCollector.startCollection();
      this.healthCheck.startHealthChecks();
      this.dashboardProvider.startDataCollection();

      this.isInitialized = true;
      this.emit('monitoring-system-initialized');

      console.log('🎯 SQLite monitoring system initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize monitoring system:', error);
      throw error;
    }
  }

  /**
   * Shutdown the monitoring system
   */
  public async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      // Stop all monitoring components
      this.performanceMonitor.stopMonitoring();
      this.metricsCollector.stopCollection();
      this.healthCheck.stopHealthChecks();
      this.dashboardProvider.stopDataCollection();

      // Cleanup
      this.performanceMonitor.destroy();
      this.metricsCollector.destroy();
      this.healthCheck.destroy();
      this.queryAnalyzer.destroy();
      this.dashboardProvider.destroy();

      this.isInitialized = false;
      this.removeAllListeners();
      
      this.emit('monitoring-system-shutdown');
      console.log('🔌 SQLite monitoring system shut down');
      
    } catch (error) {
      console.error('Error during monitoring system shutdown:', error);
      throw error;
    }
  }

  /**
   * Measure and record performance of a query operation
   */
  public async measureQuery<T>(
    operation: string,
    query: string,
    connectionId: string,
    executor: () => Promise<T> | T,
    options?: {
      userId?: string;
      captureQueryPlan?: boolean;
      enableAnalysis?: boolean;
    }
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      // Use performance monitor to measure the operation
      const result = await this.performanceMonitor.measureQuery(
        operation,
        query,
        connectionId,
        executor,
        {
          userId: options?.userId,
          captureQueryPlan: options?.captureQueryPlan
        }
      );

      const duration = Date.now() - startTime;

      // Analyze query if enabled and meets criteria
      if (options?.enableAnalysis !== false && duration > 100) {
        try {
          this.queryAnalyzer.analyzeQuery(query, duration, {
            timestamp: startTime,
            operationType: operation
          });
        } catch (analysisError) {
          console.warn('Query analysis failed:', analysisError);
        }
      }

      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record error metric
      this.metricsCollector.recordMetric(
        'sqlite_error_count',
        1,
        {
          operation,
          error_type: error.name
        }
      );

      throw error;
    }
  }

  /**
   * Record a custom performance metric
   */
  public recordMetric(
    operation: string,
    duration: number,
    options?: {
      recordsProcessed?: number;
      cacheHit?: boolean;
      indexesUsed?: string[];
      connectionId?: string;
      userId?: string;
    }
  ): void {
    this.performanceMonitor.recordMetric(operation, duration, {
      recordsProcessed: options?.recordsProcessed,
      cacheHit: options?.cacheHit,
      indexesUsed: options?.indexesUsed
    });

    // Also record in metrics collector
    this.metricsCollector.recordMetric(
      'sqlite_query_duration_ms',
      duration,
      {
        operation,
        connection: options?.connectionId || 'unknown'
      }
    );
  }

  /**
   * Get comprehensive system statistics
   */
  public getStats(): MonitoringSystemStats {
    const performanceStats = this.performanceMonitor.getRealTimeStatus();
    const healthStatus = this.healthCheck.getHealthStatus();
    const queryStats = this.queryAnalyzer.getAnalyzerStats();
    const dashboardMetrics = this.dashboardProvider.getCurrentMetrics();

    return {
      uptime: Date.now() - this.startTime,
      totalQueries: queryStats.totalQueries,
      slowQueries: queryStats.slowQueries,
      totalAlerts: 0, // Would aggregate from all sources
      activeAlerts: performanceStats.activeAlerts.info + 
                   performanceStats.activeAlerts.warning + 
                   performanceStats.activeAlerts.critical,
      healthScore: healthStatus?.score || 0,
      performanceScore: performanceStats.isHealthy ? 100 : 
                       (performanceStats.activeAlerts.critical > 0 ? 20 : 60),
      systemStatus: this.getOverallSystemStatus()
    };
  }

  private getOverallSystemStatus(): 'healthy' | 'warning' | 'critical' | 'unknown' {
    const performanceStatus = this.performanceMonitor.getRealTimeStatus();
    const healthStatus = this.healthCheck.getHealthStatus();

    if (!healthStatus || !performanceStatus.isHealthy) {
      return 'unknown';
    }

    if (performanceStatus.activeAlerts.critical > 0 || healthStatus.overall === 'critical') {
      return 'critical';
    }

    if (performanceStatus.activeAlerts.warning > 0 || healthStatus.overall === 'warning') {
      return 'warning';
    }

    return 'healthy';
  }

  /**
   * Get dashboard data for external monitoring systems
   */
  public getDashboardData() {
    return {
      metrics: this.dashboardProvider.getCurrentMetrics(),
      alerts: this.dashboardProvider.getAlertSummary(),
      capacity: this.dashboardProvider.getCapacityPlanningData(),
      health: this.healthCheck.getHealthStatus(),
      performance: this.performanceMonitor.getRealTimeStatus(),
      queries: {
        slow: this.queryAnalyzer.getSlowQueries(10),
        patterns: this.queryAnalyzer.getQueryPatterns(20),
        recommendations: this.queryAnalyzer.getIndexRecommendations()
      }
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  public exportPrometheusMetrics(): string {
    const performanceMetrics = this.performanceMonitor.exportPrometheusMetrics();
    const collectorMetrics = this.metricsCollector.exportPrometheusFormat();
    const dashboardMetrics = this.dashboardProvider.getPrometheusMetrics();

    return [
      '# SQLite Performance Monitoring System',
      '# Generated by MonitoringSystem',
      '',
      performanceMetrics,
      '',
      collectorMetrics,
      '',
      dashboardMetrics
    ].join('\n');
  }

  /**
   * Get Grafana data source configuration
   */
  public getGrafanaConfig() {
    return this.dashboardProvider.getGrafanaDataSource();
  }

  /**
   * Handle Grafana queries
   */
  public handleGrafanaQuery(query: any) {
    return this.dashboardProvider.handleGrafanaQuery(query);
  }

  /**
   * Run a comprehensive health check
   */
  public async runHealthCheck(): Promise<import('./HealthCheck').HealthStatus> {
    return this.healthCheck.runHealthChecks();
  }

  /**
   * Get performance report
   */
  public generatePerformanceReport(startTime?: number, endTime?: number) {
    return this.performanceMonitor.generateReport(startTime, endTime);
  }

  /**
   * Get query optimization recommendations
   */
  public getOptimizationRecommendations() {
    return {
      indexes: this.queryAnalyzer.getIndexRecommendations(),
      slowQueries: this.queryAnalyzer.getSlowQueries(),
      patterns: this.queryAnalyzer.getQueryPatterns()
    };
  }

  /**
   * Implement a recommended index
   */
  public async implementIndexRecommendation(recommendationId: string, execute = false) {
    return this.queryAnalyzer.implementIndexRecommendation(recommendationId, execute);
  }

  // Getters for individual components (for advanced usage)
  public get performance(): PerformanceMonitor {
    return this.performanceMonitor;
  }

  public get metrics(): MetricsCollector {
    return this.metricsCollector;
  }

  public get health(): HealthCheck {
    return this.healthCheck;
  }

  public get analyzer(): QueryAnalyzer {
    return this.queryAnalyzer;
  }

  public get dashboard(): DashboardProvider {
    return this.dashboardProvider;
  }
}

// Convenience factory function
export function createMonitoringSystem(
  db: Database.Database,
  config?: MonitoringSystemConfig
): MonitoringSystem {
  return new MonitoringSystem(db, config);
}

// Default export
export default MonitoringSystem;