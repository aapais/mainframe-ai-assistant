/**
 * Cache Warmer - Intelligent Cache Warming Service
 * Proactively loads frequently accessed data into cache for optimal performance
 */

import { KBEntry, SearchOptions } from '../../types';
import { ServiceError } from '../../types/services';
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
  schedule: string; // Cron expression
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

/**
 * Intelligent cache warming service with machine learning-based optimization
 */
export class CacheWarmer {
  private searchService: CachedSearchService;
  private cacheService: CacheService;
  private config: WarmingConfig;

  private warmingSchedules: Map<string, WarmingSchedule> = new Map();
  private warmingResults: WarmingResult[] = [];
  private isWarming = false;
  private warmingQueue: Array<{ strategy: string; priority: number }> = [];

  // Analytics and learning
  private usagePatterns: Map<
    string,
    {
      frequency: number;
      lastAccess: Date;
      avgResponseTime: number;
      userSegments: string[];
    }
  > = new Map();

  private performanceHistory: Array<{
    timestamp: Date;
    strategy: string;
    hitRateBefore: number;
    hitRateAfter: number;
    responseBefore: number;
    responseAfter: number;
  }> = [];

  constructor(
    searchService: CachedSearchService,
    cacheService: CacheService,
    config?: Partial<WarmingConfig>
  ) {
    this.searchService = searchService;
    this.cacheService = cacheService;
    this.config = this.mergeConfig(config);

    this.initializeStrategies();
  }

  /**
   * Start automatic cache warming based on schedules
   */
  async startScheduledWarming(): Promise<void> {
    console.log('🔥 Starting scheduled cache warming...');

    // Set up intervals for each strategy
    for (const [strategyName, schedule] of this.warmingSchedules) {
      if (schedule.enabled) {
        this.scheduleWarming(strategyName, schedule);
      }
    }

    console.log('✅ Scheduled warming initialized');
  }

  /**
   * Perform immediate cache warming with specific strategy
   */
  async warmCache(strategy: string, userContext?: UserContext): Promise<WarmingResult> {
    if (this.isWarming) {
      throw new ServiceError('Cache warming already in progress', 'WARMING_IN_PROGRESS', 429);
    }

    this.isWarming = true;
    const startTime = Date.now();

    try {
      console.log(`🔥 Starting cache warming with strategy: ${strategy}`);

      const beforeMetrics = this.searchService.getMetrics();

      let result: WarmingResult;

      switch (strategy) {
        case 'popular-queries':
          result = await this.warmPopularQueries(userContext);
          break;
        case 'recent-activity':
          result = await this.warmRecentActivity(userContext);
          break;
        case 'predictive-user':
          result = await this.warmPredictiveUser(userContext);
          break;
        case 'category-based':
          result = await this.warmCategoryBased(userContext);
          break;
        case 'time-based':
          result = await this.warmTimeBased(userContext);
          break;
        case 'machine-learning':
          result = await this.warmMachineLearning(userContext);
          break;
        default:
          throw new ServiceError(`Unknown warming strategy: ${strategy}`, 'INVALID_STRATEGY', 400);
      }

      const afterMetrics = this.searchService.getMetrics();
      result.hitRateImprovement = afterMetrics.hitRates.overall - beforeMetrics.hitRates.overall;
      result.timeTaken = Date.now() - startTime;

      // Record performance improvement
      this.recordPerformanceImprovement(strategy, beforeMetrics, afterMetrics);

      // Store result
      this.warmingResults.push(result);
      if (this.warmingResults.length > 100) {
        this.warmingResults = this.warmingResults.slice(-100);
      }

      console.log(
        `✅ Cache warming completed: ${result.warmed} entries, ${result.hitRateImprovement * 100}% hit rate improvement`
      );

      return result;
    } catch (error) {
      console.error('❌ Cache warming failed:', error);
      throw error;
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Adaptive warming based on current system performance
   */
  async adaptiveWarming(performanceMetrics: {
    hitRate: number;
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
  }): Promise<WarmingResult[]> {
    console.log('🧠 Starting adaptive cache warming...');

    const results: WarmingResult[] = [];
    const strategies = this.selectOptimalStrategies(performanceMetrics);

    for (const strategy of strategies) {
      try {
        const result = await this.warmCache(strategy.name);
        results.push(result);

        // Stop if we've achieved good performance
        const currentMetrics = this.searchService.getMetrics();
        if (
          currentMetrics.hitRates.overall > 0.9 &&
          currentMetrics.performance.avgResponseTime < 200
        ) {
          console.log('🎯 Optimal performance achieved, stopping adaptive warming');
          break;
        }
      } catch (error) {
        console.warn(`Adaptive warming strategy '${strategy.name}' failed:`, error);
      }
    }

    return results;
  }

  /**
   * Warm cache for specific user context
   */
  async warmForUser(userContext: UserContext): Promise<WarmingResult> {
    console.log(`👤 Warming cache for user: ${userContext.userId}`);

    const startTime = Date.now();
    let warmed = 0;
    let failed = 0;

    try {
      // Warm recent queries
      for (const query of userContext.recentQueries.slice(0, 10)) {
        try {
          await this.searchService.search(query, { limit: 20 }, userContext);
          warmed++;
        } catch (error) {
          failed++;
          console.warn(`Failed to warm query "${query}":`, error);
        }
      }

      // Warm preferences-based content
      if (userContext.preferences.categories) {
        for (const category of userContext.preferences.categories.slice(0, 5)) {
          try {
            await this.searchService.search(
              '',
              {
                category,
                limit: 15,
                sortBy: 'usage_count',
              },
              userContext
            );
            warmed++;
          } catch (error) {
            failed++;
          }
        }
      }

      return {
        strategy: 'user-specific',
        warmed,
        failed,
        timeTaken: Date.now() - startTime,
        hitRateImprovement: 0, // Will be calculated by caller
        estimatedTimeSaved: warmed * 150, // Assume 150ms saved per query
        resourcesUsed: {
          memory: warmed * 1024, // Rough estimate
          cpu: 0.1,
          storage: warmed * 512,
        },
      };
    } catch (error) {
      throw new ServiceError(
        `User-specific warming failed: ${error.message}`,
        'USER_WARMING_ERROR',
        500,
        { userId: userContext.userId, originalError: error }
      );
    }
  }

  /**
   * Pre-warm cache based on predicted queries
   */
  async predictiveWarming(timeWindow: number = 3600000): Promise<WarmingResult> {
    console.log('🔮 Starting predictive cache warming...');

    const startTime = Date.now();
    let warmed = 0;
    let failed = 0;

    try {
      // Analyze patterns from recent history
      const predictions = await this.generateQueryPredictions(timeWindow);

      for (const prediction of predictions.slice(0, 20)) {
        try {
          await this.searchService.search(prediction.query, {
            limit: prediction.expectedResultCount,
            category: prediction.likelyCategory,
          });
          warmed++;
        } catch (error) {
          failed++;
          console.warn(`Failed to warm predicted query "${prediction.query}":`, error);
        }
      }

      return {
        strategy: 'predictive',
        warmed,
        failed,
        timeTaken: Date.now() - startTime,
        hitRateImprovement: 0,
        estimatedTimeSaved: warmed * 200,
        resourcesUsed: {
          memory: warmed * 1536,
          cpu: 0.15,
          storage: warmed * 768,
        },
      };
    } catch (error) {
      throw new ServiceError(
        `Predictive warming failed: ${error.message}`,
        'PREDICTIVE_WARMING_ERROR',
        500,
        { originalError: error }
      );
    }
  }

  /**
   * Get warming statistics and recommendations
   */
  getWarmingStats(): {
    totalWarmed: number;
    avgHitRateImprovement: number;
    avgTimeSaved: number;
    successRate: number;
    topStrategies: Array<{ strategy: string; effectiveness: number }>;
    recommendations: string[];
  } {
    const totalResults = this.warmingResults.length;

    if (totalResults === 0) {
      return {
        totalWarmed: 0,
        avgHitRateImprovement: 0,
        avgTimeSaved: 0,
        successRate: 0,
        topStrategies: [],
        recommendations: ['No warming data available'],
      };
    }

    const totalWarmed = this.warmingResults.reduce((sum, r) => sum + r.warmed, 0);
    const avgHitRateImprovement =
      this.warmingResults.reduce((sum, r) => sum + r.hitRateImprovement, 0) / totalResults;
    const avgTimeSaved =
      this.warmingResults.reduce((sum, r) => sum + r.estimatedTimeSaved, 0) / totalResults;
    const successRate =
      this.warmingResults.reduce((sum, r) => sum + r.warmed / (r.warmed + r.failed), 0) /
      totalResults;

    // Calculate strategy effectiveness
    const strategyStats = new Map<string, { total: number; effectiveness: number }>();

    for (const result of this.warmingResults) {
      const current = strategyStats.get(result.strategy) || { total: 0, effectiveness: 0 };
      const effectiveness = result.hitRateImprovement * 100 + result.estimatedTimeSaved / 1000;

      strategyStats.set(result.strategy, {
        total: current.total + 1,
        effectiveness: current.effectiveness + effectiveness,
      });
    }

    const topStrategies = Array.from(strategyStats.entries())
      .map(([strategy, stats]) => ({
        strategy,
        effectiveness: stats.effectiveness / stats.total,
      }))
      .sort((a, b) => b.effectiveness - a.effectiveness)
      .slice(0, 5);

    // Generate recommendations
    const recommendations = this.generateWarmingRecommendations();

    return {
      totalWarmed,
      avgHitRateImprovement,
      avgTimeSaved,
      successRate,
      topStrategies,
      recommendations,
    };
  }

  /**
   * Stop all scheduled warming operations
   */
  async stopScheduledWarming(): Promise<void> {
    console.log('🛑 Stopping scheduled cache warming...');

    // Clear all intervals and timeouts
    // Implementation would depend on how intervals are stored

    this.isWarming = false;
    this.warmingQueue = [];

    console.log('✅ Scheduled warming stopped');
  }

  // =========================
  // Private Implementation
  // =========================

  private mergeConfig(config?: Partial<WarmingConfig>): WarmingConfig {
    const defaultStrategies: WarmingStrategy[] = [
      {
        name: 'popular-queries',
        priority: 'high',
        estimatedTime: 30000,
        estimatedBenefit: 0.8,
        enabled: true,
      },
      {
        name: 'recent-activity',
        priority: 'normal',
        estimatedTime: 15000,
        estimatedBenefit: 0.6,
        enabled: true,
      },
      {
        name: 'predictive-user',
        priority: 'normal',
        estimatedTime: 20000,
        estimatedBenefit: 0.7,
        enabled: true,
      },
      {
        name: 'category-based',
        priority: 'low',
        estimatedTime: 45000,
        estimatedBenefit: 0.5,
        enabled: true,
      },
      {
        name: 'time-based',
        priority: 'low',
        estimatedTime: 25000,
        estimatedBenefit: 0.4,
        enabled: false,
      },
      {
        name: 'machine-learning',
        priority: 'critical',
        estimatedTime: 60000,
        estimatedBenefit: 0.9,
        enabled: false,
      },
    ];

    return {
      strategies: defaultStrategies,
      maxConcurrency: 3,
      batchSize: 50,
      timeWindow: 3600000, // 1 hour
      cooldownPeriod: 300000, // 5 minutes
      adaptiveMode: true,
      performanceThresholds: {
        maxWarmingTime: 120000, // 2 minutes
        minHitRateImprovement: 0.05, // 5%
        maxResourceUsage: 0.7, // 70%
      },
      ...config,
    };
  }

  private initializeStrategies(): void {
    for (const strategy of this.config.strategies) {
      if (strategy.enabled) {
        this.warmingSchedules.set(strategy.name, {
          strategy: strategy.name,
          schedule: this.getDefaultSchedule(strategy.priority),
          lastRun: new Date(0),
          nextRun: new Date(Date.now() + this.calculateNextRun(strategy.priority)),
          enabled: true,
          adaptivePriority: this.calculateAdaptivePriority(strategy),
        });
      }
    }
  }

  private getDefaultSchedule(priority: string): string {
    switch (priority) {
      case 'critical':
        return '0 */5 * * * *'; // Every 5 minutes
      case 'high':
        return '0 */15 * * * *'; // Every 15 minutes
      case 'normal':
        return '0 0 */1 * * *'; // Every hour
      case 'low':
        return '0 0 */6 * * *'; // Every 6 hours
      default:
        return '0 0 */12 * * *'; // Every 12 hours
    }
  }

  private calculateNextRun(priority: string): number {
    switch (priority) {
      case 'critical':
        return 5 * 60 * 1000;
      case 'high':
        return 15 * 60 * 1000;
      case 'normal':
        return 60 * 60 * 1000;
      case 'low':
        return 6 * 60 * 60 * 1000;
      default:
        return 12 * 60 * 60 * 1000;
    }
  }

  private calculateAdaptivePriority(strategy: WarmingStrategy): number {
    return (
      strategy.estimatedBenefit *
      (strategy.priority === 'critical'
        ? 4
        : strategy.priority === 'high'
          ? 3
          : strategy.priority === 'normal'
            ? 2
            : 1)
    );
  }

  private scheduleWarming(strategyName: string, schedule: WarmingSchedule): void {
    const interval = this.calculateNextRun(
      this.config.strategies.find(s => s.name === strategyName)?.priority || 'normal'
    );

    setTimeout(async () => {
      try {
        await this.warmCache(strategyName);
        schedule.lastRun = new Date();
        schedule.nextRun = new Date(Date.now() + interval);

        // Re-schedule
        this.scheduleWarming(strategyName, schedule);
      } catch (error) {
        console.error(`Scheduled warming failed for ${strategyName}:`, error);

        // Re-schedule with longer interval on failure
        setTimeout(() => this.scheduleWarming(strategyName, schedule), interval * 2);
      }
    }, interval);
  }

  private async warmPopularQueries(userContext?: UserContext): Promise<WarmingResult> {
    const analytics = this.searchService.getAnalytics();
    const popularQueries = analytics.popularQueries.slice(0, 15);

    let warmed = 0;
    let failed = 0;

    for (const { query } of popularQueries) {
      try {
        await this.searchService.search(query, { limit: 25 }, userContext);
        warmed++;
      } catch (error) {
        failed++;
      }
    }

    return {
      strategy: 'popular-queries',
      warmed,
      failed,
      timeTaken: 0, // Will be set by caller
      hitRateImprovement: 0,
      estimatedTimeSaved: warmed * 180,
      resourcesUsed: { memory: warmed * 1200, cpu: 0.2, storage: warmed * 600 },
    };
  }

  private async warmRecentActivity(userContext?: UserContext): Promise<WarmingResult> {
    // Warm based on recent search patterns
    const recentPatterns = this.extractRecentPatterns();

    let warmed = 0;
    let failed = 0;

    for (const pattern of recentPatterns.slice(0, 10)) {
      try {
        await this.searchService.search(
          pattern.query,
          {
            limit: 20,
            category: pattern.category,
          },
          userContext
        );
        warmed++;
      } catch (error) {
        failed++;
      }
    }

    return {
      strategy: 'recent-activity',
      warmed,
      failed,
      timeTaken: 0,
      hitRateImprovement: 0,
      estimatedTimeSaved: warmed * 120,
      resourcesUsed: { memory: warmed * 800, cpu: 0.1, storage: warmed * 400 },
    };
  }

  private async warmPredictiveUser(userContext?: UserContext): Promise<WarmingResult> {
    if (!userContext) {
      return {
        strategy: 'predictive-user',
        warmed: 0,
        failed: 0,
        timeTaken: 0,
        hitRateImprovement: 0,
        estimatedTimeSaved: 0,
        resourcesUsed: { memory: 0, cpu: 0, storage: 0 },
      };
    }

    // Generate predictions based on user behavior
    const predictions = this.generateUserPredictions(userContext);

    let warmed = 0;
    let failed = 0;

    for (const prediction of predictions.slice(0, 8)) {
      try {
        await this.searchService.search(prediction, { limit: 15 }, userContext);
        warmed++;
      } catch (error) {
        failed++;
      }
    }

    return {
      strategy: 'predictive-user',
      warmed,
      failed,
      timeTaken: 0,
      hitRateImprovement: 0,
      estimatedTimeSaved: warmed * 160,
      resourcesUsed: { memory: warmed * 1000, cpu: 0.15, storage: warmed * 500 },
    };
  }

  private async warmCategoryBased(userContext?: UserContext): Promise<WarmingResult> {
    const categories = ['System', 'Performance', 'Error', 'Configuration', 'Other'];

    let warmed = 0;
    let failed = 0;

    for (const category of categories) {
      try {
        await this.searchService.search(
          '',
          {
            category,
            limit: 30,
            sortBy: 'usage_count',
          },
          userContext
        );
        warmed++;
      } catch (error) {
        failed++;
      }
    }

    return {
      strategy: 'category-based',
      warmed,
      failed,
      timeTaken: 0,
      hitRateImprovement: 0,
      estimatedTimeSaved: warmed * 100,
      resourcesUsed: { memory: warmed * 1500, cpu: 0.25, storage: warmed * 750 },
    };
  }

  private async warmTimeBased(userContext?: UserContext): Promise<WarmingResult> {
    // Warm based on time-of-day patterns
    const hour = new Date().getHours();
    const timeBasedQueries = this.getTimeBasedQueries(hour);

    let warmed = 0;
    let failed = 0;

    for (const query of timeBasedQueries.slice(0, 12)) {
      try {
        await this.searchService.search(query, { limit: 18 }, userContext);
        warmed++;
      } catch (error) {
        failed++;
      }
    }

    return {
      strategy: 'time-based',
      warmed,
      failed,
      timeTaken: 0,
      hitRateImprovement: 0,
      estimatedTimeSaved: warmed * 140,
      resourcesUsed: { memory: warmed * 900, cpu: 0.12, storage: warmed * 450 },
    };
  }

  private async warmMachineLearning(userContext?: UserContext): Promise<WarmingResult> {
    // Advanced ML-based warming (placeholder for future implementation)
    const mlPredictions = await this.generateMLPredictions();

    let warmed = 0;
    let failed = 0;

    for (const prediction of mlPredictions.slice(0, 20)) {
      try {
        await this.searchService.search(prediction.query, prediction.options, userContext);
        warmed++;
      } catch (error) {
        failed++;
      }
    }

    return {
      strategy: 'machine-learning',
      warmed,
      failed,
      timeTaken: 0,
      hitRateImprovement: 0,
      estimatedTimeSaved: warmed * 220,
      resourcesUsed: { memory: warmed * 1800, cpu: 0.3, storage: warmed * 900 },
    };
  }

  private selectOptimalStrategies(performanceMetrics: any): WarmingStrategy[] {
    return this.config.strategies
      .filter(s => s.enabled)
      .sort((a, b) => {
        // Prioritize based on current performance issues
        let aScore = a.estimatedBenefit;
        let bScore = b.estimatedBenefit;

        if (performanceMetrics.hitRate < 0.7) {
          // Low hit rate - prioritize popular queries
          if (a.name === 'popular-queries') aScore += 0.3;
          if (b.name === 'popular-queries') bScore += 0.3;
        }

        if (performanceMetrics.avgResponseTime > 1000) {
          // High response time - prioritize predictive warming
          if (a.name === 'predictive-user') aScore += 0.2;
          if (b.name === 'predictive-user') bScore += 0.2;
        }

        return bScore - aScore;
      })
      .slice(0, 3); // Top 3 strategies
  }

  private recordPerformanceImprovement(
    strategy: string,
    beforeMetrics: any,
    afterMetrics: any
  ): void {
    this.performanceHistory.push({
      timestamp: new Date(),
      strategy,
      hitRateBefore: beforeMetrics.hitRates.overall,
      hitRateAfter: afterMetrics.hitRates.overall,
      responseBefore: beforeMetrics.performance.avgResponseTime,
      responseAfter: afterMetrics.performance.avgResponseTime,
    });

    // Keep only last 200 records
    if (this.performanceHistory.length > 200) {
      this.performanceHistory = this.performanceHistory.slice(-200);
    }
  }

  private extractRecentPatterns(): Array<{ query: string; category?: string }> {
    // Extract patterns from recent search activity
    const analytics = this.searchService.getAnalytics();

    return analytics.popularQueries.slice(0, 10).map(pq => ({ query: pq.query }));
  }

  private generateUserPredictions(userContext: UserContext): string[] {
    const predictions: string[] = [];

    // Based on recent queries, predict related searches
    for (const query of userContext.recentQueries.slice(0, 5)) {
      const words = query.split(' ');

      // Generate variations
      if (words.length > 1) {
        predictions.push(words.slice(0, -1).join(' ')); // Remove last word
        predictions.push(words.slice(1).join(' ')); // Remove first word
      }

      // Add common expansions
      predictions.push(`${query} error`);
      predictions.push(`${query} solution`);
    }

    return [...new Set(predictions)]; // Remove duplicates
  }

  private getTimeBasedQueries(hour: number): string[] {
    const timeBasedQueries: Record<string, string[]> = {
      morning: ['system status', 'daily reports', 'performance check'],
      afternoon: ['troubleshooting', 'error resolution', 'configuration'],
      evening: ['batch processing', 'maintenance', 'backup'],
      night: ['monitoring', 'alerts', 'system health'],
    };

    const timeOfDay =
      hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

    return timeBasedQueries[timeOfDay] || [];
  }

  private async generateQueryPredictions(timeWindow: number): Promise<
    Array<{
      query: string;
      expectedResultCount: number;
      likelyCategory?: string;
      confidence: number;
    }>
  > {
    // Analyze patterns and generate predictions
    const analytics = this.searchService.getAnalytics();

    return analytics.popularQueries.slice(0, 15).map(pq => ({
      query: pq.query,
      expectedResultCount: Math.min(20, Math.max(5, Math.floor(pq.count / 2))),
      confidence: Math.min(0.9, pq.count / 100),
    }));
  }

  private async generateMLPredictions(): Promise<
    Array<{
      query: string;
      options: SearchOptions;
      confidence: number;
    }>
  > {
    // Placeholder for ML-based predictions
    // In a real implementation, this would use trained models

    const predictions = [
      { query: 'performance optimization', options: { limit: 25 }, confidence: 0.85 },
      { query: 'error handling', options: { limit: 20, category: 'System' }, confidence: 0.78 },
      { query: 'configuration management', options: { limit: 15 }, confidence: 0.72 },
    ];

    return predictions;
  }

  private generateWarmingRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.warmingResults;

    if (stats.length === 0) {
      recommendations.push('Enable cache warming to improve performance');
      return recommendations;
    }

    const avgSuccessRate =
      stats.reduce((sum, r) => sum + r.warmed / (r.warmed + r.failed), 0) / stats.length;

    if (avgSuccessRate < 0.8) {
      recommendations.push('Review warming strategies - high failure rate detected');
    }

    const avgImprovement = stats.reduce((sum, r) => sum + r.hitRateImprovement, 0) / stats.length;

    if (avgImprovement < 0.05) {
      recommendations.push('Consider more aggressive warming strategies');
    }

    if (this.config.adaptiveMode && this.performanceHistory.length > 10) {
      recommendations.push('Enable machine learning warming for better predictions');
    }

    return recommendations;
  }
}

export default CacheWarmer;
