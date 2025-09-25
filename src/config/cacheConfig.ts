/**
 * Cache Configuration System
 * Centralized, tunable parameters for all cache layers
 */

export interface CacheLayerConfig {
  enabled: boolean;
  name: string;
  maxSize: number;
  maxMemoryMB: number;
  defaultTTL: number;
  evictionPolicy: 'LRU' | 'LFU' | 'ARC' | 'ADAPTIVE';
  cleanupInterval: number;
  compressionEnabled: boolean;
  compressionThreshold: number;
}

export interface RedisConfig {
  enabled: boolean;
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  maxRetries: number;
  retryDelayMs: number;
  enableCluster: boolean;
  clusterNodes?: Array<{ host: string; port: number }>;
  enableReadReplicas: boolean;
  readReplicaNodes?: Array<{ host: string; port: number }>;
  connectionPoolSize: number;
}

export interface PredictiveCacheConfig {
  enabled: boolean;
  enableMLPredictions: boolean;
  maxPredictions: number;
  confidenceThreshold: number;
  predictionHorizon: number;
  modelUpdateInterval: number;
  enablePatternLearning: boolean;
  enableContextualPredictions: boolean;
  enableTemporalPredictions: boolean;
  maxPatternHistory: number;
  predictionBatchSize: number;
}

export interface IncrementalLoadingConfig {
  enabled: boolean;
  defaultChunkSize: number;
  maxParallelLoads: number;
  enableAdaptiveChunking: boolean;
  enablePrioritization: boolean;
  loadTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  throughputThreshold: number;
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsInterval: number;
  enablePerformanceAlerts: boolean;
  alertThresholds: {
    hitRateBelow: number;
    errorRateAbove: number;
    latencyAbove: number;
    memoryUsageAbove: number;
  };
  enableMetricsExport: boolean;
  metricsExportInterval: number;
}

export interface SecurityConfig {
  enableEncryption: boolean;
  encryptionAlgorithm: 'AES-256-GCM' | 'AES-128-GCM';
  enableAccessControl: boolean;
  maxKeyLength: number;
  maxValueSize: number;
  enableAuditLog: boolean;
}

export interface CacheSystemConfig {
  environment: 'development' | 'staging' | 'production';
  performanceTarget: '<1s' | '<500ms' | '<200ms';

  // Layer configurations
  l0Cache: CacheLayerConfig; // Instant cache
  l1Cache: CacheLayerConfig; // Hot cache
  l2Cache: CacheLayerConfig; // Warm cache
  l3Redis: RedisConfig; // Distributed cache
  l4Persistent: CacheLayerConfig; // Disk cache

  // Advanced features
  predictiveCache: PredictiveCacheConfig;
  incrementalLoading: IncrementalLoadingConfig;
  monitoring: MonitoringConfig;
  security: SecurityConfig;

  // Global settings
  enableMultiLayer: boolean;
  enablePromotion: boolean;
  enableDemotion: boolean;
  enableWarmup: boolean;
  maxTotalMemoryMB: number;
  memoryPressureThreshold: number;
  globalTTLMultiplier: number;
}

/**
 * Cache Configuration Factory
 * Provides optimized configurations for different environments and performance targets
 */
export class CacheConfigFactory {
  /**
   * Create optimized configuration for development environment
   */
  static createDevelopmentConfig(): CacheSystemConfig {
    return {
      environment: 'development',
      performanceTarget: '<1s',

      l0Cache: {
        enabled: true,
        name: 'Instant Cache (L0)',
        maxSize: 25,
        maxMemoryMB: 10,
        defaultTTL: 2 * 60 * 1000, // 2 minutes
        evictionPolicy: 'LRU',
        cleanupInterval: 30 * 1000, // 30 seconds
        compressionEnabled: false,
        compressionThreshold: 10240, // 10KB
      },

      l1Cache: {
        enabled: true,
        name: 'Hot Cache (L1)',
        maxSize: 100,
        maxMemoryMB: 25,
        defaultTTL: 5 * 60 * 1000, // 5 minutes
        evictionPolicy: 'ADAPTIVE',
        cleanupInterval: 60 * 1000, // 1 minute
        compressionEnabled: false,
        compressionThreshold: 5120, // 5KB
      },

      l2Cache: {
        enabled: true,
        name: 'Warm Cache (L2)',
        maxSize: 500,
        maxMemoryMB: 50,
        defaultTTL: 15 * 60 * 1000, // 15 minutes
        evictionPolicy: 'LRU',
        cleanupInterval: 2 * 60 * 1000, // 2 minutes
        compressionEnabled: true,
        compressionThreshold: 1024, // 1KB
      },

      l3Redis: {
        enabled: false, // Disabled for development
        host: 'localhost',
        port: 6379,
        db: 0,
        keyPrefix: 'cache:dev:',
        maxRetries: 3,
        retryDelayMs: 1000,
        enableCluster: false,
        enableReadReplicas: false,
        connectionPoolSize: 5,
      },

      l4Persistent: {
        enabled: true,
        name: 'Persistent Cache (L4)',
        maxSize: 2000,
        maxMemoryMB: 100,
        defaultTTL: 60 * 60 * 1000, // 1 hour
        evictionPolicy: 'LRU',
        cleanupInterval: 5 * 60 * 1000, // 5 minutes
        compressionEnabled: true,
        compressionThreshold: 512, // 512 bytes
      },

      predictiveCache: {
        enabled: true,
        enableMLPredictions: false, // Disabled for development
        maxPredictions: 20,
        confidenceThreshold: 0.8,
        predictionHorizon: 15, // 15 minutes
        modelUpdateInterval: 120, // 2 hours
        enablePatternLearning: true,
        enableContextualPredictions: true,
        enableTemporalPredictions: false,
        maxPatternHistory: 1000,
        predictionBatchSize: 5,
      },

      incrementalLoading: {
        enabled: true,
        defaultChunkSize: 50,
        maxParallelLoads: 2,
        enableAdaptiveChunking: false,
        enablePrioritization: true,
        loadTimeout: 10000, // 10 seconds
        retryAttempts: 2,
        retryDelay: 500,
        throughputThreshold: 0.7,
      },

      monitoring: {
        enabled: true,
        metricsInterval: 30 * 1000, // 30 seconds
        enablePerformanceAlerts: false,
        alertThresholds: {
          hitRateBelow: 0.7,
          errorRateAbove: 0.05,
          latencyAbove: 1000,
          memoryUsageAbove: 0.9,
        },
        enableMetricsExport: false,
        metricsExportInterval: 5 * 60 * 1000, // 5 minutes
      },

      security: {
        enableEncryption: false,
        encryptionAlgorithm: 'AES-256-GCM',
        enableAccessControl: false,
        maxKeyLength: 250,
        maxValueSize: 10 * 1024 * 1024, // 10MB
        enableAuditLog: false,
      },

      enableMultiLayer: true,
      enablePromotion: true,
      enableDemotion: true,
      enableWarmup: true,
      maxTotalMemoryMB: 200,
      memoryPressureThreshold: 0.8,
      globalTTLMultiplier: 1.0,
    };
  }

  /**
   * Create optimized configuration for production environment
   */
  static createProductionConfig(): CacheSystemConfig {
    return {
      environment: 'production',
      performanceTarget: '<200ms',

      l0Cache: {
        enabled: true,
        name: 'Instant Cache (L0)',
        maxSize: 100,
        maxMemoryMB: 50,
        defaultTTL: 5 * 60 * 1000, // 5 minutes
        evictionPolicy: 'ADAPTIVE',
        cleanupInterval: 60 * 1000, // 1 minute
        compressionEnabled: true,
        compressionThreshold: 5120, // 5KB
      },

      l1Cache: {
        enabled: true,
        name: 'Hot Cache (L1)',
        maxSize: 1000,
        maxMemoryMB: 200,
        defaultTTL: 15 * 60 * 1000, // 15 minutes
        evictionPolicy: 'ARC',
        cleanupInterval: 2 * 60 * 1000, // 2 minutes
        compressionEnabled: true,
        compressionThreshold: 2048, // 2KB
      },

      l2Cache: {
        enabled: true,
        name: 'Warm Cache (L2)',
        maxSize: 5000,
        maxMemoryMB: 500,
        defaultTTL: 60 * 60 * 1000, // 1 hour
        evictionPolicy: 'ARC',
        cleanupInterval: 5 * 60 * 1000, // 5 minutes
        compressionEnabled: true,
        compressionThreshold: 1024, // 1KB
      },

      l3Redis: {
        enabled: true,
        host: process.env.REDIS_HOST || 'redis-cluster',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: 0,
        keyPrefix: 'cache:prod:',
        maxRetries: 5,
        retryDelayMs: 2000,
        enableCluster: true,
        clusterNodes: [
          { host: 'redis-node-1', port: 6379 },
          { host: 'redis-node-2', port: 6379 },
          { host: 'redis-node-3', port: 6379 },
        ],
        enableReadReplicas: true,
        readReplicaNodes: [
          { host: 'redis-replica-1', port: 6379 },
          { host: 'redis-replica-2', port: 6379 },
        ],
        connectionPoolSize: 20,
      },

      l4Persistent: {
        enabled: true,
        name: 'Persistent Cache (L4)',
        maxSize: 50000,
        maxMemoryMB: 1000,
        defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
        evictionPolicy: 'LRU',
        cleanupInterval: 15 * 60 * 1000, // 15 minutes
        compressionEnabled: true,
        compressionThreshold: 256, // 256 bytes
      },

      predictiveCache: {
        enabled: true,
        enableMLPredictions: true,
        maxPredictions: 100,
        confidenceThreshold: 0.7,
        predictionHorizon: 30, // 30 minutes
        modelUpdateInterval: 60, // 1 hour
        enablePatternLearning: true,
        enableContextualPredictions: true,
        enableTemporalPredictions: true,
        maxPatternHistory: 50000,
        predictionBatchSize: 20,
      },

      incrementalLoading: {
        enabled: true,
        defaultChunkSize: 100,
        maxParallelLoads: 5,
        enableAdaptiveChunking: true,
        enablePrioritization: true,
        loadTimeout: 30000, // 30 seconds
        retryAttempts: 3,
        retryDelay: 1000,
        throughputThreshold: 0.8,
      },

      monitoring: {
        enabled: true,
        metricsInterval: 10 * 1000, // 10 seconds
        enablePerformanceAlerts: true,
        alertThresholds: {
          hitRateBelow: 0.85,
          errorRateAbove: 0.01,
          latencyAbove: 200,
          memoryUsageAbove: 0.85,
        },
        enableMetricsExport: true,
        metricsExportInterval: 60 * 1000, // 1 minute
      },

      security: {
        enableEncryption: true,
        encryptionAlgorithm: 'AES-256-GCM',
        enableAccessControl: true,
        maxKeyLength: 250,
        maxValueSize: 50 * 1024 * 1024, // 50MB
        enableAuditLog: true,
      },

      enableMultiLayer: true,
      enablePromotion: true,
      enableDemotion: true,
      enableWarmup: true,
      maxTotalMemoryMB: 2000,
      memoryPressureThreshold: 0.8,
      globalTTLMultiplier: 1.0,
    };
  }

  /**
   * Create optimized configuration for staging environment
   */
  static createStagingConfig(): CacheSystemConfig {
    const prodConfig = this.createProductionConfig();

    return {
      ...prodConfig,
      environment: 'staging',
      performanceTarget: '<500ms',

      l0Cache: {
        ...prodConfig.l0Cache,
        maxSize: 50,
        maxMemoryMB: 25,
      },

      l1Cache: {
        ...prodConfig.l1Cache,
        maxSize: 500,
        maxMemoryMB: 100,
      },

      l2Cache: {
        ...prodConfig.l2Cache,
        maxSize: 2000,
        maxMemoryMB: 200,
      },

      l3Redis: {
        ...prodConfig.l3Redis,
        enabled: true,
        host: process.env.REDIS_HOST || 'redis-staging',
        keyPrefix: 'cache:staging:',
        enableCluster: false,
        enableReadReplicas: false,
        connectionPoolSize: 10,
      },

      predictiveCache: {
        ...prodConfig.predictiveCache,
        maxPredictions: 50,
        enableMLPredictions: true,
        maxPatternHistory: 10000,
      },

      monitoring: {
        ...prodConfig.monitoring,
        enablePerformanceAlerts: true,
        alertThresholds: {
          ...prodConfig.monitoring.alertThresholds,
          hitRateBelow: 0.8,
          latencyAbove: 500,
        },
      },

      security: {
        ...prodConfig.security,
        enableEncryption: false,
        enableAccessControl: false,
        enableAuditLog: false,
      },

      maxTotalMemoryMB: 500,
    };
  }

  /**
   * Create configuration optimized for high-performance scenarios
   */
  static createHighPerformanceConfig(): CacheSystemConfig {
    const prodConfig = this.createProductionConfig();

    return {
      ...prodConfig,
      performanceTarget: '<200ms',

      l0Cache: {
        ...prodConfig.l0Cache,
        maxSize: 200,
        maxMemoryMB: 100,
        defaultTTL: 10 * 60 * 1000, // 10 minutes
        evictionPolicy: 'ARC',
      },

      l1Cache: {
        ...prodConfig.l1Cache,
        maxSize: 2000,
        maxMemoryMB: 500,
        defaultTTL: 30 * 60 * 1000, // 30 minutes
        evictionPolicy: 'ARC',
      },

      l2Cache: {
        ...prodConfig.l2Cache,
        maxSize: 10000,
        maxMemoryMB: 1000,
        defaultTTL: 2 * 60 * 60 * 1000, // 2 hours
        evictionPolicy: 'ARC',
      },

      predictiveCache: {
        ...prodConfig.predictiveCache,
        maxPredictions: 200,
        confidenceThreshold: 0.6,
        predictionHorizon: 60, // 1 hour
        modelUpdateInterval: 30, // 30 minutes
        maxPatternHistory: 100000,
        predictionBatchSize: 50,
      },

      incrementalLoading: {
        ...prodConfig.incrementalLoading,
        defaultChunkSize: 200,
        maxParallelLoads: 10,
        enableAdaptiveChunking: true,
      },

      monitoring: {
        ...prodConfig.monitoring,
        metricsInterval: 5 * 1000, // 5 seconds
        alertThresholds: {
          hitRateBelow: 0.9,
          errorRateAbove: 0.005,
          latencyAbove: 100,
          memoryUsageAbove: 0.8,
        },
      },

      maxTotalMemoryMB: 4000,
      memoryPressureThreshold: 0.7,
    };
  }

  /**
   * Create configuration for memory-constrained environments
   */
  static createMemoryConstrainedConfig(): CacheSystemConfig {
    const devConfig = this.createDevelopmentConfig();

    return {
      ...devConfig,
      performanceTarget: '<1s',

      l0Cache: {
        ...devConfig.l0Cache,
        maxSize: 10,
        maxMemoryMB: 5,
        compressionEnabled: true,
        compressionThreshold: 512,
      },

      l1Cache: {
        ...devConfig.l1Cache,
        maxSize: 50,
        maxMemoryMB: 10,
        compressionEnabled: true,
        compressionThreshold: 256,
      },

      l2Cache: {
        ...devConfig.l2Cache,
        maxSize: 100,
        maxMemoryMB: 15,
        compressionEnabled: true,
        compressionThreshold: 128,
      },

      l3Redis: {
        ...devConfig.l3Redis,
        enabled: false,
      },

      l4Persistent: {
        ...devConfig.l4Persistent,
        maxSize: 500,
        maxMemoryMB: 20,
      },

      predictiveCache: {
        ...devConfig.predictiveCache,
        enabled: false,
      },

      incrementalLoading: {
        ...devConfig.incrementalLoading,
        defaultChunkSize: 20,
        maxParallelLoads: 1,
        enableAdaptiveChunking: false,
      },

      maxTotalMemoryMB: 50,
      memoryPressureThreshold: 0.9,
    };
  }

  /**
   * Get configuration based on environment variable or default
   */
  static getConfig(): CacheSystemConfig {
    const env = process.env.NODE_ENV || 'development';
    const cacheProfile = process.env.CACHE_PROFILE;

    switch (cacheProfile) {
      case 'high-performance':
        return this.createHighPerformanceConfig();
      case 'memory-constrained':
        return this.createMemoryConstrainedConfig();
      default:
        switch (env) {
          case 'production':
            return this.createProductionConfig();
          case 'staging':
            return this.createStagingConfig();
          default:
            return this.createDevelopmentConfig();
        }
    }
  }

  /**
   * Validate configuration values
   */
  static validateConfig(config: CacheSystemConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate memory constraints
    const totalMemory =
      config.l0Cache.maxMemoryMB +
      config.l1Cache.maxMemoryMB +
      config.l2Cache.maxMemoryMB +
      config.l4Persistent.maxMemoryMB;

    if (totalMemory > config.maxTotalMemoryMB) {
      errors.push(
        `Total layer memory (${totalMemory}MB) exceeds max total memory (${config.maxTotalMemoryMB}MB)`
      );
    }

    // Validate TTL hierarchy
    if (config.l0Cache.defaultTTL > config.l1Cache.defaultTTL) {
      errors.push('L0 cache TTL should not exceed L1 cache TTL');
    }

    if (config.l1Cache.defaultTTL > config.l2Cache.defaultTTL) {
      errors.push('L1 cache TTL should not exceed L2 cache TTL');
    }

    // Validate size hierarchy
    if (config.l0Cache.maxSize > config.l1Cache.maxSize) {
      errors.push('L0 cache size should not exceed L1 cache size');
    }

    if (config.l1Cache.maxSize > config.l2Cache.maxSize) {
      errors.push('L1 cache size should not exceed L2 cache size');
    }

    // Validate thresholds
    if (config.memoryPressureThreshold <= 0 || config.memoryPressureThreshold > 1) {
      errors.push('Memory pressure threshold must be between 0 and 1');
    }

    if (
      config.monitoring.alertThresholds.hitRateBelow <= 0 ||
      config.monitoring.alertThresholds.hitRateBelow > 1
    ) {
      errors.push('Hit rate threshold must be between 0 and 1');
    }

    // Validate Redis configuration
    if (config.l3Redis.enabled) {
      if (!config.l3Redis.host) {
        errors.push('Redis host is required when Redis is enabled');
      }

      if (config.l3Redis.port <= 0 || config.l3Redis.port > 65535) {
        errors.push('Redis port must be between 1 and 65535');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a custom configuration by merging with base configuration
   */
  static createCustomConfig(
    baseConfig: CacheSystemConfig,
    overrides: Partial<CacheSystemConfig>
  ): CacheSystemConfig {
    return {
      ...baseConfig,
      ...overrides,
      l0Cache: { ...baseConfig.l0Cache, ...overrides.l0Cache },
      l1Cache: { ...baseConfig.l1Cache, ...overrides.l1Cache },
      l2Cache: { ...baseConfig.l2Cache, ...overrides.l2Cache },
      l3Redis: { ...baseConfig.l3Redis, ...overrides.l3Redis },
      l4Persistent: { ...baseConfig.l4Persistent, ...overrides.l4Persistent },
      predictiveCache: { ...baseConfig.predictiveCache, ...overrides.predictiveCache },
      incrementalLoading: { ...baseConfig.incrementalLoading, ...overrides.incrementalLoading },
      monitoring: { ...baseConfig.monitoring, ...overrides.monitoring },
      security: { ...baseConfig.security, ...overrides.security },
    };
  }
}

// Export the default configuration
export const cacheConfig = CacheConfigFactory.getConfig();

export default cacheConfig;
