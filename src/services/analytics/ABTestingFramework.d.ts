import { EventEmitter } from 'events';
export interface ABTestConfig {
    id: string;
    name: string;
    description: string;
    type: 'ab' | 'multivariate' | 'multi_armed_bandit';
    status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
    createdAt: number;
    startDate?: number;
    endDate?: number;
    trafficAllocation: number;
    variants: ABTestVariant[];
    targeting: {
        userSegments?: string[];
        devices?: ('desktop' | 'mobile' | 'tablet')[];
        locations?: string[];
        userTypes?: ('new' | 'returning')[];
        customRules?: Array<{
            property: string;
            operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
            value: any;
        }>;
    };
    primaryMetric: string;
    secondaryMetrics: string[];
    successCriteria: {
        minimumDetectableEffect: number;
        confidenceLevel: number;
        statisticalPower: number;
        minimumSampleSize: number;
    };
    settings: {
        randomizationUnit: 'user' | 'session';
        holdoutGroup?: number;
        autoPromoteWinner?: boolean;
        autoPromoteThreshold?: number;
        maxDuration?: number;
    };
}
export interface ABTestVariant {
    id: string;
    name: string;
    description: string;
    trafficWeight: number;
    isControl: boolean;
    configuration: {
        searchAlgorithm?: string;
        rankingWeights?: Record<string, number>;
        filterSettings?: Record<string, any>;
        uiElements?: Record<string, any>;
        customParameters?: Record<string, any>;
    };
}
export interface ABTestAssignment {
    userId: string;
    testId: string;
    variantId: string;
    assignedAt: number;
    sessionId?: string;
    isHoldout?: boolean;
}
export interface ABTestEvent {
    id: string;
    testId: string;
    variantId: string;
    userId: string;
    sessionId: string;
    eventType: string;
    eventValue?: number;
    timestamp: number;
    properties: Record<string, any>;
}
export interface ABTestResults {
    testId: string;
    status: 'running' | 'completed' | 'inconclusive';
    duration: number;
    totalParticipants: number;
    variants: Array<{
        variantId: string;
        name: string;
        participants: number;
        metrics: Record<string, {
            value: number;
            standardError: number;
            confidenceInterval: [number, number];
            sampleSize: number;
        }>;
        significance: Record<string, {
            pValue: number;
            isSignificant: boolean;
            effectSize: number;
            confidenceInterval: [number, number];
        }>;
    }>;
    recommendations: {
        winningVariant?: string;
        confidence: number;
        reasoning: string;
        nextSteps: string[];
    };
    statisticalAnalysis: {
        hasReachedSignificance: boolean;
        hasReachedMinimumSampleSize: boolean;
        estimatedTimeToSignificance?: number;
        powerAnalysis: {
            achievedPower: number;
            requiredSampleSize: number;
            currentSampleSize: number;
        };
    };
}
export interface BayesianAnalysis {
    testId: string;
    variants: Array<{
        variantId: string;
        probabilityOfBeingBest: number;
        expectedLoss: number;
        credibleInterval: [number, number];
        posteriorDistribution: {
            mean: number;
            variance: number;
            alpha: number;
            beta: number;
        };
    }>;
    recommendation: {
        recommendedAction: 'continue' | 'promote' | 'stop';
        variant?: string;
        confidence: number;
    };
}
export interface MultiArmedBanditConfig {
    algorithm: 'epsilon_greedy' | 'thompson_sampling' | 'ucb1';
    explorationRate?: number;
    decayRate?: number;
    updateFrequency: number;
}
export declare class ABTestingFramework extends EventEmitter {
    private tests;
    private assignments;
    private events;
    private results;
    private banditConfig;
    private variantPerformance;
    constructor();
    createTest(config: Omit<ABTestConfig, 'id' | 'createdAt' | 'status'>): string;
    startTest(testId: string): void;
    stopTest(testId: string, reason?: string): void;
    assignUserToTest(userId: string, testId: string, sessionId?: string): ABTestAssignment | null;
    trackEvent(userId: string, testId: string, eventType: string, eventValue?: number, properties?: Record<string, any>): string;
    getUserAssignment(userId: string, testId: string): ABTestAssignment | null;
    analyzeTestResults(testId: string): Promise<ABTestResults>;
    performBayesianAnalysis(testId: string): Promise<BayesianAnalysis>;
    getVariantConfiguration(userId: string, testId: string): Record<string, any> | null;
    getActiveTestsForUser(userId: string): Array<{
        testId: string;
        testName: string;
        variantId: string;
        variantName: string;
        configuration: Record<string, any>;
    }>;
    getDashboardData(): Promise<{
        activeTests: Array<{
            testId: string;
            name: string;
            status: string;
            participants: number;
            duration: number;
            confidence: number;
            leadingVariant?: string;
        }>;
        recentResults: Array<{
            testId: string;
            name: string;
            winner: string;
            improvement: number;
            confidence: number;
            completedAt: number;
        }>;
        performanceMetrics: {
            totalTests: number;
            activeTests: number;
            successfulTests: number;
            averageImprovement: number;
        };
        alerts: Array<{
            type: 'low_traffic' | 'no_significance' | 'high_variance' | 'test_ended';
            testId: string;
            message: string;
            severity: 'low' | 'medium' | 'high';
        }>;
    }>;
    private validateTestConfig;
    private meetsTargetingCriteria;
    private getRandomVariantAssignment;
    private getBanditAssignment;
    private epsilonGreedySelection;
    private thompsonSamplingSelection;
    private ucb1Selection;
    private calculateMetric;
    private getMetricValues;
    private calculateConfidenceInterval;
    private calculateStatisticalSignificance;
    private generateRecommendations;
    private performStatisticalAnalysis;
    private autoPromoteWinner;
    private initializeBandit;
    private updateBanditPerformance;
    private updateBanditAllocations;
    private generateTestAlerts;
    private hashString;
    private getZScore;
    private normalCDF;
    private erf;
    private sampleBeta;
    private sampleGamma;
    private sampleNormal;
    private sampleBetaDistribution;
    private calculateCredibleInterval;
    private startPeriodicAnalysis;
    private generateId;
}
//# sourceMappingURL=ABTestingFramework.d.ts.map