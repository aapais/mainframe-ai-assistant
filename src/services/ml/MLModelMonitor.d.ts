import { MLModel } from '../../types/ml';
interface ModelMetrics {
  modelId: string;
  accuracy: number;
  latency: number;
  throughput: number;
  errorRate: number;
  memoryUsage: number;
  lastUpdated: Date;
  predictionCount: number;
  driftScore: number;
}
interface PerformanceTrend {
  metric: string;
  trend: 'improving' | 'degrading' | 'stable';
  changeRate: number;
  significance: number;
  timeWindow: string;
}
interface ModelAlert {
  modelId: string;
  type: 'performance_degradation' | 'drift_detected' | 'high_latency' | 'error_spike';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  metrics: Record<string, number>;
  recommendations: string[];
}
export declare class MLModelMonitor {
  private config;
  private modelMetrics;
  private alerts;
  private driftDetectors;
  private performanceBaselines;
  constructor(config?: any);
  startMonitoring(modelId: string, model: MLModel): Promise<void>;
  recordPrediction(
    modelId: string,
    input: any,
    prediction: any,
    actualValue?: any,
    latency?: number
  ): Promise<void>;
  private captureBaseline;
  private initializeDriftDetector;
  private updateModelMetrics;
  private getCurrentMetrics;
  private updateMovingAverage;
  private checkForDrift;
  private detectFeatureDrift;
  private detectLabelDrift;
  private detectConceptDrift;
  private extractFeatures;
  private calculateEntropy;
  private isPredictionCorrect;
  private determineDriftType;
  private generateDriftAlert;
  private getDriftRecommendations;
  private checkPerformanceThresholds;
  private generatePerformanceAlert;
  private getPerformanceRecommendations;
  getModelHealth(modelId: string): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    metrics: ModelMetrics;
    recentAlerts: ModelAlert[];
    trends: PerformanceTrend[];
  }>;
  private calculatePerformanceTrends;
  private calculateTrend;
  getAlerts(modelId?: string): ModelAlert[];
  clearAlerts(modelId?: string): void;
  getModelMetrics(modelId: string): ModelMetrics[];
}
export {};
//# sourceMappingURL=MLModelMonitor.d.ts.map
