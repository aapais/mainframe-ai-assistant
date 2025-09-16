import { EventEmitter } from 'events';
export interface OptimizationMetrics {
    timestamp: number;
    category: 'performance' | 'search' | 'cache' | 'database' | 'memory';
    metric: string;
    value: number;
    unit: string;
    trend: 'improving' | 'degrading' | 'stable';
    severity: 'low' | 'medium' | 'high' | 'critical';
}
export interface OptimizationRecommendation {
    id: string;
    timestamp: number;
    category: string;
    title: string;
    description: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
    effort: 'low' | 'medium' | 'high';
    roi: number;
    priority: number;
    implementation: {
        steps: string[];
        estimatedTime: string;
        prerequisites: string[];
        risks: string[];
    };
    metrics: {
        before: OptimizationMetrics[];
        expectedAfter: OptimizationMetrics[];
        measurableGoals: string[];
    };
    status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
    appliedAt?: number;
    results?: {
        actualImprovement: number;
        metricsAfter: OptimizationMetrics[];
        success: boolean;
        notes: string;
    };
}
export interface OptimizationConfig {
    enableAutoRecommendations: boolean;
    monitoringInterval: number;
    thresholds: {
        performanceWarning: number;
        performanceCritical: number;
        cacheHitRatio: number;
        queryResponseTime: number;
        memoryUsage: number;
    };
    categories: string[];
    minROI: number;
    maxRecommendations: number;
}
export declare class OptimizationEngine extends EventEmitter {
    private config;
    private algorithmTuner;
    private indexAdvisor;
    private cacheOptimizer;
    private bottleneckDetector;
    private recommendations;
    private metrics;
    private monitoringInterval?;
    private analysisHistory;
    constructor(config?: Partial<OptimizationConfig>);
    initialize(): Promise<void>;
    startMonitoring(): void;
    stopMonitoring(): void;
    performAnalysis(): Promise<OptimizationRecommendation[]>;
    private generateRecommendations;
    private formatRecommendation;
    private calculateROI;
    private calculatePriority;
    private filterAndPrioritizeRecommendations;
    getRecommendations(status?: string): OptimizationRecommendation[];
    getRecommendation(id: string): OptimizationRecommendation | undefined;
    applyRecommendation(id: string): Promise<boolean>;
    private measureOptimizationResults;
    private calculateImprovement;
    private getRecentMetrics;
    getDashboardData(): any;
    private calculateTrends;
    private getImprovementHistory;
    private getCategoryBreakdown;
    private setupEventHandlers;
    destroy(): Promise<void>;
}
export default OptimizationEngine;
//# sourceMappingURL=OptimizationEngine.d.ts.map