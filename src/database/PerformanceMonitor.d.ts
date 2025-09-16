import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
export interface PerformanceMetrics {
    timestamp: number;
    operation: string;
    duration: number;
    recordsProcessed: number;
    cacheHit: boolean;
    indexesUsed: string[];
    queryPlan?: string;
    memoryUsage: number;
    cpuUsage?: number;
}
export interface PerformanceAlert {
    level: 'warning' | 'critical';
    message: string;
    metric: string;
    threshold: number;
    actual: number;
    timestamp: number;
    suggestions: string[];
}
export interface PerformanceReport {
    period: {
        start: number;
        end: number;
        duration: number;
    };
    summary: {
        totalOperations: number;
        averageResponseTime: number;
        slowOperations: number;
        cacheHitRate: number;
        errorRate: number;
    };
    breakdown: {
        byOperation: Map<string, OperationStats>;
        byHour: Map<number, HourlyStats>;
        slowestQueries: PerformanceMetrics[];
    };
    recommendations: string[];
    alerts: PerformanceAlert[];
}
interface OperationStats {
    count: number;
    totalTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
    errorCount: number;
    cacheHits: number;
}
interface HourlyStats {
    hour: number;
    operations: number;
    averageTime: number;
    errorCount: number;
}
export interface MonitorConfig {
    slowQueryThreshold: number;
    criticalThreshold: number;
    memoryAlertThreshold: number;
    sampleRate: number;
    retentionDays: number;
    enableRealTimeAlerts: boolean;
    enableQueryPlanCapture: boolean;
}
export declare class PerformanceMonitor extends EventEmitter {
    private db;
    private config;
    private metrics;
    private alerts;
    private isMonitoring;
    private monitoringInterval?;
    private startTime;
    private readonly THRESHOLDS;
    constructor(db: Database.Database, config?: Partial<MonitorConfig>);
    private initializeMonitoring;
    private createMonitoringTables;
    startMonitoring(): void;
    stopMonitoring(): void;
    recordMetric(operation: string, duration: number, options?: {
        recordsProcessed?: number;
        cacheHit?: boolean;
        indexesUsed?: string[];
        queryPlan?: string;
    }): void;
    measureOperation<T>(operation: string, fn: () => Promise<T> | T, options?: {
        recordsProcessed?: number;
        expectedCacheHit?: boolean;
    }): Promise<T>;
    generateReport(startTime?: number, endTime?: number): PerformanceReport;
    getRealTimeStatus(): {
        isHealthy: boolean;
        currentLoad: number;
        averageResponseTime: number;
        activeAlerts: number;
        cacheHitRate: number;
        memoryUsage: number;
    };
    getPerformanceTrends(hours?: number): {
        responseTime: Array<{
            time: number;
            value: number;
        }>;
        throughput: Array<{
            time: number;
            value: number;
        }>;
        errorRate: Array<{
            time: number;
            value: number;
        }>;
        cacheHitRate: Array<{
            time: number;
            value: number;
        }>;
    };
    getSlowQueries(limit?: number): Array<{
        operation: string;
        duration: number;
        frequency: number;
        timestamp: number;
        queryPlan?: string;
        recommendations: string[];
    }>;
    private persistMetric;
    private checkMetricForAlerts;
    private persistAlert;
    private collectSystemMetrics;
    private checkPerformanceThresholds;
    private cleanupOldMetrics;
    private getMetricsForPeriod;
    private getAlertsForPeriod;
    private calculateSummaryStats;
    private calculateBreakdownStats;
    private generateRecommendations;
    private getCurrentMemoryUsage;
    private getCurrentCPUUsage;
    private getOperationFrequency;
    private getQueryRecommendations;
}
export {};
//# sourceMappingURL=PerformanceMonitor.d.ts.map