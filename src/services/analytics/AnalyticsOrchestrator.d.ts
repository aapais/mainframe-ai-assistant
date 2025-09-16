import { EventEmitter } from 'events';
import { QueryPattern } from './QueryAnalyzer';
import { IntentClassification } from './SearchIntentClassifier';
import { ComplexityScore } from './QueryComplexityAnalyzer';
import { BehaviorPattern } from './UserBehaviorTracker';
export interface AnalyticsConfig {
    enableRealTimeTracking: boolean;
    enableABTesting: boolean;
    enablePredictiveAnalytics: boolean;
    dataRetentionDays: number;
    samplingRate: number;
    advancedFeatures: {
        enableBayesianAnalysis: boolean;
        enableMultivariateTesting: boolean;
        enableCohortAnalysis: boolean;
        enableStatisticalSignificanceTesting: boolean;
    };
    queryAnalytics: {
        enablePatternDetection: boolean;
        enableIntentClassification: boolean;
        enableComplexityAnalysis: boolean;
        enableFailureDetection: boolean;
        enableBehaviorTracking: boolean;
        patternCacheSize: number;
        complexityThreshold: number;
    };
}
export interface UnifiedAnalytics {
    effectiveness: {
        ctr: number;
        engagement: number;
        relevance: number;
        satisfaction: number;
        conversion: number;
    };
    queryAnalytics: {
        topPatterns: QueryPattern[];
        intentDistribution: Record<string, number>;
        averageComplexity: number;
        failureRate: number;
        mostCommonFailures: string[];
        behaviorPatterns: BehaviorPattern[];
    };
    trends: {
        period: string;
        metrics: Record<string, number>;
    }[];
    insights: {
        type: 'opportunity' | 'alert' | 'recommendation';
        title: string;
        description: string;
        impact: 'high' | 'medium' | 'low';
        actionItems: string[];
    }[];
    experiments: {
        activeTests: number;
        successfulTests: number;
        averageImprovement: number;
        recommendations: string[];
    };
}
export interface SearchExperience {
    userId: string;
    sessionId: string;
    query: string;
    results: Array<{
        id: string;
        title: string;
        snippet: string;
        url: string;
        position: number;
        relevanceScore?: number;
    }>;
    interactions: Array<{
        type: 'click' | 'hover' | 'scroll' | 'dwell' | 'bookmark' | 'share';
        resultId?: string;
        timestamp: number;
        data?: Record<string, any>;
    }>;
    satisfaction?: {
        rating: number;
        feedback: string;
        timestamp: number;
    };
    abTestAssignments?: Array<{
        testId: string;
        variantId: string;
        configuration: Record<string, any>;
    }>;
}
export declare class AnalyticsOrchestrator extends EventEmitter {
    private effectivenessTracker;
    private relevanceScorer;
    private satisfactionMetrics;
    private conversionTracker;
    private abTestingFramework;
    private queryAnalyzer;
    private intentClassifier;
    private complexityAnalyzer;
    private failureDetector;
    private behaviorTracker;
    private config;
    private isInitialized;
    private batchQueue;
    private batchProcessingInterval;
    constructor(config?: Partial<AnalyticsConfig>);
    private initializeServices;
    private setupEventListeners;
    private handleCrossServiceEvent;
    trackSearchExperience(experience: SearchExperience): Promise<void>;
    private trackQueryAnalytics;
    getUnifiedAnalytics(timeRange?: [number, number]): Promise<UnifiedAnalytics>;
    createSearchAlgorithmTest(name: string, description: string, variants: Array<{
        name: string;
        algorithmConfig: Record<string, any>;
        trafficWeight: number;
    }>): Promise<string>;
    getSearchConfiguration(userId: string): Record<string, any>;
    exportAnalyticsData(format: 'json' | 'csv', timeRange?: [number, number], includePersonalData?: boolean): Promise<string>;
    private generateInsights;
    private generateTrendsData;
    private startBatchProcessing;
    private processBatchQueue;
    private addToBatch;
    private getQueryAnalyticsData;
    getQueryInsights(query: string): Promise<{
        patterns: QueryPattern[];
        intent: IntentClassification;
        complexity: ComplexityScore;
        predictedFailure: boolean;
        recommendations: string[];
    }>;
    private generateQueryRecommendations;
    destroy(): void;
}
export default AnalyticsOrchestrator;
//# sourceMappingURL=AnalyticsOrchestrator.d.ts.map