import { EventEmitter } from 'events';
export interface CacheMetrics {
  timestamp: number;
  cacheKey: string;
  operation: 'hit' | 'miss' | 'set' | 'delete' | 'evict';
  responseTime: number;
  dataSize: number;
  ttl: number;
  accessPattern: 'read' | 'write' | 'readwrite';
  frequency: number;
}
export interface CacheConfig {
  strategy: 'lru' | 'lfu' | 'fifo' | 'arc' | 'adaptive';
  maxSize: number;
  maxEntries: number;
  defaultTTL: number;
  cleanupInterval: number;
  compressionEnabled: boolean;
  memoryThreshold: number;
  distribution: {
    enabled: boolean;
    nodes: number;
    consistentHashing: boolean;
  };
}
export interface CacheOptimizationRecommendation {
  id: string;
  timestamp: number;
  category: 'strategy' | 'size' | 'ttl' | 'distribution' | 'cleanup';
  title: string;
  description: string;
  currentValue: any;
  recommendedValue: any;
  reason: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  effort: 'low' | 'medium' | 'high';
  expectedImprovement: {
    hitRatio: number;
    responseTime: number;
    memoryEfficiency: number;
  };
  metrics: {
    currentHitRatio: number;
    targetHitRatio: number;
    affectedKeys: string[];
    estimatedSavings: number;
  };
}
export interface CacheAnalysis {
  hitRatio: number;
  missRatio: number;
  avgResponseTime: number;
  memoryUtilization: number;
  evictionRate: number;
  hotKeys: string[];
  coldKeys: string[];
  accessPatterns: Map<string, any>;
  temporalPatterns: any;
  sizeDistribution: any;
}
export declare class CacheStrategyOptimizer extends EventEmitter {
  private metrics;
  private config;
  private analysisCache;
  private keyPatterns;
  private temporalAnalysis;
  constructor();
  initialize(): Promise<void>;
  recordCacheMetrics(metrics: CacheMetrics): void;
  analyzeCacheStrategy(): Promise<any[]>;
  getOptimizationRecommendations(metrics: any[]): Promise<CacheOptimizationRecommendation[]>;
  applyOptimization(recommendation: any): Promise<boolean>;
  private analyzeStrategyOptimization;
  private analyzeSizeOptimization;
  private analyzeTTLOptimization;
  private analyzeDistributionOptimization;
  private analyzeCleanupOptimization;
  private applyCacheOptimization;
  private testCacheOptimization;
  private getRecentMetrics;
  private calculateHitRatio;
  private calculateMissRatio;
  private calculateAverageResponseTime;
  private calculateMemoryUtilization;
  private calculateEvictionRate;
  private identifyHotKeys;
  private identifyColdKeys;
  private analyzeAccessPatterns;
  private analyzeTemporalPatterns;
  private analyzeSizeDistribution;
  private updateKeyPatterns;
  private checkCriticalIssues;
  private analyzeKeyAccessFrequency;
  private hasHighVariability;
  private analyzeKeyLifespans;
  private hasVariableTTLNeeds;
  private calculateVariance;
  private getFrequentlyEvictedKeys;
  private getDistributedKeys;
  private getExpiredKeys;
  private getLargeKeys;
  private determineAccessPattern;
  private findPeakHours;
  private calculateTemporalVariance;
  private prioritizeRecommendations;
  private createCacheAnalysisMetric;
  private determineCacheTrend;
  private determineCacheSeverity;
  private startBackgroundAnalysis;
  destroy(): Promise<void>;
}
export default CacheStrategyOptimizer;
//# sourceMappingURL=CacheStrategyOptimizer.d.ts.map
