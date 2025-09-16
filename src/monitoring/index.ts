/**
 * Monitoring Module Export Index
 * Centralized exports for all monitoring components
 */

// Core monitoring components
export { SearchPerformanceMonitor } from './SearchPerformanceMonitor';
export { MonitoringDashboard } from './MonitoringDashboard';
export { AlertingEngine } from './AlertingEngine';
export { SearchLogger } from './SearchLogger';
export { PerformanceProfiler } from './PerformanceProfiler';

// Orchestration and integration
export { MonitoringOrchestrator, DEFAULT_MONITORING_CONFIG } from './MonitoringOrchestrator';
export { MonitoredSearchService, demonstrateMonitoring } from './SearchServiceIntegration';

// Types and interfaces
export type { MonitoringConfig } from './MonitoringOrchestrator';
export type { PerformanceMetrics, SLAMetrics } from './SearchPerformanceMonitor';
export type { DashboardWidget, DashboardConfig } from './MonitoringDashboard';
export type { AlertRule, AlertChannel } from './AlertingEngine';
export type { LogLevel, SearchLogEntry } from './SearchLogger';
export type { ProfileSession, QueryProfile, Bottleneck } from './PerformanceProfiler';

/**
 * Quick start function for monitoring
 */
export async function startMonitoring(config?: Partial<MonitoringConfig>): Promise<MonitoredSearchService> {
  const { MonitoredSearchService, DEFAULT_MONITORING_CONFIG } = await import('./SearchServiceIntegration');
  
  const finalConfig = {
    ...DEFAULT_MONITORING_CONFIG,
    ...config
  };

  const service = new MonitoredSearchService('./knowledge.db', finalConfig);
  await service.initialize();
  
  console.log('🔍 Search monitoring started successfully');
  console.log('📊 Dashboard: Call service.getDashboard() for real-time data');
  console.log('🚨 SLA monitoring: <1s response time threshold active');
  console.log('📈 Profiling: Call service.startProfiling() to begin detailed analysis');
  
  return service;
}

/**
 * Development monitoring configuration
 */
export const DEV_MONITORING_CONFIG: MonitoringConfig = {
  database: {
    path: './monitoring_dev.db'
  },
  sla: {
    responseTimeThreshold: 1000, // 1 second
    errorRateThreshold: 10, // 10% (more lenient for dev)
    cacheHitRateThreshold: 70 // 70% (more lenient for dev)
  },
  alerting: {
    enabled: true,
    channels: ['console'],
    escalationDelay: 5 // 5 minutes
  },
  logging: {
    level: 'debug',
    destinations: ['console'],
    enableTrace: true
  },
  profiling: {
    enabled: true,
    autoProfile: true,
    sessionDuration: 5 // 5 minutes
  },
  dashboard: {
    refreshInterval: 10, // 10 seconds
    autoStart: true
  }
};

/**
 * Production monitoring configuration
 */
export const PROD_MONITORING_CONFIG: MonitoringConfig = {
  database: {
    path: './monitoring_prod.db'
  },
  sla: {
    responseTimeThreshold: 1000, // 1 second
    errorRateThreshold: 2, // 2%
    cacheHitRateThreshold: 85 // 85%
  },
  alerting: {
    enabled: true,
    channels: ['console', 'file', 'webhook'],
    escalationDelay: 15 // 15 minutes
  },
  logging: {
    level: 'info',
    destinations: ['file', 'webhook'],
    enableTrace: false
  },
  profiling: {
    enabled: true,
    autoProfile: false, // Manual profiling in production
    sessionDuration: 15 // 15 minutes
  },
  dashboard: {
    refreshInterval: 60, // 1 minute
    autoStart: true
  }
};

/**
 * Monitoring health check
 */
export async function healthCheck(): Promise<{ status: string; components: any }> {
  try {
    const service = await startMonitoring(DEV_MONITORING_CONFIG);
    const metrics = await service.getMetrics();
    await service.shutdown();

    return {
      status: 'healthy',
      components: {
        database: 'connected',
        performance_monitor: 'active',
        alerting: 'configured',
        logging: 'enabled',
        profiling: 'available',
        sla_monitoring: metrics.slaCompliance > 95 ? 'compliant' : 'at_risk'
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      components: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}