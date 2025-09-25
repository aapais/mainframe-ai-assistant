import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { PerformanceMonitor } from '../database/PerformanceMonitor';
export interface SearchMetrics {
  timestamp: Date;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  queriesPerSecond: number;
  searchAccuracy: number;
  cacheHitRate: number;
  cacheHitRateByType: Record<string, number>;
  indexSize: number;
  indexGrowthRate: number;
  topQueries: Array<{
    query: string;
    count: number;
    avgTime: number;
  }>;
  slowQueries: Array<{
    query: string;
    time: number;
    timestamp: Date;
  }>;
  slaCompliance: number;
  slaViolations: number;
}
export interface SearchAlert {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'critical';
  metric: string;
  currentValue: number;
  threshold: number;
  message: string;
  query?: string;
  recommendations: string[];
}
export interface QueryProfileData {
  query: string;
  normalizedQuery: string;
  executions: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  cacheHits: number;
  cacheHitRate: number;
  lastExecuted: Date;
  strategy: string;
  indexesUsed: string[];
}
export declare class SearchPerformanceMonitor extends EventEmitter {
  private db;
  private baseMonitor;
  private metrics;
  private alerts;
  private queryProfiles;
  private responseTimes;
  private readonly SLA_THRESHOLD;
  private readonly SLOW_QUERY_THRESHOLD;
  private readonly CRITICAL_THRESHOLD;
  private config;
  constructor(database: Database.Database, baseMonitor: PerformanceMonitor);
  recordSearch(
    query: string,
    duration: number,
    resultCount: number,
    cacheHit: boolean,
    strategy: string,
    indexesUsed?: string[]
  ): void;
  getCurrentMetrics(): SearchMetrics | null;
  getDashboardData(): {
    currentMetrics: SearchMetrics | null;
    recentTrends: any;
    topQueries: QueryProfileData[];
    slowQueries: QueryProfileData[];
    activeAlerts: SearchAlert[];
    slaStatus: any;
  };
  getPerformanceTrends(hours?: number): {
    responseTime: Array<{
      time: Date;
      avg: number;
      p95: number;
      p99: number;
    }>;
    throughput: Array<{
      time: Date;
      qps: number;
    }>;
    slaCompliance: Array<{
      time: Date;
      compliance: number;
      violations: number;
    }>;
    cacheHitRate: Array<{
      time: Date;
      rate: number;
    }>;
  };
  getTopQueries(limit?: number): QueryProfileData[];
  getSlowQueries(limit?: number): QueryProfileData[];
  getSLAViolations(limit?: number): Array<{
    query: string;
    avgTime: number;
    executions: number;
    violationRate: number;
    lastViolation: Date;
  }>;
  getActiveAlerts(): SearchAlert[];
  getSLAStatus(): {
    currentCompliance: number;
    hourlyCompliance: number;
    dailyCompliance: number;
    recentViolations: number;
    worstQueries: Array<{
      query: string;
      avgTime: number;
    }>;
  };
  getOptimizationRecommendations(): string[];
  generatePerformanceReport(timeframe?: 'hourly' | 'daily' | 'weekly'): any;
  private collectMetrics;
  private normalizeQuery;
  private updateQueryProfile;
  private checkSearchAlert;
  private checkMetricAlerts;
  private createAlert;
  private calculatePercentile;
  private calculateSearchAccuracy;
  private calculateCacheHitRate;
  private calculateCacheHitRateByType;
  private getIndexSize;
  private calculateIndexGrowthRate;
  private getTopQueriesForMetrics;
  private getSlowQueriesForMetrics;
  private calculateSLACompliance;
  private calculateCacheHitRateByStrategy;
  private getAlertSummary;
  private getTopAlertMetrics;
  private getHistoricalMetrics;
  private generateAlertId;
  private storeMetrics;
  private storeSearchMetric;
  private storeAlert;
  private initializeMonitoringTables;
  private startMonitoring;
  private cleanupOldData;
}
//# sourceMappingURL=SearchPerformanceMonitor.d.ts.map
