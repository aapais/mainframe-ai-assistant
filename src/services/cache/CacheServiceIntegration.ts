import { EventEmitter } from 'events';
import { CacheService } from '../CacheService'; // Existing LRU cache service
import {
  CacheOrchestrator,
  QueryCache,
  CacheWarmingService,
  CacheInvalidationService,
  CDNIntegration,
  PerformanceMonitor,
  createCacheConfig,
  type CacheOrchestratorConfig,
  type CDNConfig,
} from './index';
import { CacheConfig, ICacheService } from '../../types/services';

export interface AdvancedCacheConfig {
  // Existing cache service configuration
  legacyCache?: CacheConfig;

  // New advanced caching configuration
  multiLayer?: Partial<CacheOrchestratorConfig>;
  cdn?: CDNConfig;

  // Integration settings
  hybridMode?: boolean;
  fallbackToLegacy?: boolean;
  migrationStrategy?: 'immediate' | 'gradual' | 'manual';

  // Performance monitoring
  monitoring?: {
    enabled: boolean;
    interval: number;
    alertThresholds?: {
      hitRate: number;
      responseTime: number;
      errorRate: number;
    };
  };

  // Cache warming
  warming?: {
    enabled: boolean;
    onStartup: boolean;
    strategies: string[];
  };
}

/**
 * Advanced Cache Service Integration
 * Combines the existing LRU cache with new multi-layer caching capabilities
 */
export class CacheServiceIntegration extends EventEmitter {
  private legacyCache?: CacheService;
  private orchestrator?: CacheOrchestrator;
  private queryCache?: QueryCache;
  private warmingService?: CacheWarmingService;
  private invalidationService?: CacheInvalidationService;
  private cdnIntegration?: CDNIntegration;
  private performanceMonitor?: PerformanceMonitor;

  private config: AdvancedCacheConfig;
  private initialized = false;
  private migrationStatus = {
    started: false,
    completed: false,
    progress: 0,
    errors: [] as string[],
  };

  constructor(config: AdvancedCacheConfig = {}) {
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

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('Cache service already initialized');
      return;
    }

    try {
      console.log('Initializing advanced cache service integration...');

      // Initialize legacy cache if configured
      if (this.config.legacyCache) {
        this.legacyCache = new CacheService(this.config.legacyCache);
        console.log('Legacy cache service initialized');
      }

      // Initialize advanced multi-layer cache
      await this.initializeAdvancedCache();

      // Setup performance monitoring
      if (this.config.monitoring?.enabled) {
        this.setupPerformanceMonitoring();
      }

      // Setup cache warming
      if (this.config.warming?.enabled) {
        await this.setupCacheWarming();
      }

      // Start migration if gradual strategy
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

  // Unified cache interface methods
  async get<T>(
    key: string,
    options?: {
      fallback?: () => Promise<T>;
      ttl?: number;
      tags?: string[];
      useAdvanced?: boolean;
    }
  ): Promise<T | null> {
    const useAdvanced = options?.useAdvanced ?? true;

    try {
      // Try advanced cache first if available and enabled
      if (useAdvanced && this.orchestrator) {
        const result = await this.orchestrator.get<T>(key, {
          fallback: options?.fallback,
          ttl: options?.ttl,
          tags: options?.tags,
        });

        if (result !== null) {
          return result;
        }
      }

      // Fallback to legacy cache if enabled
      if (this.config.fallbackToLegacy && this.legacyCache) {
        const result = await this.legacyCache.get<T>(key);

        if (result !== null) {
          // Optionally migrate to advanced cache
          if (this.orchestrator && this.shouldMigrate(key)) {
            await this.orchestrator.set(key, result, options?.ttl, options?.tags);
          }
          return result;
        }
      }

      // Execute fallback if provided
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

  async set<T>(
    key: string,
    value: T,
    ttl?: number,
    tags?: string[],
    options?: { useAdvanced?: boolean }
  ): Promise<boolean> {
    const useAdvanced = options?.useAdvanced ?? true;
    let success = false;

    try {
      // Set in advanced cache if available
      if (useAdvanced && this.orchestrator) {
        success = await this.orchestrator.set(key, value, ttl, tags);
      }

      // Also set in legacy cache if hybrid mode or fallback enabled
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

  async del(key: string): Promise<boolean> {
    let deleted = false;

    // Delete from advanced cache
    if (this.orchestrator) {
      deleted = (await this.orchestrator.del(key)) || deleted;
    }

    // Delete from legacy cache
    if (this.legacyCache) {
      deleted = (await this.legacyCache.delete(key)) || deleted;
    }

    return deleted;
  }

  async invalidateByTag(tag: string): Promise<number> {
    if (this.orchestrator) {
      return await this.orchestrator.invalidateByTag(tag);
    }
    return 0;
  }

  // Query caching methods
  async cacheSearchQuery<T>(
    query: string,
    filters: any,
    executor: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    if (this.queryCache) {
      return this.queryCache.executeSearchQuery(query, filters, { execute: executor }, ttl);
    }

    // Fallback to regular caching
    const cacheKey = `search:${this.hashQuery(query, filters)}`;
    const cached = await this.get<T>(cacheKey);
    if (cached) return cached;

    const result = await executor();
    await this.set(cacheKey, result, ttl, ['search']);
    return result;
  }

  async cacheDbQuery<T>(
    sql: string,
    params: any[],
    executor: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    if (this.queryCache) {
      return this.queryCache.executeDbQuery(sql, params, { execute: executor }, ttl);
    }

    // Fallback to regular caching
    const cacheKey = `db:${this.hashQuery(sql, params)}`;
    const cached = await this.get<T>(cacheKey);
    if (cached) return cached;

    const result = await executor();
    await this.set(cacheKey, result, ttl, ['database']);
    return result;
  }

  // CDN integration
  getCDNUrl(assetPath: string, type?: 'static' | 'images' | 'api'): string {
    return this.cdnIntegration?.getCDNUrl(assetPath, type) || assetPath;
  }

  async uploadToCDN(
    localPath: string,
    cdnPath: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!this.cdnIntegration) {
      return { success: false, error: 'CDN not configured' };
    }
    return this.cdnIntegration.uploadAsset(localPath, cdnPath);
  }

  // Performance and monitoring
  getPerformanceMetrics() {
    if (this.performanceMonitor) {
      return this.performanceMonitor.getMetrics();
    }

    // Return legacy cache stats if available
    if (this.legacyCache) {
      return {
        legacy: this.legacyCache.stats(),
        advanced: null,
      };
    }

    return null;
  }

  getPerformanceReport(timeframe?: '1h' | '24h' | '7d') {
    return this.performanceMonitor?.generateReport(timeframe);
  }

  async getHealthStatus() {
    const status = {
      legacy: null as any,
      advanced: null as any,
      migration: this.migrationStatus,
      overall: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    };

    // Check legacy cache
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

    // Check advanced cache
    if (this.orchestrator) {
      status.advanced = await this.orchestrator.healthCheck();
    }

    // Determine overall status
    const hasHealthyCache =
      status.legacy?.status === 'healthy' || status.advanced?.status === 'healthy';

    if (!hasHealthyCache) {
      status.overall = 'unhealthy';
    } else if (status.legacy?.status === 'degraded' || status.advanced?.status === 'degraded') {
      status.overall = 'degraded';
    }

    return status;
  }

  // Migration methods
  async startMigration(): Promise<void> {
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
      // Export data from legacy cache
      const exportData = await this.legacyCache.export();
      const backup = JSON.parse(exportData);

      const totalEntries = backup.entries.length;
      let migratedEntries = 0;

      // Migrate entries in batches
      const batchSize = 100;
      for (let i = 0; i < backup.entries.length; i += batchSize) {
        const batch = backup.entries.slice(i, i + batchSize);

        await Promise.allSettled(
          batch.map(async (entry: any) => {
            try {
              await this.orchestrator!.set(entry.key, entry.value, entry.ttl, ['migrated']);
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

  // Cleanup and shutdown
  async flush(): Promise<void> {
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

  async destroy(): Promise<void> {
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

  // Private methods
  private async initializeAdvancedCache(): Promise<void> {
    if (!this.config.multiLayer) return;

    const cacheConfig = {
      ...createCacheConfig(),
      ...this.config.multiLayer,
    };

    this.orchestrator = new CacheOrchestrator(cacheConfig);
    this.queryCache = new QueryCache(this.orchestrator);
    this.warmingService = new CacheWarmingService(this.orchestrator, this.queryCache);
    this.invalidationService = new CacheInvalidationService(this.orchestrator);

    if (this.config.cdn?.enabled) {
      this.cdnIntegration = new CDNIntegration(this.config.cdn);
    }

    console.log('Advanced cache components initialized');
  }

  private setupPerformanceMonitoring(): void {
    if (!this.orchestrator) return;

    this.performanceMonitor = new PerformanceMonitor(this.orchestrator, this.cdnIntegration);

    this.performanceMonitor.startMonitoring(this.config.monitoring!.interval);

    // Setup alert thresholds
    const thresholds = this.config.monitoring!.alertThresholds!;
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

  private async setupCacheWarming(): Promise<void> {
    if (!this.warmingService) return;

    const strategies = this.config.warming!.strategies;

    if (strategies.includes('popular')) {
      this.warmingService.registerPopularSearches();
    }

    if (strategies.includes('recent')) {
      this.warmingService.registerKnowledgeBaseWarming();
    }

    if (strategies.includes('critical')) {
      this.warmingService.registerUserPreferencesWarming();
    }

    if (this.config.warming!.onStartup) {
      await this.warmingService.warmOnStartup();
    }

    console.log('Cache warming setup complete');
  }

  private startGradualMigration(): void {
    if (!this.legacyCache || !this.orchestrator) return;

    // Start background migration after 30 seconds
    setTimeout(() => {
      this.startMigration().catch(error => {
        console.error('Gradual migration failed:', error);
      });
    }, 30000);
  }

  private shouldMigrate(key: string): boolean {
    // Simple migration logic - migrate 10% of requests
    return Math.random() < 0.1;
  }

  private hashQuery(query: string, params: any): string {
    try {
      const combined = JSON.stringify({ query, params });
      return Buffer.from(combined).toString('base64').substring(0, 16);
    } catch {
      return 'unknown';
    }
  }

  // Getters for direct access
  get legacyCacheService(): CacheService | undefined {
    return this.legacyCache;
  }

  get advancedCacheOrchestrator(): CacheOrchestrator | undefined {
    return this.orchestrator;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getMigrationStatus() {
    return { ...this.migrationStatus };
  }
}
