/**
 * Search Backend Service - Main Integration Layer
 * Orchestrates all search backend services with comprehensive error handling and monitoring
 */

import { AdvancedSearchEngine } from '../services/search/AdvancedSearchEngine';
import { SearchApiService } from './api/search/SearchApiService';
import { SearchHistoryService } from './api/search/SearchHistoryService';
import { AutocompleteService } from './api/search/AutocompleteService';
import { SearchMetricsCollector } from './api/search/SearchMetricsCollector';
import { MultiLayerCache, CacheConfig } from './cache/MultiLayerCache';
import { SearchIPCHandlers } from './ipc/SearchIPCHandlers';
import { AppError } from './core/errors/AppError';
import Database from 'better-sqlite3';

export interface SearchBackendConfig {
  database: {
    path: string;
    options?: Database.Options;
  };
  cache: CacheConfig;
  search: {
    maxResults: number;
    defaultTimeout: number;
    enableAI: boolean;
    geminiApiKey?: string;
  };
  performance: {
    enableMetrics: boolean;
    metricsRetentionDays: number;
    historyRetentionDays: number;
  };
}

export interface BackendStatus {
  status: 'initializing' | 'ready' | 'error' | 'stopping' | 'stopped';
  services: {
    database: 'connected' | 'disconnected' | 'error';
    cache: 'ready' | 'degraded' | 'error';
    search: 'ready' | 'error';
    metrics: 'collecting' | 'stopped' | 'error';
    ipc: 'listening' | 'stopped' | 'error';
  };
  performance: {
    totalRequests: number;
    avgResponseTime: number;
    errorRate: number;
    uptime: number;
  };
  resources: {
    memoryUsage: number;
    cpuUsage: number;
    cacheMemoryUsage: number;
    dbSize: number;
  };
}

/**
 * Comprehensive Search Backend Service
 * Features:
 * - Service orchestration with dependency management
 * - Health monitoring and automatic recovery
 * - Performance optimization and tuning
 * - Graceful shutdown handling
 * - Error isolation and recovery
 * - Resource monitoring and alerting
 */
export class SearchBackendService {
  private config: SearchBackendConfig;
  private status: BackendStatus['status'] = 'initializing';

  // Core services
  private database?: Database.Database;
  private cache?: MultiLayerCache;
  private searchEngine?: AdvancedSearchEngine;
  private searchApiService?: SearchApiService;
  private historyService?: SearchHistoryService;
  private autocompleteService?: AutocompleteService;
  private metricsCollector?: SearchMetricsCollector;
  private ipcHandlers?: SearchIPCHandlers;

  // Health monitoring
  private healthCheckInterval?: NodeJS.Timeout;
  private startTime = Date.now();
  private totalRequests = 0;
  private totalResponseTime = 0;
  private errorCount = 0;

  constructor(config: SearchBackendConfig) {
    this.config = config;
  }

  /**
   * Initialize all backend services
   */
  async initialize(): Promise<void> {
    console.log('Initializing Search Backend Service...');
    this.status = 'initializing';

    try {
      // Initialize services in dependency order
      await this.initializeDatabase();
      await this.initializeCache();
      await this.initializeSearchEngine();
      await this.initializeServices();
      await this.initializeIPC();

      // Start health monitoring
      this.startHealthMonitoring();

      this.status = 'ready';
      console.log('✅ Search Backend Service initialized successfully');

    } catch (error) {
      this.status = 'error';
      console.error('❌ Failed to initialize Search Backend Service:', error);
      await this.cleanup();
      throw new AppError(
        'Backend initialization failed',
        'BACKEND_INIT_ERROR',
        500,
        { originalError: error.message }
      );
    }
  }

  /**
   * Get current backend status
   */
  async getStatus(): Promise<BackendStatus> {
    const memUsage = process.memoryUsage();

    return {
      status: this.status,
      services: {
        database: this.database ? 'connected' : 'disconnected',
        cache: await this.getCacheStatus(),
        search: this.searchEngine ? 'ready' : 'error',
        metrics: this.metricsCollector ? 'collecting' : 'stopped',
        ipc: this.ipcHandlers ? 'listening' : 'stopped'
      },
      performance: {
        totalRequests: this.totalRequests,
        avgResponseTime: this.totalRequests > 0 ? this.totalResponseTime / this.totalRequests : 0,
        errorRate: this.totalRequests > 0 ? this.errorCount / this.totalRequests : 0,
        uptime: Date.now() - this.startTime
      },
      resources: {
        memoryUsage: memUsage.heapUsed,
        cpuUsage: process.cpuUsage().user,
        cacheMemoryUsage: await this.getCacheMemoryUsage(),
        dbSize: await this.getDatabaseSize()
      }
    };
  }

  /**
   * Get performance metrics
   */
  async getMetrics(timeframe: string = '1h'): Promise<any> {
    if (!this.metricsCollector) {
      throw new AppError('Metrics collector not available', 'METRICS_UNAVAILABLE', 503);
    }

    return this.metricsCollector.getMetrics({
      timeframe,
      granularity: '5m'
    });
  }

  /**
   * Execute health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    details: Record<string, { status: string; message?: string; responseTime?: number }>;
  }> {
    const details: Record<string, { status: string; message?: string; responseTime?: number }> = {};

    // Database health check
    const dbStart = Date.now();
    try {
      if (this.database) {
        this.database.prepare('SELECT 1').get();
        details.database = {
          status: 'healthy',
          responseTime: Date.now() - dbStart
        };
      } else {
        details.database = { status: 'unavailable', message: 'Database not initialized' };
      }
    } catch (error: any) {
      details.database = {
        status: 'unhealthy',
        message: error.message,
        responseTime: Date.now() - dbStart
      };
    }

    // Cache health check
    const cacheStart = Date.now();
    try {
      if (this.cache) {
        const stats = this.cache.getStats();
        details.cache = {
          status: stats.overall.errorRate < 0.1 ? 'healthy' : 'degraded',
          responseTime: Date.now() - cacheStart
        };
      } else {
        details.cache = { status: 'unavailable', message: 'Cache not initialized' };
      }
    } catch (error: any) {
      details.cache = {
        status: 'unhealthy',
        message: error.message,
        responseTime: Date.now() - cacheStart
      };
    }

    // Search engine health check
    const searchStart = Date.now();
    try {
      if (this.searchEngine && this.searchApiService) {
        // Simple search test
        await this.searchApiService.executeSearch({
          query: 'test',
          limit: 1,
          offset: 0,
          useAI: false
        });
        details.search = {
          status: 'healthy',
          responseTime: Date.now() - searchStart
        };
      } else {
        details.search = { status: 'unavailable', message: 'Search engine not initialized' };
      }
    } catch (error: any) {
      details.search = {
        status: 'unhealthy',
        message: error.message,
        responseTime: Date.now() - searchStart
      };
    }

    // Overall health determination
    const healthy = Object.values(details).every(detail =>
      detail.status === 'healthy' || detail.status === 'degraded'
    );

    return { healthy, details };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down Search Backend Service...');
    this.status = 'stopping';

    try {
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Close services in reverse dependency order
      await this.cleanup();

      this.status = 'stopped';
      console.log('✅ Search Backend Service shut down successfully');

    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Handle service recovery
   */
  async recoverServices(): Promise<void> {
    console.log('Attempting service recovery...');

    try {
      const status = await this.getStatus();

      // Recover failed services
      if (status.services.cache === 'error' && !this.cache) {
        console.log('Recovering cache service...');
        await this.initializeCache();
      }

      if (status.services.search === 'error' && !this.searchEngine) {
        console.log('Recovering search service...');
        await this.initializeSearchEngine();
        await this.initializeServices();
      }

      if (status.services.metrics === 'error' && !this.metricsCollector) {
        console.log('Recovering metrics service...');
        this.metricsCollector = new SearchMetricsCollector();
      }

      console.log('Service recovery completed');

    } catch (error) {
      console.error('Service recovery failed:', error);
      throw error;
    }
  }

  // Private initialization methods

  private async initializeDatabase(): Promise<void> {
    console.log('Initializing database...');

    try {
      this.database = new Database(this.config.database.path, {
        ...this.config.database.options,
        verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
      });

      // Test connection
      this.database.prepare('SELECT 1').get();

      console.log('✅ Database initialized');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  private async initializeCache(): Promise<void> {
    console.log('Initializing multi-layer cache...');

    try {
      this.cache = new MultiLayerCache(this.config.cache);

      // Test cache functionality
      await this.cache.set('test', 'value', 60);
      const testValue = await this.cache.get('test');

      if (testValue !== 'value') {
        throw new Error('Cache test failed');
      }

      await this.cache.delete('test');
      console.log('✅ Multi-layer cache initialized');

    } catch (error) {
      console.error('❌ Cache initialization failed:', error);
      throw error;
    }
  }

  private async initializeSearchEngine(): Promise<void> {
    console.log('Initializing search engine...');

    try {
      this.searchEngine = new AdvancedSearchEngine({
        maxResults: this.config.search.maxResults,
        defaultTimeout: this.config.search.defaultTimeout,
        cacheEnabled: true,
        fuzzyEnabled: true,
        rankingAlgorithm: 'combined',
        performance: {
          indexingBatchSize: 1000,
          searchTimeout: this.config.search.defaultTimeout,
          maxConcurrentSearches: 10,
          memoryThreshold: 512 * 1024 * 1024, // 512MB
          optimizationLevel: 'balanced'
        },
        features: {
          semanticSearch: this.config.search.enableAI,
          autoComplete: true,
          spellCorrection: false,
          queryExpansion: true,
          resultClustering: false,
          personalizedRanking: true
        }
      });

      console.log('✅ Search engine initialized');

    } catch (error) {
      console.error('❌ Search engine initialization failed:', error);
      throw error;
    }
  }

  private async initializeServices(): Promise<void> {
    console.log('Initializing backend services...');

    if (!this.database || !this.cache || !this.searchEngine) {
      throw new Error('Dependencies not initialized');
    }

    try {
      // Initialize history service
      this.historyService = new SearchHistoryService(this.config.database.path);

      // Initialize autocomplete service
      this.autocompleteService = new AutocompleteService(this.database);

      // Initialize metrics collector
      if (this.config.performance.enableMetrics) {
        this.metricsCollector = new SearchMetricsCollector();
      }

      // Initialize API service
      this.searchApiService = new SearchApiService(
        this.searchEngine,
        this.autocompleteService,
        this.historyService!
      );

      console.log('✅ Backend services initialized');

    } catch (error) {
      console.error('❌ Backend services initialization failed:', error);
      throw error;
    }
  }

  private async initializeIPC(): Promise<void> {
    console.log('Initializing IPC handlers...');

    if (!this.searchApiService || !this.historyService || !this.autocompleteService || !this.cache) {
      throw new Error('Services not initialized for IPC');
    }

    try {
      this.ipcHandlers = new SearchIPCHandlers(
        this.searchApiService,
        this.historyService,
        this.autocompleteService,
        this.metricsCollector!,
        this.cache
      );

      console.log('✅ IPC handlers initialized');

    } catch (error) {
      console.error('❌ IPC handlers initialization failed:', error);
      throw error;
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.healthCheck();

        if (!health.healthy) {
          console.warn('Health check failed:', health.details);

          // Attempt automatic recovery
          try {
            await this.recoverServices();
          } catch (recoveryError) {
            console.error('Automatic recovery failed:', recoveryError);
          }
        }

      } catch (error) {
        console.error('Health check error:', error);
      }
    }, 60000); // Check every minute
  }

  private async cleanup(): Promise<void> {
    const cleanupPromises: Promise<any>[] = [];

    if (this.ipcHandlers) {
      cleanupPromises.push(this.ipcHandlers.close());
    }

    if (this.metricsCollector) {
      cleanupPromises.push(this.metricsCollector.close());
    }

    if (this.historyService) {
      cleanupPromises.push(this.historyService.close());
    }

    if (this.cache) {
      cleanupPromises.push(this.cache.close());
    }

    if (this.database) {
      cleanupPromises.push(Promise.resolve(this.database.close()));
    }

    await Promise.allSettled(cleanupPromises);
  }

  private async getCacheStatus(): Promise<'ready' | 'degraded' | 'error'> {
    if (!this.cache) return 'error';

    try {
      const stats = this.cache.getStats();
      return stats.overall.errorRate > 0.1 ? 'degraded' : 'ready';
    } catch {
      return 'error';
    }
  }

  private async getCacheMemoryUsage(): Promise<number> {
    if (!this.cache) return 0;

    try {
      const stats = this.cache.getStats();
      return stats.overall.memoryUsage;
    } catch {
      return 0;
    }
  }

  private async getDatabaseSize(): Promise<number> {
    if (!this.database) return 0;

    try {
      const result = this.database.prepare(`
        SELECT page_count * page_size as size
        FROM pragma_page_count(), pragma_page_size()
      `).get() as { size: number };

      return result.size;
    } catch {
      return 0;
    }
  }

  /**
   * Get service instances for external use
   */
  getServices() {
    return {
      database: this.database,
      cache: this.cache,
      searchEngine: this.searchEngine,
      searchApiService: this.searchApiService,
      historyService: this.historyService,
      autocompleteService: this.autocompleteService,
      metricsCollector: this.metricsCollector,
      ipcHandlers: this.ipcHandlers
    };
  }

  /**
   * Update request metrics
   */
  recordRequest(responseTime: number, success: boolean = true): void {
    this.totalRequests++;
    this.totalResponseTime += responseTime;

    if (!success) {
      this.errorCount++;
    }
  }
}

/**
 * Factory function for creating configured backend service
 */
export function createSearchBackend(config?: Partial<SearchBackendConfig>): SearchBackendService {
  const defaultConfig: SearchBackendConfig = {
    database: {
      path: './data/search.db',
      options: {
        verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
      }
    },
    cache: {
      l0: {
        maxItems: 100,
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
        ttlSeconds: 300
      },
      l1: {
        host: 'localhost',
        port: 6379,
        db: 0,
        maxRetries: 3,
        retryDelayOnFailover: 100
      },
      l2: {
        maxItems: 10000,
        cleanupIntervalMinutes: 60,
        compressionThreshold: 1024
      },
      compression: {
        enabled: true,
        algorithm: 'gzip',
        threshold: 1024
      },
      monitoring: {
        enabled: true,
        metricsInterval: 30000,
        alertThresholds: {
          hitRateBelow: 0.7,
          errorRateAbove: 0.05,
          latencyAbove: 1000
        }
      }
    },
    search: {
      maxResults: 100,
      defaultTimeout: 5000,
      enableAI: true,
      geminiApiKey: process.env.GEMINI_API_KEY
    },
    performance: {
      enableMetrics: true,
      metricsRetentionDays: 30,
      historyRetentionDays: 90
    }
  };

  const finalConfig = {
    ...defaultConfig,
    ...config,
    database: { ...defaultConfig.database, ...config?.database },
    cache: { ...defaultConfig.cache, ...config?.cache },
    search: { ...defaultConfig.search, ...config?.search },
    performance: { ...defaultConfig.performance, ...config?.performance }
  };

  return new SearchBackendService(finalConfig);
}