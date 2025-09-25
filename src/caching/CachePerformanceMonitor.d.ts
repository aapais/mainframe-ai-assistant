import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { MultiLayerCacheManager } from './MultiLayerCacheManager';
import { CacheWarmingEngine } from './CacheWarmingEngine';
import { CacheInvalidationManager } from './CacheInvalidationManager';
export interface PerformanceTarget {
  mvpLevel: 1 | 2 | 3 | 4 | 5;
  maxResponseTime: number;
  minHitRate: number;
  maxMemoryUsage: number;
  maxEvictionRate: number;
}
export interface PerformanceMetrics {
  timestamp: Date;
  mvpLevel: 1 | 2 | 3 | 4 | 5;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  overallHitRate: number;
  layerHitRates: Record<string, number>;
  memoryUsage: number;
  memoryEfficiency: number;
  requestsPerSecond: number;
  cacheEventsPerMinute: number;
  warmingEffectiveness: number;
  invalidationAccuracy: number;
  dataFreshness: number;
  slaCompliance: number;
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}
export interface PerformanceAlert {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'critical';
  metric: string;
  currentValue: number;
  threshold: number;
  message: string;
  recommendations: string[];
}
export interface TrendAnalysis {
  metric: string;
  trend: 'improving' | 'stable' | 'degrading';
  changeRate: number;
  projection: number;
  confidence: number;
}
export declare class CachePerformanceMonitor extends EventEmitter {
  private db;
  private cacheManager;
  private warmingEngine;
  private invalidationManager;
  private currentMetrics;
  private historicalMetrics;
  private alerts;
  private responseTimes;
  private targets;
  private config;
  constructor(
    database: Database.Database,
    cacheManager: MultiLayerCacheManager,
    warmingEngine: CacheWarmingEngine,
    invalidationManager: CacheInvalidationManager,
    mvpLevel: 1 | 2 | 3 | 4 | 5
  );
  getCurrentMetrics(): PerformanceMetrics;
  getHistoricalMetrics(hours?: number): PerformanceMetrics[];
  getActiveAlerts(): PerformanceAlert[];
  getTrendAnalysis(): TrendAnalysis[];
  recordOperation(operation: string, duration: number, cacheHit: boolean): void;
  generateReport(timeframe?: 'hourly' | 'daily' | 'weekly'): any;
  getOptimizationSuggestions(): string[];
  private collectMetrics;
  private calculatePercentile;
  private calculateTotalMemoryUsage;
  private calculateMemoryEfficiency;
  private calculateRequestsPerSecond;
  private calculateCacheEventsPerMinute;
  private calculateDataFreshness;
  private calculateSLACompliance;
  private calculatePerformanceGrade;
  private checkAlerts;
  private createAlert;
  private analyzeTrend;
  private calculateAverage;
  private calculateStability;
  private calculateOverallGrade;
  private getAlertSummary;
  private getTopAlertMetrics;
  private generateRecommendations;
  private setupPerformanceTargets;
  private cleanupHistoricalMetrics;
  private generateAlertId;
  private storeMetrics;
  private storeAlert;
  private storeOperationMetric;
  private initializeMonitoringTables;
  private startMonitoring;
}
//# sourceMappingURL=CachePerformanceMonitor.d.ts.map
