import { TrainingData, ModelEvaluation } from '../../types/ml';
import { QuerySuggestionEngine } from './QuerySuggestionEngine';
import { PersonalizedRanker } from './PersonalizedRanker';
import { SemanticSearchEnhancer } from './SemanticSearchEnhancer';
import { SearchAnomalyDetector } from './SearchAnomalyDetector';
import { PredictiveOptimizer } from './PredictiveOptimizer';
interface TrainingConfig {
    models: string[];
    dataSource: string;
    validationSplit: number;
    crossValidationFolds: number;
    hyperparameterTuning: boolean;
    earlyStoppingPatience: number;
    maxTrainingTime: number;
    parallelTraining: boolean;
}
interface TrainingResult {
    modelId: string;
    evaluation: ModelEvaluation;
    trainingTime: number;
    modelSize: number;
    status: 'success' | 'failed' | 'timeout';
    error?: string;
}
interface PipelineMetrics {
    totalTrainingTime: number;
    modelsTrained: number;
    successRate: number;
    averageAccuracy: number;
    bestModel: string;
    resourceUsage: {
        memoryPeak: number;
        cpuTime: number;
        diskSpace: number;
    };
}
export declare class MLTrainingPipeline {
    private config;
    private querySuggestionEngine;
    private personalizedRanker;
    private semanticSearchEnhancer;
    private searchAnomalyDetector;
    private predictiveOptimizer;
    private trainingResults;
    private pipelineMetrics;
    constructor(config: TrainingConfig);
    runFullPipeline(trainingData: TrainingData): Promise<PipelineMetrics>;
    private prepareTrainingData;
    private prepareQuerySuggestionData;
    private preparePersonalizedRankingData;
    private prepareSemanticSearchData;
    private prepareAnomalyDetectionData;
    private preparePredictiveOptimizationData;
    private trainQuerySuggestion;
    private trainPersonalizedRanker;
    private trainSemanticSearchEnhancer;
    private trainSearchAnomalyDetector;
    private trainPredictiveOptimizer;
    private estimateModelSize;
    private createFailedEvaluation;
    private calculatePipelineMetrics;
    private estimateMemoryUsage;
    crossValidate(data: TrainingData, folds?: number): Promise<Record<string, ModelEvaluation[]>>;
    private trainAndEvaluateModel;
    private evaluateQuerySuggestion;
    private evaluatePersonalizedRanker;
    private evaluateSemanticSearch;
    private evaluateAnomalyDetector;
    private evaluatePredictiveOptimizer;
    saveAllModels(basePath: string): Promise<void>;
    loadAllModels(basePath: string): Promise<void>;
    getTrainingResults(): Map<string, TrainingResult>;
    getPipelineMetrics(): PipelineMetrics | null;
    getModelServices(): {
        querySuggestionEngine: QuerySuggestionEngine;
        personalizedRanker: PersonalizedRanker;
        semanticSearchEnhancer: SemanticSearchEnhancer;
        searchAnomalyDetector: SearchAnomalyDetector;
        predictiveOptimizer: PredictiveOptimizer;
    };
}
export {};
//# sourceMappingURL=MLTrainingPipeline.d.ts.map