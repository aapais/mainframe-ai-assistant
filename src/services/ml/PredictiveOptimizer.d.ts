import { PredictiveInsight, MLModel, TrainingData, ModelEvaluation } from '../../types/ml';
interface PredictionFeatures {
    temporalFeatures: {
        hour: number;
        dayOfWeek: number;
        dayOfMonth: number;
        month: number;
        isWeekend: boolean;
        isHoliday: boolean;
    };
    searchFeatures: {
        queryVolume: number;
        averageQueryLength: number;
        uniqueQueriesRatio: number;
        topCategoriesDistribution: Record<string, number>;
    };
    userFeatures: {
        activeUsers: number;
        newUsers: number;
        returningUsers: number;
        averageSessionDuration: number;
    };
    systemFeatures: {
        serverLoad: number;
        responseTime: number;
        errorRate: number;
        cacheHitRate: number;
    };
    externalFeatures: {
        seasonalTrend: number;
        competitorActivity: number;
        marketEvents: number[];
    };
}
interface OptimizationStrategy {
    id: string;
    name: string;
    description: string;
    targetMetrics: string[];
    actions: OptimizationAction[];
    estimatedImpact: Record<string, number>;
    implementationCost: number;
    timeToImplement: number;
    confidence: number;
}
interface OptimizationAction {
    type: 'algorithm_tune' | 'infrastructure_scale' | 'ui_improve' | 'content_optimize' | 'cache_optimize';
    parameters: Record<string, any>;
    expectedBenefit: number;
    risk: 'low' | 'medium' | 'high';
}
interface TrendAnalysis {
    metric: string;
    trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    slope: number;
    confidence: number;
    projectedValue: number;
    seasonality: Record<string, number>;
}
export declare class PredictiveOptimizer {
    private config;
    private model;
    private trendModels;
    private optimizationStrategies;
    private historicalPredictions;
    private featureImportance;
    constructor(config?: any);
    private initializeOptimizationStrategies;
    train(trainingData: TrainingData): Promise<ModelEvaluation>;
    private trainTrendModels;
    private fitTrendModel;
    private detectSeasonalPattern;
    private trainPredictionModels;
    private analyzeFeatureImportance;
    private trainStrategySelector;
    private buildPredictiveModel;
    private evaluateModel;
    generatePredictions(features: PredictionFeatures, horizonHours?: number): Promise<PredictiveInsight[]>;
    private generateTrendPredictions;
    private getCurrentMetricValue;
    private generateTrendRecommendations;
    private identifyOptimizationOpportunities;
    private calculateStrategySuitability;
    private identifyMetricIssues;
    private calculateOptimizationImpact;
    private predictRisks;
    private predictServerLoadRisk;
    private predictQualityRisk;
    private predictUserSatisfactionRisk;
    private generateSeasonalPredictions;
    private isPeakHour;
    private estimateQueryVolumeChange;
    analyzeOptimizationHistory(): Promise<TrendAnalysis[]>;
    getOptimizationStrategies(): OptimizationStrategy[];
    getModelInfo(): MLModel | null;
    saveModel(path: string): Promise<void>;
    loadModel(path: string): Promise<void>;
}
export {};
//# sourceMappingURL=PredictiveOptimizer.d.ts.map