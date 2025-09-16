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
    clusterNodes?: Array<{
        host: string;
        port: number;
    }>;
    enableReadReplicas: boolean;
    readReplicaNodes?: Array<{
        host: string;
        port: number;
    }>;
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
    l0Cache: CacheLayerConfig;
    l1Cache: CacheLayerConfig;
    l2Cache: CacheLayerConfig;
    l3Redis: RedisConfig;
    l4Persistent: CacheLayerConfig;
    predictiveCache: PredictiveCacheConfig;
    incrementalLoading: IncrementalLoadingConfig;
    monitoring: MonitoringConfig;
    security: SecurityConfig;
    enableMultiLayer: boolean;
    enablePromotion: boolean;
    enableDemotion: boolean;
    enableWarmup: boolean;
    maxTotalMemoryMB: number;
    memoryPressureThreshold: number;
    globalTTLMultiplier: number;
}
export declare class CacheConfigFactory {
    static createDevelopmentConfig(): CacheSystemConfig;
    static createProductionConfig(): CacheSystemConfig;
    static createStagingConfig(): CacheSystemConfig;
    static createHighPerformanceConfig(): CacheSystemConfig;
    static createMemoryConstrainedConfig(): CacheSystemConfig;
    static getConfig(): CacheSystemConfig;
    static validateConfig(config: CacheSystemConfig): {
        valid: boolean;
        errors: string[];
    };
    static createCustomConfig(baseConfig: CacheSystemConfig, overrides: Partial<CacheSystemConfig>): CacheSystemConfig;
}
export declare const cacheConfig: CacheSystemConfig;
export default cacheConfig;
//# sourceMappingURL=cacheConfig.d.ts.map