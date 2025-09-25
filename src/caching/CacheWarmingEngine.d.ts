import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { MultiLayerCacheManager } from './MultiLayerCacheManager';
export interface WarmingPrediction {
  query: string;
  probability: number;
  expectedTime: Date;
  userContext?: string;
  category?: string;
  mvpLevel: number;
  priority: number;
}
export interface WarmingStats {
  totalWarmed: number;
  successfulPredictions: number;
  accuracy: number;
  timesSaved: number;
  avgTimeSaved: number;
  topPatterns: Array<{
    pattern: string;
    frequency: number;
    avgTimeSaved: number;
  }>;
}
export interface UserPattern {
  userId: string;
  commonQueries: string[];
  preferredCategories: string[];
  activeHours: number[];
  searchVelocity: number;
  lastSeen: Date;
}
export declare class CacheWarmingEngine extends EventEmitter {
  private db;
  private cacheManager;
  private mvpLevel;
  private userPatterns;
  private queryPatterns;
  private timeBasedPatterns;
  private stats;
  private config;
  constructor(
    database: Database.Database,
    cacheManager: MultiLayerCacheManager,
    mvpLevel: 1 | 2 | 3 | 4 | 5
  );
  generatePredictions(userContext?: string): Promise<WarmingPrediction[]>;
  executeWarming(predictions?: WarmingPrediction[]): Promise<WarmingStats>;
  learnFromInteraction(
    userId: string,
    query: string,
    category: string,
    responseTime: number,
    timestamp?: Date
  ): Promise<void>;
  getStats(): WarmingStats;
  getRecommendations(): string[];
  private generateTimeBasedPredictions;
  private generateUserPredictions;
  private generatePatternPredictions;
  private generateMVPSpecificPredictions;
  private generateSeasonalPredictions;
  private warmPrediction;
  private updateUserPattern;
  private updateQueryPattern;
  private updateTimePattern;
  private getTrendingQueries;
  private extractCategory;
  private generateMockData;
  private recordSuccessfulPrediction;
  private recordInteraction;
  private getTopPatterns;
  private initializePatternTables;
  private loadHistoricalPatterns;
  private startWarmingProcesses;
  private optimizePatterns;
}
//# sourceMappingURL=CacheWarmingEngine.d.ts.map
