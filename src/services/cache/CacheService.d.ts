import { EventEmitter } from 'events';
import { SearchEvent } from './PredictiveCache';
import { LoadRequest } from './IncrementalLoader';
import { WarmingConfig, UserContext } from './CacheWarmer';
export interface CacheConfig {
  lru: {
    maxSize: number;
    maxMemoryMB: number;
    defaultTTL: number;
    evictionPolicy: 'LRU' | 'LFU' | 'ARC' | 'ADAPTIVE';
  };
  predictive: {
    enableMLPredictions: boolean;
    maxPredictions: number;
    confidenceThreshold: number;
    predictionHorizon: number;
  };
  incremental: {
    defaultChunkSize: number;
    maxParallelLoads: number;
    enableAdaptiveChunking: boolean;
  };
  warming: Partial<WarmingConfig>;
  performance: {
    enableMetrics: boolean;
    metricsRetentionDays: number;
    enableAlerts: boolean;
  };
}
export interface CacheMetrics {
  lru: {
    hitRate: number;
    size: number;
    memoryUsage: number;
    evictions: number;
  };
  predictive: {
    totalPredictions: number;
    successfulPredictions: number;
    predictionAccuracy: number;
  };
  incremental: {
    activeLoads: number;
    averageLoadTime: number;
    cacheHitRate: number;
  };
  warming: {
    totalWarmed: number;
    avgHitRateImprovement: number;
    successRate: number;
  };
  overall: {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    averageResponseTime: number;
    throughput: number;
  };
}
export interface CacheKey {
  type: 'search' | 'data' | 'computation' | 'user';
  id: string;
  params?: Record<string, any>;
  userContext?: string;
}
export declare class CacheService extends EventEmitter {
  private config;
  private lruCache;
  private predictiveCache;
  private incrementalLoader;
  private cacheWarmer;
  private metrics;
  private requestHistory;
  private activeOperations;
  constructor(config?: Partial<CacheConfig>);
  get<T>(key: CacheKey): Promise<T | null>;
  set<T>(
    key: CacheKey,
    value: T,
    options?: {
      ttl?: number;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      metadata?: Record<string, any>;
    }
  ): Promise<boolean>;
  delete(key: CacheKey): Promise<boolean>;
  has(key: CacheKey): Promise<boolean>;
  clear(): Promise<void>;
  loadIncremental<T>(
    request: LoadRequest<T>,
    dataSource: (offset: number, limit: number) => Promise<T[]>
  ): Promise<T[]>;
  warmCache(strategy?: string, userContext?: UserContext): Promise<any>;
  recordSearchEvent(sessionId: string, event: SearchEvent, userId?: string): void;
  getPredictions(sessionId: string, userId?: string, context?: Record<string, any>): Promise<any[]>;
  getMetrics(): CacheMetrics;
  getPerformanceStats(): {
    hitRate: number;
    missRate: number;
    averageResponseTime: number;
    throughput: number;
    hotKeys: Array<{
      key: string;
      hitCount: number;
      avgResponseTime: number;
    }>;
    recommendations: string[];
  };
  optimize(): Promise<{
    actionsPerformed: string[];
    estimatedImprovement: number;
    newConfiguration: Partial<CacheConfig>;
  }>;
  destroy(): Promise<void>;
  private mergeConfig;
  private initializeComponents;
  private initializeMetrics;
  private updateMetrics;
  private updateOverallMetrics;
  private recordHit;
  private recordMiss;
  private cleanupRequestHistory;
  private generateCacheKey;
  private estimateSize;
  private storeMetadata;
  private triggerPredictiveLoading;
  private resetMetrics;
  private generateRecommendations;
  private adaptConfiguration;
  private startPerformanceMonitoring;
  private checkPerformanceAlerts;
}
export default CacheService;
//# sourceMappingURL=CacheService.d.ts.map
