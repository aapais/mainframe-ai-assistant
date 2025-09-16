import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
interface OptimizationStrategy {
    name: string;
    category: 'query' | 'cache' | 'memory' | 'bundle' | 'index';
    priority: 'high' | 'medium' | 'low';
    impact: number;
    risk: number;
    effort: number;
    enabled: boolean;
    execute: () => Promise<OptimizationResult>;
}
interface OptimizationResult {
    success: boolean;
    improvement: number;
    metrics: {
        beforeMetrics: PerformanceSnapshot;
        afterMetrics: PerformanceSnapshot;
    };
    error?: string;
    recommendations?: string[];
}
interface PerformanceSnapshot {
    responseTime: number;
    throughput: number;
    memoryUsage: number;
    cacheHitRate: number;
    errorRate: number;
    cpuUsage: number;
    timestamp: Date;
}
interface QueryOptimization {
    query: string;
    currentPlan: string;
    suggestedIndexes: string[];
    estimatedImprovement: number;
    rewriteSuggestion?: string;
}
interface BundleAnalysis {
    totalSize: number;
    chunkSizes: Map<string, number>;
    unusedCode: string[];
    duplicateModules: string[];
    treeshakingOpportunities: string[];
}
export declare class PerformanceOptimizer extends EventEmitter {
    private db;
    private strategies;
    private optimizationHistory;
    private currentSnapshot;
    private isOptimizing;
    constructor(database: Database.Database);
    analyzePerformance(): Promise<{
        currentMetrics: PerformanceSnapshot;
        bottlenecks: string[];
        recommendations: OptimizationStrategy[];
        quickWins: OptimizationStrategy[];
    }>;
    optimizeStrategy(strategyName: string): Promise<OptimizationResult>;
    autoOptimize(aggressiveness?: 'conservative' | 'moderate' | 'aggressive'): Promise<OptimizationResult[]>;
    getRecommendationsForMetric(metric: string): OptimizationStrategy[];
    optimizeQueries(): Promise<QueryOptimization[]>;
    analyzeBundleSize(): Promise<BundleAnalysis>;
    profileMemoryUsage(): Promise<{
        heapUsage: NodeJS.MemoryUsage;
        leaks: Array<{
            type: string;
            count: number;
            size: number;
        }>;
        recommendations: string[];
    }>;
    getOptimizationHistory(): {
        history: OptimizationResult[];
        trends: {
            totalImprovements: number;
            averageImprovement: number;
            successRate: number;
            topStrategies: Array<{
                name: string;
                avgImprovement: number;
                count: number;
            }>;
        };
    };
    private initializeStrategies;
    private capturePerformanceSnapshot;
    private identifyBottlenecks;
    private isStrategyApplicable;
    private calculateImprovement;
    private optimizeIndexes;
    private optimizeQueryRewriting;
    private optimizeCacheStrategy;
    private implementCachePreloading;
    private optimizeMemoryPools;
    private tuneGarbageCollection;
    private implementCodeSplitting;
    private optimizeTreeShaking;
    private measureAverageResponseTime;
    private measureThroughput;
    private measureCacheHitRate;
    private measureErrorRate;
    private measureCPUUsage;
    private getSlowQueries;
    private analyzeQueryExecution;
    private startContinuousMonitoring;
}
export {};
//# sourceMappingURL=PerformanceOptimizer.d.ts.map