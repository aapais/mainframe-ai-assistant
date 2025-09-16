import { SearchResult } from '../../types/services';
import { ParsedQuery } from '../search/QueryParser';
import { ComplexityScore } from './QueryComplexityAnalyzer';
import { IntentClassification } from './SearchIntentClassifier';
export interface UserSession {
    id: string;
    userId?: string;
    startTime: number;
    lastActivity: number;
    duration: number;
    isActive: boolean;
    device: DeviceInfo;
    location?: LocationInfo;
    queries: SessionQuery[];
    interactions: UserInteraction[];
    outcomes: SessionOutcome[];
    metrics: SessionMetrics;
    patterns: BehaviorPattern[];
    flags: SessionFlag[];
}
export interface SessionQuery {
    id: string;
    query: string;
    parsedQuery: ParsedQuery;
    timestamp: number;
    complexity: ComplexityScore;
    intent: IntentClassification;
    results: {
        count: number;
        relevanceScore: number;
        processingTime: number;
    };
    userReaction: {
        clickedResults: number[];
        dwellTime: number;
        satisfaction?: number;
        refinementFollowed: boolean;
    };
}
export interface UserInteraction {
    id: string;
    type: InteractionType;
    timestamp: number;
    target: string;
    details: any;
    context: InteractionContext;
    outcome: InteractionOutcome;
}
export type InteractionType = 'search_initiated' | 'result_clicked' | 'result_rated' | 'result_shared' | 'result_bookmarked' | 'filter_applied' | 'sort_changed' | 'page_navigation' | 'export_performed' | 'help_accessed' | 'feedback_provided' | 'settings_changed' | 'session_paused' | 'session_resumed';
export interface InteractionContext {
    queryId?: string;
    resultPosition?: number;
    timeFromQuery: number;
    previousAction?: InteractionType;
    userState: UserState;
}
export interface InteractionOutcome {
    successful: boolean;
    value: number;
    satisfaction: number;
    efficiency: number;
}
export interface UserState {
    focus: 'high' | 'medium' | 'low';
    engagement: 'active' | 'passive' | 'distracted';
    expertise: 'novice' | 'intermediate' | 'expert';
    taskUrgency: 'low' | 'medium' | 'high' | 'critical';
    sessionGoal: SessionGoal;
}
export type SessionGoal = 'information_seeking' | 'problem_solving' | 'learning' | 'verification' | 'exploration' | 'task_completion' | 'research';
export interface SessionOutcome {
    type: OutcomeType;
    achieved: boolean;
    value: number;
    timeToAchieve?: number;
    effort: EffortLevel;
    satisfaction: number;
    description: string;
}
export type OutcomeType = 'information_found' | 'problem_solved' | 'task_completed' | 'knowledge_gained' | 'decision_made' | 'process_understood' | 'goal_abandoned';
export type EffortLevel = 'minimal' | 'low' | 'moderate' | 'high' | 'excessive';
export interface SessionMetrics {
    queryCount: number;
    refinementRate: number;
    clickThroughRate: number;
    avgQueryComplexity: number;
    timePerQuery: number;
    successRate: number;
    bounceRate: number;
    engagementScore: number;
    efficiencyScore: number;
    satisfactionScore: number;
}
export interface BehaviorPattern {
    id: string;
    type: PatternType;
    description: string;
    confidence: number;
    frequency: number;
    impact: 'positive' | 'negative' | 'neutral';
    recommendation?: string;
}
export type PatternType = 'query_refinement_cycle' | 'result_browsing_pattern' | 'topic_exploration' | 'learning_progression' | 'efficiency_optimization' | 'preference_indication' | 'expertise_demonstration' | 'frustration_indicator' | 'success_pattern';
export interface SessionFlag {
    type: FlagType;
    severity: 'info' | 'warning' | 'error' | 'critical';
    description: string;
    timestamp: number;
    autoResolvable: boolean;
}
export type FlagType = 'anomalous_behavior' | 'potential_bot' | 'excessive_queries' | 'zero_engagement' | 'rapid_abandonment' | 'system_abuse' | 'data_quality_issue';
export interface DeviceInfo {
    type: 'desktop' | 'tablet' | 'mobile' | 'unknown';
    os: string;
    browser: string;
    screenSize: {
        width: number;
        height: number;
    };
    userAgent: string;
}
export interface LocationInfo {
    country?: string;
    region?: string;
    timezone: string;
    language: string;
}
export interface UserProfile {
    userId: string;
    created: number;
    lastSeen: number;
    totalSessions: number;
    totalQueries: number;
    expertise: {
        level: 'novice' | 'intermediate' | 'expert';
        domains: Record<string, number>;
        progression: ProgressionMetric[];
    };
    preferences: {
        queryComplexity: 'simple' | 'moderate' | 'complex';
        resultFormat: string[];
        topics: TopicPreference[];
        searchStyle: SearchStyle;
    };
    patterns: {
        searchTiming: TimingPattern;
        sessionDuration: DurationPattern;
        queryTypes: QueryTypeDistribution;
        successFactors: SuccessFactor[];
    };
    metrics: {
        avgSessionLength: number;
        avgQueriesPerSession: number;
        successRate: number;
        satisfactionScore: number;
        learningVelocity: number;
    };
}
export interface ProgressionMetric {
    timestamp: number;
    metric: 'complexity_handling' | 'success_rate' | 'efficiency' | 'satisfaction';
    value: number;
    trend: 'improving' | 'stable' | 'declining';
}
export interface TopicPreference {
    topic: string;
    interest: number;
    expertise: number;
    frequency: number;
    lastAccessed: number;
}
export interface SearchStyle {
    approach: 'systematic' | 'iterative' | 'exploratory' | 'targeted';
    refinementStrategy: 'additive' | 'subtractive' | 'replacement' | 'mixed';
    resultExamination: 'thorough' | 'selective' | 'quick_scan';
    decisionMaking: 'fast' | 'deliberate' | 'research_heavy';
}
export interface TimingPattern {
    preferredTimes: number[];
    sessionFrequency: 'frequent' | 'regular' | 'occasional' | 'rare';
    urgencyDistribution: Record<string, number>;
}
export interface DurationPattern {
    typical: number;
    range: {
        min: number;
        max: number;
    };
    efficiency: number;
    focusLevel: number;
}
export interface QueryTypeDistribution {
    informational: number;
    navigational: number;
    transactional: number;
    investigational: number;
}
export interface SuccessFactor {
    factor: string;
    impact: number;
    confidence: number;
    examples: string[];
}
export interface BehaviorAnalysisReport {
    timeRange: {
        from: number;
        to: number;
    };
    userMetrics: {
        totalUsers: number;
        activeUsers: number;
        newUsers: number;
        returningUsers: number;
    };
    sessionMetrics: {
        totalSessions: number;
        avgSessionDuration: number;
        avgQueriesPerSession: number;
        bounceRate: number;
    };
    engagementMetrics: {
        clickThroughRate: number;
        timeOnResults: number;
        interactionDepth: number;
        returnRate: number;
    };
    behaviorPatterns: {
        common: BehaviorPattern[];
        emerging: BehaviorPattern[];
        concerning: BehaviorPattern[];
    };
    userSegments: UserSegment[];
    trends: BehaviorTrend[];
    insights: BehaviorInsight[];
    recommendations: BehaviorRecommendation[];
}
export interface UserSegment {
    id: string;
    name: string;
    description: string;
    size: number;
    characteristics: SegmentCharacteristic[];
    behavior: SegmentBehavior;
    value: number;
    growth: number;
}
export interface SegmentCharacteristic {
    dimension: string;
    value: any;
    importance: number;
}
export interface SegmentBehavior {
    searchFrequency: number;
    sessionDuration: number;
    queryComplexity: number;
    successRate: number;
    satisfactionScore: number;
    preferredTopics: string[];
}
export interface BehaviorTrend {
    metric: string;
    direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    magnitude: number;
    significance: number;
    timeframe: string;
    drivers: string[];
}
export interface BehaviorInsight {
    category: 'user_experience' | 'content_strategy' | 'system_optimization' | 'business_impact';
    insight: string;
    confidence: number;
    impact: 'low' | 'medium' | 'high';
    actionability: number;
    supportingData: any[];
}
export interface BehaviorRecommendation {
    category: 'personalization' | 'content' | 'interface' | 'features';
    recommendation: string;
    priority: number;
    expectedImpact: number;
    implementation: 'easy' | 'moderate' | 'complex';
    targetSegment?: string;
}
export declare class UserBehaviorTracker {
    private activeSessions;
    private userProfiles;
    private behaviorPatterns;
    private sessionHistory;
    private patternDetectors;
    private readonly config;
    constructor(config?: Partial<typeof UserBehaviorTracker.prototype.config>);
    startSession(sessionId: string, userId?: string, deviceInfo?: Partial<DeviceInfo>, locationInfo?: LocationInfo): UserSession;
    trackQuery(sessionId: string, query: string, parsedQuery: ParsedQuery, complexity: ComplexityScore, intent: IntentClassification, results: SearchResult[], processingTime: number): void;
    trackInteraction(sessionId: string, type: InteractionType, target: string, context: Partial<InteractionContext>, outcome?: Partial<InteractionOutcome>): void;
    recordOutcome(sessionId: string, outcome: Partial<SessionOutcome>): void;
    endSession(sessionId: string): UserSession | null;
    getSession(sessionId: string): UserSession | null;
    getUserProfile(userId: string): UserProfile | null;
    generateBehaviorReport(timeRange?: {
        from: number;
        to: number;
    }): BehaviorAnalysisReport;
    getPersonalizationRecommendations(userId: string): Array<{
        type: 'query_suggestion' | 'content_recommendation' | 'interface_adaptation' | 'workflow_optimization';
        recommendation: string;
        confidence: number;
        impact: number;
    }>;
    exportBehaviorData(): {
        sessions: UserSession[];
        profiles: UserProfile[];
        patterns: BehaviorPattern[];
        report: BehaviorAnalysisReport;
    };
    private initializePatternDetectors;
    private startRealTimeAnalysis;
    private performRealTimeAnalysis;
    private cleanupInactiveSessions;
    private buildDeviceInfo;
    private initializeSessionMetrics;
    private calculateAverageRelevance;
    private assessUserState;
    private inferSessionGoal;
    private getMostCommonIntent;
    private calculateTimeFromLastQuery;
    private updateQueryReaction;
    private isRefinement;
    private checkBehavioralFlags;
    private updateSessionMetrics;
    private calculateEngagementScore;
    private calculateEfficiencyScore;
    private calculateSatisfactionScore;
    private finalizeSessionMetrics;
    private detectRealTimePatterns;
    private detectSessionPatterns;
    private addSessionPattern;
    private detectRefinementCycle;
    private detectBrowsingPattern;
    private detectLearningProgression;
    private detectEfficiencyOptimization;
    private detectCompletionPattern;
    private updateUserProfile;
    private createUserProfile;
    private updateProfileFromSession;
    private updateAllUserProfiles;
    private updateUserProgression;
    private cleanupSessionHistory;
    private getSessionsInRange;
    private calculateUserMetrics;
    private calculateSessionMetrics;
    private calculateEngagementMetrics;
    private categorizeBehaviorPatterns;
    private identifyUserSegments;
    private calculateBehaviorTrends;
    private generateBehaviorInsights;
    private generateBehaviorRecommendations;
    private getEmptyBehaviorReport;
    private createEmptySession;
    private anonymizeUserId;
    private anonymizeQuery;
    private generateQueryId;
    private generateInteractionId;
}
export default UserBehaviorTracker;
//# sourceMappingURL=UserBehaviorTracker.d.ts.map