import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
export interface CacheLayer {
  name: string;
  level: number;
  enabled: boolean;
  hitRate: number;
  avgResponseTime: number;
  memoryUsage: number;
  size: number;
}
export interface CacheMetrics {
  totalHits: number;
  totalMisses: number;
  totalRequests: number;
  overallHitRate: number;
  avgResponseTime: number;
  layers: CacheLayer[];
  predictiveAccuracy: number;
  warmingEffectiveness: number;
}
export interface CacheWarmingStrategy {
  name: string;
  priority: number;
  frequency: 'continuous' | 'hourly' | 'daily' | 'on-demand';
  queries: string[];
  estimatedBenefit: number;
}
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  computationTime: number;
  size: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  tags: string[];
  mvpLevel: 1 | 2 | 3 | 4 | 5;
  userContext?: string;
}
export declare class MultiLayerCacheManager extends EventEmitter {
  private instantCache;
  private hotCache;
  private warmCache;
  private distributedCache?;
  private persistentCache;
  private metrics;
  private warmingStrategies;
  private mvpLevel;
  private config;
  constructor(
    database: Database.Database,
    mvpLevel?: 1 | 2 | 3 | 4 | 5,
    options?: Partial<typeof this.config>
  );
  get<T>(
    key: string,
    computeFn: () => Promise<T> | T,
    options?: {
      ttl?: number;
      priority?: 'low' | 'normal' | 'high' | 'critical';
      tags?: string[];
      userContext?: string;
      bypassCache?: boolean;
    }
  ): Promise<T>;
  warmCache(strategy?: string): Promise<number>;
  predictiveCache(userContext?: string): Promise<number>;
  invalidate(pattern?: string, tags?: string[], cascade?: boolean): Promise<number>;
  getMetrics(): CacheMetrics;
  getOptimizationSuggestions(): string[];
  private getFromInstantCache;
  private setInInstantCache;
  private promoteToInstantCache;
  private enforceInstantCacheLimit;
  private calculateInstantCacheValue;
  private getFromHotCache;
  private getFromWarmCache;
  private computeAndDistribute;
  private setInHotCache;
  private setInWarmCache;
  private promoteToHotCache;
  private enforceHotCacheLimit;
  private enforceWarmCacheLimit;
  private calculateEntryValue;
  private invalidateLayer;
  private generateCacheKey;
  private isExpired;
  private estimateSize;
  private recordCacheHit;
  private recordCacheMiss;
  private updateResponseTime;
  private calculateLayerHitRate;
  private calculateLayerAvgTime;
  private calculateMemoryUsage;
  private initializeMetrics;
  private setupWarmingStrategies;
  private executeWarmingStrategy;
  private generateCachePredictions;
  private startMaintenanceProcesses;
  private cleanupExpiredEntries;
  private performMaintenance;
  private monitorPerformance;
}
//# sourceMappingURL=MultiLayerCacheManager.d.ts.map
