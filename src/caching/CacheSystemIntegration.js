'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.MVPConfigurations = exports.CacheSystemIntegration = void 0;
exports.createCacheSystem = createCacheSystem;
const MultiLayerCacheManager_1 = require('./MultiLayerCacheManager');
const CacheWarmingEngine_1 = require('./CacheWarmingEngine');
const CacheInvalidationManager_1 = require('./CacheInvalidationManager');
const CachePerformanceMonitor_1 = require('./CachePerformanceMonitor');
class CacheSystemIntegration {
  database;
  cacheManager;
  warmingEngine;
  invalidationManager;
  performanceMonitor;
  config;
  initialized = false;
  constructor(database, config) {
    this.database = database;
    this.config = {
      enableDistributedCache: true,
      enablePredictiveWarming: true,
      enableSmartInvalidation: true,
      enablePerformanceMonitoring: true,
      ...config,
    };
    console.log(`🚀 Initializing integrated cache system for MVP${config.mvpLevel}...`);
  }
  async initialize() {
    try {
      this.cacheManager = new MultiLayerCacheManager_1.MultiLayerCacheManager(
        this.database,
        this.config.mvpLevel,
        {
          enableDistributedCache: this.config.enableDistributedCache && this.config.mvpLevel >= 5,
          enablePredictiveCaching: this.config.enablePredictiveWarming,
          hotCacheSize: this.getOptimalHotCacheSize(),
          warmCacheSize: this.getOptimalWarmCacheSize(),
          maxMemoryMB: this.getOptimalMemoryLimit(),
        }
      );
      this.warmingEngine = new CacheWarmingEngine_1.CacheWarmingEngine(
        this.database,
        this.cacheManager,
        this.config.mvpLevel
      );
      this.invalidationManager = new CacheInvalidationManager_1.CacheInvalidationManager(
        this.database,
        this.cacheManager
      );
      this.performanceMonitor = new CachePerformanceMonitor_1.CachePerformanceMonitor(
        this.database,
        this.cacheManager,
        this.warmingEngine,
        this.invalidationManager,
        this.config.mvpLevel
      );
      this.setupEventListeners();
      await this.initialCacheWarming();
      this.initialized = true;
      console.log(`✅ Cache system initialized successfully for MVP${this.config.mvpLevel}`);
    } catch (error) {
      console.error('❌ Failed to initialize cache system:', error);
      throw error;
    }
  }
  async get(key, computeFn, options) {
    this.ensureInitialized();
    const startTime = performance.now();
    const operationId = this.generateOperationId();
    try {
      if (options?.userContext) {
        await this.warmingEngine.learnFromInteraction(
          options.userContext,
          key,
          options.category || 'general',
          0,
          new Date()
        );
      }
      const result = await this.cacheManager.get(key, computeFn, {
        ttl: options?.ttl,
        priority: options?.priority,
        tags: options?.tags,
        userContext: options?.userContext,
      });
      const duration = performance.now() - startTime;
      this.performanceMonitor.recordOperation('cache-get', duration, duration < 10);
      if (options?.userContext) {
        await this.warmingEngine.learnFromInteraction(
          options.userContext,
          key,
          options.category || 'general',
          duration,
          new Date()
        );
      }
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.performanceMonitor.recordOperation('cache-get-error', duration, false);
      throw error;
    }
  }
  async searchKB(query, options) {
    const cacheKey = this.generateSearchCacheKey(query, options);
    return this.get(cacheKey, () => this.executeKBSearch(query, options), {
      ttl: this.getSearchTTL(query),
      priority: 'high',
      tags: ['search', 'kb-entries', options?.category || 'all'].filter(Boolean),
      userContext: options?.userContext,
      category: 'search',
    });
  }
  async analyzePatterns(timeWindow = '24h', options) {
    if (this.config.mvpLevel < 2) {
      throw new Error('Pattern analysis requires MVP2 or higher');
    }
    const cacheKey = `patterns:${timeWindow}:${(options?.components || []).join(',')}`;
    return this.get(cacheKey, () => this.executePatternAnalysis(timeWindow, options), {
      ttl: 15 * 60 * 1000,
      priority: 'normal',
      tags: ['patterns', 'analysis', timeWindow],
      userContext: options?.userContext,
      category: 'patterns',
    });
  }
  async analyzeCode(filePath, options) {
    if (this.config.mvpLevel < 3) {
      throw new Error('Code analysis requires MVP3 or higher');
    }
    const cacheKey = `code:${filePath}:${options?.analysisType || 'full'}`;
    return this.get(cacheKey, () => this.executeCodeAnalysis(filePath, options), {
      ttl: 60 * 60 * 1000,
      priority: 'normal',
      tags: ['code', 'analysis', options?.analysisType || 'full'],
      userContext: options?.userContext,
      category: 'code',
    });
  }
  async warmCache(strategy, userContext) {
    this.ensureInitialized();
    console.log(`🔥 Warming cache with strategy: ${strategy || 'all'}`);
    let totalWarmed = 0;
    if (!strategy || strategy === 'popular') {
      totalWarmed += await this.warmingEngine.warmCache('popular-entries');
    }
    if (!strategy || strategy === 'time-based') {
      totalWarmed += await this.warmingEngine.warmCache('recent-activity');
    }
    if (!strategy || strategy === 'predictive') {
      totalWarmed += await this.warmingEngine.predictiveCache(userContext);
    }
    console.log(`✅ Cache warming completed: ${totalWarmed} entries warmed`);
    return totalWarmed;
  }
  async invalidateCache(pattern, tags, reason) {
    this.ensureInitialized();
    const event = await this.invalidationManager.invalidate(pattern, tags, true, reason);
    if (event.success && event.affectedKeys.length > 10) {
      setTimeout(() => {
        this.warmingEngine.predictiveCache().catch(error => {
          console.error('Post-invalidation warming failed:', error);
        });
      }, 1000);
    }
    return event.affectedKeys.length;
  }
  getSystemStats() {
    this.ensureInitialized();
    const cacheMetrics = this.cacheManager.getMetrics();
    const warmingStats = this.warmingEngine.getStats();
    const invalidationStats = this.invalidationManager.getStats();
    const performanceMetrics = this.performanceMonitor.getCurrentMetrics();
    return {
      layers: {
        hot: this.extractLayerStats(cacheMetrics, 'Hot Cache (L1)'),
        warm: this.extractLayerStats(cacheMetrics, 'Warm Cache (L2)'),
        distributed: this.extractLayerStats(cacheMetrics, 'Distributed Cache (L3)'),
        persistent: this.extractLayerStats(cacheMetrics, 'Persistent Cache (L4)'),
      },
      warming: {
        totalWarmed: warmingStats.totalWarmed,
        accuracy: warmingStats.accuracy,
        effectiveness: warmingStats.avgTimeSaved > 0 ? 1 : 0,
      },
      invalidation: {
        totalInvalidated: invalidationStats.totalInvalidations,
        cascadeRate:
          invalidationStats.cascadeInvalidations /
          Math.max(invalidationStats.totalInvalidations, 1),
        accuracy: invalidationStats.effectiveness,
      },
      performance: {
        overallHitRate: performanceMetrics.overallHitRate,
        avgResponseTime: performanceMetrics.avgResponseTime,
        slaCompliance: performanceMetrics.slaCompliance,
        grade: performanceMetrics.performanceGrade,
      },
    };
  }
  getOptimizationRecommendations() {
    this.ensureInitialized();
    return {
      cache: this.cacheManager.getOptimizationSuggestions(),
      warming: this.warmingEngine.getRecommendations(),
      invalidation: this.invalidationManager.getRecommendations(),
      performance: this.performanceMonitor.getOptimizationSuggestions(),
    };
  }
  generatePerformanceReport(timeframe = 'hourly') {
    this.ensureInitialized();
    const report = this.performanceMonitor.generateReport(timeframe);
    const systemStats = this.getSystemStats();
    const recommendations = this.getOptimizationRecommendations();
    return {
      ...report,
      systemStats,
      recommendations,
      mvpLevel: this.config.mvpLevel,
      generatedAt: new Date().toISOString(),
    };
  }
  async shutdown() {
    if (!this.initialized) return;
    console.log('🔄 Shutting down cache system...');
    try {
      await this.warmCache('popular');
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.initialized = false;
      console.log('✅ Cache system shutdown completed');
    } catch (error) {
      console.error('❌ Error during cache system shutdown:', error);
    }
  }
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Cache system not initialized. Call initialize() first.');
    }
  }
  setupEventListeners() {
    this.warmingEngine.on('warming-completed', event => {
      console.log(
        `🔥 Cache warming: ${event.warmed}/${event.total} entries, ${event.timeSaved}ms saved`
      );
    });
    this.invalidationManager.on('invalidation-completed', event => {
      console.log(
        `🗑️ Cache invalidated: ${event.affectedKeys.length} keys, cascade level ${event.cascadeLevel}`
      );
    });
    this.performanceMonitor.on('performance-alert', alert => {
      console.log(`🚨 Performance alert: ${alert.level} - ${alert.message}`);
      if (alert.level === 'critical') {
        this.handleCriticalAlert(alert).catch(error => {
          console.error('Failed to handle critical alert:', error);
        });
      }
    });
    this.performanceMonitor.on('metrics-updated', metrics => {
      if (metrics.overallHitRate < 0.7) {
        this.warmCache('predictive').catch(error => {
          console.error('Auto-warming failed:', error);
        });
      }
    });
  }
  async initialCacheWarming() {
    console.log('🔥 Performing initial cache warming...');
    const strategies = ['popular-entries'];
    if (this.config.mvpLevel >= 2) {
      strategies.push('category-overview');
    }
    if (this.config.mvpLevel >= 3) {
      strategies.push('recent-activity');
    }
    let totalWarmed = 0;
    for (const strategy of strategies) {
      try {
        const warmed = await this.warmingEngine.warmCache(strategy);
        totalWarmed += warmed;
      } catch (error) {
        console.warn(`Warning: Initial warming strategy '${strategy}' failed:`, error);
      }
    }
    console.log(`✅ Initial warming completed: ${totalWarmed} entries`);
  }
  async handleCriticalAlert(alert) {
    console.log('🚨 Handling critical performance alert:', alert.metric);
    switch (alert.metric) {
      case 'avgResponseTime':
        await this.warmCache('popular');
        break;
      case 'overallHitRate':
        await this.warmCache('predictive');
        break;
      case 'memoryUsage':
        await this.invalidateCache('*:old*', ['stale']);
        break;
    }
  }
  getOptimalHotCacheSize() {
    const baseSizes = { 1: 50, 2: 75, 3: 100, 4: 150, 5: 200 };
    return baseSizes[this.config.mvpLevel] || 100;
  }
  getOptimalWarmCacheSize() {
    const baseSizes = { 1: 500, 2: 750, 3: 1000, 4: 1500, 5: 2000 };
    return baseSizes[this.config.mvpLevel] || 1000;
  }
  getOptimalMemoryLimit() {
    const baseLimits = { 1: 128, 2: 192, 3: 256, 4: 384, 5: 512 };
    return baseLimits[this.config.mvpLevel] || 256;
  }
  generateSearchCacheKey(query, options) {
    const parts = ['search', query];
    if (options?.category) parts.push(`cat:${options.category}`);
    if (options?.limit) parts.push(`limit:${options.limit}`);
    if (options?.useAI) parts.push('ai');
    return parts.join(':');
  }
  getSearchTTL(query) {
    const baseWords = query.toLowerCase().split(/\s+/);
    const popularWords = ['error', 'vsam', 'jcl', 'batch', 'status'];
    const isPopular = popularWords.some(word => baseWords.includes(word));
    return isPopular ? 30 * 60 * 1000 : 10 * 60 * 1000;
  }
  async executeKBSearch(query, options) {
    console.log(`Executing KB search: ${query}`);
    return [];
  }
  async executePatternAnalysis(timeWindow, options) {
    console.log(`Executing pattern analysis: ${timeWindow}`);
    return [];
  }
  async executeCodeAnalysis(filePath, options) {
    console.log(`Executing code analysis: ${filePath}`);
    return {};
  }
  extractLayerStats(metrics, layerName) {
    const layer = metrics.layers.find(l => l.name === layerName);
    return layer
      ? {
          size: layer.size,
          hitRate: layer.hitRate,
          avgTime: layer.avgResponseTime,
        }
      : { size: 0, hitRate: 0, avgTime: 0 };
  }
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
}
exports.CacheSystemIntegration = CacheSystemIntegration;
async function createCacheSystem(database, config) {
  const cacheSystem = new CacheSystemIntegration(database, config);
  await cacheSystem.initialize();
  return cacheSystem;
}
exports.MVPConfigurations = {
  MVP1: {
    mvpLevel: 1,
    enableDistributedCache: false,
    enablePredictiveWarming: true,
    performanceTargets: {
      maxResponseTime: 1000,
      minHitRate: 0.8,
      maxMemoryUsage: 100 * 1024 * 1024,
    },
  },
  MVP2: {
    mvpLevel: 2,
    enableDistributedCache: false,
    enablePredictiveWarming: true,
    performanceTargets: {
      maxResponseTime: 800,
      minHitRate: 0.82,
      maxMemoryUsage: 150 * 1024 * 1024,
    },
  },
  MVP3: {
    mvpLevel: 3,
    enableDistributedCache: false,
    enablePredictiveWarming: true,
    performanceTargets: {
      maxResponseTime: 500,
      minHitRate: 0.85,
      maxMemoryUsage: 200 * 1024 * 1024,
    },
  },
  MVP4: {
    mvpLevel: 4,
    enableDistributedCache: false,
    enablePredictiveWarming: true,
    performanceTargets: {
      maxResponseTime: 300,
      minHitRate: 0.88,
      maxMemoryUsage: 250 * 1024 * 1024,
    },
  },
  MVP5: {
    mvpLevel: 5,
    enableDistributedCache: true,
    enablePredictiveWarming: true,
    performanceTargets: {
      maxResponseTime: 200,
      minHitRate: 0.9,
      maxMemoryUsage: 512 * 1024 * 1024,
    },
  },
};
//# sourceMappingURL=CacheSystemIntegration.js.map
