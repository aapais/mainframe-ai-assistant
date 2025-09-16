import { EventEmitter } from 'events';
import { SearchPerformanceMonitor } from './SearchPerformanceMonitor';
import { PerformanceMonitor } from '../database/PerformanceMonitor';
import { CachePerformanceMonitor } from '../caching/CachePerformanceMonitor';
export interface DashboardWidget {
    id: string;
    title: string;
    type: 'metric' | 'chart' | 'table' | 'alert' | 'gauge';
    size: 'small' | 'medium' | 'large';
    refreshInterval: number;
    data: any;
    thresholds?: {
        warning: number;
        critical: number;
    };
}
export interface DashboardConfig {
    title: string;
    refreshInterval: number;
    widgets: DashboardWidget[];
    alerts: {
        enabled: boolean;
        soundEnabled: boolean;
        notificationTypes: string[];
    };
}
export interface DashboardData {
    timestamp: Date;
    summary: {
        slaCompliance: number;
        avgResponseTime: number;
        p95ResponseTime: number;
        queriesPerSecond: number;
        cacheHitRate: number;
        activeAlerts: number;
    };
    widgets: Record<string, any>;
    alerts: any[];
    trends: {
        responseTime: any[];
        throughput: any[];
        slaCompliance: any[];
    };
}
export declare class MonitoringDashboard extends EventEmitter {
    private searchMonitor;
    private performanceMonitor;
    private cacheMonitor;
    private config;
    private currentData;
    private refreshTimer?;
    constructor(searchMonitor: SearchPerformanceMonitor, performanceMonitor: PerformanceMonitor, cacheMonitor: CachePerformanceMonitor);
    start(): void;
    stop(): void;
    getCurrentData(): DashboardData | null;
    updateConfig(config: Partial<DashboardConfig>): void;
    getConfig(): DashboardConfig;
    exportData(format?: 'json' | 'csv'): string;
    getHealthSummary(): {
        overall: 'healthy' | 'warning' | 'critical';
        score: number;
        issues: string[];
        recommendations: string[];
    };
    private refreshData;
    private buildSLAGaugeWidget;
    private buildResponseTimeChartWidget;
    private buildThroughputWidget;
    private buildCacheMetricsWidget;
    private buildTopQueriesWidget;
    private buildSlowQueriesWidget;
    private buildAlertsTableWidget;
    private buildSystemHealthWidget;
    private createDefaultConfig;
    private setupEventListeners;
    private formatAge;
    private convertToCSV;
}
export declare const DashboardUtils: {
    formatMetric: (value: number, format: string) => string;
    formatBytes: (bytes: number) => string;
    getStatusColor: (value: number, thresholds: {
        warning: number;
        critical: number;
    }) => string;
    calculateTrend: (current: number, previous: number) => {
        direction: string;
        percentage: number;
    };
};
//# sourceMappingURL=MonitoringDashboard.d.ts.map