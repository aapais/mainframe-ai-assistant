import { EventEmitter } from 'events';
import { OptimizationEngine, OptimizationMetrics } from './OptimizationEngine';
export interface AggregatedMetrics {
  timestamp: number;
  period: string;
  totalMetrics: number;
  categories: Record<
    string,
    {
      count: number;
      averageValue: number;
      minValue: number;
      maxValue: number;
      trend: 'improving' | 'stable' | 'degrading';
      variance: number;
    }
  >;
  systemOverview: {
    healthScore: number;
    performanceIndex: number;
    efficiencyRating: number;
    stabilityScore: number;
  };
  trends: {
    hourly: Record<number, number>;
    daily: Record<string, number>;
    weekly: Record<string, number>;
  };
  anomalies: any[];
  predictions: {
    shortTerm: any;
    longTerm: any;
  };
}
export interface MetricsSnapshot {
  id: string;
  timestamp: number;
  type: 'scheduled' | 'triggered' | 'manual';
  metrics: OptimizationMetrics[];
  aggregated: AggregatedMetrics;
  insights: string[];
  alerts: any[];
}
export interface MetricsConfiguration {
  aggregationInterval: number;
  retentionPeriod: number;
  anomalyThreshold: number;
  enablePredictions: boolean;
  enableRealTimeAlerts: boolean;
  categories: string[];
  customThresholds: Record<string, any>;
}
export declare class OptimizationMetricsAggregator extends EventEmitter {
  private optimizationEngine;
  private config;
  private rawMetrics;
  private aggregatedMetrics;
  private snapshots;
  private aggregationInterval?;
  private anomalyDetector;
  constructor(optimizationEngine: OptimizationEngine, config?: Partial<MetricsConfiguration>);
  initialize(): Promise<void>;
  recordMetric(metric: OptimizationMetrics): void;
  performAggregation(type?: 'scheduled' | 'triggered' | 'manual'): Promise<AggregatedMetrics>;
  getAggregatedMetrics(period?: string): AggregatedMetrics | null;
  getSnapshots(limit?: number): MetricsSnapshot[];
  getMetricsForTimeRange(startTime: number, endTime: number): OptimizationMetrics[];
  getTrendingMetrics(category?: string, timeWindow?: number): any;
  getAnomalies(timeWindow?: number): any[];
  getPerformancePredictions(): any;
  generateMetricsReport(period?: string): any;
  private setupEngineEventHandlers;
  private initializeAnomalyDetector;
  private startPeriodicAggregation;
  private aggregateMetrics;
  private aggregateByCategory;
  private calculateSystemOverview;
  private calculateTrends;
  private detectAnomalies;
  private generatePredictions;
  private getRecentMetrics;
  private getCurrentPeriod;
  private getPeriodStart;
  private cleanupOldMetrics;
  private checkRealTimeAnomalies;
  private generateMetricsInsights;
  private checkMetricsAlerts;
  private parseTimeWindow;
  private generateMetricsSummary;
  private generateCategoryAnalysis;
  private generateTrendAnalysis;
  private generateAdvancedInsights;
  private calculateVariance;
  private determineCategoryTrend;
  private groupMetricsByHour;
  private groupMetricsByDay;
  private groupMetricsByWeek;
  private calculateTrendDirection;
  private calculateTrendChange;
  private calculateTrendConfidence;
  private calculateLinearTrend;
  private calculateCorrelation;
  private convertMapToRecord;
  destroy(): Promise<void>;
}
export default OptimizationMetricsAggregator;
//# sourceMappingURL=OptimizationMetricsAggregator.d.ts.map
