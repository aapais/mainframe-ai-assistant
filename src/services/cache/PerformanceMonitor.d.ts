import { EventEmitter } from 'events';
import { CacheOrchestrator } from './CacheOrchestrator';
import { CDNIntegration } from './CDNIntegration';
export interface PerformanceMetrics {
    cache: {
        hitRate: number;
        missRate: number;
        avgResponseTime: number;
        memoryUsage: number;
        operations: {
            total: number;
            hits: number;
            misses: number;
            sets: number;
            deletes: number;
        };
    };
    cdn: {
        enabled: boolean;
        hitRate: number;
        avgResponseTime: number;
        bandwidth: number;
        requests: number;
    };
    application: {
        avgPageLoadTime: number;
        avgApiResponseTime: number;
        totalRequests: number;
        errorRate: number;
    };
    system: {
        cpuUsage: number;
        memoryUsage: number;
        diskUsage: number;
        networkLatency: number;
    };
}
export interface PerformanceAlert {
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: 'performance' | 'availability' | 'error';
    message: string;
    threshold: number;
    currentValue: number;
    timestamp: number;
    resolved: boolean;
}
export interface PerformanceTarget {
    metric: string;
    target: number;
    warning: number;
    critical: number;
    unit: string;
}
export declare class PerformanceMonitor extends EventEmitter {
    private cacheOrchestrator;
    private cdnIntegration?;
    private metrics;
    private alerts;
    private targets;
    private monitoring;
    private monitoringInterval?;
    private metricsHistory;
    private maxHistorySize;
    constructor(cacheOrchestrator: CacheOrchestrator, cdnIntegration?: CDNIntegration);
    startMonitoring(interval?: number): void;
    stopMonitoring(): void;
    getMetrics(): PerformanceMetrics;
    getMetricsHistory(hours?: number): PerformanceMetrics[];
    getActiveAlerts(): PerformanceAlert[];
    getAllAlerts(): PerformanceAlert[];
    setPerformanceTarget(target: PerformanceTarget): void;
    checkPerformanceTargets(): {
        passed: number;
        failed: number;
        targets: Array<{
            metric: string;
            target: number;
            current: number;
            status: 'pass' | 'warning' | 'critical';
            unit: string;
        }>;
    };
    generateReport(timeframe?: '1h' | '24h' | '7d'): {
        summary: {
            overallScore: number;
            cacheEfficiency: number;
            responseTimeGrade: 'A' | 'B' | 'C' | 'D' | 'F';
            availability: number;
        };
        details: {
            cache: any;
            performance: any;
            alerts: any;
        };
        recommendations: string[];
    };
    private collectMetrics;
    private collectApplicationMetrics;
    private collectSystemMetrics;
    private checkAlerts;
    private checkAlert;
    private initializeMetrics;
    private setupPerformanceTargets;
    private getMetricValue;
    private calculateAverage;
    private getMetricValueFromObject;
    private calculateResponseTimeGrade;
    private gradeToScore;
    private generateRecommendations;
}
//# sourceMappingURL=PerformanceMonitor.d.ts.map