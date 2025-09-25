import { CachedSearchService } from '../search/CachedSearchService';
import { CacheService } from '../CacheService';
export interface WarmingStrategy {
  name: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  estimatedTime: number;
  estimatedBenefit: number;
  enabled: boolean;
}
export interface WarmingConfig {
  strategies: WarmingStrategy[];
  maxConcurrency: number;
  batchSize: number;
  timeWindow: number;
  cooldownPeriod: number;
  adaptiveMode: boolean;
  performanceThresholds: {
    maxWarmingTime: number;
    minHitRateImprovement: number;
    maxResourceUsage: number;
  };
}
export interface WarmingResult {
  strategy: string;
  warmed: number;
  failed: number;
  timeTaken: number;
  hitRateImprovement: number;
  estimatedTimeSaved: number;
  resourcesUsed: {
    memory: number;
    cpu: number;
    storage: number;
  };
}
export interface WarmingSchedule {
  strategy: string;
  schedule: string;
  lastRun: Date;
  nextRun: Date;
  enabled: boolean;
  adaptivePriority: number;
}
export interface UserContext {
  userId: string;
  role: string;
  preferences: Record<string, any>;
  recentQueries: string[];
  sessionData: Record<string, any>;
}
export declare class CacheWarmer {
  private searchService;
  private cacheService;
  private config;
  private warmingSchedules;
  private warmingResults;
  private isWarming;
  private warmingQueue;
  private usagePatterns;
  private performanceHistory;
  constructor(
    searchService: CachedSearchService,
    cacheService: CacheService,
    config?: Partial<WarmingConfig>
  );
  startScheduledWarming(): Promise<void>;
  warmCache(strategy: string, userContext?: UserContext): Promise<WarmingResult>;
  adaptiveWarming(performanceMetrics: {
    hitRate: number;
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
  }): Promise<WarmingResult[]>;
  warmForUser(userContext: UserContext): Promise<WarmingResult>;
  predictiveWarming(timeWindow?: number): Promise<WarmingResult>;
  getWarmingStats(): {
    totalWarmed: number;
    avgHitRateImprovement: number;
    avgTimeSaved: number;
    successRate: number;
    topStrategies: Array<{
      strategy: string;
      effectiveness: number;
    }>;
    recommendations: string[];
  };
  stopScheduledWarming(): Promise<void>;
  private mergeConfig;
  private initializeStrategies;
  private getDefaultSchedule;
  private calculateNextRun;
  private calculateAdaptivePriority;
  private scheduleWarming;
  private warmPopularQueries;
  private warmRecentActivity;
  private warmPredictiveUser;
  private warmCategoryBased;
  private warmTimeBased;
  private warmMachineLearning;
  private selectOptimalStrategies;
  private recordPerformanceImprovement;
  private extractRecentPatterns;
  private generateUserPredictions;
  private getTimeBasedQueries;
  private generateQueryPredictions;
  private generateMLPredictions;
  private generateWarmingRecommendations;
}
export default CacheWarmer;
//# sourceMappingURL=CacheWarmer.d.ts.map
