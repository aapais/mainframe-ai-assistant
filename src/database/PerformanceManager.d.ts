import { KnowledgeDB } from './KnowledgeDB';
import { ConnectionPool } from './ConnectionPool';
import { QueryCache } from './QueryCache';
import { EventEmitter } from 'events';
export interface PerformanceMetrics {
    avgQueryTime: number;
    cacheHitRate: number;
    indexUtilization: number;
    connectionPoolUtilization: number;
    totalQueries: number;
    slowQueries: number;
    optimizationsApplied: number;
    lastBenchmarkScore: number;
}
export interface PerformanceThresholds {
    maxQueryTime: number;
    minCacheHitRate: number;
    maxSlowQueryPercent: number;
    benchmarkIntervalHours: number;
}
export interface PerformanceAlert {
    type: 'slow_query' | 'low_cache_hit' | 'high_load' | 'optimization_needed';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    recommendation: string;
    timestamp: Date;
    metrics?: Partial<PerformanceMetrics>;
}
export declare class PerformanceManager extends EventEmitter {
    private knowledgeDB;
    private connectionPool;
    private queryCache;
    private indexStrategy;
    private optimizationEngine;
    private benchmark;
    private metrics;
    private thresholds;
    private monitoringInterval?;
    private benchmarkInterval?;
    private queryTimes;
    private lastBenchmark;
    constructor(knowledgeDB: KnowledgeDB, connectionPool: ConnectionPool, queryCache: QueryCache);
    initialize(): Promise<void>;
    recordQuery(queryTime: number, cacheHit: boolean): void;
    getMetrics(): PerformanceMetrics;
    updateThresholds(thresholds: Partial<PerformanceThresholds>): void;
    runBenchmark(isBaseline?: boolean): Promise<void>;
    applyAutomaticOptimizations(benchmarkResults?: any): Promise<void>;
    generateReport(): {
        summary: PerformanceMetrics;
        analysis: string[];
        recommendations: string[];
        alerts: PerformanceAlert[];
    };
    private startMonitoring;
    private scheduleBenchmarks;
    private updateMetrics;
    private checkThresholds;
    private calculateBenchmarkScore;
    private setupEventListeners;
    cleanup(): Promise<void>;
    exportPerformanceData(): {
        metrics: PerformanceMetrics;
        thresholds: PerformanceThresholds;
        queryTimes: number[];
        lastBenchmark: Date;
    };
}
export declare class PerformanceManagerFactory {
    static create(knowledgeDB: KnowledgeDB, connectionPool: ConnectionPool, queryCache: QueryCache, options?: {
        thresholds?: Partial<PerformanceThresholds>;
        autoInitialize?: boolean;
    }): Promise<PerformanceManager>;
}
//# sourceMappingURL=PerformanceManager.d.ts.map