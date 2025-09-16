import { EventEmitter } from 'events';
export interface RelevanceSignal {
    type: 'textual' | 'behavioral' | 'contextual' | 'semantic' | 'temporal';
    weight: number;
    score: number;
    confidence: number;
    source: string;
    metadata?: Record<string, any>;
}
export interface ScoringResult {
    resultId: string;
    query: string;
    overallScore: number;
    confidence: number;
    signals: RelevanceSignal[];
    explanation: string;
    recommendations: string[];
    timestamp: number;
}
export interface RelevanceMetrics {
    averageRelevance: number;
    topResultsRelevance: number;
    precisionAtK: Record<number, number>;
    ndcg: Record<number, number>;
    meanReciprocalRank: number;
    qualityDistribution: {
        excellent: number;
        good: number;
        fair: number;
        poor: number;
    };
}
export interface UserFeedback {
    resultId: string;
    userId: string;
    query: string;
    rating: number;
    feedback: 'relevant' | 'somewhat_relevant' | 'not_relevant' | 'spam';
    comments?: string;
    timestamp: number;
}
export interface ContextualFactors {
    userProfile: {
        searchHistory: string[];
        preferences: Record<string, any>;
        expertise: 'beginner' | 'intermediate' | 'expert';
        location?: string;
        language: string;
    };
    sessionContext: {
        previousQueries: string[];
        clickedResults: string[];
        timeSpentOnResults: Record<string, number>;
        sessionDuration: number;
    };
    temporalContext: {
        timeOfDay: number;
        dayOfWeek: number;
        seasonality?: string;
    };
}
export declare class RelevanceScorer extends EventEmitter {
    private userFeedback;
    private scoringHistory;
    private mlModels;
    private scoringWeights;
    private qualityThresholds;
    constructor();
    scoreRelevance(resultId: string, resultContent: {
        title: string;
        snippet: string;
        content?: string;
        metadata: Record<string, any>;
    }, query: string, context: ContextualFactors): Promise<ScoringResult>;
    private calculateTextualSignals;
    private calculateBehavioralSignals;
    private calculateContextualSignals;
    private calculateSemanticSignals;
    private calculateTemporalSignals;
    recordUserFeedback(feedback: Omit<UserFeedback, 'timestamp'>): string;
    calculateRelevanceMetrics(query: string, results: Array<{
        resultId: string;
        position: number;
        score?: number;
    }>, timeRange?: [number, number]): Promise<RelevanceMetrics>;
    private calculateOverallScore;
    private calculateConfidence;
    private calculateExactMatch;
    private calculateTFIDF;
    private calculateBM25;
    private calculateResultCTR;
    private calculateDwellTimeScore;
    private calculateInteractionScore;
    private calculateProfileMatch;
    private calculateSessionRelevance;
    private calculateLocationRelevance;
    private calculateEmbeddingSimilarity;
    private calculateTopicAlignment;
    private calculateIntentMatch;
    private calculateFreshnessScore;
    private calculateTrendingScore;
    private calculateSeasonalScore;
    private calculateNDCG;
    private getScoringHistory;
    private generateExplanation;
    private generateRecommendations;
    private matchExpertiseLevel;
    private matchPreferences;
    private analyzeQueryRelation;
    private analyzeResultRelation;
    private calculateQuerySimilarity;
    private classifyQueryIntent;
    private classifyContentType;
    private calculateIntentContentAlignment;
    private getSeasonalKeywords;
    private updateModelsWithFeedback;
    private initializeModels;
}
//# sourceMappingURL=RelevanceScorer.d.ts.map