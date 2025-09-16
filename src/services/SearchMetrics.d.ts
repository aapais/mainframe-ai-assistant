import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
export interface PerformanceMetric {
    timestamp: number;
    operation: string;
    duration: number;
    success: boolean;
    metadata?: any;
}
export interface SearchAnalytics {
    totalSearches: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    successRate: number;
    cacheHitRate: number;
    popularQueries: Array<{
        query: string;
        count: number;
        avgResponseTime: number;
        successRate: number;
    }>;
    performanceTrends: Array<{
        date: string;
        avgResponseTime: number;
        totalSearches: number;
        cacheHitRate: number;
    }>;
}
export interface CacheMetrics {
    layer: string;
    level: number;
    hitRate: number;
    missRate: number;
    averageAccessTime: number;
    totalHits: number;
    totalMisses: number;
    memoryUsage: number;
    evictionCount: number;
}
export interface AlertRule {
    name: string;
    condition: string;
    threshold: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    enabled: boolean;
    lastTriggered?: number;
    triggerCount: number;
}
export interface PerformanceAlert {
    id: string;
    rule: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: number;
    metadata: any;
    acknowledged: boolean;
    resolved: boolean;
}
export declare class SearchMetrics extends EventEmitter {
    private database?;
    private metrics;
    private cacheMetrics;
    private alertRules;
    private activeAlerts;
    private metricsBuffer;
    private bufferFlushInterval;
    private maxMetricsInMemory;
    private alertCooldownPeriod;
    constructor(database?: Database.Database);
    recordMetric(operation: string, duration: number, success?: boolean, metadata?: any): void;
    recordCacheMetrics(layer: string, level: number, hitRate: number, averageAccessTime: number, memoryUsage?: number): void;
    getSearchAnalytics(timeRange?: '1h' | '24h' | '7d' | '30d'): Promise<SearchAnalytics>;
    getRealTimeMetrics(): {
        currentQPS: number;
        averageResponseTime: number;
        cacheHitRate: number;
        activeAlerts: PerformanceAlert[];
        systemHealth: 'excellent' | 'good' | 'warning' | 'critical';
        bottlenecks: string[];
    };
    getCacheLayerMetrics(): CacheMetrics[];
    createAlertRule(name: string, condition: string, threshold: number, severity: AlertRule['severity']): void;
    getOptimizationRecommendations(): Array<{
        category: 'cache' | 'query' | 'system' | 'database';
        priority: 'high' | 'medium' | 'low';
        recommendation: string;
        impact: string;
        effort: 'low' | 'medium' | 'high';
    }>;
    exportMetrics(format: 'json' | 'csv', timeRange?: '1h' | '24h' | '7d' | '30d'): Promise<string>;
    private initializeMetrics;
    private setupAlertRules;
    private startMetricsCollection;
    private flushMetricsBuffer;
    private checkPerformanceAlerts;
    private checkCacheAlerts;
    private triggerAlert;
    private getMetricsInTimeRange;
    private getCutoffTime;
    private average;
    private calculateOverallCacheHitRate;
    private assessSystemHealth;
    private identifyPerformanceBottlenecks;
    private getSeverityWeight;
    private getPopularQueries;
    private getPerformanceTrends;
    private getEmptyAnalytics;
    private cleanupOldMetrics;
    private performanceHealthCheck;
    private autoResolveAlerts;
}
export default SearchMetrics;
//# sourceMappingURL=SearchMetrics.d.ts.map