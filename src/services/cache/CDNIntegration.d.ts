export interface CDNConfig {
    enabled: boolean;
    baseUrl: string;
    regions: string[];
    apiKey?: string;
    zones: {
        static: string;
        images: string;
        api: string;
    };
    compression: {
        enabled: boolean;
        formats: string[];
        quality: number;
    };
    caching: {
        browser: {
            maxAge: number;
            public: boolean;
        };
        edge: {
            maxAge: number;
            staleWhileRevalidate: number;
        };
    };
}
export interface AssetOptimization {
    minification: boolean;
    compression: 'gzip' | 'brotli' | 'none';
    imageOptimization: boolean;
    lazy: boolean;
    preload: boolean;
}
export interface CDNMetrics {
    requests: number;
    hits: number;
    misses: number;
    bandwidth: number;
    avgResponseTime: number;
    regions: Map<string, {
        requests: number;
        responseTime: number;
    }>;
}
export declare class CDNIntegration {
    private config;
    private metrics;
    private assetManifest;
    constructor(config: CDNConfig);
    getCDNUrl(assetPath: string, type?: 'static' | 'images' | 'api', options?: {
        version?: string;
        optimize?: AssetOptimization;
        region?: string;
    }): string;
    generatePreloadHeaders(assets: Array<{
        path: string;
        type: 'script' | 'style' | 'image' | 'font';
        priority: 'high' | 'low';
    }>): string[];
    uploadAsset(localPath: string, cdnPath: string, options?: {
        contentType?: string;
        cacheControl?: string;
        metadata?: any;
    }): Promise<{
        success: boolean;
        url?: string;
        error?: string;
    }>;
    uploadAssets(assets: Array<{
        localPath: string;
        cdnPath: string;
        contentType?: string;
    }>): Promise<{
        successful: number;
        failed: number;
        results: Array<{
            path: string;
            success: boolean;
            url?: string;
            error?: string;
        }>;
    }>;
    purgeCache(paths: string[], options?: {
        purgeType: 'url' | 'tag' | 'everything';
        tags?: string[];
    }): Promise<{
        success: boolean;
        purged: number;
        error?: string;
    }>;
    getAnalytics(timeframe?: '24h' | '7d' | '30d'): Promise<CDNMetrics>;
    healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        regions: Map<string, {
            status: 'up' | 'down';
            responseTime: number;
        }>;
        overallResponseTime: number;
    }>;
    generateManifest(): {
        version: string;
        assets: Record<string, {
            url: string;
            version: string;
            size: number;
            integrity?: string;
        }>;
    };
    getCacheHeaders(assetType: 'css' | 'js' | 'images' | 'fonts' | 'api'): Record<string, string>;
    getMetrics(): CDNMetrics;
    isEnabled(): boolean;
    getAssetManifest(): Map<string, any>;
}
//# sourceMappingURL=CDNIntegration.d.ts.map