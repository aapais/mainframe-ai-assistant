import { EventEmitter } from 'events';
export interface ConversionGoal {
    id: string;
    name: string;
    type: 'pageview' | 'click' | 'download' | 'form_submit' | 'time_spent' | 'custom';
    category: 'micro' | 'macro';
    value: number;
    conditions: {
        triggers: Array<{
            event: string;
            parameters?: Record<string, any>;
            operator?: 'equals' | 'contains' | 'greater_than' | 'less_than';
            value?: any;
        }>;
        timeframe?: number;
        sequence?: boolean;
    };
    metadata: {
        description: string;
        priority: 'low' | 'medium' | 'high' | 'critical';
        createdAt: number;
        isActive: boolean;
    };
}
export interface ConversionEvent {
    id: string;
    userId: string;
    sessionId: string;
    goalId: string;
    eventType: string;
    timestamp: number;
    value?: number;
    properties: Record<string, any>;
    source: {
        page: string;
        referrer?: string;
        campaign?: string;
        medium?: string;
    };
    context: {
        userAgent: string;
        ip?: string;
        location?: string;
        deviceType: 'desktop' | 'mobile' | 'tablet';
    };
}
export interface Conversion {
    id: string;
    userId: string;
    sessionId: string;
    goalId: string;
    goalName: string;
    completedAt: number;
    value: number;
    timeToConvert: number;
    touchpoints: ConversionEvent[];
    attribution: {
        firstTouch: ConversionEvent;
        lastTouch: ConversionEvent;
        assistingTouches: ConversionEvent[];
        model: 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'position_based';
    };
    funnel: {
        stage: string;
        completionRate: number;
        dropoffPoint?: string;
    };
}
export interface ConversionMetrics {
    overall: {
        conversionRate: number;
        totalConversions: number;
        totalValue: number;
        averageValue: number;
        averageTimeToConvert: number;
    };
    byGoal: Record<string, {
        conversions: number;
        conversionRate: number;
        value: number;
        averageTimeToConvert: number;
    }>;
    bySource: Record<string, {
        conversions: number;
        conversionRate: number;
        value: number;
    }>;
    byTimeframe: Array<{
        period: string;
        conversions: number;
        conversionRate: number;
        value: number;
    }>;
    funnelAnalysis: Array<{
        stage: string;
        users: number;
        conversions: number;
        conversionRate: number;
        dropoffRate: number;
    }>;
}
export interface FunnelStage {
    id: string;
    name: string;
    order: number;
    conditions: Array<{
        event: string;
        parameters?: Record<string, any>;
    }>;
    isRequired: boolean;
}
export interface ConversionFunnel {
    id: string;
    name: string;
    goalId: string;
    stages: FunnelStage[];
    timeframe: number;
    isActive: boolean;
    createdAt: number;
}
export interface AttributionModel {
    name: string;
    type: 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'position_based' | 'custom';
    weights?: number[];
    decayRate?: number;
    customLogic?: (touchpoints: ConversionEvent[]) => Record<string, number>;
}
export declare class ConversionTracker extends EventEmitter {
    private goals;
    private events;
    private conversions;
    private funnels;
    private attributionModels;
    private metricsCache;
    private cacheExpiry;
    private activeUserSessions;
    constructor();
    createGoal(goal: Omit<ConversionGoal, 'id' | 'metadata.createdAt'>): string;
    trackEvent(event: Omit<ConversionEvent, 'id' | 'timestamp'>): string;
    private checkGoalCompletions;
    private evaluateGoalCompletion;
    private recordConversion;
    calculateConversionMetrics(filters?: {
        timeRange?: [number, number];
        goalIds?: string[];
        userSegment?: string;
    }): Promise<ConversionMetrics>;
    createFunnel(funnel: Omit<ConversionFunnel, 'id' | 'createdAt'>): string;
    analyzeFunnelPerformance(funnelId: string, timeRange?: [number, number]): Promise<{
        funnel: ConversionFunnel;
        performance: Array<{
            stage: FunnelStage;
            users: number;
            completions: number;
            conversionRate: number;
            dropoffRate: number;
            averageTimeInStage: number;
        }>;
        insights: {
            bottleneckStage: string;
            improvementOpportunities: Array<{
                stage: string;
                currentRate: number;
                potentialRate: number;
                impact: number;
            }>;
            recommendations: string[];
        };
    }>;
    getAttributionAnalysis(modelType?: 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'position_based', timeRange?: [number, number]): Promise<{
        model: AttributionModel;
        attribution: Record<string, {
            conversions: number;
            value: number;
            percentage: number;
        }>;
        comparison: Record<string, Record<string, number>>;
    }>;
    getConversionDashboard(): Promise<{
        realtimeMetrics: {
            conversionsToday: number;
            conversionRateToday: number;
            valueToday: number;
            activeGoals: number;
        };
        topConvertingGoals: Array<{
            goalId: string;
            goalName: string;
            conversions: number;
            conversionRate: number;
            value: number;
        }>;
        conversionTrends: Array<{
            time: string;
            conversions: number;
            conversionRate: number;
        }>;
        funnelHealth: Array<{
            funnelId: string;
            funnelName: string;
            overallConversionRate: number;
            bottleneckStage: string;
            status: 'healthy' | 'warning' | 'critical';
        }>;
        alerts: Array<{
            type: 'goal_underperforming' | 'funnel_bottleneck' | 'conversion_spike' | 'technical_issue';
            severity: 'low' | 'medium' | 'high';
            message: string;
            timestamp: number;
        }>;
    }>;
    private getFilteredData;
    private eventMatchesTrigger;
    private validateEventSequence;
    private validateAllTriggers;
    private findRelevantTouchpoints;
    private calculateAttribution;
    private getTouchpointSource;
    private calculateFunnelPosition;
    private calculateGoalMetrics;
    private calculateSourceMetrics;
    private calculateTimeframeMetrics;
    private calculateFunnelAnalysis;
    private getUsersInStage;
    private getStageCompletions;
    private calculateAverageTimeInStage;
    private generateFunnelInsights;
    private compareAttributionModels;
    private calculateTodayConversionRate;
    private getTopConvertingGoals;
    private generateConversionTrends;
    private assessFunnelHealth;
    private generateConversionAlerts;
    private updateActiveSession;
    private updateFunnelAnalytics;
    private groupBy;
    private getCachedMetrics;
    private setCachedMetrics;
    private invalidateCache;
    private generateId;
    private initializeDefaultGoals;
    private initializeAttributionModels;
    private startSessionMonitoring;
}
//# sourceMappingURL=ConversionTracker.d.ts.map