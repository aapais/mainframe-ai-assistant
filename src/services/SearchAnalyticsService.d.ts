import { EventEmitter } from 'events';
import { SearchResult, SearchOptions } from '../types/services';
export interface AnalyticsEvent {
    id: string;
    type: AnalyticsEventType;
    timestamp: number;
    userId?: string;
    sessionId?: string;
    data: any;
    metadata?: {
        userAgent?: string;
        platform?: string;
        version?: string;
        experimentId?: string;
    };
}
export type AnalyticsEventType = 'search_performed' | 'search_results_viewed' | 'result_clicked' | 'result_rated' | 'search_refined' | 'export_performed' | 'filter_applied' | 'sort_changed' | 'page_navigation' | 'error_occurred' | 'performance_metric';
export interface SearchPerformanceMetrics {
    query: string;
    searchTime: number;
    resultCount: number;
    cacheHit: boolean;
    aiUsed: boolean;
    fallbackUsed: boolean;
    indexSize?: number;
    queryComplexity?: number;
}
export interface UserBehaviorMetrics {
    userId: string;
    sessionId: string;
    searchCount: number;
    averageSearchTime: number;
    clickThroughRate: number;
    refinementRate: number;
    exportCount: number;
    averageSessionDuration: number;
    popularQueries: Array<{
        query: string;
        count: number;
    }>;
    preferredCategories: Array<{
        category: string;
        count: number;
    }>;
}
export interface SearchQualityMetrics {
    query: string;
    resultRelevance: number;
    userSatisfaction?: number;
    zeroResultRate: number;
    clickPosition: number;
    dwellTime: number;
    refinementNeeded: boolean;
    expertRating?: number;
}
export interface SystemHealthMetrics {
    searchLatency: {
        p50: number;
        p95: number;
        p99: number;
        average: number;
    };
    throughput: {
        requestsPerSecond: number;
        requestsPerMinute: number;
        requestsPerHour: number;
    };
    errorRate: {
        total: number;
        percentage: number;
        byType: Record<string, number>;
    };
    cachePerformance: {
        hitRate: number;
        missRate: number;
        evictionRate: number;
    };
    resourceUsage: {
        memoryUsage: number;
        cpuUsage: number;
        indexSize: number;
    };
}
export interface AlertRule {
    id: string;
    name: string;
    condition: (metrics: SystemHealthMetrics) => boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
    cooldownPeriod: number;
    lastTriggered?: number;
}
export interface AnalyticsConfig {
    enableTracking: boolean;
    enablePerformanceMonitoring: boolean;
    enableUserBehaviorTracking: boolean;
    enableErrorTracking: boolean;
    batchSize: number;
    batchTimeout: number;
    retentionPeriod: number;
    anonymizeData: boolean;
    enableExport: boolean;
}
export declare class SearchAnalyticsService extends EventEmitter {
    private config;
    private eventBuffer;
    private performanceBuffer;
    private userSessions;
    private qualityMetrics;
    private systemMetrics;
    private alertRules;
    private batchTimer;
    private metricsTimer;
    constructor(config?: Partial<AnalyticsConfig>);
    trackSearch(query: string, results: SearchResult[], options: SearchOptions, performanceMetrics: SearchPerformanceMetrics): void;
    trackResultClick(result: SearchResult, position: number, query: string, dwellTime?: number): void;
    trackResultRating(result: SearchResult, rating: number, query: string, feedback?: string): void;
    trackSearchRefinement(originalQuery: string, refinedQuery: string, refinementType: 'filter' | 'sort' | 'modify'): void;
    trackExport(format: string, resultCount: number, query?: string): void;
    trackError(error: Error, context: {
        operation: string;
        query?: string;
        userId?: string;
    }): void;
    getPerformanceMetrics(timeRange?: {
        from: number;
        to: number;
    }): {
        searchLatency: SystemHealthMetrics['searchLatency'];
        throughput: SystemHealthMetrics['throughput'];
        cachePerformance: SystemHealthMetrics['cachePerformance'];
    };
    getUserBehaviorMetrics(userId?: string): UserBehaviorMetrics[];
    getSearchQualityMetrics(query?: string): SearchQualityMetrics[];
    getSystemHealth(): SystemHealthMetrics;
    generateReport(timeRange: {
        from: number;
        to: number;
    }, format?: 'json' | 'csv'): any;
    addAlertRule(rule: Omit<AlertRule, 'lastTriggered'>): void;
    exportData(format: 'json' | 'csv' | 'excel', timeRange?: {
        from: number;
        to: number;
    }): Promise<Blob>;
    private trackEvent;
    private trackPerformanceMetric;
    private updateUserBehavior;
    private trackSearchQuality;
    private updateSearchQuality;
    private startBatchProcessing;
    private processBatch;
    private sendToBackend;
    private startMetricsCollection;
    private collectSystemMetrics;
    private checkAlerts;
    private setupDefaultAlerts;
    private initializeSystemMetrics;
    private updateSystemMetrics;
    private updateSystemErrorMetrics;
    private anonymizeQuery;
    private sanitizeOptions;
    private sanitizeFeedback;
    private calculateRelevanceScore;
    private percentile;
    private filterMetricsByTimeRange;
    private updatePopularQueries;
    private aggregateUserBehavior;
    private aggregateSearchQuality;
    private getTopQueries;
    private analyzeErrors;
    private mergePopularQueries;
    private convertToCSV;
    private generateEventId;
    private getCurrentUserId;
    private getCurrentSessionId;
    destroy(): void;
}
export default SearchAnalyticsService;
//# sourceMappingURL=SearchAnalyticsService.d.ts.map