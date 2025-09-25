import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
interface PerformanceServiceConfig {
  autoOptimization: boolean;
  alertThresholds: {
    responseTime: number;
    memoryUsage: number;
    errorRate: number;
    cacheHitRate: number;
  };
  monitoringInterval: number;
  optimizationCooldown: number;
}
export declare class PerformanceService extends EventEmitter {
  private db;
  private searchMonitor;
  private optimizer;
  private testSuite;
  private baseMonitor;
  private config;
  private lastOptimization;
  private isInitialized;
  private serviceWorker;
  private cache;
  constructor(database: Database.Database, config?: Partial<PerformanceServiceConfig>);
  private initializeServices;
  getMetrics(timeRange?: '1h' | '24h' | '7d'): Promise<{
    metrics: any[];
    alerts: any[];
    recommendations: string[];
    slaStatus: any;
    trends: any;
  }>;
  recordSearch(
    query: string,
    duration: number,
    resultCount: number,
    cacheHit: boolean,
    strategy?: string,
    indexesUsed?: string[]
  ): void;
  executeOptimization(strategyName: string): Promise<{
    success: boolean;
    improvement: number;
    error?: string;
    recommendations?: string[];
  }>;
  runPerformanceTests(): Promise<{
    summary: any;
    results: any[];
    regressions?: any[];
    improvements?: any[];
  }>;
  getOptimizationRecommendations(metric: string): Promise<{
    strategies: any[];
    quickWins: any[];
    analysis: any;
  }>;
  setAutoOptimization(enabled: boolean): void;
  updateThresholds(thresholds: Partial<PerformanceServiceConfig['alertThresholds']>): void;
  getPerformanceHistory(): {
    optimizations: any;
    trends: any;
    slaCompliance: any[];
  };
  profileMemory(): Promise<{
    usage: any;
    leaks: any[];
    recommendations: string[];
  }>;
  analyzeBundleSize(): Promise<{
    totalSize: number;
    chunks: any;
    optimizations: string[];
  }>;
  optimizeWithWebAssembly(): Promise<{
    available: boolean;
    modules: string[];
    performance?: number;
  }>;
  private setupEventListeners;
  private initializeServiceWorker;
  private startPerformanceMonitoring;
  private checkSystemHealth;
  private checkAutoOptimization;
  private generateTimeSeriesMetrics;
}
export {};
//# sourceMappingURL=PerformanceService.d.ts.map
