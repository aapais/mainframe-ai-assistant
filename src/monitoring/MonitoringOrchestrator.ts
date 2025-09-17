/**
 * Monitoring Orchestrator
 * Coordinates all monitoring components and provides unified interface
 */

import { SearchPerformanceMonitor } from './SearchPerformanceMonitor';
import { MonitoringDashboard } from './MonitoringDashboard';
import { AlertingEngine } from './AlertingEngine';
import { SearchLogger } from './SearchLogger';
import { PerformanceProfiler } from './PerformanceProfiler';
import { EventEmitter } from 'events';

export interface MonitoringConfig {
  database: {
    path: string;
  };
  sla: {
    responseTimeThreshold: number; // milliseconds
    errorRateThreshold: number; // percentage
    cacheHitRateThreshold: number; // percentage
  };
  alerting: {
    enabled: boolean;
    channels: string[];
    escalationDelay: number; // minutes
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    destinations: string[];
    enableTrace: boolean;
  };
  profiling: {
    enabled: boolean;
    autoProfile: boolean;
    sessionDuration: number; // minutes
  };
  dashboard: {
    refreshInterval: number; // seconds
    autoStart: boolean;
  };
}

export class MonitoringOrchestrator extends EventEmitter {
  private performanceMonitor: SearchPerformanceMonitor;
  private dashboard: MonitoringDashboard;
  private alertingEngine: AlertingEngine;
  private logger: SearchLogger;
  private profiler: PerformanceProfiler;
  private config: MonitoringConfig;
  private isStarted = false;
  private dashboardInterval?: ReturnType<typeof setTimeout>;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    this.initializeComponents();
    this.setupEventHandlers();
  }

  private initializeComponents(): void {
    // Initialize all monitoring components
    this.performanceMonitor = new SearchPerformanceMonitor(this.config.database.path);
    this.dashboard = new MonitoringDashboard();
    this.alertingEngine = new AlertingEngine();
    this.logger = new SearchLogger();
    this.profiler = new PerformanceProfiler(this.config.database.path);

    // Configure SLA thresholds
    this.setupSLAMonitoring();
    
    // Configure alerting rules
    this.setupAlertingRules();
    
    // Configure logging
    this.setupLogging();
  }

  private setupEventHandlers(): void {
    // Performance monitor events
    this.performanceMonitor.on('sla_violation', (violation) => {
      this.logger.logSLAViolation(violation.metric, violation.value, violation.threshold);
      this.emit('sla_violation', violation);
    });

    this.performanceMonitor.on('performance_degradation', (degradation) => {
      this.logger.logPerformanceDegradation(degradation);
      this.emit('performance_degradation', degradation);
    });

    // Alerting engine events
    this.alertingEngine.on('alert_triggered', (alert) => {
      this.logger.logAlert(alert);
      this.emit('alert_triggered', alert);
    });

    // Profiler events
    this.profiler.on('bottleneck_detected', (bottleneck) => {
      this.logger.logBottleneck(bottleneck);
      this.emit('bottleneck_detected', bottleneck);
    });

    this.profiler.on('session_complete', (session) => {
      this.logger.logProfilingSession(session);
      this.emit('profiling_session_complete', session);
    });
  }

  private setupSLAMonitoring(): void {
    const rules = [
      {
        id: 'response_time_sla',
        metric: 'response_time_p95',
        operator: '>' as const,
        threshold: this.config.sla.responseTimeThreshold,
        severity: 'critical' as const,
        channels: this.config.alerting.channels,
        description: 'Search response time SLA violation'
      },
      {
        id: 'error_rate_sla',
        metric: 'error_rate',
        operator: '>' as const,
        threshold: this.config.sla.errorRateThreshold,
        severity: 'warning' as const,
        channels: this.config.alerting.channels,
        description: 'Search error rate threshold exceeded'
      },
      {
        id: 'cache_hit_rate',
        metric: 'cache_hit_rate',
        operator: '<' as const,
        threshold: this.config.sla.cacheHitRateThreshold,
        severity: 'warning' as const,
        channels: this.config.alerting.channels,
        description: 'Cache hit rate below threshold'
      }
    ];

    rules.forEach(rule => this.alertingEngine.addRule(rule));
  }

  private setupAlertingRules(): void {
    // Additional alerting rules
    const additionalRules = [
      {
        id: 'high_query_volume',
        metric: 'queries_per_second',
        operator: '>' as const,
        threshold: 100,
        severity: 'info' as const,
        channels: ['console'],
        description: 'High query volume detected'
      },
      {
        id: 'memory_usage_high',
        metric: 'memory_usage_mb',
        operator: '>' as const,
        threshold: 500,
        severity: 'warning' as const,
        channels: this.config.alerting.channels,
        description: 'High memory usage detected'
      },
      {
        id: 'index_corruption',
        metric: 'index_integrity_score',
        operator: '<' as const,
        threshold: 95,
        severity: 'critical' as const,
        channels: this.config.alerting.channels,
        description: 'Potential index corruption detected'
      }
    ];

    additionalRules.forEach(rule => this.alertingEngine.addRule(rule));
  }

  private setupLogging(): void {
    this.logger.setLevel(this.config.logging.level);
    this.logger.enableTrace(this.config.logging.enableTrace);
    
    // Add log destinations
    this.config.logging.destinations.forEach(dest => {
      this.logger.addDestination(dest);
    });
  }

  /**
   * Start the monitoring orchestrator
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.info('Monitoring orchestrator already started');
      return;
    }

    this.logger.info('Starting monitoring orchestrator');

    try {
      // Initialize database schemas
      await this.performanceMonitor.initialize();
      await this.profiler.initialize();

      // Start dashboard if configured
      if (this.config.dashboard.autoStart) {
        this.startDashboard();
      }

      // Start auto-profiling if enabled
      if (this.config.profiling.enabled && this.config.profiling.autoProfile) {
        this.startAutoProfiling();
      }

      this.isStarted = true;
      this.logger.info('Monitoring orchestrator started successfully');
      this.emit('started');

    } catch (error) {
      this.logger.error('Failed to start monitoring orchestrator', { error });
      throw error;
    }
  }

  /**
   * Stop the monitoring orchestrator
   */
  async stop(): Promise<void> {
    if (!this.isStarted) return;

    this.logger.info('Stopping monitoring orchestrator');

    // Stop dashboard
    if (this.dashboardInterval) {
      clearInterval(this.dashboardInterval);
      this.dashboardInterval = undefined;
    }

    // Stop profiling sessions
    this.profiler.stopSession();

    this.isStarted = false;
    this.logger.info('Monitoring orchestrator stopped');
    this.emit('stopped');
  }

  /**
   * Record a search operation
   */
  recordSearch(
    query: string,
    duration: number,
    resultCount: number,
    cacheHit: boolean,
    strategy: string,
    error?: Error,
    indexesUsed: string[] = []
  ): void {
    const traceId = this.generateTraceId();

    // Record performance metrics
    this.performanceMonitor.recordSearch(
      query,
      duration,
      resultCount,
      cacheHit,
      strategy,
      indexesUsed
    );

    // Log the operation
    this.logger.logSearch({
      traceId,
      query,
      duration,
      resultCount,
      cacheHit,
      strategy,
      error: error?.message,
      indexesUsed
    });

    // Check for alerts
    this.checkAlerts(duration, !!error, cacheHit);

    // Record in profiler if session active
    if (this.profiler.isSessionActive()) {
      this.profiler.recordQuery(query, duration, strategy, indexesUsed);
    }
  }

  /**
   * Start a profiling session
   */
  async startProfilingSession(name?: string): Promise<string> {
    const sessionId = await this.profiler.startSession(name);
    this.logger.info(`Profiling session started: ${sessionId}`);
    return sessionId;
  }

  /**
   * Stop current profiling session
   */
  async stopProfilingSession(): Promise<any> {
    const session = await this.profiler.stopSession();
    if (session) {
      this.logger.info(`Profiling session completed: ${session.id}`);
    }
    return session;
  }

  /**
   * Get current performance metrics
   */
  async getCurrentMetrics(): Promise<any> {
    return this.performanceMonitor.getCurrentMetrics();
  }

  /**
   * Get dashboard data
   */
  async getDashboardData(): Promise<any> {
    const performanceData = await this.performanceMonitor.getCurrentMetrics();
    const profilerData = this.profiler.isSessionActive() 
      ? await this.profiler.getCurrentStats() 
      : null;

    return this.dashboard.getDashboardData({
      performance: performanceData,
      profiler: profilerData,
      alerts: this.alertingEngine.getActiveAlerts()
    });
  }

  /**
   * Generate performance report
   */
  async generateReport(hours: number = 24): Promise<any> {
    const performanceReport = await this.performanceMonitor.generateReport(hours);
    const profilerReport = await this.profiler.generateReport(hours);
    
    return {
      timestamp: new Date(),
      period: `${hours} hours`,
      performance: performanceReport,
      profiler: profilerReport,
      alerts: this.alertingEngine.getAlertHistory(hours),
      recommendations: this.generateRecommendations(performanceReport, profilerReport)
    };
  }

  private startDashboard(): void {
    if (this.dashboardInterval) return;

    this.dashboardInterval = setInterval(async () => {
      try {
        const dashboardData = await this.getDashboardData();
        this.emit('dashboard_update', dashboardData);
      } catch (error) {
        this.logger.error('Dashboard update failed', { error });
      }
    }, this.config.dashboard.refreshInterval * 1000);
  }

  private startAutoProfiling(): void {
    // Start automatic profiling sessions
    setInterval(async () => {
      try {
        if (!this.profiler.isSessionActive()) {
          await this.startProfilingSession('auto');
          
          // Stop after configured duration
          setTimeout(async () => {
            await this.stopProfilingSession();
          }, this.config.profiling.sessionDuration * 60 * 1000);
        }
      } catch (error) {
        this.logger.error('Auto-profiling failed', { error });
      }
    }, (this.config.profiling.sessionDuration + 5) * 60 * 1000); // 5 min gap between sessions
  }

  private checkAlerts(duration: number, hasError: boolean, cacheHit: boolean): void {
    const metrics = {
      response_time: duration,
      error_occurred: hasError ? 1 : 0,
      cache_hit: cacheHit ? 1 : 0
    };

    this.alertingEngine.checkRules(metrics);
  }

  private generateRecommendations(performanceReport: any, profilerReport: any): string[] {
    const recommendations: string[] = [];

    // Response time recommendations
    if (performanceReport.avgResponseTime > this.config.sla.responseTimeThreshold * 0.8) {
      recommendations.push('Response times approaching SLA threshold - consider query optimization');
    }

    // Cache recommendations
    if (performanceReport.cacheHitRate < this.config.sla.cacheHitRateThreshold) {
      recommendations.push('Cache hit rate below threshold - review caching strategy');
    }

    // Profiler recommendations
    if (profilerReport && profilerReport.bottlenecks.length > 0) {
      recommendations.push('Performance bottlenecks detected - review profiling session details');
    }

    return recommendations;
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Default configuration
export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  database: {
    path: './monitoring.db'
  },
  sla: {
    responseTimeThreshold: 1000, // 1 second
    errorRateThreshold: 5, // 5%
    cacheHitRateThreshold: 80 // 80%
  },
  alerting: {
    enabled: true,
    channels: ['console', 'file'],
    escalationDelay: 15 // 15 minutes
  },
  logging: {
    level: 'info',
    destinations: ['console', 'file'],
    enableTrace: true
  },
  profiling: {
    enabled: true,
    autoProfile: false,
    sessionDuration: 10 // 10 minutes
  },
  dashboard: {
    refreshInterval: 30, // 30 seconds
    autoStart: true
  }
};