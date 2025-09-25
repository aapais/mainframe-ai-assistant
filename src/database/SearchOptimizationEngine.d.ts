import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
export interface SearchPerformanceProfile {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  cacheHitRate: number;
  queryVolume: number;
  slowQueryCount: number;
  indexEfficiency: number;
}
export interface OptimizationStrategy {
  name: string;
  priority: number;
  estimatedImprovement: number;
  implementation: () => Promise<boolean>;
  rollback: () => Promise<boolean>;
  description: string;
}
export interface SearchPattern {
  pattern: string;
  frequency: number;
  averageTime: number;
  peakTime: number;
  preferredStrategy: string;
  cacheTTL: number;
}
export declare class SearchOptimizationEngine extends EventEmitter {
  private db;
  private optimizationCache;
  private searchPatterns;
  private performanceHistory;
  private activeOptimizations;
  constructor(db: Database.Database);
  private initializeOptimizationTables;
  analyzeAndOptimize(): Promise<OptimizationStrategy[]>;
  applyOptimization(strategy: OptimizationStrategy): Promise<{
    success: boolean;
    improvement?: number;
    error?: string;
  }>;
  private identifySlowQueries;
  private identifyUncachedFrequentQueries;
  private identifyIndexOpportunities;
  private identifyRoutingOptimizations;
  private createSlowQueryOptimization;
  private createCacheOptimization;
  private createIndexOptimization;
  private createRoutingOptimization;
  private precomputeComplexSearch;
  private preWarmQuery;
  private measureCurrentPerformance;
  private startPerformanceMonitoring;
  private scheduleOptimizationAnalysis;
  getPerformanceStatus(): {
    current: SearchPerformanceProfile;
    trend: 'improving' | 'stable' | 'degrading';
    activeOptimizations: string[];
    recommendations: string[];
  };
  getOptimizationHistory(): Array<{
    strategy: string;
    appliedAt: Date;
    improvement: number;
    status: string;
  }>;
}
//# sourceMappingURL=SearchOptimizationEngine.d.ts.map
