'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.CacheWarmer = void 0;
const services_1 = require('../../types/services');
class CacheWarmer {
  searchService;
  cacheService;
  config;
  warmingSchedules = new Map();
  warmingResults = [];
  isWarming = false;
  warmingQueue = [];
  usagePatterns = new Map();
  performanceHistory = [];
  constructor(searchService, cacheService, config) {
    this.searchService = searchService;
    this.cacheService = cacheService;
    this.config = this.mergeConfig(config);
    this.initializeStrategies();
  }
  async startScheduledWarming() {
    console.log('🔥 Starting scheduled cache warming...');
    for (const [strategyName, schedule] of this.warmingSchedules) {
      if (schedule.enabled) {
        this.scheduleWarming(strategyName, schedule);
      }
    }
    console.log('✅ Scheduled warming initialized');
  }
  async warmCache(strategy, userContext) {
    if (this.isWarming) {
      throw new services_1.ServiceError(
        'Cache warming already in progress',
        'WARMING_IN_PROGRESS',
        429
      );
    }
    this.isWarming = true;
    const startTime = Date.now();
    try {
      console.log(`🔥 Starting cache warming with strategy: ${strategy}`);
      const beforeMetrics = this.searchService.getMetrics();
      let result;
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
          throw new services_1.ServiceError(
            `Unknown warming strategy: ${strategy}`,
            'INVALID_STRATEGY',
            400
          );
      }
      const afterMetrics = this.searchService.getMetrics();
      result.hitRateImprovement = afterMetrics.hitRates.overall - beforeMetrics.hitRates.overall;
      result.timeTaken = Date.now() - startTime;
      this.recordPerformanceImprovement(strategy, beforeMetrics, afterMetrics);
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
  async adaptiveWarming(performanceMetrics) {
    console.log('🧠 Starting adaptive cache warming...');
    const results = [];
    const strategies = this.selectOptimalStrategies(performanceMetrics);
    for (const strategy of strategies) {
      try {
        const result = await this.warmCache(strategy.name);
        results.push(result);
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
  async warmForUser(userContext) {
    console.log(`👤 Warming cache for user: ${userContext.userId}`);
    const startTime = Date.now();
    let warmed = 0;
    let failed = 0;
    try {
      for (const query of userContext.recentQueries.slice(0, 10)) {
        try {
          await this.searchService.search(query, { limit: 20 }, userContext);
          warmed++;
        } catch (error) {
          failed++;
          console.warn(`Failed to warm query "${query}":`, error);
        }
      }
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
        hitRateImprovement: 0,
        estimatedTimeSaved: warmed * 150,
        resourcesUsed: {
          memory: warmed * 1024,
          cpu: 0.1,
          storage: warmed * 512,
        },
      };
    } catch (error) {
      throw new services_1.ServiceError(
        `User-specific warming failed: ${error.message}`,
        'USER_WARMING_ERROR',
        500,
        { userId: userContext.userId, originalError: error }
      );
    }
  }
  async predictiveWarming(timeWindow = 3600000) {
    console.log('🔮 Starting predictive cache warming...');
    const startTime = Date.now();
    let warmed = 0;
    let failed = 0;
    try {
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
      throw new services_1.ServiceError(
        `Predictive warming failed: ${error.message}`,
        'PREDICTIVE_WARMING_ERROR',
        500,
        { originalError: error }
      );
    }
  }
  getWarmingStats() {
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
    const strategyStats = new Map();
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
  async stopScheduledWarming() {
    console.log('🛑 Stopping scheduled cache warming...');
    this.isWarming = false;
    this.warmingQueue = [];
    console.log('✅ Scheduled warming stopped');
  }
  mergeConfig(config) {
    const defaultStrategies = [
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
      timeWindow: 3600000,
      cooldownPeriod: 300000,
      adaptiveMode: true,
      performanceThresholds: {
        maxWarmingTime: 120000,
        minHitRateImprovement: 0.05,
        maxResourceUsage: 0.7,
      },
      ...config,
    };
  }
  initializeStrategies() {
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
  getDefaultSchedule(priority) {
    switch (priority) {
      case 'critical':
        return '0 */5 * * * *';
      case 'high':
        return '0 */15 * * * *';
      case 'normal':
        return '0 0 */1 * * *';
      case 'low':
        return '0 0 */6 * * *';
      default:
        return '0 0 */12 * * *';
    }
  }
  calculateNextRun(priority) {
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
  calculateAdaptivePriority(strategy) {
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
  scheduleWarming(strategyName, schedule) {
    const interval = this.calculateNextRun(
      this.config.strategies.find(s => s.name === strategyName)?.priority || 'normal'
    );
    setTimeout(async () => {
      try {
        await this.warmCache(strategyName);
        schedule.lastRun = new Date();
        schedule.nextRun = new Date(Date.now() + interval);
        this.scheduleWarming(strategyName, schedule);
      } catch (error) {
        console.error(`Scheduled warming failed for ${strategyName}:`, error);
        setTimeout(() => this.scheduleWarming(strategyName, schedule), interval * 2);
      }
    }, interval);
  }
  async warmPopularQueries(userContext) {
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
      timeTaken: 0,
      hitRateImprovement: 0,
      estimatedTimeSaved: warmed * 180,
      resourcesUsed: { memory: warmed * 1200, cpu: 0.2, storage: warmed * 600 },
    };
  }
  async warmRecentActivity(userContext) {
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
  async warmPredictiveUser(userContext) {
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
  async warmCategoryBased(userContext) {
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
  async warmTimeBased(userContext) {
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
  async warmMachineLearning(userContext) {
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
  selectOptimalStrategies(performanceMetrics) {
    return this.config.strategies
      .filter(s => s.enabled)
      .sort((a, b) => {
        let aScore = a.estimatedBenefit;
        let bScore = b.estimatedBenefit;
        if (performanceMetrics.hitRate < 0.7) {
          if (a.name === 'popular-queries') aScore += 0.3;
          if (b.name === 'popular-queries') bScore += 0.3;
        }
        if (performanceMetrics.avgResponseTime > 1000) {
          if (a.name === 'predictive-user') aScore += 0.2;
          if (b.name === 'predictive-user') bScore += 0.2;
        }
        return bScore - aScore;
      })
      .slice(0, 3);
  }
  recordPerformanceImprovement(strategy, beforeMetrics, afterMetrics) {
    this.performanceHistory.push({
      timestamp: new Date(),
      strategy,
      hitRateBefore: beforeMetrics.hitRates.overall,
      hitRateAfter: afterMetrics.hitRates.overall,
      responseBefore: beforeMetrics.performance.avgResponseTime,
      responseAfter: afterMetrics.performance.avgResponseTime,
    });
    if (this.performanceHistory.length > 200) {
      this.performanceHistory = this.performanceHistory.slice(-200);
    }
  }
  extractRecentPatterns() {
    const analytics = this.searchService.getAnalytics();
    return analytics.popularQueries.slice(0, 10).map(pq => ({ query: pq.query }));
  }
  generateUserPredictions(userContext) {
    const predictions = [];
    for (const query of userContext.recentQueries.slice(0, 5)) {
      const words = query.split(' ');
      if (words.length > 1) {
        predictions.push(words.slice(0, -1).join(' '));
        predictions.push(words.slice(1).join(' '));
      }
      predictions.push(`${query} error`);
      predictions.push(`${query} solution`);
    }
    return [...new Set(predictions)];
  }
  getTimeBasedQueries(hour) {
    const timeBasedQueries = {
      morning: ['system status', 'daily reports', 'performance check'],
      afternoon: ['troubleshooting', 'error resolution', 'configuration'],
      evening: ['batch processing', 'maintenance', 'backup'],
      night: ['monitoring', 'alerts', 'system health'],
    };
    const timeOfDay =
      hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    return timeBasedQueries[timeOfDay] || [];
  }
  async generateQueryPredictions(timeWindow) {
    const analytics = this.searchService.getAnalytics();
    return analytics.popularQueries.slice(0, 15).map(pq => ({
      query: pq.query,
      expectedResultCount: Math.min(20, Math.max(5, Math.floor(pq.count / 2))),
      confidence: Math.min(0.9, pq.count / 100),
    }));
  }
  async generateMLPredictions() {
    const predictions = [
      { query: 'performance optimization', options: { limit: 25 }, confidence: 0.85 },
      { query: 'error handling', options: { limit: 20, category: 'System' }, confidence: 0.78 },
      { query: 'configuration management', options: { limit: 15 }, confidence: 0.72 },
    ];
    return predictions;
  }
  generateWarmingRecommendations() {
    const recommendations = [];
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
exports.CacheWarmer = CacheWarmer;
exports.default = CacheWarmer;
//# sourceMappingURL=CacheWarmer.js.map
