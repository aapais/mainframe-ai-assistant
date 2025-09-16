import { EventEmitter } from 'events';
export interface SearchMetrics {
    timestamp: number;
    query: string;
    responseTime: number;
    resultsCount: number;
    relevanceScore: number;
    algorithm: string;
    parameters: Record<string, any>;
    userInteraction?: {
        clickThroughRate: number;
        dwellTime: number;
        refinements: number;
    };
}
export interface AlgorithmConfig {
    fuzzySearch: {
        threshold: number;
        distance: number;
        includeScore: boolean;
        includeMatches: boolean;
    };
    indexing: {
        batchSize: number;
        updateFrequency: number;
        compressionLevel: number;
    };
    scoring: {
        relevanceWeight: number;
        freshnessWeight: number;
        popularityWeight: number;
        personalizedWeight: number;
    };
    performance: {
        maxResults: number;
        cacheSize: number;
        cacheTTL: number;
        timeoutMs: number;
    };
}
export interface TuningRecommendation {
    id: string;
    timestamp: number;
    algorithm: string;
    parameter: string;
    currentValue: any;
    recommendedValue: any;
    reason: string;
    expectedImprovement: number;
    confidence: number;
    impact: 'low' | 'medium' | 'high';
    effort: 'low' | 'medium' | 'high';
    testData: {
        sampleQueries: string[];
        expectedResults: any[];
        benchmarkMetrics: SearchMetrics[];
    };
}
export declare class AlgorithmTuner extends EventEmitter {
    private metrics;
    private config;
    private performanceBaselines;
    private tuningHistory;
    private activeTuning;
    constructor();
    initialize(): Promise<void>;
    recordSearchMetrics(metrics: SearchMetrics): void;
    analyzePerformance(): Promise<any[]>;
    getOptimizationRecommendations(metrics: any[]): Promise<TuningRecommendation[]>;
    private analyzeFuzzySearchParameters;
    private analyzeScoringWeights;
    private analyzePerformanceParameters;
    private analyzeIndexingStrategy;
    applyOptimization(recommendation: any): Promise<boolean>;
    private testOptimization;
    private simulateSearchWithConfig;
    private getConfigValue;
    private setConfigValue;
    private getRecentMetrics;
    private calculateAverageResponseTime;
    private calculateAverageRelevanceScore;
    private analyzeQueryPatterns;
    private analyzePerformanceTrends;
    private analyzeAlgorithmEfficiency;
    private analyzeUserEngagement;
    private analyzeCacheEfficiency;
    private analyzeUpdatePatterns;
    private extractSampleQueries;
    private extractCommonTerms;
    private categorizeQueries;
    private groupMetricsByHour;
    private groupMetricsByAlgorithm;
    private identifyPeakHours;
    private calculateTrendDirection;
    private calculateVolatility;
    private findDuplicateQueries;
    private createPerformanceMetric;
    private determineTrend;
    private determineSeverity;
    private establishBaselines;
    private startPerformanceMonitoring;
    private checkForImmediateOptimizations;
    destroy(): Promise<void>;
}
export default AlgorithmTuner;
//# sourceMappingURL=AlgorithmTuner.d.ts.map