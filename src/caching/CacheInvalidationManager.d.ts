import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { MultiLayerCacheManager } from './MultiLayerCacheManager';
export interface InvalidationRule {
  id: string;
  name: string;
  trigger: 'data_change' | 'time_based' | 'manual' | 'dependency' | 'pattern_match';
  pattern?: string;
  tags?: string[];
  dependencies?: string[];
  cascade: boolean;
  priority: number;
  enabled: boolean;
  conditions?: InvalidationCondition[];
}
export interface InvalidationCondition {
  type: 'table_change' | 'time_elapsed' | 'access_count' | 'data_size' | 'custom';
  target: string;
  operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'matches';
  value: any;
}
export interface InvalidationEvent {
  id: string;
  timestamp: Date;
  trigger: string;
  affectedKeys: string[];
  affectedTags: string[];
  cascadeLevel: number;
  success: boolean;
  error?: string;
}
export interface InvalidationStats {
  totalInvalidations: number;
  successfulInvalidations: number;
  cascadeInvalidations: number;
  avgInvalidationTime: number;
  topTriggers: Array<{
    trigger: string;
    count: number;
    avgKeysAffected: number;
  }>;
  effectiveness: number;
}
export declare class CacheInvalidationManager extends EventEmitter {
  private db;
  private cacheManager;
  private rules;
  private dependencies;
  private events;
  private stats;
  private config;
  constructor(database: Database.Database, cacheManager: MultiLayerCacheManager);
  registerRule(rule: InvalidationRule): Promise<void>;
  onDataChange(
    table: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    affectedIds?: string[],
    changes?: Record<string, any>
  ): Promise<InvalidationEvent[]>;
  invalidate(
    pattern?: string,
    tags?: string[],
    cascade?: boolean,
    reason?: string
  ): Promise<InvalidationEvent>;
  adjustTTL(
    cacheKey: string,
    accessPattern: {
      accessCount: number;
      lastAccessed: Date;
      computationTime: number;
      hitRate: number;
    }
  ): Promise<number>;
  getStats(): InvalidationStats;
  getRecentEvents(limit?: number): InvalidationEvent[];
  getRecommendations(): string[];
  private findTriggeredRules;
  private evaluateRuleConditions;
  private evaluateCondition;
  private executeRule;
  private executeCascadeInvalidation;
  private findDependentRules;
  private setupDefaultRules;
  private setupDatabaseTriggers;
  private generateAffectedKeysFromPattern;
  private recordEvent;
  private updateStats;
  private updateTopTriggers;
  private generateEventId;
  private storeRule;
  private storeEvent;
  private initializeInvalidationTables;
  private startMaintenanceProcesses;
  private processPendingEvents;
  private calculateEffectiveness;
  private cleanupOldEvents;
}
//# sourceMappingURL=CacheInvalidationManager.d.ts.map
