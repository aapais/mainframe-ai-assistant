import { SearchResult, SearchOptions } from '../../types/services';
import { ParsedQuery } from '../search/QueryParser';
export interface FailedSearch {
  id: string;
  query: string;
  parsedQuery: ParsedQuery;
  timestamp: number;
  userId?: string;
  sessionId?: string;
  failureType: FailureType;
  failureReasons: FailureReason[];
  context: SearchContext;
  attemptedSolutions: string[];
  userActions: UserAction[];
  resolved: boolean;
  resolutionMethod?: ResolutionMethod;
  resolutionTime?: number;
}
export type FailureType =
  | 'zero_results'
  | 'poor_relevance'
  | 'timeout'
  | 'error'
  | 'incomplete_results'
  | 'user_abandoned'
  | 'refinement_loop';
export interface FailureReason {
  type: FailureReasonType;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggestedFix?: string;
}
export type FailureReasonType =
  | 'content_gap'
  | 'query_complexity'
  | 'terminology_mismatch'
  | 'scope_too_broad'
  | 'scope_too_narrow'
  | 'spelling_error'
  | 'syntax_error'
  | 'index_issue'
  | 'system_performance'
  | 'user_expectation';
export interface SearchContext {
  previousQueries: string[];
  searchSession: {
    startTime: number;
    queryCount: number;
    refinementCount: number;
    clickThroughRate: number;
  };
  userProfile?: {
    expertise: 'beginner' | 'intermediate' | 'expert';
    frequentTopics: string[];
    successfulPatterns: string[];
  };
  systemState: {
    indexHealth: number;
    responseTime: number;
    errorRate: number;
  };
}
export interface UserAction {
  type: UserActionType;
  timestamp: number;
  details: any;
}
export type UserActionType =
  | 'query_refinement'
  | 'filter_applied'
  | 'result_clicked'
  | 'result_rated'
  | 'search_abandoned'
  | 'help_requested'
  | 'feedback_provided';
export type ResolutionMethod =
  | 'query_suggestion'
  | 'content_creation'
  | 'user_guidance'
  | 'system_fix'
  | 'manual_intervention'
  | 'user_education';
export interface FailurePattern {
  id: string;
  pattern: string | RegExp;
  failureType: FailureType;
  commonReasons: FailureReasonType[];
  frequency: number;
  successRate: number;
  resolutionStrategies: ResolutionStrategy[];
  examples: string[];
}
export interface ResolutionStrategy {
  method: ResolutionMethod;
  description: string;
  effectiveness: number;
  automationLevel: 'manual' | 'semi-automatic' | 'automatic';
  requiredResources: string[];
}
export interface FailureAnalysisReport {
  timeRange: {
    from: number;
    to: number;
  };
  summary: {
    totalFailures: number;
    uniqueFailures: number;
    resolutionRate: number;
    avgResolutionTime: number;
  };
  failureDistribution: Record<FailureType, number>;
  reasonDistribution: Record<FailureReasonType, number>;
  topFailurePatterns: FailurePattern[];
  contentGaps: ContentGap[];
  systemIssues: SystemIssue[];
  userBehaviorInsights: UserBehaviorInsight[];
  recommendations: FailureRecommendation[];
  trends: FailureTrend[];
}
export interface ContentGap {
  topic: string;
  queries: string[];
  frequency: number;
  userDemand: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  suggestedContent: string[];
  relatedTopics: string[];
}
export interface SystemIssue {
  type: 'performance' | 'index' | 'algorithm' | 'infrastructure';
  description: string;
  impact: number;
  frequency: number;
  affectedQueries: string[];
  recommendedFix: string;
}
export interface UserBehaviorInsight {
  pattern: string;
  description: string;
  prevalence: number;
  impact: 'positive' | 'negative' | 'neutral';
  recommendation: string;
}
export interface FailureRecommendation {
  type: 'immediate' | 'short_term' | 'long_term';
  category: 'content' | 'system' | 'user_experience' | 'training';
  description: string;
  priority: number;
  estimatedImpact: number;
  requiredEffort: 'low' | 'medium' | 'high';
}
export interface FailureTrend {
  metric: string;
  direction: 'improving' | 'worsening' | 'stable';
  rate: number;
  significance: number;
  timeframe: string;
}
export declare class FailedSearchDetector {
  private failedSearches;
  private failurePatterns;
  private contentGaps;
  private resolutionStrategies;
  private userSessions;
  private readonly config;
  constructor(config?: Partial<typeof FailedSearchDetector.prototype.config>);
  detectFailure(
    query: string,
    parsedQuery: ParsedQuery,
    results: SearchResult[],
    processingTime: number,
    options?: SearchOptions,
    userId?: string,
    sessionId?: string
  ): {
    isFailed: boolean;
    failedSearch?: FailedSearch;
    suggestions?: string[];
    autoResolution?: ResolutionMethod;
  };
  recordUserAction(failureId: string, action: UserActionType, details: any): void;
  markAsResolved(
    failureId: string,
    resolutionMethod: ResolutionMethod,
    resolutionTime?: number
  ): void;
  generateFailureReport(timeRange?: { from: number; to: number }): FailureAnalysisReport;
  getRecoverySuggestions(
    query: string,
    failureType: FailureType,
    context?: SearchContext
  ): Array<{
    type: ResolutionMethod;
    suggestion: string;
    confidence: number;
    effort: 'low' | 'medium' | 'high';
  }>;
  exportFailureData(): {
    failures: FailedSearch[];
    patterns: FailurePattern[];
    contentGaps: ContentGap[];
    report: FailureAnalysisReport;
  };
  private initializeFailurePatterns;
  private initializeResolutionStrategies;
  private determineFailureType;
  private createFailedSearchRecord;
  private buildSearchContext;
  private analyzeFailureReasons;
  private analyzeZeroResultsReasons;
  private analyzePoorRelevanceReasons;
  private checkCommonIssues;
  private generateFailureSuggestions;
  private attemptAutoResolution;
  private updateSessionTracking;
  private updateFailurePatterns;
  private hasPotentialSpellingErrors;
  private isOverlySpecific;
  private indicatesContentGap;
  private hasSyntaxErrors;
  private matchesPattern;
  private isResolutionAction;
  private getResolutionMethod;
  private updateResolutionEffectiveness;
  private getUserProfile;
  private getFailuresInRange;
  private calculateSummaryStats;
  private calculateFailureDistribution;
  private calculateReasonDistribution;
  private getTopFailurePatterns;
  private identifyContentGaps;
  private identifySystemIssues;
  private analyzeUserBehavior;
  private generateRecommendations;
  private calculateFailureTrends;
  private findSimilarFailures;
  private calculateQuerySimilarity;
  private getResolutionStrategy;
  private getGeneralRecoverySuggestions;
  private extractTopic;
  private getEmptyReport;
  private generateFailureId;
}
export default FailedSearchDetector;
//# sourceMappingURL=FailedSearchDetector.d.ts.map
