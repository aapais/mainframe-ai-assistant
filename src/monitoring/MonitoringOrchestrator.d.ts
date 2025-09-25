import { EventEmitter } from 'events';
export interface MonitoringConfig {
  database: {
    path: string;
  };
  sla: {
    responseTimeThreshold: number;
    errorRateThreshold: number;
    cacheHitRateThreshold: number;
  };
  alerting: {
    enabled: boolean;
    channels: string[];
    escalationDelay: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    destinations: string[];
    enableTrace: boolean;
  };
  profiling: {
    enabled: boolean;
    autoProfile: boolean;
    sessionDuration: number;
  };
  dashboard: {
    refreshInterval: number;
    autoStart: boolean;
  };
}
export declare class MonitoringOrchestrator extends EventEmitter {
  private performanceMonitor;
  private dashboard;
  private alertingEngine;
  private logger;
  private profiler;
  private config;
  private isStarted;
  private dashboardInterval?;
  constructor(config: MonitoringConfig);
  private initializeComponents;
  private setupEventHandlers;
  private setupSLAMonitoring;
  private setupAlertingRules;
  private setupLogging;
  start(): Promise<void>;
  stop(): Promise<void>;
  recordSearch(
    query: string,
    duration: number,
    resultCount: number,
    cacheHit: boolean,
    strategy: string,
    error?: Error,
    indexesUsed?: string[]
  ): void;
  startProfilingSession(name?: string): Promise<string>;
  stopProfilingSession(): Promise<any>;
  getCurrentMetrics(): Promise<any>;
  getDashboardData(): Promise<any>;
  generateReport(hours?: number): Promise<any>;
  private startDashboard;
  private startAutoProfiling;
  private checkAlerts;
  private generateRecommendations;
  private generateTraceId;
}
export declare const DEFAULT_MONITORING_CONFIG: MonitoringConfig;
//# sourceMappingURL=MonitoringOrchestrator.d.ts.map
