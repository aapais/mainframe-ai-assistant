import { EventEmitter } from 'events';
export interface SatisfactionSurvey {
    id: string;
    userId: string;
    sessionId: string;
    query: string;
    timestamp: number;
    responses: {
        overallSatisfaction: number;
        resultRelevance: number;
        searchSpeed: number;
        interfaceUsability: number;
        wouldRecommend: boolean;
    };
    feedback: {
        positiveAspects: string[];
        improvementAreas: string[];
        comments: string;
    };
    metadata: {
        searchType: 'quick' | 'detailed' | 'research';
        resultCount: number;
        searchDuration: number;
        platform: string;
        userAgent: string;
    };
}
export interface ImplicitFeedback {
    id: string;
    userId: string;
    sessionId: string;
    type: 'dwell_time' | 'scroll_depth' | 'click_sequence' | 'return_rate' | 'refinement_pattern';
    value: number;
    context: Record<string, any>;
    timestamp: number;
}
export interface SatisfactionMetrics {
    overall: {
        averageRating: number;
        satisfaction: number;
        nps: number;
        confidence: number;
        sampleSize: number;
    };
    dimensions: {
        relevance: number;
        speed: number;
        usability: number;
        completeness: number;
    };
    trends: {
        daily: Array<{
            date: string;
            score: number;
        }>;
        weekly: Array<{
            week: string;
            score: number;
        }>;
        monthly: Array<{
            month: string;
            score: number;
        }>;
    };
    segments: {
        byUserType: Record<string, number>;
        byQueryType: Record<string, number>;
        byPlatform: Record<string, number>;
    };
}
export interface UserJourney {
    userId: string;
    sessionId: string;
    startTime: number;
    endTime?: number;
    steps: Array<{
        action: string;
        timestamp: number;
        data: Record<string, any>;
        satisfaction?: number;
    }>;
    outcome: 'successful' | 'abandoned' | 'partially_successful';
    satisfactionScore?: number;
}
export interface PredictiveInsights {
    satisfactionPrediction: number;
    riskFactors: Array<{
        factor: string;
        impact: number;
        recommendation: string;
    }>;
    opportunityAreas: Array<{
        area: string;
        potential: number;
        actionItems: string[];
    }>;
    userSegmentInsights: Array<{
        segment: string;
        satisfaction: number;
        keyDrivers: string[];
        improvementActions: string[];
    }>;
}
export declare class UserSatisfactionMetrics extends EventEmitter {
    private surveys;
    private implicitFeedback;
    private userJourneys;
    private metricsCache;
    private cacheExpiry;
    private mlModels;
    constructor();
    recordSurveyResponse(survey: Omit<SatisfactionSurvey, 'id' | 'timestamp'>): string;
    recordImplicitFeedback(feedback: Omit<ImplicitFeedback, 'id' | 'timestamp'>): string;
    startUserJourney(userId: string, sessionId: string): UserJourney;
    addJourneyStep(sessionId: string, action: string, data: Record<string, any>, satisfaction?: number): void;
    completeUserJourney(sessionId: string, outcome: 'successful' | 'abandoned' | 'partially_successful', satisfactionScore?: number): void;
    calculateSatisfactionMetrics(filters?: {
        timeRange?: [number, number];
        userSegment?: string;
        platform?: string;
    }): Promise<SatisfactionMetrics>;
    generatePredictiveInsights(userId?: string, timeRange?: [number, number]): Promise<PredictiveInsights>;
    getSatisfactionDashboard(): Promise<{
        currentMetrics: {
            satisfaction: number;
            nps: number;
            avgRating: number;
            responsesCount: number;
        };
        recentFeedback: Array<{
            type: 'positive' | 'negative' | 'neutral';
            comment: string;
            timestamp: number;
            rating: number;
        }>;
        alertsAndInsights: Array<{
            type: 'alert' | 'insight' | 'recommendation';
            severity: 'high' | 'medium' | 'low';
            message: string;
            actionRequired: boolean;
        }>;
        topIssues: Array<{
            issue: string;
            frequency: number;
            impact: number;
            suggestedAction: string;
        }>;
        improvementOpportunities: Array<{
            area: string;
            potential: number;
            effort: number;
            roi: number;
        }>;
    }>;
    analyzeSatisfactionPatterns(): Promise<{
        correlations: Array<{
            factor1: string;
            factor2: string;
            correlation: number;
            significance: number;
        }>;
        keyDrivers: Array<{
            driver: string;
            impact: number;
            elasticity: number;
        }>;
        seasonalPatterns: Array<{
            period: string;
            avgSatisfaction: number;
            trend: 'increasing' | 'decreasing' | 'stable';
        }>;
        userBehaviorInsights: Array<{
            pattern: string;
            description: string;
            recommendation: string;
        }>;
    }>;
    private getFilteredSurveys;
    private getFilteredImplicitFeedback;
    private getFilteredJourneys;
    private calculateDimensionScore;
    private calculateCompletenessScore;
    private calculateTrends;
    private calculateSegmentScores;
    private calculateNPS;
    private calculateConfidence;
    private predictSatisfaction;
    private identifyRiskFactors;
    private identifyOpportunities;
    private generateSegmentInsights;
    private generateAlertsAndInsights;
    private identifyTopIssues;
    private identifyImprovementOpportunities;
    private groupSurveysByTime;
    private classifyUserType;
    private classifyFeedbackSentiment;
    private calculateTrend;
    private extractImprovementAreas;
    private generateActionItems;
    private groupSurveysBySegment;
    private identifySegmentDrivers;
    private generateSegmentActions;
    private extractIssues;
    private generateIssueAction;
    private analyzeJourneyPatterns;
    private calculateCorrelations;
    private calculatePearsonCorrelation;
    private identifyKeyDrivers;
    private analyzeSeasonalPatterns;
    private extractBehaviorInsights;
    private getAllSurveys;
    private getAllImplicitFeedback;
    private getCachedMetrics;
    private setCachedMetrics;
    private invalidateCache;
    private generateId;
    private initializePredictiveModels;
    private startContinuousLearning;
    private updatePredictiveModels;
}
//# sourceMappingURL=UserSatisfactionMetrics.d.ts.map