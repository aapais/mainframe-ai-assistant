'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.CacheServiceIntegration = void 0;
const events_1 = require('events');
const CacheService_1 = require('../CacheService');
const index_1 = require('./index');
class CacheServiceIntegration extends events_1.EventEmitter {
  legacyCache;
  orchestrator;
  queryCache;
  warmingService;
  invalidationService;
  cdnIntegration;
  performanceMonitor;
  config;
  initialized = false;
  migrationStatus = {
    started: false,
    completed: false,
    progress: 0,
    errors: [],
  };
  constructor(config = {}) {
    super();
    this.config = {
      hybridMode: true,
      fallbackToLegacy: true,
      migrationStrategy: 'gradual',
      monitoring: {
        enabled: true,
        interval: 60000,
        alertThresholds: {
          hitRate: 80,
          responseTime: 1000,
          errorRate: 5,
        },
      },
      warming: {
        enabled: true,
        onStartup: true,
        strategies: ['popular', 'recent', 'critical'],
      },
      ...config,
    };
  }
  async initialize() {
    if (this.initialized) {
      console.log('Cache service already initialized');
      return;
    }
    try {
      console.log('Initializing advanced cache service integration...');
      if (this.config.legacyCache) {
        this.legacyCache = new CacheService_1.CacheService(this.config.legacyCache);
        console.log('Legacy cache service initialized');
      }
      await this.initializeAdvancedCache();
      if (this.config.monitoring?.enabled) {
        this.setupPerformanceMonitoring();
      }
      if (this.config.warming?.enabled) {
        await this.setupCacheWarming();
      }
      if (this.config.migrationStrategy === 'gradual') {
        this.startGradualMigration();
      }
      this.initialized = true;
      this.emit('initialized');
      console.log('Advanced cache service integration initialized successfully');
    } catch (error) {
      console.error('Cache service initialization failed:', error);
      throw error;
    }
  }
  async get(key, options) {
    const useAdvanced = options?.useAdvanced ?? true;
    try {
      if (useAdvanced && this.orchestrator) {
        const result = await this.orchestrator.get(key, {
          fallback: options?.fallback,
          ttl: options?.ttl,
          tags: options?.tags,
        });
        if (result !== null) {
          return result;
        }
      }
      if (this.config.fallbackToLegacy && this.legacyCache) {
        const result = await this.legacyCache.get(key);
        if (result !== null) {
          if (this.orchestrator && this.shouldMigrate(key)) {
            await this.orchestrator.set(key, result, options?.ttl, options?.tags);
          }
          return result;
        }
      }
      if (options?.fallback) {
        const result = await options.fallback();
        if (result !== null) {
          await this.set(key, result, options?.ttl, options?.tags);
        }
        return result;
      }
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return options?.fallback ? await options.fallback() : null;
    }
  }
  async set(key, value, ttl, tags, options) {
    const useAdvanced = options?.useAdvanced ?? true;
    let success = false;
    try {
      if (useAdvanced && this.orchestrator) {
        success = await this.orchestrator.set(key, value, ttl, tags);
      }
      if ((this.config.hybridMode || this.config.fallbackToLegacy) && this.legacyCache) {
        await this.legacyCache.set(key, value, ttl);
        success = true;
      }
      return success;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }
  async del(key) {
    let deleted = false;
    if (this.orchestrator) {
      deleted = (await this.orchestrator.del(key)) || deleted;
    }
    if (this.legacyCache) {
      deleted = (await this.legacyCache.delete(key)) || deleted;
    }
    return deleted;
  }
  async invalidateByTag(tag) {
    if (this.orchestrator) {
      return await this.orchestrator.invalidateByTag(tag);
    }
    return 0;
  }
  async cacheSearchQuery(query, filters, executor, ttl) {
    if (this.queryCache) {
      return this.queryCache.executeSearchQuery(query, filters, { execute: executor }, ttl);
    }
    const cacheKey = `search:${this.hashQuery(query, filters)}`;
    const cached = await this.get(cacheKey);
    if (cached) return cached;
    const result = await executor();
    await this.set(cacheKey, result, ttl, ['search']);
    return result;
  }
  async cacheDbQuery(sql, params, executor, ttl) {
    if (this.queryCache) {
      return this.queryCache.executeDbQuery(sql, params, { execute: executor }, ttl);
    }
    const cacheKey = `db:${this.hashQuery(sql, params)}`;
    const cached = await this.get(cacheKey);
    if (cached) return cached;
    const result = await executor();
    await this.set(cacheKey, result, ttl, ['database']);
    return result;
  }
  getCDNUrl(assetPath, type) {
    return this.cdnIntegration?.getCDNUrl(assetPath, type) || assetPath;
  }
  async uploadToCDN(localPath, cdnPath) {
    if (!this.cdnIntegration) {
      return { success: false, error: 'CDN not configured' };
    }
    return this.cdnIntegration.uploadAsset(localPath, cdnPath);
  }
  getPerformanceMetrics() {
    if (this.performanceMonitor) {
      return this.performanceMonitor.getMetrics();
    }
    if (this.legacyCache) {
      return {
        legacy: this.legacyCache.stats(),
        advanced: null,
      };
    }
    return null;
  }
  getPerformanceReport(timeframe) {
    return this.performanceMonitor?.generateReport(timeframe);
  }
  async getHealthStatus() {
    const status = {
      legacy: null,
      advanced: null,
      migration: this.migrationStatus,
      overall: 'healthy',
    };
    if (this.legacyCache) {
      try {
        const stats = this.legacyCache.stats();
        status.legacy = {
          status: stats.hitRate > 0.5 ? 'healthy' : 'degraded',
          stats,
        };
      } catch (error) {
        status.legacy = { status: 'unhealthy', error: error.message };
      }
    }
    if (this.orchestrator) {
      status.advanced = await this.orchestrator.healthCheck();
    }
    const hasHealthyCache =
      status.legacy?.status === 'healthy' || status.advanced?.status === 'healthy';
    if (!hasHealthyCache) {
      status.overall = 'unhealthy';
    } else if (status.legacy?.status === 'degraded' || status.advanced?.status === 'degraded') {
      status.overall = 'degraded';
    }
    return status;
  }
  async startMigration() {
    if (this.migrationStatus.started) {
      console.log('Migration already in progress');
      return;
    }
    if (!this.legacyCache || !this.orchestrator) {
      throw new Error('Both legacy and advanced caches must be available for migration');
    }
    console.log('Starting cache migration...');
    this.migrationStatus.started = true;
    this.migrationStatus.progress = 0;
    this.migrationStatus.errors = [];
    try {
      const exportData = await this.legacyCache.export();
      const backup = JSON.parse(exportData);
      const totalEntries = backup.entries.length;
      let migratedEntries = 0;
      const batchSize = 100;
      for (let i = 0; i < backup.entries.length; i += batchSize) {
        const batch = backup.entries.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(async entry => {
            try {
              await this.orchestrator.set(entry.key, entry.value, entry.ttl, ['migrated']);
              migratedEntries++;
            } catch (error) {
              this.migrationStatus.errors.push(
                `Failed to migrate key ${entry.key}: ${error.message}`
              );
            }
          })
        );
        this.migrationStatus.progress = (migratedEntries / totalEntries) * 100;
        this.emit('migration-progress', this.migrationStatus);
      }
      this.migrationStatus.completed = true;
      this.emit('migration-completed', this.migrationStatus);
      console.log(`Migration completed: ${migratedEntries}/${totalEntries} entries migrated`);
    } catch (error) {
      this.migrationStatus.errors.push(error.message);
      this.emit('migration-error', error);
      console.error('Migration failed:', error);
    }
  }
  async flush() {
    const tasks = [];
    if (this.orchestrator) {
      tasks.push(this.orchestrator.flush());
    }
    if (this.legacyCache) {
      tasks.push(this.legacyCache.clear());
    }
    await Promise.allSettled(tasks);
    this.emit('cache-flushed');
  }
  async destroy() {
    console.log('Shutting down cache service integration...');
    if (this.performanceMonitor) {
      this.performanceMonitor.stopMonitoring();
    }
    if (this.warmingService) {
      this.warmingService.stopScheduledWarming();
    }
    if (this.invalidationService) {
      this.invalidationService.clearScheduledTasks();
    }
    const cleanupTasks = [];
    if (this.orchestrator) {
      cleanupTasks.push(this.orchestrator.destroy());
    }
    if (this.legacyCache) {
      cleanupTasks.push(this.legacyCache.close());
    }
    await Promise.allSettled(cleanupTasks);
    this.initialized = false;
    this.emit('destroyed');
    console.log('Cache service integration shutdown complete');
  }
  async initializeAdvancedCache() {
    if (!this.config.multiLayer) return;
    const cacheConfig = {
      ...(0, index_1.createCacheConfig)(),
      ...this.config.multiLayer,
    };
    this.orchestrator = new index_1.CacheOrchestrator(cacheConfig);
    this.queryCache = new index_1.QueryCache(this.orchestrator);
    this.warmingService = new index_1.CacheWarmingService(this.orchestrator, this.queryCache);
    this.invalidationService = new index_1.CacheInvalidationService(this.orchestrator);
    if (this.config.cdn?.enabled) {
      this.cdnIntegration = new index_1.CDNIntegration(this.config.cdn);
    }
    console.log('Advanced cache components initialized');
  }
  setupPerformanceMonitoring() {
    if (!this.orchestrator) return;
    this.performanceMonitor = new index_1.PerformanceMonitor(
      this.orchestrator,
      this.cdnIntegration
    );
    this.performanceMonitor.startMonitoring(this.config.monitoring.interval);
    const thresholds = this.config.monitoring.alertThresholds;
    this.performanceMonitor.setPerformanceTarget({
      metric: 'cache.hitRate',
      target: thresholds.hitRate,
      warning: thresholds.hitRate * 0.8,
      critical: thresholds.hitRate * 0.6,
      unit: '%',
    });
    this.performanceMonitor.on('alert', alert => {
      console.warn('Performance Alert:', alert);
      this.emit('performance-alert', alert);
    });
    console.log('Performance monitoring setup complete');
  }
  async setupCacheWarming() {
    if (!this.warmingService) return;
    const strategies = this.config.warming.strategies;
    if (strategies.includes('popular')) {
      this.warmingService.registerPopularSearches();
    }
    if (strategies.includes('recent')) {
      this.warmingService.registerKnowledgeBaseWarming();
    }
    if (strategies.includes('critical')) {
      this.warmingService.registerUserPreferencesWarming();
    }
    if (this.config.warming.onStartup) {
      await this.warmingService.warmOnStartup();
    }
    console.log('Cache warming setup complete');
  }
  startGradualMigration() {
    if (!this.legacyCache || !this.orchestrator) return;
    setTimeout(() => {
      this.startMigration().catch(error => {
        console.error('Gradual migration failed:', error);
      });
    }, 30000);
  }
  shouldMigrate(key) {
    return Math.random() < 0.1;
  }
  hashQuery(query, params) {
    try {
      const combined = JSON.stringify({ query, params });
      return Buffer.from(combined).toString('base64').substring(0, 16);
    } catch {
      return 'unknown';
    }
  }
  get legacyCacheService() {
    return this.legacyCache;
  }
  get advancedCacheOrchestrator() {
    return this.orchestrator;
  }
  isInitialized() {
    return this.initialized;
  }
  getMigrationStatus() {
    return { ...this.migrationStatus };
  }
}
exports.CacheServiceIntegration = CacheServiceIntegration;
//# sourceMappingURL=CacheServiceIntegration.js.map
