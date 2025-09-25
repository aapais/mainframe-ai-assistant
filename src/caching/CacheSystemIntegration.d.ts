import Database from 'better-sqlite3';
export interface CacheSystemConfig {
  mvpLevel: 1 | 2 | 3 | 4 | 5;
  enableDistributedCache?: boolean;
  enablePredictiveWarming?: boolean;
  enableSmartInvalidation?: boolean;
  enablePerformanceMonitoring?: boolean;
  performanceTargets?: {
    maxResponseTime: number;
    minHitRate: number;
    maxMemoryUsage: number;
  };
}
export interface CacheSystemStats {
  layers: {
    hot: {
      size: number;
      hitRate: number;
      avgTime: number;
    };
    warm: {
      size: number;
      hitRate: number;
      avgTime: number;
    };
    distributed: {
      size: number;
      hitRate: number;
      avgTime: number;
    };
    persistent: {
      size: number;
      hitRate: number;
      avgTime: number;
    };
  };
  warming: {
    totalWarmed: number;
    accuracy: number;
    effectiveness: number;
  };
  invalidation: {
    totalInvalidated: number;
    cascadeRate: number;
    accuracy: number;
  };
  performance: {
    overallHitRate: number;
    avgResponseTime: number;
    slaCompliance: number;
    grade: string;
  };
}
export declare class CacheSystemIntegration {
  private database;
  private cacheManager;
  private warmingEngine;
  private invalidationManager;
  private performanceMonitor;
  private config;
  private initialized;
  constructor(database: Database.Database, config: CacheSystemConfig);
  initialize(): Promise<void>;
  get<T>(
    key: string,
    computeFn: () => Promise<T> | T,
    options?: {
      ttl?: number;
      priority?: 'low' | 'normal' | 'high' | 'critical';
      tags?: string[];
      userContext?: string;
      category?: string;
    }
  ): Promise<T>;
  searchKB(
    query: string,
    options?: {
      limit?: number;
      category?: string;
      userContext?: string;
      useAI?: boolean;
    }
  ): Promise<any[]>;
  analyzePatterns(
    timeWindow?: string,
    options?: {
      userContext?: string;
      components?: string[];
    }
  ): Promise<any[]>;
  analyzeCode(
    filePath: string,
    options?: {
      userContext?: string;
      analysisType?: 'syntax' | 'quality' | 'links';
    }
  ): Promise<any>;
  warmCache(
    strategy?: 'popular' | 'user-specific' | 'time-based' | 'predictive',
    userContext?: string
  ): Promise<number>;
  invalidateCache(pattern?: string, tags?: string[], reason?: string): Promise<number>;
  getSystemStats(): CacheSystemStats;
  getOptimizationRecommendations(): {
    cache: string[];
    warming: string[];
    invalidation: string[];
    performance: string[];
  };
  generatePerformanceReport(timeframe?: 'hourly' | 'daily' | 'weekly'): any;
  shutdown(): Promise<void>;
  private ensureInitialized;
  private setupEventListeners;
  private initialCacheWarming;
  private handleCriticalAlert;
  private getOptimalHotCacheSize;
  private getOptimalWarmCacheSize;
  private getOptimalMemoryLimit;
  private generateSearchCacheKey;
  private getSearchTTL;
  private executeKBSearch;
  private executePatternAnalysis;
  private executeCodeAnalysis;
  private extractLayerStats;
  private generateOperationId;
}
export declare function createCacheSystem(
  database: Database.Database,
  config: CacheSystemConfig
): Promise<CacheSystemIntegration>;
export declare const MVPConfigurations: {
  MVP1: {
    mvpLevel: 1;
    enableDistributedCache: boolean;
    enablePredictiveWarming: boolean;
    performanceTargets: {
      maxResponseTime: number;
      minHitRate: number;
      maxMemoryUsage: number;
    };
  };
  MVP2: {
    mvpLevel: 2;
    enableDistributedCache: boolean;
    enablePredictiveWarming: boolean;
    performanceTargets: {
      maxResponseTime: number;
      minHitRate: number;
      maxMemoryUsage: number;
    };
  };
  MVP3: {
    mvpLevel: 3;
    enableDistributedCache: boolean;
    enablePredictiveWarming: boolean;
    performanceTargets: {
      maxResponseTime: number;
      minHitRate: number;
      maxMemoryUsage: number;
    };
  };
  MVP4: {
    mvpLevel: 4;
    enableDistributedCache: boolean;
    enablePredictiveWarming: boolean;
    performanceTargets: {
      maxResponseTime: number;
      minHitRate: number;
      maxMemoryUsage: number;
    };
  };
  MVP5: {
    mvpLevel: 5;
    enableDistributedCache: boolean;
    enablePredictiveWarming: boolean;
    performanceTargets: {
      maxResponseTime: number;
      minHitRate: number;
      maxMemoryUsage: number;
    };
  };
};
//# sourceMappingURL=CacheSystemIntegration.d.ts.map
