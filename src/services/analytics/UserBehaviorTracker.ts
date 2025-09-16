/**
 * User Behavior Tracker for Session Analysis
 * 
 * Comprehensive tracking and analysis of user search behavior including:
 * - Real-time session monitoring
 * - Search pattern recognition
 * - User journey mapping
 * - Engagement analytics
 * - Personalization insights
 * - Behavioral anomaly detection
 * 
 * @version 1.0.0
 */

import { SearchResult, SearchOptions, KBEntry } from '../../types/services';
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

export type InteractionType =
  | 'search_initiated'
  | 'result_clicked'
  | 'result_rated'
  | 'result_shared'
  | 'result_bookmarked'
  | 'filter_applied'
  | 'sort_changed'
  | 'page_navigation'
  | 'export_performed'
  | 'help_accessed'
  | 'feedback_provided'
  | 'settings_changed'
  | 'session_paused'
  | 'session_resumed';

export interface InteractionContext {
  queryId?: string;
  resultPosition?: number;
  timeFromQuery: number;
  previousAction?: InteractionType;
  userState: UserState;
}

export interface InteractionOutcome {
  successful: boolean;
  value: number;           // Business value or utility score
  satisfaction: number;    // User satisfaction score
  efficiency: number;      // Task completion efficiency
}

export interface UserState {
  focus: 'high' | 'medium' | 'low';
  engagement: 'active' | 'passive' | 'distracted';
  expertise: 'novice' | 'intermediate' | 'expert';
  taskUrgency: 'low' | 'medium' | 'high' | 'critical';
  sessionGoal: SessionGoal;
}

export type SessionGoal =
  | 'information_seeking'
  | 'problem_solving' 
  | 'learning'
  | 'verification'
  | 'exploration'
  | 'task_completion'
  | 'research';

export interface SessionOutcome {
  type: OutcomeType;
  achieved: boolean;
  value: number;
  timeToAchieve?: number;
  effort: EffortLevel;
  satisfaction: number;
  description: string;
}

export type OutcomeType =
  | 'information_found'
  | 'problem_solved'
  | 'task_completed'
  | 'knowledge_gained'
  | 'decision_made'
  | 'process_understood'
  | 'goal_abandoned';

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

export type PatternType =
  | 'query_refinement_cycle'
  | 'result_browsing_pattern'
  | 'topic_exploration'
  | 'learning_progression'
  | 'efficiency_optimization'
  | 'preference_indication'
  | 'expertise_demonstration'
  | 'frustration_indicator'
  | 'success_pattern';

export interface SessionFlag {
  type: FlagType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  description: string;
  timestamp: number;
  autoResolvable: boolean;
}

export type FlagType =
  | 'anomalous_behavior'
  | 'potential_bot'
  | 'excessive_queries'
  | 'zero_engagement'
  | 'rapid_abandonment'
  | 'system_abuse'
  | 'data_quality_issue';

export interface DeviceInfo {
  type: 'desktop' | 'tablet' | 'mobile' | 'unknown';
  os: string;
  browser: string;
  screenSize: { width: number; height: number };
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
  preferredTimes: number[]; // Hours of day
  sessionFrequency: 'frequent' | 'regular' | 'occasional' | 'rare';
  urgencyDistribution: Record<string, number>;
}

export interface DurationPattern {
  typical: number;
  range: { min: number; max: number };
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
  timeRange: { from: number; to: number };
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

/**
 * Comprehensive User Behavior Tracker
 */
export class UserBehaviorTracker {
  private activeSessions: Map<string, UserSession> = new Map();
  private userProfiles: Map<string, UserProfile> = new Map();
  private behaviorPatterns: Map<string, BehaviorPattern> = new Map();
  private sessionHistory: UserSession[] = [];
  private patternDetectors: PatternDetector[] = [];
  
  private readonly config: {
    sessionTimeout: number;
    trackingEnabled: boolean;
    anonymizeData: boolean;
    realTimeAnalysis: boolean;
    patternDetection: {
      minSessions: number;
      confidenceThreshold: number;
      updateFrequency: number;
    };
    storage: {
      maxSessions: number;
      retentionPeriod: number;
    };
  };

  constructor(config: Partial<typeof UserBehaviorTracker.prototype.config> = {}) {
    this.config = {
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      trackingEnabled: true,
      anonymizeData: false,
      realTimeAnalysis: true,
      patternDetection: {
        minSessions: 5,
        confidenceThreshold: 0.7,
        updateFrequency: 60000 // 1 minute
      },
      storage: {
        maxSessions: 10000,
        retentionPeriod: 90 * 24 * 60 * 60 * 1000 // 90 days
      },
      ...config
    };
    
    this.initializePatternDetectors();
    
    if (this.config.realTimeAnalysis) {
      this.startRealTimeAnalysis();
    }
  }

  /**
   * Start tracking a new user session
   */
  public startSession(
    sessionId: string,
    userId?: string,
    deviceInfo?: Partial<DeviceInfo>,
    locationInfo?: LocationInfo
  ): UserSession {
    if (!this.config.trackingEnabled) {
      return this.createEmptySession(sessionId);
    }
    
    // End existing session if any
    this.endSession(sessionId);
    
    const session: UserSession = {
      id: sessionId,
      userId: this.config.anonymizeData ? this.anonymizeUserId(userId) : userId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      duration: 0,
      isActive: true,
      device: this.buildDeviceInfo(deviceInfo),
      location: locationInfo,
      queries: [],
      interactions: [],
      outcomes: [],
      metrics: this.initializeSessionMetrics(),
      patterns: [],
      flags: []
    };
    
    this.activeSessions.set(sessionId, session);
    
    // Update user profile
    if (userId) {
      this.updateUserProfile(userId, 'session_started', session);
    }
    
    return session;
  }

  /**
   * Track a search query within a session
   */
  public trackQuery(
    sessionId: string,
    query: string,
    parsedQuery: ParsedQuery,
    complexity: ComplexityScore,
    intent: IntentClassification,
    results: SearchResult[],
    processingTime: number
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session || !this.config.trackingEnabled) return;
    
    const sessionQuery: SessionQuery = {
      id: this.generateQueryId(),
      query: this.config.anonymizeData ? this.anonymizeQuery(query) : query,
      parsedQuery,
      timestamp: Date.now(),
      complexity,
      intent,
      results: {
        count: results.length,
        relevanceScore: this.calculateAverageRelevance(results),
        processingTime
      },
      userReaction: {
        clickedResults: [],
        dwellTime: 0,
        refinementFollowed: false
      }
    };
    
    session.queries.push(sessionQuery);
    session.lastActivity = Date.now();
    
    // Track search interaction
    this.trackInteraction(sessionId, 'search_initiated', query, {
      queryId: sessionQuery.id,
      timeFromQuery: 0,
      userState: this.assessUserState(session)
    });
    
    // Update session metrics
    this.updateSessionMetrics(session);
    
    // Real-time pattern detection
    if (this.config.realTimeAnalysis) {
      this.detectRealTimePatterns(session, sessionQuery);
    }
  }

  /**
   * Track user interaction
   */
  public trackInteraction(
    sessionId: string,
    type: InteractionType,
    target: string,
    context: Partial<InteractionContext>,
    outcome?: Partial<InteractionOutcome>
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session || !this.config.trackingEnabled) return;
    
    const interaction: UserInteraction = {
      id: this.generateInteractionId(),
      type,
      timestamp: Date.now(),
      target,
      details: {},
      context: {
        timeFromQuery: this.calculateTimeFromLastQuery(session),
        userState: this.assessUserState(session),
        ...context
      },
      outcome: {
        successful: true,
        value: 0.5,
        satisfaction: 0.5,
        efficiency: 0.5,
        ...outcome
      }
    };
    
    session.interactions.push(interaction);
    session.lastActivity = Date.now();
    
    // Update query reaction if applicable
    if (context.queryId) {
      this.updateQueryReaction(session, context.queryId, type, interaction);
    }
    
    // Detect behavioral flags
    this.checkBehavioralFlags(session, interaction);
    
    // Update session metrics
    this.updateSessionMetrics(session);
  }

  /**
   * Record session outcome
   */
  public recordOutcome(
    sessionId: string,
    outcome: Partial<SessionOutcome>
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session || !this.config.trackingEnabled) return;
    
    const sessionOutcome: SessionOutcome = {
      type: 'task_completed',
      achieved: false,
      value: 0,
      effort: 'moderate',
      satisfaction: 0.5,
      description: '',
      ...outcome
    };
    
    if (sessionOutcome.achieved && !sessionOutcome.timeToAchieve) {
      sessionOutcome.timeToAchieve = Date.now() - session.startTime;
    }
    
    session.outcomes.push(sessionOutcome);
    session.lastActivity = Date.now();
    
    // Update session metrics
    this.updateSessionMetrics(session);
  }

  /**
   * End a user session
   */
  public endSession(sessionId: string): UserSession | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;
    
    // Finalize session
    session.isActive = false;
    session.duration = Date.now() - session.startTime;
    
    // Final metrics calculation
    this.finalizeSessionMetrics(session);
    
    // Detect final patterns
    this.detectSessionPatterns(session);
    
    // Store in history
    this.sessionHistory.push(session);
    
    // Remove from active sessions
    this.activeSessions.delete(sessionId);
    
    // Update user profile
    if (session.userId) {
      this.updateUserProfile(session.userId, 'session_ended', session);
    }
    
    // Cleanup old sessions
    this.cleanupSessionHistory();
    
    return session;
  }

  /**
   * Get current session for a user
   */
  public getSession(sessionId: string): UserSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get user profile
   */
  public getUserProfile(userId: string): UserProfile | null {
    return this.userProfiles.get(userId) || null;
  }

  /**
   * Generate behavior analysis report
   */
  public generateBehaviorReport(
    timeRange?: { from: number; to: number }
  ): BehaviorAnalysisReport {
    const sessions = this.getSessionsInRange(timeRange);
    
    if (sessions.length === 0) {
      return this.getEmptyBehaviorReport(timeRange);
    }
    
    return {
      timeRange: timeRange || { from: 0, to: Date.now() },
      userMetrics: this.calculateUserMetrics(sessions),
      sessionMetrics: this.calculateSessionMetrics(sessions),
      engagementMetrics: this.calculateEngagementMetrics(sessions),
      behaviorPatterns: this.categorizeBehaviorPatterns(),
      userSegments: this.identifyUserSegments(sessions),
      trends: this.calculateBehaviorTrends(sessions),
      insights: this.generateBehaviorInsights(sessions),
      recommendations: this.generateBehaviorRecommendations(sessions)
    };
  }

  /**
   * Get personalization recommendations for user
   */
  public getPersonalizationRecommendations(
    userId: string
  ): Array<{
    type: 'query_suggestion' | 'content_recommendation' | 'interface_adaptation' | 'workflow_optimization';
    recommendation: string;
    confidence: number;
    impact: number;
  }> {
    const profile = this.userProfiles.get(userId);
    if (!profile) return [];
    
    const recommendations: Array<{
      type: 'query_suggestion' | 'content_recommendation' | 'interface_adaptation' | 'workflow_optimization';
      recommendation: string;
      confidence: number;
      impact: number;
    }> = [];
    
    // Query suggestions based on patterns
    if (profile.patterns.queryTypes.informational > 0.7) {
      recommendations.push({
        type: 'query_suggestion',
        recommendation: 'Provide more explanatory content and definitions',
        confidence: 0.8,
        impact: 0.7
      });
    }
    
    // Interface adaptations
    if (profile.expertise.level === 'expert') {
      recommendations.push({
        type: 'interface_adaptation',
        recommendation: 'Enable advanced search features by default',
        confidence: 0.9,
        impact: 0.6
      });
    }
    
    // Content recommendations
    for (const topicPref of profile.preferences.topics.slice(0, 3)) {
      recommendations.push({
        type: 'content_recommendation',
        recommendation: `Suggest content related to ${topicPref.topic}`,
        confidence: topicPref.interest,
        impact: 0.5
      });
    }
    
    return recommendations.sort((a, b) => (b.confidence * b.impact) - (a.confidence * a.impact));
  }

  /**
   * Export behavior data
   */
  public exportBehaviorData(): {
    sessions: UserSession[];
    profiles: UserProfile[];
    patterns: BehaviorPattern[];
    report: BehaviorAnalysisReport;
  } {
    return {
      sessions: [...this.sessionHistory, ...Array.from(this.activeSessions.values())],
      profiles: Array.from(this.userProfiles.values()),
      patterns: Array.from(this.behaviorPatterns.values()),
      report: this.generateBehaviorReport()
    };
  }

  // Private Methods
  
  private initializePatternDetectors(): void {
    this.patternDetectors = [
      {
        id: 'refinement-cycle',
        detect: (session: UserSession) => this.detectRefinementCycle(session)
      },
      {
        id: 'browsing-pattern',
        detect: (session: UserSession) => this.detectBrowsingPattern(session)
      },
      {
        id: 'learning-progression',
        detect: (session: UserSession) => this.detectLearningProgression(session)
      },
      {
        id: 'efficiency-optimization',
        detect: (session: UserSession) => this.detectEfficiencyOptimization(session)
      }
    ];
  }
  
  private startRealTimeAnalysis(): void {
    setInterval(() => {
      this.performRealTimeAnalysis();
    }, this.config.patternDetection.updateFrequency);
  }
  
  private performRealTimeAnalysis(): void {
    // Clean up inactive sessions
    this.cleanupInactiveSessions();
    
    // Update behavior patterns
    for (const session of this.activeSessions.values()) {
      this.detectRealTimePatterns(session);
    }
    
    // Update user profiles
    this.updateAllUserProfiles();
  }
  
  private cleanupInactiveSessions(): void {
    const now = Date.now();
    const inactiveSessions: string[] = [];
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.lastActivity > this.config.sessionTimeout) {
        inactiveSessions.push(sessionId);
      }
    }
    
    for (const sessionId of inactiveSessions) {
      this.endSession(sessionId);
    }
  }
  
  private buildDeviceInfo(partial?: Partial<DeviceInfo>): DeviceInfo {
    return {
      type: 'desktop',
      os: 'unknown',
      browser: 'unknown',
      screenSize: { width: 1920, height: 1080 },
      userAgent: '',
      ...partial
    };
  }
  
  private initializeSessionMetrics(): SessionMetrics {
    return {
      queryCount: 0,
      refinementRate: 0,
      clickThroughRate: 0,
      avgQueryComplexity: 0,
      timePerQuery: 0,
      successRate: 0,
      bounceRate: 0,
      engagementScore: 0,
      efficiencyScore: 0,
      satisfactionScore: 0
    };
  }
  
  private calculateAverageRelevance(results: SearchResult[]): number {
    if (results.length === 0) return 0;
    return results.reduce((sum, r) => sum + r.score, 0) / results.length;
  }
  
  private assessUserState(session: UserSession): UserState {
    const recentInteractions = session.interactions.slice(-5);
    const timeSpan = recentInteractions.length > 1 ? 
      recentInteractions[recentInteractions.length - 1].timestamp - recentInteractions[0].timestamp : 0;
    
    // Simple heuristics for user state assessment
    const focus = timeSpan > 0 && (recentInteractions.length / timeSpan * 1000) > 0.1 ? 'high' : 'medium';
    const engagement = session.interactions.length > 10 ? 'active' : 'passive';
    const expertise = session.queries.some(q => q.complexity.overall > 0.7) ? 'expert' : 'intermediate';
    
    return {
      focus: focus as 'high' | 'medium' | 'low',
      engagement: engagement as 'active' | 'passive' | 'distracted',
      expertise: expertise as 'novice' | 'intermediate' | 'expert',
      taskUrgency: 'medium',
      sessionGoal: this.inferSessionGoal(session)
    };
  }
  
  private inferSessionGoal(session: UserSession): SessionGoal {
    if (session.queries.length === 0) return 'information_seeking';
    
    const intents = session.queries.map(q => q.intent.primary);
    const mostCommon = this.getMostCommonIntent(intents);
    
    const intentToGoalMap: Record<string, SessionGoal> = {
      'informational': 'information_seeking',
      'troubleshooting': 'problem_solving',
      'procedural': 'learning',
      'verification': 'verification',
      'exploratory': 'exploration',
      'transactional': 'task_completion',
      'investigational': 'research'
    };
    
    return intentToGoalMap[mostCommon] || 'information_seeking';
  }
  
  private getMostCommonIntent(intents: string[]): string {
    const counts = new Map<string, number>();
    for (const intent of intents) {
      counts.set(intent, (counts.get(intent) || 0) + 1);
    }
    
    let maxCount = 0;
    let mostCommon = 'informational';
    for (const [intent, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = intent;
      }
    }
    
    return mostCommon;
  }
  
  private calculateTimeFromLastQuery(session: UserSession): number {
    if (session.queries.length === 0) return 0;
    return Date.now() - session.queries[session.queries.length - 1].timestamp;
  }
  
  private updateQueryReaction(
    session: UserSession,
    queryId: string,
    interactionType: InteractionType,
    interaction: UserInteraction
  ): void {
    const query = session.queries.find(q => q.id === queryId);
    if (!query) return;
    
    switch (interactionType) {
      case 'result_clicked':
        if (interaction.context.resultPosition !== undefined) {
          query.userReaction.clickedResults.push(interaction.context.resultPosition);
        }
        break;
        
      case 'search_initiated':
        // Check if this is a refinement
        if (session.queries.length > 1) {
          const prevQuery = session.queries[session.queries.length - 2];
          if (this.isRefinement(prevQuery.query, query.query)) {
            prevQuery.userReaction.refinementFollowed = true;
          }
        }
        break;
    }
  }
  
  private isRefinement(prevQuery: string, currentQuery: string): boolean {
    // Simple refinement detection
    const prevTokens = new Set(prevQuery.toLowerCase().split(/\s+/));
    const currentTokens = new Set(currentQuery.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...prevTokens].filter(x => currentTokens.has(x)));
    const similarity = intersection.size / Math.max(prevTokens.size, currentTokens.size);
    
    return similarity > 0.5 && similarity < 1.0;
  }
  
  private checkBehavioralFlags(session: UserSession, interaction: UserInteraction): void {
    // Check for rapid queries (potential bot behavior)
    if (session.queries.length > 10) {
      const recentQueries = session.queries.slice(-10);
      const timeSpan = recentQueries[9].timestamp - recentQueries[0].timestamp;
      if (timeSpan < 30000) { // 30 seconds for 10 queries
        session.flags.push({
          type: 'potential_bot',
          severity: 'warning',
          description: 'Rapid query submission detected',
          timestamp: Date.now(),
          autoResolvable: false
        });
      }
    }
    
    // Check for zero engagement
    if (session.interactions.length > 20 && 
        session.interactions.filter(i => i.type === 'result_clicked').length === 0) {
      session.flags.push({
        type: 'zero_engagement',
        severity: 'warning',
        description: 'No result clicks despite many interactions',
        timestamp: Date.now(),
        autoResolvable: false
      });
    }
  }
  
  private updateSessionMetrics(session: UserSession): void {
    session.metrics.queryCount = session.queries.length;
    
    if (session.queries.length > 0) {
      // Calculate refinement rate
      let refinements = 0;
      for (let i = 1; i < session.queries.length; i++) {
        if (this.isRefinement(session.queries[i-1].query, session.queries[i].query)) {
          refinements++;
        }
      }
      session.metrics.refinementRate = refinements / session.queries.length;
      
      // Calculate average complexity
      session.metrics.avgQueryComplexity = session.queries
        .reduce((sum, q) => sum + q.complexity.overall, 0) / session.queries.length;
      
      // Calculate click-through rate
      const queriesWithClicks = session.queries.filter(q => q.userReaction.clickedResults.length > 0).length;
      session.metrics.clickThroughRate = queriesWithClicks / session.queries.length;
      
      // Calculate success rate (based on outcomes)
      const successfulOutcomes = session.outcomes.filter(o => o.achieved).length;
      session.metrics.successRate = session.outcomes.length > 0 ? 
        successfulOutcomes / session.outcomes.length : 0;
    }
    
    // Calculate engagement score
    session.metrics.engagementScore = this.calculateEngagementScore(session);
    
    // Calculate efficiency score
    session.metrics.efficiencyScore = this.calculateEfficiencyScore(session);
    
    // Calculate satisfaction score
    session.metrics.satisfactionScore = this.calculateSatisfactionScore(session);
  }
  
  private calculateEngagementScore(session: UserSession): number {
    let score = 0;
    
    // Base score from interaction count
    score += Math.min(0.4, session.interactions.length / 50);
    
    // Bonus for diverse interaction types
    const interactionTypes = new Set(session.interactions.map(i => i.type));
    score += Math.min(0.3, interactionTypes.size / 10);
    
    // Bonus for result clicks
    const resultClicks = session.interactions.filter(i => i.type === 'result_clicked').length;
    score += Math.min(0.3, resultClicks / 10);
    
    return Math.min(1.0, score);
  }
  
  private calculateEfficiencyScore(session: UserSession): number {
    if (session.queries.length === 0) return 0;
    
    let score = 1.0;
    
    // Penalty for excessive queries
    if (session.queries.length > 10) {
      score -= (session.queries.length - 10) * 0.05;
    }
    
    // Penalty for high refinement rate
    score -= session.metrics.refinementRate * 0.3;
    
    // Bonus for quick success
    const avgTimePerQuery = session.duration / session.queries.length;
    if (avgTimePerQuery < 30000) { // Less than 30 seconds per query
      score += 0.2;
    }
    
    return Math.max(0, Math.min(1.0, score));
  }
  
  private calculateSatisfactionScore(session: UserSession): number {
    if (session.outcomes.length === 0) return 0.5;
    
    // Average satisfaction from outcomes
    return session.outcomes.reduce((sum, o) => sum + o.satisfaction, 0) / session.outcomes.length;
  }
  
  private finalizeSessionMetrics(session: UserSession): void {
    // Calculate final metrics
    if (session.queries.length > 0) {
      session.metrics.timePerQuery = session.duration / session.queries.length;
    }
    
    // Calculate bounce rate (single query with no clicks)
    if (session.queries.length === 1 && 
        session.queries[0].userReaction.clickedResults.length === 0) {
      session.metrics.bounceRate = 1.0;
    }
  }
  
  private detectRealTimePatterns(session: UserSession, query?: SessionQuery): void {
    for (const detector of this.patternDetectors) {
      const pattern = detector.detect(session);
      if (pattern && pattern.confidence > this.config.patternDetection.confidenceThreshold) {
        this.addSessionPattern(session, pattern);
      }
    }
  }
  
  private detectSessionPatterns(session: UserSession): void {
    // Final pattern detection for completed session
    this.detectRealTimePatterns(session);
    
    // Additional patterns for completed sessions
    const completionPattern = this.detectCompletionPattern(session);
    if (completionPattern) {
      this.addSessionPattern(session, completionPattern);
    }
  }
  
  private addSessionPattern(session: UserSession, pattern: BehaviorPattern): void {
    // Check if pattern already exists
    const existing = session.patterns.find(p => p.type === pattern.type);
    if (existing) {
      existing.confidence = Math.max(existing.confidence, pattern.confidence);
      existing.frequency++;
    } else {
      session.patterns.push(pattern);
      
      // Update global pattern tracking
      const globalPattern = this.behaviorPatterns.get(pattern.id);
      if (globalPattern) {
        globalPattern.frequency++;
      } else {
        this.behaviorPatterns.set(pattern.id, { ...pattern, frequency: 1 });
      }
    }
  }
  
  // Pattern detection methods
  
  private detectRefinementCycle(session: UserSession): BehaviorPattern | null {
    if (session.queries.length < 3) return null;
    
    const recentQueries = session.queries.slice(-5);
    let refinements = 0;
    
    for (let i = 1; i < recentQueries.length; i++) {
      if (this.isRefinement(recentQueries[i-1].query, recentQueries[i].query)) {
        refinements++;
      }
    }
    
    if (refinements >= 2) {
      return {
        id: `refinement-cycle-${session.id}`,
        type: 'query_refinement_cycle',
        description: 'User is iteratively refining queries',
        confidence: Math.min(1.0, refinements / 3),
        frequency: 1,
        impact: 'neutral',
        recommendation: 'Provide query suggestions or search tips'
      };
    }
    
    return null;
  }
  
  private detectBrowsingPattern(session: UserSession): BehaviorPattern | null {
    const resultClicks = session.interactions.filter(i => i.type === 'result_clicked');
    if (resultClicks.length < 3) return null;
    
    // Check if user is browsing systematically (clicking results in order)
    let sequential = 0;
    for (let i = 1; i < resultClicks.length; i++) {
      const prevPos = resultClicks[i-1].context.resultPosition || 0;
      const currPos = resultClicks[i].context.resultPosition || 0;
      if (currPos === prevPos + 1) {
        sequential++;
      }
    }
    
    if (sequential >= 2) {
      return {
        id: `browsing-pattern-${session.id}`,
        type: 'result_browsing_pattern',
        description: 'User browses results systematically',
        confidence: sequential / resultClicks.length,
        frequency: 1,
        impact: 'positive',
        recommendation: 'Optimize result ordering and presentation'
      };
    }
    
    return null;
  }
  
  private detectLearningProgression(session: UserSession): BehaviorPattern | null {
    if (session.queries.length < 3) return null;
    
    // Check if query complexity is increasing over time
    const complexities = session.queries.map(q => q.complexity.overall);
    let increasing = 0;
    
    for (let i = 1; i < complexities.length; i++) {
      if (complexities[i] > complexities[i-1]) {
        increasing++;
      }
    }
    
    if (increasing >= complexities.length * 0.6) {
      return {
        id: `learning-progression-${session.id}`,
        type: 'learning_progression',
        description: 'User is progressing to more complex queries',
        confidence: increasing / complexities.length,
        frequency: 1,
        impact: 'positive',
        recommendation: 'Provide advanced search features and tutorials'
      };
    }
    
    return null;
  }
  
  private detectEfficiencyOptimization(session: UserSession): BehaviorPattern | null {
    if (session.queries.length < 5) return null;
    
    // Check if user is getting faster at finding results
    const times: number[] = [];
    for (let i = 0; i < session.queries.length; i++) {
      const query = session.queries[i];
      const firstClick = session.interactions.find(interaction => 
        interaction.context.queryId === query.id && interaction.type === 'result_clicked'
      );
      
      if (firstClick) {
        times.push(firstClick.timestamp - query.timestamp);
      }
    }
    
    if (times.length >= 3) {
      const firstHalf = times.slice(0, Math.floor(times.length / 2));
      const secondHalf = times.slice(Math.floor(times.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, t) => sum + t, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, t) => sum + t, 0) / secondHalf.length;
      
      if (secondAvg < firstAvg * 0.8) { // 20% improvement
        return {
          id: `efficiency-optimization-${session.id}`,
          type: 'efficiency_optimization',
          description: 'User is becoming more efficient at finding results',
          confidence: (firstAvg - secondAvg) / firstAvg,
          frequency: 1,
          impact: 'positive',
          recommendation: 'Recognize user expertise and offer advanced features'
        };
      }
    }
    
    return null;
  }
  
  private detectCompletionPattern(session: UserSession): BehaviorPattern | null {
    const successful = session.outcomes.filter(o => o.achieved).length;
    const total = session.outcomes.length;
    
    if (total === 0) return null;
    
    const successRate = successful / total;
    
    if (successRate >= 0.8) {
      return {
        id: `success-pattern-${session.id}`,
        type: 'success_pattern',
        description: 'User successfully completed most tasks',
        confidence: successRate,
        frequency: 1,
        impact: 'positive'
      };
    }
    
    return null;
  }
  
  private updateUserProfile(userId: string, event: string, data: any): void {
    let profile = this.userProfiles.get(userId);
    
    if (!profile) {
      profile = this.createUserProfile(userId);
      this.userProfiles.set(userId, profile);
    }
    
    profile.lastSeen = Date.now();
    
    if (event === 'session_started') {
      profile.totalSessions++;
    } else if (event === 'session_ended') {
      this.updateProfileFromSession(profile, data as UserSession);
    }
  }
  
  private createUserProfile(userId: string): UserProfile {
    return {
      userId,
      created: Date.now(),
      lastSeen: Date.now(),
      totalSessions: 0,
      totalQueries: 0,
      expertise: {
        level: 'novice',
        domains: {},
        progression: []
      },
      preferences: {
        queryComplexity: 'simple',
        resultFormat: [],
        topics: [],
        searchStyle: {
          approach: 'systematic',
          refinementStrategy: 'additive',
          resultExamination: 'thorough',
          decisionMaking: 'deliberate'
        }
      },
      patterns: {
        searchTiming: {
          preferredTimes: [],
          sessionFrequency: 'occasional',
          urgencyDistribution: {}
        },
        sessionDuration: {
          typical: 300000, // 5 minutes
          range: { min: 60000, max: 1800000 },
          efficiency: 0.5,
          focusLevel: 0.5
        },
        queryTypes: {
          informational: 0.5,
          navigational: 0.2,
          transactional: 0.1,
          investigational: 0.2
        },
        successFactors: []
      },
      metrics: {
        avgSessionLength: 0,
        avgQueriesPerSession: 0,
        successRate: 0.5,
        satisfactionScore: 0.5,
        learningVelocity: 0
      }
    };
  }
  
  private updateProfileFromSession(profile: UserProfile, session: UserSession): void {
    // Update basic metrics
    profile.totalQueries += session.queries.length;
    
    // Update averages
    const sessionCount = profile.totalSessions;
    profile.metrics.avgSessionLength = (profile.metrics.avgSessionLength * (sessionCount - 1) + session.duration) / sessionCount;
    profile.metrics.avgQueriesPerSession = profile.totalQueries / sessionCount;
    profile.metrics.successRate = (profile.metrics.successRate * (sessionCount - 1) + session.metrics.successRate) / sessionCount;
    profile.metrics.satisfactionScore = (profile.metrics.satisfactionScore * (sessionCount - 1) + session.metrics.satisfactionScore) / sessionCount;
    
    // Update expertise based on query complexity
    const avgComplexity = session.metrics.avgQueryComplexity;
    if (avgComplexity > 0.7 && session.metrics.successRate > 0.7) {
      profile.expertise.level = 'expert';
    } else if (avgComplexity > 0.4 && session.metrics.successRate > 0.5) {
      profile.expertise.level = 'intermediate';
    }
    
    // Update query type distribution
    const intentCounts = new Map<string, number>();
    for (const query of session.queries) {
      const intent = query.intent.primary;
      intentCounts.set(intent, (intentCounts.get(intent) || 0) + 1);
    }
    
    for (const [intent, count] of intentCounts.entries()) {
      const proportion = count / session.queries.length;
      switch (intent) {
        case 'informational':
          profile.patterns.queryTypes.informational = (profile.patterns.queryTypes.informational + proportion) / 2;
          break;
        case 'navigational':
          profile.patterns.queryTypes.navigational = (profile.patterns.queryTypes.navigational + proportion) / 2;
          break;
        case 'transactional':
          profile.patterns.queryTypes.transactional = (profile.patterns.queryTypes.transactional + proportion) / 2;
          break;
        case 'investigational':
          profile.patterns.queryTypes.investigational = (profile.patterns.queryTypes.investigational + proportion) / 2;
          break;
      }
    }
  }
  
  private updateAllUserProfiles(): void {
    // Periodic update of all user profiles
    for (const profile of this.userProfiles.values()) {
      this.updateUserProgression(profile);
    }
  }
  
  private updateUserProgression(profile: UserProfile): void {
    // Add progression metrics
    const now = Date.now();
    const recentProgression = profile.expertise.progression.filter(p => now - p.timestamp < 30 * 24 * 60 * 60 * 1000); // Last 30 days
    
    if (recentProgression.length < 30) { // Add daily progression points
      profile.expertise.progression.push({
        timestamp: now,
        metric: 'success_rate',
        value: profile.metrics.successRate,
        trend: 'stable'
      });
    }
  }
  
  private cleanupSessionHistory(): void {
    const now = Date.now();
    const cutoff = now - this.config.storage.retentionPeriod;
    
    this.sessionHistory = this.sessionHistory.filter(session => session.startTime > cutoff);
    
    // Also limit by count
    if (this.sessionHistory.length > this.config.storage.maxSessions) {
      this.sessionHistory.sort((a, b) => b.startTime - a.startTime);
      this.sessionHistory = this.sessionHistory.slice(0, this.config.storage.maxSessions);
    }
  }
  
  private getSessionsInRange(timeRange?: { from: number; to: number }): UserSession[] {
    const allSessions = [...this.sessionHistory, ...Array.from(this.activeSessions.values())];
    
    if (!timeRange) return allSessions;
    
    return allSessions.filter(session => 
      session.startTime >= timeRange.from && session.startTime <= timeRange.to
    );
  }
  
  // Report generation methods
  
  private calculateUserMetrics(sessions: UserSession[]): BehaviorAnalysisReport['userMetrics'] {
    const userIds = new Set(sessions.map(s => s.userId).filter(Boolean));
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    
    const activeSessions = sessions.filter(s => s.lastActivity > dayAgo);
    const activeUsers = new Set(activeSessions.map(s => s.userId).filter(Boolean)).size;
    
    // Simple heuristic for new vs returning users
    const newUsers = Math.floor(userIds.size * 0.3); // Assume 30% are new
    const returningUsers = userIds.size - newUsers;
    
    return {
      totalUsers: userIds.size,
      activeUsers,
      newUsers,
      returningUsers
    };
  }
  
  private calculateSessionMetrics(sessions: UserSession[]): BehaviorAnalysisReport['sessionMetrics'] {
    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        avgSessionDuration: 0,
        avgQueriesPerSession: 0,
        bounceRate: 0
      };
    }
    
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const totalQueries = sessions.reduce((sum, s) => sum + s.queries.length, 0);
    const bouncedSessions = sessions.filter(s => s.metrics.bounceRate > 0).length;
    
    return {
      totalSessions: sessions.length,
      avgSessionDuration: totalDuration / sessions.length,
      avgQueriesPerSession: totalQueries / sessions.length,
      bounceRate: bouncedSessions / sessions.length
    };
  }
  
  private calculateEngagementMetrics(sessions: UserSession[]): BehaviorAnalysisReport['engagementMetrics'] {
    if (sessions.length === 0) {
      return {
        clickThroughRate: 0,
        timeOnResults: 0,
        interactionDepth: 0,
        returnRate: 0
      };
    }
    
    const totalCTR = sessions.reduce((sum, s) => sum + s.metrics.clickThroughRate, 0);
    const totalInteractions = sessions.reduce((sum, s) => sum + s.interactions.length, 0);
    
    // Simple return rate calculation
    const userIds = new Set(sessions.map(s => s.userId).filter(Boolean));
    const multiSessionUsers = new Set();
    for (const userId of userIds) {
      const userSessions = sessions.filter(s => s.userId === userId);
      if (userSessions.length > 1) {
        multiSessionUsers.add(userId);
      }
    }
    
    return {
      clickThroughRate: totalCTR / sessions.length,
      timeOnResults: 30000, // Placeholder
      interactionDepth: totalInteractions / sessions.length,
      returnRate: multiSessionUsers.size / userIds.size
    };
  }
  
  private categorizeBehaviorPatterns(): BehaviorAnalysisReport['behaviorPatterns'] {
    const allPatterns = Array.from(this.behaviorPatterns.values());
    
    return {
      common: allPatterns.filter(p => p.frequency > 10).slice(0, 5),
      emerging: allPatterns.filter(p => p.frequency > 2 && p.frequency <= 10).slice(0, 5),
      concerning: allPatterns.filter(p => p.impact === 'negative').slice(0, 3)
    };
  }
  
  private identifyUserSegments(sessions: UserSession[]): UserSegment[] {
    // Simple segmentation based on behavior patterns
    const segments: UserSegment[] = [
      {
        id: 'power-users',
        name: 'Power Users',
        description: 'Users with high query complexity and engagement',
        size: Math.floor(sessions.length * 0.15),
        characteristics: [
          { dimension: 'query_complexity', value: 'high', importance: 0.9 },
          { dimension: 'session_duration', value: 'long', importance: 0.8 }
        ],
        behavior: {
          searchFrequency: 0.8,
          sessionDuration: 1800000, // 30 minutes
          queryComplexity: 0.8,
          successRate: 0.9,
          satisfactionScore: 0.8,
          preferredTopics: ['advanced', 'technical']
        },
        value: 0.9,
        growth: 0.1
      },
      {
        id: 'casual-users',
        name: 'Casual Users',
        description: 'Users with simple queries and moderate engagement',
        size: Math.floor(sessions.length * 0.6),
        characteristics: [
          { dimension: 'query_complexity', value: 'simple', importance: 0.7 },
          { dimension: 'session_frequency', value: 'occasional', importance: 0.6 }
        ],
        behavior: {
          searchFrequency: 0.3,
          sessionDuration: 600000, // 10 minutes
          queryComplexity: 0.3,
          successRate: 0.6,
          satisfactionScore: 0.7,
          preferredTopics: ['basic', 'how-to']
        },
        value: 0.5,
        growth: 0.05
      }
    ];
    
    return segments;
  }
  
  private calculateBehaviorTrends(sessions: UserSession[]): BehaviorTrend[] {
    // Simplified trend calculation
    return [
      {
        metric: 'session_duration',
        direction: 'increasing',
        magnitude: 0.1,
        significance: 0.7,
        timeframe: '30 days',
        drivers: ['user_engagement', 'content_quality']
      }
    ];
  }
  
  private generateBehaviorInsights(sessions: UserSession[]): BehaviorInsight[] {
    const insights: BehaviorInsight[] = [];
    
    // Average session duration insight
    const avgDuration = sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length;
    if (avgDuration > 1800000) { // 30 minutes
      insights.push({
        category: 'user_experience',
        insight: 'Users are spending significant time in search sessions, indicating either high engagement or difficulty finding information',
        confidence: 0.8,
        impact: 'medium',
        actionability: 0.7,
        supportingData: [{ metric: 'avg_duration', value: avgDuration }]
      });
    }
    
    return insights;
  }
  
  private generateBehaviorRecommendations(sessions: UserSession[]): BehaviorRecommendation[] {
    const recommendations: BehaviorRecommendation[] = [];
    
    // Query complexity recommendation
    const avgComplexity = sessions.reduce((sum, s) => sum + s.metrics.avgQueryComplexity, 0) / sessions.length;
    if (avgComplexity < 0.3) {
      recommendations.push({
        category: 'features',
        recommendation: 'Introduce advanced search features gradually to help users create more effective queries',
        priority: 0.7,
        expectedImpact: 0.6,
        implementation: 'moderate'
      });
    }
    
    return recommendations;
  }
  
  private getEmptyBehaviorReport(timeRange?: { from: number; to: number }): BehaviorAnalysisReport {
    return {
      timeRange: timeRange || { from: 0, to: Date.now() },
      userMetrics: {
        totalUsers: 0,
        activeUsers: 0,
        newUsers: 0,
        returningUsers: 0
      },
      sessionMetrics: {
        totalSessions: 0,
        avgSessionDuration: 0,
        avgQueriesPerSession: 0,
        bounceRate: 0
      },
      engagementMetrics: {
        clickThroughRate: 0,
        timeOnResults: 0,
        interactionDepth: 0,
        returnRate: 0
      },
      behaviorPatterns: {
        common: [],
        emerging: [],
        concerning: []
      },
      userSegments: [],
      trends: [],
      insights: [],
      recommendations: []
    };
  }
  
  private createEmptySession(sessionId: string): UserSession {
    return {
      id: sessionId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      duration: 0,
      isActive: false,
      device: this.buildDeviceInfo(),
      queries: [],
      interactions: [],
      outcomes: [],
      metrics: this.initializeSessionMetrics(),
      patterns: [],
      flags: []
    };
  }
  
  // Utility methods
  
  private anonymizeUserId(userId?: string): string | undefined {
    if (!userId) return undefined;
    // Simple anonymization - in practice would use proper hashing
    return `user_${btoa(userId).substring(0, 8)}`;
  }
  
  private anonymizeQuery(query: string): string {
    // Simple query anonymization
    return query.replace(/\b\d+\b/g, '[NUM]').replace(/\b[A-Z]{2,}\b/g, '[ACRONYM]');
  }
  
  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateInteractionId(): string {
    return `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Pattern detector interface
interface PatternDetector {
  id: string;
  detect: (session: UserSession) => BehaviorPattern | null;
}

export default UserBehaviorTracker;