import { EventEmitter } from 'events';
export interface PerformanceMetric {
  timestamp: number;
  component: string;
  metric: string;
  value: number;
  unit: string;
  context?: Record<string, any>;
  threshold?: {
    warning: number;
    critical: number;
  };
}
export interface Bottleneck {
  id: string;
  timestamp: number;
  component: string;
  type: 'cpu' | 'memory' | 'io' | 'network' | 'database' | 'cache' | 'search' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metrics: PerformanceMetric[];
  impactAnalysis: {
    affectedComponents: string[];
    performanceDegradation: number;
    userExperienceImpact: 'minimal' | 'moderate' | 'significant' | 'severe';
    businessImpact: 'low' | 'medium' | 'high' | 'critical';
  };
  rootCause: {
    primary: string;
    contributing: string[];
    confidence: number;
  };
  trend: {
    direction: 'improving' | 'stable' | 'degrading';
    velocity: number;
    prediction: string;
  };
}
export interface OptimizationSuggestion {
  id: string;
  bottleneckId: string;
  timestamp: number;
  category: 'immediate' | 'short-term' | 'long-term';
  title: string;
  description: string;
  implementation: {
    steps: string[];
    estimatedEffort: 'low' | 'medium' | 'high';
    estimatedTime: string;
    prerequisites: string[];
    risks: string[];
  };
  expectedResults: {
    performanceImprovement: number;
    timeline: string;
    measurableOutcomes: string[];
  };
  priority: number;
  cost: 'low' | 'medium' | 'high';
}
export interface ComponentHealth {
  component: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  score: number;
  lastCheck: number;
  metrics: PerformanceMetric[];
  trends: {
    shortTerm: 'improving' | 'stable' | 'degrading';
    longTerm: 'improving' | 'stable' | 'degrading';
  };
  alerts: {
    warning: number;
    critical: number;
  };
}
export declare class BottleneckDetector extends EventEmitter {
  private metrics;
  private bottlenecks;
  private componentHealth;
  private detectionRules;
  private thresholds;
  private analysisHistory;
  constructor();
  initialize(): Promise<void>;
  recordMetric(metric: PerformanceMetric): void;
  detectBottlenecks(): Promise<any[]>;
  getOptimizationRecommendations(metrics: any[]): Promise<OptimizationSuggestion[]>;
  applyOptimization(recommendation: any): Promise<boolean>;
  private initializeDetectionRules;
  private initializeThresholds;
  private initializeComponentHealth;
  private updateComponentHealth;
  private calculateHealthScore;
  private updateHealthStatus;
  private updateHealthTrends;
  private checkImediateBottleneck;
  private generateOptimizationSuggestion;
  private calculateSuggestionPriority;
  private getRecentMetrics;
  private analyzeTrend;
  private calculateVelocity;
  private isRecentBottleneck;
  private prioritizeRecommendations;
  private simulateOptimizationApplication;
  private createBottleneckAnalysisMetric;
  private startContinuousMonitoring;
  getComponentHealth(): ComponentHealth[];
  getActiveBottlenecks(): Bottleneck[];
  destroy(): Promise<void>;
}
export default BottleneckDetector;
//# sourceMappingURL=BottleneckDetector.d.ts.map
