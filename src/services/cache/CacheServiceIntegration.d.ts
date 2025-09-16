import { EventEmitter } from 'events';
import { CacheService } from '../CacheService';
import { CacheOrchestrator, type CacheOrchestratorConfig, type CDNConfig } from './index';
import { CacheConfig } from '../../types/services';
export interface AdvancedCacheConfig {
    legacyCache?: CacheConfig;
    multiLayer?: Partial<CacheOrchestratorConfig>;
    cdn?: CDNConfig;
    hybridMode?: boolean;
    fallbackToLegacy?: boolean;
    migrationStrategy?: 'immediate' | 'gradual' | 'manual';
    monitoring?: {
        enabled: boolean;
        interval: number;
        alertThresholds?: {
            hitRate: number;
            responseTime: number;
            errorRate: number;
        };
    };
    warming?: {
        enabled: boolean;
        onStartup: boolean;
        strategies: string[];
    };
}
export declare class CacheServiceIntegration extends EventEmitter {
    private legacyCache?;
    private orchestrator?;
    private queryCache?;
    private warmingService?;
    private invalidationService?;
    private cdnIntegration?;
    private performanceMonitor?;
    private config;
    private initialized;
    private migrationStatus;
    constructor(config?: AdvancedCacheConfig);
    initialize(): Promise<void>;
    get<T>(key: string, options?: {
        fallback?: () => Promise<T>;
        ttl?: number;
        tags?: string[];
        useAdvanced?: boolean;
    }): Promise<T | null>;
    set<T>(key: string, value: T, ttl?: number, tags?: string[], options?: {
        useAdvanced?: boolean;
    }): Promise<boolean>;
    del(key: string): Promise<boolean>;
    invalidateByTag(tag: string): Promise<number>;
    cacheSearchQuery<T>(query: string, filters: any, executor: () => Promise<T>, ttl?: number): Promise<T>;
    cacheDbQuery<T>(sql: string, params: any[], executor: () => Promise<T>, ttl?: number): Promise<T>;
    getCDNUrl(assetPath: string, type?: 'static' | 'images' | 'api'): string;
    uploadToCDN(localPath: string, cdnPath: string): Promise<{
        success: boolean;
        url?: string;
        error?: string;
    }>;
    getPerformanceMetrics(): import("./PerformanceMonitor").PerformanceMetrics | {
        legacy: any;
        advanced: null;
    } | null;
    getPerformanceReport(timeframe?: '1h' | '24h' | '7d'): {
        summary: {
            overallScore: number;
            cacheEfficiency: number;
            responseTimeGrade: "A" | "B" | "C" | "D" | "F";
            availability: number;
        };
        details: {
            cache: any;
            performance: any;
            alerts: any;
        };
        recommendations: string[];
    } | undefined;
    getHealthStatus(): Promise<{
        legacy: any;
        advanced: any;
        migration: {
            started: boolean;
            completed: boolean;
            progress: number;
            errors: string[];
        };
        overall: "healthy" | "degraded" | "unhealthy";
    }>;
    startMigration(): Promise<void>;
    flush(): Promise<void>;
    destroy(): Promise<void>;
    private initializeAdvancedCache;
    private setupPerformanceMonitoring;
    private setupCacheWarming;
    private startGradualMigration;
    private shouldMigrate;
    private hashQuery;
    get legacyCacheService(): CacheService | undefined;
    get advancedCacheOrchestrator(): CacheOrchestrator | undefined;
    isInitialized(): boolean;
    getMigrationStatus(): {
        started: boolean;
        completed: boolean;
        progress: number;
        errors: string[];
    };
}
//# sourceMappingURL=CacheServiceIntegration.d.ts.map