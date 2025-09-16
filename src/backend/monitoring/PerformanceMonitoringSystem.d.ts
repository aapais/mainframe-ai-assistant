import { EventEmitter } from 'events';
import { IBaseService, ServiceContext, ServiceHealth } from '../core/interfaces/ServiceInterfaces';
export interface IPerformanceMonitor extends IBaseService {
    recordOperation(operation: string, success: boolean, duration: number, metadata?: any): void;
    recordError(operation: string, error: Error, metadata?: any): void;
    recordSlowQuery(operation: string, duration: number, metadata?: any): void;
    recordMetric(name: string, value: number, tags?: Record<string, string>): void;
    recordCounter(name: string, increment?: number, tags?: Record<string, string>): void;
    recordHistogram(name: string, value: number, tags?: Record<string, string>): void;
    recordGauge(name: string, value: number, tags?: Record<string, string>): void;
    recordCacheHit(operation: string, layer?: string): void;
    recordCacheMiss(operation: string): void;
    recordDatabaseQuery(query: string, duration: number, rowCount?: number): void;
    recordConnectionPoolStats(stats: ConnectionPoolStats): void;
    recordMemoryUsage(usage: MemoryUsage): void;
    recordCPUUsage(usage: number): void;
    recordDiskUsage(usage: DiskUsage): void;
    getMetrics(timeRange?: TimeRange): Promise<MetricsReport>;
    getOperationStats(operation: string): Promise<OperationStats>;
    getSystemHealth(): Promise<SystemHealthReport>;
    exportMetrics(format: 'json' | 'csv' | 'prometheus'): Promise<string>;
    checkAlerts(): Promise<Alert[]>;
    addAlertRule(rule: AlertRule): void;
    removeAlertRule(ruleId: string): void;
}
export interface IAlertManager {
    triggerAlert(type: string, severity: AlertSeverity, message: string, data?: any): Promise<void>;
    resolveAlert(alertId: string): Promise<void>;
    getActiveAlerts(): Promise<Alert[]>;
    getAlertHistory(timeRange?: TimeRange): Promise<Alert[]>;
}
export declare class PerformanceMonitor extends EventEmitter implements IPerformanceMonitor {
    readonly name = "performance-monitor";
    readonly version = "1.0.0";
    readonly dependencies: string[];
    private readonly metricsStore;
    private readonly alertManager;
    private readonly config;
    private readonly collectors;
    private readonly alertRules;
    private context;
    private metricsCollectionInterval?;
    private healthCheckInterval?;
    constructor(config: MonitoringConfig);
    initialize(context: ServiceContext): Promise<void>;
    shutdown(): Promise<void>;
    healthCheck(): Promise<ServiceHealth>;
    recordOperation(operation: string, success: boolean, duration: number, metadata?: any): void;
    recordError(operation: string, error: Error, metadata?: any): void;
    recordSlowQuery(operation: string, duration: number, metadata?: any): void;
    recordMetric(name: string, value: number, tags?: Record<string, string>): void;
    recordCounter(name: string, increment?: number, tags?: Record<string, string>): void;
    recordHistogram(name: string, value: number, tags?: Record<string, string>): void;
    recordGauge(name: string, value: number, tags?: Record<string, string>): void;
    recordCacheHit(operation: string, layer?: string): void;
    recordCacheMiss(operation: string): void;
    recordDatabaseQuery(query: string, duration: number, rowCount?: number): void;
    recordConnectionPoolStats(stats: ConnectionPoolStats): void;
    recordMemoryUsage(usage: MemoryUsage): void;
    recordCPUUsage(usage: number): void;
    recordDiskUsage(usage: DiskUsage): void;
    getOperationStats(operation: string): Promise<OperationStats>;
    getSystemHealth(): Promise<SystemHealthReport>;
    exportMetrics(format: 'json' | 'csv' | 'prometheus'): Promise<string>;
    checkAlerts(): Promise<Alert[]>;
    addAlertRule(rule: AlertRule): void;
    removeAlertRule(ruleId: string): void;
    resetMetrics(): void;
    private initializeCollectors;
    private setupDefaultAlertRules;
    private getOrCreateCollector;
    private getOrCreateHistogramCollector;
    private startMetricsCollection;
    private startHealthChecks;
    private collectSystemMetrics;
    private getCPUUsage;
    private performHealthChecks;
    private checkOperationAlerts;
    private triggerAlert;
    private sanitizeQuery;
    private getServicesHealth;
    private aggregateOperationMetrics;
    private aggregateErrorMetrics;
    private aggregateCustomMetrics;
    private calculateAverageResponseTime;
    private evaluateAlertRule;
    private exportToCSV;
    private exportToPrometheus;
}
interface MonitoringConfig {
    collection: {
        enabled: boolean;
        interval: number;
    };
    storage: StorageConfig;
    alerts: AlertConfig;
    healthChecks: {
        enabled: boolean;
        interval: number;
    };
    slowQueryThreshold: number;
}
interface StorageConfig {
    type: 'memory' | 'sqlite' | 'file';
    path?: string;
    retention: number;
}
interface AlertConfig {
    enabled: boolean;
    errorRateThreshold: number;
    memoryThreshold: number;
    cpuThreshold: number;
    diskThreshold: number;
    notifications: {
        enabled: boolean;
        channels: string[];
    };
}
interface TimeRange {
    start: Date;
    end: Date;
}
interface ConnectionPoolStats {
    active: number;
    idle: number;
    total: number;
    waiting: number;
}
interface MemoryUsage {
    used: number;
    total: number;
}
interface DiskUsage {
    used: number;
    total: number;
}
interface SystemMetrics {
    memory: {
        used: number;
        total: number;
        percentage: number;
    };
    cpu: {
        percentage: number;
    };
    disk: {
        used: number;
        total: number;
        percentage: number;
    };
}
interface MetricsReport {
    timeRange: TimeRange;
    operations: any;
    errors: any;
    slowQueries: number;
    custom: any;
    summary: {
        totalOperations: number;
        totalErrors: number;
        errorRate: number;
        averageResponseTime: number;
    };
    generatedAt: Date;
}
interface OperationStats {
    count: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    errorRate: number;
    successRate: number;
    throughput: number;
    cacheHitRate?: number;
}
interface SystemHealthReport {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, ServiceHealth>;
    resources: SystemMetrics;
    alerts: Alert[];
    timestamp: Date;
}
interface Alert {
    id: string;
    type: string;
    severity: AlertSeverity;
    message: string;
    data?: any;
    timestamp: Date;
    resolved: boolean;
    resolvedAt?: Date;
}
interface AlertRule {
    id: string;
    name: string;
    type: string;
    severity: AlertSeverity;
    condition: {
        metric: string;
        operator: '>' | '<' | '=' | '>=' | '<=';
        threshold: number;
        timeWindow: number;
    };
    message: string;
}
type AlertSeverity = 'info' | 'warning' | 'critical';
export { PerformanceMonitor as default };
//# sourceMappingURL=PerformanceMonitoringSystem.d.ts.map