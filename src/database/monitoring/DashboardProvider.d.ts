import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import { PerformanceMonitor } from './PerformanceMonitor';
import { MetricsCollector } from './MetricsCollector';
import { HealthCheck } from './HealthCheck';
import { QueryAnalyzer } from './QueryAnalyzer';
export interface DashboardMetrics {
    timestamp: number;
    performance: {
        avgResponseTime: number;
        throughput: number;
        errorRate: number;
        cacheHitRate: number;
        activeConnections: number;
        memoryUsage: number;
    };
    health: {
        overall: 'healthy' | 'warning' | 'critical' | 'unknown';
        score: number;
        activeAlerts: number;
        lastCheck: number;
    };
    queries: {
        totalQueries: number;
        slowQueries: number;
        topSlowQueries: Array<{
            query: string;
            avgDuration: number;
            occurrences: number;
        }>;
    };
    system: {
        cpuUsage: number;
        memoryUsage: number;
        diskUsage: number;
        uptime: number;
    };
}
export interface TimeSeriesData {
    labels: string[];
    datasets: Array<{
        label: string;
        data: Array<{
            x: number;
            y: number;
        }>;
        borderColor: string;
        backgroundColor: string;
        fill: boolean;
    }>;
}
export interface AlertSummary {
    total: number;
    critical: number;
    warning: number;
    info: number;
    recent: Array<{
        id: string;
        severity: 'critical' | 'warning' | 'info';
        message: string;
        timestamp: number;
        resolved: boolean;
    }>;
}
export interface CapacityPlanningData {
    projections: {
        storage: {
            current: number;
            projected30Days: number;
            projected90Days: number;
            growthRate: number;
        };
        connections: {
            current: number;
            peak: number;
            projected: number;
            utilization: number;
        };
        queries: {
            currentQPS: number;
            peakQPS: number;
            projectedQPS: number;
            growthTrend: 'increasing' | 'stable' | 'decreasing';
        };
    };
    recommendations: Array<{
        type: 'storage' | 'performance' | 'scaling';
        urgency: 'low' | 'medium' | 'high';
        description: string;
        timeline: string;
    }>;
}
export interface DashboardConfig {
    refreshInterval: number;
    retentionPeriod: number;
    enableRealTime: boolean;
    enableAlerts: boolean;
    enableTrends: boolean;
    enableCapacityPlanning: boolean;
    customMetrics: string[];
    alertThresholds: {
        responseTime: number;
        errorRate: number;
        memoryUsage: number;
        diskUsage: number;
    };
}
export declare class DashboardProvider extends EventEmitter {
    private db;
    private config;
    private performanceMonitor;
    private metricsCollector;
    private healthCheck;
    private queryAnalyzer;
    private refreshTimer?;
    private isRunning;
    private lastMetrics?;
    private metricsHistory;
    constructor(db: Database.Database, performanceMonitor: PerformanceMonitor, metricsCollector: MetricsCollector, healthCheck: HealthCheck, queryAnalyzer: QueryAnalyzer, config?: Partial<DashboardConfig>);
    private buildConfig;
    private initializeProvider;
    private createDashboardTables;
    private loadMetricsHistory;
    startDataCollection(): void;
    stopDataCollection(): void;
    private collectMetrics;
    private storeMetrics;
    private checkForAlerts;
    private createAlert;
    private updateCapacityPlanning;
    private storeCapacityProjection;
    getCurrentMetrics(): DashboardMetrics | null;
    getMetricsHistory(hours?: number): DashboardMetrics[];
    getTimeSeriesData(metric: 'responseTime' | 'throughput' | 'errorRate' | 'cacheHitRate' | 'memoryUsage', hours?: number): TimeSeriesData;
    private getMetricColor;
    getAlertSummary(hours?: number): AlertSummary;
    getCapacityPlanningData(): CapacityPlanningData;
    getPrometheusMetrics(): string;
    getGrafanaDataSource(): any;
    handleGrafanaQuery(query: any): any;
    resolveAlert(alertId: string): boolean;
    getDashboardConfig(): DashboardConfig;
    updateDashboardConfig(newConfig: Partial<DashboardConfig>): void;
    private cleanupOldData;
    destroy(): void;
}
//# sourceMappingURL=DashboardProvider.d.ts.map