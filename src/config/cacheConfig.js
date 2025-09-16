"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheConfig = exports.CacheConfigFactory = void 0;
class CacheConfigFactory {
    static createDevelopmentConfig() {
        return {
            environment: 'development',
            performanceTarget: '<1s',
            l0Cache: {
                enabled: true,
                name: 'Instant Cache (L0)',
                maxSize: 25,
                maxMemoryMB: 10,
                defaultTTL: 2 * 60 * 1000,
                evictionPolicy: 'LRU',
                cleanupInterval: 30 * 1000,
                compressionEnabled: false,
                compressionThreshold: 10240
            },
            l1Cache: {
                enabled: true,
                name: 'Hot Cache (L1)',
                maxSize: 100,
                maxMemoryMB: 25,
                defaultTTL: 5 * 60 * 1000,
                evictionPolicy: 'ADAPTIVE',
                cleanupInterval: 60 * 1000,
                compressionEnabled: false,
                compressionThreshold: 5120
            },
            l2Cache: {
                enabled: true,
                name: 'Warm Cache (L2)',
                maxSize: 500,
                maxMemoryMB: 50,
                defaultTTL: 15 * 60 * 1000,
                evictionPolicy: 'LRU',
                cleanupInterval: 2 * 60 * 1000,
                compressionEnabled: true,
                compressionThreshold: 1024
            },
            l3Redis: {
                enabled: false,
                host: 'localhost',
                port: 6379,
                db: 0,
                keyPrefix: 'cache:dev:',
                maxRetries: 3,
                retryDelayMs: 1000,
                enableCluster: false,
                enableReadReplicas: false,
                connectionPoolSize: 5
            },
            l4Persistent: {
                enabled: true,
                name: 'Persistent Cache (L4)',
                maxSize: 2000,
                maxMemoryMB: 100,
                defaultTTL: 60 * 60 * 1000,
                evictionPolicy: 'LRU',
                cleanupInterval: 5 * 60 * 1000,
                compressionEnabled: true,
                compressionThreshold: 512
            },
            predictiveCache: {
                enabled: true,
                enableMLPredictions: false,
                maxPredictions: 20,
                confidenceThreshold: 0.8,
                predictionHorizon: 15,
                modelUpdateInterval: 120,
                enablePatternLearning: true,
                enableContextualPredictions: true,
                enableTemporalPredictions: false,
                maxPatternHistory: 1000,
                predictionBatchSize: 5
            },
            incrementalLoading: {
                enabled: true,
                defaultChunkSize: 50,
                maxParallelLoads: 2,
                enableAdaptiveChunking: false,
                enablePrioritization: true,
                loadTimeout: 10000,
                retryAttempts: 2,
                retryDelay: 500,
                throughputThreshold: 0.7
            },
            monitoring: {
                enabled: true,
                metricsInterval: 30 * 1000,
                enablePerformanceAlerts: false,
                alertThresholds: {
                    hitRateBelow: 0.7,
                    errorRateAbove: 0.05,
                    latencyAbove: 1000,
                    memoryUsageAbove: 0.9
                },
                enableMetricsExport: false,
                metricsExportInterval: 5 * 60 * 1000
            },
            security: {
                enableEncryption: false,
                encryptionAlgorithm: 'AES-256-GCM',
                enableAccessControl: false,
                maxKeyLength: 250,
                maxValueSize: 10 * 1024 * 1024,
                enableAuditLog: false
            },
            enableMultiLayer: true,
            enablePromotion: true,
            enableDemotion: true,
            enableWarmup: true,
            maxTotalMemoryMB: 200,
            memoryPressureThreshold: 0.8,
            globalTTLMultiplier: 1.0
        };
    }
    static createProductionConfig() {
        return {
            environment: 'production',
            performanceTarget: '<200ms',
            l0Cache: {
                enabled: true,
                name: 'Instant Cache (L0)',
                maxSize: 100,
                maxMemoryMB: 50,
                defaultTTL: 5 * 60 * 1000,
                evictionPolicy: 'ADAPTIVE',
                cleanupInterval: 60 * 1000,
                compressionEnabled: true,
                compressionThreshold: 5120
            },
            l1Cache: {
                enabled: true,
                name: 'Hot Cache (L1)',
                maxSize: 1000,
                maxMemoryMB: 200,
                defaultTTL: 15 * 60 * 1000,
                evictionPolicy: 'ARC',
                cleanupInterval: 2 * 60 * 1000,
                compressionEnabled: true,
                compressionThreshold: 2048
            },
            l2Cache: {
                enabled: true,
                name: 'Warm Cache (L2)',
                maxSize: 5000,
                maxMemoryMB: 500,
                defaultTTL: 60 * 60 * 1000,
                evictionPolicy: 'ARC',
                cleanupInterval: 5 * 60 * 1000,
                compressionEnabled: true,
                compressionThreshold: 1024
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
                    { host: 'redis-node-3', port: 6379 }
                ],
                enableReadReplicas: true,
                readReplicaNodes: [
                    { host: 'redis-replica-1', port: 6379 },
                    { host: 'redis-replica-2', port: 6379 }
                ],
                connectionPoolSize: 20
            },
            l4Persistent: {
                enabled: true,
                name: 'Persistent Cache (L4)',
                maxSize: 50000,
                maxMemoryMB: 1000,
                defaultTTL: 24 * 60 * 60 * 1000,
                evictionPolicy: 'LRU',
                cleanupInterval: 15 * 60 * 1000,
                compressionEnabled: true,
                compressionThreshold: 256
            },
            predictiveCache: {
                enabled: true,
                enableMLPredictions: true,
                maxPredictions: 100,
                confidenceThreshold: 0.7,
                predictionHorizon: 30,
                modelUpdateInterval: 60,
                enablePatternLearning: true,
                enableContextualPredictions: true,
                enableTemporalPredictions: true,
                maxPatternHistory: 50000,
                predictionBatchSize: 20
            },
            incrementalLoading: {
                enabled: true,
                defaultChunkSize: 100,
                maxParallelLoads: 5,
                enableAdaptiveChunking: true,
                enablePrioritization: true,
                loadTimeout: 30000,
                retryAttempts: 3,
                retryDelay: 1000,
                throughputThreshold: 0.8
            },
            monitoring: {
                enabled: true,
                metricsInterval: 10 * 1000,
                enablePerformanceAlerts: true,
                alertThresholds: {
                    hitRateBelow: 0.85,
                    errorRateAbove: 0.01,
                    latencyAbove: 200,
                    memoryUsageAbove: 0.85
                },
                enableMetricsExport: true,
                metricsExportInterval: 60 * 1000
            },
            security: {
                enableEncryption: true,
                encryptionAlgorithm: 'AES-256-GCM',
                enableAccessControl: true,
                maxKeyLength: 250,
                maxValueSize: 50 * 1024 * 1024,
                enableAuditLog: true
            },
            enableMultiLayer: true,
            enablePromotion: true,
            enableDemotion: true,
            enableWarmup: true,
            maxTotalMemoryMB: 2000,
            memoryPressureThreshold: 0.8,
            globalTTLMultiplier: 1.0
        };
    }
    static createStagingConfig() {
        const prodConfig = this.createProductionConfig();
        return {
            ...prodConfig,
            environment: 'staging',
            performanceTarget: '<500ms',
            l0Cache: {
                ...prodConfig.l0Cache,
                maxSize: 50,
                maxMemoryMB: 25
            },
            l1Cache: {
                ...prodConfig.l1Cache,
                maxSize: 500,
                maxMemoryMB: 100
            },
            l2Cache: {
                ...prodConfig.l2Cache,
                maxSize: 2000,
                maxMemoryMB: 200
            },
            l3Redis: {
                ...prodConfig.l3Redis,
                enabled: true,
                host: process.env.REDIS_HOST || 'redis-staging',
                keyPrefix: 'cache:staging:',
                enableCluster: false,
                enableReadReplicas: false,
                connectionPoolSize: 10
            },
            predictiveCache: {
                ...prodConfig.predictiveCache,
                maxPredictions: 50,
                enableMLPredictions: true,
                maxPatternHistory: 10000
            },
            monitoring: {
                ...prodConfig.monitoring,
                enablePerformanceAlerts: true,
                alertThresholds: {
                    ...prodConfig.monitoring.alertThresholds,
                    hitRateBelow: 0.8,
                    latencyAbove: 500
                }
            },
            security: {
                ...prodConfig.security,
                enableEncryption: false,
                enableAccessControl: false,
                enableAuditLog: false
            },
            maxTotalMemoryMB: 500
        };
    }
    static createHighPerformanceConfig() {
        const prodConfig = this.createProductionConfig();
        return {
            ...prodConfig,
            performanceTarget: '<200ms',
            l0Cache: {
                ...prodConfig.l0Cache,
                maxSize: 200,
                maxMemoryMB: 100,
                defaultTTL: 10 * 60 * 1000,
                evictionPolicy: 'ARC'
            },
            l1Cache: {
                ...prodConfig.l1Cache,
                maxSize: 2000,
                maxMemoryMB: 500,
                defaultTTL: 30 * 60 * 1000,
                evictionPolicy: 'ARC'
            },
            l2Cache: {
                ...prodConfig.l2Cache,
                maxSize: 10000,
                maxMemoryMB: 1000,
                defaultTTL: 2 * 60 * 60 * 1000,
                evictionPolicy: 'ARC'
            },
            predictiveCache: {
                ...prodConfig.predictiveCache,
                maxPredictions: 200,
                confidenceThreshold: 0.6,
                predictionHorizon: 60,
                modelUpdateInterval: 30,
                maxPatternHistory: 100000,
                predictionBatchSize: 50
            },
            incrementalLoading: {
                ...prodConfig.incrementalLoading,
                defaultChunkSize: 200,
                maxParallelLoads: 10,
                enableAdaptiveChunking: true
            },
            monitoring: {
                ...prodConfig.monitoring,
                metricsInterval: 5 * 1000,
                alertThresholds: {
                    hitRateBelow: 0.9,
                    errorRateAbove: 0.005,
                    latencyAbove: 100,
                    memoryUsageAbove: 0.8
                }
            },
            maxTotalMemoryMB: 4000,
            memoryPressureThreshold: 0.7
        };
    }
    static createMemoryConstrainedConfig() {
        const devConfig = this.createDevelopmentConfig();
        return {
            ...devConfig,
            performanceTarget: '<1s',
            l0Cache: {
                ...devConfig.l0Cache,
                maxSize: 10,
                maxMemoryMB: 5,
                compressionEnabled: true,
                compressionThreshold: 512
            },
            l1Cache: {
                ...devConfig.l1Cache,
                maxSize: 50,
                maxMemoryMB: 10,
                compressionEnabled: true,
                compressionThreshold: 256
            },
            l2Cache: {
                ...devConfig.l2Cache,
                maxSize: 100,
                maxMemoryMB: 15,
                compressionEnabled: true,
                compressionThreshold: 128
            },
            l3Redis: {
                ...devConfig.l3Redis,
                enabled: false
            },
            l4Persistent: {
                ...devConfig.l4Persistent,
                maxSize: 500,
                maxMemoryMB: 20
            },
            predictiveCache: {
                ...devConfig.predictiveCache,
                enabled: false
            },
            incrementalLoading: {
                ...devConfig.incrementalLoading,
                defaultChunkSize: 20,
                maxParallelLoads: 1,
                enableAdaptiveChunking: false
            },
            maxTotalMemoryMB: 50,
            memoryPressureThreshold: 0.9
        };
    }
    static getConfig() {
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
    static validateConfig(config) {
        const errors = [];
        const totalMemory = config.l0Cache.maxMemoryMB +
            config.l1Cache.maxMemoryMB +
            config.l2Cache.maxMemoryMB +
            config.l4Persistent.maxMemoryMB;
        if (totalMemory > config.maxTotalMemoryMB) {
            errors.push(`Total layer memory (${totalMemory}MB) exceeds max total memory (${config.maxTotalMemoryMB}MB)`);
        }
        if (config.l0Cache.defaultTTL > config.l1Cache.defaultTTL) {
            errors.push('L0 cache TTL should not exceed L1 cache TTL');
        }
        if (config.l1Cache.defaultTTL > config.l2Cache.defaultTTL) {
            errors.push('L1 cache TTL should not exceed L2 cache TTL');
        }
        if (config.l0Cache.maxSize > config.l1Cache.maxSize) {
            errors.push('L0 cache size should not exceed L1 cache size');
        }
        if (config.l1Cache.maxSize > config.l2Cache.maxSize) {
            errors.push('L1 cache size should not exceed L2 cache size');
        }
        if (config.memoryPressureThreshold <= 0 || config.memoryPressureThreshold > 1) {
            errors.push('Memory pressure threshold must be between 0 and 1');
        }
        if (config.monitoring.alertThresholds.hitRateBelow <= 0 || config.monitoring.alertThresholds.hitRateBelow > 1) {
            errors.push('Hit rate threshold must be between 0 and 1');
        }
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
            errors
        };
    }
    static createCustomConfig(baseConfig, overrides) {
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
            security: { ...baseConfig.security, ...overrides.security }
        };
    }
}
exports.CacheConfigFactory = CacheConfigFactory;
exports.cacheConfig = CacheConfigFactory.getConfig();
exports.default = exports.cacheConfig;
//# sourceMappingURL=cacheConfig.js.map