export interface PerformanceMetric {
    id: string;
    timestamp: number;
    type: 'query' | 'cache' | 'response' | 'system';
    value: number;
    metadata: Record<string, any>;
    tags: string[];
}
export interface PercentileMetrics {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
    mean: number;
    min: number;
    max: number;
    count: number;
}
export interface CacheMetrics {
    hitRate: number;
    missRate: number;
    totalRequests: number;
    hits: number;
    misses: number;
    evictions: number;
    size: number;
    maxSize: number;
}
export interface QueryMetrics {
    avgResponseTime: number;
    slowQueries: Array<{
        query: string;
        duration: number;
        timestamp: number;
    }>;
    queryCount: number;
    errorRate: number;
    percentiles: PercentileMetrics;
}
export interface SLAMetrics {
    availability: number;
    responseTimeTarget: number;
    responseTimeActual: number;
    errorRateTarget: number;
    errorRateActual: number;
    throughputTarget: number;
    throughputActual: number;
    violations: Array<{
        type: string;
        timestamp: number;
        severity: 'warning' | 'critical';
        message: string;
    }>;
}
export declare class MetricsCollector {
    private metrics;
    private subscribers;
    private windowSize;
    private cleanupInterval;
    private aggregationInterval;
    constructor();
    recordMetric(metric: PerformanceMetric): void;
    recordQuery(query: string, duration: number, success: boolean, metadata?: Record<string, any>): void;
    recordCacheEvent(key: string, hit: boolean, retrievalTime?: number): void;
    recordResponseTime(endpoint: string, method: string, duration: number, statusCode: number): void;
    private calculatePercentiles;
    getQueryMetrics(): QueryMetrics;
    getCacheMetrics(): CacheMetrics;
    getResponseTimeMetrics(): PercentileMetrics & {
        byEndpoint: Record<string, PercentileMetrics>;
    };
    getSLAMetrics(targets: {
        responseTime: number;
        errorRate: number;
        throughput: number;
    }): SLAMetrics;
    private getMetricsByType;
    private getMetricsSince;
    subscribe(callback: (metrics: any) => void): () => void;
    private notifySubscribers;
    private cleanupOldMetrics;
    getCurrentMetrics(): {
        timestamp: number;
        query: QueryMetrics;
        cache: CacheMetrics;
        responseTime: PercentileMetrics & {
            byEndpoint: Record<string, PercentileMetrics>;
        };
        sla: SLAMetrics;
    };
    destroy(): void;
}
export declare const metricsCollector: MetricsCollector;
//# sourceMappingURL=MetricsCollector.d.ts.map